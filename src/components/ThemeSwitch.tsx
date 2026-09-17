import React, { useEffect, useState } from 'react';
import { Icon } from './Icon.js';
import { useTheme, type Tema } from '../hooks/useTheme.js';

/**
 * El segmentado de tres posiciones del template (`shell/theme-switch.js`):
 * seguir al sistema · claro · oscuro, con la pastilla que viaja.
 *
 * La pastilla no se posiciona acá: la mueve el CSS según `data-choice` en el
 * contenedor (`theme-switch.css`). Y `data-ready` arranca en `false` para que
 * no se deslice sola en el primer pintado — recién después del montaje pasa a
 * `true` y las transiciones se encienden.
 */

const OPCIONES: { valor: Tema; icono: string; etiqueta: string }[] = [
  { valor: 'auto', icono: 'monitor', etiqueta: 'Seguir al sistema' },
  { valor: 'light', icono: 'sun', etiqueta: 'Claro' },
  { valor: 'dark', icono: 'moon', etiqueta: 'Oscuro' },
];

export function ThemeSwitch(): React.ReactElement {
  const { choice, set } = useTheme();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    // Un cuadro de margen: si se enciende en el mismo, la pastilla anima desde
    // el origen hasta la opción guardada y se ve como un tirón al cargar.
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="sw-theme"
      role="radiogroup"
      aria-label="Tema"
      data-choice={choice}
      data-ready={listo ? 'true' : 'false'}
    >
      <span className="sw-theme__pill" aria-hidden="true" />
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="sw-theme__opt"
          role="radio"
          aria-checked={choice === o.valor}
          aria-label={o.etiqueta}
          title={o.etiqueta}
          data-value={o.valor}
          /* Un radiogroup se recorre con flechas, no con Tab: sólo el activo
             queda en el orden de tabulación. */
          tabIndex={choice === o.valor ? 0 : -1}
          onClick={() => set(o.valor)}
        >
          <Icon name={o.icono} />
        </button>
      ))}
    </div>
  );
}
