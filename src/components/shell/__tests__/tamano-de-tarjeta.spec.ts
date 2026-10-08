import { describe, expect, it } from 'vitest';
import {
  ANCHO_BASE,
  ANCHO_MINIMO,
  RATIO,
  altoDe,
  anchoDelGesto,
  anchoMaximo,
  limitarAncho,
} from '../tamano-de-tarjeta.js';

const HUECO = { ancho: 1600, alto: 1000, respiro: 16 };

describe('el alto sale del ancho', () => {
  it('conserva la proporción de fábrica', () => {
    expect(altoDe(ANCHO_BASE)).toBe(560);
    expect(altoDe(600)).toBe(Math.round(600 * RATIO));
  });
});

describe('el gesto', () => {
  it('en diagonal exacta, la esquina sigue al puntero', () => {
    // Moverse (1, RATIO) es moverse por la diagonal: el ancho crece 1 y el
    // alto RATIO, o sea que la esquina queda justo bajo el dedo.
    expect(anchoDelGesto(420, 1, RATIO)).toBeCloseTo(421, 6);
  });
  it('en un solo eje agranda menos, y el vertical pesa más', () => {
    const soloX = anchoDelGesto(420, 100, 0) - 420;
    const soloY = anchoDelGesto(420, 0, 100) - 420;
    expect(soloX).toBeGreaterThan(0);
    expect(soloX).toBeLessThan(100);
    // La tarjeta es más alta que ancha: un píxel de alto vale menos ancho.
    expect(soloY).toBeGreaterThan(soloX);
  });
  it('hacia afuera achica', () => {
    expect(anchoDelGesto(420, -100, -100)).toBeLessThan(420);
  });
});

describe('los topes', () => {
  it('nunca baja del mínimo', () => {
    expect(limitarAncho(10, HUECO)).toBe(ANCHO_MINIMO);
  });
  it('el eje que primero se queda sin lugar gobierna a los dos', () => {
    // Ventana baja y ancha: de ancho sobra, pero el alto no da.
    const bajo = { ancho: 1600, alto: 600, respiro: 16 };
    expect(anchoMaximo(bajo)).toBe(Math.floor((600 - 32) / RATIO));
    expect(limitarAncho(1200, bajo)).toBe(anchoMaximo(bajo));
    // Y al revés: ventana angosta y alta.
    const angosto = { ancho: 500, alto: 2000, respiro: 16 };
    expect(anchoMaximo(angosto)).toBe(500 - 32);
  });
  it('un hueco más chico que el mínimo no devuelve un máximo negativo', () => {
    expect(anchoMaximo({ ancho: 100, alto: 100, respiro: 16 })).toBe(ANCHO_MINIMO);
  });
});
