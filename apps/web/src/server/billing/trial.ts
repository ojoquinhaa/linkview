import "server-only";
import {
  getDb,
  plans,
  subscriptions,
  trialRedemptions,
  userProfiles,
  workspaces,
} from "@linkview/db";
import { normalizeEmail, TRIAL_DURATION_DAYS } from "@linkview/shared";
import { and, eq, or } from "drizzle-orm";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

/** Plan a workspace receives during the free trial (Pro-tier features). */
const TRIAL_PLAN_KEY = "trial";

/**
 * Strong-signal abuse check: has this document (CPF/CNPJ) or e-mail redeemed a
 * trial before? Either one matching blocks a new trial on its own — these are
 * high-confidence identity keys, so a single hit is enough. E-mail is compared
 * in its normalized form (gmail dots / `+tag` collapsed) to defeat aliasing.
 */
async function findHardRedemption(
  db: ReturnType<typeof getDb>,
  keys: { document: string; email: string },
) {
  const [row] = await db
    .select({ id: trialRedemptions.id })
    .from(trialRedemptions)
    .where(
      or(
        eq(trialRedemptions.document, keys.document),
        eq(trialRedemptions.email, keys.email),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Weak-signal abuse check: blocks only when the device fingerprint AND the IP
 * *both* match the same prior redemption. Either one alone is too noisy to deny
 * a trial — IP collides across NAT/CGNAT/shared Wi-Fi, and a fingerprint resets
 * in incognito — so we require the two to agree before treating it as the same
 * person evading the strong keys. Returns null if either signal is missing.
 */
async function findSoftRedemption(
  db: ReturnType<typeof getDb>,
  keys: { fingerprint: string | null; ip: string | null },
) {
  if (!keys.fingerprint || !keys.ip) return null;
  const [row] = await db
    .select({ id: trialRedemptions.id })
    .from(trialRedemptions)
    .where(
      and(
        eq(trialRedemptions.fingerprint, keys.fingerprint),
        eq(trialRedemptions.ip, keys.ip),
      ),
    )
    .limit(1);
  return row ?? null;
}

export interface TrialEligibility {
  eligible: boolean;
  /** Reason the trial is unavailable, for UI copy / logging. */
  reason?: "not_free" | "already_redeemed" | "no_profile";
}

/**
 * Whether the signed-in user's workspace can start a trial right now. Drives the
 * /assinar CTA. Only the *strong* keys (document, e-mail) gate visibility here —
 * the weak fingerprint+IP signal isn't available server-side at page load and
 * is enforced authoritatively in `startTrial`. (This is why a shared IP no
 * longer hides the card from a legitimate new customer.)
 */
export async function getTrialEligibility(
  userId: string,
  email: string,
  workspacePlanKey: string,
): Promise<TrialEligibility> {
  // Only a brand-new free workspace can begin a trial.
  if (workspacePlanKey !== "free")
    return { eligible: false, reason: "not_free" };

  const db = getDb();
  const [profile] = await db
    .select({ document: userProfiles.document })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (!profile) return { eligible: false, reason: "no_profile" };

  const prior = await findHardRedemption(db, {
    document: profile.document,
    email: normalizeEmail(email),
  });
  if (prior) return { eligible: false, reason: "already_redeemed" };

  return { eligible: true };
}

export interface StartTrialResult {
  ok: boolean;
  error?: string;
}

/**
 * Grant the signed-in user's workspace a 7-day Pro trial. Authoritative abuse
 * gate: denies if the document, e-mail, or sign-up IP has redeemed a trial
 * before. On success the workspace is promoted to the trial plan, a `trialing`
 * subscription is recorded, and a redemption ledger row is written — all in a
 * single batch (Neon HTTP batch = one transaction).
 */
export async function startTrial(
  fingerprint?: string,
): Promise<StartTrialResult> {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const email = normalizeEmail(session.user.email);
    const fp = fingerprint?.trim() || null;

    const workspace = await getActiveWorkspace(userId);
    if (!workspace)
      return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (workspace.planKey !== "free") {
      return { ok: false, error: "Seu workspace já tem um plano ativo." };
    }

    const db = getDb();

    // Independent reads run together to cut serverless round-trips (each Neon
    // HTTP call is a separate hop; doing them in parallel keeps the click snappy
    // even on a cold connection).
    const [[profile], [trialPlan], [existing]] = await Promise.all([
      db
        .select({
          document: userProfiles.document,
          signupIp: userProfiles.signupIp,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1),
      db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.key, TRIAL_PLAN_KEY))
        .limit(1),
      // A fresh free workspace has no subscription row yet; reuse it if one
      // exists (e.g. an abandoned checkout left a `pending` row).
      db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, workspace.id))
        .limit(1),
    ]);

    if (!profile) {
      return {
        ok: false,
        error: "Complete seu cadastro antes de iniciar o teste.",
      };
    }
    if (!trialPlan) {
      return {
        ok: false,
        error: "Plano de teste indisponível. Tente mais tarde.",
      };
    }

    // Strong keys first: a document or e-mail reuse is high-confidence abuse.
    const hard = await findHardRedemption(db, {
      document: profile.document,
      email,
    });
    if (hard) {
      return {
        ok: false,
        error: "Este CPF/CNPJ ou e-mail já utilizou o teste grátis.",
      };
    }
    // Weak keys: deny only when fingerprint AND IP both match a prior trial.
    const soft = await findSoftRedemption(db, {
      fingerprint: fp,
      ip: profile.signupIp,
    });
    if (soft) {
      return {
        ok: false,
        error: "Este dispositivo já utilizou o teste grátis.",
      };
    }

    const now = new Date();
    const endsAt = new Date(
      now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    const subscriptionWrite = existing
      ? db
          .update(subscriptions)
          .set({
            planId: trialPlan.id,
            provider: "trial",
            status: "trialing",
            currentPeriodStart: now,
            currentPeriodEnd: endsAt,
            trialEndsAt: endsAt,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          })
          .where(eq(subscriptions.id, existing.id))
      : db.insert(subscriptions).values({
          workspaceId: workspace.id,
          planId: trialPlan.id,
          provider: "trial",
          status: "trialing",
          currentPeriodStart: now,
          currentPeriodEnd: endsAt,
          trialEndsAt: endsAt,
        });

    await db.batch([
      subscriptionWrite,
      db
        .update(workspaces)
        .set({ planKey: TRIAL_PLAN_KEY })
        .where(eq(workspaces.id, workspace.id)),
      db.insert(trialRedemptions).values({
        workspaceId: workspace.id,
        userId,
        document: profile.document,
        email,
        ip: profile.signupIp,
        fingerprint: fp,
        startedAt: now,
        endsAt,
      }),
    ]);

    return { ok: true };
  } catch (err) {
    // Never let the action reject: a thrown query (cold DB, missing env, etc.)
    // would otherwise leave the client button spinning forever.
    console.error("trial.start_failed", err);
    return {
      ok: false,
      error: "Não foi possível iniciar o teste. Tente de novo.",
    };
  }
}

/**
 * Active trial summary for a workspace (or null). Used by the dashboard to show
 * how many days remain and nudge conversion.
 */
export interface TrialStatus {
  endsAt: Date;
  daysLeft: number;
}

export async function getTrialStatus(
  workspaceId: string,
): Promise<TrialStatus | null> {
  const db = getDb();
  const [row] = await db
    .select({ endsAt: subscriptions.trialEndsAt, status: subscriptions.status })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, "trialing"),
      ),
    )
    .limit(1);
  if (!row?.endsAt) return null;
  const ms = row.endsAt.getTime() - Date.now();
  return {
    endsAt: row.endsAt,
    daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)),
  };
}
