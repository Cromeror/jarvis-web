import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listAllEnvironmentRuns,
  type EnvironmentRunSummary,
} from '../../lib/environments-api.js';

const POLL_MS = 5000;

const STATUS_LABEL: Record<EnvironmentRunSummary['status'], string> = {
  running: '● corriendo',
  checking: '● verificando',
  completed: '✔ ok',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
};

const STATUS_CLASS: Record<EnvironmentRunSummary['status'], string> = {
  running: 'text-indigo-600',
  checking: 'text-amber-600',
  completed: 'text-emerald-600',
  failed: 'text-red-600',
  cancelled: 'text-slate-400',
};

/**
 * Environments button for the TopNav — always visible, shows checks across
 * every project (not scoped to whichever :projectId is in the current
 * route). Structural clone of PipelinesMenu, kept as a separate
 * component/system on purpose (see packages/mcp/src/api/environments.ts
 * header): status-checks a project author writes to see what's currently
 * alive (e.g. a Docker stack and which env it's pointing at), not
 * build/deploy tasks. Hover shows a quick popover with checks currently
 * running; click opens a modal with recent run history across projects.
 */
export function EnvironmentsMenu(): React.ReactElement {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<EnvironmentRunSummary[]>([]);
  const [hovering, setHovering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(() => {
    listAllEnvironmentRuns().then(setRuns).catch(() => { /* best-effort — keep last known list */ });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const runningRuns = runs.filter((r) => r.status === 'running' || r.status === 'checking');

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title="Environments"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <i className="pi pi-server" />
          {runningRuns.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
              {runningRuns.length}
            </span>
          )}
        </button>

        {hovering && !modalOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {runningRuns.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-400">Ningún check corriendo</p>
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
              <h2 className="text-base font-semibold text-slate-900">Environments — todos los proyectos</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Runs recientes</h3>
              {runs.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no se corrió ningún check.</p>
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
                        <div className="text-[11px] text-slate-400">{r.project_id ?? '—'} · {r.started_at}</div>
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
