"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster, useToasts } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface SessionRow {
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  current: boolean;
}

/** Coarse device label from a user-agent string. Good enough to recognize. */
function describe(ua: string | null): { device: string; os: string } {
  if (!ua) return { device: "Dispositivo desconhecido", os: "" };
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Navegador";
  return { device: browser, os };
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const { toasts, toast } = useToasts();
  const [busy, setBusy] = useState<string | null>(null);

  const others = sessions.filter((s) => !s.current).length;

  async function revoke(token: string) {
    setBusy(token);
    const { error } = await authClient.revokeSession({ token });
    setBusy(null);
    if (error) {
      toast(
        error.status === 403
          ? "Sua sessão expirou. Entre de novo para gerenciar dispositivos."
          : "Não foi possível encerrar a sessão.",
        "danger",
      );
      return;
    }
    toast("Sessão encerrada.");
    router.refresh();
  }

  async function revokeOthers() {
    setBusy("others");
    const { error } = await authClient.revokeOtherSessions();
    setBusy(null);
    if (error) {
      toast(
        error.status === 403
          ? "Sua sessão expirou. Entre de novo para gerenciar dispositivos."
          : "Não foi possível encerrar as sessões.",
        "danger",
      );
      return;
    }
    toast("Outros dispositivos desconectados.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-input)] border border-line">
        {sessions.map((s) => {
          const { device, os } = describe(s.userAgent);
          return (
            <li
              key={s.token}
              className="flex items-center justify-between gap-4 bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <DeviceGlyph os={os} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[0.88rem] font-medium text-ink">
                    <span className="truncate">
                      {device}
                      {os && ` · ${os}`}
                    </span>
                    {s.current && (
                      <span className="shrink-0 rounded-full border border-accent-line bg-accent-weak px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-accent-deep">
                        Este aparelho
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[0.78rem] text-muted">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    desde {fmt(s.createdAt)}
                  </p>
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  onClick={() => revoke(s.token)}
                  disabled={busy === s.token}
                  className={cn(
                    "shrink-0 rounded-[var(--radius-input)] px-2.5 py-1.5 text-[0.8rem] font-medium text-muted transition-colors hover:bg-danger-weak hover:text-danger disabled:opacity-55",
                  )}
                >
                  {busy === s.token ? "Encerrando…" : "Encerrar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {others > 0 && (
        <button
          type="button"
          onClick={revokeOthers}
          disabled={busy === "others"}
          className="self-start text-[0.83rem] font-medium text-accent transition-colors hover:text-accent-deep disabled:opacity-55"
        >
          {busy === "others"
            ? "Desconectando…"
            : "Sair de todos os outros dispositivos"}
        </button>
      )}

      <Toaster toasts={toasts} />
    </div>
  );
}

function DeviceGlyph({ os }: { os: string }) {
  const mobile = os === "Android" || os === "iOS";
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-sunk text-muted">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mobile ? (
          <>
            <rect x="7" y="3" width="10" height="18" rx="2" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </>
        ) : (
          <>
            <rect x="3" y="4.5" width="18" height="12" rx="2" />
            <path d="M8 20.5h8M12 16.5v4" />
          </>
        )}
      </svg>
    </span>
  );
}
