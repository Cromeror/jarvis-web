import React from 'react';
import { agruparPorModulo } from './permisos-por-modulo.js';
import { ChipDeGrupo } from '../ui/ChipDeGrupo.js';

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
 * El chip es `ChipDeGrupo`, el mismo de los proyectos de la tabla de usuarios.
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
          <ChipDeGrupo
            key={g.titulo}
            rotulo={nombre ?? <code>{g.titulo}</code>}
            codigo={nombre && !g.plataforma ? g.titulo : undefined}
            items={g.items.map((i) => i.etiqueta)}
            title={detalle.join('\n')}
            neutro={g.plataforma}
          />
        );
      })}
    </div>
  );
}
