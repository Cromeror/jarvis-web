import React from 'react';
import type { ChangedFileRow } from '../../lib/diff-view.js';
import { Icon } from '../Icon.js';

interface ChangedFileListProps {
  rows: ChangedFileRow[];
  selectedPath: string | undefined;
  onSelect: (row: ChangedFileRow) => void;
}

const LETTER_CLASS: Record<string, string> = {
  M: 'text-[var(--sw-warning)]',
  A: 'text-[var(--sw-success)]',
  D: 'text-[var(--sw-error)]',
  U: 'text-muted-foreground',
  R: 'text-[var(--sw-accent-text)]',
  C: 'text-[var(--sw-accent-text)]',
  T: 'text-[var(--sw-accent-text)]',
  '!': 'text-[var(--sw-error)]',
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
      <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <Icon name="check" className="text-[var(--sw-success)]" />
        No hay cambios sin commitear.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const selected = row.path === selectedPath;
        return (
          <li key={row.path}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              title={`${row.label} · ${row.path}`}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                selected ? 'bg-[var(--sw-accent-weak)]' : 'hover:bg-accent'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${selected ? 'font-medium text-[var(--sw-accent-text)]' : 'text-foreground'}`}>
                  {row.name}
                </span>
                {row.dir && <span className="block truncate text-xs text-muted-foreground">{row.dir}</span>}
                {row.origPath && <span className="block truncate text-xs text-muted-foreground">← {row.origPath}</span>}
              </span>
              <span className={`shrink-0 font-mono text-xs font-bold ${LETTER_CLASS[row.letter] ?? 'text-muted-foreground'}`}>
                {row.letter}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
