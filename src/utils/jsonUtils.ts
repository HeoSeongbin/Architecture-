import type { ArchitectureEdge, ArchitectureNode, GraphState } from '../types/graph';

const edgeDefaults = {
  animated: true,
  type: 'smoothstep',
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
  labelStyle: { fill: '#334155', fontSize: 12, fontWeight: 600 },
  style: { stroke: '#475569', strokeWidth: 2 },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeNode = (value: unknown): ArchitectureNode | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.position) || !isRecord(value.data)) {
    return null;
  }

  const { data, position } = value;
  if (
    typeof position.x !== 'number' ||
    typeof position.y !== 'number' ||
    typeof data.kind !== 'string' ||
    typeof data.label !== 'string' ||
    typeof data.subtitle !== 'string' ||
    typeof data.category !== 'string' ||
    typeof data.accent !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    type: 'architectureNode',
    position: { x: position.x, y: position.y },
    data: {
      kind: data.kind as ArchitectureNode['data']['kind'],
      label: data.label,
      subtitle: data.subtitle,
      category: data.category as ArchitectureNode['data']['category'],
      accent: data.accent,
      ...(typeof data.note === 'string' ? { note: data.note } : {}),
    },
  };
};

const normalizeEdge = (value: unknown, nodeIds: Set<string>): ArchitectureEdge | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.source !== 'string' || typeof value.target !== 'string') {
    return null;
  }

  if (!nodeIds.has(value.source) || !nodeIds.has(value.target)) return null;

  const label = isRecord(value.data) && typeof value.data.label === 'string' ? value.data.label : undefined;

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    data: { label },
    label,
    ...edgeDefaults,
  };
};

export const normalizeImportedGraph = (value: unknown): GraphState | null => {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;

  const nodes = value.nodes.map(normalizeNode).filter((node): node is ArchitectureNode => Boolean(node));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.map((edge) => normalizeEdge(edge, nodeIds)).filter((edge): edge is ArchitectureEdge => Boolean(edge));

  return { nodes, edges };
};

export const toExportableGraph = (graph: GraphState): GraphState => ({
  nodes: graph.nodes.map((node) => ({
    id: node.id,
    type: 'architectureNode',
    position: node.position,
    data: node.data,
  })),
  edges: graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { label: edge.data?.label },
    label: edge.data?.label,
    ...edgeDefaults,
  })),
});
