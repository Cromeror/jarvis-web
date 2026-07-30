import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { ProjectNode } from '../components/Map/ProjectNode.js';
import { IntegrationNode } from '../components/Map/IntegrationNode.js';
import { ContextPanel } from '../components/Map/ContextPanel.js';

const NODE_TYPES = {
  project: ProjectNode,
  integration: IntegrationNode,
};

/** Column x positions for layout */
const COL_PROJECT = 50;
const COL_INTEGRATION = 350;
const NODE_HEIGHT = 80;
const NODE_V_GAP = 20;

/**
 * ReactFlow canvas: project root node + integration nodes.
 * Manual layered layout (no dagre — no new deps).
 * REQ-2, REQ-3, REQ-12, SC-02/03, T11.
 */
export function ProjectMapPage(): React.ReactElement {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const onBack = useCallback(() => navigate('/'), [navigate]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    listProjects()
      .then((all) => {
        const found = all.find((p) => p.id === projectId) ?? null;
        if (!found) {
          setNotFound(true);
        } else {
          setProject(found);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading project');
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  /**
   * Build nodes and edges from project summary.
   * Integration data is derived from counts — the full context
   * is shown in the ContextPanel sidebar (text format).
   */
  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!project) return { nodes: [], edges: [] };

    const ns: Node[] = [];
    const es: Edge[] = [];

    // Root project node
    ns.push({
      id: project.id,
      type: 'project',
      position: {
        x: COL_PROJECT,
        y: Math.max(
          (project.integrations_count * (NODE_HEIGHT + NODE_V_GAP)) / 2,
          0,
        ),
      },
      data: {
        label: project.name,
        status: project.status,
        sector: project.sector,
        sdd_enabled: project.sdd_enabled,
      },
    });

    // Integration placeholder nodes
    for (let i = 0; i < project.integrations_count; i++) {
      const nodeId = `integration-${i}`;
      ns.push({
        id: nodeId,
        type: 'integration',
        position: {
          x: COL_INTEGRATION,
          y: i * (NODE_HEIGHT + NODE_V_GAP),
        },
        data: {
          label: `Integration ${i + 1}`,
          config: {},
        },
      });
      es.push({
        id: `e-${project.id}-${nodeId}`,
        source: project.id,
        target: nodeId,
        animated: false,
      });
    }

    return { nodes: ns, edges: es };
  }, [project]);

  const onInit = useCallback(() => {
    // ReactFlow initialized
  }, []);

  if (loading) {
    return (
      <div className="map-page">
        <div className="map-loading">Loading project...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="map-page map-page-error">
        <div className="map-error-box">
          <h2>Project not found</h2>
          <p>No project with id <strong>{projectId}</strong> exists.</p>
          <button className="btn btn-secondary" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-page map-page-error">
        <div className="map-error-box">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Dashboard
        </button>
        <span className="map-toolbar-title">{project?.name ?? projectId}</span>
      </div>

      <div className="map-canvas-area">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onInit={onInit}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <div className="map-sidebar">
        <ContextPanel projectId={projectId} />
      </div>
    </div>
  );
}
