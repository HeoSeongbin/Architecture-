import { MarkerType } from '@xyflow/react';
import type { ArchitectureEdge, ArchitectureEdgeData, ArchitectureNode, GraphState } from '../types/graph';

const DEFAULT_EDGE_COLOR = '#475569';

export const edgeDefaults = {
  animated: true,
  type: 'smoothstep',
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

const getNodeLabel = (node?: ArchitectureNode) => node?.data.label ?? node?.id ?? 'Unknown';

const getSourceColor = (edge: ArchitectureEdge, nodes: ArchitectureNode[]) =>
  nodes.find((node) => node.id === edge.source)?.data.accent ?? DEFAULT_EDGE_COLOR;

const getDisplayedLabel = (edge: ArchitectureEdge, nodes: ArchitectureNode[]) => {
  const label = edge.data?.label?.trim() ?? '';
  if (!edge.data?.showEndpoints) return label;

  const source = getNodeLabel(nodes.find((node) => node.id === edge.source));
  const target = getNodeLabel(nodes.find((node) => node.id === edge.target));
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

export const applyEdgePresentation = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) => {
  const routeOffsets = getRouteOffsets(edges);

  return edges.map<ArchitectureEdge>((edge) => {
    const color = getSourceColor(edge, nodes);
    const data = { direction: 'forward' as const, ...edge.data };

    return {
      ...edge,
      data,
      label: getDisplayedLabel({ ...edge, data }, nodes),
      ...getEdgeVisuals(data, color, routeOffsets.get(edge.id)),
    };
  });
};

export const presentGraph = (graph: GraphState): GraphState => ({
  nodes: graph.nodes,
  edges: applyEdgePresentation(graph.nodes, graph.edges),
});
