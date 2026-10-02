/**
 * El caché existe para una sola cosa: que la tabla no salte. Lo que estos
 * tests cuidan es que no se convierta en una segunda fuente de verdad ni en
 * una forma de romper la pantalla.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { claveDeCache, leerCache, escribirCache, difieren } from '../cache-de-preferencias.js';

function montarStorage(): Map<string, string> {
  const datos = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => datos.set(k, v),
    },
  });
  return datos;
}

describe('la clave lleva el usuario', () => {
  it('dos personas en el mismo browser no comparten preferencias', () => {
    // Sin esto, el siguiente que entre ve las columnas del anterior: no filtra
    // datos, pero parece un bug de permisos.
    expect(claveDeCache('u1', 'm')).not.toBe(claveDeCache('u2', 'm'));
  });

  it('dos módulos del mismo usuario tampoco', () => {
    expect(claveDeCache('u', 'm1')).not.toBe(claveDeCache('u', 'm2'));
  });
});

describe('leer y escribir', () => {
  beforeEach(() => montarStorage());

  it('devuelve lo guardado', () => {
    escribirCache('u', 'm', { columnas: ['a', 'b'] });
    expect(leerCache('u', 'm')).toEqual({ columnas: ['a', 'b'] });
  });

  it('sin nada guardado devuelve null, no un objeto vacío', () => {
    // El consumidor tiene que poder distinguir "no hay caché" de "el usuario
    // guardó nada": en el primer caso espera al servidor, en el segundo no.
    expect(leerCache('u', 'm')).toBeNull();
  });

  it('sin usuario no lee ni escribe: una clave sin dueño es la de cualquiera', () => {
    escribirCache(null, 'm', { columnas: ['a'] });
    expect(leerCache(null, 'm')).toBeNull();
  });
});

describe('nada de esto puede romper la pantalla', () => {
  it('basura guardada se ignora en vez de explotar', () => {
    const datos = montarStorage();
    datos.set(claveDeCache('u', 'm'), '{no es json');
    expect(leerCache('u', 'm')).toBeNull();
  });

  it('un array guardado no pasa por objeto', () => {
    const datos = montarStorage();
    datos.set(claveDeCache('u', 'm'), '["a"]');
    expect(leerCache('u', 'm')).toBeNull();
  });

  it('si localStorage tira, escribir no propaga', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      },
    });
    expect(() => escribirCache('u', 'm', { columnas: ['a'] })).not.toThrow();
  });
});

describe('difieren', () => {
  it('compara el CONTENIDO: la respuesta del servidor es un objeto nuevo cada vez', () => {
    // Por identidad siempre diferiría, y el re-render que el caché vino a
    // evitar pasaría igual en cada carga.
    expect(difieren({ columnas: ['a'] }, { columnas: ['a'] })).toBe(false);
  });

  it('un cambio real sí se detecta', () => {
    expect(difieren({ columnas: ['a'] }, { columnas: ['a', 'b'] })).toBe(true);
  });
});
