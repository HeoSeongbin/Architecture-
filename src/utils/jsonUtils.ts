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

  const width = isRecord(value.style) && typeof value.style.width === 'number' ? value.style.width : undefined;
  const height = isRecord(value.style) && typeof value.style.height === 'number' ? value.style.height : undefined;
  const type = value.type === 'groupNode' || data.kind === 'group' || data.isGroup === true ? 'groupNode' : 'architectureNode';

  return {
    id: value.id,
    type,
    position: { x: position.x, y: position.y },
    data: {
      kind: data.kind as ArchitectureNode['data']['kind'],
      label: data.label,
      subtitle: data.subtitle,
      category: data.category as ArchitectureNode['data']['category'],
      accent: data.accent,
      ...(data.isGroup === true ? { isGroup: true } : {}),
      ...(typeof data.note === 'string' ? { note: data.note } : {}),
    },
    ...(typeof value.parentId === 'string' ? { parentId: value.parentId } : {}),
    ...(value.extent === 'parent' ? { extent: 'parent' as const } : {}),
    ...(width || height ? { style: { width: width ?? 520, height: height ?? 320 } } : {}),
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
    rawLabelMode === 'hidden' || rawLabelMode === 'compact' || rawLabelMode === 'full' || rawLabelMode === 'protocol'
      ? rawLabelMode
      : showEndpoints
        ? 'compact'
        : 'protocol';
  const data: ArchitectureEdge['data'] = { direction, label, labelMode, showEndpoints: labelMode !== 'protocol' };
  if (isRecord(value.data) && value.data.handleMode === 'manual') data.handleMode = 'manual';
  if (isRecord(value.data) && typeof value.data.manualLabelOffsetX === 'number') data.manualLabelOffsetX = value.data.manualLabelOffsetX;
  if (isRecord(value.data) && typeof value.data.manualLabelOffsetY === 'number') data.manualLabelOffsetY = value.data.manualLabelOffsetY;

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    data,
    label,
    ...(typeof value.sourceHandle === 'string' ? { sourceHandle: value.sourceHandle } : {}),
    ...(typeof value.targetHandle === 'string' ? { targetHandle: value.targetHandle } : {}),
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
  nodes: graph.nodes.map((node) => {
    const styleWidth = typeof node.style?.width === 'number' ? node.style.width : node.width;
    const styleHeight = typeof node.style?.height === 'number' ? node.style.height : node.height;

    return {
      id: node.id,
      type: node.type ?? 'architectureNode',
      position: node.position,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      ...(node.extent === 'parent' ? { extent: node.extent } : {}),
      ...(node.style || styleWidth || styleHeight
        ? { style: { ...node.style, width: styleWidth ?? node.style?.width, height: styleHeight ?? node.style?.height } }
        : {}),
      data: node.data,
    };
  }),
  edges: graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: {
      direction: edge.data?.direction ?? 'forward',
      handleMode: edge.data?.handleMode ?? 'auto',
      label: edge.data?.label,
      labelMode: edge.data?.labelMode ?? (edge.data?.showEndpoints ? 'compact' : 'protocol'),
      manualLabelOffsetX: edge.data?.manualLabelOffsetX ?? 0,
      manualLabelOffsetY: edge.data?.manualLabelOffsetY ?? 0,
      showEndpoints: edge.data?.showEndpoints ?? edge.data?.labelMode !== 'protocol',
    },
    label: edge.data?.label,
  })),
});
