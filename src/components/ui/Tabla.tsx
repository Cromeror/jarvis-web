import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon.js';
import { MenuContextual, type GrupoDeMenu } from './MenuContextual.js';
import {
  ID_MARCA,
  ID_MENU,
  ordenarFilas,
  repartirAnchos,
  type ColumnaDeTabla,
} from './anchos-de-tabla.js';
import { alternarOculta, idsVisibles, unirColumnas } from './visibilidad-de-columnas.js';
import { TEXTOS_TABLA, rell, ventana, type TextosDeTabla } from './tabla-textos.js';

/**
 * PORT de `montar()` de `src/accounting/table.js` (template SpaceMyWork).
 *
 * Mismas clases, misma estructura de DOM, mismo contrato de opciones. Lo que
 * cambia es quién emite los nodos: React en vez de `innerHTML`. La hoja es
 * `theme/tabla/tabla.css`, **copiada tal cual del template** — no se toca, para
 * poder re-sincronizar.
 *
 * ## Por qué esto existe y no una tabla propia
 *
 * Hubo una tabla propia acá, con `.sw-tabla__th/__td/__fila/__corte` inventados.
 * Ninguna de esas clases existe en el template: su tabla es `.sw-tabla__cont`,
 * `__t`, `__ajustes`, `__ord`, `__cmarca`, `__cmenu`, `__pie`, `__pag`. Dos
 * vocabularios para la misma pieza es exactamente lo que adoptar el template
 * vino a evitar, y además se perdía todo lo que el componente resuelve y el CSS
 * no dice: el reparto de anchos, el orden de tres pasos, la paginación con
 * ventana, la casilla maestra de tres estados.
 *
 * ## Las dos columnas de servicio
 *
 * `__marca` (la casilla) y `__menu` (las acciones) se declaran como cualquier
 * otra, con su ancho de 44px — que es el objetivo táctil de la regla 9 del
 * corpus. **No se agranda el control: se le da la columna.** Y no se pueden
 * esconder: sin ellas la tabla deja de poder seleccionar y de poder actuar.
 *
 * ## `__sobra`: la columna de relleno
 *
 * Queda en cero y existe sólo para que la cantidad de celdas por fila no cambie
 * según qué columnas estén visibles — que es como se corren todas de lugar.
 */

export type { ColumnaDeTabla };

export interface EspecDeTabla<F> {
  /** Nombre accesible de la tabla. */
  titulo?: string;
  columnas: ColumnaDeTabla[];
  filas: F[];
  /** Cómo identificar una fila. */
  clave: (f: F) => string;
  /** Para los nombres accesibles de la casilla y del menú de esa fila. */
  nombreFila?: (f: F) => string;
  /** El dominio pinta la celda; la tabla arma la grilla. */
  celda?: (f: F, c: ColumnaDeTabla) => React.ReactNode;
  /** `false` = sin columna de casillas. */
  seleccion?: boolean;
  puedeElegir?: (f: F) => boolean;
  porPagina?: number;
  opcionesPagina?: number[];
  orden?: { col: string; dir?: 'asc' | 'desc' };
  menuFila?: (f: F) => { groups: GrupoDeMenu[]; onSelect?: (id: string, f: F) => void } | null;
  /**
   * Las que arrancan escondidas.
   *
   * El template arranca con `ocultas` vacío porque sus tablas declaran siete
   * columnas. Ésta declara veinticuatro —salen del extractor— y mostrarlas
   * todas de entrada es ilegible. Es un default del consumidor, no un cambio
   * de comportamiento: el menú sigue siendo el mismo y sigue mandando.
   */
  ocultasInicial?: readonly string[];
  /** Campos que el dato tiene y la tabla no dibuja: alimentan «Agregar una columna…». */
  columnasExtra?: () => ColumnaDeTabla[];
  onAgregarColumna?: (c: ColumnaDeTabla) => void;
  onSeleccionar?: (s: { claves: string[]; total: number }) => void;
  onAbrir?: (f: F) => void;
  onOrdenar?: (o: { col: string; dir: 'asc' | 'desc' } | null) => void;
  onColumnas?: (visibles: string[]) => void;
  /** Pisa los textos del componente (el motivo del vacío es del dominio). */
  textos?: Partial<TextosDeTabla>;
  /** Franja de acciones masivas, debajo del pie y adentro de la card. */
  acciones?: React.ReactNode;
  /**
   * LA BANDA DE CONTROLES, arriba de todo y ADENTRO de la card.
   *
   * La llena quien monta la tabla —en el template son los filtros de
   * Contabilidad— y es opcional: sin ella la banda no se dibuja, no queda una
   * franja vacía. Va acá y no suelta sobre el lienzo por lo que el template
   * tiene medido: los filtros gobiernan ESTA tabla, así que tienen que estar
   * pegados a ella, y sueltos sobre la grilla punteada no tenían fondo contra
   * el cual leerse (su filete daba 1,073:1 contra el lienzo en claro, o sea
   * nada) ni decían de quién eran.
   */
  encabezado?: React.ReactNode;
}

