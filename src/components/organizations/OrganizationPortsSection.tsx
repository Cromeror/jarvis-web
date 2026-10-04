import React, { useCallback, useEffect, useState } from 'react';
import {
  assignProjectPortGrant,
  listOrganizationPortGrants,
  revokeProjectPortGrant,
  type OrganizationPortGrantsResponse,
  type ProjectPortGrant,
} from '../../lib/organizations-api.js';
import { mensajeDeError } from './errores.js';
import { repartoDeBloque } from './reparto-de-puertos.js';
import { Tabla, type ColumnaDeTabla } from '../ui/Tabla.js';

/** Mismas superficies que `PortGrantsPage`: esto es su segundo nivel y tiene que leerse igual. */
const PANEL_CLASS = 'rounded-xl border border-white/10 bg-white/[0.03] p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';
const BOTON_PRIMARIO =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

const TAMANIO_POR_DEFECTO = 10;

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'proyecto', label: 'Proyecto', w: 220 },
  { id: 'tramo', label: 'Puertos', w: 140 },
  { id: 'cantidad', label: 'Cantidad', w: 90, al: 'der' },
  { id: 'note', label: 'Para qué', w: 260, elastica: true },
];

/**
 * EL REPARTO DEL BLOQUE DE PUERTOS ENTRE LOS PROYECTOS DE LA ORGANIZACIÓN.
 *
 * Es el segundo nivel de `PortGrantsPage`: allá el superadmin le da un bloque a
 * la organización, acá la organización decide qué proyecto usa qué parte. Vive
 * en el panel de la organización y no en una página propia porque lo gobierna
 * un permiso de ORGANIZACIÓN (`environments-002:ports`) — quien lo tiene ya está
 * mirando esta pantalla para configurar su organización.
 *
 * A diferencia del primer nivel, acá SÍ se puede elegir desde qué puerto: el
 * bloque es chico y conocido, y un proyecto que ya tiene un servicio escuchando
 * en un puerto concreto necesita ese y no el primer hueco. Es opcional; vacío,
 * el servidor elige.
 */
