import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon.js';

/**
 * PORT FIEL de `createMenu` + `showContextMenu` (`src/shell/menus.js` del
 * template SpaceMyWork).
 *
 * No es una reinterpretación: mismos nombres de clase, misma estructura de DOM,
 * mismos umbrales. Lo único que cambia es que el nodo lo emite React en vez de
 * `document.createElement`.
 *
 * Su encabezado original explica por qué existe, y aplica igual acá:
 *
 * > El Menu resuelve el INDICADOR DESLIZANTE: el resaltado de hover es una
 * > única píldora que viaja entre items en lugar de aparecer y desaparecer.
 * > **Se resuelve una vez acá; ningún consumidor lo reimplementa.**
 *
 * ## Lo que se pierde al escribir un `.sw-menu` a mano
 *
 * Todo esto estaba en `menus.js` y no en el CSS, así que un markup hecho contra
 * la hoja de estilos lo pierde entero y el menú «no se ve igual» sin que se
 * pueda señalar qué falta:
 *
 * - **La duración del viaje escala con la distancia** (`travelDuration`): 0 /
 *   130 / 180 / 240 / 300 ms según cuántos píxeles recorra. Es doctrina de
 *   motion declarada por el corpus — «los elementos que recorren más camino
 *   tardan más»—, no un detalle: con una duración fija, saltar un item y cruzar
 *   el menú entero tardan lo mismo y el movimiento se lee mal.
 * - **`data-active` en el item**, que es de donde sale su color (`.sw-menu__item[data-active="true"]`).
 *   Sin eso el item bajo la píldora no se aclara.
 * - **`offsetTop`/`offsetHeight`**, no `getBoundingClientRect()`: son relativos
 *   al menú, así que ya contemplan su scroll sin hacer cuentas.
 * - **`lastY = null` al salir con el puntero**, para que al volver aparezca sin
 *   viajar desde donde estaba.
 * - **Grupos** (`.sw-menu__group`): el separador del CSS cuelga de
 *   `.sw-menu__group + .sw-menu__group`, así que sin el envoltorio nunca hay
 *   separadores.
 * - **El reencuadre del contextual**: si no entra abajo o a la derecha, se abre
 *   hacia el otro lado y el origen de la animación sigue al punto de
 *   invocación.
 */

/** Los umbrales espejan `--sw-d-*` de tokens.css. Verbatim de `menus.js`. */
function travelDuration(px: number): number {
  const d = Math.abs(px);
  if (d < 4) return 0; // no se movió
  if (d < 40) return 130;
  if (d < 100) return 180;
  if (d < 220) return 240;
  return 300;
}

export interface ItemDeMenu {
  id: string;
  label: string;
  icon?: string;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Presente (aunque sea `false`) = el item es un `menuitemcheckbox`. */
  checked?: boolean;
}

export interface GrupoDeMenu {
  items: ItemDeMenu[];
}

export interface EspecDeMenu {
  groups: GrupoDeMenu[];
  onSelect?: (id: string) => void;
}

/**
 * El menú en sí. Se usa suelto (anclado por el consumidor) o dentro de
 * `MenuContextual`, igual que `createMenu` en el template.
 */
