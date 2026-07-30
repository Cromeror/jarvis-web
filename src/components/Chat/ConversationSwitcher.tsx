import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { toneForProject } from '../../lib/project-tone.js';
import { Spinner } from '../ui/atoms/Spinner.js';

interface ConversationSwitcherProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
}

/** Trigger de búsqueda global — abre un popover para saltar a cualquier conversación de cualquier proyecto, filtrable por título o proyecto. El tab activo del ProjectTabStrip ya muestra el proyecto en foco, este trigger es solo para buscar. */
export function ConversationSwitcher({
  sessions,
  projects,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelect,
  onDelete,
  onRename,
}: ConversationSwitcherProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const startEditing = (session: ChatSession): void => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title ?? '');
  };

  const commitEditing = (): void => {
    const sessionId = editingSessionId;
    const trimmed = editingTitle.trim();
    setEditingSessionId(null);
    if (sessionId && trimmed) onRename(sessionId, trimmed);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setEditingSessionId(null);
    }
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
        title="Buscar conversación"
        aria-label="Buscar conversación"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--tab-text-default)] transition-colors hover:bg-white/10 hover:text-[var(--tab-text-hover)]"
      >
        <i className="pi pi-search text-sm" />
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
              const editing = editingSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={`group flex w-full items-center gap-1 rounded-lg ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  {editing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEditing();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingSessionId(null);
                        }
                      }}
                      className="min-w-0 flex-1 rounded-md border border-indigo-300 px-2 py-1.5 text-sm text-slate-700 outline-none"
                    />
                  ) : (
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
                  )}
                  {!editing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(session);
                      }}
                      aria-label="Renombrar conversación"
                      title="Renombrar conversación"
                      className="shrink-0 rounded px-2 py-1 text-slate-400 opacity-0 transition-opacity hover:text-indigo-600 group-hover:opacity-100"
                    >
                      <i className="pi pi-pencil text-xs" />
                    </button>
                  )}
                  {!editing && (
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
