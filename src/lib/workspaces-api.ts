/**
 * Cliente del apartado de workspaces (packages/http-api/src/workspaces).
 *
 * Un "workspace" es un directorio de trabajo del proyecto: el principal
 * (`project.root_path`) o una réplica (copia física por git-worktree). Todas
 * las vistas del apartado —explorador, cambios, grafo— trabajan sobre uno,
 * elegido con `replica_id` (ausente = el principal).
 */

/**
 * - `ok`: está en disco y es usable.
 * - `broken`: declarado pero no usable — el directorio no está, o la réplica
 *   quedó en error en la base.
 * - `creating`: la réplica todavía se está armando.
 */
export type WorkspaceStatus = 'ok' | 'broken' | 'creating';

export interface GitLastCommit {
  hash: string;
  subject: string;
  date: string;
}

export interface GitWorkspaceSummary {
  branch: string | null;
  detached: boolean;
  changed_files: number;
  last_commit: GitLastCommit | null;
  error: string | null;
}

export interface WorkspaceEntry {
  kind: 'main' | 'replica';
  /** id de la réplica; null para el principal. */
  id: string | null;
  slug: string | null;
  root_path: string;
  /** Rama declarada de la réplica. Null para el principal. */
  branch: string | null;
  status: WorkspaceStatus;
  /** Qué anda mal o qué falta. Null cuando el resumen salió completo. */
  error: string | null;
  git: GitWorkspaceSummary | null;
}

/**
 * `enabled: false` NO es un error: es un proyecto al que este apartado
 * todavía no le aplica (no tiene `root_path`). Por eso viene con 200 y con el
 * motivo — para poder decirlo en pantalla en vez de mostrar una lista vacía,
 * que no se distingue de "no creaste ninguna réplica".
 */
export type WorkspacesResponse =
  | { enabled: false; reason: string }
  | { enabled: true; workspaces: WorkspaceEntry[] };

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/projects/:id/workspaces — el principal y sus réplicas, con el trabajo en curso de cada uno. */
export async function listWorkspaces(projectId: string): Promise<WorkspacesResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspaces`);
  return handleResponse<WorkspacesResponse>(res);
}
