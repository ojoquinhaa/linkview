# DESIGN.md — linkview ("Tinta")

Light only. Cool paper, deep ink, single indigo accent. Daytime, quick, trustworthy.
Tokens live in `apps/web/src/app/globals.css` (`:root` + `@theme inline`). Use the
semantic Tailwind classes (`bg-paper`, `text-ink`, `border-line`, `bg-accent`…), not
raw hex.

## Color (OKLCH)

| Token            | Value                  | Uso |
|------------------|------------------------|-----|
| `paper`          | oklch(.985 .004 250)   | fundo base |
| `paper-sunk`     | oklch(.967 .005 250)   | hover de linha, pílulas |
| `surface`        | oklch(.998 .002 250)   | cartões/painéis |
| `ink`            | oklch(.20 .02 262)     | texto principal |
| `ink-soft`       | oklch(.38 .02 260)     | labels, texto secundário forte |
| `muted`          | oklch(.54 .018 258)    | texto auxiliar, domínio apagado |
| `line` / `line-strong` | oklch(.91 .006 255) / oklch(.84 .01 258) | bordas |
| `accent`         | oklch(.48 .15 265)     | ações primárias, slug, seleção |
| `accent-deep`    | oklch(.42 .16 265)     | hover do accent, links |
| `accent-weak`    | oklch(.955 .028 265)   | fundo de sucesso/realce suave |
| `danger`         | oklch(.53 .18 25)      | erro |
| `ok`             | oklch(.55 .11 152)     | confirmação (copiado) |

Estratégia: **Restrained**. Accent só em ação primária, seleção e estado. Nunca decoração.

## Tipografia

- **Display** — Bricolage Grotesque (500/600/700): wordmark + H1/H2. `font-display`.
- **UI/corpo** — Inter: tudo o resto. `font-sans`.
- **Mono** — JetBrains Mono: slugs, short URLs, exemplos de link. `font-mono`.
- Escala fixa em rem (produto), não fluida. Numerais tabulares em contagens: `.nums`.

## Motivo de marca

O próprio link curto: `lnkv.com.br/oferta` — domínio em `muted`, slug em
`accent`. Wordmark = "linkview" + marca quadrada accent (cursor/ponto de domínio),
em `components/wordmark.tsx`. Ticker ambiente nas telas de auth digita slugs reais.

## Componentes (apps/web/src/components)

- `ui/button.tsx` — variantes primary/secondary/ghost/danger, tamanhos sm/md/lg,
  estado `loading` com spinner. Todos os estados (hover/focus/active/disabled).
- `ui/field.tsx` — `Field` (label+erro+hint via render-prop) e `Input` (foco com ring
  accent, `invalid` com ring danger, `prefix` para domínio em mono).
- `dashboard/copy-button.tsx`, `qr-button.tsx` (dialog nativo + download PNG),
  `create-link.tsx`, `sign-out-button.tsx`.

## Regras

- Radius input `--radius-input` (0.625rem); cartões `rounded-2xl`.
- Ease `--ease-out-quint`; transições 150ms; sem bounce; respeita reduced-motion.
- Sombras sutis tintadas de índigo, baixas. Sem glassmorphism (exceto backdrop do dialog).
- Foco sempre visível (`:focus-visible` ring accent). Dialog fecha no Esc + botão ✕.
