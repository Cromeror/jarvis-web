import React, { useEffect, useMemo, useState } from 'react';
import {
  listModulosDeOrganizacion,
  listOrganizations,
  type ModuloDeOrganizacion,
  type OrganizationSummary,
} from '../lib/organizations-api.js';
import { SECCIONES_DE_ORGANIZACION } from '../components/organizations/secciones.js';
import { seccionesVisibles } from '../components/organizations/secciones-visibles.js';
import { mensajeDeError } from '../components/organizations/errores.js';

const PAGE_INPUT_CLASS =
  'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';

/**
 * «MI ORGANIZACIÓN» — la configuración de la organización: las secciones de
 * sus módulos de ORGANIZACIÓN (`ORGANIZATION_MODULES` en el core).
 *
 * Es el tercer lugar de la app, al lado de las suites del proyecto (el día a
 * día) y de las pantallas de instalación (el operador). Ver
 * `docs/buckets-de-modulos.md` del workspace.
 *
 * La ve quien tenga algo que configurar en alguna organización. El
 * administrador de una organización no es otro tipo de cuenta: es un cliente con
 * un rol, y controla SU organización desde acá y nada más. El operador elige
 * cualquiera.
 */
export function OrganizacionPage(): React.ReactElement {
  const [organizaciones, setOrganizaciones] = useState<OrganizationSummary[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [modulos, setModulos] = useState<ModuloDeOrganizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        // Sólo las que tiene algo que configurar: una organización donde no
        // puede nada sería un selector que lleva a una pantalla vacía.
        const orgs = (await listOrganizations()).filter((o) => o.permissions.length > 0);
        setOrganizaciones(orgs);
        setElegida(orgs[0]?.id ?? null);
      } catch (err) {
        setError(mensajeDeError(err, 'No se pudieron cargar las organizaciones'));
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!elegida) return;
    setModulos(null);
    let vigente = true;
    void listModulosDeOrganizacion(elegida)
      .then((m) => {
        if (vigente) setModulos(m);
      })
      .catch((err: unknown) => {
        if (vigente) {
          setModulos([]);
          setError(mensajeDeError(err, 'No se pudieron cargar los módulos de la organización'));
        }
      });
    return () => {
      vigente = false;
    };
  }, [elegida]);

  const org = organizaciones.find((o) => o.id === elegida) ?? null;
  const secciones = useMemo(
    () => (org && modulos ? seccionesVisibles(SECCIONES_DE_ORGANIZACION, modulos, org.permissions) : []),
    [org, modulos],
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : organizaciones.length === 0 ? (
        <p className="text-sm text-slate-400">No tenés nada que configurar en ninguna organización.</p>
      ) : (
        <>
          {/* Un cliente pertenece a UNA organización, así que el selector sólo
              aparece cuando hay de dónde elegir — el operador. */}
          {organizaciones.length > 1 && (
            <div className="mb-6">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Organización</label>
              <select
                value={elegida ?? ''}
                onChange={(e) => setElegida(e.target.value)}
                className={`${PAGE_INPUT_CLASS} min-w-64`}
              >
                {organizaciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {modulos === null ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : secciones.length === 0 ? (
            /* EL VACÍO DICE LA CAUSA: o la organización no tiene módulos de
               organización —vienen en las suites de sus proyectos—, o los tiene
               y a quien mira no le dieron ningún permiso de ellos. */
            <div className="max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              {modulos.length === 0 ? (
                <p>
                  {org?.name} todavía no tiene módulos de organización. Se activan con una suite asignada a alguno de
                  sus proyectos, desde el Catálogo.
                </p>
              ) : (
                <p>
                  {org?.name} tiene {modulos.map((m) => m.name).join(', ')}, pero tu rol no incluye permisos para
                  configurarlos.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {/* Cada sección trae su propio título: es la misma que se usaba
                  antes en otra pantalla, y el nombre lo dice ella. */}
              {secciones.map(({ key, seccion }) => (
                <div key={`${elegida}-${key}`}>{seccion.render(elegida as string, org?.permissions ?? [])}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
