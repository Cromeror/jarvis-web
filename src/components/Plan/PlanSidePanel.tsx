import React, { useEffect, useState } from 'react';
import { getPlan, approvePlan, launchPlan } from '../../lib/plans-api.js';
import type { PlanDetail } from '../../lib/plans-api.js';
import { useCollapsible } from '../../hooks/useCollapsible.js';

interface PlanSidePanelProps {
  planId: string;
  onClose: () => void;
  /** Called with the run id once the plan is launched, so the caller can navigate to the progress view. */
  onLaunched?: (runId: string) => void;
}

const KIND_LABEL: Record<string, string> = {
  note: 'Nota',
  tool_call: 'Tool',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

/**
 * Read-only detail of a plan proposed during a Plan Mode turn, shown as a
 * collapsible panel to the right of the chat instead of inline in the
 * message feed — lets the user keep chatting while the plan stays visible.
 */
export function PlanSidePanel({ planId, onClose, onLaunched }: PlanSidePanelProps): React.ReactElement {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, toggle] = useCollapsible('plan-side-panel');
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    getPlan(planId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el plan'); });
    return () => { cancelled = true; };
  }, [planId]);

  function toggleStep(stepId: string): void {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

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
      if (detail?.plan.status === 'draft') await approvePlan(planId);
      const { run_id } = await launchPlan(planId);
      const fresh = await getPlan(planId);
      setDetail(fresh);
      onLaunched?.(run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al lanzar el plan');
    } finally {
      setBusy(false);
    }
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-l border-slate-200 bg-slate-50 py-3">
        <button
          type="button"
          onClick={toggle}
          title="Expandir panel de plan"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <i className="pi pi-angle-left text-xs" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-96 shrink-0 flex-col border-l border-slate-200 bg-slate-50" style={{ fontSize: '16px' }}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Plan propuesto</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            title="Colapsar panel"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <i className="pi pi-angle-right text-xs" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <i className="pi pi-times text-xs" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {!error && !detail && (
          <div className="text-sm text-slate-400">Cargando plan…</div>
        )}
        {detail && (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{detail.plan.title}</h3>
              <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {STATUS_LABEL[detail.plan.status] ?? detail.plan.status}
              </span>
            </div>

            <div className="mb-4 space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Contexto</div>
                <p className="mt-0.5 whitespace-pre-wrap">{detail.plan.context}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Arquitectura</div>
                <p className="mt-0.5 whitespace-pre-wrap">{detail.plan.architecture}</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                Pasos ({detail.steps.length})
              </div>
              <ol className="space-y-1.5">
                {[...detail.steps]
                  .sort((a, b) => a.step_index - b.step_index)
                  .map((step) => {
                    const isOpen = openSteps.has(step.step_id);
                    return (
                      <li key={step.step_id} className="rounded-lg border border-slate-200 bg-white text-xs text-slate-700">
                        <button
                          type="button"
                          onClick={() => toggleStep(step.step_id)}
                          className="flex w-full items-center gap-1.5 px-3 py-2 text-left"
                        >
                          <i className={`pi ${isOpen ? 'pi-chevron-down' : 'pi-chevron-right'} text-[10px] text-slate-400`} />
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                            {KIND_LABEL[step.kind] ?? step.kind}
                          </span>
                          {step.tool_name && <span className="font-mono text-[11px] text-indigo-600">{step.tool_name}</span>}
                          <span className="min-w-0 flex-1 truncate">{step.description}</span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 px-3 py-2">
                            <p className={step.kind === 'note' ? 'italic text-slate-500' : 'text-slate-700'}>{step.description}</p>
                            {step.dependsOn.length > 0 && (
                              <p className="mt-1.5 text-[11px] text-slate-400">depende de: {step.dependsOn.join(', ')}</p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ol>
            </div>

            <div className="flex gap-2">
              {detail.plan.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={busy}
                  className="rounded-full border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                >
                  Aprobar
                </button>
              )}
              {(detail.plan.status === 'draft' || detail.plan.status === 'approved') && (
                <button
                  type="button"
                  onClick={() => void handleLaunch()}
                  disabled={busy}
                  className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Lanzar ahora
                </button>
              )}
              {detail.plan.status === 'running' && (
                <span className="text-xs text-slate-500">Ejecutándose…</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
