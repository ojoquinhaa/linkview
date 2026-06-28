import { getAnnualSavings, getPlan } from "@linkview/shared";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { getWorkspaceSubscription } from "@/server/billing/subscription";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { SuccessRedirect } from "./success-redirect";

const ACTIVE = new Set(["active", "trialing"]);

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

/**
 * Thank-you screen. Reached only with an active subscription: a pending charge
 * is sent back to the confirmation screen so this page never shows a promise we
 * can't keep. Summarises what the customer just bought, then carries them into
 * the dashboard.
 */
export default async function SucessoPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const sub = await getWorkspaceSubscription(workspace.id);
  if (!sub || !ACTIVE.has(sub.status)) redirect("/assinar/confirmando");

  const pro = getPlan("pro");
  const savings = getAnnualSavings("pro");
  const annual = sub.billingCycle === "yearly";
  const priceCents = annual ? savings.yearlyCents : pro.priceCents;
  const cadence = annual ? "ano" : "mês";
  const renewsAt = sub.currentPeriodEnd;

  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_70%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <PublicHeader
        user={{ name: session.user.name ?? "", email: session.user.email }}
        canAccessDashboard
      />

      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-16">
        <div className="w-full max-w-[28rem] text-center">
          <span className="mx-auto grid size-16 animate-pop place-items-center rounded-full bg-accent text-accent-ink shadow-[0_8px_28px_oklch(0.42_0.16_265/0.28)]">
            <Check />
          </span>

          <div className="animate-rise [animation-delay:80ms]">
            <h1 className="mt-6 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              Bem-vindo ao Pro
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-pretty text-[0.95rem] leading-relaxed text-muted">
              Pagamento confirmado e assinatura ativa. Tudo pronto para criar,
              encurtar e medir seus links.
            </p>
          </div>

          <div className="mt-8 animate-rise overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] [animation-delay:160ms]">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="text-[0.9rem] text-ink-soft">Plano</span>
              <span className="font-medium text-ink">
                Pro · {annual ? "anual" : "mensal"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4">
              <span className="text-[0.9rem] text-ink-soft">Valor</span>
              <span className="nums font-medium text-ink">
                {brl(priceCents)}
                <span className="font-normal text-muted">/{cadence}</span>
              </span>
            </div>
            {renewsAt && (
              <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4">
                <span className="text-[0.9rem] text-ink-soft">
                  Próxima cobrança
                </span>
                <span className="font-medium text-ink">
                  {fmtDate(renewsAt)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 animate-rise [animation-delay:240ms]">
            <SuccessRedirect />
          </div>
        </div>
      </main>
    </div>
  );
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Confirmado</title>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}
