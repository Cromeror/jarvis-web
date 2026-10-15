import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { workspacePath, type WorkspaceRow, type WorkspaceView } from '../lib/workspace-view.js';
import { ArchivosDelProyecto, esVistaDeArchivos } from '../components/Workspaces/ArchivosDelProyecto.js';
import { Button } from '../components/ui/atoms/Button.js';
import { Card } from '../components/ui/atoms/Card.js';

/**
 * Archivos, como superficie fija del OPERADOR (`/workspaces`): elige cualquier
 * proyecto de la instalación y ve sus archivos.
 *
 * Lo de adentro es `ArchivosDelProyecto`, el mismo componente que muestra el
 * módulo Archivos (`MOD-0008`) a quien lo tiene asignado. Acá la copia y la
 * vista viven en el PATH (`/workspaces/:projectId/:workspaceId/:view`) y no en
 * estado local, por dos razones: el link se puede compartir y la elección
 * sobrevive a un F5.
 */
export function WorkspacesPage(): React.ReactElement {
  const { projectId, workspaceId, view } = useParams<{ projectId?: string; workspaceId?: string; view?: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [copia, setCopia] = useState<WorkspaceRow | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const onNavegar = useCallback(
    (copiaId: string | undefined, vista?: WorkspaceView) => {
      if (projectId) navigate(workspacePath(projectId, copiaId, vista));
    },
    [navigate, projectId],
  );

  if (!projectId) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--sw-ink)] p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Archivos</h1>
          <p className="text-sm text-muted-foreground">Elegí un proyecto para ver sus archivos.</p>
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

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--sw-ink)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Archivos</h1>
          <p className="text-sm text-muted-foreground">
            {project?.name ?? projectId}
            {copia && (
              <>
                {' '}
                · trabajando en <strong className="text-foreground">{copia.title}</strong>
              </>
            )}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate(workspacePath())}>
          Cambiar de proyecto
        </Button>
      </div>
      <ArchivosDelProyecto
        projectId={projectId}
        workspaceId={workspaceId}
        view={esVistaDeArchivos(view) ? view : undefined}
        onNavegar={onNavegar}
        onCopia={setCopia}
      />
    </div>
  );
}
