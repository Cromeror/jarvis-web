import type { CausacionSoporte } from '../../lib/causacion-soportes-api.js';

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
  leer: (doc: CausacionSoporte) => string;
}

/** Lo que haya en `procesamiento` bajo esa clave, como texto. Vacío si no está. */
function delJson(doc: CausacionSoporte, clave: string): string {
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
function conFallback(columna: string | number | null, doc: CausacionSoporte, clave: string): string {
  if (columna !== null && columna !== undefined && columna !== '') return String(columna);
  return delJson(doc, clave);
}

/**
 * LAS COLUMNAS, EN EL ORDEN DEL DOCUMENTO de diseño («Causaciones de Facturas —
 * Suite Contabilidad», §2 y §2.1).
 *
 * Reemplaza a una lista armada contra una versión anterior de ese documento, que
 * había quedado desfasada en cuatro puntos y cada uno era un dato equivocado en
 * pantalla:
 *
 * - **`cufe` y `cude` eran dos columnas y ahora son una** (`cufe_cude`). El
 *   documento lo dice explícito: «ante la DIAN no hay discriminación entre
 *   ambas — se tratan como un mismo identificador de validación». Cuál de las
 *   dos es se sabe por `tipo_documento`, no por en qué columna cayó.
 * - **Faltaban `valor_total` y `soporte_fiscal_valido_dian`**, que son dos de
 *   las quince que entran al asiento. La segunda es la que decide si el IVA es
 *   descontable.
 * - **`archivos_relacionados` y `paginas_unificadas` se eliminaron** (§2.2):
 *   eran dos formas de decir lo mismo y se normalizaron en tablas. Una columna
 *   que muestra `a.jpg||b.jpg` es un dato que ya no existe así.
 * - **`observaciones` pasó a `observaciones_ia`**, y el nombre importa: es de
 *   escritura exclusiva de la IA.
 *
 * El orden es el del CSV del documento, no uno propio: es el que el contador ya
 * conoce de mirar el archivo que hoy arma a mano.
 */

/**
 * LAS SIETE QUE SE DIBUJAN. El resto entra por «Agregar una columna…».
 *
 * Son las siete primeras del documento, y juntas contestan la pregunta de
 * identificación: qué es, de quién, cuándo, con qué número y con qué código de
 * validación. Las quince del asiento no se muestran de entrada porque causar es
 * el paso siguiente a reconocer, y una tabla de veintiún columnas no deja hacer
 * ni lo uno ni lo otro.
 *
 * La división NO es «lo importante y lo demás»: es la que el template distingue
 * en su menú — «qué de lo que hay quiero ver» (tildes) contra «qué más hay»
 * (agregar). Por eso el resto no nace escondido sino AFUERA de la tabla, y se
 * suma con una acción distinta.
 */
export const COLUMNAS_POR_DEFECTO = [
  'archivo',
  'tipo_documento',
  'fecha',
  'tercero_nombre',
  'tercero_nit_cc',
  'numero_documento',
  'cufe_cude',
];

export const COLUMNAS: ColumnaDoc[] = [
  // --- las siete de identificación (§2, columnas 1-7) ---
  { key: 'archivo', header: 'Archivo', leer: (d) => d.filename },
  { key: 'tipo_documento', header: 'Tipo documento', leer: (d) => conFallback(d.tipo, d, 'tipo_documento') },
  { key: 'fecha', header: 'Fecha', leer: (d) => conFallback(d.fecha_documento, d, 'fecha') },
  { key: 'tercero_nombre', header: 'Tercero', leer: (d) => conFallback(d.tercero, d, 'tercero_nombre') },
  { key: 'tercero_nit_cc', header: 'NIT / CC', leer: (d) => delJson(d, 'tercero_nit_cc') },
  { key: 'numero_documento', header: 'N° documento', leer: (d) => conFallback(d.numero, d, 'numero_documento') },
  /* UNA SOLA COLUMNA para CUFE y CUDE: ante la DIAN no se discriminan — son el
     mismo identificador de validación del sistema de facturación (Art. 616-1).
     Cuál de los dos es lo dice `tipo_documento`. */
  { key: 'cufe_cude', header: 'CUFE / CUDE', leer: (d) => delJson(d, 'cufe_cude') },

  // --- las del asiento (§2.1, «necesarias para causar») ---
  { key: 'descripcion', header: 'Descripción', leer: (d) => delJson(d, 'descripcion') },
  { key: 'cantidad', header: 'Cantidad', numerica: true, leer: (d) => delJson(d, 'cantidad') },
  { key: 'valor_unitario', header: 'Valor unitario', numerica: true, leer: (d) => delJson(d, 'valor_unitario') },
  { key: 'subtotal', header: 'Subtotal', numerica: true, leer: (d) => delJson(d, 'subtotal') },
  { key: 'iva', header: 'IVA', numerica: true, leer: (d) => delJson(d, 'iva') },
  { key: 'otros_impuestos', header: 'Otros impuestos', numerica: true, leer: (d) => delJson(d, 'otros_impuestos') },
  { key: 'valor_total', header: 'Valor total', numerica: true, leer: (d) => conFallback(d.monto, d, 'valor_total') },
  { key: 'forma_pago', header: 'Forma de pago', leer: (d) => delJson(d, 'forma_pago') },
  /* NO es un booleano: `PENDIENTE_VALIDAR_DIAN` hasta que se cruce contra el
     export de la DIAN. «Todavía no se verificó» y «la DIAN dice que no» son
     contablemente opuestos. */
  { key: 'soporte_fiscal_valido_dian', header: 'Soporte válido DIAN', leer: (d) => delJson(d, 'soporte_fiscal_valido_dian') },
  { key: 'cuenta_puc_sugerida', header: 'Cuenta PUC sugerida', leer: (d) => delJson(d, 'cuenta_puc_sugerida') },

  // --- trazabilidad y auditoría (§2.1, «no necesarias para causar») ---
  /* Escritura exclusiva de la IA, y el nombre lo dice. Es su conclusión para
     orientar al auditor por dónde empezar, no un dato a causar. */
  { key: 'observaciones_ia', header: 'Observaciones IA', leer: (d) => delJson(d, 'observaciones_ia') },
  { key: 'documento_valido_dian_trazado', header: 'Documento válido trazado', leer: (d) => delJson(d, 'documento_valido_dian_trazado') },
  { key: 'estado_trazabilidad', header: 'Estado trazabilidad', leer: (d) => delJson(d, 'estado_trazabilidad') },

  /* NUESTRA, no del documento: el estado del procesamiento del archivo, que es
     de la plataforma y no del asiento. */
  { key: 'procesamiento_estado', header: 'Procesamiento', leer: (d) => d.procesamiento_estado },
];
