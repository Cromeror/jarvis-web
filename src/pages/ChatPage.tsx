import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  listChatSessions,
  startChatSession,
  sendChatMessage,
  stopChatMessage,
  getChatMessages,
  deleteChatSession,
  renameChatSession,
  cancelQueuedMessage,
  stopBackgroundTask,
} from '../lib/chat-api.js';
import type { ChatSession, ChatMessage, ChatAttachmentInput } from '../lib/chat-api.js';
import { resolveQueueStates } from '../lib/chat-queue.js';
import type { QueuedMessageView } from '../components/ui/molecules/QueuePanel.js';
import { useChatStream } from '../hooks/useChatStream.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { PlanSidePanel } from '../components/Plan/PlanSidePanel.js';
import { ChatOptionsRail, type RailHoverPreviewData } from '../components/ui/organisms/ChatOptionsRail.js';
import type { RailListPanelItem, RailListPanelData } from '../components/ui/organisms/RailListPanel.js';
import type { BadgeStatus } from '../components/ui/atoms/Badge.js';
import { listPlans, launchPlan, approvePlan } from '../lib/plans-api.js';
import type { PlanSummary, PlanStatus } from '../lib/plans-api.js';
import { timeAgo, timeAgoPrecise, activeFor } from '../lib/time-ago.js';
import { useRailFocus } from '../hooks/useRailFocus.js';
import { markNotificationRead, type Notification } from '../lib/notifications-api.js';
import type { RailFocusPanelProject, RailFocusPanelAttentionItem, RailFocusPanelLiveEvent } from '../components/ui/organisms/RailFocusPanel.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';

/**
 * Chat view: conversations from all projects (or a filtered subset) side by
 * side, each tagged with its project. Every turn runs against the project's
 * own root_path via packages/mcp/src/api/chat.ts — see plan for backend details.
 */
interface SessionChatState {
  messages: ChatMessage[];
  pending: boolean;
  hasUnread: boolean;
  proposedPlanIds?: string[];
}

/**
 * Cuántas filas sueltas muestra ATENCIÓN antes de resumir el resto en la fila
 * "Ver más mensajes +N" (el diseño apila desde la 3ra, node 7493:905).
 */
const ATTENTION_VISIBLE_ROWS = 3;

/** La cola LIVE del diseño muestra los últimos eventos, no el log completo. */
const LIVE_VISIBLE_ROWS = 5;

/** Estado del plan → badge del rail (etiqueta + tono del átomo Badge). */
const PLAN_BADGE: Record<PlanStatus, { label: string; status: BadgeStatus }> = {
  draft: { label: 'Borrador', status: 'info' },
  approved: { label: 'Aprobado', status: 'success' },
  running: { label: 'Ejecutando', status: 'running' },
  done: { label: 'Completado', status: 'success' },
  failed: { label: 'Falló', status: 'failed' },
  archived: { label: 'Archivado', status: 'cancelled' },
};

