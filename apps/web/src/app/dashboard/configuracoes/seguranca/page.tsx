import { headers } from "next/headers";
import Link from "next/link";
import { PasswordForm } from "@/components/dashboard/password-form";
import { SessionsList } from "@/components/dashboard/sessions-list";
import { auth } from "@/lib/auth";
import { requireSession } from "@/server/session";

export const metadata = { title: "Segurança · Configurações" };

const REAUTH_HREF = "/login?redirect=/dashboard/configuracoes/seguranca";

/** Better Auth gates listing/managing sessions behind a "fresh" session (login
 * within `freshAge`, 1 day by default). When it isn't fresh it throws FORBIDDEN
 * — catch that one case so the route shows a re-login prompt instead of a crash,
 * and rethrow anything else. */
function isStaleSession(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: unknown;
    statusCode?: unknown;
    body?: { code?: unknown };
    message?: unknown;
  };
  const code = typeof e.body?.code === "string" ? e.body.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  return (
    code === "SESSION_NOT_FRESH" ||
    e.status === "FORBIDDEN" ||
    e.statusCode === 403 ||
    /not fresh/i.test(message)
  );
}

export default async function SegurancaPage() {
  const session = await requireSession();
  const currentToken = session.session.token;

  let rows: Awaited<ReturnType<typeof auth.api.listSessions>> | null = null;
  try {
    rows = await auth.api.listSessions({ headers: await headers() });
  } catch (err) {
    if (!isStaleSession(err)) throw err;
  }

  if (!rows) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <ReauthNotice />
      </div>
    );
  }

  const sessions = rows
    .map((s) => ({
      token: s.token,
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      createdAt: new Date(s.createdAt).toISOString(),
      current: s.token === currentToken,
    }))
    .sort((a, b) => (a.current ? -1 : b.current ? 1 : 0));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Senha
        </h2>
        <p className="mt-1 text-[0.88rem] text-muted">
          Use uma senha forte que você não usa em outro lugar.
        </p>
        <div className="mt-5">
          <PasswordForm />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Sessões ativas
        </h2>
        <p className="mt-1 text-[0.88rem] text-muted">
          Dispositivos com sua conta conectada. Não reconhece algum? Encerre.
        </p>
        <div className="mt-5">
          <SessionsList sessions={sessions} />
        </div>
      </section>
    </div>
  );
}

function ReauthNotice() {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-8">
      <h2 className="font-display text-lg font-semibold text-ink">
        Confirme que é você
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-[0.9rem] text-muted">
        Por segurança, entre de novo para alterar a senha e gerenciar os
        dispositivos conectados.
      </p>
      <Link
        href={REAUTH_HREF}
        className="mt-5 inline-flex h-10 items-center rounded-[var(--radius-input)] bg-accent px-4 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
      >
        Entrar novamente
      </Link>
    </section>
  );
}
