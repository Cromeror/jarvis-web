import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon.js';
import { listProjects, type ProjectSummary } from '../../lib/projects-api.js';

/**
 * EL SIDEBAR DE TRES NIVELES del template (`shell/sidebar.js`).
 *
 *   nivel 1 · riel     elige superficie
 *   nivel 2 · panel    los objetos de esa superficie
 *   nivel 3 · detalle  lo que hay dentro del objeto elegido
 *
 * VA TODO EN UN COMPONENTE, igual que allá, porque el estado es compartido: los
 * tres niveles se dibujan a partir de DOS clases sobre `.sw-side` —`is-collapsed`
 * y `is-open`— y partirlo obligaría a subir ese estado igual, con la anatomía
 * repartida en tres archivos.
 *
 * EL COMPORTAMIENTO DEL RIEL, tal cual el template:
 *
 *  · HAY SUPERFICIES QUE ENTRAN DIRECTO (`directa`): el riel las abre sin
 *    desplegar el nivel 2, porque su lista no son objetos que haya que elegir
 *    sino la pantalla misma — ya es el destino. Acá son las que no llevan
 *    proyecto en la ruta, que es la misma distinción que ya hacía
 *    `useActiveProject` con `CON_PROYECTO`.
 *  · LA MISMA SUPERFICIE sólo alterna colapsado/expandido — nunca recarga.
 *  · OTRA SUPERFICIE navega y deja el nivel 2 desplegado, salvo que sea directa.
 *
 * Y la escalera de Escape es la de allá, escalón por escalón: cierra el detalle,
 * después limpia la búsqueda, después pliega el panel, y al final suelta el foco
 * — toda escalera de escape necesita un último escalón, o el teclado queda
 * atrapado.
 */

type Superficie = {
  to: string;
  icono: string;
  label: string;
  exacta?: boolean;
  /** Sin nivel 2: la pantalla ya es el destino. */
  directa?: boolean;
  /** Qué lista el nivel 2, para el rótulo del vacío. */
  unidad?: string;
};

const SUPERFICIES: Superficie[] = [
  { to: '/', icono: 'grid', label: 'Dashboard', exacta: true, directa: true },
  { to: '/chat', icono: 'mensajes', label: 'Chat', unidad: 'proyecto' },
  { to: '/plans', icono: 'listaCheck', label: 'Planes', unidad: 'proyecto' },
  { to: '/environments', icono: 'cubo', label: 'Environments', unidad: 'proyecto' },
  { to: '/workspaces', icono: 'folder', label: 'Workspaces', unidad: 'proyecto' },
  { to: '/catalogo', icono: 'lista', label: 'Catálogo', directa: true },
  { to: '/users', icono: 'users', label: 'Usuarios', directa: true },
];

function indiceDeLaRuta(pathname: string): number {
  const i = SUPERFICIES.findIndex((s) =>
    s.exacta ? pathname === s.to : pathname === s.to || pathname.startsWith(`${s.to}/`),
  );
  return i < 0 ? 0 : i;
}

