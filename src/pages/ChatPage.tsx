import React, { useCallback, useEffect, useState } from 'react';
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
import type { ChatSession, ChatMessage } from '../lib/chat-api.js';
import { SessionList } from '../components/Chat/SessionList.js';
import { ChatWindow } from '../components/Chat/ChatWindow.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { Button } from '../components/ui/atoms/Button.js';

/**
 * Chat view: pick a project, browse/create conversations, send messages.
 * Every turn runs against the project's own root_path via
 * packages/mcp/src/api/chat.ts — see plan for backend details.
 */
export function ChatPage(): React.ReactElement {
  const { projectId: initialProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const onBack = useCallback(() => navigate('/'), [navigate]);
  const { toasts, addToast, removeToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const selectedProjectId = initialProjectId ?? null;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

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
      getChatMessages(sessionId)
        .then(setMessages)
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar mensajes', 'error');
        });
    },
    [addToast],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!selectedProjectId) return;
      if (!confirm('¿Eliminar esta conversación?')) return;
      try {
        await deleteChatSession(sessionId);
        if (sessionId === activeSessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
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
      setMessages([]);
      loadSessions(selectedProjectId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear la conversación', 'error');
    }
  }, [selectedProjectId, loadSessions, addToast]);

  const handleSend = useCallback(
    async (message: string) => {
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

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          session_id: sessionId!,
          role: 'user',
          content: message,
          tool_calls: null,
          created_at: new Date().toISOString(),
          input_tokens: null,
          output_tokens: null,
          context_used_percent: null,
          duration_ms: null,
        },
      ]);
      setPending(true);
      try {
        await sendChatMessage(sessionId, message);
        const fresh = await getChatMessages(sessionId);
        setMessages(fresh);
        loadSessions(selectedProjectId);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al enviar el mensaje', 'error');
      } finally {
        setPending(false);
      }
    },
    [selectedProjectId, activeSessionId, loadSessions, addToast],
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

  return (
    <div className="flex h-full flex-col bg-white" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex flex-1 overflow-hidden">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          projectName={selectedProject?.name ?? selectedProjectId}
          onSelect={handleSelectSession}
          onNewSession={handleNewSession}
          onDelete={(sessionId) => void handleDeleteSession(sessionId)}
          onBack={onBack}
          onChangeProject={() => navigate('/chat')}
        />
        <ChatWindow messages={messages} pending={pending} onSend={handleSend} />
      </div>
    </div>
  );
}
