/**
 * Cliente de `api/catalog` — suites, módulos y herramientas.
 *
 * ACÁ SE SIGUE DICIENDO «moduleTool», Y ES A PROPÓSITO: es el contrato con la API
 * (`CatalogModuleTool`, `runModuleTool`, `/api/catalog/module-tools`), que vive en el
 * otro repo. De este archivo para adentro de la app el nombre es HERRAMIENTA
 * —es lo que el usuario lee y donde viven, la caja de herramientas de la
 * columna derecha—, y la traducción ocurre en un solo lugar:
 * `superficies-del-riel.ts`. Renombrar el tipo acá sin renombrar el endpoint
 * dejaría dos nombres para lo mismo sin una línea que diga cuál es cuál.
 *
 * Dos superficies con audiencias distintas: todo lo de configuración es del
 * superadmin, y `fetchNavigation` la pide cualquier usuario para dibujar su
 * menú. Están en el mismo archivo porque son el mismo modelo, pero no se
 * mezclan: la de navegación devuelve SÓLO lo asignado al proyecto que se pasa.
 */

export interface CatalogModuleTool {
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
  module_tools: CatalogModuleTool[];
  key: string | null;
  origin: 'code' | 'manual';
  status: 'active' | 'missing';
  /** `any` = acepta también las herramientas abiertas; `declared` = sólo las que lo nombran. */
  accepts: 'any' | 'declared';
  created_at: string;
  updated_at: string;
}

export interface CatalogSuite {
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

export interface CatalogModuleToolInput extends CatalogItemInput {
  tool_name?: string | null;
}

export async function listSuites(): Promise<CatalogSuite[]> {
  return handle<CatalogSuite[]>(await fetch('/api/catalog/suites'));
}

export async function createSuite(input: CatalogItemInput): Promise<CatalogSuite> {
  return send('POST', '/api/catalog/suites', input);
}

export async function updateSuite(id: string, input: Partial<CatalogItemInput>): Promise<CatalogSuite> {
  return send('PATCH', `/api/catalog/suites/${encodeURIComponent(id)}`, input);
}

export async function deleteSuite(id: string): Promise<void> {
  await send('DELETE', `/api/catalog/suites/${encodeURIComponent(id)}`);
}

/** Reemplazo TOTAL y en orden: la lista que se manda es la que queda. */
export async function setSuiteModules(id: string, ids: string[]): Promise<CatalogSuite> {
  return send('PUT', `/api/catalog/suites/${encodeURIComponent(id)}/modules`, { ids });
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

export async function setModuleTools(id: string, ids: string[]): Promise<CatalogModule> {
  return send('PUT', `/api/catalog/modules/${encodeURIComponent(id)}/module-tools`, { ids });
}

export async function listModuleTools(): Promise<CatalogModuleTool[]> {
  return handle<CatalogModuleTool[]>(await fetch('/api/catalog/module-tools'));
}

export async function createModuleTool(input: CatalogModuleToolInput): Promise<CatalogModuleTool> {
  return send('POST', '/api/catalog/module-tools', input);
}

export async function updateModuleTool(id: string, input: Partial<CatalogModuleToolInput>): Promise<CatalogModuleTool> {
  return send('PATCH', `/api/catalog/module-tools/${encodeURIComponent(id)}`, input);
}

export async function deleteModuleTool(id: string): Promise<void> {
  await send('DELETE', `/api/catalog/module-tools/${encodeURIComponent(id)}`);
}

/** Las tools que se pueden asociar a una herramienta — la misma fuente que valida al guardar. */
export async function listCatalogTools(): Promise<CatalogToolOption[]> {
  const body = await handle<{ tools: CatalogToolOption[] }>(await fetch('/api/catalog/tools'));
  return body.tools;
}

/** A qué proyectos está asignada cada suite, indexado por suite_id. */
export async function listAssignments(): Promise<Record<string, string[]>> {
  return handle<Record<string, string[]>>(await fetch('/api/catalog/assignments'));
}

export async function setProjectSuites(projectId: string, ids: string[]): Promise<CatalogSuite[]> {
  return send('PUT', `/api/catalog/projects/${encodeURIComponent(projectId)}/suites`, { ids });
}

/**
 * Si una herramienta puede colgarse de un módulo.
 *
 * Misma regla que el backend (`isModuleToolCompatible` en `@jarvis/core`), acá para
 * que la pantalla ofrezca sólo lo compatible en vez de dejar elegir algo que el
 * servidor va a rechazar. El filtro es comodidad; la regla la aplica el backend.
 *
 * Sin compatibilidad declarada (`null`, las creadas a mano antes del registro)
 * entra en cualquier módulo: si no, la pantalla escondería composiciones que ya
 * existen.
 */
export function esCompatible(moduleTool: CatalogModuleTool, module: CatalogModule): boolean {
  if (moduleTool.compatible_with === null) return true;
  if (moduleTool.compatible_with === '*') return module.accepts === 'any';
  return module.key !== null && moduleTool.compatible_with.includes(module.key);
}

/** Ejecuta una herramienta del menú del proyecto y devuelve lo que la tool respondió. */
export async function runModuleTool(
  projectId: string,
  moduleToolId: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const body = await send<{ output: unknown }>(
    'POST',
    `/api/catalog/projects/${encodeURIComponent(projectId)}/module-tools/${encodeURIComponent(moduleToolId)}/run`,
    { input },
  );
  return body.output;
}

/**
 * El menú del proyecto. La pide cualquier usuario, no sólo el superadmin, y
 * devuelve únicamente lo asignado a ese proyecto.
 */
export async function fetchNavigation(projectId: string): Promise<CatalogSuite[]> {
  const body = await handle<{ suites: CatalogSuite[] }>(
    await fetch(`/api/catalog/navigation?project_id=${encodeURIComponent(projectId)}`),
  );
  return body.suites;
}
