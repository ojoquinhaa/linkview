import "server-only";
import { getDb, user } from "@linkview/db";
import { ACCOUNT_CLOSURE_RETENTION_DAYS } from "@linkview/shared";
import { eq } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Account lifecycle status mirrored from `user.status`. */
export type AccountStatus = "active" | "suspended" | "deleted";

export interface AccountState {
  status: AccountStatus;
  /** When the account left the active lifecycle; starts the retention clock. */
  deletedAt: Date | null;
}

/** Read the lifecycle status (+ closure timestamp) for a user. */
export async function getAccountState(userId: string): Promise<AccountState> {
  const db = getDb();
  const [row] = await db
    .select({ status: user.status, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return {
    status: (row?.status as AccountStatus) ?? "active",
    deletedAt: row?.deletedAt ?? null,
  };
}

/** True only when the account is `active` (not suspended/closed). */
export async function accountIsActive(userId: string): Promise<boolean> {
  return (await getAccountState(userId)).status === "active";
}

export type AccountClosureKind = "suspended" | "deleted";

export interface AccountClosure {
  kind: AccountClosureKind;
  /** Days left before the retention purge soft-deletes the data, floored at 0. */
  daysLeft: number;
}

/**
 * Translate a non-active account state into the read-only closure notice shown
 * under the topbar. Returns null for an active account. The dashboard is kept
 * reachable read-only until `deletedAt + ACCOUNT_CLOSURE_RETENTION_DAYS`, after
 * which the maintenance job soft-deletes the owned workspaces.
 */
export function resolveAccountClosure(
  state: AccountState,
): AccountClosure | null {
  if (state.status === "active") return null;
  const startedMs = state.deletedAt?.getTime() ?? Date.now();
  const purgeMs = startedMs + ACCOUNT_CLOSURE_RETENTION_DAYS * DAY_MS;
  const daysLeft = Math.max(0, Math.ceil((purgeMs - Date.now()) / DAY_MS));
  return { kind: state.status, daysLeft };
}
