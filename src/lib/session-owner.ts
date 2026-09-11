import type { ChatSession } from './chat-api.js';

/**
 * De quién es una conversación, cuando no es tuya.
 *
 * POR QUÉ EXISTE. El backend ya devolvía la marca (`propia`) desde que se
 * cerró la fuga del listado, pero la web nunca leyó ese campo: un operador de
 * la instalación —que tiene `resource:manage_any` en todos los proyectos y por
 * eso ve las ajenas a propósito— las veía mezcladas con las suyas, sin nada
 * que las distinguiera. Visto desde la pantalla, eso es indistinguible de que
 * el filtro por persona no existiera.
 *
 * Mismo criterio que `session-workspace.ts`, y por eso vive al lado: lo
 * consumen tres vistas (la conversación abierta, el buscador global y el
 * historial del rail), y los casos borde —no hay dato, no hay dueño— se
 * testean mejor sin renderizar nada.
 */

export type SessionOwnerMarkKind = 'ajena' | 'huerfana';

export interface SessionOwnerMark {
  kind: SessionOwnerMarkKind;
  /** Texto corto para un badge. */
  label: string;
  /** Detalle para el title/tooltip. */
  detail: string;
}

/**
 * La marca a pintar, o `null` si no hay ninguna.
 *
 * Devuelve `null` en los dos casos en que marcar sería peor que no marcar:
 *
 * - **Es tuya** (`propia: true`) — el caso normal. Un badge "tuya" en cada fila
 *   es ruido permanente que además apaga la señal: lo excepcional deja de
 *   verse cuando todo está marcado.
 * - **No hay dato** (`propia` ausente) — un server viejo, o una lista que se
 *   pidió sin decir quién pregunta. Ahí "ajena" sería una afirmación inventada,
 *   y marcar todas las filas como ajenas asusta sin informar.
 *
 * La distinción entre ajena y huérfana importa porque son dos cosas distintas
 * de verdad: la segunda no es de nadie —la abrió una corrida de plan— y no hay
 * ninguna persona cuya privacidad estés mirando.
 */
export function sessionOwnerMark(
  session: Pick<ChatSession, 'propia' | 'owner_username'>,
): SessionOwnerMark | null {
  if (session.propia !== false) return null;
  const nombre = session.owner_username ?? null;
  if (!nombre) {
    return {
      kind: 'huerfana',
      label: 'Sin dueño',
      detail: 'No la abrió ninguna persona — es la conversación de una corrida de plan, o su usuario ya no existe.',
    };
  }
  return {
    kind: 'ajena',
    label: `de ${nombre}`,
    detail: `Esta conversación es de ${nombre}. La ves porque administrás recursos de otras personas en este proyecto, no porque sea tuya.`,
  };
}
