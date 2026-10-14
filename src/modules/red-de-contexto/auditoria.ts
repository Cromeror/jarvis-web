import type { StatusBadgeTone } from '../../components/ui/atoms/StatusBadge.js';
import type { EstadoRevision, MotivoRevision } from '../../lib/red-de-contexto-api.js';

/**
 * Cómo se lee el auditor en pantalla. Funciones puras: la sección del 007 las
 * usa y el test las fija sin montar nada.
 */

const MOTIVOS: Record<MotivoRevision, string> = {
  auditor: 'Lo retuvo el auditor',
  secreto: 'Posible secreto',
  tamano: 'Más grande que el umbral',
  ilegible: 'No se pudo revisar',
  formato: 'Formato no admitido u oculto',
  alcance: 'Contenido de otra carpeta compartida',
  persona: 'Lo decidió una persona',
};

export function etiquetaDeMotivo(motivo: MotivoRevision | null): string {
  return motivo ? MOTIVOS[motivo] : 'Esperando al auditor';
}

export function estadoDeRevision(estado: EstadoRevision): { etiqueta: string; tono: StatusBadgeTone } {
  switch (estado) {
    case 'pendiente':
      return { etiqueta: 'Pendiente', tono: 'neutral' };
    case 'cuarentena':
      return { etiqueta: 'Cuarentena', tono: 'warning' };
    case 'aprobado':
      return { etiqueta: 'Aprobado', tono: 'success' };
    case 'rechazado':
      return { etiqueta: 'Rechazado', tono: 'danger' };
  }
}

const MB = 1024 * 1024;

/** El umbral se edita en MB (con decimales); el backend lo guarda en bytes. */
export function bytesAMb(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

/** `null` si no es un número positivo. */
export function mbABytes(texto: string): number | null {
  const n = Number(texto.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * MB);
}
