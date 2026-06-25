"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Support line. Includes the BR country code (55) so wa.me resolves it. */
const WHATSAPP_NUMBER = "5562984348489";
const WHATSAPP_DISPLAY = "+55 62 98434-8489";

const CATEGORIES = [
  { key: "duvida", label: "Dúvida" },
  { key: "problema", label: "Problema técnico" },
  { key: "cobranca", label: "Cobrança" },
  { key: "sugestao", label: "Sugestão" },
  { key: "outro", label: "Outro" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function SupportComposer({
  name,
  email,
  workspaceName,
  planLabel,
}: {
  name: string;
  email: string;
  workspaceName: string;
  planLabel: string;
}) {
  const [category, setCategory] = useState<CategoryKey>("duvida");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const categoryLabel =
    CATEGORIES.find((c) => c.key === category)?.label ?? "Dúvida";

  const ticket = useMemo(() => {
    const head = subject.trim()
      ? `${categoryLabel} — ${subject.trim()}`
      : categoryLabel;
    return [
      "*Suporte linkview*",
      "",
      `*Assunto:* ${head}`,
      "",
      message.trim() || "(descreva aqui)",
      "",
      "———",
      `*Cliente:* ${name || "—"}`,
      `*E-mail:* ${email}`,
      `*Workspace:* ${workspaceName} · *Plano:* ${planLabel}`,
    ].join("\n");
  }, [categoryLabel, subject, message, name, email, workspaceName, planLabel]);

  const canSend = message.trim().length > 0;

  function open() {
    if (!canSend) return;
    const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(ticket)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid min-w-0 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <form
        className="flex min-w-0 max-w-xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[0.82rem] font-medium text-ink-soft">
            Sobre o que é?
          </legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = c.key === category;
              return (
                <label
                  key={c.key}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-[0.85rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)] has-[:focus-visible]:shadow-[0_0_0_3px_var(--ring)]",
                    selected
                      ? "border-accent-line bg-accent-weak text-accent-deep"
                      : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="suporte-categoria"
                    value={c.key}
                    checked={selected}
                    onChange={() => setCategory(c.key)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Assunto"
          hint="Opcional. Um resumo em poucas palavras."
          htmlFor="suporte-assunto"
        >
          {({ id }) => (
            <Input
              id={id}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: meu QR Code não abre"
              maxLength={120}
            />
          )}
        </Field>

        <Field
          label="Mensagem"
          hint="Quanto mais detalhes, mais rápido a gente resolve."
          htmlFor="suporte-mensagem"
        >
          {({ id }) => (
            <Textarea
              id={id}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Conte o que aconteceu, o que você esperava e, se der, o link envolvido."
            />
          )}
        </Field>

        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <Button
            type="submit"
            size="lg"
            disabled={!canSend}
            className="w-full sm:w-auto"
          >
            <WhatsAppGlyph />
            Abrir conversa no WhatsApp
          </Button>
          <p className="text-[0.8rem] text-muted">
            Abre o WhatsApp com sua mensagem pronta. É só revisar e enviar.
          </p>
        </div>
      </form>

      <aside className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 lg:self-start">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-ink">Atendimento</h2>
          <p className="mt-1 text-[0.85rem] text-muted">
            Gente de verdade do outro lado, em português.
          </p>
        </div>
        <dl className="flex flex-col gap-3.5 text-[0.85rem]">
          <InfoRow term="WhatsApp" value={WHATSAPP_DISPLAY} />
          <InfoRow term="Horário" value="Seg a sex, 9h às 18h" />
          <InfoRow term="Resposta" value="Em até 1 dia útil" />
        </dl>
      </aside>
    </div>
  );
}

function InfoRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right font-medium text-ink-soft">{value}</dd>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-[18px]"
    >
      <title>WhatsApp</title>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.13c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.48-.02-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}
