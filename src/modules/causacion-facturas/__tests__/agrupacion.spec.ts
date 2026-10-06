import { describe, it, expect } from 'vitest';
import { agrupar, otrosDelGrupo } from '../agrupacion.js';
import type { Clasificacion, DocumentoContable } from '../../../lib/causacion-documentos-api.js';

/**
 * UNA FILA POR GRUPO, NO POR DOCUMENTO.
 *
 * Lo que se fija acá es la regla del dominio, que tiene más casos de los que
 * parece: quién encabeza, qué pasa cuando NINGUNO es principal —que no es un
 * empate cualquiera, es un documento incompleto— y que la cadena A-B-C sea un
 * grupo y no dos.
 */

function doc(
  id: string,
  opciones: { clasificacion?: Clasificacion | null; relacionadoCon?: string[] } = {},
): DocumentoContable {
  return {
    id,
    periodo: '2026-03',
    estado: 'PENDIENTE_AUDITAR',
    importacion_error: null,
    eliminado_en: null,
    archivos: [],
    clasificacion: { clasificacion: opciones.clasificacion ?? null, operacion_destino: null },
    extraccion: null,
    trazabilidad: { cufe_cude: null, observaciones_ia: null, documento_valido_dian_trazado: [] },
    relaciones: (opciones.relacionadoCon ?? []).map((otro, i) => ({
      id: `${id}-r${i}`,
      documento_id: id,
      documento_relacionado_id: otro,
      tipo_relacion: 'otro' as const,
      evidencia: null,
    })),
    created_at: '2026-03-01T00:00:00Z',
  };
}

describe('agrupar documentos relacionados', () => {
  it('un documento suelto es su propio grupo', () => {
    const grupos = agrupar([doc('a')]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.duenio.id).toBe('a');
    expect(otrosDelGrupo(grupos[0]!)).toBe(0);
  });

  it('dos relacionados ocupan UNA fila, y la encabeza el PRINCIPAL', () => {
    // El complementario viene primero en la lista a propósito: lo que decide
    // quién encabeza es la clasificación, no el orden ni el lado de la FK.
    const grupos = agrupar([
      doc('remision', { clasificacion: 'COMPLEMENTARIO', relacionadoCon: ['factura'] }),
      doc('factura', { clasificacion: 'PRINCIPAL' }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.duenio.id).toBe('factura');
    expect(grupos[0]?.miembros.map((m) => m.id)).toEqual(['factura', 'remision']);
  });

  it('sin ningún principal encabeza el PRIMERO de la lista', () => {
    // Es el documento incompleto: la IA ató dos papeles y no pudo decidir cuál
    // causa. Se muestra igual —esconderlo hasta que esté completo escondería
    // justo el que necesita mano— y el orden del servidor lo hace estable.
    const grupos = agrupar([doc('uno', { relacionadoCon: ['dos'] }), doc('dos')]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.duenio.id).toBe('uno');
    expect(otrosDelGrupo(grupos[0]!)).toBe(1);
  });

  it('la cadena A-B-C es UN grupo, aunque A y C no se nombren', () => {
    // Si no fuera transitivo saldrían dos filas para una sola cadena de
    // papeles, y cuál de las dos dependería de a quién se mirara primero.
    const grupos = agrupar([
      doc('a', { relacionadoCon: ['b'] }),
      doc('b', { relacionadoCon: ['c'] }),
      doc('c'),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.miembros.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    expect(otrosDelGrupo(grupos[0]!)).toBe(2);
  });

  it('un vínculo hacia afuera de lo cargado se CUENTA, no se pierde', () => {
    // Los vínculos cruzan períodos: una factura de marzo pagada en abril. Si se
    // contara sólo lo cargado, el mismo documento diría «1 documento» o «2»
    // según en qué mes estuviera parado el usuario.
    const grupos = agrupar([doc('a', { relacionadoCon: ['de-otro-mes'] })]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.idsAusentes).toEqual(['de-otro-mes']);
    expect(otrosDelGrupo(grupos[0]!)).toBe(1);
  });

  it('dos grupos distintos siguen siendo dos filas', () => {
    const grupos = agrupar([
      doc('a', { relacionadoCon: ['b'] }),
      doc('b'),
      doc('c', { relacionadoCon: ['d'] }),
      doc('d'),
    ]);
    expect(grupos.map((g) => g.duenio.id)).toEqual(['a', 'c']);
  });

  it('un vínculo recíproco no duplica al documento', () => {
    // Las dos puntas pueden declarar la relación; el recorrido no puede contar
    // a ninguna dos veces ni quedarse en un ciclo.
    const grupos = agrupar([
      doc('a', { relacionadoCon: ['b'] }),
      doc('b', { relacionadoCon: ['a'] }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.miembros).toHaveLength(2);
  });

  it('ningún documento desaparece de la tabla', () => {
    // La garantía de fondo: agrupar cambia cuántas FILAS hay, no cuántos
    // documentos. Si uno se cae del reparto, deja de poder causarse.
    const todos = [
      doc('a', { relacionadoCon: ['b'] }),
      doc('b'),
      doc('c'),
      doc('d', { clasificacion: 'PRINCIPAL', relacionadoCon: ['e'] }),
      doc('e', { clasificacion: 'COMPLEMENTARIO' }),
    ];
    const vistos = agrupar(todos).flatMap((g) => g.miembros.map((m) => m.id));
    expect(vistos.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
