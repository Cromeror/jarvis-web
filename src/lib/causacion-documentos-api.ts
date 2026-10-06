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
 * EL VOCABULARIO CERRADO de `tipo_documento`, espejo de
 * `CAUSACION_TIPOS_DOCUMENTO` en `@jarvis/storage`.
 *
 * Está duplicado porque son dos repos, igual que `EstadoDocumento` y
 * `Clasificacion` acá arriba. Lo que lo hace sostenible es que del otro lado NO
 * es una convención: la columna tiene un `CHECK` (migración
 * `TipoDocumentoCerrado`) y el repositorio valida antes de escribir, así que un
 * valor que no esté en esta lista **no puede existir en la base**. Si algún día
 * se agrega uno, el síntoma acá es una fila cuyo tipo no matchea ninguna opción
 * del combo — no datos corruptos.
 *
 * Por eso el combo se arma con esto y no preguntándole a los datos qué valores
 * hay: es lo que hace el template con los documentos de su país, y es lo que
 * evita que dos formas de la misma palabra sean dos opciones.
 */
export const TIPOS_DE_DOCUMENTO = [
  'Factura electronica',
  'Documento equivalente',
  'Comprobante de transferencia',
  'Remision',
  'Otro',
] as const;

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

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
  /**
   * Suma al recorte del período los documentos que TODAVÍA no tienen uno.
   *
   * La pantalla lo manda siempre que filtra por período, y es la única
   * diferencia con el template: allá el período sale de la fecha de la factura
   * y toda factura tiene una, acá `period` lo escribe la IA al analizar. Sin
   * esto, subir veinte documentos y mirar el mes corriente da una tabla vacía —
   * justo el trabajo que acaba de entrar.
   */
  incluir_sin_periodo?: boolean;
  estado?: EstadoDocumento;
  clasificacion?: Clasificacion;
  /** El NIT es la clave del tercero; el nombre es sólo la etiqueta del combo. */
  tercero_nit_cc?: string;
  tipo_documento?: string;
  texto?: string;
  limit?: number;
  offset?: number;
}

/** Un período con documentos, para el navegador de la tarjeta de avance. */
export interface PeriodoConDocumentos {
  periodo: string;
  estado: string;
  documentos: number;
}

/**
 * CON QUÉ SE POBLA EL COMBO DE TERCEROS.
 *
 * El template deriva su lista de proveedores recorriendo las facturas que tiene
 * en memoria, que allá son todas. Acá la tabla pagina, así que hacer lo mismo
 * daría las opciones de UNA página: el combo ofrecería menos valores de los que
 * hay, y por el resto no se podría filtrar nunca. Los cuenta el servidor sobre
 * el mismo recorte que la tabla.
 *
 * SÓLO TERCEROS. El tipo de documento no se consulta: su vocabulario es cerrado
 * (`TIPOS_DE_DOCUMENTO`, con `CHECK` en la base), así que la lista se sabe sin
 * preguntar. Un tercero, en cambio, es un universo abierto — aparece uno nuevo
 * con cada proveedor.
 */
export interface FacetasDeDocumentos {
  terceros: { nit: string | null; nombre: string | null; documentos: number }[];
}

export async function listarPeriodos(projectId: string): Promise<PeriodoConDocumentos[]> {
  const res = await fetch(`${base(projectId)}/periodos`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { periodos: PeriodoConDocumentos[] }).periodos;
}

export async function facetasDeDocumentos(
  projectId: string,
  q: { periodo?: string; incluir_sin_periodo?: boolean } = {},
): Promise<FacetasDeDocumentos> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const res = await fetch(`${base(projectId)}/documentos/facetas?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as FacetasDeDocumentos;
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

/**
 * UN documento por id, con su asiento y su trazabilidad.
 *
 * Lo usa el visor para resolver un documento RELACIONADO que la tabla no tiene
 * cargado: los vínculos cruzan períodos y páginas —una factura de marzo puede
 * estar pagada por un comprobante de abril— así que buscarlos sólo entre las
 * filas visibles los mostraría a veces sí y a veces no, según dónde estuviera
 * parado el usuario. Un vínculo que aparece y desaparece es peor que no tenerlo.
 */
export async function getDocumento(projectId: string, documentoId: string): Promise<DocumentoContable> {
  const res = await fetch(`${base(projectId)}/documentos/${encodeURIComponent(documentoId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { documento: DocumentoContable }).documento;
}

/**
 * **UNA FILA DE LA TABLA: un grupo de documentos relacionados.**
 *
 * La agrupación la hace el SERVIDOR (`causacion-agrupacion.ts` en storage) y no
 * la pantalla, por dos razones que están escritas allá y que conviene conocer
 * desde acá: el resumen de la tarjeta cuenta sobre TODO el período y la tabla
 * muestra una página —agrupado en el cliente, la tarjeta sólo podía contar lo
 * cargado—, y la agrupación es del dominio: contesta cuántos asientos quedan
 * por auditar, que es la misma pregunta que haría una tool.
 */
export interface GrupoDeDocumentos {
  /** El que ocupa la fila: el `PRINCIPAL`, o el primero si el grupo no tiene. */
  duenio: DocumentoContable;
  /** Todos los del grupo, el dueño incluido y primero. */
  miembros: DocumentoContable[];
}

/** En qué etapa está un grupo. Espejo de `CausacionEtapaDeGrupo` en storage. */
export type EtapaDeGrupo = 'causadas' | 'listas' | 'revision' | 'sin_clasificar' | 'otra_operacion';

/**
 * Lo que muestra la tarjeta de avance: **grupos**, no documentos.
 *
 * `documentos` viaja aparte para no tener que elegir una sola verdad — son dos
 * cuentas ciertas de cosas distintas, y la tarjeta narra el trabajo (grupos).
 */
export interface ResumenDePeriodo {
  total: number;
  documentos: number;
  por_etapa: Record<EtapaDeGrupo, number>;
}

/**
 * LA TABLA. Paginada POR GRUPOS: `total` son grupos, porque es lo que el
 * paginador cuenta.
 */
export async function buscarGrupos(
  projectId: string,
  q: ConsultaDeDocumentos = {},
): Promise<{ grupos: GrupoDeDocumentos[]; total: number; documentos: number }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const res = await fetch(`${base(projectId)}/documentos/grupos?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { grupos: GrupoDeDocumentos[]; total: number; documentos: number };
}

/**
 * LA TARJETA. Sobre TODO el recorte, sin paginar — y se le manda el período
 * SIN los filtros: narra el período, no lo que se está mirando.
 */
export async function resumenDePeriodo(
  projectId: string,
  q: { periodo?: string; incluir_sin_periodo?: boolean } = {},
): Promise<ResumenDePeriodo> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const res = await fetch(`${base(projectId)}/documentos/resumen?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ResumenDePeriodo;
}
