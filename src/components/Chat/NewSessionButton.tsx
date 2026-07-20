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
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600"
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
