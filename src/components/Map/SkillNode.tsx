import React from 'react';
import { Handle, Position } from 'reactflow';

interface SkillNodeData {
  label: string;
  scope: 'user' | 'project';
  client: string;
}

interface SkillNodeProps {
  data: SkillNodeData;
}

/**
 * ReactFlow custom node — installed skill.
 * Spec §3.3, T10.
 */
export function SkillNode({ data }: SkillNodeProps): React.ReactElement {
  return (
    <div className="map-node map-node-skill">
      <Handle type="target" position={Position.Left} />
      <div className="map-node-icon">&#9889;</div>
      <div className="map-node-label">{data.label}</div>
      <div className="map-node-sub">{data.scope} &middot; {data.client}</div>
    </div>
  );
}
