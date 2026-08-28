import { parsePatch } from 'diff';
import type { ChangedFile, FileStatus } from './workspace-changes-api.js';
import type { StatusBadgeTone } from '../components/ui/atoms/StatusBadge.js';

/**
 * De la salida de git a lo que se dibuja: la lista de archivos cambiados y el
 * diff unificado con resaltado por línea.
 *
 * Vive en lib/ y no en el componente por la razón de siempre en este repo
 * (ver session-workspace.ts): los casos borde son de datos, no de pintura —
 * un diff truncado a la mitad, un archivo binario, un rename, una línea sin
 * salto final. Testear eso sin renderizar es más barato y más honesto.
 *
 * El parseo lo hace `parsePatch` de jsdiff (la dependencia `diff` que ya usa
 * PlanFullscreenModal). NO se calcula el diff acá: git ya lo mandó hecho, así
 * que lo único que falta es entenderlo.
 */

// ---------------------------------------------------------------------------
// Lista de archivos
// ---------------------------------------------------------------------------

/** En qué columna de git está el cambio que se va a mostrar. */
export type ChangeSide = 'worktree' | 'staged';

export interface ChangedFileRow {
  path: string;
  origPath: string | null;
  /** Nombre del archivo, sin el directorio. */
  name: string;
  /** El directorio que lo contiene, o '' en la raíz. */
  dir: string;
  /** Letra corta al estilo de VSCode: M, A, D, U, R… */
  letter: string;
  /** Texto largo, para el title. */
  label: string;
  tone: StatusBadgeTone;
  /** Qué diff se muestra por defecto para este archivo. */
  defaultSide: ChangeSide;
  /** True si el archivo tiene cambios en las DOS columnas y vale ofrecer el toggle. */
  hasBothSides: boolean;
}

const STATUS_LETTER: Record<FileStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  type_changed: 'T',
  untracked: 'U',
  unmerged: '!',
};

const STATUS_LABEL: Record<FileStatus, string> = {
  modified: 'Modificado',
  added: 'Agregado',
  deleted: 'Borrado',
  renamed: 'Renombrado',
  copied: 'Copiado',
  type_changed: 'Cambió de tipo',
  untracked: 'Sin trackear',
  unmerged: 'En conflicto',
};

const STATUS_TONE: Record<FileStatus, StatusBadgeTone> = {
  modified: 'warning',
  added: 'success',
  deleted: 'danger',
  renamed: 'info',
  copied: 'info',
  type_changed: 'info',
  untracked: 'neutral',
  unmerged: 'danger',
};

/**
 * Un archivo de la lista a una fila.
 *
 * El estado que se muestra es el del working tree si lo hay, y si no el del
 * índice: es el orden en que a alguien revisando su propio trabajo le
 * interesan — primero lo que todavía no guardó.
 *
 * `defaultSide` sigue la misma idea, pero además evita un vacío: un archivo
 * que SOLO tiene cambios stageados no aparece en `git diff` (el working tree
 * está igual al índice), así que abrirlo con el diff del working tree mostraría
 * "sin cambios" para algo que la lista acaba de anunciar como modificado.
 */
export function toChangedFileRow(file: ChangedFile): ChangedFileRow {
  const status = file.unstaged ?? file.staged ?? 'modified';
  const slash = file.path.lastIndexOf('/');
  return {
    path: file.path,
    origPath: file.orig_path,
    name: slash === -1 ? file.path : file.path.slice(slash + 1),
    dir: slash === -1 ? '' : file.path.slice(0, slash),
    letter: STATUS_LETTER[status],
    label: STATUS_LABEL[status],
    tone: STATUS_TONE[status],
    defaultSide: file.unstaged ? 'worktree' : 'staged',
    hasBothSides: file.staged !== null && file.unstaged !== null,
  };
}

/**
 * La lista de archivos para el panel.
 *
 * Un archivo sin cambios NO aparece: git no lo lista, y si por lo que fuera
 * llegara una fila con las dos columnas vacías, se descarta acá — una entrada
 * que al abrirla no tiene nada que mostrar es peor que no estar.
 */
