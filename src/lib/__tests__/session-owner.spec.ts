import { describe, it, expect } from 'vitest';
import { sessionOwnerMark } from '../session-owner.js';

/**
 * Los dos `null` son el contrato de verdad: cuándo NO se pinta. Un badge de más
 * en cada fila apaga la señal tan bien como no tener ninguno.
 */
describe('sessionOwnerMark', () => {
  it('la conversación propia no se marca', () => {
    expect(sessionOwnerMark({ propia: true })).toBeNull();
  });

  it('sin el dato no inventa que es ajena', () => {
    // Server viejo, o una lista pedida sin decir quién pregunta.
    expect(sessionOwnerMark({})).toBeNull();
    expect(sessionOwnerMark({ propia: undefined, owner_username: null })).toBeNull();
  });

  it('la ajena se marca con el nombre de su dueño', () => {
    const marca = sessionOwnerMark({ propia: false, owner_username: 'sebastian' });
    expect(marca?.kind).toBe('ajena');
    expect(marca?.label).toBe('de sebastian');
    expect(marca?.detail).toContain('sebastian');
  });

  it('la que no tiene dueño se distingue de la ajena', () => {
    // No es de nadie (la abre una corrida de plan): no hay una persona cuya
    // conversación estés leyendo, y decir "de alguien" sería falso.
    for (const session of [{ propia: false, owner_username: null }, { propia: false }]) {
      const marca = sessionOwnerMark(session);
      expect(marca?.kind).toBe('huerfana');
      expect(marca?.label).toBe('Sin dueño');
    }
  });
});
