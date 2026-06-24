"use client";

import type {
  LogoPosition,
  PageLayoutInput,
  SplashBgType,
} from "@linkview/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  createPageLayoutAction,
  requestLayoutUploadAction,
  updatePageLayoutAction,
} from "@/server/page-layouts";

export interface LayoutEditorValues {
  name: string;
  logoUrl: string | null;
  bgType: SplashBgType;
  bgColor: string;
  bgImageUrl: string | null;
  blur: number;
  logoPosition: LogoPosition;
  accentColor: string;
  textColor: string;
  countdownSeconds: number;
  showBranding: boolean;
}

const DEFAULTS: LayoutEditorValues = {
  name: "",
  logoUrl: null,
  bgType: "color",
  bgColor: "#0b0b0f",
  bgImageUrl: null,
  blur: 0,
  logoPosition: "center",
  accentColor: "#6366f1",
  textColor: "#ffffff",
  countdownSeconds: 3,
  showBranding: true,
};

export function LayoutEditor({
  mode,
  layoutId,
  initial,
  canEdit,
  uploadEnabled,
}: {
  mode: "create" | "edit";
  layoutId?: string;
  initial?: LayoutEditorValues;
  canEdit: boolean;
  uploadEnabled: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<LayoutEditorValues>(initial ?? DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof LayoutEditorValues>(
    key: K,
    value: LayoutEditorValues[K],
  ) => {
    setSaved(false);
    setV((prev) => ({ ...prev, [key]: value }));
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload: PageLayoutInput = {
      name: v.name,
      logoUrl: v.logoUrl,
      bgType: v.bgType,
      bgColor: v.bgColor,
      bgImageUrl: v.bgImageUrl,
      blur: v.blur,
      logoPosition: v.logoPosition,
      accentColor: v.accentColor,
      textColor: v.textColor,
      countdownSeconds: v.countdownSeconds,
      showBranding: v.showBranding,
    };
    startTransition(async () => {
      const res =
        mode === "edit" && layoutId
          ? await updatePageLayoutAction(layoutId, payload)
          : await createPageLayoutAction(payload);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      if (mode === "create") {
        router.push("/dashboard/paginas");
        router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6">
        <div>
          <h2 className="font-display text-[1rem] font-semibold tracking-[-0.01em] text-ink">
            Página de redirecionamento
          </h2>
          <p className="mt-1 text-[0.85rem] text-muted">
            Personalize a tela que aparece por alguns segundos antes de levar o
            visitante ao destino. Aplique esta página a quantos links quiser.
          </p>
        </div>

        <Field label="Nome da página" hint="Só você vê — para organizar.">
          {({ id }) => (
            <Input
              id={id}
              value={v.name}
              maxLength={80}
              placeholder="Ex.: Marca principal"
              onChange={(e) => set("name", e.target.value)}
              disabled={!canEdit}
            />
          )}
        </Field>

        <ImagePicker
          label="Logo"
          kind="logo"
          value={v.logoUrl}
          onChange={(url) => set("logoUrl", url)}
          onError={setError}
          canEdit={canEdit}
          uploadEnabled={uploadEnabled}
          hint="PNG, SVG ou WebP. Vazio usa a marca linkview."
        />

        <Segmented
          label="Posição da logo"
          value={v.logoPosition}
          onChange={(p) => set("logoPosition", p as LogoPosition)}
          disabled={!canEdit}
          options={[
            { value: "top", label: "Topo" },
            { value: "center", label: "Centro" },
            { value: "bottom", label: "Base" },
          ]}
        />

        <Segmented
          label="Fundo"
          value={v.bgType}
          onChange={(t) => set("bgType", t as SplashBgType)}
          disabled={!canEdit}
          options={[
            { value: "color", label: "Cor sólida" },
            { value: "image", label: "Imagem" },
          ]}
        />

        {v.bgType === "color" ? (
          <ColorField
            label="Cor de fundo"
            value={v.bgColor}
            onChange={(c) => set("bgColor", c)}
            disabled={!canEdit}
          />
        ) : (
          <>
            <ImagePicker
              label="Imagem de fundo"
              kind="background"
              value={v.bgImageUrl}
              onChange={(url) => set("bgImageUrl", url)}
              onError={setError}
              canEdit={canEdit}
              uploadEnabled={uploadEnabled}
              hint="JPG ou WebP, até 8 MB. Ideal 1080×1920."
            />
            <RangeField
              label="Desfoque (blur)"
              value={v.blur}
              min={0}
              max={40}
              suffix="px"
              onChange={(n) => set("blur", n)}
              disabled={!canEdit}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label="Cor de destaque"
            value={v.accentColor}
            onChange={(c) => set("accentColor", c)}
            disabled={!canEdit}
          />
          <ColorField
            label="Cor do texto"
            value={v.textColor}
            onChange={(c) => set("textColor", c)}
            disabled={!canEdit}
          />
        </div>

        <RangeField
          label="Contador"
          value={v.countdownSeconds}
          min={1}
          max={15}
          suffix="s"
          onChange={(n) => set("countdownSeconds", n)}
          disabled={!canEdit}
        />

        <label className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] border border-line bg-paper-sunk px-3.5 py-3">
          <span className="text-[0.85rem] text-ink-soft">
            Exibir “Criado com linkview”
          </span>
          <input
            type="checkbox"
            checked={v.showBranding}
            disabled={!canEdit}
            onChange={(e) => set("showBranding", e.target.checked)}
            className="size-4 accent-accent"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
          >
            {error}
          </p>
        )}

        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-[0.82rem] font-medium text-ok">Salvo.</span>
            )}
            <Button type="submit" loading={pending}>
              {mode === "edit" ? "Salvar alterações" : "Criar página"}
            </Button>
          </div>
        )}
      </div>

      {/* Live preview. */}
      <div className="flex flex-col gap-2">
        <span className="text-[0.78rem] uppercase tracking-wide text-muted">
          Prévia
        </span>
        <SplashPreview v={v} />
        <p className="text-[0.78rem] text-muted">
          Prévia aproximada. O contador roda de verdade no link.
        </p>
      </div>
    </form>
  );
}

