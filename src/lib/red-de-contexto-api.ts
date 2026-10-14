/**
 * Cliente del módulo `MOD-0004`: los círculos de documentación que
 * los proyectos de una organización comparten entre sí.
 *
 * Dos alcances, como en el backend:
 * - **organización** (`api/organizations/:id/red-contexto`) — lo administra
 *   quien tiene `MOD-0007:manage`: armar círculos, escribir su
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
  /** El contexto general de la carpeta. Markdown. */
  contexto: string;
  /** El espacio que la creó y la administra; `null` = la creó la organización. */
  owner_project_id: string | null;
  /** Desactivada: no se entrega a nadie. `null` = activa. */
  desactivada_at: string | null;
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
  /** Una invitación espera a la organización (`pendiente`); sólo `aprobada` recibe. */
  estado: EstadoDeInvitacion;
  invitado_por: string | null;
  decidido_por: string | null;
  decidido_at: string | null;
  /** Lo que escribió la organización al decidir; sobre todo, por qué rechazó. */
  nota: string | null;
  created_at: string;
}

export type EstadoDeInvitacion = 'pendiente' | 'aprobada' | 'rechazada';

/** Un espacio de la organización al que se le puede compartir. */
export interface EspacioDeRed {
  id: string;
  name: string;
  /** Tiene carpeta en el servidor. Sin ella no hay dónde recibir. */
  tiene_root: boolean;
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
  /** Las carpetas que creó este espacio, con todas sus invitaciones (también pendientes y rechazadas). */
  propias: Array<{ circulo: Circulo; miembros: MiembroDeCirculo[] }>;
  /** Los demás espacios de la organización: a quién se puede invitar. */
  espacios: EspacioDeRed[];
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
    await fetch(`${base(organizationId)}/circulos`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
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

export async function conectarProyecto(
  organizationId: string,
  circuloId: string,
  projectId: string,
): Promise<MiembroDeCirculo> {
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

// ── El auditor (docs/auditor-red-de-contexto.md del core) ──────────────────
// Configuración y bandeja: lo opera la organización desde `MOD-0007`.

export type EstadoRevision = 'pendiente' | 'aprobado' | 'cuarentena' | 'rechazado';
export type MotivoRevision = 'auditor' | 'secreto' | 'tamano' | 'ilegible' | 'formato' | 'alcance' | 'persona';

/** Dónde y qué regla, nunca el texto sensible. */
export interface Hallazgo {
  regla: string;
  ubicacion: string;
  severidad: 'alta' | 'media' | 'baja';
}

/** Un contenido en un círculo: el veredicto es por audiencia. */
export interface Revision {
  organization_id: string;
  circulo_id: string;
  sha256: string;
  estado: EstadoRevision;
  motivo: MotivoRevision | null;
  decidido_por: string | null;
  hallazgos: Hallazgo[];
  explicacion: string | null;
  nota: string | null;
  project_id: string;
  ruta: string;
  bytes: number;
  intentos: number;
  ultimo_error: string | null;
  duracion_ms: number | null;
  costo_usd: number | null;
  decidido_at: string | null;
  created_at: string;
}

export interface EstadoDelAuditor {
  motor: string;
  /** La cuenta del auditor venció: nada se revisa hasta volver a iniciar sesión. */
  sesion_vencida: boolean;
  ultimo_error: string | null;
  ultima_revision_at: string | null;
}

export interface Auditoria {
  organization_id: string;
  activa: boolean;
  reglas: string;
  umbral_bytes: number;
  conteos: Record<EstadoRevision, number>;
  auditor: EstadoDelAuditor;
}

export async function getAuditoria(organizationId: string): Promise<Auditoria> {
  return handleResponse<Auditoria>(await fetch(`${base(organizationId)}/auditoria`));
}

export async function guardarAuditoria(
  organizationId: string,
  patch: { activa?: boolean; reglas?: string; umbral_bytes?: number },
): Promise<Omit<Auditoria, 'conteos' | 'auditor'>> {
  return handleResponse(
    await fetch(`${base(organizationId)}/auditoria`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }),
  );
}

export async function listarRevisiones(organizationId: string, estado?: EstadoRevision): Promise<Revision[]> {
  const q = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  return handleResponse<Revision[]>(await fetch(`${base(organizationId)}/revisiones${q}`));
}

/** Una persona decide. Aprobar hace que viaje en la próxima pasada; rechazar lo deja afuera. */
export async function decidirRevision(
  organizationId: string,
  revision: Pick<Revision, 'circulo_id' | 'sha256'>,
  decision: { estado: 'aprobado' | 'rechazado'; nota?: string },
): Promise<Revision> {
  return handleResponse<Revision>(
    await fetch(
      `${base(organizationId)}/revisiones/${encodeURIComponent(revision.circulo_id)}/${encodeURIComponent(revision.sha256)}/decision`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify(decision) },
    ),
  );
}

// ── Compartir desde el espacio (`MOD-0004:share`) ───────────────
// La red la arman los espacios: crean sus carpetas e invitan a otros. Cada
// invitación queda pendiente hasta que la organización la aprueba.

function baseEspacio(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/red-contexto`;
}

export async function crearCarpetaDeEspacio(
  projectId: string,
  input: { slug: string; nombre: string; contexto?: string },
): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${baseEspacio(projectId)}/carpetas`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

export async function editarCarpetaDeEspacio(
  projectId: string,
  circuloId: string,
  patch: { nombre?: string; contexto?: string },
): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }),
  );
}

