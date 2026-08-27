import React from 'react';
import type { ChatMessage, ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import type { ProjectReplica } from '../../lib/project-replicas-api.js';
import { MessageList } from '../ui/molecules/MessageList.js';
import type { QueuedMessageView } from '../ui/molecules/QueuePanel.js';
import type { BackgroundTaskView } from '../ui/molecules/BackgroundTasksBar.js';
import type { QueueState } from '../../lib/chat-queue.js';
import { ChatContent } from './ChatContent.js';

interface ChatWindowProps {
  messages: ChatMessage[];
  pending: boolean;
  /** Partial assistant text streamed so far for the turn in flight — empty when there's nothing to show yet (e.g. Jarvis is still only running tools). */
  liveText?: string;
  onSend: (message: string, attachments?: File[], planMode?: boolean) => void;
  /** Cancels the turn currently in flight. Absent while there's nothing to stop. */
  onStop?: () => void;
  /** Estado de cola por id de mensaje del usuario — marca cuál está respondiendo Jarvis y cuáles esperan. */
  queueStates?: Map<number, QueueState>;
  /** Saca un mensaje puntual de la cola. */
  onRemoveQueued?: (message: QueuedMessageView) => void;
  /** Vacía la cola entera — también aborta el turno en curso. */
  onClearQueue?: () => void;
  /** Tareas que Jarvis dejó corriendo; sobreviven al turno, van en su propia barra. */
  backgroundTasks?: BackgroundTaskView[];
  onStopBackgroundTask?: (taskId: string) => void;
  onStopAllBackgroundTasks?: () => void;
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
  /** Réplicas de todos los proyectos visibles, por id — traduce el `replica_id` de cada conversación. */
  replicasById?: Map<string, ProjectReplica>;
  /** Réplicas del proyecto de la conversación abierta — vacío = no hay a dónde moverse. */
  activeSessionReplicas?: ProjectReplica[];
  onOpenWorkspaceDialog?: () => void;
}

export function ChatWindow({
  messages,
  pending,
  liveText,
  onSend,
  onStop,
  queueStates,
  onRemoveQueued,
  onClearQueue,
  backgroundTasks,
  onStopBackgroundTask,
  onStopAllBackgroundTasks,
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
  replicasById,
  activeSessionReplicas,
  onOpenWorkspaceDialog,
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
      turnInFlight={pending}
      onStop={onStop}
      backgroundTasks={backgroundTasks}
      onStopBackgroundTask={onStopBackgroundTask}
      onStopAllBackgroundTasks={onStopAllBackgroundTasks}
      replicasById={replicasById}
      activeSessionReplicas={activeSessionReplicas}
      onOpenWorkspaceDialog={onOpenWorkspaceDialog}
    >
      <MessageList
        sessionId={activeSessionId}
        messages={messages}
        pending={pending}
        liveText={liveText}
        onStop={onStop}
        queueStates={queueStates}
        onRemoveQueued={onRemoveQueued}
        onClearQueue={onClearQueue}
        proposedPlanIds={proposedPlanIds}
        onOpenPlan={onOpenPlan}
      />
    </ChatContent>
  );
}
