import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  listChatSessions,
  startChatSession,
  sendChatMessage,
  getChatMessages,
  deleteChatSession,
} from '../lib/chat-api.js';
import type { ChatSession, ChatMessage, ChatAttachmentInput } from '../lib/chat-api.js';
import { SessionList } from '../components/Chat/SessionList.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { Button } from '../components/ui/atoms/Button.js';

/**
 * Chat view: pick a project, browse/create conversations, send messages.
 * Every turn runs against the project's own root_path via
 * packages/mcp/src/api/chat.ts — see plan for backend details.
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
  const selectedProjectId = initialProjectId ?? null;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;
  const [chatBySession, setChatBySession] = useState<Record<string, SessionChatState>>({});
  // Independent of any session — the user can toggle Plan Mode before a
  // conversation exists yet (empty chat, nothing sent), so it can't live
  // nested under chatBySession[activeSessionId], which wouldn't exist then.
  const [planMode, setPlanMode] = useState(false);

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
    (projectId: string) => {
      listChatSessions(projectId)
        .then(setSessions)
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar conversaciones', 'error');
        });
    },
    [addToast],
  );

  useEffect(() => {
    if (selectedProjectId) loadSessions(selectedProjectId);
  }, [selectedProjectId, loadSessions]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
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
      if (!selectedProjectId) return;
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
        loadSessions(selectedProjectId);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al eliminar la conversación', 'error');
      }
    },
    [selectedProjectId, activeSessionId, loadSessions, addToast],
  );

  const handleNewSession = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const { session_id } = await startChatSession(selectedProjectId);
      setActiveSessionId(session_id);
      patchSession(session_id, { messages: [] });
      loadSessions(selectedProjectId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear la conversación', 'error');
    }
  }, [selectedProjectId, loadSessions, addToast, patchSession]);

  const handleSend = useCallback(
    async (message: string, attachmentFiles?: File[], planMode?: boolean) => {
      if (!selectedProjectId) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        try {
          const started = await startChatSession(selectedProjectId);
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
        loadSessions(selectedProjectId);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al enviar el mensaje', 'error');
      } finally {
        patchSession(activeSessionIdForSend, { pending: false });
      }
    },
    [selectedProjectId, activeSessionId, loadSessions, addToast, patchSession],
  );

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-50" style={{ fontSize: '16px' }}>
        <Toast toasts={toasts} onDismiss={removeToast} />
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            J
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Elegí un proyecto</h1>
          <p className="text-sm text-slate-500">¿Con qué proyecto querés charlar?</p>
        </div>
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {projects.map((p) => (
            <Button key={p.id} variant="secondary" onClick={() => navigate(`/chat/${p.id}`)}>
              {p.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Volver
        </Button>
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
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
          activeSessionId={activeSessionId}
          pendingSessionIds={pendingSessionIds}
          unreadSessionIds={unreadSessionIds}
          projectName={selectedProject?.name ?? selectedProjectId}
          onSelect={handleSelectSession}
          onNewSession={handleNewSession}
          onDelete={(sessionId) => void handleDeleteSession(sessionId)}
          onBack={onBack}
          onChangeProject={() => navigate('/chat')}
        />
        <ChatWindow
          messages={activeChat?.messages ?? []}
          pending={activeChat?.pending ?? false}
          onSend={handleSend}
          planMode={planMode}
          onTogglePlanMode={setPlanMode}
          proposedPlanIds={activeChat?.proposedPlanIds}
        />
      </div>
    </div>
  );
}
