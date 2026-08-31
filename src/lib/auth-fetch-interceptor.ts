import { getToken, clearSession, replaceToken } from './auth-api.js';

/**
 * El header por el que el server manda un token renovado. Mismo string que
 * `REFRESHED_TOKEN_HEADER` en http-api, escrito acá porque `web-app` no depende
 * de ese paquete. Si cambia allá tiene que cambiar acá: el modo de falla es
 * silencioso —la sesión deja de deslizarse y vuelve el corte a los 90 días— así
 * que hay un e2e que lo fija del lado del server.
 */
const REFRESHED_TOKEN_HEADER = 'X-Jarvis-Token';

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

    // Sesión deslizante: si el server renovó el token, se guarda el nuevo. Va
    // acá y no en cada cliente por lo mismo que el Authorization de arriba —
    // este interceptor es el único punto por el que pasan todos los fetch.
    // Se excluye el 401 para no guardar un token que el bloque de abajo va a
    // borrar en la misma pasada.
    if (isApi && !isLogin && res.status !== 401) {
      const refreshed = res.headers.get(REFRESHED_TOKEN_HEADER);
      if (refreshed) replaceToken(refreshed);
    }

    if (isApi && !isLogin && res.status === 401) {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return res;
  };
}
