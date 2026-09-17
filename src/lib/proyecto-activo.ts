/**
 * QUÉ PROYECTO ESTÁ ELEGIDO — la regla sola, sin React y sin red.
 *
 * Vive acá y no en el hook porque es lo único de todo esto que tiene casos
 * borde que valga la pena fijar con tests: la precedencia entre las tres
 * fuentes, y qué pasa cuando la elección guardada ya no es accesible.
 */

/** Secciones cuya segunda parte de la ruta ES un proyecto. */
export const CON_PROYECTO = ['chat', 'plans', 'environments', 'workspaces', 'paquetes'];

const CLAVE = 'jarvis_proyecto_activo';

export function projectIdDeLaUrl(pathname: string): string | null {
  const [, seccion, posibleProyecto] = pathname.split('/');
  if (!seccion || !CON_PROYECTO.includes(seccion)) return null;
  return posibleProyecto || null;
}

/**
 * EL PROYECTO EN EL QUE SE ESTÁ TRABAJANDO, con la precedencia en un solo lugar.
 *
 *  1. LA URL MANDA. Un link compartido apunta a un proyecto concreto, y una
 *     preferencia guardada no puede ganarle: el usuario vería el contenido de
 *     uno con el menú del otro.
 *  2. LO ELEGIDO, si sigue siendo accesible. Se revalida contra la lista en vez
 *     de confiar en el storage — a alguien le pueden sacar un proyecto entre dos
 *     sesiones, y un id muerto deja el sidebar pidiendo módulos de algo que la
 *     API ya no devuelve.
 *  3. EL ÚNICO ACCESIBLE, y SÓLO SI `autoElegirUnico`. Ver abajo.
 *
 * Con varios y sin elección devuelve `null` A PROPÓSITO: adivinar cuál quiso es
 * peor que mostrar el selector, porque lo que cambia detrás son SUS módulos.
 *
 * `accesibles` en `null` significa «todavía no sé» (la lista no llegó), y es
 * distinto de `[]` («no tiene ninguno»): con la lista en vuelo no se puede
 * descartar lo guardado todavía.
 *
 * POR QUÉ LA AUTOSELECCIÓN ES UN PARÁMETRO Y NO «¿hay uno solo?».
 *
 * Los dos tipos de cuenta no tienen la misma relación con un proyecto. Un
 * CLIENTE pertenece a una organización y a uno o varios proyectos DE ESA
 * organización: el proyecto es su lugar de trabajo, y con uno solo no hay nada
 * que elegir — preguntarle sería pedirle que confirme la única opción.
 *
 * Un OPERADOR, en cambio, es hoy superadmin del producto: ve todos los
 * proyectos porque los administra, no porque trabaje en uno. Que la lista le dé
 * uno solo es una casualidad del estado de la base, no una pertenencia, y
 * elegirlo por él le pondría un ámbito que nunca pidió. Elige explícitamente o
 * no hay ámbito.
 *
 * (Que operador ⇒ superadmin es una simplificación de hoy, todavía sin refinar.
 * Cuando se refine, lo que cambia es QUIÉN pasa `autoElegirUnico`, no esta
 * función — por eso el parámetro no se llama `esOperador`.)
 */
export function resolverProyectoActivo(entrada: {
  deLaUrl: string | null;
  guardado: string | null;
  accesibles: string[] | null;
  autoElegirUnico: boolean;
}): string | null {
  const { deLaUrl, guardado, accesibles, autoElegirUnico } = entrada;
  if (deLaUrl) return deLaUrl;
  if (accesibles === null) return guardado;
  if (guardado && accesibles.includes(guardado)) return guardado;
  if (!autoElegirUnico) return null;
  return accesibles.length === 1 ? (accesibles[0] ?? null) : null;
}

/**
 * A dónde ir al cambiar de proyecto desde una ruta cualquiera.
 *
 * Se vuelve a la RAÍZ de la superficie, nunca al mismo objeto: un
 * `/chat/viejo/:sessionId` con el id nuevo pediría una conversación de otro
 * proyecto, y `/paquetes/viejo/:slug` un paquete que el nuevo puede no tener.
 * Por eso los paquetes caen al inicio — su ruta entera es del proyecto anterior.
 */
export function rutaAlCambiarDeProyecto(pathname: string, projectId: string): string {
  const [, seccion] = pathname.split('/');
  if (!seccion || !CON_PROYECTO.includes(seccion)) return pathname;
  if (seccion === 'paquetes') return '/';
  return `/${seccion}/${projectId}`;
}

export function leerProyectoGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    // Storage bloqueado (modo privado, permisos): se trabaja sin preferencia.
    return null;
  }
}

export function guardarProyecto(projectId: string | null): void {
  try {
    if (projectId) localStorage.setItem(CLAVE, projectId);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* ídem: no poder recordar la elección no puede romper la navegación */
  }
}
