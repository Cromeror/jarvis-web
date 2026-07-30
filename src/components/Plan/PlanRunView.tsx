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
  const { steps, runStatus, stepProgress } = usePlanRunEvents(runId ?? null);
  const layers = groupByOverlap(steps);

  return (
    <div className="plan-run-view h-full overflow-y-auto bg-white mx-auto max-w-3xl px-6 py-6">
      <h1 className="text-lg font-semibold text-slate-900">Plan run {runId}</h1>
      <p className="mt-1 text-sm text-slate-500">Estado: {STATUS_LABEL[runStatus] ?? runStatus}</p>

      <div className="mt-4 space-y-3">
        {layers.map((layer, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            {layer.map((step) => (
              <div
                key={step.step_id}
                className={`min-w-[220px] flex-1 rounded-xl border px-3 py-2 text-xs ${
                  step.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : step.status === 'skipped'
                    ? 'border-slate-200 bg-slate-50 opacity-60'
                    : step.status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-indigo-200 bg-indigo-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="font-mono text-[11px] text-slate-700">{step.step_id}</strong>
                  <span className="text-slate-500">{STATUS_LABEL[step.status] ?? step.status}</span>
                </div>
                {step.started_at && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    {step.started_at}
                    {step.finished_at ? ` → ${step.finished_at}` : ''}
                  </div>
                )}
                {step.error && <pre className="mt-1 whitespace-pre-wrap text-[11px] text-red-600">{step.error}</pre>}
                {step.output && step.status === 'completed' && (
                  <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-600">{step.output}</pre>
                )}
                {/* Live output while the step runs — same <pre> treatment as the
                    completed output above, with a streaming caret. Fills the gap
                    between step_started and step_completed. */}
                {step.status === 'running' && stepProgress[step.step_id] && (
                  <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-600">
                    {stepProgress[step.step_id]}
                    <span className="animate-pulse text-indigo-400">▋</span>
                  </pre>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
