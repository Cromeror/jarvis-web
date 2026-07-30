import React from 'react';
import { ReplicaIndicator } from '../molecules/ReplicaIndicator.js';
import { EnvTag } from '../molecules/EnvTag.js';

export interface InfrastructureTableEnv {
  name: string;
  active: boolean;
}

export interface InfrastructureTableRow {
  id: string;
  project: string;
  activeReplicas: number;
  totalReplicas: number;
  environments: InfrastructureTableEnv[];
}

interface InfrastructureTableProps {
  rows: InfrastructureTableRow[];
  className?: string;
}

const HEADERS = ['Proyecto', 'Réplicas', 'Ambientes'];

/**
 * InfrastructureTable — organismo del design system "DBoard V1.1.X" (Figma
 * node 7173:786, Table/Infraestructura). Reusa los tokens --table2-*
 * (genéricos, ya usados por RecentPipelinesTable2 — confirmado 1:1 contra
 * Figma) en vez de tokens nuevos.
 */
export function InfrastructureTable({ rows, className = '' }: InfrastructureTableProps): React.ReactElement {
  return (
    <div
      className={`overflow-hidden rounded-[var(--table2-radius)] border border-[var(--table2-border)] bg-[var(--table2-bg)] ${className}`}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[var(--table2-header-bg)]">
            {HEADERS.map((label, i) => (
              <th
                key={label}
                className={`px-[var(--table2-cell-padding-h)] py-[var(--table2-header-padding-v)] text-[11px] font-semibold uppercase tracking-wide text-[var(--card-text-secondary)] ${
                  i > 0 ? 'text-right' : ''
                }`}
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
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)] text-[13px] text-[var(--card-text-secondary)]">
                {row.project}
              </td>
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)]">
                <div className="flex justify-end">
                  <ReplicaIndicator active={row.activeReplicas} total={row.totalReplicas} />
                </div>
              </td>
              <td className="px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)]">
                <div className="flex flex-wrap justify-end gap-1.5">
                  {row.environments.map((env) => (
                    <EnvTag key={env.name} label={env.name} active={env.active} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
