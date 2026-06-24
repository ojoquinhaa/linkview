import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isPlatformAdmin } from "@/server/admin/guard";
import { getWorkspaceSubscription } from "@/server/billing/subscription";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

// No free tier at launch: the dashboard requires a paid, active subscription.
const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing"]);

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  member: "Membro",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const admin = await isPlatformAdmin(session.user.id);

  // Platform admins bypass the paid-subscription gate so they can audit the
  // product without holding a plan of their own.
  if (!admin) {
    const sub = await getWorkspaceSubscription(workspace.id);
    if (!sub || !ACTIVE_SUBSCRIPTION.has(sub.status)) redirect("/assinar");
  }

  return (
    <DashboardShell
      user={{ name: session.user.name ?? "", email: session.user.email }}
      workspaceName={workspace.name}
      planLabel={PLAN_LABELS[workspace.planKey] ?? workspace.planKey}
      roleLabel={ROLE_LABELS[workspace.role] ?? workspace.role}
      isAdmin={admin}
    >
      {children}
    </DashboardShell>
  );
}
