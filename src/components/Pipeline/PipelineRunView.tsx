import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePipelineEvents } from '../../hooks/usePipelineEvents.js';
import { stopPipelineRun } from '../../lib/pipelines-api.js';

const STATUS_LABEL: Record<string, string> = {
  pending: '○ pendiente',
  running: '● corriendo',
  checking: '● verificando',
  completed: '✔ completado',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
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
    <div className="pipeline-run-view h-full overflow-y-auto mx-auto max-w-3xl px-6 py-6">
      <h1 className="text-lg font-semibold text-slate-900">Pipeline run {runId}</h1>
      <p className="mt-1 flex items-center gap-3 text-sm text-slate-500">
        Estado: {STATUS_LABEL[runStatus] ?? runStatus}
        {isInFlight && startedAt && (
          <span className="font-mono text-xs text-slate-400">{formatDuration(startedAt, now)}</span>
        )}
        {isInFlight && currentStep && (
          <span className="text-xs text-slate-400">
            paso actual: <code>{currentStep.step_id}</code>
          </span>
        )}
        {isInFlight && (
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {stopping ? 'Deteniendo…' : 'Detener'}
          </button>
        )}
      </p>
      {stopError && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {stopError}
        </p>
      )}

      <ol className="pipeline-run-steps mt-4 space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`rounded-xl border px-3 py-2 text-xs ${
              step.status === 'failed'
                ? 'border-red-200 bg-red-50'
                : step.status === 'completed'
                ? 'border-emerald-200 bg-emerald-50'
                : step.status === 'running'
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <strong className="font-mono text-[11px] text-slate-700">{step.step_id}</strong>
              <span className="text-slate-500">{STATUS_LABEL[step.status] ?? step.status}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              <code>{step.command}</code>
            </div>
            {step.exit_code !== null && (
              <div className="mt-1 text-[11px] text-slate-400">exit code: {step.exit_code}</div>
            )}
            {step.stderr && (
              <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-red-600">
                {step.stderr}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
