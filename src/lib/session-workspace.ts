import type { ChatSession } from './chat-api.js';
import type { ProjectReplica } from './project-replicas-api.js';

/**
 * En qué workspace corre cada conversación — el dato que hasta ahora no hacía
 * falta mostrar.
 *
 * Mientras todas las conversaciones corrían en el root del proyecto, el
 * directorio era una constante y pintarlo habría sido ruido. Desde que una
 * conversación se puede mover a una réplica, es lo único que le dice al
 * usuario si dos chats suyos están aislados o compartiendo el mismo disco —
 * y esa diferencia no se deduce de nada más en pantalla.
 *
 * Vive acá y no dentro de un componente porque lo consumen dos vistas (la
 * lista de conversaciones y la conversación abierta) y porque las reglas
 * tienen casos borde que conviene testear sin renderizar nada.
 */

export type SessionWorkspaceKind = 'base' | 'replica' | 'unknown';

export interface SessionWorkspace {
  kind: SessionWorkspaceKind;
  /** Texto corto para un badge. */
  label: string;
  /** Detalle para el title/tooltip — branch y path cuando se conocen. */
  detail: string;
}

/**
 * Réplicas indexadas por id, para resolver el `replica_id` de una sesión sin
 * recorrer listas en cada render.
 */
export function indexReplicasById(replicas: ProjectReplica[]): Map<string, ProjectReplica> {
  return new Map(replicas.map((r) => [r.id, r]));
}

/**
 * Sin `replica_id` es la base, y eso es un estado normal, no una carencia.
 *
 * El caso interesante es el tercero: la sesión apunta a una réplica que no
 * está en el índice (borrada, o de un proyecto que no cargamos). NO se
 * reporta como base. El backend ya falla el turno en esa situación
 * (resolveWorkspaceRoot), así que decir "Base" acá sería mentir dos veces:
 * sobre dónde corre y sobre que va a correr.
 */
export function sessionWorkspace(
  session: Pick<ChatSession, 'replica_id'>,
  replicasById: Map<string, ProjectReplica>,
): SessionWorkspace {
  const replicaId = session.replica_id ?? null;
  if (!replicaId) {
    return { kind: 'base', label: 'Base', detail: 'Corre en el directorio principal del proyecto' };
  }
  const replica = replicasById.get(replicaId);
  if (!replica) {
    return {
      kind: 'unknown',
      label: 'Réplica no disponible',
      detail: `Esta conversación está asignada a la réplica '${replicaId}', que ya no está disponible. El próximo turno va a fallar hasta que la muevas.`,
    };
  }
  return {
    kind: 'replica',
    label: replica.slug,
    detail: `${replica.branch} · ${replica.root_path}`,
  };
}

/** Una réplica a medio crear o rota no es un destino: el backend la rechaza. */
export function activeReplicas(replicas: ProjectReplica[]): ProjectReplica[] {
  return replicas.filter((r) => r.status === 'active');
}

/**
 * ¿Ofrecer "trabajar en otra réplica" en esta conversación?
 *
 * No, si no hay a dónde ir: una conversación en la base de un proyecto sin
 * réplicas activas no tiene ninguna elección que hacer, y abrir un diálogo con
 * una sola opción —la que ya está usando— es ofrecer una decisión vacía.
 *
 * Sí, en cambio, si la conversación YA está en una réplica aunque no queden
 * otras: volver a la base sigue siendo un destino válido, y es la única salida
 * de una conversación cuya réplica se rompió.
 */
export function canChooseWorkspace(
  session: Pick<ChatSession, 'replica_id'> | null,
  replicasOfProject: ProjectReplica[],
): boolean {
  if (!session) return false;
  if (session.replica_id) return true;
  return activeReplicas(replicasOfProject).length > 0;
}
