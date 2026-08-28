/**
 * Cliente de las rutas de "trabajo en curso" del apartado de workspaces
 * (packages/http-api/src/workspaces/workspaces.controller.ts).
 *
 * Todas aceptan `replicaId`: ausente = el workspace principal del proyecto.
 * Es el mismo parámetro que usa el resto del apartado, así que el panel de
 * cambios funciona sobre una réplica exactamente igual que sobre el principal
 * — lo único que cambia es contra qué directorio corre el git del backend.
 */

/** `untracked` solo aparece sin stagear; `unmerged` aparece en las dos columnas. */
export type FileStatus =
  | 'modified' | 'added' | 'deleted' | 'renamed' | 'copied'
  | 'type_changed' | 'untracked' | 'unmerged';

export interface ChangedFile {
  path: string;
  /** Origen de un rename/copy. */
  orig_path: string | null;
  /** Estado en el índice (la columna X de git). Null si el índice no lo tocó. */
  staged: FileStatus | null;
  /** Estado en el working tree (la columna Y). Null si el working tree no lo tocó. */
  unstaged: FileStatus | null;
}

export interface WorkspaceChangesResponse {
  root_path: string;
  files: ChangedFile[];
  /** Null cuando la lista es confiable, incluso si está vacía porque el repo está limpio. */
  error: string | null;
}

export interface FileDiffResponse {
  root_path: string;
  path: string;
  source: 'worktree' | 'staged' | 'untracked';
  /** El archivo no es texto: no hay diff que mostrar, solo la marca. */
  binary: boolean;
  /** El diff se cortó por tamaño. Lo que viene en `diff` es un prefijo válido. */
  truncated: boolean;
  diff: string | null;
  added_lines: number | null;
  deleted_lines: number | null;
  error: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function withReplica(params: URLSearchParams, replicaId?: string): URLSearchParams {
  if (replicaId) params.set('replica_id', replicaId);
  return params;
}

/** GET .../workspaces/changes — los archivos con cambios del workspace elegido. */
export async function listWorkspaceChanges(
  projectId: string,
  replicaId?: string,
): Promise<WorkspaceChangesResponse> {
  const params = withReplica(new URLSearchParams(), replicaId);
  const query = params.toString();
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspaces/changes${query ? `?${query}` : ''}`);
  return handleResponse<WorkspaceChangesResponse>(res);
}

/**
 * GET .../workspaces/diff — el diff de un archivo.
 *
 * El parámetro se llama `file` y no `path` porque el backend tiene un
 * middleware global que secuestra cualquier request con `path` y lo reancla a
 * `docs/` (ver el header de workspace-files.controller.ts).
 */
export async function getWorkspaceFileDiff(
  projectId: string,
  file: string,
  options: { staged?: boolean; replicaId?: string } = {},
): Promise<FileDiffResponse> {
  const params = withReplica(new URLSearchParams({ file }), options.replicaId);
  if (options.staged) params.set('staged', 'true');
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspaces/diff?${params.toString()}`);
  return handleResponse<FileDiffResponse>(res);
}
