import React, { Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchNavigation } from '../lib/catalog-api.js';
import type { CatalogPackage } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
import { moduleView } from '../modules/registry.js';
import { UtilitiesRail, type UtilityRunResult } from '../components/modules/UtilitiesRail.js';

/**
 * Un paquete asignado al proyecto: sus módulos, y las utilidades del módulo
 * elegido.
 *
 * El submenú del sidebar y esta página muestran lo mismo desde dos lados
 * —sidebar para navegar, acá para trabajar— y los dos salen de la MISMA
 * llamada (`/api/catalog/navigation`), que es lo que garantiza que no puedan
 * discrepar: una lista de módulos armada por otro camino terminaría ofreciendo
 * uno que el menú no tiene.
 */
export function PackagePage(): React.ReactElement {
  const { projectId, packageSlug, moduleSlug } = useParams<{
    projectId: string;
    packageSlug: string;
    moduleSlug?: string;
  }>();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<CatalogPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Lo último que devolvió una utilidad del rail. Se muestra en el área de trabajo, que es donde hay lugar. */
  const [ultimaCorrida, setUltimaCorrida] = useState<UtilityRunResult | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelado = false;
    void fetchNavigation(projectId)
      .then((p) => {
        if (!cancelado) setPackages(p);
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el paquete');
      });
    return () => {
      cancelado = true;
    };
  }, [projectId]);

  const paquete = packages?.find((p) => p.slug === packageSlug) ?? null;
  // Sin módulo en la URL se muestra el primero: entrar a un paquete y ver una
  // pantalla vacía obligaría a un clic más para llegar a lo único que hay.
  const modulo = paquete?.modules.find((m) => m.slug === moduleSlug) ?? paquete?.modules[0] ?? null;
  const Vista = moduleView(modulo?.key ?? null);

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!packages) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (!paquete) {
    return (
      <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
        <p className="text-sm text-slate-400">
          Este proyecto no tiene asignado el paquete «{packageSlug}». Pedíselo a quien administre el producto.
        </p>
      </div>
    );
  }

  return (
    // El trabajo en el centro y las utilidades a la derecha, en el mismo lugar
    // y con el mismo componente que el rail de opciones del chat: quien usa la
    // app ya sabe que a la derecha están las acciones sobre lo que tiene
    // enfrente, y aprender un segundo lugar para lo mismo es costo sin beneficio.
    <div className="flex h-full gap-2 bg-[var(--app-bg)] p-2">
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
      <h1 className="text-lg font-semibold text-white">{paquete.name}</h1>
      {paquete.description && <p className="mt-1 text-sm text-slate-400">{paquete.description}</p>}

      {paquete.modules.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Este paquete todavía no tiene módulos configurados.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {paquete.modules.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/paquetes/${projectId}/${paquete.slug}/${m.slug}`)}
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
                // utilidades las presenta ella (un botón, un paso de un
                // asistente, lo que corresponda a ese trabajo).
                <div className="mt-3">
                  <Suspense fallback={<p className="text-sm text-slate-400">Cargando el módulo…</p>}>
                    <Vista projectId={projectId as string} module={modulo} />
                  </Suspense>
                </div>
              ) : (
                <>
                  {/* Sin vista construida se listan las utilidades, que es lo
                      único que se sabe del módulo. No es un error: el front y la
                      API se despliegan por separado, así que un módulo puede
                      estar configurado antes de que este bundle lo tenga. */}
                  <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Este módulo todavía no tiene una vista en esta versión de la aplicación. Abajo están sus
                    utilidades configuradas.
                  </p>
                  {modulo.utilities.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">Este módulo todavía no tiene utilidades.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {modulo.utilities.map((u) => (
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

      {/* El resultado de una utilidad corrida desde el rail. Vive acá y no en el
          rail porque un JSON no entra en 350px — y porque es el resultado del
          trabajo, no una opción. */}
      {ultimaCorrida && (
        <section className="mt-6 border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{ultimaCorrida.utility.name}</h3>
            <button
              type="button"
              onClick={() => setUltimaCorrida(null)}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          {ultimaCorrida.error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {ultimaCorrida.error}
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200">
              {typeof ultimaCorrida.output === 'string'
                ? ultimaCorrida.output
                : JSON.stringify(ultimaCorrida.output, null, 2)}
            </pre>
          )}
        </section>
      )}
      </div>

      {modulo && projectId && (
        <UtilitiesRail projectId={projectId} utilities={modulo.utilities} onResult={setUltimaCorrida} />
      )}
    </div>
  );
}
