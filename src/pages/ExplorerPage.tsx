import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../components/ui/atoms/Spinner.js';
import { PlanMarkdown } from '../components/Plan/PlanMarkdown.js';
import { RawEditor } from '../components/Editor/RawEditor.js';
import { WorkspaceTree, type DirState } from '../components/Workspaces/WorkspaceTree.js';
import { listWorkspaceDir, readWorkspaceFile, type WorkspaceFileResponse } from '../lib/workspace-files-api.js';
import { Icon } from '../components/Icon.js';
import { toTreeNodes, parseExplorerPath, toExplorerPath, toPreviewState, humanSize } from '../lib/explorer-view.js';

interface ExplorerPageProps {
  projectId: string;
  /** `undefined` = el workspace principal. */
  replicaId: string | undefined;
  /**
   * La ruta actual, tal como vive en la URL: un archivo, o una carpeta marcada
   * con la barra final. Es lo que hace que el link sea compartible y que un F5
   * vuelva a abrir el arbol donde estabas.
   */
  openPath: string | undefined;
  onOpenPath: (path: string | undefined) => void;
}

/**
 * Explorador del workspace elegido: arbol navegable a la izquierda, vista
 * previa del archivo a la derecha. Solo lectura.
 *
 * El proyecto y el workspace NO se eligen aca: los fija la vista raiz del
 * apartado y llegan como props ya resueltos. Por eso este componente vive en
 * pages/ pero lo monta `WorkspacesPage` en vez de estar ruteado directo —
 * si tuviera su propia ruta tendria que resolver el contexto otra vez, y
 * habria dos lugares decidiendo contra que directorio se lee.
 *
 * El visor de la derecha: el markdown de los planes (`PlanMarkdown`, que ya
 * trae los colores de `prose` apuntados a los tokens del tema) para .md, y
 * `RawEditor` en modo lectura para el resto. Solo lectura de punta a punta:
 * nada de aca escribe en el workspace — es un apartado de consulta.
 */
