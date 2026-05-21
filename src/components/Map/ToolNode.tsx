import React from 'react';
import { Handle, Position } from 'reactflow';

interface ToolNodeData {
  label: string;
  description?: string;
}

interface ToolNodeProps {
  data: ToolNodeData;
}

/**
 * ReactFlow custom node — available tool.
 * Spec §3.3, T10.
 */
export function ToolNode({ data }: ToolNodeProps): React.ReactElement {
  return (
    <div className="map-node map-node-tool">
      <Handle type="target" position={Position.Left} />
      <div className="map-node-icon">&#128295;</div>
      <div className="map-node-label">{data.label}</div>
      {data.description && (
        <div className="map-node-sub" title={data.description}>
          {data.description.slice(0, 40)}{data.description.length > 40 ? '…' : ''}
        </div>
      )}
    </div>
  );
}
