"use server";
import {
  auditLogs,
  getDb,
  plans,
  session as sessionTable,
  subscriptions,
  user,
  userConsents,
  userProfiles,
  workspaces,
} from "@linkview/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { lockWorkspaceLinks, unlockWorkspaceLinks } from "@/lib/kv";
import { logAudit } from "@/server/audit";
import {
  listWorkspacePayments,
  type PaymentRow,
} from "@/server/billing/payments";
import { requireAdmin } from "./guard";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const PLAN_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Suspend or reactivate a user account. Suspending revokes its sessions, starts
 * the retention clock (`deletedAt`), and darks the owned workspaces' links;
 * a suspended owner's dashboard becomes read-only (enforced in the layout and
 * `workspaceCanWrite`) until reactivated or purged. Reactivating clears the
 * clock and brings the links back online. (SECURITY-AUDIT F1.)
 */
export async function setUserStatusAction(
  userId: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = getDb();
  try {
    await db
      .update(user)
      .set({ status, deletedAt: status === "suspended" ? new Date() : null })
      .where(eq(user.id, userId));

    const owned = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));

    if (status === "suspended") {
      await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
      for (const ws of owned) await lockWorkspaceLinks(ws.id);
    } else {
      // Reactivated: bring the workspaces' links back online.
      for (const ws of owned) await unlockWorkspaceLinks(ws.id);
    }
    await logAudit({
      workspaceId: null as unknown as string,
      userId: admin.userId,
      action: "admin.user.status_changed",
      entityType: "user",
      entityId: userId,
      metadata: { status },
    });
  } catch (err) {
    console.error("admin.set_user_status_failed", err);
    return { ok: false, error: "Não foi possível alterar o status." };
  }
  revalidatePath("/admin/clientes");
  return { ok: true };
}

/** Grant or revoke the platform admin role. Cannot demote yourself. */
export async function setPlatformRoleAction(
  userId: string,
  role: "user" | "admin",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.userId === userId && role === "user") {
    return {
      ok: false,
      error: "Você não pode remover seu próprio acesso admin.",
    };
  }
  const db = getDb();
  try {
    await db.update(user).set({ role }).where(eq(user.id, userId));
    await logAudit({
      workspaceId: null as unknown as string,
      userId: admin.userId,
      action: "admin.user.role_changed",
      entityType: "user",
      entityId: userId,
      metadata: { role },
    });
  } catch (err) {
    console.error("admin.set_role_failed", err);
    return { ok: false, error: "Não foi possível alterar o papel." };
  }
  revalidatePath("/admin/clientes");
  return { ok: true };
}

/**
 * Override a workspace's plan manually (admin grant). A paid plan upserts a
 * `manual` active subscription so the dashboard gate opens; `free` downgrades
 * and marks any subscription canceled. Does not touch the billing provider.
 */
export async function setWorkspacePlanAction(
  workspaceId: string,
  planKey: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = getDb();
  try {
    if (planKey === "free") {
      await db
        .update(workspaces)
        .set({ planKey: "free" })
        .where(eq(workspaces.id, workspaceId));
      await db
        .update(subscriptions)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(eq(subscriptions.workspaceId, workspaceId));
    } else {
      const [plan] = await db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.key, planKey))
        .limit(1);
      if (!plan) return { ok: false, error: `Plano "${planKey}" não existe.` };

      await db
        .update(workspaces)
        .set({ planKey })
        .where(eq(workspaces.id, workspaceId));

      const end = new Date(Date.now() + PLAN_PERIOD_MS);
      const [existing] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, workspaceId))
        .limit(1);
      if (existing) {
        await db
          .update(subscriptions)
          .set({
            planId: plan.id,
            provider: "manual",
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: end,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db.insert(subscriptions).values({
          workspaceId,
          planId: plan.id,
          provider: "manual",
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: end,
        });
      }
    }
    await logAudit({
      workspaceId,
      userId: admin.userId,
      action: "admin.workspace.plan_changed",
      entityType: "workspace",
      entityId: workspaceId,
      metadata: { planKey },
    });
  } catch (err) {
    console.error("admin.set_plan_failed", err);
    return { ok: false, error: "Não foi possível alterar o plano." };
  }
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  return { ok: true };
}

