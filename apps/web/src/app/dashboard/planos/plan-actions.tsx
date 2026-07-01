"use client";
import type { BillingCycle } from "@linkview/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BillingCycleChoice,
  type BillingCyclePricing,
} from "@/components/billing/billing-cycle-choice";
import { CardForm } from "@/components/billing/card-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { RawCard } from "@/lib/card";
import {
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  switchBillingCycleAction,
  switchToCardAction,
  switchToPixAction,
  updateCardAction,
} from "@/server/billing/actions";

type Mode = "trial" | "active";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Action zone for the plan page. Upgrades reuse the monthly/annual checkout
 * inline (no modal); active subscribers switch cycle through that same checkout
 * (pay the new cycle now, unused days credited as extra time); cancellation is a
 * two-step inline confirm so it never fires by accident.
 */
export function PlanActions({
  mode,
  canceling,
  autopay,
  trialDays,
  pricing,
  currentCycle,
  switchPending,
  switchTargetCycle,
  nextChargeLabel,
  cardLast4,
  cardBrand,
}: {
  mode: Mode;
  canceling: boolean;
  autopay: boolean;
  trialDays: number;
  pricing: BillingCyclePricing;
  currentCycle: BillingCycle;
  /** A cycle switch is paid-pending: show a processing notice, hide the switch. */
  switchPending: boolean;
  /** Target cycle of the in-flight switch, for the notice copy. */
  switchTargetCycle: BillingCycle | null;
  nextChargeLabel: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
}) {
  // Trial users get the checkout path.
  if (mode === "trial") {
    return (
      <Upgrade
        title="Continue no Pro"
        blurb={`Escolha seu ciclo e assine antes que o teste de ${trialDays} dias acabe.`}
        cta="Assinar Pro"
        pricing={pricing}
      />
    );
  }

  // A Pro user who scheduled a cancellation but is still inside the paid period
  // can resume without paying now — the next charge just returns at renewal.
  if (canceling) {
    return <ResumeRow autopay={autopay} nextChargeLabel={nextChargeLabel} />;
  }

  return (
    <>
      <PaymentMethodRow
        autopay={autopay}
        nextChargeLabel={nextChargeLabel}
        cardLast4={cardLast4}
        cardBrand={cardBrand}
      />
      {switchPending ? (
        <SwitchProcessing
          targetCycle={switchTargetCycle}
          pricing={pricing}
          autopay={autopay}
        />
      ) : (
        <CycleSwitch
          currentCycle={currentCycle}
          pricing={pricing}
          autopay={autopay}
          nextChargeLabel={nextChargeLabel}
        />
      )}
      <CancelRow />
    </>
  );
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  elo: "Elo",
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  AMEX: "Amex",
  ELO: "Elo",
};

/**
 * Payment-method panel for an active subscriber. Shows the method on file and
 * lets the owner switch it, effective the next renewal with no charge today:
 *  - Card → swap the card in place (tokenized, no charge), or move to Pix.
 *  - Pix  → add a card so the next renewal is auto-charged.
 * The next renewal date frames every action so the user knows when it applies.
 */