export function ExplorerPage({ projectId, replicaId, openPath, onOpenPath }: ExplorerPageProps): React.ReactElement {
  const [dirs, setDirs] = useState<Map<string, DirState>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<WorkspaceFileResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const patchDir = useCallback((dir: string, patch: Partial<DirState>) => {
    setDirs((prev) => {
      const next = new Map(prev);
      const current = next.get(dir) ?? { nodes: [], loading: false, truncated: false, error: null };
      next.set(dir, { ...current, ...patch });
      return next;
    });
  }, []);

  /**
   * Pide UN nivel. Nunca recursivo: es lo que evita que un repo grande se
   * traiga entero para pintar la raiz.
   */
  const loadDir = useCallback((dir: string) => {
    patchDir(dir, { loading: true, error: null });
    listWorkspaceDir(projectId, dir, { replicaId })
      .then((res) => patchDir(dir, {
        nodes: toTreeNodes(res.dir, res.entries),
        truncated: res.truncated,
        error: res.error,
        loading: false,
      }))
      .catch((err: unknown) => patchDir(dir, {
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
  }, [patchDir, projectId, replicaId]);

  // Cambiar de workspace tira todo lo cargado: los paths son de OTRO
  // directorio y mezclarlos mostraria el arbol del anterior.
  useEffect(() => {
    setDirs(new Map());
    setExpanded(new Set());
    loadDir('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, replicaId]);

  // Entrar con una ruta de un link: hay que abrir cada carpeta del camino y
  // pedirle sus hijos, o lo seleccionado queda fuera de pantalla.
  const location = useMemo(() => parseExplorerPath(openPath), [openPath]);
  useEffect(() => {
    if (location.dirsToExpand.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const dir of location.dirsToExpand) next.add(dir);
      return next;
    });
    for (const dir of location.dirsToExpand) {
      if (!dirs.has(dir)) loadDir(dir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.dirsToExpand.join('|'), dirs.size]);

  /**
   * Abrir o cerrar una carpeta tambien mueve la URL: la ruta actual es donde
   * estas parado, no solo el ultimo archivo que abriste. Cerrarla vuelve a su
   * carpeta madre, que es lo que uno espera del "atras".
   */
  const handleToggleDir = useCallback((path: string) => {
    const isOpen = expanded.has(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(path);
      else {
        next.add(path);
        // Se pide una sola vez y queda cacheado: cerrar y volver a abrir no
        // vuelve a pegarle al backend.
        if (!dirs.has(path)) loadDir(path);
      }
      return next;
    });
    if (isOpen) {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      onOpenPath(parent === '' ? undefined : toExplorerPath(parent, true));
    } else {
      onOpenPath(toExplorerPath(path, true));
    }
  }, [dirs, expanded, loadDir, onOpenPath]);

  const handleSelectFile = useCallback((path: string) => {
    onOpenPath(toExplorerPath(path, false));
  }, [onOpenPath]);

  const selectedFile = location.selectedFile;
  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    readWorkspaceFile(projectId, selectedFile, { replicaId })
      .then((res) => { if (!cancelled) setPreview(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreview({
          root_path: '', path: selectedFile, content: null, binary: false, too_large: false, size: null,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    // Una respuesta vieja que llega tarde no puede pisar al archivo que el
    // usuario ya abrio despues.
    return () => { cancelled = true; };
  }, [projectId, replicaId, selectedFile]);

  const state = preview ? toPreviewState(preview) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
      <div className="overflow-hidden rounded-[var(--sw-r-lg)] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="text-sm font-semibold text-foreground">Archivos</h2>
          <button
            type="button"
            onClick={() => { setDirs(new Map()); setExpanded(new Set()); loadDir(''); onOpenPath(undefined); }}
            title="Recargar"
            aria-label="Recargar"
            className="btn"
            data-variant="ghost"
            data-size="icon-sm"
          >
            <i className="pi pi-refresh text-xs" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto py-1">
          <WorkspaceTree
            dir=""
            dirs={dirs}
            expanded={expanded}
            selectedPath={location.selectedFile ?? location.selectedDir}
            onToggleDir={handleToggleDir}
            onSelectFile={handleSelectFile}
          />
        </div>
      </div>

      <div className="min-w-0 rounded-[var(--sw-r-lg)] border border-border bg-card p-4">
        {!selectedFile ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {location.selectedDir
              ? `Estas en ${location.selectedDir}. Elegi un archivo para verlo.`
              : 'Elegi un archivo del arbol para verlo.'}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="min-w-0 truncate font-mono text-sm text-foreground" title={selectedFile}>{selectedFile}</h3>
              {preview?.size !== null && preview?.size !== undefined && (
                <span className="shrink-0 text-xs text-muted-foreground">{humanSize(preview.size)}</span>
              )}
            </div>

            {previewLoading && !preview ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Leyendo el archivo…</div>
            ) : state === null ? null : state.content !== null ? (
              state.kind === 'markdown' ? (
                <PlanMarkdown>{state.content}</PlanMarkdown>
              ) : (
                // El visor crudo, en modo lectura.
                <div className="h-[60vh] overflow-hidden rounded-[var(--sw-r-md)] border border-border">
                  <RawEditor content={state.content} onChange={() => undefined} readOnly />
                </div>
              )
            ) : (
              // Binario, demasiado grande, vacio o error: aviso explicito. Lo
              // que NO se hace nunca es pintar el contenido igual.
              <div
                className={`flex items-center gap-2 rounded-[var(--sw-r-md)] border px-4 py-3 text-sm ${
                  state.kind === 'error'
                    ? 'border-[var(--sw-error)] bg-[var(--sw-error-bg)] text-[var(--sw-on-error)]'
                    : state.kind === 'too_large'
                      ? 'border-[var(--sw-warning)] bg-[var(--sw-warning-bg)] text-[var(--sw-on-warning)]'
                      : 'border-border bg-muted text-secondary-foreground'
                }`}
              >
                <Icon name={state.kind === 'binary' ? 'archivo' : 'info'} />
                {state.message}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
