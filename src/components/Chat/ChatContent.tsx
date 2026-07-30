import React from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { ProjectTabStrip } from './ProjectTabStrip.js';
import { ConversationSwitcher } from './ConversationSwitcher.js';
import { NewSessionButton } from './NewSessionButton.js';
import { ChatInputBar } from '../ui/molecules/ChatInputBar.js';

interface ChatContentProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelectSession: (sessionId: string) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onNewSession: (projectId: string) => void;
  onSend: (message: string, attachments?: File[], planMode?: boolean) => void;
  planMode?: boolean;
  onTogglePlanMode?: (next: boolean) => void;
  inputDisabled: boolean;
  /** Área de contenido (mensajes o estado vacío) — la arma quien use ChatContent, acá solo se envuelve. */
  children: React.ReactNode;
}

/**
 * ChatContent — organismo "DBoard V1.1.X" de Figma (node 7658:1930): el shell
 * completo del chat — fondo oscuro con gradiente (mismo patrón que Sidebar2/
 * ChatOptionsRail), TopRow (tab-strip de proyectos + buscador global + nueva
 * conversación) y la barra de escribir. El área de mensajes queda como
 * `children` porque en Figma esa parte solo modela el estado vacío — el
 * listado de mensajes real es lógica de `ChatWindow`, no diseño propio de
 * este organismo.
 */
export function ChatContent({
  sessions,
  projects,
  activeProjectId,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelectSession,
  onSelectProject,
  onDeleteSession,
  onRenameSession,
  onNewSession,
  onSend,
  planMode,
  onTogglePlanMode,
  inputDisabled,
  children,
}: ChatContentProps): React.ReactElement {
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--chatcontent-radius)] bg-[var(--chatcontent-bg-base)] bg-gradient-to-b from-[var(--chatcontent-bg-from)] to-[var(--chatcontent-bg-to)]">
      <div className="flex items-center gap-2 border-b border-[var(--chatcontent-border-subtle)] px-3 py-2">
        <ProjectTabStrip sessions={sessions} projects={projects} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
        <div className="ml-auto flex items-center gap-1">
          <ConversationSwitcher
            sessions={sessions}
            projects={projects}
            activeSessionId={activeSessionId}
            pendingSessionIds={pendingSessionIds}
            unreadSessionIds={unreadSessionIds}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
            onRename={onRenameSession}
          />
          <NewSessionButton projects={projects} onCreate={onNewSession} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <ChatInputBar disabled={inputDisabled} onSend={onSend} planMode={planMode} onTogglePlanMode={onTogglePlanMode} />
    </div>
  );
}