function PaymentMethodRow({
  autopay,
  nextChargeLabel,
  cardLast4,
  cardBrand,
}: {
  autopay: boolean;
  nextChargeLabel: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
}) {
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [toPixConfirm, setToPixConfirm] = useState(false);
  const [toPixLoading, setToPixLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Swap the card on a card subscription (no charge, next renewals).
  async function onSwapCard(card: RawCard): Promise<string | null> {
    const res = await updateCardAction(card);
    if (!res.ok) return res.error ?? "Não foi possível trocar o cartão.";
    setSwapOpen(false);
    router.refresh();
    return null;
  }

  // Move a Pix subscription to card autopay (tokenize now, charge next renewal).
  async function onAddCard(card: RawCard): Promise<string | null> {
    const res = await switchToCardAction(card);
    if (!res.ok) return res.error ?? "Não foi possível salvar o cartão.";
    setAddCardOpen(false);
    router.refresh();
    return null;
  }

  // Move a card subscription to manual Pix (no charge; invoice emailed at renewal).
  async function onSwitchToPix() {
    setError(null);
    setToPixLoading(true);
    const res = await switchToPixAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível mudar para Pix.");
      setToPixLoading(false);
      return;
    }
    setToPixConfirm(false);
    setToPixLoading(false);
    router.refresh();
  }

  const brand = cardBrand ? (BRAND_LABEL[cardBrand] ?? cardBrand) : null;
  const renewal = nextChargeLabel ? ` em ${nextChargeLabel}` : "";

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-muted">
          {autopay ? <CardIcon /> : <PixIcon />}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
            Forma de pagamento
          </h3>
          <p className="mt-1.5 text-[0.88rem] text-muted">
            {autopay
              ? cardLast4
                ? `${brand ? `${brand} ` : "Cartão "}···· ${cardLast4} · renovação automática${renewal}.`
                : `Cartão de crédito · renovação automática${renewal}.`
              : `Pix · você paga a cada ciclo${nextChargeLabel ? `, próxima${renewal}` : ""}. Enviamos a fatura por e-mail.`}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      {/* Card → swap card / move to Pix. */}
      {autopay && !toPixConfirm && (
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSwapOpen(true)}
            className="sm:w-auto"
          >
            Trocar cartão
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setToPixConfirm(true);
            }}
            className="sm:w-auto"
          >
            Mudar para Pix
          </Button>
        </div>
      )}

      {/* Card → Pix confirmation. */}
      {autopay && toPixConfirm && (
        <div className="mt-5">
          <p className="text-[0.85rem] text-ink-soft">
            A partir da próxima renovação{renewal}, você paga por Pix. Nada é
            cobrado no cartão automaticamente — enviamos a fatura por e-mail e
            você paga aqui pelo QR Code. Nada muda até lá.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              loading={toPixLoading}
              onClick={onSwitchToPix}
              className="sm:w-auto"
            >
              Confirmar mudança para Pix
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={toPixLoading}
              onClick={() => setToPixConfirm(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Pix → add a card for autopay. */}
      {!autopay && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setError(null);
            setAddCardOpen(true);
          }}
          className="mt-5 w-full sm:w-auto"
        >
          Pagar com cartão
        </Button>
      )}

      <Modal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Trocar cartão"
        description="O novo cartão passa a valer para as próximas renovações. Nada é cobrado agora."
      >
        <CardForm
          onSubmit={onSwapCard}
          submitLabel="Salvar cartão"
          note="Não cobramos nada agora. Não guardamos os dados do cartão."
        />
      </Modal>

      <Modal
        open={addCardOpen}
        onClose={() => setAddCardOpen(false)}
        title="Pagar com cartão"
        description={`Seu cartão será cobrado automaticamente só na próxima renovação${renewal}. Nada é cobrado agora.`}
      >
        <CardForm
          onSubmit={onAddCard}
          submitLabel="Salvar cartão"
          note="Não cobramos nada agora. Não guardamos os dados do cartão."
        />
      </Modal>
    </section>
  );
}

function CardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
      <line x1="6" y1="14.5" x2="9" y2="14.5" />
    </svg>
  );
}

function PixIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="currentColor"
    >
      <path d="M12 2.6a2 2 0 0 1 1.43.6l6.77 6.77a2 2 0 0 1 0 2.83l-6.77 6.77a2 2 0 0 1-2.86 0L3.8 12.8a2 2 0 0 1 0-2.83L10.57 3.2A2 2 0 0 1 12 2.6Zm0 2.23L5.23 11.6a.57.57 0 0 0 0 .8L12 19.17l6.77-6.77a.57.57 0 0 0 0-.8Z" />
    </svg>
  );
}

/**
 * Notice shown while a cycle switch is *paid-pending*: the subscription stays on
 * its current plan (price + renewal date unchanged) until the new charge clears,
 * then flips. Replaces the switch CTA so the user can't start a second switch,
 * and never shows the new price/date before it's paid. For Pix the open invoice
 * is payable from the global billing banner / payments page; card autopay just
 * captures on its own.
 */
