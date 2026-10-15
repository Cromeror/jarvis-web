import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listWorkspaces } from '../../lib/workspaces-api.js';
import {
  toWorkspacesSection,
  resolveSelection,
  type WorkspaceRow,
  type WorkspacesSection,
  type WorkspaceView,
} from '../../lib/workspace-view.js';
import { WorkspaceList } from './WorkspaceList.js';
import { ChangesPanel } from './ChangesPanel.js';
import { ExplorerPage } from '../../pages/ExplorerPage.js';
import { GraphPanel } from './GraphPanel.js';
import { Button } from '../ui/atoms/Button.js';
import { Icon } from '../Icon.js';
import { Toolbar, ToolbarBoton, ToolbarGrupo, ToolbarSeparador } from '../ui/molecules/Toolbar.js';

/** Las vistas del apartado, en el orden en que se ofrecen. */
const VISTAS: { id: WorkspaceView; rotulo: string }[] = [
  { id: 'changes', rotulo: 'Cambios' },
  { id: 'explorer', rotulo: 'Explorador' },
  { id: 'graph', rotulo: 'Grafo' },
];

/** Los parámetros de la query que dicen qué se está mirando DENTRO de una vista. */
const DE_LA_VISTA = ['file', 'path', 'commit'] as const;

export function esVistaDeArchivos(v: string | null | undefined): v is WorkspaceView {
  return v === 'changes' || v === 'explorer' || v === 'graph';
}

/**
 * Los archivos de UN proyecto: sus copias (el principal y sus réplicas), cada
 * una con su rama, sus cambios sin commitear y su último commit; y, elegida una,
 * sus tres vistas — cambios, explorador y grafo.
 *
 * Se usa en dos lugares que guardan la copia y la vista en lugares distintos de
 * la URL: la superficie del operador (`/workspaces/:projectId/:copia/:vista`,
 * segmentos de path) y el módulo Archivos (`MOD-0008`, adentro de una suite,
 * donde la ruta termina en el módulo y van en la query). Por eso no navega: le
 * pide a quien lo monta que lo haga, con `onNavegar`.
 *
 * Lo que se mira DENTRO de una vista —el archivo abierto, dónde estás parado en
 * el árbol, el commit elegido— sí va siempre en la query, y cada vista tiene su
 * parámetro: `file` es el archivo cuyo diff se mira; `path`, dónde estás en el
 * árbol (puede ser una carpeta). Compartir uno solo haría que cambiar de vista
 * arrastre una ruta que allí no significa nada.
 *
 * El id del principal es el sentinel `root`; el de una réplica es su id (no su
 * slug), que es lo que espera el API y no puede colisionar con el sentinel
 * porque los ids son UUID.
 */
export function ArchivosDelProyecto({
  projectId,
  workspaceId,
  view,
  onNavegar,
  onCopia,
}: {
  projectId: string;
  workspaceId: string | undefined;
  view: WorkspaceView | undefined;
  /** Elegir otra copia, otra vista, o volver a la lista (los dos `undefined`). */
  onNavegar: (workspaceId: string | undefined, view?: WorkspaceView) => void;
  /** La copia elegida, para que quien lo monta la nombre en su encabezado. */
  onCopia?: (copia: WorkspaceRow | null) => void;
}): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const openFile = searchParams.get('file') ?? undefined;
  const openPath = searchParams.get('path') ?? undefined;
  const openCommit = searchParams.get('commit') ?? undefined;

  const [section, setSection] = useState<WorkspacesSection>({ kind: 'loading' });

  const load = useCallback((id: string) => {
    setSection({ kind: 'loading' });
    listWorkspaces(id)
      .then((response) => setSection(toWorkspacesSection(response)))
      // Un fetch caído es `failed`, no `disabled`: acá SÍ se rompió algo, y por
      // eso se ofrece reintentar. La confusión entre los dos estados es
      // justamente lo que hace que un proyecto sin root_path parezca un bug.
      .catch((err: unknown) =>
        setSection({
          kind: 'failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
  }, []);

  useEffect(() => {
    load(projectId);
  }, [projectId, load]);

  const { selected, missingId } = useMemo(
    () => (section.kind === 'ready' ? resolveSelection(section.rows, workspaceId) : { selected: null, missingId: null }),
    [section, workspaceId],
  );

  useEffect(() => {
    onCopia?.(selected);
  }, [selected, onCopia]);

  const handleSelect = useCallback(
    (row: WorkspaceRow) => {
      // Elegir el que ya está elegido lo deselecciona: sin esto no habría forma
      // de volver a la vista sin contexto desde la propia lista.
      onNavegar(row.id === workspaceId ? undefined : row.id);
    },
    [onNavegar, workspaceId],
  );

  const openView = useCallback(
    (target: WorkspaceView) => {
      // Sin `file`: el archivo abierto en una vista no significa lo mismo en la
      // otra, y arrastrarlo abriría algo que el usuario no pidió.
      if (workspaceId) onNavegar(workspaceId, target);
    },
    [onNavegar, workspaceId],
  );

  /* Abrir algo dentro de la vista toca sólo SU parámetro y conserva el resto de
     la query: en el módulo, la copia y la vista también viven ahí. `replace`
     para que abrir un archivo tras otro no llene el historial: el «atrás» del
     navegador tiene que volver a la lista, no recorrer cada archivo mirado. */
  const abrirEnLaVista = useCallback(
    (clave: (typeof DE_LA_VISTA)[number], valor: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const k of DE_LA_VISTA) next.delete(k);
          if (valor) next.set(clave, valor);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const enVista = view !== undefined && selected;

  if (enVista) {
    return (
      <div className="flex flex-col gap-4">
        {/* Cambiar de vista conserva la copia pero NO el archivo abierto: el
            path del explorador no significa nada en el panel de cambios y
            viceversa. */}
        <Toolbar label="Vistas de la copia">
          <ToolbarGrupo>
            <ToolbarBoton onClick={() => onNavegar(workspaceId)}>
              <Icon name="left" />
              Volver a las copias
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
            onSelectFile={(p) => abrirEnLaVista('file', p)}
          />
        ) : view === 'explorer' ? (
          <ExplorerPage
            projectId={projectId}
            replicaId={selected.replicaId}
            openPath={openPath}
            onOpenPath={(p) => abrirEnLaVista('path', p)}
          />
        ) : (
          <GraphPanel
            projectId={projectId}
            replicaId={selected.replicaId}
            selectedHash={openCommit}
            onSelectCommit={(h) => abrirEnLaVista('commit', h)}
          />
        )}
      </div>
    );
  }

  return (
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
  );
}
