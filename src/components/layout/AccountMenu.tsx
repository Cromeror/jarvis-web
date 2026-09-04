import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from 'primereact/avatar';
import { startLogin, submitLoginCode, cancelLogin, getLoginAccount, type LoginAccount } from '../../lib/login-api.js';
import { useLoginEvents } from '../../hooks/useLoginEvents.js';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * User account menu, footer del Sidebar (AppSidebar2 — el Topbar de Figma no
 * lo incluye). Click opens a standard account
 * dropdown; "Configuración" opens a modal that drives a real
 * `claude auth login` against the active executor's credentials dir (see
 * @jarvis/login-runner) and shows its progress live — no more picking
 * between saved accounts, just re-authenticating the one Jarvis runs as.
 */
export function AccountMenu(): React.ReactElement {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const username = user?.username ?? '?';

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
        <Avatar label={username.charAt(0).toUpperCase()} shape="circle" className="bg-indigo-500! text-white!" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 border-b border-slate-100 px-2 pb-2">
            <p className="text-sm font-medium text-slate-900">{username}</p>
            {user && <p className="text-xs text-slate-400">{user.account_type === 'operator' ? 'Operador del producto' : 'Cliente'}</p>}
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
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <i className="pi pi-sign-out text-slate-400" />
            Cerrar sesión
          </button>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [account, setAccount] = useState<LoginAccount | null>(null);
  const { attempt, isFinished } = useLoginEvents(attemptId);

  useEffect(() => {
    let cancelled = false;
    getLoginAccount()
      .then((a) => { if (!cancelled) setAccount(a); })
      .catch(() => { /* best-effort — the modal still works, it just shows "…" */ });
    return () => { cancelled = true; };
  }, []);

  async function handleStartLogin(): Promise<void> {
    setError(null);
    setCodeInput('');
    try {
      const { attemptId: id } = await startLogin();
      setAttemptId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el login');
    }
  }

  async function handleSubmitCode(): Promise<void> {
    if (!attemptId || !codeInput.trim()) return;
    setSubmittingCode(true);
    try {
      await submitLoginCode(attemptId, codeInput.trim());
      setCodeInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el código');
    } finally {
      setSubmittingCode(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!attemptId) return;
    try {
      await cancelLogin(attemptId);
    } catch {
      /* best-effort — the attempt will show as failed/aborted from the SSE stream regardless */
    }
  }

  const isRunning = attemptId !== null && !isFinished;

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

        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Cuenta Claude activa</h3>
        <div className="mb-4 rounded-xl border border-slate-200 px-3 py-2">
          {account?.label && <p className="mb-0.5 text-sm font-medium text-slate-900">{account.label}</p>}
          <p className="break-all font-mono text-sm text-slate-700">{account?.dir ?? '…'}</p>
          {account?.isCliDefault && <p className="mt-0.5 text-xs text-slate-400">Default del CLI</p>}
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!attemptId && (
          <button
            type="button"
            onClick={() => void handleStartLogin()}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Cambiar de cuenta / Loguear de nuevo
          </button>
        )}

        {attempt && attempt.status === 'starting' && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <i className="pi pi-spin pi-spinner" />
            Iniciando sesión de login…
          </div>
        )}

        {attempt && (attempt.status === 'awaiting_browser' || attempt.status === 'polling') && attempt.oauth_url && (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-700">Abrí este link y autorizá el acceso:</p>
            <a
              href={attempt.oauth_url}
              target="_blank"
              rel="noreferrer"
              className="block truncate rounded-lg bg-indigo-50 px-2.5 py-1.5 font-mono text-xs text-indigo-700 hover:bg-indigo-100"
            >
              {attempt.oauth_url}
            </a>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <i className="pi pi-spin pi-spinner" />
              Esperando que completes el login en tu navegador…
            </div>
          </div>
        )}

        {attempt && attempt.status === 'awaiting_code' && (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-700">{attempt.prompt_text ?? 'Pegá el código de autorización:'}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && void handleSubmitCode()}
                placeholder="Código"
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => void handleSubmitCode()}
                disabled={!codeInput.trim() || submittingCode}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        {attempt && attempt.status === 'success' && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <i className="pi pi-check-circle" />
            Cuenta conectada
          </div>
        )}

        {attempt && (attempt.status === 'failed' || attempt.status === 'aborted') && (
          <div className="space-y-2">
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {attempt.error ?? 'El login no se completó.'}
            </div>
            <button
              type="button"
              onClick={() => void handleStartLogin()}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Reintentar
            </button>
          </div>
        )}

        {isRunning && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