function SwitchProcessing({
  targetCycle,
  pricing,
  autopay,
}: {
  targetCycle: BillingCycle | null;
  pricing: BillingCyclePricing;
  autopay: boolean;
}) {
  const annual = targetCycle === "yearly";
  const label = annual ? "anual" : "mensal";
  const amount = annual ? brl(pricing.yearlyCents) : brl(pricing.monthlyCents);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
          <span
            aria-hidden
            className="inline-block size-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
            Mudança para o plano {label} em processamento
          </h3>
          <p className="mt-1.5 text-[0.88rem] text-muted">
            Sua assinatura segue no plano atual até o pagamento de{" "}
            <span className="font-medium text-ink">{amount}</span> ser
            confirmado. Assim que cair, o plano passa a ser {label} e a próxima
            cobrança é ajustada.
            {autopay
              ? " A cobrança é feita automaticamente no seu cartão."
              : " Enviamos a fatura por e-mail e você paga por Pix."}
          </p>
          {!autopay && (
            <Link
              href="/dashboard/pagamentos"
              className="mt-5 inline-flex h-10 select-none items-center justify-center gap-2 rounded-[var(--radius-input)] border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-paper-sunk"
            >
              Pagar fatura
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Monthly ⇄ annual switch for an active subscriber. The two directions differ:
 *  - Upgrade (monthly → annual): routes to our checkout, charges the annual
 *    price now and credits the unused days of the current period as extra time.
 *  - Downgrade (annual → monthly): no charge now — scheduled in place at Asaas.
 *    The current paid annual period runs out untouched, then renewal flips to
 *    monthly. We just flag the change; nothing is billed until renewal.
 */
function CycleSwitch({
  currentCycle,
  pricing,
  autopay,
  nextChargeLabel,
}: {
  currentCycle: BillingCycle;
  pricing: BillingCyclePricing;
  autopay: boolean;
  nextChargeLabel: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target: BillingCycle = currentCycle === "yearly" ? "monthly" : "yearly";
  const toAnnual = target === "yearly";

  // Upgrade pays now via checkout; downgrade just schedules the cycle change.
  async function onSwitch() {
    setError(null);
    setLoading(true);
    if (toAnnual) {
      const method = autopay ? "card" : "pix";
      router.push(`/assinar/pagamento?cycle=yearly&method=${method}&switch=1`);
      return;
    }
    const res = await switchBillingCycleAction("monthly");
    if (!res.ok) {
      setError(res.error ?? "Não foi possível mudar o ciclo.");
      setLoading(false);
      return;
    }
    setConfirming(false);
    setLoading(false);
    router.refresh();
  }

  const newPriceLine = toAnnual
    ? `${brl(pricing.yearlyCents)} por ano (${brl(pricing.monthlyEquivCents)}/mês)`
    : `${brl(pricing.monthlyCents)} por mês`;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
            {toAnnual ? "Mude para o plano anual" : "Voltar ao plano mensal"}
          </h3>
          <p className="mt-1.5 text-[0.88rem] text-muted">
            {toAnnual
              ? `Pague ${newPriceLine} e economize ${brl(pricing.savingsCents)} por ano.`
              : `Pague ${newPriceLine}, sem compromisso anual.`}
          </p>
        </div>
        {toAnnual && (
          <span className="shrink-0 rounded-full border border-accent-line bg-accent-weak px-2.5 py-1 text-[0.72rem] font-semibold text-accent-deep">
            -{pricing.percentOff}%
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      {confirming ? (
        <div className="mt-5">
          <p className="text-[0.85rem] text-ink-soft">
            {toAnnual ? (
              <>
                Você paga o valor anual agora no checkout. Os dias restantes do
                seu período atual entram como tempo extra no novo período — você
                não perde nada.
              </>
            ) : (
              <>
                Sem cobrança agora. Seu plano anual segue até{" "}
                <span className="font-medium text-ink">
                  {nextChargeLabel ?? "o fim do período"}
                </span>
                ; a partir daí você passa a pagar {brl(pricing.monthlyCents)} por
                mês.
              </>
            )}
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              loading={loading}
              onClick={onSwitch}
              className="sm:w-auto"
            >
              {toAnnual ? "Ir para o checkout anual" : "Confirmar mudança"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          variant={toAnnual ? "primary" : "secondary"}
          onClick={() => setConfirming(true)}
          className="mt-5 w-full sm:w-auto"
        >
          {toAnnual ? "Mudar para anual" : "Mudar para mensal"}
        </Button>
      )}
    </section>
  );
}

function Upgrade({
  title,
  blurb,
  cta,
  pricing,
}: {
  title: string;
  blurb: string;
  cta: string;
  pricing: BillingCyclePricing;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">{blurb}</p>
      {open ? (
        <div className="mt-5">
          <BillingCycleChoice pricing={pricing} cta={cta} />
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={() => setOpen(true)}
          className="mt-5 w-full sm:w-auto"
        >
          {cta}
        </Button>
      )}
    </section>
  );
}

/**
 * Resume panel for a subscriber who canceled but is still inside the paid
 * period. Resuming charges nothing now: the subscription is recreated with its
 * first charge dated to the current period's end. Card autopay is redirected to
 * a hosted page to re-enter a card for that future charge; manual (Pix/boleto)
 * resumes in a single click.
 */
function ResumeRow({
  autopay,
  nextChargeLabel,
}: {
  autopay: boolean;
  nextChargeLabel: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onResume() {
    setError(null);
    setLoading(true);
    const res = await resumeSubscriptionAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível retomar.");
      setLoading(false);
      return;
    }
    // Stay in the app: refresh to the active-plan view. Autopay customers
    // recapture a card there via "Atualizar cartão" — nothing is charged now.
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        Mudou de ideia? Retome o Pro
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">
        {nextChargeLabel
          ? `Seu acesso Pro continua até ${nextChargeLabel}. Retome agora — nada é cobrado, e a próxima cobrança volta a ser em ${nextChargeLabel}.`
          : "Retome agora — nada é cobrado, e a cobrança volta no próximo ciclo."}
        {autopay ? " Depois, confirme seu cartão em “Atualizar cartão”." : ""}
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}
      <Button
        type="button"
        size="lg"
        loading={loading}
        onClick={onResume}
        className="mt-5 w-full sm:w-auto"
      >
        Retomar Pro
      </Button>
    </section>
  );
}

function CancelRow() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    setError(null);
    setLoading(true);
    const res = await cancelSubscriptionAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível cancelar.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Cancelar assinatura
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        Cancelar o plano Pro?
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">
        Você mantém o acesso Pro até o fim do período já pago. Depois disso, o
        workspace volta ao plano gratuito.
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Button
          type="button"
          variant="danger"
          loading={loading}
          onClick={onCancel}
        >
          Confirmar cancelamento
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Voltar
        </Button>
      </div>
    </section>
  );
}
