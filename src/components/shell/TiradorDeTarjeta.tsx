import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ANCHO_BASE,
  TAMANO_KEY,
  altoDe,
  anchoDelGesto,
  anchoMaximo,
  ANCHO_MINIMO,
  limitarAncho,
  type Hueco,
} from './tamano-de-tarjeta.js';

/**
 * LA MANIJA QUE AGRANDA LA TARJETA DEL CHAT — esquina superior izquierda.
 *
 * Por qué ahí y por qué un solo número: `tamano-de-tarjeta.ts`, que además
 * tiene anotada la desviación respecto de la decisión 49 del template.
 *
 * ## Escribe en el DOM, no en el estado de React
 *
 * El tamaño vive en `--sw-flota-w` / `--sw-flota-h` sobre el nodo de la
 * tarjeta, y el gesto las escribe directo. No es un atajo: la regla 5 pide 0ms
 * para manipulación directa, y un `setState` por `pointermove` re-renderiza el
 * chat entero —el hilo, la lista, el composer— sesenta veces por segundo para
 * cambiar dos números de CSS. Lo mismo que hace el template con `--sw-flota-x`
 * al arrastrar (`side-column.js`), y por la misma razón.
 *
 * Que la escritura esté en UN solo lugar es lo que mantiene eso sano: nadie
 * más toca esas variables, así que no hay dos fuentes de verdad para el tamaño.
 */
