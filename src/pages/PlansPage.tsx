import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPlans, launchPlan, approvePlan, deletePlan, getLatestPlanRun } from '../lib/plans-api.js';
import type { PlanSummary, PlanStatus } from '../lib/plans-api.js';
import { filterPlansByStatus } from '../lib/plan-filters.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { Button } from '../components/ui/atoms/Button.js';
import { Tabla, type ColumnaDeTabla } from '../components/ui/Tabla.js';
import { Toolbar, ToolbarBoton, ToolbarGrupo } from '../components/ui/molecules/Toolbar.js';
import { Combo } from '../components/ui/Combo.js';
import { PlanFullscreenModal } from '../components/Plan/PlanFullscreenModal.js';
import { PlanLaunchDialog } from '../components/Plan/PlanLaunchDialog.js';
import { ETIQUETA_DE_ESTADO, VARIANTE_DE_ESTADO } from '../components/Plan/estado-del-plan.js';

/** Relative "hace X" from an ISO timestamp — minutes/hours/days. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

/* UN PLAN ES UNA FILA: título, proyecto, estado y cuándo se tocó, que es lo
   que se compara entre planes. Eran tarjetas en grilla de tres, y una grilla
   de tarjetas no se ordena ni se recorre de arriba abajo: para encontrar «el
   último que falló» había que leerlas todas. La tabla del template trae el
   orden por columna (por eso se fue el desplegable «Recently Updated») y el
   menú de fila para lo que no es la acción principal.

   `titulo` es la elástica: es la única de largo impredecible. */
