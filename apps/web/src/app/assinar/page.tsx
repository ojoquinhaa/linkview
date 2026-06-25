import {
  getAnnualSavings,
  getPlan,
  TRIAL_DURATION_DAYS,
} from "@linkview/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingCycleChoice } from "@/components/billing/billing-cycle-choice";
import { Wordmark } from "@/components/wordmark";
import {
  getWorkspaceSubscription,
  reconcilePendingSubscription,
} from "@/server/billing/subscription";
import { getTrialEligibility } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { TrialCta } from "./trial-cta";

const ACTIVE = new Set(["active", "trialing"]);

const PRO_PERKS = [
  "Até 500 links rastreáveis",
  "QR Codes para cada link",
  "Páginas de bio e canais",
  "Relatórios de origem, dispositivo e região",
  "Histórico de cliques por 1 ano",
  "Links com senha e expiração",
];

export default async function AssinarPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

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
  if (sub && ACTIVE.has(sub.status)) redirect("/dashboard/links");
  // A charge that's still settling belongs on the live confirmation screen, not
  // back on the pricing page.
  if (sub?.status === "pending") redirect("/assinar/confirmando");

  const plan = getPlan("pro");
  const savings = getAnnualSavings("pro");
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
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_70%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Wordmark size="md" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-16">
        <div className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-weak px-3 py-1 text-[0.78rem] font-medium text-accent-deep">
            <Spark />
            Links inteligentes, decisões melhores
          </span>
          <h1 className="mt-5 text-balance font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.5rem]">
            Escolha o plano ideal para você
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-[0.95rem] text-muted">
            Crie, gerencie e analise seus links com mais inteligência e
            segurança.
          </p>
        </div>

        <div
          className={`mt-10 grid w-full items-start gap-5 ${
            trial.eligible ? "max-w-4xl sm:grid-cols-2" : "max-w-md grid-cols-1"
          }`}
        >
          {trial.eligible && <TrialCta days={TRIAL_DURATION_DAYS} />}
          <ProCard pricing={pricing} secondaryCta={trial.eligible} />
        </div>

        <p className="mt-8 text-center text-[0.85rem] text-muted">
          Entrou com {session.user.email}.{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:underline"
          >
            Trocar conta
          </Link>
        </p>
      </main>
    </div>
  );
}

function ProCard({
  pricing,
  secondaryCta,
}: {
  pricing: React.ComponentProps<typeof BillingCycleChoice>["pricing"];
  /** When the trial is the primary action, the Pro card is the alternative. */
  secondaryCta: boolean;
}) {
  return (
    <div className="relative rounded-2xl border border-accent-line bg-surface p-6 shadow-[0_4px_24px_oklch(0.42_0.16_265/0.08)] sm:p-7">
      <span className="-top-3 absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[0.72rem] font-semibold text-accent-ink shadow-[0_2px_8px_oklch(0.42_0.16_265/0.3)]">
        <Star />
        Mais escolhido
      </span>

      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent-weak text-accent">
          <Bolt />
        </span>
        <div>
          <h2 className="font-display text-[1.2rem] font-semibold tracking-[-0.02em] text-ink">
            Plano Pro
          </h2>
          <p className="text-[0.85rem] text-muted">
            Para quem leva links a sério.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <BillingCycleChoice pricing={pricing} secondary={secondaryCta} />
      </div>

      <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-6">
        {PRO_PERKS.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2.5 text-[0.88rem] text-ink-soft"
          >
            <Check />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[3px] size-3.5 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Incluído</title>
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}

function Spark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="currentColor"
    >
      <title>Destaque</title>
      <path d="M8 0.5l1.6 4.3a3 3 0 0 0 1.6 1.6L15.5 8l-4.3 1.6a3 3 0 0 0-1.6 1.6L8 15.5l-1.6-4.3a3 3 0 0 0-1.6-1.6L0.5 8l4.3-1.6a3 3 0 0 0 1.6-1.6z" />
    </svg>
  );
}

function Star() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>Destaque</title>
      <path d="M8 1l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.8 4.2 12.8l.7-4.3-3.1-3 4.3-.6z" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Pro</title>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}
