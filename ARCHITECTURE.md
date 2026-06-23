# ARCHITECTURE.md

# SaaS de Links Rastreáveis, QR Codes e Campanhas

## 1. Visão geral

Este documento descreve a arquitetura técnica, funcional e estratégica de um SaaS de encurtamento, gerenciamento e rastreamento de links voltado principalmente para o mercado brasileiro.

A ideia inicial do produto é criar uma alternativa simples, barata e nacional a ferramentas como Bitly, TinyURL e Linktree, mas com foco mais prático em pequenos negócios, profissionais autônomos, agências, lojas locais, restaurantes, clínicas, infoprodutores, vendedores, prestadores de serviço e empresas que usam WhatsApp, Instagram, QR Code e campanhas digitais no dia a dia.

O produto não deve ser posicionado apenas como um “encurtador de links”. A proposta mais forte é:

“Uma plataforma simples para criar links rastreáveis, QR Codes e campanhas, entendendo quais canais realmente geram cliques, conversas e oportunidades.”

A primeira versão deve ser simples, rápida de construir e barata de manter. A arquitetura foi pensada para permitir um MVP enxuto, mas com base suficiente para evoluir para um SaaS mais robusto no futuro.

---

## 2. Objetivo do produto

O produto deve permitir que o usuário:

- Crie links curtos personalizados.
- Rastreie acessos e cliques.
- Gere QR Codes automaticamente.
- Organize links por campanhas.
- Crie links de WhatsApp com mensagem pronta.
- Visualize métricas simples e úteis.
- Entenda quais links, campanhas e canais geram mais resultado.
- Use o produto sem depender de ferramentas gringas caras.
- Pague em reais, com Pix, boleto ou cartão via Asaas.
- Tenha uma experiência simples, brasileira e comercial.

---

## 3. Posicionamento

O produto não deve competir diretamente apenas por tecnologia com grandes players globais. O diferencial deve estar na combinação de:

- Preço acessível em reais.
- Interface simples em português.
- Foco em WhatsApp, Instagram, QR Code e campanhas locais.
- Métricas fáceis de entender.
- Pagamento brasileiro com Pix, boleto e cartão.
- Atendimento e suporte em português.
- Possibilidade de virar porta de entrada para outros serviços digitais.

O produto pode ser vendido como:

- Encurtador de links profissional.
- Rastreador de campanhas simples.
- Gerador de QR Codes com métricas.
- Painel de links para WhatsApp e redes sociais.
- Ferramenta para pequenos negócios entenderem de onde vêm os cliques.
- Produto de entrada para a Casa da Árvore ou outra software house.

---

## 4. Stack oficial do projeto

A stack definida para o projeto é:

- Monorepo:
  - pnpm workspaces
  - Turborepo

- App:
  - Next.js
  - TypeScript
  - Tailwind CSS
  - shadcn/ui

- Backend:
  - Next.js Route Handlers
  - Server Actions
  - Drizzle ORM

- Database:
  - Neon PostgreSQL

- Auth:
  - Better Auth

- Redirect:
  - Cloudflare Workers
  - Hono
  - Cloudflare KV

- Billing:
  - Asaas
  - Webhooks

- Email:
  - Resend

- Logs e erros:
  - Sentry
  - Cloudflare Analytics

---

## 5. Princípios de arquitetura

A arquitetura deve seguir alguns princípios centrais:

### 5.1 Simplicidade primeiro

O projeto deve ser simples de entender, simples de manter e simples de evoluir.

Não usar microserviços desnecessários no MVP.

Não usar Kafka, Kubernetes, ClickHouse, Redis complexo ou filas distribuídas no começo.

O MVP deve resolver o problema principal:

- Criar link.
- Redirecionar rápido.
- Registrar clique.
- Mostrar métricas.
- Cobrar assinatura.

### 5.2 Postgres como fonte da verdade

O PostgreSQL gerenciado no Neon será a fonte oficial dos dados.

Tudo que for crítico deve existir no banco:

- Usuários.
- Workspaces.
- Links.
- Cliques.
- Assinaturas.
- Planos.
- Eventos de billing.
- Domínios.
- Logs de auditoria.

Cloudflare KV não é fonte da verdade. KV é cache operacional para redirecionamento rápido.

### 5.3 Redirect separado do dashboard

O dashboard e o sistema de gestão rodam no Next.js.

O redirecionamento de links roda separado em Cloudflare Workers.

Isso evita que cada clique dependa diretamente do app principal.

O fluxo de redirect precisa ser muito rápido, barato e resiliente.

### 5.4 Tudo em TypeScript

O projeto deve usar TypeScript de ponta a ponta:

- Next.js
- Server Actions
- Route Handlers
- Drizzle
- Hono
- Workers
- Validações
- Tipos compartilhados

Isso reduz erro, melhora manutenção e deixa o monorepo mais consistente.

### 5.5 MVP vendável, não perfeito

O objetivo não é construir a plataforma perfeita no início.

O objetivo é lançar uma primeira versão funcional, bonita, confiável e vendável.

Funcionalidades avançadas devem ser colocadas depois que houver uso real e validação comercial.

---

## 6. Arquitetura de alto nível

Componentes principais:

1. Web App
   - Landing page
   - Autenticação
   - Dashboard
   - Gestão de links
   - Métricas
   - Billing
   - Admin

2. API interna
   - Route Handlers do Next.js
   - Server Actions
   - Webhooks do Asaas
   - Integração com Resend
   - Integração com Cloudflare KV

3. Banco de dados
   - Neon PostgreSQL
   - Drizzle ORM
   - Migrações versionadas

4. Redirect Engine
   - Cloudflare Worker
   - Hono
   - Cloudflare KV
   - Registro de clique

5. Serviços externos
   - Asaas para cobrança
   - Resend para e-mail
   - Sentry para erros
   - Cloudflare Analytics para tráfego e redirect

---

## 7. Estrutura do monorepo

Estrutura sugerida:

/apps
  /web
    App principal Next.js
    Landing page
    Dashboard
    Auth
    Billing
    Admin
    API routes
    Webhooks

  /redirect
    Cloudflare Worker
    Hono app
    Redirect handler
    Click tracking
    KV lookup
    Fallback para API interna se necessário

/packages
  /db
    Drizzle schema
    Drizzle client
    Migrations
    Queries reutilizáveis
    Seed opcional

  /auth
    Configuração do Better Auth
    Helpers de sessão
    Helpers de permissão
    Middleware compartilhado

  /billing
    Cliente Asaas
    Tipos de eventos
    Verificação de webhooks
    Regras de planos
    Helpers de assinatura

  /emails
    Templates de e-mail
    Cliente Resend
    E-mails transacionais

  /ui
    Componentes compartilhados
    Design system interno
    Wrappers de shadcn/ui

  /shared
    Tipos compartilhados
    Schemas Zod
    Constantes
    Helpers de URL
    Helpers de slug
    Helpers de datas
    Helpers de plano

  /config
    Configuração de ambiente
    Validação de variáveis
    Configuração de eslint
    Configuração de tsconfig

/tooling
  Scripts auxiliares
  Scripts de deploy
  Scripts de sync KV
  Scripts de manutenção

---

## 8. Apps do monorepo

## 8.1 apps/web

O app web é o coração administrativo do produto.

Responsabilidades:

- Exibir landing page.
- Permitir cadastro e login.
- Criar e gerenciar workspaces.
- Criar links curtos.
- Editar links.
- Desativar links.
- Gerar QR Codes.
- Exibir métricas.
- Gerenciar billing.
- Receber webhooks do Asaas.
- Enviar e-mails via Resend.
- Sincronizar links com Cloudflare KV.
- Exibir área administrativa interna.

Tecnologias:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Drizzle ORM
- Better Auth
- Server Actions
- Route Handlers

Rotas principais:

- /
  Landing page pública.

- /pricing
  Página de planos.

- /login
  Login.

- /register
  Cadastro.

- /dashboard
  Visão geral do workspace.

- /dashboard/links
  Lista de links.

- /dashboard/links/new
  Criação de link.

