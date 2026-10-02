import type { ChatAttachmentInput } from './chat-api.js';

/**
 * Qué se puede adjuntar a un turno de chat, y cómo se prepara para mandarlo.
 *
 * Vive acá y no en un composer porque hay DOS: la barra de la pantalla
 * completa (`ChatInputBar`) y el panel que acompaña al trabajo
 * (`FloatingChat`). Con una copia en cada uno, agregar un formato arregla el
 * chat que se está mirando y deja al otro rechazando un archivo que el
 * servidor acepta.
 *
 * Las listas tienen que decir lo mismo que `ALLOWED_ATTACHMENT_EXTENSIONS` en
 * `packages/core/src/chat-attachment-types.ts`, pero esto es **comodidad**
 * —filtrar antes de subir 10 MB al vacío—, no el control: el servidor valida
 * extensión Y firma de bytes, y `POST /api/chat/sessions/:id/messages` es
 * invocable sin pasar por ninguna de las dos pantallas.
 */

/** Separadas porque el menú del `+` ofrece imágenes y documentos por separado, como el template. */
export const IMAGE_ATTACHMENT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
export const DOCUMENT_ATTACHMENT_EXTENSIONS = ['.pdf', '.md', '.markdown'];
export const ACCEPTED_ATTACHMENT_EXTENSIONS = [...IMAGE_ATTACHMENT_EXTENSIONS, ...DOCUMENT_ATTACHMENT_EXTENSIONS];

function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot > 0 ? lower.slice(dot) : '';
}

export function isAcceptedAttachment(file: File): boolean {
  return ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name));
}

/**
 * Parte lo que el usuario soltó en lo que se puede mandar y lo que no.
 *
 * Los rechazados vuelven por nombre para poder decirlo: descartarlos en
 * silencio es el mismo problema que tenía el backend con los adjuntos que no
 * podía leer, sólo que del lado del usuario.
 */
export function splitByAcceptedFormat(files: FileList | File[]): { accepted: File[]; rejected: string[] } {
  const incoming = Array.from(files);
  return {
    accepted: incoming.filter(isAcceptedAttachment),
    rejected: incoming.filter((f) => !isAcceptedAttachment(f)).map((f) => f.name),
  };
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** El ícono del chip, del registro del template: una imagen se ve, un documento se lee. */
export function attachmentIconName(file: File): string {
  return IMAGE_ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name)) ? 'image' : 'doc';
}

/** El `title` del chip: «nombre · tipo · peso», como lo arma el composer del template. */
export function describeAttachment(file: File): string {
  const type = extensionOf(file.name).slice(1).toUpperCase() || 'archivo';
  return `${file.name} · ${type} · ${formatAttachmentSize(file.size)}`;
}

/** Lee un File como base64 (sin el prefijo `data:`) para que viaje en el JSON del turno. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Los adjuntos de UN turno, listos para el body. `undefined` si no hay ninguno. */
export async function filesToAttachmentInputs(files: File[] | undefined): Promise<ChatAttachmentInput[] | undefined> {
  if (!files?.length) return undefined;
  return Promise.all(
    files.map(async (file) => ({ filename: file.name, content_base64: await fileToBase64(file) })),
  );
}
