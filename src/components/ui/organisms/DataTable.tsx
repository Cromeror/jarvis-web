import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  /** Matches the Figma component's own `showHeader` prop (node 7193:35628). */
  showHeader?: boolean;
  /** Opt-in — the Figma "Table" primitive itself has no alternating row background; RecentPipelinesTable2 added that as its own domain touch via the same `--table2-row-bg-alt` token this reuses. */
  stripedRows?: boolean;
  className?: string;
}

/**
 * DataTable — organismo genérico del design system "DBoard V1.1.X" (Figma
 * node 7193:35628, "Table"). Reemplazó a la tabla genérica anterior
 * (light/slate, usada solo por UsersPage) — mismos tokens `--table2-*` que
 * ya consumía RecentPipelinesTable2, que documenta en styles-tailwind.css
 * que ese namespace se pensó para esta tabla genérica desde el vamos. El
 * sufijo -2 quedó solo en el nombre de los tokens CSS (compartidos con
 * RecentPipelinesTable2) y en RecentPipelinesTable2 mismo; no tiene sentido
 * en este componente porque ya no hay una tabla previa con la que
 * desambiguar.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  showHeader = true,
  stripedRows = false,
  className = '',
}: DataTableProps<T>): React.ReactElement {
  return (
    <div
      className={`overflow-hidden rounded-[var(--table2-radius)] border border-[var(--table2-border)] bg-[var(--table2-bg)] ${className}`}
    >
      <table className="w-full border-collapse text-left">
        {showHeader && (
          <thead>
            <tr className="bg-[var(--table2-header-bg)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-[var(--table2-cell-padding-h)] py-[var(--table2-header-padding-v)] text-[11px] font-semibold uppercase tracking-wide text-[var(--card-text-secondary)]"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row)}
              className={`border-t border-[var(--table2-row-border)] first:border-t-0 ${
                stripedRows && index % 2 === 1 ? 'bg-[var(--table2-row-bg-alt)]' : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-[var(--table2-cell-padding-h)] py-[var(--table2-row-padding-v)] text-[13px] text-[var(--card-text-secondary)] ${col.className ?? ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
