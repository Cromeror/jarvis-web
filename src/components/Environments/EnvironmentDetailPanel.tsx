import React, { useState } from 'react';
import type { EnvironmentRunSummary, EnvironmentLifecycleStatus } from '../../lib/environments-api.js';
import { deriveEnvironmentStatus } from '../../lib/environments-api.js';
import { ROOT_REPLICA } from '../../lib/project-replicas-api.js';
import type { ProjectReplica } from '../../lib/project-replicas-api.js';
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

const LIFECYCLE_BADGE: Record<EnvironmentLifecycleStatus, { label: string; className: string }> = {
  'never-run': { label: 'SIN EJECUTAR', className: 'bg-slate-100 text-slate-500' },
  running: { label: '● CORRIENDO', className: 'bg-emerald-100 text-emerald-700' },
  stopped: { label: 'DETENIDO', className: 'bg-slate-100 text-slate-500' },
  failed: { label: 'FALLÓ', className: 'bg-red-100 text-red-700' },
  stopping: { label: 'APAGANDO…', className: 'bg-amber-100 text-amber-700' },
};

/** "Corriendo desde hace 18h 42m" — granularidad de minutos, no un cronómetro en vivo (se recalcula en cada render). */
function formatElapsed(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
  /** Réplicas del proyecto activo — vacío si no tiene ninguna, en cuyo caso el selector no se muestra. */
  replicas: ProjectReplica[];
  /** ROOT_REPLICA = correr/apagar contra el root_path del proyecto (comportamiento de siempre). */
  replicaId: string;
  onChangeReplica: (replicaId: string) => void;
  runs: EnvironmentRunSummary[];
  onOpenRun: (runId: string) => void;
  /** Reabre el drawer de la lista en mobile (mismo control que EnvironmentList.mobileOpen). Sin esto, al seleccionar un environment el usuario queda atrapado en el detalle. */
  onBackToList: () => void;
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
  replicas,
  replicaId,
  onChangeReplica,
  runs,
  onOpenRun,
  onBackToList,
}: EnvironmentDetailPanelProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const replicaOptions = [
    { label: projectName, value: ROOT_REPLICA },
    ...replicas.map((r) => ({ label: r.slug, value: r.id })),
  ];

  const lifecycleStatus = deriveEnvironmentStatus(runs);
  const badge = LIFECYCLE_BADGE[lifecycleStatus];
  const uptime = lifecycleStatus === 'running' && runs[0] ? formatElapsed(runs[0].started_at) : null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
          >
            <i className="pi pi-angle-left text-base" />
            Volver a la lista
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {projectName}
              {uptime && <> · hace {uptime}</>}
            </div>
          </div>
          {replicas.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
              {replicaOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeReplica(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    opt.value === replicaId ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
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

      <div className="flex min-h-0 flex-1 flex-col bg-slate-950">
        <div className="flex items-center justify-between px-6 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Environment config (YAML)</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <i className={`pi ${copied ? 'pi-check' : 'pi-copy'} text-xs`} />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <EnvironmentEditor content={content} onChange={onChangeContent} />
        </div>
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
