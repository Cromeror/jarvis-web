import { describe, it, expect } from 'vitest';
import { chipsVisibles } from '../chips-visibles.js';

describe('chipsVisibles', () => {
  it('si entran en dos líneas, se muestran todos', () => {
    expect(chipsVisibles([0, 0, 0, 24, 24])).toBe(5);
    expect(chipsVisibles([0])).toBe(1);
    expect(chipsVisibles([])).toBe(0);
  });

  it('si no, lo que entra en dos líneas menos uno: ese lugar es del «+N»', () => {
    // 3 en la primera línea, 2 en la segunda, 4 más abajo.
    expect(chipsVisibles([0, 0, 0, 24, 24, 48, 48, 72, 72])).toBe(4);
  });

  it('nunca menos de uno', () => {
    expect(chipsVisibles([0, 24, 48])).toBe(1);
    expect(chipsVisibles([0, 24, 48], 1)).toBe(1);
  });
});
