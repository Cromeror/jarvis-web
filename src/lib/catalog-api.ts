/**
 * Cliente de `api/catalog` — paquetes, módulos y utilidades.
 *
 * Dos superficies con audiencias distintas: todo lo de configuración es del
 * superadmin, y `fetchNavigation` la pide cualquier usuario para dibujar su
 * menú. Están en el mismo archivo porque son el mismo modelo, pero no se
 * mezclan: la de navegación devuelve SÓLO lo asignado al proyecto que se pasa.
 */

export interface CatalogUtility {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** La tool que la ejecuta. `null` = declarada antes de que su tool exista. */
  tool_name: string | null;
  /** El identificador del CÓDIGO. `null` = la escribieron a mano en la pantalla. */
  key: string | null;
  origin: 'code' | 'manual';
  /** `missing` = el código dejó de declararla; sigue configurada, pero ya no resuelve. */
  status: 'active' | 'missing';
  /** `'*'` = abierta; lista = cerrada a esos `module.key`; `null` = sin declarar (entra en cualquiera). */
  compatible_with: '*' | string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogModule {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  utilities: CatalogUtility[];
  key: string | null;
  origin: 'code' | 'manual';
  status: 'active' | 'missing';
  /** `any` = acepta también las utilidades abiertas; `declared` = sólo las que lo nombran. */
  accepts: 'any' | 'declared';
  created_at: string;
  updated_at: string;
}

export interface CatalogPackage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  modules: CatalogModule[];
  created_at: string;
  updated_at: string;
}

export interface CatalogToolOption {
  name: string;
  description: string;
}

/** Un error de la API con su status — un 400 acá es una regla, no una falla. */
export class CatalogApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new CatalogApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method,
      headers: jsonHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

export interface CatalogItemInput {
  name: string;
  slug?: string;
  description?: string | null;
}

export interface CatalogUtilityInput extends CatalogItemInput {
  tool_name?: string | null;
}

export async function listPackages(): Promise<CatalogPackage[]> {
  return handle<CatalogPackage[]>(await fetch('/api/catalog/packages'));
}

export async function createPackage(input: CatalogItemInput): Promise<CatalogPackage> {
  return send('POST', '/api/catalog/packages', input);
}

export async function updatePackage(id: string, input: Partial<CatalogItemInput>): Promise<CatalogPackage> {
  return send('PATCH', `/api/catalog/packages/${encodeURIComponent(id)}`, input);
}

export async function deletePackage(id: string): Promise<void> {
  await send('DELETE', `/api/catalog/packages/${encodeURIComponent(id)}`);
}

/** Reemplazo TOTAL y en orden: la lista que se manda es la que queda. */
export async function setPackageModules(id: string, ids: string[]): Promise<CatalogPackage> {
  return send('PUT', `/api/catalog/packages/${encodeURIComponent(id)}/modules`, { ids });
}

export async function listModules(): Promise<CatalogModule[]> {
  return handle<CatalogModule[]>(await fetch('/api/catalog/modules'));
}

export async function createModule(input: CatalogItemInput): Promise<CatalogModule> {
  return send('POST', '/api/catalog/modules', input);
}

export async function updateModule(id: string, input: Partial<CatalogItemInput>): Promise<CatalogModule> {
  return send('PATCH', `/api/catalog/modules/${encodeURIComponent(id)}`, input);
}

export async function deleteModule(id: string): Promise<void> {
  await send('DELETE', `/api/catalog/modules/${encodeURIComponent(id)}`);
}

export async function setModuleUtilities(id: string, ids: string[]): Promise<CatalogModule> {
  return send('PUT', `/api/catalog/modules/${encodeURIComponent(id)}/utilities`, { ids });
}

export async function listUtilities(): Promise<CatalogUtility[]> {
  return handle<CatalogUtility[]>(await fetch('/api/catalog/utilities'));
}

export async function createUtility(input: CatalogUtilityInput): Promise<CatalogUtility> {
  return send('POST', '/api/catalog/utilities', input);
}

export async function updateUtility(id: string, input: Partial<CatalogUtilityInput>): Promise<CatalogUtility> {
  return send('PATCH', `/api/catalog/utilities/${encodeURIComponent(id)}`, input);
}

export async function deleteUtility(id: string): Promise<void> {
  await send('DELETE', `/api/catalog/utilities/${encodeURIComponent(id)}`);
}

/** Las tools que se pueden asociar a una utilidad — la misma fuente que valida al guardar. */
export async function listCatalogTools(): Promise<CatalogToolOption[]> {
  const body = await handle<{ tools: CatalogToolOption[] }>(await fetch('/api/catalog/tools'));
  return body.tools;
}

/** A qué proyectos está asignado cada paquete, indexado por package_id. */
export async function listAssignments(): Promise<Record<string, string[]>> {
  return handle<Record<string, string[]>>(await fetch('/api/catalog/assignments'));
}

export async function setProjectPackages(projectId: string, ids: string[]): Promise<CatalogPackage[]> {
  return send('PUT', `/api/catalog/projects/${encodeURIComponent(projectId)}/packages`, { ids });
}

/**
 * Si una utilidad puede colgarse de un módulo.
 *
 * Misma regla que el backend (`isUtilityCompatible` en `@jarvis/core`), acá para
 * que la pantalla ofrezca sólo lo compatible en vez de dejar elegir algo que el
 * servidor va a rechazar. El filtro es comodidad; la regla la aplica el backend.
 *
 * Sin compatibilidad declarada (`null`, las creadas a mano antes del registro)
 * entra en cualquier módulo: si no, la pantalla escondería composiciones que ya
 * existen.
 */
export function esCompatible(utility: CatalogUtility, module: CatalogModule): boolean {
  if (utility.compatible_with === null) return true;
  if (utility.compatible_with === '*') return module.accepts === 'any';
  return module.key !== null && utility.compatible_with.includes(module.key);
}

/** Ejecuta una utilidad del menú del proyecto y devuelve lo que la tool respondió. */
export async function runUtility(
  projectId: string,
  utilityId: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const body = await send<{ output: unknown }>(
    'POST',
    `/api/catalog/projects/${encodeURIComponent(projectId)}/utilities/${encodeURIComponent(utilityId)}/run`,
    { input },
  );
  return body.output;
}

/**
 * El menú del proyecto. La pide cualquier usuario, no sólo el superadmin, y
 * devuelve únicamente lo asignado a ese proyecto.
 */
export async function fetchNavigation(projectId: string): Promise<CatalogPackage[]> {
  const body = await handle<{ packages: CatalogPackage[] }>(
    await fetch(`/api/catalog/navigation?project_id=${encodeURIComponent(projectId)}`),
  );
  return body.packages;
}
