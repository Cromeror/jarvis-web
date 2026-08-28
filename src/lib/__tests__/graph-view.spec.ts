import { describe, it, expect } from 'vitest';
import { buildCommitGraph, laneColor, toGraphState, appendPage, NO_HISTORY_REASON } from '../graph-view.js';
import type { Commit, CommitLogResponse } from '../workspace-history-api.js';

function c(hash: string, parents: string[] = []): Commit {
  return {
    hash, parents, refs: [], author_name: 'Ana', author_email: 'a@e',
    date: '2026-01-01T00:00:00Z', subject: hash, is_merge: parents.length > 1,
  };
}

/** Historia lineal: A <- B <- C, en el orden en que la devuelve el backend. */
const LINEAL = [c('A', ['B']), c('B', ['C']), c('C', [])];

/**
 * `n` bloques encadenados, cada uno con DOS merges (`Mia`, `Mib`) que apuntan
 * al mismo padre `Xi`. Cada bloque es una oportunidad de dejar un carril muerto:
 * cuando llega `Xi` hay dos carriles esperandolo y hay que cerrar los dos.
 */
function convergencias(n: number): Commit[] {
  const commits: Commit[] = [];
  for (let i = 1; i <= n; i++) {
    commits.push(
      c(`M${i}a`, [`A${i}`, `X${i}`]),
      c(`A${i}`, [`M${i}b`]),
      c(`M${i}b`, [`B${i}`, `X${i}`]),
      c(`B${i}`, [`X${i}`]),
      // El bloque siguiente cuelga de Xi; el ultimo cierra la historia.
      c(`X${i}`, i < n ? [`M${i + 1}a`] : []),
    );
  }
  return commits;
}

