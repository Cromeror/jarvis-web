import React, { useEffect, useRef } from 'react';
import type { ChatMessage, ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { MessageBubble } from '../ui/molecules/MessageBubble.js';
import { Spinner } from '../ui/atoms/Spinner.js';
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending]);

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
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        {messages.length === 0 && !pending && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--chatcontent-surface-subtle)] text-[var(--tab-text-hover)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M21 11.5c0 4.14-4.03 7.5-9 7.5-1.06 0-2.07-.15-3-.42L4 20l1.1-3.3C3.8 15.4 3 13.53 3 11.5 3 7.36 7.03 4 12 4s9 3.36 9 7.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm text-[var(--chatcontent-text-muted)]">Escribí un mensaje para empezar la conversación.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            inputTokens={m.input_tokens}
            outputTokens={m.output_tokens}
            contextUsedPercent={m.context_used_percent}
            durationMs={m.duration_ms}
            attachments={m.attachments}
          />
        ))}
        {pending && (
          <div className="space-y-2">
            {liveText && <MessageBubble role="assistant" content={liveText} />}
            <div className="flex items-center gap-2 text-sm text-[var(--chatcontent-text-muted)]">
              <Spinner />
              Jarvis está pensando...
              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="ml-2 rounded-full border border-[var(--chatcontent-border-subtle)] px-3 py-1 text-xs font-medium text-[var(--tab-text-hover)] hover:bg-white/10"
                >
                  Detener
                </button>
              )}
            </div>
          </div>
        )}
        {proposedPlanIds?.map((planId) => (
          <button
            key={planId}
            type="button"
            onClick={() => onOpenPlan?.(planId)}
            className="flex w-full items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-left text-sm text-indigo-200 hover:bg-indigo-500/20"
          >
            <i className="pi pi-list-check text-sm" />
            Plan propuesto — ver en el panel
            <i className="pi pi-arrow-right ml-auto text-xs" />
          </button>
        ))}
        <div ref={bottomRef} />
      </div>
    </ChatContent>
  );
}
