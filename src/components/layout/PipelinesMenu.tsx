import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listPipelineDefinitions,
  listPipelineRuns,
  runPipelineByName,
  type PipelineRunSummary,
} from '../../lib/pipelines-api.js';

const POLL_MS = 5000;

const STATUS_LABEL: Record<PipelineRunSummary['status'], string> = {
  running: '● corriendo',
  completed: '✔ completado',
  failed: '✘ falló',
};

const STATUS_CLASS: Record<PipelineRunSummary['status'], string> = {
  running: 'text-indigo-600',
  completed: 'text-emerald-600',
  failed: 'text-red-600',
};

/**
 * Pipelines button for the TopNav, scoped to the active project (read from
 * the current route by the caller — TopNav resolves :projectId). Hover shows
 * a quick popover with runs currently in progress; click opens a modal with
 * the full picture: defined pipelines (with a "Correr" action) and recent
 * run history. Polls both lists on an interval since there's no aggregate
 * SSE across runs — only per-run (see usePipelineEvents), which the modal
 * links out to via /pipeline/:runId for live step detail.
 */
export function PipelinesMenu({ projectId }: { projectId: string | null }): React.ReactElement | null {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [definitions, setDefinitions] = useState<string[]>([]);
  const [hovering, setHovering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!projectId) return;
    listPipelineRuns(projectId).then(setRuns).catch(() => { /* best-effort — keep last known list */ });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [projectId, refresh]);

  useEffect(() => {
    if (!modalOpen || !projectId) return;
    listPipelineDefinitions(projectId)
      .then(setDefinitions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar pipelines'));
  }, [modalOpen, projectId]);

  if (!projectId) return null;

  const runningRuns = runs.filter((r) => r.status === 'running');

  async function handleRun(name: string): Promise<void> {
    if (!projectId) return;
    setBusyName(name);
    setError(null);
    try {
      await runPipelineByName(projectId, name);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al correr ${name}`);
    } finally {
      setBusyName(null);
    }
  }

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title="Pipelines"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <i className="pi pi-bell" />
          {runningRuns.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
              {runningRuns.length}
            </span>
          )}
        </button>

        {hovering && !modalOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {runningRuns.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-400">Ningún pipeline corriendo</p>
            ) : (
              <ul className="space-y-1">
                {runningRuns.map((r) => (
                  <li key={r.id} className="rounded-lg px-2 py-1 text-xs">
                    <div className="font-medium text-slate-700">{r.name}</div>
                    <div className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Pipelines — {projectId}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="mb-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Disponibles</h3>
              {definitions.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No hay pipelines definidos en .jarvis/pipelines/ para este proyecto.
                </p>
              ) : (
                <ul className="space-y-2">
                  {definitions.map((name) => (
                    <li
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <span className="font-mono text-sm text-slate-700">{name}</span>
                      <button
                        type="button"
                        onClick={() => void handleRun(name)}
                        disabled={busyName === name}
                        className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {busyName === name ? 'Corriendo…' : 'Correr'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Runs recientes</h3>
              {runs.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no se corrió ningún pipeline.</p>
              ) : (
                <ul className="space-y-1.5">
                  {runs.slice(0, 15).map((r) => (
                    <li
                      key={r.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
                      onClick={() => {
                        setModalOpen(false);
                        navigate(`/pipeline/${r.id}`);
                      }}
                    >
                      <div>
                        <div className="text-sm text-slate-700">{r.name}</div>
                        <div className="text-[11px] text-slate-400">{r.started_at}</div>
                      </div>
                      <span className={`text-xs ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
