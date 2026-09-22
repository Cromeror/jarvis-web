import React from 'react';
import { Icon } from '../Icon.js';
import { AmbitoDeBusqueda } from './AmbitoDeBusqueda.js';
import { UserMenu } from './UserMenu.js';
import type { Miga } from '../../lib/migas.js';

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
  medida,
  acciones,
  columnaAbierta,
  onAlternarColumna,
  migas = [],
  onIrA,
  sinLeer = 0,
}: {
  titulo: string;
  sub?: string;
  acciones?: React.ReactNode;
  /** Dónde estás. Vacío = la franja no se muestra. */
  migas?: Miga[];
  onIrA?: (to: string) => void;
  columnaAbierta: boolean;
  onAlternarColumna: () => void;
  /** El segundo renglón: la CUENTA de lo que la superficie muestra. */
  medida?: string | null;
  /** Avisos sin leer. Todavía no hay de dónde sacarlos: queda en 0, mockeado. */
  sinLeer?: number;
}): React.ReactElement {
  return (
    <div className="sw-topbar">
      <div className="sw-topbar__fila sw-topbar__cab">
        <div className="sw-topbar__ident">
          <h1 className="sw-topbar__seccion">{titulo}</h1>
          {/* DOS RENGLONES, NO UNA FRASE, y cada uno en su `<span>`.

              El `.sw-topbar__subL` no es envoltorio de más: es quien recorta con
              elipsis (`.sw-topbar__sub` sólo declara la grilla). Con el texto
              suelto acá adentro, la descripción larga de un módulo estiraba el
              bloque de identidad y se comía el ancho del buscador.

              Y son dos renglones porque son dos cosas de distinta naturaleza
              —una descripción y una medida—: en una sola línea, «Las facturas
              de compra de tus empresas · 17 accesos» se lee como una frase con
              la cuenta de coletilla. Apiladas, la de abajo queda alineada bajo
              la de arriba, que es donde el ojo la busca.

              La que falte no deja renglón vacío: se dibuja sólo lo que hay
              (y `.sw-topbar__sub:empty` esconde el `<p>` entero). */}
          <p className="sw-topbar__sub">
            {sub ? <span className="sw-topbar__subL">{sub}</span> : null}
            {medida ? <span className="sw-topbar__subL sw-topbar__subL--n">{medida}</span> : null}
          </p>
        </div>

        {/* El ícono va ENVUELTO en un <span data-align>. Basecoat le pone
            padding-inline-start al addon, y sobre un <svg> con ancho fijo y
            box-sizing:border-box ese padding se come el dibujo en vez de
            separarlo: queda pegado al borde y recortado. */}
        {/* SIN LUPA AL INICIO, y no es un olvido: el template la sacó a
            propósito — «había dos en el mismo control… dos veces el mismo ícono
            en la misma píldora hace dudar de cuál es el que hace algo». La que
            queda es la del botón del final, que es la que se puede apretar.

            Y SIN `class="input"` en el campo: `.input-group` YA es la caja con
            borde, y la clase le agrega un segundo borde adentro del primero. */}
        <div className="input-group sw-topbar__buscador">
          <input type="search" placeholder="Buscar en la sección" aria-label="Buscar en la sección" />
          {/* El ámbito y la lupa. De qué se puede acotar la búsqueda depende de
              qué superficie está abierta, así que recibe el título. */}
          <AmbitoDeBusqueda seccion={titulo} />
        </div>

        <nav className="sw-topbar__nav" aria-label="Vistas" />

        <div className="sw-topbar__acciones">
          {acciones}

          {/* AVISOS. La referencia del header los pone justo antes del avatar.
              El globo va montado sobre la esquina de la campana y es
              `aria-hidden` porque visualmente ya está dicho — el número va
              TAMBIÉN en la etiqueta accesible: un lector que sólo oiga
              «Notificaciones» pierde el dato entero.

              Tope en 9+: la cápsula está medida para un dígito, y un 12 la
              deforma. */}
          <button
            className="sw-topbar__aviso"
            type="button"
            aria-label={`Notificaciones${sinLeer ? `, ${sinLeer} sin leer` : ''}`}
          >
            <Icon name="bell" />
            {sinLeer > 0 && (
              <span className="badge sw-topbar__globo" aria-hidden="true">
                {sinLeer > 9 ? '9+' : sinLeer}
              </span>
            )}
          </button>

          {/* EL TEMA NO VA SUELTO ACÁ: vive adentro del menú de usuario, que es
              donde lo puso el template. El segmentado de tres posiciones quedó
              para la pantalla de entrar, que no carga el header y es su único
              lugar suelto. Tenerlo en los dos sitios daría dos controles para
              el mismo dato en la misma pantalla.

              El avatar va ÚLTIMO, pegado al borde: es donde el ojo lo busca.
              Adentro vive cerrar sesión. */}
          <UserMenu />
        </div>
      </div>

      {/* Las franjas que llena la superficie. Ocultas hasta que alguien las use:
          una franja vacía deja un hueco mudo que se lee como algo roto. */}
      {/* LAS MIGAS. `hidden` cuando no hay ninguna y no una franja vacía: el CSS
          ya esconde `:empty`, pero el atributo lo dice antes de que el estilo
          cargue — si no, en el primer pintado queda un hueco mudo. La ÚLTIMA no
          es un enlace: es donde estás, que es la regla del breadcrumb y la que
          más se rompe. */}
      <nav className="sw-topbar__fila sw-topbar__migas" aria-label="Ubicación" hidden={migas.length === 0}>
        {migas.map((miga, i) => (
          <React.Fragment key={`${miga.label}-${i}`}>
            {i > 0 ? (
              <span className="sw-topbar__migaSep" aria-hidden="true">
                <Icon name="right" />
              </span>
            ) : null}
            {miga.to && onIrA ? (
              <button type="button" className="sw-topbar__miga" onClick={() => onIrA(miga.to as string)}>
                {miga.label}
              </button>
            ) : (
              <span className="sw-topbar__miga" aria-current="page">
                {miga.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>
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
