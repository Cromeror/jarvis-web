import { describe, it, expect } from 'vitest';
import {
  filterPlansByStatus,
  selectRailPlans,
  hasPlansHiddenFromRail,
  selectRailExecutions,
  countRailExecutionsNeedingAttention,
  RAIL_PLAN_STATUSES,
  RAIL_EXECUTION_LIMIT,
} from '../plan-filters.js';
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

/** Como `plan`, pero con fecha propia: el orden dentro de un mismo rango la usa. */
function execPlan(id: string, status: PlanStatus, day: number): PlanSummary {
  const iso = `2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  return { ...plan(id, status), created_at: iso, updated_at: iso };
}

describe('selectRailExecutions', () => {
  it('deja afuera lo que no se lanzó (draft/approved/archived)', () => {
    const { items } = selectRailExecutions(ALL);
    expect(items.map((p) => p.id)).toEqual(['r', 'f', 'done']);
  });

  it('ordena por relevancia: corriendo, después lo que falló, después lo terminado', () => {
    const sel = selectRailExecutions([
      execPlan('done-nuevo', 'done', 20),
      execPlan('failed-viejo', 'failed', 1),
      execPlan('corriendo', 'running', 2),
    ]);
    expect(sel.items.map((p) => p.id)).toEqual(['corriendo', 'failed-viejo', 'done-nuevo']);
  });

  it('un running entra aunque haya 5 done más nuevos — el tope no lo desplaza', () => {
    const plans = [
      execPlan('viejo-corriendo', 'running', 1),
      ...[10, 11, 12, 13, 14].map((d) => execPlan(`done-${d}`, 'done', d)),
    ];
    const sel = selectRailExecutions(plans);
    expect(sel.items).toHaveLength(RAIL_EXECUTION_LIMIT);
    expect(sel.items[0]!.id).toBe('viejo-corriendo');
    expect(sel.hiddenCount).toBe(1);
  });

  it('apila en hiddenCount lo que pasa del tope, sin filtrar por antigüedad', () => {
    // Los 8 done de jarvis-dev: el más viejo es de julio y sigue siendo
    // candidato — pierde el lugar por relevancia, no por fecha.
    const plans = Array.from({ length: 11 }, (_, i) => execPlan(`p${i}`, 'done', i + 1));
    const sel = selectRailExecutions(plans);
    expect(sel.items).toHaveLength(5);
    expect(sel.hiddenCount).toBe(6);
  });

  it('respeta un límite explícito', () => {
    const plans = [execPlan('a', 'running', 3), execPlan('b', 'running', 2), execPlan('c', 'running', 1)];
    expect(selectRailExecutions(plans, { limit: 2 })).toMatchObject({ hiddenCount: 1 });
  });

  it('baja el failed ya visto por debajo del no visto', () => {
    const plans = [execPlan('visto', 'failed', 20), execPlan('nuevo', 'failed', 1)];
    const sel = selectRailExecutions(plans, { seenIds: new Set(['visto']) });
    expect(sel.items.map((p) => p.id)).toEqual(['nuevo', 'visto']);
  });

  it('sin seenIds trata todo failed como no visto', () => {
    const sel = selectRailExecutions([execPlan('f', 'failed', 1), execPlan('d', 'done', 20)]);
    expect(sel.items.map((p) => p.id)).toEqual(['f', 'd']);
  });

  it('no muta el array original', () => {
    const plans = [execPlan('d', 'done', 20), execPlan('r', 'running', 1)];
    const copy = [...plans];
    selectRailExecutions(plans);
    expect(plans).toEqual(copy);
  });

  it('sin ejecuciones devuelve lista vacía y nada apilado', () => {
    expect(selectRailExecutions([plan('d', 'draft')])).toEqual({ items: [], hiddenCount: 0 });
  });
});

describe('countRailExecutionsNeedingAttention', () => {
  it('cuenta lo corriendo y lo que falló sin ver, no lo que terminó bien', () => {
    const plans = [plan('r', 'running'), plan('f', 'failed'), plan('done', 'done'), plan('d', 'draft')];
    expect(countRailExecutionsNeedingAttention(plans)).toBe(2);
  });

  it('un failed ya visto deja de contar', () => {
    const plans = [plan('r', 'running'), plan('f', 'failed')];
    expect(countRailExecutionsNeedingAttention(plans, new Set(['f']))).toBe(1);
  });

  it('un running sigue contando aunque se lo haya visto — está pasando ahora', () => {
    expect(countRailExecutionsNeedingAttention([plan('r', 'running')], new Set(['r']))).toBe(1);
  });

  it('es 0 cuando todo terminó bien — el badge desaparece', () => {
    expect(countRailExecutionsNeedingAttention([plan('done', 'done')])).toBe(0);
  });
});