const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'titulo', label: 'Plan', dato: 'title', w: 420, tip: true, elastica: true },
  { id: 'proyecto', label: 'Proyecto', w: 180, tip: true },
  { id: 'estado', label: 'Estado', dato: 'status', w: 120 },
  {
    id: 'actualizado',
    label: 'Actualizado',
    w: 120,
    valor: ((p: PlanSummary) => new Date(p.updated_at).getTime()) as (fila: never) => unknown,
  },
  { id: 'accion', label: '', w: 130, orden: false, al: 'der' },
];

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
  /* Un proyecto o «todos» (`''`), y un estado o «todos». Eran filtros de
     selección múltiple en un popover propio; ahora son los combos del template,
     en la toolbar, como los filtros de Contabilidad. */
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | ''>('');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  /** Plan esperando que se elija dónde corre — el launch pasa por PlanLaunchDialog. */
  const [launchTarget, setLaunchTarget] = useState<PlanSummary | null>(null);

  useEffect(() => {
    listProjects()
      .catch((err: unknown) => {
        addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
      })
      .then((data) => {
        if (data) setProjects(data);
      });
  }, [addToast]);

  // La ruta /plans/:projectId (si viene) precarga ese proyecto en el filtro; sin ella arranca "todos".
  useEffect(() => {
    if (initialProjectId) setProjectFilter(initialProjectId);
  }, [initialProjectId]);

  const projectIdsToLoad = projectFilter ? [projectFilter] : projects.map((p) => p.id);

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

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const visiblePlans = useMemo(
    () => filterPlansByStatus(plans, statusFilter ? [statusFilter] : []),
    [plans, statusFilter],
  );

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
    const interval = setInterval(
      () => {
        if (document.hidden) return;
        loadPlans(projectIdsToLoad);
      },
      hasRunningPlan ? 6_000 : 20_000,
    );
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

  const createPlanProjectId = projectFilter || (projects[0]?.id ?? null);

  /** La acción principal de cada plan, la misma que llevaba su tarjeta. */
  function accionDe(plan: PlanSummary): { label: string; run: () => void } {
    const isLaunchable = plan.status === 'draft' || plan.status === 'approved';
    if (isLaunchable) {
      return { label: busyPlanId === plan.id ? 'Lanzando…' : 'Lanzar', run: () => setLaunchTarget(plan) };
    }
    return {
      label: plan.status === 'running' ? 'Ver progreso' : 'Ver detalles',
      run: () => void handleViewProgress(plan.id),
    };
  }

  function celda(plan: PlanSummary, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'titulo') return <span className="font-medium text-foreground">{plan.title}</span>;
    if (c.id === 'proyecto') {
      return <span className="text-secondary-foreground">{projectNameById.get(plan.project_id ?? '') ?? plan.project_id}</span>;
    }
    if (c.id === 'estado') {
      return (
        <span className="badge" data-variant={VARIANTE_DE_ESTADO[plan.status]}>
          {ETIQUETA_DE_ESTADO[plan.status] ?? plan.status}
        </span>
      );
    }
    if (c.id === 'actualizado') {
      return (
        <span className="text-muted-foreground" title={new Date(plan.updated_at).toLocaleString()}>
          {timeAgo(plan.updated_at)}
        </span>
      );
    }
    if (c.id === 'accion') {
      const accion = accionDe(plan);
      return (
        <Button variant="outline" disabled={busyPlanId === plan.id} onClick={accion.run}>
          {accion.label}
        </Button>
      );
    }
    return null;
  }

  /* El menú de fila lleva lo que la tarjeta tenía alrededor de su botón: abrir
     el plan (que era hacer clic en la tarjeta), la acción principal repetida y
     eliminar — que no se ofrece mientras corre, igual que antes. */
  const menuDePlan = (plan: PlanSummary) => ({
    groups: [
      { items: [{ id: 'abrir', label: 'Abrir el plan' }, { id: 'accion', label: accionDe(plan).label }] },
      ...(plan.status === 'running' ? [] : [{ items: [{ id: 'eliminar', label: 'Eliminar el plan', danger: true }] }]),
    ],
    onSelect: (id: string) => {
      if (id === 'abrir') setSelectedPlanId(plan.id);
      if (id === 'accion') accionDe(plan).run();
      if (id === 'eliminar') void handleDelete(plan);
    },
  });

  return (
    // Una sola columna de contenido con scroll propio; el detalle de un plan no
    // es un panel al costado sino el modal de pantalla completa, que va a la
    // capa superior del navegador y no ocupa lugar en el layout.
    <div className="h-full overflow-y-auto bg-[var(--sw-ink)]">
      <Toast toasts={toasts} onDismiss={removeToast} />
      {/* LA TOOLBAR DE LA SUPERFICIE, a todo el ancho y pegada arriba como en
          el template: los filtros a la izquierda y, en su propio grupo, la
          acción principal. «Crear plan» antes aparecía sólo con la lista vacía
          (una tarjeta fantasma); acá está siempre, porque proponer un plan no
          depende de que no haya otros. Lleva al chat: los planes nacen ahí. */}
      <div className="sticky top-0 z-10">
        <Toolbar label="Planes">
          <ToolbarGrupo>
            <Combo
              rotulo="Proyecto"
              opciones={[{ id: '', label: 'Todos los proyectos' }, ...projects.map((p) => ({ id: p.id, label: p.name }))]}
              valor={projectFilter}
              alCambiar={setProjectFilter}
            />
            <Combo
              rotulo="Estado"
              opciones={[
                { id: '', label: 'Todos los estados' },
                ...(Object.entries(ETIQUETA_DE_ESTADO) as Array<[PlanStatus, string]>).map(([id, label]) => ({
                  id,
                  label,
                })),
              ]}
              valor={statusFilter}
              alCambiar={(v) => setStatusFilter(v as PlanStatus | '')}
            />
          </ToolbarGrupo>
          <ToolbarGrupo>
            <ToolbarBoton
              primario
              disabled={!createPlanProjectId}
              onClick={() => createPlanProjectId && navigate(`/chat/${createPlanProjectId}`)}
              title="Los planes se proponen desde el chat del proyecto"
            >
              + Crear plan
            </ToolbarBoton>
          </ToolbarGrupo>
        </Toolbar>
      </div>

      <div className="p-6">
        <Tabla<PlanSummary>
          titulo="Planes"
          columnas={COLUMNAS}
          filas={visiblePlans}
          clave={(p) => p.id}
          nombreFila={(p) => p.title}
          seleccion={false}
          celda={celda}
          textoDeCelda={(p, c) =>
            c.id === 'proyecto' ? (projectNameById.get(p.project_id ?? '') ?? p.project_id ?? '') : p.title
          }
          menuFila={menuDePlan}
          onAbrir={(p) => setSelectedPlanId(p.id)}
          orden={{ col: 'actualizado', dir: 'desc' }}
          porPagina={25}
          opcionesPagina={[25, 50, 100]}
          textos={
            plans.length > 0
              ? { vacio: 'Ningún plan en ese estado', vacioPaso: 'Probá con «Todos los estados».' }
              : {
                  vacio: 'Todavía no hay planes',
                  vacioPaso: 'Se proponen desde el chat del proyecto: pedile uno y lo guarda.',
                }
          }
        />
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
  );
}
