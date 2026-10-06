import type { DocumentoContable, Extraccion } from '../../lib/causacion-documentos-api.js';

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
  /** La clave del extractor. Es también la de la columna en pantalla. */
  key: string;
  header: string;
  /** Alineada a la derecha: los importes se comparan de un vistazo por la unidad. */
  numerica?: boolean;
  leer: (doc: DocumentoContable) => string;
}

/** Un valor del asiento como texto. Vacío si no se leyó: un campo sin dato se deja VACÍO. */
function delAsiento(doc: DocumentoContable, clave: keyof Extraccion): string {
  const valor = doc.extraccion?.[clave];
  if (valor === undefined || valor === null || valor === '') return '';
  return String(valor);
}

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
  'archivos',
  'estado',
  'tipo_documento',
  'fecha',
  'tercero_nombre',
  'numero_documento',
  'cufe_cude',
];

export const COLUMNAS: ColumnaDoc[] = [
  /* LA FILA ES UN DOCUMENTO, no un archivo: puede tener varias páginas. Por eso
     la primera columna cuenta en vez de nombrar — mostrar sólo el nombre de la
     primera escondería que hay más. */
  {
    key: 'archivos',
    header: 'Contenido',
    /**
     * UN RESUMEN, NO UNA LISTA: «3 páginas · 2 documentos».
     *
     * Se llamaba «Archivos» y mostraba el nombre del primero con un `+N`, que
     * decía dos cosas mal. La primera: el nombre de archivo no identifica nada
     * —para eso están tipo, fecha, tercero y número, que son columnas— y en
     * cambio se lleva el ancho. La segunda y peor: con un documento RELACIONADO
     * el `+N` se leía como una página más, y no lo es.
     *
     * **Las dos cuentas son poblaciones distintas y por eso se nombran las dos.**
     * Las páginas son el MISMO papel fotografiado varias veces: un documento,
     * un asiento (`agrupar` en el README del módulo). Los relacionados son OTROS
     * documentos, cada uno con su clasificación, su CUFE y su estado
     * (`relacionar`, que no toca los archivos de nadie). Tres páginas son un
     * asiento; tres relacionados son cuatro documentos.
     */
    leer: (d) => {
      const partes: string[] = [];
      if (d.archivos.length > 0) {
        partes.push(d.archivos.length === 1 ? '1 página' : `${d.archivos.length} páginas`);
      }
      if (d.relaciones.length > 0) {
        partes.push(d.relaciones.length === 1 ? '1 documento' : `${d.relaciones.length} documentos`);
      }
      // Sin archivos y sin vínculos no hay nada que resumir, y la celda vacía
      // es lo que el template hace con un dato que no existe.
      return partes.join(' · ');
    },
  },
  /* EL EJE ÚNICO. Antes eran dos columnas —`estado_trazabilidad` y
     `procesamiento_estado`— que contestaban lo mismo con distinto vocabulario. */
  { key: 'estado', header: 'Estado', leer: (d) => d.estado },
  { key: 'clasificacion', header: 'Clasificación', leer: (d) => d.clasificacion.clasificacion ?? '' },

  // --- las de identificación (§2, columnas 1-7) ---
  { key: 'tipo_documento', header: 'Tipo documento', leer: (d) => delAsiento(d, 'tipo_documento') },
  { key: 'fecha', header: 'Fecha', leer: (d) => delAsiento(d, 'fecha') },
  { key: 'tercero_nombre', header: 'Tercero', leer: (d) => delAsiento(d, 'tercero_nombre') },
  { key: 'tercero_nit_cc', header: 'NIT / CC', leer: (d) => delAsiento(d, 'tercero_nit_cc') },
  { key: 'numero_documento', header: 'N° documento', leer: (d) => delAsiento(d, 'numero_documento') },
  /* UNA SOLA COLUMNA para CUFE y CUDE: ante la DIAN no se discriminan — son el
     mismo identificador de validación del sistema de facturación (Art. 616-1).
     Cuál de los dos es lo dice `tipo_documento`. */
  { key: 'cufe_cude', header: 'CUFE / CUDE', leer: (d) => d.trazabilidad.cufe_cude ?? '' },

  // --- las del asiento (§2.1, «necesarias para causar») ---
  { key: 'descripcion', header: 'Descripción', leer: (d) => delAsiento(d, 'descripcion') },
  { key: 'cantidad', header: 'Cantidad', numerica: true, leer: (d) => delAsiento(d, 'cantidad') },
  { key: 'valor_unitario', header: 'Valor unitario', numerica: true, leer: (d) => delAsiento(d, 'valor_unitario') },
  { key: 'subtotal', header: 'Subtotal', numerica: true, leer: (d) => delAsiento(d, 'subtotal') },
  { key: 'iva', header: 'IVA', numerica: true, leer: (d) => delAsiento(d, 'iva') },
  { key: 'otros_impuestos', header: 'Otros impuestos', numerica: true, leer: (d) => delAsiento(d, 'otros_impuestos') },
  { key: 'valor_total', header: 'Valor total', numerica: true, leer: (d) => delAsiento(d, 'valor_total') },
  { key: 'forma_pago', header: 'Forma de pago', leer: (d) => delAsiento(d, 'forma_pago') },
  /* NO es un booleano: `PENDIENTE_VALIDAR_DIAN` hasta que se cruce contra el
     export de la DIAN. «Todavía no se verificó» y «la DIAN dice que no» son
     contablemente opuestos. */
  { key: 'soporte_fiscal_valido_dian', header: 'Soporte válido DIAN', leer: (d) => delAsiento(d, 'soporte_fiscal_valido_dian') },
  { key: 'cuenta_puc_sugerida', header: 'Cuenta PUC sugerida', leer: (d) => delAsiento(d, 'cuenta_puc_sugerida') },

  // --- trazabilidad y auditoría (§2.1, «no necesarias para causar») ---
  /* Escritura exclusiva de la IA, y el nombre lo dice. Es su conclusión para
     orientar al auditor por dónde empezar, no un dato a causar. */
  { key: 'observaciones_ia', header: 'Observaciones IA', leer: (d) => d.trazabilidad.observaciones_ia ?? '' },
  {
    key: 'documento_valido_dian_trazado',
    header: 'Documento válido trazado',
    leer: (d) => d.trazabilidad.documento_valido_dian_trazado.join(', '),
  },
];
