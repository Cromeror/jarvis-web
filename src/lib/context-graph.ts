/**
 * Parses a CONTEXT.md hub file into a graph of nodes and edges.
 *
 * Node types:
 *   hub        — root context file (CONTEXT.md)
 *   config     — CLAUDE.md / project config files
 *   flujo      — flow docs (.drawio / flujos/*)
 *   doc        — technical docs (packages/docs/*)
 *   tool       — tool references extracted from text
 *   adr        — architecture decision records
 *   section    — heading-level groupings (e.g. "Inconsistencias conocidas")
 *
 * Edges are built from:
 *   1. Markdown links [label](path) in the CONTEXT.md
 *   2. Nested indentation (child links under a parent link = subtree)
 *   3. Section headings group their children
 */

export type NodeType = 'hub' | 'config' | 'flujo' | 'doc' | 'tool' | 'adr' | 'section';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  path?: string;       // relative file path (if applicable)
  description?: string;
  url?: string;        // full URL for navigation
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ContextGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function classifyPath(path: string): NodeType {
  const p = path.toLowerCase();
  if (p.includes('claude.md')) return 'config';
  if (p.includes('flujos/') || p.endsWith('.drawio')) return 'flujo';
  if (p.includes('packages/docs/') || p.includes('/docs/')) return 'doc';
  if (p.includes('adr')) return 'adr';
  return 'doc';
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Extract [label](path) links from a single line */
function extractLinks(line: string): Array<{ label: string; path: string }> {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const results: Array<{ label: string; path: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    results.push({ label: m[1]!, path: m[2]! });
  }
  return results;
}

/** Count leading spaces/tabs to determine indent level */
function indentLevel(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1]!.length : 0;
}

/** Extract description text that follows a link on the same line (after " — ") */
function extractDescription(line: string): string | undefined {
  const dashIdx = line.indexOf(' — ');
  if (dashIdx === -1) return undefined;
  // Remove any trailing links in the description
  return line.slice(dashIdx + 3).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim() || undefined;
}

// ── main parser ───────────────────────────────────────────────────────────────

export function parseContextGraph(
  contextMdContent: string,
  contextFilePath = 'docs/CONTEXT.md',
): ContextGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: GraphNode): void => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  };

  const addEdge = (source: string, target: string, label?: string): void => {
    const id = `e-${source}-${target}`;
    if (!edges.find((e) => e.id === id)) {
      edges.push({ id, source, target, label });
    }
  };

  // Root hub node
  const hubId = slugify(contextFilePath);
  addNode({
    id: hubId,
    label: 'Jarvis Context',
    type: 'hub',
    path: contextFilePath,
    description: 'Hub de conocimiento del proyecto',
  });

  const lines = contextMdContent.split('\n');

  // Track heading sections so we can group nodes under them
  let currentSectionId: string | null = null;
  // Stack of (indent, nodeId) for nested link resolution
  const indentStack: Array<{ indent: number; nodeId: string }> = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // ## Section headings → section nodes
    if (trimmed.startsWith('## ')) {
      const title = trimmed.slice(3).trim();
      const sectionId = `section-${slugify(title)}`;
      addNode({ id: sectionId, label: title, type: 'section' });
      addEdge(hubId, sectionId);
      currentSectionId = sectionId;
      indentStack.length = 0;
      continue;
    }

    // Skip H1 and H3+
    if (trimmed.startsWith('#')) continue;

    // Lines with markdown links
    const links = extractLinks(trimmed);
    if (links.length === 0) continue;

    const currentIndent = indentLevel(rawLine);

    // Determine parent for this line
    // Pop stack entries that are at same or deeper indent
    while (indentStack.length > 0 && indentStack[indentStack.length - 1]!.indent >= currentIndent) {
      indentStack.pop();
    }
    const parentId =
      indentStack.length > 0
        ? indentStack[indentStack.length - 1]!.nodeId
        : (currentSectionId ?? hubId);

    // Primary link on this line (first link = the node)
    const primary = links[0]!;
    const nodeId = slugify(primary.path) || slugify(primary.label);
    const type = classifyPath(primary.path);
    const description = extractDescription(rawLine);

    addNode({
      id: nodeId,
      label: primary.label,
      type,
      path: primary.path,
      description,
    });
    addEdge(parentId, nodeId);

    // Push to indent stack so children link to this node
    indentStack.push({ indent: currentIndent, nodeId });

    // Additional inline links on the same line (sibling references)
    for (const link of links.slice(1)) {
      const sibId = slugify(link.path) || slugify(link.label);
      if (sibId === nodeId) continue;
      addNode({
        id: sibId,
        label: link.label,
        type: classifyPath(link.path),
        path: link.path,
      });
      addEdge(nodeId, sibId);
    }
  }

  return { nodes, edges };
}
