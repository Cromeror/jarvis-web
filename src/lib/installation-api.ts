/**
 * Cliente de `api/installation` — lo que gobierna la INSTALACIÓN, no un cliente.
 *
 * Todo acá es del superadmin (`@AccountTypes('operator')` del otro lado). No se
 * mezcla con `catalog-api`, que es el producto que se le vende a una
 * organización: repartir el espacio de puertos de la máquina no es una acción
 * *sobre* una organización, y un archivo compartido invitaría a que una pantalla
 * de cliente importe de acá sin que nada lo frene.
 */

export class InstallationApiError extends Error {
  constructor(
    readonly status: number,
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
  if (!res.ok) throw new InstallationApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

/** Un módulo de instalación tal como lo declara el código de la entrega. */
export interface InstallationModule {
  key: string;
  name: string;
  description: string;
}

/** El bloque de puertos externos concedido a una organización. */
export interface PortGrant {
  id: string;
  organization_id: string;
  start_port: number;
  end_port: number;
  note: string | null;
  created_at: string;
}

export interface PortGrantsResponse {
  /** El espacio asignable de esta instalación. Viene del servidor para no repetir los números acá. */
  pool: { start: number; end: number };
  default_size: number;
  grants: PortGrant[];
}

/**
 * Qué módulos de instalación trae ESTA entrega.
 *
 * Es lo que decide si la pantalla se ofrece: en un on-premise recortado el
 * módulo no está compilado y el riel no lo muestra. Por eso la pregunta va al
 * servidor en vez de ser una constante del front — el front es el mismo bundle
 * para todas las entregas.
 */
export async function listInstallationModules(): Promise<InstallationModule[]> {
  return handle<InstallationModule[]>(await fetch('/api/installation/modules'));
}

export async function listPortGrants(): Promise<PortGrantsResponse> {
  return handle<PortGrantsResponse>(await fetch('/api/installation/port-grants'));
}

/** Se pide CUÁNTOS puertos, no cuáles: el servidor elige el hueco. */
export async function allocatePortGrant(input: {
  organization_id: string;
  size: number;
  note?: string | null;
}): Promise<PortGrant> {
  return handle<PortGrant>(
    await fetch('/api/installation/port-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function revokePortGrant(id: string): Promise<void> {
  const res = await fetch(`/api/installation/port-grants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new InstallationApiError(res.status, await readError(res));
}
