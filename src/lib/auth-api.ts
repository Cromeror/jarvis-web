/** Auth API client — login + current user, y el storage local del JWT. */

export type UserRole = 'superadmin' | 'user';

export interface AuthUserSummary {
  id: string;
  username: string;
  role: UserRole;
  project_ids: string[];
}

export interface LoginResult {
  token: string;
  user: AuthUserSummary;
}

const TOKEN_KEY = 'jarvis_token';
const USER_KEY = 'jarvis_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Cacheado por valor crudo — se usa como getSnapshot de useSyncExternalStore
// en useAuth(), que espera la MISMA referencia si el valor no cambió.
// Re-parsear un objeto nuevo en cada llamada (JSON.parse siempre devuelve una
// referencia distinta) hace que React vea "cambios" en cada render y entre en
// loop infinito (Maximum update depth exceeded), tirando abajo toda la app.
let cachedRaw: string | null = null;
let cachedUser: AuthUserSummary | null = null;

export function getStoredUser(): AuthUserSummary | null {
  const raw = localStorage.getItem(USER_KEY);
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  if (!raw) {
    cachedUser = null;
    return null;
  }
  try {
    cachedUser = JSON.parse(raw) as AuthUserSummary;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function storeSession(result: LoginResult): void {
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
}

/** POST /api/auth/login */
export async function login(username: string, password: string): Promise<AuthUserSummary> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(res.status === 401 ? 'Usuario o contraseña inválidos' : `HTTP ${res.status}: ${body}`);
  }
  const result = (await res.json()) as LoginResult;
  storeSession(result);
  return result.user;
}

export function logout(): void {
  clearSession();
}