- /dashboard/links/[id]
  Detalhes e métricas de um link.

- /dashboard/campaigns
  Campanhas.

- /dashboard/qr-codes
  QR Codes.

- /dashboard/settings
  Configurações do workspace.

- /dashboard/billing
  Plano, assinatura, pagamentos e upgrade.

- /admin
  Área administrativa interna.

- /api/webhooks/asaas
  Webhook de cobrança.

- /api/internal/links/sync
  Endpoint interno para sincronização, se necessário.

- /api/internal/clicks
  Endpoint interno para ingestão de cliques, se o Worker enviar diretamente para o app.

---

## 8.2 apps/redirect

O app redirect é um Cloudflare Worker responsável por receber acessos aos links curtos e redirecionar para o destino final.

Responsabilidades:

- Receber requests públicas de links curtos.
- Identificar slug.
- Buscar dados do link no Cloudflare KV.
- Validar se o link existe.
- Validar se está ativo.
- Validar se expirou.
- Validar se exige senha.
- Registrar evento de clique.
- Redirecionar rapidamente.
- Retornar página de erro amigável se necessário.

Tecnologias:

- Cloudflare Workers
- Hono
- Cloudflare KV
- TypeScript

Fluxo básico:

Usuário acessa:
https://dominio.com/oferta

Worker:
- Extrai slug: oferta
- Busca slug no KV
- Verifica estado do link
- Registra clique
- Redireciona para destinationUrl

Possíveis respostas:

- 302 redirect para URL final.
- 404 se slug não existir.
- 410 se link expirou.
- 403 se link estiver desativado.
- Página de senha se link for protegido.
- Página de aviso se link for considerado suspeito no futuro.

---

## 9. Banco de dados

Banco principal:

- Neon PostgreSQL

ORM:

- Drizzle ORM

Motivos para usar Postgres:

- Confiável.
- Maduro.
- Excelente para SaaS.
- Bom para analytics inicial.
- Suporta JSONB.
- Suporta índices avançados.
- Fácil de migrar depois.
- Compatível com Drizzle.
- Suficiente para o MVP e para um bom volume inicial.

---

## 10. Modelagem inicial de dados

## 10.1 Usuários e autenticação

Better Auth terá suas próprias tabelas principais.

Tabelas esperadas ou equivalentes:

- users
- sessions
- accounts
- verifications

Campos típicos de users:

- id
- name
- email
- emailVerified
- image
- createdAt
- updatedAt

Observação:

A modelagem exata pode seguir as convenções do Better Auth, mas o restante do sistema deve referenciar user.id como dono de entidades, criador de workspace ou membro.

---

## 10.2 Workspaces

Tabela: workspaces

Finalidade:

Representa uma organização, conta comercial, empresa ou espaço de trabalho.

Campos:

- id
- name
- slug
- ownerId
- planKey
- createdAt
- updatedAt
- deletedAt

Exemplos:

- Casa da Árvore
- Loja do João
- Clínica Exemplo
- Agência X

Cada usuário pode ter um ou mais workspaces.

---

## 10.3 Membros de workspace

Tabela: workspace_members

Finalidade:

Controlar quem pode acessar cada workspace.

Campos:

- id
- workspaceId
- userId
- role
- createdAt
- updatedAt

Roles sugeridas:

- owner
- admin
- member
- viewer

Permissões iniciais:

owner:
- Pode tudo.
- Gerencia billing.
- Remove membros.
- Transfere propriedade no futuro.

admin:
- Cria e edita links.
- Vê métricas.
- Gerencia campanhas.

member:
- Cria e edita links.
- Vê métricas básicas.

viewer:
- Apenas visualiza métricas e links.

No MVP, pode começar apenas com owner e member.

---

## 10.4 Links

Tabela: links

Finalidade:

Representa um link curto criado por um workspace.

Campos:

- id
- workspaceId
- createdByUserId
- domainId
- slug
- destinationUrl
- title
- description
- isActive
- expiresAt
- passwordHash
- utmSource
- utmMedium
- utmCampaign
- utmTerm
- utmContent
- tags
- metadata
- totalClicks
- uniqueClicks
- lastClickedAt
- createdAt
- updatedAt
- deletedAt

Observações:

- slug deve ser único por domínio.
- destinationUrl deve ser validada.
- totalClicks pode ser denormalizado para performance.
- uniqueClicks pode ser calculado por hash de visitante.
- passwordHash só existe se o link for protegido.
- metadata pode guardar dados flexíveis.

Índices importantes:

- unique(domainId, slug)
- index(workspaceId)
- index(createdByUserId)
- index(createdAt)
- index(isActive)
- index(expiresAt)

---

## 10.5 Cliques

Tabela: clicks

Finalidade:

Registrar eventos de acesso aos links.

Campos:

- id
- linkId
- workspaceId
- occurredAt
- ipHash
- userAgent
- referer
- country
- region
- city
- device
- browser
- os
- bot
- source
- medium
- campaign
- metadata

Observações:

- Não salvar IP puro.
- Salvar hash do IP para privacidade e contagem aproximada de únicos.
- User-agent pode ser salvo, mas com cuidado.
- Localização deve ser aproximada.
- Dados de analytics devem ser simples no MVP.

Índices importantes:

- index(linkId, occurredAt)
- index(workspaceId, occurredAt)
- index(country)
- index(device)
- index(browser)

Cuidados:

A tabela clicks pode crescer rápido. No MVP, Postgres aguenta bem. Com crescimento, pode-se migrar eventos antigos para storage frio ou ClickHouse.

---

## 10.6 Campanhas

Tabela: campaigns

Finalidade:

Agrupar links por campanha.

Campos:

- id
- workspaceId
- name
- slug
- description
- startsAt
- endsAt
- createdAt
- updatedAt
- deletedAt

Tabela de relação opcional:

- campaign_links

Campos:

- id
- campaignId
- linkId
- createdAt

No MVP, um link pode ter campaignId direto na tabela links.

---

## 10.7 QR Codes

Tabela: qr_codes

Finalidade:

Guardar dados de QR Codes gerados.

Campos:

- id
- workspaceId
- linkId
- format
- foregroundColor
- backgroundColor
- logoUrl
- imageUrl
- createdAt
- updatedAt

No MVP, não é obrigatório salvar imagem. O QR Code pode ser gerado dinamicamente a partir da URL curta.

---

## 10.8 Domínios

Tabela: domains

Finalidade:

Gerenciar domínios usados nos links.

Campos:

- id
- workspaceId
- hostname
- type
- status
- verificationToken
- verifiedAt
- createdAt
- updatedAt

Types:

- system
- custom

Status:

- pending
- active
- failed
- disabled

No MVP, pode existir apenas domínio padrão do produto.

Domínio personalizado deve entrar depois.

---

## 10.9 Planos

Tabela: plans

Finalidade:

Definir planos internos da plataforma.

Campos:

- id
- key
- name
- description
- priceCents
- currency
- billingCycle
- maxLinks
- maxClicksPerMonth
- maxWorkspaces
- maxMembers
- customDomainsEnabled
- passwordLinksEnabled
- expirationEnabled
- qrCodesEnabled
- bioPagesEnabled
- analyticsRetentionDays
- createdAt
- updatedAt

Exemplos de planos:

free:
- 10 links ativos.
- Analytics 7 dias.
- QR Code básico.
- Sem domínio personalizado.

starter:
- 100 links ativos.
- Analytics 30 dias.
- QR Code.
- Slug personalizado.
- Expiração.

pro:
- 500 links ativos.
- Analytics 12 meses.
- Links com senha.
- UTM builder.
- Export CSV.
- Bio page.

business:
- Links maiores.
- Domínio personalizado.
- Membros.
- Relatórios avançados.

---

## 10.10 Assinaturas

Tabela: subscriptions

Finalidade:

Controlar o estado da assinatura do workspace.

Campos:

- id
- workspaceId
- planId
- provider
- providerSubscriptionId
- status
- currentPeriodStart
- currentPeriodEnd
- cancelAtPeriodEnd
- canceledAt
- trialEndsAt
- createdAt
- updatedAt

