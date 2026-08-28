import type { Commit, CommitLogResponse } from './workspace-history-api.js';

/**
 * Carriles del grafo de commits, calculados desde `parents`.
 *
 * Es el algoritmo de la extension Git Graph de VSCode: se recorre la pagina en
 * topo-order manteniendo una lista de carriles activos, cada uno "esperando" un
 * hash. Un commit toma el carril que lo esperaba (o uno libre), su primer padre
 * hereda ese mismo carril, y cada padre extra toma otro — que es lo que abre
 * una rama a la izquierda o a la derecha.
 *
 * La decision de calcularlos aca en vez de usar una libreria esta medida y
 * escrita en el plan "Vista de grafo del apartado de workspaces — decision del
 * spike". El resumen: @gitgraph/react no tiene mantenimiento desde 2021 y seria
 * una dependencia nueva; mermaid gitGraph ya es dependencia pero su modelo es
 * un RELATO (commit/branch/checkout/merge) y no acepta declarar padres, asi que
 * no puede expresar un DAG real; reactflow da layout de arbol, no carriles.
 *
 * Corre sobre la PAGINA que se dibuja, no sobre la historia entera: medido en
 * 0,33 ms para 50 commits y 25 ms para 20.000, asi que paginar no lo estresa.
 */

export interface GraphEdge {
  /** Carril del padre — a donde baja la linea desde el nodo. */
  lane: number;
  parentHash: string;
  /** False si el padre no esta en esta pagina: la linea sigue hacia abajo sin nodo. */
  inPage: boolean;
}

export interface GraphRow {
  commit: Commit;
  /** Carril donde se dibuja el nodo. */
  lane: number;
  /** Carriles que esperaban a este commit y por lo tanto ENTRAN al nodo desde arriba. */
  incoming: number[];
  /** Carriles de los padres: SALEN del nodo hacia abajo. */
  outgoing: GraphEdge[];
  /** Carriles ocupados arriba de esta fila que NO entran al nodo: la cruzan derecho. */
  passingTop: number[];
  /** Carriles ocupados abajo de esta fila que NO salen del nodo: la cruzan derecho. */
  passingBottom: number[];
  isMerge: boolean;
}

export interface CommitGraph {
  rows: GraphRow[];
  /** Cuantos carriles hace falta dibujar — el ancho del SVG sale de aca. */
  laneCount: number;
}

function occupiedLanes(slots: Array<string | null>): number[] {
  const out: number[] = [];
  for (let i = 0; i < slots.length; i++) if (slots[i] !== null) out.push(i);
  return out;
}

/** Primer carril libre, creando uno nuevo al final si no hay. */
function claimLane(slots: Array<string | null>): number {
  const free = slots.indexOf(null);
  if (free !== -1) return free;
  slots.push(null);
  return slots.length - 1;
}

/**
 * Arma el grafo de una pagina de commits.
 *
 * Los commits tienen que venir en el orden en que se van a dibujar (el
 * `--topo-order` del backend): el algoritmo asume que un hijo siempre aparece
 * antes que sus padres.
 */
