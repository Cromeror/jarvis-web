import { describe, expect, it } from 'vitest';
import { fichaDeModulo, nombreDistinguible } from '../ficha-de-modulo.js';

const espacio = {
  id: 'm4',
  key: 'MOD-0004',
  name: 'Red de contexto',
  ambito: 'cliente' as const,
  superficie: 'ajustes' as const,
};
const org = {
  id: 'm7',
  key: 'MOD-0007',
  name: 'Red de contexto',
  ambito: 'organizacion' as const,
  superficie: 'ajustes' as const,
};
const riel = { id: 'm1', key: 'MOD-0001', name: 'Causación', ambito: 'cliente' as const, superficie: 'riel' as const };

describe('ficha de un módulo', () => {
  it('dos módulos con el mismo nombre se distinguen por para quién son', () => {
    const todos = [espacio, org, riel];
    expect(nombreDistinguible(espacio, todos)).toBe('Red de contexto (espacio)');
    expect(nombreDistinguible(org, todos)).toBe('Red de contexto (organización)');
    // Sin repetido, el nombre queda tal cual.
    expect(nombreDistinguible(riel, todos)).toBe('Causación');
  });

  it('dice dónde aparece según la superficie y el catálogo', () => {
    expect(fichaDeModulo(espacio, []).dondeAparece).toBe('Ajustes → Espacio');
    expect(fichaDeModulo(org, []).dondeAparece).toBe('Ajustes → Organización');
    expect(fichaDeModulo(riel, []).dondeCorto).toBe('Riel');
  });

  it('las suites que lo traen son las que lo contienen, y sin ninguna no le llega a nadie', () => {
    const suites = [
      { name: 'Red', modules: [{ id: 'm4' }, { id: 'm7' }] },
      { name: 'Contabilidad', modules: [{ id: 'm1' }] },
    ] as never;
    expect(fichaDeModulo(org, suites).suites).toEqual(['Red']);
    expect(fichaDeModulo({ ...riel, id: 'otro' }, suites).comoLlega).toMatch(/no le llega a nadie/);
  });
});
