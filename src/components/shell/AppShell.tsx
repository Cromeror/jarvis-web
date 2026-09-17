import React, { useState } from 'react';
import { Sidebar } from './Sidebar.js';
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
  /* DOS ESTADOS, NO TRES: abierta y riel. No se cierra del todo porque el chat
     es del shell y nunca se va — a lo sumo queda a un clic.

     El estado vive acá y no en la columna porque el botón que lo alterna está en
     la barra superior: son dos piezas separadas en el DOM mirando el mismo dato. */
  const [columnaAbierta, setColumnaAbierta] = useState(true);

  return (
    <Sidebar>
      <main className="sw-side__canvas">
        <Topbar
          titulo={titulo}
          sub={sub}
          acciones={acciones}
          columnaAbierta={columnaAbierta}
          onAlternarColumna={() => setColumnaAbierta((v) => !v)}
        />

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
          <SideColumn
            chat={chat}
            herramientas={herramientas}
            riel={!columnaAbierta}
            onAbrir={() => setColumnaAbierta(true)}
          />
        </div>

        <div className="sw-dock-slot" />
      </main>
    </Sidebar>
  );
}
