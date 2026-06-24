import type { KvLinkRecord } from "@linkview/shared";
import type { Bindings } from "./types";

/** Unlock cookie name for a given link. */
export function unlockCookieName(linkId: string): string {
	return `us_pw_${linkId}`;
}

const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000; // 12h

async function hmacHex(secret: string, msg: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(msg),
	);
	return [...new Uint8Array(sig)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Constant-time hex string comparison. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Signed `exp.signature` token proving the visitor cleared the password. */
export async function makeUnlockToken(
	linkId: string,
	secret: string,
): Promise<string> {
	const exp = Date.now() + UNLOCK_TTL_MS;
	const sig = await hmacHex(secret, `${linkId}.${exp}`);
	return `${exp}.${sig}`;
}

export async function verifyUnlockToken(
	token: string,
	linkId: string,
	secret: string,
): Promise<boolean> {
	const [expStr, sig] = token.split(".");
	if (!expStr || !sig) return false;
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || exp < Date.now()) return false;
	const expected = await hmacHex(secret, `${linkId}.${exp}`);
	return safeEqual(sig, expected);
}

/** True when the visitor's country is not allowed for this link (§14.7). */
export function countryBlocked(
	link: KvLinkRecord,
	country: string | undefined,
): boolean {
	const c = (country ?? "").toUpperCase();
	const allow = (link.allowedCountries ?? []).map((x) => x.toUpperCase());
	const block = (link.blockedCountries ?? []).map((x) => x.toUpperCase());
	if (allow.length > 0 && (!c || !allow.includes(c))) return true;
	if (c && block.includes(c)) return true;
	return false;
}

/**
 * Fixed-window per-IP rate limit backed by KV. Best-effort: KV is eventually
 * consistent and not atomic, so the cap is approximate across edge locations.
 * Returns true when the request should be rejected.
 */
export async function rateLimited(
	env: Bindings,
	linkId: string,
	ipHash: string,
	limitPerMinute: number,
): Promise<boolean> {
	const bucket = Math.floor(Date.now() / 60_000);
	const key = `rl:${linkId}:${ipHash}:${bucket}`;
	const current = Number((await env.LINKS_KV.get(key)) ?? "0");
	if (current >= limitPerMinute) return true;
	await env.LINKS_KV.put(key, String(current + 1), { expirationTtl: 120 });
	return false;
}

/** Ask the web app to verify a submitted password against Postgres (§14.5). */
export async function verifyPasswordRemote(
	env: Bindings,
	hostname: string,
	slug: string,
	password: string,
): Promise<boolean> {
	if (!env.UNLOCK_VERIFY_URL) return false;
	try {
		const res = await fetch(env.UNLOCK_VERIFY_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(env.CLICK_INGEST_TOKEN
					? { authorization: `Bearer ${env.CLICK_INGEST_TOKEN}` }
					: {}),
			},
			body: JSON.stringify({ hostname, slug, password }),
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return false;
		const data = (await res.json()) as { ok?: boolean };
		return data.ok === true;
	} catch {
		return false;
	}
}

/** Minimal unlock form page (Portuguese). Posts back to the current URL. */
export function unlockPage(error = false): Response {
	const msg = error ? `<p class="err">Senha incorreta. Tente de novo.</p>` : "";
	const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link protegido</title><style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{width:100%;max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .25rem}p{color:#a1a1aa;margin:.25rem 0 1.25rem}.err{color:#f87171}form{display:flex;flex-direction:column;gap:.75rem}input{padding:.7rem .8rem;border-radius:.6rem;border:1px solid #2a2a32;background:#15151b;color:#fff;font-size:1rem}button{padding:.7rem;border:0;border-radius:.6rem;background:#6366f1;color:#fff;font-size:1rem;font-weight:600;cursor:pointer}</style></head><body><main><h1>Link protegido</h1><p>Digite a senha para continuar.</p>${msg}<form method="post" autocomplete="off"><input type="password" name="password" placeholder="Senha" autofocus required minlength="4"><button type="submit">Acessar</button></form></main></body></html>`;
	return new Response(html, {
		status: error ? 401 : 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}
