import { describe, it, expect } from 'vitest';
import { seccionesVisibles } from '../secciones-visibles.js';

const REGISTRO = {
  'miembros-006': { permisos: ['miembros-006:roles', 'miembros-006:members', 'miembros-006:create'] },
  'puertos-005': { permisos: ['puertos-005:manage'] },
};

describe('seccionesVisibles', () => {
  const modulos = [
    { key: 'puertos-005', name: 'Puertos' },
    { key: 'miembros-006', name: 'Miembros' },
  ];

  it('dibuja las de los módulos que la organización tiene y quien mira puede usar, en su orden', () => {
    const r = seccionesVisibles(REGISTRO, modulos, ['puertos-005:manage', 'miembros-006:members']);
    expect(r.map((s) => s.key)).toEqual(['puertos-005', 'miembros-006']);
  });

  it('con un solo permiso de la sección alcanza', () => {
    expect(seccionesVisibles(REGISTRO, modulos, ['miembros-006:create']).map((s) => s.key)).toEqual(['miembros-006']);
  });

  it('sin el permiso no se dibuja, aunque la organización tenga el módulo', () => {
    // Su primer pedido daría 403: mejor no montarla.
    expect(seccionesVisibles(REGISTRO, modulos, ['red-de-contexto-004:read'])).toEqual([]);
  });

  it('con el permiso pero sin el módulo tampoco: la suite decide qué se ve', () => {
    expect(seccionesVisibles(REGISTRO, [], ['puertos-005:manage'])).toEqual([]);
  });

  it('un módulo que este bundle no conoce, o sin key, se ignora', () => {
    const r = seccionesVisibles(REGISTRO, [{ key: 'nuevo-999', name: 'Nuevo' }, { key: null, name: 'Manual' }], ['x']);
    expect(r).toEqual([]);
  });
});