Provider inicial:

- asaas

Status:

- trialing
- active
- past_due
- unpaid
- canceled
- expired
- pending

---

## 10.11 Clientes de billing

Tabela: billing_customers

Finalidade:

Relacionar workspace/usuário com cliente criado no Asaas.

Campos:

- id
- workspaceId
- provider
- providerCustomerId
- name
- email
- document
- phone
- createdAt
- updatedAt

---

## 10.12 Eventos de billing

Tabela: billing_events

Finalidade:

Registrar webhooks recebidos do Asaas.

Campos:

- id
- provider
- providerEventId
- eventType
- payload
- processedAt
- createdAt

Importante:

Todo webhook deve ser persistido para auditoria, debug e reprocessamento.

---

## 10.13 API keys

Tabela: api_keys

Finalidade:

Permitir integrações futuras.

Campos:

- id
- workspaceId
- name
- keyHash
- lastUsedAt
- expiresAt
- createdAt
- revokedAt

Não precisa no MVP inicial, mas a modelagem deve considerar possibilidade futura.

---

## 10.14 Audit logs

Tabela: audit_logs

Finalidade:

Registrar ações importantes.

Campos:

- id
- workspaceId
- userId
- action
- entityType
- entityId
- metadata
- createdAt

Exemplos de ações:

- link.created
- link.updated
- link.deleted
- link.disabled
- billing.subscription_created
- billing.subscription_canceled
- domain.created
- member.invited

---

## 11. Fluxos principais

## 11.1 Cadastro

Fluxo:

1. Usuário acessa landing page.
2. Clica em criar conta.
3. Informa nome, e-mail e senha.
4. Better Auth cria usuário.
5. Sistema cria workspace inicial automaticamente.
6. Usuário entra no dashboard.
7. Usuário pode criar o primeiro link.

Regras:

- Todo usuário novo deve ter um workspace padrão.
- Workspace padrão pode usar nome do usuário ou empresa.
- Plano inicial deve ser free.
- E-mail de boas-vindas pode ser enviado via Resend.

---

## 11.2 Login

Fluxo:

1. Usuário informa e-mail e senha.
2. Better Auth valida credenciais.
3. Sessão é criada.
4. Usuário é redirecionado para /dashboard.
5. Sistema carrega workspace ativo.

Regras:

- Sessão deve ser segura.
- Cookies devem usar httpOnly, secure e sameSite adequado.
- Rotas protegidas devem validar sessão.
- Usuário sem workspace deve gerar workspace automaticamente.

---

## 11.3 Criação de link

Fluxo:

1. Usuário acessa /dashboard/links/new.
2. Informa URL final.
3. Opcionalmente define slug personalizado.
4. Opcionalmente define título.
5. Opcionalmente define campanha.
6. Opcionalmente define UTM.
7. Sistema valida limites do plano.
8. Sistema valida URL.
9. Sistema valida disponibilidade do slug.
10. Sistema salva link no Postgres.
11. Sistema grava versão operacional no Cloudflare KV.
12. Sistema retorna URL curta.
13. Sistema gera QR Code automaticamente.

Regras:

- Slug deve ser único por domínio.
- Slug deve ser normalizado.
- Slug deve bloquear palavras reservadas.
- URL final deve iniciar com http ou https.
- Não aceitar javascript:, data:, file: ou protocolos perigosos.
- Usuário free deve respeitar limite de links ativos.

Palavras reservadas sugeridas:

- login
- register
- dashboard
- admin
- api
- pricing
- settings
- billing
- support
- help
- terms
- privacy
- app
- www

---

## 11.4 Redirecionamento

Fluxo:

1. Visitante acessa link curto.
2. Cloudflare Worker recebe request.
3. Worker extrai hostname e slug.
4. Worker busca no KV usando chave composta.
5. Worker valida se o link existe.
6. Worker valida se está ativo.
7. Worker valida expiração.
8. Worker registra clique.
9. Worker redireciona com status 302 ou 301, conforme configuração futura.

Chave sugerida no KV:

link:{hostname}:{slug}

Valor sugerido no KV:

{
  linkId: string,
  workspaceId: string,
  destinationUrl: string,
  active: boolean,
  expiresAt: string | null,
  passwordProtected: boolean,
  createdAt: string,
  updatedAt: string
}

Regras:

- Redirect padrão deve usar 302 no MVP.
- 301 pode ser opção avançada, mas deve ser usado com cuidado por causa de cache.
- Se o link não existir, retornar 404.
- Se estiver expirado, retornar 410.
- Se estiver desativado, retornar 403.
- Se for protegido por senha, redirecionar para página de senha ou renderizar página simples.

---

## 11.5 Registro de clique

Existem duas opções de arquitetura:

### Opção A: Worker grava direto em endpoint do app

Worker recebe clique e faz request para endpoint interno:

POST /api/internal/clicks

Vantagens:

- Simples.
- Centraliza escrita no app.
- Usa Drizzle e validações do backend principal.

Desvantagens:

- Pode adicionar latência.
- Se o app estiver lento, pode afetar tracking.

### Opção B: Worker usa fila ou mecanismo assíncrono

No futuro, pode usar:

- Cloudflare Queues
- Logpush
- Durable Objects
- Batch insert

Vantagens:

- Mais escalável.
- Menor impacto no redirect.

Desvantagens:

- Mais complexo.

Decisão para MVP:

Usar Opção A com timeout curto e sem bloquear redirect.

O clique não deve impedir o redirect.

Fluxo ideal:

1. Worker identifica link.
2. Worker dispara registro de clique.
3. Mesmo se falhar, redireciona.
4. Erros são enviados ao Sentry ou logados.

Dados coletados:

- linkId
- workspaceId
- occurredAt
- userAgent
- referer
- ipHash
- country
- city
- device
- browser
- os

Privacidade:

- Não salvar IP puro.
- Usar hash com salt.
- Não usar fingerprint invasivo no MVP.
- Não coletar dados desnecessários.

---

## 11.6 Edição de link

Fluxo:

1. Usuário abre link no dashboard.
2. Edita URL final, título, status, expiração ou slug.
3. Sistema valida permissões.
4. Sistema atualiza Postgres.
5. Sistema atualiza Cloudflare KV.
6. Se slug mudou, remove chave antiga do KV.
7. Cria nova chave no KV.
8. Registra audit log.

Regra importante:

Postgres é fonte da verdade. KV deve refletir o estado operacional atual.

Se a atualização do Postgres funcionar e a do KV falhar, o sistema deve marcar necessidade de resync.

Pode existir campo:

- kvSyncedAt
- kvSyncStatus

Ou uma tabela:

- kv_sync_jobs

No MVP, pode ser apenas tentativa direta + log de erro.

---

## 11.7 Desativação de link

Fluxo:

1. Usuário clica em desativar.
2. Sistema atualiza isActive = false no Postgres.
3. Sistema atualiza active = false no KV.
4. Redirect passa a retornar 403 ou página informativa.

Não deletar fisicamente no primeiro momento.

Usar soft delete com deletedAt.

---

## 11.8 Exclusão de link

Fluxo:

1. Usuário solicita exclusão.
2. Sistema define deletedAt.
3. Sistema remove ou desativa KV.
4. Métricas históricas podem permanecer no banco.

Recomendação:

No MVP, excluir link deve ser soft delete.

---

## 11.9 Geração de QR Code

Fluxo:

1. Link é criado.
2. URL curta é formada.
3. QR Code é gerado no frontend ou backend.
4. Usuário pode baixar PNG ou SVG.

No MVP:

- Gerar QR Code dinamicamente no frontend.
- Permitir download básico.
- Não precisa salvar imagem em storage.

Futuro:

- QR Code customizado.
- Logo no centro.
- Cores.
- Templates.
- Histórico de QR Codes.

---

## 11.10 Billing com Asaas

Fluxo de assinatura:

