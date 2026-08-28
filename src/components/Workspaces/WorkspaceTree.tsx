import React from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
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
  dir: 'pi-folder',
  file: 'pi-file',
  symlink: 'pi-link',
  other: 'pi-question-circle',
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
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400" style={{ paddingLeft: 12 + depth * 14 }}>
        <Spinner className="h-3 w-3" /> Leyendo…
      </div>
    );
  }
  if (state.error) {
    return (
      <p className="px-3 py-2 text-xs text-orange-600" style={{ paddingLeft: 12 + depth * 14 }}>
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
                isSelected ? 'bg-indigo-50 font-medium text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <i
                className={`pi text-[10px] text-slate-400 ${
                  node.expandable ? (isOpen ? 'pi-chevron-down' : 'pi-chevron-right') : 'pi-fw'
                }`}
              />
              <i className={`pi ${ICON[node.type]} text-[11px] ${node.type === 'dir' ? 'text-amber-500' : 'text-slate-400'}`} />
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
          className="px-3 py-1 text-xs italic text-slate-400"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          …hay más entradas de las que entran en un nivel
        </li>
      )}
    </ul>
  );
}
