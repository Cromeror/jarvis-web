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
  creado_por: string | null;
  /**
   * De qué documento contable es evidencia este archivo, o `null` si está
   * suelto. Lo accionable: un archivo se elimina con su documento.
   */
  documento_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntradaArbol {
  nombre: string;
  path: string;
  tipo: 'carpeta' | 'documento';
  documento: CausacionSoporte | null;
  /**
   * De qué DOCUMENTO CONTABLE es esta entrada.
   *
   * En una carpeta, el documento que agrupa —su nombre es ese id—; en un
   * archivo, el documento del que es evidencia, o `null` si está suelto.
   *
   * Es lo accionable: un archivo se elimina con su documento, no solo.
   */
  documento_id: string | null;
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
  /** Sólo para el multi-hoja: la página se cuelga de ese documento. */
  documento_id?: string;
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
}

/**
 * Sube un archivo y lo deja como DOCUMENTO.
 *
 * Devuelve los dos: el archivo y el documento contable que quedó. Antes sólo
 * creaba el archivo, y un archivo sin documento no se clasifica, no se extrae y
 * no cuenta para cerrar el periodo — no es un estado intermedio, es un
 * documento perdido.
 *
 * Es exactamente lo mismo que hace la tool del chat; lo único que cambia es que
 * acá los bytes suben por la red.
 */
export async function uploadDocument(
  projectId: string,
  input: UploadInput,
): Promise<{ archivo: CausacionSoporte; documento: { id: string } }> {
  return send('POST', base(projectId), input);
}

/**
 * Elimina un documento contable Y SUS ARCHIVOS.
 *
 * Reemplaza al borrado de archivo suelto, que se quitó: pasaba por fuera de las
 * reglas —un archivo de un documento auditado se podía sacar sin más— y no era
 * atómico. Este endpoint ejecuta exactamente lo mismo que la tool del chat.
 *
 * Es reversible: los bytes van a la papelera.
 */
export async function eliminarDocumento(
  projectId: string,
  documentoId: string,
  motivo?: string,
): Promise<{ archivos: string[] }> {
  return send(
    'DELETE',
    `/api/projects/${encodeURIComponent(projectId)}/causacion/documentos/${encodeURIComponent(documentoId)}`,
    motivo ? { motivo } : undefined,
  );
}

/** Renombra, no mueve: el módulo guarda todo plano y esa ubicación es suya. */
export async function renombrarArchivo(
  projectId: string,
  id: string,
  nombre: string,
): Promise<{ documento: CausacionSoporte }> {
  return send('POST', `${base(projectId)}/${encodeURIComponent(id)}/renombrar`, { nombre });
}

// NO hay `updateDocument`, y es una decisión. Editaba tipo, tercero, número,
// fecha y monto EN EL ARCHIVO — datos que son del asiento del documento, donde
// además queda registrado si los puso la IA o el auditor. Escritos en el
// archivo quedaban fuera de esa trazabilidad y el circuito no los miraba.

export function downloadUrl(projectId: string, id: string): string {
  return `${base(projectId)}/${encodeURIComponent(id)}/download`;
}

export async function fetchTree(projectId: string, carpeta = ''): Promise<EntradaArbol[]> {
  const body = await handle<{ entradas: EntradaArbol[] }>(
    await fetch(`${base(projectId)}/tree${carpeta ? `?carpeta=${encodeURIComponent(carpeta)}` : ''}`),
  );
  return body.entradas;
}

/**
 * Los BYTES del archivo, con la sesión puesta.
 *
 * No alcanza con apuntar un `<img src>` o un `<a href>` a `downloadUrl`: el
 * token viaja en `Authorization`, que lo pone el interceptor de `window.fetch`
 * (`lib/auth-fetch-interceptor.ts`), y el browser NO lo manda cuando carga un
 * subrecurso ni cuando navega. `JwtAuthGuard` sólo lee ese header —no hay
 * cookie de sesión—, así que por esos dos caminos el servidor responde 401.
 *
 * Con `fetch` sí pasa por el interceptor. De ahí sale un blob y un object URL,
 * que es lo que se le puede dar al `<img>`.
 */
export async function fetchSoporteBlob(projectId: string, id: string): Promise<Blob> {
  const res = await fetch(downloadUrl(projectId, id));
  if (!res.ok) throw new SoporteApiError(res.status, await readError(res));
  return res.blob();
}

/**
 * Bajar el archivo, también con la sesión puesta.
 *
 * Mismo motivo que arriba: un `window.location.href` a la URL de descarga es
 * una navegación sin token. Se traen los bytes y se dispara un `<a download>`
 * sobre el object URL; el nombre sale del filename que guardamos, no del
 * `Content-Disposition`, porque el blob ya perdió los headers.
 */
export async function descargarSoporte(projectId: string, id: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(await fetchSoporteBlob(projectId, id));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  /* Se revoca en el próximo tick y no en la línea siguiente: revocarlo antes de
     que el click arranque la descarga la cancela. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Si el browser puede dibujarlo en un `<img>`.
 *
 * El `kind` lo decide el servidor por FIRMA DE BYTES y viene como texto
 * («imagen PNG», «documento PDF»), así que se pregunta por él y no por la
 * extensión — un `.jpg` que en realidad es un PDF acá dice PDF.
 *
 * HEIC queda afuera aunque sea imagen: ningún navegador de escritorio lo
 * decodifica, y un `<img>` roto es peor que decir que no se puede ver.
 */
export function sePuedeVer(kind: string): boolean {
  return kind.startsWith('imagen') && !kind.includes('HEIC');
}
