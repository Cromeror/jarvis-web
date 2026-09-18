import type { AccountingDocument } from '../../lib/accounting-documents-api.js';

/**
 * Las columnas de la tabla, en el orden y con los nombres del extractor.
 *
 * Salen del CSV de extracción real, no de lo que la base guarda hoy — que es
 * un subconjunto. La diferencia es deliberada y es todo el diseño del módulo:
 *
 *  - Unas pocas son COLUMNAS DE LA TABLA (`tipo`, `tercero`, `numero`,
 *    `fecha_documento`, `monto`): las que se filtran y ordenan, y por eso
 *    tienen índice en Postgres.
 *  - El resto vive en `procesamiento` (jsonb), porque su forma todavía se está
 *    afinando. Cuando una se estabilice y haga falta filtrar por ella, se
 *    promueve a columna — y este archivo es el único lugar donde hay que
 *    cambiar de dónde se lee.
 *
 * `leer` encapsula exactamente eso: la pantalla no sabe ni tiene que saber si
 * un dato es columna o clave del jsonb.
 */

export interface ColumnaDoc {
  /** La clave del extractor. Es también la del jsonb cuando no es columna. */
  key: string;
  header: string;
  /** Alineada a la derecha: los importes se comparan de un vistazo por la unidad. */
  numerica?: boolean;
  leer: (doc: AccountingDocument) => string;
}

/** Lo que haya en `procesamiento` bajo esa clave, como texto. Vacío si no está. */
function delJson(doc: AccountingDocument, clave: string): string {
  const valor = doc.procesamiento?.[clave];
  if (valor === undefined || valor === null || valor === '') return '';
  return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
}

/**
 * La columna indexada gana sobre el jsonb.
 *
 * Es lo que alguien corrigió a mano contra lo que el extractor propuso: si el
 * jsonb ganara, una corrección se vería pisada en la próxima pasada del
 * procesador — y el usuario no tendría forma de saber por qué.
 */
function conFallback(columna: string | number | null, doc: AccountingDocument, clave: string): string {
  if (columna !== null && columna !== undefined && columna !== '') return String(columna);
  return delJson(doc, clave);
}

export const COLUMNAS: ColumnaDoc[] = [
  { key: 'archivo', header: 'Archivo', leer: (d) => d.filename },
  { key: 'tipo_documento', header: 'Tipo documento', leer: (d) => conFallback(d.tipo, d, 'tipo_documento') },
  { key: 'fecha', header: 'Fecha', leer: (d) => conFallback(d.fecha_documento, d, 'fecha') },
  { key: 'tercero_nombre', header: 'Tercero', leer: (d) => conFallback(d.tercero, d, 'tercero_nombre') },
  { key: 'tercero_nit_cc', header: 'NIT / CC', leer: (d) => delJson(d, 'tercero_nit_cc') },
  { key: 'numero_documento', header: 'N° documento', leer: (d) => conFallback(d.numero, d, 'numero_documento') },
  { key: 'cufe', header: 'CUFE', leer: (d) => delJson(d, 'cufe') },
  { key: 'cude', header: 'CUDE', leer: (d) => delJson(d, 'cude') },
  { key: 'descripcion', header: 'Descripción', leer: (d) => delJson(d, 'descripcion') },
  { key: 'cantidad', header: 'Cantidad', numerica: true, leer: (d) => delJson(d, 'cantidad') },
  { key: 'valor_unitario', header: 'Valor unitario', numerica: true, leer: (d) => delJson(d, 'valor_unitario') },
  { key: 'subtotal', header: 'Subtotal', numerica: true, leer: (d) => delJson(d, 'subtotal') },
  { key: 'iva', header: 'IVA', numerica: true, leer: (d) => delJson(d, 'iva') },
  { key: 'otros_impuestos', header: 'Otros impuestos', numerica: true, leer: (d) => delJson(d, 'otros_impuestos') },
  {
    key: 'valor_total',
    header: 'Valor total',
    numerica: true,
    leer: (d) => conFallback(d.monto, d, 'valor_total'),
  },
  { key: 'forma_pago', header: 'Forma de pago', leer: (d) => delJson(d, 'forma_pago') },
  {
    key: 'soporte_fiscal_valido_dian',
    header: 'Soporte fiscal DIAN',
    leer: (d) => delJson(d, 'soporte_fiscal_valido_dian'),
  },
  { key: 'cuenta_puc_sugerida', header: 'Cuenta PUC sugerida', leer: (d) => delJson(d, 'cuenta_puc_sugerida') },
  { key: 'observaciones', header: 'Observaciones', leer: (d) => delJson(d, 'observaciones') },
  { key: 'archivos_relacionados', header: 'Archivos relacionados', leer: (d) => delJson(d, 'archivos_relacionados') },
  { key: 'paginas_unificadas', header: 'Páginas', numerica: true, leer: (d) => delJson(d, 'paginas_unificadas') },
  {
    key: 'documentos_relacionados',
    header: 'Documentos relacionados',
    leer: (d) => delJson(d, 'documentos_relacionados'),
  },
  {
    key: 'documento_valido_dian_trazado',
    header: 'Trazado a documento DIAN',
    leer: (d) => delJson(d, 'documento_valido_dian_trazado'),
  },
  { key: 'estado_trazabilidad', header: 'Estado trazabilidad', leer: (d) => delJson(d, 'estado_trazabilidad') },
];
