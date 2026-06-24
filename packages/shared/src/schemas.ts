import { z } from "zod";
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from "./constants";
import { isValidDocument, isValidPhone } from "./document";
import { PERSON_TYPES } from "./legal";
import { isValidDestinationUrl } from "./url";

const destinationUrl = z
	.string()
	.url()
	.refine(isValidDestinationUrl, { message: "URL de destino não permitida" });

const slugField = z
	.string()
	.min(SLUG_MIN_LENGTH)
	.max(SLUG_MAX_LENGTH)
	.regex(/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/, { message: "Slug inválido" });

export const utmSchema = z.object({
	utmSource: z.string().max(255).optional(),
	utmMedium: z.string().max(255).optional(),
	utmCampaign: z.string().max(255).optional(),
	utmTerm: z.string().max(255).optional(),
	utmContent: z.string().max(255).optional(),
});

export const createLinkSchema = z
	.object({
		destinationUrl,
		slug: slugField.optional(),
		title: z.string().max(255).optional(),
		description: z.string().max(1000).optional(),
		campaignId: z.string().uuid().optional(),
		domainId: z.string().uuid().optional(),
		expiresAt: z.coerce.date().optional(),
		password: z.string().min(4).max(128).optional(),
		tags: z.array(z.string().max(64)).max(20).optional(),
	})
	.merge(utmSchema);

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export const updateLinkSchema = createLinkSchema
	.partial()
	.extend({ isActive: z.boolean().optional() });

export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

/**
 * Account registration payload. Validated identically on the client (inline UX)
 * and on the server (authoritative, before the account is created). The
 * document is checked against its person type by the check-digit algorithm, and
 * Terms + Privacy consent must be explicitly granted.
 */
export const registerSchema = z
	.object({
		name: z.string().trim().min(2, "Informe seu nome").max(120),
		email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
		password: z
			.string()
			.min(8, "A senha precisa de ao menos 8 caracteres")
			.max(128),
		personType: z.enum(PERSON_TYPES),
		document: z.string().min(1, "Informe o documento"),
		phone: z.string().refine(isValidPhone, "Telefone inválido"),
		zip: z
			.string()
			.refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
		street: z.string().trim().min(1, "Informe o logradouro").max(200),
		number: z.string().trim().min(1, "Informe o número").max(20),
		complement: z.string().trim().max(120).optional().default(""),
		district: z.string().trim().min(1, "Informe o bairro").max(120),
		city: z.string().trim().min(1, "Informe a cidade").max(120),
		state: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z]{2}$/, "UF inválida"),
		acceptTerms: z.literal(true, {
			message: "É necessário aceitar os Termos de Uso",
		}),
		acceptPrivacy: z.literal(true, {
			message: "É necessário aceitar a Política de Privacidade",
		}),
		marketingOptIn: z.boolean().default(false),
	})
	.refine((data) => isValidDocument(data.document, data.personType), {
		message: "Documento inválido",
		path: ["document"],
	});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Editable account profile (the "Perfil" settings tab). The fiscal document and
 * person type are intentionally absent: they are billing identity, captured at
 * sign-up and changed only via support. Mirrors the contact + address fields of
 * `registerSchema` so the same validation runs on the client and the server.
 */
export const profileSchema = z.object({
	name: z.string().trim().min(2, "Informe seu nome").max(120),
	phone: z.string().refine(isValidPhone, "Telefone inválido"),
	zip: z
		.string()
		.refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
	street: z.string().trim().min(1, "Informe o logradouro").max(200),
	number: z.string().trim().min(1, "Informe o número").max(20),
	complement: z.string().trim().max(120).optional().default(""),
	district: z.string().trim().min(1, "Informe o bairro").max(120),
	city: z.string().trim().min(1, "Informe a cidade").max(120),
	state: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/, "UF inválida"),
	marketingOptIn: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const ogSchema = z.object({
	ogTitle: z.string().max(120).optional(),
	ogDescription: z.string().max(300).optional(),
	ogImageUrl: z.string().url().max(2048).optional(),
});

export type OgInput = z.infer<typeof ogSchema>;

/** Vertical placement of the logo on the redirect interstitial. */
export const LOGO_POSITIONS = ["top", "center", "bottom"] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];

/** Background source for the interstitial: a solid color or an uploaded image. */
export const SPLASH_BG_TYPES = ["color", "image"] as const;
export type SplashBgType = (typeof SPLASH_BG_TYPES)[number];

const hexColor = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, { message: "Use uma cor hex (#RRGGBB)." });

/**
 * Fully-resolved interstitial config stored in the KV record and rendered by
 * the redirect Worker. `null` on the record means "no interstitial, redirect
 * straight to the destination". All fields are required here (no defaults) so
 * the Worker can render without fallbacks.
 */
