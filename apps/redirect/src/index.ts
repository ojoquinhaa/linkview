import {
	canonicalizeDestinationUrl,
	isExpired,
	type KvLinkRecord,
	kvLinkRecordSchema,
} from "@linkview/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { buildClick, hashIp, sendClick } from "./click";
import {
	countryBlocked,
	makeUnlockToken,
	rateLimited,
	unlockCookieName,
	unlockPage,
	unlockRateLimited,
	verifyPasswordRemote,
	verifyUnlockToken,
} from "./security";
import type { Bindings } from "./types";
import { parseUa } from "./ua";

type Env = { Bindings: Bindings };

const app = new Hono<Env>();

/** Where visitors who hit a dead link go to discover the product. */
const MARKETING_URL = "https://app.linkview.com.br";

type ErrorKind =
	| "notfound"
	| "invalid"
	| "disabled"
	| "expired"
	| "blocked"
	| "ratelimit";

/** Line-art glyph per state (24×24, currentColor stroke). */
const ICONS: Record<ErrorKind, string> = {
	notfound: `<circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16" y2="16"/>`,
	invalid: `<path d="M12 4l9 15.5H3z"/><line x1="12" y1="10" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12" y2="17.01"/>`,
	disabled: `<path d="M9.6 9.6 6.9 12.3a3.7 3.7 0 0 0 5.2 5.2l1.2-1.2"/><path d="M14.4 14.4 17.1 11.7a3.7 3.7 0 0 0-5.2-5.2l-1.2 1.2"/><line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/>`,
	expired: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
	blocked: `<path d="M12 3.5 19 6.2v5.3c0 4-2.9 6.6-7 8-4.1-1.4-7-4-7-8V6.2L12 3.5Z"/><line x1="9" y1="12" x2="15" y2="12"/>`,
	ratelimit: `<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.2l2.8 1.6"/>`,
};

/** States that read as a guard/limit rather than a neutral dead end. */
const ALERT_KINDS = new Set<ErrorKind>(["blocked", "ratelimit"]);

/**
 * Branded, visitor-facing status page (404/403/410/429). Light "Tinta" system,
 * single indigo accent, wordmark, and a conversion nudge back to the product.
 * Self-contained: no external fonts or assets so it renders instantly anywhere.
 */