const COL_MARCA: ColumnaDeTabla = { id: ID_MARCA, w: 44, orden: false };
const COL_MENU: ColumnaDeTabla = { id: ID_MENU, w: 44, orden: false };

export function Tabla<F>({
  titulo,
  columnas: columnasDeclaradas,
  filas,
  clave,
  nombreFila,
  celda,
  seleccion = true,
  puedeElegir = () => true,
  porPagina: porPaginaInicial = 100,
  opcionesPagina = [],
  orden: ordenInicial,
  menuFila,
  ocultasInicial,
  columnasExtra,
  onAgregarColumna,
  onSeleccionar,
  onAbrir,
  onOrdenar,
  onColumnas,
  textos,
  acciones,
  encabezado,
}: EspecDeTabla<F>): React.ReactElement {
  const T = useMemo(() => ({ ...TEXTOS_TABLA, ...textos }), [textos]);
  const nombreDe = nombreFila ?? ((f: F) => String(clave(f)));
  const pintarCelda =
    celda ?? ((f: F, c: ColumnaDeTabla) => String((f as Record<string, unknown>)[c.dato ?? c.id] ?? ''));

  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set(ocultasInicial ?? []));
  const [orden, setOrden] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(
    ordenInicial ? { col: ordenInicial.col, dir: ordenInicial.dir ?? 'asc' } : null,
  );
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(porPaginaInicial);
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  /* CUÁL FILA ESTÁ ABIERTA. Es distinto de marcada: marcada es «va a recibir
     una acción masiva», abierta es «su detalle es el que se está mirando al
     lado». Sin esto, la caja mostraba una factura y la tabla no decía cuál. */
  const [abierta, setAbierta] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; de: 'ajustes' | 'mas' | 'fila'; fila?: F } | null>(
    null,
  );
  /* Las que se agregaron desde «Agregar una columna…». Se suman a las
     declaradas, así que a partir de ahí aparecen en el primer menú como una
     tilde más — que es el punto: dejan de ser «qué más hay» y pasan a ser «qué
     de lo que hay quiero ver». */
  const [agregadas, setAgregadas] = useState<ColumnaDeTabla[]>([]);

  const contRef = useRef<HTMLDivElement>(null);
  const maestraRef = useRef<HTMLInputElement>(null);

  /**
   * Las declaradas más las que el usuario agregó, **sin repetir**.
   *
   * El dedupe no es defensivo: es necesario desde que el consumidor puede
   * persistir qué columnas se ven. Al guardar una agregada, vuelve por
   * `columnas` en el render siguiente mientras sigue en `agregadas`, y la
   * columna aparecía dos veces. Gana la declarada —es la que trae el orden que
   * el consumidor decidió— y la copia de `agregadas` se descarta.
   */
  const declaradas = useMemo(
    () => unirColumnas(columnasDeclaradas, agregadas),
    [columnasDeclaradas, agregadas],
  );

  const cols = useMemo(
    () => [...(seleccion ? [COL_MARCA] : []), ...declaradas, ...(menuFila ? [COL_MENU] : [])],
    [seleccion, declaradas, menuFila],
  );
  const vivas = useMemo(() => cols.filter((c) => !ocultas.has(c.id)), [cols, ocultas]);

  // ------------------------------------------------------------ anchos

  const [anchos, setAnchos] = useState<number[]>([]);
  const [minimo, setMinimo] = useState(0);

  const medir = useCallback(() => {
    const hueco = Math.max(0, contRef.current?.clientWidth ?? 0);
    if (!hueco) return;
    const r = repartirAnchos(vivas, hueco);
    setAnchos(r.anchos);
    setMinimo(r.minimo);
  }, [vivas]);

  useLayoutEffect(medir, [medir]);
  useEffect(() => {
    if (!contRef.current) return;
    // El reparto depende del ancho real que hay, así que se recalcula cuando la
    // caja cambia: al abrir o cerrar la columna lateral, al mover el borde.
    const ro = new ResizeObserver(medir);
    ro.observe(contRef.current);
    return () => ro.disconnect();
  }, [medir]);

  // ------------------------------------------------------- datos derivados

  const ordenadas = useMemo(
    () => ordenarFilas(filas, orden ? declaradas.find((c) => c.id === orden.col) : undefined, orden?.dir ?? 'asc'),
    [filas, orden, declaradas],
  );
  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const pagActual = Math.min(Math.max(1, pagina), totalPaginas);
  const visibles = useMemo(
    () => ordenadas.slice((pagActual - 1) * porPagina, pagActual * porPagina),
    [ordenadas, pagActual, porPagina],
  );

  /* TRES ESTADOS Y NO DOS: decir «ninguna» cuando hay tres de cien marcadas es
     mentira, y decir «todas» también. Las filas que no se pueden elegir quedan
     afuera de la cuenta — si entraran, «todas» no podría marcarse nunca. */
  const elegibles = useMemo(() => visibles.filter(puedeElegir).map(clave), [visibles, puedeElegir, clave]);
  const nMarcadas = elegibles.filter((k) => marcadas.has(k)).length;
  useEffect(() => {
    const m = maestraRef.current;
    if (!m) return;
    m.indeterminate = nMarcadas > 0 && nMarcadas < elegibles.length;
  }, [nMarcadas, elegibles.length]);

  const avisar = useCallback(
    (s: Set<string>) => onSeleccionar?.({ claves: [...s], total: filas.length }),
    [onSeleccionar, filas.length],
  );

  // ------------------------------------------------------------- acciones

  function alOrdenar(colId: string): void {
    /* TRES PASOS Y NO DOS: ascendente, descendente y SIN ORDEN. El orden
       original de los datos suele querer decir algo —acá, la fecha en que
       llegaron— y sin el tercer paso no hay forma de volver a él salvo
       recargando. */
    const siguiente =
      !orden || orden.col !== colId
        ? { col: colId, dir: 'asc' as const }
        : orden.dir === 'asc'
          ? { col: colId, dir: 'desc' as const }
          : null;
    setOrden(siguiente);
    onOrdenar?.(siguiente);
  }

  function alternarMarca(k: string, poner: boolean): void {
    const s = new Set(marcadas);
    if (poner) s.add(k);
    else s.delete(k);
    setMarcadas(s);
    avisar(s);
  }

  function alMaestra(poner: boolean): void {
    const s = new Set(marcadas);
    for (const k of elegibles) {
      if (poner) s.add(k);
      else s.delete(k);
    }
    setMarcadas(s);
    avisar(s);
  }

  /* EL MENÚ DE LA TABLA. Las columnas van como `checked`, que es lo que las
     vuelve tildes y no ítems sueltos. EL ÚLTIMO ITEM AGREGA: las declaradas son
     las que el módulo eligió mostrar; los campos que el dato tiene y la tabla no
     dibuja entran por acá. Es la diferencia entre «qué de lo que hay quiero
     ver» y «qué más hay». */
  const gruposDeAjustes = useMemo((): GrupoDeMenu[] => {
    const cols2 = declaradas.map((c) => ({
      id: `col:${c.id}`,
      label: c.label ?? c.id,
      icon: 'table',
      checked: !ocultas.has(c.id),
    }));
    const extra = (columnasExtra?.() ?? []).filter((c) => !declaradas.some((d) => d.id === c.id));
    const grupos: GrupoDeMenu[] = [{ items: cols2 }];
    if (extra.length) grupos.push({ items: [{ id: '__mas', label: T.agregarColumna, icon: 'plus' }] });
    return grupos;
  }, [declaradas, ocultas, columnasExtra, T.agregarColumna]);

  const faltan = useMemo(
    () => (columnasExtra?.() ?? []).filter((c) => !declaradas.some((d) => d.id === c.id)),
    [columnasExtra, declaradas],
  );

  function alElegirAjuste(id: string, ancla: { x: number; y: number }): void {
    if (id === '__mas') {
      /* AGREGAR UNA COLUMNA ES UNA PREGUNTA MÁS: cuál. Va en un SEGUNDO menú y
         no como una lista larga adentro del primero — el primero contesta «qué
         de lo que hay quiero ver» y son siete tildes; meterle abajo diecisiete
         opciones de otra naturaleza lo convierte en una lista de veinticuatro
         cosas que no se parecen.

         Se ancla al MISMO punto, así que sale de donde salió el menú anterior:
         es la continuación de un gesto, no un salto. */
      setMenu({ ...ancla, de: 'mas' });
      return;
    }
    const cid = id.slice(4);
    const s = alternarOculta(ocultas, cid, declaradas.length);
    setOcultas(s);
    onColumnas?.(idsVisibles(declaradas, s));
    /* Se vuelve a abrir en el mismo lugar: la tilde que se acaba de poner tiene
       que quedar a la vista para poder seguir. */
    setMenu({ ...ancla, de: 'ajustes' });
  }

  // ------------------------------------------------------------- el dibujo

  const hayMenuFila = Boolean(menuFila);
  const relleno = <col className="sw-tabla__csobra" style={{ width: 0 }} />;

  function celdaDe(f: F, c: ColumnaDeTabla, k: string): React.ReactNode {
    if (c.id === ID_MARCA) {
      const elegible = puedeElegir(f);
      return (
        <td className="sw-tabla__cmarca" key={c.id}>
          {/* El nombre de la casilla dice QUÉ FILA marca: «casilla» repetida
              cien veces no le sirve a nadie que navegue de a saltos. */}
          <input
            type="checkbox"
            className="input sw-tabla__check"
            checked={marcadas.has(k)}
            disabled={!elegible}
            aria-label={rell(T.marcarFila, { '%s': nombreDe(f) })}
            onChange={(e) => alternarMarca(k, e.currentTarget.checked)}
          />
        </td>
      );
    }
    if (c.id === ID_MENU) {
      return (
        <React.Fragment key={c.id}>
          <td className="sw-tabla__sobra" aria-hidden="true" />
          <td className="sw-tabla__cmenu">
            <button
              type="button"
              className="sw-tabla__puntos sw-touch-target"
              aria-haspopup="menu"
              aria-expanded={menu?.de === 'fila' && menu.fila === f}
              aria-label={rell(T.accionesFila, { '%s': nombreDe(f) })}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ x: r.right, y: r.bottom + 2, de: 'fila', fila: f });
              }}
            >
              <Icon name="puntos" />
            </button>
          </td>
        </React.Fragment>
      );
    }
    /* El globo sólo donde puede haber recorte de verdad: ponerlo en todas las
       celdas llena la pantalla de globos que repiten lo que ya se lee. */
    const bruto = (f as Record<string, unknown>)[c.dato ?? c.id];
    return (
      <td key={c.id} data-al={c.al} title={c.tip ? String(bruto ?? '') : undefined}>
        {pintarCelda(f, c)}
      </td>
    );
  }

  const menuDeFila = menu?.de === 'fila' && menu.fila !== undefined ? menuFila?.(menu.fila) : null;

  return (
    /* `sw-raised` de base.css, como en el template (`raiz.className = 'sw-raised
       sw-tabla'`): la elevación del sistema es un escalón de valor más un filete
       de 1px, y ya está escrita una vez. Sin ella la tabla no tiene card — se le
       ve la grilla punteada del lienzo a través de las filas. */
    <div className="sw-raised sw-tabla">
      {/* La banda sólo existe si hay con qué llenarla — `if (o.encabezado)` en
          `table.js`. Dibujarla vacía deja una franja con su filete separando
          la cabecera de nada. */}
      {encabezado ? <div className="sw-tabla__banda">{encabezado}</div> : null}
      <div className="table-container sw-tabla__cont" ref={contRef}>
        <table
          className="table sw-tabla__t"
          aria-label={titulo ?? T.tabla}
          aria-rowcount={filas.length + 1}
          style={{ ['--sw-tabla-min' as string]: `${minimo}px` }}
        >
          <colgroup>
            {vivas.map((c, k) => (
              <React.Fragment key={c.id}>
                {c.id === ID_MENU ? relleno : null}
                <col style={{ width: anchos[k] ? `${anchos[k]}px` : undefined }} />
              </React.Fragment>
            ))}
            {hayMenuFila ? null : relleno}
          </colgroup>

          <thead>
            <tr>
              {vivas.map((c) => {
                if (c.id === ID_MARCA) {
                  return (
                    <th scope="col" className="sw-tabla__cmarca" key={c.id}>
                      <input
                        ref={maestraRef}
                        type="checkbox"
                        className="input sw-tabla__todos"
                        aria-label={T.marcarPagina}
                        disabled={elegibles.length === 0}
                        checked={elegibles.length > 0 && nMarcadas === elegibles.length}
                        onChange={(e) => alMaestra(e.currentTarget.checked)}
                      />
                    </th>
                  );
                }
                if (c.id === ID_MENU) {
                  return (
                    <React.Fragment key={c.id}>
                      {/* La celda del sobrante es de presentación y no dice
                          nada, así que se esconde del lector: una columna en
                          blanco anunciada es una parada más en un recorrido
                          que ya tiene nueve. */}
                      <td className="sw-tabla__sobra" aria-hidden="true" />
                      <th scope="col" className="sw-tabla__cmenu">
                        {/* LA MISMA COLUMNA, UN NIVEL ARRIBA: por fila el menú
                            de esa fila; en la cabecera, el de la TABLA. Es el
                            lugar natural de lo que la gobierna — un control
                            lejos de lo que controla obliga a cruzar la pantalla
                            para algo que se decide mirando la tabla. */}
                        <button
                          type="button"
                          className="sw-tabla__ajustes sw-touch-target"
                          aria-haspopup="menu"
                          aria-expanded={menu?.de === 'ajustes'}
                          aria-label={T.ajustes}
                          title={T.ajustes}
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu({ x: r.right, y: r.bottom + 2, de: 'ajustes' });
                          }}
                        >
                          <Icon name="puntos" />
                        </button>
                      </th>
                    </React.Fragment>
                  );
                }
                if (c.orden === false) {
                  return (
                    <th scope="col" data-al={c.al} key={c.id}>
                      <span className="sw-tabla__rot">{c.label}</span>
                    </th>
                  );
                }
                const dir = orden?.col === c.id ? orden.dir : null;
                return (
                  <th
                    scope="col"
                    data-al={c.al}
                    key={c.id}
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                  >
                    <button
                      type="button"
                      className="sw-tabla__ord"
                      data-col={c.id}
                      data-dir={dir ?? ''}
                      onClick={() => alOrdenar(c.id)}
                    >
                      <span className="sw-tabla__rot">{c.label}</span>
                      <Icon name={dir === 'asc' ? 'chevronUp' : dir === 'desc' ? 'chevron' : 'ordenar'} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibles.length === 0 ? (
              <tr className="sw-tabla__nada">
                <td colSpan={vivas.length + (hayMenuFila ? 1 : 0)}>
                  <p className="sw-tabla__nadaT">{T.vacio}</p>
                  {T.vacioPaso ? <p className="sw-tabla__nadaP">{T.vacioPaso}</p> : null}
                </td>
              </tr>
            ) : (
              visibles.map((f, i) => {
                const k = clave(f);
                return (
                  <tr
                    key={k}
                    data-k={k}
                    aria-rowindex={(pagActual - 1) * porPagina + i + 2}
                    data-state={marcadas.has(k) ? 'selected' : undefined}
                    data-abierta={k === abierta ? 'true' : undefined}
                    onClick={(e) => {
                      // Un clic en la casilla o en el menú no abre la fila.
                      if ((e.target as HTMLElement).closest('input,button')) return;
                      if (!onAbrir) return;
                      setAbierta(k);
                      onAbrir(f);
                    }}
                  >
                    {vivas.map((c) => celdaDe(f, c, k))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sw-tabla__pie">
        {/* EL RANGO ES UNA REGIÓN VIVA: cuando cambia la página o el filtro, es
            lo que se anuncia. El «…» del paginador es decorativo a propósito,
            así que si esta frase falta, no hay otra. */}
        <p className="sw-tabla__rango" role="status">
          {filas.length
            ? rell(T.rango, {
                '%a': (pagActual - 1) * porPagina + 1,
                '%b': Math.min(pagActual * porPagina, filas.length),
                '%t': filas.length,
              })
            : T.rangoVacio}
        </p>

        <nav className="sw-tabla__pag" aria-label={T.paginacion} hidden={totalPaginas < 2}>
          {totalPaginas > 1 ? (
            <>
              {/* LA FLECHA SE MARCA COMO FLECHA: lleva el número al que va,
                  igual que un botón de página, así que sin `data-salto` «la
                  página 2» y «la siguiente, que hoy es la 2» son el mismo
                  selector para cualquiera que las busque. */}
              <button
                type="button"
                className="sw-tabla__pagb"
                data-p={pagActual - 1}
                data-salto="ant"
                disabled={pagActual === 1}
                aria-label={T.anterior}
                onClick={() => setPagina(pagActual - 1)}
              >
                <Icon name="left" />
              </button>
              {ventana(pagActual, totalPaginas).map((n, idx) =>
                n === null ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <span className="sw-tabla__elip" aria-hidden="true" key={`e${idx}`}>
                    …
                  </span>
                ) : (
                  <button
                    type="button"
                    className="sw-tabla__pagb"
                    data-p={n}
                    key={n}
                    aria-current={n === pagActual ? 'page' : undefined}
                    aria-label={rell(T.pagina, { '%n': n })}
                    onClick={() => setPagina(n)}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                className="sw-tabla__pagb"
                data-p={pagActual + 1}
                data-salto="sig"
                disabled={pagActual === totalPaginas}
                aria-label={T.siguiente}
                onClick={() => setPagina(pagActual + 1)}
              >
                <Icon name="right" />
              </button>
            </>
          ) : null}
        </nav>

        <div className="sw-tabla__pp" role="group" aria-label={T.porPagina} hidden={opcionesPagina.length < 2}>
          <span className="sw-tabla__ppr">{T.porPagina}</span>
          {opcionesPagina.map((n) => (
            <button
              type="button"
              className="sw-tabla__ppb"
              data-n={n}
              key={n}
              aria-pressed={n === porPagina}
              onClick={() => {
                setPorPagina(n);
                setPagina(1);
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* LA FRANJA DE ACCIONES, debajo del pie y adentro de la card. Estuvo en
          el dock del shell y ahí quedaba a media pantalla de las filas que uno
          acaba de marcar: la barra decía «3 facturas marcadas» a 600px de las
          tres. Pegada al pie se lee en contexto. */}
      {acciones ? <div className="sw-tabla__acciones">{acciones}</div> : null}

      {menu ? (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          groups={
            menu.de === 'ajustes'
              ? gruposDeAjustes
              : menu.de === 'mas'
                ? [{ items: faltan.map((c) => ({ id: c.id, label: c.label ?? c.id, icon: 'plus' })) }]
                : (menuDeFila?.groups ?? [])
          }
          onCerrar={() => setMenu(null)}
          onSelect={(id) => {
            if (menu.de === 'ajustes') {
              alElegirAjuste(id, { x: menu.x, y: menu.y });
            } else if (menu.de === 'mas') {
              const col = faltan.find((c) => c.id === id);
              if (col) {
                setAgregadas((a) => [...a, col]);
                onAgregarColumna?.(col);
                /* AGREGAR TAMBIÉN CAMBIA QUÉ SE VE, y `onColumnas` promete
                   justamente eso. Faltaba: se avisaba sólo al tildar en el
                   menú de ajustes, así que quien persistía las columnas
                   guardaba los destildes y perdía los agregados. La lista se
                   arma a mano porque `declaradas` todavía no incluye la nueva
                   —`setAgregadas` recién se aplica en el render siguiente. */
                onColumnas?.(idsVisibles(unirColumnas(declaradas, [col]), ocultas));
              }
            } else if (menu.fila !== undefined) {
              menuDeFila?.onSelect?.(id, menu.fila);
            }
          }}
        />
      ) : null}
    </div>
  );
}
