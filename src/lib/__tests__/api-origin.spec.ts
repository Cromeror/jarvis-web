/**
 * Los Escenarios de la Regla D de `despliegue-web-desacoplado.feature`.
 *
 * Todos giran alrededor del mismo modo de falla, que es silencioso: cuando la
 * API pasa a otro origen, lo que se rompe no tira una excepción — el token deja
 * de viajar, el renovado deja de guardarse y los streams apuntan al host
 * equivocado. Nada de eso aparece en consola; se manifiesta como "la app me
 * desloguea sola" o "el chat no responde".
 *
 * `API_URL` se resuelve en tiempo de import (es una constante inlineada por
 * Vite), así que cada Escenario que necesita otro origen reimporta el módulo
 * con `vi.resetModules()` + `vi.stubEnv()`. Es más ceremonia que un parámetro,
 * pero prueba la constante REAL en vez de una versión inyectable que producción
 * no usa.
 *
 * No hay jsdom a propósito (ver `vitest.config.ts`): los dos Escenarios que
 * necesitan el interceptor corriendo usan un doble mínimo de `window` con lo
 * único que el interceptor toca. Instalar un DOM entero para verificar tres
 * propiedades sería pagar mucho por poco.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OTRO_ORIGEN = 'https://api.ejemplo';

/** Reimporta `api-origin` con el origen dado (cadena vacía = sin configurar). */
async function conOrigen(origen: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', origen);
  return import('../api-origin.js');
}

/**
 * Un `window` con lo único que el interceptor usa: `fetch`, y `location` para
 * el redirect del 401. `fetchDoble` devuelve la respuesta que se le pase y
 * registra con qué URL lo llamaron.
 */
function montarWindow(respuesta: Response) {
  const llamadas: string[] = [];
  const win = {
    fetch: (input: unknown) => {
      llamadas.push(String(input));
      return Promise.resolve(respuesta);
    },
    location: { pathname: '/plans', href: '', origin: 'https://web.ejemplo' },
  };
  (globalThis as Record<string, unknown>)['window'] = win;
  return { llamadas, win };
}

function respuesta(status: number, headers: Record<string, string> = {}): Response {
  return { status, headers: new Headers(headers) } as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)['window'];
});

describe('despliegue-web-desacoplado — origen de la API', () => {
  it('Sin configuración, la API vive en el mismo origen', async () => {
    const { API_URL, apiUrl } = await conOrigen('');
    expect(API_URL).toBe('');
    // Relativa, exactamente como hoy: un checkout sin configurar no cambia.
    expect(apiUrl('/api/plans')).toBe('/api/plans');
  });

  it('Configurado otro origen, las llamadas salen hacia allá', async () => {
    const { apiUrl } = await conOrigen(OTRO_ORIGEN);
    expect(apiUrl('/api/plans')).toBe(`${OTRO_ORIGEN}/api/plans`);
    // La barra final del env no puede duplicarse contra la del path.
    const { apiUrl: conBarra } = await conOrigen(`${OTRO_ORIGEN}/`);
    expect(conBarra('/api/plans')).toBe(`${OTRO_ORIGEN}/api/plans`);
  });

  it('El interceptor reconoce la API también cuando la URL es absoluta', async () => {
    const { apiRequestPath } = await conOrigen(OTRO_ORIGEN);
    // Las dos formas que el interceptor ve: la relativa que escriben los
    // módulos y la absoluta que produce apiUrl().
    expect(apiRequestPath('/api/plans')).toBe('/api/plans');
    expect(apiRequestPath(`${OTRO_ORIGEN}/api/plans`)).toBe('/api/plans');
    // La query no puede cambiar la identificación de la ruta.
    expect(apiRequestPath(`${OTRO_ORIGEN}/api/auth/login?x=1`)).toBe('/api/auth/login');
    // Un tercero no recibe nuestro token por parecerse.
    expect(apiRequestPath('https://otro.host/api/plans')).toBeNull();
    expect(apiRequestPath('/assets/index.js')).toBeNull();
  });

  it('El token renovado se guarda aunque la API esté en otro origen', async () => {
    const guardados: string[] = [];
    vi.doMock('../auth-api.js', () => ({
      getToken: () => 'token-viejo',
      replaceToken: (t: string) => guardados.push(t),
      clearSession: () => undefined,
    }));
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', OTRO_ORIGEN);
    const { llamadas } = montarWindow(respuesta(200, { 'X-Jarvis-Token': 'token-nuevo' }));
    const { installAuthFetchInterceptor } = await import('../auth-fetch-interceptor.js');

    installAuthFetchInterceptor();
    await (globalThis as unknown as { window: { fetch: typeof fetch } }).window.fetch('/api/plans');

    // La relativa se reescribió al origen de la API...
    expect(llamadas).toEqual([`${OTRO_ORIGEN}/api/plans`]);
    // ...y el interceptor siguió reconociéndola, así que guardó el renovado.
    expect(guardados).toEqual(['token-nuevo']);
    vi.doUnmock('../auth-api.js');
  });

  it('El 401 sigue cerrando la sesión con la API en otro origen', async () => {
    let limpiada = false;
    vi.doMock('../auth-api.js', () => ({
      getToken: () => 'token-viejo',
      replaceToken: () => undefined,
      clearSession: () => { limpiada = true; },
    }));
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', OTRO_ORIGEN);
    const { win } = montarWindow(respuesta(401));
    const { installAuthFetchInterceptor } = await import('../auth-fetch-interceptor.js');

    installAuthFetchInterceptor();
    await (globalThis as unknown as { window: { fetch: typeof fetch } }).window.fetch('/api/plans');

    expect(limpiada).toBe(true);
    expect(win.location.href).toBe('/login');
    vi.doUnmock('../auth-api.js');
  });

  it('Ningún stream se abre con EventSource', () => {
    // Antes este test verificaba que cada `new EventSource(...)` pasara por
    // apiUrl(). Cambió el transporte: los streams van sobre fetch
    // (`sse-stream.ts`), así que heredan el origen y el token del interceptor y
    // ya no hace falta resolverlos a mano.
    //
    // Lo que se prohíbe ahora es VOLVER a EventSource, porque volvería con él
    // el JWT en la query — el motivo por el que se cambió.
    const SRC = resolve(import.meta.dirname, '..', '..');
    const fuentes = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fuentes(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
      );
    const culpables = fuentes(SRC)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /new EventSource\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));
    expect(culpables).toEqual([]);
  });

  it('Ningún módulo del front escribe el origen a mano', () => {
    // Vivía en el spec de http-api, que recorría packages/web-app/src. Con la
    // web en su propio repo ese path no existe: el invariante se verifica donde
    // está el código que lo tiene que cumplir.
    //
    // Sólo el ARGUMENTO de un fetch/EventSource. Un `https://` en un
    // comentario, en un link de la UI o en un `<a href>` no es una llamada a la
    // API, y prohibirlos volvería el test ruidoso hasta que alguien lo apague.
    const ORIGEN_LITERAL = /(?:fetch|EventSource)\s*\(\s*(?:new\s+URL\s*\(\s*)?[`'"]https?:\/\//;
    const SRC = resolve(import.meta.dirname, '..', '..');
    const fuentes = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fuentes(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
      );
    const culpables = fuentes(SRC)
      .filter((f) => ORIGEN_LITERAL.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));
    expect(culpables).toEqual([]);
  });
});
