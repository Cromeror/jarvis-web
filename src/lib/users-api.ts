/** API client for api/users — superadmin-only user management. */

export type UserRole = 'superadmin' | 'user';

export interface UserSummary {
  id: string;
  username: string;
  role: UserRole;
  project_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  project_ids: string[];
}

export interface UpdateUserInput {
  role?: UserRole;
  password?: string;
  project_ids?: string[];
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
