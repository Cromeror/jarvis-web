import React from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { Icon } from '../Icon.js';
import type { TreeNode } from '../../lib/explorer-view.js';

/** Lo que sabemos de un directorio ya pedido al backend. */
export interface DirState {
  nodes: TreeNode[];
  loading: boolean;
  /** El directorio tenía más entradas que el tope: se avisa en vez de mentir. */
  truncated: boolean;
  error: string | null;
}

interface WorkspaceTreeProps {
  dir: string;
  dirs: Map<string, DirState>;
  expanded: Set<string>;
  selectedPath: string | undefined;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  depth?: number;
}

const ICON: Record<TreeNode['type'], string> = {
  dir: 'folder',
  file: 'archivo',
  symlink: 'enlace',
  other: 'info',
};

/**
 * Árbol del workspace, un nivel por vez.
 *
 * Cada carpeta se le pide al backend recién cuando se abre — nunca se recorre
 * el repo entero. Es lo que hace que un directorio con miles de entradas no
 * cuelgue la UI: el costo es el del nivel que estás mirando, no el del árbol.
 * El backend además acota cada nivel y avisa con `truncated`, así que ni
 * siquiera un solo directorio gigante puede llenar la pantalla.
 */
export function WorkspaceTree({
  dir,
  dirs,
  expanded,
  selectedPath,
  onToggleDir,
  onSelectFile,
  depth = 0,
}: WorkspaceTreeProps): React.ReactElement | null {
  const state = dirs.get(dir);

  if (!state) return null;
  if (state.loading && state.nodes.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground" style={{ paddingLeft: 12 + depth * 14 }}>
        <Spinner className="h-3 w-3" /> Leyendo…
      </div>
    );
  }
  if (state.error) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--sw-warning)]" style={{ paddingLeft: 12 + depth * 14 }}>
        {state.error}
      </p>
    );
  }

  return (
    <ul>
      {state.nodes.map((node) => {
        const isOpen = expanded.has(node.path);
        const isSelected = node.path === selectedPath;
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => (node.expandable ? onToggleDir(node.path) : onSelectFile(node.path))}
              title={node.path}
              style={{ paddingLeft: 8 + depth * 14 }}
              className={`flex w-full items-center gap-1.5 py-1 pr-2 text-left text-sm transition ${
                isSelected
                  ? 'bg-[var(--sw-accent-weak)] font-medium text-[var(--sw-accent-text)]'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              {/* Sin chevron (un archivo) igual se reserva su ancho: así los
                  nombres de un mismo nivel quedan alineados. */}
              <span className="inline-flex w-4 shrink-0 justify-center text-muted-foreground">
                {node.expandable && <Icon name={isOpen ? 'chevron' : 'right'} />}
              </span>
              <Icon
                name={ICON[node.type]}
                className={node.type === 'dir' ? 'text-[var(--sw-accent-text)]' : 'text-muted-foreground'}
              />
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
            </button>
            {node.expandable && isOpen && (
              <WorkspaceTree
                dir={node.path}
                dirs={dirs}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
      {state.truncated && (
        <li
          className="px-3 py-1 text-xs italic text-muted-foreground"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          …hay más entradas de las que entran en un nivel
        </li>
      )}
    </ul>
  );
}
