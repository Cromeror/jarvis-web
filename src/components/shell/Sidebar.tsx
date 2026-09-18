import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { useAuth } from '../../hooks/useAuth.js';
import {
  superficiesDe,
  superficieDeLaRuta,
  type ModuloDeMenu,
  type Superficie,
} from '../../lib/superficies-del-riel.js';

/**
 * EL SIDEBAR DE DOS NIVELES del template (`shell/sidebar.js`).
 *
 *   nivel 1 · riel     elige superficie
 *   nivel 2 · panel    los objetos de esa superficie
 *
 * VA TODO EN UN COMPONENTE, igual que allá, porque el estado es compartido: los
 * niveles se dibujan a partir de una clase sobre `.sw-side` —`is-collapsed`— y
 * partirlo obligaría a subir ese estado igual, con la anatomía repartida en dos
 * archivos.
 *
 * EL COMPORTAMIENTO DEL RIEL, tal cual el template:
 *
 *  · HAY SUPERFICIES QUE ENTRAN DIRECTO (`directa`): el riel las abre sin
 *    desplegar el nivel 2, porque su lista no son objetos que haya que elegir
 *    sino la pantalla misma — ya es el destino.
 *  · LA MISMA SUPERFICIE sólo alterna colapsado/expandido — nunca recarga.
 *  · OTRA SUPERFICIE navega y deja el nivel 2 desplegado, salvo que sea directa.
 *
 * Y la escalera de Escape es la de allá, escalón por escalón: primero limpia la
 * búsqueda, después pliega el panel, y al final suelta el foco — toda escalera
 * de escape necesita un último escalón, o el teclado queda atrapado.
 *
 * EL RIEL NO ES UNA LISTA FIJA, y son DOS rieles disjuntos: el cliente ve sus
 * suites y nada más; el operador, la maquinaria del producto y la
 * administración. La regla vive en `superficiesDe()` — acá sólo se dibuja.
 *
 * EL NIVEL 3 YA NO EXISTE. Tuvo dos inquilinos y ninguno quedó: las
 * conversaciones de un proyecto (el proyecto dejó de ser un objeto que se
 * navegue) y las herramientas de un módulo, que se mudaron a la pestaña
 * «Herramientas» de la columna derecha — que es LA caja de herramientas de la
 * superficie, así que es donde le toca estar. El markup del detalle se fue
 * con ellos: un tercer nivel que nunca abre es peor que dos que sí.
 */