function SplashPreview({ v }: { v: LayoutEditorValues }) {
  const justify =
    v.logoPosition === "top"
      ? "justify-start"
      : v.logoPosition === "bottom"
        ? "justify-end"
        : "justify-center";
  return (
    <div
      className="relative mx-auto aspect-[10/19] w-full max-w-[16rem] overflow-hidden rounded-[1.75rem] border-4 border-ink/80 shadow-[0_8px_30px_oklch(0.2_0.03_265/0.18)]"
      style={{ background: v.bgColor }}
    >
      {v.bgType === "image" && v.bgImageUrl && (
        // biome-ignore lint/performance/noImgElement: arbitrary R2 URL preview
        <img
          src={v.bgImageUrl}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover"
          style={{ filter: `blur(${v.blur}px)` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_45%,rgba(0,0,0,0.45))]" />
      <div
        className={cn(
          "relative flex size-full flex-col items-center gap-5 px-5 py-7 text-center",
          justify,
        )}
        style={{ color: v.textColor }}
      >
        {v.logoUrl ? (
          // biome-ignore lint/performance/noImgElement: arbitrary R2 URL preview
          <img
            src={v.logoUrl}
            alt=""
            className="max-h-16 max-w-[70%] object-contain"
          />
        ) : (
          <span className="text-lg font-bold tracking-tight">
            link<span style={{ color: v.accentColor }}>view</span>
          </span>
        )}
        <div className="flex flex-col items-center gap-2">
          <div className="relative grid size-14 place-items-center">
            <svg
              className="size-14 -rotate-90"
              viewBox="0 0 56 56"
              aria-hidden="true"
            >
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.18"
                strokeWidth="4"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke={v.accentColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="150.8"
                strokeDashoffset="45"
              />
            </svg>
            <span className="absolute text-base font-semibold tabular-nums">
              {v.countdownSeconds}
            </span>
          </div>
          <span className="text-[0.7rem] opacity-75">Redirecionando você…</span>
        </div>
      </div>
      {v.showBranding && (
        <span
          className="absolute inset-x-0 bottom-2.5 text-center text-[0.62rem] opacity-70"
          style={{ color: v.textColor }}
        >
          Criado com link
          <span style={{ color: v.accentColor }}>view</span>
        </span>
      )}
    </div>
  );
}

function ImagePicker({
  label,
  kind,
  value,
  onChange,
  onError,
  canEdit,
  uploadEnabled,
  hint,
}: {
  label: string;
  kind: "logo" | "background";
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (msg: string | null) => void;
  canEdit: boolean;
  uploadEnabled: boolean;
  hint: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onError(null);
    setUploading(true);
    try {
      const ticket = await requestLayoutUploadAction({
        kind,
        contentType: file.type,
        size: file.size,
      });
      if (!ticket.ok || !ticket.uploadUrl || !ticket.fileUrl) {
        onError(ticket.error ?? "Falha no upload.");
        return;
      }
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        onError("Não foi possível enviar a imagem.");
        return;
      }
      onChange(ticket.fileUrl);
    } catch {
      onError("Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  if (!uploadEnabled) {
    return (
      <Field label={`URL da ${label.toLowerCase()}`} hint={hint}>
        {({ id }) => (
          <Input
            id={id}
            type="url"
            value={value ?? ""}
            placeholder="https://..."
            onChange={(e) => onChange(e.target.value || null)}
            disabled={!canEdit}
          />
        )}
      </Field>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.82rem] font-medium text-ink-soft">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={onPick}
          className="hidden"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          disabled={!canEdit}
          onClick={() => fileRef.current?.click()}
        >
          {value ? "Trocar" : "Enviar"}
        </Button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={!canEdit}
            className="text-[0.82rem] font-medium text-muted transition-colors hover:text-danger"
          >
            Remover
          </button>
        )}
        <span className="text-[0.78rem] text-muted">{hint}</span>
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-medium text-ink-soft">{label}</span>
      <div className="flex gap-1 rounded-[var(--radius-input)] border border-line bg-paper-sunk p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[0.82rem] font-medium transition-colors",
              value === o.value
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.08)]"
                : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-medium text-ink-soft">{label}</span>
      <div className="flex h-11 items-center gap-2 rounded-[var(--radius-input)] border border-line bg-surface px-2 pr-3.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          disabled={disabled}
          maxLength={7}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full bg-transparent font-mono text-[0.82rem] uppercase text-ink outline-none"
        />
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.82rem] font-medium text-ink-soft">
          {label}
        </span>
        <span className="font-mono text-[0.8rem] tabular-nums text-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-sunk accent-accent"
      />
    </div>
  );
}
