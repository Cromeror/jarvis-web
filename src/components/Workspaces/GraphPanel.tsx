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
  const [detail, setDetail] = useState<CommitDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadFirstPage = useCallback(() => {
    setState({ kind: 'loading' });
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
    listWorkspaceLog(projectId, { replicaId, limit: PAGE_SIZE, cursor: state.nextCursor })
      // Se apila: los carriles se calculan sobre el acumulado o la rama se
      // veria partida justo en el limite de pagina.
      .then((res) => setState((prev) => appendPage(prev, res)))
      .catch(() => undefined)
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
    return <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Spinner /> Leyendo la historia…</div>;
  }

  // Sin historia que dibujar — sea porque el root no es un repo git o porque
  // todavia no tiene commits — es un estado vacio explicado, no un error.
  if (state.kind === 'empty') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <i className="pi pi-sitemap mb-3 block text-2xl text-slate-400" />
        <h3 className="text-base font-medium text-slate-700">No hay historia para mostrar</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{state.reason}</p>
      </div>
    );
  }

  // Y esto sí es una falla: el pedido no llego. Por eso se puede reintentar.
  if (state.kind === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <i className="pi pi-exclamation-triangle mb-3 block text-2xl text-red-400" />
        <h3 className="text-base font-medium text-red-700">No se pudo leer la historia</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-red-600">{state.message}</p>
        <button
          type="button"
          onClick={loadFirstPage}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,45%)]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-700">Historia ({state.commits.length})</h2>
          <button type="button" onClick={loadFirstPage} title="Recargar" className="text-slate-400 hover:text-slate-600">
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
          <div className="border-t border-slate-100 p-2 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Cargando…' : `Cargar ${PAGE_SIZE} commits mas`}
            </button>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
        <CommitDetailPanel detail={detail} loading={detailLoading} />
      </div>
    </div>
  );
}
