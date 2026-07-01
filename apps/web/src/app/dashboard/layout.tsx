import { PAST_DUE_GRACE_DAYS } from "@linkview/shared";
import { redirect } from "next/navigation";
import type { AccountStatusKind } from "@/components/dashboard/account-status-banner";
import type { BillingAlertKind } from "@/components/dashboard/billing-alert-banner";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getAccountState,
  resolveAccountClosure,
} from "@/server/account-status";
import { isPlatformAdmin } from "@/server/admin/guard";
import { getOpenChargeInfo } from "@/server/billing/payments";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "@/server/billing/subscription";
import { getTrialStatus } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { ensureActiveWorkspace } from "@/server/workspace";

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

export interface BillingAlert {
  kind: BillingAlertKind;
  dueLabel: string | null;
  daysLeft: number | null;
}

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
  // Provision a fresh free workspace if the user has none — e.g. a returning
  // customer whose only workspace was soft-deleted by the retention purge.
  // Without this the null case redirected to /login, which bounced the live
  // session back here: an infinite loop with no way to reach /assinar.
  const workspace = await ensureActiveWorkspace(session.user.id);

  // Account-level lifecycle gate (SECURITY-AUDIT F1). A suspended or closed
  // account keeps reaching the dashboard read-only — with a retention countdown
  // — until the maintenance job purges it. This supersedes every billing banner
  // and the onboarding redirect, and forces read-only (`workspaceCanWrite`
  // denies the actual writes on the server). Checked before the admin bypass so
  // a suspended admin is read-only too.
  const accountState = await getAccountState(session.user.id);
  const closure = resolveAccountClosure(accountState);
  let accountAlert: { kind: AccountStatusKind; daysLeft: number } | null = null;
  if (closure) {
    accountAlert = { kind: closure.kind, daysLeft: closure.daysLeft };
  }

  const admin = await isPlatformAdmin(session.user.id);

  // Platform admins bypass the paid-subscription gate so they can audit the
  // product without holding a plan of their own.
  let billingAlert: BillingAlert | null = null;
  let locked = false;
  if (!admin && !closure) {
    const sub = await getWorkspaceSubscription(workspace.id);
    const access = resolveSubscriptionAccess(sub);
    // Only a workspace that has *never* paid is sent to onboarding. A workspace
    // that paid before but lapsed stays reachable in a read-only "locked" state
    // — it can browse and pay, but cannot write and its links are dark — until
    // the retention job purges it. This is what keeps the user from being
    // trapped on /assinar with a paid (or recently-paid) plan.
    if (access === "none") redirect("/assinar");
    locked = access === "locked";

    // Surface an actionable billing notice as a fixed banner, matching the email
    // we send for the same event. Skipped when locked (LockedBanner takes over).
    if (!locked) {
      const pastDue = sub?.status === "past_due";
      // Days left in the past-due tolerance window, so the user pays before the
      // lapse to `locked`.
      const daysLeft =
        pastDue && sub?.currentPeriodEnd
          ? Math.max(
              0,
              Math.ceil(
                (sub.currentPeriodEnd.getTime() +
                  PAST_DUE_GRACE_DAYS * DAY_MS -
                  Date.now()) /
                  DAY_MS,
              ),
            )
          : null;

      const autopay = sub?.autopay ?? false;

      let kind: BillingAlertKind | null = null;
      let dueLabel: string | null = null;
      if (autopay) {
        // Card autopay: alarm only when the charge is actually failing
        // (past due) — never while a normal renewal is auto-capturing. No Asaas
        // call needed; the copy is driven by the tolerance window.
        if (pastDue) kind = "card_failed";
      } else {
        // Pix (manual): hit Asaas once to learn whether a renewal invoice is
        // open and whether it has lapsed. Only manual workspaces pay this cost.
        const open = await getOpenChargeInfo(workspace.id);
        const overdue = pastDue || open?.state === "overdue";
        if (overdue) kind = "pix_overdue";
        else if (open) kind = "pix_pending";
        dueLabel = open?.dueDate ? fmtDate(open.dueDate) : null;
      }

      if (kind) billingAlert = { kind, dueLabel, daysLeft };
    }
  }

  // A closed/suspended account is read-only regardless of plan, and its trial
  // banner is irrelevant.
  const trial = closure ? null : await getTrialStatus(workspace.id);

  return (
    <DashboardShell
      user={{ name: session.user.name ?? "", email: session.user.email }}
      workspaceName={workspace.name}
      planLabel={PLAN_LABELS[workspace.planKey] ?? workspace.planKey}
      roleLabel={ROLE_LABELS[workspace.role] ?? workspace.role}
      isAdmin={admin}
      trialDaysLeft={trial?.daysLeft ?? null}
      billingAlert={billingAlert}
      locked={locked || closure != null}
      accountAlert={accountAlert}
    >
      {children}
    </DashboardShell>
  );
}
