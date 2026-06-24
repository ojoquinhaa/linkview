import { redirect } from "next/navigation";
import { SupportComposer } from "@/components/dashboard/support-composer";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export const metadata = { title: "Suporte" };

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export default async function SupportPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  return (
    <div className="flex flex-col">
      <div className="border-b border-line bg-paper px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-[1.5rem] font-semibold tracking-[-0.02em] text-ink">
            Suporte
          </h1>
          <p className="mt-1 max-w-prose text-[0.9rem] text-muted">
            Atendimento humano pelo WhatsApp. Conte o que precisa e abrimos a
            conversa já com seus dados, sem você repetir nada.
          </p>
        </div>
      </div>

      <div className="px-6 py-7 sm:px-8">
        <SupportComposer
          name={session.user.name ?? ""}
          email={session.user.email}
          workspaceName={workspace.name}
          planLabel={PLAN_LABELS[workspace.planKey] ?? workspace.planKey}
        />
      </div>
    </div>
  );
}