1. Usuário acessa /dashboard/billing.
2. Escolhe plano.
3. App cria ou recupera customer no Asaas.
4. App cria assinatura no Asaas.
5. Usuário recebe link de pagamento ou checkout.
6. Asaas envia webhook.
7. App valida webhook.
8. App registra evento em billing_events.
9. App atualiza subscriptions.
10. App atualiza planKey do workspace.
11. Usuário ganha limites do plano.

Eventos importantes do Asaas:

- Pagamento criado.
- Pagamento confirmado.
- Pagamento vencido.
- Pagamento recebido.
- Assinatura criada.
- Assinatura atualizada.
- Assinatura cancelada.

Regras:

- Nunca confiar somente no frontend.
- Estado de plano deve ser atualizado por webhook.
- Webhook deve ser idempotente.
- Eventos duplicados não podem causar inconsistência.
- Todo payload deve ser salvo.

---

## 11.11 Cancelamento

Fluxo:

1. Usuário solicita cancelamento.
2. Sistema cancela assinatura no Asaas ou agenda cancelamento.
3. Sistema atualiza cancelAtPeriodEnd, se aplicável.
4. Webhook confirma mudança.
5. Ao fim do período, workspace volta para plano free ou status canceled.

Regras:

- Não apagar dados imediatamente.
- Se o plano cair, aplicar limites.
- Links excedentes podem continuar existindo, mas talvez não possam ser editados/criados.
- Decidir regra comercial com cuidado.

Sugestão:

Se downgrade para free:

- Manter links antigos funcionando por um período.
- Impedir criação de novos links acima do limite.
- Mostrar aviso para upgrade.

---

## 12. Planos e limites

Planos sugeridos:

### Free

Preço:

- R$ 0

Limites:

- 10 links ativos.
- 1 workspace.
- 1 usuário.
- Analytics dos últimos 7 dias.
- QR Code básico.
- Sem link com senha.
- Sem domínio personalizado.
- Sem exportação CSV.

Objetivo:

- Aquisição.
- Teste.
- Leads.
- Demonstração.

### Starter

Preço sugerido:

- R$ 9,90/mês

Limites:

- 100 links ativos.
- Analytics 30 dias.
- QR Code.
- Slug personalizado.
- Expiração de link.
- 1 workspace.
- 1 usuário.

Objetivo:

- Pequenos profissionais.
- Vendedores.
- Autônomos.
- Pequenas lojas.

### Pro

Preço sugerido:

- R$ 19,90/mês

Limites:

- 500 links ativos.
- Analytics 12 meses.
- QR Code.
- Slug personalizado.
- Link com senha.
- UTM builder.
- Exportação CSV.
- Bio page.
- 3 membros.

Objetivo:

- Pequenas empresas.
- Agências pequenas.
- Campanhas recorrentes.

### Business

Preço sugerido:

- R$ 39,90/mês ou mais

Limites:

- Links maiores.
- Domínio personalizado.
- Múltiplos membros.
- Relatórios por campanha.
- Suporte prioritário.
- Analytics avançado.

Objetivo:

- Empresas.
- Agências.
- Times comerciais.
- Operações locais com várias campanhas.

---

## 13. Permissões

Permissões devem ser baseadas em workspace.

Entidades principais:

- User
- Workspace
- WorkspaceMember
- Role

Operações protegidas:

- Criar link.
- Editar link.
- Deletar link.
- Ver métricas.
- Gerenciar billing.
- Gerenciar membros.
- Gerenciar domínio.
- Ver audit logs.

Regras iniciais:

Owner:
- Pode tudo.

Admin:
- Gerencia links, campanhas e métricas.

Member:
- Cria e edita links próprios ou do workspace.

Viewer:
- Apenas visualiza.

No MVP, implementar apenas:

- owner
- member

---

## 14. Segurança

## 14.1 Validação de URL

Toda URL de destino deve ser validada.

Bloquear:

- javascript:
- data:
- file:
- ftp, se não for necessário
- URLs inválidas
- URLs internas sensíveis
- localhost
- 127.0.0.1
- 0.0.0.0
- ::1
- IPs privados
- metadata services de cloud

Prevenir SSRF em qualquer funcionalidade que busque dados da URL.

No MVP, se não houver preview da URL, o risco é menor, mas ainda deve validar protocolo.

---

## 14.2 Slugs

Slugs devem:

- Ser normalizados.
- Ter tamanho mínimo e máximo.
- Aceitar apenas caracteres seguros.
- Bloquear palavras reservadas.
- Ser únicos por domínio.
- Evitar colisão.

Exemplo de padrão:

- letras minúsculas
- números
- hífen
- underscore opcional

Tamanho sugerido:

- mínimo 3
- máximo 64

---

## 14.3 Rate limit

Pontos que precisam de rate limit:

- Login.
- Cadastro.
- Criação de links.
- Redirect de slugs inexistentes.
- Webhook público.
- APIs internas.
- Recuperação de senha.

Pode ser implementado com:

- Cloudflare WAF/rules.
- Rate limiting no Worker.
- Rate limiting no app.
- Tabela simples para tentativas, se necessário.

No MVP:

- Usar proteção da Cloudflare.
- Rate limit básico nas rotas críticas.

---

## 14.4 Proteção contra abuso

Encurtadores de link podem ser usados para spam, phishing e golpes.

Medidas iniciais:

- Bloquear domínios claramente perigosos manualmente.
- Criar sistema de report abuse.
- Permitir desativar workspace/link manualmente.
- Registrar audit logs.
- Adicionar termos de uso.
- Criar lista de bloqueio de domínios.
- Monitorar links com muitos cliques suspeitos.

Futuro:

- Integração com Google Safe Browsing.
- Análise automática de destino.
- Score de risco.
- Bloqueio preventivo.

---

## 14.5 Senhas

Para links protegidos por senha:

- Nunca salvar senha em texto puro.
- Salvar hash seguro.
- Comparar no servidor.
- Usar página intermediária.
- Definir cookie temporário de acesso ao link.

No MVP, link com senha pode ficar para segunda fase.

---

## 14.6 Dados pessoais e LGPD

O produto deve coletar apenas dados necessários.

Boas práticas:

- Não armazenar IP puro.
- Usar hash de IP com salt.
- Evitar fingerprint invasivo.
- Informar uso de cookies e analytics.
- Ter política de privacidade.
- Permitir exclusão de conta.
- Permitir exclusão de workspace, conforme regra.
- Ter retenção de dados por plano.

Dados de clique são potencialmente sensíveis quando combinados. Portanto, devem ser tratados com cuidado.

---

## 15. Observabilidade

Ferramentas:

- Sentry
- Cloudflare Analytics
- Logs próprios

## 15.1 Sentry

Usar Sentry para:

- Erros no Next.js.
- Erros em Server Actions.
- Erros em Route Handlers.
- Erros no Worker.
- Falhas em webhooks.
- Falhas de integração com Asaas.
- Falhas de integração com Resend.
- Falhas de sincronização com KV.

Eventos importantes:

- redirect.error
- billing.webhook_error
- billing.asaas_request_failed
- link.kv_sync_failed
- auth.error
- email.send_failed

---

## 15.2 Cloudflare Analytics

Usar para:

- Volume de requests no redirect.
- Países e regiões.
- Erros 4xx e 5xx.
- Performance do Worker.
- Picos de tráfego.
- Tráfego suspeito.

---

## 15.3 Logs próprios

Criar logs no banco para eventos de negócio:

- link.created
- link.updated
- link.deleted
- subscription.updated
- webhook.received
- webhook.processed
- kv.sync.failed
- member.added
- member.removed

Esses logs ajudam em suporte e auditoria.

---

## 16. Estratégia de cache

## 16.1 Cloudflare KV

Cloudflare KV deve armazenar dados mínimos para redirect.

Chave:

link:{hostname}:{slug}

Valor:

{
  linkId,
  workspaceId,
  destinationUrl,
  active,
  expiresAt,
  passwordProtected,
  updatedAt
}

Benefícios:

- Redirect rápido.
- Menor dependência do banco.
- Menor custo.
- Melhor resiliência.

Limitações:

