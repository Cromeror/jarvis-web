/**
 * API client for the Claude Code login flow (packages/mcp/src/api/login.ts /
 * packages/http-api/src/login/login.controller.ts) — drives a real
 * `claude auth login` against the single fixed Jarvis credentials dir.
 */

export type LoginAttemptStatus =
  | 'starting'
  | 'awaiting_browser'
  | 'awaiting_code'
  | 'polling'
  | 'success'
  | 'failed'
  | 'aborted';

export interface LoginAttempt {
  id: string;
  status: LoginAttemptStatus;
  oauth_url: string | null;
  prompt_text: string | null;
  error: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** POST /api/login — starts a new `claude auth login` attempt, returns its id */
export async function startLogin(): Promise<{ attemptId: string }> {
  const res = await fetch('/api/login', { method: 'POST' });
  return handleResponse<{ attemptId: string }>(res);
}

/** GET /api/login/:id — snapshot of the attempt's current state */
export async function getLoginAttempt(id: string): Promise<LoginAttempt> {
  const res = await fetch(`/api/login/${encodeURIComponent(id)}`);
  const { attempt } = await handleResponse<{ attempt: LoginAttempt }>(res);
  return attempt;
}

/** POST /api/login/:id/code — submit the OAuth code when the CLI prompts for one */
export async function submitLoginCode(id: string, code: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/login/${encodeURIComponent(id)}/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return handleResponse<{ ok: true }>(res);
}

/** POST /api/login/:id/cancel — aborts an in-progress login attempt */
export async function cancelLogin(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/login/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  return handleResponse<{ ok: true }>(res);
}
