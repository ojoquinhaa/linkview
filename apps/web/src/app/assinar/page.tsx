import {
  getAnnualSavings,
  getPlan,
  TRIAL_DURATION_DAYS,
} from "@linkview/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import {
  getWorkspaceSubscription,
  reconcilePendingSubscription,
  resolveSubscriptionAccess,
} from "@/server/billing/subscription";
import { getTrialEligibility } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { ensureActiveWorkspace } from "@/server/workspace";
import { Plans } from "./plans";

const PRO_PERKS = [
  "Até 500 links rastreáveis",
  "QR Code para cada link",
  "Páginas de bio e canais",
  "Relatórios de origem, dispositivo e região",
  "Histórico de cliques por 1 ano",
  "Links com senha e expiração",
];

export default async function AssinarPage() {
  const session = await requireSession();
  // Same re-provisioning as the dashboard: a purged returning user lands here to
  // pay again instead of looping through /login with no workspace.
  const workspace = await ensureActiveWorkspace(session.user.id);

  let sub = await getWorkspaceSubscription(workspace.id);
  // If a charge already cleared at Asaas but the webhook hasn't landed, activate
  // now so a returning user lands straight in the dashboard.
  if (sub?.status === "pending") {
    try {
      await reconcilePendingSubscription(workspace.id);
      sub = await getWorkspaceSubscription(workspace.id);
    } catch (err) {
      console.error("billing.reconcile_failed", err);
    }
  }
  // Anyone with live access belongs in the dashboard, not on the plans page.
  const access = resolveSubscriptionAccess(sub);
  if (access === "full") redirect("/dashboard/links");
  // A workspace that paid before but lapsed reaches the dashboard read-only, so
  // /assinar offers a way back instead of stranding it here on the plans.
  const canReturnToDashboard = access === "locked";

  const savings = getAnnualSavings("pro");
  const plan = getPlan("pro");
  const pricing = {
    monthlyCents: plan.priceCents,
    yearlyCents: savings.yearlyCents,
    monthlyEquivCents: savings.monthlyEquivalentCents,
    savingsCents: savings.savingsCents,
    percentOff: savings.percentOff,
  };
  const trial = await getTrialEligibility(
    session.user.id,
    session.user.email,
    workspace.planKey,
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-paper lg:h-screen lg:overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_60%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <PublicHeader
        user={{ name: session.user.name ?? "", email: session.user.email }}
        canAccessDashboard={canReturnToDashboard}
      />

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-10 lg:min-h-0 lg:justify-center lg:overflow-y-auto lg:pb-6">
        <div className="mx-auto max-w-xl pt-2 text-center sm:pt-4">
          <h1 className="text-balance font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.4rem]">
            Escolha seu plano
          </h1>
          <p className="mx-auto mt-2.5 max-w-sm text-pretty text-[0.92rem] text-muted">
            {trial.eligible
              ? "Comece grátis ou assine o Pro. Cancele quando quiser."
              : "Tudo para criar, medir e crescer seus links. Cancele quando quiser."}
          </p>
        </div>

        <div className="mt-7 flex w-full flex-col items-center">
          <Plans
            pricing={pricing}
            perks={PRO_PERKS}
            trialEligible={trial.eligible}
            trialDays={TRIAL_DURATION_DAYS}
          />

          {canReturnToDashboard && (
            <Link
              href="/dashboard/links"
              className="mt-6 inline-flex items-center gap-1.5 text-[0.86rem] font-medium text-accent hover:underline"
            >
              ← Voltar ao painel
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
