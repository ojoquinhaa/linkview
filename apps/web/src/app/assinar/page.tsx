import { getPlan, TRIAL_DURATION_DAYS } from "@linkview/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getWorkspaceSubscription } from "@/server/billing/subscription";
import { getTrialEligibility } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { CheckoutForm } from "./checkout-form";
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

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const sub = await getWorkspaceSubscription(workspace.id);
  if (sub && ACTIVE.has(sub.status)) redirect("/dashboard/links");

  const { status } = await searchParams;
  const awaiting = sub?.status === "pending" || status === "ok";
  const plan = getPlan("pro");
  const trial = await getTrialEligibility(
    session.user.id,
    session.user.email,
    workspace.planKey,
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_80%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Wordmark size="md" />
      </header>

      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-12">
        <div className="w-full max-w-[27rem]">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
            {awaiting ? (
              <Awaiting />
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h1 className="font-display text-[1.5rem] font-semibold tracking-[-0.02em] text-ink">
                    Plano {plan.name}
                  </h1>
                  <div className="text-right">
                    <span className="nums text-[1.4rem] font-semibold text-ink">
                      {brl(plan.priceCents)}
                    </span>
                    <span className="text-[0.8rem] text-muted">/mês</span>
                  </div>
                </div>
                <p className="mt-1.5 text-[0.9rem] text-muted">
                  Tudo que você precisa para criar e medir seus links. Cancele
                  quando quiser.
                </p>

                {trial.eligible && <TrialCta days={TRIAL_DURATION_DAYS} />}

                <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
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

                <CheckoutForm />
              </>
            )}
          </div>

          <p className="mt-6 text-center text-[0.85rem] text-muted">
            Entrou com {session.user.email}.{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              Trocar conta
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Awaiting() {
  return (
    <div className="text-center">
      <h1 className="font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
        Pagamento em processamento
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-[0.9rem] leading-relaxed text-muted">
        Recebemos seu pedido. Pagamentos via Pix liberam em segundos; boleto
        pode levar até alguns dias úteis. Assim que confirmar, seu acesso é
        liberado automaticamente.
      </p>
      <Link
        href="/assinar"
        className="mt-6 inline-block text-[0.9rem] font-medium text-accent hover:underline"
      >
        Já paguei — verificar agora
      </Link>
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
