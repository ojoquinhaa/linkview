export interface ParsedUa {
	device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
	browser: string;
	os: string;
	bot: boolean;
}

const BOT_RE =
	/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|preview|monitor|curl|wget|python-requests|headless/i;

/** Lightweight UA parser — enough for MVP analytics buckets. */
export function parseUa(ua: string | null | undefined): ParsedUa {
	if (!ua)
		return { device: "unknown", browser: "unknown", os: "unknown", bot: false };

	const bot = BOT_RE.test(ua);

	const isTablet =
		/ipad|tablet|playbook|silk/i.test(ua) ||
		(/android/i.test(ua) && !/mobile/i.test(ua));
	const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
	const device: ParsedUa["device"] = bot
		? "bot"
		: isTablet
			? "tablet"
			: isMobile
				? "mobile"
				: "desktop";

	let browser = "unknown";
	if (/edg/i.test(ua)) browser = "Edge";
	else if (/opr|opera/i.test(ua)) browser = "Opera";
	else if (/chrome|crios/i.test(ua)) browser = "Chrome";
	else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
	else if (/safari/i.test(ua)) browser = "Safari";

	let os = "unknown";
	if (/windows/i.test(ua)) os = "Windows";
	else if (/iphone|ipad|ipod|ios/i.test(ua)) os = "iOS";
	else if (/mac os x/i.test(ua)) os = "macOS";
	else if (/android/i.test(ua)) os = "Android";
	else if (/linux/i.test(ua)) os = "Linux";

	return { device, browser, os, bot };
}
