/**
 * A dónde vuelve el usuario después de loguearse.
 *
 * Existe por el login de los previews (`/preview-login?rd=…`, ver
 * `PreviewLoginPage`): esa página es el destino de un redirect de Traefik, y si
 * el usuario no tiene sesión hay que mandarlo al login y TRAERLO DE VUELTA con
 * el `rd` intacto. Antes el login mandaba siempre a `/`, así que el enlace al
 * preview se perdía en el camino.
 *
 * Viaja de dos formas, y las dos hacen falta:
 *
 *  · `state.from` del router — lo pone `RequireAuth` al redirigir dentro de la
 *    SPA. No sobrevive a una recarga.
 *  · `?next=` en la URL del login — lo pone el interceptor de `fetch` ante un
 *    401, que navega con `window.location` (recarga entera) y por eso no puede
 *    usar el state. Es el caso del token guardado pero vencido: `RequireAuth`
 *    lo deja pasar, el primer pedido rebota y sin `next` el `rd` se perdía.
 *
 * ## Por qué tanta desconfianza con un string que armamos nosotros
 *
 * Porque `?next=` lo puede armar CUALQUIERA: un enlace a
 * `jarvis…/login?next=https://evil.com` que, después de un login legítimo,
 * manda al usuario a otro sitio es un redirector abierto con nuestra marca
 * encima. Por eso sólo se acepta una ruta relativa del MISMO origen, y la
 * prueba no es sólo "empieza con /": `//evil.com` y `/\evil.com` son URLs
 * absolutas para el navegador, y el parser de URL descarta tabs y saltos de
 * línea, así que `/\t/evil.com` termina siendo `//evil.com`. La comprobación
 * final la hace el propio parser: si resuelta contra un origen ficticio sale de
 * ese origen, no es nuestra.
 */

const ORIGEN_FICTICIO = 'https://jarvis.invalid';

/** La ruta interna a la que se puede volver, o `null` si `raw` no es una. */
export function rutaDeVueltaSegura(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  // Barra invertida o caracteres de control en cualquier lado: el navegador los
  // normaliza de formas que convierten una ruta en un host. No hay ruta legítima
  // de la SPA que los lleve, así que no vale la pena distinguir.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, ORIGEN_FICTICIO);
  } catch {
    return null;
  }
  if (url.origin !== ORIGEN_FICTICIO) return null;
  const ruta = `${url.pathname}${url.search}${url.hash}`;
  // Volver al login después de loguearse es un loop, no un destino.
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return null;
  return ruta;
}

/**
 * La URL del login que, al entrar, devuelve a `ruta`. Para `/` (o una ruta que
 * no pasa el filtro) es el `/login` pelado: el destino por defecto ya es `/`, y
 * así la URL del caso común queda igual que siempre.
 */
export function loginConVuelta(ruta: string): string {
  const segura = rutaDeVueltaSegura(ruta);
  return segura && segura !== '/' ? `/login?next=${encodeURIComponent(segura)}` : '/login';
}
