import type { WorkspaceDirEntry, WorkspaceFileResponse } from './workspace-files-api.js';

/**
 * Lógica del explorador: cómo se ordena un nivel del árbol, qué carpetas hay
 * que abrir para llegar a un archivo, y qué se puede mostrar de un archivo.
 *
 * Acá y no en el componente por lo de siempre en este repo (ver
 * session-workspace.ts): los casos borde son de datos —un binario, un archivo
 * enorme, una carpeta truncada, un path en la raíz— y testearlos sin renderizar
 * es más barato.
 */

export interface TreeNode {
  /** Path completo relativo al root del workspace. */
  path: string;
  name: string;
  type: WorkspaceDirEntry['type'];
  /** True si se puede expandir (y por lo tanto pedirle hijos al backend). */
  expandable: boolean;
}

/**
 * Un nivel del árbol: carpetas primero y después archivos, cada grupo
 * alfabético.
 *
 * El backend ya devuelve todo alfabético en una sola lista; separar carpetas
 * de archivos es convención de explorador (VSCode, Finder) y hace que un
 * directorio con muchos archivos no esconda sus subcarpetas al final.
 */
export function toTreeNodes(dir: string, entries: WorkspaceDirEntry[]): TreeNode[] {
  const prefix = dir === '' ? '' : `${dir}/`;
  const nodes = entries.map((entry) => ({
    path: `${prefix}${entry.name}`,
    name: entry.name,
    type: entry.type,
    // Un symlink a directorio también se puede abrir: el backend resuelve y
    // rechaza el que salga del workspace, así que intentarlo es seguro.
    expandable: entry.type === 'dir' || entry.type === 'symlink',
  }));
  return nodes.sort((a, b) => {
    const aDir = a.type === 'dir';
    const bDir = b.type === 'dir';
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Las carpetas que hay que tener abiertas para que un archivo sea visible.
 *
 * Es lo que convierte la URL en algo recargable: al entrar con `?file=a/b/c.ts`
 * hay que abrir `a` y `a/b` —y pedirle los hijos a cada una— o el archivo
 * quedaría seleccionado pero fuera de la pantalla.
 */
export function ancestorDirs(path: string): string[] {
  const parts = path.split('/').filter((p) => p !== '');
  // El último segmento es el archivo, no una carpeta que abrir.
  parts.pop();
  const dirs: string[] = [];
  let acc = '';
  for (const part of parts) {
    acc = acc === '' ? part : `${acc}/${part}`;
    dirs.push(acc);
  }
  return dirs;
}

/**
 * Dónde está parado el explorador, leído de la URL.
 *
 * La convención es la de cualquier URL: una ruta que termina en `/` es un
 * directorio, y una que no, un archivo. Sin esa marca habría que preguntarle al
 * backend qué es cada path del link antes de poder abrir el árbol — o peor,
 * pedirle el listado de un archivo y mostrar el error.
 */
export interface ExplorerLocation {
  /** Carpetas que hay que abrir (y pedir) para que lo seleccionado se vea. */
  dirsToExpand: string[];
  /** Archivo a previsualizar, si lo que está seleccionado es un archivo. */
  selectedFile: string | undefined;
  /** Directorio seleccionado, si lo que está seleccionado es una carpeta. */
  selectedDir: string | undefined;
}

const EMPTY_LOCATION: ExplorerLocation = { dirsToExpand: [], selectedFile: undefined, selectedDir: undefined };

/** Lee la ruta actual de la URL. */
export function parseExplorerPath(raw: string | undefined): ExplorerLocation {
  if (!raw || raw === '' || raw === '/') return EMPTY_LOCATION;
  const isDir = raw.endsWith('/');
  const clean = isDir ? raw.slice(0, -1) : raw;
  if (clean === '') return EMPTY_LOCATION;
  if (isDir) {
    // Un directorio se abre a sí mismo además de a sus ancestros.
    return { dirsToExpand: [...ancestorDirs(clean), clean], selectedFile: undefined, selectedDir: clean };
  }
  return { dirsToExpand: ancestorDirs(clean), selectedFile: clean, selectedDir: undefined };
}

/** Arma la ruta para la URL, marcando los directorios con la barra final. */
export function toExplorerPath(path: string, isDir: boolean): string {
  return isDir ? `${path}/` : path;
}

/** Qué se puede mostrar de un archivo. */
export type PreviewKind = 'markdown' | 'text' | 'binary' | 'too_large' | 'error' | 'empty';

export interface PreviewState {
  kind: PreviewKind;
  /** Texto a mostrar cuando no hay contenido que pintar. */
  message: string | null;
  content: string | null;
}

/** Tamaño legible: el número crudo en bytes no le dice nada a nadie. */
export function humanSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

function isMarkdown(path: string): boolean {
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * De la respuesta del backend a qué pinta el visor.
 *
 * El orden importa: primero lo que IMPIDE mostrar contenido (error, binario,
 * demasiado grande) y recién después el contenido. Un binario cuyo `content`
 * viniera con algo no se debe pintar igual — mostrar bytes crudos como si
 * fueran texto es exactamente la basura que hay que evitar.
 */
export function toPreviewState(file: WorkspaceFileResponse): PreviewState {
  if (file.error) {
    return { kind: 'error', message: file.error, content: null };
  }
  if (file.binary) {
    return {
      kind: 'binary',
      message: `Archivo binario${file.size !== null ? ` (${humanSize(file.size)})` : ''} — no se puede mostrar como texto.`,
      content: null,
    };
  }
  if (file.too_large) {
    return {
      kind: 'too_large',
      message: `El archivo pesa ${humanSize(file.size)} y supera el tope de vista previa.`,
      content: null,
    };
  }
  if (file.content === null || file.content === '') {
    return { kind: 'empty', message: 'El archivo está vacío.', content: null };
  }
  return {
    kind: isMarkdown(file.path) ? 'markdown' : 'text',
    message: null,
    content: file.content,
  };
}
