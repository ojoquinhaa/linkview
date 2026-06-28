"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, userProfiles } from "@linkview/db";
import type { BillingCycle } from "@linkview/shared";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type RawCard, validateCard } from "@/lib/card";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import {
  cancelWorkspaceSubscription,
  changeCard,
  changeSubscriptionCycle,
  getWorkspaceSubscription,
  type PixCheckoutResult,
  reconcilePendingSubscription,
  resumeSubscription,
  startCardSubscription,
  startPixSubscription,
} from "./subscription";
import { type StartTrialResult, startTrial } from "./trial";

/** Only `owner` holds `billing.manage`; shown when a lower role tries to act. */
const NO_BILLING_PERMISSION =
  "Você não tem permissão para gerenciar a assinatura deste workspace.";

/** Buyer IP for Asaas anti-fraud — the client's, never the server's. Reads the
 * proxy headers Vercel/Cloudflare set; falls back to a sentinel that Asaas
 * tolerates so a missing header never blocks a legitimate purchase. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "0.0.0.0";
  return h.get("x-real-ip")?.trim() || "0.0.0.0";
}

/** Fetch the fiscal + address fields Asaas needs for card anti-fraud. */
async function billingProfile(userId: string) {
  const db = getDb();
  const [profile] = await db
    .select({
      document: userProfiles.document,
      phone: userProfiles.phone,
      zip: userProfiles.zip,
      number: userProfiles.number,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export interface PixCheckoutActionResult {
  ok: boolean;
  /** Pix QR + copy-paste code to render in-app (no hosted page). */
  pix?: PixCheckoutResult;
  error?: string;
}

/**
 * Start (or refresh) a Pix Pro subscription for the signed-in user's workspace
 * and return the Pix QR + copy-paste code, rendered by our own checkout — no
 * Asaas hosted page. The fiscal document comes from the profile captured at
 * sign-up. The client shows the QR and polls {@link checkActivationAction} until
 * the payment clears.
 */
export async function createPixCheckoutAction(
  cycle: BillingCycle = "monthly",
): Promise<PixCheckoutActionResult> {
  try {
    const session = await requireSession();
    const workspace = await getActiveWorkspace(session.user.id);
    if (!workspace)
      return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!can(workspace.role, "billing.manage")) {
      return { ok: false, error: NO_BILLING_PERMISSION };
    }

    // Blunt abuse: cap how often a workspace/IP can spin up new Pix charges.
    const ip = await clientIp();
    const allowed =
      (await rateLimit(`pix:ws:${workspace.id}`, 10, 600)) &&
      (await rateLimit(`pix:ip:${ip}`, 16, 600));
    if (!allowed) {
      return {
        ok: false,
        error: "Muitas tentativas. Aguarde alguns minutos.",
      };
    }

    const db = getDb();
    const [profile] = await db
      .select({ document: userProfiles.document, phone: userProfiles.phone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);
    if (!profile?.document) {
      return { ok: false, error: "Complete seu cadastro antes de assinar." };
    }

    const pix = await startPixSubscription(
      workspace.id,
      "pro",
      {
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        cpfCnpj: profile.document,
        phone: profile.phone || undefined,
      },
      cycle,
    );
    return { ok: true, pix };
  } catch (err) {
    // Never reject — a thrown read would leave the checkout button spinning.
    console.error("billing.pix_checkout_failed", err);
    return {
      ok: false,
      error: "Não foi possível gerar o Pix. Tente novamente.",
    };
  }
}

export interface CardCheckoutActionResult {
  ok: boolean;
  /** `active` when the first charge cleared (the common case); `pending` if the
   * card was accepted but hasn't settled yet. */
  status?: "active" | "pending";
  error?: string;
}

/** A declined/blocked card surfaces a clean, user-actionable message — never the
 * raw gateway error. Asaas wraps the reason as "Asaas <code>: <description>". */
function cardErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const match = raw.match(/^Asaas \d+:\s*(.+)$/);
  if (match?.[1]) return match[1];
  return "Não foi possível aprovar o cartão. Confira os dados ou tente outro cartão.";
}

/**
 * Subscribe with a credit card captured by our own checkout (no Asaas hosted
 * page). The card is validated, rate-limited (anti card-testing), tokenized, and
 * charged synchronously. Card data lives only for this request and is never
 * logged. Returns `active` once the charge clears.
 */
export async function createCardCheckoutAction(
  cycle: BillingCycle,
  card: RawCard,
): Promise<CardCheckoutActionResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!can(workspace.role, "billing.manage")) {
    return { ok: false, error: NO_BILLING_PERMISSION };
  }

  // Revalidate server-side: never trust the client's checks.
  const invalid = validateCard(card);
  if (invalid) return { ok: false, error: invalid };

  const ip = await clientIp();
  // Blunt card-testing: cap attempts per workspace and per source IP.
  const allowed =
    (await rateLimit(`card:ws:${workspace.id}`, 8, 600)) &&
    (await rateLimit(`card:ip:${ip}`, 12, 600));
  if (!allowed) {
    return {
      ok: false,
      error: "Muitas tentativas de pagamento. Aguarde alguns minutos.",
    };
  }

  const profile = await billingProfile(session.user.id);
  if (!profile?.document || !profile.zip || !profile.number) {
    return { ok: false, error: "Complete seu cadastro antes de assinar." };
  }

  try {
    const result = await startCardSubscription(
      workspace.id,
      "pro",
      {
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        cpfCnpj: profile.document,
        phone: profile.phone || undefined,
        postalCode: profile.zip,
        addressNumber: profile.number,
      },
      {
        holderName: card.holderName.trim(),
        number: card.number.replace(/\D/g, ""),
        expiryMonth: card.expiryMonth.trim(),
        expiryYear: card.expiryYear.trim(),
        ccv: card.ccv.trim(),
      },
      ip,
      cycle,
    );
    return { ok: true, status: result.status };
  } catch (err) {
    // Log without any card data — only the gateway's reason string.
    console.error("billing.card_checkout_failed", {
      workspaceId: workspace.id,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: cardErrorMessage(err) };
  }
}

export interface UpdateCardActionResult {
  ok: boolean;
  card?: { last4: string; brand: string };
  error?: string;
}

/**
 * Replace the card on file via our own form. Tokenizes the new card and points
 * the Asaas subscription at it without charging now. Validated, rate-limited,
 * never logs card data.
 */
export async function updateCardAction(
  card: RawCard,
): Promise<UpdateCardActionResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!can(workspace.role, "billing.manage")) {
    return { ok: false, error: NO_BILLING_PERMISSION };
  }

  const invalid = validateCard(card);
  if (invalid) return { ok: false, error: invalid };

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`card:ws:${workspace.id}`, 8, 600)) &&
    (await rateLimit(`card:ip:${ip}`, 12, 600));
  if (!allowed) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const profile = await billingProfile(session.user.id);
  if (!profile?.document || !profile.zip || !profile.number) {
    return { ok: false, error: "Complete seu cadastro para trocar o cartão." };
  }

  try {
    const result = await changeCard(
      workspace.id,
      {
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        cpfCnpj: profile.document,
        phone: profile.phone || undefined,
        postalCode: profile.zip,
        addressNumber: profile.number,
      },
      {
        holderName: card.holderName.trim(),
        number: card.number.replace(/\D/g, ""),
        expiryMonth: card.expiryMonth.trim(),
        expiryYear: card.expiryYear.trim(),
        ccv: card.ccv.trim(),
      },
      ip,
    );
    return { ok: true, card: result };
  } catch (err) {
    console.error("billing.card_update_failed", {
      workspaceId: workspace.id,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: cardErrorMessage(err) };
  }
}

