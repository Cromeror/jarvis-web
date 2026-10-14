import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { CommitGraph } from './CommitGraph.js';
import { CommitDetailPanel } from './CommitDetailPanel.js';
import { buildCommitGraph, toGraphState, appendPage, type GraphState } from '../../lib/graph-view.js';
import {
  listWorkspaceLog,
  getWorkspaceCommit,
  type CommitDetailResponse,
} from '../../lib/workspace-history-api.js';
import { Button } from '../ui/atoms/Button.js';
import { Icon } from '../Icon.js';

interface GraphPanelProps {
  projectId: string;
  /** `undefined` = el workspace principal. */
  replicaId: string | undefined;
  /** Commit abierto, que vive en la URL para que el link sea compartible. */
  selectedHash: string | undefined;
  onSelectCommit: (hash: string | undefined) => void;
}

/** Cuantos commits trae cada pagina. El backend acota a 500 como tope duro. */
const PAGE_SIZE = 50;

/**
 * La vista de grafo: carriles a la izquierda, y a la derecha el detalle del
 * commit elegido.
 *
 * NO se dibuja la historia entera: se pide de a paginas de PAGE_SIZE y el
 * backend devuelve el cursor de la siguiente. Es lo que permite que el
 * algoritmo de carriles corra sobre lo que se ve (medido en 0,33 ms por
 * pagina) y que un repo de miles de commits no arme un SVG de miles de filas
 * de entrada.
 */
export function GraphPanel({ projectId, replicaId, selectedHash, onSelectCommit }: GraphPanelProps): React.ReactElement {
  const [state, setState] = useState<GraphState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  // Que fallo al traer la pagina siguiente. Tragarselo dejaba el unico caso en
  // el que un error se disfraza de estado normal: sin cursor no hay boton, y
  // "no se pudo leer mas" se ve identico a "llegaste al final de la historia".
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommitDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadFirstPage = useCallback(() => {
    setState({ kind: 'loading' });
    setLoadMoreError(null);
    listWorkspaceLog(projectId, { replicaId, limit: PAGE_SIZE })
      .then((res) => setState(toGraphState(res)))
      // Solo un pedido que NO llego es `failed`: ahi reintentar tiene sentido.
      // Un repo sin commits o sin git los resuelve `toGraphState` como vacio.
      .catch((err: unknown) => setState({
        kind: 'failed',
        message: err instanceof Error ? err.message : String(err),
      }));
  }, [projectId, replicaId]);

  useEffect(loadFirstPage, [loadFirstPage]);

  const loadMore = useCallback(() => {
    if (state.kind !== 'ready' || !state.nextCursor) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    listWorkspaceLog(projectId, { replicaId, limit: PAGE_SIZE, cursor: state.nextCursor })
      // Se apila: los carriles se calculan sobre el acumulado o la rama se
      // veria partida justo en el limite de pagina. `appendPage` no apila una
      // pagina con error, asi que el cursor sobrevive para reintentar.
      .then((res) => {
        if (res.error) setLoadMoreError(res.error);
        setState((prev) => appendPage(prev, res));
      })
      .catch((err: unknown) => setLoadMoreError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingMore(false));
  }, [projectId, replicaId, state]);

  const graph = useMemo(
    () => buildCommitGraph(state.kind === 'ready' ? state.commits : []),
    [state],
  );

  useEffect(() => {
    if (!selectedHash) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getWorkspaceCommit(projectId, selectedHash, { replicaId })
      .then((res) => { if (!cancelled) setDetail(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetail({
          root_path: '', commit: null, files: [], diff: null, truncated: false,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    // Una respuesta vieja que llega tarde no puede pisar al commit que el
    // usuario ya eligio despues.
    return () => { cancelled = true; };
  }, [projectId, replicaId, selectedHash]);

  if (state.kind === 'loading') {
    return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Spinner /> Leyendo la historia…</div>;
  }

  // Sin historia que dibujar — sea porque el root no es un repo git o porque
  // todavia no tiene commits — es un estado vacio explicado, no un error.
  if (state.kind === 'empty') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--sw-r-lg)] border border-border bg-card p-8 text-center">
        <Icon name="branch" className="text-muted-foreground" />
        <h3 className="text-base font-medium text-foreground">No hay historia para mostrar</h3>
        <p className="max-w-md text-sm text-muted-foreground">{state.reason}</p>
      </div>
    );
  }

  // Y esto sí es una falla: el pedido no llego. Por eso se puede reintentar.
  if (state.kind === 'failed') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--sw-r-lg)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] p-8 text-center text-[var(--sw-on-error)]">
        <Icon name="alerta" />
        <h3 className="text-base font-medium">No se pudo leer la historia</h3>
        <p className="max-w-md text-sm">{state.message}</p>
        <Button onClick={loadFirstPage} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,45%)]">
      <div className="min-w-0 overflow-hidden rounded-[var(--sw-r-lg)] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <h2 className="text-sm font-semibold text-foreground">Historia ({state.commits.length})</h2>
          <button type="button" onClick={loadFirstPage} title="Recargar" aria-label="Recargar" className="btn" data-variant="ghost" data-size="icon-sm">
            <i className="pi pi-refresh text-xs" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <CommitGraph
            rows={graph.rows}
            laneCount={graph.laneCount}
            selectedHash={selectedHash}
            onSelect={(hash) => onSelectCommit(hash === selectedHash ? undefined : hash)}
          />
        </div>
        {state.nextCursor && (
          <div className="flex flex-col items-center gap-2 border-t border-border p-2 text-center">
            {loadMoreError && (
              <p className="text-xs text-[var(--sw-error)]">
                No se pudo traer la pagina siguiente: {loadMoreError}
              </p>
            )}
            <Button
              onClick={loadMore}
              disabled={loadingMore}
              variant="outline"
            >
              {loadingMore ? 'Cargando…' : loadMoreError ? 'Reintentar' : `Cargar ${PAGE_SIZE} commits mas`}
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-[var(--sw-r-lg)] border border-border bg-card p-4">
        <CommitDetailPanel detail={detail} loading={detailLoading} />
      </div>
    </div>
  );
}
