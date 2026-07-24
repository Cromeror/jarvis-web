import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { FilterPopover } from '../ui/atoms/FilterPopover.js';
import { FilterIcon } from '../ui/atoms/FilterIcon.js';

/** One environment definition, tagged with the project it belongs to (a project can have any number of these). */
export interface EnvironmentListItem {
  projectId: string;
  name: string;
}

interface EnvironmentListProps {
  items: EnvironmentListItem[];
  projects: ProjectSummary[];
  projectFilter: string[];
  onProjectFilterChange: (projectIds: string[]) => void;
  activeKey: string | null;
  onSelect: (item: EnvironmentListItem) => void;
  onCreate: (projectId: string) => void;
  onBack: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function itemKey(item: EnvironmentListItem): string {
  return `${item.projectId}/${item.name}`;
}

/** Inline "pick a project" popover for creating a new environment without a fixed project in the page. */
function NewEnvironmentButton({
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
        title="Nuevo environment"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
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

export function EnvironmentList({
  items,
  projects,
  projectFilter,
  onProjectFilterChange,
  activeKey,
  onSelect,
  onCreate,
  onBack,
  mobileOpen,
  onMobileClose,
}: EnvironmentListProps): React.ReactElement {
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectOptions = useMemo(() => projects.map((p) => ({ label: p.name, value: p.id })), [projects]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-blue-500 to-indigo-800 transition-transform duration-200 md:relative md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ fontSize: '16px' }}
      >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-white">Environments</span>
          <NewEnvironmentButton projects={projects} onCreate={onCreate} />
        </div>
        <FilterPopover
          icon={<FilterIcon />}
          groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: onProjectFilterChange }]}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
        {items.length === 0 && (
          <p className="px-1 py-8 text-sm text-white/70">Todavía no hay environments definidos.</p>
        )}
        {items.map((item) => {
          const active = itemKey(item) === activeKey;
          return (
            <button
              key={itemKey(item)}
              type="button"
              onClick={() => {
                onSelect(item);
                onMobileClose();
              }}
              className={`flex w-full flex-col items-start rounded-2xl px-4 py-3 text-left transition-colors ${
                active ? 'bg-orange-500 text-white shadow-md' : 'bg-white/90 text-slate-900 hover:bg-white'
              }`}
            >
              <span className="text-sm font-semibold">{item.name}</span>
              <span className={`text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>
                {projectNameById.get(item.projectId) ?? item.projectId}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={onBack} className="text-xs font-medium text-white/70 hover:text-white">
          ← Dashboard
        </button>
      </div>
      </aside>
    </>
  );
}
