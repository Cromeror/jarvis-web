/**
 * Converter: drawio XML → TOON (semantic representation for the LLM).
 *
 * Lossy by design: only structural/semantic info is preserved.
 * Discarded: colors, positions, sizes, fonts, alignment, shadows, dashed, etc.
 *
 * Schema:
 *   diagram: flow
 *   direction: LR | TD | RL | BT
 *   groups[N]{id,label}:
 *     <id>,<label>
 *   nodes[N]{id,label,shape,group}:
 *     <id>,<label>,<shape>,<group_or_empty>
 *   edges[N]{from,to,label}:
 *     <from>,<to>,<label_or_empty>
 *
 * Shapes detected from drawio style strings:
 *   rounded=1            → rounded
 *   ellipse              → circle
 *   rhombus              → diamond
 *   cylinder/shape=cyl…  → cylinder
 *   default              → box
 */

export type Shape = 'box' | 'rounded' | 'circle' | 'diamond' | 'cylinder';
export type Direction = 'LR' | 'TD' | 'RL' | 'BT';

/** Supported diagram notations. `null`/missing = generic. */
export type Notation = 'ansi-iso-5807' | null;

/** Shapes for ANSI/ISO 5807 flowcharts. */
export type AnsiShape = 'terminator' | 'process' | 'decision' | 'offpage' | 'connector' | 'data' | 'document' | 'predefined';

export interface ToonNode {
  id: string;
  label: string;
  shape: Shape;
  group?: string;
}

export interface ToonGroup {
  id: string;
  label: string;
}

export interface ToonEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ToonDiagram {
  direction: Direction;
  groups: ToonGroup[];
  nodes: ToonNode[];
  edges: ToonEdge[];
}

interface MxCell {
  id: string;
  parent: string | null;
  value: string;
  style: string;
  vertex: boolean;
  edge: boolean;
  width?: number;
  source: string | null;
  target: string | null;
}

function mapMxCell(c: Element): MxCell {
  const geom = c.querySelector('mxGeometry');
  const wAttr = geom?.getAttribute('width');
  const width = wAttr ? Number(wAttr) : undefined;
  return {
    id: c.getAttribute('id') ?? '',
    parent: c.getAttribute('parent'),
    value: decodeHtmlEntities(c.getAttribute('value') ?? ''),
    style: c.getAttribute('style') ?? '',
    vertex: c.getAttribute('vertex') === '1',
    edge: c.getAttribute('edge') === '1',
    width: Number.isFinite(width) ? width : undefined,
    source: c.getAttribute('source'),
    target: c.getAttribute('target'),
  };
}

/**
 * Parse drawio XML into a flat list of MxCell entries.
 * Uses DOMParser (browser only). Throws on invalid XML.
 *
 * NOTE: collapses cells from ALL pages into one list. For per-page processing,
 * use `parseDrawioPages` instead.
 */
export function parseDrawioXml(xml: string): MxCell[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML inválido: ' + parseError.textContent);
  }
  return Array.from(doc.querySelectorAll('mxCell')).map(mapMxCell);
}

export interface DrawioPage {
  name: string;
  cells: MxCell[];
}

/**
 * Parse drawio XML page-by-page. Each `<diagram>` element becomes one DrawioPage
 * with the cells scoped to its own `<root>`. Falls back to a single page when
 * the XML has no `<diagram>` wrapper.
 */
export function parseDrawioPages(xml: string): DrawioPage[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML inválido: ' + parseError.textContent);
  }
  const diagrams = Array.from(doc.querySelectorAll('diagram'));
  if (diagrams.length === 0) {
    // Fallback: treat the whole document as one unnamed page.
    const cells = Array.from(doc.querySelectorAll('mxCell')).map(mapMxCell);
    return [{ name: '', cells }];
  }
  return diagrams.map((d, idx): DrawioPage => ({
    name: d.getAttribute('name') ?? `page-${idx + 1}`,
    cells: Array.from(d.querySelectorAll('mxCell')).map(mapMxCell),
  }));
}

/**
 * Detect direction from a top-level style hint (drawio doesn't store this
 * explicitly; we infer from layout or default to LR).
 */
function inferDirection(): Direction {
  return 'LR';
}

