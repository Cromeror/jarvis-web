import type { PreferenciasDeModulo } from './preferencias-de-modulo.js';

/**
 * EL CACHÉ LOCAL DE PREFERENCIAS — lo que hace que la tabla no salte.
 *
 * El problema: la pantalla pinta antes de que el servidor conteste, así que
 * aparece con los defaults y se reacomoda cuando llegan las preferencias. Un
 * salto en cada carga.
 *
 * La salida no es esperar al servidor —eso cambia un salto por una demora
 * visible siempre— sino **tener la respuesta antes de preguntar**: se pinta con
 * lo último conocido y la respuesta del servidor reconcilia por detrás.
 *
 * ## El servidor SIEMPRE gana
 *
 * Esto es un caché, no una fuente. Vale porque es lo que permite abrir la
 * misma cuenta en otra máquina y encontrar lo tuyo: si el local mandara, cada
 * browser tendría su propia verdad y la tabla del servidor no serviría para
 * nada.
 *
 * ## La clave lleva el usuario
 *
 * Sin eso, el siguiente que entre en ese browser ve las columnas del anterior
 * — y en una instalación donde operador y cliente comparten máquina, eso es
 * mostrarle a alguien la configuración de otro. No filtra datos, pero es
 * desconcertante y parece un bug de permisos.
 *
 * ## Nada de esto puede fallar hacia afuera
 *
 * `localStorage` tira en modo privado de algunos browsers y cuando la cuota se
 * llena. Una preferencia de columnas no puede romper una pantalla: todo va
 * envuelto, y sin caché simplemente se vuelve al comportamiento anterior.
 */

const PREFIJO = 'jarvis.prefs';

/** `jarvis.prefs.<usuario>.<módulo>` — el usuario en la clave, no en el valor. */
export function claveDeCache(userId: string, moduleKey: string): string {
  return `${PREFIJO}.${userId}.${moduleKey}`;
}

export function leerCache(userId: string | null, moduleKey: string | null): PreferenciasDeModulo | null {
  if (!userId || !moduleKey) return null;
  try {
    const crudo = window.localStorage.getItem(claveDeCache(userId, moduleKey));
    if (!crudo) return null;
    const v = JSON.parse(crudo) as unknown;
    // Un array o un string entran en JSON igual y romperían a quien los lea
    // esperando un objeto. Basura guardada = sin caché, no una pantalla rota.
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as PreferenciasDeModulo) : null;
  } catch {
    return null;
  }
}

export function escribirCache(
  userId: string | null,
  moduleKey: string | null,
  prefs: PreferenciasDeModulo,
): void {
  if (!userId || !moduleKey) return;
  try {
    window.localStorage.setItem(claveDeCache(userId, moduleKey), JSON.stringify(prefs));
  } catch {
    // Cuota llena o modo privado. Se sigue sin caché: vuelve el salto, no el error.
  }
}

/**
 * Si lo que llegó del servidor es distinto de lo que ya se estaba mostrando.
 *
 * Se compara el JSON y no las referencias: la respuesta del servidor es un
 * objeto nuevo en cada fetch, así que por identidad SIEMPRE diferiría y el
 * re-render que el caché vino a evitar pasaría igual, en cada carga.
 */
export function difieren(a: PreferenciasDeModulo, b: PreferenciasDeModulo): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
