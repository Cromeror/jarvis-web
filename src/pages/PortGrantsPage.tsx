import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Icon } from '../components/Icon.js';
import { Tabla, type ColumnaDeTabla } from '../components/ui/Tabla.js';
import { ConcederBloqueDialog } from '../components/installation/ConcederBloqueDialog.js';
import {
  InstallationApiError,
  allocatePortGrant,
  listPortGrants,
  revokePortGrant,
  type PortGrant,
  type PortGrantsResponse,
} from '../lib/installation-api.js';
import { listOrganizations, type OrganizationSummary } from '../lib/organizations-api.js';

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'organizacion', label: 'Organización', w: 220 },
  { id: 'bloque', label: 'Bloque', w: 140 },
  { id: 'cantidad', label: 'Puertos', w: 90, al: 'der' },
  { id: 'note', label: 'Para qué', w: 260 },
];

/**
 * LOS TRES TRAMOS DE LA BARRA, en el orden en que se apilan.
 *
 * El orden no es decorativo: va de lo más comprometido a lo más libre, para
 * que la barra se lea como un termómetro de cuánto queda. Y los rótulos van en
 * PLURAL porque cada uno lleva su número al lado en la leyenda.
 */
const TRAMOS: { id: 'en_uso' | 'asignado' | 'libre'; rot: string }[] = [
  { id: 'en_uso', rot: 'En uso' },
  { id: 'asignado', rot: 'Asignados sin usar' },
  { id: 'libre', rot: 'Libres' },
];

