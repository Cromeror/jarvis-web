import { describe, it, expect } from 'vitest';
import { agruparPorModulo, GRUPO_PLATAFORMA } from '../permisos-por-modulo.js';

describe('agruparPorModulo', () => {
  it('separa lo transversal de lo de módulo por el id de tres dígitos', () => {
    const g = agruparPorModulo(['project:read', 'causacion-facturas-001:write', 'chat:write']);
    expect(g.map((x) => x.titulo)).toEqual([GRUPO_PLATAFORMA, 'causacion-facturas-001']);
    expect(g[0].items.map((i) => i.etiqueta)).toEqual(['project:read', 'chat:write']);
  });

  it('el chip de un módulo muestra sólo la acción — el módulo ya lo dice el grupo', () => {
    const [grupo] = agruparPorModulo(['environments-002:read', 'environments-002:run']);
    expect(grupo.items).toEqual([
      { permiso: 'environments-002:read', etiqueta: 'read' },
      { permiso: 'environments-002:run', etiqueta: 'run' },
    ]);
  });

  it('sin permisos transversales no inventa el grupo Plataforma', () => {
    const g = agruparPorModulo(['causacion-facturas-001:read']);
    expect(g).toHaveLength(1);
    expect(g[0].plataforma).toBe(false);
  });

  it('ordena los módulos por key, así que el id agrupa las versiones de un nombre', () => {
    const g = agruparPorModulo(['zeta-003:read', 'causacion-facturas-001:read', 'causacion-facturas-002:read']);
    expect(g.map((x) => x.titulo)).toEqual(['causacion-facturas-001', 'causacion-facturas-002', 'zeta-003']);
  });

  it('un permiso raro no se pierde: cae en Plataforma en vez de desaparecer', () => {
    const g = agruparPorModulo(['algo-sin-forma']);
    expect(g[0].items[0]).toEqual({ permiso: 'algo-sin-forma', etiqueta: 'algo-sin-forma' });
  });

  it('una lista vacía no dibuja grupos', () => {
    expect(agruparPorModulo([])).toEqual([]);
  });
});
