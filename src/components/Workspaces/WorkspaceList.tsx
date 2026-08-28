import React from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { WorkspaceCard } from './WorkspaceCard.js';
import type { WorkspaceRow, WorkspacesSection } from '../../lib/workspace-view.js';

interface WorkspaceListProps {
  section: WorkspacesSection;
  selectedId: string | undefined;
  /** Id que venía en la URL y no está en la lista — una réplica borrada, típicamente. */
  missingId: string | null;
  onSelect: (row: WorkspaceRow) => void;
  onRetry: () => void;
}

/**
 * La vista raíz del apartado. Cada estado de `WorkspacesSection` se pinta
 * distinto a propósito:
 *
 *  - `disabled` (el proyecto no tiene `root_path`) es un aviso explicado, no
 *    un error rojo ni una grilla vacía: no se rompió nada, el apartado
 *    todavía no le aplica a este proyecto.
 *  - `failed` (el pedido se cayó) sí es un error, y se puede reintentar.
 *  - `ready` siempre tiene al menos el principal, así que no existe el estado
 *    "no hay workspaces" — no hay nada vacío que pintar.
 */
export function WorkspaceList({ section, selectedId, missingId, onSelect, onRetry }: WorkspaceListProps): React.ReactElement {
  if (section.kind === 'loading') {
    return (
      <div className="flex items-center gap-3 p-8 text-slate-500">
        <Spinner />
        <span>Leyendo los espacios de trabajo…</span>
      </div>
    );
  }

  if (section.kind === 'disabled') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <i className="pi pi-folder-open mb-3 block text-2xl text-slate-400" />
        <h3 className="text-base font-medium text-slate-700">Este proyecto todavía no tiene espacios de trabajo</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{section.reason}</p>
      </div>
    );
  }

  if (section.kind === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i className="pi pi-exclamation-triangle mb-3 block text-2xl text-red-400" />
        <h3 className="text-base font-medium text-red-700">No se pudieron leer los espacios de trabajo</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-red-600">{section.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      {missingId && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          El espacio de trabajo <code className="font-mono">{missingId}</code> del link ya no existe. Elegí otro de la lista.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {section.rows.map((row) => (
          <WorkspaceCard key={row.id} row={row} selected={row.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}
