/**
 * Cuántos chips se muestran para que entren en `maxLineas` líneas, dejando
 * lugar para el chip «+N» cuando no entran todos.
 *
 * Recibe la posición vertical de cada chip ya dibujado (todos en una capa de
 * medición, con el mismo ancho que la celda): los que comparten `top` están en
 * la misma línea. Si sobran líneas, se muestra lo que entra en las primeras
 * `maxLineas` menos uno —ese lugar es del «+N», que siempre es más angosto que
 * un chip con nombre—, y nunca menos de uno.
 */
export function chipsVisibles(tops: readonly number[], maxLineas = 2): number {
  const lineas = [...new Set(tops)].sort((a, b) => a - b);
  if (lineas.length <= maxLineas) return tops.length;
  const tope = lineas[maxLineas - 1]!;
  const entran = tops.filter((t) => t <= tope).length;
  return Math.max(entran - 1, 1);
}
