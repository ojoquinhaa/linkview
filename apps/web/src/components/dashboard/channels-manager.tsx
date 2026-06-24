"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  createChannelAction,
  deleteChannelAction,
} from "@/server/link-channels";
import type { LinkChannel } from "@/server/links-query";
import {
  CHANNEL_CATEGORY_ORDER,
  CHANNEL_PRESETS,
  ChannelIcon,
} from "./channel-icons";
import { CopyButton } from "./copy-button";

const slugifySource = (raw: string) =>
  raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function channelUrl(
  domain: string,
  slug: string,
  c: {
    utmSource: string;
    utmMedium: string | null;
    utmCampaign: string | null;
  },
): string {
  const u = new URL(`https://${domain}/${slug}`);
  u.searchParams.set("utm_source", c.utmSource);
  if (c.utmMedium) u.searchParams.set("utm_medium", c.utmMedium);
  if (c.utmCampaign) u.searchParams.set("utm_campaign", c.utmCampaign);
  return u.toString();
}

export function ChannelsManager({
  linkId,
  slug,
  domain,
  channels,
  canEdit,
}: {
  linkId: string;
  slug: string;
  domain: string;
  channels: LinkChannel[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  // When a preset is chosen its `source` becomes a locked prefix; `variant` is
  // the optional per-instance suffix (an influencer handle, a campaign) so two
  // "Influenciador" channels resolve to distinct utm_sources instead of clashing.
  const [prefix, setPrefix] = useState<string | null>(null);
  const [variant, setVariant] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<LinkChannel | null>(null);

  // Preset mode: prefix [+ "-" + slug(variant)]. Free mode: manual source, or a
  // slug of the name until the user edits the source directly.
  const variantSlug = slugifySource(variant);
  const effectiveSource = prefix
    ? variantSlug
      ? `${prefix}-${variantSlug}`
      : prefix
    : source.trim()
      ? slugifySource(source)
      : slugifySource(name);

  const applyPreset = (p: (typeof CHANNEL_PRESETS)[number]) => {
    setPrefix(p.source);
    setVariant("");
    setName(p.name);
    setSource("");
    setMedium(p.medium);
    setAdvanced(false);
    setError(null);
  };

  const clearPreset = () => {
    setPrefix(null);
    setVariant("");
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createChannelAction(linkId, {
        name: name.trim(),
        utmSource: effectiveSource,
        utmMedium: medium.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Não foi possível criar o canal.");
        return;
      }
      setName("");
      setSource("");
      setMedium("");
      setPrefix(null);
      setVariant("");
      setAdvanced(false);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    startTransition(async () => {
      await deleteChannelAction(id);
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-[0.9rem] text-muted">
        Crie uma versão marcada do link para cada lugar onde você divulga. Assim
        você sabe exatamente de onde veio cada clique, sem misturar tudo.
      </p>

      {canEdit && (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-5"
        >
          <p className="text-[0.78rem] font-medium uppercase tracking-wide text-muted">
            Comece por um atalho
          </p>
          <div className="mt-3 flex flex-col gap-3.5">
            {CHANNEL_CATEGORY_ORDER.map((category) => {
              const presets = CHANNEL_PRESETS.filter(
                (p) => p.category === category,
              );
              if (presets.length === 0) return null;
              return (
                <div key={category}>
                  <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-muted/80">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => {
                      const active = prefix === p.source;
                      return (
                        <button
                          key={p.source}
                          type="button"
                          onClick={() => applyPreset(p)}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[0.8rem] font-medium transition-colors ${
                            active
                              ? "border-accent-line bg-accent-weak text-accent-deep"
                              : "border-line bg-paper text-ink-soft hover:border-accent-line hover:bg-accent-weak hover:text-accent-deep"
                          }`}
                        >
                          <ChannelIcon source={p.source} size="sm" />
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[0.76rem] text-muted">
            Em Parcerias e Anúncios, escolha o atalho e troque o nome (ex.: o
            handle do influenciador ou o site do parceiro).
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Nome do canal"
              hint={
                effectiveSource
                  ? `Origem: utm_source=${effectiveSource}`
                  : "Ex.: Stories de junho, Lista VIP, Anúncio"
              }
            >
              {({ id }) => (
                <Input
                  id={id}
                  placeholder="Instagram, WhatsApp, Lista VIP..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  invalid={Boolean(error)}
                  required
                />
              )}
            </Field>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Adicionar canal
            </Button>
          </div>

          {prefix ? (
            <div className="mt-3">
              <Field
                label="Detalhe da origem (opcional)"
                hint={
                  <>
                    utm_source=
                    <span className="font-mono text-ink-soft">
                      {effectiveSource}
                    </span>{" "}
                    · cada detalhe vira um canal separado, sem colidir.
                  </>
                }
              >
                {({ id }) => (
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      prefix={`${prefix}-`}
                      placeholder="nome do influenciador, campanha…"
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={clearPreset}
                      className="shrink-0 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink"
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </Field>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="mt-3 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink"
              >
                {advanced
                  ? "− Menos opções"
                  : "+ Origem e mídia personalizadas"}
              </button>

              {advanced && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Origem (utm_source)">
                    {({ id }) => (
                      <Input
                        id={id}
                        placeholder="instagram"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Mídia (utm_medium)">
                    {({ id }) => (
                      <Input
                        id={id}
                        placeholder="social, email, chat..."
                        value={medium}
                        onChange={(e) => setMedium(e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              )}
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
            >
              {error}
            </p>
          )}
        </form>
      )}

      {channels.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <ChannelIcon source="instagram" />
          <p className="mt-4 font-display text-lg font-semibold text-ink">
            Nenhum canal ainda
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
            Toque num atalho acima. Cada canal vira um link próprio que conta os
            cliques separadamente.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {channels.map((c) => {
            const url = channelUrl(domain, slug, c);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ChannelIcon source={c.utmSource} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-ink">{c.name}</span>
                      <span className="rounded-full bg-paper-sunk px-2 py-0.5 font-mono text-[0.7rem] text-muted">
                        {c.utmSource}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[0.8rem] text-muted">
                      {url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
                    <span className="nums text-[1.05rem] font-semibold leading-none text-ink">
                      {c.clicks.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-wide text-muted sm:mt-1">
                      {c.clicks === 1 ? "clique" : "cliques"}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 sm:ml-3 sm:flex-col sm:items-end sm:gap-0 sm:border-l sm:border-line sm:pl-3 sm:text-right">
                    <span className="nums text-[1.05rem] font-semibold leading-none text-ink">
                      {c.unique.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-wide text-muted sm:mt-1">
                      {c.unique === 1 ? "visitante" : "visitantes"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 sm:ml-3 sm:border-l sm:border-line sm:pl-3">
                    <CopyButton value={url} />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setToDelete(c)}
                        aria-label={`Excluir canal ${c.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-weak hover:text-danger"
                      >
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir canal"
        description="O link marcado para de funcionar. Os cliques já registrados continuam no histórico."
      >
        <p className="text-[0.9rem] text-ink-soft">
          Excluir o canal{" "}
          <span className="font-medium text-ink">{toDelete?.name}</span>?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setToDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            onClick={confirmDelete}
          >
            Excluir canal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
