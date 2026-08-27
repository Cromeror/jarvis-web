import type { PlanStatus, PlanSummary } from './plans-api.js';

/**
 * Filtrado de planes por estado — un solo lugar, porque hay dos consumidores
 * con la misma semántica y distintos disparadores: el multi-select de estados
 * de PlansPage (elección del usuario) y el subconjunto fijo del rail de Chats.
 *
 * `plans-api.ts` sabe pedirle al backend un subconjunto de estados
 * (`listPlans(projectId, ['draft','approved'])`); esto es la otra mitad, para
 * cuando un mismo fetch alimenta más de una vista y filtrar en el servidor
 * dejaría a las otras sin datos.
 */

/**
 * Los estados que muestra la opción "Planes" del rail de Chats: los que todavía
 * piden algo del usuario — revisar un borrador, lanzar un aprobado.
 *
 * Quedan afuera los ya ejecutados (running/done/failed), que tienen su propia
 * opción "Ejecuciones", y `archived`, que es explícitamente algo que se sacó de
 * encima. Sin esto "Planes" era la unión de las tres cosas y un borrador nuevo
 * aparecía enterrado abajo de meses de corridas.
 */
export const RAIL_PLAN_STATUSES: PlanStatus[] = ['draft', 'approved'];

/**
 * Deja los planes cuyo estado esté en `statuses`. Una lista vacía significa
 * "sin filtro" y devuelve todo — es lo que espera un multi-select donde no se
 * tildó nada, y coincide con cómo el backend lee un `?status=` vacío.
 */
export function filterPlansByStatus<T extends { status: PlanStatus }>(plans: T[], statuses: PlanStatus[]): T[] {
  if (statuses.length === 0) return plans;
  return plans.filter((plan) => statuses.includes(plan.status));
}

/** El subconjunto que muestra el rail de Chats — `filterPlansByStatus` con RAIL_PLAN_STATUSES. */
export function selectRailPlans<T extends { status: PlanStatus }>(plans: T[]): T[] {
  return filterPlansByStatus(plans, RAIL_PLAN_STATUSES);
}

/** Sirve para distinguir "no hay planes" de "hay, pero todos ejecutados" en el estado vacío del rail. */
export function hasPlansHiddenFromRail(plans: PlanSummary[]): boolean {
  return plans.length > 0 && selectRailPlans(plans).length === 0;
}

/**
 * Los estados que muestra la opción "Ejecuciones" del rail: los planes que ya
 * se lanzaron. Complemento exacto de RAIL_PLAN_STATUSES sobre lo lanzable —
 * `archived` queda afuera de las dos.
 */
export const RAIL_EXECUTION_STATUSES: PlanStatus[] = ['running', 'failed', 'done'];

/**
 * Cuántas filas de ejecución entran en el rail. El recorte es por CONTEO y no
 * por alto máximo con scroll propio: el rail es una barra de señal, y una lista
 * con scroll interno esconde el mismo inventario en vez de reducirlo. Lo que no
 * entra se apila en una sola fila que lleva a /plans, donde hay ancho para
 * inventario.
 */
export const RAIL_EXECUTION_LIMIT = 5;

export interface RailExecutionSelection<T> {
  /** Las que se muestran, ya ordenadas por relevancia. Nunca más de `limit`. */
  items: T[];
  /** Las que quedaron afuera del tope — 0 significa que no hay nada que apilar. */
  hiddenCount: number;
}

/**
 * Prioridad de una ejecución dentro del rail. Más bajo = más arriba.
 *
 * El criterio es "vivo y no visto": lo que está pasando ahora primero, después
 * lo que se rompió y todavía no mirás, y al final lo que ya terminó bien (que
 * es lo que se acumula: en jarvis-dev, 8 de 11). NO se descarta nada por
 * antigüedad — un `done` viejo no está filtrado, simplemente pierde el lugar
 * contra algo más relevante. El único filtro duro es el tope.
 */
function executionRank(status: PlanStatus, seen: boolean): number {
  if (status === 'running') return 0;
  if (status === 'failed') return seen ? 2 : 1;
  return 3;
}

function newestFirst(a: { updated_at: string }, b: { updated_at: string }): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

/**
 * Elige qué ejecuciones muestra el rail y cuántas quedaron afuera.
 *
 * Antes esto era un `filter` por estado sin tope dentro de ChatPage: mostraba
 * todos los planes lanzados del proyecto, para siempre, y como el scroll del
 * rail es del acordeón y no de la tarjeta (ver RailListPanel), esa lista
 * empujaba las otras opciones fuera del viewport. Vive acá y no en el useMemo
 * porque es el mismo tipo de criterio que `selectRailPlans` y se testea igual.
 *
 * `seenIds` es opcional a propósito: sin él, un `failed` cuenta como no visto
 * (lo más ruidoso pero nunca lo que oculta un problema).
 */
export function selectRailExecutions<T extends { id: string; status: PlanStatus; updated_at: string }>(
  plans: T[],
  options: { limit?: number; seenIds?: ReadonlySet<string> } = {},
): RailExecutionSelection<T> {
  const { limit = RAIL_EXECUTION_LIMIT, seenIds } = options;
  const candidates = filterPlansByStatus(plans, RAIL_EXECUTION_STATUSES);
  const ranked = [...candidates].sort(
    (a, b) =>
      executionRank(a.status, seenIds?.has(a.id) ?? false) - executionRank(b.status, seenIds?.has(b.id) ?? false) ||
      newestFirst(a, b),
  );
  return { items: ranked.slice(0, limit), hiddenCount: Math.max(0, ranked.length - limit) };
}

/**
 * Cuántas ejecuciones piden atención ahora — el badge del nav item. Es un
 * subconjunto de lo que muestra el panel, no su largo: un `done` es
 * información, no un pendiente, así que no infla el contador.
 */
export function countRailExecutionsNeedingAttention<T extends { id: string; status: PlanStatus }>(
  plans: T[],
  seenIds?: ReadonlySet<string>,
): number {
  return plans.filter((p) => p.status === 'running' || (p.status === 'failed' && !(seenIds?.has(p.id) ?? false))).length;
}
