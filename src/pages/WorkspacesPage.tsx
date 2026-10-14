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
import { Button } from '../components/ui/atoms/Button.js';
import { Card } from '../components/ui/atoms/Card.js';
import { Icon } from '../components/Icon.js';
import { Toolbar, ToolbarBoton, ToolbarGrupo, ToolbarSeparador } from '../components/ui/molecules/Toolbar.js';

/** Las vistas del apartado, en el orden en que se ofrecen. */
const VISTAS: { id: WorkspaceView; rotulo: string }[] = [
  { id: 'changes', rotulo: 'Cambios' },
  { id: 'explorer', rotulo: 'Explorador' },
  { id: 'graph', rotulo: 'Grafo' },
];

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
      <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--sw-ink)] p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Elegí un proyecto para ver sus espacios de trabajo.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} onClick={() => navigate(workspacePath(project.id))} className="flex flex-col gap-1">
              <span className="block font-medium text-foreground">{project.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{project.id}</span>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === projectId);
  const enVista = (view === 'changes' || view === 'explorer' || view === 'graph') && selected;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--sw-ink)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            {project?.name ?? projectId}
            {selected && <> · trabajando en <strong className="text-foreground">{selected.title}</strong></>}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate(workspacePath())}>
          Cambiar de proyecto
        </Button>
      </div>

      {enVista ? (
        <div className="flex flex-col gap-4">
          {/* Cambiar de vista conserva el workspace (es el segmento anterior)
              pero NO el archivo abierto: el path del explorador no significa
              nada en el panel de cambios y viceversa. */}
          <Toolbar label="Vistas del espacio de trabajo">
            <ToolbarGrupo>
              <ToolbarBoton onClick={() => navigate(workspacePath(projectId, workspaceId))}>
                <Icon name="left" />
                Volver a los espacios de trabajo
              </ToolbarBoton>
            </ToolbarGrupo>
            <ToolbarSeparador />
            <ToolbarGrupo>
              {VISTAS.map(({ id, rotulo }) => (
                <ToolbarBoton key={id} presionado={view === id} onClick={() => openView(id)}>
                  {rotulo}
                </ToolbarBoton>
              ))}
            </ToolbarGrupo>
          </Toolbar>
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
        </div>
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
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => openView('changes')}>
                <Icon name="pen" />
                Ver los cambios de {selected.title}
              </Button>
              <Button variant="outline" onClick={() => openView('explorer')}>
                <Icon name="folder" />
                Explorar los archivos
              </Button>
              <Button variant="outline" onClick={() => openView('graph')}>
                <Icon name="branch" />
                Ver el grafo de la historia
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