export function Menu({ groups, onSelect }: EspecDeMenu): React.ReactElement {
  const raizRef = useRef<HTMLDivElement>(null);
  const ultimaY = useRef<number | null>(null);
  const [hot, setHot] = useState(false);
  const [warp, setWarp] = useState(true);
  const [pill, setPill] = useState<{ y: number; h: number; d: number }>({ y: 0, h: 0, d: 0 });
  const [activo, setActivo] = useState<string | null>(null);

  /** `moveTo` de `menus.js`, literal. */
  const moverA = useCallback((el: HTMLElement, id: string) => {
    const y = el.offsetTop;
    const h = el.offsetHeight;
    if (ultimaY.current === null) {
      // Primera aparición: colocar sin animar, si no entra volando desde el
      // borde superior y se lee como un glitch.
      setWarp(true);
      setPill({ y, h, d: 0 });
    } else {
      setWarp(false);
      setPill({ y, h, d: travelDuration(y - ultimaY.current) });
    }
    setHot(true);
    ultimaY.current = y;
    setActivo(id);
  }, []);

  const alSalir = useCallback(() => {
    setHot(false);
    setActivo(null);
    ultimaY.current = null; // al volver, aparece sin viajar
  }, []);

  const usables = useCallback(
    (): HTMLElement[] =>
      Array.from(
        raizRef.current?.querySelectorAll<HTMLElement>(
          '.sw-menu__item:not([aria-disabled="true"])',
        ) ?? [],
      ),
    [],
  );

  /* Teclado: flechas mueven la píldora igual que el puntero. Sin vuelta y
     clampeado, como en `menus.js` — no se inventa Home/End ni typeahead. */
  const alTeclado = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const lista = usables();
      const i = lista.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        lista[Math.min(i + 1, lista.length - 1)]?.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        lista[Math.max(i - 1, 0)]?.focus();
      }
    },
    [usables],
  );

  return (
    <div
      ref={raizRef}
      className="sw-menu"
      role="menu"
      data-hot={String(hot)}
      data-warp={String(warp)}
      onPointerLeave={alSalir}
      onKeyDown={alTeclado}
    >
      <div
        className="sw-menu__pill"
        style={
          {
            '--pill-y': `${pill.y}px`,
            '--pill-h': `${pill.h}px`,
            '--pill-d': `${pill.d}ms`,
          } as React.CSSProperties
        }
      />
      {groups.map((g, gi) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="sw-menu__group" key={gi}>
          {g.items.map((it) => {
            /* UN ITEM QUE SE TILDA NO ES UN `menuitem`. Con `checked` el rol es
               `menuitemcheckbox` y lleva `aria-checked`: sin eso un lector de
               pantalla lo anuncia como una acción que se dispara y no como un
               estado que se alterna. El tilde ocupa la ranura del ícono
               —siempre, prendido o apagado— para que las etiquetas queden
               alineadas. (Comentario del template, y por eso está acá.) */
            const tildable = typeof it.checked === 'boolean';
            return (
              <button
                key={it.id}
                type="button"
                className={`sw-menu__item${it.danger ? ' sw-menu__item--danger' : ''}`}
                role={tildable ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={tildable ? it.checked : undefined}
                aria-disabled={it.disabled ? 'true' : undefined}
                data-id={it.id}
                data-active={String(activo === it.id)}
                onPointerEnter={(e) => moverA(e.currentTarget, it.id)}
                onFocus={(e) => moverA(e.currentTarget, it.id)}
                onClick={() => {
                  if (it.disabled) return;
                  onSelect?.(it.id);
                }}
              >
                {tildable ? (
                  <span className="sw-menu__tilde">
                    <Icon name="check" />
                  </span>
                ) : it.icon ? (
                  <Icon name={it.icon} />
                ) : null}
                <span className="sw-menu__label">{it.label}</span>
                {it.kbd ? <span className="sw-menu__kbd">{it.kbd}</span> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export interface MenuContextualProps extends EspecDeMenu {
  /** El punto de invocación, en coordenadas de ventana. */
  x: number;
  y: number;
  onCerrar: () => void;
}

/**
 * `showContextMenu(x, y, spec)`: el menú anclado a un punto, con reencuadre.
 *
 * Va en un portal al `<body>` porque en el template se hace `document.body.appendChild`
 * — y por la misma razón práctica: el ancla suele estar dentro de algo que
 * recorta (el encabezado de una tabla con scroll), y ahí un popover en el flujo
 * se corta contra el borde.
 *
 * Cierra con Escape, con un clic afuera y al cambiar el tamaño de la ventana,
 * que son los tres listeners que `menus.js` registra a nivel documento.
 */
export function MenuContextual({
  x,
  y,
  groups,
  onSelect,
  onCerrar,
}: MenuContextualProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; ox: string; oy: string } | null>(null);

  /* Reencuadre: si no entra abajo o a la derecha, se abre hacia el otro lado.
     En layout y no en effect: medir después de pintar haría que el menú
     aparezca un frame en el lugar equivocado. */
  useLayoutEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const flipX = x + r.width > window.innerWidth - 8;
    const flipY = y + r.height > window.innerHeight - 8;
    setPos({
      left: flipX ? Math.max(8, x - r.width) : x,
      top: flipY ? Math.max(8, y - r.height) : y,
      ox: flipX ? '100%' : '0',
      oy: flipY ? '100%' : '0',
    });
    /* El primero USABLE, no el primero a secas: un item deshabilitado dejaba el
       menú abierto con el foco en algo que no responde ni al Enter ni a las
       flechas. */
    w.querySelector<HTMLElement>('.sw-menu__item:not([aria-disabled="true"])')?.focus();
  }, [x, y]);

  useEffect(() => {
    const afuera = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) onCerrar();
    };
    const escape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar();
    };
    // En captura, igual que el template: un handler que detiene la propagación
    // en el medio no puede impedir que el menú se cierre.
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', onCerrar);
    return () => {
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', onCerrar);
    };
  }, [onCerrar]);

  return createPortal(
    <div
      ref={wrapRef}
      className="sw-context"
      style={
        {
          left: pos?.left ?? x,
          top: pos?.top ?? y,
          '--origin-x': pos?.ox ?? '0',
          '--origin-y': pos?.oy ?? '0',
          // Hasta medir, invisible: un frame en el lugar equivocado se ve.
          visibility: pos ? 'visible' : 'hidden',
        } as React.CSSProperties
      }
    >
      <Menu
        groups={groups}
        onSelect={(id) => {
          // El contextual cierra al elegir; quien quiera reabrirlo lo hace
          // desde su `onSelect`, como `abrirAjustes` en table.js.
          onCerrar();
          onSelect?.(id);
        }}
      />
    </div>,
    document.body,
  );
}
