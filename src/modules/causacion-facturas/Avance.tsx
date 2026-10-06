import React from 'react';
import { Icon } from '../../components/Icon.js';
import type { EtapaDeGrupo, ResumenDePeriodo } from '../../lib/causacion-documentos-api.js';

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
 * - `otra_operacion` son los COMPLEMENTARIOS: la remisión, la orden, el pago
 *   que respaldan un asiento sin generar uno propio. Respaldan trabajo, no lo
 *   generan; mezclarlos con lo pendiente infla la cuenta con algo que no se
 *   resuelve causándolo.
 *
 * Los tonos siguen la regla del template —«el tono sale del dato»—: sólo lo que
 * espera a una persona va en naranja. Lo que va a otro módulo lleva el acento,
 * que dice «otro destino», no «un problema»; pintarlo de naranja inventaría uno
 * que no hay.
 */
const GRUPOS: { id: EtapaDeGrupo; rot: string }[] = [
  { id: 'causadas', rot: 'Ya causadas' },
  { id: 'listas', rot: 'Listas para causar' },
  { id: 'revision', rot: 'Esperando al contador' },
  { id: 'sin_clasificar', rot: 'Sin analizar' },
  { id: 'otra_operacion', rot: 'Soportes' },
];

/**
 * EL NAVEGADOR DE PERÍODO — port de `periodo()` del template
 * (`accounting.js:1033-1045`, CSS `accounting.css:556-585`).
 *
 * VIVE EN LA TARJETA Y NO EN LA BARRA, y el template dice por qué: la tarjeta
 * es la que narra el período, así que el control que lo cambia tiene que estar
 * donde se lee el resultado y no dos cajas más arriba.
 *
 * El botón de «siguiente» se apaga en el período más nuevo que tenga
 * documentos: hacia adelante no hay nada que mirar, y un botón que no hace nada
 * enseña que los botones de esta pantalla a veces no responden.
 */
export function Periodo({
  etiqueta,
  alMover,
  haySiguiente,
}: {
  etiqueta: string;
  alMover: (delta: number) => void;
  haySiguiente: boolean;
}): React.ReactElement {
  return (
    <div className="sw-soportes__periodo" role="group" aria-label="Período">
      <button
        type="button"
        className="sw-soportes__pb"
        aria-label="Mes anterior"
        onClick={() => alMover(-1)}
      >
        <Icon name="left" />
      </button>
      <span className="sw-soportes__pm">{etiqueta}</span>
      <button
        type="button"
        className="sw-soportes__pb"
        aria-label="Mes siguiente"
        disabled={!haySiguiente}
        onClick={() => alMover(1)}
      >
        <Icon name="right" />
      </button>
    </div>
  );
}

export function Avance({
  resumen,
  periodo,
}: {
  /**
   * EL RESUMEN LO CUENTA EL SERVIDOR, sobre TODO el período.
   *
   * La tarjeta contaba acá, recorriendo los documentos que la tabla había
   * traído, y eso estaba mal dos veces: contaba una PÁGINA como si fuera el
   * período —con 800 documentos en el mes y 200 cargados, decía que falta un
   * cuarto de lo que falta— y contaba DOCUMENTOS SUELTOS, así que una factura
   * con su remisión y su pago figuraban como tres cosas por hacer cuando son
   * un asiento.
   *
   * Ahora cuenta GRUPOS, que es la unidad de trabajo, y lo hace el endpoint
   * `documentos/resumen` (ver `causacion-agrupacion.ts` en storage).
   */
  resumen: ResumenDePeriodo | null;
  /** El navegador de período. La tarjeta lo ALOJA; quién manda el mes es la vista. */
  periodo?: React.ReactNode;
}): React.ReactElement {
  const total = resumen?.total ?? 0;
  const tramos = GRUPOS.map((g) => ({ ...g, n: resumen?.por_etapa[g.id] ?? 0 })).filter((t) => t.n > 0);
  const causadas = resumen?.por_etapa.causadas ?? 0;

  /* LA FRASE DICE EL ESTADO, no el porcentaje. Tres variantes, como el
     template: no hay nada, está todo, o falta esto. */
  /* LA FRASE CUENTA ASIENTOS, NO PAPELES, y por eso dice «documentos a causar»
     y no «documentos»: una factura con su remisión y su pago es UNA cosa por
     hacer. El total de papeles está en `resumen.documentos` y se dice aparte —
     son dos cuentas ciertas de cosas distintas, y elegir una sola escondía la
     otra. */
  const frase =
    total === 0
      ? 'Todavía no hay documentos analizados.'
      : causadas === total
        ? `Los ${total} documentos a causar del período ya están causados.`
        : `${causadas} de ${total} documentos a causar ya están causados.`;

  const papeles = resumen?.documentos ?? 0;
  const pct = total ? Math.round((causadas / total) * 100) : 0;

  return (
    <section className="sw-raised sw-soportes__avance">
      <div className="sw-soportes__avTexto">
        <p className="sw-soportes__avFrase">{frase}</p>
        {/* Los papeles, sólo cuando son más que los asientos: con uno por
            documento la aclaración no agrega nada y repetir el mismo número
            con dos nombres hace dudar de cuál se está leyendo. */}
        {papeles > total ? (
          <p className="sw-soportes__avPapeles">
            {papeles} documentos en total — algunos van agrupados con los que están
            relacionados.
          </p>
        ) : null}
      </div>

      {/* El navegador va en la segunda columna de la grilla, que es donde el
          template lo pone (`'<div class=avTexto>…</div>' + periodo()`). */}
      {periodo}

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
