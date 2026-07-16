import React, { useCallback, useEffect, useState } from 'react';
import { Avatar } from 'primereact/avatar';
import { listExecutorAccounts, activateExecutorAccount, type ExecutorAccount } from '../../lib/executor-accounts-api.js';

/**
 * Account switcher for the TopNav — lets the user pick which saved Claude
 * Code credentials_dir (e.g. "Personal" vs "Alter") new chat sessions use,
 * without restarting the MCP daemon. Global, not scoped by project.
 *
 * Only affects sessions not yet started: JarvisCore.resolveChat reads
 * executorConfig.getActive() fresh on every turn, but each chat session
 * fixes its own executor_credentials_dir on its first turn and never
 * re-reads it after — a conversation already running keeps the account it
 * started with even if the active account changes here.
 */
export function AccountMenu(): React.ReactElement | null {
  const [accounts, setAccounts] = useState<ExecutorAccount[]>([]);
  const [hovering, setHovering] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listExecutorAccounts().then(setAccounts).catch(() => { /* best-effort — keep last known list */ });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (accounts.length === 0) return null;

  const active = accounts.find((a) => a.is_active);

  async function handleActivate(id: number): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await activateExecutorAccount(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar de cuenta');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-800"
      >
        <Avatar label={(active?.label ?? '?').charAt(0).toUpperCase()} shape="circle" className="bg-indigo-500! text-white!" />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-medium text-white">{active?.label ?? '—'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cuenta activa</span>
        </span>
      </button>

      {hovering && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {error && <p className="px-2 py-1 text-xs text-red-600">{error}</p>}
          <ul className="space-y-1">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void handleActivate(a.id)}
                  disabled={a.is_active || busyId === a.id}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-60"
                >
                  <span>{a.label}</span>
                  {a.is_active && <span className="text-xs text-emerald-600">activa</span>}
                  {busyId === a.id && <span className="text-xs text-slate-400">…</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
