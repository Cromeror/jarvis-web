import React, { useEffect, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import { getAjustesDeArchivos, setAjustesDeArchivos, type AjustesDeArchivos } from '../../lib/archivos-ajustes-api.js';
import { mensajeDeError } from '../../components/organizations/errores.js';
import { timeAgo } from '../../lib/time-ago.js';

/**
 * LOS AJUSTES DE ARCHIVOS (`MOD-0009`, Ajustes → «Espacio»): qué ve, en la
 * sección Archivos del riel, quien tiene acceso a ella en este espacio.
 *
 * Un solo interruptor: ocultar lo que ignora el `.gitignore`. Encendido es lo de
 * siempre. Apagado se ve TODO menos `.git` —el `.env` incluido—, y por eso el
 * texto lo dice con todas las letras: es la consecuencia que hay que tener
 * presente antes de tocarlo. El cambio se aplica en el servidor, así que vale
 * para todos y desde el próximo clic.
 */
export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [ajustes, setAjustes] = useState<AjustesDeArchivos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    getAjustesDeArchivos(projectId)
      .then((a) => vigente && setAjustes(a))
      .catch((err: unknown) => vigente && setError(mensajeDeError(err, 'No se pudieron leer los ajustes')));
    return () => {
      vigente = false;
    };
  }, [projectId]);

  async function cambiar(ocultar: boolean): Promise<void> {
    setError(null);
    setGuardando(true);
    try {
      setAjustes(await setAjustesDeArchivos(projectId, ocultar));
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Archivos</h2>
        <p className="text-sm text-muted-foreground">Qué se ve en la sección Archivos de este espacio.</p>
      </div>
      {error && (
        <div className="rounded-[var(--sw-r-md)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          {error}
        </div>
      )}
      {!ajustes ? (
        !error && <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--sw-r-md)] border border-border bg-card p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              className="input mt-0.5"
              checked={ajustes.ocultar_ignorados}
              disabled={guardando}
              onChange={(e) => void cambiar(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Ocultar lo que ignora el .gitignore</span>
              <span className="block text-xs text-muted-foreground">
                {ajustes.ocultar_ignorados
                  ? 'Encendido: no se ven los archivos que el .gitignore del proyecto ignora (por ejemplo el .env), ni node_modules.'
                  : 'Apagado: se ve todo menos .git, incluidos el .env y node_modules. Cualquiera con acceso a Archivos en este espacio puede abrirlos.'}
              </span>
            </span>
          </label>
          {ajustes.updated_by && ajustes.updated_at && (
            <p className="text-xs text-muted-foreground">
              Lo cambió {ajustes.updated_by} {timeAgo(ajustes.updated_at)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
