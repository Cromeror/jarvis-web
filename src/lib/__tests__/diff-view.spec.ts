import { describe, it, expect } from 'vitest';
import {
  parseUnifiedDiff,
  countDiffLines,
  toChangedFileRow,
  toChangedFileRows,
} from '../diff-view.js';
import type { ChangedFile } from '../workspace-changes-api.js';

/**
 * Los patches de acá son salida REAL de git (generada con un repo temporal y
 * pegada tal cual), no escritos a mano: `parsePatch` es estricto y un patch
 * inventado no prueba nada sobre lo que la app va a recibir.
 */
const PATCH_DOS_HUNKS = `diff --git a/multi.txt b/multi.txt
index 1d4c1c0..8a6e2f1 100644
--- a/multi.txt
+++ b/multi.txt
@@ -1,5 +1,5 @@
 l1
-l2
+L2 MODIFICADA
 l3
 l4
 l5
@@ -11,5 +11,5 @@
 l11
 l12
 l13
-l14
+L14 MODIFICADA
 l15
`;

const PATCH_SIN_SALTO_FINAL = `diff --git a/nonl.txt b/nonl.txt
index c30572d..d83c8e8 100644
--- a/nonl.txt
+++ b/nonl.txt
@@ -1 +1 @@
-sin salto final
\\ No newline at end of file
+sin salto final MODIFICADO
\\ No newline at end of file
`;

const PATCH_ARCHIVO_NUEVO = `diff --git a/nuevo.txt b/nuevo.txt
new file mode 100644
index 0000000..a5bce3f
--- /dev/null
+++ b/nuevo.txt
@@ -0,0 +1,2 @@
+nuevo
+contenido
`;

const PATCH_BORRADO = `diff --git a/borrar.txt b/borrar.txt
deleted file mode 100644
index 7898192..0000000
--- a/borrar.txt
+++ /dev/null
@@ -1 +0,0 @@
-a
`;

describe('parseUnifiedDiff', () => {
  it('parsea varios hunks y numera las líneas de cada lado', () => {
    const parsed = parseUnifiedDiff(PATCH_DOS_HUNKS);
    expect(parsed.unparsed).toBe(false);
    expect(parsed.repaired).toBe(false);
    expect(parsed.hunks).toHaveLength(2);

    const [primero] = parsed.hunks;
    expect(primero.header).toBe('@@ -1,5 +1,5 @@');
    // Una línea de contexto avanza los dos contadores; una borrada solo el
    // viejo; una agregada solo el nuevo.
    expect(primero.lines.map((l) => [l.type, l.oldNumber, l.newNumber])).toEqual([
      ['context', 1, 1],
      ['del', 2, null],
      ['add', null, 2],
      ['context', 3, 3],
      ['context', 4, 4],
      ['context', 5, 5],
    ]);

    // El segundo hunk arranca en la línea que dice su cabecera, no en 1.
    expect(parsed.hunks[1].lines[0].oldNumber).toBe(11);
  });

  it('saca el prefijo +/-/espacio del contenido', () => {
    const parsed = parseUnifiedDiff(PATCH_DOS_HUNKS);
    const linea = parsed.hunks[0].lines.find((l) => l.type === 'add')!;
    expect(linea.content).toBe('L2 MODIFICADA');
    expect(parsed.hunks[0].lines[0].content).toBe('l1');
  });

  // git emite esta línea dentro del hunk y no corresponde a ninguna línea del
  // archivo: numerarla correría todo lo que viene después.
  it('trata "\\ No newline at end of file" como meta, sin numerarla', () => {
    const parsed = parseUnifiedDiff(PATCH_SIN_SALTO_FINAL);
    const tipos = parsed.hunks[0].lines.map((l) => l.type);
    expect(tipos).toEqual(['del', 'meta', 'add', 'meta']);
    const meta = parsed.hunks[0].lines[1];
    expect(meta.oldNumber).toBeNull();
    expect(meta.newNumber).toBeNull();
    expect(meta.content).toBe('No newline at end of file');
  });

  it('parsea un archivo nuevo entero como agregado', () => {
    const parsed = parseUnifiedDiff(PATCH_ARCHIVO_NUEVO);
    expect(parsed.hunks[0].lines.every((l) => l.type === 'add')).toBe(true);
    expect(countDiffLines(parsed)).toEqual({ added: 2, deleted: 0 });
  });

  it('parsea un archivo borrado entero como borrado', () => {
    const parsed = parseUnifiedDiff(PATCH_BORRADO);
    expect(parsed.hunks[0].lines.every((l) => l.type === 'del')).toBe(true);
    expect(countDiffLines(parsed)).toEqual({ added: 0, deleted: 1 });
  });

  // ACEPTACIÓN: el backend corta los diffs grandes en un fin de línea y avisa
  // con `truncated`. `parsePatch` es ESTRICTO — explota si un hunk trae menos
  // líneas de las que declara — así que sin esto un diff truncado se perdía
  // entero en vez de mostrarse parcial.
  it('un diff cortado a la mitad del último hunk se muestra igual, marcado como reparado', () => {
    // Se corta en medio del segundo hunk, como haría el tope de bytes.
    const cortado = PATCH_DOS_HUNKS.split('\n').slice(0, 13).join('\n') + '\n';
    const parsed = parseUnifiedDiff(cortado);
    expect(parsed.unparsed).toBe(false);
    expect(parsed.repaired).toBe(true);
    // Lo que sí estaba completo se conserva.
    expect(parsed.hunks).toHaveLength(1);
    expect(parsed.hunks[0].lines[1].content).toBe('l2');
  });

  // Cortado tan temprano que ni el primer hunk está completo: queda el
  // encabezado del archivo y ningún hunk. No es "no se pudo parsear" (el
  // encabezado se entendió perfecto), es "no quedó nada que mostrar" — y
  // `repaired` es lo que se lo dice a la UI.
  it('un diff cortado antes de terminar el PRIMER hunk queda sin hunks pero reparado', () => {
    const cortado = PATCH_DOS_HUNKS.split('\n').slice(0, 7).join('\n') + '\n';
    const parsed = parseUnifiedDiff(cortado);
    expect(parsed.hunks).toEqual([]);
    expect(parsed.repaired).toBe(true);
    expect(parsed.unparsed).toBe(false);
  });

  it('basura que no es un diff se marca sin parsear en vez de lanzar', () => {
    expect(() => parseUnifiedDiff('esto no es un diff\nen absoluto\n')).not.toThrow();
    // Sin ningún `@@`, no hay nada que parsear ni que reparar.
    const parsed = parseUnifiedDiff('@@ roto\nbasura\n');
    expect(parsed.unparsed).toBe(true);
  });

  it('null y vacío dan un diff vacío, no un error', () => {
    for (const entrada of [null, '', '   \n']) {
      const parsed = parseUnifiedDiff(entrada);
      expect(parsed.hunks).toEqual([]);
      expect(parsed.unparsed).toBe(false);
    }
  });

  it('cuenta agregadas y borradas de lo que efectivamente se muestra', () => {
    expect(countDiffLines(parseUnifiedDiff(PATCH_DOS_HUNKS))).toEqual({ added: 2, deleted: 2 });
  });
});

