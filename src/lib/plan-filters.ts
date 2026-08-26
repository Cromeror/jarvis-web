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
