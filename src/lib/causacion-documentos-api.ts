/**
 * Cliente de `api/projects/:id/causacion/documentos` — el DOCUMENTO LÓGICO.
 *
 * No es lo mismo que `causacion-soportes-api`, y la diferencia es la del §2.2
 * del documento de diseño: un soporte es un ARCHIVO que alguien subió; un
 * documento es la unidad contable, y puede estar compuesto por varios archivos
 * (una factura fotografiada en tres tomas es UN documento con tres archivos).
 *
 * Acá sólo se lee, y sólo lo que la tarjeta de avance necesita contar. El alta
 * y la clasificación las hace la IA con sus tools: el humano sube, la IA
 * analiza y de ahí sale si es factura o es otra operación.
 */

/** El circuito del asiento. */
export type EstadoCausacion = 'BORRADOR_IA' | 'VALIDADO_AUDITOR' | 'CAUSADO_EN_CONTABLE';

/** La primera pregunta: ¿esto se causa acá, o es de otro módulo? */
export type Clasificacion = 'CAUSACION_CONTABLE' | 'OTRA_OPERACION' | 'PENDIENTE_CLASIFICAR';

/**
 * Lo que la tarjeta lee de cada documento, y nada más.
 *
 * El `CausacionDocumento` del servidor trae también los archivos, las quince
 * columnas del asiento y la trazabilidad. Declarar sólo esto no es pereza: es
 * lo que hace que un cambio en la forma de la extracción no rompa la tarjeta.
 */
export interface DocumentoDeAvance {
  id: string;
  periodo: string | null;
  clasificacion: { clasificacion: Clasificacion };
  extraccion: { estado_causacion: EstadoCausacion } | null;
}

function base(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/causacion`;
}

/**
 * Los documentos del proyecto.
 *
 * El tope del servidor es 500 (`search()` clampea), y se pide el máximo a
 * propósito: la tarjeta CUENTA, y una cuenta hecha sobre una página es una
 * cuenta equivocada. Cuando el volumen pase de ahí hay que pedirle al servidor
 * un endpoint de resumen en vez de subir el número.
 */
export async function listDocumentos(
  projectId: string,
): Promise<{ documentos: DocumentoDeAvance[]; total: number }> {
  const res = await fetch(`${base(projectId)}/documentos?limit=500`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { documentos: DocumentoDeAvance[]; total: number };
}
