import { describe, it, expect } from 'vitest';
import {
  sessionWorkspace,
  canChooseWorkspace,
  activeReplicas,
  indexReplicasById,
} from '../session-workspace.js';
import type { ProjectReplica } from '../project-replicas-api.js';

function replica(over: Partial<ProjectReplica> = {}): ProjectReplica {
  return {
    id: 'rep-1',
    project_id: 'proj-a',
    slug: 'wtree1',
    root_path: '/srv/proj-a-wtree1',
    branch: 'replica/wtree1',
    status: 'active',
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('sessionWorkspace', () => {
  it('sin replica_id es la base', () => {
    const ws = sessionWorkspace({ replica_id: null }, new Map());
    expect(ws.kind).toBe('base');
    expect(ws.label).toBe('Base');
  });

  it('replica_id ausente (server viejo) se lee igual que la base', () => {
    expect(sessionWorkspace({}, new Map()).kind).toBe('base');
  });

  it('con réplica conocida muestra su slug y su branch', () => {
    const index = indexReplicasById([replica()]);
    const ws = sessionWorkspace({ replica_id: 'rep-1' }, index);
    expect(ws.kind).toBe('replica');
    expect(ws.label).toBe('wtree1');
    expect(ws.detail).toContain('replica/wtree1');
  });

  it('una réplica que ya no está NO se reporta como base', () => {
    // El fail-soft acá sería el mismo error que se sacó del backend: decir
    // "Base" describiría mal dónde corre y ocultaría que el turno va a fallar.
    const ws = sessionWorkspace({ replica_id: 'rep-borrada' }, indexReplicasById([replica()]));
    expect(ws.kind).toBe('unknown');
    expect(ws.label).not.toBe('Base');
    expect(ws.detail).toContain('rep-borrada');
  });
});

describe('activeReplicas', () => {
  it('deja afuera las que el backend rechazaría', () => {
    const all = [
      replica({ id: 'a', status: 'active' }),
      replica({ id: 'b', status: 'creating' }),
      replica({ id: 'c', status: 'error' }),
      replica({ id: 'd', status: 'removed' }),
    ];
    expect(activeReplicas(all).map((r) => r.id)).toEqual(['a']);
  });
});

describe('canChooseWorkspace', () => {
  it('no ofrece elegir si el proyecto no tiene réplicas', () => {
    expect(canChooseWorkspace({ replica_id: null }, [])).toBe(false);
  });

  it('no ofrece elegir si las que hay no están active', () => {
    expect(canChooseWorkspace({ replica_id: null }, [replica({ status: 'creating' })])).toBe(false);
  });

  it('ofrece elegir con al menos una réplica active', () => {
    expect(canChooseWorkspace({ replica_id: null }, [replica()])).toBe(true);
  });

  it('una conversación YA en una réplica siempre puede volver a la base', () => {
    // Aunque no queden réplicas usables: es la única salida de una conversación
    // cuya réplica se rompió o se borró.
    expect(canChooseWorkspace({ replica_id: 'rep-1' }, [])).toBe(true);
  });

  it('sin conversación abierta no hay nada que mover', () => {
    expect(canChooseWorkspace(null, [replica()])).toBe(false);
  });
});
