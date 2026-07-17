import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../lib/chat-api.js';
import type { ChatSession, ChatMessage, ChatAttachmentInput } from '../lib/chat-api.js';
import { SessionList } from '../components/Chat/SessionList.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { PlanSidePanel } from '../components/Plan/PlanSidePanel.js';
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
  const { projectId: initialProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const onBack = useCallback(() => navigate('/'), [navigate]);
  const { toasts, addToast, removeToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
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

  // La ruta /chat/:projectId (si viene) precarga ese proyecto en el filtro; sin ella arranca "todos".
  useEffect(() => {
    if (initialProjectId) setProjectFilter([initialProjectId]);
  }, [initialProjectId]);

  const projectIdsToLoad = projectFilter.length > 0 ? projectFilter : projects.map((p) => p.id);

  const loadSessions = useCallback(
    (projectIds: string[]) => {
      Promise.all(projectIds.map((id) => listChatSessions(id)))
        .then((results) => setSessions(results.flat()))
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar conversaciones', 'error');
        });
    },
    [addToast],
  );

  useEffect(() => {
    if (projectIdsToLoad.length > 0) loadSessions(projectIdsToLoad);
  }, [projectIdsToLoad.join(','), loadSessions]);

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

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!confirm('¿Eliminar esta conversación?')) return;
      try {
        await deleteChatSession(sessionId);
        if (sessionId === activeSessionId) {
          setActiveSessionId(null);
        }
        setChatBySession((prev) => {
          const { [sessionId]: _removed, ...rest } = prev;
          return rest;
        });
        loadSessions(projectIdsToLoad);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al eliminar la conversación', 'error');
      }
    },
    [activeSessionId, loadSessions, projectIdsToLoad, addToast],
  );

  const handleNewSession = useCallback(
    async (projectId: string) => {
      try {
        const { session_id } = await startChatSession(projectId);
        setActiveSessionId(session_id);
        patchSession(session_id, { messages: [] });
        loadSessions(projectIdsToLoad);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al crear la conversación', 'error');
      }
    },
    [loadSessions, projectIdsToLoad, addToast, patchSession],
  );

  const handleSend = useCallback(
    async (message: string, attachmentFiles?: File[], planMode?: boolean) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        // Sin conversación activa, hace falta saber a qué proyecto pertenece la nueva
        // sesión — solo se puede inferir si el filtro dejó exactamente uno seleccionado.
        if (projectFilter.length !== 1) {
          addToast('Elegí un proyecto (o creá la conversación con "Nueva conversación")', 'error');
          return;
        }
        try {
          const started = await startChatSession(projectFilter[0]!);
          sessionId = started.session_id;
          setActiveSessionId(sessionId);
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Error al crear la conversación', 'error');
          return;
        }
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
        loadSessions(projectIdsToLoad);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al enviar el mensaje', 'error');
      } finally {
        patchSession(activeSessionIdForSend, { pending: false });
      }
    },
    [projectFilter, activeSessionId, loadSessions, projectIdsToLoad, addToast, patchSession],
  );

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    stopChatMessage(activeSessionId).catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al detener la respuesta', 'error');
    });
  }, [activeSessionId, addToast]);

  const activeChat = activeSessionId ? chatBySession[activeSessionId] : undefined;
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
        <SessionList
          sessions={sessions}
          projects={projects}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          activeSessionId={activeSessionId}
          pendingSessionIds={pendingSessionIds}
          unreadSessionIds={unreadSessionIds}
          onSelect={handleSelectSession}
          onNewSession={(projectId) => void handleNewSession(projectId)}
          onDelete={(sessionId) => void handleDeleteSession(sessionId)}
          onBack={onBack}
        />
        <ChatWindow
          messages={activeChat?.messages ?? []}
          pending={activeChat?.pending ?? false}
          onSend={handleSend}
          onStop={handleStop}
          planMode={planMode}
          onTogglePlanMode={setPlanMode}
          proposedPlanIds={activeChat?.proposedPlanIds}
          onOpenPlan={setOpenPlanId}
        />
        {openPlanId && (
          <PlanSidePanel
            planId={openPlanId}
            onClose={() => setOpenPlanId(null)}
            onLaunched={(runId) => navigate(`/plan-runs/${runId}`)}
          />
        )}
      </div>
    </div>
  );
}
