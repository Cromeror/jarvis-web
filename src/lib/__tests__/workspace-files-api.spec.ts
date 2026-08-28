import { describe, it, expect, vi, afterEach } from 'vitest';
import { listWorkspaceDir, readWorkspaceFile } from '../workspace-files-api.js';

/**
 * La construccion de la URL es donde un olvido haria que el explorador lea
 * siempre el workspace principal aunque el usuario haya elegido una replica:
 * un bug silencioso, porque la pantalla se ve perfecta con los datos de otro
 * directorio.
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

describe('listWorkspaceDir', () => {
  it('la raiz no manda dir: el vacio ES la raiz', async () => {
    const { calls } = mockFetch();
    await listWorkspaceDir('p', '');
    expect(calls[0]).toBe('/api/projects/p/workspaces/tree');
  });

  it('un subdirectorio va como dir', async () => {
    const { calls } = mockFetch();
    await listWorkspaceDir('p', 'packages/core/src');
    expect(calls[0]).toBe('/api/projects/p/workspaces/tree?dir=packages%2Fcore%2Fsrc');
  });

  it('sobre una replica solo agrega replica_id', async () => {
    const { calls } = mockFetch();
    await listWorkspaceDir('p', 'src', { replicaId: 'r-1' });
    expect(calls[0]).toBe('/api/projects/p/workspaces/tree?dir=src&replica_id=r-1');
  });
});

describe('readWorkspaceFile', () => {
  // El param se llama `file` y no `path` porque el backend tiene un middleware
  // global que secuestra cualquier request con `path` y lo reancla a docs/.
  it('manda el archivo como file, nunca como path', async () => {
    const { calls } = mockFetch();
    await readWorkspaceFile('p', 'src/a b.ts');
    expect(calls[0]).toContain('file=src%2Fa+b.ts');
    expect(calls[0]).not.toContain('path=');
  });

  it('el mismo archivo sobre una replica solo agrega replica_id', async () => {
    const { calls } = mockFetch();
    await readWorkspaceFile('p', 'a.ts');
    await readWorkspaceFile('p', 'a.ts', { replicaId: 'r-1' });
    expect(calls[0]).toBe('/api/projects/p/workspaces/file?file=a.ts');
    expect(calls[1]).toBe('/api/projects/p/workspaces/file?file=a.ts&replica_id=r-1');
  });
});
