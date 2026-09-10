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
  moveChatSessionToReplica,
  cancelQueuedMessage,
  stopBackgroundTask,
} from '../lib/chat-api.js';
import type { ChatSession, ChatMessage, ChatAttachmentInput } from '../lib/chat-api.js';
import { resolveQueueStates } from '../lib/chat-queue.js';
import type { QueuedMessageView } from '../components/ui/molecules/QueuePanel.js';
import { useChatStream } from '../hooks/useChatStream.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { PlanFullscreenModal } from '../components/Plan/PlanFullscreenModal.js';
import { PlanLaunchDialog } from '../components/Plan/PlanLaunchDialog.js';
import { SessionWorkspaceDialog } from '../components/Chat/SessionWorkspaceDialog.js';
import { listProjectReplicas, type ProjectReplica } from '../lib/project-replicas-api.js';
import { indexReplicasById } from '../lib/session-workspace.js';
import { ChatOptionsRail, type RailHoverPreviewData, type ChatOptionsRailNavItem } from '../components/ui/organisms/ChatOptionsRail.js';
import type { RailListPanelItem, RailListPanelData } from '../components/ui/organisms/RailListPanel.js';
import type { BadgeStatus } from '../components/ui/atoms/Badge.js';
import { listPlans, launchPlan, approvePlan } from '../lib/plans-api.js';
import {
  selectRailPlans,
  hasPlansHiddenFromRail,
  selectRailExecutions,
  countRailExecutionsNeedingAttention,
} from '../lib/plan-filters.js';
import type { PlanSummary, PlanStatus } from '../lib/plans-api.js';
import { timeAgo, timeAgoPrecise, activeFor } from '../lib/time-ago.js';
import { useRailFocus } from '../hooks/useRailFocus.js';
import { useSeenExecutions } from '../hooks/useSeenExecutions.js';
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

/**
 * Los campos de `ChatSession` que el rail y el tab strip realmente pintan. Se
 * comparan para no reemplazar el array en cada refresco cuando nada cambió —
 * ver `loadSessions`. `busy` entra en la comparación: es justo el campo que
 * cambia sin que cambie `updated_at`.
 */
