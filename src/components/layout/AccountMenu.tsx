import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from 'primereact/avatar';
import {
  listExecutorAccounts,
  activateExecutorAccount,
  addExecutorAccount,
  renameExecutorAccount,
  type ExecutorAccount,
} from '../../lib/executor-accounts-api.js';

const LOGGED_IN_USER = 'SuperAdmin';

/**
 * User account menu for the TopNav — logged-in user is hardcoded (no auth
 * system yet). Click opens a standard account dropdown; "Configuración"
 * opens a modal showing the active Claude Code executor account (which
 * saved credentials_dir new chat sessions use — see executor-accounts-api).
 *
 * Only affects sessions not yet started: JarvisCore.resolveChat reads
 * executorConfig.getActive() fresh on every turn, but each chat session
 * fixes its own executor_credentials_dir on its first turn and never
 * re-reads it after — a conversation already running keeps the account it
 * started with even if the active account changes here.
 */
export function AccountMenu(): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-800"
      >
        <Avatar label={LOGGED_IN_USER.charAt(0)} shape="circle" className="bg-indigo-500! text-white!" />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-medium text-white">{LOGGED_IN_USER}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Usuario</span>
        </span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 border-b border-slate-100 px-2 pb-2">
            <p className="text-sm font-medium text-slate-900">{LOGGED_IN_USER}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <i className="pi pi-cog text-slate-400" />
            Configuración
          </button>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [accounts, setAccounts] = useState<ExecutorAccount[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCredentialsDir, setNewCredentialsDir] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [renaming, setRenaming] = useState(false);

  const refresh = useCallback(() => {
    listExecutorAccounts().then(setAccounts).catch(() => { /* best-effort — keep last known list */ });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  function startEditing(a: ExecutorAccount): void {
    setEditingId(a.id);
    setEditLabel(a.label);
  }

  async function handleRename(id: number): Promise<void> {
    if (!editLabel.trim()) return;
    setRenaming(true);
    setError(null);
    try {
      await renameExecutorAccount(id, editLabel.trim());
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al renombrar la cuenta');
    } finally {
      setRenaming(false);
    }
  }

  async function handleAdd(): Promise<void> {
    if (!newLabel.trim() || !newCredentialsDir.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addExecutorAccount(newLabel.trim(), newCredentialsDir.trim());
      setNewLabel('');
      setNewCredentialsDir('');
      setShowAddForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar la cuenta');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Configuración</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Cuenta Claude activa</h3>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-lg px-1.5 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {showAddForm ? 'Cancelar' : '+ Agregar cuenta'}
          </button>
        </div>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-400">No hay cuentas de Claude Code registradas.</p>
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((a) =>
              editingId === a.id ? (
                <li key={a.id} className="flex items-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(a.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename(a.id)}
                    disabled={!editLabel.trim() || renaming}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => void handleActivate(a.id)}
                    disabled={a.is_active || busyId === a.id}
                    className="flex flex-1 items-center gap-2 text-left disabled:cursor-default"
                  >
                    <span>{a.label}</span>
                    {a.is_active && <span className="text-xs text-emerald-600">activa</span>}
                    {busyId === a.id && <span className="text-xs text-slate-400">…</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditing(a)}
                    title="Renombrar"
                    className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <i className="pi pi-pencil text-xs" />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {showAddForm && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3">
            <div>
              <label htmlFor="account-label" className="mb-1 block text-xs font-medium text-slate-500">
                Nombre
              </label>
              <input
                id="account-label"
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Personal"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label htmlFor="account-dir" className="mb-1 block text-xs font-medium text-slate-500">
                Directorio de credenciales
              </label>
              <input
                id="account-dir"
                type="text"
                value={newCredentialsDir}
                onChange={(e) => setNewCredentialsDir(e.target.value)}
                placeholder="/home/cristobal/.claude"
                onKeyDown={(e) => e.key === 'Enter' && void handleAdd()}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!newLabel.trim() || !newCredentialsDir.trim() || adding}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {adding ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
