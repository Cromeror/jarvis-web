/**
 * El ÚNICO lugar que decide dónde vive la API.
 *
 * Hoy el front y la API comparten origen: `http-api` sirve el bundle y la API
 * desde el mismo puerto, así que todos los `fetch('/api/...')` son relativos y
 * eso alcanza. Este módulo existe para que dejen de tener que serlo, sin
 * reescribir los 26 archivos que ya llaman a la API.
 *
 * **El default es el comportamiento de hoy.** Sin `VITE_JARVIS_API_ORIGIN`, el
 * origen es la cadena vacía y toda URL queda relativa — un checkout recién
 * clonado sigue andando sin leer un runbook. La configuración habilita la
 * separación, no la impone.
 *
 * ## Por qué un módulo y no un `if` en cada llamada
 *
 * Porque el modo de falla de hacerlo mal es SILENCIOSO y ya tiene precedente
 * acá. El interceptor de `fetch` reconoce una llamada a la API con
 * `url.startsWith('/api/')`; con un origen absoluto ese prefijo deja de
 * matchear y el interceptor deja de hacer sus tres trabajos —adjuntar el
 * `Authorization`, guardar el `X-Jarvis-Token` renovado y reaccionar al 401—
 * sin que nada tire una excepción. La app se desloguearía sola. Por eso
 * `apiRequestPath()` normaliza ANTES de decidir, y reconoce las dos formas.
 *
 * ## Los streams van aparte, y no es un olvido
 *
 * `EventSource` no pasa por `window.fetch`, así que el interceptor no lo toca:
 * los cinco streams del front (chat, plan-runs, pipelines, login, file/watch)
 * tienen que llamar a `apiUrl()` explícitamente. Si se los deja relativos con
 * un origen configurado, apuntan al host del bundle en vez de al de la API y el
 * chat se queda mudo sin un error en consola.
 */

/**
 * El origen de la API: `https://api.ejemplo` o `''` para "el mismo que el front".
 *
 * Sale de `VITE_JARVIS_API_ORIGIN` (Vite sólo expone al cliente las variables
 * con prefijo `VITE_`). Se le saca la barra final para que `origen + path` no
 * produzca `//api/...`, que algunos proxies normalizan y otros no.
 */
export const API_ORIGIN: string = (import.meta.env['VITE_JARVIS_API_ORIGIN'] ?? '').replace(/\/+$/, '');

/** El prefijo bajo el que vive toda la API. */
const API_PREFIX = '/api/';

/**
 * La URL con la que hay que llamar a `path`.
 *
 * `path` se escribe SIEMPRE relativo (`/api/chat/sessions`), igual que hoy;
 * esto le antepone el origen sólo si hay uno configurado.
 */
export function apiUrl(path: string): string {
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * El path de la API al que apunta `url`, o `null` si no es una llamada a la API.
 *
 * Acepta las dos formas —relativa (`/api/x`) y absoluta contra el origen de la
 * API (`https://api.ejemplo/api/x`)— porque el interceptor ve las dos: las
 * relativas que escriben los módulos y las absolutas que produce `apiUrl()`.
 * Devuelve el path SIN query ni hash, para que comparar contra una ruta
 * concreta (el login) no dependa de si la llamada llevaba parámetros.
 */
export function apiRequestPath(url: string): string | null {
  let path: string;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    // Absoluta. Sólo cuenta si va al origen de la API — una absoluta a
    // cualquier otro host es una llamada a un tercero y el interceptor no tiene
    // por qué mandarle nuestro token.
    const base = API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!base || !url.startsWith(`${base}/`)) return null;
    path = url.slice(base.length);
  } else {
    path = url.startsWith('/') ? url : `/${url}`;
  }

  const limpio = path.split(/[?#]/)[0] as string;
  return limpio.startsWith(API_PREFIX) ? limpio : null;
}
