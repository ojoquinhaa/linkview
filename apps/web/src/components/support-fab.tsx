import Link from "next/link";

/**
 * Floating "Suporte" launcher for public, pre-dashboard surfaces (auth, the
 * payment-confirmation wait). Links to the public support page so a stuck or
 * undecided visitor always has a way to reach a human.
 */
export function SupportFab() {
  return (
    <Link
      href="/suporte"
      aria-label="Falar com o suporte"
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-2.5 pr-4 pl-3 text-[0.875rem] font-medium text-ink shadow-[0_4px_16px_oklch(0.42_0.16_265/0.12)] transition-[border-color,box-shadow,transform] duration-150 ease-[var(--ease-out-quint)] hover:border-accent-line hover:shadow-[0_6px_20px_oklch(0.42_0.16_265/0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:translate-y-px sm:right-6 sm:bottom-6"
    >
      <span className="grid size-6 place-items-center rounded-full bg-accent-weak text-accent-deep">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L3 21z" />
        </svg>
      </span>
      Suporte
    </Link>
  );
}
