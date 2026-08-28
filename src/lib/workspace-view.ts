import type { WorkspaceEntry, WorkspacesResponse, WorkspaceStatus } from './workspaces-api.js';
import type { StatusBadgeTone } from '../components/ui/atoms/StatusBadge.js';

/**
 * Cómo se ve la vista raíz del apartado de workspaces, derivado de la
 * respuesta del backend.
 *
 * Vive acá y no dentro del componente por la misma razón que
 * `session-workspace.ts`: las reglas tienen casos borde —proyecto sin
 * `root_path`, proyecto sin réplicas, réplica rota, selección apuntando a algo
 * que ya no existe— que conviene testear sin renderizar nada. El componente
 * queda como una función de este modelo a JSX.
 */

/** Sentinel del workspace principal en la URL. Una réplica nunca puede tener este id: los suyos son UUID. */
export const MAIN_WORKSPACE_ID = 'root';

export interface WorkspaceRow {
  /** Lo que va en la URL y lo que identifica al workspace en el resto del apartado. */
  id: string;
  /** `replica_id` para el API — undefined en el principal, que es la ausencia del parámetro. */
  replicaId: string | undefined;
  kind: 'main' | 'replica';
  title: string;
  rootPath: string;
  /** Rama en la que está parado ahora. Null si no se pudo leer o si el HEAD está detached. */
  branch: string | null;
  detached: boolean;
  /** Archivos con cambios sin commitear. Null cuando no se pudo leer el git. */
  changedFiles: number | null;
  lastCommit: { hash: string; subject: string; date: string } | null;
  status: WorkspaceStatus;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  /** Qué anda mal o qué falta, para mostrar debajo. Null cuando está todo bien. */
  note: string | null;
  /**
   * Si se puede fijar como contexto de las otras vistas. Un workspace roto o a
   * medio crear no lo es: el explorador, los cambios y el grafo no tendrían de
   * dónde leer, y ofrecerlo sería mandar al usuario a tres errores seguidos.
   */
  selectable: boolean;
}

export type WorkspacesSection =
  | { kind: 'loading' }
  /** El proyecto no tiene `root_path`. No es un error ni una lista vacía: es un apartado que todavía no aplica. */
  | { kind: 'disabled'; reason: string }
  /** El pedido falló de verdad (red, 500). Distinto de `disabled`. */
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; rows: WorkspaceRow[] };

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  ok: 'Disponible',
  broken: 'Roto',
  creating: 'Creándose',
};

const STATUS_TONE: Record<WorkspaceStatus, StatusBadgeTone> = {
  ok: 'success',
  broken: 'danger',
  creating: 'info',
};

/**
 * Un workspace del backend a una fila de la vista.
 *
 * El `error` del backend viaja tal cual: en un workspace `ok` explica por qué
 * falta el resumen de git (típicamente, que el root todavía no es un repo), y
 * en uno `broken` explica por qué está roto. Es información en los dos casos.
 */
export function toWorkspaceRow(entry: WorkspaceEntry): WorkspaceRow {
  const isMain = entry.kind === 'main';
  return {
    id: isMain ? MAIN_WORKSPACE_ID : (entry.id ?? MAIN_WORKSPACE_ID),
    replicaId: isMain ? undefined : (entry.id ?? undefined),
    kind: entry.kind,
    title: isMain ? 'Principal' : (entry.slug ?? 'réplica sin nombre'),
    rootPath: entry.root_path,
    // La rama que importa es en la que está PARADO (la del git), no la que se
    // declaró al crear la réplica: si alguien hizo checkout a otra cosa, la
    // declarada mentiría. La declarada queda de respaldo cuando no hay git.
    branch: entry.git?.branch ?? entry.branch ?? null,
    detached: entry.git?.detached ?? false,
    changedFiles: entry.git ? entry.git.changed_files : null,
    lastCommit: entry.git?.last_commit ?? null,
    status: entry.status,
    statusLabel: STATUS_LABEL[entry.status],
    statusTone: STATUS_TONE[entry.status],
    note: entry.error ?? entry.git?.error ?? null,
    selectable: entry.status === 'ok',
  };
}

