import {
	isExpired,
	type KvLinkRecord,
	kvLinkRecordSchema,
} from "@urlsimples/shared";
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
	verifyPasswordRemote,
	verifyUnlockToken,
} from "./security";
import type { Bindings } from "./types";
import { parseUa } from "./ua";

type Env = { Bindings: Bindings };

const app = new Hono<Env>();

function errorPage(title: string, message: string, status: number): Response {
	const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{text-align:center;padding:2rem}h1{font-size:3rem;margin:0}p{color:#a1a1aa}</style></head><body><main><h1>${status}</h1><p>${message}</p></main></body></html>`;
	return new Response(html, {
		status,
		headers: { "content-type": "text/html; charset=utf-8" },
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
	return c.redirect(link.destinationUrl, 302);
}

/** Load and validate the KV record, applying the active/expiry/geo/bot gates. */
async function loadGatedLink(
	c: Context<Env>,
): Promise<{ link: KvLinkRecord } | { error: Response }> {
	const slug = c.req.param("slug");
	const hostname = new URL(c.req.url).hostname;
	const raw = await c.env.LINKS_KV.get(`link:${hostname}:${slug}`, "json");
	if (!raw) {
		return { error: errorPage("Não encontrado", "Este link não existe.", 404) };
	}
	const parsed = kvLinkRecordSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: errorPage("Erro", "Link inválido.", 404) };
	}
	const link = parsed.data;

	if (!link.active) {
		return {
			error: errorPage("Indisponível", "Este link foi desativado.", 403),
		};
	}
	if (isExpired(link.expiresAt)) {
		return { error: errorPage("Expirado", "Este link expirou.", 410) };
	}

	// Bot/crawler gate (§14.7).
	if (link.blockBots && parseUa(c.req.header("user-agent")).bot) {
		return {
			error: errorPage("Indisponível", "Acesso não permitido.", 403),
		};
	}

	// Geo gate (§14.7).
	if (countryBlocked(link, clientCountry(c.req.raw))) {
		return {
			error: errorPage(
				"Indisponível",
				"Este link não está disponível na sua região.",
				403,
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
						"Você acessou este link muitas vezes. Aguarde um minuto.",
						429,
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
	c.text("urlsimples redirect engine", 200, { "cache-control": "no-store" }),
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
