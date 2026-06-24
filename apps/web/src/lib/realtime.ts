import "server-only";
import Redis from "ioredis";
import { redisConfigured, redisUrl } from "./env";

/** Per-workspace pub/sub channel. Every dashboard tab for a workspace listens
 * here, so one publish lights up the links list and every link's detail tabs. */
export function workspaceChannel(workspaceId: string): string {
  return `realtime:ws:${workspaceId}`;
}

export type ClickEvent = { linkId: string; slug: string };

// A single publisher is reused across invocations — module scope survives within
// a warm serverless instance, so we avoid reconnecting on every click. Never
// share this with subscribers: a connection in subscribe mode can't publish.
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(redisUrl(), { maxRetriesPerRequest: 3 });
    publisher.on("error", (err) =>
      console.error("realtime.publisher_error", err),
    );
  }
  return publisher;
}

/** Best-effort publish of a click to the workspace channel. Never throws — a
 * realtime hiccup must not fail click ingestion. */
export async function publishClick(
  workspaceId: string,
  event: ClickEvent,
): Promise<void> {
  if (!redisConfigured()) return;
  try {
    await getPublisher().publish(
      workspaceChannel(workspaceId),
      JSON.stringify(event),
    );
  } catch (err) {
    console.error("realtime.publish_failed", err);
  }
}

/** A dedicated connection for SUBSCRIBE. The caller owns its lifecycle and must
 * disconnect it when the SSE stream ends. `maxRetriesPerRequest: null` keeps the
 * long-lived subscriber from erroring out while idle. */
export function createSubscriber(): Redis {
  return new Redis(redisUrl(), { maxRetriesPerRequest: null });
}
