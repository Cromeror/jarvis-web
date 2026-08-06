import { useEffect, useRef, useState } from 'react';
import { getToken } from '../lib/auth-api.js';
import type { BackgroundTaskLike } from '../lib/chat-queue.js';

/** One message already sent to Jarvis and not answered yet — what the input bar shows as "en cola". */
export interface QueuedCommand {
  uuid: string;
  text: string;
  /** 'queued' = waiting its turn; 'started' = Jarvis is already working on it. */
  state: 'queued' | 'started';
  queuedAt: number;
}

/** Mirrors packages/core's CoreStreamEvent, plus the markers the chat SSE endpoint adds. */
type ChatSseEvent =
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_use'; toolUseId: string; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; toolUseId: string; result: string; isError: boolean }
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'queue'; pending: QueuedCommand[] }
  /**
   * Forward del `system/background_tasks_changed` del CLI: la lista COMPLETA de
   * tareas vivas, no un delta. Llega `tasks: []` cuando se vació.
   *
   * Pendiente del lado del server: el stream parser todavía descarta las líneas
   * `system/task_*`, así que este evento no se emite. La UI ya lo maneja.
   */
  | { kind: 'background_tasks'; tasks: BackgroundTaskLike[] }
  | { kind: 'turn_end' }
  | { kind: 'plan_created'; plan_id: string }
  | { kind: 'error'; message: string; error_id?: string };

interface ChatStreamHandlers {
  /**
   * The stored history may have changed — refetch it.
   *
   * Called on every turn whose reply was persisted, and ALSO whenever the
   * connection (re)opens and whenever the session goes idle. Those two extras
   * are the safety net: a single missed event (a drop mid-turn, an
   * http-api restart, a reply written while this tab was disconnected) would
   * otherwise leave the conversation permanently showing a stale history
   * until the user reloads by hand. Refetching is a cheap GET; missing a
   * reply is not.
   */
  onHistoryChanged: () => void;
  /**
   * El stream (re)conectó. Momento de tirar cualquier estado optimista local:
   * las burbujas "Enviando…" que el consumidor mantenga por su cuenta no
   * sobreviven a un reinicio del server, y quedarían pegadas para siempre
   * porque el turno que las iba a resolver murió con el proceso.
   */
  onReconnected?: () => void;
  /** A plan_create ran during the turn that just ended. */
  onPlanCreated?: (planId: string) => void;
  /** The session failed with messages still unanswered. */
  onError?: (message: string) => void;
}

/**
 * Live view of one conversation — GET /api/chat/sessions/:id/stream.
 *
 * One connection per conversation, open for as long as it's selected: it is
 * not tied to a turn, so it covers both "I just sent something" and "I came
 * back to a conversation that was already working" with the same code path.
 * Messages are sent over a separate POST that returns 202 without waiting, so
 * this stream is the ONLY place the reply, the queue and any failure show up.
 *
 * Scope: only the currently active/selected session gets a live connection —
 * this does not track background sessions in a multi-conversation sidebar.
 */
export function useChatStream(sessionId: string | null, handlers: ChatStreamHandlers) {
  const [active, setActive] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [pending, setPending] = useState<QueuedCommand[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTaskLike[]>([]);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    setActive(false);
    setLiveText('');
    setPending([]);
    setBackgroundTasks([]);
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

      switch (data.kind) {
        case 'idle':
          setActive(false);
          setPending([]);
          setLiveText('');
          // OJO: `backgroundTasks` NO se limpia acá. Idle significa que no queda
          // nada sin contestar, no que no quede nada corriendo — verificado
          // contra el CLI real: una tarea sobrevive al turno que la lanzó. La
          // lista solo se vacía cuando el propio CLI manda `tasks: []`.
          //
          // Red de seguridad: si algún turn_end se perdió (caída del stream,
          // reinicio del server), quedar idle con historial viejo es el peor
          // estado posible — se ve una conversación sin su última respuesta.
          handlersRef.current.onHistoryChanged();
          return;
        case 'busy':
          setActive(true);
          return;
        case 'queue':
          setPending(data.pending);
          setActive(data.pending.length > 0);
          return;
        case 'background_tasks':
          // Reemplazo, no merge: el evento trae la lista completa.
          setBackgroundTasks(data.tasks);
          return;
        case 'turn_end':
          // Not a disconnect: more messages may be queued behind this turn.
          // The history now has the reply, so the live buffer must go.
          setLiveText('');
          handlersRef.current.onHistoryChanged();
          return;
        case 'plan_created':
          handlersRef.current.onPlanCreated?.(data.plan_id);
          return;
        case 'error':
          handlersRef.current.onError?.(data.message);
          return;
        case 'assistant_text':
          setActive(true);
          setLiveText((prev) => prev + data.text);
          return;
        default:
          setActive(true);
      }
    };
    // EventSource retries the connection on its own on a drop (e.g. an
    // http-api restart) — nothing to do here besides not crashing the UI.
    es.onerror = () => undefined;
    // Cada (re)conexión resincroniza DESDE CERO, no solo pide el historial.
    //
    // El estado de "trabajando" (turno activo, cola, tareas) es efímero: vive
    // en la memoria del proceso del server. Si ese proceso se reinició, lo que
    // había en vuelo se perdió — pero el front seguía mostrando su última foto
    // para siempre: "Enviando… / 1 esperando" sobre un mensaje que ya había
    // sido contestado. Y ni un refresh lo arreglaba, porque el estado se
    // reconstruía igual en cada carga.
    //
    // Se limpia y se deja que el server vuelva a decir la verdad: el `queue`
    // que manda al conectar repone lo que realmente sigue pendiente, y el
    // refetch del historial trae lo que se contestó mientras no escuchábamos.
    // Perder la marca por un instante es mucho mejor que mostrar una falsa.
    es.onopen = () => {
      setPending([]);
      setLiveText('');
      setActive(false);
      setBackgroundTasks([]);
      handlersRef.current.onReconnected?.();
      handlersRef.current.onHistoryChanged();
    };

    return () => es.close();
  }, [sessionId]);

  return { active, liveText, pending, backgroundTasks };
}
