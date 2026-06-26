import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Cloud,
  Container,
  Database,
  Globe2,
  MonitorSmartphone,
  Network,
  Server,
  Shield,
  SplitSquareHorizontal,
  TerminalSquare,
  Workflow
} from 'lucide-react';
import type { ArchitectureNode } from '../../types/graph';

const iconByKind = {
  mssql: Database,
  oracle: Database,
  mariadb: Database,
  postgresql: Database,
  mongodb: Database,
  redis: Database,
  docker: Container,
  nginx: Network,
  wsl: TerminalSquare,
  nodejs: Server,
  python: TerminalSquare,
  spring: Server,
  aspnet: Globe2,
  react: MonitorSmartphone,
  aws: Cloud,
  azure: Cloud,
  gcp: Cloud,
  loadbalancer: SplitSquareHorizontal,
  firewall: Shield,
  queue: Workflow,
  group: Server,
  block: Server,
};

const connectionHandles = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

export function ArchitectureNodeCard({ data, selected }: NodeProps<ArchitectureNode>) {
  const Icon = iconByKind[data.kind] ?? Server;

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
        <span>{data.category}</span>
        <span className="node-status">Active</span>
      </div>
      {data.note ? <div className="mt-2 line-clamp-2 text-xs text-slate-500">{data.note}</div> : null}
    </div>
  );
}

