import { useEffect, useRef, useState } from 'react';

/**
 * El port del `tipeo()` de `auth/login.js`: una frase por vez — se escribe, se
 * queda, se borra y sigue la otra.
 *
 * LOS TIEMPOS son los del template, y cada uno tiene su razón: 55 ms por tecla
 * MÁS UN POCO DE AZAR, porque una cadencia exacta se lee como máquina y no como
 * alguien escribiendo; 2600 con la frase entera, que alcanza para leer la más
 * larga sin apuro; el borrado bastante más rápido, porque ya se leyó; y un
 * respiro con el renglón vacío antes de la siguiente.
 *
 * LA ESTRUCTURA ES LA DEL TEMPLATE y no una traducción a hooks, por dos cosas
 * que se rompieron al intentarlo:
 *
 *  · El paso siguiente se agenda DENTRO del anterior (`seguir`), no se deriva
 *    del estado. Con el avance en un `useRef` y el efecto dependiendo de él, el
 *    final de la escritura no cambiaba ningún estado —sólo un ref—, así que el
 *    efecto no se volvía a disparar y la animación se congelaba en la primera
 *    frase.
 *  · El efecto depende SÓLO de `activo` y `frases`. Dependiendo del avance, un
 *    re-render cualquiera —escribir en el formulario, Bloq Mayús— reiniciaba el
 *    temporizador, y con él la espera de 2600 ms de la frase completa.
 *
 * El avance vive en un ref y sobrevive a la pausa: al reanudar sigue donde
 * estaba, igual que el `pausar()`/`reanudar()` del template.
 *
 * Devuelve la frase partida en `escrito` + `falta`. Lo que falta se pinta
 * invisible, y ahí está el truco: el renglón se diagrama con la frase COMPLETA
 * desde el principio, así no se mueve mientras se tipea. Centrado, cada letra
 * nueva lo correría hacia los dos lados, y al pasar a dos renglones el primero
 * saltaría.
 */

export const TECLA = 55;
export const AZAR = 35;
export const BORRA = 22;
export const LLENA = 2600;
export const VACIA = 450;

/** Dónde va la animación: qué frase, cuántas letras, y si está borrando. */
export type Avance = { i: number; n: number; borrando: boolean };

/**
 * UN PASO de la máquina, puro: el avance nuevo y cuánto esperar hasta el
 * siguiente. Está afuera del hook para poder compararlo contra el `paso()` del
 * template sin montar React — que es como se descubrió que la primera versión
 * no hacía lo mismo.
 *
 * El texto NO viaja acá porque se deriva del avance: `frases[i]` partida en `n`.
 * Por eso el paso que sólo marca `borrando` no cambia lo que se ve —`i` y `n`
 * quedan igual—, que es exactamente lo que hace el template: la frase entera se
 * queda quieta sus 2600 ms.
 */
export function avanzar(
  a: Avance,
  frases: string[],
  azar: () => number = Math.random,
): { avance: Avance; demora: number } {
  const f = frases[a.i] ?? '';
  if (!a.borrando) {
    if (a.n < f.length) return { avance: { ...a, n: a.n + 1 }, demora: TECLA + azar() * AZAR };
    return { avance: { ...a, borrando: true }, demora: LLENA };
  }
  if (a.n > 0) return { avance: { ...a, n: a.n - 1 }, demora: BORRA };
  return { avance: { i: (a.i + 1) % frases.length, n: 0, borrando: false }, demora: VACIA };
}

/** Lo que se ve, derivado del avance. */
export function partir(a: Avance, frases: string[]): { escrito: string; falta: string } {
  const f = frases[a.i] ?? '';
  return { escrito: f.slice(0, a.n), falta: f.slice(a.n) };
}

export function useTipeo(frases: string[], activo: boolean): { escrito: string; falta: string } {
  const [txt, setTxt] = useState<{ escrito: string; falta: string }>(() => ({
    escrito: '',
    falta: frases[0] ?? '',
  }));
  const avance = useRef({ i: 0, n: 0, borrando: false });
  const timer = useRef(0);

  useEffect(() => {
    if (!activo || frases.length === 0) return;

    const pintar = (): void => setTxt(partir(avance.current, frases));

    const seguir = (ms: number): void => {
      clearTimeout(timer.current);
      timer.current = window.setTimeout(paso, ms);
    };

    function paso(): void {
      const { avance: siguiente, demora } = avanzar(avance.current, frases);
      avance.current = siguiente;
      pintar();
      seguir(demora);
    }

    pintar();
    seguir(TECLA);
    return () => clearTimeout(timer.current);
  }, [activo, frases]);

  return txt;
}
