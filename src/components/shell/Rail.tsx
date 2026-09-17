import React, { useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../Icon.js';

/**
 * NIVEL 1 DEL SIDEBAR — el riel que elige superficie.
 *
 * El markup sale de `shell/sidebar.js` del template y no es libre: el CSS
 * selecciona por descendencia y por clase exacta. En particular
 *
 *  · la marca va ANTES del `<ul>` y no adentro — no es un ítem: no es botón, no
 *    toma foco, no participa del recorrido con flechas ni de la pastilla.
 *    `aria-hidden` porque el nombre del producto ya está en otro lado.
 *  · el nombre de cada ítem viaja en `data-n`, que el CSS pinta como globo con
 *    `content: attr(data-n)`. No es `title`: el globo nativo del navegador
 *    aparecería encima del nuestro, con otro aspecto y otro tiempo de espera.
 *  · `.sw-side__ghost` es UNA pastilla que viaja entre ítems, en vez de una que
 *    aparece en cada uno.
 *
 * Las superficies son las de esta app, no las del template: el riel es el
 * chasis, lo que cuelga de él es nuestro.
 */

type Superficie = { to: string; icono: string; label: string; exacta?: boolean };

const SUPERFICIES: Superficie[] = [
  { to: '/', icono: 'grid', label: 'Dashboard', exacta: true },
  { to: '/chat', icono: 'mensajes', label: 'Chat' },
  { to: '/plans', icono: 'listaCheck', label: 'Planes' },
  { to: '/environments', icono: 'cubo', label: 'Environments' },
  { to: '/workspaces', icono: 'folder', label: 'Workspaces' },
  { to: '/catalogo', icono: 'lista', label: 'Catálogo' },
  { to: '/users', icono: 'users', label: 'Usuarios' },
];

export function Rail(): React.ReactElement {
  const railRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const { pathname } = useLocation();

  /* La pastilla viaja: se la lleva al ítem que recibe el puntero o el foco, y
     descansa al salir del riel. Es la misma cuenta del template —la distancia
     entre el tope del ítem y el del riel—, hecha contra el DOM porque depende
     de la posición pintada, no del estado. */
  const llevarA = useCallback((el: HTMLElement) => {
    const rail = railRef.current;
    const ghost = ghostRef.current;
    if (!rail || !ghost) return;
    const a = rail.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    ghost.style.transform = `translateY(${b.top - a.top}px)`;
    rail.classList.add('is-tracking');
  }, []);

  const descansar = useCallback(() => {
    railRef.current?.classList.remove('is-tracking');
  }, []);

  const activa = (s: Superficie): boolean =>
    s.exacta ? pathname === s.to : pathname === s.to || pathname.startsWith(`${s.to}/`);

  return (
    <nav
      className="sw-side__rail"
      aria-label="Superficies"
      ref={railRef}
      onPointerLeave={descansar}
      onBlur={(e) => {
        if (!railRef.current?.contains(e.relatedTarget as Node)) descansar();
      }}
    >
      <div className="sw-side__logo" aria-hidden="true">
        <Icon name="logo" />
      </div>

      <ul className="sw-side__ritems">
        {SUPERFICIES.map((s) => {
          const on = activa(s);
          return (
            <li key={s.to}>
              <NavLink
                to={s.to}
                className={`sw-side__i${on ? ' is-on' : ''}`}
                data-n={s.label}
                aria-current={on ? 'page' : undefined}
                /* Sólo el activo queda en el orden de tabulación: el riel se
                   recorre con flechas, como cualquier lista de navegación. */
                tabIndex={on ? 0 : -1}
                onPointerEnter={(e) => llevarA(e.currentTarget)}
                onFocus={(e) => llevarA(e.currentTarget)}
              >
                <Icon name={s.icono} />
                <span className="sw-side__t">{s.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div className="sw-side__foot">
        <button
          className="sw-side__i"
          type="button"
          tabIndex={-1}
          data-n="Ajustes"
          onPointerEnter={(e) => llevarA(e.currentTarget)}
          onFocus={(e) => llevarA(e.currentTarget)}
        >
          <Icon name="sliders" />
          <span className="sw-side__t">Ajustes</span>
        </button>
      </div>

      <span className="sw-side__ghost" aria-hidden="true" ref={ghostRef} />
    </nav>
  );
}
