import React from 'react';
import { Icon } from '../Icon.js';
import { ThemeSwitch } from '../ThemeSwitch.js';

/**
 * LA BARRA SUPERIOR — una PILA DE FRANJAS que crece, no una fila.
 *
 * Del template (`shell/chrome.css` + el chasis de `index.html`). La disposición
 * de la primera franja está fijada contra referencia:
 *
 *   [ Nombre de sección ][ ←— buscador —→ ][ vistas · acciones ]
 *
 * EL BUSCADOR NO ES UN CAJÓN AL LADO DEL TÍTULO: es la fila. Crece hasta chocar
 * con los controles de la derecha. Con un ancho fijo quedaba como un resto entre
 * dos bloques — el síntoma era «se ve roto», y era exactamente eso.
 *
 * Las franjas de abajo —migas, KPIs, barra— nacen ocultas y las llena cada
 * superficie. Van en el markup igual porque el CSS las posiciona por
 * descendencia: agregarlas después sería reescribir el chasis.
 */

export function Topbar({
  titulo,
  sub,
  acciones,
  columnaAbierta,
  onAlternarColumna,
}: {
  titulo: string;
  sub?: string;
  acciones?: React.ReactNode;
  columnaAbierta: boolean;
  onAlternarColumna: () => void;
}): React.ReactElement {
  return (
    <div className="sw-topbar">
      <div className="sw-topbar__fila sw-topbar__cab">
        <div className="sw-topbar__ident">
          <h1 className="sw-topbar__seccion">{titulo}</h1>
          <p className="sw-topbar__sub">{sub}</p>
        </div>

        {/* El ícono va ENVUELTO en un <span data-align>. Basecoat le pone
            padding-inline-start al addon, y sobre un <svg> con ancho fijo y
            box-sizing:border-box ese padding se come el dibujo en vez de
            separarlo: queda pegado al borde y recortado. */}
        <div className="input-group sw-topbar__buscador">
          <span data-align="start" aria-hidden="true">
            <Icon name="search" />
          </span>
          <input type="search" placeholder="Buscar" aria-label="Buscar en la sección" />
          <div className="sw-topbar__ambito" />
        </div>

        <nav className="sw-topbar__nav" aria-label="Vistas" />

        <div className="sw-topbar__acciones">
          {acciones}
          <ThemeSwitch />
        </div>
      </div>

      {/* Las franjas que llena la superficie. Ocultas hasta que alguien las use:
          una franja vacía deja un hueco mudo que se lee como algo roto. */}
      <nav className="sw-topbar__fila sw-topbar__migas" aria-label="Ubicación" hidden />
      <div className="sw-topbar__fila sw-topbar__kpis" hidden />
      <div className="sw-topbar__fila sw-topbar__barra">
        <div className="sw-topbar__contexto" hidden />
        <div className="sw-toolbar-slot" />
        {/* EL BOTÓN DE LA COLUMNA VIVE ACÁ, en la caja del header, y no en la
            columna. Lo pone el shell una vez y para todas las superficies: el
            template lo tuvo pegado a cada toolbar y era olvidable — una
            superficie se lo olvidó y el botón desapareció justo ahí, sin un
            error en ningún lado. Una barra a la que le falta un botón se ve
            igual de bien que una completa.

            ALTERNA ABIERTA/RIEL, nunca cierra del todo: la columna hospeda el
            chat, que es del shell y no se va — a lo sumo queda a un clic. */}
        <div className="sw-topbar__caja">
          <div className="sw-toolbar__aside">
            <button
              className="sw-toolbar__btn sw-toolbar__btn--der"
              type="button"
              title="Columna lateral"
              aria-label="Abrir o colapsar la columna"
              aria-expanded={columnaAbierta}
              onClick={onAlternarColumna}
            >
              <Icon name="panelRight" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
