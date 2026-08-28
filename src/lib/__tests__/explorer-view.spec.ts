import { describe, it, expect } from 'vitest';
import { toTreeNodes, ancestorDirs, toPreviewState, humanSize, parseExplorerPath, toExplorerPath } from '../explorer-view.js';
import type { WorkspaceDirEntry, WorkspaceFileResponse } from '../workspace-files-api.js';

function entry(name: string, type: WorkspaceDirEntry['type'] = 'file'): WorkspaceDirEntry {
  return { name, type };
}

function file(over: Partial<WorkspaceFileResponse> = {}): WorkspaceFileResponse {
  return {
    root_path: '/srv/p', path: 'src/a.ts', content: 'const a = 1;\n',
    binary: false, too_large: false, size: 13, error: null, ...over,
  };
}

describe('toTreeNodes', () => {
  it('arma el path completo de cada entrada', () => {
    const nodes = toTreeNodes('packages/core', [entry('src', 'dir'), entry('index.ts')]);
    expect(nodes.map((n) => n.path)).toEqual(['packages/core/src', 'packages/core/index.ts']);
  });

  it('en la raiz no antepone barra', () => {
    const nodes = toTreeNodes('', [entry('README.md')]);
    expect(nodes[0].path).toBe('README.md');
  });

  // Convencion de explorador: un directorio con muchos archivos no puede
  // esconder sus subcarpetas al final de la lista.
  it('pone las carpetas primero y ordena cada grupo alfabeticamente', () => {
    const nodes = toTreeNodes('', [
      entry('zeta.ts'), entry('src', 'dir'), entry('alfa.ts'), entry('assets', 'dir'),
    ]);
    expect(nodes.map((n) => n.name)).toEqual(['assets', 'src', 'alfa.ts', 'zeta.ts']);
  });

  it('marca expandible lo que se puede abrir', () => {
    const nodes = toTreeNodes('', [entry('d', 'dir'), entry('f'), entry('l', 'symlink'), entry('x', 'other')]);
    expect(nodes.map((n) => [n.name, n.expandable])).toEqual([
      ['d', true], ['f', false], ['l', true], ['x', false],
    ]);
  });

  it('un nivel vacio da una lista vacia', () => {
    expect(toTreeNodes('src', [])).toEqual([]);
  });
});

describe('ancestorDirs', () => {
  // Es lo que hace que la URL sea recargable: sin abrir (y pedir) cada
  // ancestro, el archivo del link queda seleccionado pero fuera de pantalla.
  it('da las carpetas a abrir para llegar a un archivo', () => {
    expect(ancestorDirs('packages/core/src/index.ts')).toEqual([
      'packages', 'packages/core', 'packages/core/src',
    ]);
  });

  it('un archivo en la raiz no necesita abrir nada', () => {
    expect(ancestorDirs('README.md')).toEqual([]);
  });

  it('tolera barras de mas y strings vacios', () => {
    expect(ancestorDirs('')).toEqual([]);
    expect(ancestorDirs('a//b/c.ts')).toEqual(['a', 'a/b']);
  });
});

describe('parseExplorerPath', () => {
  // La barra final distingue carpeta de archivo sin tener que preguntarle al
  // backend qué es cada path del link.
  it('un path sin barra final es un archivo: abre sus ancestros y lo previsualiza', () => {
    expect(parseExplorerPath('packages/core/src/index.ts')).toEqual({
      dirsToExpand: ['packages', 'packages/core', 'packages/core/src'],
      selectedFile: 'packages/core/src/index.ts',
      selectedDir: undefined,
    });
  });

  it('un path con barra final es una carpeta: se abre a si misma tambien', () => {
    expect(parseExplorerPath('packages/core/')).toEqual({
      dirsToExpand: ['packages', 'packages/core'],
      selectedFile: undefined,
      selectedDir: 'packages/core',
    });
  });

  it('una carpeta de primer nivel se abre sin ancestros', () => {
    expect(parseExplorerPath('docs/')).toEqual({
      dirsToExpand: ['docs'],
      selectedFile: undefined,
      selectedDir: 'docs',
    });
  });

  it('sin ruta, o con basura vacia, no abre ni selecciona nada', () => {
    for (const raw of [undefined, '', '/']) {
      expect(parseExplorerPath(raw)).toEqual({ dirsToExpand: [], selectedFile: undefined, selectedDir: undefined });
    }
  });

  it('ida y vuelta: lo que se escribe en la URL es lo que se lee', () => {
    expect(parseExplorerPath(toExplorerPath('a/b', true)).selectedDir).toBe('a/b');
    expect(parseExplorerPath(toExplorerPath('a/b.ts', false)).selectedFile).toBe('a/b.ts');
  });
});

describe('toPreviewState', () => {
  it('un archivo de texto se muestra tal cual', () => {
    const state = toPreviewState(file());
    expect(state.kind).toBe('text');
    expect(state.content).toBe('const a = 1;\n');
    expect(state.message).toBeNull();
  });

  it('un .md se marca como markdown para renderizarlo', () => {
    expect(toPreviewState(file({ path: 'docs/guia.md' })).kind).toBe('markdown');
    expect(toPreviewState(file({ path: 'README.MARKDOWN' })).kind).toBe('markdown');
    // Un archivo que solo TIENE 'md' en el nombre no cuenta.
    expect(toPreviewState(file({ path: 'src/md-parser.ts' })).kind).toBe('text');
  });

  // ACEPTACION: aviso en vez de basura. Pintar bytes crudos como si fueran
  // texto es exactamente lo que hay que evitar.
  it('un binario da aviso y NUNCA contenido', () => {
    const state = toPreviewState(file({ binary: true, content: null, size: 2048 }));
    expect(state.kind).toBe('binary');
    expect(state.content).toBeNull();
    expect(state.message).toContain('binario');
    expect(state.message).toContain('2.0 kB');
  });

  // Defensa en profundidad: si el backend alguna vez mandara bytes en un
  // binario, el visor no los pinta igual.
  it('un binario con contenido tampoco lo muestra', () => {
    const state = toPreviewState(file({ binary: true, content: 'bytes crudos' }));
    expect(state.kind).toBe('binary');
    expect(state.content).toBeNull();
  });

  it('un archivo demasiado grande da aviso con su tamano real', () => {
    const state = toPreviewState(file({ too_large: true, content: null, size: 3 * 1024 * 1024 }));
    expect(state.kind).toBe('too_large');
    expect(state.content).toBeNull();
    expect(state.message).toContain('3.0 MB');
  });

  it('un error del backend se muestra como error, no como archivo vacio', () => {
    const state = toPreviewState(file({ error: "'.env' esta ignorado por .gitignore", content: null }));
    expect(state.kind).toBe('error');
    expect(state.message).toContain('.gitignore');
  });

  // El error gana sobre todo lo demas: si no se pudo leer, el resto de las
  // marcas no son confiables.
  it('el error tiene prioridad sobre binario y grande', () => {
    expect(toPreviewState(file({ error: 'no existe', binary: true, too_large: true })).kind).toBe('error');
  });

  it('un archivo vacio se dice, no se muestra en blanco', () => {
    expect(toPreviewState(file({ content: '' })).kind).toBe('empty');
    expect(toPreviewState(file({ content: null })).kind).toBe('empty');
  });
});

describe('humanSize', () => {
  it('escala a la unidad que se lee', () => {
    expect(humanSize(0)).toBe('0 B');
    expect(humanSize(512)).toBe('512 B');
    expect(humanSize(2048)).toBe('2.0 kB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(humanSize(null)).toBe('');
  });
});
