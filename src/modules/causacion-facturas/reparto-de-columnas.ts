import type { ColumnaDeTabla } from '../../components/ui/Tabla.js';

/**
 * Qué columnas dibujar: las que esta persona dejó, o las siete por default.
 *
 * Se respeta el ORDEN guardado, no el de `COLUMNAS`: mover una columna es
 * parte de acomodarse la tabla, y devolverla a su lugar en cada recarga sería
 * recordar a medias. Una columna guardada que ya no existe —se sacó del
 * módulo— se ignora en vez de romper.
 */
export function repartirColumnas(guardadas: string[] | null,
  todasLasColumnas: ColumnaDeTabla[],
  porDefecto: ColumnaDeTabla[],
  extraPorDefecto: ColumnaDeTabla[]): {
  columnasDeTabla: ColumnaDeTabla[];
  columnasExtra: ColumnaDeTabla[];
} {
  if (!guardadas || guardadas.length === 0) {
    return { columnasDeTabla: porDefecto, columnasExtra: extraPorDefecto };
  }
  const todas = todasLasColumnas;
  const visibles = guardadas
    .map((id) => todas.find((c) => c.id === id))
    .filter((c): c is ColumnaDeTabla => !!c);
  if (visibles.length === 0) return { columnasDeTabla: porDefecto, columnasExtra: extraPorDefecto };
  const vistos = new Set(visibles.map((c) => c.id));
  return { columnasDeTabla: visibles, columnasExtra: todas.filter((c) => !vistos.has(c.id)) };
}
