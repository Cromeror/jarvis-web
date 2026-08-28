import { describe, it, expect, vi, afterEach } from 'vitest';
import { listWorkspaceChanges, getWorkspaceFileDiff } from '../workspace-changes-api.js';

/**
 * Lo único que distingue "sobre una réplica" de "sobre el principal" es el
 * `replica_id` de la query. Estos tests fijan esa construcción de URL, que es
 * donde un olvido haría que el panel muestre siempre el principal aunque el
 * usuario haya elegido una réplica — un bug silencioso, porque la pantalla se
 * vería perfecta con los datos equivocados.
 */
function mockFetch(): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  });
  return { calls };
}

afterEach(() => vi.unstubAllGlobals());

describe('listWorkspaceChanges', () => {
  it('sin réplica no manda replica_id: la ausencia ES el principal', async () => {
    const { calls } = mockFetch();
    await listWorkspaceChanges('mi-proyecto');
    expect(calls[0]).toBe('/api/projects/mi-proyecto/workspaces/changes');
  });

  it('con réplica la manda en la query', async () => {
    const { calls } = mockFetch();
    await listWorkspaceChanges('mi-proyecto', 'r-1');
    expect(calls[0]).toBe('/api/projects/mi-proyecto/workspaces/changes?replica_id=r-1');
  });
});

describe('getWorkspaceFileDiff', () => {
  // El param se llama `file` y no `path` porque el backend tiene un middleware
  // global que secuestra cualquier request con `path`.
  it('manda el archivo como `file`, escapado', async () => {
    const { calls } = mockFetch();
    await getWorkspaceFileDiff('p', 'packages/core/src/a b.ts');
    expect(calls[0]).toContain('file=packages%2Fcore%2Fsrc%2Fa+b.ts');
    expect(calls[0]).not.toContain('path=');
  });

  it('el mismo archivo sobre una réplica solo agrega replica_id', async () => {
    const { calls } = mockFetch();
    await getWorkspaceFileDiff('p', 'a.ts');
    await getWorkspaceFileDiff('p', 'a.ts', { replicaId: 'r-1' });
    expect(calls[0]).toBe('/api/projects/p/workspaces/diff?file=a.ts');
    expect(calls[1]).toBe('/api/projects/p/workspaces/diff?file=a.ts&replica_id=r-1');
  });

  it('staged solo viaja cuando se pide', async () => {
    const { calls } = mockFetch();
    await getWorkspaceFileDiff('p', 'a.ts', { staged: true });
    await getWorkspaceFileDiff('p', 'a.ts', { staged: false });
    expect(calls[0]).toContain('staged=true');
    expect(calls[1]).not.toContain('staged');
  });

  it('escapa el id del proyecto en la ruta', async () => {
    const { calls } = mockFetch();
    await getWorkspaceFileDiff('con/barra', 'a.ts');
    expect(calls[0]).toContain('/api/projects/con%2Fbarra/workspaces/diff');
  });
});
