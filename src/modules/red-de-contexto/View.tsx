import React, { useCallback, useEffect, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import {
  borrarCarpetaDeEspacio,
  crearCarpetaDeEspacio,
  dejarDeCompartirDesdeEspacio,
  editarCarpetaDeEspacio,
  getRedDeProyecto,
  invitarEspacio,
  type Circulo,
  type ProyectoDeRed,
  type RedDeProyecto,
} from '../../lib/red-de-contexto-api.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import {
  EditarCarpetaDialog,
  NuevoCirculo,
  TablaDeCarpetas,
} from '../../components/organizations/carpetas-compartidas.js';
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
  const [editando, setEditando] = useState<Circulo | null>(null);

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
        { id: projectId, name: propio?.name ?? projectId, con_modulo: true, tiene_root: true },
        ...datos.espacios.map((e) => ({ ...e, con_modulo: true })),
      ]
    : [];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-white">Red de contexto</h2>
      <div className="mb-4 flex border-b border-white/10" role="tablist" aria-label="Red de contexto">
        <span role="tab" aria-selected className="-mb-px border-b-2 border-indigo-400 px-3 py-2 text-sm text-white">
          Compartir
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Las carpetas compartidas de este espacio. Invitá a otros espacios desde el menú de cada fila: la organización
        aprueba cada invitación, y recién ahí les llega. Lo que este espacio deje en{' '}
        <code className="text-slate-300">contexto-org/&lt;carpeta&gt;/publicado/</code> les llega a los aprobados.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{aviso}</div>
      )}

      {!datos ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <NuevoCirculo
            vacio={datos.propias.length === 0}
            onCrear={(input) =>
              accion(() => crearCarpetaDeEspacio(projectId, input), 'No se pudo crear la carpeta compartida')
            }
          />

          <TablaDeCarpetas
            carpetas={datos.propias.map(({ circulo, miembros }) => ({ ...circulo, miembros }))}
            proyectos={espacios}
            excluir={projectId}
            onCompartir={(c, p) =>
              void accion(
                () => invitarEspacio(projectId, c.id, p.id),
                'No se pudo invitar a ese espacio',
                `Invitaste a «${p.name}» a «${c.nombre}». Le llega cuando la organización lo apruebe.`,
              )
            }
            onDejarDeCompartir={(c, p) => {
              const pendiente = c.miembros.find((m) => m.project_id === p.id)?.estado === 'pendiente';
              const pregunta = pendiente
                ? `¿Retirar la invitación a «${p.name}»?`
                : `¿Dejar de compartir «${c.nombre}» con «${p.name}»? Deja de publicar y de recibir en esta carpeta, y se le retira lo que recibió.`;
              if (!window.confirm(pregunta)) return;
              void accion(
                () => dejarDeCompartirDesdeEspacio(projectId, c.id, p.id),
                'No se pudo dejar de compartir',
              );
            }}
            onEditar={(c) => setEditando(c)}
            onBorrar={(c) => {
              if (
                !window.confirm(
                  `¿Borrar la carpeta compartida «${c.nombre}»? Lo que recibió cada espacio se le retira en la próxima sincronización. Lo que cada uno publicó se queda en su espacio.`,
                )
              )
                return;
              void accion(() => borrarCarpetaDeEspacio(projectId, c.id), 'No se pudo borrar la carpeta compartida');
            }}
          />

          <EditarCarpetaDialog
            carpeta={editando}
            onCerrar={() => setEditando(null)}
            onGuardar={(patch) =>
              editando
                ? accion(
                    () => editarCarpetaDeEspacio(projectId, editando.id, patch),
                    'No se pudo guardar la carpeta compartida',
                  )
                : Promise.resolve(false)
            }
          />
        </div>
      )}
    </section>
  );
}
