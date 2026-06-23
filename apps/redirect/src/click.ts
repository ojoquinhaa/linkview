import type { ClickIngestInput, KvLinkRecord } from "@urlsimples/shared";
import type { Bindings } from "./types";
import { parseUa } from "./ua";

/** SHA-256 hash of `ip + salt`, hex-encoded. Never store raw IPs (§14.6). */
export async function hashIp(ip: string, salt: string): Promise<string> {
	const data = new TextEncoder().encode(`${ip}:${salt}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

interface CfProps {
	country?: string;
	region?: string;
	city?: string;
}

/** Build the click payload from the incoming request + KV record. */
export async function buildClick(
	req: Request,
	link: KvLinkRecord,
	env: Bindings,
): Promise<ClickIngestInput> {
	const ua = req.headers.get("user-agent");
	const parsed = parseUa(ua);
	const ip =
		req.headers.get("cf-connecting-ip") ??
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"";
	const cf = (req as Request & { cf?: CfProps }).cf ?? {};
	const url = new URL(req.url);

	return {
		linkId: link.linkId,
		workspaceId: link.workspaceId,
		// `?qr=<id>` marks a scan from a tracked QR code; validated app-side.
		qrCodeId: url.searchParams.get("qr") ?? undefined,
		occurredAt: new Date().toISOString(),
		ipHash: ip ? await hashIp(ip, env.IP_HASH_SALT) : undefined,
		userAgent: ua ?? undefined,
		referer: req.headers.get("referer") ?? undefined,
		country: cf.country ?? req.headers.get("cf-ipcountry") ?? undefined,
		region: cf.region,
		city: cf.city,
		device: parsed.device,
		browser: parsed.browser,
		os: parsed.os,
		bot: parsed.bot,
		source: url.searchParams.get("utm_source") ?? undefined,
		medium: url.searchParams.get("utm_medium") ?? undefined,
		campaign: url.searchParams.get("utm_campaign") ?? undefined,
	};
}

/**
 * Send the click to the app ingest endpoint. Fire-and-forget: failures are
 * swallowed so they never block the redirect (§11.5 Option A).
 */
export async function sendClick(
	payload: ClickIngestInput,
	env: Bindings,
): Promise<void> {
	if (!env.CLICK_INGEST_URL) return;
	try {
		await fetch(env.CLICK_INGEST_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(env.CLICK_INGEST_TOKEN
					? { authorization: `Bearer ${env.CLICK_INGEST_TOKEN}` }
					: {}),
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(2000),
		});
	} catch {
		// Swallow — tracking must never break redirects.
	}
}
