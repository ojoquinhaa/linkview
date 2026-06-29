"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { dialCode } from "@/lib/countries";
import { createLinkAction } from "@/server/links";
import { CopyButton } from "./copy-button";
import { PhoneCountrySelect } from "./phone-country-select";
import { QrButton } from "./qr-button";

type LinkType = "url" | "whatsapp" | "instagram" | "phone" | "email";

const TABS: {
  key: LinkType;
  label: string;
  icon: ReactNode;
  /** Brand color for the active icon (real brands only; others use accent). */
  brand?: string;
}[] = [
  { key: "url", label: "Link", icon: <LinkIcon /> },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: <WhatsAppIcon />,
    brand: "#25D366",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: <InstagramIcon />,
    brand: "#E1306C",
  },
  { key: "phone", label: "Telefone", icon: <PhoneIcon /> },
  { key: "email", label: "E-mail", icon: <MailIcon /> },
];

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Pull a clean Instagram username out of a handle, @mention, or full URL. */
function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();
}

export function CreateLink({ domain }: { domain: string }) {
  const router = useRouter();
  const [type, setType] = useState<LinkType>("url");

  // url
  const [url, setUrl] = useState("");
  // whatsapp
  const [waCountry, setWaCountry] = useState("BR");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  // instagram
  const [igHandle, setIgHandle] = useState("");
  const [igMode, setIgMode] = useState<"profile" | "dm">("profile");
  // phone
  const [telCountry, setTelCountry] = useState("BR");
  const [telPhone, setTelPhone] = useState("");
  // email
  const [email, setEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // shared
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    shortUrl: string;
    slug: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const destination = buildDestination();
  const ready = isReady();

  function buildDestination(): string {
    switch (type) {
      case "url": {
        const u = url.trim();
        if (!u) return "";
        return /^https?:\/\//i.test(u) ? u : `https://${u}`;
      }
      case "whatsapp": {
        const digits = dialCode(waCountry) + onlyDigits(waPhone);
        const msg = waMessage.trim();
        return `https://wa.me/${digits}${
          msg ? `?text=${encodeURIComponent(msg)}` : ""
        }`;
      }
      case "instagram": {
        const h = cleanHandle(igHandle);
        return igMode === "dm"
          ? `https://ig.me/m/${h}`
          : `https://instagram.com/${h}`;
      }
      case "phone":
        return `tel:+${dialCode(telCountry)}${onlyDigits(telPhone)}`;
      case "email": {
        const params = new URLSearchParams();
        if (emailSubject.trim()) params.set("subject", emailSubject.trim());
        if (emailBody.trim()) params.set("body", emailBody.trim());
        const q = params.toString();
        return `mailto:${email.trim()}${q ? `?${q}` : ""}`;
      }
    }
  }

  function isReady(): boolean {
    switch (type) {
      case "url":
        return /\.\S/.test(url.trim());
      case "whatsapp":
        return onlyDigits(waPhone).length >= 8;
      case "instagram":
        return cleanHandle(igHandle).length >= 1;
      case "phone":
        return onlyDigits(telPhone).length >= 6;
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }
  }

  function resetFields() {
    setUrl("");
    setWaPhone("");
    setWaMessage("");
    setIgHandle("");
    setTelPhone("");
    setEmail("");
    setEmailSubject("");
    setEmailBody("");
    setSlug("");
    setTitle("");
    setAdvanced(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ready) {
      setError("Preencha os campos do link antes de continuar.");
      return;
    }
    startTransition(async () => {
      const res = await createLinkAction({
        destinationUrl: destination,
        slug: slug.trim() || undefined,
        title: title.trim() || undefined,
      });
      if (!res.ok || !res.link) {
        setError(res.error ?? "Não foi possível criar o link.");
        return;
      }
      setCreated({ shortUrl: res.link.shortUrl, slug: res.link.slug });
      resetFields();
      // Go to the link detail page; the success card stays visible until it loads.
      router.push(`/dashboard/links/${res.link.slug}`);
    });
  }

  const invalid = Boolean(error);

  return (
    <section aria-labelledby="novo-link">
      <h2 id="novo-link" className="sr-only">
        Criar link
      </h2>
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-5"
      >
        {/* Type selector */}
        <div
          role="tablist"
          aria-label="Tipo de link"
          data-tour="create-types"
          className="grid grid-cols-5 gap-1 rounded-xl bg-paper-sunk p-1"
        >
          {TABS.map((tab) => {
            const active = tab.key === type;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="builder-panel"
                aria-label={tab.label}
                title={tab.label}
                onClick={() => {
                  setType(tab.key);
                  setError(null);
                }}
                className={cn(
                  // Mobile: tall, icon-only tap targets. ≥sm: icon + label.
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-[0.72rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)] sm:py-2",
                  active
                    ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.08)]"
                    : "text-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    // Big on phones, back to compact on desktop.
                    "[&_svg]:size-[1.6rem] sm:[&_svg]:size-[1.125rem]",
                    active && !tab.brand && "text-accent",
                  )}
                  style={active && tab.brand ? { color: tab.brand } : undefined}
                >
                  {tab.icon}
                </span>
                <span className="hidden w-full truncate text-center sm:block">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Builder */}
        <div
          id="builder-panel"
          role="tabpanel"
          data-tour="create-builder"
          className="mt-5"
        >
          {type === "url" && (
            <Field label="Cole o link que você quer encurtar">
              {({ id, invalid: fieldInvalid }) => (
                <Input
                  id={id}
                  data-create-link-url
                  type="url"
                  inputMode="url"
                  placeholder="https://sua-loja.com.br/promocao-de-junho"
                  value={url}
                  invalid={fieldInvalid || invalid}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </Field>
          )}

          {type === "whatsapp" && (
            <div className="grid gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.82rem] font-medium text-ink-soft">
                  Número do WhatsApp
                </span>
                <PhoneShell invalid={invalid}>
                  <PhoneCountrySelect
                    value={waCountry}
                    onChange={setWaCountry}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="11 91234-5678"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    className="h-full w-full bg-transparent px-3 text-ink outline-none placeholder:text-muted/80"
                  />
                </PhoneShell>
                <p className="text-[0.8rem] text-muted">
                  Com DDD. Abre uma conversa direto no WhatsApp.
                </p>
              </div>
              <Field
                label="Mensagem automática (opcional)"
                hint="Já vem digitada para a pessoa só enviar."
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={3}
                    placeholder="Olá! Vim pelo seu link e quero saber mais."
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                  />
                )}
              </Field>
            </div>
          )}

          {type === "instagram" && (
            <div className="grid gap-4">
              <Field
                label="Perfil do Instagram"
                hint="Pode colar o @ ou o link inteiro, a gente arruma."
              >
                {({ id, invalid: fieldInvalid }) => (
                  <Input
                    id={id}
                    prefix="instagram.com/"
                    placeholder="sualoja"
                    value={igHandle}
                    invalid={fieldInvalid || invalid}
                    onChange={(e) => setIgHandle(e.target.value)}
                  />
                )}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.82rem] font-medium text-ink-soft">
                  O link abre
                </span>
                <Segmented
                  options={[
                    { value: "profile", label: "O perfil" },
                    { value: "dm", label: "A conversa (DM)" },
                  ]}
                  value={igMode}
                  onChange={(v) => setIgMode(v as "profile" | "dm")}
                />
              </div>
            </div>
          )}

          {type === "phone" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.82rem] font-medium text-ink-soft">
                Número de telefone
              </span>
              <PhoneShell invalid={invalid}>
                <PhoneCountrySelect
                  value={telCountry}
                  onChange={setTelCountry}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="11 3000-0000"
                  value={telPhone}
                  onChange={(e) => setTelPhone(e.target.value)}
                  className="h-full w-full bg-transparent px-3 text-ink outline-none placeholder:text-muted/80"
                />
              </PhoneShell>
              <p className="text-[0.8rem] text-muted">
                Abre o discador para ligar com um toque no celular.
              </p>
            </div>
          )}

          {type === "email" && (
            <div className="grid gap-4">
              <Field label="E-mail de destino">
                {({ id, invalid: fieldInvalid }) => (
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    placeholder="contato@suaempresa.com.br"
                    value={email}
                    invalid={fieldInvalid || invalid}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Assunto (opcional)">
                {({ id }) => (
                  <Input
                    id={id}
                    placeholder="Quero saber mais"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Mensagem (opcional)">
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={3}
                    placeholder="Olá, vim pelo seu link e gostaria de..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        {/* Live preview */}
        {ready && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-input)] border border-line bg-paper-sunk/60 px-3.5 py-2.5">
            <span className="mt-0.5 text-muted">
              {TABS.find((t) => t.key === type)?.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
                {previewLabel(type, igMode)}
              </p>
              <p className="truncate font-mono text-[0.82rem] text-ink-soft">
                {destination}
              </p>
            </div>
          </div>
        )}

        {/* Advanced */}
        {advanced && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Slug personalizado"
              hint="Deixe vazio para gerar automático."
            >
              {({ id }) => (
                <Input
                  id={id}
                  prefix={`${domain}/`}
                  placeholder="promo-junho"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              )}
            </Field>
            <Field label="Título (opcional)">
              {({ id }) => (
                <Input
                  id={id}
                  placeholder="Promoção de junho"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
            </Field>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            data-tour="create-advanced"
            className="text-[0.85rem] font-medium text-muted transition-colors hover:text-ink"
          >
            {advanced ? "− Menos opções" : "+ Personalizar link e título"}
          </button>
          <Button
            type="submit"
            data-tour="create-submit"
            loading={pending}
            disabled={!ready}
          >
            Criar link
          </Button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </p>
      )}

      {created && (
        <div className="mt-3 rounded-2xl border border-accent-line bg-accent-weak px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-[0.74rem] font-medium text-muted">
                Pronto! Seu link curto:
              </p>
              <Link
                href={created.shortUrl}
                target="_blank"
                className="break-all font-mono text-[0.92rem] font-medium text-accent-deep hover:underline"
              >
                {created.shortUrl.replace(/^https?:\/\//, "")}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <QrButton url={created.shortUrl} slug={created.slug} />
              <CopyButton value={created.shortUrl} label="Copiar" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Field shell that frames a country selector + bare phone input as one control. */
function PhoneShell({
  invalid,
  children,
}: {
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center rounded-[var(--radius-input)] border bg-surface transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)]",
        invalid
          ? "border-danger focus-within:border-danger focus-within:shadow-[0_0_0_3px_oklch(0.53_0.18_25/0.25)]"
          : "border-line focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]",
      )}
    >
      {children}
    </div>
  );
}

/** Two-up segmented control sharing the tab-track styling. */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="grid grid-cols-2 gap-1 rounded-xl bg-paper-sunk p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[0.83rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)]",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.08)]"
                : "text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function previewLabel(type: LinkType, igMode: "profile" | "dm"): string {
  switch (type) {
    case "url":
      return "Vai abrir a página";
    case "whatsapp":
      return "Conversa no WhatsApp";
    case "instagram":
      return igMode === "dm"
        ? "Mensagem direta no Instagram"
        : "Perfil no Instagram";
    case "phone":
      return "Discador do telefone";
    case "email":
      return "Novo e-mail";
  }
}

function LinkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12a3 3 0 0 0 3 3h2.5a3.5 3.5 0 0 0 0-7H13" />
      <path d="M15 12a3 3 0 0 0-3-3H9.5a3.5 3.5 0 0 0 0 7H11" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20l1.3-3.6A7.5 7.5 0 1 1 8.4 19L4 20z" />
      <path d="M9 9.2c.2 1.6 1.1 2.7 2 3.6.9.9 2 1.6 3.4 1.8.5.1.9-.2 1.1-.6l.3-.7-1.8-.9-.6.7c-.9-.4-1.6-1.1-2-2l.7-.6-.9-1.8-.7.3c-.4.2-.7.6-.6 1.1z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.7" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 4h3l1.2 4-2 1.2a11 11 0 0 0 5 5l1.2-2 4 1.2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M4 7l8 5.5L20 7" />
    </svg>
  );
}
