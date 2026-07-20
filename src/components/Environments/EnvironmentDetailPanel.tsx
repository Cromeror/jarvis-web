import React from 'react';
import type { EnvironmentRunSummary } from '../../lib/environments-api.js';
import { EnvironmentEditor } from './EnvironmentEditor.js';
import { Spinner } from '../ui/atoms/Spinner.js';

const STATUS_LABEL: Record<EnvironmentRunSummary['status'], string> = {
  running: '● corriendo',
  completed: '✔ ok',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
};

const STATUS_CLASS: Record<EnvironmentRunSummary['status'], string> = {
  running: 'text-indigo-600',
  completed: 'text-emerald-600',
  failed: 'text-red-600',
  cancelled: 'text-slate-400',
};

interface EnvironmentDetailPanelProps {
  projectName: string;
  name: string;
  content: string;
  onChangeContent: (value: string) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
  running: boolean;
  onRun: () => void;
  /** Runs this environment's `stop` sequence — a no-op error from the backend if it doesn't define one, since content is raw YAML here (no client-side parse to know upfront). */
  onShutdown: () => void;
  runs: EnvironmentRunSummary[];
  onOpenRun: (runId: string) => void;
}

export function EnvironmentDetailPanel({
  projectName,
  name,
  content,
  onChangeContent,
  dirty,
  saving,
  onSave,
  onDelete,
  running,
  onRun,
  onShutdown,
  runs,
  onOpenRun,
}: EnvironmentDetailPanelProps): React.ReactElement {
  return (
    <div className="flex h-full flex-1 flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{name}</div>
          <div className="text-xs text-slate-400">{projectName}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={running || dirty}
            title={dirty ? 'Guardá los cambios antes de ejecutar' : undefined}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {running && <Spinner className="h-3.5 w-3.5" />}
            Ejecutar
          </button>
          <button
            type="button"
            onClick={onShutdown}
            disabled={running || dirty}
            title={dirty ? 'Guardá los cambios antes de apagar' : 'Corre el bloque "stop" del YAML, si lo define'}
            className="flex items-center gap-2 rounded-full border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Apagar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <EnvironmentEditor content={content} onChange={onChangeContent} />
      </div>

      {runs.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-slate-200 px-6 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Historial de runs</div>
          <div className="space-y-1">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenRun(r.id)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                <span className="text-slate-500">{new Date(r.started_at).toLocaleString()}</span>
                <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
