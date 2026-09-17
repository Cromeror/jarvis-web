import { useCallback, useEffect, useState } from 'react';

/**
 * El port de `shell/theme.js`, con la misma arquitectura de TRES estados.
 *
 * `auto` no es la ausencia de elección: es una elección, y sigue al sistema en
 * vivo. Un hook de dos posiciones la destruye en el primer clic y no hay forma
 * de volver — por eso el conmutador del template es un segmentado de tres y no
 * un interruptor de sol y luna.
 *
 * Es el ÚNICO dueño de `data-theme` en el `<html>`. Por eso la isla `theme.js`
 * del template no se importa: dos dueños del mismo atributo es el bug, no la
 * redundancia. Ningún componente conoce un color; todo sale de tokens.css.
 */

export type Tema = 'auto' | 'light' | 'dark';

const KEY = 'sw.theme';

function leer(): Tema {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'auto';
  } catch {
    /* file://, modo privado o cookies bloqueadas. El tema es una comodidad,
       nunca una razón para romper. */
    return 'auto';
  }
}

export function useTheme(): { choice: Tema; resolved: 'light' | 'dark'; set: (v: Tema) => void } {
  const [choice, setChoice] = useState<Tema>(leer);
  const [system, setSystem] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  /* `auto` sigue al SO EN VIVO: si el sistema cambia con la app abierta, la app
     cambia. Sin este listener, `auto` sería "lo que el SO decía cuando cargó la
     página", que no es lo mismo. */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent): void => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
    try {
      if (choice === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* sin persistencia: la elección dura la sesión */
    }
  }, [choice]);

  const set = useCallback((v: Tema) => setChoice(v), []);

  return { choice, resolved: choice === 'auto' ? system : choice, set };
}