/** Reads a File as a base64 string (without the data: URL prefix) for sending over JSON. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolvePromise(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatPage(): React.ReactElement {
  const { projectId: initialProjectId, sessionId: routeSessionId } = useParams<{ projectId?: string; sessionId?: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;
  const [chatBySession, setChatBySession] = useState<Record<string, SessionChatState>>({});
  // Burbujas optimistas recién enviadas → el uuid con el que quedaron
  // encoladas (null hasta que el POST responde). Existe por dos razones:
  // el aviso de "estoy trabajando en esto" tiene que ser inmediato y local
  // (esperar el `queue` del stream deja un hueco donde apretás enviar y no
  // pasa nada visible), y una vez conocido el uuid el estado se lee del
  // stream sin que quede ningún instante sin marca.
  const [sentUuidByOptimisticId, setSentUuidByOptimisticId] = useState<Map<number, string | null>>(new Map());
  // Independent of any session — the user can toggle Plan Mode before a
  // conversation exists yet (empty chat, nothing sent), so it can't live
  // nested under chatBySession[activeSessionId], which wouldn't exist then.
  const [planMode, setPlanMode] = useState(false);
  // Which plan is open in the side panel — null means the panel is hidden.
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  // Opción activa del rail derecho — Focus es un ítem más del acordeón (ver
  // ChatOptionsRail), arranca abierto por default; null = las 4 opciones
  // están plegadas (nada abierto, estado legítimo pero no el inicial).
  const [railOption, setRailOption] = useState<string | null>('focus');
  // Planes del proyecto activo — se cargan solo cuando el panel de Planes del rail está abierto.
  const [railPlans, setRailPlans] = useState<PlanSummary[]>([]);
  const [railPlansLoading, setRailPlansLoading] = useState(false);
  const [railPlansError, setRailPlansError] = useState<string | null>(null);
  // Se incrementa al terminar cada turno para recargar la lista de planes. El
  // evento `plan_created` sigue siendo el camino preciso (abre el panel del
  // plan nuevo), pero depende de poder atribuir la ejecución de `plan_create` a
  // esta sesión; esto es el piso: después de cualquier turno la lista está
  // fresca, haya llegado el evento o no.
  const [railPlansToken, setRailPlansToken] = useState(0);

  const patchSession = useCallback(
    (sessionId: string, patch: Partial<SessionChatState> | ((current: SessionChatState) => Partial<SessionChatState>)) => {
      setChatBySession((prev) => {
        const current: SessionChatState = prev[sessionId] ?? { messages: [], pending: false, hasUnread: false };
        const resolved = typeof patch === 'function' ? patch(current) : patch;
        return { ...prev, [sessionId]: { ...current, ...resolved } };
      });
    },
    [],
  );

  useEffect(() => {
    listProjects().catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
    }).then((data) => {
      if (data) setProjects(data);
    });
  }, [addToast]);

  const loadSessions = useCallback(
    (projectIds: string[]) => {
      Promise.all(projectIds.map((id) => listChatSessions(id)))
        .then((results) =>
          setSessions(
            results.flat().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
          ),
        )
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar conversaciones', 'error');
        });
    },
    [addToast],
  );

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  useEffect(() => {
    if (projectIds.length > 0) loadSessions(projectIds);
  }, [projectIds.join(','), loadSessions]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      setOpenPlanId(null);
      patchSession(sessionId, { hasUnread: false });
      getChatMessages(sessionId)
        .then((fresh) => patchSession(sessionId, { messages: fresh }))
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar mensajes', 'error');
        });
    },
    [addToast, patchSession],
  );

  // Restaura la conversación activa desde la URL (deep-link) — así un reload
  // no la pierde. La navegación hacia esta URL (selectSession/handleNewSession)
  // no dispara este efecto de nuevo porque el sessionId de la ruta no cambia.
  useEffect(() => {
    if (routeSessionId) handleSelectSession(routeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId]);

  // Mantiene la URL en sync con la conversación elegida por el usuario (click
  // en la lista, o al mandar el primer mensaje sin conversación activa).
  const selectSessionAndNavigate = useCallback(
    (sessionId: string, projectId?: string | null) => {
      handleSelectSession(sessionId);
      const targetProjectId = projectId ?? sessions.find((s) => s.id === sessionId)?.project_id;
      if (targetProjectId) navigate(`/chat/${targetProjectId}/${sessionId}`, { replace: true });
    },
    [handleSelectSession, navigate, sessions],
  );

  // /chat "a secas" (sin projectId ni sessionId en la URL) retoma la conversación
  // más reciente en vez de dejar una sesión activa "invisible": antes, si ya había
  // una activeSessionId de una navegación previa dentro de la app (React Router no
  // remonta ChatPage entre /chat, /chat/:id y /chat/:id/:sid, son la misma ruta),
  // se seguía pudiendo escribir en esa conversación sin que la barra superior
  // mostrara a qué proyecto pertenecía. Ahora queda explícito: se selecciona y se
  // refleja en la URL + en el chip de proyecto.
  useEffect(() => {
    if (routeSessionId || initialProjectId || activeSessionId || sessions.length === 0) return;
    const mostRecent = [...sessions].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0]!;
    selectSessionAndNavigate(mostRecent.id, mostRecent.project_id);
  }, [routeSessionId, initialProjectId, activeSessionId, sessions, selectSessionAndNavigate]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!confirm('¿Eliminar esta conversación?')) return;
      try {
        await deleteChatSession(sessionId);
        if (sessionId === activeSessionId) {
          setActiveSessionId(null);
          navigate('/chat', { replace: true });
        }
        setChatBySession((prev) => {
          const { [sessionId]: _removed, ...rest } = prev;
          return rest;
        });
        loadSessions(projectIds);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al eliminar la conversación', 'error');
      }
    },
    [activeSessionId, loadSessions, projectIds, addToast, navigate],
  );

  const handleRenameSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        const updated = await renameChatSession(sessionId, title);
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al renombrar la conversación', 'error');
      }
    },
    [addToast],
  );

  const handleNewSession = useCallback(
    async (projectId: string) => {
      try {
        const { session_id } = await startChatSession(projectId);
        setActiveSessionId(session_id);
        patchSession(session_id, { messages: [] });
        navigate(`/chat/${projectId}/${session_id}`, { replace: true });
        loadSessions(projectIds);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al crear la conversación', 'error');
      }
    },
    [loadSessions, projectIds, addToast, patchSession, navigate],
  );

  // La ruta /chat/:projectId (si viene, sin sessionId) llega desde el CardProject del
  // dashboard — arranca directo una conversación nueva para ese proyecto.
  useEffect(() => {
    if (initialProjectId && !routeSessionId) void handleNewSession(initialProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  const handleSend = useCallback(
    async (message: string, attachmentFiles?: File[], planMode?: boolean) => {
      const sessionId = activeSessionId;
      if (!sessionId) {
        addToast('Elegí "Nueva conversación" para empezar', 'error');
        return;
      }
      const activeSessionIdForSend = sessionId;
      const optimisticId = Date.now();
      setSentUuidByOptimisticId((prev) => new Map(prev).set(optimisticId, null));

      setChatBySession((prev) => {
        const current = prev[activeSessionIdForSend] ?? { messages: [], pending: false };
        return {
          ...prev,
          [activeSessionIdForSend]: {
            ...current,
            messages: [
              ...current.messages,
              {
                id: optimisticId,
                session_id: activeSessionIdForSend,
                role: 'user',
                content: message,
                tool_calls: null,
                created_at: new Date().toISOString(),
                input_tokens: null,
                output_tokens: null,
                context_used_percent: null,
                duration_ms: null,
                attachments: attachmentFiles?.length
                  ? JSON.stringify(attachmentFiles.map((f) => ({ filename: f.name })))
                  : null,
                // El uuid real lo asigna el backend al encolar; hasta el
                // próximo refetch esta burbuja optimista se muestra suelta,
                // que es exactamente lo que es: mandada y sin contestar.
                command_uuid: null,
                answers_command_uuids: null,
              },
            ],
          },
        };
      });
      patchSession(activeSessionIdForSend, { pending: true });
      try {
        let attachments: ChatAttachmentInput[] | undefined;
        if (attachmentFiles?.length) {
          attachments = await Promise.all(
            attachmentFiles.map(async (file) => ({
              filename: file.name,
              content_base64: await fileToBase64(file),
            })),
          );
        }
        // Returns as soon as the message is queued — the reply arrives over
        // the conversation's SSE stream, so nothing here waits for the turn
        // and the user can send the next message right away.
        const queued = await sendChatMessage(activeSessionIdForSend, message, attachments, planMode ? 'plan' : undefined);
        // Con el uuid ya se puede leer el estado real del stream ('queued' /
        // 'started') sobre esta misma burbuja. NO se borra la entrada acá: si
        // se borrara, entre el 202 y el primer evento del stream el mensaje
        // quedaría sin ninguna marca, que es justo el hueco a evitar.
        if (queued.command_uuid) {
          setSentUuidByOptimisticId((prev) => new Map(prev).set(optimisticId, queued.command_uuid));
        }
        loadSessions(projectIds);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al enviar el mensaje', 'error');
        patchSession(activeSessionIdForSend, { pending: false });
        setSentUuidByOptimisticId((prev) => {
          const next = new Map(prev);
          next.delete(optimisticId);
          return next;
        });
      }
    },
    [activeSessionId, loadSessions, projectIds, addToast, patchSession],
  );

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    stopChatMessage(activeSessionId).catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al detener la respuesta', 'error');
    });
  }, [activeSessionId, addToast]);

  /**
   * Saca UN mensaje de la cola sin tocar el turno en curso.
   *
   * Sin `commandUuid` no hay nada que cancelar: el mensaje se mandó pero el POST
   * todavía no volvió con su uuid, así que el CLI ni lo conoce. Es una ventana de
   * milisegundos, pero la fila ya está en pantalla y hay que decir algo.
   */
  const handleRemoveQueued = useCallback(
    (message: QueuedMessageView) => {
      if (!activeSessionId) return;
      if (!message.commandUuid) {
        addToast('Todavía no se puede quitar: el mensaje se está enviando', 'info');
        return;
      }
      cancelQueuedMessage(activeSessionId, message.commandUuid)
        .then((res) => {
          // cancelled:false = el CLI ya lo había drenado al turno. No es un
          // error, pero el usuario tiene que saber que sigue en camino.
          if (!res.cancelled) addToast('El mensaje ya había empezado a procesarse', 'info');
        })
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al quitar el mensaje de la cola', 'error');
        });
    },
    [activeSessionId, addToast],
  );

  /** Vacía la cola y aborta el turno — es el mismo control que el botón Detener. */
  const handleClearQueue = useCallback(() => {
    if (!activeSessionId) return;
    stopChatMessage(activeSessionId, true).catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al vaciar la cola', 'error');
    });
  }, [activeSessionId, addToast]);

  const handleStopBackgroundTask = useCallback(
    (taskId: string) => {
      if (!activeSessionId) return;
      stopBackgroundTask(activeSessionId, taskId).catch((err: unknown) => {
        addToast(err instanceof Error ? err.message : 'Error al detener la tarea', 'error');
      });
    },
    [activeSessionId, addToast],
  );

  const handleStopAllBackgroundTasks = useCallback(() => {
    if (!activeSessionId) return;
    stopBackgroundTask(activeSessionId).catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al detener las tareas', 'error');
    });
  }, [activeSessionId, addToast]);

  // Fires on every turn the stream reports finished — the one this mount sent,
  // and equally the one it never saw (navigated away mid-turn and came back,
  // or a hard reload). Nothing local tracks turn completion any more: sending
  // no longer awaits a promise, so this is the only refresh path.
  const handleTurnEnd = useCallback(() => {
    if (!activeSessionId) return;
    const doneSessionId = activeSessionId;
    getChatMessages(doneSessionId)
      .then((fresh) => {
        patchSession(doneSessionId, {
          messages: fresh,
          hasUnread: activeSessionIdRef.current !== doneSessionId,
        });
        // El historial ya trae esas filas con su uuid propio, así que las
        // burbujas optimistas dejaron de existir: limpiar evita que el mapa
        // crezca para siempre en una conversación larga.
        setSentUuidByOptimisticId((prev) => (prev.size === 0 ? prev : new Map()));
      })
      .catch((err: unknown) => {
        addToast(err instanceof Error ? err.message : 'Error al cargar mensajes', 'error');
      });
    loadSessions(projectIds);
    // Un turno pudo haber creado, editado o aprobado un plan — el rail se
    // revalida siempre al cerrar el turno, no solo cuando llega `plan_created`.
    setRailPlansToken((n) => n + 1);
  }, [activeSessionId, patchSession, loadSessions, projectIds, addToast]);

  /**
   * El stream reconectó: se tiran las burbujas optimistas.
   *
   * Sin esto quedaban pegadas. `sentUuidByOptimisticId` solo se limpiaba dentro
   * del refetch de `handleTurnEnd`, o sea al cerrar un turno — y si el server se
   * reinició, ese turno murió con el proceso y nunca hubo cierre. El síntoma era
   * una burbuja "Enviando… hola" permanente, incluso después de recargar la
   * página, sobre un mensaje que en la base ya tenía su respuesta.
   *
   * Si el mensaje sí quedó encolado de verdad, el `queue` que el server manda al
   * conectar lo vuelve a marcar enseguida.
   */
  const handleReconnected = useCallback(() => {
    setSentUuidByOptimisticId((prev) => (prev.size === 0 ? prev : new Map()));
    if (activeSessionId) patchSession(activeSessionId, { pending: false });
  }, [activeSessionId, patchSession]);

  const handlePlanCreated = useCallback(
    (planId: string) => {
      if (!activeSessionId) return;
      patchSession(activeSessionId, (current) => ({
        proposedPlanIds: [...(current.proposedPlanIds ?? []), planId],
      }));
      setOpenPlanId(planId);
    },
    [activeSessionId, patchSession],
  );

  const handleStreamError = useCallback(
    (message: string) => {
      addToast(message, 'error');
    },
    [addToast],
  );

  const {
    active: streamActive,
    liveText,
    pending: queuedCommands,
    backgroundTasks,
  } = useChatStream(activeSessionId, {
    onHistoryChanged: handleTurnEnd,
    onReconnected: handleReconnected,
    onPlanCreated: handlePlanCreated,
    onError: handleStreamError,
  });

  // `pending` was optimistic-only while sending awaited the turn; now the
  // stream owns the truth. Clearing it when the stream reports idle keeps the
  // "trabajando" indicators from sticking after everything is answered.
  useEffect(() => {
    if (!activeSessionId || streamActive) return;
    patchSession(activeSessionId, { pending: false });
  }, [activeSessionId, streamActive, patchSession]);

  // Qué mensaje del historial corresponde a cada ítem de la cola: se matchea
  // por `command_uuid`, el mismo id con el que el mensaje se encoló en el CLI
  // y con el que después la respuesta lo referencia. Por posición o por texto
  // sería frágil (dos mensajes iguales, "hola" y "hola", colisionan).
  const queueStates = useMemo(() => {
    const messages = activeSessionId ? chatBySession[activeSessionId]?.messages ?? [] : [];
    return resolveQueueStates(messages, queuedCommands, sentUuidByOptimisticId);
  }, [queuedCommands, sentUuidByOptimisticId, activeSessionId, chatBySession]);

  const activeChat = activeSessionId ? chatBySession[activeSessionId] : undefined;
  const activeProjectId = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.project_id ?? null,
    [sessions, activeSessionId],
  );
  // Salto de tab de proyecto: siempre a la conversación más reciente de ese
  // proyecto — el puntero se recalcula en cada click, nunca queda fijado a
  // un id (ver project_chat_topbar_tabstrip en memoria).
  const handleSelectProject = useCallback(
    (projectId: string) => {
      const mostRecent = sessions
        .filter((s) => s.project_id === projectId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
      if (mostRecent) selectSessionAndNavigate(mostRecent.id, projectId);
    },
    [sessions, selectSessionAndNavigate],
  );
  // Los planes alimentan la opción "Planes" (todos), "Ejecuciones" (los ya
  // lanzados) y el hover-preview de Ejecuciones en el rail colapsado — este
  // último necesita el dato disponible aunque el acordeón no esté abierto,
  // así que el fetch ya no depende de `railOption`, solo de haber un
  // proyecto activo. Se recarga al cambiar de proyecto y cuando cambia el
  // plan abierto (un turno con plan nuevo mueve `openPlanId`, así el rail no
  // queda mostrando una lista vieja), y al cerrar cada turno vía
  // `railPlansToken` — que es lo que cubre el turno que creó un plan sin que
  // llegara el evento `plan_created`.
  useEffect(() => {
    if (!activeProjectId) {
      setRailPlans([]);
      return;
    }
    let cancelled = false;
    setRailPlansLoading(true);
    setRailPlansError(null);
    listPlans(activeProjectId)
      .then((data) => { if (!cancelled) setRailPlans(data); })
      .catch((err: unknown) => { if (!cancelled) setRailPlansError(err instanceof Error ? err.message : 'Error al cargar planes'); })
      .finally(() => { if (!cancelled) setRailPlansLoading(false); });
    return () => { cancelled = true; };
  }, [activeProjectId, openPlanId, railPlansToken]);

  const activeProjectName = useMemo(
    () => projects.find((p) => p.id === activeProjectId)?.name ?? activeProjectId ?? '',
    [projects, activeProjectId],
  );

  const railPlanItems = useMemo<RailListPanelItem[]>(
    () =>
      railPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        subtitle: `${activeProjectName} · ${timeAgo(plan.updated_at)}`,
        badge: PLAN_BADGE[plan.status],
        canAct: plan.status === 'approved',
      })),
    [railPlans, activeProjectName],
  );

  // "Ejecuciones" = los planes de este proyecto que ya se lanzaron al menos
  // una vez (running/done/failed) — no hay un endpoint propio de "listar
  // runs", así que se deriva del mismo listado de planes en vez de inventar
  // una API nueva. Sin acción propia (ya están en curso o terminados) — solo
  // abren el detalle del plan, igual que en "Planes".
  const railRunItems = useMemo<RailListPanelItem[]>(
    () =>
      railPlans
        .filter((plan) => plan.status === 'running' || plan.status === 'done' || plan.status === 'failed')
        .map((plan) => ({
          id: plan.id,
          title: plan.title,
          subtitle: `${activeProjectName} · ${timeAgo(plan.updated_at)}`,
          badge: PLAN_BADGE[plan.status],
        })),
    [railPlans, activeProjectName],
  );

  // "Historial" = conversaciones anteriores del proyecto activo — mismos
  // `sessions` que ya alimentan ProjectTabStrip/ConversationSwitcher, sin
  // fetch propio. Clickear una fila salta a esa conversación.
  const railHistoryItems = useMemo<RailListPanelItem[]>(
    () =>
      sessions
        .filter((s) => s.project_id === activeProjectId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .map((s) => ({
          id: s.id,
          title: s.title ?? 'Nueva conversación',
          subtitle: timeAgo(s.updated_at),
        })),
    [sessions, activeProjectId],
  );

  const handleLaunchPlan = useCallback(
    async (planId: string) => {
      try {
        const { run_id } = await launchPlan(planId);
        navigate(`/plan-runs/${run_id}`);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al lanzar el plan', 'error');
      }
    },
    [navigate, addToast],
  );

  // Mensajes de "nada que mostrar" — compartidos entre el ContentPanel
  // expandido (RailListPanel) y la tarjeta de hover del rail colapsado
  // (RailHoverPreview), para no tener dos redacciones distintas del mismo
  // estado vacío.
  const railPlansEmptyLabel = activeProjectId ? 'Este proyecto todavía no tiene planes.' : 'Elegí una conversación para ver sus planes.';
  const railExecutionsEmptyLabel = activeProjectId ? 'Este proyecto todavía no tiene ejecuciones.' : 'Elegí una conversación para ver sus ejecuciones.';
  const railHistoryEmptyLabel = activeProjectId ? 'Este proyecto todavía no tiene conversaciones anteriores.' : 'Elegí una conversación para ver su historial.';

  // Datos de la "Lista compacta" por opción del acordeón del rail — las 3
  // (Planes/Ejecuciones/Historial) se comportan igual sin excepción, solo
  // cambian los datos y qué pasa al clickear una fila.
  const railPanels = useMemo<Partial<Record<string, RailListPanelData>>>(
    () => ({
      plans: {
        items: railPlanItems,
        loading: railPlansLoading,
        error: railPlansError,
        emptyLabel: railPlansEmptyLabel,
        actionLabel: 'Lanzar plan',
        onSelectItem: setOpenPlanId,
        onAction: (planId) => void handleLaunchPlan(planId),
      },
      executions: {
        items: railRunItems,
        loading: railPlansLoading,
        error: railPlansError,
        emptyLabel: railExecutionsEmptyLabel,
        onSelectItem: setOpenPlanId,
      },
      history: {
        items: railHistoryItems,
        emptyLabel: railHistoryEmptyLabel,
        onSelectItem: (sessionId) => selectSessionAndNavigate(sessionId, activeProjectId),
      },
    }),
    [
      railPlanItems,
      railRunItems,
      railHistoryItems,
      railPlansLoading,
      railPlansError,
      railPlansEmptyLabel,
      railExecutionsEmptyLabel,
      railHistoryEmptyLabel,
      activeProjectId,
      handleLaunchPlan,
      selectSessionAndNavigate,
    ],
  );

  const handleApprovePlan = useCallback(
    async (planId: string) => {
      try {
        await approvePlan(planId);
        addToast('Plan aprobado', 'success');
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al aprobar el plan', 'error');
      }
    },
    [addToast],
  );

  // --- Rail de Focus/Atención/Live -----------------------------------------
  // Datos reales del módulo notify: el foco lo reporta el propio chat con
  // notify_focus_update, los eventos con notify_event (ver packages/tools/notify).
  const {
    focus,
    inbox,
    liveEvents,
    sessionPlan,
    draftPlanIds,
    now: railNow,
    refresh: refreshRail,
  } = useRailFocus(activeSessionId, activeProjectId);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  /**
   * "Crear plan" no puede crear el plan por sí solo: plan_create exige título,
   * contexto, arquitectura y el grafo completo de steps. Lo que hace es pedirle
   * al chat que lo genere, usando el título sugerido como semilla.
   */
  const handleCreateSuggestedPlan = useCallback(
    (suggestedTitle: string) => {
      // Plan mode va como argumento del turno, no por el toggle: setPlanMode no
      // habría aplicado a este envío (el estado se lee en el próximo render) y
      // además dejaría el toggle prendido para los mensajes siguientes.
      void handleSend(`Creá el plan "${suggestedTitle}" que propusiste para esta conversación.`, undefined, true);
    },
    [handleSend],
  );

  const railFocusProject = useMemo<RailFocusPanelProject | null>(() => {
    if (!focus || !activeSession) return null;

    const projectName =
      projects.find((p) => p.id === (focus.project_id ?? activeSession.project_id))?.name ??
      focus.project_id ??
      activeSession.project_id ??
      'Sin proyecto';

    // Un plan `archived` ya no es el foco de la conversación; el resto de los
    // estados sí describen en qué anda el plan de este chat.
    const plan = sessionPlan && sessionPlan.status !== 'archived' ? sessionPlan : null;

    return {
      // Duración de la conversación, no del foco: session_focus solo guarda
      // cuándo se actualizó por última vez, no cuándo empezó este foco.
      durationLabel: activeFor(activeSession.created_at, railNow),
      projectName,
      title: focus.title,
      description: focus.summary,
      badge: plan ? PLAN_BADGE[plan.status] : null,
      updatedLabel: plan ? `Actualizado ${timeAgoPrecise(plan.updated_at, railNow)}` : null,
      // Con plan: aprobar/lanzar. Sin plan: la sugerencia del modelo y crearlo.
      suggestedPlanTitle: plan ? null : focus.suggested_plan_title,
      actions: plan
        ? [
            ...(plan.status === 'draft' ? [{ label: 'Aprobar', onClick: () => void handleApprovePlan(plan.id) }] : []),
            ...(plan.status === 'approved' || plan.status === 'draft'
              ? [{ label: 'Lanzar ahora', onClick: () => void handleLaunchPlan(plan.id) }]
              : []),
          ]
        : focus.suggested_plan_title
          ? [{ label: 'Crear plan', onClick: () => handleCreateSuggestedPlan(focus.suggested_plan_title!) }]
          : [],
    };
  }, [focus, activeSession, projects, sessionPlan, railNow, handleApprovePlan, handleLaunchPlan, handleCreateSuggestedPlan]);

  /** Silenciar: sale del Inbox, sigue en el log y en LIVE. */
  const dismissNotification = useCallback(
    async (id: number) => {
      try {
        await markNotificationRead(id);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al silenciar la notificación', 'error');
      } finally {
        // Refresca igual si falló: así la fila no queda “fantasma” si otro
        // proceso ya la había resuelto.
        refreshRail();
      }
    },
    [addToast, refreshRail],
  );

  /**
   * Click en la fila = ir a donde está la acción Y darla por atendida, como un
   * inbox de mail. A dónde lleva depende del target que reportó el modelo; sin
   * target la fila es informativa y solo se silencia.
   */
  const openNotificationTarget = useCallback(
    (notification: Notification) => {
      const { target_kind: kind, target_id: targetId, session_id: sessionId, project_id: projectId } = notification;

      if (kind === 'plan' && targetId) {
        // El plan se aprueba desde su panel, que vive dentro de la conversación
        // que lo propuso; sin sesión conocida, la lista de planes del proyecto.
        if (sessionId) {
          selectSessionAndNavigate(sessionId, projectId);
          setOpenPlanId(targetId);
        } else if (projectId) {
          navigate(`/plans/${projectId}`);
        }
      } else if (kind === 'plan_run' && targetId) {
        navigate(`/plan-runs/${targetId}`);
      } else if (kind === 'pipeline_run' && targetId) {
        navigate(`/pipeline/${targetId}`);
      } else if ((kind === 'session' && targetId) || sessionId) {
        const target = kind === 'session' && targetId ? targetId : sessionId!;
        selectSessionAndNavigate(target, projectId);
      }

      void dismissNotification(notification.id);
    },
    [navigate, selectSessionAndNavigate, dismissNotification],
  );

  /** Aprobar sin moverse del rail — evita el viaje de ida y vuelta al panel del plan. */
  const approveFromInbox = useCallback(
    async (planId: string, notificationId: number) => {
      await handleApprovePlan(planId);
      // El backend ya marca leídas las notificaciones del plan al aprobarlo
      // (plans.controller); esto solo refresca para que la fila se vaya ya.
      void dismissNotification(notificationId);
    },
    [handleApprovePlan, dismissNotification],
  );

  /**
   * ATENCIÓN vs LIVE: el criterio de Inbox es "algo pendiente de tu atención"
   * y el de Live "qué está pasando ahora", así que `warning` no leído va a la
   * primera y el feed completo a la segunda. Es el motivo por el que `warning`
   * existe como status en el backend.
   */
  const railAttentionItems = useMemo<RailFocusPanelAttentionItem[]>(
    () =>
      inbox.slice(0, ATTENTION_VISIBLE_ROWS).map((n) => ({
        id: String(n.id),
        text: n.text,
        action:
          n.target_kind === 'plan' && n.target_id && draftPlanIds.has(n.target_id)
            ? { label: 'Aprobar', onClick: () => void approveFromInbox(n.target_id!, n.id) }
            : undefined,
        onDismiss: () => void dismissNotification(n.id),
      })),
    [inbox, draftPlanIds, approveFromInbox, dismissNotification],
  );

  const railAttentionOverflow = useMemo(
    () => Math.max(0, inbox.length - ATTENTION_VISIBLE_ROWS),
    [inbox],
  );

  const handleAttentionItemClick = useCallback(
    (id: string) => {
      const target = inbox.find((n) => String(n.id) === id);
      if (target) openNotificationTarget(target);
    },
    [inbox, openNotificationTarget],
  );

  const railLiveEvents = useMemo<RailFocusPanelLiveEvent[]>(
    () =>
      liveEvents
        .filter((n) => n.status !== 'warning')
        .slice(0, LIVE_VISIBLE_ROWS)
        .map((n) => ({
          id: String(n.id),
          status: n.status as RailFocusPanelLiveEvent['status'],
          text: n.text,
          timestamp: timeAgoPrecise(n.created_at, railNow),
        })),
    [liveEvents, railNow],
  );

  // Hover-preview del rail colapsado (Figma ChatOptionsRail/HoverPreview) —
  // los 4 ítems lo usan sin excepción, nunca el tooltip nativo (ver
  // RailHoverPreview/ChatOptionsRail: sin `title` acá cae en la variante
  // vacía de la tarjeta, no en el tooltip del browser). Focus/Ejecuciones
  // tienen layout propio en Figma; Planes/Historial reusan el mismo layout
  // con su ítem más reciente como resumen. "Trabajando" reusa `streamActive`
  // (mismo activeSessionId que arma railFocusProject) en vez de inventar un
  // estado nuevo. Ejecuciones muestra la corriendo más reciente (o la última
  // actualizada si no hay ninguna corriendo) en una versión reducida — sin
  // worktree/%/réplicas del frame original, esos datos no existen en el
  // modelo de planes.
  const focusHoverPreview = useMemo<RailHoverPreviewData>(() => {
    if (!railFocusProject) return { headerLabel: 'FOCUS ACTUAL', emptyLabel: 'Sin foco reportado en esta conversación.' };
    return {
      headerLabel: 'FOCUS ACTUAL',
      title: railFocusProject.projectName,
      subtitle: railFocusProject.title ?? railFocusProject.description,
      badge: railFocusProject.badge,
      statusText: streamActive ? 'Trabajando' : null,
    };
  }, [railFocusProject, streamActive]);

  const executionsHoverPreview = useMemo<RailHoverPreviewData>(() => {
    if (railRunItems.length === 0) return { headerLabel: 'EJECUCIONES', emptyLabel: railExecutionsEmptyLabel };
    const primary = railRunItems.find((r) => r.badge?.status === 'running') ?? railRunItems[0]!;
    return {
      headerLabel: 'EJECUCIONES',
      title: primary.title,
      subtitle: activeProjectName,
      badge: primary.badge ?? null,
    };
  }, [railRunItems, activeProjectName, railExecutionsEmptyLabel]);

  const plansHoverPreview = useMemo<RailHoverPreviewData>(() => {
    if (railPlanItems.length === 0) return { headerLabel: 'PLANES', emptyLabel: railPlansEmptyLabel };
    const primary = railPlanItems[0]!;
    return { headerLabel: 'PLANES', title: primary.title, subtitle: primary.subtitle, badge: primary.badge };
  }, [railPlanItems, railPlansEmptyLabel]);

  const historyHoverPreview = useMemo<RailHoverPreviewData>(() => {
    if (railHistoryItems.length === 0) return { headerLabel: 'HISTORIAL', emptyLabel: railHistoryEmptyLabel };
    const primary = railHistoryItems[0]!;
    return { headerLabel: 'HISTORIAL', title: primary.title, subtitle: primary.subtitle };
  }, [railHistoryItems, railHistoryEmptyLabel]);

  const railHoverPreviews = useMemo<Partial<Record<string, RailHoverPreviewData>>>(
    () => ({
      focus: focusHoverPreview,
      executions: executionsHoverPreview,
      plans: plansHoverPreview,
      history: historyHoverPreview,
    }),
    [focusHoverPreview, executionsHoverPreview, plansHoverPreview, historyHoverPreview],
  );

  const pendingSessionIds = new Set(
    Object.entries(chatBySession)
      .filter(([, state]) => state.pending)
      .map(([sessionId]) => sessionId),
  );
  const unreadSessionIds = new Set(
    Object.entries(chatBySession)
      .filter(([, state]) => state.hasUnread)
      .map(([sessionId]) => sessionId),
  );

  return (
    // La página vive DENTRO del Content slot del AppShell: no pinta fondo propio
    // (antes tapaba el degradé del slot con --app-bg opaco, que es reemplazarlo,
    // no rellenarlo). ChatContent y el rail son tarjetas adentro del slot —
    // padding 8 + gap 8 es lo que cierra el ancho del frame de Figma:
    // 1344 = 8 + 970 (ChatContent) + 8 + 350 (rail) + 8.
    <div className="flex h-full flex-col" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex flex-1 gap-[var(--layout-gap)] overflow-hidden p-[var(--layout-padding)]">
        <ChatWindow
          messages={activeChat?.messages ?? []}
          pending={(activeChat?.pending ?? false) || streamActive}
          liveText={liveText}
          onSend={handleSend}
          onStop={handleStop}
          queueStates={queueStates}
          onRemoveQueued={handleRemoveQueued}
          onClearQueue={handleClearQueue}
          backgroundTasks={backgroundTasks}
          onStopBackgroundTask={handleStopBackgroundTask}
          onStopAllBackgroundTasks={handleStopAllBackgroundTasks}
          planMode={planMode}
          onTogglePlanMode={setPlanMode}
          proposedPlanIds={activeChat?.proposedPlanIds}
          onOpenPlan={setOpenPlanId}
          activeProjectId={activeProjectId}
          sessions={sessions}
          activeSessionId={activeSessionId}
          pendingSessionIds={pendingSessionIds}
          unreadSessionIds={unreadSessionIds}
          onSelectSession={selectSessionAndNavigate}
          onSelectProject={handleSelectProject}
          onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
          onRenameSession={(sessionId, title) => void handleRenameSession(sessionId, title)}
          projects={projects}
          onNewSession={(projectId) => void handleNewSession(projectId)}
        />
        {openPlanId && (
          <PlanSidePanel
            planId={openPlanId}
            onClose={() => setOpenPlanId(null)}
            onLaunched={(runId) => navigate(`/plan-runs/${runId}`)}
            activeSessionId={activeSessionId}
            onSendToChat={(message) => void handleSend(message)}
          />
        )}
        <ChatOptionsRail
          activeOption={railOption}
          onToggleOption={(key) => setRailOption((cur) => (cur === key ? null : key))}
          panels={railPanels}
          hoverPreviews={railHoverPreviews}
          focusProject={railFocusProject}
          attentionItems={railAttentionItems}
          onAttentionItemClick={handleAttentionItemClick}
          moreMessagesCount={railAttentionOverflow}
          liveEvents={railLiveEvents}
        />
      </div>
    </div>
  );
}
