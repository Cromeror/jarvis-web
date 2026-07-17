import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPlans, launchPlan, approvePlan, getLatestPlanRun } from '../lib/plans-api.js';
import type { PlanSummary, PlanStatus } from '../lib/plans-api.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { Button } from '../components/ui/atoms/Button.js';
import { PillDropdown } from '../components/ui/atoms/PillDropdown.js';
import { FilterIcon } from '../components/ui/atoms/FilterIcon.js';
import { SortIcon } from '../components/ui/atoms/SortIcon.js';
import { EntityCard } from '../components/ui/molecules/EntityCard.js';
import { EmptyCard } from '../components/ui/molecules/EmptyCard.js';
import type { StatusBadgeTone } from '../components/ui/atoms/StatusBadge.js';

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

const STATUS_TONE: Record<PlanStatus, StatusBadgeTone> = {
  draft: 'neutral',
  approved: 'info',
  running: 'warning',
  done: 'success',
  failed: 'danger',
  archived: 'neutral',
};

const STATUS_FILTER_OPTIONS = [
  { label: 'Todos los estados', value: null },
  ...(Object.entries(STATUS_LABEL) as Array<[PlanStatus, string]>).map(([value, label]) => ({ label, value })),
];

const SORT_OPTIONS = [
  { label: 'Recently Updated', value: 'desc' as const },
  { label: 'Oldest First', value: 'asc' as const },
];

/** Relative "hace X" from an ISO timestamp — minutes/hours/days, matches the reference card's "DEPLOYS 4M AGO" style. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

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
  const [statusFilter, setStatusFilter] = useState<PlanStatus | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    listProjects().catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
    }).then((data) => {
      if (data) setProjects(data);
    });
  }, [addToast]);

  // Sin :projectId en la ruta, seleccioná el primer proyecto de la lista por defecto.
  useEffect(() => {
    if (!initialProjectId && projects.length > 0) {
      navigate(`/plans/${projects[0]!.id}`, { replace: true });
    }
  }, [initialProjectId, projects, navigate]);

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

  const visiblePlans = useMemo(() => {
    const filtered = statusFilter ? plans.filter((p) => p.status === statusFilter) : plans;
    const sign = sortOrder === 'desc' ? -1 : 1;
    return [...filtered].sort(
      (a, b) => sign * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
    );
  }, [plans, statusFilter, sortOrder]);

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
    <div className="mx-auto max-w-6xl px-6 py-6" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Planes — {selectedProject?.name ?? selectedProjectId}</h1>
        <div className="flex items-center gap-2">
          <PillDropdown
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
            placeholder="Filters"
            icon={<FilterIcon />}
          />
          <PillDropdown
            value={sortOrder}
            options={SORT_OPTIONS}
            onChange={setSortOrder}
            icon={<SortIcon />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePlans.length === 0 && (
          <EmptyCard
            icon="pi-plus"
            title="Crear Plan"
            description="Proponé uno desde el chat en Modo Plan"
            onClick={() => navigate(`/chat/${selectedProjectId}`)}
          />
        )}
        {visiblePlans.map((plan) => {
          const isLaunchable = plan.status === 'draft' || plan.status === 'approved';
          return (
            <EntityCard
              key={plan.id}
              icon="pi-file-edit"
              title={plan.title}
              description={plan.context}
              statusLabel={STATUS_LABEL[plan.status] ?? plan.status}
              statusTone={STATUS_TONE[plan.status] ?? 'neutral'}
              meta={`Actualizado ${timeAgo(plan.updated_at)}`}
              actionLabel={
                plan.status === 'running'
                  ? 'Ver progreso'
                  : isLaunchable
                    ? (busyPlanId === plan.id ? 'Lanzando…' : 'Lanzar')
                    : 'Ver detalles'
              }
              onAction={() => {
                if (plan.status === 'running') void handleViewProgress(plan.id);
                else if (isLaunchable) void handleLaunch(plan.id, plan.status);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