export function toChangedFileRows(files: ChangedFile[]): ChangedFileRow[] {
  return files.filter((f) => f.staged !== null || f.unstaged !== null).map(toChangedFileRow);
}

// ---------------------------------------------------------------------------
// Diff unificado
// ---------------------------------------------------------------------------

export type DiffLineType = 'context' | 'add' | 'del' | 'meta';

export interface DiffLine {
  type: DiffLineType;
  /** El texto de la línea, sin el prefijo `+`/`-`/espacio. */
  content: string;
  /** Número de línea en la versión vieja, o null si la línea no existe ahí. */
  oldNumber: number | null;
  newNumber: number | null;
}

export interface DiffHunk {
  /** `@@ -1,5 +1,5 @@` reconstruido, para mostrar como separador. */
  header: string;
  lines: DiffLine[];
}

export interface ParsedDiff {
  hunks: DiffHunk[];
  /**
   * Hubo que descartar el final incompleto para poder parsear. Pasa con un
   * diff truncado: `parsePatch` es estricto y explota si un hunk tiene menos
   * líneas que las que declara su cabecera.
   */
  repaired: boolean;
  /** Ni siquiera reparándolo se pudo parsear: hay que mostrar el texto crudo. */
  unparsed: boolean;
}

const EMPTY_DIFF: ParsedDiff = { hunks: [], repaired: false, unparsed: false };

function lineType(raw: string): DiffLineType {
  if (raw.startsWith('+')) return 'add';
  if (raw.startsWith('-')) return 'del';
  // `\ No newline at end of file` — git lo emite como una línea más del hunk.
  if (raw.startsWith('\\')) return 'meta';
  return 'context';
}

/**
 * Descarta el último hunk del patch, para reintentar cuando el final está
 * cortado. Todo lo anterior al corte está completo —la truncación del backend
 * corta en un fin de línea— así que el único hunk que puede estar a medias es
 * el último.
 */
function dropLastHunk(patch: string): string | null {
  const lines = patch.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('@@')) {
      // Sin ningún hunk antes, no queda nada que parsear.
      return i === 0 ? null : lines.slice(0, i).join('\n') + '\n';
    }
  }
  return null;
}

/**
 * Parsea un diff unificado de git a hunks con números de línea.
 *
 * Tolera el truncado a propósito: el backend corta los diffs grandes en un fin
 * de línea y avisa con `truncated: true`, pero `parsePatch` no acepta un hunk
 * que declare más líneas de las que trae. En vez de perder el diff entero, se
 * van descartando hunks del final hasta que parsea, y se marca `repaired` para
 * que la UI pueda decir que lo que se ve no es todo.
 */
export function parseUnifiedDiff(patch: string | null): ParsedDiff {
  if (!patch || patch.trim() === '') return EMPTY_DIFF;

  let candidate: string | null = patch;
  let repaired = false;

  while (candidate !== null) {
    try {
      const files = parsePatch(candidate);
      const hunks: DiffHunk[] = [];
      for (const file of files) {
        for (const hunk of file.hunks) {
          let oldNumber = hunk.oldStart;
          let newNumber = hunk.newStart;
          const lines: DiffLine[] = hunk.lines.map((raw) => {
            const type = lineType(raw);
            const content = type === 'meta' ? raw.slice(2) : raw.slice(1);
            if (type === 'add') return { type, content, oldNumber: null, newNumber: newNumber++ };
            if (type === 'del') return { type, content, oldNumber: oldNumber++, newNumber: null };
            // Una línea `\ No newline…` no ocupa lugar en ninguna de las dos versiones.
            if (type === 'meta') return { type, content, oldNumber: null, newNumber: null };
            return { type, content, oldNumber: oldNumber++, newNumber: newNumber++ };
          });
          hunks.push({
            header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
            lines,
          });
        }
      }
      return { hunks, repaired, unparsed: false };
    } catch {
      candidate = dropLastHunk(candidate);
      repaired = true;
    }
  }

  return { hunks: [], repaired: false, unparsed: true };
}

/** Cuántas líneas agregadas y borradas tiene lo que se está mostrando. */
export function countDiffLines(parsed: ParsedDiff): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') added += 1;
      else if (line.type === 'del') deleted += 1;
    }
  }
  return { added, deleted };
}