describe('buildCommitGraph', () => {
  it('una historia lineal usa un solo carril', () => {
    const graph = buildCommitGraph(LINEAL);
    expect(graph.laneCount).toBe(1);
    expect(graph.rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    // El primer padre hereda el carril del hijo: por eso la rama es una recta.
    expect(graph.rows[0].outgoing).toEqual([{ lane: 0, parentHash: 'B', inPage: true }]);
  });

  it('la raiz no tiene salida y cierra su carril', () => {
    const graph = buildCommitGraph(LINEAL);
    const raiz = graph.rows[2];
    expect(raiz.outgoing).toEqual([]);
    expect(raiz.passingBottom).toEqual([]);
  });

  // M tiene dos padres: uno sigue en el carril de M, el otro abre uno al lado.
  it('un merge abre un segundo carril para su otro padre', () => {
    const graph = buildCommitGraph([
      c('M', ['P1', 'P2']),
      c('P2', ['P1']),
      c('P1', []),
    ]);
    const merge = graph.rows[0];
    expect(merge.isMerge).toBe(true);
    expect(merge.outgoing).toEqual([
      { lane: 0, parentHash: 'P1', inPage: true },
      { lane: 1, parentHash: 'P2', inPage: true },
    ]);
    // P2 se dibuja en el carril que le abrio el merge.
    expect(graph.rows[1].lane).toBe(1);
    expect(graph.laneCount).toBe(2);
  });

  // ESTE es el hallazgo del spike. Dos merges que apuntan al mismo padre dejan
  // dos carriles esperandolo; al llegar el padre hay que liberar LOS DOS.
  it('libera TODOS los carriles que convergen en un commit, no solo el primero', () => {
    // M1 abre el carril 1 esperando a X. M2 abre el carril 2 esperando a X.
    // Cuando llega X, si solo se libera uno, el otro queda ocupado para siempre.
    const graph = buildCommitGraph([
      c('M1', ['A', 'X']),
      c('A', ['M2']),
      c('M2', ['B', 'X']),
      c('B', ['X']),
      c('X', []),
    ]);
    const filaX = graph.rows[4];
    // Los dos carriles que lo esperaban entran al nodo.
    expect(filaX.incoming.length).toBeGreaterThan(1);
    // Y despues de X no queda NINGUN carril vivo: la historia se cerro.
    expect(filaX.passingBottom).toEqual([]);
    expect(filaX.outgoing).toEqual([]);
  });

  // El sintoma del bug es el ANCHO, y para verlo hace falta encadenar varias
  // convergencias: con una sola, el carril muerto que deja la version ingenua
  // todavia entra en el ancho que el grafo iba a ocupar igual (2 en los dos
  // casos), asi que un tope fijo la deja pasar. Encadenadas, cada bloque deja
  // el suyo y el ancho crece con la historia: 2, 3, 4, 5 contra 2 constante.
  it('el ancho no crece con la cantidad de convergencias', () => {
    const anchos = [1, 2, 3, 4].map((n) => buildCommitGraph(convergencias(n)).laneCount);
    expect(anchos).toEqual([2, 2, 2, 2]);
  });

  it('ninguna convergencia encadenada deja un carril vivo al terminar', () => {
    const graph = buildCommitGraph(convergencias(4));
    const ultima = graph.rows[graph.rows.length - 1];
    expect(ultima.passingBottom).toEqual([]);
    expect(ultima.outgoing).toEqual([]);
  });

  // Un padre fuera de la pagina no es un extremo suelto: la linea sigue.
  it('marca el padre que no esta en la pagina y deja su carril vivo', () => {
    const graph = buildCommitGraph([c('A', ['FUERA'])]);
    expect(graph.rows[0].outgoing).toEqual([{ lane: 0, parentHash: 'FUERA', inPage: false }]);
    // El carril sigue ocupado: se dibuja saliendo por abajo de la pagina.
    expect(graph.rows[0].passingBottom).toEqual([]);
    expect(graph.rows[0].outgoing[0].lane).toBe(0);
  });

  // Los carriles que no participan de una fila la cruzan derecho: sin esto la
  // rama de al lado se dibujaria cortada en cada commit del tronco.
  it('los carriles ajenos cruzan la fila de arriba abajo', () => {
    const graph = buildCommitGraph([
      c('M', ['T1', 'R1']),
      c('T1', ['T2']),
      c('R1', ['T2']),
      c('T2', []),
    ]);
    const filaT1 = graph.rows[1];
    // El carril de la rama (1, esperando a R1) no entra ni sale del nodo de T1.
    expect(filaT1.lane).toBe(0);
    expect(filaT1.passingTop).toContain(1);
    expect(filaT1.passingBottom).toContain(1);
  });

  it('una pagina vacia da un grafo vacio, no un error', () => {
    const graph = buildCommitGraph([]);
    expect(graph.rows).toEqual([]);
    expect(graph.laneCount).toBe(1);
  });

  it('el ancho declarado alcanza para todo lo que se dibuja', () => {
    const graph = buildCommitGraph([
      c('M', ['A', 'B']),
      c('A', ['C']),
      c('B', ['C']),
      c('C', ['D']),
      c('D', []),
    ]);
    for (const row of graph.rows) {
      expect(row.lane).toBeLessThan(graph.laneCount);
      for (const e of row.outgoing) expect(e.lane).toBeLessThan(graph.laneCount);
      for (const l of row.passingTop) expect(l).toBeLessThan(graph.laneCount);
      for (const l of row.passingBottom) expect(l).toBeLessThan(graph.laneCount);
    }
  });
});

describe('laneColor', () => {
  it('da un color estable por carril y cicla sin romperse', () => {
    expect(laneColor(0)).toBe(laneColor(0));
    expect(laneColor(0)).not.toBe(laneColor(1));
    expect(laneColor(8)).toBe(laneColor(0));
    expect(laneColor(99)).toMatch(/^#[0-9a-f]{6}$/);
  });
});


function logResponse(over: Partial<CommitLogResponse> = {}): CommitLogResponse {
  return { root_path: '/srv/p', commits: [], next_cursor: null, tip: null, error: null, ...over };
}

describe('toGraphState', () => {
  // ACEPTACION: repo sin git muestra estado vacio. No hay un estado "grafo
  // roto": si no hay historia que dibujar, es vacio con su motivo.
  it('un root que no es repo git da estado vacio con la razon', () => {
    const state = toGraphState(logResponse({ error: '/srv/p no es un repositorio git' }));
    expect(state.kind).toBe('empty');
    if (state.kind !== 'empty') throw new Error('inalcanzable');
    expect(state.reason).toContain('no es un repositorio git');
  });

  it('un repo sin commits tambien es vacio, con su propio texto', () => {
    const state = toGraphState(logResponse({ commits: [] }));
    expect(state.kind).toBe('empty');
    if (state.kind !== 'empty') throw new Error('inalcanzable');
    expect(state.reason).toBe(NO_HISTORY_REASON);
  });

  it('ninguno de los dos es `failed`: reintentar no arreglaria nada', () => {
    expect(toGraphState(logResponse({ error: 'no es un repositorio git' })).kind).not.toBe('failed');
    expect(toGraphState(logResponse({ commits: [] })).kind).not.toBe('failed');
  });

  // Los dos estados vacios son distinguibles por su motivo: el del backend
  // ("no es un repositorio git") y el de la vista ("todavia no tiene commits").
  // Ninguno se muestra como un grafo vacio sin explicacion.
  it('sin commits y sin repo son vacios con motivos distintos', () => {
    const sinRepo = toGraphState(logResponse({ error: '/srv/p no es un repositorio git' }));
    const sinCommits = toGraphState(logResponse({ commits: [] }));
    expect(sinRepo.kind).toBe('empty');
    expect(sinCommits.kind).toBe('empty');
    if (sinRepo.kind !== 'empty' || sinCommits.kind !== 'empty') throw new Error('inalcanzable');
    expect(sinRepo.reason).not.toBe(sinCommits.reason);
    expect(sinCommits.reason).toBe(NO_HISTORY_REASON);
  });

  it('con commits queda listo y conserva el cursor', () => {
    const state = toGraphState(logResponse({ commits: [c('A')], next_cursor: 'abc:50' }));
    expect(state).toEqual({ kind: 'ready', commits: [c('A')], nextCursor: 'abc:50' });
  });

  // El error gana sobre la lista: si git fallo, una lista vacia no significa
  // "repo limpio", significa que no se pudo leer.
  it('el error manda aunque vengan commits', () => {
    const state = toGraphState(logResponse({ commits: [c('A')], error: 'git no contesto' }));
    expect(state.kind).toBe('empty');
  });
});

describe('appendPage', () => {
  // Los carriles se calculan sobre el acumulado: si cada pagina se dibujara
  // por su cuenta, una rama abierta antes del corte empezaria de nuevo en otro
  // carril y el grafo se veria partido justo en el limite.
  it('apila la pagina nueva sobre lo ya cargado y actualiza el cursor', () => {
    const inicial = toGraphState(logResponse({ commits: [c('A', ['B'])], next_cursor: 'x:1' }));
    const siguiente = appendPage(inicial, logResponse({ commits: [c('B')], next_cursor: null }));
    expect(siguiente.kind).toBe('ready');
    if (siguiente.kind !== 'ready') throw new Error('inalcanzable');
    expect(siguiente.commits.map((x) => x.hash)).toEqual(['A', 'B']);
    expect(siguiente.nextCursor).toBeNull();

    // Y el grafo del acumulado conecta las dos paginas: el padre de A, que
    // estaba fuera de la primera, ahora es un nodo de verdad.
    const graph = buildCommitGraph(siguiente.commits);
    expect(graph.rows[0].outgoing[0].inPage).toBe(true);
  });

  // Una pagina rota NO puede verse igual que el final de la historia: el
  // `emptyLog` del backend trae `commits: []` y `next_cursor: null`, asi que
  // apilarla borraria el cursor y el boton de cargar mas desapareceria — git
  // fallo, pero en pantalla se leeria "no hay mas commits".
  it('una pagina con error no se apila y conserva el cursor para reintentar', () => {
    const inicial = toGraphState(logResponse({ commits: [c('A', ['B'])], next_cursor: 'x:1' }));
    const despues = appendPage(inicial, logResponse({ commits: [], next_cursor: null, error: 'git no contesto' }));
    expect(despues).toBe(inicial);
    if (despues.kind !== 'ready') throw new Error('inalcanzable');
    expect(despues.nextCursor).toBe('x:1');
    expect(despues.commits.map((x) => x.hash)).toEqual(['A']);
  });

  // El final de verdad si apaga el cursor, y por eso el boton desaparece.
  it('la ultima pagina cierra la paginacion', () => {
    const inicial = toGraphState(logResponse({ commits: [c('A', ['B'])], next_cursor: 'x:1' }));
    const despues = appendPage(inicial, logResponse({ commits: [c('B')], next_cursor: null }));
    if (despues.kind !== 'ready') throw new Error('inalcanzable');
    expect(despues.nextCursor).toBeNull();
  });

  it('no apila sobre un estado que no esta listo', () => {
    const vacio = toGraphState(logResponse({ commits: [] }));
    expect(appendPage(vacio, logResponse({ commits: [c('A')] }))).toBe(vacio);
  });
});
