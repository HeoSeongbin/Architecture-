import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Server } from 'lucide-react';
import { assetIcons, categoryLabels } from '../../utils/assetPresentation';
import type { ArchitectureNode } from '../../types/graph';

const connectionHandles = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function ArchitectureNodeCard({ data, selected }: NodeProps<ArchitectureNode>) {
  const Icon = assetIcons[data.kind] ?? Server;

  return (
    <div
      className={`architecture-node ${selected ? 'architecture-node-selected' : ''}`}
      style={{ '--node-accent': data.accent } as React.CSSProperties}
    >
      {connectionHandles.map((position) => (
        <Handle className="node-handle" id={position} key={position} position={position} type="source" />
      ))}
      <div className="flex items-start gap-3">
        <div className="node-icon">
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{data.label}</div>
          <div className="truncate text-xs text-slate-500">{data.subtitle}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{categoryLabels[data.category] ?? data.category}</span>
        <span className="node-status">활성</span>
      </div>
      {data.note ? <div className="mt-2 line-clamp-2 text-xs text-slate-500">{data.note}</div> : null}
    </div>
  );
}
