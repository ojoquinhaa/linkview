import Link from "next/link";
import { redirect } from "next/navigation";
import { CloseAccount } from "@/components/dashboard/close-account";
import { WorkspaceForm } from "@/components/dashboard/workspace-form";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export const metadata = { title: "Conta · Configurações" };

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export default async function ContaPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const isOwner = workspace.role === "owner";
  const planLabel = PLAN_LABELS[workspace.planKey] ?? workspace.planKey;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Workspace */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Workspace
        </h2>
        <p className="mt-1 text-[0.88rem] text-muted">
          O nome aparece na barra lateral e nos relatórios.
        </p>
        <div className="mt-5">
          <WorkspaceForm name={workspace.name} canEdit={isOwner} />
        </div>
      </section>

      {/* Plano */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
        <div>
          <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
            Plano
          </h2>
          <p className="mt-1.5 text-[0.95rem] text-ink">
            Você está no plano{" "}
            <span className="font-semibold text-ink">{planLabel}</span>.
          </p>
        </div>
        <Link
          href="/dashboard/planos"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-input)] border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-paper-sunk"
        >
          Gerenciar plano
        </Link>
      </section>

      {/* Zona de perigo */}
      <section className="rounded-2xl border border-danger/30 bg-danger-weak/40 p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-wide text-danger">
          Zona de perigo
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-md">
            <p className="text-[0.95rem] font-medium text-ink">
              Encerrar conta
            </p>
            <p className="mt-1 text-[0.84rem] text-muted">
              Apaga seu acesso e seus dados conforme a LGPD. Seus links param de
              funcionar. Esta ação é permanente.
            </p>
          </div>
          <CloseAccount />
        </div>
      </section>
    </div>
  );
}