function errorPage(
	title: string,
	message: string,
	status: number,
	kind: ErrorKind = "notfound",
): Response {
	const alert = ALERT_KINDS.has(kind);
	const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · linkview</title>
<style>
*{box-sizing:border-box}
:root{
--paper:#f6f7fa;--paper:oklch(.985 .004 250);
--surface:#fdfdff;--surface:oklch(.998 .002 250);
--ink:#232838;--ink:oklch(.2 .02 262);
--muted:#71788c;--muted:oklch(.54 .018 258);
--line:#e4e7ee;--line:oklch(.91 .006 255);
--accent:#4b51c4;--accent:oklch(.48 .15 265);
--accent-deep:#3d43ad;--accent-deep:oklch(.42 .16 265);
--accent-weak:#ebeefc;--accent-weak:oklch(.955 .028 265);
--accent-ink:#fff;--accent-ink:oklch(.99 .002 250);
--danger:#c4434f;--danger:oklch(.53 .18 25);
--danger-weak:#fbecec;--danger-weak:oklch(.955 .02 25);
--ease:cubic-bezier(.22,1,.36,1);
}
html,body{height:100%}
body{
margin:0;color:var(--ink);
font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
background:radial-gradient(46rem 24rem at 50% -8%,rgba(75,81,196,.07),transparent 70%),var(--paper);
display:grid;place-items:center;padding:2rem 1.25rem;
-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.wrap{width:100%;max-width:27rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.5rem;animation:rise .55s var(--ease) both}
.brand{display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--ink)}
.brand-mark{width:1.05rem;height:1.05rem;border-radius:.32rem;background:var(--accent);box-shadow:0 1px 2px rgba(61,67,173,.4),0 2px 8px rgba(61,67,173,.22)}
.brand-name{font-weight:600;font-size:1.06rem;letter-spacing:-.02em}
.status{display:flex;flex-direction:column;align-items:center;gap:.85rem}
.badge{width:4rem;height:4rem;border-radius:999px;display:grid;place-items:center;background:var(--accent-weak);color:var(--accent-deep);box-shadow:inset 0 0 0 1px rgba(75,81,196,.12)}
.badge.alert{background:var(--danger-weak);color:var(--danger);box-shadow:inset 0 0 0 1px rgba(196,67,79,.14)}
.badge svg{width:1.8rem;height:1.8rem;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
h1{margin:0;font-size:clamp(1.45rem,5.5vw,1.8rem);font-weight:600;letter-spacing:-.02em;line-height:1.15}
.msg{margin:0;color:var(--muted);font-size:1rem;line-height:1.6;max-width:32ch}
.promo{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:1rem;padding:1.4rem 1.25rem;box-shadow:0 1px 2px rgba(40,44,70,.04);display:flex;flex-direction:column;align-items:center;gap:.5rem}
.promo-eyebrow{margin:0;font-size:.68rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.promo-title{margin:0;font-size:1.08rem;font-weight:600;letter-spacing:-.01em;line-height:1.3;max-width:24ch}
.promo-sub{margin:0 0 .35rem;font-size:.9rem;color:var(--muted);line-height:1.55;max-width:30ch}
.cta{display:inline-flex;align-items:center;gap:.45rem;height:2.75rem;padding:0 1.15rem;border-radius:.625rem;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:.92rem;text-decoration:none;box-shadow:0 1px 2px rgba(61,67,173,.35),0 2px 10px rgba(61,67,173,.2);transition:background .15s var(--ease),transform .15s var(--ease)}
.cta:hover{background:var(--accent-deep)}
.cta:active{transform:translateY(1px)}
.cta svg{width:1.05rem;height:1.05rem;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.foot{margin:0;font-size:.78rem;color:var(--muted);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
a:focus-visible,.cta:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:.5rem}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.wrap{animation:none}.cta{transition:none}}
</style>
</head>
<body>
<main class="wrap">
<a class="brand" href="${MARKETING_URL}">
<span class="brand-mark" aria-hidden="true"></span>
<span class="brand-name">linkview</span>
</a>
<div class="status">
<span class="badge${alert ? " alert" : ""}" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[kind]}</svg></span>
<h1>${title}</h1>
<p class="msg">${message}</p>
</div>
<section class="promo">
<p class="promo-eyebrow">linkview</p>
<h2 class="promo-title">Crie seus próprios links e QR Codes</h2>
<p class="promo-sub">Encurte, gere QR Code e veja de onde vêm os cliques. Em português, pagando em reais.</p>
<a class="cta" href="${MARKETING_URL}/register">Começar de graça<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a>
</section>
<p class="foot">lnkv.com.br</p>
</main>
</body>
</html>`;
	return new Response(html, {
		status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

interface CfProps {
	country?: string;
}

function clientCountry(req: Request): string | undefined {
	const cf = (req as Request & { cf?: CfProps }).cf;
	return cf?.country ?? req.headers.get("cf-ipcountry") ?? undefined;
}

function clientIp(req: Request): string {
	return (
		req.headers.get("cf-connecting-ip") ??
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		""
	);
}

/** Record the click for a visit (non-blocking; never delays the response). */
function recordClick(c: Context<Env>, link: KvLinkRecord): void {
	c.executionCtx.waitUntil(
		buildClick(c.req.raw, link, c.env).then((payload) =>
			sendClick(payload, c.env),
		),
	);
}

/** Record the click and 302 straight to the destination (no interstitial). */
function doRedirect(c: Context<Env>, link: KvLinkRecord): Response {
	recordClick(c, link);
	// Older KV records may hold raw emoji in the URL; the Location header is a
	// Latin-1 byte string, so canonicalize to percent-encoding before redirecting.
	return c.redirect(canonicalizeDestinationUrl(link.destinationUrl), 302);
}

/** Load and validate the KV record, applying the active/expiry/geo/bot gates. */
async function loadGatedLink(
	c: Context<Env>,
): Promise<{ link: KvLinkRecord } | { error: Response }> {
	const slug = c.req.param("slug");
	const hostname = new URL(c.req.url).hostname;
	const raw = await c.env.LINKS_KV.get(`link:${hostname}:${slug}`, "json");
	if (!raw) {
		return {
			error: errorPage(
				"Link não encontrado",
				"Este link não existe ou foi removido. Confira se o endereço está correto.",
				404,
				"notfound",
			),
		};
	}
	const parsed = kvLinkRecordSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			error: errorPage(
				"Link inválido",
				"Não foi possível abrir este link. Confira se o endereço está correto.",
				404,
				"invalid",
			),
		};
	}
	const link = parsed.data;

	// Workspace billing gate (§billing). A lapsed workspace's links go dark: no
	// redirect, no click. The flag is written only while billing is locked, so
	// the common path is an absent key (one cheap KV read) — live by default.
	const wsGate = (await c.env.LINKS_KV.get(
		`ws:${link.workspaceId}`,
		"json",
	)) as { live?: boolean } | null;
	if (wsGate && wsGate.live === false) {
		return {
			error: errorPage(
				"Link indisponível",
				"Este link está temporariamente fora do ar. Tente novamente mais tarde.",
				404,
				"notfound",
			),
		};
	}

	if (!link.active) {
		return {
			error: errorPage(
				"Link desativado",
				"Quem criou este link o desativou, então ele não está mais disponível.",
				403,
				"disabled",
			),
		};
	}
	if (isExpired(link.expiresAt)) {
		return {
			error: errorPage(
				"Link expirado",
				"Este link tinha prazo de validade e já não está mais ativo.",
				410,
				"expired",
			),
		};
	}

	// Bot/crawler gate (§14.7).
	if (link.blockBots && parseUa(c.req.header("user-agent")).bot) {
		return {
			error: errorPage(
				"Acesso não permitido",
				"Não foi possível liberar o acesso a este link.",
				403,
				"blocked",
			),
		};
	}

	// Geo gate (§14.7).
	if (countryBlocked(link, clientCountry(c.req.raw))) {
		return {
			error: errorPage(
				"Indisponível na sua região",
				"Quem criou este link limitou o acesso por localização.",
				403,
				"blocked",
			),
		};
	}

	// Per-IP rate limit (§14.7). Best-effort; skipped when IP is unknown.
	if (link.rateLimitPerMinute && link.rateLimitPerMinute > 0) {
		const ip = clientIp(c.req.raw);
		if (ip) {
			const ipHash = await hashIp(ip, c.env.IP_HASH_SALT);
			if (
				await rateLimited(c.env, link.linkId, ipHash, link.rateLimitPerMinute)
			) {
				return {
					error: errorPage(
						"Muitas tentativas",
						"Você abriu este link várias vezes seguidas. Aguarde um minuto e tente de novo.",
						429,
						"ratelimit",
					),
				};
			}
		}
	}

	return { link };
}

async function isUnlocked(c: Context<Env>, linkId: string): Promise<boolean> {
	const secret = c.env.UNLOCK_SECRET;
	if (!secret) return false;
	const token = getCookie(c, unlockCookieName(linkId));
	if (!token) return false;
	return verifyUnlockToken(token, linkId, secret);
}

app.get("/", (c) =>
	c.text("linkview redirect engine", 200, { "cache-control": "no-store" }),
);

app.get("/favicon.ico", (c) => c.body(null, 204));

app.get("/:slug", async (c) => {
	const gated = await loadGatedLink(c);
	if ("error" in gated) return gated.error;
	const { link } = gated;

	if (link.passwordProtected && !(await isUnlocked(c, link.linkId))) {
		return unlockPage();
	}

	return doRedirect(c, link);
});

// Password submission for a protected link (§14.5).
app.post("/:slug", async (c) => {
	const gated = await loadGatedLink(c);
	if ("error" in gated) return gated.error;
	const { link } = gated;

	if (!link.passwordProtected) {
		// Nothing to submit; treat as a normal visit.
		return doRedirect(c, link);
	}

	// Throttle password guessing per IP, independent of the owner's redirect
	// rate limit, so a protected link can't be brute-forced.
	const ip = clientIp(c.req.raw);
	if (ip) {
		const ipHash = await hashIp(ip, c.env.IP_HASH_SALT);
		if (await unlockRateLimited(c.env, link.linkId, ipHash)) {
			return errorPage(
				"Muitas tentativas",
				"Você tentou a senha várias vezes. Aguarde um minuto e tente de novo.",
				429,
				"ratelimit",
			);
		}
	}

	const form = await c.req.formData();
	const password = String(form.get("password") ?? "");
	const hostname = new URL(c.req.url).hostname;
	const ok = await verifyPasswordRemote(
		c.env,
		hostname,
		c.req.param("slug"),
		password,
	);
	if (!ok) return unlockPage(true);

	const secret = c.env.UNLOCK_SECRET;
	if (secret) {
		setCookie(
			c,
			unlockCookieName(link.linkId),
			await makeUnlockToken(link.linkId, secret),
			{
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
				path: "/",
				maxAge: 12 * 60 * 60,
			},
		);
	}
	return doRedirect(c, link);
});

export default app;
