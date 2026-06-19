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
  | 'queue';

export interface ArchitectureNodeData extends Record<string, unknown> {
  kind: ArchitectureNodeKind;
  label: string;
  subtitle: string;
  category: 'Database' | 'Server' | 'Application' | 'Cloud' | 'Network';
  accent: string;
  note?: string;
}

export interface ArchitectureEdgeData extends Record<string, unknown> {
  direction?: 'forward' | 'reverse' | 'bidirectional';
  label?: string;
  showEndpoints?: boolean;
}

export type ArchitectureNode = Node<ArchitectureNodeData, 'architectureNode'>;
export type ArchitectureEdge = Edge<ArchitectureEdgeData>;

export interface GraphState {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface MinifiedNode {
  i: string;
  t: string;
  p: [number, number];
  d: ArchitectureNodeData;
}

export interface MinifiedEdge {
  i: string;
  s: string;
  t: string;
  l?: string;
  d?: 'r' | 'b';
  x?: 1;
}

export interface MinifiedGraph {
  n: MinifiedNode[];
  e: MinifiedEdge[];
}
