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
