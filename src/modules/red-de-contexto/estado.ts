import type { StatusBadgeTone } from '../../components/ui/atoms/StatusBadge.js';
import type { MiembroDeCirculo, ProyectoDeRed, Publicado } from '../../lib/red-de-contexto-api.js';
import { timeAgo } from '../../lib/time-ago.js';

/**
 * La lógica de la red de contexto que las dos pantallas comparten —la de la
 * organización y la del módulo en el proyecto—, sin React para poder probarla.
 */

export interface EstadoDeMiembro {
  tono: StatusBadgeTone;
  etiqueta: string;
  /** La explicación larga: el tooltip, o la línea debajo. */
  detalle: string;
  /** Un ícono propio, cuando el del tono no alcanza (rechazada = ✗, no ⚠). */
  icono?: string;
}

/**
 * Cómo está un miembro, en palabras de quien administra.
 *
 * El orden de las preguntas importa: un proyecto sin el módulo o sin carpeta
 * NO PARTICIPA, y eso se dice antes que cualquier error del sync — el error
 * sería la consecuencia, no la causa. `proyecto` es opcional porque la vista
 * del proyecto no sabe de los demás si tienen el módulo; ahí manda lo que dejó
 * escrito el sync.
 */
export function estadoDeMiembro(
  miembro: Pick<MiembroDeCirculo, 'sincronizado_at' | 'ultimo_error'>,
  proyecto?: Pick<ProyectoDeRed, 'con_modulo' | 'tiene_root' | 'desactivado'>,
): EstadoDeMiembro {
  // Desactivado por la organización manda sobre todo lo demás: no comparte ni
  // recibe, así que su sync no dice nada.
  if (proyecto?.desactivado) {
    return {
      tono: 'neutral',
      icono: 'eyeOff',
      etiqueta: 'Desactivado',
      detalle: `La organización lo desactivó en la red: no comparte ni recibe.${proyecto.desactivado.nota ? ` ${proyecto.desactivado.nota}` : ''}`,
    };
  }
  if (proyecto && !proyecto.con_modulo) {
    return {
      tono: 'warning',
      etiqueta: 'Sin la red',
      detalle: 'La organización no tiene la red de contexto: no publica ni recibe.',
    };
  }
  if (proyecto && !proyecto.tiene_root) {
    return {
      tono: 'warning',
      etiqueta: 'Sin carpeta',
      detalle: 'El espacio no tiene carpeta en el servidor: no hay dónde publicar ni dónde recibir.',
    };
  }
  if (!miembro.sincronizado_at) {
    return miembro.ultimo_error
      ? { tono: 'danger', etiqueta: 'No sincroniza', detalle: miembro.ultimo_error }
      : { tono: 'neutral', etiqueta: 'Pendiente', detalle: 'Esperando la primera sincronización (corre cada 30 segundos).' };
  }
  const cuando = `Sincronizado ${timeAgo(miembro.sincronizado_at)}`;
  return miembro.ultimo_error
    ? { tono: 'warning', etiqueta: 'Con aviso', detalle: `${cuando}. ${miembro.ultimo_error}` }
    : { tono: 'success', etiqueta: 'Sincronizado', detalle: cuando };
}

/**
 * El estado de un espacio DENTRO de una carpeta compartida: primero, si la
 * organización aprobó que le llegue; después, cómo le va al sync.
 *
 * Una invitación pendiente o rechazada no recibe nada, así que no tiene
 * sentido hablar de su sincronización: lo que hay que decir es que espera, o
 * por qué no.
 */
export function estadoEnLaCarpeta(
  miembro: Pick<MiembroDeCirculo, 'estado' | 'nota' | 'sincronizado_at' | 'ultimo_error'>,
  proyecto?: Pick<ProyectoDeRed, 'con_modulo' | 'tiene_root' | 'desactivado'>,
): EstadoDeMiembro {
  if (proyecto?.desactivado) return estadoDeMiembro(miembro, proyecto);
  if (miembro.estado === 'pendiente') {
    return {
      tono: 'info',
      etiqueta: 'Pendiente de aprobación',
      detalle: 'La organización todavía no aprobó que esta carpeta le llegue.',
    };
  }
  if (miembro.estado === 'rechazada') {
    return {
      tono: 'danger',
      icono: 'x',
      etiqueta: 'Rechazada',
      detalle: miembro.nota ? `La organización la rechazó: ${miembro.nota}` : 'La organización la rechazó.',
    };
  }
  return estadoDeMiembro(miembro, proyecto);
}

/**
 * Un slug a partir del nombre: es la carpeta en el disco de cada miembro, así
 * que va sin tildes, en minúsculas y con guiones — la misma regla que valida
 * el backend (`^[a-z0-9][a-z0-9-]{0,62}$`).
 */
export function slugDeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

export function slugValido(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(slug);
}

/** Lo publicado en un círculo, por proyecto y ordenado por ruta. */
export function publicadosPorProyecto(publicados: readonly Publicado[]): Map<string, Publicado[]> {
  const out = new Map<string, Publicado[]>();
  for (const p of publicados) {
    const lista = out.get(p.project_id) ?? [];
    lista.push(p);
    out.set(p.project_id, lista);
  }
  for (const lista of out.values()) lista.sort((a, b) => a.ruta.localeCompare(b.ruta));
  return out;
}

export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}
