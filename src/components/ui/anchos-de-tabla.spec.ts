import { describe, it, expect } from 'vitest';
import { repartirAnchos, ordenarFilas, type ColumnaDeTabla } from './anchos-de-tabla.js';

/**
 * El reparto de anchos y el orden, portados de `table.js` del template.
 *
 * Se testean porque son lo único del componente que es datos → datos, y porque
 * el comentario original documenta cuatro intentos fallidos: sin un test, la
 * próxima «simplificación» reintroduce el que se veía mal.
 */
const COLS: ColumnaDeTabla[] = [
  { id: '__marca', w: 44 },
  { id: 'archivo', w: 220 },
  { id: 'tercero', w: 240, elastica: true },
  { id: 'total', w: 130 },
  { id: '__menu', w: 44 },
];

describe('reparto de anchos', () => {
  it('las columnas de servicio no crecen ni encogen', () => {
    const { anchos } = repartirAnchos(COLS, 1400);
    expect(anchos[0]).toBe(44);
    expect(anchos[4]).toBe(44);
  });

  it('el sobrante se reparte en proporción y la tabla llena su caja', () => {
    const hueco = 1000;
    const { anchos } = repartirAnchos(COLS, hueco);
    expect(anchos.reduce((a, w) => a + w, 0)).toBe(hueco);
    // Proporcional: la que más tenía queda con más.
    expect(anchos[2]).toBeGreaterThan(anchos[1] as number);
  });

  it('cuando falta lugar, SÓLO encoge la elástica', () => {
    // Ideal = 44+220+240+130+44 = 678. Con 600 faltan 78.
    const { anchos } = repartirAnchos(COLS, 600);
    expect(anchos[1]).toBe(220); // archivo intacto: una fecha a medias no es una fecha
    expect(anchos[3]).toBe(130); // total intacto: una cifra truncada no es una cifra
    expect(anchos[2]).toBeLessThan(240);
  });

  it('la elástica no baja de dos tercios de su ancho ideal', () => {
    const { anchos } = repartirAnchos(COLS, 200);
    expect(anchos[2]).toBe(Math.round(240 * 0.66));
  });

  it('el mínimo publicado es el ENCOGIDO, no el ideal', () => {
    const { minimo } = repartirAnchos(COLS, 1400);
    expect(minimo).toBe(44 + 220 + Math.round(240 * 0.66) + 130 + 44);
  });
});

describe('orden de filas', () => {
  const COL: ColumnaDeTabla = { id: 'n', dato: 'n' };
  const por = (dir: 'asc' | 'desc', filas: { n: unknown }[]): unknown[] =>
    ordenarFilas(filas, COL, dir).map((f) => f.n);

  it('los huecos van al final EN LOS DOS SENTIDOS', () => {
    const filas = [{ n: 2 }, { n: null }, { n: 1 }];
    expect(por('asc', filas)).toEqual([1, 2, null]);
    // Invertir no los trae al frente: una pantalla de celdas vacías no es el
    // otro extremo de nada.
    expect(por('desc', filas)).toEqual([2, 1, null]);
  });

  it('los consecutivos de factura se ordenan numéricamente, no alfabéticamente', () => {
    // Sin `numeric`, FEB11111 iría antes que FEB9.
    expect(por('asc', [{ n: 'FEB11111' }, { n: 'FEB9' }])).toEqual(['FEB9', 'FEB11111']);
  });

  it('sin columna, el orden original se respeta', () => {
    const filas = [{ n: 3 }, { n: 1 }];
    expect(ordenarFilas(filas, undefined, 'asc')).toEqual(filas);
  });
});
