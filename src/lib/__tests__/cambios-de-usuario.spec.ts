import { describe, expect, it } from 'vitest';
import { cambiosDeUsuario, type FormDeUsuario } from '../cambios-de-usuario.js';

const base: FormDeUsuario = {
  username: 'ana',
  password: '',
  account_type: 'client',
  organization_id: '',
  organization_role_id: '',
  project_roles: [
    { project_id: 'p1', role_id: 'contable' },
    { project_id: 'p1', role_id: 'lector' },
  ],
};

describe('cambios al guardar un usuario', () => {
  it('sin tocar nada no hay cambios', () => {
    expect(cambiosDeUsuario(base, { ...base, project_roles: [...base.project_roles].reverse() }).vacio).toBe(true);
  });

  it('distingue proyecto agregado, quitado y roles cambiados', () => {
    const r = cambiosDeUsuario(
      { ...base, project_roles: [...base.project_roles, { project_id: 'p2', role_id: 'x' }] },
      { ...base, project_roles: [{ project_id: 'p1', role_id: 'contable' }, { project_id: 'p1', role_id: 'admin' }, { project_id: 'p3', role_id: 'y' }] },
    );
    const por = Object.fromEntries(r.proyectos.map((p) => [p.project_id, p]));
    expect(por.p1).toMatchObject({ tipo: 'modificado', rolesAgregados: ['admin'], rolesQuitados: ['lector'] });
    expect(por.p2).toMatchObject({ tipo: 'quitado', rolesQuitados: ['x'] });
    expect(por.p3).toMatchObject({ tipo: 'agregado', rolesAgregados: ['y'] });
    expect(r.hayQuitas).toBe(true);
  });

  it('sólo agregar no cuenta como quita', () => {
    const r = cambiosDeUsuario(base, { ...base, project_roles: [...base.project_roles, { project_id: 'p9', role_id: 'z' }] });
    expect(r.hayQuitas).toBe(false);
    expect(r.vacio).toBe(false);
  });

  it('la contraseña, el tipo de cuenta y la organización cuentan', () => {
    expect(cambiosDeUsuario(base, { ...base, password: 'nueva-clave' }).clave).toBe(true);
    expect(cambiosDeUsuario(base, { ...base, account_type: 'operator' }).cuenta).toEqual({ de: 'client', a: 'operator' });
    expect(cambiosDeUsuario(base, { ...base, organization_id: 'o1', organization_role_id: 'r1' }).organizacion).toEqual({ id: 'o1', rol: 'r1' });
  });
});
