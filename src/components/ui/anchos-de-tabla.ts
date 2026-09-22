/**
 * EL REPARTO DE ANCHOS — `pintarAnchos()` de `table.js`, portado tal cual.
 *
 * Sin React y en su propio archivo porque es la única parte del componente que
 * es datos → datos, y por lo tanto la única que este repo puede fijar con un
 * test (`vitest.config.ts`: sólo lógica pura, sin jsdom).
 *
 * El comentario original documenta cuatro intentos y por qué los tres primeros
 * se veían mal. Vale la pena conservarlo porque explica por qué NO se simplifica:
 *
 * > · TODO A LA ELÁSTICA: con dos columnas escondidas el nombre del proveedor se
 * >   estiraba a 400px y quedaba un hueco de 250 entre él y el total. La fila se
 * >   leía como dos tablas pegadas.
 * > · NADA, TODO AL FINAL: la tabla quedaba compactada a la izquierda con un
 * >   vacío al costado.
 * > · CON TECHO Y EL RESTO AL FINAL: arregla esconder columnas a 1600 y reproduce
 * >   el problema anterior en una pantalla grande.
 *
 * Y por qué sólo encoge la elástica:
 *
 * > El primer intento encogió todo lo que no fuera control y a 1440 la tabla
 * > dejó de scrollear a cambio de mostrar «$ 2.213…» y «2026-06…»: una cifra
 * > truncada no es una cifra, y una fecha a medias tampoco. Lo único que aguanta
 * > puntos suspensivos es el texto libre.
 */

export interface ColumnaDeTabla {
  id: string;
  label?: string;
  /** Qué campo de la fila pinta, si no se pasa `celda`. */
  dato?: string;
  /** Ancho IDEAL en px (no el mínimo). Default 120. */
  w?: number;
  /** Alineación: va como `data-al` en la celda.
   *
   * Los valores son los del template (`al: 'der'` / `al: 'centro'` en
   * `data/content.js`) porque el CSS —copia literal— selecciona por ellos:
   * `[data-al="der"]`. Estuvieron como `'d' | 'c'`, que es un vocabulario
   * paralelo y no casa con ninguna regla: los importes quedaban a la izquierda. */
  al?: 'der' | 'centro';
  /** `false` = la columna no se puede ordenar. */
  orden?: boolean;
  /** `true` = muestra el valor completo en un `title` cuando puede recortarse. */
  tip?: boolean;
  /** Ancho fijo: no crece ni encoge. */
  fija?: boolean;
  /** La única que absorbe el déficit. Dos tercios de su ancho ideal es el piso. */
  elastica?: boolean;
  /** Para ordenar: el valor comparable de la fila. Default `f[dato]`. */
  valor?: (fila: never) => unknown;
}

/** Hasta dónde puede encogerse la elástica y seguir diciendo de quién es la factura. */
const PISO = 0.66;

export const ID_MARCA = '__marca';
export const ID_MENU = '__menu';

export function anchoBase(c: ColumnaDeTabla): number {
  return c.w || 120;
}

export function esFlexible(c: ColumnaDeTabla): boolean {
  return !c.fija && c.id !== ID_MARCA && c.id !== ID_MENU;
}

function encoge(c: ColumnaDeTabla): boolean {
  return esFlexible(c) && Boolean(c.elastica);
}

function anchoMinimo(c: ColumnaDeTabla): number {
  return encoge(c) ? Math.round(anchoBase(c) * PISO) : anchoBase(c);
}

export interface RepartoDeAnchos {
  anchos: number[];
  /** Lo que se publica como `--sw-tabla-min`: el ENCOGIDO, no el ideal. */
  minimo: number;
}

/**
 * Reparte `hueco` px entre las columnas vivas.
 *
 * `hueco` es el `clientWidth` del contenedor: descuenta filete, relleno y la
 * barra de scroll vertical de una sola vez. Medir contra algo que no la
 * descuente hace que la tabla desborde por esos ~15px y encienda un scroll
 * horizontal a cualquier tamaño — y **no se ve en Chromium headless**, que
 * dibuja las barras por encima sin robar ancho.
 */
export function repartirAnchos(vivas: readonly ColumnaDeTabla[], hueco: number): RepartoDeAnchos {
  const ideal = vivas.reduce((a, c) => a + anchoBase(c), 0);
  const sobra = Math.max(0, hueco - ideal);
  const falta = Math.max(0, ideal - hueco);
  // En proporción a lo que ya mide cada una, que es lo que las mantiene
  // legibles entre sí: la que necesita más ancho es la que más tenía.
  const masa = vivas.filter(esFlexible).reduce((a, c) => a + anchoBase(c), 0) || 1;

  const anchos = vivas.map((c) => {
    if (!esFlexible(c)) return anchoBase(c);
    if (sobra) return anchoBase(c) + Math.floor((sobra * anchoBase(c)) / masa);
    if (falta) {
      if (!encoge(c)) return anchoBase(c);
      // El déficit lo absorbe la elástica, que es la única que puede.
      const masaE = vivas.filter(encoge).reduce((a, x) => a + anchoBase(x), 0) || 1;
      return Math.max(anchoMinimo(c), anchoBase(c) - Math.ceil((falta * anchoBase(c)) / masaE));
    }
    return anchoBase(c);
  });

  /* Lo que quedó por redondear —unos pocos píxeles— va a la última que crezca,
     para que la suma dé exacta y no quede una rayita de fondo al final. */
  const usado = anchos.reduce((a, w) => a + w, 0);
  const resto = Math.max(0, hueco - usado);
  if (resto > 0) {
    for (let k = vivas.length - 1; k >= 0; k--) {
      if (esFlexible(vivas[k] as ColumnaDeTabla)) {
        anchos[k] = (anchos[k] as number) + resto;
        break;
      }
    }
  }

  return { anchos, minimo: vivas.reduce((a, c) => a + anchoMinimo(c), 0) };
}

/**
 * Ordena las filas. `ordenadas()` de table.js.
 *
 * **Los huecos van al final en los DOS sentidos**: invertir el orden no tiene
 * que traerlos al frente — el que ordena por monto quiere ver montos, y una
 * pantalla de celdas vacías no es el otro extremo de nada.
 *
 * `numeric` en el `localeCompare` para que FEB11111 vaya después de FEB9 y no
 * antes: son consecutivos de factura y el orden alfabético puro los miente.
 */
export function ordenarFilas<F>(
  filas: readonly F[],
  columna: ColumnaDeTabla | undefined,
  dir: 'asc' | 'desc',
): F[] {
  if (!columna) return [...filas];
  const valorDe = (columna.valor ?? ((f: F) => (f as Record<string, unknown>)[columna.dato ?? columna.id])) as (
    f: F,
  ) => unknown;
  const signo = dir === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => {
    const x = valorDe(a);
    const y = valorDe(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * signo;
    if (typeof x === 'boolean' && typeof y === 'boolean') return ((x ? 1 : 0) - (y ? 1 : 0)) * signo;
    return String(x).localeCompare(String(y), 'es', { numeric: true }) * signo;
  });
}
