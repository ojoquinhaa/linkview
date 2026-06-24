"use client";

import {
  BR_STATES,
  formatCep,
  formatDocument,
  formatPhone,
  lookupCep,
  onlyDigits,
  type PersonTypeKey,
} from "@linkview/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { sendVerificationEmail } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { updateProfileAction } from "@/server/account";

interface Address {
  phone: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

const EMPTY: Address = {
  phone: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

export function ProfileForm({
  name: initialName,
  email,
  emailVerified,
  personType,
  document,
  marketingOptIn: initialMarketing,
  profile,
}: {
  name: string;
  email: string;
  emailVerified: boolean;
  personType: PersonTypeKey | null;
  document: string | null;
  marketingOptIn: boolean;
  profile: Address | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [addr, setAddr] = useState<Address>(
    profile
      ? {
          ...profile,
          phone: formatPhone(profile.phone),
          zip: formatCep(profile.zip),
        }
      : EMPTY,
  );
  const [marketing, setMarketing] = useState(initialMarketing);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);
  const lastCep = useRef(onlyDigits(profile?.zip ?? ""));

  const set = (k: keyof Address, v: string) => {
    setAddr((a) => ({ ...a, [k]: v }));
    setSaved(false);
  };

  async function onCepBlur() {
    const digits = onlyDigits(addr.zip);
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    setCepLoading(true);
    const found = await lookupCep(digits);
    setCepLoading(false);
    if (found) {
      setAddr((a) => ({
        ...a,
        street: found.street || a.street,
        district: found.district || a.district,
        city: found.city || a.city,
        state: found.state || a.state,
      }));
    }
  }

  async function onResend() {
    setResent(true);
    await sendVerificationEmail({ email, callbackURL: "/dashboard" });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfileAction({
        name: name.trim(),
        phone: addr.phone,
        zip: addr.zip,
        street: addr.street.trim(),
        number: addr.number.trim(),
        complement: addr.complement.trim(),
        district: addr.district.trim(),
        city: addr.city.trim(),
        state: addr.state.trim(),
        marketingOptIn: marketing,
      });
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const docLabel = personType === "pj" ? "CNPJ" : "CPF";

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-7 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7"
    >
      {/* Identidade */}
      <section className="flex flex-col gap-5">
        <SectionLabel>Identificação</SectionLabel>
        <Field label="Nome">
          {({ id }) => (
            <Input
              id={id}
              value={name}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              required
            />
          )}
        </Field>

        <ReadOnlyRow
          label="E-mail"
          value={email}
          mono={false}
          note={
            emailVerified ? (
              <span className="inline-flex items-center gap-1 text-ok">
                <CheckGlyph /> Verificado
              </span>
            ) : resent ? (
              <span className="text-muted">
                Link enviado. Confira seu e-mail.
              </span>
            ) : (
              <button
                type="button"
                onClick={onResend}
                className="font-medium text-accent transition-colors hover:text-accent-deep"
              >
                Não verificado · reenviar
              </button>
            )
          }
        />

        {document && (
          <ReadOnlyRow
            label={docLabel}
            value={formatDocument(document, personType ?? "pf")}
            mono
            note={
              <span className="text-muted">
                Dado fiscal. Para alterar, fale com o suporte.
              </span>
            }
          />
        )}
      </section>

      {/* Contato */}
      <section className="flex flex-col gap-5 border-t border-line pt-6">
        <SectionLabel>Contato e endereço</SectionLabel>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Telefone">
            {({ id }) => (
              <Input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={addr.phone}
                placeholder="(11) 99999-0000"
                onChange={(e) => set("phone", formatPhone(e.target.value))}
                required
              />
            )}
          </Field>
          <Field
            label="CEP"
            hint={cepLoading ? "Buscando endereço…" : undefined}
          >
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="postal-code"
                value={addr.zip}
                placeholder="00000-000"
                onChange={(e) => set("zip", formatCep(e.target.value))}
                onBlur={onCepBlur}
                required
              />
            )}
          </Field>
        </div>

        <Field label="Logradouro">
          {({ id }) => (
            <Input
              id={id}
              value={addr.street}
              autoComplete="address-line1"
              placeholder="Rua, avenida…"
              onChange={(e) => set("street", e.target.value)}
              required
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
          <Field label="Número">
            {({ id }) => (
              <Input
                id={id}
                value={addr.number}
                placeholder="123"
                onChange={(e) => set("number", e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Complemento (opcional)">
            {({ id }) => (
              <Input
                id={id}
                value={addr.complement}
                placeholder="Sala, bloco…"
                onChange={(e) => set("complement", e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Bairro">
          {({ id }) => (
            <Input
              id={id}
              value={addr.district}
              onChange={(e) => set("district", e.target.value)}
              required
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label="Cidade">
            {({ id }) => (
              <Input
                id={id}
                value={addr.city}
                autoComplete="address-level2"
                onChange={(e) => set("city", e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="UF">
            {({ id }) => (
              <select
                id={id}
                value={addr.state}
                onChange={(e) => set("state", e.target.value)}
                required
                className="h-11 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]"
              >
                <option value="" disabled>
                  UF
                </option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </section>

      {/* Comunicações */}
      <section className="border-t border-line pt-6">
        <SectionLabel>Comunicações</SectionLabel>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-input)] border border-line bg-paper-sunk/50 px-3.5 py-3">
          <span className="text-[0.85rem]">
            <span className="block font-medium text-ink-soft">
              Novidades e dicas por e-mail
            </span>
            <span className="block text-[0.78rem] text-muted">
              Lançamentos e boas práticas. Sem spam, cancele quando quiser.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={marketing}
            aria-label="Receber novidades por e-mail"
            onClick={() => {
              setMarketing((v) => !v);
              setSaved(false);
            }}
            className={cn(
              "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)]",
              marketing ? "bg-accent" : "bg-line-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[left] duration-150 ease-[var(--ease-out-quint)]",
                marketing ? "left-[1.125rem]" : "left-0.5",
              )}
            />
          </button>
        </label>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
        {saved && (
          <span className="text-[0.82rem] font-medium text-ok">Salvo.</span>
        )}
        <Button type="submit" loading={pending}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

function ReadOnlyRow({
  label,
  value,
  note,
  mono,
}: {
  label: string;
  value: string;
  note: React.ReactNode;
  mono: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-medium text-ink-soft">{label}</span>
      <div className="flex h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-input)] border border-line bg-paper-sunk/40 px-3.5">
        <span
          className={cn(
            "truncate text-sm text-ink-soft",
            mono && "font-mono text-[0.85rem]",
          )}
        >
          {value}
        </span>
        <LockGlyph />
      </div>
      <p className="text-[0.8rem]">{note}</p>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
