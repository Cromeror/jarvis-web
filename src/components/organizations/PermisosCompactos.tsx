import React from 'react';
import { agruparPorModulo } from './permisos-por-modulo.js';

/**
 * LOS PERMISOS DE UN ROL, en una línea por lo general.
 *
 * Era un renglón por módulo con un chip por acción: un rol de cuatro módulos
 * ocupaba cuatro renglones, la tabla crecía sin necesidad y el ojo tenía que
 * saltar entre el código del módulo a la izquierda y sus chips a la derecha.
 *
 * Ahora es UN chip por módulo, segmentado —quién | qué puede—, todos en la
 * misma fila y bajando sólo si no entran:
 *
 *     Miembros MOD-0006 │ roles · members · create
 *
 * El nombre del módulo va primero porque es lo que se reconoce; el código queda
 * al lado, chico, porque es lo que distingue dos módulos con el mismo nombre.
 * El detalle —qué habilita cada permiso— está en el `title` del chip: es lo que
 * se consulta de a uno, y en pantalla costaba un renglón por permiso.
 *
 * El contraste es a propósito más alto que el de la tabla (`--sw-line-strong`,
 * el rótulo teñido con el acento, las acciones sobre `card`): con el borde
 * normal el chip se perdía contra el fondo de la fila en el tema oscuro.
 */
export function PermisosCompactos({
  permisos,
  nombres,
  descripciones,
}: {
  permisos: readonly string[];
  /** `MOD-0006` → «Miembros». Sin nombre, el chip muestra sólo el código. */
  nombres: ReadonlyMap<string, string>;
  /** `MOD-0006:roles` → qué habilita. Para el `title`. */
  descripciones: ReadonlyMap<string, string>;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 whitespace-normal">
      {agruparPorModulo(permisos).map((g) => {
        const nombre = g.plataforma ? 'Plataforma' : (nombres.get(g.titulo) ?? null);
        const detalle = g.items.map((i) => `${i.permiso}${descripciones.has(i.permiso) ? ` — ${descripciones.get(i.permiso)}` : ''}`);
        return (
          <span
            key={g.titulo}
            title={detalle.join('\n')}
            className="inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-[var(--sw-line-strong)] text-[11px] leading-none shadow-sm"
          >
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 font-medium ${
                g.plataforma ? 'bg-accent text-foreground' : 'bg-primary/25 text-foreground'
              }`}
            >
              {nombre ?? <code>{g.titulo}</code>}
              {nombre && !g.plataforma ? <code className="text-[10px] font-normal text-secondary-foreground">{g.titulo}</code> : null}
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-1 border-l border-[var(--sw-line-strong)] bg-card px-2 py-1 text-foreground">
              {g.items.map((i, n) => (
                <React.Fragment key={i.permiso}>
                  {n > 0 ? <span className="text-muted-foreground">·</span> : null}
                  <span>{i.etiqueta}</span>
                </React.Fragment>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