export function Sidebar({ children }: { children?: React.ReactNode }): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { projectId, suites } = useActiveProject();

  const sideRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);

  /* Arranca colapsado, como el template: la superficie no despliega su lista
     hasta que alguien la pide. */
  const [collapsed, setCollapsed] = useState(true);
  const [query, setQuery] = useState('');

  const superficies = superficiesDe({
    suites,
    projectId,
    esOperador: user?.account_type === 'operator',
  });
  /* El riel de un cliente sin suites habilitadas queda VACÍO, y entonces no
     hay superficie que describir: el panel se dibuja igual pero sin rótulo de
     nada, porque no hay nada de lo que sea la lista. */
  const def: Superficie | null = superficieDeLaRuta(pathname, superficies) ?? null;
  const enHerramientas = superficies.filter((s) => !s.alPie);
  const enPie = superficies.filter((s) => s.alPie);

  /* La inercia es lo que impide que el teclado entre en un nivel plegado: sin
     esto, Tab recorre una lista que no se ve. */
  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = collapsed;
  }, [collapsed]);

  /* La pastilla viaja entre ítems en vez de aparecer en cada uno. */
  const llevarA = useCallback((el: HTMLElement) => {
    const rail = railRef.current;
    const ghost = ghostRef.current;
    if (!rail || !ghost) return;
    ghost.style.transform = `translateY(${el.getBoundingClientRect().top - rail.getBoundingClientRect().top}px)`;
    rail.classList.add('is-tracking');
  }, []);
  const descansar = useCallback(() => railRef.current?.classList.remove('is-tracking'), []);

  /* ESTE ES EL ÚNICO LUGAR QUE CAMBIA DE SUPERFICIE. Si alguien navegara por su
     cuenta, cambiaría la pantalla pero no la marca del riel ni la lista: la
     superficie quedaría partida en dos mitades que dicen cosas distintas. */
  function irA(s: Superficie): void {
    setQuery('');
    /* Va DESPUÉS de elegir la superficie: una directa entra con el nivel 2
       plegado, el resto lo despliega. */
    setCollapsed(!!s.directa);
    descansar();
    navigate(s.to);
  }

  function clicEnRiel(s: Superficie): void {
    // La MISMA superficie sólo alterna colapsado/expandido — nunca recarga.
    if (s.id === def?.id) {
      setCollapsed((c) => !c);
      return;
    }
    irA(s);
  }

  /* Un módulo no tiene nivel 3: elegirlo ES entrar. Lo que hay adentro se
     muestra en la caja de herramientas de la columna derecha. */
  function elegirModulo(m: ModuloDeMenu): void {
    navigate(m.id);
  }

  /* La escalera de Escape, escalón por escalón. Va en el componente y no en el
     documento para no pisarle el Esc a otra cosa —el compositor del chat, por
     ejemplo—, así que sólo actúa si el foco está adentro. */
  function alTeclado(e: React.KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (query) {
      setQuery('');
      return;
    }
    if (!collapsed) {
      setCollapsed(true);
      railRef.current?.querySelector<HTMLElement>('.sw-side__i.is-on')?.focus();
      return;
    }
    // Último escalón: no queda nada abierto, así que Esc suelta el componente.
    if (railRef.current?.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  function flechasEnRiel(e: React.KeyboardEvent): void {
    const items = Array.from(railRef.current?.querySelectorAll<HTMLElement>('.sw-side__i') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    let n: number | null = null;
    if (e.key === 'ArrowDown') n = (i + 1) % items.length;
    if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
    if (n === null) return;
    e.preventDefault();
    items[n]?.focus();
  }

  const modulos = def?.modulos ?? [];
  const modulosFiltrados = modulos.filter((m) =>
    m.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const itemDelRiel = (s: Superficie): React.ReactElement => {
    const on = s.id === def?.id;
    return (
      <button
        type="button"
        className={`sw-side__i${on ? ' is-on' : ''}`}
        /* El globo lo pinta el CSS con `content: attr(data-n)`. No es
           `title`: el globo nativo aparecería encima del nuestro. */
        data-n={s.label}
        aria-current={on ? 'page' : undefined}
        aria-expanded={s.directa ? undefined : on && !collapsed}
        tabIndex={on ? 0 : -1}
        onPointerEnter={(e) => llevarA(e.currentTarget)}
        onFocus={(e) => llevarA(e.currentTarget)}
        onClick={() => clicEnRiel(s)}
      >
        <Icon name={s.icono} />
        <span className="sw-side__t">{s.label}</span>
      </button>
    );
  };

  return (
    <div className={`sw-side${collapsed ? ' is-collapsed' : ''}`} ref={sideRef} onKeyDown={alTeclado}>
      {/* ── nivel 1 · riel ───────────────────────────────────────────── */}
      <nav
        className="sw-side__rail"
        aria-label="Superficies"
        ref={railRef}
        onPointerLeave={descansar}
        onKeyDown={flechasEnRiel}
        onBlur={(e) => {
          if (!railRef.current?.contains(e.relatedTarget as Node)) descansar();
        }}
      >
        {/* La marca NO es un ítem: no es botón, no toma foco, no entra en el
            recorrido con flechas ni en la pastilla. Por eso va antes del <ul>. */}
        <div className="sw-side__logo" aria-hidden="true">
          <Icon name="logo" />
        </div>

        <ul className="sw-side__ritems">
          {enHerramientas.map((s) => (
            <li key={s.id}>{itemDelRiel(s)}</li>
          ))}
        </ul>

        <div className="sw-side__foot">
          {enPie.map((s) => (
            <React.Fragment key={s.id}>{itemDelRiel(s)}</React.Fragment>
          ))}
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

      {/* ── nivel 2 · panel de lista ─────────────────────────────────── */}
      <aside className="sw-side__panel" aria-label={def?.label ?? 'Sin superficie'} ref={panelRef}>
        <div className="sw-side__search">
          <span className="sw-side__sicon">
            <Icon name="search" />
          </span>
          <input
            ref={buscadorRef}
            type="search"
            placeholder="Buscar"
            aria-label={`Buscar en ${def?.label ?? 'el menú'}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="sw-side__filtro"
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
            aria-label="Filtrar y ordenar"
          />
        </div>

        <div className="sw-side__list" role="list">
          {modulosFiltrados.length > 0 ? (
            modulosFiltrados.map((m) => (
              <button
                key={m.id}
                className={`sw-side__c${pathname === m.id ? ' is-sel' : ''}`}
                type="button"
                role="listitem"
                data-n={m.name}
                title={m.name}
                onClick={() => elegirModulo(m)}
              >
                <span className="sw-side__ct">
                  <span className="sw-side__cn">{m.name}</span>
                </span>
                {m.description ? (
                  <span className="sw-side__cm">
                    <span>{m.description}</span>
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="sw-side__empty">
              {query
                ? `Nada que coincida con «${query}»`
                : /* Una superficie directa no despliega el panel, así que este
                     vacío es el de la suite sin módulos. */
                  `Sin ${def?.unidad ?? 'objetos'}s todavía`}
              <br />
              Probá con otro nombre.
            </p>
          )}
        </div>

        <div className="sw-side__pager" />
        <div className="sw-side__veil" aria-hidden="true" />
      </aside>

      {/* El popover de filtros vive FUERA del panel: el panel recorta, y un
          popover adentro se cortaría contra su borde. */}
      <div className="sw-pop" role="dialog" aria-label="Filtrar y ordenar" />

      {/* El área de trabajo es hermana de los niveles, no hija: `.sw-side` es el
          marco de todo. */}
      {children}
    </div>
  );
}
