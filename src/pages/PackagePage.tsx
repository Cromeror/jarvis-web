import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchNavigation } from '../lib/catalog-api.js';
import type { CatalogPackage } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';

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
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
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

              {modulo.utilities.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Este módulo todavía no tiene utilidades.</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modulo.utilities.map((u) => (
                    <div key={u.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-white">{u.name}</h3>
                        {/* Una utilidad sin tool se muestra igual, marcada: se
                            declaró antes de que exista lo que la ejecuta, y
                            esconderla haría parecer que el módulo está vacío. */}
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
