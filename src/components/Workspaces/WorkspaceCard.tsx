import React from 'react';
import { Card } from '../ui/atoms/Card.js';
import { IconTile } from '../ui/atoms/IconTile.js';
import { StatusBadge } from '../ui/atoms/StatusBadge.js';
import { timeAgo } from '../../lib/time-ago.js';
import { branchLabel, changesLabel, type WorkspaceRow } from '../../lib/workspace-view.js';

interface WorkspaceCardProps {
  row: WorkspaceRow;
  selected: boolean;
  onSelect: (row: WorkspaceRow) => void;
}

/**
 * Una tarjeta por espacio de trabajo: rama, cuántos cambios sin commitear y
 * cuál fue el último commit.
 *
 * Elegirla fija el contexto del resto del apartado, así que una fila no
 * seleccionable (rota, o a medio crear) no se comporta como botón: no tiene
 * cursor de mano ni responde al click, y muestra por qué. Ofrecerla y que
 * después todas las vistas fallen sería peor que no ofrecerla.
 */
export function WorkspaceCard({ row, selected, onSelect }: WorkspaceCardProps): React.ReactElement {
  const clickable = row.selectable;
  return (
    <div
      onClick={clickable ? () => onSelect(row) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row); } } : undefined}
      aria-pressed={clickable ? selected : undefined}
      className={`h-full rounded-2xl transition ${clickable ? 'cursor-pointer' : 'cursor-default'} ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      <Card className={`flex h-full flex-col gap-3 ${row.selectable ? '' : 'opacity-75'}`}>
        <div className="flex items-start justify-between gap-2">
          <IconTile
            icon={row.kind === 'main' ? 'pi-home' : 'pi-clone'}
            className={row.kind === 'main' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}
          />
          <StatusBadge label={row.statusLabel} tone={row.statusTone} />
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-800">{row.title}</h3>
          {/* El path completo es lo que desambigua dos réplicas del mismo
              proyecto, así que va como title para poder leerlo entero. */}
          <p className="truncate text-xs text-slate-400" title={row.rootPath}>{row.rootPath}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5" title="Rama actual">
            <i className="pi pi-sitemap text-[11px] text-slate-400" />
            {branchLabel(row)}
          </span>
          <span className="inline-flex items-center gap-1.5" title="Archivos con cambios sin commitear">
            <i className="pi pi-pencil text-[11px] text-slate-400" />
            {changesLabel(row)}
          </span>
        </div>

        {row.lastCommit ? (
          <div className="mt-auto border-t border-slate-100 pt-3">
            <p className="truncate text-sm text-slate-700" title={row.lastCommit.subject}>
              {row.lastCommit.subject}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {row.lastCommit.hash.slice(0, 7)} · {timeAgo(row.lastCommit.date)}
            </p>
          </div>
        ) : (
          <div className="mt-auto border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">Sin commits todavía</p>
          </div>
        )}

        {row.note && (
          <p className={`text-xs ${row.status === 'broken' ? 'text-red-600' : 'text-slate-400'}`}>{row.note}</p>
        )}
      </Card>
    </div>
  );
}
