import type { OrganizationPortBlock, ProjectPortGrant } from '../../lib/organizations-api.js';

/** Un pedazo contiguo del bloque: o es de un tramo, o está libre. */
export type SegmentoDeBloque =
  | { tipo: 'tramo'; grant: ProjectPortGrant; start: number; end: number; size: number }
  | { tipo: 'libre'; start: number; end: number; size: number };

export interface RepartoDeBloque {
  total: number;
  repartidos: number;
  libres: number;
  /** El hueco contiguo más grande: es lo que de verdad decide si un tramo de N entra sin elegir el puerto. */
  mayorHueco: number;
  /** En orden de puerto, cubriendo el bloque entero sin huecos ni solapes. */
  segmentos: SegmentoDeBloque[];
}

/**
 * Cómo está partido un bloque entre los proyectos.
 *
 * Es lógica pura y no vive en el componente porque la barra es la que dice
 * «cuánto queda», y un error de borde acá (un `+1` de menos, un tramo de otro
 * bloque contado como propio) es una pantalla que miente sobre lo único que se
 * viene a mirar. Los tramos se filtran por `organization_grant_id`: una
 * organización puede tener más de un bloque y cada barra cuenta sólo lo suyo.
 *
 * Además del total libre se calcula el mayor hueco, a diferencia de
 * `PortGrantsPage`: acá los bloques son chicos y el formulario pregunta
 * cuántos, así que «hay 12 libres pero el mayor hueco es de 4» es justo lo que
 * evita un 400 de «no cabe».
 */
export function repartoDeBloque(block: OrganizationPortBlock, grants: ProjectPortGrant[]): RepartoDeBloque {
  const propios = grants
    .filter((g) => g.organization_grant_id === block.id)
    .sort((a, b) => a.start_port - b.start_port);

  const segmentos: SegmentoDeBloque[] = [];
  let cursor = block.start_port;
  for (const g of propios) {
    // Defensivo: un tramo fuera del bloque no debería existir (el servidor lo
    // rechaza), pero si existiera se recorta en vez de estirar la barra.
    const start = Math.max(g.start_port, block.start_port);
    const end = Math.min(g.end_port, block.end_port);
    if (end < start) continue;
    if (start > cursor) segmentos.push({ tipo: 'libre', start: cursor, end: start - 1, size: start - cursor });
    segmentos.push({ tipo: 'tramo', grant: g, start, end, size: end - start + 1 });
    cursor = Math.max(cursor, end + 1);
  }
  if (cursor <= block.end_port) {
    segmentos.push({ tipo: 'libre', start: cursor, end: block.end_port, size: block.end_port - cursor + 1 });
  }

  const total = block.end_port - block.start_port + 1;
  const libres = segmentos.filter((s) => s.tipo === 'libre').reduce((suma, s) => suma + s.size, 0);
  const mayorHueco = segmentos.reduce((max, s) => (s.tipo === 'libre' && s.size > max ? s.size : max), 0);
  return { total, repartidos: total - libres, libres, mayorHueco, segmentos };
}
