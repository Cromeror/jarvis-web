import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { toneForProject } from '../../lib/project-tone.js';
import { Spinner } from '../ui/atoms/Spinner.js';

interface ConversationSwitcherProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  activeSessionId: string | null;
  activeProjectName: string;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/** Trigger showing the active project — opens a popover to jump to any conversation, filterable by title or project. */
export function ConversationSwitcher({
  sessions,
  projects,
  activeSessionId,
  activeProjectName,
  pendingSessionIds,
  unreadSessionIds,
  onSelect,
  onDelete,
}: ConversationSwitcherProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const title = (s.title ?? 'Nueva conversación').toLowerCase();
      const projectName = (s.project_id ? projectNameById.get(s.project_id) : undefined)?.toLowerCase() ?? '';
      return title.includes(q) || projectName.includes(q);
    });
  }, [sessions, query, projectNameById]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 ${toneForProject(activeProjectName)}`}
      >
        {activeProjectName}
        <i className="pi pi-chevron-down text-[10px]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o proyecto..."
            className="mb-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-300"
          />
          <div className="max-h-72 overflow-y-auto">
            {filteredSessions.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-slate-400">Sin resultados.</p>
            )}
            {filteredSessions.map((session) => {
              const projectName = session.project_id ? projectNameById.get(session.project_id) : undefined;
              const active = session.id === activeSessionId;
              const pending = pendingSessionIds.has(session.id);
              const unread = unreadSessionIds.has(session.id);
              return (
                <div
                  key={session.id}
                  className={`group flex w-full items-center gap-1 rounded-lg ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelect(session.id);
                    }}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 px-2 py-1.5 text-left"
                  >
                    <span className="flex w-full min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{session.title ?? 'Nueva conversación'}</span>
                      {pending && <Spinner />}
                      {unread && !pending && (
                        <span
                          aria-label="Mensaje nuevo sin leer"
                          title="Mensaje nuevo sin leer"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600"
                        />
                      )}
                    </span>
                    {projectName && (
                      <span
                        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneForProject(projectName)}`}
                      >
                        {projectName}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    aria-label="Eliminar conversación"
                    title="Eliminar conversación"
                    className="mr-1 shrink-0 rounded px-2 py-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
