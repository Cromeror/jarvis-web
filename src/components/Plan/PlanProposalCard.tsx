import React, { useEffect, useState } from 'react';
import { getPlan, approvePlan, launchPlan } from '../../lib/plans-api.js';
import type { PlanDetail } from '../../lib/plans-api.js';

interface PlanProposalCardProps {
  planId: string;
  /** Called with the run id once the plan is launched, so the caller can navigate to the progress view. */
  onLaunched?: (runId: string) => void;
}

const KIND_LABEL: Record<string, string> = {
  note: 'Nota',
  tool_call: 'Tool',
};

/**
 * Renders a plan proposed during a Plan Mode turn — inline in the chat —
 * so the user can review the step graph and approve/launch it right there,
 * without having to navigate to the plans list first.
 */
export function PlanProposalCard({ planId, onLaunched }: PlanProposalCardProps): React.ReactElement {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlan(planId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el plan'); });
    return () => { cancelled = true; };
  }, [planId]);

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (!detail) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">Cargando plan…</div>;
  }

  const { plan, steps } = detail;
  const sorted = [...steps].sort((a, b) => a.step_index - b.step_index);

  async function handleApprove(): Promise<void> {
    setBusy(true);
    try {
      await approvePlan(planId);
      const fresh = await getPlan(planId);
      setDetail(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aprobar el plan');
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch(): Promise<void> {
    setBusy(true);
    try {
      if (plan.status === 'draft') await approvePlan(planId);
      await launchPlan(planId);
      const fresh = await getPlan(planId);
      setDetail(fresh);
      onLaunched?.(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al lanzar el plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{plan.title}</h3>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{plan.status}</span>
      </div>

      <div className="mb-3 space-y-2 text-sm text-slate-700">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Contexto</div>
          <p className="mt-0.5 whitespace-pre-wrap">{plan.context}</p>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Arquitectura</div>
          <p className="mt-0.5 whitespace-pre-wrap">{plan.architecture}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Pasos</div>
        <ol className="space-y-1.5">
          {sorted.map((step) => (
            <li key={step.step_id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{KIND_LABEL[step.kind] ?? step.kind}</span>
                {step.tool_name && <span className="font-mono text-[11px] text-indigo-600">{step.tool_name}</span>}
                {step.dependsOn.length > 0 && (
                  <span className="text-[11px] text-slate-400">depende de: {step.dependsOn.join(', ')}</span>
                )}
              </div>
              <p className={step.kind === 'note' ? 'mt-1 italic text-slate-500' : 'mt-1 text-slate-700'}>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-2">
        {plan.status === 'draft' && (
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={busy}
            className="rounded-full border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            Aprobar
          </button>
        )}
        {(plan.status === 'draft' || plan.status === 'approved') && (
          <button
            type="button"
            onClick={() => void handleLaunch()}
            disabled={busy}
            className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Lanzar ahora
          </button>
        )}
        {plan.status === 'running' && (
          <span className="text-xs text-slate-500">Ejecutándose…</span>
        )}
      </div>
    </div>
  );
}
