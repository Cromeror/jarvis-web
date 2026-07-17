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
} from '../lib/environments-api.js';
import type { EnvironmentRunSummary } from '../lib/environments-api.js';
import { EnvironmentList } from '../components/Environments/EnvironmentList.js';
import { EnvironmentDetailPanel } from '../components/Environments/EnvironmentDetailPanel.js';
import type { EnvironmentListItem } from '../components/Environments/EnvironmentList.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';

const NEW_ENVIRONMENT_TEMPLATE = 'name: mi-environment\nsteps:\n  - run: docker compose ps\n';

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
  const [items, setItems] = useState<EnvironmentListItem[]>([]);
  const [active, setActive] = useState<EnvironmentListItem | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<EnvironmentRunSummary[]>([]);

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
      getEnvironmentDefinition(item.projectId, item.name)
        .then((def) => {
          setContent(def.content);
          setSavedContent(def.content);
        })
        .catch((err: unknown) => {
          addToast(err instanceof Error ? err.message : 'Error al cargar el environment', 'error');
        });
      listEnvironmentRuns(item.projectId)
        .then((all) => setRuns(all.filter((r) => r.name === item.name)))
        .catch(() => setRuns([]));
    },
    [addToast],
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
      const { run_id } = await runEnvironmentByName(active.projectId, active.name);
      navigate(`/pipeline/${run_id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al ejecutar el environment', 'error');
    } finally {
      setRunning(false);
    }
  }, [active, addToast, navigate]);

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const activeKey = active ? `${active.projectId}/${active.name}` : null;

  return (
    <div className="flex h-full flex-col bg-white" style={{ fontSize: '16px' }}>
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex flex-1 overflow-hidden">
        <EnvironmentList
          items={items}
          projects={projects}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          activeKey={activeKey}
          onSelect={handleSelect}
          onCreate={(projectId) => void handleCreate(projectId)}
          onBack={onBack}
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
            runs={runs}
            onOpenRun={(runId) => navigate(`/pipeline/${runId}`)}
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
