import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ArchitectureNode } from '../../types/graph';
import { useGraphStore } from '../../store/useGraphStore';

export const GroupNodeCard = memo(function GroupNodeCard({ data, selected }: NodeProps<ArchitectureNode>) {
  return (
    <div className={`group-node ${selected ? 'group-node-selected' : ''}`} style={{ '--node-accent': data.accent } as CSSProperties}>
      <NodeResizer
        color={data.accent}
        handleClassName="group-resize-handle"
        isVisible={selected}
        minHeight={180}
        minWidth={280}
        maxWidth={8000}
        maxHeight={8000}
        onResizeStart={() => useGraphStore.getState().beginResize()}
      />
      <div className="group-node-header">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-800">{data.label}</div>
          <div className="truncate text-xs text-slate-500">{data.subtitle}</div>
        </div>
        <span className="group-node-badge">그룹</span>
      </div>
      {data.note ? <div className="group-node-note">{data.note}</div> : null}
    </div>
  );
});
