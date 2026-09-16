import { getToken } from './auth-api.js';
import { openSseStream } from './sse-stream.js';

/**
 * Cliente de `api/login` — re-autenticar el executor (Claude).
 *
 * Es el mismo flujo que exponen las tools `executor_login_*` y, abajo, el mismo
 * `login-runner`: un solo camino de login que no puede divergir entre la
 * pantalla y el chat.
 */

export interface LoginStarted {
  attemptId: string;
  /** A quién se está autenticando — el usuario Unix del proyecto, o la cuenta de jarvis-api. */
  authenticating?: { unix_user: string; project_id: string } | { jarvis_api: true };
}

export type LoginEventKind = 'url' | 'awaiting_code' | 'log' | 'success' | 'error';

export interface LoginEvent {
  event: 'login_updated' | 'login_finished';
  type?: LoginEventKind;
  data?: string;
  status?: 'success' | 'error';
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * Arranca el login. `projectId` decide a quién se autentica: un proyecto
 * aislado necesita el suyo (su chat lee las credenciales del home de su usuario
 * Unix), y sin él se autentica la cuenta de jarvis-api.
 */
export async function startExecutorLogin(projectId?: string | null): Promise<LoginStarted> {
  return handle<LoginStarted>(
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectId ? { project_id: projectId } : {}),
    }),
  );
}

export async function submitExecutorLoginCode(attemptId: string, code: string): Promise<void> {
  await handle<{ ok: boolean }>(
    await fetch(`/api/login/${encodeURIComponent(attemptId)}/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
  );
}

export async function cancelExecutorLogin(attemptId: string): Promise<void> {
  await fetch(`/api/login/${encodeURIComponent(attemptId)}/cancel`, { method: 'POST' }).catch(() => undefined);
}

/**
 * Sigue el progreso del intento. Devuelve la función para cortar.
 *
 * El progreso viene por SSE y no por polling porque lo que se espera es la URL
 * —que el CLI imprime cuando quiere— y después el veredicto: preguntar cada
 * tanto agregaría latencia justo en los dos momentos en que alguien está
 * mirando la pantalla.
 */
export function watchExecutorLogin(attemptId: string, onEvent: (event: LoginEvent) => void): () => void {
  if (!getToken()) return () => undefined;
  const stream = openSseStream(`/api/login/${encodeURIComponent(attemptId)}/events`, {
    onMessage: (raw) => {
      try {
        onEvent(JSON.parse(raw) as LoginEvent);
      } catch {
        /* una línea que no parsea no puede tumbar el stream */
      }
    },
  });
  return () => stream.close();
}
