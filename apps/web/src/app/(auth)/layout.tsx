import Link from "next/link";
import { ShortLinkTicker } from "@/components/auth/short-link-ticker";
import { SupportFab } from "@/components/support-fab";
import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      {/* faint ruled paper texture, anchors the warm-cool surface */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_80%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Link href="/" className="inline-block">
          <Wordmark size="md" />
        </Link>
      </header>

      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-10">
        <div className="w-full max-w-[25rem]">{children}</div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-3 px-6 py-7 text-center">
        <ShortLinkTicker />
      </footer>

      <SupportFab />
    </div>
  );
}
