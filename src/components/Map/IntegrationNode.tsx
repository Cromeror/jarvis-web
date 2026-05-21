import React from 'react';
import { Handle, Position } from 'reactflow';

interface IntegrationNodeData {
  label: string;
  config: Record<string, unknown>;
}

interface IntegrationNodeProps {
  data: IntegrationNodeData;
}

/**
 * ReactFlow custom node — integration (jira, github, etc.).
 * Spec §3.3, T10.
 */
export function IntegrationNode({ data }: IntegrationNodeProps): React.ReactElement {
  return (
    <div className="map-node map-node-integration">
      <Handle type="target" position={Position.Left} />
      <div className="map-node-icon">&#128279;</div>
      <div className="map-node-label">{data.label}</div>
    </div>
  );
}
