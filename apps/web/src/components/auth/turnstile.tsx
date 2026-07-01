"use client";
import { useEffect, useRef } from "react";

/** Public Turnstile site key. Empty when not configured (local dev). */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** True when Turnstile is wired up, so the widget should render and gate submit. */
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
    },
  ) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script once and resolve when `window.turnstile` is ready. */
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    );
    const onReady = () => resolve();
    if (existing) {
      if (window.turnstile) resolve();
      else existing.addEventListener("load", onReady, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("turnstile_load")),
      {
        once: true,
      },
    );
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Fires with a fresh token once the challenge is solved. */
  onVerify: (token: string) => void;
  /** Token expired — caller should clear any stored token. */
  onExpire?: () => void;
  /** Widget failed to render/solve — caller should clear any stored token. */
  onError?: () => void;
}

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured,
 * so local dev (and the gating in parent forms) degrades gracefully.
 */
export function Turnstile({ onVerify, onExpire, onError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep latest callbacks without re-rendering the widget.
  const handlers = useRef({ onVerify, onExpire, onError });
  handlers.current = { onVerify, onExpire, onError };

  useEffect(() => {
    if (!turnstileEnabled) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          language: "pt-br",
          callback: (token) => handlers.current.onVerify(token),
          "expired-callback": () => handlers.current.onExpire?.(),
          "error-callback": () => handlers.current.onError?.(),
        });
      })
      .catch(() => handlers.current.onError?.());

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Widget already torn down — ignore.
        }
      }
    };
  }, []);

  if (!turnstileEnabled) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
