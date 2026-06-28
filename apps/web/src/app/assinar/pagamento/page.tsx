import { getDb, userProfiles } from "@linkview/db";
import {
  getAnnualSavings,
  getCyclePriceCents,
  getPlan,
} from "@linkview/shared";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/wordmark";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "@/server/billing/subscription";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { CheckoutPanel } from "./checkout-panel";
import { DesktopSummary, MobileSummary } from "./order-summary";

/** Mask a CPF/CNPJ to a recognizable-but-protected form (reveals the middle
 * block, hides the rest), so the customer can confirm it's theirs without us
 * re-displaying the full fiscal number on a payment screen. */
function maskDocument(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
  if (d.length === 14) {
    return `••.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-••`;
  }
  return "•••••••••";
}

/** Concise Pro perks for the summary, derived from the plan's own flags so the
 * list never drifts from what the workspace actually gets. */
function summaryPerks(): string[] {
  const p = getPlan("pro");
  const perks = [`Até ${p.maxLinks.toLocaleString("pt-BR")} links rastreáveis`];
  if (p.qrCodesEnabled) perks.push("QR Code para cada link");
  perks.push("Relatórios de origem, dispositivo e região");
  if (p.passwordLinksEnabled && p.expirationEnabled) {
    perks.push("Links com senha e expiração");
  }
  return perks;
}

/**
 * Our own checkout — fully replaces the Asaas hosted page. A commercial
 * split-panel: the payment capture (card or Pix) on the left, a persistent order
 * summary on the right (a collapsible bar on mobile). The whole page is sized to
 * fit one viewport without a long scroll. Fiscal data captured at sign-up is
 * reused and shown read-only, so the only thing asked here is the payment.
 * `?method=card|pix` picks the initial tab; `?switch=1` allows a cycle change.
 */
export default async function PagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; method?: string; switch?: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const params = await searchParams;
  const cycle = params.cycle === "yearly" ? "yearly" : "monthly";
  const initialMethod = params.method === "pix" ? "pix" : "card";

  // Already paying? Don't show a second checkout — UNLESS this is an explicit
  // cycle switch (?switch=1 to a *different* cycle): an active subscriber comes
  // here to pay the new cycle now, with the unused days credited as extra time.
  // A trialing workspace also has "full" access but holds no paid plan yet, so
  // it MUST reach checkout to convert — only an actually paid plan is bounced.
  const sub = await getWorkspaceSubscription(workspace.id);
  const access = resolveSubscriptionAccess(sub);
  const onTrial = sub?.status === "trialing";
  const switching =
    params.switch === "1" && sub != null && sub.billingCycle !== cycle;
  if (access === "full" && !onTrial && !switching) redirect("/dashboard/links");

  const db = getDb();
  const [profile] = await db
    .select({
      document: userProfiles.document,
      city: userProfiles.city,
      state: userProfiles.state,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);
  // Fiscal data is captured at sign-up; without it Asaas can't run anti-fraud.
  if (!profile?.document) redirect("/assinar");

  const plan = getPlan("pro");
  const annual = cycle === "yearly";
  const priceCents = getCyclePriceCents("pro", cycle);
  const savings = getAnnualSavings("pro");
  const name = session.user.name ?? "";
  const docLabel =
    profile.document.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF";
  const place =
    profile.city && profile.state ? `${profile.city} · ${profile.state}` : null;

  const summary = {
    planName: plan.name,
    annual,
    priceCents,
    perMonthCents: savings.monthlyEquivalentCents,
    savingsCents: savings.savingsCents,
    perks: summaryPerks(),
    switching,
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:overflow-hidden">
      {/* Slim checkout topbar: identity reuse so the buyer always sees which
          account is paying, plus a secure-payment cue. */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-4">
          <Wordmark size="md" />
          <span className="hidden items-center gap-1.5 border-l border-line pl-4 text-[0.78rem] font-medium text-muted sm:inline-flex">
            <Lock />
            Pagamento seguro
          </span>
        </div>
        <AccountMenu
          name={name}
          email={session.user.email}
          canAccessDashboard={access === "locked" || onTrial}
        />
      </header>

      <main className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[1.45fr_1fr]">
        {/* Mobile: collapsible summary sits above the form (DOM-first); on
            desktop it's display:none, so the grid places only form + aside. */}
        <MobileSummary {...summary} />

        {/* Left: the action. Scrolls within its own column on short desktops so
            the page itself never scrolls. */}
        <section className="flex flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-9 xl:px-14">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <Link
              href="/assinar"
              className="mb-5 inline-flex items-center gap-1.5 text-[0.83rem] font-medium text-muted transition-colors hover:text-ink"
            >
              <span aria-hidden>←</span> Voltar aos planos
            </Link>

            <h1 className="font-display text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.7rem]">
              Finalize sua assinatura
            </h1>
            <p className="mt-1.5 text-[0.86rem] text-muted">
              Assinando como{" "}
              <span className="font-medium text-ink-soft">
                {name || session.user.email}
              </span>
            </p>

            {/* Billing data reused from the profile, one compact read-only line. */}
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-ink-soft">{docLabel}</span>
                <span className="nums">{maskDocument(profile.document)}</span>
              </span>
              {place && (
                <>
                  <span aria-hidden className="text-line-strong">
                    ·
                  </span>
                  <span>{place}</span>
                </>
              )}
            </p>

            <div className="mt-7">
              <CheckoutPanel
                cycle={cycle}
                holderName={name}
                initialMethod={initialMethod}
              />
            </div>
          </div>
        </section>

        {/* Right: persistent commercial summary (desktop only). */}
        <DesktopSummary {...summary} />
      </main>
    </div>
  );
}

function Lock() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Seguro</title>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
