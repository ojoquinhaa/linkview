# linkview

SaaS brasileiro de links rastreáveis, QR Codes e campanhas. Alternativa simples,
barata e nacional a Bitly / TinyURL / Linktree — pague em reais (Pix, boleto ou
cartão via Asaas).

- **App / dashboard:** `app.linkview.com.br`
- **Links curtos:** `lnkv.com.br`
- **Marca:** `linkview.com.br`

## Arquitetura

Monorepo pnpm + Turbo. Os links curtos são resolvidos na borda da Cloudflare
(Worker + KV), perto do Brasil, sem ida ao banco central — redirecionamento
rápido. O dashboard é Next.js; o tracking de cliques é gravado de forma não
bloqueante (`waitUntil`).

```
apps/
  web/        Dashboard Next.js (App Router) — app.linkview.com.br
  redirect/   Cloudflare Worker + Hono — resolve lnkv.com.br/:slug via KV
packages/
  db/         Drizzle ORM + Neon Postgres (schema, migrações, seed)
  auth/       Better Auth + permissões/roles
  shared/     Tipos, planos, schemas e helpers compartilhados
  config/     Configuração compartilhada (TS, etc.)
```

### Stack

- **Runtime:** Node ≥ 22, pnpm 10
- **Web:** Next.js 16 (Turbopack), React, Tailwind CSS 4
- **Borda:** Cloudflare Workers, Hono, KV
- **Dados:** Neon Postgres, Drizzle ORM
- **Auth:** Better Auth
- **Billing:** Asaas (Pix / boleto / cartão)
- **E-mail:** Resend · **Imagens OG:** Cloudflare R2 · **Realtime:** Upstash Redis
- **Tooling:** Turbo, Biome, TypeScript 6

## Começando

```bash
pnpm install
cp .env.example .env   # preencha as variáveis (ver abaixo)
pnpm db:push           # aplica o schema no Postgres
pnpm dev               # sobe todos os apps via Turbo
```

### Variáveis de ambiente

Veja [`.env.example`](.env.example) para a lista completa. Essenciais para subir
localmente:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Neon Postgres |
| `SYSTEM_DOMAIN` | Domínio dos links curtos (`lnkv.com.br`) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Sessão/auth |
| `NEXT_PUBLIC_APP_URL` | URL do app (browser); em produção `https://app.linkview.com.br` |

Billing (Asaas), e-mail (Resend), KV/R2 (Cloudflare) e Redis (Upstash) são
opcionais para o fluxo básico — sem eles os recursos correspondentes ficam
desligados.

## Scripts

| Comando | Ação |
| --- | --- |
| `pnpm dev` | Sobe todos os apps |
| `pnpm build` | Build de produção |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` | Lint (Biome) |
| `pnpm format` | Formata com Biome |
| `pnpm db:generate` | Gera migração Drizzle |
| `pnpm db:migrate` | Aplica migrações |
| `pnpm db:push` | Push do schema (dev) |
| `pnpm db:studio` | Drizzle Studio |

## Deploy

- **Web:** plataforma compatível com Next.js, com as variáveis de ambiente acima.
- **Redirect:** `pnpm --filter @linkview/redirect deploy` (Wrangler). As rotas
  `lnkv.com.br/*` estão definidas em `apps/redirect/wrangler.jsonc`; configure os
  secrets do Worker com `wrangler secret`.

## Licença

Privado. Todos os direitos reservados.
