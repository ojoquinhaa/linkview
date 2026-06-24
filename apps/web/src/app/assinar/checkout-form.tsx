"use client";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createCheckout } from "@/server/billing/actions";

export function CheckoutForm() {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createCheckout({ cpfCnpj, phone: phone || undefined });
    if (res.error || !res.url) {
      setError(res.error ?? "Não foi possível continuar.");
      setLoading(false);
      return;
    }
    // Hand off to the Asaas hosted checkout (Pix / boleto / cartão).
    window.location.href = res.url;
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      <Field label="CPF ou CNPJ" hint="Necessário para emitir a cobrança.">
        {({ id, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            invalid={invalid}
            onChange={(e) => setCpfCnpj(e.target.value)}
            required
            autoFocus
          />
        )}
      </Field>

      <Field label="Celular (opcional)">
        {({ id }) => (
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </Field>

      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        Ir para o pagamento
      </Button>
      <p className="text-center text-[0.78rem] text-muted">
        Pagamento seguro via Asaas · Pix, boleto ou cartão
      </p>
    </form>
  );
}
