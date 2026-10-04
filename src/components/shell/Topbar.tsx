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
 *   [ Nombre de sección ][ ←— buscador —→ ][ vistas · avatar ]
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
  migas = [],
  onIrA,
}: {
  titulo: string;
  sub?: string;
  /** Dónde estás. Vacío = la franja no se muestra. */
  migas?: Miga[];
  onIrA?: (to: string) => void;
  /** El segundo renglón: la CUENTA de lo que la superficie muestra. */
  medida?: string | null;
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

        {/* EL EXTREMO DERECHO ES SÓLO EL AVATAR.

            Tuvo tres inquilinos más —Environments, Pipelines y una campana de
            avisos— y los tres se fueron juntos. Los dos menús son atajos a
            superficies que YA están en el riel (`/environments`, `/plans`), o
            sea un segundo lugar para llegar al mismo lado; la campana nunca
            tuvo de dónde sacar un número ni adónde llevar, así que era un botón
            que no hacía nada.

            Lo que los volvió un problema fue el ancho chico: la franja no
            encoge —el nombre de la sección no tiene reemplazo y el buscador ya
            se va solo por debajo de 620px— así que cuatro controles más el
            avatar se salían del canto y se recortaban sin aviso. Con uno solo,
            la fila entra.

            El avatar va pegado al borde: es donde el ojo lo busca. Adentro
            viven el tema y cerrar sesión. */}
        <div className="sw-topbar__acciones">
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
      {/* LA FILA DE LA TOOLBAR SE FUE (1-oct-2026), y con ella el botón de la
          columna derecha que era su único habitante visible.

          Medía su alto en TODAS las pantallas para no mostrar nada: el slot de
          acciones del bloque (`.sw-toolbar-slot`) está vacío en cada superficie
          de hoy —ninguna publica acciones— y el contexto de al lado nace
          `hidden`. Lo único que quedaba era el botón que abría la caja de
          herramientas, y esa caja salió del chasis: es del módulo, va a vivir
          adentro de su espacio.

          Es alto caro: en una pantalla baja, el header entero más esta fila
          dejaban la tabla del módulo fuera de la vista. El shell no puede
          cobrarle espacio permanente a todas las superficies por una pieza que
          ninguna usa.

          Las clases (`.sw-toolbar`, `.sw-toolbar__aside`, `.sw-topbar__caja`)
          siguen en `shell/chrome.css`: vuelven con la caja. */}
    </div>
  );
}
