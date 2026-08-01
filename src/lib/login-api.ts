/**
 * API client for the Claude Code login flow (packages/mcp/src/api/login.ts /
 * packages/http-api/src/login/login.controller.ts) — drives a real
 * `claude auth login` against the active executor's credentials dir.
 */

export interface LoginAccount {
  /** Absolute dir the login will re-authenticate — resolved server-side. */
  dir: string;
  /** True when nothing is configured and the CLI picks the dir itself. */
  isCliDefault: boolean;
  label: string | null;
  type: string | null;
}

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

/**
 * GET /api/login/account — the account a login would re-authenticate. Read
 * from the server instead of hard-coding a path in the UI: the dir is
 * machine-specific, and a stale copy here would promise to fix one directory
 * while the backend fixed another.
 */
export async function getLoginAccount(): Promise<LoginAccount> {
  const res = await fetch('/api/login/account');
  return handleResponse<LoginAccount>(res);
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