function detectShape(style: string): Shape {
  const s = style.toLowerCase();
  if (s.includes('ellipse')) return 'circle';
  if (s.includes('rhombus')) return 'diamond';
  if (s.includes('cylinder') || s.includes('shape=cylinder')) return 'cylinder';
  if (s.includes('rounded=1')) return 'rounded';
  return 'box';
}

/**
 * Detect a node's role under ANSI/ISO 5807. Falls back to `process` for unknown shapes
 * (the most permissive default — a rectangle is the universal "do something" symbol).
 *
 * Heuristics:
 *   - `shape=offPageConnector` → offpage (pentagon)
 *   - `ellipse` with width<=60 and short label → connector (small on-page circle)
 *   - `ellipse` (other)                        → terminator
 *   - `rhombus`                                → decision
 *   - `shape=document`                         → document
 *   - `shape=parallelogram` or `shape=data`    → data (input/output)
 *   - default                                  → process
 */
function detectAnsiShape(style: string, label: string, width?: number): AnsiShape {
  const s = style.toLowerCase();
  if (s.includes('offpageconnector')) return 'offpage';
  if (s.includes('rhombus') || s.includes('flowchart.decision')) return 'decision';
  if (s.includes('flowchart.terminator') || s.includes('flowchart.start')) return 'terminator';
  if (s.includes('document')) return 'document';
  if (s.includes('parallelogram') || s.includes('shape=data')) return 'data';
  if (s.includes('shape=process') || s.includes('shape=predefinedprocess')) return 'predefined';
  if (s.includes('ellipse')) {
    // Heuristic: small circle with short label = on-page connector. Otherwise terminator.
    const isSmall = (width ?? 999) <= 60 && label.trim().length <= 3;
    return isSmall ? 'connector' : 'terminator';
  }
  return 'process';
}

/** True if the cell is a group container (subgraph) — drawio marks with style="group" or has children */
function isGroup(cell: MxCell, allCells: MxCell[]): boolean {
  if (cell.style.includes('group')) return true;
  // Has child vertex cells = container
  const hasChildren = allCells.some(
    (c) => c.vertex && c.parent === cell.id && c.id !== cell.id,
  );
  return hasChildren && cell.vertex;
}

