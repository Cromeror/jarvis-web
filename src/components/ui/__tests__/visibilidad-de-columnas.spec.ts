/**
 * Los dos bugs que motivaron sacar esto del componente, y la regla que los dos
 * violaban: **`onColumnas` reporta qué se ve, y agregar también cambia qué se
 * ve.**
 */
import { describe, it, expect } from 'vitest';
import { unirColumnas, idsVisibles, alternarOculta } from '../visibilidad-de-columnas.js';
import type { ColumnaDeTabla } from '../anchos-de-tabla.js';

const c = (id: string): ColumnaDeTabla => ({ id, label: id });

describe('unirColumnas', () => {
  it('junta declaradas y agregadas, en ese orden', () => {
    expect(unirColumnas([c('a'), c('b')], [c('x')]).map((x) => x.id)).toEqual(['a', 'b', 'x']);
  });

  it('NO duplica cuando una agregada ya volvió por la preferencia guardada', () => {
    // El bug: al persistir «Cantidad», vuelve en `columnas` mientras sigue en
    // `agregadas`, y la tabla la dibujaba dos veces.
    expect(unirColumnas([c('a'), c('x')], [c('x')]).map((x) => x.id)).toEqual(['a', 'x']);
  });

  it('gana la declarada: es la que trae el orden que eligió el consumidor', () => {
    const declarada = { id: 'x', label: 'La buena' } as ColumnaDeTabla;
    const agregada = { id: 'x', label: 'La vieja' } as ColumnaDeTabla;
    expect(unirColumnas([declarada], [agregada])[0]?.label).toBe('La buena');
  });

  it('aguanta huecos en la lista declarada', () => {
    const conHueco = [c('a'), undefined as unknown as ColumnaDeTabla, c('b')];
    expect(unirColumnas(conHueco, []).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('idsVisibles', () => {
  it('devuelve lo que NO está oculto, en orden', () => {
    expect(idsVisibles([c('a'), c('b'), c('c')], new Set(['b']))).toEqual(['a', 'c']);
  });

  it('sin nada oculto devuelve todas', () => {
    expect(idsVisibles([c('a'), c('b')], new Set())).toEqual(['a', 'b']);
  });

  it('una columna recién agregada entra en el reporte', () => {
    // Éste es EL caso: agregar cambia qué se ve, así que tiene que aparecer en
    // lo que `onColumnas` informa — si no, la preferencia guardada la pierde.
    const trasAgregar = unirColumnas([c('a')], [c('nueva')]);
    expect(idsVisibles(trasAgregar, new Set())).toEqual(['a', 'nueva']);
  });

  it('agregar no resucita lo que estaba oculto', () => {
    const trasAgregar = unirColumnas([c('a'), c('b')], [c('nueva')]);
    expect(idsVisibles(trasAgregar, new Set(['b']))).toEqual(['a', 'nueva']);
  });
});

describe('alternarOculta', () => {
  it('esconde una visible y muestra una escondida', () => {
    expect([...alternarOculta(new Set(), 'a', 3)]).toEqual(['a']);
    expect([...alternarOculta(new Set(['a']), 'a', 3)]).toEqual([]);
  });

  it('el último destilde se ignora: una tabla sin columnas no se puede deshacer', () => {
    expect([...alternarOculta(new Set(['a', 'b']), 'c', 3)]).toEqual(['a', 'b']);
  });
});
