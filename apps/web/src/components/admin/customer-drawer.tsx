"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  type ActionResult,
  type AuditRow,
  type CustomerDetail,
  getCustomerDetailAction,
  setPlatformRoleAction,
  setUserStatusAction,
  setWorkspaceArchivedAction,
  setWorkspacePlanAction,
} from "@/server/admin/actions";
import type { CustomerRow } from "@/server/admin/customers";
import {
  IconAccount,
  IconArchive,
  IconAudit,
  IconBadgeCheck,
  IconBan,
  IconBilling,
  IconCalendar,
  IconCheck,
  IconConsent,
  IconCpu,
  IconCrown,
  IconCursor,
  IconIdCard,
  IconLayers,
  IconLink,
  IconOverview,
  IconPhone,
  IconPin,
  type IconProps,
  IconReceipt,
  IconRestore,
  IconSearch,
  IconShield,
  IconWorkspace,
  IconX,
} from "./icons";

const PLAN_OPTIONS = [
  { key: "free", label: "Grátis" },
  { key: "starter", label: "Starter" },
  { key: "pro", label: "Pro" },
  { key: "business", label: "Business" },
];

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
const fmtDoc = (digits: string) =>
  digits.length === 11
    ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : digits.length === 14
      ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      : digits;

const statusPt = (s: string) =>
  (
    ({
      active: "Ativo",
      suspended: "Suspenso",
      deleted: "Excluído",
      trialing: "Em trial",
      past_due: "Atrasada",
      unpaid: "Não paga",
      canceled: "Cancelada",
      expired: "Expirada",
      pending: "Pendente",
    }) as Record<string, string>
  )[s] ?? s;
const planPt = (k: string) =>
  (
    ({
      free: "Grátis",
      trial: "Trial",
      starter: "Starter",
      pro: "Pro",
      business: "Business",
    }) as Record<string, string>
  )[k] ?? k;
const payStatePt = (s: string) =>
  (
    ({
      paid: "Pago",
      pending: "Pendente",
      overdue: "Atrasado",
      refunded: "Reembolsado",
    }) as Record<string, string>
  )[s] ?? s;
const consentPt = (t: string) =>
  (
    ({
      terms: "Termos",
      privacy: "Privacidade",
      marketing: "Marketing",
    }) as Record<string, string>
  )[t] ?? t;

type Tab = "overview" | "billing" | "account" | "audit";
const TABS: {
  id: Tab;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
}[] = [
  { id: "overview", label: "Visão geral", Icon: IconOverview },
  { id: "billing", label: "Cobrança", Icon: IconBilling },
  { id: "account", label: "Conta e acesso", Icon: IconAccount },
  { id: "audit", label: "Auditoria", Icon: IconAudit },
];