- KV pode ter consistência eventual.
- Não deve ser fonte da verdade.
- Atualizações podem demorar um pouco para propagar.

Regras:

- Toda criação/edição/desativação de link atualiza Postgres e KV.
- Se KV falhar, registrar erro.
- Criar script de resync no futuro.
- Postgres sempre vence em caso de conflito.

---

## 16.2 Denormalização de métricas

Na tabela links, manter:

- totalClicks
- uniqueClicks
- lastClickedAt

Isso evita consultar clicks toda hora para listar links.

Atualização:

- Pode ser feita em tempo real no MVP.
- Pode virar job assíncrono depois.

No MVP, simples:

- Ao registrar clique, incrementar totalClicks.
- Atualizar lastClickedAt.

Cuidado:

- Alto volume pode gerar contenção.
- Depois, usar agregações por lote.

---

## 17. Analytics

Métricas iniciais:

- Total de cliques.
- Cliques por dia.
- Cliques por hora.
- Cliques por país.
- Cliques por cidade.
- Cliques por dispositivo.
- Cliques por navegador.
- Cliques por sistema operacional.
- Referrers principais.
- Links mais clicados.
- Campanhas mais clicadas.

Métricas por link:

- Total de cliques.
- Últimos 7 dias.
- Últimos 30 dias.
- Origem.
- Dispositivo.
- Localização aproximada.
- Horários.

Métricas por workspace:

- Total de links.
- Links ativos.
- Total de cliques no período.
- Melhor link.
- Melhor campanha.
- Crescimento em relação ao período anterior.

No MVP:

- Gráfico de cliques por dia.
- Tabela de links.
- Cards simples.
- Referrers.
- Dispositivos.

Bibliotecas:

- Recharts para gráficos.
- TanStack Table para tabelas.

---

## 18. UTM Builder

O UTM Builder deve transformar algo técnico em uma experiência simples.

Campos:

- URL destino.
- Origem.
- Mídia.
- Campanha.
- Conteúdo.
- Termo.

Campos técnicos:

- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term

Exemplo de interface:

Origem:
- instagram
- whatsapp
- google
- facebook
- panfleto
- qr_code
- email
- outro

Mídia:
- social
- cpc
- organic
- message
- offline
- referral
- email

O sistema gera a URL final com UTM e depois cria o link curto.

---

## 19. WhatsApp Links

Funcionalidade importante para o mercado brasileiro.

Usuário informa:

- Número de WhatsApp.
- Mensagem inicial.
- Nome da campanha.
- Slug opcional.

Sistema gera:

https://wa.me/55numero?text=mensagem

Depois encurta:

https://seudominio.com/campanha-whats

Métricas úteis:

- Quantos cliques no link de WhatsApp.
- Qual campanha gerou mais abertura de conversa.
- Qual QR Code gerou mais cliques.
- Qual canal trouxe mais intenção.

Observação:

O sistema não sabe se a pessoa realmente enviou a mensagem, apenas se clicou no link.

A comunicação deve ser honesta:

- “cliques para WhatsApp”
- não “conversas iniciadas”, a menos que exista integração real depois.

---

## 20. QR Codes

QR Code deve ser uma funcionalidade central de valor percebido.

Casos de uso:

- Cardápio.
- Catálogo.
- Evento.
- Panfleto.
- Cartão de visita.
- Instagram.
- WhatsApp.
- Promoção.
- Localização.
- Formulário.
- Página de pagamento.

MVP:

- QR Code automático para cada link.
- Download em PNG.
- Download em SVG se possível.
- Visualização rápida.

Futuro:

- QR Code customizado.
- Cores.
- Logo.
- Moldura.
- Templates.
- Lotes.
- QR Codes dinâmicos com destino editável.

Importante:

Como o QR aponta para o link curto, o destino pode ser alterado depois sem reimprimir o QR Code.

Isso é um argumento comercial forte.

---

## 21. Bio pages

Bio page é uma expansão natural.

Exemplo:

seudominio.com/joao

Funcionalidade:

- Página simples com múltiplos links.
- WhatsApp.
- Instagram.
- Site.
- Catálogo.
- Localização.
- Link de pagamento.
- Formulário.

No MVP inicial, pode ficar fora.

No futuro, pode aumentar retenção e valor percebido.

Tabela sugerida:

bio_pages

Campos:

- id
- workspaceId
- slug
- title
- description
- avatarUrl
- theme
- isActive
- createdAt
- updatedAt

bio_page_links

Campos:

- id
- bioPageId
- label
- url
- position
- isActive
- createdAt
- updatedAt

---

## 22. Domínio personalizado

Não implementar no primeiro MVP, mas preparar arquitetura.

Fluxo futuro:

1. Usuário adiciona domínio.
2. Sistema gera instruções DNS.
3. Usuário aponta CNAME para domínio do produto.
4. Sistema verifica DNS.
5. Sistema ativa domínio.
6. Links passam a usar domínio personalizado.

Exemplo:

go.minhaloja.com/oferta

Regras:

- Domínio deve pertencer ao workspace.
- Hostname deve ser único.
- Certificado pode ser gerenciado via Cloudflare.
- KV deve incluir hostname na chave.

Chave no KV:

link:{hostname}:{slug}

Isso permite múltiplos domínios com mesmo slug.

---

## 23. Integração com Asaas

## 23.1 Responsabilidades do pacote billing

O pacote /packages/billing deve conter:

- Cliente HTTP do Asaas.
- Tipos de requests.
- Tipos de responses.
- Tipos de webhooks.
- Funções para criar cliente.
- Funções para criar assinatura.
- Funções para cancelar assinatura.
- Funções para buscar status.
- Funções para validar ou processar webhook.
- Mapeamento de planos internos para planos comerciais.

## 23.2 Entidades relacionadas

- billing_customers
- subscriptions
- billing_events
- plans

## 23.3 Idempotência

Webhooks podem chegar duplicados.

Regra:

- Verificar providerEventId antes de processar.
- Salvar evento bruto sempre que possível.
- Se evento já foi processado, ignorar com sucesso.
- Nunca processar evento duplicado duas vezes.

## 23.4 Segurança do webhook

- Validar token/assinatura conforme Asaas permitir.
- Usar segredo em variável de ambiente.
- Não expor logs sensíveis.
- Rate limit na rota.
- Aceitar apenas método POST.
- Validar payload.

## 23.5 Estado do plano

O estado de assinatura no banco deve ser atualizado pelo webhook.

O frontend pode iniciar checkout, mas não deve conceder plano pago sozinho.

---

## 24. Integração com Resend

Usar Resend para e-mails transacionais.

E-mails iniciais:

- Boas-vindas.
- Confirmação de e-mail, se usado.
- Recuperação de senha, se Better Auth exigir integração.
- Pagamento confirmado.
- Pagamento pendente.
- Assinatura cancelada.
- Alerta de limite atingido.
- Convite de membro no futuro.

Pacote /packages/emails:

- Templates.
- Funções de envio.
- Tipos de payload.
- Configuração de remetente.

Remetente sugerido:

- no-reply@seudominio.com
- suporte@seudominio.com

---

## 25. Better Auth

Better Auth será usado para autenticação.

Responsabilidades:

- Cadastro.
- Login.
- Sessão.
- Logout.
- Recuperação de senha.
- Providers sociais no futuro.
- Tabelas de usuário, sessão, conta e verificação.

Regras:

- Todas as rotas de dashboard exigem sessão.
- Route Handlers privados exigem sessão.
- Server Actions privadas validam sessão.
- Sessão deve ser carregada no servidor.
- Permissões devem considerar workspace ativo.

Pacote /packages/auth:

- Configuração Better Auth.
- Helper getCurrentUser.
- Helper requireUser.
- Helper requireWorkspace.
- Helper requireWorkspaceRole.
- Middleware ou utilitários de proteção.

---

## 26. Drizzle ORM

Drizzle será usado para:

- Definir schema.
- Rodar migrations.
- Fazer queries tipadas.
- Organizar acesso ao banco.

Pacote /packages/db:

- schema.ts
- client.ts
- migrations
- queries
- relations
- seeds opcionais

