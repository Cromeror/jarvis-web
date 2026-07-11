import React, { useMemo } from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import { SessionListItem } from '../ui/molecules/SessionListItem.js';

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  projectName: string;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDelete: (sessionId: string) => void;
  onBack: () => void;
  onChangeProject: () => void;
}

function groupByDate(sessions: ChatSession[]): Array<[string, ChatSession[]]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const d = new Date(session.updated_at);
    d.setHours(0, 0, 0, 0);
    const label = d.getTime() === today.getTime() ? 'Hoy' : d.getTime() === yesterday.getTime() ? 'Ayer' : 'Anteriores';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(session);
  }

  const order = ['Hoy', 'Ayer', 'Anteriores'];
  return order.filter((label) => groups.has(label)).map((label) => [label, groups.get(label)!]);
}

export function SessionList({
  sessions,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  projectName,
  onSelect,
  onNewSession,
  onDelete,
  onBack,
  onChangeProject,
}: SessionListProps): React.ReactElement {
  const groups = useMemo(() => groupByDate(sessions), [sessions]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50" style={{ fontSize: '16px' }}>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {projectName}
          </span>
          <button
            type="button"
            aria-label="Buscar conversaciones"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={onNewSession}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sessions.length === 0 && (
          <p className="px-1 py-8 text-sm text-slate-400">Todavía no hay conversaciones.</p>
        )}
        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </div>
            <div className="space-y-1">
              {items.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  active={session.id === activeSessionId}
                  pending={pendingSessionIds.has(session.id)}
                  unread={unreadSessionIds.has(session.id)}
                  onClick={() => onSelect(session.id)}
                  onDelete={() => onDelete(session.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          ← Dashboard
        </button>
        <button
          type="button"
          onClick={onChangeProject}
          className="text-xs font-medium text-slate-400 hover:text-indigo-600"
        >
          Cambiar proyecto
        </button>
      </div>
    </div>
  );
}
