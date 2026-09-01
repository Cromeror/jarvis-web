import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPlans, launchPlan, approvePlan, deletePlan, getLatestPlanRun } from '../lib/plans-api.js';
import type { PlanSummary, PlanStatus } from '../lib/plans-api.js';
import { filterPlansByStatus } from '../lib/plan-filters.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { PillDropdown } from '../components/ui/atoms/PillDropdown.js';
import { FilterPopover } from '../components/ui/atoms/FilterPopover.js';
import { FilterIcon } from '../components/ui/atoms/FilterIcon.js';
import { SortIcon } from '../components/ui/atoms/SortIcon.js';
import { EntityCard } from '../components/ui/molecules/EntityCard.js';
import { EmptyCard } from '../components/ui/molecules/EmptyCard.js';
import { PlanFullscreenModal } from '../components/Plan/PlanFullscreenModal.js';
import { PlanLaunchDialog } from '../components/Plan/PlanLaunchDialog.js';
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

const STATUS_FILTER_OPTIONS = (Object.entries(STATUS_LABEL) as Array<[PlanStatus, string]>).map(
  ([value, label]) => ({ label, value }),
);

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
 * button per approved plan. The primary flow is conversational (asking the
 * chat for a plan, which persists it with `plan_create`) — this page is for
 * revisiting/launching plans later, in a different session or day, per
 * "lanzar a voluntad".
 */
