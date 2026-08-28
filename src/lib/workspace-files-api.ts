/**
 * Cliente de la lectura de archivos del apartado de workspaces
 * (packages/http-api/src/workspaces/workspace-files.controller.ts).
 *
 * Los parámetros se llaman `dir` y `file`, NO `path`: el backend tiene un
 * middleware global sobre todo `/api/*` que secuestra cualquier request con un
 * `path` y lo reancla a `docs/`. Ver el header de ese controller.
 */

export type WorkspaceEntryType = 'file' | 'dir' | 'symlink' | 'other';

export interface WorkspaceDirEntry {
  name: string;
  type: WorkspaceEntryType;
}

export interface WorkspaceDirResponse {
  root_path: string;
  /** Directorio devuelto, relativo al root. '' es la raíz del workspace. */
  dir: string;
  entries: WorkspaceDirEntry[];
  /** True si el directorio tenía más entradas que el tope pedido. */
  truncated: boolean;
  error: string | null;
}

export interface WorkspaceFileResponse {
  root_path: string;
  path: string;
  /** Contenido utf8, o null si es binario, si es muy grande, o si falló. */
  content: string | null;
  /** El archivo no es texto: se manda la marca, no bytes crudos. */
  binary: boolean;
  /** Supera el tope: se manda la marca y el tamaño real, no un pedazo. */
  too_large: boolean;
  size: number | null;
  error: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET .../workspaces/tree — UN nivel del directorio pedido ('' = la raíz). */
export async function listWorkspaceDir(
  projectId: string,
  dir: string,
  options: { replicaId?: string; limit?: number } = {},
): Promise<WorkspaceDirResponse> {
  const params = new URLSearchParams();
  if (dir) params.set('dir', dir);
  if (options.replicaId) params.set('replica_id', options.replicaId);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspaces/tree${query ? `?${query}` : ''}`);
  return handleResponse<WorkspaceDirResponse>(res);
}

/** GET .../workspaces/file — el contenido de un archivo. */
export async function readWorkspaceFile(
  projectId: string,
  file: string,
  options: { replicaId?: string; maxBytes?: number } = {},
): Promise<WorkspaceFileResponse> {
  const params = new URLSearchParams({ file });
  if (options.replicaId) params.set('replica_id', options.replicaId);
  if (options.maxBytes) params.set('max_bytes', String(options.maxBytes));
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspaces/file?${params.toString()}`);
  return handleResponse<WorkspaceFileResponse>(res);
}
