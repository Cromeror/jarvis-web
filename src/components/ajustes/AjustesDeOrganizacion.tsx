import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  listModulosDeOrganizacion,
  listOrganizations,
  type ModuloDeOrganizacion,
  type OrganizationSummary,
} from '../../lib/organizations-api.js';
import type { CatalogModule } from '../../lib/catalog-api.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { moduleView } from '../../modules/registry.js';
import { SECCIONES_DE_ORGANIZACION } from '../organizations/secciones.js';
import { seccionesVisibles } from '../organizations/secciones-visibles.js';
import { mensajeDeError } from '../organizations/errores.js';

const PAGE_INPUT_CLASS =
  'rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary [&>option]:bg-popover [&>option]:text-popover-foreground';

/** Lo que se puede elegir en el menú: un módulo del espacio activo, o una sección de la organización. */
type Entrada =
  | { id: string; grupo: 'espacio'; nombre: string; modulo: CatalogModule }
  | {
      id: string;
      grupo: 'organizacion';
      nombre: string;
      render: () => React.ReactNode;
    };

/**
 * EL CONTENIDO DEL MODAL DE AJUSTES: los módulos cuya SUPERFICIE es `ajustes`.
 *
 * El menú de la izquierda los agrupa por CATÁLOGO, que es para quién es cada
 * uno (`docs/05-ambito-de-los-modulos.md` del workspace):
 *
 * - **«Espacio»**: los módulos del espacio activo que se muestran acá en vez de
 *   en el riel. Vienen en las suites del espacio, como los del riel; lo único
 *   distinto es dónde se dibujan. Se usan COMO ese espacio.
 * - **«Organización»**: las secciones de los módulos de la organización que
 *   tiene quien mira —por las suites de sus espacios— y para los que su rol le
 *   da al menos un permiso (`seccionesVisibles`).
 *
 * A la derecha, la configuración del elegido. Mostrarse acá no vuelve de
 * organización a un módulo: «Ajustes» es una ubicación, no un alcance.
 */
export function AjustesDeOrganizacion(): React.ReactElement {
  const { projectId, suites, proyectos } = useActiveProject();
  const [organizaciones, setOrganizaciones] = useState<OrganizationSummary[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [modulos, setModulos] = useState<ModuloDeOrganizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [elegido, setElegido] = useState<string | null>(null);

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
    if (!elegida) {
      setModulos([]);
      return;
    }
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

  /* Del espacio activo, los que van en Ajustes y tienen pantalla en este bundle.
     Un mismo módulo puede venir en dos suites: se muestra una vez. */
  const delEspacio: Entrada[] = useMemo(() => {
    if (!projectId) return [];
    const vistos = new Set<string>();
    return suites
      .flatMap((s) => s.modules)
      .filter(
        (m) => m.superficie === 'ajustes' && m.ambito === 'cliente' && m.key !== null && moduleView(m.key) !== null,
      )
      .filter((m) => (vistos.has(m.key!) ? false : (vistos.add(m.key!), true)))
      .map((m) => ({
        id: `espacio:${m.key}`,
        grupo: 'espacio' as const,
        nombre: m.name,
        modulo: m,
      }));
  }, [projectId, suites]);

  const org = organizaciones.find((o) => o.id === elegida) ?? null;
  const deOrganizacion: Entrada[] = useMemo(
    () =>
      org && modulos
        ? seccionesVisibles(SECCIONES_DE_ORGANIZACION, modulos, org.permissions).map(({ key, nombre, seccion }) => ({
            id: `organizacion:${key}`,
            grupo: 'organizacion' as const,
            nombre,
            render: () => seccion.render(org.id, org.permissions),
          }))
        : [],
    [org, modulos],
  );

  const entradas = [...delEspacio, ...deOrganizacion];
  /* Lo elegido sólo vale si sigue en el menú: al cambiar de organización la
     lista cambia, y se cae al primero en vez de quedar mostrando nada. */
  const actual = entradas.find((x) => x.id === elegido) ?? entradas[0] ?? null;
  const nombreDelEspacio = proyectos.find((p) => p.id === projectId)?.name ?? projectId;

  /* Una función y no un componente: declarado acá adentro, React lo vería como
     un componente nuevo en cada render y remontaría la lista (se pierde el foco
     del botón que se acaba de tocar). */
  function grupo(titulo: string, items: Entrada[]): React.ReactElement | null {
    // Sin nada que mostrar, el grupo no se dibuja: un título sobre una lista
    // vacía no dice nada.
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</span>
        <ul className="space-y-1">
          {items.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-current={actual?.id === x.id ? 'page' : undefined}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  actual?.id === x.id ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground hover:bg-accent'
                }`}
                onClick={() => setElegido(x.id)}
              >
                {x.nombre}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function contenido(): React.ReactNode {
    if (!actual) {
      return modulos === null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        /* EL VACÍO DICE LA CAUSA: nada de este espacio va en Ajustes, y la
           organización no tiene módulos que mostrar acá o el rol no da permiso. */
        <div className="rounded-xl border border-border bg-muted p-4 text-sm text-secondary-foreground">
          {modulos.length > 0 ? (
            <p>
              {org?.name} tiene {modulos.map((m) => m.name).join(', ')}, pero tu rol no incluye permisos para
              configurarlos.
            </p>
          ) : (
            <p>Todavía no hay nada para configurar acá.</p>
          )}
        </div>
      );
    }
    if (actual.grupo === 'espacio') {
      const Vista = moduleView(actual.modulo.key);
      return Vista && projectId ? (
        /* Se remonta al cambiar de espacio o de módulo: carga lo suyo desde cero. */
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <Vista key={`${projectId}-${actual.id}`} projectId={projectId} module={actual.modulo} />
        </Suspense>
      ) : null;
    }
    /* La sección trae su propio título. Se remonta al cambiar de organización o
       de módulo: carga lo suyo desde cero. */
    return <div key={`${elegida}-${actual.id}`}>{actual.render()}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6">
          <nav aria-label="Ajustes" className="w-56 shrink-0 overflow-y-auto border-r border-border pr-4">
            {grupo(nombreDelEspacio ? `Espacio · ${nombreDelEspacio}` : 'Espacio', delEspacio)}

            {/* Un cliente pertenece a UNA organización, así que el selector sólo
                aparece cuando hay de dónde elegir — el operador. */}
            {organizaciones.length > 1 && (
              <label className="mb-2 block">
                <select
                  aria-label="Elegir organización"
                  value={elegida ?? ''}
                  onChange={(e) => {
                    setElegida(e.target.value);
                    setElegido(null);
                  }}
                  className={`${PAGE_INPUT_CLASS} w-full`}
                >
                  {organizaciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {grupo('Organización', deOrganizacion)}
          </nav>

          {/* El módulo ocupa todo el ancho que deja el menú y nunca más
              (`min-w-0`); lo que no entra se desplaza acá adentro. */}
          <div className="min-h-0 min-w-0 flex-1 overflow-auto pr-1">{contenido()}</div>
        </div>
      )}
    </div>
  );
}
