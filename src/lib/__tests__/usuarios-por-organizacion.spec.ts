import { describe, it, expect } from 'vitest';
import { pendientesDeAsignar, filasDeUsuarios } from '../usuarios-por-organizacion.js';

const u = (id: string, account_type: 'operator' | 'client', org: string | null) => ({
  id,
  account_type,
  organization: org ? { organization_id: org } : null,
});

const USUARIOS = [
  u('ana', 'client', 'acme'),
  u('beto', 'client', 'acme'),
  u('caro', 'client', 'otra'),
  u('dani', 'client', null),
  u('eli', 'client', null),
  u('admin', 'operator', null),
];

describe('usuarios por organización', () => {
  it('el contador cuenta a los clientes sin organización, no a los operadores', () => {
    expect(pendientesDeAsignar(USUARIOS)).toBe(2);
    expect(pendientesDeAsignar([u('admin', 'operator', null)])).toBe(0);
  });

  it('«Sin asignar» lista a esos clientes y también a los operadores', () => {
    expect(filasDeUsuarios(USUARIOS, { sinAsignar: true, organizationId: 'acme' }).map((x) => x.id)).toEqual([
      'dani',
      'eli',
      'admin',
    ]);
  });

  it('con una organización elegida, sólo sus miembros', () => {
    expect(filasDeUsuarios(USUARIOS, { sinAsignar: false, organizationId: 'acme' }).map((x) => x.id)).toEqual([
      'ana',
      'beto',
    ]);
  });

  it('sin organización elegida no vuelve a la lista revuelta', () => {
    expect(filasDeUsuarios(USUARIOS, { sinAsignar: false, organizationId: null })).toEqual([]);
  });
});
