import { ApiError } from '../../lib/organizations-api.js';

/**
 * El mensaje que hay que mostrar de un error de la API de organizaciones.
 *
 * Vive acá y no adentro de un componente porque lo usan los tres (el panel, el
 * alta de organización y la página): un 409 no es una falla sino un invariante
 * —el último administrador, un rol en uso, una persona que ya pertenece a otra
 * organización— y su mensaje explica cómo salir. Perderlo detrás de un "error
 * al guardar" deja a quien configura sin saber qué hacer.
 */
export function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}
