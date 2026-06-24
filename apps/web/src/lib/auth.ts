import "server-only";
import { createAuth } from "@linkview/auth";
import { getDb } from "@linkview/db";
import {
  emailConfigured,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "./email";
import { authEnv } from "./env";

const env = authEnv();

// Email delivery is optional in local dev; when unconfigured we skip the
// callbacks so sign-up still works without a Resend key.
const withEmail = emailConfigured();

export const auth = createAuth({
  db: getDb(),
  secret: env.secret,
  baseURL: env.baseURL,
  trustedOrigins: [env.baseURL],
  requireEmailVerification: withEmail,
  sendResetPassword: withEmail
    ? async ({ user, token }) => {
        // Drive the reset through our own page rather than Better Auth's
        // default /reset-password path.
        const url = `${env.baseURL}/redefinir-senha?token=${token}`;
        await sendResetPasswordEmail({ to: user.email, name: user.name, url });
      }
    : undefined,
  sendVerificationEmail: withEmail
    ? async ({ user, url }) => {
        await sendVerificationEmail({ to: user.email, name: user.name, url });
      }
    : undefined,
});
