import React, { useEffect, useRef } from 'react';
import type { ChatMessage, ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { MessageBubble } from '../ui/molecules/MessageBubble.js';
import { ChatInputBar } from '../ui/molecules/ChatInputBar.js';
import { Spinner } from '../ui/atoms/Spinner.js';
import { NewSessionButton } from './NewSessionButton.js';
import { ConversationSwitcher } from './ConversationSwitcher.js';

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
  /** Project owning the active conversation — shown in the top bar, and doubles as the trigger to switch conversations. */
  activeProjectName?: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelectSession: (sessionId: string) => void;
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
  activeProjectName,
  sessions,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelectSession,
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
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        {activeProjectName && (
          <ConversationSwitcher
            sessions={sessions}
            projects={projects}
            activeSessionId={activeSessionId}
            activeProjectName={activeProjectName}
            pendingSessionIds={pendingSessionIds}
            unreadSessionIds={unreadSessionIds}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
            onRename={onRenameSession}
          />
        )}
        <div className="ml-auto">
          <NewSessionButton projects={projects} onCreate={onNewSession} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
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
              <p className="text-sm text-slate-400">Escribí un mensaje para empezar la conversación.</p>
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
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Spinner />
                Jarvis está pensando...
                {onStop && (
                  <button
                    type="button"
                    onClick={onStop}
                    className="ml-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
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
              className="flex w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-left text-sm text-indigo-700 hover:bg-indigo-50"
            >
              <i className="pi pi-list-check text-sm" />
              Plan propuesto — ver en el panel
              <i className="pi pi-arrow-right ml-auto text-xs" />
            </button>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInputBar disabled={pending} onSend={onSend} planMode={planMode} onTogglePlanMode={onTogglePlanMode} />
    </div>
  );
}
