import { PAST_DUE_GRACE_DAYS } from "@linkview/shared";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isPlatformAdmin } from "@/server/admin/guard";
import { getWorkspaceSubscription } from "@/server/billing/subscription";
import { getTrialStatus } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

const DAY_MS = 24 * 60 * 60 * 1000;

// No free tier at launch: the dashboard requires a paid, active subscription.
const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing"]);

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  trial: "Pro (teste)",
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
  let pastDueDaysLeft: number | null = null;
  if (!admin) {
    const sub = await getWorkspaceSubscription(workspace.id);
    if (!sub) redirect("/assinar");
    if (!ACTIVE_SUBSCRIPTION.has(sub.status)) {
      // `past_due` keeps access for a bounded tolerance window measured from the
      // last paid period end; past it (or for any other inactive status) the
      // dashboard is hard-blocked.
      const graceEnd =
        sub.status === "past_due" && sub.currentPeriodEnd
          ? sub.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS
          : null;
      if (!graceEnd || graceEnd <= Date.now()) redirect("/assinar");
      pastDueDaysLeft = Math.max(
        0,
        Math.ceil((graceEnd - Date.now()) / DAY_MS),
      );
    }
  }

  const trial = await getTrialStatus(workspace.id);

  return (
    <DashboardShell
      user={{ name: session.user.name ?? "", email: session.user.email }}
      workspaceName={workspace.name}
      planLabel={PLAN_LABELS[workspace.planKey] ?? workspace.planKey}
      roleLabel={ROLE_LABELS[workspace.role] ?? workspace.role}
      isAdmin={admin}
      trialDaysLeft={trial?.daysLeft ?? null}
      pastDueDaysLeft={pastDueDaysLeft}
    >
      {children}
    </DashboardShell>
  );
}