export function buildCommitGraph(commits: Commit[]): CommitGraph {
  const inPage = new Set(commits.map((c) => c.hash));
  const slots: Array<string | null> = [];
  const rows: GraphRow[] = [];

  for (const commit of commits) {
    const before = occupiedLanes(slots);

    // Todos los carriles que esperaban a este commit convergen en el.
    const incoming = slots.reduce<number[]>((acc, hash, index) => {
      if (hash === commit.hash) acc.push(index);
      return acc;
    }, []);

    const lane = incoming.length > 0 ? incoming[0] : claimLane(slots);

    // HALLAZGO DEL SPIKE: liberar SOLO el primero deja colgados los carriles
    // convergentes —dos merges que apuntan al mismo padre— y el grafo se
    // dibuja el doble de ancho, con carriles muertos que nunca se cierran.
    // Medido sobre este repo: max 6 / p50 6 liberando uno, contra max 3 /
    // p50 1 liberandolos todos.
    for (const extra of incoming.slice(1)) slots[extra] = null;

    // El primer padre hereda el carril del hijo: es lo que hace que una rama se
    // vea como una linea recta y no como una escalera.
    slots[lane] = commit.parents[0] ?? null;

    const outgoing: GraphEdge[] = [];
    if (commit.parents.length > 0) {
      outgoing.push({ lane, parentHash: commit.parents[0], inPage: inPage.has(commit.parents[0]) });
    }
    for (const parent of commit.parents.slice(1)) {
      // Si otro carril ya espera a ese padre, la rama converge ahi en vez de
      // abrir uno nuevo al costado.
      let parentLane = slots.indexOf(parent);
      if (parentLane === -1) {
        parentLane = claimLane(slots);
        slots[parentLane] = parent;
      }
      outgoing.push({ lane: parentLane, parentHash: parent, inPage: inPage.has(parent) });
    }

    const after = occupiedLanes(slots);
    const outgoingLanes = new Set(outgoing.map((e) => e.lane));
    const incomingLanes = new Set(incoming);

    rows.push({
      commit,
      lane,
      incoming,
      outgoing,
      passingTop: before.filter((l) => !incomingLanes.has(l) && l !== lane),
      passingBottom: after.filter((l) => !outgoingLanes.has(l) && l !== lane),
      isMerge: commit.parents.length > 1,
    });
  }

  const laneCount = rows.reduce(
    (max, row) => Math.max(max, row.lane + 1, ...row.outgoing.map((e) => e.lane + 1), ...row.passingBottom.map((l) => l + 1)),
    1,
  );
  return { rows, laneCount };
}

/** Color estable por carril, para que una rama mantenga el suyo al scrollear. */
const LANE_COLORS = ['#6366f1', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d'];

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}


/**
 * En que estado esta la vista de grafo, derivado de la respuesta del backend.
 *
 * La distincion que importa: NO hay un estado "grafo roto". Un workspace cuyo
 * root no es un repositorio git, y uno que es repo pero todavia no tiene
 * commits, son los dos un ESTADO VACIO con su motivo — no hay grafo que
 * dibujar, y eso no es una falla. Solo un pedido que no llego (red, 500) es
 * `failed`, porque es lo unico donde reintentar tiene sentido.
 */
export type GraphState =
  | { kind: 'loading' }
  | { kind: 'empty'; reason: string }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; commits: Commit[]; nextCursor: string | null };

/** Lo que se muestra cuando el repo existe pero no tiene ni un commit. */
export const NO_HISTORY_REASON =
  'Este workspace es un repositorio git sin commits todavia. En cuanto haya uno, el grafo aparece aca.';

/** La respuesta del log al estado de la vista. */
export function toGraphState(response: CommitLogResponse): GraphState {
  // El backend manda el motivo cuando no pudo leer la historia: que el root no
  // sea un repo git es el caso tipico, y se muestra igual que "sin commits" —
  // con su texto, no como error.
  if (response.error) return { kind: 'empty', reason: response.error };
  if (response.commits.length === 0) return { kind: 'empty', reason: NO_HISTORY_REASON };
  return { kind: 'ready', commits: response.commits, nextCursor: response.next_cursor };
}

/**
 * Apila la pagina siguiente sobre lo ya cargado.
 *
 * Los carriles se calculan sobre el ACUMULADO y no por pagina suelta: si cada
 * pagina se dibujara por su cuenta, una rama abierta antes del corte empezaria
 * de nuevo en otro carril y el grafo se veria partido en el limite.
 */
export function appendPage(current: GraphState, response: CommitLogResponse): GraphState {
  if (current.kind !== 'ready') return current;
  return {
    kind: 'ready',
    commits: [...current.commits, ...response.commits],
    nextCursor: response.next_cursor,
  };
}
