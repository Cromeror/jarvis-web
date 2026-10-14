import React from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { WorkspaceCard } from './WorkspaceCard.js';
import type { WorkspaceRow, WorkspacesSection } from '../../lib/workspace-view.js';
import { Button } from '../ui/atoms/Button.js';
import { Icon } from '../Icon.js';

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
      <div className="flex items-center gap-3 p-8 text-muted-foreground">
        <Spinner />
        <span>Leyendo los espacios de trabajo…</span>
      </div>
    );
  }

  if (section.kind === 'disabled') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--sw-r-lg)] border border-border bg-card p-8 text-center">
        <Icon name="folder" className="text-muted-foreground" />
        <h3 className="text-base font-medium text-foreground">Este proyecto todavía no tiene espacios de trabajo</h3>
        <p className="max-w-xl text-sm text-muted-foreground">{section.reason}</p>
      </div>
    );
  }

  if (section.kind === 'failed') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--sw-r-lg)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] p-8 text-center text-[var(--sw-on-error)]">
        <Icon name="alerta" />
        <h3 className="text-base font-medium">No se pudieron leer los espacios de trabajo</h3>
        <p className="max-w-xl text-sm">{section.message}</p>
        <Button onClick={onRetry} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {missingId && (
        <div className="rounded-[var(--sw-r-md)] border border-[var(--sw-warning)] bg-[var(--sw-warning-bg)] px-4 py-3 text-sm text-[var(--sw-on-warning)]">
          El espacio de trabajo <code className="font-mono">{missingId}</code> del link ya no existe. Elegí otro de la lista.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {section.rows.map((row) => (
          <WorkspaceCard key={row.id} row={row} selected={row.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
