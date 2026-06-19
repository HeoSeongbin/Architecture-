import type { ArchitectureEdge, ArchitectureNode, GraphState } from '../types/graph';
import { presentGraph } from './edgeUtils';

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
  const rawDirection = isRecord(value.data) && typeof value.data.direction === 'string' ? value.data.direction : undefined;
  const direction =
    rawDirection === 'reverse' || rawDirection === 'bidirectional' || rawDirection === 'forward' ? rawDirection : 'forward';
  const showEndpoints = isRecord(value.data) && value.data.showEndpoints === true;
  const rawLabelMode = isRecord(value.data) && typeof value.data.labelMode === 'string' ? value.data.labelMode : undefined;
  const labelMode =
    rawLabelMode === 'compact' || rawLabelMode === 'full' || rawLabelMode === 'protocol'
      ? rawLabelMode
      : showEndpoints
        ? 'compact'
        : 'protocol';
  const data: ArchitectureEdge['data'] = { direction, label, labelMode, showEndpoints: labelMode !== 'protocol' };

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    data,
    label,
  };
};

export const normalizeImportedGraph = (value: unknown): GraphState | null => {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;

  const nodes = value.nodes.map(normalizeNode).filter((node): node is ArchitectureNode => Boolean(node));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.map((edge) => normalizeEdge(edge, nodeIds)).filter((edge): edge is ArchitectureEdge => Boolean(edge));

  return presentGraph({ nodes, edges });
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
    data: {
      direction: edge.data?.direction ?? 'forward',
      label: edge.data?.label,
      labelMode: edge.data?.labelMode ?? (edge.data?.showEndpoints ? 'compact' : 'protocol'),
      showEndpoints: edge.data?.showEndpoints ?? edge.data?.labelMode !== 'protocol',
    },
    label: edge.data?.label,
  })),
});
