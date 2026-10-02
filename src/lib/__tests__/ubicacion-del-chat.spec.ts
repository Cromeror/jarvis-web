import { describe, it, expect } from 'vitest';
import { ubicacionDe } from '../ubicacion-del-chat.js';
import type { CatalogSuite } from '../catalog-api.js';

const SUITES = [
  {
    slug: 'contabilidad',
    modules: [
      { slug: 'causacion', key: 'causacion-facturas-001' },
      { slug: 'entornos', key: 'environments-002' },
    ],
  },
] as unknown as CatalogSuite[];

describe('ubicacionDe', () => {
  it('traduce el slug del módulo a su key — el slug se renombra, la key no', () => {
    expect(ubicacionDe('/suites/jarvis-dev/contabilidad/causacion', SUITES)).toEqual({
      surface: 'contabilidad',
      module: 'causacion-facturas-001',
    });
  });

  it('sin módulo en la URL toma el primero, igual que la pantalla', () => {
    expect(ubicacionDe('/suites/jarvis-dev/contabilidad', SUITES)?.module).toBe('causacion-facturas-001');
  });

  it('sin suites cargadas manda el slug: saber menos es mejor que inventar', () => {
    expect(ubicacionDe('/suites/jarvis-dev/contabilidad/causacion')).toEqual({
      surface: 'contabilidad',
      module: 'causacion',
    });
  });

  it('fuera de una superficie nombra la pantalla', () => {
    expect(ubicacionDe('/plans/jarvis-dev')).toEqual({ view: 'plans' });
  });

  it('en la raíz no hay nada que decir', () => {
    expect(ubicacionDe('/')).toBeNull();
  });

  it('un módulo que la suite no tiene cae al slug, no a undefined', () => {
    expect(ubicacionDe('/suites/p/contabilidad/inventado', SUITES)?.module).toBe('inventado');
  });
});

describe('selección', () => {
  const SEL = { kind: 'documento', ids: ['a', 'b'], label: 'f1.pdf, f2.pdf' };

  it('viaja junto a la ubicación', () => {
    expect(ubicacionDe('/suites/p/contabilidad/causacion', SUITES, SEL)).toEqual({
      surface: 'contabilidad',
      module: 'causacion-facturas-001',
      selection: SEL,
    });
  });

  it('nada marcado no agrega el campo', () => {
    const sinNada = ubicacionDe('/suites/p/contabilidad/causacion', SUITES, { kind: 'documento', ids: [] });
    expect(sinNada).not.toHaveProperty('selection');
  });

  it('fuera de una superficie también se manda: lo señalado importa esté donde esté', () => {
    expect(ubicacionDe('/plans/p', SUITES, SEL)).toEqual({ view: 'plans', selection: SEL });
  });
});
