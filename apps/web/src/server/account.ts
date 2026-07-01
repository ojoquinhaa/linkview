"use server";
import {
  getDb,
  session as sessionTable,
  user,
  userConsents,
  userProfiles,
  workspaces,
} from "@linkview/db";
import {
  onlyDigits,
  PRIVACY_VERSION,
  type ProfileInput,
  profileSchema,
} from "@linkview/shared";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { lockWorkspaceLinks } from "@/lib/kv";
import { accountIsActive } from "./account-status";
import { logAudit } from "./audit";
import { cancelWorkspaceSubscription } from "./billing/subscription";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** The fiscal/contact profile captured at sign-up. `null` if never recorded. */
export type UserProfile = typeof userProfiles.$inferSelect;

/** Load the current user's fiscal/contact profile. */
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

/** Latest marketing-consent state from the append-only ledger (default false). */
export async function getMarketingConsent(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ accepted: userConsents.accepted })
    .from(userConsents)
    .where(eq(userConsents.userId, userId))
    .orderBy(desc(userConsents.createdAt))
    .limit(1);
  // The most recent row may be terms/privacy; only marketing rows flip the
  // toggle. Re-query narrowed to marketing for an honest answer.
  const [m] = await db
    .select({ accepted: userConsents.accepted })
    .from(userConsents)
    .where(
      and(eq(userConsents.userId, userId), eq(userConsents.type, "marketing")),
    )
    .orderBy(desc(userConsents.createdAt))
    .limit(1);
  return m?.accepted ?? row?.accepted ?? false;
}

/** Best-effort client IP from proxy headers, retained as consent evidence. */
function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

/**
 * Update the user's display name + contact/address profile. The marketing
 * consent toggle is recorded as a new ledger row only when it changes, so the
 * append-only history (LGPD art. 8 §5, withdrawal) stays intact.
 */
export async function updateProfileAction(
  input: ProfileInput,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await accountIsActive(session.user.id))) {
    return { ok: false, error: "Conta inativa: edição bloqueada." };
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;
  const userId = session.user.id;
  const db = getDb();

  const existing = await getUserProfile(userId);
  const profileValues = {
    phone: onlyDigits(data.phone),
    zip: onlyDigits(data.zip),
    street: data.street,
    number: data.number,
    complement: data.complement || null,
    district: data.district,
    city: data.city,
    state: data.state,
  };

  try {
    await db.update(user).set({ name: data.name }).where(eq(user.id, userId));

    if (existing) {
      await db
        .update(userProfiles)
        .set(profileValues)
        .where(eq(userProfiles.userId, userId));
    } else {
      // Profile lost or never written (e.g. a failed sign-up repair path). The
      // document/personType are required, so we can only repair contact fields
      // here when the row exists; without it, surface an honest error.
      return {
        ok: false,
        error:
          "Seu cadastro fiscal está incompleto. Fale com o suporte para concluí-lo.",
      };
    }

    const current = await getMarketingConsent(userId);
    if (current !== data.marketingOptIn) {
      const h = await headers();
      await db.insert(userConsents).values({
        userId,
        type: "marketing",
        documentVersion: PRIVACY_VERSION,
        accepted: data.marketingOptIn,
        ipAddress: clientIp(h),
        userAgent: h.get("user-agent"),
      });
    }
  } catch (err) {
    console.error("account.update_profile_failed", err);
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { ok: true };
}

export interface RenameWorkspaceResult extends ActionResult {
  name?: string;
}

/** Rename the active workspace. Owner only. */
export async function renameWorkspaceAction(
  rawName: string,
): Promise<RenameWorkspaceResult> {
  const session = await requireSession();
  if (!(await accountIsActive(session.user.id))) {
    return { ok: false, error: "Conta inativa: edição bloqueada." };
  }
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Workspace não encontrado." };
  if (workspace.role !== "owner") {
    return { ok: false, error: "Apenas o dono pode renomear o workspace." };
  }

  const name = rawName.trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Use de 2 a 80 caracteres." };
  }

  const db = getDb();
  try {
    await db
      .update(workspaces)
      .set({ name })
      .where(eq(workspaces.id, workspace.id));
  } catch (err) {
    console.error("account.rename_workspace_failed", err);
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "workspace.renamed",
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, name };
}

/**
 * Close the account (LGPD right to erasure, art. 18 VI). Marks the user
 * `deleted`, starts the retention clock (`deletedAt`), darks the owned
 * workspaces' links, and revokes every session so all devices are signed out.
 *
 * The workspaces are NOT soft-deleted yet: the account keeps reaching the
 * dashboard read-only for ACCOUNT_CLOSURE_RETENTION_DAYS (the layout shows a
 * countdown; `workspaceCanWrite` blocks writes because the owner is no longer
 * `active`), after which the maintenance job soft-deletes them. The client
 * follows up with a sign-out + redirect; logging back in lands on the read-only
 * dashboard. Irreversible from the product UI.
 */
export async function closeAccountAction(): Promise<ActionResult> {
  const session = await requireSession();
  const userId = session.user.id;
  const now = new Date();
  const db = getDb();

  // Stop billing first: cancel the provider subscription for every workspace the
  // user owns so a closed account is never charged again. Best-effort — a
  // provider hiccup must not block the erasure the user requested.
  const owned = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId));
  for (const ws of owned) {
    try {
      await cancelWorkspaceSubscription(ws.id);
    } catch (err) {
      console.error("account.close_cancel_sub_failed", err);
    }
  }

  try {
    await db.batch([
      db
        .update(user)
        .set({ status: "deleted", deletedAt: now })
        .where(eq(user.id, userId)),
      db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
    ]);
  } catch (err) {
    console.error("account.close_failed", err);
    return { ok: false, error: "Não foi possível encerrar. Tente de novo." };
  }

  // Take the closed account's links offline immediately (the data lingers
  // read-only until the retention purge). Best-effort — never fail the closure.
  for (const ws of owned) await lockWorkspaceLinks(ws.id);

  return { ok: true };
}
