import React, { useCallback, useEffect, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import {
  crearCarpetaDeEspacio,
  dejarDeCompartirDesdeEspacio,
  desactivarCarpetaDeEspacio,
  activarCarpetaDeEspacio,
  getRedDeProyecto,
  invitarEspacio,
  type ProyectoDeRed,
  type RedDeProyecto,
} from '../../lib/red-de-contexto-api.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { NuevoCirculo, TablaDeCarpetas } from '../../components/organizations/carpetas-compartidas.js';
import { mensajeDeError } from '../../components/organizations/errores.js';

/**
 * LA RED DE CONTEXTO, del lado del ESPACIO (`MOD-0004`, Ajustes →
 * «Espacio»): donde el espacio activo arma su parte de la red.
 *
 * Crea carpetas compartidas —queda como su dueño— e invita a otros espacios de
 * la organización. Cada invitación queda PENDIENTE hasta que la organización la
 * aprueba (Ajustes → «Organización» → Red de contexto → Invitaciones); mientras
 * tanto no se le entrega nada. Es la única pestaña: lo que se supervisa —qué
 * valida el auditor, la cuarentena— es de la organización.
 *
 * Ver `docs/05-ambito-de-los-modulos.md` del workspace, «Red de contexto».
 */
export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const { proyectos } = useActiveProject();
  const [datos, setDatos] = useState<RedDeProyecto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDatos(await getRedDeProyecto(projectId));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la red de contexto'));
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Corre una acción, muestra su error tal cual y recarga. */
  async function accion(fn: () => Promise<unknown>, fallback: string, hecho?: string): Promise<boolean> {
    setError(null);
    setAviso(null);
    try {
      await fn();
      await refresh();
      if (hecho) setAviso(hecho);
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  /* Los espacios que la tabla nombra: éste y los demás de la organización. Para
     participar alcanza con que la organización tenga la red, así que ninguno
     está «sin la red» desde acá. */
  const propio = proyectos.find((p) => p.id === projectId);
  const espacios: ProyectoDeRed[] = datos
    ? [
        {
          id: projectId,
          name: propio?.name ?? projectId,
          con_modulo: true,
          tiene_root: true,
        },
        ...datos.espacios.map((e) => ({ ...e, con_modulo: true })),
      ]
    : [];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">Red de contexto</h2>
      <div className="mb-4 flex border-b border-border" role="tablist" aria-label="Red de contexto">
        <span role="tab" aria-selected className="-mb-px border-b-2 border-primary px-3 py-2 text-sm text-foreground">
          Compartir
        </span>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Las carpetas compartidas de este espacio. Invitá a otros espacios desde el menú de cada fila: la organización
        aprueba cada invitación, y recién ahí les llega. Lo que este espacio deje en{' '}
        <code className="text-secondary-foreground">contexto-org/&lt;carpeta&gt;/publicado/</code> les llega a los aprobados.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-secondary-foreground">
          {aviso}
        </div>
      )}

      {!datos ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <NuevoCirculo
            vacio={datos.propias.length === 0}
            onCrear={(input) =>
              accion(() => crearCarpetaDeEspacio(projectId, input), 'No se pudo crear la carpeta compartida')
            }
          />

          <TablaDeCarpetas
            carpetas={datos.propias.map(({ circulo, miembros }) => ({
              ...circulo,
              miembros,
            }))}
            proyectos={espacios}
            excluir={projectId}
            onCompartir={(c, p) =>
              void accion(
                () => invitarEspacio(projectId, c.id, p.id),
                'No se pudo invitar a ese espacio',
                `Invitaste a «${p.name}» a «${c.nombre}». Le llega cuando la organización lo apruebe.`,
              )
            }
            onDejarDeCompartir={(c, p) =>
              accion(() => dejarDeCompartirDesdeEspacio(projectId, c.id, p.id), 'No se pudo dejar de compartir')
            }
            onDesactivar={(c) =>
              accion(
                () => desactivarCarpetaDeEspacio(projectId, c.id),
                'No se pudo desactivar la carpeta compartida',
                `«${c.nombre}» quedó desactivada: se están retirando las copias de cada espacio.`,
              )
            }
            onActivar={(c) =>
              accion(
                () => activarCarpetaDeEspacio(projectId, c.id),
                'No se pudo activar la carpeta compartida',
                `«${c.nombre}» quedó activa: el sistema está volviendo a copiar los archivos a cada espacio.`,
              )
            }
          />
        </div>
      )}
    </section>
  );
}
