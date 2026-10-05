/**
 * El login de Jarvis delante de los previews de los proyectos
 * (`jarvis-agent/docs/exposicion-por-subdominio.md` §4, controller
 * `packages/http-api/src/environments/preview-auth.controller.ts`).
 *
 * Traefik manda al navegador a `/preview-login?rd=<URL del preview>`; la SPA
 * pide el acceso con la sesión del usuario y el server devuelve a dónde ir: el
 * callback del preview con un ticket de 60 s. El token de Jarvis NO viaja al
 * preview —es otro origen—: lo que cruza es ese ticket, atado a ese host.
 */

export type ValidacionRd = { ok: true; rd: string } | { ok: false; error: string };

/**
 * ¿Es `rd` algo que tenga sentido mandarle al server?
 *
 * Es UX, no seguridad: el server valida lo mismo y además que el host sea un
 * preview conocido. Lo que se gana es no hacer un viaje para contestar algo que
 * ya se sabe acá — un enlace roto o `http:` (los previews van sólo por HTTPS,
 * y la cookie que se emite es `secure`, así que por HTTP no andaría nunca).
 */
export function validarRd(rd: string | null): ValidacionRd {
  if (!rd || !rd.trim()) return { ok: false, error: 'Falta el enlace del entorno.' };
  let url: URL;
  try {
    url = new URL(rd);
  } catch {
    return { ok: false, error: 'El enlace del entorno no es una URL válida.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'Los entornos se abren sólo por HTTPS.' };
  return { ok: true, rd: url.toString() };
}

/**
 * El mensaje que ve el usuario para una respuesta no-OK del `grant`.
 *
 * 403 y 404 llevan texto propio y NO el del server: el 404 del server nombra el
 * host y el 403 sale del chequeo genérico de permisos, ninguno de los dos está
 * escrito para esta pantalla. El 400 sí se muestra tal cual — es la razón
 * concreta por la que el enlace no sirve. (El 401 no llega acá: lo atiende el
 * interceptor de `fetch`, que manda al login con la vuelta puesta.)
 */
export function mensajeDeErrorDelGrant(status: number, cuerpo: string): string {
  if (status === 403) return 'Tu usuario no tiene acceso a este proyecto.';
  if (status === 404) return 'Ese enlace no es un entorno de Jarvis.';
  if (status === 400) return mensajeDelServer(cuerpo) ?? 'El enlace del entorno no es válido.';
  return `No se pudo abrir el entorno (HTTP ${status}).`;
}

/** El `message` de un error de Nest (`{ message, error, statusCode }`), que puede venir como lista. */
function mensajeDelServer(cuerpo: string): string | null {
  try {
    const json = JSON.parse(cuerpo) as { message?: unknown };
    if (typeof json.message === 'string' && json.message) return json.message;
    if (Array.isArray(json.message) && json.message.length) return json.message.map(String).join(' ');
  } catch {
    // Un cuerpo que no es JSON (un proxy en el medio): se usa si es texto corto.
  }
  const texto = cuerpo.trim();
  return texto && texto.length <= 300 && !texto.startsWith('<') ? texto : null;
}

export class PreviewGrantError extends Error {}

/** POST /api/preview-auth/grant — devuelve la URL (de OTRO origen) a la que mandar al navegador. */
export async function pedirAccesoAlPreview(rd: string): Promise<string> {
  const res = await fetch('/api/preview-auth/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rd }),
  });
  if (!res.ok) throw new PreviewGrantError(mensajeDeErrorDelGrant(res.status, await res.text()));
  const { redirect } = (await res.json()) as { redirect?: unknown };
  // Se navega a esto con `location.assign`, así que se exige lo mismo que al
  // `rd`: una URL https. Es el server propio, pero un `javascript:` acá sería
  // ejecución de código en nuestro origen, y el chequeo cuesta una línea.
  if (typeof redirect !== 'string' || !validarRd(redirect).ok) {
    throw new PreviewGrantError('El servidor no devolvió a dónde ir.');
  }
  return redirect;
}
