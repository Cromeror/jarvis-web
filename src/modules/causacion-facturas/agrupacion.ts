import type { DocumentoContable } from '../../lib/causacion-documentos-api.js';

/**
 * UNA FILA POR GRUPO, NO POR DOCUMENTO.
 *
 * Dos documentos atados con `relacionar` —una factura y su remisión, una factura
 * y su pago— son UN trabajo para quien causa, así que ocupan una línea. Tres
 * atados, también una. Antes cada uno tenía la suya y el vínculo sólo se veía
 * entrando al visor: la tabla mostraba tres renglones donde hay un asiento.
 *
 * ## Esto NO es lo mismo que agrupar páginas
 *
 * El README del módulo lo separa en «Agrupar no es relacionar», y la distinción
 * manda acá:
 *
 * - `agrupar` junta **páginas del mismo papel**. Ya se veían en una línea: son
 *   archivos de un documento, no documentos.
 * - `relacionar` ata **documentos distintos**, y cada uno conserva su
 *   clasificación, su CUFE y su estado. Se muestran en una línea **sin dejar de
 *   ser documentos**: el grupo no los absorbe, sólo decide qué se dibuja.
 *
 * ## Quién encabeza
 *
 * 1. El `PRINCIPAL`, si el grupo tiene uno: es el que origina el asiento.
 * 2. Si no hay ninguno, **el primero que aparezca** en la lista. Ese caso no es
 *    un empate cualquiera: un grupo sin principal es un documento incompleto —la
 *    IA ató dos papeles y no pudo decidir cuál causa— y lo que se espera es que
 *    el contador lo complete. Se muestra igual, encabezado por alguno, porque
 *    esconderlo hasta que esté completo es esconder justo el que necesita mano.
 *
 * **El orden de la lista es el del servidor** (`created_at DESC`), así que «el
 * primero» es estable entre pintadas: con dos documentos sin clasificar, el que
 * encabeza no cambia de un refresh a otro.
 *
 * ## Los vínculos que salen de lo cargado
 *
 * Una relación puede apuntar a un documento que no está en la página —cruzan
 * períodos: una factura de marzo pagada en abril—. Ese id no se pierde: va en
 * `idsAusentes`, se cuenta en el resumen de la celda y el visor lo pide cuando
 * lo abren. Contar sólo lo que está cargado haría que el mismo documento dijera
 * «1 documento» o «2» según en qué mes estuviera parado el usuario.
 */
export interface GrupoDeDocumentos {
  /** El que ocupa la fila. */
  duenio: DocumentoContable;
  /** Todos los del grupo que están cargados, el dueño incluido y primero. */
  miembros: DocumentoContable[];
  /** Los del grupo que NO están cargados. Se cuentan, y el visor los resuelve. */
  idsAusentes: string[];
}

/** Cuántos documentos tiene el grupo además del que encabeza. */
export function otrosDelGrupo(g: GrupoDeDocumentos): number {
  return g.miembros.length - 1 + g.idsAusentes.length;
}

/**
 * Arma los grupos recorriendo el grafo de relaciones.
 *
 * **Es transitivo a propósito**: si A está atado a B y B a C, los tres son un
 * grupo aunque A y C no se nombren entre sí. Mirar sólo las relaciones directas
 * daría dos filas para lo que es una sola cadena de papeles, y peor, cuál de las
 * dos dependería de cuál documento se mirara primero.
 */
export function agrupar(documentos: DocumentoContable[]): GrupoDeDocumentos[] {
  const porId = new Map(documentos.map((d) => [d.id, d]));
  const vistos = new Set<string>();
  const grupos: GrupoDeDocumentos[] = [];

  for (const doc of documentos) {
    if (vistos.has(doc.id)) continue;

    // Recorrido en anchura desde este documento: junta todo lo alcanzable.
    const miembros: DocumentoContable[] = [];
    const ausentes = new Set<string>();
    const cola = [doc.id];
    const enCola = new Set<string>([doc.id]);

    while (cola.length > 0) {
      const id = cola.shift() as string;
      const actual = porId.get(id);
      if (!actual) {
        // Alcanzable pero fuera de lo cargado. Sus propias relaciones no se
        // pueden recorrer —no tenemos la fila— así que el grupo se corta acá.
        ausentes.add(id);
        continue;
      }
      vistos.add(id);
      miembros.push(actual);
      for (const r of actual.relaciones) {
        const otro = r.documento_id === id ? r.documento_relacionado_id : r.documento_id;
        if (enCola.has(otro)) continue;
        enCola.add(otro);
        cola.push(otro);
      }
    }

    /* EL PRINCIPAL ENCABEZA; si no hay, el primero. `miembros[0]` es el
       documento por el que se entró, que es el primero de la lista entre los de
       su grupo —el `for` los recorre en orden y saltea los ya vistos—, así que
       el default ya es «el primero que aparece» sin tener que ordenarlo. */
    const principal = miembros.find((m) => m.clasificacion.clasificacion === 'PRINCIPAL');
    const duenio = principal ?? (miembros[0] as DocumentoContable);

    grupos.push({
      duenio,
      // El dueño primero: la lista del visor se lee desde él.
      miembros: [duenio, ...miembros.filter((m) => m.id !== duenio.id)],
      idsAusentes: [...ausentes],
    });
  }

  return grupos;
}
