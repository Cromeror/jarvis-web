import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  listEnvironmentDefinitions,
  listEnvironmentRuns,
  getEnvironmentDefinition,
  createEnvironmentDefinition,
  updateEnvironmentDefinition,
  deleteEnvironmentDefinition,
  runEnvironmentByName,
  shutdownEnvironmentByName,
  checkEnvironmentByName,
  runBelongsToEnvironment,
} from '../lib/environments-api.js';
import type { EnvironmentRunSummary } from '../lib/environments-api.js';
import { listProjectReplicas, ROOT_REPLICA } from '../lib/project-replicas-api.js';
import type { ProjectReplica } from '../lib/project-replicas-api.js';
import { EnvironmentList } from '../components/Environments/EnvironmentList.js';
import { EnvironmentDetailPanel } from '../components/Environments/EnvironmentDetailPanel.js';
import type { EnvironmentListItem } from '../components/Environments/EnvironmentList.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';
import { FilterPopover } from '../components/ui/atoms/FilterPopover.js';
import { FilterIcon } from '../components/ui/atoms/FilterIcon.js';

// `check` y `stop` son opcionales a propósito — se incluyen acá para que
// queden descubribles (es la única "documentación" del formato que un
// usuario ve). `check` debe salir con exit code 0 solo si el environment
// está realmente sano — sin reintentos propios del runner, así que un
// comando que necesite esperar debe reintentar puertas adentro.
const NEW_ENVIRONMENT_TEMPLATE =
  'name: mi-environment\nsteps:\n  - run: docker compose up -d\ncheck:\n  - run: docker compose ps --status running | grep -q .\nstop:\n  - run: docker compose down\n';

/**
 * Environments view: definitions from every project (or a filtered subset)
 * side by side, each tagged with its project — same fan-out pattern as
 * ChatPage. Editing is raw-YAML only (no guided form), reusing the same
 * @jarvis/pipeline-runner engine and shape as Pipelines under the hood.
 */
