import { MarkerType } from '@xyflow/react';
import type { ArchitectureEdge, ArchitectureEdgeData, ArchitectureNode, GraphState } from '../types/graph';

const DEFAULT_EDGE_COLOR = '#475569';

export const edgeDefaults = {
  animated: true,
  type: 'architectureEdge' as const,
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
  labelStyle: { fill: '#334155', fontSize: 12, fontWeight: 600 },
  style: { stroke: DEFAULT_EDGE_COLOR, strokeWidth: 2 },
};

const getArrowMarker = (color: string) => ({
  type: MarkerType.ArrowClosed,
  width: 12,
  height: 12,
  color,
});

export const getEdgeDirection = (data?: ArchitectureEdgeData) => data?.direction ?? 'forward';
export const getEdgeLabelMode = (data?: ArchitectureEdgeData) =>
  data?.labelMode ?? (data?.showEndpoints ? 'compact' : 'protocol');

const getNodeLabel = (node?: ArchitectureNode) => node?.data.label ?? node?.id ?? 'Unknown';
const getNodeFullLabel = (node?: ArchitectureNode) => {
  if (!node) return 'Unknown';
  return node.data.subtitle ? `${node.data.label} (${node.data.subtitle})` : node.data.label;
};

const getSourceColor = (edge: ArchitectureEdge, nodes: ArchitectureNode[]) =>
  nodes.find((node) => node.id === edge.source)?.data.accent ?? DEFAULT_EDGE_COLOR;

const getDisplayedLabel = (edge: ArchitectureEdge, nodes: ArchitectureNode[]) => {
  const label = edge.data?.label?.trim() ?? '';
  const labelMode = getEdgeLabelMode(edge.data);
  if (labelMode === 'protocol') return label;

  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  const source = labelMode === 'full' ? getNodeFullLabel(sourceNode) : getNodeLabel(sourceNode);
  const target = labelMode === 'full' ? getNodeFullLabel(targetNode) : getNodeLabel(targetNode);
  const direction = getEdgeDirection(edge.data);
  const endpoints =
    direction === 'reverse' ? `${target} -> ${source}` : direction === 'bidirectional' ? `${source} <-> ${target}` : `${source} -> ${target}`;

  return label ? `${endpoints} / ${label}` : endpoints;
};

type EdgePresentation = Partial<ArchitectureEdge> & {
  pathOptions?: { offset: number };
};

export const getEdgeVisuals = (
  data?: ArchitectureEdgeData,
  color = DEFAULT_EDGE_COLOR,
  routeOffset?: number,
): EdgePresentation => {
  const direction = getEdgeDirection(data);
  const arrowMarker = getArrowMarker(color);

  return {
    ...edgeDefaults,
    pathOptions: routeOffset ? { offset: routeOffset } : undefined,
    style: { stroke: color, strokeWidth: 2 },
    markerStart: direction === 'reverse' || direction === 'bidirectional' ? arrowMarker : undefined,
    markerEnd: direction === 'forward' || direction === 'bidirectional' ? arrowMarker : undefined,
  };
};

const getSharedNodeKey = (edge: ArchitectureEdge) => edge.target || edge.source;

const getRouteOffsets = (edges: ArchitectureEdge[]) => {
  const groups = new Map<string, ArchitectureEdge[]>();

  edges.forEach((edge) => {
    const key = getSharedNodeKey(edge);
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  });

  const offsets = new Map<string, number>();
  groups.forEach((group) => {
    const sorted = [...group].sort((first, second) => first.id.localeCompare(second.id));
    const center = (sorted.length - 1) / 2;

    sorted.forEach((edge, index) => {
      offsets.set(edge.id, 18 + Math.abs(index - center) * 10);
    });
  });

  return offsets;
};

const getLabelOffsets = (edges: ArchitectureEdge[]) => {
  const groups = new Map<string, ArchitectureEdge[]>();

  edges.forEach((edge) => {
    const key = `${edge.source}->${edge.target}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  });

  edges.forEach((edge) => {
    const targetKey = `target:${edge.target}`;
    groups.set(targetKey, [...(groups.get(targetKey) ?? []), edge]);

    const sourceKey = `source:${edge.source}`;
    groups.set(sourceKey, [...(groups.get(sourceKey) ?? []), edge]);
  });

  const offsets = new Map<string, { x: number; y: number }>();

  groups.forEach((group) => {
    if (group.length < 2) return;

    const sorted = [...group].sort((first, second) => first.id.localeCompare(second.id));
    const center = (sorted.length - 1) / 2;

    sorted.forEach((edge, index) => {
      const current = offsets.get(edge.id) ?? { x: 0, y: 0 };
      const distance = index - center;

      offsets.set(edge.id, {
        x: current.x + (Math.abs(distance) > 0.5 ? Math.sign(distance) * 12 : 0),
        y: current.y + distance * 30,
      });
    });
  });

  return offsets;
};

export const applyEdgePresentation = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) => {
  const routeOffsets = getRouteOffsets(edges);
  const labelOffsets = getLabelOffsets(edges);

  return edges.map<ArchitectureEdge>((edge) => {
    const color = getSourceColor(edge, nodes);
    const data = { direction: 'forward' as const, ...edge.data };
    const labelOffset = labelOffsets.get(edge.id) ?? { x: 0, y: 0 };

    return {
      ...edge,
      data: {
        ...data,
        labelOffsetX: labelOffset.x,
        labelOffsetY: labelOffset.y,
        renderLabel: getDisplayedLabel({ ...edge, data }, nodes),
      },
      label: undefined,
      ...getEdgeVisuals(data, color, routeOffsets.get(edge.id)),
    };
  });
};

export const presentGraph = (graph: GraphState): GraphState => ({
  nodes: graph.nodes,
  edges: applyEdgePresentation(graph.nodes, graph.edges),
});
