import { getToken, clearSession } from './auth-api.js';

/**
 * Monkeypatchea window.fetch una sola vez (llamado desde main.tsx) para que
 * TODOS los fetch('/api/...') existentes en el codebase — chat-api,
 * plans-api, environments-api, etc., ya escritos como fetch() directo, sin
 * un wrapper común — lleven el JWT sin tener que tocar cada call site. Un
 * 401 significa token ausente/vencido: limpia la sesión y manda a /login.
 */
export function installAuthFetchInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApi = url.startsWith('/api/');
    const isLogin = url === '/api/auth/login';

    if (isApi && !isLogin) {
      const token = getToken();
      if (token) {
        init = { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } };
      }
    }

    const res = await originalFetch(input, init);

    if (isApi && !isLogin && res.status === 401) {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return res;
  };
}
