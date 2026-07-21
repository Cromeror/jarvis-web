import React, { useEffect, useState } from 'react';
import { listPlans } from '../../lib/plans-api.js';
import type { PlanSummary, PlanStatus } from '../../lib/plans-api.js';

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

const STATUS_CLASS: Record<PlanStatus, string> = {
  draft: 'text-slate-400',
  approved: 'text-indigo-600',
  running: 'text-amber-600',
  done: 'text-emerald-600',
  failed: 'text-red-600',
  archived: 'text-slate-400',
};

interface ChatPlansPanelProps {
  /** Proyecto de la sesión activa — null si todavía no hay conversación elegida. */
  projectId: string | null;
  /** Plan resaltado (el abierto en el PlanSidePanel), si hay uno. */
  activePlanId?: string | null;
  onSelectPlan: (planId: string) => void;
  onClose: () => void;
}

/**
 * Narrow panel that lists the plans of the active chat session's project,
 * shown next to ChatOptionsRail. Visually mirrors EnvironmentList (list of
 * selectable items) with PlanSidePanel's header. Fetches its own data via
 * listPlans — no backend work, GET /api/plans?project_id= already exists.
 */
export function ChatPlansPanel({ projectId, activePlanId, onSelectPlan, onClose }: ChatPlansPanelProps): React.ReactElement {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setPlans([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPlans(projectId)
      .then((data) => { if (!cancelled) setPlans(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar planes'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50" style={{ fontSize: '16px' }}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Planes</h2>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <i className="pi pi-times text-xs" />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {!projectId && (
          <p className="px-1 py-8 text-sm text-slate-400">Elegí una conversación para ver sus planes.</p>
        )}
        {projectId && loading && (
          <p className="px-1 py-8 text-sm text-slate-400">Cargando planes…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {projectId && !loading && !error && plans.length === 0 && (
          <p className="px-1 py-8 text-sm text-slate-400">Este proyecto todavía no tiene planes.</p>
        )}
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
            className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              plan.id === activePlanId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <span className="line-clamp-1 font-medium">{plan.title}</span>
            <span className={`text-xs ${STATUS_CLASS[plan.status] ?? 'text-slate-400'}`}>
              {STATUS_LABEL[plan.status] ?? plan.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
