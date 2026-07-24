import { useEffect, useRef, useState } from 'react';
import { getToken } from '../lib/auth-api.js';

/** Mirrors packages/core's CoreStreamEvent, plus the two terminal markers the chat SSE endpoint adds. */
type ChatSseEvent =
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_use'; toolUseId: string; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; toolUseId: string; result: string; isError: boolean }
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done' };

/**
 * Reconnects to the live progress of a chat turn currently in flight for
 * `sessionId`, if any — GET /api/chat/sessions/:id/stream. Solves navigating
 * away mid-turn and coming back: on every mount/sessionId change this asks
 * the server "is this session still generating?" instead of relying on
 * local component state that would already be gone by then.
 *
 * Scope: only the currently active/selected session gets a live connection —
 * this does not track background sessions in a multi-conversation sidebar.
 */
export function useChatStream(sessionId: string | null, onDone: () => void) {
  const [active, setActive] = useState(false);
  const [liveText, setLiveText] = useState('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setActive(false);
    setLiveText('');
    if (!sessionId) return;

    // EventSource can't set an Authorization header (unlike every other API
    // call, patched globally in auth-fetch-interceptor.ts) — the JWT rides as
    // a query param instead, which JwtAuthGuard accepts as a fallback for
    // exactly this reason. No token yet (logged out) — nothing to stream.
    const token = getToken();
    if (!token) return;

    const es = new EventSource(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/stream?access_token=${encodeURIComponent(token)}`,
    );
    es.onmessage = (e: MessageEvent) => {
      let data: ChatSseEvent;
      try {
        data = JSON.parse(e.data as string) as ChatSseEvent;
      } catch {
        return; // ignore malformed events
      }

      if (data.kind === 'idle') {
        es.close();
        return;
      }
      if (data.kind === 'done') {
        setActive(false);
        es.close();
        onDoneRef.current();
        return;
      }
      setActive(true);
      if (data.kind === 'busy') return;
      if (data.kind === 'assistant_text') setLiveText((prev) => prev + data.text);
    };
    // EventSource retries the connection on its own on a drop (e.g. an
    // http-api restart) — nothing to do here besides not crashing the UI.
    es.onerror = () => undefined;

    return () => es.close();
  }, [sessionId]);

  return { active, liveText };
}
