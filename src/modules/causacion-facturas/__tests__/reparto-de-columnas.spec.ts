import { describe, it, expect } from 'vitest';
import { repartirColumnas } from '../reparto-de-columnas.js';
import type { ColumnaDeTabla } from '../../../components/ui/Tabla.js';

const c = (id: string): ColumnaDeTabla => ({ id, label: id });
const TODAS = ['a', 'b', 'c', 'd'].map(c);
const DEFAULT = ['a', 'b'].map(c);
const EXTRA = ['c', 'd'].map(c);

const repartir = (g: string[] | null) => repartirColumnas(g, TODAS, DEFAULT, EXTRA);

describe('repartirColumnas', () => {
  it('sin nada guardado usa los defaults del módulo', () => {
    expect(repartir(null).columnasDeTabla.map((x) => x.id)).toEqual(['a', 'b']);
    expect(repartir([]).columnasDeTabla.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('respeta el ORDEN guardado, no el de la declaración', () => {
    // Mover una columna es parte de acomodarse la tabla; devolverla a su lugar
    // en cada recarga sería recordar a medias.
    expect(repartir(['c', 'a']).columnasDeTabla.map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('lo que no quedó visible pasa a «Agregar una columna…»', () => {
    expect(repartir(['c', 'a']).columnasExtra.map((x) => x.id)).toEqual(['b', 'd']);
  });

  it('una columna guardada que ya no existe se ignora, no rompe', () => {
    expect(repartir(['a', 'borrada']).columnasDeTabla.map((x) => x.id)).toEqual(['a']);
  });

  it('si TODAS las guardadas desaparecieron, vuelve a los defaults', () => {
    // Una tabla sin columnas no es una preferencia, es una pantalla rota.
    expect(repartir(['fantasma']).columnasDeTabla.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
