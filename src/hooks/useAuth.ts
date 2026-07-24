import { useCallback, useSyncExternalStore } from 'react';
import { getStoredUser, getToken, logout as clearSession, type AuthUserSummary } from '../lib/auth-api.js';

const listeners = new Set<() => void>();

/** Único punto de escritura de sesión desde componentes React — dispara el re-render de useAuth() en todos lados. */
export function notifyAuthChanged(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): { user: AuthUserSummary | null; isAuthenticated: boolean; logout: () => void } {
  const user = useSyncExternalStore(subscribe, getStoredUser);
  const isAuthenticated = useSyncExternalStore(subscribe, () => getToken() !== null);

  const logout = useCallback(() => {
    clearSession();
    notifyAuthChanged();
    window.location.href = '/login';
  }, []);

  return { user, isAuthenticated, logout };
}
