import React, { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon.js';
import { chipsVisibles } from './chips-visibles.js';

export interface ChipDeEspacio {
  nombre: string;
  /** Qué dice el ícono y su color: el estado de ESTE espacio. */
  icono: string;
  claseIcono: string;
  etiqueta: string;
  /** El globo: el estado con su detalle. */
  detalle: string;
}

const CHIP = 'inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-200';

function Chip({ c }: { c: ChipDeEspacio }): React.ReactElement {
  return (
    <span className={CHIP} title={c.detalle}>
      <span className={`inline-flex ${c.claseIcono}`} aria-label={c.etiqueta}>
        <Icon name={c.icono} />
      </span>
      {c.nombre}
    </span>
  );
}

/**
 * LOS ESPACIOS CON LOS QUE SE COMPARTE UNA CARPETA, como chips con el estado de
 * cada uno, en hasta DOS LÍNEAS. Si no entran, el último chip es «+N» y su globo
 * lista con quién más se comparte, con su estado: que haya más se ve, y quiénes,
 * también.
 *
 * Cuántos entran depende del ancho real de la celda, así que se mide: todos los
 * chips se dibujan en una capa invisible del mismo ancho, se lee en qué línea
 * cayó cada uno (`chipsVisibles`) y se vuelve a medir cuando la celda cambia de
 * ancho.
 */
export function ChipsDeEspacios({ chips }: { chips: ChipDeEspacio[] }): React.ReactElement {
  const medida = useRef<HTMLDivElement>(null);
  const [visibles, setVisibles] = useState(chips.length);

  useLayoutEffect(() => {
    const capa = medida.current;
    if (!capa) return;
    const medir = (): void => {
      const tops = Array.from(capa.children).map((el) => (el as HTMLElement).offsetTop);
      setVisibles(chipsVisibles(tops, 2));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(capa);
    return () => ro.disconnect();
  }, [chips]);

  const ocultos = chips.slice(visibles);
  return (
    <div className="relative py-2">
      <div ref={medida} aria-hidden="true" className="invisible absolute inset-x-0 top-2 flex flex-wrap gap-1">
        {chips.map((c) => (
          <Chip key={c.nombre} c={c} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1 whitespace-normal">
        {chips.slice(0, visibles).map((c) => (
          <Chip key={c.nombre} c={c} />
        ))}
        {ocultos.length > 0 && (
          <span className={`${CHIP} cursor-help`} title={ocultos.map((c) => `${c.nombre} — ${c.detalle}`).join('\n')}>
            +{ocultos.length}
          </span>
        )}
      </div>
    </div>
  );
}
