import { getToken, clearSession, replaceToken } from './auth-api.js';
import { API_URL, apiUrl, apiRequestPath } from './api-origin.js';

/**
 * El header por el que el server manda un token renovado. Mismo string que
 * `REFRESHED_TOKEN_HEADER` en http-api, escrito acá porque `web-app` no depende
 * de ese paquete. Si cambia allá tiene que cambiar acá: el modo de falla es
 * silencioso —la sesión deja de deslizarse y vuelve el corte a los 90 días— así
 * que hay un e2e que lo fija del lado del server.
 */
const REFRESHED_TOKEN_HEADER = 'X-Jarvis-Token';

/** Una URL ya absoluta (`https://…`, `blob:` no matchea por falta de `//`). */
const ES_ABSOLUTA = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Monkeypatchea window.fetch una sola vez (llamado desde main.tsx) para que
 * TODOS los fetch('/api/...') existentes en el codebase — chat-api,
 * plans-api, environments-api, etc., ya escritos como fetch() directo, sin
 * un wrapper común — lleven el JWT sin tener que tocar cada call site. Un
 * 401 significa token ausente/vencido: limpia la sesión y manda a /login.
 *
 * ## Es además el punto donde se resuelve el ORIGEN de la API
 *
 * Los módulos siguen escribiendo rutas relativas (`fetch('/api/plans')`) y acá
 * se les antepone `API_URL` si hay uno configurado. Es lo que permite mover
 * la API a otro host sin tocar los 26 archivos que la llaman.
 *
 * Y es la razón por la que reconocer la llamada NO puede seguir siendo
 * `url.startsWith('/api/')`: apenas la URL pasa a ser absoluta ese prefijo deja
 * de matchear y el interceptor se apaga entero —sin `Authorization`, sin
 * guardar el token renovado y sin reaccionar al 401— sin tirar una excepción.
 * `apiRequestPath()` reconoce las dos formas.
 *
 * **Sólo se reescribe un `input` string o URL.** Un `Request` ya construido
 * lleva su cuerpo y sus headers adentro, y rearmarlo para cambiarle el origen
 * es una fuente de bugs sutiles; ningún call site del front usa esa forma. Con
 * el default (`API_URL` vacío) no se reescribe nada y el comportamiento es
 * exactamente el de antes.
 */
export function installAuthFetchInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = apiRequestPath(url);
    const isApi = path !== null;
    const isLogin = path === '/api/auth/login';

    // Relativa + origen configurado => absoluta contra la API. `apiUrl` recibe
    // la url cruda, no el path normalizado, para no perder query ni hash.
    const destino: RequestInfo | URL =
      isApi && API_URL && !ES_ABSOLUTA.test(url) && (typeof input === 'string' || input instanceof URL)
        ? apiUrl(url)
        : input;

    if (isApi && !isLogin) {
      const token = getToken();
      if (token) {
        init = { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } };
      }
    }

    const res = await originalFetch(destino, init);

    // Sesión deslizante: si el server renovó el token, se guarda el nuevo. Va
    // acá y no en cada cliente por lo mismo que el Authorization de arriba —
    // este interceptor es el único punto por el que pasan todos los fetch.
    // Se excluye el 401 para no guardar un token que el bloque de abajo va a
    // borrar en la misma pasada.
    //
    // Con la API en otro origen, que este header LLEGUE depende de que el
    // server lo declare en `exposedHeaders`: CORS no lo expone por defecto y el
    // browser lo oculta sin error. Del lado del server hay un e2e que lo fija.
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
