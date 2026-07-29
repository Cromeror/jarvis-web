import React from 'react';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';

export interface RecentPipelinesTable2Row {
  id: string;
  name: string;
  project: string;
  statusLabel: string;
  statusTone: BadgeStatus;
  duration: string;
}

interface RecentPipelinesTable2Props {
  rows: RecentPipelinesTable2Row[];
  className?: string;
}

const HEADERS = ['Pipeline', 'Status', 'Duration'];

/**
 * RecentPipelinesTable2 — organismo del design system "DBoard V1.1.X"
 * (Figma node 7107:226, Table/RecentPipelines, portado desde el frame
 * "PipelinesTable" que ya vivía suelto dentro del Dashboard). Mismo criterio
 * que Sidebar2/CardBase: componente nuevo y separado de DataTable (la tabla
 * genérica configurable por columnas, Figma node 7193:35628 — hoy también
 * con este mismo skin `--table2-*`, ya que reemplazó a la vieja light/slate)
 * — este organismo SÍ conoce el dominio (pipeline + proyecto + status +
 * duración) porque así es el componente en Figma, no una tabla genérica.
 */
export function RecentPipelinesTable2({ rows, className = '' }: RecentPipelinesTable2Props): React.ReactElement {
  return (
    <div
      className={`overflow-hidden rounded-[var(--table2-radius)] border border-[var(--table2-border)] bg-[var(--table2-bg)] ${className}`}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--table2-header-bg)]">
            {HEADERS.map((label) => (
              <th
                key={label}
                className="px-[var(--table2-cell-padding-h)] py-[var(--table2-header-padding-v)] text-[11px] font-semibold uppercase tracking-wide text-[var(--card-text-secondary)]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={`border-t border-[var(--table2-row-border)] first:border-t-0 ${
                index % 2 === 1 ? 'bg-[var(--table2-row-bg-alt)]' : ''
              }`}
            >
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)]">
                <div className="flex flex-col gap-[var(--table2-cell-gap)]">
                  <span className="text-sm font-medium text-[var(--card-text-secondary)]">{row.name}</span>
                  <span className="text-xs text-[var(--card-text-secondary)]">{row.project}</span>
                </div>
              </td>
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)]">
                <Badge label={row.statusLabel} status={row.statusTone} size="sm" />
              </td>
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)]">
                <span className="text-sm text-[var(--card-text-secondary)]">{row.duration}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
