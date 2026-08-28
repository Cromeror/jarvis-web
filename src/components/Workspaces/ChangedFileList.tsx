import React from 'react';
import type { ChangedFileRow } from '../../lib/diff-view.js';

interface ChangedFileListProps {
  rows: ChangedFileRow[];
  selectedPath: string | undefined;
  onSelect: (row: ChangedFileRow) => void;
}

const LETTER_CLASS: Record<string, string> = {
  M: 'text-orange-500',
  A: 'text-emerald-600',
  D: 'text-red-500',
  U: 'text-slate-400',
  R: 'text-indigo-500',
  C: 'text-indigo-500',
  T: 'text-indigo-500',
  '!': 'text-red-600',
};

/**
 * La columna de archivos cambiados, al estilo del panel de Source Control de
 * VSCode: nombre, su carpeta en gris, y la letra del estado a la derecha.
 *
 * Lista plana y no árbol a propósito: el objetivo es "saber qué modifiqué"
 * de un vistazo, y un árbol con un solo archivo por rama obliga a expandir
 * carpetas para llegar a lo que uno ya sabe que tocó.
 */
export function ChangedFileList({ rows, selectedPath, onSelect }: ChangedFileListProps): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        <i className="pi pi-check-circle mb-2 block text-xl text-emerald-400" />
        No hay cambios sin commitear.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => {
        const selected = row.path === selectedPath;
        return (
          <li key={row.path}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              title={`${row.label} · ${row.path}`}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                selected ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${selected ? 'font-medium text-indigo-900' : 'text-slate-700'}`}>
                  {row.name}
                </span>
                {row.dir && <span className="block truncate text-xs text-slate-400">{row.dir}</span>}
                {row.origPath && <span className="block truncate text-xs text-slate-400">← {row.origPath}</span>}
              </span>
              <span className={`shrink-0 font-mono text-xs font-bold ${LETTER_CLASS[row.letter] ?? 'text-slate-400'}`}>
                {row.letter}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
