import "server-only";
import type { KvLinkRecord } from "@linkview/shared";
import { kvEnv } from "./env";

const CF_API = "https://api.cloudflare.com/client/v4";

function kvKey(hostname: string, slug: string): string {
  return `link:${hostname}:${slug}`;
}

function kvUrl(key: string): string {
  const { accountId, namespaceId } = kvEnv();
  return `${CF_API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
}

/** Upsert the operational link record into Cloudflare KV (§16.1). */
export async function syncLinkToKv(
  hostname: string,
  slug: string,
  record: KvLinkRecord,
): Promise<void> {
  const { apiToken } = kvEnv();
  const res = await fetch(kvUrl(kvKey(hostname, slug)), {
    method: "PUT",
    headers: { authorization: `Bearer ${apiToken}` },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    throw new Error(`KV put failed (${res.status}): ${await res.text()}`);
  }
}

function wsKey(workspaceId: string): string {
  return `ws:${workspaceId}`;
}

/**
 * Mark a workspace's links dark in KV. The redirect Worker reads `ws:<id>` and,
 * when it finds `live:false`, stops redirecting and counting that workspace's
 * links — the mechanism behind read-only "locked" billing. Best-effort: a KV
 * failure must never break the billing transition (cron/webhook) that calls it.
 * Absence of the key means live, so the unlock path simply deletes it.
 */
export async function lockWorkspaceLinks(workspaceId: string): Promise<void> {
  try {
    const { apiToken } = kvEnv();
    const res = await fetch(kvUrl(wsKey(workspaceId)), {
      method: "PUT",
      headers: { authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({
        live: false,
        updatedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      throw new Error(`KV put failed (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.error("billing.kv_lock_failed", workspaceId, err);
  }
}

/** Bring a workspace's links back online (deletes the dark flag). Best-effort. */
export async function unlockWorkspaceLinks(workspaceId: string): Promise<void> {
  try {
    const { apiToken } = kvEnv();
    const res = await fetch(kvUrl(wsKey(workspaceId)), {
      method: "DELETE",
      headers: { authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`KV delete failed (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.error("billing.kv_unlock_failed", workspaceId, err);
  }
}

/** Remove a link record from KV (slug change / deletion). */
export async function removeLinkFromKv(
  hostname: string,
  slug: string,
): Promise<void> {
  const { apiToken } = kvEnv();
  const res = await fetch(kvUrl(kvKey(hostname, slug)), {
    method: "DELETE",
    headers: { authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`KV delete failed (${res.status}): ${await res.text()}`);
  }
}
