import React from 'react';
import { Handle, Position } from 'reactflow';

interface ProjectNodeData {
  label: string;
  status: string;
  sector: string | null;
  sdd_enabled: boolean | null;
}

interface ProjectNodeProps {
  data: ProjectNodeData;
}

/**
 * ReactFlow custom node — project root.
 * Spec §3.3, T10.
 */
export function ProjectNode({ data }: ProjectNodeProps): React.ReactElement {
  return (
    <div className="map-node map-node-project">
      <Handle type="source" position={Position.Right} />
      <div className="map-node-label">{data.label}</div>
      <div className="map-node-meta">
        <span className={`status-badge status-${data.status}`}>{data.status}</span>
        {data.sector && <span className="map-node-sector">{data.sector}</span>}
        {data.sdd_enabled && <span className="map-node-sdd">SDD</span>}
      </div>
    </div>
  );
}
