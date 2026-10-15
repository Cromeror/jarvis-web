import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ModuleViewProps } from '../registry.js';
import type { WorkspaceView } from '../../lib/workspace-view.js';
import { ArchivosDelProyecto, esVistaDeArchivos } from '../../components/Workspaces/ArchivosDelProyecto.js';

/**
 * ARCHIVOS (`MOD-0008`), en el riel de quien lo tiene asignado: los archivos del
 * espacio activo, sus cambios y su historia.
 *
 * Es el mismo contenido que la superficie del operador (`/workspaces`), pero
 * acá la ruta termina en el módulo (`/suites/:proyecto/:suite/:modulo`), así
 * que la copia elegida y la vista van en la query: `?copia=root&vista=explorer`.
 * Lo que oculta o muestra —lo ignorado por el `.gitignore`— lo decide el
 * proyecto en Ajustes (`MOD-0009`) y lo aplica el servidor.
 */
export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const copia = searchParams.get('copia') ?? undefined;
  const vista = searchParams.get('vista');

  /* Cambiar de copia o de vista es navegar (entra al historial, como en la
     superficie del operador) y suelta lo que se miraba adentro de la vista. */
  const onNavegar = useCallback(
    (copiaId: string | undefined, v?: WorkspaceView) => {
      const next = new URLSearchParams();
      if (copiaId) next.set('copia', copiaId);
      if (copiaId && v) next.set('vista', v);
      setSearchParams(next);
    },
    [setSearchParams],
  );

  return (
    <div className="flex flex-col gap-6">
      <ArchivosDelProyecto
        projectId={projectId}
        workspaceId={copia}
        view={esVistaDeArchivos(vista) ? vista : undefined}
        onNavegar={onNavegar}
      />
    </div>
  );
}
