import { describe, it, expect } from 'vitest';
import {
  toWorkspacesSection,
  toWorkspaceRow,
  resolveSelection,
  workspacePath,
  changesLabel,
  branchLabel,
  MAIN_WORKSPACE_ID,
} from '../workspace-view.js';
import type { WorkspaceEntry, WorkspacesResponse } from '../workspaces-api.js';

function main(over: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return {
    kind: 'main',
    id: null,
    slug: null,
    root_path: '/srv/proyecto',
    branch: null,
    status: 'ok',
    error: null,
    git: {
      branch: 'main',
      detached: false,
      changed_files: 3,
      last_commit: { hash: 'abc1234567890', subject: 'el último commit', date: '2026-08-27T10:00:00Z' },
      error: null,
    },
    ...over,
  };
}

function replica(over: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return {
    kind: 'replica',
    id: 'r-1',
    slug: 'wtree1',
    root_path: '/srv/proyecto-wtree1',
    branch: 'replica/wtree1',
    status: 'ok',
    error: null,
    git: {
      branch: 'replica/wtree1',
      detached: false,
      changed_files: 0,
      last_commit: { hash: 'def987', subject: 'trabajo de la réplica', date: '2026-08-27T11:00:00Z' },
      error: null,
    },
    ...over,
  };
}

function ready(...workspaces: WorkspaceEntry[]): WorkspacesResponse {
  return { enabled: true, workspaces };
}

