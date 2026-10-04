import { describe, it, expect } from 'vitest';
import { repartoDeBloque } from '../reparto-de-puertos.js';
import type { OrganizationPortBlock, ProjectPortGrant } from '../../../lib/organizations-api.js';

const bloque: OrganizationPortBlock = {
  id: 'b1',
  organization_id: 'org',
  start_port: 9000,
  end_port: 9019,
  note: null,
  created_at: '',
};

function tramo(id: string, start: number, end: number, organization_grant_id = 'b1'): ProjectPortGrant {
  return { id, project_id: `p-${id}`, organization_grant_id, start_port: start, end_port: end, note: null, created_at: '' };
}

describe('repartoDeBloque', () => {
  it('sin tramos el bloque entero es un solo hueco libre', () => {
    const r = repartoDeBloque(bloque, []);
    expect(r).toMatchObject({ total: 20, repartidos: 0, libres: 20, mayorHueco: 20 });
    expect(r.segmentos).toEqual([{ tipo: 'libre', start: 9000, end: 9019, size: 20 }]);
  });

  it('intercala los huecos entre tramos y los cuenta con los dos extremos incluidos', () => {
    const r = repartoDeBloque(bloque, [tramo('b', 9010, 9014), tramo('a', 9002, 9004)]);
    expect(r.segmentos.map((s) => [s.tipo, s.start, s.end])).toEqual([
      ['libre', 9000, 9001],
      ['tramo', 9002, 9004],
      ['libre', 9005, 9009],
      ['tramo', 9010, 9014],
      ['libre', 9015, 9019],
    ]);
    expect(r).toMatchObject({ repartidos: 8, libres: 12, mayorHueco: 5 });
  });

  it('un tramo de otro bloque de la misma organización no ocupa éste', () => {
    const r = repartoDeBloque(bloque, [tramo('x', 9000, 9009, 'b2')]);
    expect(r.libres).toBe(20);
  });

  it('bloque lleno: sin huecos, mayor hueco cero', () => {
    const r = repartoDeBloque(bloque, [tramo('a', 9000, 9019)]);
    expect(r).toMatchObject({ repartidos: 20, libres: 0, mayorHueco: 0 });
    expect(r.segmentos).toHaveLength(1);
  });
});
