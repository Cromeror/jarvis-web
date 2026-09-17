import React from 'react';
import { Rail } from './Rail.js';
import { Topbar } from './Topbar.js';
import { SideColumn } from './SideColumn.js';

/**
 * EL CHASIS — el layout de la app después de entrar.
 *
 * El árbol sale tal cual del `index.html` del template y no se puede reordenar:
 * el CSS de `shell/sidebar.css` y `shell/chrome.css` selecciona por
 * descendencia, así que la forma del DOM ES el contrato.
 *
 *   .sw-side                       el marco de todo
 *     .sw-side__rail               nivel 1 — elige superficie
 *     .sw-side__panel              nivel 2 — lista de objetos
 *     .sw-side__detail             nivel 3 — el detalle
 *     .sw-pop                      el popover de filtros, FUERA del panel
 *     .sw-side__canvas             el área de trabajo
 *       .sw-topbar                 la barra superior
 *       .sw-container              lo que se trabaja + la columna derecha
 *       .sw-dock-slot
 *
 * `.sw-pop` vive fuera del panel a propósito: el panel recorta su contenido, y
 * un popover adentro se cortaría contra su borde.
 *
 * LOS NIVELES 2 Y 3 VAN EN EL MARKUP AUNQUE HOY ESTÉN VACÍOS. No es relleno:
 * el CSS los cuenta para dimensionar el riel y el área de trabajo, y sacarlos
 * mueve todo lo demás. Nacen colapsados, que es como arranca el template.
 */

export function AppShell({
  titulo,
  sub,
  acciones,
  chat,
  herramientas,
  children,
  contentRef,
}: {
  titulo: string;
  sub?: string;
  acciones?: React.ReactNode;
  chat?: React.ReactNode;
  herramientas?: React.ReactNode;
  children?: React.ReactNode;
  contentRef?: React.Ref<HTMLDivElement>;
}): React.ReactElement {
  return (
    <div className="sw-side">
      <Rail />

      <aside className="sw-side__panel" aria-label="Objetos">
        <div className="sw-side__search">
          <span className="sw-side__sicon" />
          <input type="search" placeholder="Buscar" aria-label="Buscar" />
          <button
            className="sw-side__filtro"
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
            aria-label="Filtrar y ordenar"
          />
        </div>
        <div className="sw-side__list" role="list" />
        <div className="sw-side__pager" />
        <div className="sw-side__veil" aria-hidden="true" />
      </aside>

      <section className="sw-side__detail" aria-label="Detalle" />

      <div className="sw-pop" role="dialog" aria-label="Filtrar y ordenar" />

      <main className="sw-side__canvas">
        <Topbar titulo={titulo} sub={sub} acciones={acciones} />

        <div className="sw-container">
          {/* El slot es la CAJA y no scrollea; la zona de adentro sí. Es la
              anatomía de `.sw-hoja-zona` en el template: la superficie le pone
              bordes al trabajo, y lo que se mueve es el contenido. */}
          <div className="sw-surface-slot sw-grid-surface" ref={contentRef}>
            <div className="sw-vista-zona">{children}</div>
          </div>
          {/* El chat tiene DOS ubicaciones y el usuario elige: inquilino de la
              columna, o tarjeta que flota sobre el área de trabajo. */}
          <aside className="sw-flota" hidden />
          <SideColumn chat={chat} herramientas={herramientas} />
        </div>

        <div className="sw-dock-slot" />
      </main>
    </div>
  );
}