/** Slugify a label to a stable id when drawio id is opaque. */
function slugify(label: string, fallback: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/¿/g, '')          // drop opening ¿ (closing ? is kept below)
    .replace(/[^a-z0-9?]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/** Strip HTML tags drawio uses inside labels (e.g. <br/>). */
function stripHtml(label: string): string {
  return label
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function xmlToDiagram(xml: string): ToonDiagram {
  const cells = parseDrawioXml(xml);

  // Skip the synthetic root cells (id "0" and "1")
  const real = cells.filter((c) => c.id !== '0' && c.id !== '1' && c.id !== '');

  // Build a set of edge cell ids so we can detect drawio label-cells:
  // drawio creates a vertex="1" child cell parented to an edge cell to hold
  // a manually-positioned edge label. These must be excluded from nodes.
  const edgeCellIds = new Set<string>(real.filter((c) => c.edge).map((c) => c.id));

  const groupCellIds = new Set<string>();
  for (const c of real) {
    if (c.vertex && isGroup(c, cells)) groupCellIds.add(c.id);
  }

  // Build stable id mapping (drawio id → slug)
  const idMap = new Map<string, string>();
  const usedSlugs = new Set<string>();
  for (const c of real) {
    if (!c.vertex && !c.edge) continue;
    // Skip label-cells parented to edges — they are not real nodes
    if (c.vertex && c.parent !== null && edgeCellIds.has(c.parent)) continue;
    const label = stripHtml(c.value);
    const base = slugify(label, c.id);
    let slug = base;
    let i = 1;
    while (usedSlugs.has(slug)) slug = `${base}-${++i}`;
    usedSlugs.add(slug);
    idMap.set(c.id, slug);
  }

  const groups: ToonGroup[] = [];
  const nodes: ToonNode[] = [];
  const edges: ToonEdge[] = [];

  for (const c of real) {
    if (c.vertex && c.parent !== null && edgeCellIds.has(c.parent)) continue;
    if (c.vertex) {
      const id = idMap.get(c.id)!;
      const label = stripHtml(c.value);
      if (groupCellIds.has(c.id)) {
        groups.push({ id, label });
      } else {
        const node: ToonNode = {
          id,
          label,
          shape: detectShape(c.style),
        };
        if (c.parent && groupCellIds.has(c.parent)) {
          node.group = idMap.get(c.parent);
        }
        nodes.push(node);
      }
    } else if (c.edge) {
      const from = c.source ? idMap.get(c.source) : undefined;
      const to = c.target ? idMap.get(c.target) : undefined;
      if (!from || !to) continue;
      const edge: ToonEdge = { from, to };
      const label = stripHtml(c.value);
      if (label) edge.label = label;
      edges.push(edge);
    }
  }

  return {
    direction: inferDirection(),
    groups,
    nodes,
    edges,
  };
}

/**
 * Serialize a ToonDiagram to TOON markdown text.
 * Output format matches the project's TOON conventions (header + tabular blocks).
 *
 * Edges use the format: `slug "Label",slug "Label",edge-label` so the LLM
 * can read natural language directly from the edge line without looking up nodes.
 */
export function diagramToToon(d: ToonDiagram): string {
  const lines: string[] = [];
  lines.push(`diagram: flow`);
  lines.push(`direction: ${d.direction}`);

  // Build id → label index for inline edge labels (option C)
  const labelOf = new Map<string, string>();
  for (const g of d.groups) labelOf.set(g.id, g.label);
  for (const n of d.nodes) labelOf.set(n.id, n.label);

  if (d.groups.length > 0) {
    lines.push(`groups[${d.groups.length}]{id,label}:`);
    for (const g of d.groups) {
      lines.push(`  ${g.id},${escapeField(g.label)}`);
    }
  }

  lines.push(`nodes[${d.nodes.length}]{id,label,shape,group}:`);
  for (const n of d.nodes) {
    lines.push(`  ${n.id},${escapeField(n.label)},${n.shape},${n.group ?? ''}`);
  }

  if (d.edges.length > 0) {
    lines.push(`edges[${d.edges.length}]{from,to,label}:`);
    for (const e of d.edges) {
      const from = labelOf.has(e.from) ? `${e.from} "${escapeField(labelOf.get(e.from)!)}"` : e.from;
      const to   = labelOf.has(e.to)   ? `${e.to} "${escapeField(labelOf.get(e.to)!)}"` : e.to;
      lines.push(`  ${from},${to},${escapeField(e.label ?? '')}`);
    }
  }

  return lines.join('\n');
}

function escapeField(s: string): string {
  // Commas and newlines break the row format; replace with safe alternatives.
  return s.replace(/,/g, ' ').replace(/\n/g, ' ').trim();
}

export function xmlToToon(xml: string): string {
  return diagramToToon(xmlToDiagram(xml));
}

// ---------------------------------------------------------------------------
// ANSI/ISO 5807 variant
// ---------------------------------------------------------------------------

interface AnsiToonNode {
  id: string;
  label: string;
  shape: AnsiShape;
}

interface AnsiToonDiagram {
  direction: Direction;
  nodes: AnsiToonNode[];
  edges: ToonEdge[];
}

function cellsToDiagramAnsi(cells: MxCell[]): AnsiToonDiagram {
  const real = cells.filter((c) => c.id !== '0' && c.id !== '1' && c.id !== '');

  const edgeCellIds = new Set<string>(real.filter((c) => c.edge).map((c) => c.id));

  const idMap = new Map<string, string>();
  const usedSlugs = new Set<string>();
  for (const c of real) {
    if (!c.vertex && !c.edge) continue;
    if (c.vertex && c.parent !== null && edgeCellIds.has(c.parent)) continue;
    const label = stripHtml(c.value);
    const base = slugify(label, c.id);
    let slug = base;
    let i = 1;
    while (usedSlugs.has(slug)) slug = `${base}-${++i}`;
    usedSlugs.add(slug);
    idMap.set(c.id, slug);
  }

  const nodes: AnsiToonNode[] = [];
  const edges: ToonEdge[] = [];

  for (const c of real) {
    if (c.vertex && c.parent !== null && edgeCellIds.has(c.parent)) continue;
    const slug = idMap.get(c.id);
    if (!slug) continue;
    const label = stripHtml(c.value);
    if (c.vertex) {
      nodes.push({
        id: slug,
        label,
        shape: detectAnsiShape(c.style, label, c.width),
      });
    } else if (c.edge && c.source && c.target) {
      const from = idMap.get(c.source);
      const to = idMap.get(c.target);
      if (from && to) edges.push({ from, to, label: label || undefined });
    }
  }

  return { direction: inferDirection(), nodes, edges };
}

/**
 * Render a single ANSI page's body (without the top-level `diagram:`/`notation:`
 * lines, since those are emitted once per TOON document). Includes a `page:`
 * separator when a name is provided.
 */
function pageBodyAnsi(name: string, d: AnsiToonDiagram): string {
  const lines: string[] = [];
  if (name) lines.push(`page: ${escapeField(name)}`);
  lines.push(`direction: ${d.direction}`);
  lines.push(`nodes[${d.nodes.length}]{id,label,shape}:`);

  const labelOf = new Map<string, string>();
  for (const n of d.nodes) labelOf.set(n.id, n.label);

  for (const n of d.nodes) {
    lines.push(`  ${n.id},${escapeField(n.label)},${n.shape}`);
  }
  if (d.edges.length > 0) {
    lines.push(`edges[${d.edges.length}]{from,to,label}:`);
    for (const e of d.edges) {
      const from = labelOf.has(e.from) ? `${e.from} "${escapeField(labelOf.get(e.from)!)}"` : e.from;
      const to   = labelOf.has(e.to)   ? `${e.to} "${escapeField(labelOf.get(e.to)!)}"` : e.to;
      lines.push(`  ${from},${to},${escapeField(e.label ?? '')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Lint result for an ANSI/ISO 5807 diagram. `warnings` is empty when the diagram
 * is well-formed; otherwise each entry describes a modeling issue the user
 * should fix in drawio.
 */
export interface AnsiLintWarning {
  /** Stable code for grouping/i18n (e.g. `offpage_orphan`). */
  code: string;
  /** Human-readable message in Spanish (UI) explaining the problem AND the fix. */
  message: string;
  /** Drawio cell id of the offending node, when applicable, so the UI can highlight it. */
  cellId?: string;
}

/**
 * Validate an ANSI/ISO 5807 diagram against the standard's rules.
 *
 * Detected issues:
 *   - offpage_orphan: a connector appears only once in the whole document
 *     (no peer to continue the flow). User must add the matching pentagon.
 *   - offpage_too_many: same offpage label appears 3+ times. ANSI dictates
 *     a 2-point connection only; user should rename duplicates.
 *   - connector_orphan: an on-page connector has no peer in the same page.
 *   - connector_too_many: 3+ on-page connectors share a label in one page.
 *   - decision_arity: a decision (rhombus) has ≠2 outgoing edges. The standard
 *     prescribes exactly 2 branches.
 */
export function validateAnsiDiagram(xml: string): AnsiLintWarning[] {
  const pages = parseDrawioPages(xml);
  const warnings: AnsiLintWarning[] = [];

  // --- Off-page: scope is the whole document (cross-page) ---
  // Map: label → list of {pageName, cellId}
  const offpageByLabel = new Map<string, Array<{ pageName: string; cellId: string }>>();

  // --- On-page connectors and decisions: scope is a single page ---
  for (const page of pages) {
    const real = page.cells.filter((c) => c.id !== '0' && c.id !== '1' && c.id !== '');
    const connectorByLabel = new Map<string, string[]>(); // label → cellIds (this page)

    for (const c of real) {
      if (!c.vertex) continue;
      const label = stripHtml(c.value).trim();
      const shape = detectAnsiShape(c.style, label, c.width);

      if (shape === 'offpage') {
        if (!label) {
          warnings.push({
            code: 'offpage_no_label',
            message: `Off-page connector sin label en la página "${page.name || '(sin nombre)'}". Asignale un identificador (ej. "A") y replicalo en la página destino.`,
            cellId: c.id,
          });
          continue;
        }
        const list = offpageByLabel.get(label) ?? [];
        list.push({ pageName: page.name, cellId: c.id });
        offpageByLabel.set(label, list);
      } else if (shape === 'connector') {
        if (!label) {
          warnings.push({
            code: 'connector_no_label',
            message: `Connector on-page sin label en la página "${page.name || '(sin nombre)'}". Asignale un número (ej. "1") y agregá otro círculo con el mismo número en esta página.`,
            cellId: c.id,
          });
          continue;
        }
        const list = connectorByLabel.get(label) ?? [];
        list.push(c.id);
        connectorByLabel.set(label, list);
      }
    }

    // Per-page connector validation
    for (const [label, cellIds] of connectorByLabel) {
      if (cellIds.length === 1) {
        warnings.push({
          code: 'connector_orphan',
          message: `El connector on-page "${label}" en la página "${page.name || '(sin nombre)'}" aparece una sola vez. Agregá otro círculo con label "${label}" en esta misma página, o eliminalo si era residuo.`,
          cellId: cellIds[0],
        });
      } else if (cellIds.length > 2) {
        warnings.push({
          code: 'connector_too_many',
          message: `El connector on-page "${label}" aparece ${cellIds.length} veces en la página "${page.name || '(sin nombre)'}". On-page connectors conectan exactamente 2 puntos: renombrá los extras (ej. "${label}2", "${label}3").`,
          cellId: cellIds[0],
        });
      }
    }

    // Per-page decision arity validation (ANSI: rhombus must have exactly 2 outgoing edges)
    const idToShape = new Map<string, AnsiShape>();
    const idToLabel = new Map<string, string>();
    for (const c of real) {
      if (!c.vertex) continue;
      const lbl = stripHtml(c.value).trim();
      idToShape.set(c.id, detectAnsiShape(c.style, lbl, c.width));
      idToLabel.set(c.id, lbl);
    }
    const outgoing = new Map<string, number>();
    for (const c of real) {
      if (c.edge && c.source) outgoing.set(c.source, (outgoing.get(c.source) ?? 0) + 1);
    }
    for (const [cellId, shape] of idToShape) {
      if (shape !== 'decision') continue;
      const n = outgoing.get(cellId) ?? 0;
      if (n !== 2) {
        warnings.push({
          code: 'decision_arity',
          message: `La decisión "${idToLabel.get(cellId) || '(sin label)'}" en la página "${page.name || '(sin nombre)'}" tiene ${n} edges salientes. ANSI/ISO 5807 exige exactamente 2 (Sí/No o condición/no condición). ${n < 2 ? 'Agregá la rama faltante' : 'Convertí a `process` o eliminá edges'}.`,
          cellId,
        });
      }
    }
  }

  // --- Cross-page off-page validation ---
  for (const [label, occurrences] of offpageByLabel) {
    if (occurrences.length === 1) {
      const o = occurrences[0]!;
      warnings.push({
        code: 'offpage_orphan',
        message: `El connector cross-page "${label}" aparece una sola vez (en la página "${o.pageName || '(sin nombre)'}"). Agregá un segundo pentágono con el mismo label en la página destino, o eliminalo si era residuo.`,
        cellId: o.cellId,
      });
    } else if (occurrences.length > 2) {
      warnings.push({
        code: 'offpage_too_many',
        message: `El connector cross-page "${label}" aparece ${occurrences.length} veces. Off-page connectors conectan exactamente 2 páginas: renombrá los duplicados (ej. "${label}2", "${label}3").`,
        cellId: occurrences[0]!.cellId,
      });
    }
  }

  return warnings;
}

/**
 * Convert drawio XML to a TOON block tagged with `notation: ansi-iso-5807`.
 *
 * Pages: when the XML contains multiple `<diagram>` pages, each is emitted as
 * its own block separated by `---`, with a `page: <name>` line. This removes
 * the ambiguity of having the same `offpage` / `connector` label appear in
 * unrelated flows — the LLM resolves continuity within and across page blocks
 * unambiguously.
 *
 * Detects ANSI/ISO 5807 shapes: terminator, process, decision, offpage,
 * connector, data, document, predefined.
 */
export function xmlToToonAnsi(xml: string): string {
  const pages = parseDrawioPages(xml);
  const header = ['diagram: flow', 'notation: ansi-iso-5807'].join('\n');
  // Single unnamed page → omit `page:` line for compactness.
  if (pages.length === 1 && !pages[0]!.name) {
    const body = pageBodyAnsi('', cellsToDiagramAnsi(pages[0]!.cells));
    return [header, body].join('\n');
  }
  const blocks = pages.map((p) => pageBodyAnsi(p.name, cellsToDiagramAnsi(p.cells)));
  return [header, blocks.join('\n---\n')].join('\n');
}

/**
 * Pick the right converter for the given notation. Falls back to the generic
 * converter when notation is null/unknown.
 */
export function xmlToToonByNotation(xml: string, notation: Notation | string | null): string {
  if (notation === 'ansi-iso-5807') return xmlToToonAnsi(xml);
  return xmlToToon(xml);
}