/** Archive (soft-delete) or restore a workspace. */
export async function setWorkspaceArchivedAction(
  workspaceId: string,
  archived: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = getDb();
  try {
    await db
      .update(workspaces)
      .set({ deletedAt: archived ? new Date() : null })
      .where(eq(workspaces.id, workspaceId));
    await logAudit({
      workspaceId,
      userId: admin.userId,
      action: archived
        ? "admin.workspace.archived"
        : "admin.workspace.restored",
      entityType: "workspace",
      entityId: workspaceId,
    });
  } catch (err) {
    console.error("admin.archive_workspace_failed", err);
    return { ok: false, error: "Não foi possível concluir a ação." };
  }
  revalidatePath("/admin/clientes");
  return { ok: true };
}

export interface ConsentRow {
  type: string;
  accepted: boolean;
  documentVersion: string;
  createdAt: Date;
}

export interface AuditRow {
  action: string;
  entityType: string | null;
  createdAt: Date;
  metadata: unknown;
}

export interface CustomerDetail {
  workspace: {
    id: string;
    name: string;
    slug: string;
    planKey: string;
    archived: boolean;
    createdAt: Date;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    status: string;
    role: string;
    emailVerified: boolean;
    createdAt: Date;
  };
  fiscal: {
    personType: string;
    document: string;
    phone: string;
    city: string;
    state: string;
    signupIp: string | null;
  } | null;
  subscription: {
    status: string;
    provider: string;
    currentPeriodEnd: Date | null;
  } | null;
  consents: ConsentRow[];
  audit: AuditRow[];
  payments: PaymentRow[];
  paymentsUnavailable: boolean;
}

/** Full audit + management detail for one workspace, loaded lazily by the drawer. */
export async function getCustomerDetailAction(
  workspaceId: string,
): Promise<CustomerDetail | null> {
  await requireAdmin();
  const db = getDb();

  const [ws] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      planKey: workspaces.planKey,
      deletedAt: workspaces.deletedAt,
      createdAt: workspaces.createdAt,
      ownerId: workspaces.ownerId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) return null;

  const [owner] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, ws.ownerId))
    .limit(1);

  const [profile, consents, audit, sub] = await Promise.all([
    db
      .select({
        personType: userProfiles.personType,
        document: userProfiles.document,
        phone: userProfiles.phone,
        city: userProfiles.city,
        state: userProfiles.state,
        signupIp: userProfiles.signupIp,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, ws.ownerId))
      .limit(1),
    db
      .select({
        type: userConsents.type,
        accepted: userConsents.accepted,
        documentVersion: userConsents.documentVersion,
        createdAt: userConsents.createdAt,
      })
      .from(userConsents)
      .where(eq(userConsents.userId, ws.ownerId))
      .orderBy(desc(userConsents.createdAt))
      .limit(8),
    db
      .select({
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
    db
      .select({
        status: subscriptions.status,
        provider: subscriptions.provider,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1),
  ]);

  const pay = await listWorkspacePayments(workspaceId);

  return {
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      planKey: ws.planKey,
      archived: ws.deletedAt != null,
      createdAt: ws.createdAt,
    },
    owner: owner ?? {
      id: ws.ownerId,
      name: "—",
      email: "—",
      status: "unknown",
      role: "user",
      emailVerified: false,
      createdAt: ws.createdAt,
    },
    fiscal: profile[0] ?? null,
    subscription: sub[0] ?? null,
    consents,
    audit,
    payments: pay.payments,
    paymentsUnavailable: pay.unavailable,
  };
}
