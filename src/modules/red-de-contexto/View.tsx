import React, { useCallback, useEffect, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import { getRedDeProyecto, type RedDeProyecto } from '../../lib/red-de-contexto-api.js';
import { StatusBadge } from '../../components/ui/atoms/StatusBadge.js';
import { estadoDeMiembro, publicadosPorProyecto, tamano } from './estado.js';

/** Cada cuánto se refresca sola: el sync corre cada 30 s, así que mirar más seguido no muestra nada nuevo. */
const REFRESCO_MS = 30_000;

/**
 * Área de trabajo del módulo `red-de-contexto-004` en un proyecto: con quién
 * comparte documentación, qué publicó cada uno y si llega.
 *
 * Es una vista para MIRAR. Lo que se comparte no se sube desde acá: se deja en
 * la carpeta `publicado/` del proyecto, como en una carpeta compartida, y el
 * sync se encarga del resto. Y quién está en cada círculo no lo decide el
 * proyecto sino su organización (Mi organización → Red de contexto). Por eso no hay
 * botones: cualquiera que hubiera prometería algo que este proyecto no puede
 * hacer sobre sí mismo.
 */
export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [datos, setDatos] = useState<RedDeProyecto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    try {
      setDatos(await getRedDeProyecto(projectId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la red de contexto');
    }
  }, [projectId]);

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => void cargar(), REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [cargar]);

  if (error) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>;
  }
  if (!datos) return <p className="text-sm text-slate-400">Cargando…</p>;

  if (datos.circulos.length === 0) {
    return (
      <div className="max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Este proyecto todavía no comparte documentación con nadie.</p>
        <p className="mt-2 text-slate-400">
          Los círculos los arma quien administra la organización, desde Mi organización → Red de contexto. En cuanto este
          proyecto esté en uno, aparece acá con quién comparte y qué publicó cada uno.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Todo vive en <code className="text-slate-300">{datos.carpeta}/</code>, en la raíz del proyecto. Lo que dejes en{' '}
        <code className="text-slate-300">&lt;círculo&gt;/publicado/</code> les llega a los demás; lo de ellos está en{' '}
        <code className="text-slate-300">&lt;círculo&gt;/recibido/</code>, de solo lectura. Se sincroniza cada 30 segundos.
      </p>

      {datos.circulos.map(({ circulo, miembros, publicados }) => {
        const porProyecto = publicadosPorProyecto(publicados);
        return (
          <section key={circulo.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <h2 className="text-sm font-semibold text-white">{circulo.nombre}</h2>
              <code className="text-xs text-slate-400">
                {datos.carpeta}/{circulo.slug}/
              </code>
            </div>

            {circulo.contexto.trim() ? (
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-300">{circulo.contexto}</p>
            ) : (
              <p className="mb-4 text-xs text-slate-500">La organización todavía no escribió el contexto general de este círculo.</p>
            )}

            <ul className="space-y-3">
              {miembros.map((m) => {
                const propio = m.project_id === projectId;
                const archivos = porProyecto.get(m.project_id) ?? [];
                const e = estadoDeMiembro(m);
                return (
                  <li key={m.project_id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white">{m.project_id}</span>
                      {propio && <span className="text-xs text-indigo-300">este proyecto</span>}
                      <span title={e.detalle}>
                        <StatusBadge label={e.etiqueta} tone={e.tono} />
                      </span>
                      <span className="text-xs text-slate-400">
                        {archivos.length === 0
                          ? propio
                            ? 'no publicó nada todavía'
                            : 'no publicó nada'
                          : `${archivos.length} archivo(s) ${propio ? 'publicados' : 'recibidos'}`}
                      </span>
                    </div>
                    {e.tono !== 'success' && e.tono !== 'neutral' && (
                      <p className="mt-1 text-xs text-slate-400">{e.detalle}</p>
                    )}
                    {archivos.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                          {propio ? `${circulo.slug}/publicado/` : `${circulo.slug}/recibido/${m.project_id}/`}
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-4">
                          {archivos.map((a) => (
                            <li key={a.ruta} className="flex gap-3 font-mono text-xs text-slate-300">
                              <span className="truncate">{a.ruta}</span>
                              <span className="shrink-0 text-slate-500">{tamano(a.bytes)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
