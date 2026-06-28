import { getDb, userProfiles } from "@linkview/db";
import { getCyclePriceCents, getPlan } from "@linkview/shared";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "@/server/billing/subscription";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { CheckoutPanel } from "./checkout-panel";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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

/**
 * Our own checkout — fully replaces the Asaas hosted page. Card payments are
 * captured, tokenized server-side, and charged synchronously; Pix renders a QR +
 * copy-paste code in-app. Every field the buyer already gave us at sign-up
 * (fiscal document, address) is reused and shown read-only, so the only thing
 * asked here is the payment itself. `?method=card|pix` picks the initial tab.
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
  const sub = await getWorkspaceSubscription(workspace.id);
  const access = resolveSubscriptionAccess(sub);
  const switching =
    params.switch === "1" && sub != null && sub.billingCycle !== cycle;
  if (access === "full" && !switching) redirect("/dashboard/links");

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
  const priceCents = getCyclePriceCents("pro", cycle);
  const annual = cycle === "yearly";
  const perMonth = annual ? Math.round(priceCents / 12) : priceCents;
  const name = session.user.name ?? "";

  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_70%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <PublicHeader
        user={{ name, email: session.user.email }}
        canAccessDashboard={access === "locked"}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-16">
        <Link
          href="/assinar"
          className="mb-5 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-muted transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> Voltar aos planos
        </Link>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_4px_24px_oklch(0.42_0.16_265/0.08)]">
          {/* Intro + identity reuse. */}
          <div className="px-6 pt-6 pb-5 sm:px-7">
            <h1 className="font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
              Finalize sua assinatura
            </h1>
            <p className="mt-1.5 text-[0.86rem] text-muted">
              Assinando como{" "}
              <span className="font-medium text-ink-soft">
                {name || session.user.email}
              </span>
              {name ? ` · ${session.user.email}` : null}
            </p>
          </div>

          {/* Order summary. */}
          <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="text-[0.92rem] font-medium text-ink">
                Plano {plan.name} · {annual ? "anual" : "mensal"}
              </p>
              <p className="text-[0.8rem] text-muted">
                {annual
                  ? `Equivale a ${brl(perMonth)}/mês`
                  : "Cobrança mensal, cancele quando quiser"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="nums text-[1.2rem] font-semibold text-ink">
                {brl(priceCents)}
              </span>
              <span className="text-[0.78rem] text-muted">
                /{annual ? "ano" : "mês"}
              </span>
            </div>
          </div>

          {switching && (
            <div className="border-t border-line bg-accent-weak/40 px-6 py-3 sm:px-7">
              <p className="text-[0.8rem] text-ink-soft">
                Você está trocando de plano. Paga o valor acima agora; os dias
                restantes do seu período atual entram como tempo extra no novo
                período.
              </p>
            </div>
          )}

          {/* Billing data reused from the profile, shown read-only. */}
          <div className="border-t border-line px-6 py-4 sm:px-7">
            <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
              Cobrança no seu cadastro
            </p>
            <dl className="mt-2.5 flex flex-col gap-1.5 text-[0.85rem]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">
                  {profile.document.replace(/\D/g, "").length === 14
                    ? "CNPJ"
                    : "CPF"}
                </dt>
                <dd className="nums font-medium text-ink-soft">
                  {maskDocument(profile.document)}
                </dd>
              </div>
              {profile.city && profile.state && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Local</dt>
                  <dd className="font-medium text-ink-soft">
                    {profile.city} · {profile.state}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Payment capture: card or Pix, our own UI. */}
          <div className="border-t border-line px-6 pt-5 pb-6 sm:px-7">
            <CheckoutPanel
              cycle={cycle}
              holderName={name}
              initialMethod={initialMethod}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
