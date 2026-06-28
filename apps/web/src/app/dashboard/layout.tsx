import { PAST_DUE_GRACE_DAYS } from "@linkview/shared";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isPlatformAdmin } from "@/server/admin/guard";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "@/server/billing/subscription";
import { getTrialStatus } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  let locked = false;
  if (!admin) {
    const sub = await getWorkspaceSubscription(workspace.id);
    const access = resolveSubscriptionAccess(sub);
    // Only a workspace that has *never* paid is sent to onboarding. A workspace
    // that paid before but lapsed stays reachable in a read-only "locked" state
    // — it can browse and pay, but cannot write and its links are dark — until
    // the retention job purges it. This is what keeps the user from being
    // trapped on /assinar with a paid (or recently-paid) plan.
    if (access === "none") redirect("/assinar");
    locked = access === "locked";
    if (!locked && sub?.status === "past_due" && sub.currentPeriodEnd) {
      // Inside the past-due tolerance window: full access, but warn how long is
      // left so the user pays before the lapse to `locked`.
      const graceEnd =
        sub.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS;
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
      locked={locked}
    >
      {children}
    </DashboardShell>
  );
}
