"use client";

import type { LinkSecurityInput } from "@linkview/shared";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Toaster, useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { COUNTRIES, countryName, flagEmoji } from "@/lib/countries";
import {
  resetLinkClicksAction,
  updateLinkSecurityAction,
} from "@/server/links";

interface SecurityLink {
  isActive: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  totalClicks: number;
  blockBots: boolean;
  allowedCountries: string[];
  blockedCountries: string[];
  rateLimitPerMinute: number | null;
}

type GeoMode = "all" | "allow" | "block";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function LinkSecurityForm({
  linkId,
  link,
  canEdit,
}: {
  linkId: string;
  link: SecurityLink;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toasts, toast } = useToasts();

  const [isActive, setIsActive] = useState(link.isActive);
  const [expiresAt, setExpiresAt] = useState(toLocalInput(link.expiresAt));
  const [maxOn, setMaxOn] = useState(link.maxClicks != null);
  const [maxClicks, setMaxClicks] = useState(
    link.maxClicks != null ? String(link.maxClicks) : "",
  );
  const [blockBots, setBlockBots] = useState(link.blockBots);
  const [rateOn, setRateOn] = useState(link.rateLimitPerMinute != null);
  const [rateLimit, setRateLimit] = useState(
    link.rateLimitPerMinute != null ? String(link.rateLimitPerMinute) : "",
  );
  const [geoMode, setGeoMode] = useState<GeoMode>(
    link.allowedCountries.length
      ? "allow"
      : link.blockedCountries.length
        ? "block"
        : "all",
  );
  const [countries, setCountries] = useState<string[]>(
    link.allowedCountries.length
      ? link.allowedCountries
      : link.blockedCountries,
  );

  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const firstRun = useRef(true);

  // Debounced autosave for everything except the password (which is explicit).
  // biome-ignore lint/correctness/useExhaustiveDependencies: save reads fresh state
  useEffect(() => {
    if (!canEdit) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(t);
  }, [
    isActive,
    expiresAt,
    maxOn,
    maxClicks,
    blockBots,
    rateOn,
    rateLimit,
    geoMode,
    countries,
  ]);

  async function save() {
    setSaving(true);
    const payload: LinkSecurityInput = {
      isActive,
      blockBots,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxClicks: maxOn && Number(maxClicks) >= 1 ? Number(maxClicks) : null,
      rateLimitPerMinute:
        rateOn && Number(rateLimit) >= 1 ? Number(rateLimit) : null,
      allowedCountries: geoMode === "allow" ? countries : [],
      blockedCountries: geoMode === "block" ? countries : [],
    };
    const res = await updateLinkSecurityAction(linkId, payload);
    setSaving(false);
    if (res.ok) {
      toast("Salvo");
      router.refresh();
    } else {
      toast(res.error ?? "Não foi possível salvar.", "danger");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-2 text-[0.8rem] text-muted">
        <SpinnerOrCheck saving={saving} />
        {canEdit
          ? saving
            ? "Salvando…"
            : "As alterações são salvas automaticamente."
          : "Você não tem permissão para editar a segurança deste link."}
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <Card
          icon={<PowerGlyph />}
          title="Disponibilidade"
          hint="Controle se e até quando o link redireciona."
          aside={
            <Switch
              checked={isActive}
              onChange={setIsActive}
              disabled={!canEdit}
              label="Link ativo"
            />
          }
        >
          <FieldRow
            label="Expira em"
            hint="Depois desta data o link para de funcionar."
          >
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={!canEdit}
                className={inputCls}
              />
              {expiresAt && canEdit && (
                <button
                  type="button"
                  onClick={() => setExpiresAt("")}
                  className="shrink-0 rounded-[var(--radius-input)] px-2.5 py-1 text-[0.8rem] font-medium text-muted transition-colors hover:bg-paper-sunk hover:text-ink"
                >
                  Remover
                </button>
              )}
            </div>
          </FieldRow>
        </Card>

        <Card
          icon={<GaugeGlyph />}
          title="Limite de cliques"
          hint="O link desativa sozinho ao atingir o total. 1 = uso único."
          aside={
            <Switch
              checked={maxOn}
              onChange={(v) => {
                setMaxOn(v);
                if (!v) setMaxClicks("");
              }}
              disabled={!canEdit}
              label="Limitar cliques"
            />
          }
        >
          {maxOn && (
            <div className="flex flex-col gap-4">
              <FieldRow label="Máximo de cliques">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ex.: 100"
                  value={maxClicks}
                  onChange={(e) => setMaxClicks(e.target.value)}
                  disabled={!canEdit}
                  className={cn(inputCls, "max-w-[10rem]")}
                />
              </FieldRow>
              {Number(maxClicks) >= 1 && (
                <ClickProgress
                  used={link.totalClicks}
                  cap={Number(maxClicks)}
                  canReset={canEdit}
                  onReset={() => setResetOpen(true)}
                />
              )}
            </div>
          )}
        </Card>

        <Card
          icon={<LockGlyph />}
          title="Senha"
          hint="Visitantes digitam a senha antes de serem redirecionados."
          aside={
            link.hasPassword ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-weak px-2.5 py-1 text-[0.72rem] font-medium text-accent-deep">
                <ShieldGlyph />
                Protegido
              </span>
            ) : undefined
          }
        >
          <PasswordCard
            linkId={linkId}
            hasPassword={link.hasPassword}
            canEdit={canEdit}
            onChanged={(msg) => {
              toast(msg);
              router.refresh();
            }}
            onError={(msg) => toast(msg, "danger")}
          />
        </Card>

        <Card
          icon={<TrafficGlyph />}
          title="Tráfego"
          hint="Filtre acessos automáticos e limite abusos."
        >
          <div className="flex flex-col divide-y divide-line">
            <SettingRow
              label="Bloquear robôs e crawlers"
              hint="Pré-visualizações e robôs não são redirecionados."
            >
              <Switch
                checked={blockBots}
                onChange={setBlockBots}
                disabled={!canEdit}
                label="Bloquear robôs"
              />
            </SettingRow>
            <SettingRow
              label="Limite por IP"
              hint="Trava cliques repetidos do mesmo visitante."
            >
              <Switch
                checked={rateOn}
                onChange={(v) => {
                  setRateOn(v);
                  if (!v) setRateLimit("");
                }}
                disabled={!canEdit}
                label="Limitar por IP"
              />
            </SettingRow>
            {rateOn && (
              <div className="flex items-center gap-2 pt-3">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ex.: 10"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  disabled={!canEdit}
                  className={cn(inputCls, "max-w-[8rem]")}
                />
                <span className="text-[0.85rem] text-muted">
                  cliques por minuto
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card
          icon={<GlobeGlyph />}
          title="Região"
          hint="Escolha de quais países o link pode ser aberto."
          className="md:col-span-2"
        >
          <div className="flex flex-col gap-4">
            <Segmented
              value={geoMode}
              onChange={(m) => {
                setGeoMode(m);
                if (m === "all") setCountries([]);
              }}
              disabled={!canEdit}
              options={[
                { value: "all", label: "Todos" },
                { value: "allow", label: "Só permitir" },
                { value: "block", label: "Bloquear" },
              ]}
            />
            {geoMode !== "all" && (
              <CountrySelect
                value={countries}
                onChange={setCountries}
                disabled={!canEdit}
                tone={geoMode === "allow" ? "allow" : "block"}
              />
            )}
          </div>
        </Card>
      </div>

      <ResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        linkId={linkId}
        total={link.totalClicks}
        onDone={() => {
          toast("Contagem zerada");
          setResetOpen(false);
          router.refresh();
        }}
        onError={(msg) => toast(msg, "danger")}
      />

      <Toaster toasts={toasts} />
    </div>
  );
}

/* ------------------------------- Card shell ------------------------------- */

const inputCls =
  "h-11 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] placeholder:text-muted/80 focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] disabled:opacity-55";

function Card({
  icon,
  title,
  hint,
  aside,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-[13.5rem] flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6",
        className,
      )}
    >
      <header className="flex items-start gap-3.5">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-paper-sunk text-ink-soft">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-ink">{title}</h3>
          <p className="mt-0.5 text-[0.82rem] leading-snug text-muted">
            {hint}
          </p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {children && <div className="mt-5 flex-1">{children}</div>}
    </section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[0.78rem] text-muted">{hint}</span>}
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-[0.85rem]">
        <span className="block font-medium text-ink-soft">{label}</span>
        <span className="block text-[0.78rem] text-muted">{hint}</span>
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* -------------------------------- Controls -------------------------------- */

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)] disabled:opacity-55",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[left] duration-150 ease-[var(--ease-out-quint)]",
          checked ? "left-[1.125rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex w-full rounded-[var(--radius-input)] border border-line bg-paper-sunk/60 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            disabled={disabled}
            className={cn(
              "flex-1 rounded-[calc(var(--radius-input)-0.25rem)] px-3 py-1.5 text-[0.83rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)] disabled:opacity-55",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.08)]"
                : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ClickProgress({
  used,
  cap,
  canReset,
  onReset,
}: {
  used: number;
  cap: number;
  canReset: boolean;
  onReset: () => void;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const reached = used >= cap;
  return (
    <div className="rounded-[var(--radius-input)] border border-line bg-paper-sunk/40 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.82rem] font-medium text-ink-soft">
          <span className="nums">{used.toLocaleString("pt-BR")}</span>
          <span className="text-muted">
            {" "}
            de {cap.toLocaleString("pt-BR")} cliques
          </span>
        </span>
        <span
          className={cn(
            "text-[0.78rem] font-medium nums",
            reached ? "text-danger" : "text-muted",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out-quint)]",
            reached ? "bg-danger" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[0.78rem] text-muted">
          {reached
            ? "Limite atingido. O link foi desativado."
            : `Faltam ${(cap - used).toLocaleString("pt-BR")} cliques.`}
        </span>
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] px-2.5 py-1 text-[0.8rem] font-medium text-accent-deep transition-colors hover:bg-accent-weak"
          >
            <RefreshGlyph />
            Resetar
          </button>
        )}
      </div>
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
  disabled,
  tone,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
  tone: "allow" | "block";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Floating panel anchored to the trigger via fixed positioning, so it never
  // grows the page or pushes the dashboard layout. Flips upward when the space
  // below the trigger is tight.
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const flipUp = below < 280 && above > below;
    // Cap to ~5 visible rows so the panel stays compact.
    const cap = 260;
    setPos({
      left: r.left,
      width: r.width,
      ...(flipUp
        ? {
            bottom: window.innerHeight - r.top + 6,
            maxHeight: Math.min(above - 16, cap),
          }
        : { top: r.bottom + 6, maxHeight: Math.min(below - 16, cap) }),
    });
  }

  function openMenu() {
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Close on page scroll/resize, but ignore scrolling inside the panel itself.
    const reflow = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open]);

  const query = q.trim().toLowerCase();
  const filtered = COUNTRIES.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query),
  );

  const toggle = (code: string) =>
    onChange(
      value.includes(code) ? value.filter((c) => c !== code) : [...value, code],
    );

  return (
    <div ref={ref} className="relative flex flex-col gap-2.5">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <li key={code}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-1 text-[0.8rem] font-medium",
                  tone === "allow"
                    ? "bg-accent-weak text-accent-deep"
                    : "bg-danger-weak text-danger",
                )}
              >
                <span aria-hidden>{flagEmoji(code)}</span>
                {countryName(code)}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggle(code)}
                    aria-label={`Remover ${countryName(code)}`}
                    className="grid size-4 place-items-center rounded-full text-current/70 transition-colors hover:bg-ink/10 hover:text-current"
                  >
                    <XGlyph />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          "flex h-11 items-center justify-between gap-2 rounded-[var(--radius-input)] border border-line bg-surface px-3.5 text-sm text-muted transition-colors hover:border-line-strong disabled:opacity-55",
          open && "border-accent shadow-[0_0_0_3px_var(--ring)]",
        )}
      >
        {value.length
          ? `${value.length} país(es) selecionado(s)`
          : "Adicionar países…"}
        <ChevronGlyph open={open} />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-50 flex flex-col overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface shadow-[0_16px_40px_-16px_oklch(0.2_0.05_265/0.35)]"
          style={{
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
          }}
        >
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar país…"
              className="h-9 w-full rounded-[calc(var(--radius-input)-0.15rem)] bg-paper-sunk/60 px-3 text-sm text-ink outline-none placeholder:text-muted/80"
            />
          </div>
          <ul
            id={listId}
            className="flex-1 overflow-y-auto overscroll-contain p-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-[0.82rem] text-muted">
                Nenhum país encontrado.
              </li>
            )}
            {filtered.map((c) => {
              const selected = value.includes(c.code);
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => toggle(c.code)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[calc(var(--radius-input)-0.2rem)] px-2.5 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-accent-weak text-ink"
                        : "text-ink-soft hover:bg-paper-sunk",
                    )}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {flagEmoji(c.code)}
                    </span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-[0.72rem] text-muted nums">
                      {c.code}
                    </span>
                    {selected && (
                      <span className="text-accent-deep">
                        <CheckGlyph />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function PasswordCard({
  linkId,
  hasPassword,
  canEdit,
  onChanged,
  onError,
}: {
  linkId: string;
  hasPassword: boolean;
  canEdit: boolean;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, startTransition] = useTransition();

  function setPassword() {
    startTransition(async () => {
      const res = await updateLinkSecurityAction(linkId, { password: value });
      if (res.ok) {
        setValue("");
        setReveal(false);
        onChanged(hasPassword ? "Senha alterada" : "Senha definida");
      } else {
        onError(res.error ?? "Não foi possível salvar a senha.");
      }
    });
  }

  function removePassword() {
    startTransition(async () => {
      const res = await updateLinkSecurityAction(linkId, { password: null });
      if (res.ok) {
        setValue("");
        onChanged("Senha removida");
      } else {
        onError(res.error ?? "Não foi possível remover a senha.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasPassword ? "Nova senha" : "Defina uma senha"}
          disabled={!canEdit}
          className={cn(inputCls, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted transition-colors hover:text-ink"
        >
          {reveal ? <EyeOffGlyph /> : <EyeGlyph />}
        </button>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            loading={pending}
            disabled={value.trim().length < 4}
            onClick={setPassword}
          >
            {hasPassword ? "Alterar senha" : "Definir senha"}
          </Button>
          {hasPassword && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={removePassword}
            >
              Remover
            </Button>
          )}
          <span className="ml-auto text-[0.76rem] text-muted">
            Mínimo 4 caracteres
          </span>
        </div>
      )}
    </div>
  );
}

function ResetModal({
  open,
  onClose,
  linkId,
  total,
  onDone,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  linkId: string;
  total: number;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  function confirm() {
    startTransition(async () => {
      const res = await resetLinkClicksAction(linkId);
      if (res.ok) onDone();
      else onError(res.error ?? "Não foi possível resetar.");
    });
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resetar contagem de cliques"
      description="Reativa o link e libera o limite."
    >
      <p className="text-[0.9rem] text-ink-soft">
        A contagem volta a zero (hoje:{" "}
        <span className="font-medium text-ink nums">
          {total.toLocaleString("pt-BR")}
        </span>
        ) e o link volta a redirecionar. O histórico de cliques nos relatórios é
        mantido.
      </p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" loading={pending} onClick={confirm}>
          Resetar contagem
        </Button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Glyphs --------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SpinnerOrCheck({ saving }: { saving: boolean }) {
  if (saving) {
    return (
      <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-muted border-t-transparent" />
    );
  }
  return null;
}

function PowerGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-[1.15rem]"
    >
      <path d="M12 4v8" />
      <path d="M7.5 7a7 7 0 1 0 9 0" />
    </svg>
  );
}
function GaugeGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-[1.15rem]"
    >
      <path d="M12 14l3.5-3.5" />
      <path d="M4 18a8 8 0 1 1 16 0" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-[1.15rem]"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function TrafficGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-[1.15rem]"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function GlobeGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-[1.15rem]"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16" />
    </svg>
  );
}
function ShieldGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...stroke} className="size-3">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}
function RefreshGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className="size-3.5"
    >
      <path d="M20 11a8 8 0 1 0-1 5" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}
function EyeGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...stroke} className="size-4">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...stroke} className="size-4">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.7M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 2.6-.4" />
    </svg>
  );
}
function XGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      className="size-3"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      className="size-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...stroke}
      className={cn(
        "size-4 shrink-0 transition-transform duration-150",
        open && "rotate-180",
      )}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
