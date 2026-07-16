import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPlans, launchPlan, approvePlan, getLatestPlanRun } from '../lib/plans-api.js';
import type { PlanSummary } from '../lib/plans-api.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { Button } from '../components/ui/atoms/Button.js';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

/**
 * Secondary view: list of plans for a project, with a manual "Lanzar"
 * button per approved plan. The primary flow is conversational (Plan Mode
 * in the chat) — this page is for revisiting/launching plans later, in a
 * different session or day, per "lanzar a voluntad".
 */
export function PlansPage(): React.ReactElement {
  const { projectId: initialProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const selectedProjectId = initialProjectId ?? null;
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  useEffect(() => {
    listProjects().catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
    }).then((data) => {
      if (data) setProjects(data);
    });
  }, [addToast]);

  const loadPlans = useCallback(
    (projectId: string) => {
      listPlans(projectId)
        .then(setPlans)
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar planes', 'error');
        });
    },
    [addToast],
  );

  useEffect(() => {
    if (selectedProjectId) loadPlans(selectedProjectId);
  }, [selectedProjectId, loadPlans]);

  const handleLaunch = useCallback(
    async (planId: string, status: string) => {
      setBusyPlanId(planId);
      try {
        if (status === 'draft') await approvePlan(planId);
        const { run_id } = await launchPlan(planId);
        navigate(`/plan-runs/${run_id}`);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al lanzar el plan', 'error');
      } finally {
        setBusyPlanId(null);
      }
    },
    [navigate, addToast],
  );

  const handleViewProgress = useCallback(
    async (planId: string) => {
      try {
        const { run } = await getLatestPlanRun(planId);
        navigate(`/plan-runs/${run.id}`);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al obtener el progreso', 'error');
      }
    },
    [navigate, addToast],
  );

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-50" style={{ fontSize: '16px' }}>
        <Toast toasts={toasts} onDismiss={removeToast} />
        <h1 className="text-xl font-semibold text-slate-900">Elegí un proyecto</h1>
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {projects.map((p) => (
            <Button key={p.id} variant="secondary" onClick={() => navigate(`/plans/${p.id}`)}>
              {p.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>← Volver</Button>
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Planes — {selectedProject?.name ?? selectedProjectId}</h1>
        <Button variant="ghost" onClick={() => navigate('/plans')}>Cambiar proyecto</Button>
      </div>

      {plans.length === 0 && <p className="text-sm text-slate-400">No hay planes todavía — proponé uno desde el chat en Modo Plan.</p>}

      <ul className="space-y-2">
        {plans.map((plan) => (
          <li key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-900">{plan.title}</div>
              <div className="text-xs text-slate-400">{STATUS_LABEL[plan.status] ?? plan.status}</div>
            </div>
            {(plan.status === 'draft' || plan.status === 'approved') && (
              <Button
                variant="primary"
                onClick={() => void handleLaunch(plan.id, plan.status)}
                disabled={busyPlanId === plan.id}
              >
                Lanzar
              </Button>
            )}
            {plan.status === 'running' && (
              <Button variant="secondary" onClick={() => void handleViewProgress(plan.id)}>Ver progreso</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
