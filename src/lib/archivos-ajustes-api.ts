import { handleResponse } from './organizations-api.js';

/** Los ajustes de la sección Archivos de un proyecto (`MOD-0009`). */
export interface AjustesDeArchivos {
  project_id: string;
  /** Si la sección Archivos oculta lo que ignora el `.gitignore`. */
  ocultar_ignorados: boolean;
  /** Quién lo cambió por última vez; `null` si nunca se configuró (vale el default). */
  updated_by: string | null;
  updated_at: string | null;
}

function url(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/archivos/ajustes`;
}

export async function getAjustesDeArchivos(projectId: string): Promise<AjustesDeArchivos> {
  return handleResponse<AjustesDeArchivos>(await fetch(url(projectId)));
}

export async function setAjustesDeArchivos(projectId: string, ocultarIgnorados: boolean): Promise<AjustesDeArchivos> {
  return handleResponse<AjustesDeArchivos>(
    await fetch(url(projectId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocultar_ignorados: ocultarIgnorados }),
    }),
  );
}
