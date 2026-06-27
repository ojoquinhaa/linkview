import { redirect } from "next/navigation";
import { SupportFab } from "@/components/support-fab";
import { Wordmark } from "@/components/wordmark";
import {
  getWorkspaceSubscription,
  reconcilePendingSubscription,
} from "@/server/billing/subscription";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { Confirming } from "./confirming";

const ACTIVE = new Set(["active", "trialing"]);

/**
 * Landing screen after the Asaas hosted checkout. Pix and card payments usually
 * clear before this page even renders, so we reconcile once on the server and,
 * if the money already landed, hand straight off to the thank-you screen. Only
 * a genuinely pending charge falls through to the live-polling client.
 */
export default async function ConfirmandoPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const sub = await getWorkspaceSubscription(workspace.id);
  if (!sub) redirect("/assinar");
  if (ACTIVE.has(sub.status)) redirect("/assinar/sucesso");

  let active = false;
  if (sub.status === "pending") {
    try {
      active = await reconcilePendingSubscription(workspace.id);
    } catch (err) {
      // A failed read must not strand the user on a dead page; fall through to
      // the client poller, which keeps trying.
      console.error("billing.confirm_reconcile_failed", err);
    }
  }
  if (active) redirect("/assinar/sucesso");

  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_70%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Wordmark size="md" />
      </header>

      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-16">
        <Confirming />
      </main>

      <SupportFab />
    </div>
  );
}