function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof InstallationApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/**
 * EL REPARTO DEL ESPACIO DE PUERTOS, que es configuración de la instalación.
 *
 * Lo que la pantalla tiene que dejar ver de un vistazo es cómo está repartido
 * el pool: es finito y un bloque concedido no se recupera solo. La decisión que
 * se toma acá —«¿le doy diez a esta organización?»— depende del resto, así que
 * el resumen va arriba de la tabla; el listado dice quién tiene qué.
 *
 * **Por qué una barra y no un número.** La cabecera decía «30 libres de 100» y
 * en el párrafo siguiente se desmentía: el total libre no es el bloque contiguo
 * más grande, así que pueden quedar treinta sueltos en huecos de cinco y una
 * concesión de veinte igual no entrar. Un número que viene con su propia
 * advertencia es la señal de que falta la representación. La barra muestra el
 * reparto; la nota al pie queda sólo para lo que la barra no puede decir.
 *
 * **Y por qué tres tramos y no dos.** Concedido no es usado: una organización
 * puede tener su bloque entero ocioso, y eso —desde afuera— se ve igual que un
 * bloque lleno. Es exactamente lo que hace falta distinguir para saber a quién
 * pedirle que devuelva espacio cuando el pool se acaba.
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
  const [concediendo, setConcediendo] = useState(false);

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
   * EL REPARTO EN TRES CIFRAS.
   *
   * `libres` es el total sin conceder, NO el bloque contiguo más grande: pueden
   * quedar treinta sueltos en huecos de cinco y que una concesión de veinte no
   * entre. Se dice así —«libres», no «disponibles»— porque prometer más de lo
   * que se puede dar es peor que no decir nada, y el servidor es quien tiene la
   * última palabra.
   *
   * `en_uso` sale de `in_use`, que el servidor todavía no manda: ausente cuenta
   * como 0 y su tramo no se dibuja, con lo que la barra queda en dos tramos
   * ciertos en vez de inventar un tercero. Ver el comentario del campo en
   * `installation-api.ts`.
   */
  const reparto = useMemo(() => {
    if (!datos) return null;
    const total = datos.pool.end - datos.pool.start + 1;
    const concedidos = datos.grants.reduce((suma, g) => suma + (g.end_port - g.start_port + 1), 0);
    const enUso = datos.grants.reduce((suma, g) => suma + (g.in_use ?? 0), 0);
    return {
      total,
      concedidos,
      en_uso: enUso,
      asignado: concedidos - enUso,
      libre: total - concedidos,
    };
  }, [datos]);

  async function conceder(input: { organization_id: string; size: number; note: string | null }): Promise<void> {
    await allocatePortGrant(input);
    await refresh();
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

  /* LOS TRAMOS EN CERO NO SE DIBUJAN, que es la regla del template: uno de
     ancho cero igual ocupa su filete y deja una rayita que no significa nada. */
  const tramos = reparto ? TRAMOS.map((t) => ({ ...t, n: reparto[t.id] })).filter((t) => t.n > 0) : [];

  /* LA FRASE DICE UNA SOLA COSA: cuántos puertos quedan libres. Es la cifra
     con la que se decide lo único que se hace acá —«¿le doy diez a esta
     organización?»—; el total y el reparto ya los dicen la barra y la leyenda,
     y repetirlos en la frase obligaba a leer una resta para llegar al número
     que importa.

     El singular es su propia variante: «1 puertos libres» está mal escrito. */
  const frase = !reparto
    ? ''
    : reparto.libre === 0
      ? 'Ningún puerto libre.'
      : reparto.libre === 1
        ? '1 puerto libre.'
        : `${reparto.libre} puertos libres.`;

  return (
    <div className="h-full min-h-0 bg-[var(--app-bg)] p-6">
      <div className="sw-puertos">
        {/* LA FRANJA DE ARRIBA. El aviso y la tarjeta son la misma cosa —el
            estado del reparto— así que la superficie tiene DOS hijos y no tres:
            las filas de `.sw-puertos` son `auto minmax(0, 1fr)`, y un tercer
            hijo caería en una fila implícita robándole a la tabla el alto que
            la hace llenar la pantalla. */}
        <div className="sw-puertos__franja">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {reparto && datos && (
            <section className="sw-raised sw-puertos__avance">
              <div className="sw-puertos__avTexto">
                <p className="sw-puertos__avFrase">{frase}</p>
                {/* LA ADVERTENCIA, sólo cuando puede haber huecos. Con el pool
                    entero libre o entero concedido no hay nada que fragmentar, y
                    una advertencia que no aplica enseña a ignorar las que sí. */}
                {reparto.libre > 0 && reparto.concedidos > 0 ? (
                  <p className="sw-puertos__avNota">
                    Es el total libre, no el bloque contiguo más grande: puede haber puertos sueltos en huecos y que
                    una concesión grande igual no entre. Revocar un bloque es lo único que lo devuelve al pool.
                  </p>
                ) : null}
              </div>

              {/* LA ACCIÓN VIVE EN LA TARJETA, en su segunda columna — es el
                  mismo lugar donde contable aloja el navegador de período. El
                  control que actúa sobre lo que la tarjeta narra tiene que estar
                  donde se lee el resultado, no dos cajas más arriba. */}
              <button type="button" className="btn" onClick={() => setConcediendo(true)}>
                <Icon name="plus" />
                Conceder
              </button>

              {tramos.length > 0 ? (
                <>
                  <div
                    className="sw-puertos__barraT"
                    role="img"
                    aria-label={`${reparto.concedidos} de ${reparto.total} puertos concedidos`}
                  >
                    {tramos.map((t) => (
                      <span key={t.id} className="sw-puertos__tramo" data-e={t.id} style={{ flexGrow: t.n }} />
                    ))}
                  </div>

                  <ul className="sw-puertos__leyenda">
                    {tramos.map((t) => (
                      <li key={t.id}>
                        <span className="sw-puertos__punto" data-e={t.id} aria-hidden="true" />
                        {t.rot}
                        <span className="sw-puertos__leyN">{t.n}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          )}
        </div>

        <div className="sw-puertos__tabla">
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
                vacioPaso: 'Concedé uno con el botón del resumen.',
              }}
            />
          )}
        </div>
      </div>

      <ConcederBloqueDialog
        organizaciones={organizaciones}
        defaultSize={datos?.default_size ?? 10}
        abierto={concediendo}
        onCerrar={() => setConcediendo(false)}
        onConceder={conceder}
      />
    </div>
  );
}
