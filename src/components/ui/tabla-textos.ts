/**
 * Los textos de la tabla, verbatim de `content.js` del template (`C.tabla`).
 *
 * Copiados y no reescritos: son parte del componente, no de la pantalla que lo
 * usa. `content.js` los agrupa junto a su comentario, y ese comentario explica
 * decisiones que se pierden si alguien los vuelve a redactar — «el rango es la
 * única frase que dice dónde está parado el usuario, y por eso va en una región
 * viva», o «las casillas dicen QUÉ marcan: "casilla" repetido cien veces no le
 * sirve a nadie que navegue de a saltos».
 *
 * Quien monta la tabla pisa lo suyo (el motivo del vacío, la unidad), como
 * `o.textos` en el template.
 */
export interface TextosDeTabla {
  tabla: string;
  ajustes: string;
  agregarColumna: string;
  elegirColumna: string;
  rango: string;
  rangoVacio: string;
  paginacion: string;
  pagina: string;
  anterior: string;
  siguiente: string;
  porPagina: string;
  marcarPagina: string;
  marcarFila: string;
  accionesFila: string;
  vacio: string;
  vacioPaso: string;
  vacioIcono: string;
}

export const TEXTOS_TABLA: TextosDeTabla = {
  tabla: 'Tabla de datos',
  ajustes: 'Qué columnas se ven',
  agregarColumna: 'Agregar una columna…',
  elegirColumna: 'Qué columna agregar',
  rango: 'Mostrando %a–%b de %t',
  rangoVacio: 'Nada para mostrar',
  paginacion: 'Paginación',
  pagina: 'Página %n',
  anterior: 'Página anterior',
  siguiente: 'Página siguiente',
  porPagina: 'Filas por página',
  marcarPagina: 'Marcar todas las filas de esta página',
  marcarFila: 'Marcar %s',
  accionesFila: 'Acciones de %s',
  vacio: 'Nada para mostrar',
  vacioPaso: '',
  vacioIcono: 'table',
};

/** `rell()` de table.js: reemplazo de marcadores, sin plantillas. */
export function rell(plantilla: string, valores: Record<string, string | number>): string {
  let out = plantilla;
  for (const [k, v] of Object.entries(valores)) out = out.split(k).join(String(v));
  return out;
}

/**
 * `ventana(actual, total)` de table.js, verbatim.
 *
 * Devuelve los números de página a dibujar, con `null` donde va un «…».
 * Siempre la primera y la última, más una ventana alrededor de la actual.
 */
export function ventana(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  let desde = Math.max(2, actual - 1);
  let hasta = Math.min(total - 1, actual + 1);
  if (actual <= 3) {
    desde = 2;
    hasta = 4;
  }
  if (actual >= total - 2) {
    desde = total - 3;
    hasta = total - 1;
  }
  if (desde > 2) out.push(null);
  for (let i = desde; i <= hasta; i++) out.push(i);
  if (hasta < total - 1) out.push(null);
  out.push(total);
  return out;
}
