import React from 'react';
import { Icon } from '../Icon.js';

/**
 * LA COLUMNA DERECHA — la caja de herramientas.
 *
 * El template le da DOS inquilinos que se turnan (decisión 43): la
 * conversación y las herramientas. Acá queda uno solo: **el chat está siempre
 * desanclado**, en su tarjeta sobre el área de trabajo, así que la columna es
 * la caja de herramientas y nada más. Es lo mismo que hace el template cuando
 * el chat está afuera —`side-column.js` esconde su pestaña en vez de
 * deshabilitarla, porque deshabilitada diría «esto existe y no podés» cuando la
 * verdad es que no está en la columna—, sólo que acá ese estado es permanente.
 *
 * El `role="tablist"` va en un contenedor INTERNO y no en la fila: un tablist
 * sólo puede contener tabs, y un botón suelto adentro rompe la navegación por
 * flechas del lector de pantalla. La fila es el contenedor visual.
 *
 * Y el nombre viaja en `aria-label` + `data-n`, no en `title`: en modo riel la
 * palabra se esconde con CSS y sin el aria-label la pestaña se queda sin nombre
 * accesible — y `title` traería el globo nativo encima del nuestro.
 */

export function SideColumn({
  herramientas,
  riel,
  onAbrir,
}: {
  herramientas?: React.ReactNode;
  /** Colapsada a riel. Son DOS estados, no tres: abierta y riel. */
  riel: boolean;
  onAbrir: () => void;
}): React.ReactElement {
  return (
    <div className={`sw-side-col${riel ? ' is-riel' : ''}`}>
      <div className="sw-side-col__switch">
        <div className="sw-side-col__tabs" role="tablist" aria-label="Qué ocupa la columna">
          {/* Con la columna colapsada el clic LA ABRE: dice qué querés ver, y
              dejarla en riel sería contestar que no. Abierta ya está mostrando
              lo único que hospeda, así que no tiene nada más que hacer. */}
          <button
            className="sw-side-col__tab"
            type="button"
            role="tab"
            id="side-col-tab-tools"
            data-id="tools"
            data-n="Herramientas"
            aria-label="Herramientas"
            aria-selected
            onClick={() => riel && onAbrir()}
          >
            <Icon name="wrench" />
            <span className="sw-side-col__label">Herramientas</span>
          </button>
        </div>
      </div>

      {/*
        EL INQUILINO QUE NO SE VE SE APAGA CON `data-tenant-off`, no con
        `hidden`. Es el contrato del CSS del template
        (`.sw-side-col__body > [data-tenant-off] { display: none }`), y no es
        intercambiable: estas cajas llevan `display` por clase, y una regla de
        autor le gana al `[hidden] { display: none }` del navegador. Con
        `hidden` las dos zonas se dibujaban a la vez, apiladas.

        Eso cubre además la regla 3 de §11 —la zona que no se ve sale del orden
        de tabulación—: `display: none` no es focusable. `side-column.js` suma
        `inert` porque también apaga zonas que siguen a la vista (la tarjeta
        plegada); acá no hay ninguna en ese estado.
      */}
      <div className="sw-side-col__body">
        <div className="sw-inspector-slot" data-tenant-off={herramientas ? undefined : ''}>
          {herramientas}
        </div>
        {/* Un hueco mudo se lee como que algo se rompió: cuando la superficie no
            trae herramientas, la columna lo dice. */}
        <p className="sw-side-col__vacio" data-tenant-off={herramientas ? '' : undefined}>
          Esta superficie no trae caja de herramientas
        </p>
      </div>
    </div>
  );
}