Regras:

- Não espalhar SQL pelo app inteiro.
- Queries comuns devem ficar em /packages/db/queries.
- Server Actions podem chamar serviços que usam queries.
- Evitar lógica de negócio pesada dentro de componentes.

---

## 27. Server Actions vs Route Handlers

## 27.1 Server Actions

Usar para ações internas do dashboard:

- Criar link.
- Editar link.
- Deletar link.
- Criar campanha.
- Atualizar configurações.
- Convidar membro.
- Trocar plano, quando for ação iniciada por UI.

Vantagens:

- Integra bem com formulários.
- Reduz boilerplate.
- Fica simples para o MVP.

## 27.2 Route Handlers

Usar para:

- Webhooks do Asaas.
- APIs internas chamadas pelo Worker.
- Endpoints públicos futuros.
- Integrações externas.
- Download de relatórios.
- Rotas que precisam de controle HTTP mais explícito.

---

## 28. Sincronização Postgres e KV

Postgres:

- Fonte da verdade.

KV:

- Cache de redirect.

Quando criar link:

1. Salvar no Postgres.
2. Escrever no KV.
3. Se KV falhar, marcar erro e informar usuário ou tentar novamente.

Quando editar link:

1. Atualizar Postgres.
2. Atualizar KV.
3. Se slug mudou, remover chave antiga.
4. Criar chave nova.

Quando desativar link:

1. Atualizar Postgres.
2. Atualizar KV com active false ou remover chave.

Quando deletar link:

1. Soft delete no Postgres.
2. Remover do KV ou marcar inactive.

Estratégia futura:

- Criar tabela kv_sync_jobs.
- Worker ou job processa pendências.
- Admin consegue rodar resync manual.

Tabela sugerida:

kv_sync_jobs

Campos:

- id
- entityType
- entityId
- operation
- status
- attempts
- lastError
- createdAt
- updatedAt
- processedAt

---

## 29. Deploy

## 29.1 Web App

Hospedagem:

- Vercel

Responsável por:

- Next.js app
- Landing
- Dashboard
- Route Handlers
- Webhooks

Variáveis de ambiente:

- DATABASE_URL
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL
- ASAAS_API_KEY
- ASAAS_WEBHOOK_SECRET
- RESEND_API_KEY
- SENTRY_DSN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_KV_NAMESPACE_ID
- CLOUDFLARE_API_TOKEN
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SHORT_DOMAIN

---

## 29.2 Redirect Worker

Hospedagem:

- Cloudflare Workers

Responsável por:

- Redirect
- Lookup KV
- Tracking
- Páginas simples de erro

Variáveis:

- KV namespace binding
- INTERNAL_API_URL
- INTERNAL_API_SECRET
- SENTRY_DSN opcional
- IP_HASH_SECRET

---

## 29.3 Banco

Hospedagem:

- Neon PostgreSQL

Ambientes:

- development
- preview
- production

Regras:

- Não usar banco de produção em desenvolvimento.
- Migrations devem ser versionadas.
- Backups devem estar ativos.
- Criar branch/preview se necessário.

---

## 29.4 DNS

Cloudflare deve gerenciar DNS.

Domínios possíveis:

- app.seudominio.com para dashboard
- seudominio.com para landing
- l.seudominio.com para links curtos
- go.seudominio.com para links curtos

Recomendação:

Usar um domínio curto separado para links.

Exemplos:

- meul.ink
- linkbr.com.br
- lnkbr.com.br
- cdarv.link
- go.casadearvore.com.br

---

## 30. Ambientes

## 30.1 Development

Local.

Serviços:

- Next.js local.
- Worker local com Wrangler.
- Banco Neon dev ou Postgres local.
- Webhooks simulados.
- Resend em modo teste, se possível.

## 30.2 Preview

Para pull requests e testes.

- Deploy preview na Vercel.
- Banco preview ou schema separado.
- Worker preview, se necessário.
- Asaas sandbox, se disponível.

## 30.3 Production

Produção real.

- Vercel production.
- Cloudflare Worker production.
- Neon production.
- Asaas production.
- Resend production.
- Sentry production.

---

## 31. Convenções de código

## 31.1 TypeScript

- strict mode ativado.
- Evitar any.
- Tipar payloads externos.
- Usar Zod para validações de entrada.
- Compartilhar tipos quando fizer sentido.

## 31.2 Nomenclatura

Entidades:

- User
- Workspace
- Link
- Click
- Campaign
- Subscription
- Plan
- Domain

Arquivos:

- kebab-case para arquivos.
- PascalCase para componentes.
- camelCase para funções.

## 31.3 Organização por domínio

Evitar separar tudo apenas por tipo técnico.

Preferir organização por domínio:

- links
- billing
- auth
- workspaces
- analytics
- campaigns

---

## 32. Validação

Usar Zod para schemas de entrada.

Exemplos de validações:

CreateLinkInput:

- destinationUrl obrigatória.
- slug opcional.
- title opcional.
- campaignId opcional.
- expiresAt opcional.
- password opcional.

UpdateLinkInput:

- id obrigatório.
- destinationUrl opcional.
- slug opcional.
- title opcional.
- isActive opcional.
- expiresAt opcional.

CreateWorkspaceInput:

- name obrigatório.
- slug opcional.

BillingCheckoutInput:

- planKey obrigatório.
- billingCycle obrigatório.

As validações devem ficar em /packages/shared ou em módulos específicos do domínio.

---

## 33. Tratamento de erros

Erros devem ser claros para o usuário e detalhados internamente.

Exemplos de mensagens para usuário:

- “Esse slug já está em uso.”
- “Você atingiu o limite do seu plano.”
- “Esse link não existe.”
- “Esse link expirou.”
- “Não foi possível criar sua assinatura agora.”
- “Não foi possível sincronizar o link. Tente novamente.”

Internamente:

- Enviar erro ao Sentry.
- Registrar contexto.
- Não expor secrets.
- Não mostrar stack trace ao usuário.

---

## 34. Páginas de erro do redirect

O redirect deve ter páginas simples para:

404:
- Link não encontrado.

410:
- Link expirado.

403:
- Link desativado.

Senha:
- Link protegido por senha.

Abuse:
- Link bloqueado por segurança.

Essas páginas podem ser simples no Worker ou redirecionar para app web.

No MVP, podem ser HTML simples direto no Worker.

---

## 35. Performance

## 35.1 Redirect

Objetivo:

- Resolver redirect com baixa latência.
- Evitar ida ao banco em cada clique.
- Usar KV para lookup.
- Não bloquear redirect por falha de analytics.

Boas práticas:

- Lookup no KV.
- Tracking assíncrono ou com timeout.
- Resposta 302 rápida.
- Evitar lógica pesada no Worker.
- Não consultar Postgres diretamente do Worker no MVP.

## 35.2 Dashboard

O dashboard pode ser menos crítico que redirect, mas deve ser agradável.

Boas práticas:

- Paginar listas.
- Usar queries agregadas.
- Evitar carregar todos os cliques.
- Usar filtros por período.
- Usar índices corretos.
- Usar Server Components quando fizer sentido.

---

## 36. Escalabilidade futura

Quando o produto crescer, possíveis evoluções:

### 36.1 Analytics

Migrar clicks para:

- ClickHouse
- BigQuery
- TimescaleDB
- Particionamento em Postgres

Primeiro passo antes disso:

- Particionar tabela clicks por mês.
- Criar agregações diárias.
- Criar tabela link_daily_stats.

Tabela futura:

link_daily_stats

Campos:

- id
- linkId
- workspaceId
- date
- clicks
- uniqueClicks
- createdAt
- updatedAt

### 36.2 Fila

Adicionar:

- Cloudflare Queues
- Background jobs
- Batch inserts

Uso:

- Registrar cliques em lote.
- Processar webhooks.
- Enviar e-mails.
- Sincronizar KV.
- Gerar relatórios.

### 36.3 Domínios personalizados

Adicionar onboarding DNS.

### 36.4 API pública

Permitir que clientes criem links por API.

### 36.5 Times e agências

