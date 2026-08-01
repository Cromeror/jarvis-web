/**
 * "hace X" relativo desde un ISO timestamp — minutos/horas/días. Mismo criterio
 * (y mismo texto) que las copias locales de PlansPage y CardProject; acá vive la
 * versión compartida para no seguir duplicándola en cada vista nueva.
 */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function secondsSince(iso: string, now: number): number {
  const elapsed = Math.floor((now - new Date(iso).getTime()) / 1000);
  // Clock skew between server and browser can make a fresh row look future-dated.
  return elapsed < 0 ? 0 : elapsed;
}

/**
 * "hace 3s" / "hace 9 min" — la cola LIVE del rail del chat necesita segundos
 * (los eventos llegan en tiempo real) y el texto largo del diseño, mientras
 * `timeAgo` mantiene el suyo ("hace 9m", sin segundos) porque ya está en
 * PlansPage/CardProject y cambiarlo movería copy de esas vistas. `now` es
 * parámetro para que el hook recalcule al refrescar en vez de congelarse.
 */
export function timeAgoPrecise(iso: string, now: number = Date.now()): string {
  const seconds = secondsSince(iso, now);
  if (seconds < MINUTE) return `hace ${seconds}s`;
  if (seconds < HOUR) return `hace ${Math.floor(seconds / MINUTE)} min`;
  if (seconds < DAY) return `hace ${Math.floor(seconds / HOUR)} h`;
  return `hace ${Math.floor(seconds / DAY)} d`;
}

/** "recién" / "45 min activo" — el DurationIndicator de la card de Focus. */
export function activeFor(iso: string, now: number = Date.now()): string {
  const seconds = secondsSince(iso, now);
  if (seconds < MINUTE) return 'recién';
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min activo`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} h activo`;
  return `${Math.floor(seconds / DAY)} d activo`;
}