export function OrganizationPortsSection({ organizationId }: { organizationId: string }): React.ReactElement {
  const [datos, setDatos] = useState<OrganizationPortGrantsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [projectId, setProjectId] = useState('');
  const [size, setSize] = useState('');
  const [startPort, setStartPort] = useState('');
  const [note, setNote] = useState('');
  const [guardando, setGuardando] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDatos(await listOrganizationPortGrants(organizationId));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar el reparto de puertos'));
    } finally {
      setCargando(false);
    }
  }, [organizationId]);

  // El panel lo monta con `key={organizationId}`, así que cambiar de
  // organización lo remonta limpio: no hace falta resetear el formulario acá.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nombreDeProyecto = (id: string): string => datos?.projects.find((p) => p.id === id)?.name ?? id;

  async function asignar(): Promise<void> {
    if (!projectId) return;
    const tamanio = size.trim() === '' ? TAMANIO_POR_DEFECTO : Number(size);
    const desde = startPort.trim() === '' ? undefined : Number(startPort);
    setGuardando(true);
    setError(null);
    try {
      await assignProjectPortGrant(organizationId, {
        project_id: projectId,
        size: tamanio,
        ...(desde !== undefined ? { start_port: desde } : {}),
        note: note.trim() || null,
      });
      setSize('');
      setStartPort('');
      setNote('');
      await refresh();
    } catch (err) {
      // El 400 de «no cabe» o «se pisa con otro tramo» es el caso normal acá, y
      // su mensaje dice cuál de los dos: se muestra tal cual.
      setError(mensajeDeError(err, 'No se pudo asignar el tramo'));
    } finally {
      setGuardando(false);
    }
  }

  async function soltar(g: ProjectPortGrant): Promise<void> {
    if (!window.confirm(`¿Soltar los puertos ${g.start_port}–${g.end_port} de '${nombreDeProyecto(g.project_id)}'?`)) return;
    setError(null);
    try {
      await revokeProjectPortGrant(organizationId, g.id);
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo soltar el tramo'));
    }
  }

  function celda(g: ProjectPortGrant, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'proyecto') return nombreDeProyecto(g.project_id);
    if (c.id === 'tramo') return `${g.start_port}–${g.end_port}`;
    if (c.id === 'cantidad') return String(g.end_port - g.start_port + 1);
    return g.note ?? '—';
  }

  const sinBloque = datos !== null && datos.blocks.length === 0;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-white">Puertos</h2>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : sinBloque ? (
        <p className="text-sm text-slate-400">
          La organización no tiene bloque de puertos; lo concede un superadmin desde Puertos.
        </p>
      ) : datos ? (
        <div className="space-y-4">
          {datos.blocks.map((b) => {
            const r = repartoDeBloque(b, datos.project_grants);
            return (
              <div key={b.id} className={PANEL_CLASS}>
                <p className="text-sm text-white">
                  Bloque <span className="font-semibold">{b.start_port}–{b.end_port}</span>{' '}
                  <span className="text-slate-400">
                    ({r.total} puertos: {r.repartidos} repartidos, {r.libres} libres
                    {r.libres > 0 && r.mayorHueco < r.libres ? `, el mayor hueco es de ${r.mayorHueco}` : ''})
                  </span>
                </p>
                {b.note && <p className="mt-1 text-xs text-slate-400">{b.note}</p>}
                {/* La barra es el bloque en orden de puerto: deja ver no sólo
                    cuánto queda sino DÓNDE, que es lo que importa al elegir
                    «desde el puerto». El ancho es proporcional y el detalle va
                    en el tooltip de cada pedazo. */}
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                  {r.segmentos.map((s) => (
                    <div
                      key={`${s.tipo}-${s.start}`}
                      style={{ width: `${(s.size / r.total) * 100}%` }}
                      className={s.tipo === 'tramo' ? 'border-r border-[var(--app-bg)] bg-indigo-500/80' : ''}
                      title={
                        s.tipo === 'tramo'
                          ? `${nombreDeProyecto(s.grant.project_id)}: ${s.start}–${s.end}`
                          : `Libre: ${s.start}–${s.end} (${s.size})`
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className={PANEL_CLASS}>
            <h3 className="mb-3 text-sm font-semibold text-white">Asignar a un proyecto</h3>
            {datos.projects.length === 0 ? (
              <p className="text-xs text-slate-400">La organización todavía no tiene proyectos a los que asignarles puertos.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-56 flex-1">
                    <span className="mb-1 block text-xs text-slate-400">Proyecto</span>
                    <select className={INPUT_CLASS} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      <option value="">Elegí uno…</option>
                      {datos.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-28">
                    <span className="mb-1 block text-xs text-slate-400">Cantidad</span>
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={1}
                      value={size}
                      placeholder={String(TAMANIO_POR_DEFECTO)}
                      onChange={(e) => setSize(e.target.value)}
                    />
                  </label>
                  <label className="w-36">
                    <span className="mb-1 block text-xs text-slate-400">Desde el puerto (opcional)</span>
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      value={startPort}
                      placeholder="primer hueco"
                      onChange={(e) => setStartPort(e.target.value)}
                    />
                  </label>
                  <label className="min-w-56 flex-1">
                    <span className="mb-1 block text-xs text-slate-400">Para qué (opcional)</span>
                    <input className={INPUT_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className={BOTON_PRIMARIO}
                    disabled={!projectId || guardando}
                    onClick={() => void asignar()}
                  >
                    Asignar
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Sin «desde el puerto», el servidor toma el primer hueco del tamaño pedido.
                </p>
              </>
            )}
          </div>

          <Tabla<ProjectPortGrant>
            titulo="Tramos por proyecto"
            columnas={COLUMNAS}
            filas={datos.project_grants}
            clave={(g) => g.id}
            nombreFila={(g) => `${nombreDeProyecto(g.project_id)} ${g.start_port}–${g.end_port}`}
            seleccion={false}
            celda={celda}
            menuFila={() => ({
              groups: [{ items: [{ id: 'soltar', label: 'Soltar los puertos', danger: true }] }],
              onSelect: (id, g) => {
                if (id === 'soltar') void soltar(g);
              },
            })}
            textos={{
              vacio: 'Todavía no hay puertos asignados a proyectos',
              vacioPaso: 'Asigná un tramo con el formulario de arriba.',
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
