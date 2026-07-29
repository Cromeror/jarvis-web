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
} from '../lib/chat-api.js';
import type { ChatSession, ChatMessage, ChatAttachmentInput } from '../lib/chat-api.js';
import { useChatStream } from '../hooks/useChatStream.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { PlanSidePanel } from '../components/Plan/PlanSidePanel.js';
import { ChatPlansPanel } from '../components/Chat/ChatPlansPanel.js';
import { ChatOptionsRail } from '../components/ui/organisms/ChatOptionsRail.js';
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
  // Independent of any session — the user can toggle Plan Mode before a
  // conversation exists yet (empty chat, nothing sent), so it can't live
  // nested under chatBySession[activeSessionId], which wouldn't exist then.
  const [planMode, setPlanMode] = useState(false);
  // Which plan is open in the side panel — null means the panel is hidden.
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  // Opción activa del rail derecho (null = ningún panel del rail abierto).
  const [railOption, setRailOption] = useState<string | null>(null);

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

      setChatBySession((prev) => {
        const current = prev[activeSessionIdForSend] ?? { messages: [], pending: false };
        return {
          ...prev,
          [activeSessionIdForSend]: {
            ...current,
            messages: [
              ...current.messages,
              {
                id: Date.now(),
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
        const result = await sendChatMessage(activeSessionIdForSend, message, attachments, planMode ? 'plan' : undefined);
        const fresh = await getChatMessages(activeSessionIdForSend);
        patchSession(activeSessionIdForSend, (current) => ({
          messages: fresh,
          hasUnread: activeSessionIdRef.current !== activeSessionIdForSend,
          ...(result.plan_id
            ? { proposedPlanIds: [...(current.proposedPlanIds ?? []), result.plan_id] }
            : {}),
        }));
        if (result.plan_id) setOpenPlanId(result.plan_id);
        if (result.cancelled) addToast('Se detuvo la respuesta de Jarvis', 'info');
        loadSessions(projectIds);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al enviar el mensaje', 'error');
      } finally {
        patchSession(activeSessionIdForSend, { pending: false });
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

  // Fires when the SSE stream reports the in-flight turn settled — covers
  // the case where THIS mount never sent the message itself (navigated away
  // mid-turn and came back, or a hard reload), so there's no local `pending`
  // promise around to refresh messages once it resolves.
  const handleStreamDone = useCallback(() => {
    if (!activeSessionId) return;
    const doneSessionId = activeSessionId;
    getChatMessages(doneSessionId)
      .then((fresh) => patchSession(doneSessionId, { messages: fresh, pending: false }))
      .catch((err: unknown) => {
        addToast(err instanceof Error ? err.message : 'Error al cargar mensajes', 'error');
      });
    loadSessions(projectIds);
  }, [activeSessionId, patchSession, loadSessions, projectIds, addToast]);

  const { active: streamActive, liveText } = useChatStream(activeSessionId, handleStreamDone);

  const activeChat = activeSessionId ? chatBySession[activeSessionId] : undefined;
  const activeProjectId = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.project_id ?? null,
    [sessions, activeSessionId],
  );
  const activeProjectName = useMemo(
    () => (activeProjectId ? projects.find((p) => p.id === activeProjectId)?.name : undefined),
    [activeProjectId, projects],
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
    <div className="flex h-full flex-col bg-white" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex flex-1 overflow-hidden">
        <ChatWindow
          messages={activeChat?.messages ?? []}
          pending={(activeChat?.pending ?? false) || streamActive}
          liveText={liveText}
          onSend={handleSend}
          onStop={handleStop}
          planMode={planMode}
          onTogglePlanMode={setPlanMode}
          proposedPlanIds={activeChat?.proposedPlanIds}
          onOpenPlan={setOpenPlanId}
          activeProjectName={activeProjectName}
          sessions={sessions}
          activeSessionId={activeSessionId}
          pendingSessionIds={pendingSessionIds}
          unreadSessionIds={unreadSessionIds}
          onSelectSession={selectSessionAndNavigate}
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
        {railOption === 'plans' && (
          <ChatPlansPanel
            projectId={activeProjectId}
            activePlanId={openPlanId}
            onSelectPlan={setOpenPlanId}
            onClose={() => setRailOption(null)}
          />
        )}
        <ChatOptionsRail
          activeOption={railOption}
          onToggleOption={(key) => setRailOption((cur) => (cur === key ? null : key))}
        />
      </div>
    </div>
  );
}
