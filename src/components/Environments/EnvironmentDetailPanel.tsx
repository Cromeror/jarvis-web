import React, { useEffect, useState } from 'react';
import type { EnvironmentRunSummary, EnvironmentLifecycleStatus } from '../../lib/environments-api.js';
import { deriveEnvironmentStatus } from '../../lib/environments-api.js';
import { ROOT_REPLICA } from '../../lib/project-replicas-api.js';
import type { ProjectReplica } from '../../lib/project-replicas-api.js';
import { EnvironmentEditor } from './EnvironmentEditor.js';
import { Spinner } from '../ui/atoms/Spinner.js';
import { Button } from '../ui/atoms/Button.js';
import { StatusBadge, type StatusBadgeTone } from '../ui/atoms/StatusBadge.js';

const STATUS_LABEL: Record<EnvironmentRunSummary['status'], string> = {
  running: '● corriendo',
  checking: '● verificando',
  completed: '✔ ok',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
};

const STATUS_CLASS: Record<EnvironmentRunSummary['status'], string> = {
  running: 'text-primary',
  checking: 'text-[var(--sw-warning)]',
  completed: 'text-[var(--sw-success)]',
  failed: 'text-[var(--sw-error)]',
  cancelled: 'text-muted-foreground',
};

const LIFECYCLE_BADGE: Record<EnvironmentLifecycleStatus, { label: string; tone: StatusBadgeTone }> = {
  'never-run': { label: 'SIN EJECUTAR', tone: 'neutral' },
  running: { label: '● CORRIENDO', tone: 'success' },
  checking: { label: '● VERIFICANDO…', tone: 'warning' },
  connected: { label: '✔ CONECTADO', tone: 'success' },
  stopped: { label: 'DETENIDO', tone: 'neutral' },
  failed: { label: 'FALLÓ', tone: 'danger' },
  stopping: { label: 'APAGANDO…', tone: 'warning' },
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
  /** Runs ONLY this environment's `check` sequence on demand — a no-op error from the backend if it doesn't define one. */
  onCheck: () => void;
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
  onCheck,
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
  const isInFlight = lifecycleStatus === 'running' || lifecycleStatus === 'checking';

  // Cronómetro en vivo (a diferencia de "hace Xd Yh" de un environment ya
  // conectado, que no necesita recalcularse cada segundo) — mientras está
  // levantando o verificando, el usuario quiere ver el tiempo corriendo.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isInFlight) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isInFlight]);

  const elapsedLabel =
    isInFlight && runs[0]
      ? (() => {
          const totalSeconds = Math.max(0, Math.floor((now - new Date(runs[0].started_at).getTime()) / 1000));
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        })()
      : null;
  const uptime = lifecycleStatus === 'connected' && runs[0] ? formatElapsed(runs[0].started_at) : null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBackToList} className="md:hidden">
            <i className="pi pi-angle-left text-base" />
            Volver a la lista
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              <StatusBadge label={badge.label} tone={badge.tone} />
            </div>
            <div className="text-xs text-muted-foreground">
              {projectName}
              {uptime && <> · hace {uptime}</>}
              {elapsedLabel && <> · {elapsedLabel}</>}
            </div>
          </div>
          {replicas.length > 0 && (
            <div className="flex items-center gap-1 rounded-[var(--sw-r-md)] bg-muted p-1">
              {replicaOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeReplica(opt.value)}
                  className={`rounded-[var(--sw-r-sm)] px-3 py-1 text-xs font-medium transition-colors ${
                    opt.value === replicaId ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onRun}
            disabled={running || dirty}
            title={dirty ? 'Guardá los cambios antes de ejecutar' : undefined}
            variant="primary" className="gap-2"
          >
            {running && <Spinner className="h-3.5 w-3.5" />}
            Ejecutar
          </Button>
          <Button
            variant="outline"
            onClick={onCheck}
            disabled={running || dirty}
            title={dirty ? 'Guardá los cambios antes de verificar' : 'Corre el bloque "check" del YAML, si lo define'}
          >
            Verificar
          </Button>
          <Button
            variant="outline"
            onClick={onShutdown}
            disabled={running || dirty}
            title={dirty ? 'Guardá los cambios antes de apagar' : 'Corre el bloque "stop" del YAML, si lo define'}
          >
            Apagar
          </Button>
          <Button variant="outline" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-muted">
        <div className="flex items-center justify-between px-6 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Environment config (YAML)</span>
          <Button variant="ghost" onClick={handleCopy}>
            <i className={`pi ${copied ? 'pi-check' : 'pi-copy'} text-xs`} />
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <EnvironmentEditor content={content} onChange={onChangeContent} />
        </div>
      </div>

      {runs.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-border px-6 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de runs</div>
          <div className="flex flex-col gap-1">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenRun(r.id)}
                className="flex w-full items-center justify-between rounded-[var(--sw-r-md)] px-2 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
                <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
