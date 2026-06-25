"use server";
import { getDb, userProfiles } from "@linkview/db";
import type { BillingCycle } from "@linkview/shared";
import { eq } from "drizzle-orm";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import {
  cancelWorkspaceSubscription,
  changeSubscriptionCycle,
  getOpenInvoiceUrl,
  getWorkspaceSubscription,
  reconcilePendingSubscription,
  startSubscription,
} from "./subscription";
import { type StartTrialResult, startTrial } from "./trial";

export interface CheckoutActionResult {
  url?: string;
  error?: string;
}

/**
 * Start the Pro subscription for the signed-in user's workspace on the chosen
 * billing cycle and hand back the Asaas hosted-checkout URL. The client
 * redirects the browser to it. The fiscal document and phone come from the
 * profile captured at sign-up — we never ask for them again here.
 */
export async function createCheckout(
  cycle: BillingCycle = "monthly",
  /** True = recurring credit-card auto-charge; false = manual Pix/boleto/card. */
  autopay = false,
): Promise<CheckoutActionResult> {
  try {
    const session = await requireSession();
    const workspace = await getActiveWorkspace(session.user.id);
    if (!workspace) return { error: "Sessão expirada. Entre novamente." };

    const db = getDb();
    const [profile] = await db
      .select({ document: userProfiles.document, phone: userProfiles.phone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);
    if (!profile?.document) {
      return { error: "Complete seu cadastro antes de assinar." };
    }

    const { invoiceUrl } = await startSubscription(
      workspace.id,
      "pro",
      {
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        cpfCnpj: profile.document,
        phone: profile.phone || undefined,
      },
      cycle,
      autopay,
    );
    return { url: invoiceUrl };
  } catch (err) {
    // Never reject — a thrown read would leave the checkout button spinning.
    console.error("billing.checkout_failed", err);
    return {
      error: "Não foi possível iniciar o pagamento. Tente novamente.",
    };
  }
}

/** Start the 7-day Pro trial for the signed-in user's workspace. */
export async function startTrialAction(): Promise<StartTrialResult> {
  return startTrial();
}

export interface CardUpdateResult {
  /** Hosted invoice URL to pay with a new card, or null when nothing is open. */
  url: string | null;
  error?: string;
}

/**
 * Hosted URL the customer opens to pay an open charge with a new card — Asaas
 * then reuses that card for future auto-renewals. Returns `url: null` when there
 * is no open charge (nothing to pay right now), so the UI can explain that.
 */
export async function cardUpdateUrlAction(): Promise<CardUpdateResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace)
    return { url: null, error: "Sessão expirada. Entre novamente." };

  try {
    return { url: await getOpenInvoiceUrl(workspace.id) };
  } catch (err) {
    console.error("billing.card_update_url_failed", err);
    return { url: null, error: "Não foi possível abrir agora. Tente de novo." };
  }
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
