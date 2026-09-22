/**
 * Cliente de `api/projects/:id/causacion/soportes` — el repositorio de
 * documentos que sustentan operaciones contables.
 *
 * No pasa por `runModuleTool` (la ruta genérica que ejecuta una herramienta del
 * catálogo) a propósito: por ahí el actor que registra el audit log es el chat,
 * y lo que sube la pantalla lo sube una PERSONA. Endpoint propio = identidad
 * correcta en el log, que es media razón de que el módulo exista.
 */

export interface CausacionSoporte {
  id: string;
  project_id: string;
  /** Relativa a la raíz del repositorio del proyecto. */
  path: string;
  filename: string;
  /** Lo que resultó ser según los bytes, no según la extensión. */
  kind: string;
  size_bytes: number;
  sha256: string;
  tipo: string | null;
  tercero: string | null;
  numero: string | null;
  fecha_documento: string | null;
  monto: number | null;
  /**
   * El resultado de procesar el documento. Forma LIBRE a propósito: todavía se
   * está afinando, y fijarla acá obligaría a un cambio de tipos en cada
   * iteración del extractor.
   */
  procesamiento: Record<string, unknown> | null;
  procesamiento_estado: 'pendiente' | 'listo' | 'fallo';
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntradaArbol {
  nombre: string;
  path: string;
  tipo: 'carpeta' | 'documento';
  documento: CausacionSoporte | null;
  size_bytes: number | null;
}

export class SoporteApiError extends Error {
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
  if (!res.ok) throw new SoporteApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

function base(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/causacion/soportes`;
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

export interface DocumentQuery {
  texto?: string;
  tipo?: string;
  tercero?: string;
  desde?: string;
  hasta?: string;
  carpeta?: string;
  procesamiento_estado?: 'pendiente' | 'listo' | 'fallo';
  limit?: number;
  offset?: number;
}

export async function listDocuments(
  projectId: string,
  query: DocumentQuery = {},
): Promise<{ documentos: CausacionSoporte[]; total: number }> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor));
  }
  const qs = params.toString();
  return handle(await fetch(`${base(projectId)}${qs ? `?${qs}` : ''}`));
}

export async function fetchLimits(projectId: string): Promise<{ extensiones: string[]; max_bytes: number }> {
  return handle(await fetch(`${base(projectId)}/limits`));
}

/**
 * Los bytes del archivo en base64, SIN el prefijo `data:…;base64,` que agrega
 * `readAsDataURL`. El servidor espera base64 puro, y mandar el prefijo hace que
 * la validación de firma falle con un mensaje que no se parece a la causa.
 */
export function leerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`No se pudo leer «${file.name}»`));
    reader.onload = () => {
      const resultado = String(reader.result ?? '');
      const coma = resultado.indexOf(',');
      resolve(coma === -1 ? resultado : resultado.slice(coma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export interface UploadInput {
  filename: string;
  content_base64: string;
  carpeta?: string;
  tipo?: string | null;
  tercero?: string | null;
  numero?: string | null;
  fecha_documento?: string | null;
  monto?: number | null;
}

export async function uploadDocument(
  projectId: string,
  input: UploadInput,
): Promise<{ documento: CausacionSoporte }> {
  return send('POST', base(projectId), input);
}

export async function deleteDocument(projectId: string, id: string): Promise<void> {
  await send('DELETE', `${base(projectId)}/${encodeURIComponent(id)}`);
}

export async function moveDocument(
  projectId: string,
  id: string,
  destino: string,
): Promise<{ documento: CausacionSoporte }> {
  return send('POST', `${base(projectId)}/${encodeURIComponent(id)}/move`, { destino });
}

export async function updateDocument(
  projectId: string,
  id: string,
  metadata: Partial<Pick<CausacionSoporte, 'tipo' | 'tercero' | 'numero' | 'fecha_documento' | 'monto'>>,
): Promise<{ documento: CausacionSoporte }> {
  return send('PATCH', `${base(projectId)}/${encodeURIComponent(id)}`, metadata);
}

export function downloadUrl(projectId: string, id: string): string {
  return `${base(projectId)}/${encodeURIComponent(id)}/download`;
}

export async function fetchTree(projectId: string, carpeta = ''): Promise<EntradaArbol[]> {
  const body = await handle<{ entradas: EntradaArbol[] }>(
    await fetch(`${base(projectId)}/tree${carpeta ? `?carpeta=${encodeURIComponent(carpeta)}` : ''}`),
  );
  return body.entradas;
}
