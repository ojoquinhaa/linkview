# Integração de Nota Fiscal (NFS-e) — emissão pós-pagamento + envio por e-mail

## Objetivo

Emitir automaticamente a **NFS-e** (nota fiscal de serviço) após cada pagamento
confirmado da assinatura no Asaas e entregar o PDF ao cliente por e-mail.

**Decisão (definida):** **dois e-mails separados** — o recibo continua saindo na
hora do pagamento (inalterado) e um **novo e-mail "Sua nota fiscal"** é enviado
quando a nota é autorizada (`INVOICE_AUTHORIZED`, ~15 min depois). Escolhido por ser
mais simples e robusto; não depende de segurar o recibo esperando a prefeitura.

---

## 1. Como o Asaas faz (resultado do estudo via MCP)

### Pré-requisitos de conta (uma vez, no painel/`fiscalInfo`)

- Empresa precisa ser **PJ** com inscrição municipal e certificado digital
  configurados no Asaas (`POST /v3/fiscalInfo`, `POST /v3/fiscalInfo/nationalPortal`).
- Isso é setup de conta, **não** entra no código do app. Confirmar que o emissor
  está habilitado no ambiente (sandbox e produção separados).

### Dois caminhos de emissão

**A) Config automática por assinatura (RECOMENDADO)**
`POST /v3/subscriptions/{id}/invoiceSettings` — configura uma vez; o Asaas passa a
**agendar e emitir NFS-e sozinho para cada cobrança** daquela assinatura (inclusive
renovações), sem precisar disparar nota a cada ciclo.
Campos-chave (`SubscriptionConfigureInvoiceRequestDTO`):
- `effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION"` → emite ao confirmar pagamento.
- `receivedOnly: true` → só emite se a cobrança foi paga.
- `municipalServiceId` **ou** `municipalServiceCode` + `municipalServiceName`
  (listar em `GET /v3/invoices/municipalServices`).
- `taxes` (obrigatório): `retainIss, iss, pis, cofins, csll, inss, ir` + situação
  tributária. Valores dependem do regime (Simples Nacional vs Regime Normal).
- `observations`, `deductions` opcionais.

**B) Agendamento manual por cobrança (fallback)**
`POST /v3/invoices` com `payment` (id da cobrança), `effectiveDate` (hoje →
emite em até ~15 min), `value`, `serviceDescription`, `taxes`.
Depois `POST /v3/invoices/{id}/authorize` só se quiser adiantar uma nota futura.

> Decisão: usar **(A)**. Menos código por ciclo, cobre renovações automaticamente,
> o Asaas cuida de agendamento/retentativa. **(B)** fica como recurso de reemissão
> manual (ex.: botão admin "reemitir nota").

### Ciclo de vida + webhook de nota fiscal (separado do webhook de pagamento)

Eventos (`event`): `INVOICE_CREATED` → `INVOICE_SYNCHRONIZED` →
`INVOICE_AUTHORIZED` (emitida, **PDF/XML prontos**) | `INVOICE_ERROR` |
`INVOICE_CANCELED` | `INVOICE_CANCELLATION_DENIED` | `INVOICE_PROCESSING_CANCELLATION`.
Status da nota: `SCHEDULED, AUTHORIZED, PROCESSING_CANCELLATION, CANCELED,
CANCELLATION_DENIED, ERROR`.
Payload traz: `invoice.id, invoice.status, invoice.payment, invoice.pdfUrl,
invoice.xmlUrl, invoice.number, invoice.validationCode`. `pdfUrl/xmlUrl/number/
validationCode` só vêm preenchidos **após `INVOICE_AUTHORIZED`**. Entrega
**at-least-once** → idempotência pelo `id` do evento (mesma tabela `billing_events`).

### Timing importante (o nó do problema)

O recibo hoje é enviado **na hora** do `PAYMENT_CONFIRMED`. A NFS-e só fica pronta
**~15 min depois**, num evento `INVOICE_AUTHORIZED` **separado**. Ou seja, no
momento do recibo atual a nota **ainda não existe**. Ver decisão na seção 3.

---

## 2. Mudanças no código

### 2.1 `asaas.ts` — novas funções
- `configureSubscriptionInvoices(subId, cfg)` → `POST /subscriptions/{id}/invoiceSettings`.
- `listMunicipalServices(filter?)` → `GET /invoices/municipalServices` (uso pontual/admin).
- (opcional B) `scheduleInvoice(input)` / `authorizeInvoice(id)` para reemissão manual.
- Tipar `AsaasInvoice { id, status, payment, pdfUrl, xmlUrl, number, validationCode, value }`.

