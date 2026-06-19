import type { Edge, Node } from '@xyflow/react';

export type ArchitectureNodeKind =
  | 'mssql'
  | 'oracle'
  | 'mariadb'
  | 'postgresql'
  | 'mongodb'
  | 'redis'
  | 'docker'
  | 'nginx'
  | 'wsl'
  | 'nodejs'
  | 'python'
  | 'spring'
  | 'aspnet'
  | 'react'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'loadbalancer'
  | 'firewall'
  | 'queue'
  | 'group';

export interface ArchitectureNodeData extends Record<string, unknown> {
  kind: ArchitectureNodeKind;
  label: string;
  subtitle: string;
  category: 'Database' | 'Server' | 'Application' | 'Cloud' | 'Network' | 'Group';
  accent: string;
  isGroup?: boolean;
  note?: string;
}

export interface ArchitectureEdgeData extends Record<string, unknown> {
  direction?: 'forward' | 'reverse' | 'bidirectional';
  handleMode?: 'auto' | 'manual';
  label?: string;
  labelMode?: 'hidden' | 'protocol' | 'compact' | 'full';
  labelOrientation?: 'auto' | 'horizontal' | 'vertical' | 'verticalClockwise' | 'verticalCounterclockwise';
  labelOffsetX?: number;
  labelOffsetY?: number;
  manualLabelOffsetX?: number;
  manualLabelOffsetY?: number;
  renderLabel?: string;
  routePoints?: Array<{ x: number; y: number }>;
  showEndpoints?: boolean;
  sourceTerminalOffset?: number;
  targetTerminalOffset?: number;
}

export type ArchitectureNode = Node<ArchitectureNodeData, 'architectureNode' | 'groupNode'>;
export type ArchitectureEdge = Edge<ArchitectureEdgeData, 'architectureEdge'>;

export interface GraphState {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface MinifiedNode {
  i: string;
  t: string;
  p: [number, number];
  d: ArchitectureNodeData;
  g?: string;
  e?: 1;
  w?: number;
  h?: number;
}

export interface MinifiedEdge {
  i: string;
  s: string;
  t: string;
  l?: string;
  d?: 'r' | 'b';
  h?: 1;
  m?: 'h' | 'c' | 'f';
  r?: 'h' | 'v' | 'w';
  ox?: number;
  oy?: number;
  a?: 't' | 'r' | 'b' | 'l';
  z?: 't' | 'r' | 'b' | 'l';
  x?: 1;
}

export interface MinifiedGraph {
  n: MinifiedNode[];
  e: MinifiedEdge[];
}