// ---------------------------------------------------------------------------

function file(over: Partial<ChangedFile> = {}): ChangedFile {
  return { path: 'src/a.ts', orig_path: null, staged: null, unstaged: 'modified', ...over };
}

describe('toChangedFileRow', () => {
  it('parte el path en directorio y nombre', () => {
    const row = toChangedFileRow(file({ path: 'packages/core/src/index.ts' }));
    expect(row.name).toBe('index.ts');
    expect(row.dir).toBe('packages/core/src');
  });

  it('un archivo en la raíz no inventa directorio', () => {
    const row = toChangedFileRow(file({ path: 'README.md' }));
    expect(row.name).toBe('README.md');
    expect(row.dir).toBe('');
  });

  it('usa la letra y el tono del estado, al estilo de VSCode', () => {
    expect(toChangedFileRow(file({ unstaged: 'modified' })).letter).toBe('M');
    expect(toChangedFileRow(file({ unstaged: 'untracked' })).letter).toBe('U');
    expect(toChangedFileRow(file({ unstaged: null, staged: 'added' })).letter).toBe('A');
    expect(toChangedFileRow(file({ unstaged: 'deleted' })).tone).toBe('danger');
    expect(toChangedFileRow(file({ unstaged: null, staged: 'renamed' })).label).toBe('Renombrado');
  });

  // Un archivo que SOLO tiene cambios stageados no aparece en `git diff`: el
  // working tree está igual al índice. Abrirlo con el diff del working tree
  // mostraría "sin cambios" para algo que la lista acaba de anunciar.
  it('elige el lado que efectivamente tiene el diff', () => {
    expect(toChangedFileRow(file({ unstaged: 'modified', staged: null })).defaultSide).toBe('worktree');
    expect(toChangedFileRow(file({ unstaged: null, staged: 'modified' })).defaultSide).toBe('staged');
    // Con las dos, se arranca por lo que todavía no guardó.
    expect(toChangedFileRow(file({ unstaged: 'modified', staged: 'modified' })).defaultSide).toBe('worktree');
  });

  it('avisa cuándo vale ofrecer el toggle entre staged y sin stagear', () => {
    expect(toChangedFileRow(file({ unstaged: 'modified', staged: 'modified' })).hasBothSides).toBe(true);
    expect(toChangedFileRow(file({ unstaged: 'modified', staged: null })).hasBothSides).toBe(false);
    expect(toChangedFileRow(file({ unstaged: null, staged: 'modified' })).hasBothSides).toBe(false);
  });

  it('conserva el origen de un rename', () => {
    const row = toChangedFileRow(file({ path: 'nuevo.ts', orig_path: 'viejo.ts', unstaged: null, staged: 'renamed' }));
    expect(row.origPath).toBe('viejo.ts');
  });
});

describe('toChangedFileRows', () => {
  // ACEPTACIÓN: una entrada que al abrirla no tiene nada que mostrar es peor
  // que no estar.
  it('un archivo sin cambios en ninguna columna no aparece', () => {
    const rows = toChangedFileRows([
      file({ path: 'cambiado.ts' }),
      file({ path: 'quieto.ts', staged: null, unstaged: null }),
    ]);
    expect(rows.map((r) => r.path)).toEqual(['cambiado.ts']);
  });

  it('una lista vacía da una lista vacía, sin inventar filas', () => {
    expect(toChangedFileRows([])).toEqual([]);
  });
});
