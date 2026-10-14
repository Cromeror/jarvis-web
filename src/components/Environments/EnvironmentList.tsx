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
        className="btn"
        data-variant="ghost"
        data-size="icon-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-[var(--sw-r-lg)] border border-border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="mb-1 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              className="flex w-full items-center rounded-[var(--sw-r-md)] px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
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
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-border bg-card transition-transform duration-200 md:relative md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Environments</span>
          <NewEnvironmentButton projects={projects} onCreate={onCreate} />
        </div>
        <FilterPopover
          icon={<FilterIcon />}
          groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: onProjectFilterChange }]}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {items.length === 0 && (
          <p className="px-2 py-8 text-sm text-muted-foreground">Todavía no hay environments definidos.</p>
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
              aria-current={active ? 'true' : undefined}
              className={`flex w-full flex-col items-start rounded-[var(--sw-r-md)] px-3 py-2 text-left text-foreground transition-colors ${
                active ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              <span className="text-sm font-semibold">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {projectNameById.get(item.projectId) ?? item.projectId}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <button type="button" onClick={onBack} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Dashboard
        </button>
      </div>
      </aside>
    </>
  );
}
