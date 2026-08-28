import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listWorkspaces } from '../lib/workspaces-api.js';
import {
  toWorkspacesSection,
  resolveSelection,
  workspacePath,
  type WorkspaceRow,
  type WorkspacesSection,
  type WorkspaceView,
} from '../lib/workspace-view.js';
import { WorkspaceList } from '../components/Workspaces/WorkspaceList.js';
import { ChangesPanel } from '../components/Workspaces/ChangesPanel.js';
import { ExplorerPage } from './ExplorerPage.js';
import { GraphPanel } from '../components/Workspaces/GraphPanel.js';

/**
 * Vista raíz del apartado de workspaces: los espacios de trabajo del proyecto
 * (el principal y sus réplicas), cada uno con su rama, sus cambios sin
 * commitear y su último commit.
 *
 * El workspace elegido vive en la URL (`/workspaces/:projectId/:workspaceId`)
 * y no en estado local, por dos razones: el link se puede compartir y la
 * elección sobrevive a un F5. Es también el contexto que van a leer las demás
 * vistas del apartado (explorador, cambios, grafo), que cuelgan de esta misma
 * ruta — por eso el workspace es un segmento de path y no un query param.
 *
 * El id del principal es el sentinel `root`; el de una réplica es su id (no su
 * slug), que es lo que espera el API y no puede colisionar con el sentinel
 * porque los ids son UUID.
 */
export function WorkspacesPage(): React.ReactElement {
  const { projectId, workspaceId, view } = useParams<{ projectId?: string; workspaceId?: string; view?: string }>();
  const navigate = useNavigate();
  // El archivo abierto va en la query y no en la ruta: no es una ruta, es qué
  // archivo está mirando — y así un path con barras no se escapa dentro del path.
  // Cada vista tiene su propio parametro porque significan cosas distintas:
  // `file` es el archivo cuyo diff se mira; `path` es donde estas parado en el
  // arbol (que puede ser una carpeta). Compartir uno solo haria que cambiar de
  // vista arrastre una ruta que alli no significa nada.
  const [searchParams, setSearchParams] = useSearchParams();
  const openFile = searchParams.get('file') ?? undefined;
  const openPath = searchParams.get('path') ?? undefined;
  const openCommit = searchParams.get('commit') ?? undefined;

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [section, setSection] = useState<WorkspacesSection>({ kind: 'loading' });

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const load = useCallback((id: string) => {
    setSection({ kind: 'loading' });
    listWorkspaces(id)
      .then((response) => setSection(toWorkspacesSection(response)))
      // Un fetch caído es `failed`, no `disabled`: acá SÍ se rompió algo, y por
      // eso se ofrece reintentar. La confusión entre los dos estados es
      // justamente lo que hace que un proyecto sin root_path parezca un bug.
      .catch((err: unknown) => setSection({
        kind: 'failed',
        message: err instanceof Error ? err.message : String(err),
      }));
  }, []);

  useEffect(() => {
    if (projectId) load(projectId);
  }, [projectId, load]);

  const { selected, missingId } = useMemo(
    () => (section.kind === 'ready'
      ? resolveSelection(section.rows, workspaceId)
      : { selected: null, missingId: null }),
    [section, workspaceId],
  );

  const handleSelect = useCallback(
    (row: WorkspaceRow) => {
      if (!projectId) return;
      // Elegir el que ya está elegido lo deselecciona: sin esto no habría forma
      // de volver a la vista sin contexto desde la propia lista.
      const next = row.id === workspaceId ? undefined : row.id;
      navigate(workspacePath(projectId, next));
    },
    [navigate, projectId, workspaceId],
  );

  const openView = useCallback(
    (target: WorkspaceView) => {
      // Sin `file`: el archivo abierto en una vista no significa lo mismo en la
      // otra, y arrastrarlo abriría algo que el usuario no pidió.
      if (projectId && workspaceId) navigate(workspacePath(projectId, workspaceId, target));
    },
    [navigate, projectId, workspaceId],
  );

  const handleOpenPath = useCallback(
    (path: string | undefined) => {
      setSearchParams(path ? { path } : {}, { replace: true });
    },
    [setSearchParams],
  );

  const handleOpenCommit = useCallback(
    (hash: string | undefined) => {
      setSearchParams(hash ? { commit: hash } : {}, { replace: true });
    },
    [setSearchParams],
  );

  const handleOpenFile = useCallback(
    (path: string | undefined) => {
      // `replace` para que abrir un archivo tras otro no llene el historial:
      // el "atrás" del navegador tiene que volver a la lista, no recorrer cada
      // archivo que se miró.
      setSearchParams(path ? { file: path } : {}, { replace: true });
    },
    [setSearchParams],
  );

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-slate-800">Workspaces</h1>
        <p className="mt-1 text-sm text-slate-500">Elegí un proyecto para ver sus espacios de trabajo.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(workspacePath(project.id))}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <span className="block font-medium text-slate-800">{project.name}</span>
              <span className="block truncate text-xs text-slate-400">{project.id}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Workspaces</h1>
          <p className="mt-1 text-sm text-slate-500">
            {project?.name ?? projectId}
            {selected && <> · trabajando en <strong className="text-slate-700">{selected.title}</strong></>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(workspacePath())}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cambiar de proyecto
        </button>
      </div>

      {(view === 'changes' || view === 'explorer' || view === 'graph') && selected ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(workspacePath(projectId, workspaceId))}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              <i className="pi pi-arrow-left mr-1 text-xs" />
              Volver a los espacios de trabajo
            </button>
            {/* Cambiar de vista conserva el workspace (es el segmento anterior)
                pero NO el archivo abierto: el path del explorador no significa
                nada en el panel de cambios y viceversa. */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm">
              {(['changes', 'explorer', 'graph'] as WorkspaceView[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => openView(option)}
                  className={`px-3 py-1 ${view === option ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {option === 'changes' ? 'Cambios' : option === 'explorer' ? 'Explorador' : 'Grafo'}
                </button>
              ))}
            </div>
          </div>
          {view === 'changes' ? (
            <ChangesPanel
              projectId={projectId}
              replicaId={selected.replicaId}
              selectedPath={openFile}
              onSelectFile={handleOpenFile}
            />
          ) : view === 'explorer' ? (
            <ExplorerPage
              projectId={projectId}
              replicaId={selected.replicaId}
              openPath={openPath}
              onOpenPath={handleOpenPath}
            />
          ) : (
            <GraphPanel
              projectId={projectId}
              replicaId={selected.replicaId}
              selectedHash={openCommit}
              onSelectCommit={handleOpenCommit}
            />
          )}
        </>
      ) : (
        <>
          <WorkspaceList
            section={section}
            selectedId={selected?.id}
            missingId={missingId}
            onSelect={handleSelect}
            onRetry={() => load(projectId)}
          />
          {selected && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openView('changes')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300"
              >
                <i className="pi pi-file-edit mr-2 text-xs text-slate-400" />
                Ver los cambios de {selected.title}
              </button>
              <button
                type="button"
                onClick={() => openView('explorer')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300"
              >
                <i className="pi pi-folder-open mr-2 text-xs text-slate-400" />
                Explorar los archivos
              </button>
              <button
                type="button"
                onClick={() => openView('graph')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300"
              >
                <i className="pi pi-sitemap mr-2 text-xs text-slate-400" />
                Ver el grafo de la historia
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
