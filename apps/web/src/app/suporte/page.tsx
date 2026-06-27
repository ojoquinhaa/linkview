import Link from "next/link";
import { SupportComposer } from "@/components/dashboard/support-composer";
import { Wordmark } from "@/components/wordmark";
import { getSession } from "@/server/session";

export const metadata = {
  title: "Suporte — linkview",
  description:
    "Fale com o suporte do linkview pelo WhatsApp. Atendimento humano, em português, sem precisar de conta.",
};

/**
 * Public support page: same composer as the dashboard, reachable without a
 * session. Visitors type their own name + e-mail; signed-in users get those
 * prefilled but can still edit. No workspace context here by design.
 */
export default async function PublicSupportPage() {
  const session = await getSession();

  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_60%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="inline-block">
          <Wordmark size="md" />
        </Link>
        <Link
          href={session ? "/dashboard/links" : "/login"}
          className="text-[0.9rem] font-medium text-ink-soft transition-colors hover:text-ink"
        >
          {session ? "Painel" : "Entrar"}
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 pb-16 sm:px-8">
        <div className="max-w-prose pt-6 pb-8">
          <h1 className="font-display text-[1.9rem] font-semibold tracking-[-0.02em] text-ink">
            Como podemos ajudar?
          </h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
            Atendimento humano pelo WhatsApp, em português. Conte o que você
            precisa e abrimos a conversa já com sua mensagem pronta. Não precisa
            ter conta.
          </p>
        </div>

        <SupportComposer
          name={session?.user.name ?? ""}
          email={session?.user.email ?? ""}
          editableContact
        />
      </main>
    </div>
  );
}