describe('toWorkspacesSection', () => {
  // ACEPTACIÓN 1: no es un error, y tampoco una lista vacía —que en pantalla
  // es indistinguible de "no creaste ninguna réplica".
  it('un proyecto sin root_path da la sección deshabilitada con el motivo', () => {
    const section = toWorkspacesSection({
      enabled: false,
      reason: "El proyecto 'x' no tiene root_path configurado — asignale uno para ver sus workspaces.",
    });
    expect(section.kind).toBe('disabled');
    if (section.kind !== 'disabled') throw new Error('inalcanzable');
    expect(section.reason).toContain('root_path');
  });

  it('la sección deshabilitada no es la de error: son estados distintos', () => {
    const deshabilitada = toWorkspacesSection({ enabled: false, reason: 'sin root_path' });
    expect(deshabilitada.kind).not.toBe('failed');
    expect(deshabilitada.kind).not.toBe('ready');
  });

  // ACEPTACIÓN 2: sin réplicas se ve el principal y nada más. No hay estado
  // vacío que pintar porque nunca hay cero workspaces con el apartado activo.
  it('un proyecto sin réplicas muestra solo el principal, sin estado vacío', () => {
    const section = toWorkspacesSection(ready(main()));
    expect(section.kind).toBe('ready');
    if (section.kind !== 'ready') throw new Error('inalcanzable');
    expect(section.rows).toHaveLength(1);
    expect(section.rows[0].kind).toBe('main');
    expect(section.rows[0].title).toBe('Principal');
    // El principal siempre es elegible: es lo que evita la pantalla vacía.
    expect(section.rows[0].selectable).toBe(true);
    expect(section.rows[0].note).toBeNull();
  });

  it('habilitado siempre trae al menos el principal', () => {
    for (const response of [ready(main()), ready(main(), replica()), ready(main({ status: 'broken', error: 'no está' }))]) {
      const section = toWorkspacesSection(response);
      if (section.kind !== 'ready') throw new Error('inalcanzable');
      expect(section.rows.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ACEPTACIÓN 3: una réplica rota se ve, no se esconde. Enterarse de que se
  // rompió es justamente para lo que se mira esta pantalla.
  it('una réplica rota aparece marcada como rota y con su motivo', () => {
    const section = toWorkspacesSection(ready(
      main(),
      replica({ id: 'r-rota', slug: 'borrada', status: 'broken', error: 'El directorio /srv/x-borrada no existe en disco', git: null }),
    ));
    if (section.kind !== 'ready') throw new Error('inalcanzable');
    expect(section.rows).toHaveLength(2);

    const rota = section.rows[1];
    expect(rota.status).toBe('broken');
    expect(rota.statusLabel).toBe('Roto');
    expect(rota.statusTone).toBe('danger');
    expect(rota.note).toContain('no existe en disco');
    // Y no se ofrece como contexto: el explorador, los cambios y el grafo no
    // tendrían de dónde leer.
    expect(rota.selectable).toBe(false);
  });

  it('una réplica rota no tumba a las sanas', () => {
    const section = toWorkspacesSection(ready(
      main(),
      replica({ id: 'r-rota', slug: 'rota', status: 'broken', error: 'no está', git: null }),
      replica({ id: 'r-viva', slug: 'viva' }),
    ));
    if (section.kind !== 'ready') throw new Error('inalcanzable');
    expect(section.rows.map((r) => r.selectable)).toEqual([true, false, true]);
  });

  it('una réplica en creación se muestra como tal y tampoco es elegible', () => {
    const section = toWorkspacesSection(ready(main(), replica({ status: 'creating', git: null })));
    if (section.kind !== 'ready') throw new Error('inalcanzable');
    expect(section.rows[1].statusLabel).toBe('Creándose');
    expect(section.rows[1].statusTone).toBe('info');
    expect(section.rows[1].selectable).toBe(false);
  });
});

describe('toWorkspaceRow', () => {
  it('el principal usa el sentinel de la URL y no manda replica_id', () => {
    const row = toWorkspaceRow(main());
    expect(row.id).toBe(MAIN_WORKSPACE_ID);
    // `undefined` y no null: para el API la ausencia del parámetro ES el principal.
    expect(row.replicaId).toBeUndefined();
  });

  it('una réplica usa su id, que es lo que espera el API', () => {
    const row = toWorkspaceRow(replica({ id: 'r-42' }));
    expect(row.id).toBe('r-42');
    expect(row.replicaId).toBe('r-42');
    expect(row.title).toBe('wtree1');
  });

  it('trae branch, cantidad de cambios y último commit', () => {
    const row = toWorkspaceRow(main());
    expect(row.branch).toBe('main');
    expect(row.changedFiles).toBe(3);
    expect(row.lastCommit?.subject).toBe('el último commit');
  });

  // Si alguien hizo checkout a otra rama dentro de la réplica, la declarada
  // mentiría.
  it('la rama que muestra es en la que está parado, no la declarada', () => {
    const row = toWorkspaceRow(replica({
      branch: 'replica/wtree1',
      git: { branch: 'otra-rama', detached: false, changed_files: 0, last_commit: null, error: null },
    }));
    expect(row.branch).toBe('otra-rama');
  });

  it('sin git cae a la rama declarada de la réplica', () => {
    const row = toWorkspaceRow(replica({ branch: 'replica/wtree1', git: null }));
    expect(row.branch).toBe('replica/wtree1');
    expect(row.changedFiles).toBeNull();
  });

  // Un root que existe pero todavía no es repo git: usable, sin resumen.
  it('un workspace ok con error de git sigue siendo elegible y muestra el motivo', () => {
    const row = toWorkspaceRow(main({
      status: 'ok',
      error: '/srv/proyecto no es un repositorio git',
      git: { branch: null, detached: false, changed_files: 0, last_commit: null, error: '/srv/proyecto no es un repositorio git' },
    }));
    expect(row.selectable).toBe(true);
    expect(row.note).toContain('no es un repositorio git');
    expect(row.statusLabel).toBe('Disponible');
  });
});

describe('resolveSelection', () => {
  const rows = [toWorkspaceRow(main()), toWorkspaceRow(replica({ id: 'r-1' }))];

  it('sin nada en la URL no hay selección', () => {
    expect(resolveSelection(rows, undefined)).toEqual({ selected: null, missingId: null });
  });

  it('resuelve el principal por el sentinel y una réplica por su id', () => {
    expect(resolveSelection(rows, MAIN_WORKSPACE_ID).selected?.kind).toBe('main');
    expect(resolveSelection(rows, 'r-1').selected?.title).toBe('wtree1');
  });

  // Un link a una réplica borrada tiene que decir que no está, no mostrar otra
  // cosa como si fuera la pedida.
  it('un id que ya no existe se reporta, no cae al principal en silencio', () => {
    const res = resolveSelection(rows, 'r-borrada');
    expect(res.selected).toBeNull();
    expect(res.missingId).toBe('r-borrada');
  });
});

describe('workspacePath', () => {
  it('arma la URL del apartado, con y sin workspace elegido', () => {
    expect(workspacePath('jarvis-dev')).toBe('/workspaces/jarvis-dev');
    expect(workspacePath('jarvis-dev', 'root')).toBe('/workspaces/jarvis-dev/root');
    expect(workspacePath('jarvis-dev', 'r-1')).toBe('/workspaces/jarvis-dev/r-1');
  });

  it('escapa lo que podría romper la ruta', () => {
    expect(workspacePath('con/barra')).toBe('/workspaces/con%2Fbarra');
  });

  // Sin proyecto tiene que dar la raíz exacta: `/workspaces/` con la barra
  // colgando no matchea la misma ruta del router.
  it('sin proyecto devuelve la raíz, sin barra colgando', () => {
    expect(workspacePath()).toBe('/workspaces');
    expect(workspacePath(undefined, 'root')).toBe('/workspaces');
  });

  // Las vistas cuelgan del workspace: cambiar de vista no puede perder el
  // contexto, y por eso la vista es el ÚLTIMO segmento y no el primero.
  it('agrega la vista después del workspace', () => {
    expect(workspacePath('p', 'root', 'changes')).toBe('/workspaces/p/root/changes');
    expect(workspacePath('p', 'r-1', 'changes')).toBe('/workspaces/p/r-1/changes');
  });

  it('sin workspace elegido, la vista se ignora: no hay contexto sobre el que abrirla', () => {
    expect(workspacePath('p', undefined, 'changes')).toBe('/workspaces/p');
  });
});

describe('etiquetas', () => {
  it('changesLabel distingue cero, uno, varios y "no se pudo leer"', () => {
    expect(changesLabel(toWorkspaceRow(main({ git: { branch: 'm', detached: false, changed_files: 0, last_commit: null, error: null } })))).toBe('sin cambios');
    expect(changesLabel(toWorkspaceRow(main({ git: { branch: 'm', detached: false, changed_files: 1, last_commit: null, error: null } })))).toBe('1 cambio');
    expect(changesLabel(toWorkspaceRow(main()))).toBe('3 cambios');
    // Sin git no es cero: es que no se sabe, y decir "sin cambios" sería mentir.
    expect(changesLabel(toWorkspaceRow(main({ git: null })))).toBe('—');
  });

  it('branchLabel contempla el HEAD detached', () => {
    expect(branchLabel(toWorkspaceRow(main()))).toBe('main');
    expect(branchLabel(toWorkspaceRow(main({
      git: { branch: null, detached: true, changed_files: 0, last_commit: null, error: null },
    })))).toBe('HEAD detached');
    expect(branchLabel(toWorkspaceRow(main({ git: null, branch: null })))).toBe('—');
  });
});
