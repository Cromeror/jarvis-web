import React, { Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchNavigation } from '../lib/catalog-api.js';
import type { CatalogSuite } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
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
  const navigate = useNavigate();
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
  const modulo = suite?.modules.find((m) => m.slug === moduleSlug) ?? suite?.modules[0] ?? null;
  const Vista = moduleView(modulo?.key ?? null);

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!suites) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <p className="text-sm text-slate-400">
          Este proyecto no tiene asignada la suite «{suiteSlug}». Pedíselo a quien administre el producto.
        </p>
      </div>
    );
  }

  return (
    // El trabajo ocupa el ancho entero: lo que se hace SOBRE él está en la
    // columna derecha del shell, que es la caja de herramientas de cualquier
    // superficie. Esta pantalla no tiene por qué traer la suya.
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-2">
      <div className="min-w-0 p-4">
      <h1 className="text-lg font-semibold text-white">{suite.name}</h1>
      {suite.description && <p className="mt-1 text-sm text-slate-400">{suite.description}</p>}

      {suite.modules.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Esta suite todavía no tiene módulos configurados.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {suite.modules.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/suites/${projectId}/${suite.slug}/${m.slug}`)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.id === modulo?.id ? 'bg-indigo-500/20 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {modulo && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-white">{modulo.name}</h2>
              {modulo.description && <p className="mt-1 text-xs text-slate-400">{modulo.description}</p>}

              {Vista ? (
                // El módulo está construido: manda su propia vista, y las
                // herramientas las presenta ella (un botón, un paso de un
                // asistente, lo que corresponda a ese trabajo).
                <div className="mt-3">
                  <Suspense fallback={<p className="text-sm text-slate-400">Cargando el módulo…</p>}>
                    <Vista projectId={projectId as string} module={modulo} />
                  </Suspense>
                </div>
              ) : (
                <>
                  {/* Sin vista construida se listan las herramientas, que es lo
                      único que se sabe del módulo. No es un error: el front y la
                      API se despliegan por separado, así que un módulo puede
                      estar configurado antes de que este bundle lo tenga. */}
                  <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Este módulo todavía no tiene una vista en esta versión de la aplicación. Abajo están sus
                    herramientas configuradas, y se corren desde la caja de herramientas de la derecha.
                  </p>
                  {modulo.module_tools.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">Este módulo todavía no tiene herramientas.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {modulo.module_tools.map((u) => (
                        <div key={u.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium text-white">{u.name}</h3>
                            {u.tool_name ? (
                              <StatusBadge label={u.tool_name} tone="neutral" />
                            ) : (
                              <StatusBadge label="sin tool" tone="warning" />
                            )}
                          </div>
                          {u.description && <p className="mt-2 text-xs text-slate-400">{u.description}</p>}
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

      {/* El resultado de una herramienta corrida desde la caja. Vive acá y no
          en la columna porque un JSON no entra en 350px — y porque es el
          resultado del trabajo, no una opción sobre él. */}
      {corrida && (
        <section className="mt-6 border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{corrida.herramienta.name}</h3>
            <button
              type="button"
              onClick={() => setCorrida(null)}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          {corrida.error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {corrida.error}
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200">
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
