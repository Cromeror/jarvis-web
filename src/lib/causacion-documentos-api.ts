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

/**
 * EL ÚNICO EJE DE ESTADO del documento.
 *
 * Reemplaza a `EstadoCausacion` (`BORRADOR_IA` / `VALIDADO_AUDITOR` /
 * `CAUSADO_EN_CONTABLE`) y a la columna de trazabilidad, que contestaban lo
 * mismo con distinto vocabulario.
 *
 * `PENDIENTE_AUDITAR` es la bandeja humana: lo que la IA no pudo cerrar y lo
 * que el contador devolvió. `AUDITADO` es el único terminal.
 */
export type EstadoDocumento = 'PENDIENTE_PROCESAR' | 'PENDIENTE_AUDITAR' | 'COMPLETADO' | 'AUDITADO';

/**
 * ¿Origina el asiento, o lo acompaña? `null` = todavía no se clasificó.
 *
 * Antes era `CAUSACION_CONTABLE` / `OTRA_OPERACION`, que sugería que del
 * segundo no se leía nada — y sí se lee: un complementario arma la historia del
 * asiento aunque no genere registro propio.
 */
export type Clasificacion = 'PRINCIPAL' | 'COMPLEMENTARIO';

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
  estado: EstadoDocumento;
  clasificacion: { clasificacion: Clasificacion | null };
}

/** Un archivo del documento, tal como viene en la lista. */
export interface ArchivoDeDocumento {
  soporte_id: string;
  orden: number;
  filename?: string;
  path?: string;
  /** El visor los necesita para decidir si puede mostrarlo y qué dice el encabezado. */
  kind?: string;
  size_bytes?: number;
}

/**
 * EL ASIENTO: las quince columnas que entran a la contabilidad.
 *
 * Todo nullable salvo los enums, y eso es regla del dominio: un campo que no se
 * lee en el papel se deja VACÍO. Ponerle un `0` sería inventar un dato contable.
 */
export interface Extraccion {
  tipo_documento: string | null;
  numero_documento: string | null;
  fecha: string | null;
  tercero_nombre: string | null;
  tercero_nit_cc: string | null;
  descripcion: string | null;
  cantidad: number | null;
  valor_unitario: number | null;
  subtotal: number | null;
  iva: number | null;
  otros_impuestos: number | null;
  valor_total: number | null;
  forma_pago: string | null;
  soporte_fiscal_valido_dian: string;
  cuenta_puc_sugerida: string | null;
}

/** El respaldo ante la DIAN. `cufe_cude` es uno solo: ante la DIAN no se discriminan. */
export interface Trazabilidad {
  cufe_cude: string | null;
  observaciones_ia: string | null;
  documento_valido_dian_trazado: string[];
}

/**
 * EL DOCUMENTO CONTABLE, que es lo que la tabla lista.
 *
 * Antes listaba archivos, y eso era de cuando el archivo era la unidad. Lo que
 * se clasifica, se causa y se cierra es el documento; el archivo es su
 * evidencia, y puede ser más de uno.
 */
/** Un vínculo entre dos documentos. No es jerarquía: siguen siendo independientes. */
export interface RelacionDeDocumento {
  id: string;
  documento_id: string;
  documento_relacionado_id: string;
  tipo_relacion: 'remision_factura' | 'pago_factura' | 'otro';
  evidencia: string | null;
}

export interface DocumentoContable {
  id: string;
  periodo: string | null;
  estado: EstadoDocumento;
  importacion_error: string | null;
  eliminado_en: string | null;
  archivos: ArchivoDeDocumento[];
  clasificacion: { clasificacion: Clasificacion | null; operacion_destino: string | null };
  extraccion: Extraccion | null;
  trazabilidad: Trazabilidad;
  /**
   * Con qué otros documentos está relacionado.
   *
   * Viene en la lista para que la vista pueda AGRUPAR —una factura con sus
   * soportes— sin pedir las relaciones de cada fila. La causación es un proceso
   * de agrupación: todo nace suelto y los vínculos van apareciendo.
   */
  relaciones: RelacionDeDocumento[];
  created_at: string;
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

export interface ConsultaDeDocumentos {
  periodo?: string;
  estado?: EstadoDocumento;
  clasificacion?: Clasificacion;
  texto?: string;
  limit?: number;
  offset?: number;
}

/** Los documentos para la tabla, con su asiento y su trazabilidad. */
export async function buscarDocumentos(
  projectId: string,
  q: ConsultaDeDocumentos = {},
): Promise<{ documentos: DocumentoContable[]; total: number }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const res = await fetch(`${base(projectId)}/documentos?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { documentos: DocumentoContable[]; total: number };
}