export function Sidebar({ children }: { children?: React.ReactNode }): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const sideRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);

  const surf = indiceDeLaRuta(pathname);
  const def = SUPERFICIES[surf];

  /* Arranca colapsado, como el template: la superficie no despliega su lista
     hasta que alguien la pide. */
  const [collapsed, setCollapsed] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [proyectos, setProyectos] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    let vivo = true;
    void listProjects()
      .then((p) => {
        if (vivo) setProyectos(p);
      })
      .catch(() => {
        /* El sidebar no es el lugar para contar un fallo de red: se queda sin
           lista y la superficie sigue navegable desde el riel. */
      });
    return () => {
      vivo = false;
    };
  }, []);

  /* La inercia es lo que impide que el teclado entre en un nivel plegado: sin
     esto, Tab recorre una lista que no se ve. */
  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = collapsed;
    if (detailRef.current) detailRef.current.inert = abierto === null;
  }, [collapsed, abierto]);

  /* La pastilla viaja entre ítems en vez de aparecer en cada uno. */
  const llevarA = useCallback((el: HTMLElement) => {
    const rail = railRef.current;
    const ghost = ghostRef.current;
    if (!rail || !ghost) return;
    ghost.style.transform = `translateY(${el.getBoundingClientRect().top - rail.getBoundingClientRect().top}px)`;
    rail.classList.add('is-tracking');
  }, []);
  const descansar = useCallback(() => railRef.current?.classList.remove('is-tracking'), []);

  function cerrarDetalle(): void {
    setAbierto(null);
  }

  /* ESTE ES EL ÚNICO LUGAR QUE CAMBIA DE SUPERFICIE. Si alguien navegara por su
     cuenta, cambiaría la pantalla pero no la marca del riel ni la lista: la
     superficie quedaría partida en dos mitades que dicen cosas distintas. */
  function irA(i: number): void {
    const s = SUPERFICIES[i];
    if (!s) return;
    setAbierto(null);
    setQuery('');
    /* Va DESPUÉS de elegir la superficie: una directa entra con el nivel 2
       plegado, el resto lo despliega. */
    setCollapsed(!!s.directa);
    descansar();
    navigate(s.to);
  }

  function clicEnRiel(i: number): void {
    // La MISMA superficie sólo alterna colapsado/expandido — nunca recarga.
    if (i === surf) {
      if (abierto !== null) {
        cerrarDetalle();
        setCollapsed(false);
        return;
      }
      setCollapsed((c) => !c);
      return;
    }
    irA(i);
  }

  function elegirProyecto(p: ProjectSummary): void {
    navigate(`${def.to}/${p.id}`);
    /* Nivel 3 sólo si hay algo adentro. Si el objeto no tiene nada que mostrar,
       elegirlo ES navegar — no se abre un panel vacío. */
    setAbierto(p.recent_chats.length > 0 ? p.id : null);
  }

  /* La escalera de Escape, escalón por escalón. Va en el componente y no en el
     documento para no pisarle el Esc a otra cosa —el compositor del chat, por
     ejemplo—, así que sólo actúa si el foco está adentro. */
  function alTeclado(e: React.KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (abierto !== null) {
      cerrarDetalle();
      return;
    }
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

  const filtrados = proyectos.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const elegido = proyectos.find((p) => p.id === abierto) ?? null;

  return (
    <div
      className={`sw-side${collapsed ? ' is-collapsed' : ''}${abierto !== null ? ' is-open' : ''}`}
      ref={sideRef}
      onKeyDown={alTeclado}
    >
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
          {SUPERFICIES.map((s, i) => {
            const on = i === surf;
            return (
              <li key={s.to}>
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
                  onClick={() => clicEnRiel(i)}
                >
                  <Icon name={s.icono} />
                  <span className="sw-side__t">{s.label}</span>
                </button>
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

      {/* ── nivel 2 · panel de lista ─────────────────────────────────── */}
      <aside className="sw-side__panel" aria-label={def.label} ref={panelRef}>
        <div className="sw-side__search">
          <span className="sw-side__sicon">
            <Icon name="search" />
          </span>
          <input
            ref={buscadorRef}
            type="search"
            placeholder="Buscar"
            aria-label={`Buscar en ${def.label}`}
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
          {filtrados.length > 0 ? (
            filtrados.map((p) => (
              <button
                key={p.id}
                className={`sw-side__c${abierto === p.id ? ' is-sel' : ''}`}
                type="button"
                role="listitem"
                data-n={p.name}
                title={p.name}
                onClick={() => elegirProyecto(p)}
              >
                <span className="sw-side__ct">
                  <span className="sw-side__cn">{p.name}</span>
                  {p.status ? (
                    <span className="sw-side__b sw-side__b--ok">{p.status}</span>
                  ) : null}
                </span>
                <span className="sw-side__cm">
                  <span>{p.sector ?? ''}</span>
                  <span>{p.chats_count ? `${p.chats_count} chats` : ''}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="sw-side__empty">
              {query ? `Nada que coincida con «${query}»` : `Sin ${def.unidad ?? 'objetos'}s todavía`}
              <br />
              Probá con otro nombre.
            </p>
          )}
        </div>

        <div className="sw-side__pager" />
        <div className="sw-side__veil" aria-hidden="true" />
      </aside>

      {/* ── nivel 3 · detalle ────────────────────────────────────────── */}
      <section className="sw-side__detail" aria-label="Detalle" ref={detailRef}>
        {/* La flecha vuelve UN paso, no siempre al principio. */}
        <button
          className="sw-side__tab"
          type="button"
          aria-label="Cerrar el detalle"
          onClick={cerrarDetalle}
        >
          <Icon name="left" />
        </button>
        <div className="sw-side__dveil" aria-hidden="true" />
        {elegido ? (
          <div className="sw-side__dwrap">
            <div className="sw-side__dhead">
              <div className="sw-side__dt">
                <h3 title={elegido.name}>{elegido.name}</h3>
                <p>{def.label}</p>
              </div>
            </div>
            <div className="sw-side__dbody sw-side__dlista" role="list">
              {elegido.recent_chats.map((c) => (
                <button
                  key={c.id}
                  className="sw-side__c"
                  type="button"
                  role="listitem"
                  data-n={c.title ?? 'Sin título'}
                  title={c.title ?? 'Sin título'}
                  onClick={() => navigate(`/chat/${elegido.id}/${c.id}`)}
                >
                  <span className="sw-side__ct">
                    <span className="sw-side__cn">{c.title ?? 'Sin título'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* El popover de filtros vive FUERA del panel: el panel recorta, y un
          popover adentro se cortaría contra su borde. */}
      <div className="sw-pop" role="dialog" aria-label="Filtrar y ordenar" />

      {/* El área de trabajo es hermana de los tres niveles, no hija: `.sw-side`
          es el marco de todo. */}
      {children}
    </div>
  );
}
