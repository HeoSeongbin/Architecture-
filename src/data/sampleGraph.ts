import { architectureAssets } from './assets';
import type { ArchitectureEdge, ArchitectureNode, ArchitectureNodeKind, GraphState } from '../types/graph';

const assetByKind = new Map(architectureAssets.map((asset) => [asset.kind, asset]));

const makeNode = (kind: ArchitectureNodeKind, x: number, y: number): ArchitectureNode => {
  const asset = assetByKind.get(kind);
  if (!asset) {
    throw new Error(`Unknown sample node kind: ${kind}`);
  }

  return {
    id: kind,
    type: 'architectureNode',
    position: { x, y },
    data: asset,
  };
};

const makeEdge = (source: string, target: string, label: string): ArchitectureEdge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
  data: { label },
  label,
  animated: true,
  type: 'smoothstep',
  labelBgPadding: [8, 4],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
  labelStyle: { fill: '#334155', fontSize: 12, fontWeight: 600 },
  style: { stroke: '#475569', strokeWidth: 2 },
});

export const sampleGraph: GraphState = {
  nodes: [
    makeNode('react', 40, 110),
    makeNode('nginx', 320, 110),
    makeNode('docker', 600, 110),
    makeNode('spring', 880, 20),
    makeNode('aspnet', 880, 200),
    makeNode('mssql', 1160, 20),
    makeNode('mariadb', 1160, 200),
    makeNode('wsl', 600, 310),
  ],
  edges: [
    makeEdge('react', 'nginx', 'HTTPS'),
    makeEdge('nginx', 'docker', 'Proxy'),
    makeEdge('docker', 'spring', 'REST'),
    makeEdge('docker', 'aspnet', 'gRPC'),
    makeEdge('spring', 'mssql', 'JDBC'),
    makeEdge('aspnet', 'mariadb', 'SQL'),
    makeEdge('wsl', 'docker', 'Dev runtime'),
  ],
};
