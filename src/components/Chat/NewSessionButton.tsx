import React, { useEffect, useRef, useState } from 'react';
import type { ProjectSummary } from '../../lib/projects-api.js';

/** Inline "pick a project" popover for creating a new conversation without a fixed project in the page. */
export function NewSessionButton({
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
        className="flex items-center gap-1 rounded-lg bg-[var(--sidebar2-accent-default)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--buttonicon-primary-bg-hover)]"
      >
        <i className="pi pi-plus text-[10px]" />
        Nuevo
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            ¿En qué proyecto?
          </div>
          <div className="max-h-64 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate(p.id);
                }}
                className="flex w-full items-center border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
