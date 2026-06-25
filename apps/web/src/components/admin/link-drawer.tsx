"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  type ActionResult,
  adminDeleteLinkAction,
  adminSetLinkActiveAction,
  getAdminLinkDetailAction,
} from "@/server/admin/link-actions";
import type { AdminLinkDetail, AdminLinkRow } from "@/server/admin/links";
import {
  IconAccount,
  IconAudit,
  IconBan,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCursor,
  IconGlobe,
  IconLayers,
  IconLink,
  type IconProps,
  IconShield,
  IconWorkspace,
  IconX,
} from "./icons";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtDateTime = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const fmtDate = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function auditLabel(action: string): string {
  const map: Record<string, string> = {
    "link.created": "Link criado",
    "link.updated": "Link atualizado",
    "link.activated": "Link ativado",
    "link.paused": "Link pausado",
    "link.qr_created": "QR Code criado",
    "admin.link.activated": "Ativado pelo suporte",
    "admin.link.paused": "Pausado pelo suporte",
    "admin.link.deleted": "Excluído pelo suporte",
  };
  return (
    map[action] ??
    action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function LinkDrawer({
  link,
  hostname,
  onClose,
}: {
  link: AdminLinkRow | null;
  hostname: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminLinkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const open = link != null;
  const linkId = link?.linkId ?? null;

  useEffect(() => {
    if (!linkId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setMsg(null);
    getAdminLinkDetailAction(linkId)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch(() => {
        if (alive) setMsg({ kind: "err", text: "Falha ao carregar detalhes." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [linkId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const run = (
    fn: () => Promise<ActionResult>,
    okText: string,
    confirmText?: string,
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Falha na ação." });
        return;
      }
      setMsg({ kind: "ok", text: okText });
      if (linkId) setDetail(await getAdminLinkDetailAction(linkId));
      router.refresh();
    });
  };

  const shortUrl = link ? `https://${hostname}/${link.slug}` : "";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink/30 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gerenciar link"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex h-[92vh] w-full max-w-4xl flex-col rounded-t-3xl border border-line bg-paper shadow-[0_-10px_50px_oklch(0.2_0.02_262/0.25)] transition-transform duration-300 ease-[var(--ease-out-quint)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Grip */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent-line bg-accent-weak text-accent-deep">
              <IconLink className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-mono text-[1.05rem] font-semibold tracking-[-0.01em] text-ink">
                {hostname}/{link?.slug}
              </h2>
              <p className="truncate text-[0.85rem] text-muted">
                {link?.workspaceName} · {link?.ownerEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-soft flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading || !detail ? (
            <DrawerSkeleton loading={loading} />
          ) : (
            <div className="flex flex-col gap-5">
              {msg && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-[var(--radius-input)] border px-3 py-2 text-[0.83rem]",
                    msg.kind === "ok"
                      ? "border-accent-line bg-accent-weak text-accent-deep"
                      : "border-danger/30 bg-surface text-danger",
                  )}
                >
                  {msg.kind === "ok" ? (
                    <IconCheck className="size-4" />
                  ) : (
                    <IconBan className="size-4" />
                  )}
                  {msg.text}
                </div>
              )}

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={detail.isActive ? "accent" : "danger"}>
                  {detail.isActive ? "Ativo" : "Pausado"}
                </Badge>
                {detail.expiresAt &&
                  new Date(detail.expiresAt).getTime() < Date.now() && (
                    <Badge tone="muted">Expirado</Badge>
                  )}
                {detail.passwordProtected && (
                  <Badge tone="muted">
                    <IconShield className="size-3.5" /> Com senha
                  </Badge>
                )}
                <Badge tone="muted">
                  {PLAN_LABELS[detail.planKey] ?? detail.planKey}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  Icon={IconCursor}
                  label="Cliques"
                  value={fmtNum(detail.clicks)}
                />
                <Stat
                  Icon={IconClock}
                  label="Último clique"
                  value={fmtDate(detail.lastClickedAt)}
                />
                <Stat
                  Icon={IconCalendar}
                  label="Criado"
                  value={fmtDate(detail.createdAt)}
                />
              </div>

              {/* Destination */}
              <Card title="Destino" Icon={IconGlobe}>
                <a
                  href={detail.destinationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all font-mono text-[0.82rem] text-accent-deep hover:underline"
                >
                  {detail.destinationUrl}
                </a>
                <p className="mt-2 break-all text-[0.78rem] text-muted">
                  Curto:{" "}
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-ink-soft hover:underline"
                  >
                    {shortUrl}
                  </a>
                </p>
              </Card>

              {/* Owner / workspace */}
              <Card title="Dono" Icon={IconAccount}>
                <InfoGrid>
                  <Info
                    Icon={IconAccount}
                    label="Nome"
                    value={detail.ownerName}
                  />
                  <Info
                    Icon={IconLink}
                    label="E-mail"
                    value={detail.ownerEmail}
                  />
                  <Info
                    Icon={IconWorkspace}
                    label="Workspace"
                    value={detail.workspaceName}
                  />
                  <Info
                    Icon={IconLayers}
                    label="Plano"
                    value={PLAN_LABELS[detail.planKey] ?? detail.planKey}
                  />
                  <Info
                    Icon={IconCalendar}
                    label="Expira em"
                    value={fmtDate(detail.expiresAt)}
                  />
                </InfoGrid>
              </Card>

              {/* Security */}
              <Card title="Segurança e regras" Icon={IconShield}>
                <InfoGrid>
                  <Info
                    Icon={IconShield}
                    label="Senha"
                    value={detail.passwordProtected ? "Sim" : "Não"}
                  />
                  <Info
                    Icon={IconBan}
                    label="Bloqueia bots"
                    value={detail.blockBots ? "Sim" : "Não"}
                  />
                  <Info
                    Icon={IconClock}
                    label="Limite/min"
                    value={
                      detail.rateLimitPerMinute
                        ? String(detail.rateLimitPerMinute)
                        : "—"
                    }
                  />
                  <Info
                    Icon={IconGlobe}
                    label="Países liberados"
                    value={
                      detail.allowedCountries.length
                        ? detail.allowedCountries.join(", ")
                        : "—"
                    }
                  />
                  <Info
                    Icon={IconGlobe}
                    label="Países bloqueados"
                    value={
                      detail.blockedCountries.length
                        ? detail.blockedCountries.join(", ")
                        : "—"
                    }
                  />
                </InfoGrid>
              </Card>

              {/* Actions */}
              <section className="flex flex-col gap-2.5">
                <ControlRow
                  Icon={detail.isActive ? IconBan : IconCheck}
                  tone={detail.isActive ? "danger" : "default"}
                  title="Status do redirecionamento"
                  desc={
                    detail.isActive
                      ? "Pausar faz o link parar de redirecionar na hora (mostra página de link desativado)."
                      : "Pausado. Reative para o link voltar a redirecionar."
                  }
                >
                  {detail.isActive ? (
                    <RowButton
                      tone="danger"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => adminSetLinkActiveAction(detail.linkId, false),
                          "Link pausado.",
                          "Pausar este link? Ele para de redirecionar imediatamente.",
                        )
                      }
                    >
                      <IconBan className="size-4" /> Pausar
                    </RowButton>
                  ) : (
                    <RowButton
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => adminSetLinkActiveAction(detail.linkId, true),
                          "Link reativado.",
                        )
                      }
                    >
                      <IconCheck className="size-4" /> Reativar
                    </RowButton>
                  )}
                </ControlRow>

                <ControlRow
                  Icon={IconBan}
                  tone="danger"
                  title="Excluir link"
                  desc="Soft-delete: o link sai da lista do cliente e para de funcionar. As métricas já coletadas permanecem."
                >
                  <RowButton
                    tone="danger"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => adminDeleteLinkAction(detail.linkId),
                        "Link excluído.",
                        "Excluir (soft-delete) este link? Ele para de funcionar para o cliente.",
                      )
                    }
                  >
                    <IconBan className="size-4" /> Excluir
                  </RowButton>
                </ControlRow>
              </section>

              {/* Audit */}
              <Card title="Histórico" Icon={IconAudit}>
                {detail.audit.length === 0 ? (
                  <Empty Icon={IconAudit}>Sem eventos registrados.</Empty>
                ) : (
                  <ol className="flex flex-col">
                    {detail.audit.map((a, i) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: static audit timeline, never reordered
                        key={`${a.action}-${i}`}
                        className="flex gap-3.5"
                      >
                        <div className="flex flex-col items-center">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-soft">
                            <IconAudit className="size-3.5" />
                          </span>
                          {i < detail.audit.length - 1 && (
                            <span className="w-px flex-1 bg-line" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pb-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="font-medium text-ink">
                              {auditLabel(a.action)}
                            </p>
                            <time className="shrink-0 text-[0.76rem] text-muted">
                              {fmtDateTime(a.createdAt)}
                            </time>
                          </div>
                          <p className="mt-0.5 font-mono text-[0.72rem] text-muted">
                            {a.action}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared primitives ---------- */

function Card({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: (p: IconProps) => React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-[0.8rem] font-semibold text-ink">
        <Icon className="size-[17px] text-muted" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}

function Info({
  Icon,
  label,
  value,
}: {
  Icon: (p: IconProps) => React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-[0.72rem] text-muted">{label}</dt>
        <dd className="truncate text-[0.88rem] font-medium text-ink">
          {value}
        </dd>
      </div>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
}: {
  Icon: (p: IconProps) => React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="size-4" />
        <span className="text-[0.72rem] uppercase tracking-wide">{label}</span>
      </div>
      <p className="nums mt-1.5 text-[1.4rem] font-semibold tracking-[-0.01em] text-ink">
        {value}
      </p>
    </div>
  );
}

function ControlRow({
  Icon,
  title,
  desc,
  tone,
  children,
}: {
  Icon: (p: IconProps) => React.ReactElement;
  title: string;
  desc: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl border",
          tone === "danger"
            ? "border-danger/25 bg-danger/5 text-danger"
            : "border-line bg-paper-sunk text-ink-soft",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.88rem] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[0.78rem] leading-snug text-muted">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border px-3 text-[0.82rem] font-medium transition-colors disabled:opacity-50",
        tone === "danger"
          ? "border-danger/30 text-danger hover:bg-danger/5"
          : "border-line text-ink-soft hover:bg-paper-sunk hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "accent" | "danger" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] font-medium",
        tone === "accent"
          ? "border-accent-line bg-accent-weak text-accent-deep"
          : tone === "danger"
            ? "border-danger/30 bg-danger/5 text-danger"
            : "border-line bg-paper-sunk text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Empty({
  Icon,
  children,
}: {
  Icon: (p: IconProps) => React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-input)] border border-dashed border-line bg-surface px-4 py-8 text-center">
      <Icon className="size-5 text-line-strong" />
      <p className="text-[0.82rem] text-muted">{children}</p>
    </div>
  );
}

function DrawerSkeleton({ loading }: { loading: boolean }) {
  if (!loading) {
    return (
      <p className="py-10 text-center text-[0.88rem] text-muted">Sem dados.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="h-6 w-20 animate-pulse rounded-full bg-paper-sunk" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-paper-sunk" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-paper-sunk"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-paper-sunk" />
    </div>
  );
}
