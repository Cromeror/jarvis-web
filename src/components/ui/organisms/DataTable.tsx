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
}

/**
 * Generic read-only data table — columns and cell rendering are fully
 * caller-defined, this component has no domain knowledge of what it displays.
 */
export function DataTable<T>({ columns, rows, getRowKey }: DataTableProps<T>): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-slate-50 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={`px-6 py-4 ${col.className ?? ''}`}>
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
