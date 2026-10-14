import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePipelineEvents } from '../../hooks/usePipelineEvents.js';
import { stopPipelineRun } from '../../lib/pipelines-api.js';
import { Button } from '../ui/atoms/Button.js';

const STATUS_LABEL: Record<string, string> = {
  pending: '○ pendiente',
  running: '● corriendo',
  checking: '● verificando',
  completed: '✔ completado',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
};

/**
 * El estado de un paso va en el BORDE y no en el fondo: la card queda en la
 * superficie del tema y sólo el filete se tiñe con el token de estado. Un fondo
 * pastel por paso era el look viejo y, en oscuro, una lista de manchas.
 */
const BORDE_DE_PASO: Record<string, string> = {
  failed: 'border-[var(--sw-error)]',
  completed: 'border-[var(--sw-success)]',
  running: 'border-primary',
};

/** "2m 14s" — contador en vivo, recalculado cada segundo mientras el run está en curso. */
function formatDuration(sinceIso: string, nowMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function PipelineRunView(): React.ReactElement {
  const { runId } = useParams<{ runId: string }>();
  const { steps, runStatus, startedAt } = usePipelineEvents(runId ?? null);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isInFlight = runStatus === 'running' || runStatus === 'checking';

  useEffect(() => {
    if (!isInFlight) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isInFlight]);

  const currentStep = steps.find((s) => s.status === 'running');

  const handleStop = (): void => {
    if (!runId) return;
    setStopping(true);
    setStopError(null);
    stopPipelineRun(runId)
      .then(({ stopped }) => {
        if (!stopped) {
          setStopError(
            'No se pudo detener el run: ya terminó o no está siendo ejecutado por este servidor.',
          );
        }
      })
      .catch((err: unknown) => {
        setStopError(err instanceof Error ? err.message : 'Error al detener el run.');
      })
      .finally(() => setStopping(false));
  };

  return (
    <div className="pipeline-run-view mx-auto h-full max-w-3xl overflow-y-auto px-6 py-6">
      <h1 className="text-lg font-semibold text-foreground">Pipeline run {runId}</h1>
      <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
        Estado: {STATUS_LABEL[runStatus] ?? runStatus}
        {isInFlight && startedAt && (
          <span className="font-mono text-xs text-muted-foreground">{formatDuration(startedAt, now)}</span>
        )}
        {isInFlight && currentStep && (
          <span className="text-xs text-muted-foreground">
            paso actual: <code>{currentStep.step_id}</code>
          </span>
        )}
        {isInFlight && (
          <Button variant="outline" onClick={handleStop} disabled={stopping}>
            {stopping ? 'Deteniendo…' : 'Detener'}
          </Button>
        )}
      </p>
      {stopError && (
        <p
          role="alert"
          className="mt-2 rounded-[var(--sw-r-md)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-xs text-[var(--sw-on-error)]"
        >
          {stopError}
        </p>
      )}

      <ol className="pipeline-run-steps mt-4 space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`rounded-[var(--sw-r-md)] border bg-card px-3 py-2 text-xs ${BORDE_DE_PASO[step.status] ?? 'border-border'}`}
          >
            <div className="flex items-center justify-between">
              <strong className="font-mono text-[11px] text-foreground">{step.step_id}</strong>
              <span className="text-muted-foreground">{STATUS_LABEL[step.status] ?? step.status}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              <code>{step.command}</code>
            </div>
            {step.exit_code !== null && (
              <div className="mt-1 text-[11px] text-muted-foreground">exit code: {step.exit_code}</div>
            )}
            {step.stderr && (
              <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-[var(--sw-error)]">
                {step.stderr}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