export async function borrarCarpetaDeEspacio(projectId: string, circuloId: string): Promise<void> {
  const res = await fetch(`${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

/** Invita a otro espacio: queda pendiente hasta que la organización la apruebe. */
export async function invitarEspacio(projectId: string, circuloId: string, otroId: string): Promise<MiembroDeCirculo> {
  return handleResponse<MiembroDeCirculo>(
    await fetch(`${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}/invitaciones`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ project_id: otroId }),
    }),
  );
}

/** Deja de compartir con un espacio, o retira una invitación. */
export async function dejarDeCompartirDesdeEspacio(
  projectId: string,
  circuloId: string,
  otroId: string,
): Promise<void> {
  const res = await fetch(
    `${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}/miembros/${encodeURIComponent(otroId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

// ── Las invitaciones, del lado de la organización (`MOD-0007:manage`) ──

export async function listarInvitaciones(organizationId: string): Promise<MiembroDeCirculo[]> {
  return handleResponse<MiembroDeCirculo[]>(await fetch(`${base(organizationId)}/invitaciones`));
}

export async function decidirInvitacion(
  organizationId: string,
  circuloId: string,
  projectId: string,
  decision: { estado: 'aprobada' | 'rechazada'; nota?: string },
): Promise<MiembroDeCirculo> {
  return handleResponse<MiembroDeCirculo>(
    await fetch(
      `${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}/miembros/${encodeURIComponent(projectId)}/decision`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify(decision) },
    ),
  );
}

// ── Desactivar / activar una carpeta compartida ─────────────────────────────
// Desactivada, deja de verse para todos (el sync borra las copias de cada
// espacio) y los originales no se tocan. Reactivar vuelve a copiar: no es
// inmediato. La puede desactivar su dueño (el espacio) o la organización.

export async function desactivarCarpeta(organizationId: string, circuloId: string): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}/desactivar`, { method: 'POST' }),
  );
}

export async function activarCarpeta(organizationId: string, circuloId: string): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${base(organizationId)}/circulos/${encodeURIComponent(circuloId)}/activar`, { method: 'POST' }),
  );
}

export async function desactivarCarpetaDeEspacio(projectId: string, circuloId: string): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}/desactivar`, { method: 'POST' }),
  );
}

export async function activarCarpetaDeEspacio(projectId: string, circuloId: string): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${baseEspacio(projectId)}/carpetas/${encodeURIComponent(circuloId)}/activar`, { method: 'POST' }),
  );
}

/** Un directorio `contexto-org/<carpeta>/` en el disco de un espacio que ninguna carpeta compartida nombra. */
export interface CarpetaEnDisco {
  project_id: string;
  slug: string;
  /** Archivos en `publicado/`: lo que compartiría si se agrega. */
  publicados: number;
  bytes_publicados: number;
  /** Todos los archivos de la carpeta, también fuera de `publicado/` (esos no viajan nunca). */
  archivos: number;
  /** Si el nombre sirve como slug; si no, hay que renombrar la carpeta antes de agregarla. */
  nombre_valido: boolean;
}

/** Lee el disco de los espacios: no cambia nada. */
export async function listarCarpetasEnDisco(
  organizationId: string,
): Promise<{ carpetas: CarpetaEnDisco[]; errores: Array<{ project_id: string; error: string }> }> {
  return handleResponse(await fetch(`${base(organizationId)}/en-disco`));
}

/** La registra como carpeta del espacio donde está, sin compartirla con nadie. */
export async function agregarCarpetaDesdeDisco(
  organizationId: string,
  input: { proyecto: string; slug: string; nombre: string },
): Promise<Circulo> {
  return handleResponse<Circulo>(
    await fetch(`${base(organizationId)}/en-disco/agregar`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}
