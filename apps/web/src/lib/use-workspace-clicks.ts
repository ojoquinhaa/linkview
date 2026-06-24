"use client";

import { useEffect, useRef } from "react";

export type ClickPayload = { linkId?: string; slug?: string };
type Listener = (event: ClickPayload) => void;

// One EventSource backs every subscriber on the page. The overview's refresher
// and its "ao vivo" badge — or a link's tabs — would otherwise each open their
// own SSE stream, doubling the long-lived Redis subscribers on the server.
let source: EventSource | null = null;
let refCount = 0;
const listeners = new Set<Listener>();

function ensureSource() {
  if (source) return;
  source = new EventSource("/api/realtime");
  source.addEventListener("click", (event) => {
    let payload: ClickPayload = {};
    try {
      payload = JSON.parse((event as MessageEvent).data) as ClickPayload;
    } catch {
      // Malformed payload — fan out an empty event; consumers refresh anyway.
    }
    for (const listener of listeners) listener(payload);
  });
}

/**
 * Subscribe to the workspace click stream. Every caller shares a single
 * EventSource, opened on the first subscriber and closed when the last one
 * unmounts. `onClick` may change every render — the latest is always used.
 */
export function useWorkspaceClicks(onClick: Listener) {
  const ref = useRef(onClick);
  ref.current = onClick;

  useEffect(() => {
    const listener: Listener = (event) => ref.current(event);
    listeners.add(listener);
    refCount += 1;
    ensureSource();

    return () => {
      listeners.delete(listener);
      refCount -= 1;
      if (refCount === 0) {
        source?.close();
        source = null;
      }
    };
  }, []);
}
