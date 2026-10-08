import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';
import { useMedidaDeSuperficie } from '../layout/medida-de-superficie.js';
import { MIN_KEY, TarjetaDelChatProvider } from './chat-card.js';
import { TiradorDeTarjeta } from './TiradorDeTarjeta.js';

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
 *     .sw-pop                      el popover de filtros, FUERA del panel
 *     .sw-side__canvas             el área de trabajo
 *       .sw-topbar                 la barra superior
 *       .sw-container              lo que se trabaja + la columna derecha
 *       .sw-dock-slot
 *
 * `.sw-side__detail` (el nivel 3 del template) NO se dibuja: sus dos inquilinos
 * se fueron —el proyecto pasó a ser el ámbito y las herramientas del módulo, a la
 * caja de herramientas de la columna derecha—, y un tercer nivel que nunca abre
 * es peor que dos que sí. El CSS queda por si vuelve a haber qué poner ahí.
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
  migas,
  onIrA,
  chat,
  children,
  contentRef,
}: {
  titulo: string;
  sub?: string;
  /** Dónde estás — la franja 2 del topbar. Vacío = no se muestra. */
  migas?: import('../../lib/migas.js').Miga[];
  onIrA?: (to: string) => void;
  chat?: React.ReactNode;
  children?: React.ReactNode;
  contentRef?: React.Ref<HTMLDivElement>;
}): React.ReactElement {
  /* LA COLUMNA DERECHA SE SACÓ DEL CHASIS (1-oct-2026), con el botón que la
     abría y la fila del topbar que lo alojaba.

     Lo único que hospedaba era la CAJA DE HERRAMIENTAS DEL MÓDULO, y ése es el
     punto: es del módulo, no del shell. El plan es que viva adentro de su
     espacio y sea dominio suyo, así que tenerla acá la ponía en el lugar
     equivocado y además cobraba su precio en toda pantalla — la fila que la
     gobernaba ocupaba su alto aunque el módulo no publicara una sola acción,
     que es el caso de todas las superficies de hoy.

     NO SE BORRÓ NADA: `SideColumn`, `ModuleTools` y sus hojas siguen en el
     repo, desconectados a propósito. Vuelven cuando el módulo los reclame.

     El chat NO estaba acá —vive en `.sw-flota`, flotando sobre el área de
     trabajo— así que esto no lo toca. */

  /* El segundo renglón del título lo publica la SUPERFICIE, no el shell: el
     shell no sabe cuántos documentos hay. Mismo canal que la corrida de una
     herramienta, y por la misma razón. */
  const { medida } = useMedidaDeSuperficie();

  /* EL CHAT ESTÁ SIEMPRE DESANCLADO: tarjeta que flota sobre el área de
     trabajo, nunca inquilino de la columna. El template ofrece las dos
     ubicaciones (decisión 43) y acá la elección ya está tomada, así que no hay
     botón de acoplar ni de sacar — un control que devuelve al estado que no
     queremos es una forma de romperlo sin querer.

     Va por portal y no renderizando el chat acá adentro porque el destino es un
     nodo que este mismo componente pinta: el portal deja que `FloatingChat` viva
     en el árbol del shell (su estado sobrevive a cualquier re-render del
     layout) y aterrice adentro de la tarjeta. */
  const chatHostRef = useRef<HTMLElement>(null);
  /* El ref no existe en el primer render: hasta que el shell esté pintado no
     hay dónde portalar. */
  const [pintado, setPintado] = useState(false);
  useEffect(() => setPintado(true), []);

  /* PLEGADA O ABIERTA, Y SE RECUERDA. Sin persistir, plegarla no sirve de
     nada: la tarjeta vuelve a abrirse en la siguiente recarga y hay que
     cerrarla otra vez. Es una preferencia de cómo querés trabajar, no estado
     de una pantalla.

     Se lee una sola vez, en el inicializador: `localStorage` es sincrónico y
     leerlo en cada render sería tocar disco por render. Fail-soft —un
     navegador sin storage abre la tarjeta, que es el estado completo. */
  const [minimizada, setMinimizada] = useState(() => {
    try {
      return localStorage.getItem(MIN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const tarjeta = useMemo(
    () => ({
      minimizada,
      alternar: () =>
        setMinimizada((v) => {
          try {
            localStorage.setItem(MIN_KEY, String(!v));
          } catch {
            /* sin storage la elección vale para esta sesión y nada más */
          }
          return !v;
        }),
    }),
    [minimizada],
  );

  return (
    <Sidebar>
      <main className="sw-side__canvas">
        <Topbar titulo={titulo} sub={sub} medida={medida} migas={migas} onIrA={onIrA} />

        <div className="sw-container">
          {/* El slot es la CAJA y no scrollea; la zona de adentro sí. Es la
              anatomía de `.sw-hoja-zona` en el template: la superficie le pone
              bordes al trabajo, y lo que se mueve es el contenido. */}
          <div className="sw-surface-slot sw-grid-surface" ref={contentRef}>
            <div className="sw-vista-zona">{children}</div>
          </div>
          {/*
            LA TARJETA DEL CHAT, siempre a la vista sobre el área de trabajo.

            Va VACÍA: sus dos hijos —la barra `.sw-flota__barra` y el envoltorio
            `.sw-chat`— los pinta `FloatingChat`, que es quien tiene la
            conversación. La barra dejó de ser decorativa (elegir conversación,
            crear, renombrar, borrar), y esos controles necesitan el mismo
            estado que el hilo: partirlos entre dos componentes obligaría a
            subir la sesión al shell, que no tiene por qué saber de sesiones.

            El `.sw-chat` no es decoración tampoco: es de él que cuelga
            `.sw-chat > :not(.sw-chat__thread) { flex: 0 0 auto }`, la regla que
            mantiene rígido al composer. En el template el nodo que se muda de
            padre ES `.sw-chat` (`flota.appendChild(chatEl)` en
            `side-column.js`), así que la tarjeta siempre lo contiene.
          */}
          <aside
            className="sw-flota"
            ref={chatHostRef}
            aria-label="Conversación"
            data-min={minimizada ? 'true' : 'false'}
          >
            {/* LA MANIJA DE TAMAÑO ES DE LA TARJETA, NO DEL CHAT — por eso la
                pinta el shell y no `FloatingChat`: cambia la caja, no la
                conversación. Es el mismo reparto que con `data-min`.

                Convive con el portal sin pisarse: React la deja primera y el
                portal agrega sus nodos detrás. */}
            <TiradorDeTarjeta objetivo={chatHostRef} />
          </aside>
        </div>

        {pintado && chatHostRef.current
          ? createPortal(<TarjetaDelChatProvider value={tarjeta}>{chat}</TarjetaDelChatProvider>, chatHostRef.current)
          : null}

        <div className="sw-dock-slot" />
      </main>
    </Sidebar>
  );
}
