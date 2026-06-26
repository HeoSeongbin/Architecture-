import { NodeResizer, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ArchitectureNode } from '../../types/graph';

export function BlockNodeCard({ data, selected }: NodeProps<ArchitectureNode>) {
  return (
    <div
      className={`block-node ${selected ? 'block-node-selected' : ''}`}
      style={{ '--node-accent': data.accent } as CSSProperties}
    >
      <NodeResizer
        color={data.accent}
        handleClassName="group-resize-handle"
        isVisible={selected}
        minHeight={96}
        minWidth={160}
      />
      <div className="block-node-title">{data.label}</div>
      <div className="block-node-subtitle">{data.subtitle}</div>
      {data.note ? <div className="block-node-note">{data.note}</div> : null}
    </div>
  );
}