/** Start the 7-day Pro trial for the signed-in user's workspace. */
export async function startTrialAction(): Promise<StartTrialResult> {
  return startTrial();
}

export interface ActivationResult {
  /** `active` once the first charge clears; `pending` while we wait; `none`
   * when there's no subscription to confirm. */
  status: "active" | "pending" | "none";
}

/**
 * Poll target for the confirmation screen. Best-effort reconciles the pending
 * subscription against Asaas (so a Pix/card payment activates the moment it
 * clears, even if the webhook is late) and reports the current status. Safe to
 * call on an interval: idempotent and a no-op once active.
 */
export async function checkActivationAction(): Promise<ActivationResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { status: "none" };

  try {
    if (await reconcilePendingSubscription(workspace.id)) {
      return { status: "active" };
    }
  } catch (err) {
    console.error("billing.check_activation_failed", err);
  }

  const sub = await getWorkspaceSubscription(workspace.id);
  if (!sub) return { status: "none" };
  if (sub.status === "active" || sub.status === "trialing") {
    return { status: "active" };
  }
  return { status: "pending" };
}

export interface SwitchCycleResult {
  ok: boolean;
  error?: string;
}

/**
 * Switch the signed-in user's active subscription between monthly and yearly.
 * The change is applied in place at Asaas and takes effect from the next
 * renewal — no charge today, no loss of access.
 */
export async function switchBillingCycleAction(
  cycle: BillingCycle,
): Promise<SwitchCycleResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!can(workspace.role, "billing.manage")) {
    return { ok: false, error: NO_BILLING_PERMISSION };
  }

  try {
    await changeSubscriptionCycle(workspace.id, cycle);
    return { ok: true };
  } catch (err) {
    console.error("billing.switch_cycle_failed", err);
    return {
      ok: false,
      error: "Não foi possível alterar o ciclo agora. Tente novamente.",
    };
  }
}

export interface CancelActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Cancel the signed-in user's paid subscription at Asaas. The webhook later
 * downgrades the workspace; until then access stays until the period ends.
 */
export async function cancelSubscriptionAction(): Promise<CancelActionResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!can(workspace.role, "billing.manage")) {
    return { ok: false, error: NO_BILLING_PERMISSION };
  }

  try {
    await cancelWorkspaceSubscription(workspace.id);
    return { ok: true };
  } catch (err) {
    console.error("billing.cancel_failed", err);
    return {
      ok: false,
      error: "Não foi possível cancelar agora. Tente novamente.",
    };
  }
}

export interface ResumeActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Undo a scheduled cancellation while the paid period is still running. Nothing
 * is charged now — the subscription is recreated with its first charge dated to
 * the current period's end. The user stays in the app; card autopay recaptures a
 * card later via the normal "Atualizar cartão" button (no payment page to land
 * on, so the resume can't trap the user on an Asaas checkout).
 */
export async function resumeSubscriptionAction(): Promise<ResumeActionResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!can(workspace.role, "billing.manage")) {
    return { ok: false, error: NO_BILLING_PERMISSION };
  }

  try {
    await resumeSubscription(workspace.id);
    return { ok: true };
  } catch (err) {
    console.error("billing.resume_failed", err);
    return {
      ok: false,
      error: "Não foi possível retomar agora. Tente novamente.",
    };
  }
}