export function EnvironmentsPage(): React.ReactElement {
  const { projectId: initialProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const onBack = useCallback(() => navigate('/'), [navigate]);
  const { toasts, addToast, removeToast } = useToast();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState<EnvironmentListItem[]>([]);
  const [active, setActive] = useState<EnvironmentListItem | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<EnvironmentRunSummary[]>([]);
  const [replicas, setReplicas] = useState<ProjectReplica[]>([]);
  const [replicaId, setReplicaId] = useState<string>(ROOT_REPLICA);
  // El API espera `undefined`/ausente para "root", no el sentinel de UI.
  const apiReplicaId = replicaId === ROOT_REPLICA ? undefined : replicaId;

  useEffect(() => {
    listProjects().catch((err: unknown) => {
      addToast(err instanceof Error ? err.message : 'Error al cargar proyectos', 'error');
    }).then((data) => {
      if (data) setProjects(data);
    });
  }, [addToast]);

  useEffect(() => {
    if (initialProjectId) setProjectFilter([initialProjectId]);
  }, [initialProjectId]);

  const projectIdsToLoad = projectFilter.length > 0 ? projectFilter : projects.map((p) => p.id);

  const loadItems = useCallback(
    (projectIds: string[]) => {
      // allSettled — un proyecto sin root_path (u otro error puntual) no debe
      // tumbar la lista de los demás; cada fetch falla de forma aislada.
      Promise.allSettled(
        projectIds.map((id) => listEnvironmentDefinitions(id).then((names) => names.map((name) => ({ projectId: id, name })))),
      ).then((results) => {
        setItems(results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value));
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          const first = failures[0] as PromiseRejectedResult;
          const msg = first.reason instanceof Error ? first.reason.message : String(first.reason);
          addToast(
            failures.length === 1 ? msg : `${msg} (y ${failures.length - 1} proyecto${failures.length > 2 ? 's' : ''} más)`,
            'error',
          );
        }
      });
    },
    [addToast],
  );

  useEffect(() => {
    if (projectIdsToLoad.length > 0) loadItems(projectIdsToLoad);
  }, [projectIdsToLoad.join(','), loadItems]);

  const handleSelect = useCallback(
    (item: EnvironmentListItem) => {
      setActive(item);
      setReplicaId(ROOT_REPLICA);
      getEnvironmentDefinition(item.projectId, item.name)
        .then((def) => {
          setContent(def.content);
          setSavedContent(def.content);
        })
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar el environment', 'error');
        });
      listEnvironmentRuns(item.projectId)
        .then((all) => setRuns(all.filter((r) => runBelongsToEnvironment(r, item.name))))
        .catch(() => setRuns([]));
      listProjectReplicas(item.projectId)
        .then(setReplicas)
        .catch(() => setReplicas([]));
    },
    [addToast],
  );

  // Corre cada vez que se cambia de réplica con un environment ya seleccionado
  // (sin esto, cambiar la réplica en el dropdown no reflejaría el historial
  // de runs de esa réplica hasta volver a seleccionar el environment).
  const handleReplicaChange = useCallback(
    (nextReplicaId: string) => {
      setReplicaId(nextReplicaId);
      if (!active) return;
      listEnvironmentRuns(active.projectId, nextReplicaId === ROOT_REPLICA ? undefined : nextReplicaId)
        .then((all) => setRuns(all.filter((r) => runBelongsToEnvironment(r, active.name))))
        .catch(() => setRuns([]));
    },
    [active],
  );

  const handleCreate = useCallback(
    async (projectId: string) => {
      const name = prompt('Nombre del nuevo environment (sin extensión):');
      if (!name) return;
      try {
        await createEnvironmentDefinition(projectId, name, NEW_ENVIRONMENT_TEMPLATE);
        loadItems(projectIdsToLoad);
        const item = { projectId, name };
        setActive(item);
        setContent(NEW_ENVIRONMENT_TEMPLATE);
        setSavedContent(NEW_ENVIRONMENT_TEMPLATE);
        setRuns([]);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Error al crear el environment', 'error');
      }
    },
    [addToast, loadItems, projectIdsToLoad],
  );

  const handleSave = useCallback(async () => {
    if (!active) return;
    setSaving(true);
    try {
      await updateEnvironmentDefinition(active.projectId, active.name, content);
      setSavedContent(content);
      addToast('Environment guardado', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al guardar el environment', 'error');
    } finally {
      setSaving(false);
    }
  }, [active, content, addToast]);

  const handleDelete = useCallback(async () => {
    if (!active) return;
    if (!confirm(`¿Eliminar el environment "${active.name}"?`)) return;
    try {
      await deleteEnvironmentDefinition(active.projectId, active.name);
      setActive(null);
      setContent('');
      setSavedContent('');
      setRuns([]);
      loadItems(projectIdsToLoad);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al eliminar el environment', 'error');
    }
  }, [active, addToast, loadItems, projectIdsToLoad]);

  const handleRun = useCallback(async () => {
    if (!active) return;
    setRunning(true);
    try {
      const { run_id } = await runEnvironmentByName(active.projectId, active.name, apiReplicaId);
      navigate(`/pipeline/${run_id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al ejecutar el environment', 'error');
    } finally {
      setRunning(false);
    }
  }, [active, addToast, navigate, apiReplicaId]);

  const handleShutdown = useCallback(async () => {
    if (!active) return;
    setRunning(true);
    try {
      const { run_id } = await shutdownEnvironmentByName(active.projectId, active.name, apiReplicaId);
      navigate(`/pipeline/${run_id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al apagar el environment', 'error');
    } finally {
      setRunning(false);
    }
  }, [active, addToast, navigate, apiReplicaId]);

  const handleCheck = useCallback(async () => {
    if (!active) return;
    setRunning(true);
    try {
      const { run_id } = await checkEnvironmentByName(active.projectId, active.name, apiReplicaId);
      navigate(`/pipeline/${run_id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al verificar el environment', 'error');
    } finally {
      setRunning(false);
    }
  }, [active, addToast, navigate, apiReplicaId]);

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const projectOptions = projects.map((p) => ({ label: p.name, value: p.id }));
  const activeKey = active ? `${active.projectId}/${active.name}` : null;

  // Filtro client-side sobre los items ya cargados (que ya vienen acotados por
  // projectFilter en loadItems): matchea por nombre del environment o del
  // proyecto, case-insensitive y por substring.
  const query = search.trim().toLowerCase();
  const filteredItems = query
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (projectNameById.get(item.projectId) ?? item.projectId).toLowerCase().includes(query),
      )
    : items;

  return (
    <div className="flex h-full flex-col bg-white" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Barra solo-mobile: hamburguesa (abre el drawer de la lista), búsqueda y
          filtro de proyectos. En desktop el header propio de EnvironmentList
          cubre estas mismas funciones y esta barra queda oculta (md:hidden). */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir lista de environments"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <i className="pi pi-bars text-base" />
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar environment…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none"
        />
        <FilterPopover
          icon={<FilterIcon />}
          groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: setProjectFilter }]}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <EnvironmentList
          items={filteredItems}
          projects={projects}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          activeKey={activeKey}
          onSelect={handleSelect}
          onCreate={(projectId) => void handleCreate(projectId)}
          onBack={onBack}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        {active ? (
          <EnvironmentDetailPanel
            projectName={projectNameById.get(active.projectId) ?? active.projectId}
            name={active.name}
            content={content}
            onChangeContent={setContent}
            dirty={content !== savedContent}
            saving={saving}
            onSave={() => void handleSave()}
            onDelete={() => void handleDelete()}
            running={running}
            onRun={() => void handleRun()}
            onShutdown={() => void handleShutdown()}
            onCheck={() => void handleCheck()}
            replicas={replicas}
            replicaId={replicaId}
            onChangeReplica={handleReplicaChange}
            runs={runs}
            onOpenRun={(runId) => navigate(`/pipeline/${runId}`)}
            onBackToList={() => setMobileOpen(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Elegí un environment de la lista, o creá uno nuevo.
          </div>
        )}
      </div>
    </div>
  );
}
