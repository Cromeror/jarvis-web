import React, { useState } from 'react';
import { Icon } from '../Icon.js';
import { MenuContextual } from '../ui/MenuContextual.js';

/**
 * PORT de `mountScope()` (`src/shell/chrome.js` del template SpaceMyWork).
 *
 * Es **el alcance del buscador**, no un control de un módulo: el botón dice
 * `En %s` con el nombre de la superficie abierta, y las dos opciones son buscar
 * acá o buscar en todo. Por eso se repinta cuando cambia el módulo activo — en
 * el template, con el evento `sw:modulo-activo`.
 *
 * El comentario del template lo enmarca así: *la pregunta que el buscador no
 * contestaba.* El placeholder decía «Buscar en la sección» y no había forma de
 * salir de esa sección ni de saber cuál era.
 *
 * ## Los dos botones son distintos a propósito
 *
 * `.sw-topbar__ambitoB` abre el menú; `.sw-topbar__blup` dispara la búsqueda.
 * Y la lupa decorativa del INICIO del campo no va — el template la sacó, con el
 * motivo escrito en su `index.html`:
 *
 * > Había dos en el mismo control: ésta, decorativa al inicio del campo, y la
 * > del botón redondo del final, que es la que se puede apretar. Dos veces el
 * > mismo ícono en la misma píldora hace dudar de cuál es el que hace algo.
 *
 * El menú es el mismo servicio que usa la tabla (`MenuContextual`, port de
 * `SW.menus.showContextMenu`): píldora deslizante, reencuadre y cierre por
 * Escape o clic afuera.
 */

/* Verbatim de `content.js` (`workspace.ambito`). */
const T = {
  aqui: 'En %s',
  todo: 'En todo',
  cambiar: 'Dónde buscar',
  buscar: 'Buscar',
};

export function AmbitoDeBusqueda({
  seccion,
  onBuscar,
}: {
  /** El nombre de la superficie abierta. Es el `%s` de «En %s». */
  seccion: string;
  onBuscar?: () => void;
}): React.ReactElement {
  const [todo, setTodo] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const aqui = T.aqui.replace('%s', seccion);

  return (
    <div className="sw-topbar__ambito">
      <button
        type="button"
        className="sw-topbar__ambitoB"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        aria-label={T.cambiar}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 4 });
        }}
      >
        <span>{todo ? T.todo : aqui}</span>
        <Icon name="chevron" />
      </button>

      <button type="button" className="sw-topbar__blup" aria-label={T.buscar} onClick={onBuscar}>
        <Icon name="search" />
      </button>

      {menu ? (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          groups={[
            {
              items: [
                { id: 'aqui', label: aqui, icon: 'filter' },
                { id: 'todo', label: T.todo, icon: 'globe' },
              ],
            },
          ]}
          onCerrar={() => setMenu(null)}
          onSelect={(id) => setTodo(id === 'todo')}
        />
      ) : null}
    </div>
  );
}
