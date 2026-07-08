import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getFile } from '../lib/api.js';
import { parseContextGraph } from '../lib/context-graph.js';
import type { GraphNode as KNode, NodeType } from '../lib/context-graph.js';
import { KnowledgeGraphNode } from '../components/Graph/GraphNode.js';
import type { GraphNodeData } from '../components/Graph/GraphNode.js';
import { DocPreviewPanel } from '../components/Graph/DocPreviewPanel.js';

// ── layout ────────────────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 64;
const H_GAP = 80;
const V_GAP = 24;

/**
 * Layered left→right layout via BFS from hub root.
 * Returns a map of nodeId → {x, y}.
 */
function computeLayout(
  nodes: KNode[],
  edges: Array<{ source: string; target: string }>,
): Map<string, { x: number; y: number }> {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // BFS layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  // Roots = nodes with no incoming edges (or hubs)
  const roots = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0 || n.type === 'hub');
  const queue: Array<{ id: string; layer: number }> = roots.map((n) => ({ id: n.id, layer: 0 }));

  for (const r of roots) visited.add(r.id);

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (!layers[item.layer]) layers[item.layer] = [];
    layers[item.layer]!.push(item.id);

    for (const child of adjacency.get(item.id) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push({ id: child, layer: item.layer + 1 });
      }
    }
  }

  // Any unvisited nodes (disconnected) go to last layer
  const lastLayer = layers.length;
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      if (!layers[lastLayer]) layers[lastLayer] = [];
      layers[lastLayer]!.push(n.id);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (let col = 0; col < layers.length; col++) {
    const layer = layers[col]!;
    const totalH = layer.length * (NODE_H + V_GAP) - V_GAP;
    const startY = -totalH / 2;
    for (let row = 0; row < layer.length; row++) {
      positions.set(layer[row]!, {
        x: col * (NODE_W + H_GAP),
        y: startY + row * (NODE_H + V_GAP),
      });
    }
  }
  return positions;
}

// ── types ─────────────────────────────────────────────────────────────────────

const NODE_TYPES = { knowledge: KnowledgeGraphNode };

const TYPE_COLOR: Record<NodeType, string> = {
  hub:     '#1a1a2e',
  config:  '#4a4e69',
  flujo:   '#e6a817',
  doc:     '#0066cc',
  tool:    '#7c5cc4',
  adr:     '#3a9c5a',
  section: '#888',
};

interface ContextGraphInnerProps {
  onEditFile: (path: string) => void;
  onBack: () => void;
}

function ContextGraphInner({ onEditFile, onBack }: ContextGraphInnerProps): React.ReactElement {
  const [rfNodes, setRfNodes] = useState<Node<GraphNodeData>[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<KNode | null>(null);
  const [search, setSearch] = useState('');
  const graphRef = useRef<Map<string, KNode>>(new Map());
  const { fitView } = useReactFlow();

  // Load and parse CONTEXT.md
  useEffect(() => {
    setLoading(true);
    getFile('docs/CONTEXT.md')
      .then((f) => {
        const graph = parseContextGraph(f.content, 'docs/CONTEXT.md');
        graphRef.current = new Map(graph.nodes.map((n) => [n.id, n]));
        const positions = computeLayout(graph.nodes, graph.edges);

        const nodes: Node<GraphNodeData>[] = graph.nodes.map((n) => ({
          id: n.id,
          type: 'knowledge',
          position: positions.get(n.id) ?? { x: 0, y: 0 },
          data: {
            label: n.label,
            type: n.type,
            path: n.path,
            description: n.description,
          },
        }));

        const edges: Edge[] = graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: '#ccc' },
          style: { stroke: '#ccc', strokeWidth: 1.5 },
          animated: false,
        }));

        setRfNodes(nodes);
        setRfEdges(edges);
        setTimeout(() => fitView({ padding: 0.15 }), 50);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading CONTEXT.md');
      })
      .finally(() => setLoading(false));
  }, [fitView]);

  // Filter nodes by search query
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!search.trim()) {
      return {
        filteredNodes: rfNodes.map((n) => ({ ...n, data: { ...n.data, dimmed: false } })),
        filteredEdges: rfEdges,
      };
    }
    const q = search.toLowerCase();
    const matchIds = new Set(
      rfNodes
        .filter(
          (n) =>
            n.data.label.toLowerCase().includes(q) ||
            (n.data.description ?? '').toLowerCase().includes(q) ||
            n.data.type.includes(q),
        )
        .map((n) => n.id),
    );

    return {
      filteredNodes: rfNodes.map((n) => ({
        ...n,
        data: { ...n.data, dimmed: !matchIds.has(n.id) },
      })),
      filteredEdges: rfEdges.filter(
        (e) => matchIds.has(e.source) && matchIds.has(e.target),
      ),
    };
  }, [rfNodes, rfEdges, search]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const knode = graphRef.current.get(node.id);
      setSelectedNode(knode ?? null);
    },
    [],
  );

  const handleClosePanel = useCallback(() => setSelectedNode(null), []);

  if (loading) {
    return (
      <div className="cgraph-page">
        <div className="cgraph-loading">Cargando grafo de conocimiento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cgraph-page">
        <div className="cgraph-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={onBack}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cgraph-page">
      {/* Toolbar */}
      <div className="cgraph-toolbar">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Dashboard
        </button>
        <span className="cgraph-toolbar-title">Grafo de Conocimiento</span>
        <input
          className="cgraph-search"
          type="search"
          placeholder="Buscar nodos..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <div className="cgraph-legend">
          {(Object.entries(TYPE_COLOR) as Array<[NodeType, string]>).map(([type, color]) => (
            <span key={type} className="cgraph-legend-item">
              <span className="cgraph-legend-dot" style={{ background: color }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas + sidebar */}
      <div className="cgraph-body">
        <div className="cgraph-canvas">
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            nodeTypes={NODE_TYPES}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.3}
            maxZoom={2}
          >
            <Background color="#e8e8e8" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const type = (n.data as GraphNodeData).type as NodeType;
                return TYPE_COLOR[type] ?? '#999';
              }}
              maskColor="rgba(255,255,255,0.6)"
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div className="cgraph-sidebar">
            <DocPreviewPanel
              node={selectedNode}
              onClose={handleClosePanel}
              onEdit={onEditFile}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── public export (wrapped in ReactFlowProvider) ──────────────────────────────

interface ContextGraphPageProps {
  onEditFile: (path: string) => void;
  onBack: () => void;
}

export function ContextGraphPage(props: ContextGraphPageProps): React.ReactElement {
  return (
    <ReactFlowProvider>
      <ContextGraphInner {...props} />
    </ReactFlowProvider>
  );
}
