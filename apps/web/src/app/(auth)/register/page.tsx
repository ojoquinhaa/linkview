"use client";
import {
  BR_STATES,
  formatCep,
  formatDocument,
  formatPhone,
  isValidCep,
  isValidDocument,
  isValidPhone,
  lookupCep,
  type PersonType,
} from "@linkview/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import {
  PasswordStrength,
  scorePassword,
} from "@/components/auth/password-strength";
import { Stepper } from "@/components/auth/stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { signIn } from "@/lib/auth-client";
import { registerAccount } from "@/server/register";

const STEPS = ["Conta", "Seus dados", "Termos"];

type Errors = Record<string, string>;

export default function RegisterPage() {
  const router = useRouter();
  const numberRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Step 1 — account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — fiscal + address
  const [personType, setPersonType] = useState<PersonType>("pf");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepNotFound, setCepNotFound] = useState(false);

  // Step 3 — consent
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateAccount(): boolean {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Informe seu nome.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      next.email = "E-mail inválido.";
    if (scorePassword(password) < 1 || password.length < 8)
      next.password = "Use ao menos 8 caracteres.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateData(): boolean {
    const next: Errors = {};
    if (!isValidDocument(document, personType))
      next.document = personType === "pf" ? "CPF inválido." : "CNPJ inválido.";
    if (!isValidPhone(phone)) next.phone = "Telefone inválido.";
    if (!isValidCep(zip)) next.zip = "CEP inválido.";
    if (street.trim().length < 1) next.street = "Informe o logradouro.";
    if (number.trim().length < 1) next.number = "Informe o número.";
    if (district.trim().length < 1) next.district = "Informe o bairro.";
    if (city.trim().length < 1) next.city = "Informe a cidade.";
    if (!/^[A-Z]{2}$/.test(uf)) next.uf = "UF.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    setSubmitError(null);
    if (step === 0 && !validateAccount()) return;
    if (step === 1 && !validateData()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setSubmitError(null);
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function onPersonTypeChange(value: PersonType) {
    setPersonType(value);
    setDocument("");
    clearError("document");
  }

  async function onCepChange(raw: string) {
    const masked = formatCep(raw);
    setZip(masked);
    setCepNotFound(false);
    clearError("zip");
    if (isValidCep(masked)) {
      setCepLoading(true);
      const result = await lookupCep(masked);
      setCepLoading(false);
      if (result) {
        if (result.street) setStreet(result.street);
        setDistrict(result.district);
        setCity(result.city);
        setUf(result.state);
        clearError("street");
        clearError("district");
        clearError("city");
        clearError("uf");
        numberRef.current?.focus();
      } else {
        setCepNotFound(true);
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!acceptTerms || !acceptPrivacy) {
      setErrors({
        ...(acceptTerms ? {} : { acceptTerms: "Aceite os Termos de Uso." }),
        ...(acceptPrivacy
          ? {}
          : { acceptPrivacy: "Aceite a Política de Privacidade." }),
      });
      return;
    }
    setLoading(true);
    const result = await registerAccount({
      name: name.trim(),
      email: email.trim(),
      password,
      personType,
      document,
      phone,
      zip,
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      district: district.trim(),
      city: city.trim(),
      state: uf,
      acceptTerms: true,
      acceptPrivacy: true,
      marketingOptIn,
    });

    if (!result.ok) {
      setSubmitError(result.error ?? "Não foi possível criar a conta.");
      setLoading(false);
      // Surface duplicate-email back on the account step.
      if (result.error?.toLowerCase().includes("e-mail")) setStep(0);
      return;
    }

    if (result.requiresVerification) {
      router.push(`/verificar-email?email=${encodeURIComponent(email.trim())}`);
      return;
    }
    // No e-mail verification (local dev): establish the session, then send the
    // user to the subscription step to choose the free trial or Pro checkout.
    await signIn.email({ email: email.trim(), password });
    router.push("/assinar");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Criar conta
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">
        Grátis pra começar. Sem cartão.
      </p>

      <div className="mt-7">
        <Stepper steps={STEPS} current={step} />
      </div>

      <form
        onSubmit={(e) => {
          // Enter advances through the steps, submits only on the last one.
          if (step < STEPS.length - 1) {
            e.preventDefault();
            goNext();
          } else {
            onSubmit(e);
          }
        }}
        className="mt-7 flex flex-col gap-4"
        noValidate
      >
        {submitError && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
          >
            {submitError}
          </div>
        )}

        {step === 0 && (
          <>
            <Field label="Seu nome ou da empresa" error={errors.name}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  autoComplete="name"
                  placeholder="Loja do João"
                  value={name}
                  invalid={invalid}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError("name");
                  }}
                  autoFocus
                />
              )}
            </Field>

            <Field label="E-mail" error={errors.email}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  value={email}
                  invalid={invalid}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                />
              )}
            </Field>

            <Field label="Senha" error={errors.password}>
              {({ id, invalid }) => (
                <>
                  <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    invalid={invalid}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError("password");
                    }}
                  />
                  <PasswordStrength password={password} />
                </>
              )}
            </Field>

            <Button
              type="button"
              size="lg"
              className="mt-2 w-full"
              onClick={goNext}
            >
              Continuar
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.82rem] font-medium text-ink-soft">
                Tipo de cadastro
              </span>
              <Segmented
                aria-label="Tipo de cadastro"
                value={personType}
                onChange={onPersonTypeChange}
                options={[
                  { value: "pf", label: "Pessoa física", hint: "CPF" },
                  { value: "pj", label: "Empresa", hint: "CNPJ" },
                ]}
              />
            </div>

            <Field
              label={personType === "pf" ? "CPF" : "CNPJ"}
              error={errors.document}
            >
              {({ id, invalid }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  placeholder={
                    personType === "pf"
                      ? "000.000.000-00"
                      : "00.000.000/0000-00"
                  }
                  value={document}
                  invalid={invalid}
                  onChange={(e) => {
                    setDocument(formatDocument(e.target.value, personType));
                    clearError("document");
                  }}
                  autoFocus
                />
              )}
            </Field>

            <Field label="Telefone (WhatsApp)" error={errors.phone}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 90000-0000"
                  value={phone}
                  invalid={invalid}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value));
                    clearError("phone");
                  }}
                />
              )}
            </Field>

            <Field
              label="CEP"
              error={errors.zip}
              hint={
                cepLoading
                  ? "Buscando endereço…"
                  : cepNotFound
                    ? "CEP não encontrado. Preencha manualmente."
                    : undefined
              }
            >
              {({ id, invalid }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  value={zip}
                  invalid={invalid}
                  onChange={(e) => onCepChange(e.target.value)}
                />
              )}
            </Field>

            <Field label="Logradouro" error={errors.street}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  autoComplete="address-line1"
                  placeholder="Rua, avenida…"
                  value={street}
                  invalid={invalid}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    clearError("street");
                  }}
                />
              )}
            </Field>

            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
              <Field label="Número" error={errors.number}>
                {({ id, invalid }) => (
                  <Input
                    ref={numberRef}
                    id={id}
                    inputMode="numeric"
                    placeholder="123"
                    value={number}
                    invalid={invalid}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      clearError("number");
                    }}
                  />
                )}
              </Field>
              <Field label="Complemento" hint="Opcional">
                {({ id }) => (
                  <Input
                    id={id}
                    placeholder="Sala, apto…"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                  />
                )}
              </Field>
            </div>

            <Field label="Bairro" error={errors.district}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  autoComplete="address-level3"
                  value={district}
                  invalid={invalid}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    clearError("district");
                  }}
                />
              )}
            </Field>

            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label="Cidade" error={errors.city}>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    autoComplete="address-level2"
                    value={city}
                    invalid={invalid}
                    onChange={(e) => {
                      setCity(e.target.value);
                      clearError("city");
                    }}
                  />
                )}
              </Field>
              <Field label="UF" error={errors.uf}>
                {({ id, invalid }) => (
                  <select
                    id={id}
                    value={uf}
                    onChange={(e) => {
                      setUf(e.target.value);
                      clearError("uf");
                    }}
                    aria-invalid={invalid || undefined}
                    className="h-11 w-full rounded-[var(--radius-input)] border bg-surface px-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] aria-[invalid=true]:border-danger"
                  >
                    <option value="" disabled>
                      –
                    </option>
                    {BR_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="flex-1"
                onClick={goBack}
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-[1.6]"
                onClick={goNext}
              >
                Continuar
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-[0.85rem] text-muted">
              Quase lá. Confirme os aceites abaixo para criar sua conta com
              segurança.
            </div>

            <div className="flex flex-col gap-3.5 py-1">
              <Checkbox
                checked={acceptTerms}
                onCheckedChange={(v) => {
                  setAcceptTerms(v);
                  clearError("acceptTerms");
                }}
                invalid={Boolean(errors.acceptTerms)}
              >
                Li e aceito os{" "}
                <Link
                  href="/termos"
                  target="_blank"
                  className="font-medium text-accent hover:underline"
                >
                  Termos de Uso
                </Link>
                .
              </Checkbox>

              <Checkbox
                checked={acceptPrivacy}
                onCheckedChange={(v) => {
                  setAcceptPrivacy(v);
                  clearError("acceptPrivacy");
                }}
                invalid={Boolean(errors.acceptPrivacy)}
              >
                Li e estou de acordo com a{" "}
                <Link
                  href="/privacidade"
                  target="_blank"
                  className="font-medium text-accent hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </Checkbox>

              <div className="my-0.5 h-px bg-line" />

              <Checkbox
                checked={marketingOptIn}
                onCheckedChange={setMarketingOptIn}
              >
                Quero receber dicas e novidades por e-mail. (opcional, você pode
                cancelar quando quiser)
              </Checkbox>
            </div>

            {(errors.acceptTerms || errors.acceptPrivacy) && (
              <p className="text-[0.8rem] text-danger">
                {errors.acceptTerms ?? errors.acceptPrivacy}
              </p>
            )}

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="flex-1"
                onClick={goBack}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="lg"
                className="flex-[1.6]"
                loading={loading}
              >
                Criar minha conta
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="mt-7 text-center text-[0.9rem] text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
