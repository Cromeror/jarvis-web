import React, { Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchNavigation, vaEnElRiel } from '../lib/catalog-api.js';
import type { CatalogSuite } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
import { Button } from '../components/ui/atoms/Button.js';
import { moduleView } from '../modules/registry.js';
import { useHerramientaCorrida } from '../components/layout/herramienta-corrida.js';

/**
 * Una suite asignada al proyecto: sus módulos, y el trabajo del módulo
 * elegido.
 *
 * LAS HERRAMIENTAS DEL MÓDULO YA NO VIVEN ACÁ. Tenía un rail propio
 * (`UtilitiesRail`, eliminado) que era una segunda caja de herramientas al lado
 * de la que el shell ya tiene en la columna derecha. Ahora las dibuja
 * `ModuleTools` desde el shell y lo único que vuelve para acá es el RESULTADO
 * de correr una, por `useHerramientaCorrida` — que es lo que no entra en una
 * columna de 350px.
 *
 * El submenú del sidebar y esta página muestran lo mismo desde dos lados
 * —sidebar para navegar, acá para trabajar— y los dos salen de la MISMA
 * llamada (`/api/catalog/navigation`), que es lo que garantiza que no puedan
 * discrepar: una lista de módulos armada por otro camino terminaría ofreciendo
 * uno que el menú no tiene.
 */
export function SuitePage(): React.ReactElement {
  const { projectId, suiteSlug, moduleSlug } = useParams<{
    projectId: string;
    suiteSlug: string;
    moduleSlug?: string;
  }>();
  const [suites, setSuites] = useState<CatalogSuite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Lo último que devolvió una herramienta de la caja. Se muestra acá, en el
     área de trabajo, que es donde hay lugar para un JSON.

     Ya NO se registra un anchor de página: el rail propio se fue, así que el
     área de trabajo vuelve a ser el contenido entero del shell y el chat flota
     sobre eso — que es el default y no hace falta pedirlo. */
  const { corrida, setCorrida } = useHerramientaCorrida();

  useEffect(() => {
    if (!projectId) return;
    let cancelado = false;
    void fetchNavigation(projectId)
      .then((p) => {
        if (!cancelado) setSuites(p);
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar la suite');
      });
    return () => {
      cancelado = true;
    };
  }, [projectId]);

  const suite = suites?.find((p) => p.slug === suiteSlug) ?? null;
  // Sin módulo en la URL se muestra el primero: entrar a una suite y ver una
  // pantalla vacía obligaría a un clic más para llegar a lo único que hay.
  // Sólo los del riel: un módulo de Ajustes no se abre como pantalla de la suite.
  const delRiel = suite?.modules.filter(vaEnElRiel) ?? [];
  const modulo = delRiel.find((m) => m.slug === moduleSlug) ?? delRiel[0] ?? null;
  const Vista = moduleView(modulo?.key ?? null);

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="rounded-[var(--sw-r-md)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">{error}</div>
      </div>
    );
  }

  if (!suites) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <p className="text-sm text-muted-foreground">
          Este proyecto no tiene asignada la suite «{suiteSlug}». Pedíselo a quien administre el producto.
        </p>
      </div>
    );
  }

  return (
    // El trabajo ocupa el ancho entero: lo que se hace SOBRE él está en la
    // columna derecha del shell, que es la caja de herramientas de cualquier
    // superficie. Esta pantalla no tiene por qué traer la suya.
    // EL SCROLL ES DE LA SUPERFICIE, NO DE LA PÁGINA — el modelo del template:
    // la superficie mide el alto de su caja y lo que scrollea es la pieza que
    // tiene de más (la tabla, adentro de su card). Con la página scrolleando,
    // un módulo que pida `height: 100%` no tiene contra qué medirse y la
    // cabecera pegajosa de su tabla se va hacia arriba con las filas.
    <div className="h-full min-h-0 overflow-hidden p-2">
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] p-4">
      {/* EL TRABAJO. Scrollea sólo si su contenido no entra: un módulo con vista
          propia mide 100% y no lo hace nunca —scrollea él, adentro—; la lista de
          herramientas del módulo sin vista crece y sí. */}
      <div className="min-w-0 min-h-0 overflow-y-auto">
      {/* SIN ENCABEZADOS. Ni el nombre de la suite ni el del módulo: esto es la
          SUPERFICIE DE TRABAJO, y quien la abrió ya sabe dónde está — se lo
          dicen el riel encendido, las migas y el título del topbar, que desde
          ahora nombra el módulo. Repetirlo acá gasta el alto que necesita el
          trabajo, que es lo que la persona vino a hacer. */}
      {delRiel.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Esta suite todavía no tiene módulos configurados.</p>
      ) : (
        <>
          {/* SIN TABS. Los módulos de la suite ya son el submenú del sidebar
              (nivel 2 de `shell/Sidebar`), así que una tira de botones acá es un
              segundo navegador para lo mismo. */}
          {modulo && (
            // `h-full` SÓLO cuando hay vista: es lo que le da a la superficie
            // del módulo el alto definido contra el que resolver su `height:
            // 100%`. Sin vista el contenido es una lista que crece, y forzarle
            // el alto la dejaría con un hueco abajo.
            <section className={Vista ? 'h-full min-h-0' : undefined}>
              {Vista ? (
                // El módulo está construido: manda su propia vista, y las
                // herramientas las presenta ella (un botón, un paso de un
                // asistente, lo que corresponda a ese trabajo).
                <div className="h-full min-h-0">
                  <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando el módulo…</p>}>
                    <Vista projectId={projectId as string} module={modulo} />
                  </Suspense>
                </div>
              ) : (
                <>
                  {/* Sin vista construida se listan las herramientas, que es lo
                      único que se sabe del módulo. No es un error: el front y la
                      API se despliegan por separado, así que un módulo puede
                      estar configurado antes de que este bundle lo tenga. */}
                  <p className="mt-3 rounded-[var(--sw-r-md)] border border-[var(--sw-warning)] bg-[var(--sw-warning-bg)] px-3 py-2 text-xs text-[var(--sw-on-warning)]">
                    Este módulo todavía no tiene una vista en esta versión de la aplicación. Abajo están sus
                    herramientas configuradas, y se corren desde la caja de herramientas de la derecha.
                  </p>
                  {modulo.module_tools.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Este módulo todavía no tiene herramientas.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {modulo.module_tools.map((u) => (
                        <div key={u.id} className="rounded-[var(--sw-r-lg)] border border-border bg-card p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium text-foreground">{u.name}</h3>
                            {u.tool_name ? (
                              <StatusBadge label={u.tool_name} tone="neutral" />
                            ) : (
                              <StatusBadge label="sin tool" tone="warning" />
                            )}
                          </div>
                          {u.description && <p className="mt-2 text-xs text-muted-foreground">{u.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
      </div>

      {/* El resultado de una herramienta corrida desde la caja. Vive acá y no
          en la columna porque un JSON no entra en 350px — y porque es el
          resultado del trabajo, no una opción sobre él. */}
      {corrida && (
        <section className="mt-6 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{corrida.herramienta.name}</h3>
            <Button variant="ghost" onClick={() => setCorrida(null)}>
              Cerrar
            </Button>
          </div>
          {corrida.error ? (
            <div className="rounded-[var(--sw-r-md)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
              {corrida.error}
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-[var(--sw-r-md)] border border-border bg-muted p-3 font-mono text-xs text-foreground">
              {typeof corrida.output === 'string'
                ? corrida.output
                : JSON.stringify(corrida.output, null, 2)}
            </pre>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
