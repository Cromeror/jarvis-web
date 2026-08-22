import React, { useEffect, useRef, useState } from 'react';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { Button2 } from '../ui/atoms/Button2.js';
import { ButtonGroup } from '../ui/atoms/ButtonGroup.js';
import { Icons } from '../ui/atoms/Icons.js';

/**
 * Botón principal "Nueva conversación" (crea directo en `activeProjectId`) +
 * botón secundario para abrir el popover de "¿en qué proyecto?" cuando se
 * quiere crear en uno distinto al activo.
 *
 * Sin proyecto activo (todavía no hay ninguna conversación en pantalla) el
 * botón principal no tiene qué asumir, así que cae al mismo comportamiento
 * que el secundario: abrir el picker.
 */
export function NewSessionButton({
  projects,
  activeProjectId,
  onCreate,
}: {
  projects: ProjectSummary[];
  activeProjectId: string | null;
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
      <ButtonGroup>
        <Button2
          label="Nueva conversación"
          size="xs"
          iconLeft={<Icons icon="Plus" size={16} />}
          onClick={() => (activeProjectId ? onCreate(activeProjectId) : setOpen((o) => !o))}
        />
        <Button2
          label=""
          size="xs"
          iconLeft={<Icons icon="chevron-right" size={14} className="rotate-90" />}
          onClick={() => setOpen((o) => !o)}
        />
      </ButtonGroup>

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
