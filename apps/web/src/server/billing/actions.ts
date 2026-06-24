"use server";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { cancelWorkspaceSubscription, startSubscription } from "./subscription";
import { type StartTrialResult, startTrial } from "./trial";

export interface CheckoutActionResult {
  url?: string;
  error?: string;
}

/**
 * Start the Pro subscription for the signed-in user's workspace and hand back
 * the Asaas hosted-checkout URL. The client redirects the browser to it.
 */
export async function createCheckout(input: {
  cpfCnpj: string;
  phone?: string;
}): Promise<CheckoutActionResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { error: "Sessão expirada. Entre novamente." };

  const doc = input.cpfCnpj.replace(/\D/g, "");
  if (doc.length !== 11 && doc.length !== 14) {
    return { error: "Informe um CPF ou CNPJ válido." };
  }

  try {
    const { invoiceUrl } = await startSubscription(workspace.id, "pro", {
      name: session.user.name ?? session.user.email,
      email: session.user.email,
      cpfCnpj: doc,
      phone: input.phone?.replace(/\D/g, "") || undefined,
    });
    return { url: invoiceUrl };
  } catch (err) {
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
