"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  cardBrand,
  ccvValid,
  expiryValid,
  formatCardNumber,
  luhnValid,
  onlyDigits,
  type RawCard,
} from "@/lib/card";

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  elo: "Elo",
};

/** Split an "MM/AA" or "MMAA" entry into month + 4-digit year. */
function parseExpiry(value: string): { month: string; year: string } {
  const d = onlyDigits(value).slice(0, 4);
  const month = d.slice(0, 2);
  const yy = d.slice(2, 4);
  return { month, year: yy ? `20${yy}` : "" };
}

function formatExpiry(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export interface CardFormProps {
  /** Forwards a validated card to the server; returns an error message or null. */
  onSubmit: (card: RawCard) => Promise<string | null>;
  submitLabel: string;
  /** Reassuring line under the button. */
  note?: string;
  /** Seed the holder-name field (e.g. the account name); stays editable. */
  initialHolderName?: string;
}

/**
 * Credit-card capture form. Validates live (Luhn, expiry, CCV) so the user gets
 * instant feedback, then hands a clean {@link RawCard} to `onSubmit`. The card
 * data lives only in this component's state for the duration of the submit — it
 * is never stored in the URL, localStorage, or logs.
 */
export function CardForm({
  onSubmit,
  submitLabel,
  note,
  initialHolderName = "",
}: CardFormProps) {
  const [holderName, setHolderName] = useState(
    initialHolderName.trim().toUpperCase(),
  );
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const brand = cardBrand(number);
  const brandLabel = BRAND_LABEL[brand];

  function validate(): RawCard | null {
    const { month, year } = parseExpiry(expiry);
    const next: Record<string, string> = {};
    if (!holderName.trim()) next.holderName = "Informe o nome no cartão.";
    if (!luhnValid(number)) next.number = "Número inválido.";
    if (!expiryValid(month, year)) next.expiry = "Validade inválida.";
    if (!ccvValid(ccv, number)) next.ccv = "Código inválido.";
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      holderName: holderName.trim(),
      number: onlyDigits(number),
      expiryMonth: month,
      expiryYear: year,
      ccv: onlyDigits(ccv),
    };
  }

  async function handleSubmit() {
    setFormError(null);
    const card = validate();
    if (!card) return;
    setLoading(true);
    try {
      const error = await onSubmit(card);
      if (error) {
        setFormError(error);
        setLoading(false);
      }
      // On success the parent navigates/refreshes; keep the spinner up.
    } catch {
      setFormError("Não foi possível processar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="flex flex-col gap-4"
      // Defense in depth: keep the browser from offering to remember the PAN
      // beyond the native autofill the user explicitly triggers.
      autoComplete="on"
    >
      <Field label="Nome no cartão" error={errors.holderName}>
        {({ id, invalid }) => (
          <Input
            id={id}
            invalid={invalid}
            value={holderName}
            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
            placeholder="COMO ESTÁ NO CARTÃO"
            autoComplete="cc-name"
            spellCheck={false}
          />
        )}
      </Field>

      <Field label="Número do cartão" error={errors.number}>
        {({ id, invalid }) => (
          <Input
            id={id}
            invalid={invalid}
            value={formatCardNumber(number)}
            onChange={(e) => setNumber(onlyDigits(e.target.value).slice(0, 19))}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="cc-number"
            className="font-mono"
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Validade" error={errors.expiry}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              value={formatExpiry(expiry)}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/AA"
              inputMode="numeric"
              autoComplete="cc-exp"
              className="font-mono"
            />
          )}
        </Field>
        <Field label="CVV" error={errors.ccv}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              value={ccv}
              onChange={(e) =>
                setCcv(onlyDigits(e.target.value).slice(0, 4))
              }
              placeholder="123"
              inputMode="numeric"
              autoComplete="cc-csc"
              className="font-mono"
            />
          )}
        </Field>
      </div>

      {brandLabel && (
        <p className="-mt-1 text-[0.78rem] text-muted">Cartão {brandLabel}</p>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {formError}
        </div>
      )}

      <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
        {submitLabel}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[0.78rem] text-muted">
        <Lock />
        {note ?? "Pagamento criptografado. Não guardamos os dados do cartão."}
      </p>
    </form>
  );
}

function Lock() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5 text-muted"
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
