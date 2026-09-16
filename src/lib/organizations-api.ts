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

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  username: string;
  user_account_type: 'operator' | 'member';
  role_id: string;
  role_name: string | null;
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

export async function setMemberRole(organizationId: string, userId: string, roleId: string): Promise<void> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ role_id: roleId }) },
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