### 2.2 Banco — nova tabela `fiscal_invoices` (`packages/db`)
Rastrear cada nota para evitar depender só do payload volátil e permitir reenvio:
```
fiscal_invoices:
  id (uuid pk)
  workspaceId (fk)
  subscriptionId (fk, nullable)
  providerInvoiceId (text, unique)   -- inv_xxx
  paymentId (text)                   -- pay_xxx
  status (text)                      -- SCHEDULED/AUTHORIZED/ERROR/CANCELED...
  pdfUrl, xmlUrl (text, nullable)
  number, validationCode (text, nullable)
  valueCents (int)
  emailedAt (timestamp, nullable)    -- dedup do envio da nota por e-mail
  + timestamps
  index(workspaceId), index(paymentId)
```
Migration Drizzle (próximo número após `0012`).

### 2.3 Config no checkout
Após `createSubscription` (em `subscription.ts`), chamar
`configureSubscriptionInvoices(sub.id, {...})` com `effectiveDatePeriod:
ON_PAYMENT_CONFIRMATION`, `receivedOnly: true`, serviço municipal + `taxes` (vindos
de env/config: `ASAAS_NFSE_MUNICIPAL_SERVICE_CODE`, `ASAAS_NFSE_ISS`, etc.).
Best-effort: falha na config **não** deve derrubar o checkout (loga e segue;
backfill via cron/admin). Aplicar também às assinaturas já existentes (script único).

### 2.4 Webhook — tratar eventos `INVOICE_*`
No `apps/web/src/app/api/billing/webhook/route.ts` (mesma URL, mesmo token; a fila
de nota fiscal é configurada à parte no painel apontando para cá):
- Estender `AsaasPayload` com `invoice?`.
- Idempotência já coberta por `billing_events` (usa `payload.id`).
- `INVOICE_CREATED/SYNCHRONIZED/UPDATED` → upsert em `fiscal_invoices` (status, ids).
- `INVOICE_AUTHORIZED` → gravar `pdfUrl/xmlUrl/number/validationCode`, status
  `AUTHORIZED`, e **enviar o e-mail da nota** (novo, separado do recibo). Dedup
  pelo `emailedAt` de `fiscal_invoices`.
- `INVOICE_ERROR` → status `ERROR`, log/alerta (sem e-mail).
- `INVOICE_CANCELED` → status `CANCELED`.

### 2.5 E-mail (`lib/email.ts`) — novo `sendFiscalInvoiceEmail`
Novo e-mail dedicado "Sua nota fiscal está disponível", reaproveitando o `layout()`
existente:
- assunto: "Sua nota fiscal — linkview";
- corpo: nº da nota + botão "Baixar nota fiscal" (`pdfUrl`);
- **anexo** do PDF oficial via Resend `attachments`
  (`{ filename, content }` base64 buscado de `pdfUrl`, ou `{ filename, path: pdfUrl }`).
- `sendPaymentReceiptEmail` (recibo) **fica inalterado**.

---

## 3. Fluxo de e-mail (decidido: dois e-mails separados)

1. `PAYMENT_CONFIRMED` → **recibo** atual dispara na hora (inalterado).
2. ~15 min depois, `INVOICE_AUTHORIZED` → **novo e-mail da nota** com PDF anexado.

Sem gate compartilhado, sem backstop no cron: se a nota falhar (`INVOICE_ERROR`),
o recibo já foi entregue e o cliente não fica sem comprovante de pagamento. Dedup do
e-mail da nota via `fiscal_invoices.emailedAt` (evita reenvio em entregas
duplicadas do webhook).

---

## 4. Ordem de implementação

1. `packages/db`: tabela `fiscal_invoices` + migration.
2. `asaas.ts`: `configureSubscriptionInvoices`, `listMunicipalServices`, tipos.
3. Env/config: código do serviço municipal + alíquotas (`packages/config`).
4. Checkout: configurar invoiceSettings pós-`createSubscription` + backfill das ativas.
5. Webhook: ramo `INVOICE_*` (upsert + `sendFiscalInvoiceEmail` no `AUTHORIZED`).
6. E-mail: `sendFiscalInvoiceEmail` com anexo NFS-e (recibo fica intacto).
7. Testes em **sandbox**: assinar → confirmar pagamento (endpoint sandbox) →
   verificar `INVOICE_AUTHORIZED` → PDF no e-mail da nota. Validar idempotência
   (evento duplicado) e caminho de erro (`INVOICE_ERROR` não envia e-mail).

## 5. Riscos / notas
- `fiscalInfo` (certificado/inscrição) precisa estar OK em **produção** — sandbox
  não garante emissão real.
- `taxes` erradas = nota rejeitada pela prefeitura; validar com contador.
- Nem toda prefeitura retorna lista de serviços municipais → usar
  `municipalServiceCode` fixo por env.
- Webhook de nota fiscal é uma **fila separada** no painel Asaas: precisa ser criada
  apontando para a mesma URL/token.