Melhorar permissões, membros e workspaces.

---

## 37. Roadmap técnico

## Fase 0: Setup

Objetivo:

Preparar base do projeto.

Tarefas:

- Criar monorepo com pnpm workspaces.
- Configurar Turborepo.
- Criar app Next.js.
- Criar app Worker.
- Configurar TypeScript.
- Configurar Tailwind.
- Configurar shadcn/ui.
- Configurar Drizzle.
- Configurar Neon.
- Configurar Better Auth.
- Configurar Sentry.
- Configurar env validation.

Resultado:

Base técnica pronta.

---

## Fase 1: MVP funcional sem billing

Objetivo:

Criar produto utilizável sem cobrança.

Tarefas:

- Cadastro/login.
- Criar workspace automaticamente.
- Criar link.
- Listar links.
- Editar link.
- Desativar link.
- Redirect via Worker.
- Sync com KV.
- Registrar clique.
- Dashboard com total de cliques.
- Gráfico simples.
- QR Code automático.

Resultado:

Produto funcional para uso interno e primeiros testes.

---

## Fase 2: Billing

Objetivo:

Permitir cobrança recorrente.

Tarefas:

- Criar tabela plans.
- Criar tabela subscriptions.
- Criar integração com Asaas.
- Criar checkout/assinatura.
- Criar webhook.
- Atualizar plano por webhook.
- Aplicar limites por plano.
- Criar tela de billing.

Resultado:

Produto monetizável.

---

## Fase 3: Polimento comercial

Objetivo:

Deixar vendável.

Tarefas:

- Melhorar landing.
- Criar pricing page.
- Criar onboarding.
- Criar e-mails.
- Melhorar dashboard.
- Adicionar export CSV.
- Adicionar UTM builder.
- Adicionar WhatsApp link builder.
- Melhorar QR Code.
- Criar páginas de erro bonitas.

Resultado:

Produto pronto para vender para pequenos negócios.

---

## Fase 4: Recursos avançados

Objetivo:

Aumentar retenção e ticket.

Tarefas:

- Links com senha.
- Expiração avançada.
- Campanhas.
- Bio pages.
- Domínio personalizado.
- Membros.
- Relatórios por período.
- API pública.
- Webhooks para clientes.

Resultado:

SaaS mais robusto.

---

## 38. MVP mínimo absoluto

Se for necessário lançar o mais rápido possível, o escopo mínimo é:

- Login.
- Criar link curto.
- Redirecionar.
- Contar clique.
- Listar links.
- Ver cliques totais.
- QR Code.
- Plano free manual.

Não incluir no primeiro corte:

- Billing.
- Domínio personalizado.
- Link com senha.
- Bio page.
- Exportação.
- Campanhas complexas.
- API pública.

Esse MVP já pode ser usado para demonstração e validação.

---

## 39. Primeira versão vendável

A primeira versão realmente vendável deve ter:

- Login.
- Dashboard bonito.
- Criar link.
- Slug personalizado.
- QR Code.
- Métricas simples.
- UTM builder simples.
- Links de WhatsApp.
- Plano pago via Asaas.
- Limites por plano.
- E-mails básicos.
- Landing page com preço.
- Suporte manual.

Isso já permite vender para:

- lojas locais
- restaurantes
- clínicas
- profissionais autônomos
- pequenas agências
- social medias
- vendedores
- infoprodutores pequenos

---

## 40. Estratégia comercial conectada ao produto

O produto pode ser vendido com a seguinte promessa:

“Crie links curtos, QR Codes e campanhas rastreáveis para saber quais canais realmente geram cliques e oportunidades.”

Casos de uso comerciais:

### Restaurante

- QR Code para cardápio.
- Link para WhatsApp.
- Campanha de almoço.
- Promoção de fim de semana.

### Clínica

- Link para agendamento.
- QR Code na recepção.
- Link para localização.
- Campanha de check-up.

### Loja

- Link para catálogo.
- WhatsApp com mensagem pronta.
- QR Code em embalagem.
- Campanha no Instagram.

### Agência

- Links para clientes.
- Campanhas separadas.
- Relatórios simples.
- Domínio personalizado no plano maior.

### Evento

- QR Code para inscrição.
- Link para localização.
- Link para grupo de WhatsApp.
- Métricas de divulgação.

---

## 41. Experiência do usuário

O usuário comum não quer ver termos técnicos demais.

Evitar na interface principal:

- UTM source
- UTM medium
- HTTP status
- Referrer bruto
- User agent
- Query params

Traduzir para linguagem simples:

- Origem
- Canal
- Campanha
- Cliques
- Cidade
- Dispositivo
- Melhor horário
- Link mais acessado

Exemplos:

Em vez de:
“Referrer”

Usar:
“De onde vieram os acessos”

Em vez de:
“Device type”

Usar:
“Tipo de dispositivo”

Em vez de:
“UTM Campaign”

Usar:
“Nome da campanha”

---

## 42. Design do dashboard

Páginas principais:

### Dashboard home

Cards:

- Total de cliques.
- Links ativos.
- Melhor link.
- Cliques nos últimos 7 dias.

Gráfico:

- Cliques por dia.

Tabela:

- Links recentes.

### Links

Tabela com:

- Título.
- Link curto.
- Destino.
- Cliques.
- Status.
- Criado em.
- Ações.

Filtros:

- Status.
- Campanha.
- Período.
- Busca.

### Detalhe do link

Mostrar:

- Link curto.
- Botão copiar.
- QR Code.
- URL destino.
- Status.
- Total de cliques.
- Gráfico.
- Origem dos acessos.
- Dispositivos.
- Localização.
- Configurações.

### Billing

Mostrar:

- Plano atual.
- Limites.
- Uso atual.
- Botão upgrade.
- Histórico básico.

---

## 43. Limites e enforcement

Toda ação que consome plano deve validar limites.

Exemplos:

Criar link:

- Verificar maxLinks.
- Verificar assinatura ativa.
- Verificar workspace.

Ver analytics:

- Respeitar retention do plano.
- Free vê apenas 7 dias.
- Starter vê 30 dias.
- Pro vê 12 meses.

Usar domínio personalizado:

- Verificar customDomainsEnabled.

Criar link com senha:

- Verificar passwordLinksEnabled.

Exportar CSV:

- Verificar plano.

Essas validações devem ficar centralizadas em helpers de billing/plans.

Exemplo conceitual:

canCreateLink(workspace)
canUseCustomDomain(workspace)
canExportAnalytics(workspace)
getAnalyticsRetentionDays(workspace)

---

## 44. Admin interno

Criar área admin para uso próprio.

Funcionalidades:

- Ver usuários.
- Ver workspaces.
- Ver links recentes.
- Ver assinaturas.
- Ver eventos de billing.
- Desativar link abusivo.
- Desativar workspace.
- Ver erros de KV sync.
- Ver uso por workspace.

Acesso:

- Apenas usuários internos marcados como admin.
- Não confundir admin interno com admin de workspace.

Tabela possível:

internal_admins

Ou campo:

users.isInternalAdmin

No MVP, pode ser manual no banco.

---

## 45. Anti-abuso e moderação

Como encurtador pode ser usado para abuso, precisa haver controle.

Funcionalidades mínimas:

- Botão/report abuse público.
- Página /abuse.
- Capacidade interna de desativar link.
- Capacidade interna de desativar workspace.
- Lista de domínios bloqueados.
- Logs de criação de links.

Tabela:

blocked_domains

Campos:

- id
- domain
- reason
- createdAt

Tabela:

abuse_reports

Campos:

- id
- linkId
- reporterEmail
- reason
- message
- status
- createdAt
- reviewedAt

---

## 46. Backups e retenção

Banco:

- Usar backups automáticos do Neon.
- Definir política de retenção.
- Testar restore periodicamente quando o produto crescer.

Dados de clique:

- Free: 7 dias de analytics visível.
- Starter: 30 dias.
- Pro: 12 meses.
- Business: maior.

Mesmo que os dados existam por mais tempo, a interface deve respeitar plano.

Futuro:

