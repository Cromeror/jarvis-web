import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Tabla, type ColumnaDeTabla } from '../components/ui/Tabla.js';
import {
  InstallationApiError,
  allocatePortGrant,
  listPortGrants,
  revokePortGrant,
  type PortGrant,
  type PortGrantsResponse,
} from '../lib/installation-api.js';
import { listOrganizations, type OrganizationSummary } from '../lib/organizations-api.js';

const PANEL_CLASS = 'rounded-xl border border-white/10 bg-white/[0.03] p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';
const BOTON_PRIMARIO =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'organizacion', label: 'Organización', w: 220 },
  { id: 'bloque', label: 'Bloque', w: 140 },
  { id: 'cantidad', label: 'Puertos', w: 90, al: 'der' },
  { id: 'note', label: 'Para qué', w: 260 },
];

function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof InstallationApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/**
 * EL REPARTO DEL ESPACIO DE PUERTOS, que es configuración de la instalación.
 *
 * Lo que la pantalla tiene que dejar ver de un vistazo es cuánto queda libre: el
 * pool es finito y un bloque concedido no se recupera solo. Por eso la cabecera
 * muestra el total libre antes que la tabla — el listado dice quién tiene qué,
 * pero la decisión que se toma acá («¿le doy diez a esta organización?») depende
 * del resto.
 *
 * NO se elige el bloque, sólo el TAMAÑO. Elegir el `start` a mano obligaría a
 * mirar qué está tomado para hacer una cuenta que el servidor hace mejor, y
 * además invita a dejar huecos: el servidor toma el primer hueco contiguo y
 * mantiene el espacio libre junto al final.
 */
export function PortGrantsPage(): React.ReactElement {
  const { user } = useAuth();
  const [datos, setDatos] = useState<PortGrantsResponse | null>(null);
  const [organizaciones, setOrganizaciones] = useState<OrganizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [orgId, setOrgId] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [guardando, setGuardando] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [grants, orgs] = await Promise.all([listPortGrants(), listOrganizations()]);
      setDatos(grants);
      setOrganizaciones(orgs);
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar el reparto de puertos'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nombreDeOrg = useCallback(
    (id: string): string => organizaciones.find((o) => o.id === id)?.name ?? id,
    [organizaciones],
  );

  /**
   * Cuántos puertos quedan sin conceder.
   *
   * Es el total libre, NO el bloque contiguo más grande: pueden quedar treinta
   * sueltos en huecos de cinco y que una concesión de veinte no entre. Se dice
   * así —«libres», no «disponibles»— porque prometer más de lo que se puede dar
   * es peor que no decir nada, y el servidor es quien tiene la última palabra.
   */
  const libres = useMemo(() => {
    if (!datos) return null;
    const total = datos.pool.end - datos.pool.start + 1;
    const concedidos = datos.grants.reduce((suma, g) => suma + (g.end_port - g.start_port + 1), 0);
    return { total, concedidos, libres: total - concedidos };
  }, [datos]);

  async function conceder(): Promise<void> {
    if (!orgId) return;
    const tamanio = size.trim() === '' ? (datos?.default_size ?? 10) : Number(size);
    setGuardando(true);
    try {
      await allocatePortGrant({ organization_id: orgId, size: tamanio, note: note.trim() || null });
      setSize('');
      setNote('');
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo conceder el bloque'));
    } finally {
      setGuardando(false);
    }
  }

  async function revocar(grant: PortGrant): Promise<void> {
    try {
      await revokePortGrant(grant.id);
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo revocar el bloque'));
    }
  }

  function celda(g: PortGrant, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'organizacion') return nombreDeOrg(g.organization_id);
    if (c.id === 'bloque') return `${g.start_port}–${g.end_port}`;
    if (c.id === 'cantidad') return String(g.end_port - g.start_port + 1);
    return g.note ?? '—';
  }

  // Sólo el superadmin reparte infraestructura. Un cliente que llegue por URL se
  // va al inicio en vez de mirar una pantalla vacía.
  if (user && user.account_type !== 'operator') return <Navigate to="/" replace />;

  return (
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
      <h1 className="mb-1 text-lg font-semibold text-white">Puertos de la instalación</h1>
      <p className="mb-4 max-w-3xl text-xs text-slate-400">
        Cada organización recibe un bloque de puertos externos, y sus proyectos reservan adentro. El bloque es finito y
        no se recupera solo: revocarlo es lo único que lo devuelve al pool.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {libres && datos && (
        <div className={`${PANEL_CLASS} mb-4`}>
          <p className="text-sm text-white">
            <span className="font-semibold">{libres.libres}</span> puertos libres de {libres.total}{' '}
            <span className="text-slate-400">
              (pool {datos.pool.start}–{datos.pool.end}, {libres.concedidos} concedidos)
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Es el total libre, no el bloque contiguo más grande: puede haber puertos sueltos en huecos y que una
            concesión grande igual no entre.
          </p>
        </div>
      )}

      <div className={`${PANEL_CLASS} mb-4`}>
        <h2 className="mb-3 text-sm font-semibold text-white">Conceder un bloque</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Organización</span>
            <select className={INPUT_CLASS} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Elegí una…</option>
              {organizaciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-32">
            <span className="mb-1 block text-xs text-slate-400">Puertos</span>
            <input
              className={INPUT_CLASS}
              type="number"
              min={1}
              value={size}
              placeholder={String(datos?.default_size ?? 10)}
              onChange={(e) => setSize(e.target.value)}
            />
          </label>
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Para qué (opcional)</span>
            <input className={INPUT_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className={BOTON_PRIMARIO} disabled={!orgId || guardando} onClick={() => void conceder()}>
            Conceder
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Se elige cuántos puertos, no cuáles: el servidor toma el primer hueco contiguo del pool.
        </p>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Tabla<PortGrant>
          titulo="Bloques concedidos"
          columnas={COLUMNAS}
          filas={datos?.grants ?? []}
          clave={(g) => g.id}
          nombreFila={(g) => `${nombreDeOrg(g.organization_id)} ${g.start_port}–${g.end_port}`}
          seleccion={false}
          celda={celda}
          menuFila={() => ({
            groups: [{ items: [{ id: 'revocar', label: 'Revocar bloque', icon: 'trash' }] }],
            onSelect: (id, g) => {
              if (id === 'revocar') void revocar(g);
            },
          })}
          textos={{
            vacio: 'Todavía no hay bloques concedidos',
            vacioPaso: 'Concedé uno con el formulario de arriba.',
          }}
        />
      )}
    </div>
  );
}