export function PlansPage(): React.ReactElement {
  const { projectId: initialProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  /** Plan esperando que se elija dónde corre — el launch pasa por PlanLaunchDialog. */
  const [launchTarget, setLaunchTarget] = useState<PlanSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<PlanStatus[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    listProjects().catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
    }).then((data) => {
      if (data) setProjects(data);
    });
  }, [addToast]);

  // La ruta /plans/:projectId (si viene) precarga ese proyecto en el filtro; sin ella arranca "todos".
  useEffect(() => {
    if (initialProjectId) setProjectFilter([initialProjectId]);
  }, [initialProjectId]);

  const projectIdsToLoad = projectFilter.length > 0 ? projectFilter : projects.map((p) => p.id);

  const loadPlans = useCallback(
    (projectIds: string[]) => {
      Promise.all(projectIds.map((id) => listPlans(id)))
        .then((results) => setPlans(results.flat()))
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar planes', 'error');
        });
    },
    [addToast],
  );

  useEffect(() => {
    if (projectIdsToLoad.length > 0) loadPlans(projectIdsToLoad);
  }, [projectIdsToLoad.join(','), loadPlans]);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const visiblePlans = useMemo(() => {
    const filtered = filterPlansByStatus(plans, statusFilter);
    const sign = sortOrder === 'desc' ? -1 : 1;
    return [...filtered].sort(
      (a, b) => sign * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
    );
  }, [plans, statusFilter, sortOrder]);

  // Polling liviano, en dos velocidades. Rápido (6s) mientras haya un plan
  // 'running', para que el badge 'Ejecutando' se actualice cuando el run
  // termine. Lento (20s) el resto del tiempo: esta lista no es de una sola
  // conversación — un plan puede nacer en el chat, en otra pestaña o en otra
  // sesión, y sin este piso la página se quedaba con la foto del montaje hasta
  // que el usuario cambiara un filtro.
  //
  // Por qué no SSE acá: el stream de planes que ya existe es por RUN
  // (usePlanRunEvents), algo que el server empuja paso a paso; "los planes de
  // estos proyectos" no tiene productor de eventos y montarlo pediría un canal
  // nuevo por proyecto más su fan-out. Un GET barato cada 20s, pausado cuando
  // la pestaña no se ve, compra lo mismo. Revisar si aparece una vista donde la
  // latencia sub-segundo importe.
  const hasRunningPlan = useMemo(() => visiblePlans.some((p) => p.status === 'running'), [visiblePlans]);

  useEffect(() => {
    if (projectIdsToLoad.length === 0) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadPlans(projectIdsToLoad);
    }, hasRunningPlan ? 6_000 : 20_000);
    return () => clearInterval(interval);
  }, [hasRunningPlan, projectIdsToLoad.join(','), loadPlans]);

  const handleLaunch = useCallback(
    async (planId: string, status: string, replicaId?: string) => {
      setBusyPlanId(planId);
      setLaunchTarget(null);
      try {
        if (status === 'draft') await approvePlan(planId);
        const { run_id } = await launchPlan(planId, replicaId);
        navigate(`/plan-runs/${run_id}`);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al lanzar el plan', 'error');
      } finally {
        setBusyPlanId(null);
      }
    },
    [navigate, addToast],
  );

  const handleDelete = useCallback(
    async (plan: PlanSummary) => {
      if (!window.confirm(`¿Eliminar el plan '${plan.title}'?`)) return;
      try {
        await deletePlan(plan.id);
        setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        setSelectedPlanId((id) => (id === plan.id ? null : id));
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al eliminar el plan', 'error');
      }
    },
    [addToast],
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

  const projectOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: p.id })),
    [projects],
  );

  const createPlanProjectId = projectFilter.length === 1 ? projectFilter[0] : (projects[0]?.id ?? null);

  return (
    // Una sola columna de contenido (flex-1, con scroll propio); el detalle de un
    // plan seleccionado ya no es un panel a la derecha sino el modal fullscreen,
    // que al ser `fixed` no ocupa lugar en el layout — mismo patrón que ChatPage.
    // El flex sobrevive a la segunda columna a propósito: es lo que le da al
    // contenido su alto acotado y su propio scroll (`flex-1 overflow-hidden`),
    // que era lo que antes evitaba el contenedor centrado (mx-auto max-w-6xl).
    <div className="flex h-full flex-col bg-white" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">Planes</h1>
            <div className="flex items-center gap-2">
              <FilterPopover
                icon={<FilterIcon />}
                groups={[
                  { label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: setProjectFilter },
                  { label: 'Estados', options: STATUS_FILTER_OPTIONS, selected: statusFilter, onChange: setStatusFilter },
                ]}
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
                onClick={() => createPlanProjectId && navigate(`/chat/${createPlanProjectId}`)}
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
              meta={`${projectNameById.get(plan.project_id ?? '') ?? plan.project_id} · Actualizado ${timeAgo(plan.updated_at)}`}
              actionLabel={
                plan.status === 'running'
                  ? 'Ver progreso'
                  : isLaunchable
                    ? (busyPlanId === plan.id ? 'Lanzando…' : 'Lanzar')
                    : 'Ver detalles'
              }
              onAction={() => {
                if (isLaunchable) setLaunchTarget(plan);
                else void handleViewProgress(plan.id);
              }}
              onDelete={plan.status === 'running' ? undefined : () => void handleDelete(plan)}
              selected={selectedPlanId === plan.id}
              onSelect={() => setSelectedPlanId((id) => (id === plan.id ? null : plan.id))}
            />
          );
        })}
          </div>
        </div>

        {launchTarget && (
          <PlanLaunchDialog
            planTitle={launchTarget.title}
            projectId={launchTarget.project_id}
            onCancel={() => setLaunchTarget(null)}
            onConfirm={(replicaId) => void handleLaunch(launchTarget.id, launchTarget.status, replicaId)}
          />
        )}

        {/*
          * `activeSessionId={null}` y sin `onSendToChat`: acá no hay una
          * conversación abierta, así que las anotaciones se pueden crear pero no
          * enviar — el propio modal lo dice y ofrece abrir el chat del proyecto.
          */}
        {selectedPlanId && (
          <PlanFullscreenModal
            planId={selectedPlanId}
            onClose={() => setSelectedPlanId(null)}
            onLaunched={(runId) => navigate(`/plan-runs/${runId}`)}
            activeSessionId={null}
          />
        )}
      </div>
    </div>
  );
}
