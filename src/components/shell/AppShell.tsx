import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon.js';
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

  /* EL CHAT TIENE DOS UBICACIONES y el usuario elige: inquilino de la columna
     —como arranca— o tarjeta que flota sobre el área de trabajo.

     El nodo SE MUDA DE PADRE, que es lo que hace el template. Acá va por portal
     y no re-renderizando en dos lugares: con un portal React conserva el mismo
     árbol, así que la conversación, el scroll y lo escrito a medias sobreviven
     al viaje. Remontarlo los perdería en cada clic. */
  const [chatFuera, setChatFuera] = useState(false);
  const anclaRef = useRef<HTMLDivElement>(null);
  const flotaRef = useRef<HTMLElement>(null);
  /* Los refs no existen en el primer render: hasta que el shell esté pintado no
     hay dónde portalar. */
  const [pintado, setPintado] = useState(false);
  useEffect(() => setPintado(true), []);
  const destino = chatFuera ? flotaRef.current : anclaRef.current;

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
          <aside className="sw-flota" ref={flotaRef} aria-label="Conversación" hidden={!chatFuera}>
            {/* La barra de la tarjeta hace lo que adentro hace el conmutador:
                decir qué es esto, y ofrecer la puerta de vuelta. */}
            <header className="sw-flota__barra">
              <Icon name="message" />
              <span className="sw-flota__t">Conversación</span>
              <button
                className="sw-flota__btn"
                type="button"
                aria-label="Volver a la columna"
                title="Volver a la columna"
                onClick={() => setChatFuera(false)}
              >
                <Icon name="entrar" />
              </button>
            </header>
          </aside>
          <SideColumn
            chatHostRef={anclaRef}
            chatAnclado={!chatFuera}
            herramientas={herramientas}
            riel={!columnaAbierta}
            onAbrir={() => setColumnaAbierta(true)}
          />
        </div>

        {/* EL BOTÓN DE SACAR VIVE ADENTRO DEL CHAT, no en la fila del
            conmutador: al lado de las pestañas se leía como una tercera — dos
            controles del mismo tamaño en la misma fila se leen como una serie,
            aunque uno elija vista y el otro ejecute una acción. Y como el nodo
            se muda de padre, el botón viaja con él. */}
        {pintado && destino
          ? createPortal(
              <>
                {chat}
                {!chatFuera && (
                  <button
                    className="sw-chat__sacar"
                    type="button"
                    aria-label="Sacar la conversación de la caja"
                    title="Sacar la conversación de la caja"
                    onClick={() => setChatFuera(true)}
                  >
                    <Icon name="salir" />
                  </button>
                )}
              </>,
              destino,
            )
          : null}

        <div className="sw-dock-slot" />
      </main>
    </Sidebar>
  );
}