export function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const open = customer != null;
  const workspaceId = customer?.workspaceId ?? null;

  useEffect(() => {
    if (!workspaceId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setMsg(null);
    setTab("overview");
    getCustomerDetailAction(workspaceId)
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
  }, [workspaceId]);

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

  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Falha na ação." });
        return;
      }
      setMsg({ kind: "ok", text: "Alteração aplicada." });
      if (workspaceId) setDetail(await getCustomerDetailAction(workspaceId));
      router.refresh();
    });
  };

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
        aria-label="Gerenciar cliente"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex h-[92vh] w-full max-w-5xl flex-col rounded-t-3xl border border-line bg-paper shadow-[0_-10px_50px_oklch(0.2_0.02_262/0.25)] transition-transform duration-300 ease-[var(--ease-out-quint)]",
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
              <IconWorkspace className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-[1.3rem] font-semibold tracking-[-0.01em] text-ink">
                {customer?.name ?? ""}
              </h2>
              <p className="truncate text-[0.85rem] text-muted">
                {customer?.ownerEmail}
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

        {/* Tabs */}
        <div className="border-b border-line px-3 sm:px-5">
          <div
            role="tablist"
            aria-label="Seções do cliente"
            className="flex gap-1 overflow-x-auto"
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-[0.86rem] font-medium transition-colors",
                    active ? "text-accent-deep" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon
                    className={cn("size-[17px]", active && "text-accent")}
                  />
                  {label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
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

              {tab === "overview" && (
                <OverviewTab detail={detail} customer={customer} />
              )}
              {tab === "billing" && (
                <BillingTab detail={detail} pending={pending} run={run} />
              )}
              {tab === "account" && (
                <AccountTab detail={detail} pending={pending} run={run} />
              )}
              {tab === "audit" && <AuditTab rows={detail.audit} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Overview ---------- */

function OverviewTab({
  detail,
  customer,
}: {
  detail: CustomerDetail;
  customer: CustomerRow | null;
}) {
  const o = detail.owner;
  const w = detail.workspace;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={o.status === "active" ? "ok" : "danger"}>
          {statusPt(o.status)}
        </Badge>
        {o.role === "admin" && (
          <Badge tone="accent">
            <IconCrown className="size-3.5" /> Admin
          </Badge>
        )}
        {o.emailVerified ? (
          <Badge tone="ok">
            <IconBadgeCheck className="size-3.5" /> E-mail verificado
          </Badge>
        ) : (
          <Badge tone="muted">E-mail não verificado</Badge>
        )}
        <Badge tone="muted">{planPt(w.planKey)}</Badge>
        {w.archived && <Badge tone="danger">Arquivado</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          Icon={IconLink}
          label="Links"
          value={fmtNum(customer?.links ?? 0)}
        />
        <Stat
          Icon={IconCursor}
          label="Redirecionamentos"
          value={fmtNum(customer?.clicks ?? 0)}
        />
        <Stat
          Icon={IconReceipt}
          label="Mensalidade"
          value={
            customer?.planPriceCents && customer.planPriceCents > 0
              ? fmtBRL(customer.planPriceCents)
              : "—"
          }
        />
      </div>

      <Card title="Conta" Icon={IconAccount}>
        <InfoGrid>
          <Info Icon={IconAccount} label="Dono" value={o.name} />
          <Info Icon={IconCrown} label="E-mail" value={o.email} />
          <Info
            Icon={IconShield}
            label="Papel"
            value={o.role === "admin" ? "Administrador" : "Usuário"}
          />
          <Info
            Icon={IconCalendar}
            label="Cadastro"
            value={fmtDate(o.createdAt)}
          />
        </InfoGrid>
      </Card>

      <Card title="Workspace" Icon={IconWorkspace}>
        <InfoGrid>
          <Info Icon={IconWorkspace} label="Nome" value={w.name} />
          <Info Icon={IconLink} label="Slug" value={`/${w.slug}`} mono />
          <Info Icon={IconLayers} label="Plano" value={planPt(w.planKey)} />
          <Info
            Icon={IconCalendar}
            label="Criado"
            value={fmtDate(w.createdAt)}
          />
        </InfoGrid>
      </Card>
    </div>
  );
}

/* ---------- Billing ---------- */

function BillingTab({
  detail,
  pending,
  run,
}: {
  detail: CustomerDetail;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, confirm?: string) => void;
}) {
  const w = detail.workspace;
  const sub = detail.subscription;
  return (
    <div className="flex flex-col gap-5">
      <ControlRow
        Icon={IconLayers}
        title="Plano (override manual)"
        desc="Concede o plano sem passar pelo provedor. Pago cria assinatura manual ativa; Grátis cancela."
      >
        <select
          value={w.planKey}
          disabled={pending}
          onChange={(e) =>
            run(() => setWorkspacePlanAction(w.id, e.target.value))
          }
          className="h-9 w-40 rounded-[var(--radius-input)] border border-line bg-surface px-2.5 text-[0.85rem] font-medium text-ink transition-colors focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </ControlRow>

      <Card title="Assinatura" Icon={IconBilling}>
        <InfoGrid>
          <Info
            Icon={IconBadgeCheck}
            label="Status"
            value={sub ? statusPt(sub.status) : "Sem assinatura"}
          />
          <Info Icon={IconCpu} label="Provedor" value={sub?.provider ?? "—"} />
          <Info
            Icon={IconCalendar}
            label="Período até"
            value={fmtDate(sub?.currentPeriodEnd ?? null)}
          />
        </InfoGrid>
      </Card>

      <Card title="Pagamentos" Icon={IconReceipt}>
        {detail.paymentsUnavailable ? (
          <Empty Icon={IconReceipt}>
            Provedor de pagamento indisponível agora.
          </Empty>
        ) : detail.payments.length === 0 ? (
          <Empty Icon={IconReceipt}>Nenhum pagamento registrado.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {detail.payments.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2.5 text-[0.83rem]"
              >
                <span className="flex items-center gap-2.5 text-ink-soft">
                  <PayDot state={p.state} />
                  {fmtDateTime(p.date)}
                  <span className="text-muted">· {payStatePt(p.state)}</span>
                </span>
                <span className="nums font-semibold text-ink">
                  {fmtBRL(p.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Account ---------- */

function AccountTab({
  detail,
  pending,
  run,
}: {
  detail: CustomerDetail;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, confirm?: string) => void;
}) {
  const o = detail.owner;
  const w = detail.workspace;
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2.5">
        <SectionLabel>Ações</SectionLabel>

        <ControlRow
          Icon={o.status === "suspended" ? IconCheck : IconBan}
          tone={o.status === "suspended" ? "default" : "danger"}
          title="Conta do usuário"
          desc={
            o.status === "suspended"
              ? "Conta suspensa. Reative para liberar o acesso."
              : "Suspender encerra todas as sessões ativas do usuário."
          }
        >
          {o.status === "suspended" ? (
            <RowButton
              disabled={pending}
              onClick={() => run(() => setUserStatusAction(o.id, "active"))}
            >
              <IconCheck className="size-4" /> Reativar
            </RowButton>
          ) : (
            <RowButton
              tone="danger"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserStatusAction(o.id, "suspended"),
                  "Suspender este usuário encerra todas as sessões dele. Continuar?",
                )
              }
            >
              <IconBan className="size-4" /> Suspender
            </RowButton>
          )}
        </ControlRow>

        <ControlRow
          Icon={o.role === "admin" ? IconCrown : IconShield}
          tone={o.role === "admin" ? "accent" : "default"}
          title="Acesso de plataforma"
          desc={
            o.role === "admin"
              ? "Tem acesso ao console administrativo."
              : "Promova a admin para liberar o console."
          }
        >
          {o.role === "admin" ? (
            <RowButton
              disabled={pending}
              onClick={() =>
                run(
                  () => setPlatformRoleAction(o.id, "user"),
                  "Remover acesso admin deste usuário?",
                )
              }
            >
              Remover admin
            </RowButton>
          ) : (
            <RowButton
              disabled={pending}
              onClick={() =>
                run(
                  () => setPlatformRoleAction(o.id, "admin"),
                  "Tornar este usuário admin da plataforma?",
                )
              }
            >
              <IconShield className="size-4" /> Tornar admin
            </RowButton>
          )}
        </ControlRow>

        <ControlRow
          Icon={w.archived ? IconRestore : IconArchive}
          tone={w.archived ? "default" : "danger"}
          title="Workspace"
          desc={
            w.archived
              ? "Arquivado. Restaure para reativar o acesso aos dados."
              : "Arquivar faz soft-delete e envia os dados para a fila de retenção."
          }
        >
          {w.archived ? (
            <RowButton
              disabled={pending}
              onClick={() => run(() => setWorkspaceArchivedAction(w.id, false))}
            >
              <IconRestore className="size-4" /> Restaurar
            </RowButton>
          ) : (
            <RowButton
              tone="danger"
              disabled={pending}
              onClick={() =>
                run(
                  () => setWorkspaceArchivedAction(w.id, true),
                  "Arquivar (soft-delete) este workspace? Os dados entram na fila de retenção/purga.",
                )
              }
            >
              <IconArchive className="size-4" /> Arquivar
            </RowButton>
          )}
        </ControlRow>
      </section>

      <Card title="Dados fiscais (LGPD)" Icon={IconIdCard}>
        {detail.fiscal ? (
          <InfoGrid>
            <Info
              Icon={IconAccount}
              label="Tipo"
              value={detail.fiscal.personType === "pj" ? "Jurídica" : "Física"}
            />
            <Info
              Icon={IconIdCard}
              label={detail.fiscal.personType === "pj" ? "CNPJ" : "CPF"}
              value={fmtDoc(detail.fiscal.document)}
              mono
            />
            <Info
              Icon={IconPhone}
              label="Telefone"
              value={detail.fiscal.phone}
            />
            <Info
              Icon={IconPin}
              label="Cidade/UF"
              value={`${detail.fiscal.city}/${detail.fiscal.state}`}
            />
            <Info
              Icon={IconCpu}
              label="IP de cadastro"
              value={detail.fiscal.signupIp ?? "—"}
              mono
            />
          </InfoGrid>
        ) : (
          <Empty Icon={IconIdCard}>Sem cadastro fiscal registrado.</Empty>
        )}
      </Card>

      <Card title="Consentimentos" Icon={IconConsent}>
        {detail.consents.length === 0 ? (
          <Empty Icon={IconConsent}>Sem registros de consentimento.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {detail.consents.map((c, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: static consent ledger, never reordered
                key={`${c.type}-${i}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2.5 text-[0.83rem]"
              >
                <span className="flex items-center gap-2 text-ink-soft">
                  <IconConsent className="size-4 text-muted" />
                  {consentPt(c.type)}
                  <span className="text-muted">v{c.documentVersion}</span>
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <Badge tone={c.accepted ? "ok" : "muted"}>
                    {c.accepted ? "Aceito" : "Recusado"}
                  </Badge>
                  {fmtDate(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Audit ---------- */

const AUDIT_LABELS: Record<string, string> = {
  "admin.user.status_changed": "Status da conta alterado",
  "admin.user.role_changed": "Papel de plataforma alterado",
  "admin.workspace.plan_changed": "Plano alterado",
  "admin.workspace.archived": "Workspace arquivado",
  "admin.workspace.restored": "Workspace restaurado",
  "workspace.renamed": "Workspace renomeado",
};

type AuditCat = "Conta" | "Workspace" | "Cobrança" | "Conteúdo" | "Sistema";
const AUDIT_CATS: {
  id: AuditCat | "Todas";
  Icon: (p: IconProps) => React.ReactElement;
}[] = [
  { id: "Todas", Icon: IconAudit },
  { id: "Conta", Icon: IconAccount },
  { id: "Workspace", Icon: IconWorkspace },
  { id: "Cobrança", Icon: IconBilling },
  { id: "Conteúdo", Icon: IconLink },
  { id: "Sistema", Icon: IconCpu },
];

function auditCategory(action: string): AuditCat {
  if (/plan|billing|payment|subscription/.test(action)) return "Cobrança";
  if (action.includes("workspace")) return "Workspace";
  if (action.includes("user") || action.startsWith("account")) return "Conta";
  if (/^(link|qr|campaign|domain|page)/.test(action)) return "Conteúdo";
  return "Sistema";
}
const CAT_ICON: Record<AuditCat, (p: IconProps) => React.ReactElement> = {
  Conta: IconAccount,
  Workspace: IconWorkspace,
  Cobrança: IconBilling,
  Conteúdo: IconLink,
  Sistema: IconCpu,
};
function auditLabel(action: string): string {
  return (
    AUDIT_LABELS[action] ??
    action
      .replace(/^admin\./, "")
      .replace(/[._]/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}
function metaChips(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  return Object.entries(meta as Record<string, unknown>).map(([k, v]) => {
    let val = String(v);
    if (k === "status") val = statusPt(val);
    else if (k === "planKey") val = planPt(val);
    else if (k === "role") val = val === "admin" ? "Admin" : "Usuário";
    const key = k === "planKey" ? "plano" : k === "role" ? "papel" : k;
    return `${key}: ${val}`;
  });
}

function AuditTab({ rows }: { rows: AuditRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AuditCat | "Todas">("Todas");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const c = auditCategory(r.action);
      if (cat !== "Todas" && c !== cat) return false;
      if (!needle) return true;
      return (
        auditLabel(r.action).toLowerCase().includes(needle) ||
        r.action.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, cat]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 bg-paper/90 px-1 pb-1 pt-0.5 backdrop-blur-sm">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <IconSearch className="size-[17px]" />
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar evento por nome ou código"
            className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface pr-9 pl-10 text-[0.85rem] text-ink placeholder:text-muted transition-colors focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpar busca"
              className="absolute inset-y-0 right-2.5 my-auto inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-paper-sunk hover:text-ink"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {AUDIT_CATS.map(({ id, Icon }) => {
            const active = cat === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCat(id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-colors",
                  active
                    ? "border-accent-line bg-accent-weak text-accent-deep"
                    : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty Icon={IconAudit}>
          {rows.length === 0
            ? "Nenhum evento registrado para este workspace."
            : "Nenhum evento corresponde aos filtros."}
        </Empty>
      ) : (
        <ol className="flex flex-col">
          {filtered.map((a, i) => {
            const c = auditCategory(a.action);
            const Icon = CAT_ICON[c];
            const chips = metaChips(a.metadata);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static audit timeline, never reordered
              <li key={`${a.action}-${i}`} className="flex gap-3.5">
                {/* Timeline rail */}
                <div className="flex flex-col items-center">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-soft">
                    <Icon className="size-4" />
                  </span>
                  {i < filtered.length - 1 && (
                    <span className="w-px flex-1 bg-line" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-medium text-ink">
                      {auditLabel(a.action)}
                    </p>
                    <time className="shrink-0 text-[0.76rem] text-muted">
                      {fmtDateTime(a.createdAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 font-mono text-[0.72rem] text-muted">
                    {c} · {a.action}
                  </p>
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((ch) => (
                        <span
                          key={ch}
                          className="rounded-full border border-line bg-paper-sunk px-2 py-0.5 text-[0.72rem] text-ink-soft"
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">
      {children}
    </p>
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
  mono,
}: {
  Icon: (p: IconProps) => React.ReactElement;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-[0.72rem] text-muted">{label}</dt>
        <dd
          className={cn(
            "truncate font-medium text-ink",
            mono ? "font-mono text-[0.82rem]" : "text-[0.88rem]",
          )}
        >
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
  tone?: "default" | "danger" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl border",
          tone === "danger"
            ? "border-danger/25 bg-danger/5 text-danger"
            : tone === "accent"
              ? "border-accent-line bg-accent-weak text-accent-deep"
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
  tone: "ok" | "danger" | "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] font-medium",
        tone === "ok"
          ? "border-ok/30 bg-ok/5 text-ok"
          : tone === "danger"
            ? "border-danger/30 bg-danger/5 text-danger"
            : tone === "accent"
              ? "border-accent-line bg-accent-weak text-accent-deep"
              : "border-line bg-paper-sunk text-muted",
      )}
    >
      {children}
    </span>
  );
}

function PayDot({ state }: { state: string }) {
  const tone =
    state === "paid"
      ? "bg-ok"
      : state === "refunded"
        ? "bg-danger"
        : state === "overdue"
          ? "bg-danger"
          : "bg-line-strong";
  return <span className={cn("size-2 shrink-0 rounded-full", tone)} />;
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
