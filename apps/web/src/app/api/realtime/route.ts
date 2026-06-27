import { createSubscriber, workspaceChannel } from "@/lib/realtime";
import { getSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

// ioredis needs Node; the stream must stay dynamic and uncached. maxDuration is
// the Vercel cap for how long one SSE connection lives — the browser's
// EventSource reconnects automatically after it, so updates never stop.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cap concurrent SSE streams per user (per warm instance) so a client can't
// exhaust the connection / Redis-subscriber budget by opening many EventSources.
const MAX_CONNECTIONS_PER_USER = 5;
const openConnections = new Map<string, number>();

/** Server-Sent Events stream of click activity for the caller's workspace. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return new Response("no workspace", { status: 403 });

  const userId = session.user.id;
  const openNow = openConnections.get(userId) ?? 0;
  if (openNow >= MAX_CONNECTIONS_PER_USER) {
    return new Response("too many connections", { status: 429 });
  }
  openConnections.set(userId, openNow + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const n = (openConnections.get(userId) ?? 1) - 1;
    if (n <= 0) openConnections.delete(userId);
    else openConnections.set(userId, n);
  };

  const channel = workspaceChannel(workspace.id);
  const sub = createSubscriber();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Tell the client how soon to retry, then open the stream.
      send("retry: 3000\n\n");
      send(": connected\n\n");

      sub.on("message", (_ch, message) => {
        send(`event: click\ndata: ${message}\n\n`);
      });
      await sub.subscribe(channel);

      // Keep proxies from dropping an idle connection.
      const heartbeat = setInterval(() => send(": ping\n\n"), 15000);

      const close = async () => {
        if (closed) return;
        closed = true;
        release();
        clearInterval(heartbeat);
        try {
          await sub.unsubscribe(channel);
        } catch {}
        sub.disconnect();
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener("abort", () => void close());
    },
    cancel() {
      release();
      sub.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
