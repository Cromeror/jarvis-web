import { describe, it, expect } from 'vitest';
import { agruparPorModulo, GRUPO_PLATAFORMA } from '../permisos-por-modulo.js';

describe('agruparPorModulo', () => {
  it('separa lo transversal de lo de módulo por el código MOD-NNNN', () => {
    const g = agruparPorModulo(['project:read', 'MOD-0001:write', 'chat:write']);
    expect(g.map((x) => x.titulo)).toEqual([GRUPO_PLATAFORMA, 'MOD-0001']);
    expect(g[0].items.map((i) => i.etiqueta)).toEqual(['project:read', 'chat:write']);
  });

  it('el chip de un módulo muestra sólo la acción — el módulo ya lo dice el grupo', () => {
    const [grupo] = agruparPorModulo(['MOD-0002:read', 'MOD-0002:run']);
    expect(grupo.items).toEqual([
      { permiso: 'MOD-0002:read', etiqueta: 'read' },
      { permiso: 'MOD-0002:run', etiqueta: 'run' },
    ]);
  });

  it('sin permisos transversales no inventa el grupo Plataforma', () => {
    const g = agruparPorModulo(['MOD-0001:read']);
    expect(g).toHaveLength(1);
    expect(g[0].plataforma).toBe(false);
  });

  it('ordena los módulos por código', () => {
    const g = agruparPorModulo(['MOD-0007:read', 'MOD-0001:read', 'MOD-0004:share']);
    expect(g.map((x) => x.titulo)).toEqual(['MOD-0001', 'MOD-0004', 'MOD-0007']);
  });

  it('un permiso raro no se pierde: cae en Plataforma en vez de desaparecer', () => {
    const g = agruparPorModulo(['algo-sin-forma']);
    expect(g[0].items[0]).toEqual({ permiso: 'algo-sin-forma', etiqueta: 'algo-sin-forma' });
  });

  it('una lista vacía no dibuja grupos', () => {
    expect(agruparPorModulo([])).toEqual([]);
  });
});
