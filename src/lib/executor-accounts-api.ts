/**
 * API client for executor account endpoints (packages/mcp/src/api/executor-config.ts).
 * Global, not project-scoped — lets the user pick which saved Claude Code
 * credentials_dir (e.g. "Personal" vs "Alter") new chat sessions use.
 */

export interface ExecutorAccount {
  id: number;
  label: string;
  credentials_dir: string | null;
  is_active: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/executor-accounts — saved claude-code accounts, active one first */
export async function listExecutorAccounts(): Promise<ExecutorAccount[]> {
  const res = await fetch('/api/executor-accounts');
  const { accounts } = await handleResponse<{ accounts: ExecutorAccount[] }>(res);
  return accounts;
}

/** POST /api/executor-accounts — register a new account pointing at an already-logged-in credentials_dir */
export async function addExecutorAccount(label: string, credentialsDir: string): Promise<ExecutorAccount> {
  const res = await fetch('/api/executor-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, credentialsDir }),
  });
  return handleResponse<ExecutorAccount>(res);
}

/** POST /api/executor-accounts/:id/activate — switch the active account (affects new sessions only) */
export async function activateExecutorAccount(id: number): Promise<{ ok: true; activated: number }> {
  const res = await fetch(`/api/executor-accounts/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
  });
  return handleResponse<{ ok: true; activated: number }>(res);
}

/** PATCH /api/executor-accounts/:id — rename an existing account's label */
export async function renameExecutorAccount(id: number, label: string): Promise<ExecutorAccount> {
  const res = await fetch(`/api/executor-accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  return handleResponse<ExecutorAccount>(res);
}