/**
 * La respuesta del backend a la sección entera.
 *
 * Los tres casos que no se pueden confundir:
 *
 *  - `enabled: false` ⇒ `disabled` con el motivo. NO es `failed` (no se rompió
 *    nada) ni `ready` con cero filas (que en pantalla es indistinguible de "no
 *    creaste réplicas").
 *  - Un proyecto SIN réplicas ⇒ `ready` con UNA fila, la del principal. Nunca
 *    hay estado vacío: si el apartado está habilitado, siempre hay al menos un
 *    workspace, así que no existe el "no hay nada acá" que habría que pintar.
 *  - Una réplica rota ⇒ una fila más, marcada como rota y no seleccionable.
 *    No se esconde: el usuario tiene que poder ver que se rompió, que es
 *    justamente para lo que mira esta pantalla.
 */
export function toWorkspacesSection(response: WorkspacesResponse): WorkspacesSection {
  if (!response.enabled) return { kind: 'disabled', reason: response.reason };
  return { kind: 'ready', rows: response.workspaces.map(toWorkspaceRow) };
}

export interface SelectionResult {
  /** El workspace elegido, o null si el de la URL no está en la lista. */
  selected: WorkspaceRow | null;
  /**
   * El id que venía en la URL y no se encontró. Se reporta en vez de caer al
   * principal en silencio: un link a una réplica borrada tiene que decir que
   * esa réplica no está, no mostrar otra cosa como si fuera la pedida.
   */
  missingId: string | null;
}

/** Resuelve qué fila está seleccionada según lo que diga la URL. */
export function resolveSelection(rows: WorkspaceRow[], idFromUrl: string | undefined): SelectionResult {
  if (!idFromUrl) return { selected: null, missingId: null };
  const found = rows.find((r) => r.id === idFromUrl);
  if (!found) return { selected: null, missingId: idFromUrl };
  return { selected: found, missingId: null };
}

/** Raíz del apartado: el selector de proyecto. */
export const WORKSPACES_ROOT_PATH = '/workspaces';

/**
 * Las vistas que cuelgan del workspace elegido. Todas leen el mismo contexto
 * —proyecto + workspace— de la URL, así que cambiar de vista no pierde el
 * workspace ni obliga a re-elegirlo.
 */
export type WorkspaceView = 'changes' | 'explorer' | 'graph';

/**
 * Path del apartado. Sin proyecto devuelve la raíz (el selector) y no
 * `/workspaces/`, que con la barra colgando no matchea la misma ruta. La vista
 * solo tiene sentido con un workspace elegido: sin él se ignora.
 */
export function workspacePath(projectId?: string, workspaceId?: string, view?: WorkspaceView): string {
  if (!projectId) return WORKSPACES_ROOT_PATH;
  const base = `${WORKSPACES_ROOT_PATH}/${encodeURIComponent(projectId)}`;
  if (!workspaceId) return base;
  const withWorkspace = `${base}/${encodeURIComponent(workspaceId)}`;
  return view ? `${withWorkspace}/${view}` : withWorkspace;
}

/** "3 cambios" / "sin cambios" / "—" cuando no se pudo leer el git. */
export function changesLabel(row: WorkspaceRow): string {
  if (row.changedFiles === null) return '—';
  if (row.changedFiles === 0) return 'sin cambios';
  return row.changedFiles === 1 ? '1 cambio' : `${row.changedFiles} cambios`;
}

/** La rama para mostrar, contemplando el HEAD detached y el "no se pudo leer". */
export function branchLabel(row: WorkspaceRow): string {
  if (row.detached) return 'HEAD detached';
  return row.branch ?? '—';
}
