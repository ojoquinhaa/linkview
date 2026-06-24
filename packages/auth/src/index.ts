import { generateSlug, normalizeSlug } from "@linkview/shared";
import type { Database } from "@linkview/db";
import {
  account,
  session,
  user,
  verification,
  workspaceMembers,
  workspaces,
} from "@linkview/db";
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
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh daily
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
