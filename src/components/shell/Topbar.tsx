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
}: {
  titulo: string;
  sub?: string;
  acciones?: React.ReactNode;
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
        <div className="sw-topbar__caja" />
      </div>
    </div>
  );
}
