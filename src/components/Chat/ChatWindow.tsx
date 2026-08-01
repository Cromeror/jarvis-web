import React from 'react';
import type { ChatMessage, ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { MessageList } from '../ui/molecules/MessageList.js';
import { ChatContent } from './ChatContent.js';

interface ChatWindowProps {
  messages: ChatMessage[];
  pending: boolean;
  /** Partial assistant text streamed so far for the turn in flight — empty when there's nothing to show yet (e.g. Jarvis is still only running tools). */
  liveText?: string;
  onSend: (message: string, attachments?: File[], planMode?: boolean) => void;
  /** Cancels the turn currently in flight. Absent while there's nothing to stop. */
  onStop?: () => void;
  planMode?: boolean;
  onTogglePlanMode?: (next: boolean) => void;
  /** Plans proposed during this session's turns — rendered as a small banner that opens the side panel. */
  proposedPlanIds?: string[];
  onOpenPlan?: (planId: string) => void;
  /** Proyecto dueño de la conversación activa — resalta su tab en el ProjectTabStrip. */
  activeProjectId?: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelectSession: (sessionId: string) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  projects: ProjectSummary[];
  onNewSession: (projectId: string) => void;
}

export function ChatWindow({
  messages,
  pending,
  liveText,
  onSend,
  onStop,
  planMode,
  onTogglePlanMode,
  proposedPlanIds,
  onOpenPlan,
  activeProjectId,
  sessions,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelectSession,
  onSelectProject,
  onDeleteSession,
  onRenameSession,
  projects,
  onNewSession,
}: ChatWindowProps): React.ReactElement {
  return (
    <ChatContent
      sessions={sessions}
      projects={projects}
      activeProjectId={activeProjectId ?? null}
      activeSessionId={activeSessionId}
      pendingSessionIds={pendingSessionIds}
      unreadSessionIds={unreadSessionIds}
      onSelectSession={onSelectSession}
      onSelectProject={onSelectProject}
      onDeleteSession={onDeleteSession}
      onRenameSession={onRenameSession}
      onNewSession={onNewSession}
      onSend={onSend}
      planMode={planMode}
      onTogglePlanMode={onTogglePlanMode}
      inputDisabled={pending}
    >
      <MessageList
        messages={messages}
        pending={pending}
        liveText={liveText}
        onStop={onStop}
        proposedPlanIds={proposedPlanIds}
        onOpenPlan={onOpenPlan}
      />
    </ChatContent>
  );
}
