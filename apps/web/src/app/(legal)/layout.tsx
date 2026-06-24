import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[46rem] items-center justify-between px-6 py-5">
          <Link href="/" className="inline-block">
            <Wordmark size="md" />
          </Link>
          <Link
            href="/register"
            className="text-[0.85rem] font-medium text-accent hover:underline"
          >
            Criar conta
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[46rem] px-6 py-12 sm:py-16">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[46rem] flex-wrap items-center justify-between gap-3 px-6 py-6 text-[0.82rem] text-muted">
          <span>© {new Date().getFullYear()} linkview</span>
          <nav className="flex gap-5">
            <Link href="/termos" className="hover:text-ink-soft">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-ink-soft">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
