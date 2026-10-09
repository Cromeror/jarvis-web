/**
 * Cliente del módulo `red-de-contexto-004`: los círculos de documentación que
 * los proyectos de una organización comparten entre sí.
 *
 * Dos alcances, como en el backend:
 * - **organización** (`api/organizations/:id/red-contexto`) — lo administra
 *   quien tiene `red-de-contexto-org-007:manage`: armar círculos, escribir su
 *   contexto general, conectar proyectos.
 * - **proyecto** (`api/projects/:id/red-contexto`) — lo que ve un proyecto:
 *   sus círculos, con quién comparte y qué publicó cada uno.
 *
 * Los errores son `ApiError`: un 400 trae un mensaje escrito para mostrarse tal
 * cual (slug repetido, proyecto de otra organización).
 */
import { ApiError, handleResponse, readError } from './organizations-api.js';

export interface Circulo {
  id: string;
  organization_id: string;
  /** Nombre de la carpeta en cada miembro (`contexto-org/<slug>/`). No se cambia. */
  slug: string;
  nombre: string;
  /** El contexto general que escribe la organización. Markdown. */
  contexto: string;
  created_at: string;
  updated_at: string;
}

export interface MiembroDeCirculo {
  circulo_id: string;
  project_id: string;
  organization_id: string;
  /** La última pasada del sync que terminó bien con este miembro. */
  sincronizado_at: string | null;
  /** Lo último que el sync tiene para decir de este miembro, haya andado o no. */
  ultimo_error: string | null;
  created_at: string;
}

export interface Publicado {
  circulo_id: string;
  project_id: string;
  /** Relativa a `publicado/`. */
  ruta: string;
  sha256: string;
  bytes: number;
  mtime_ms: number;
}

/** Un proyecto de la organización, con lo que hace falta para saber si puede participar. */
export interface ProyectoDeRed {
  id: string;
  name: string;
  /** Tiene el módulo activo por una suite. Sin él, conectarlo no le entrega nada. */
  con_modulo: boolean;
  /** Tiene carpeta en el disco. Sin ella no hay dónde publicar ni recibir. */
  tiene_root: boolean;
}

export interface RedDeOrganizacion {
  circulos: Array<Circulo & { miembros: MiembroDeCirculo[] }>;
  proyectos: ProyectoDeRed[];
}

export interface ResultadoSync {
  organization_id: string;
  escritos: number;
  borrados: number;
  errores: string[];
}

export interface RedDeProyecto {
  /** La carpeta en la raíz del proyecto donde vive todo (`contexto-org`). */
  carpeta: string;
  circulos: Array<{ circulo: Circulo; miembros: MiembroDeCirculo[]; publicados: Publicado[] }>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function base(organizationId: string): string {
  return `/api/organizations/${encodeURIComponent(organizationId)}/red-contexto`;
}

export async function getRedDeOrganizacion(organizationId: string): Promise<RedDeOrganizacion> {
  return handleResponse<RedDeOrganizacion>(await fetch(base(organizationId)));
}

export async function crearCirculo(
  organizationId: string,
  input: { slug: string; nombre: string; contexto?: string },
): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${base(organizationId)}/circulos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }),
  );
}

/** Nombre y contexto. El slug no se cambia: es la carpeta en el disco de cada miembro. */
export async function editarCirculo(
  organizationId: string,
  circuloId: string,
  patch: { nombre?: string; contexto?: string },
): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }),
  );
}

export async function borrarCirculo(organizationId: string, circuloId: string): Promise<void> {
  const res = await fetch(`${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

export async function conectarProyecto(organizationId: string, circuloId: string, projectId: string): Promise<MiembroDeCirculo> {
  return handleResponse<MiembroDeCirculo>(
    await fetch(`${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}/miembros`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ project_id: projectId }),
    }),
  );
}

export async function desconectarProyecto(organizationId: string, circuloId: string, projectId: string): Promise<void> {
  const res = await fetch(
    `${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}/miembros/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

/** Corre el sync de la organización ya, sin esperar al intervalo (30 s). */
export async function sincronizarAhora(organizationId: string): Promise<ResultadoSync> {
  return handleResponse<ResultadoSync>(await fetch(`${base(organizationId)}/sincronizar`, { method: 'POST' }));
}

export async function getRedDeProyecto(projectId: string): Promise<RedDeProyecto> {
  return handleResponse<RedDeProyecto>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/red-contexto`));
}
