import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { SessionListItem } from '../ui/molecules/SessionListItem.js';
import { FilterPopover } from '../ui/atoms/FilterPopover.js';
import { FilterIcon } from '../ui/atoms/FilterIcon.js';

interface SessionListProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  projectFilter: string[];
  onProjectFilterChange: (projectIds: string[]) => void;
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelect: (sessionId: string) => void;
  onNewSession: (projectId: string) => void;
  onDelete: (sessionId: string) => void;
  onBack: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
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

/** Inline "pick a project" popover for creating a new conversation without a fixed project in the page. */
function NewSessionButton({
  projects,
  onCreate,
}: {
  projects: ProjectSummary[];
  onCreate: (projectId: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Nueva conversación
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            ¿En qué proyecto?
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onCreate(p.id);
              }}
              className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionList({
  sessions,
  projects,
  projectFilter,
  onProjectFilterChange,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelect,
  onNewSession,
  onDelete,
  onBack,
  mobileOpen,
  onMobileClose,
}: SessionListProps): React.ReactElement {
  const groups = useMemo(() => groupByDate(sessions), [sessions]);
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectOptions = useMemo(() => projects.map((p) => ({ label: p.name, value: p.id })), [projects]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onMobileClose} />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 overflow-hidden transition-[width] duration-200 md:relative md:w-64 ${
          mobileOpen ? 'w-72' : 'w-0'
        }`}
        style={{ fontSize: '16px' }}
      >
      <div className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 md:w-64">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">Conversaciones</span>
            <div className="flex items-center gap-1">
              <FilterPopover
                icon={<FilterIcon />}
                groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: onProjectFilterChange }]}
              />
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Cerrar conversaciones"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
              >
                <i className="pi pi-times text-base" />
              </button>
            </div>
          </div>

          <NewSessionButton projects={projects} onCreate={onNewSession} />
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
                    projectName={session.project_id ? projectNameById.get(session.project_id) : undefined}
                    onClick={() => {
                      onSelect(session.id);
                      onMobileClose();
                    }}
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
        </div>
      </div>
      </div>
    </>
  );
}
