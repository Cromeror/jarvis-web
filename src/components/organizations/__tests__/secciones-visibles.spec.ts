import { describe, it, expect } from 'vitest';
import { seccionesVisibles } from '../secciones-visibles.js';

const REGISTRO = {
  'MOD-0006': { permisos: ['MOD-0006:roles', 'MOD-0006:members', 'MOD-0006:create'] },
  'MOD-0005': { permisos: ['MOD-0005:manage'] },
};

describe('seccionesVisibles', () => {
  const modulos = [
    { key: 'MOD-0005', name: 'Puertos' },
    { key: 'MOD-0006', name: 'Miembros' },
  ];

  it('dibuja las de los módulos que la organización tiene y quien mira puede usar, en su orden', () => {
    const r = seccionesVisibles(REGISTRO, modulos, ['MOD-0005:manage', 'MOD-0006:members']);
    expect(r.map((s) => s.key)).toEqual(['MOD-0005', 'MOD-0006']);
  });

  it('con un solo permiso de la sección alcanza', () => {
    expect(seccionesVisibles(REGISTRO, modulos, ['MOD-0006:create']).map((s) => s.key)).toEqual(['MOD-0006']);
  });

  it('sin el permiso no se dibuja, aunque la organización tenga el módulo', () => {
    // Su primer pedido daría 403: mejor no montarla.
    expect(seccionesVisibles(REGISTRO, modulos, ['MOD-0004:read'])).toEqual([]);
  });

  it('con el permiso pero sin el módulo tampoco: la suite decide qué se ve', () => {
    expect(seccionesVisibles(REGISTRO, [], ['MOD-0005:manage'])).toEqual([]);
  });

  it('un módulo que este bundle no conoce, o sin key, se ignora', () => {
    const r = seccionesVisibles(REGISTRO, [{ key: 'nuevo-999', name: 'Nuevo' }, { key: null, name: 'Manual' }], ['x']);
    expect(r).toEqual([]);
  });
});
