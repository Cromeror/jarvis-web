/**
 * Cliente de `api/organizations` — roles y miembros por organización.
 *
 * El catálogo de permisos se PIDE al backend (`fetchPermissionCatalog`) en vez
 * de escribirse acá: es cerrado y vive en `packages/storage/src/permissions.ts`,
 * y una copia en el front sería la que diverge justo en el permiso que importa
 * — tildando una casilla que ningún guard evalúa.
 */

export type RoleScope = 'org' | 'project';

export interface OrganizationSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  /** Lo que PUEDE hacer el usuario en sesión sobre esta organización. La UI apaga botones con esto en vez de comerse un 403. */
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface RoleSummary {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

/** Un rol tal como se muestra: el id para operar, el nombre para leer. */
export interface RoleRef {
  role_id: string;
  /** `null` si el rol se borró por debajo. Se muestra como tal, no se inventa un nombre. */
  role_name: string | null;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  username: string;
  user_account_type: 'operator' | 'member';
  /** VARIOS: los permisos del miembro son la unión. Vacío = pertenece sin poder nada. */
  roles: RoleRef[];
  created_at: string;
}

export interface PermissionInfo {
  permission: string;
  description: string;
  /** Quitarlo puede rebotar con 409 por el invariante del último administrador. */
  governance: boolean;
}

/**
 * Un error de la API con su status.
 *
 * El status importa acá y no en los otros clientes: un 409 no es una falla sino
 * una regla de negocio (último administrador, rol en uso) y su mensaje explica
 * cómo salir. Mostrarlo como "error" a secas pierde justamente eso.
 */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

/** Nest contesta `{ message, statusCode }`; si no es JSON, el texto crudo es mejor que nada. */
async function readError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    /* no era JSON */
  }
  return body || `HTTP ${res.status}`;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function listOrganizations(): Promise<OrganizationSummary[]> {
  return handleResponse<OrganizationSummary[]>(await fetch('/api/organizations'));
}

/**
 * Crea una organización con su rol Administrador y su dueño adentro.
 * `owner_user_id` no es opcional: una organización sin miembros no la puede
 * arreglar nadie desde adentro.
 */
export async function createOrganization(input: {
  name: string;
  slug?: string;
  /**
   * Quién la administra. Opcional: sin nadie, la organización nace VACÍA —con
   * su rol Administrador, pero sin miembros— y se puebla después dando de alta
   * usuarios adentro. Es el único camino cuando todos los usuarios existentes
   * ya pertenecen a alguna, que es lo habitual.
   */
  owner_user_id?: string;
}): Promise<OrganizationSummary> {
  return handleResponse<OrganizationSummary>(
    await fetch('/api/organizations', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }),
  );
}

export async function fetchPermissionCatalog(): Promise<PermissionInfo[]> {
  const body = await handleResponse<{ permissions: PermissionInfo[] }>(await fetch('/api/organizations/permissions'));
  return body.permissions;
}

export async function listRoles(organizationId: string): Promise<RoleSummary[]> {
  return handleResponse<RoleSummary[]>(await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/roles`));
}

export async function createRole(
  organizationId: string,
  input: { name: string; description?: string | null; scope: RoleScope; permissions: string[] },
): Promise<RoleSummary> {
  return handleResponse<RoleSummary>(
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/roles`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

export async function updateRole(
  organizationId: string,
  roleId: string,
  input: { name?: string; description?: string | null; permissions?: string[] },
): Promise<RoleSummary> {
  return handleResponse<RoleSummary>(
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/roles/${encodeURIComponent(roleId)}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRole(organizationId: string, roleId: string): Promise<void> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

export async function listMembers(organizationId: string): Promise<OrganizationMember[]> {
  return handleResponse<OrganizationMember[]>(
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/members`),
  );
}

/**
 * Reemplaza el conjunto COMPLETO de roles del miembro — no acumula.
 *
 * Manda el estado que la pantalla muestra, no un diff: con un diff, dos pestañas
 * abiertas se pisan sin que ninguna se entere. Un array vacío es legítimo (queda
 * en la organización sin permisos) y por eso el campo viaja siempre, incluso vacío.
 */
export async function setMemberRoles(organizationId: string, userId: string, roleIds: string[]): Promise<void> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ role_ids: roleIds }) },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

/**
 * El bloque de puertos que el superadmin le concedió a la organización
 * (`/api/installation/port-grants`). Acá es de sólo lectura: la organización lo
 * reparte, no lo agranda.
 */
export interface OrganizationPortBlock {
  id: string;
  organization_id: string;
  start_port: number;
  end_port: number;
  note: string | null;
  created_at: string;
}

/** Un tramo del bloque asignado a un proyecto. `organization_grant_id` dice de qué bloque sale. */
export interface ProjectPortGrant {
  id: string;
  project_id: string;
  organization_grant_id: string;
  start_port: number;
  end_port: number;
  note: string | null;
  created_at: string;
}

/** Todo lo que hace falta para dibujar el reparto sin otra consulta: bloques, tramos y a quién se les puede dar. */
export interface OrganizationPortGrantsResponse {
  blocks: OrganizationPortBlock[];
  project_grants: ProjectPortGrant[];
  projects: Array<{ id: string; name: string }>;
}

export async function listOrganizationPortGrants(organizationId: string): Promise<OrganizationPortGrantsResponse> {
  return handleResponse<OrganizationPortGrantsResponse>(
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/port-grants`),
  );
}

/**
 * Le asigna a un proyecto un tramo del bloque de la organización.
 *
 * `start_port` es opcional: sin él el servidor toma el primer hueco del tamaño
 * pedido. Un 400 (no cabe, se pisa con otro tramo, la organización no tiene
 * bloque) trae un mensaje pensado para mostrarse tal cual.
 */
export async function assignProjectPortGrant(
  organizationId: string,
  input: { project_id: string; size: number; start_port?: number; note?: string | null },
): Promise<ProjectPortGrant> {
  return handleResponse<ProjectPortGrant>(
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/port-grants`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

/** Devuelve el tramo al bloque de la organización. */
export async function revokeProjectPortGrant(organizationId: string, grantId: string): Promise<void> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/port-grants/${encodeURIComponent(grantId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}
