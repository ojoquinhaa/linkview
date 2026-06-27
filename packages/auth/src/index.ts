import type { Database } from "@linkview/db";
import {
	account,
	session,
	user,
	verification,
	workspaceMembers,
	workspaces,
} from "@linkview/db";
import { generateSlug, normalizeSlug } from "@linkview/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/** Payload handed to the email-sending callbacks. */
export interface AuthEmailArgs {
	user: { email: string; name?: string | null };
	/** Pre-built action URL from Better Auth (used by the verification flow). */
	url: string;
	/** Raw token, for building app-owned links (used by password reset). */
	token: string;
}

/**
 * Distributed key/value store for rate-limit counters (and session cache). On
 * Vercel each request can hit a different serverless instance, so the default
 * in-memory rate limiter resets constantly and gives almost no brute-force
 * protection. Backing it with shared storage (Redis) makes the limits real.
 */
export interface AuthSecondaryStorage {
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string, ttl?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

export interface AuthConfig {
	db: Database;
	secret: string;
	baseURL: string;
	/** Trusted origins for CSRF (e.g. dashboard + landing). */
	trustedOrigins?: string[];
	/** Block sign-in until the email is verified. */
	requireEmailVerification?: boolean;
	/** Deliver the password-reset email. Omit to disable reset. */
	sendResetPassword?: (args: AuthEmailArgs) => Promise<void>;
	/** Deliver the email-verification message. Omit to disable verification. */
	sendVerificationEmail?: (args: AuthEmailArgs) => Promise<void>;
	/** Shared store for rate-limit counters. Omit to fall back to in-memory. */
	secondaryStorage?: AuthSecondaryStorage;
}

/** Build a unique workspace slug from a display name. */
function workspaceSlug(name: string): string {
	const base = normalizeSlug(name) || "workspace";
	return `${base.slice(0, 40)}-${generateSlug(5)}`;
}

/**
 * Create the Better Auth instance bound to a Drizzle (Neon) database.
 * On user creation a default workspace + owner membership is provisioned
 * automatically on the free plan (ARCHITECTURE.md section 11.1).
 */
export function createAuth(config: AuthConfig) {
	const { db } = config;

	return betterAuth({
		secret: config.secret,
		baseURL: config.baseURL,
		trustedOrigins: config.trustedOrigins,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: { user, session, account, verification },
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			requireEmailVerification: config.requireEmailVerification ?? false,
			...(config.sendResetPassword && {
				sendResetPassword: ({ user: u, url, token }) =>
					config.sendResetPassword!({
						user: { email: u.email, name: u.name },
						url,
						token,
					}),
			}),
		},
		...(config.sendVerificationEmail && {
			emailVerification: {
				sendOnSignUp: true,
				autoSignInAfterVerification: true,
				sendVerificationEmail: ({ user: u, url, token }) =>
					config.sendVerificationEmail!({
						user: { email: u.email, name: u.name },
						url,
						token,
					}),
			},
		}),
		...(config.secondaryStorage && {
			secondaryStorage: config.secondaryStorage,
		}),
		// Brute-force protection on the auth endpoints. Backed by secondaryStorage
		// when provided (shared across instances); tighter custom limits guard the
		// credential-guessing routes specifically.
		rateLimit: {
			enabled: true,
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": { window: 60, max: 10 },
				"/sign-up/email": { window: 60, max: 5 },
				"/forget-password": { window: 60, max: 5 },
				"/reset-password": { window: 60, max: 10 },
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // refresh daily
			// Keep Postgres authoritative for sessions even when secondaryStorage is
			// set (otherwise Better Auth would move them into the cache store).
			storeSessionInDatabase: true,
		},
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						const displayName = createdUser.name || createdUser.email;
						const [ws] = await db
							.insert(workspaces)
							.values({
								name: displayName,
								slug: workspaceSlug(displayName),
								ownerId: createdUser.id,
								planKey: "free",
							})
							.returning();
						if (ws) {
							await db.insert(workspaceMembers).values({
								workspaceId: ws.id,
								userId: createdUser.id,
								role: "owner",
							});
						}
					},
				},
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
