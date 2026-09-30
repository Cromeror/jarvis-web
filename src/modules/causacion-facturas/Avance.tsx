import React from 'react';
import type { DocumentoDeAvance } from '../../lib/causacion-documentos-api.js';

/**
 * LA TARJETA DE AVANCE — port de `tarjetaDeAvance()` / `pintarAvance()` del
 * template (`src/accounting/accounting.js:943-1034`, CSS `accounting.css:507`).
 *
 * Contesta UNA pregunta: **¿cuánto trabajo me queda?** Por eso cuenta
 * DOCUMENTOS y no archivos, y por eso no sigue al filtro de la tabla — el
 * template lo tiene anotado: siguiéndolo, «17 de 28» se convierte en «1 de 1»
 * al elegir un proveedor, y las dos cajas terminan diciendo lo mismo. Quieta
 * mientras la tabla de abajo se achica, es el ancla contra la cual se lee el
 * recorte.
 *
 * Tres decisiones del template que se copian tal cual:
 *
 * - **Los tramos en cero no se dibujan.** Un tramo de ancho cero igual ocupa su
 *   filete y deja una rayita que no significa nada.
 * - **La barra no se anima.** Cambia cuando cambia el contenido, no es una
 *   transición; animarla sería animar el reparto de una fila, o sea layout.
 * - **Leyenda, no globo.** Cinco colores sin decodificar no dicen nada, y un
 *   `title` hay que descubrirlo con el puntero y con teclado no existe. Cada
 *   entrada lleva su cuadrito del color del tramo y su número: la barra da la
 *   proporción, la leyenda da la cifra.
 */

/**
 * LOS CINCO GRUPOS, y por qué son cinco y no los tres del template.
 *
 * El template reparte por «cuánto le falta a una factura». Acá la primera
 * pregunta no es cuánto le falta sino **de quién es el trabajo**, y eso parte
 * en tres lo que allá era una sola cosa pendiente:
 *
 * - `revision` es MÍO: la IA ya dijo qué leyó y falta que el contador lo mire.
 * - `sin_clasificar` es DE LA MÁQUINA: todavía no dijo ni qué tipo de documento
 *   es. No es una falta de nadie, es la cola de análisis.
 * - `otra_operacion` es DE OTRO MÓDULO: nómina, tesorería, un traslado. Se
 *   causa, pero no acá (§2.2). Mezclarlo con lo pendiente infla el trabajo
 *   propio con algo que no se resuelve en esta pantalla.
 *
 * Los tonos siguen la regla del template —«el tono sale del dato»—: sólo lo que
 * espera a una persona va en naranja. Lo que va a otro módulo lleva el acento,
 * que dice «otro destino», no «un problema»; pintarlo de naranja inventaría uno
 * que no hay.
 */
const GRUPOS = [
  { id: 'causadas', rot: 'Ya causadas' },
  { id: 'listas', rot: 'Listas para causar' },
  { id: 'revision', rot: 'Esperando al contador' },
  { id: 'sin_clasificar', rot: 'Sin analizar' },
  { id: 'otra_operacion', rot: 'Para reclasificar' },
] as const;

type GrupoId = (typeof GRUPOS)[number]['id'];

export function contar(documentos: DocumentoDeAvance[]): Record<GrupoId, number> {
  const c: Record<GrupoId, number> = {
    causadas: 0,
    listas: 0,
    revision: 0,
    sin_clasificar: 0,
    otra_operacion: 0,
  };
  for (const d of documentos) {
    const cl = d.clasificacion?.clasificacion;
    if (cl === 'OTRA_OPERACION') {
      c.otra_operacion++;
      continue;
    }
    if (cl === 'PENDIENTE_CLASIFICAR') {
      c.sin_clasificar++;
      continue;
    }
    /* CAUSACION_CONTABLE. Sin extracción todavía es un documento que ya se sabe
       que se causa acá pero del que no se leyó un solo campo: es trabajo que
       espera, igual que un borrador de la IA sin revisar. */
    const ec = d.extraccion?.estado_causacion;
    if (ec === 'CAUSADO_EN_CONTABLE') c.causadas++;
    else if (ec === 'VALIDADO_AUDITOR') c.listas++;
    else c.revision++;
  }
  return c;
}

export function Avance({ documentos }: { documentos: DocumentoDeAvance[] }): React.ReactElement {
  const total = documentos.length;
  const c = contar(documentos);
  const tramos = GRUPOS.map((g) => ({ ...g, n: c[g.id] })).filter((t) => t.n > 0);

  /* LA FRASE DICE EL ESTADO, no el porcentaje. Tres variantes, como el
     template: no hay nada, está todo, o falta esto. */
  const frase =
    total === 0
      ? 'Todavía no hay documentos analizados.'
      : c.causadas === total
        ? `Los ${total} documentos del período ya están causados.`
        : `${c.causadas} de ${total} documentos ya están causados.`;

  const pct = total ? Math.round((c.causadas / total) * 100) : 0;

  return (
    <section className="sw-raised sw-soportes__avance">
      <div className="sw-soportes__avTexto">
        <p className="sw-soportes__avFrase">{frase}</p>
      </div>

      {total > 0 ? (
        <>
          <div
            className="sw-soportes__barraT"
            role="img"
            aria-label={`${pct}% causado`}
          >
            {tramos.map((t) => (
              <span
                key={t.id}
                className="sw-soportes__tramo"
                data-e={t.id}
                style={{ flexGrow: t.n }}
              />
            ))}
          </div>

          <ul className="sw-soportes__leyenda">
            {tramos.map((t) => (
              <li key={t.id}>
                <span className="sw-soportes__punto" data-e={t.id} aria-hidden="true" />
                {t.rot}
                <span className="sw-soportes__leyN">{t.n}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
