/** API client for api/users — superadmin-only user management. */

export type AccountType = 'operator' | 'member';

/** Sobre qué proyecto entra el usuario y con qué rol. El par junto: un proyecto sin rol no otorga nada. */
export interface ProjectRoleInput {
  project_id: string;
  role_id: string;
}

/** Lo mismo que devuelve la API, con el nombre del rol ya resuelto. */
export interface ProjectRoleAssignment extends ProjectRoleInput {
  role_name: string;
}

export interface UserSummary {
  id: string;
  username: string;
  account_type: AccountType;
  /**
   * Los proyectos que VE, incluyendo los que le llegan por ser miembro de la
   * organización dueña. Es más ancho que `project_roles` a propósito: esta
   * pantalla administra asignaciones por proyecto, pero mostrar sólo eso
   * escondería accesos reales.
   */
  project_ids: string[];
  /** Lo que esta pantalla administra: las asignaciones explícitas (proyecto, rol). */
  project_roles: ProjectRoleAssignment[];
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  account_type: AccountType;
  /**
   * A qué organización entra y con qué rol adentro. Van los dos o ninguno.
   *
   * Sin esto el usuario nace en una organización PROPIA, y entonces los
   * `project_roles` no le dan acceso a nada: la membresía en la organización
   * dueña del proyecto es la frontera.
   */
  organization_id?: string;
  organization_role_id?: string;
  project_roles: ProjectRoleInput[];
}

export interface UpdateUserInput {
  account_type?: AccountType;
  password?: string;
  project_roles?: ProjectRoleInput[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/users */
export async function listUsers(): Promise<UserSummary[]> {
  const res = await fetch('/api/users');
  return handleResponse<UserSummary[]>(res);
}

/** POST /api/users */
export async function createUser(input: CreateUserInput): Promise<UserSummary> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<UserSummary>(res);
}

/** PATCH /api/users/:id */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserSummary> {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<UserSummary>(res);
}

/** DELETE /api/users/:id */
export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}
