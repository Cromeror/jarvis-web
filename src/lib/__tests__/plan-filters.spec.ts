import { describe, it, expect } from 'vitest';
import { filterPlansByStatus, selectRailPlans, hasPlansHiddenFromRail, RAIL_PLAN_STATUSES } from '../plan-filters.js';
import type { PlanStatus, PlanSummary } from '../plans-api.js';

function plan(id: string, status: PlanStatus): PlanSummary {
  return {
    id,
    project_id: 'jarvis',
    session_id: null,
    title: `Plan ${id}`,
    context: '',
    architecture: '',
    status,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    approved_at: null,
  };
}

const ALL: PlanSummary[] = [
  plan('d', 'draft'),
  plan('a', 'approved'),
  plan('r', 'running'),
  plan('done', 'done'),
  plan('f', 'failed'),
  plan('arch', 'archived'),
];

describe('filterPlansByStatus', () => {
  it('deja solo los estados pedidos', () => {
    expect(filterPlansByStatus(ALL, ['draft', 'failed']).map((p) => p.id)).toEqual(['d', 'f']);
  });

  it('trata la lista vacía como "sin filtro", no como "ningún estado"', () => {
    // Es el multi-select de PlansPage sin nada tildado: mostrar todo, no nada.
    expect(filterPlansByStatus(ALL, [])).toHaveLength(ALL.length);
  });

  it('no muta el array original', () => {
    const copy = [...ALL];
    filterPlansByStatus(ALL, ['draft']);
    expect(ALL).toEqual(copy);
  });
});

describe('selectRailPlans', () => {
  it('deja borradores y aprobados, y oculta todo lo ya ejecutado', () => {
    expect(selectRailPlans(ALL).map((p) => p.id)).toEqual(['d', 'a']);
  });

  it('oculta archived — no es un plan pendiente de acción', () => {
    expect(selectRailPlans([plan('arch', 'archived')])).toEqual([]);
  });

  it('el subconjunto del rail es exactamente draft + approved', () => {
    expect(RAIL_PLAN_STATUSES).toEqual(['draft', 'approved']);
  });
});

describe('hasPlansHiddenFromRail', () => {
  it('es true cuando hay planes pero todos quedan filtrados', () => {
    // El caso que necesita un texto distinto en el estado vacío: no es que el
    // proyecto no tenga planes, es que ya se ejecutaron todos.
    expect(hasPlansHiddenFromRail([plan('r', 'running'), plan('done', 'done')])).toBe(true);
  });

  it('es false cuando el proyecto no tiene ningún plan', () => {
    expect(hasPlansHiddenFromRail([])).toBe(false);
  });

  it('es false cuando queda al menos un plan visible', () => {
    expect(hasPlansHiddenFromRail([plan('d', 'draft'), plan('done', 'done')])).toBe(false);
  });
});
