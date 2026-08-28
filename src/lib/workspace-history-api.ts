/**
 * Cliente de la historia del apartado de workspaces
 * (packages/http-api/src/workspaces/workspace-history.controller.ts).
 */

export type RefType = 'branch' | 'remote' | 'tag' | 'head';

export interface CommitRef {
  name: string;
  type: RefType;
}

export interface Commit {
  hash: string;
  /** Hashes de los padres: vacio en la raiz, 2+ en un merge. Es la topologia del grafo. */
  parents: string[];
  refs: CommitRef[];
  author_name: string;
  author_email: string;
  date: string;
  subject: string;
  is_merge: boolean;
}

export interface CommitLogResponse {
  root_path: string;
  commits: Commit[];
  /** Cursor de la pagina siguiente, o null si no hay mas. */
  next_cursor: string | null;
  tip: string | null;
  /** Null cuando la lista es confiable, incluso vacia porque el repo no tiene commits. */
  error: string | null;
}

export interface WorkspaceRef {
  name: string;
  hash: string;
}

export interface WorkspaceRefsResponse {
  root_path: string;
  branches: WorkspaceRef[];
  tags: WorkspaceRef[];
  head: string | null;
  detached: boolean;
  error: string | null;
}

export interface CommitFileStat {
  path: string;
  orig_path: string | null;
  /** null en un binario: git no cuenta lineas ahi. */
  added: number | null;
  deleted: number | null;
  binary: boolean;
}

export interface CommitDetailResponse {
  root_path: string;
  commit: Commit | null;
  files: CommitFileStat[];
  diff: string | null;
  truncated: boolean;
  error: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function base(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/workspaces`;
}

/** GET .../workspaces/log — una pagina del log con la topologia del grafo. */
export async function listWorkspaceLog(
  projectId: string,
  options: { replicaId?: string; ref?: string; limit?: number; cursor?: string } = {},
): Promise<CommitLogResponse> {
  const params = new URLSearchParams();
  if (options.replicaId) params.set('replica_id', options.replicaId);
  if (options.ref) params.set('ref', options.ref);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  const res = await fetch(`${base(projectId)}/log${query ? `?${query}` : ''}`);
  return handleResponse<CommitLogResponse>(res);
}

/** GET .../workspaces/refs — ramas locales y tags. */
export async function listWorkspaceRefs(
  projectId: string,
  replicaId?: string,
): Promise<WorkspaceRefsResponse> {
  const params = new URLSearchParams();
  if (replicaId) params.set('replica_id', replicaId);
  const query = params.toString();
  const res = await fetch(`${base(projectId)}/refs${query ? `?${query}` : ''}`);
  return handleResponse<WorkspaceRefsResponse>(res);
}

/** GET .../workspaces/commit — metadatos, archivos y patch de un commit. */
export async function getWorkspaceCommit(
  projectId: string,
  hash: string,
  options: { replicaId?: string; limit?: number } = {},
): Promise<CommitDetailResponse> {
  const params = new URLSearchParams({ hash });
  if (options.replicaId) params.set('replica_id', options.replicaId);
  if (options.limit) params.set('limit', String(options.limit));
  const res = await fetch(`${base(projectId)}/commit?${params.toString()}`);
  return handleResponse<CommitDetailResponse>(res);
}
