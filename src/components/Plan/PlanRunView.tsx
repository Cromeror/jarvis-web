import React from 'react';
import { useParams } from 'react-router-dom';
import { usePlanRunEvents } from '../../hooks/usePlanRunEvents.js';
import type { PlanRunStepSnapshot } from '../../lib/plans-api.js';

const STATUS_LABEL: Record<string, string> = {
  pending: '○ pendiente',
  running: '● corriendo',
  completed: '✔ completado',
  failed: '✘ falló',
  skipped: '⊘ saltado',
};

/* El estado de un paso (y del run) como `.badge` de Basecoat. Antes cada
   tarjeta se pintaba entera con un pastel fijo (rojo, verde, índigo) que en
   oscuro quedaba como manchas claras; ahora la tarjeta es la superficie del
   tema y el estado lo dice el badge, con los tokens de estado. */
const STATUS_VARIANT: Record<string, string | undefined> = {
  pending: 'mute',
  running: 'warning',
  completed: 'success',
  failed: 'error',
  skipped: 'mute',
};

/** Groups steps into visual "layers" of steps whose [started_at, finished_at] intervals overlapped — a cheap stand-in for a real DAG layout. */
function groupByOverlap(steps: PlanRunStepSnapshot[]): PlanRunStepSnapshot[][] {
  const withTimes = steps.filter((s) => s.started_at);
  const withoutTimes = steps.filter((s) => !s.started_at);
  const sorted = [...withTimes].sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''));

  const layers: PlanRunStepSnapshot[][] = [];
  for (const step of sorted) {
    const start = step.started_at!;
    const end = step.finished_at ?? '9999-99-99 99:99:99';
    const layer = layers.find((l) =>
      l.every((s) => {
        const sStart = s.started_at!;
        const sEnd = s.finished_at ?? '9999-99-99 99:99:99';
        return end < sStart || start > sEnd;
      }),
    );
    if (layer) layer.push(step);
    else layers.push([step]);
  }
  if (withoutTimes.length) layers.push(withoutTimes);
  return layers;
}

export function PlanRunView(): React.ReactElement {
  const { runId } = useParams<{ runId: string }>();
  const { steps, runStatus, stepProgress, replicaId } = usePlanRunEvents(runId ?? null);
  const layers = groupByOverlap(steps);

  return (
    <div className="plan-run-view h-full overflow-y-auto bg-[var(--sw-ink)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Plan run {runId}</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Estado:
            <span className="badge" data-variant={STATUS_VARIANT[runStatus]}>
              {STATUS_LABEL[runStatus] ?? runStatus}
            </span>
            {' · '}
            {/* Dónde corrió: sin réplica es el working tree del proyecto, el mismo
                que usa el chat. Con réplica, su worktree — nadie se pisa. */}
            {replicaId ? 'en una réplica' : 'en el proyecto'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {layers.map((layer, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              {layer.map((step) => (
                <div
                  key={step.step_id}
                  className={`flex min-w-[220px] flex-1 flex-col gap-1 rounded-[var(--sw-r-lg)] border bg-card px-3 py-2 text-xs ${
                    step.status === 'failed' ? 'border-[var(--sw-error)]' : 'border-border'
                  } ${step.status === 'skipped' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="font-mono text-[11px] text-foreground">{step.step_id}</strong>
                    <span className="badge" data-variant={STATUS_VARIANT[step.status]}>
                      {STATUS_LABEL[step.status] ?? step.status}
                    </span>
                  </div>
                  {step.started_at && (
                    <div className="text-[11px] text-muted-foreground">
                      {step.started_at}
                      {step.finished_at ? ` → ${step.finished_at}` : ''}
                    </div>
                  )}
                  {step.error && (
                    <pre className="whitespace-pre-wrap text-[11px] text-[var(--sw-error)]">{step.error}</pre>
                  )}
                  {/* También en 'failed': una tool que declara el fallo en su
                      salida deja la evidencia ahí (qué check rompió, la cola del
                      log) y `error` sólo dice por qué el paso cuenta como fallado.
                      Sin esto, el único caso donde el detalle importa es el único
                      que no se ve. */}
                  {step.output && (step.status === 'completed' || step.status === 'failed') && (
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-secondary-foreground">
                      {step.output}
                    </pre>
                  )}
                  {/* Live output while the step runs — same <pre> treatment as the
                      completed output above, with a streaming caret. Fills the gap
                      between step_started and step_completed. */}
                  {step.status === 'running' && stepProgress[step.step_id] && (
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-secondary-foreground">
                      {stepProgress[step.step_id]}
                      <span className="animate-pulse text-primary">▋</span>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
