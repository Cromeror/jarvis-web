import React, { useCallback, useEffect, useState } from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { Button } from '../ui/atoms/Button.js';
import { ChangedFileList } from './ChangedFileList.js';
import { DiffView } from './DiffView.js';
import { toChangedFileRows, type ChangedFileRow, type ChangeSide } from '../../lib/diff-view.js';
import {
  listWorkspaceChanges,
  getWorkspaceFileDiff,
  type FileDiffResponse,
} from '../../lib/workspace-changes-api.js';

interface ChangesPanelProps {
  projectId: string;
  /** `undefined` = el workspace principal. Es el mismo parámetro que usa todo el apartado. */
  replicaId: string | undefined;
  /** Archivo abierto, que vive en la URL para que el link sea compartible. */
  selectedPath: string | undefined;
  onSelectFile: (path: string | undefined) => void;
}

/**
 * El panel de cambios: a la izquierda qué archivos toqué, a la derecha el diff
 * del que elija. SOLO LECTURA — no hay stage, unstage ni descarte.
 *
 * Trabaja sobre el workspace que le pasen: con `replicaId` corre contra la
 * réplica y sin él contra el principal, sin ninguna otra diferencia. La
 * elección del workspace es del apartado, no de este panel.
 */
export function ChangesPanel({ projectId, replicaId, selectedPath, onSelectFile }: ChangesPanelProps): React.ReactElement {
  const [rows, setRows] = useState<ChangedFileRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [side, setSide] = useState<ChangeSide | null>(null);
  const [diff, setDiff] = useState<FileDiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const loadList = useCallback(() => {
    setRows(null);
    setListError(null);
    listWorkspaceChanges(projectId, replicaId)
      .then((res) => {
        setRows(toChangedFileRows(res.files));
        // El `error` del backend viaja aunque la lista esté vacía: es lo que
        // distingue "no hay nada que revisar" de "no pude mirar".
        setListError(res.error);
      })
      .catch((err: unknown) => {
        setRows([]);
        setListError(err instanceof Error ? err.message : String(err));
      });
  }, [projectId, replicaId]);

  useEffect(loadList, [loadList]);

  const selectedRow = rows?.find((r) => r.path === selectedPath) ?? null;
  // El lado efectivo: el que el usuario eligió con el toggle, o el que tiene el
  // diff según la lista. Sin esto, un archivo solo stageado abriría vacío.
  const effectiveSide = side ?? selectedRow?.defaultSide ?? 'worktree';

  useEffect(() => {
    if (!selectedPath) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    getWorkspaceFileDiff(projectId, selectedPath, { staged: effectiveSide === 'staged', replicaId })
      .then((res) => { if (!cancelled) setDiff(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDiff({
          root_path: '', path: selectedPath, source: 'worktree', binary: false, truncated: false,
          diff: null, added_lines: null, deleted_lines: null,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => { if (!cancelled) setDiffLoading(false); });
    // Una respuesta vieja que llega tarde no puede pisar al archivo que el
    // usuario ya eligió después.
    return () => { cancelled = true; };
  }, [projectId, replicaId, selectedPath, effectiveSide]);

  const handleSelect = useCallback((row: ChangedFileRow) => {
    setSide(null);
    onSelectFile(row.path === selectedPath ? undefined : row.path);
  }, [onSelectFile, selectedPath]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,300px)_1fr]">
      <div className="overflow-hidden rounded-[var(--sw-r-lg)] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="text-sm font-semibold text-foreground">
            Cambios{rows ? ` (${rows.length})` : ''}
          </h2>
          <button type="button" onClick={loadList} title="Recargar" aria-label="Recargar" className="btn" data-variant="ghost" data-size="icon-sm">
            <i className="pi pi-refresh text-xs" />
          </button>
        </div>
        {rows === null ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Leyendo…</div>
        ) : (
          <>
            {listError && (
              <p className="border-b border-border bg-[var(--sw-warning-bg)] px-3 py-2 text-xs text-[var(--sw-on-warning)]">{listError}</p>
            )}
            <ChangedFileList rows={rows} selectedPath={selectedPath} onSelect={handleSelect} />
          </>
        )}
      </div>

      <div className="min-w-0 rounded-[var(--sw-r-lg)] border border-border bg-card p-4">
        {!selectedPath ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Elegí un archivo para ver qué cambió.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 truncate font-mono text-sm text-foreground" title={selectedPath}>{selectedPath}</h3>
              {/* El toggle solo aparece cuando el archivo tiene cambios en las
                  dos columnas: ofrecerlo siempre sería una decisión vacía. */}
              {selectedRow?.hasBothSides && (
                <div className="flex shrink-0 gap-1" role="group" aria-label="Qué lado del diff">
                  {(['worktree', 'staged'] as ChangeSide[]).map((option) => (
                    <Button
                      key={option}
                      size="xs"
                      variant={effectiveSide === option ? 'secondary' : 'ghost'}
                      aria-pressed={effectiveSide === option}
                      onClick={() => setSide(option)}
                    >
                      {option === 'worktree' ? 'Sin stagear' : 'Stageado'}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {diffLoading && !diff ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Leyendo el diff…</div>
            ) : diff ? (
              <DiffView diff={diff} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