export function TiradorDeTarjeta({
  objetivo,
}: {
  /** El nodo `.sw-flota`. Lo pinta `AppShell`, que es su dueño. */
  objetivo: React.RefObject<HTMLElement | null>;
}): React.ReactElement {
  /* El ancho vigente. En un ref y no en estado por lo de arriba: es un valor
     que se escribe en el DOM, no algo que el árbol tenga que mirar. */
  const ancho = useRef<number>(ANCHO_BASE);
  const arrastre = useRef<{ id: number; x: number; y: number; w0: number } | null>(null);
  const tirador = useRef<HTMLButtonElement>(null);

  /** La celda del lienzo, que es el recorrido posible — `celda()` del template. */
  const huecoDe = useCallback((tarjeta: HTMLElement): Hueco => {
    const celda = document.querySelector('.sw-surface-slot') ?? tarjeta.parentElement ?? tarjeta;
    const caja = celda.getBoundingClientRect();
    const respiro = parseFloat(getComputedStyle(tarjeta).getPropertyValue('--sw-s-4')) || 16;
    return { ancho: caja.width, alto: caja.height, respiro };
  }, []);

  const aplicar = useCallback(
    (w: number, guardar: boolean): void => {
      const tarjeta = objetivo.current;
      if (!tarjeta) return;
      const limitado = limitarAncho(w, huecoDe(tarjeta));
      ancho.current = limitado;
      tarjeta.style.setProperty('--sw-flota-w', `${limitado}px`);
      tarjeta.style.setProperty('--sw-flota-h', `${altoDe(limitado)}px`);
      /* LO QUE SE ANUNCIA SE ESCRIBE ACÁ TAMBIÉN. El valor vive en un ref —no
         re-renderiza—, así que un `aria-valuenow` puesto en el JSX se quedaría
         para siempre en el tamaño del primer render: un slider que dice 420
         midiendo 700. El máximo tampoco es constante: lo pone el hueco. */
      tirador.current?.setAttribute('aria-valuenow', String(limitado));
      tirador.current?.setAttribute('aria-valuemax', String(anchoMaximo(huecoDe(tarjeta))));
      if (!guardar) return;
      try {
        localStorage.setItem(TAMANO_KEY, String(limitado));
      } catch {
        /* sin storage el tamaño vale para esta pantalla y nada más */
      }
    },
    [objetivo, huecoDe],
  );

  /* EL TAMAÑO GUARDADO SE APLICA ANTES DEL PAINT. Con `useEffect` se ve el
     salto desde los 420 del token hasta el tamaño elegido en cada carga. Se lee
     una sola vez, acá: `localStorage` es sincrónico. */
  useLayoutEffect(() => {
    let guardado = NaN;
    try {
      guardado = Number(localStorage.getItem(TAMANO_KEY));
    } catch {
      /* fail-soft: sin storage arranca en el tamaño de fábrica */
    }
    aplicar(Number.isFinite(guardado) && guardado > 0 ? guardado : ANCHO_BASE, false);
  }, [aplicar]);

  /* LA VENTANA TAMBIÉN CAMBIA EL TECHO. Sin esto, una tarjeta agrandada en una
     ventana grande queda más alta que la celda al achicarla, y ahí manda el
     `max-height` del CSS: recorta sólo el alto y la proporción se pierde. Se
     re-limita con el mismo cálculo, así que la tarjeta encoge entera. */
  useEffect(() => {
    const tarjeta = objetivo.current;
    const celda = document.querySelector('.sw-surface-slot') ?? tarjeta?.parentElement;
    if (!celda) return;
    const ro = new ResizeObserver(() => aplicar(ancho.current, false));
    ro.observe(celda);
    return () => ro.disconnect();
  }, [objetivo, aplicar]);

  return (
    <button
      type="button"
      ref={tirador}
      className="sw-flota__tirar"
      /* QUÉ HACE Y CÓMO SE MIDE. Es un `slider` y no un botón suelto porque eso
         es lo que es: un valor con mínimo, máximo y pasos. Así el lector de
         pantalla anuncia el tamaño al cambiarlo, en vez de un control mudo. */
      role="slider"
      aria-label="Tamaño de la conversación"
      aria-valuemin={ANCHO_MINIMO}
      aria-valuenow={ANCHO_BASE}
      title="Arrastrá para agrandar — doble clic vuelve al tamaño original"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY, w0: ancho.current };
        e.currentTarget.setPointerCapture(e.pointerId);
        objetivo.current?.setAttribute('data-midiendo', 'true');
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const a = arrastre.current;
        if (!a || e.pointerId !== a.id) return;
        // Positivo hacia el centro: la manija está arriba a la izquierda.
        aplicar(anchoDelGesto(a.w0, a.x - e.clientX, a.y - e.clientY), false);
      }}
      onPointerUp={(e) => {
        if (arrastre.current?.id !== e.pointerId) return;
        arrastre.current = null;
        objetivo.current?.removeAttribute('data-midiendo');
        // Se guarda al soltar y no en cada movimiento: son cien escrituras a
        // disco por gesto para quedarse con la última.
        aplicar(ancho.current, true);
      }}
      onPointerCancel={(e) => {
        if (arrastre.current?.id !== e.pointerId) return;
        arrastre.current = null;
        objetivo.current?.removeAttribute('data-midiendo');
      }}
      /* VOLVER AL TAMAÑO DE FÁBRICA. Es la salida de un gesto que se puede
         pasar de largo, y en una esquina de 16px pasarse es fácil. */
      onDoubleClick={() => aplicar(ANCHO_BASE, true)}
      /* EL TECLADO HACE LO MISMO. Un control que sólo responde al arrastre no
         existe para quien no arrastra (WCAG 2.1.1, y la 2.5.7 lo pide
         específicamente para los gestos de arrastre). El paso y el shift son
         los del arrastre de la tarjeta en el template. */
      onKeyDown={(e) => {
        const paso = e.shiftKey ? 96 : 24;
        const tarjeta = objetivo.current;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') aplicar(ancho.current + paso, true);
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') aplicar(ancho.current - paso, true);
        else if (e.key === 'Home') aplicar(ANCHO_MINIMO, true);
        else if (e.key === 'End') aplicar(tarjeta ? anchoMaximo(huecoDe(tarjeta)) : ANCHO_BASE, true);
        else return;
        e.preventDefault();
      }}
    />
  );
}
