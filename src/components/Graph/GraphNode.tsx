import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeType } from '../../lib/context-graph.js';

export interface GraphNodeData {
  label: string;
  type: NodeType;
  path?: string;
  description?: string;
  dimmed?: boolean;
}

const TYPE_META: Record<NodeType, { icon: string; className: string }> = {
  hub:     { icon: '◉', className: 'gnode-hub' },
  config:  { icon: '⚙', className: 'gnode-config' },
  flujo:   { icon: '⟶', className: 'gnode-flujo' },
  doc:     { icon: '📄', className: 'gnode-doc' },
  tool:    { icon: '🔧', className: 'gnode-tool' },
  adr:     { icon: '⚖', className: 'gnode-adr' },
  section: { icon: '▸', className: 'gnode-section' },
};

interface Props {
  data: GraphNodeData;
  selected?: boolean;
}

export function KnowledgeGraphNode({ data, selected }: Props): React.ReactElement {
  const meta = TYPE_META[data.type] ?? TYPE_META.doc;

  return (
    <div
      className={[
        'gnode',
        meta.className,
        selected ? 'gnode-selected' : '',
        data.dimmed ? 'gnode-dimmed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Handle type="target" position={Position.Left} className="gnode-handle" />
      <div className="gnode-icon">{meta.icon}</div>
      <div className="gnode-body">
        <div className="gnode-label">{data.label}</div>
        {data.description && (
          <div className="gnode-desc">{data.description}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="gnode-handle" />
    </div>
  );
}