- Apagar ou arquivar cliques antigos.
- Agregar estatísticas diárias.
- Remover dados brutos depois de certo tempo.

---

## 47. Testes

Testes importantes:

### Unitários

- Validação de URL.
- Geração de slug.
- Regras de plano.
- Helpers de UTM.
- Helpers de billing.
- Permissões.

### Integração

- Criar link.
- Editar link.
- Sync KV.
- Webhook Asaas.
- Registro de clique.
- Login e sessão.

### E2E

- Usuário cria conta.
- Cria link.
- Acessa link.
- Vê clique no dashboard.
- Faz upgrade.
- Limite de plano muda.

Ferramentas possíveis:

- Vitest
- Playwright
- Testing Library

No MVP, começar com testes críticos:

- Slug.
- URL.
- Billing webhook.
- Permissões.
- Redirect.

---

## 48. Variáveis de ambiente

Variáveis do app web:

DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SHORT_DOMAIN
ASAAS_API_KEY
ASAAS_WEBHOOK_SECRET
RESEND_API_KEY
SENTRY_DSN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_KV_NAMESPACE_ID
INTERNAL_API_SECRET
IP_HASH_SECRET

Variáveis do Worker:

SHORT_DOMAIN
INTERNAL_API_URL
INTERNAL_API_SECRET
IP_HASH_SECRET
SENTRY_DSN
ENVIRONMENT

Bindings do Worker:

LINKS_KV

---

## 49. Secrets

Regras:

- Nunca commitar .env.
- Usar .env.example sem valores reais.
- Usar secrets da Vercel.
- Usar secrets da Cloudflare.
- Rotacionar chaves se vazarem.
- Separar chaves de dev e produção.
- Não logar API keys.
- Não logar headers sensíveis.

---

## 50. Comandos esperados

Comandos do monorepo:

- pnpm dev
- pnpm build
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm db:generate
- pnpm db:migrate
- pnpm db:studio
- pnpm worker:dev
- pnpm worker:deploy

Scripts devem ser padronizados no package.json raiz e nos apps.

---

## 51. Critérios de pronto

Uma funcionalidade só é considerada pronta quando:

- Funciona no fluxo principal.
- Tem validação de entrada.
- Tem tratamento de erro.
- Respeita permissões.
- Respeita limites do plano, se aplicável.
- Não quebra mobile.
- Tem estado de loading.
- Tem feedback visual.
- Erros críticos vão para Sentry.
- Dados críticos são persistidos corretamente.
- Alterações em links sincronizam com KV.

---

## 52. Decisões técnicas importantes

### 52.1 Por que Next.js?

Porque permite construir landing, dashboard, backend simples, Server Actions e Route Handlers em uma única base TypeScript.

### 52.2 Por que Cloudflare Worker?

Porque redirect precisa ser rápido, barato e próximo do usuário.

### 52.3 Por que Cloudflare KV?

Porque lookup de slug para URL destino é um caso perfeito de leitura rápida distribuída.

### 52.4 Por que Neon Postgres?

Porque é Postgres gerenciado, moderno, simples de usar com Vercel e suficiente para MVP e crescimento inicial.

### 52.5 Por que Better Auth?

Porque permite manter autenticação sob controle do próprio app, sem depender de Supabase Auth.

### 52.6 Por que Asaas?

Porque é melhor adaptado ao mercado brasileiro, com Pix, boleto, cartão e assinatura.

### 52.7 Por que Resend?

Porque simplifica e-mails transacionais com boa experiência de desenvolvimento.

### 52.8 Por que Drizzle?

Porque é TypeScript-first, leve, explícito e combina bem com Postgres.

---

## 53. O que não fazer no MVP

Não implementar no MVP:

- Kubernetes.
- Microserviços.
- Kafka.
- ClickHouse.
- Domínio personalizado automático.
- Editor complexo de QR Code.
- Linktree completo.
- API pública.
- Webhooks para clientes.
- Sistema avançado de antifraude.
- Analytics em tempo real avançado.
- A/B testing.
- Pixel de retargeting.
- Integração com Google Analytics.
- Importador em massa.
- Multi-idioma.
- White label.

Essas coisas podem vir depois.

---

## 54. Riscos

### 54.1 Produto parecer commodity

Risco:

Usuário pensar que é apenas mais um encurtador gratuito.

Mitigação:

Posicionar como ferramenta de campanha, QR Code, WhatsApp e métricas simples para negócios brasileiros.

### 54.2 Abuso por spam/phishing

Risco:

Usuários mal-intencionados usarem links para golpes.

Mitigação:

Moderação, reports, lista de bloqueio, monitoramento e capacidade de desativação rápida.

### 54.3 Analytics crescer rápido

Risco:

Tabela clicks ficar grande.

Mitigação:

Índices, agregações, retenção e futura migração para ClickHouse ou particionamento.

### 54.4 Billing inconsistente

Risco:

Webhooks duplicados ou perdidos causarem plano errado.

Mitigação:

Idempotência, logs de billing_events e reconciliação manual.

### 54.5 KV inconsistente

Risco:

Postgres atualizado, KV não atualizado.

Mitigação:

Logs de sync, jobs futuros de resync e Postgres como fonte da verdade.

---

## 55. Estratégia de lançamento

Lançamento inicial pode ser feito em círculos pequenos:

1. Uso interno.
2. Clientes próximos.
3. Empresas locais de Goiânia.
4. Social medias e agências pequenas.
5. Restaurantes, clínicas e lojas.
6. Oferta junto com diagnóstico digital gratuito.

Pitch simples:

“Eu consigo te entregar links rastreáveis e QR Codes para você saber quais campanhas, panfletos, posts ou mensagens estão gerando mais cliques para seu WhatsApp ou site.”

Oferta inicial:

- Plano gratuito para teste.
- Plano R$ 19,90/mês.
- Setup gratuito para primeiros clientes.
- Relatório simples mensal como diferencial manual no começo.

---

## 56. Métricas do negócio

Métricas de produto:

- Usuários cadastrados.
- Workspaces criados.
- Links criados.
- Links ativos.
- Cliques por workspace.
- QR Codes baixados.
- Usuários que criaram pelo menos 1 link.
- Usuários que receberam pelo menos 10 cliques.
- Conversão free para pago.
- Churn.
- MRR.
- ARPU.

Métricas técnicas:

- Latência média do redirect.
- Erros 5xx no Worker.
- Erros no app.
- Falhas de webhook.
- Falhas de KV sync.
- Crescimento da tabela clicks.

---

## 57. Possível nome do produto

Opções:

- LinkSimples
- MeuLink
- RastroLink
- LinkMétrico
- CampanhaLink
- ZapLink
- LinkBR
- Casa Links
- Casa da Árvore Links

Direção recomendada:

Se for produto independente:

- LinkSimples

Se for produto dentro da Casa da Árvore:

- Casa Links

---

## 58. Resumo da arquitetura final

O projeto será um SaaS em monorepo TypeScript usando pnpm workspaces e Turborepo.

O app principal será construído com Next.js, Tailwind e shadcn/ui, usando Server Actions e Route Handlers para lógica de negócio, autenticação com Better Auth e persistência em Neon PostgreSQL via Drizzle ORM.

O redirecionamento será separado em um Cloudflare Worker com Hono, usando Cloudflare KV para buscar rapidamente o destino dos links. O Postgres será a fonte da verdade, enquanto o KV será usado como cache operacional para redirects rápidos.

A cobrança será feita via Asaas, com webhooks idempotentes para atualizar assinaturas e planos. E-mails transacionais serão enviados via Resend. Erros e logs técnicos serão monitorados com Sentry e Cloudflare Analytics.

A primeira versão deve focar em links curtos, QR Codes, métricas simples, WhatsApp links, dashboard e cobrança. Recursos como domínio personalizado, bio pages, API pública, analytics avançado e antifraude sofisticado ficam para fases posteriores.

O objetivo é construir um produto simples, barato, brasileiro e vendável, que funcione tanto como SaaS independente quanto como produto de entrada para outros serviços digitais.