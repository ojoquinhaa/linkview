"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/dashboard/copy-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { BIO_THEMES, getBioTheme } from "@/lib/bio-themes";
import {
  addBioLink,
  deleteBioLink,
  deleteBioPage,
  reorderBioLinks,
  updateBioLink,
  updateBioPageMeta,
} from "@/server/bio-pages";
import type { BioLink, BioPageDetail } from "@/server/bio-pages-query";

interface LinkOption {
  label: string;
  shortUrl: string;
  totalClicks: number;
}

export function BioEditor({
  page,
  publicUrl,
  linkOptions,
  canEdit,
  canDelete,
}: {
  page: BioPageDetail;
  publicUrl: string;
  linkOptions: LinkOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(page.title ?? "");
  const [description, setDescription] = useState(page.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(page.avatarUrl ?? "");
  const [theme, setTheme] = useState(page.theme);
  const [isActive, setIsActive] = useState(page.isActive);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Algo deu errado.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-5 sm:px-8">
        <div className="min-w-0">
          <a
            href="/dashboard/paginas"
            className="text-[0.82rem] font-medium text-muted hover:text-ink"
          >
            ← Páginas
          </a>
          <h1 className="mt-1 truncate font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
            {title || page.slug}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton value={publicUrl} label="Copiar link" />
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-[var(--radius-input)] border border-line-strong bg-surface px-3 text-[0.85rem] font-medium text-ink transition-colors hover:bg-paper-sunk"
          >
            Abrir
          </a>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger sm:mx-8">
          {error}
        </div>
      )}

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {/* Page identity */}
          <Section title="Aparência">
            <div className="flex flex-col gap-4">
              <Field label="Nome">
                {({ id }) => (
                  <Input
                    id={id}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Loja do João"
                  />
                )}
              </Field>
              <Field label="Descrição">
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Uma frase sobre você ou seu negócio."
                  />
                )}
              </Field>
              <Field label="Foto (URL da imagem)" hint="Opcional.">
                {({ id }) => (
                  <Input
                    id={id}
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    disabled={!canEdit}
                    placeholder="https://…"
                  />
                )}
              </Field>

              <div>
                <p className="mb-2 text-[0.82rem] font-medium text-ink-soft">
                  Tema
                </p>
                <div className="flex flex-wrap gap-2">
                  {BIO_THEMES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setTheme(t.key)}
                      aria-pressed={theme === t.key}
                      title={t.name}
                      className={`h-9 w-9 rounded-full border-2 transition-[transform,border-color] ${
                        theme === t.key
                          ? "border-accent"
                          : "border-line hover:border-line-strong"
                      }`}
                      style={{ background: t.background }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] border border-line bg-surface px-3.5 py-2.5">
                <span className="text-[0.88rem] text-ink">
                  Página publicada
                  <span className="block text-[0.78rem] text-muted">
                    Quando desligada, o link mostra “não encontrada”.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={!canEdit}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-5 accent-[var(--accent)]"
                />
              </label>

              {canEdit && (
                <Button
                  type="button"
                  loading={pending}
                  onClick={() =>
                    run(() =>
                      updateBioPageMeta(page.id, {
                        title,
                        description,
                        avatarUrl,
                        theme,
                        isActive,
                      }),
                    )
                  }
                  className="self-start"
                >
                  Salvar aparência
                </Button>
              )}
            </div>
          </Section>

          {/* Links */}
          <Section
            title="Links"
            meta={`${page.links.length} ${page.links.length === 1 ? "botão" : "botões"}`}
          >
            <div className="flex flex-col gap-2.5">
              {page.links.length === 0 && (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[0.85rem] text-muted">
                  Adicione seu primeiro botão abaixo.
                </p>
              )}
              {page.links.map((link, i) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  index={i}
                  total={page.links.length}
                  canEdit={canEdit}
                  pending={pending}
                  onSave={(label, url, active) =>
                    run(() =>
                      updateBioLink(link.id, { label, url, isActive: active }),
                    )
                  }
                  onDelete={() => run(() => deleteBioLink(link.id))}
                  onMove={(dir) => {
                    const ids = page.links.map((l) => l.id);
                    const j = dir === "up" ? i - 1 : i + 1;
                    if (j < 0 || j >= ids.length) return;
                    const a = ids[i];
                    const b = ids[j];
                    if (a === undefined || b === undefined) return;
                    ids[i] = b;
                    ids[j] = a;
                    run(() => reorderBioLinks(page.id, ids));
                  }}
                />
              ))}
            </div>

            {canEdit && (
              <AddLink
                linkOptions={linkOptions}
                pending={pending}
                onAdd={(label, url) =>
                  run(() => addBioLink(page.id, { label, url }))
                }
              />
            )}
          </Section>

          {canDelete && (
            <Section title="Zona de perigo">
              <Button
                type="button"
                variant="danger"
                loading={pending}
                onClick={() => {
                  if (!confirm("Excluir esta página? Não dá para desfazer."))
                    return;
                  start(async () => {
                    const res = await deleteBioPage(page.id);
                    if (res.ok) router.push("/dashboard/paginas");
                    else setError(res.error ?? "Falha ao excluir.");
                  });
                }}
              >
                Excluir página
              </Button>
            </Section>
          )}
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[0.82rem] font-medium text-ink-soft">
            Pré-visualização
          </p>
          <Preview
            theme={theme}
            title={title || page.slug}
            description={description}
            avatarUrl={avatarUrl}
            links={page.links}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[1rem] font-semibold text-ink">
          {title}
        </h2>
        {meta && <span className="text-[0.78rem] text-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function LinkRow({
  link,
  index,
  total,
  canEdit,
  pending,
  onSave,
  onDelete,
  onMove,
}: {
  link: BioLink;
  index: number;
  total: number;
  canEdit: boolean;
  pending: boolean;
  onSave: (label: string, url: string, active: boolean) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-accent-line bg-paper p-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome do botão"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            loading={pending}
            onClick={() => {
              onSave(label, url, link.isActive);
              setEditing(false);
            }}
          >
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setLabel(link.label);
              setUrl(link.url);
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 ${
        link.isActive ? "" : "opacity-55"
      }`}
    >
      {canEdit && (
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Mover para cima"
            disabled={index === 0 || pending}
            onClick={() => onMove("up")}
            className="text-muted hover:text-ink disabled:opacity-30"
          >
            ▴
          </button>
          <button
            type="button"
            aria-label="Mover para baixo"
            disabled={index === total - 1 || pending}
            onClick={() => onMove("down")}
            className="text-muted hover:text-ink disabled:opacity-30"
          >
            ▾
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.88rem] font-medium text-ink">
          {link.label}
        </p>
        <p className="truncate text-[0.78rem] text-muted">{link.url}</p>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={link.isActive ? "Desativar" : "Ativar"}
            disabled={pending}
            onClick={() => onSave(link.label, link.url, !link.isActive)}
            className="rounded-md px-2 py-1 text-[0.76rem] text-muted hover:bg-paper-sunk hover:text-ink"
          >
            {link.isActive ? "Ativo" : "Inativo"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-[0.76rem] text-muted hover:bg-paper-sunk hover:text-ink"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-md px-2 py-1 text-[0.76rem] text-danger hover:bg-danger-weak"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function AddLink({
  linkOptions,
  pending,
  onAdd,
}: {
  linkOptions: LinkOption[];
  pending: boolean;
  onAdd: (label: string, url: string) => void;
}) {
  const [mode, setMode] = useState<"tracked" | "manual">("tracked");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  return (
    <div className="mt-4 rounded-xl border border-dashed border-line-strong p-3.5">
      <div className="mb-3 flex gap-1 rounded-lg bg-paper-sunk p-1">
        <TabBtn active={mode === "tracked"} onClick={() => setMode("tracked")}>
          Meus links
        </TabBtn>
        <TabBtn active={mode === "manual"} onClick={() => setMode("manual")}>
          Outro link
        </TabBtn>
      </div>

      {mode === "tracked" ? (
        linkOptions.length === 0 ? (
          <p className="px-1 py-2 text-[0.82rem] text-muted">
            Você ainda não tem links. Crie um em “Links” para adicioná-lo aqui.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkOptions.map((opt) => (
              <button
                key={opt.shortUrl}
                type="button"
                disabled={pending}
                onClick={() => onAdd(opt.label, opt.shortUrl)}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.85rem] font-medium text-ink">
                    {opt.label}
                  </span>
                  <span className="block truncate text-[0.76rem] text-muted">
                    {opt.shortUrl}
                  </span>
                </span>
                <span className="shrink-0 text-[0.78rem] font-medium text-accent">
                  Adicionar
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome do botão (ex: Instagram)"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          <Button
            type="button"
            size="sm"
            loading={pending}
            onClick={() => {
              onAdd(label, url);
              setLabel("");
              setUrl("");
            }}
            className="self-start"
          >
            Adicionar botão
          </Button>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-[0.82rem] font-medium transition-colors ${
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Preview({
  theme,
  title,
  description,
  avatarUrl,
  links,
}: {
  theme: string;
  title: string;
  description: string;
  avatarUrl: string;
  links: BioLink[];
}) {
  const t = getBioTheme(theme);
  const active = links.filter((l) => l.isActive);
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div
        style={{ background: t.background, color: t.text }}
        className="flex flex-col items-center px-5 py-8"
      >
        <div
          style={{
            background: t.button,
            border: `1px solid ${t.buttonBorder}`,
          }}
          className="grid size-16 place-items-center overflow-hidden rounded-full text-xl font-bold"
        >
          {avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: arbitrary preview URL
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            (title.trim()[0]?.toUpperCase() ?? "•")
          )}
        </div>
        <p className="mt-3 text-center text-[0.95rem] font-bold">{title}</p>
        {description && (
          <p
            style={{ color: t.muted }}
            className="mt-1 text-center text-[0.8rem] leading-snug"
          >
            {description}
          </p>
        )}
        <div className="mt-5 flex w-full flex-col gap-2.5">
          {active.length === 0 ? (
            <p
              style={{ color: t.muted }}
              className="text-center text-[0.78rem]"
            >
              Seus botões aparecem aqui.
            </p>
          ) : (
            active.map((l) => (
              <div
                key={l.id}
                style={{
                  background: t.button,
                  color: t.buttonText,
                  border: `1px solid ${t.buttonBorder}`,
                }}
                className="truncate rounded-xl px-4 py-3 text-center text-[0.85rem] font-semibold"
              >
                {l.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