function sameSessionList(a: ChatSession[], b: ChatSession[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((session, i) => {
    const other = b[i];
    return (
      session.id === other.id &&
      session.title === other.title &&
      session.updated_at === other.updated_at &&
      // El workspace se pinta en la lista, así que un cambio de réplica tiene
      // que romper la igualdad o el badge se queda con el valor viejo.
      (session.replica_id ?? null) === (other.replica_id ?? null) &&
      (session.busy ?? false) === (other.busy ?? false)
    );
  });
}

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
  // Réplicas por proyecto — para traducir el `replica_id` de cada conversación
  // a un nombre y para saber si hay a dónde moverse. Se cargan una vez por
  // proyecto visible: son pocas y cambian poco, a diferencia de las sesiones,
  // que se refrescan en intervalo.
  const [replicasByProject, setReplicasByProject] = useState<Record<string, ProjectReplica[]>>({});
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [movingWorkspace, setMovingWorkspace] = useState(false);

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
    // `silent` existe para el refresco periódico del rail: un server caído
    // haría que ese intervalo escupiera un toast cada pocos segundos, así que
    // ahí el error se traga (la carga inicial sí avisa, es la que importa).
    (projectIds: string[], opts?: { silent?: boolean }) => {
      Promise.all(projectIds.map((id) => listChatSessions(id)))
        .then((results) => {
          const next = results.flat().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          // Sin esto el refresco cada pocos segundos reemplaza el array por uno
          // nuevo aunque no haya cambiado nada, y vuelve a renderizar todo lo
          // que depende de `sessions` (tab strip, switcher, rail) de gratis.
          setSessions((prev) => (sameSessionList(prev, next) ? prev : next));
        })
        .catch((err: unknown) => {
          if (opts?.silent) return;
          addToast(err instanceof Error ? err.message : 'Error al cargar conversaciones', 'error');
        });
    },
    [addToast],
  );

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  useEffect(() => {
    if (projectIds.length > 0) loadSessions(projectIds);
  }, [projectIds.join(','), loadSessions]);

  // Las réplicas se cargan BAJO DEMANDA, y de a un proyecto por vez.
  //
  // Antes se pedían las de TODOS los proyectos al entrar al chat: con once
  // proyectos eran once requests, y cada una sobre un proyecto aislado dispara
  // un `sudo` del lado del server. La mayoría no se usaba nunca — un proyecto
  // cuyas conversaciones no estás mirando no aporta nada a esta pantalla.
  //
  // Lo que de verdad hace falta son dos conjuntos, y los dos son chicos: el
  // proyecto de la conversación abierta (para el selector de réplica) y los
  // proyectos que aparecen en las sesiones ya cargadas (para traducir el
  // `replica_id` de una fila del historial a su nombre).
  //
  // El cache es incremental y no se invalida: una réplica no cambia de nombre
  // sola, y re-pedirla en cada render sería volver al problema por otra puerta.
  const proyectosConReplicasPedidas = useRef(new Set<string>());
  const proyectosQueNecesitanReplicas = useMemo(() => {
    const ids = new Set<string>();
    const activa = sessions.find((s) => s.id === activeSessionId);
    if (activa?.project_id) ids.add(activa.project_id);
    for (const s of sessions) if (s.replica_id && s.project_id) ids.add(s.project_id);
    return [...ids].sort().join(',');
  }, [activeSessionId, sessions]);

  useEffect(() => {
    const pendientes = proyectosQueNecesitanReplicas
      .split(',')
      .filter((id) => id !== '' && !proyectosConReplicasPedidas.current.has(id));
    if (pendientes.length === 0) return;
    // Se marca ANTES de pedir: si el efecto se re-dispara mientras la request
    // está en vuelo, no se pide dos veces lo mismo.
    pendientes.forEach((id) => proyectosConReplicasPedidas.current.add(id));

    let cancelled = false;
    Promise.all(
      // Un proyecto sin réplicas es el caso normal y responde `[]`: no hay error
      // que mostrar ni estado vacío que pintar — simplemente no aparece la opción
      // de moverse. Por eso el fallo se traga por proyecto en vez de cortar todo.
      pendientes.map((id) =>
        listProjectReplicas(id)
          .then((replicas) => [id, replicas] as const)
          .catch(() => [id, []] as const),
      ),
    ).then((entries) => {
      // Merge, no reemplazo: lo que ya se cargó de otros proyectos se conserva.
      if (!cancelled) setReplicasByProject((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [proyectosQueNecesitanReplicas]);

  // El `busy` de cada conversación es un snapshot del momento del fetch, no un
  // stream: el SSE es de UNA conversación (la abierta), así que para las demás
  // no hay evento que avise que arrancaron o terminaron. De ahí el refresco
  // periódico, y solo mientras el Historial está abierto — es el único panel
  // que lo muestra, no tiene sentido pollear cuando no se ve.
  useEffect(() => {
    if (railOption !== 'history' || projectIds.length === 0) return;
    const timer = window.setInterval(() => loadSessions(projectIds, { silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [railOption, projectIds.join(','), loadSessions]);

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

  /**
   * Mover la conversación abierta a otro workspace.
   *
   * El backend tira el proceso vivo para que el turno siguiente se recree en el
   * directorio nuevo, así que el `notice` que devuelve se muestra tal cual: es
   * la explicación de por qué el próximo mensaje va a tardar más. Recargar las
   * sesiones no es opcional — el badge de la lista y el del header salen de esa
   * misma fila.
   */
  const handleMoveSessionWorkspace = useCallback(
    async (sessionId: string, replicaId: string | null) => {
      setMovingWorkspace(true);
      try {
        const result = await moveChatSessionToReplica(sessionId, replicaId);
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...result.session } : s)));
        setWorkspaceDialogOpen(false);
        if (result.moved && result.notice) addToast(result.notice, 'info');
        loadSessions(projectIds, { silent: true });
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'No pude mover la conversación', 'error');
      } finally {
        setMovingWorkspace(false);
      }
    },
    [addToast, loadSessions, projectIds],
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
  //
  // El ref no es decorativo: este efecto corriendo dos veces (StrictMode en dev,
  // o cualquier re-mount) hacía DOS POST a milisegundos uno del otro. Una de las
  // dos sesiones se usaba y la otra quedaba para siempre vacía y sin título, o
  // sea una "Nueva conversación" fantasma en el Historial (había cuatro pares así
  // en la base). `handleNewSession` navega con replace, así que la dep no cambia
  // y no alcanza para frenar el segundo disparo.
  const autoStartedForProject = useRef<string | null>(null);
  useEffect(() => {
    if (!initialProjectId || routeSessionId) return;
    if (autoStartedForProject.current === initialProjectId) return;
    autoStartedForProject.current = initialProjectId;
    void handleNewSession(initialProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  const handleSend = useCallback(
    async (message: string, attachmentFiles?: File[]) => {
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
        const queued = await sendChatMessage(activeSessionIdForSend, message, attachments);
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

  // Solo borradores y aprobados — lo ya ejecutado tiene su propia opción
  // ("Ejecuciones", railRunItems más abajo). Es un filtro de vista y no del
  // fetch a propósito: las dos opciones derivan de este mismo `railPlans`, así
  // que pedirle al backend solo draft+approved dejaría Ejecuciones vacío.
  const railPlanItems = useMemo<RailListPanelItem[]>(
    () =>
      selectRailPlans(railPlans)
        .map((plan) => ({
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
  // Qué ejecuciones ya miró el usuario — baja la prioridad de un `failed` una
  // vez abierto, así el rail deja de insistir con algo ya visto.
  const { seenIds: seenExecutionIds, markSeen: markExecutionSeen } = useSeenExecutions(activeProjectId);

  // El criterio de qué entra (y qué queda apilado) vive en plan-filters, al
  // lado del de "Planes" y con spec propia. Acá solo se le da forma de fila.
  const railExecutions = useMemo(
    () => selectRailExecutions(railPlans, { seenIds: seenExecutionIds }),
    [railPlans, seenExecutionIds],
  );

  const railRunItems = useMemo<RailListPanelItem[]>(
    () =>
      railExecutions.items.map((plan) => ({
        id: plan.id,
        title: plan.title,
        subtitle: `${activeProjectName} · ${timeAgo(plan.updated_at)}`,
        badge: PLAN_BADGE[plan.status],
      })),
    [railExecutions, activeProjectName],
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
          // Para la conversación abierta manda el stream, no el `busy` de la
          // lista: es instantáneo y no espera al próximo refresco (y si los dos
          // discrepan, el que tiene el evento en vivo es el que sabe).
          status: (s.id === activeSessionId ? streamActive : (s.busy ?? false)) ? 'Respondiendo…' : undefined,
        })),
    [sessions, activeProjectId, activeSessionId, streamActive],
  );

  // Plan esperando que se elija dónde corre. Guarda SOLO el id: el título y el
  // proyecto se resuelven al renderizar el diálogo, donde ya está todo en
  // scope — `sessionPlan` se destructura más abajo que los dos puntos de launch
  // del rail, así que resolverlo acá sería un TDZ en el primer render.
  const [launchPlanId, setLaunchPlanId] = useState<string | null>(null);
  const requestLaunchPlan = useCallback((planId: string) => setLaunchPlanId(planId), []);

  // Acuse de recibo de un plan lanzado desde el chat SIN abrir su detalle: la
  // opción "Planes" del rail y el "Lanzar ahora" de la tarjeta de Focus, que
  // son los dos que pasan por `handleLaunchPlan`. Decisión explícita: ahí NO se
  // navega. El usuario está leyendo una conversación y el launch es una acción
  // al costado, no el destino — mandarlo a /plan-runs le saca de encima lo que
  // estaba mirando. El acuse va donde ya está: un toast con el nombre del plan,
  // y el plan pasando a "Ejecuciones" del rail (de ahí el bump del token:
  // `railPlans` se refetchea y el plan, ahora en running, entra en esa opción y
  // prende su badge de atención).
  // Los dos caminos que SÍ navegan son los que pasan por el detalle del plan:
  // el `onLaunched` del PlanFullscreenModal (acá abajo) y el de PlansPage. Ahí
  // el usuario ya se metió en el plan, así que el run es lo que fue a buscar.
  const notifyPlanLaunched = useCallback(
    (planTitle: string) => {
      addToast(`"${planTitle}" se está ejecutando — seguilo en Ejecuciones`, 'success');
      setRailPlansToken((n) => n + 1);
    },
    [addToast],
  );

  const handleLaunchPlan = useCallback(
    async (planId: string, planTitle: string, replicaId?: string) => {
      setLaunchPlanId(null);
      try {
        await launchPlan(planId, replicaId);
        notifyPlanLaunched(planTitle);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al lanzar el plan', 'error');
      }
    },
    [notifyPlanLaunched, addToast],
  );

  // Mensajes de "nada que mostrar" — compartidos entre el ContentPanel
  // expandido (RailListPanel) y la tarjeta de hover del rail colapsado
  // (RailHoverPreview), para no tener dos redacciones distintas del mismo
  // estado vacío.
  // Con el filtro de estados, "vacío" ya no significa "no hay planes" — puede
  // haber varios, todos ejecutados. El texto lo dice para que no parezca que se
  // perdieron; están en Ejecuciones.
  const railPlansEmptyLabel = !activeProjectId
    ? 'Elegí una conversación para ver sus planes.'
    : hasPlansHiddenFromRail(railPlans)
      ? 'No hay borradores ni planes aprobados — los ya ejecutados están en Ejecuciones.'
      : 'Este proyecto todavía no tiene planes.';
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
        onAction: requestLaunchPlan,
      },
      executions: {
        items: railRunItems,
        loading: railPlansLoading,
        error: railPlansError,
        emptyLabel: railExecutionsEmptyLabel,
        // Abrir el detalle ES el acuse de recibo: no hay un botón aparte de
        // "visto" porque mirarlo es exactamente lo que se pide.
        onSelectItem: (planId) => {
          markExecutionSeen(planId);
          setOpenPlanId(planId);
        },
        // Lo que no entró en el tope no se pierde ni se scrollea acá dentro:
        // se apila en una fila que lleva a /plans, que tiene ancho para
        // inventario. Sin proyecto activo no hay a dónde ir, así que no va.
        footer:
          railExecutions.hiddenCount > 0 && activeProjectId
            ? {
                label: `Ver las ${railExecutions.hiddenCount} restantes`,
                onClick: () => navigate(`/plans/${activeProjectId}`),
              }
            : null,
      },
      history: {
        items: railHistoryItems,
        emptyLabel: railHistoryEmptyLabel,
        onSelectItem: (sessionId) => selectSessionAndNavigate(sessionId, activeProjectId),
        // Misma acción que el botón de borrar del sidebar izquierdo: pide
        // confirmación, y si la que se borra es la abierta, vuelve a /chat.
        onDeleteItem: (sessionId) => void handleDeleteSession(sessionId),
        deleteLabel: 'Eliminar conversación',
        selectedId: activeSessionId,
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
      railExecutions.hiddenCount,
      markExecutionSeen,
      navigate,
      activeProjectId,
      activeSessionId,
      handleLaunchPlan,
      handleDeleteSession,
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
   * Todas las réplicas de todos los proyectos visibles, por id. La lista de
   * conversaciones cruza proyectos (el buscador global las muestra juntas), así
   * que un índice por proyecto no alcanzaría para traducir el `replica_id` de
   * una fila cualquiera.
   */
  const replicasById = useMemo(
    () => indexReplicasById(Object.values(replicasByProject).flat()),
    [replicasByProject],
  );

  const activeSessionReplicas = useMemo(
    () => (activeSession?.project_id ? replicasByProject[activeSession.project_id] ?? [] : []),
    [activeSession, replicasByProject],
  );

  /**
   * "Crear plan" no puede crear el plan por sí solo: plan_create exige título,
   * contexto, arquitectura y el grafo completo de steps. Lo que hace es pedirle
   * al chat que lo genere, usando el título sugerido como semilla.
   */
  const handleCreateSuggestedPlan = useCallback(
    (suggestedTitle: string) => {
      // Un mensaje normal: el chat tiene `plan_create` en su catálogo de tools,
      // así que el pedido alcanza. No hay modo de turno especial que activar.
      void handleSend(`Creá el plan "${suggestedTitle}" que propusiste para esta conversación.`);
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
              ? [{ label: 'Lanzar ahora', onClick: () => requestLaunchPlan(plan.id) }]
              : []),
          ]
        : focus.suggested_plan_title
          ? [{ label: 'Crear plan', onClick: () => handleCreateSuggestedPlan(focus.suggested_plan_title!) }]
          : [],
    };
  }, [focus, activeSession, projects, sessionPlan, railNow, handleApprovePlan, requestLaunchPlan, handleCreateSuggestedPlan]);

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

  /**
   * Nav items del rail con el badge de Ejecuciones calculado. Sin esto el rail
   * caía en `DEFAULT_NAV_ITEMS` (ChatOptionsRail.tsx), que trae `badgeCount: 3`
   * como ejemplo del diseño de Figma: el único indicador de atención de la
   * barra decía "3" siempre, sin mirar ningún dato.
   *
   * Cuenta lo que PIDE algo (corriendo, o falló y no lo viste), no cuántas
   * filas hay: un `done` es información, no un pendiente. Cero se muestra como
   * ausencia de badge — que el silencio se vea es la mitad del valor.
   */
  const railNavItems = useMemo<ChatOptionsRailNavItem[]>(() => {
    const needsAttention = countRailExecutionsNeedingAttention(railPlans, seenExecutionIds);
    const hasUnseenFailure = railPlans.some((p) => p.status === 'failed' && !seenExecutionIds.has(p.id));
    return [
      { id: 'plans', label: 'Planes', icon: 'list-checks' },
      {
        id: 'executions',
        label: 'Ejecuciones',
        icon: 'play-circle',
        badgeCount: needsAttention > 0 ? needsAttention : undefined,
        badgeTone: hasUnseenFailure ? 'danger' : 'accent',
      },
      { id: 'history', label: 'Historial', icon: 'history' },
    ];
  }, [railPlans, seenExecutionIds]);

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
          replicasById={replicasById}
          activeSessionReplicas={activeSessionReplicas}
          onOpenWorkspaceDialog={() => setWorkspaceDialogOpen(true)}
        />
        <ChatOptionsRail
          activeOption={railOption}
          onToggleOption={(key) => setRailOption((cur) => (cur === key ? null : key))}
          panels={railPanels}
          navItems={railNavItems}
          hoverPreviews={railHoverPreviews}
          focusProject={railFocusProject}
          attentionItems={railAttentionItems}
          onAttentionItemClick={handleAttentionItemClick}
          moreMessagesCount={railAttentionOverflow}
          liveEvents={railLiveEvents}
        />
      </div>
      {/*
        * El detalle de un plan es el modal, no un panel al costado: los cuatro
        * caminos que setean `openPlanId` (rail Planes, rail Ejecuciones, la
        * tarjeta del feed vía onOpenPlan, y handleAttentionItemClick) abren
        * directo la vista completa, sin el paso intermedio de un panel angosto
        * que había que maximizar. Va acá abajo, fuera del flex row, porque es
        * un overlay `fixed` como los otros diálogos — adentro de la fila
        * ocuparía ancho del layout sin necesitarlo.
        */}
      {openPlanId && (
        <PlanFullscreenModal
          planId={openPlanId}
          onClose={() => setOpenPlanId(null)}
          onLaunched={(runId) => navigate(`/plan-runs/${runId}`)}
          activeSessionId={activeSessionId}
          onSendToChat={(message) => void handleSend(message)}
        />
      )}
      {workspaceDialogOpen && activeSession && (
        <SessionWorkspaceDialog
          sessionTitle={activeSession.title ?? 'Nueva conversación'}
          replicas={activeSessionReplicas}
          currentReplicaId={activeSession.replica_id ?? null}
          moving={movingWorkspace}
          onCancel={() => setWorkspaceDialogOpen(false)}
          onConfirm={(replicaId) => void handleMoveSessionWorkspace(activeSession.id, replicaId)}
        />
      )}
      {launchPlanId && (() => {
        const plan = railPlans.find((p) => p.id === launchPlanId)
          ?? (sessionPlan?.id === launchPlanId ? sessionPlan : null);
        return (
          <PlanLaunchDialog
            planTitle={plan?.title ?? 'Plan'}
            projectId={plan?.project_id ?? activeProjectId}
            onCancel={() => setLaunchPlanId(null)}
            onConfirm={(replicaId) => void handleLaunchPlan(launchPlanId, plan?.title ?? 'El plan', replicaId)}
          />
        );
      })()}
    </div>
  );
}