export const splashConfigSchema = z.object({
	/** Logo URL, or null to use the linkview wordmark. */
	logoUrl: z.string().nullable(),
	bgType: z.enum(SPLASH_BG_TYPES),
	bgColor: z.string(),
	bgImageUrl: z.string().nullable(),
	blur: z.number(),
	logoPosition: z.enum(LOGO_POSITIONS),
	accentColor: z.string(),
	textColor: z.string(),
	countdownSeconds: z.number(),
	/** When true, render the "Criado com linkview" footer mark. */
	showBranding: z.boolean(),
});

export type SplashConfig = z.infer<typeof splashConfigSchema>;

/** Reusable redirect page layout authored in the dashboard (Starter+). */
export const pageLayoutSchema = z.object({
	name: z.string().trim().min(1, "Dê um nome ao layout").max(80),
	logoUrl: z.string().url().max(2048).nullable().optional(),
	bgType: z.enum(SPLASH_BG_TYPES).default("color"),
	bgColor: hexColor.default("#0b0b0f"),
	bgImageUrl: z.string().url().max(2048).nullable().optional(),
	blur: z.number().int().min(0).max(40).default(0),
	logoPosition: z.enum(LOGO_POSITIONS).default("center"),
	accentColor: hexColor.default("#6366f1"),
	textColor: hexColor.default("#ffffff"),
	countdownSeconds: z.number().int().min(1).max(15).default(3),
	showBranding: z.boolean().default(true),
});

export type PageLayoutInput = z.infer<typeof pageLayoutSchema>;

export const createChannelSchema = z.object({
	name: z.string().min(1, "Dê um nome ao canal").max(60),
	utmSource: z.string().min(1).max(120),
	utmMedium: z.string().max(120).optional(),
	utmCampaign: z.string().max(120).optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const createCampaignSchema = z.object({
	name: z.string().min(1).max(255),
	slug: slugField.optional(),
	description: z.string().max(1000).optional(),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/** ISO 3166-1 alpha-2 country code (uppercase). */
const countryCode = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z]{2}$/, { message: "Código de país inválido (use BR, US…)" });

/** Per-link security controls editable from the dashboard (section 14.5–14.7). */
export const linkSecuritySchema = z.object({
	isActive: z.boolean().optional(),
	expiresAt: z.coerce.date().nullable().optional(),
	/** `null`/empty removes the password; a value sets a new one. */
	password: z.string().min(4).max(128).nullable().optional(),
	maxClicks: z.number().int().min(1).max(10_000_000).nullable().optional(),
	blockBots: z.boolean().optional(),
	allowedCountries: z.array(countryCode).max(50).optional(),
	blockedCountries: z.array(countryCode).max(50).optional(),
	rateLimitPerMinute: z.number().int().min(1).max(10_000).nullable().optional(),
});

export type LinkSecurityInput = z.infer<typeof linkSecuritySchema>;

/** Value stored in Cloudflare KV under `link:{hostname}:{slug}` (section 16.1). */
export const kvLinkRecordSchema = z.object({
	linkId: z.string(),
	workspaceId: z.string(),
	destinationUrl: z.string().url(),
	active: z.boolean(),
	expiresAt: z.string().nullable(),
	passwordProtected: z.boolean(),
	// Security controls mirrored to the Worker. Optional for back-compat with
	// records written before these fields existed.
	blockBots: z.boolean().optional(),
	allowedCountries: z.array(z.string()).optional(),
	blockedCountries: z.array(z.string()).optional(),
	rateLimitPerMinute: z.number().nullable().optional(),
	// Redirect interstitial. null/absent = redirect straight to destination.
	splash: splashConfigSchema.nullable().optional(),
	updatedAt: z.string(),
});

export type KvLinkRecord = z.infer<typeof kvLinkRecordSchema>;

/** Click event payload sent from the Worker to the app (section 11.5). */
export const clickIngestSchema = z.object({
	linkId: z.string(),
	workspaceId: z.string(),
	/** QR code that produced the scan (`?qr=` marker). A malformed value falls
	 * back to undefined so a bad marker never drops the click. */
	qrCodeId: z.string().uuid().optional().catch(undefined),
	occurredAt: z.string().datetime().optional(),
	ipHash: z.string().optional(),
	userAgent: z.string().optional(),
	referer: z.string().optional(),
	country: z.string().optional(),
	region: z.string().optional(),
	city: z.string().optional(),
	device: z.string().optional(),
	browser: z.string().optional(),
	os: z.string().optional(),
	bot: z.boolean().optional(),
	source: z.string().optional(),
	medium: z.string().optional(),
	campaign: z.string().optional(),
});

export type ClickIngestInput = z.infer<typeof clickIngestSchema>;
