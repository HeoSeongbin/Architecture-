import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import type { CSSProperties } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { ArchitectureEdge, ArchitectureEdgeData, ArchitectureNode, GraphState } from '../types/graph';
import { presentGraph } from '../utils/edgeUtils';

const HISTORY_LIMIT = 80;

const cloneGraph = (graph: GraphState): GraphState => ({
  nodes: structuredClone(graph.nodes),
  edges: structuredClone(graph.edges),
});

const pushHistory = <T extends GraphStore>(state: T) => ({
  past: [...state.past.slice(-(HISTORY_LIMIT - 1)), cloneGraph({ nodes: state.nodes, edges: state.edges })],
  future: [],
});

const shouldRecordNodeChange = (change: NodeChange<ArchitectureNode>) => {
  if (change.type === 'select' || change.type === 'dimensions') return false;
  if (change.type === 'position') return change.dragging === false;
  return true;
};

const getNodeSearchText = (node: ArchitectureNode) =>
  `${node.data.kind} ${node.data.category} ${node.data.label} ${node.data.subtitle} ${node.data.note ?? ''}`.toLowerCase();

const getSemanticLayer = (node: ArchitectureNode) => {
  const text = getNodeSearchText(node);

  if (/\b(front|frontend|react|ui|browser|client)\b/.test(text)) return 0;
  if (/\b(api client|proxy|gateway|entry|nginx|load balancer|loadbalancer|firewall)\b/.test(text)) return 1;
  if (/\b(backend|api|server|docker|container|wsl|runtime)\b/.test(text)) return 2;
  if (/\b(service|controller|common|security|auth|admin|customer|project|document|role|user)\b/.test(text)) return 3;
  if (/\b(queue|event|topic|stream|notification|audit|batch|worker|scheduler)\b/.test(text)) return 4;
  if (/\b(db|database|mssql|oracle|mariadb|postgres|mongodb|redis|storage|file|table|seaweed)\b/.test(text)) return 5;
  if (/\b(aws|azure|gcp|cloud|external|third-party|third party)\b/.test(text)) return 6;

  if (node.data.category === 'Database') return 5;
  if (node.data.category === 'Cloud') return 6;
  if (node.data.category === 'Network') return 1;
  if (node.data.category === 'Server') return 2;
  return 3;
};

const getGraphDepth = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) => {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  });

  const depth = new Map<string, number>();
  const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const roots = queue.length > 0 ? queue : nodes.map((node) => node.id);

  roots.forEach((nodeId) => depth.set(nodeId, 0));

  for (let index = 0; index < roots.length; index += 1) {
    const nodeId = roots[index];
    const nextDepth = (depth.get(nodeId) ?? 0) + 1;

    if (nextDepth > nodes.length) continue;

    (outgoing.get(nodeId) ?? []).forEach((targetId) => {
      if ((depth.get(targetId) ?? -1) < nextDepth) {
        depth.set(targetId, nextDepth);
        roots.push(targetId);
      }
    });
  }

  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, getSemanticLayer(node));
  });

  return depth;
};


const clearEdgeRoutes = (edges: ArchitectureEdge[]) =>
  edges.map((edge) => ({
    ...edge,
    data: { ...edge.data, routePoints: undefined, routing: undefined },
  }));

const isGroupNode = (node: ArchitectureNode) => node.type === 'groupNode' || node.data.isGroup === true || node.data.kind === 'group';

const defaultGroupSize = {
  height: 320,
  width: 520,
};

const defaultBlockSize = {
  height: 120,
  width: 240,
};

const defaultNodeSize = {
  height: 112,
  width: 208,
};

const isBlockNode = (node: ArchitectureNode) => node.type === 'blockNode' || node.data.isBlock === true || node.data.kind === 'block';

const getDefaultSize = (node: ArchitectureNode) => {
  if (isGroupNode(node)) return defaultGroupSize;
  if (isBlockNode(node)) return defaultBlockSize;
  return defaultNodeSize;
};

const getNodeSize = (node: ArchitectureNode) => {
  const fallback = getDefaultSize(node);
  return {
    height: Number(node.height ?? node.measured?.height ?? (node.style as CSSProperties | undefined)?.height ?? fallback.height),
    width: Number(node.width ?? node.measured?.width ?? (node.style as CSSProperties | undefined)?.width ?? fallback.width),
  };
};

const getAbsolutePosition = (node: ArchitectureNode, nodes: ArchitectureNode[]): { x: number; y: number } => {
  if (!node.parentId) return node.position;
  const parent = nodes.find((item) => item.id === node.parentId);
  if (!parent) return node.position;
  const parentPosition = getAbsolutePosition(parent, nodes);
  return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y };
};
const getNodeCenter = (node: ArchitectureNode, nodes: ArchitectureNode[]) => {
  const position = getAbsolutePosition(node, nodes);
  const size = getNodeSize(node);

  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
};

const getEdgeHandles = (source?: ArchitectureNode, target?: ArchitectureNode, nodes: ArchitectureNode[] = []) => {
  if (!source || !target) return {};

  const sourceCenter = getNodeCenter(source, nodes);
  const targetCenter = getNodeCenter(target, nodes);
  const sourceSize = getNodeSize(source);
  const targetSize = getNodeSize(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const horizontalGap = Math.abs(dx) - (sourceSize.width + targetSize.width) / 2;
  const verticalGap = Math.abs(dy) - (sourceSize.height + targetSize.height) / 2;
  const useHorizontal = horizontalGap > verticalGap || (horizontalGap === verticalGap && Math.abs(dx) >= Math.abs(dy));

  if (useHorizontal) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }

  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
};

const applyDirectionalHandles = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) =>
  edges.map((edge) => {
    if (edge.data?.handleMode === 'manual' && edge.sourceHandle && edge.targetHandle) return edge;

    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);

    return {
      ...edge,
      ...getEdgeHandles(source, target, nodes),
    };
  });
const presentGraphWithDirectionalHandles = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) =>
  presentGraph({ nodes, edges: applyDirectionalHandles(nodes, edges) });

const findContainingGroup = (node: ArchitectureNode, nodes: ArchitectureNode[]) => {
  if (isGroupNode(node)) return undefined;

  const absolutePosition = getAbsolutePosition(node, nodes);
  const nodeSize = getNodeSize(node);
  const center = {
    x: absolutePosition.x + nodeSize.width / 2,
    y: absolutePosition.y + nodeSize.height / 2,
  };

  return nodes
    .filter((item) => isGroupNode(item) && item.id !== node.id)
    .sort((first, second) => {
      const firstSize = getNodeSize(first);
      const secondSize = getNodeSize(second);
      return firstSize.width * firstSize.height - secondSize.width * secondSize.height;
    })
    .find((group) => {
      const groupPosition = getAbsolutePosition(group, nodes);
      const groupSize = getNodeSize(group);

      return (
        center.x >= groupPosition.x &&
        center.x <= groupPosition.x + groupSize.width &&
        center.y >= groupPosition.y &&
        center.y <= groupPosition.y + groupSize.height
      );
    });
};

const syncNodeGroup = (nodeId: string, nodes: ArchitectureNode[]) => {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node || isGroupNode(node)) return nodes;

  const absolutePosition = getAbsolutePosition(node, nodes);
  const group = findContainingGroup(node, nodes);

  if (!group && !node.parentId) return nodes;
  if (group?.id === node.parentId) return nodes;

  return nodes.map((item) => {
    if (item.id !== nodeId) return item;

    if (!group) {
      const { parentId: _parentId, extent: _extent, ...rest } = item;
      return {
        ...rest,
        position: absolutePosition,
      };
    }

    const groupPosition = getAbsolutePosition(group, nodes);
    const { extent: _extent, ...rest } = item;

    return {
      ...rest,
      parentId: group.id,
      position: { x: absolutePosition.x - groupPosition.x, y: absolutePosition.y - groupPosition.y },
    };
  });
};

const orderNodesForGroups = (nodes: ArchitectureNode[]) => [
  ...nodes.filter(isGroupNode),
  ...nodes.filter((node) => !isGroupNode(node)),
];

const elk = new ELK();

const toElkGraph = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]): ElkNode => {
  const depth = getGraphDepth(nodes, edges);

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '130',
      'elk.spacing.nodeNode': '70',
      'elk.spacing.edgeNode': '42',
      'elk.spacing.edgeEdge': '24',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: 208,
      height: 112,
      layoutOptions: {
        'elk.layered.layering.layerChoiceConstraint': String(Math.max(depth.get(node.id) ?? 0, getSemanticLayer(node))),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };
};

const getRoutePoints = (elkEdge?: ElkExtendedEdge) => {
  const section = elkEdge?.sections?.[0];
  if (!section?.startPoint || !section.endPoint) return undefined;

  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((point) => ({ x: point.x, y: point.y }));
};

const getLayeredFallbackLayout = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) => {
  const depth = getGraphDepth(nodes, edges);
  const columns = new Map<number, ArchitectureNode[]>();

  nodes.forEach((node) => {
    const column = Math.max(depth.get(node.id) ?? 0, getSemanticLayer(node));
    columns.set(column, [...(columns.get(column) ?? []), node]);
  });

  const sortedColumns = Array.from(columns.keys()).sort((first, second) => first - second);
  const columnIndex = new Map(sortedColumns.map((column, index) => [column, index]));
  const sortedColumnNodes = new Map(
    Array.from(columns.entries()).map(([column, columnNodes]) => [
      column,
      [...columnNodes].sort((first, second) => {
        const firstLayer = getSemanticLayer(first);
        const secondLayer = getSemanticLayer(second);
        if (firstLayer !== secondLayer) return firstLayer - secondLayer;
        return first.data.label.localeCompare(second.data.label);
      }),
    ]),
  );

  return nodes.map((node) => {
    const column = Math.max(depth.get(node.id) ?? 0, getSemanticLayer(node));
    const columnNodes = sortedColumnNodes.get(column) ?? [];
    const row = columnNodes.findIndex((item) => item.id === node.id);
    const compactColumn = columnIndex.get(column) ?? column;

    return {
      ...node,
      position: { x: 80 + compactColumn * 320, y: 90 + row * 180 },
      selected: false,
    };
  });
};


type Point = { x: number; y: number };
type NodeBox = { bottom: number; left: number; right: number; top: number };

const ROUTE_MARGIN = 36;
const ROUTE_PADDING = 120;

const getNodeBox = (node: ArchitectureNode, nodes: ArchitectureNode[], margin = 0): NodeBox => {
  const position = getAbsolutePosition(node, nodes);
  const size = getNodeSize(node);

  return {
    bottom: position.y + size.height + margin,
    left: position.x - margin,
    right: position.x + size.width + margin,
    top: position.y - margin,
  };
};

const getHandlePoint = (node: ArchitectureNode, nodes: ArchitectureNode[], handle?: string | null): Point => {
  const box = getNodeBox(node, nodes);
  const side = handle ?? 'right';

  if (side === 'top') return { x: (box.left + box.right) / 2, y: box.top };
  if (side === 'bottom') return { x: (box.left + box.right) / 2, y: box.bottom };
  if (side === 'left') return { x: box.left, y: (box.top + box.bottom) / 2 };
  return { x: box.right, y: (box.top + box.bottom) / 2 };
};

const uniqueSortedNumbers = (values: number[]) =>
  Array.from(new Set(values.map((value) => Math.round(value)))).sort((first, second) => first - second);

const pointInsideBox = (point: Point, box: NodeBox) =>
  point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom;

const segmentIntersectsBox = (start: Point, end: Point, box: NodeBox) => {
  if (pointInsideBox(start, box) || pointInsideBox(end, box)) return true;

  if (start.x === end.x) {
    const x = start.x;
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return x > box.left && x < box.right && Math.max(minY, box.top) < Math.min(maxY, box.bottom);
  }

  if (start.y === end.y) {
    const y = start.y;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return y > box.top && y < box.bottom && Math.max(minX, box.left) < Math.min(maxX, box.right);
  }

  return true;
};

const isSegmentClear = (start: Point, end: Point, boxes: NodeBox[]) =>
  boxes.every((box) => !segmentIntersectsBox(start, end, box));

const simplifyRoute = (points: Point[]) =>
  points.reduce<Point[]>((result, point) => {
    const previous = result.at(-1);
    if (previous && previous.x === point.x && previous.y === point.y) return result;

    const beforePrevious = result.at(-2);
    if (
      previous &&
      beforePrevious &&
      ((beforePrevious.x === previous.x && previous.x === point.x) ||
        (beforePrevious.y === previous.y && previous.y === point.y))
    ) {
      return [...result.slice(0, -1), point];
    }

    return [...result, point];
  }, []);

const getFallbackRoute = (start: Point, end: Point, lane: number) => {
  const laneOffset = lane * 18;

  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const midX = (start.x + end.x) / 2 + laneOffset;
    return simplifyRoute([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
  }

  const midY = (start.y + end.y) / 2 + laneOffset;
  return simplifyRoute([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
};

const findOrthogonalRoute = (start: Point, end: Point, boxes: NodeBox[], lane: number) => {
  const minX = Math.min(start.x, end.x, ...boxes.map((box) => box.left)) - ROUTE_PADDING;
  const maxX = Math.max(start.x, end.x, ...boxes.map((box) => box.right)) + ROUTE_PADDING;
  const minY = Math.min(start.y, end.y, ...boxes.map((box) => box.top)) - ROUTE_PADDING;
  const maxY = Math.max(start.y, end.y, ...boxes.map((box) => box.bottom)) + ROUTE_PADDING;
  const laneOffset = lane * 12;
  const xLines = uniqueSortedNumbers([
    minX,
    maxX,
    start.x,
    end.x,
    (start.x + end.x) / 2 + laneOffset,
    ...boxes.flatMap((box) => [box.left, box.right]),
  ]);
  const yLines = uniqueSortedNumbers([
    minY,
    maxY,
    start.y,
    end.y,
    (start.y + end.y) / 2 + laneOffset,
    ...boxes.flatMap((box) => [box.top, box.bottom]),
  ]);
  const startKey = `${xLines.indexOf(Math.round(start.x))},${yLines.indexOf(Math.round(start.y))}`;
  const endKey = `${xLines.indexOf(Math.round(end.x))},${yLines.indexOf(Math.round(end.y))}`;
  const toPoint = (key: string): Point => {
    const [xIndex, yIndex] = key.split(',').map(Number);
    return { x: xLines[xIndex], y: yLines[yIndex] };
  };
  const heuristic = (key: string) => {
    const point = toPoint(key);
    return Math.abs(point.x - end.x) + Math.abs(point.y - end.y);
  };
  const open = [startKey];
  const openSet = new Set(open);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);

  while (open.length > 0) {
    open.sort((first, second) => (gScore.get(first) ?? Infinity) + heuristic(first) - ((gScore.get(second) ?? Infinity) + heuristic(second)));
    const current = open.shift()!;
    openSet.delete(current);

    if (current === endKey) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.unshift(cursor);
      }
      return simplifyRoute(path.map(toPoint));
    }

    const [xIndex, yIndex] = current.split(',').map(Number);
    const neighborIndexes = [
      [xIndex - 1, yIndex],
      [xIndex + 1, yIndex],
      [xIndex, yIndex - 1],
      [xIndex, yIndex + 1],
    ].filter(([nextX, nextY]) => nextX >= 0 && nextX < xLines.length && nextY >= 0 && nextY < yLines.length);

    neighborIndexes.forEach(([nextX, nextY]) => {
      const neighbor = `${nextX},${nextY}`;
      const currentPoint = toPoint(current);
      const neighborPoint = toPoint(neighbor);
      if (!isSegmentClear(currentPoint, neighborPoint, boxes)) return;

      const tentativeScore = (gScore.get(current) ?? Infinity) + Math.abs(currentPoint.x - neighborPoint.x) + Math.abs(currentPoint.y - neighborPoint.y);
      if (tentativeScore >= (gScore.get(neighbor) ?? Infinity)) return;

      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentativeScore);
      if (!openSet.has(neighbor)) {
        open.push(neighbor);
        openSet.add(neighbor);
      }
    });
  }

  return getFallbackRoute(start, end, lane);
};

const getAvoidanceRoutePoints = (edge: ArchitectureEdge, nodes: ArchitectureNode[], lane: number, forceRoute = false) => {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  if (!source || !target) return undefined;

  const start = getHandlePoint(source, nodes, edge.sourceHandle);
  const end = getHandlePoint(target, nodes, edge.targetHandle);
  const boxes = nodes
    .filter((node) => node.id !== source.id && node.id !== target.id && !isGroupNode(node))
    .map((node) => getNodeBox(node, nodes, ROUTE_MARGIN));

  if (isSegmentClear(start, end, boxes)) return forceRoute ? getFallbackRoute(start, end, lane) : undefined;

  return findOrthogonalRoute(start, end, boxes, lane);
};

const getRouteLaneIndexes = (edges: ArchitectureEdge[]) => {
  const groups = new Map<string, ArchitectureEdge[]>();

  edges.forEach((edge) => {
    const key = `${edge.source}:${edge.sourceHandle ?? 'right'}->${edge.target}:${edge.targetHandle ?? 'left'}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  });

  const lanes = new Map<string, number>();
  groups.forEach((group) => {
    const sorted = [...group].sort((first, second) => first.id.localeCompare(second.id));
    const center = (sorted.length - 1) / 2;
    sorted.forEach((edge, index) => lanes.set(edge.id, index - center));
  });

  return lanes;
};
const routeEdgesAroundNodes = (nodes: ArchitectureNode[], edges: ArchitectureEdge[], edgeIds?: Set<string>) => {
  const edgesWithHandles = applyDirectionalHandles(nodes, edges);
  const lanes = getRouteLaneIndexes(edgesWithHandles);

  return edgesWithHandles.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      routePoints: !edgeIds || edgeIds.has(edge.id) ? getAvoidanceRoutePoints(edge, nodes, lanes.get(edge.id) ?? 0, true) : undefined,
      routing: !edgeIds || edgeIds.has(edge.id) ? ('avoid' as const) : undefined,
    },
  }));
};
const refreshAvoidanceRoutes = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]) => {
  const edgesWithHandles = applyDirectionalHandles(nodes, edges);
  const lanes = getRouteLaneIndexes(edgesWithHandles);

  return edgesWithHandles.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      routePoints: edge.data?.routing === 'avoid' ? getAvoidanceRoutePoints(edge, nodes, lanes.get(edge.id) ?? 0, true) : undefined,
    },
  }));
};
interface GraphStore extends GraphState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  past: GraphState[];
  future: GraphState[];
  canUndo: boolean;
  canRedo: boolean;
  setGraph: (graph: GraphState) => void;
  replaceGraph: (graph: GraphState) => void;
  addNode: (node: ArchitectureNode) => void;
  assignNodeToGroup: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<ArchitectureNode['data']>) => void;
  updateEdgeData: (edgeId: string, data: Partial<ArchitectureEdge['data']>) => void;
  updateEdgeConnection: (
    edgeId: string,
    connection: Partial<Pick<ArchitectureEdge, 'sourceHandle' | 'targetHandle'>> & { handleMode?: ArchitectureEdgeData['handleMode'] },
  ) => void;
  setAllEdgeLabelModes: (labelMode: NonNullable<ArchitectureEdgeData['labelMode']>) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  autoLayout: () => Promise<void>;
  rerouteEdges: (edgeIds?: string[]) => void;
  undo: () => void;
  redo: () => void;
  onNodesChange: (changes: NodeChange<ArchitectureNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ArchitectureEdge>[]) => void;
  onConnect: (connection: Connection) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  setGraph: (graph) => {
    const presentedGraph = presentGraphWithDirectionalHandles(graph.nodes, graph.edges);

    return set({
      nodes: orderNodesForGroups(presentedGraph.nodes),
      edges: presentedGraph.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },
  replaceGraph: (graph) =>
    set((state) => {
      const pastState = pushHistory(state);
      const presentedGraph = presentGraphWithDirectionalHandles(graph.nodes, graph.edges);

      return {
        ...pastState,
        nodes: orderNodesForGroups(presentedGraph.nodes),
        edges: presentedGraph.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  addNode: (node) =>
    set((state) => {
      const pastState = pushHistory(state);
      return {
        ...pastState,
        nodes: orderNodesForGroups([...state.nodes, node]),
        selectedNodeId: node.id,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  assignNodeToGroup: (nodeId) =>
    set((state) => {
      const syncedNodes = syncNodeGroup(nodeId, state.nodes);
      if (syncedNodes === state.nodes) return state;
      const nodes = orderNodesForGroups(syncedNodes);

      const pastState = pushHistory(state);

      return {
        ...pastState,
        nodes,
        edges: presentGraph({ nodes, edges: refreshAvoidanceRoutes(nodes, state.edges) }).edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  selectNode: (nodeId) => set((state) => ({ selectedNodeId: nodeId, selectedEdgeId: nodeId ? null : state.selectedEdgeId })),
  selectEdge: (edgeId) => set((state) => ({ selectedEdgeId: edgeId, selectedNodeId: edgeId ? null : state.selectedNodeId })),
  updateNodeData: (nodeId, data) =>
    set((state) => {
      if (!state.nodes.some((node) => node.id === nodeId)) return state;

      const pastState = pushHistory(state);
      const nodes = state.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node));

      return {
        ...pastState,
        nodes,
        edges: presentGraphWithDirectionalHandles(nodes, state.edges).edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  updateEdgeData: (edgeId, data) =>
    set((state) => {
      if (!state.edges.some((edge) => edge.id === edgeId)) return state;

      const pastState = pushHistory(state);
      const edges = state.edges.map((edge) => {
        if (edge.id !== edgeId) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            ...data,
            routePoints:
              data?.handleMode === 'manual' ||
              typeof data?.manualLabelOffsetX === 'number' ||
              typeof data?.manualLabelOffsetY === 'number'
                ? undefined
                : edge.data?.routePoints,
          },
        };
      });

      return {
        ...pastState,
        edges: presentGraph({ nodes: state.nodes, edges }).edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  updateEdgeConnection: (edgeId, connection) =>
    set((state) => {
      if (!state.edges.some((edge) => edge.id === edgeId)) return state;

      const pastState = pushHistory(state);
      const edges = state.edges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const { handleMode = 'manual', ...connectionHandles } = connection;
        const source = state.nodes.find((node) => node.id === edge.source);
        const target = state.nodes.find((node) => node.id === edge.target);
        const nextHandles = handleMode === 'auto' ? getEdgeHandles(source, target, state.nodes) : connectionHandles;

        return {
          ...edge,
          ...nextHandles,
          data: {
            ...edge.data,
            handleMode,
            routePoints: undefined,
          },
        };
      });

      return {
        ...pastState,
        edges: presentGraph({ nodes: state.nodes, edges }).edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  setAllEdgeLabelModes: (labelMode) =>
    set((state) => {
      const pastState = pushHistory(state);
      const edges = state.edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          labelMode,
          showEndpoints: labelMode === 'compact' || labelMode === 'full',
        },
      }));

      return {
        ...pastState,
        edges: presentGraph({ nodes: state.nodes, edges }).edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  duplicateNode: (nodeId) =>
    set((state) => {
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node) return state;

      const pastState = pushHistory(state);
      const duplicate: ArchitectureNode = {
        ...node,
        id: `${node.data.kind}-${crypto.randomUUID().slice(0, 8)}`,
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        selected: true,
      };

      return {
        ...pastState,
        nodes: orderNodesForGroups([...state.nodes.map((item) => ({ ...item, selected: false })), duplicate]),
        selectedNodeId: duplicate.id,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  deleteNode: (nodeId) =>
    set((state) => {
      const nodeToDelete = state.nodes.find((node) => node.id === nodeId);
      if (!nodeToDelete) return state;

      const pastState = pushHistory(state);
      const nodes = orderNodesForGroups(state.nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => {
          if (node.parentId !== nodeId) return node;

          const absolutePosition = getAbsolutePosition(node, state.nodes);
          const { parentId: _parentId, extent: _extent, ...rest } = node;
          return {
            ...rest,
            position: absolutePosition,
          };
        }));

      return {
        ...pastState,
        nodes,
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId:
          state.edges.some((edge) => edge.id === state.selectedEdgeId && (edge.source === nodeId || edge.target === nodeId))
            ? null
            : state.selectedEdgeId,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  deleteEdge: (edgeId) =>
    set((state) => {
      if (!state.edges.some((edge) => edge.id === edgeId)) return state;

      const pastState = pushHistory(state);
      return {
        ...pastState,
        edges: state.edges.filter((edge) => edge.id !== edgeId),
        selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  autoLayout: async () => {
    const state = get();
    if (state.nodes.length === 0) return;

    const pastState = pushHistory(state);
    const layoutNodes = state.nodes.filter((node) => !isGroupNode(node) && !node.parentId);
    const layoutNodeIds = new Set(layoutNodes.map((node) => node.id));
    const layoutEdges = state.edges.filter((edge) => layoutNodeIds.has(edge.source) && layoutNodeIds.has(edge.target));

    try {
      const layout = await elk.layout(toElkGraph(layoutNodes, layoutEdges));
      const nodes = state.nodes.map((node) => {
        const elkNode = layout.children?.find((item) => item.id === node.id);
        if (!elkNode) return { ...node, selected: false };

        return {
          ...node,
          position: { x: 80 + (elkNode?.x ?? node.position.x), y: 80 + (elkNode?.y ?? node.position.y) },
          selected: false,
        };
      });
      const edgesWithHandles = applyDirectionalHandles(nodes, state.edges);
      const edges = edgesWithHandles.map((edge) => {
        const elkEdge = layout.edges?.find((item) => item.id === edge.id) as ElkExtendedEdge | undefined;
        const routePoints = edge.data?.handleMode === 'manual' ? undefined : getRoutePoints(elkEdge);

        return {
          ...edge,
          data: {
            ...edge.data,
            routePoints: routePoints?.map((point) => ({ x: 80 + point.x, y: 80 + point.y })),
          },
        };
      });
      const graph = presentGraph({ nodes, edges });

      set({
        ...pastState,
        nodes: graph.nodes,
        edges: graph.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      });
    } catch {
      const latestState = get();
      const latestLayoutNodes = latestState.nodes.filter((node) => !isGroupNode(node) && !node.parentId);
      const latestLayoutNodeIds = new Set(latestLayoutNodes.map((node) => node.id));
      const latestLayoutEdges = latestState.edges.filter((edge) => latestLayoutNodeIds.has(edge.source) && latestLayoutNodeIds.has(edge.target));
      const layoutNodeMap = new Map(
        getLayeredFallbackLayout(latestLayoutNodes, latestLayoutEdges).map((node) => [node.id, node]),
      );
      const nodes = latestState.nodes.map((node) => layoutNodeMap.get(node.id) ?? { ...node, selected: false });
      const edges = applyDirectionalHandles(nodes, clearEdgeRoutes(latestState.edges));
      const graph = presentGraph({ nodes, edges });

      set({
        ...pastState,
        nodes: graph.nodes,
        edges: graph.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      });
    }
  },
  rerouteEdges: (edgeIds) =>
    set((state) => {
      if (state.edges.length === 0) return state;

      const pastState = pushHistory(state);
      const routeIds = edgeIds ? new Set(edgeIds) : undefined;
      const edges = routeEdgesAroundNodes(state.nodes, state.edges, routeIds);
      const graph = presentGraph({ nodes: state.nodes, edges });

      return {
        ...pastState,
        edges: graph.edges,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;

      const past = state.past.slice(0, -1);
      const future = [cloneGraph({ nodes: state.nodes, edges: state.edges }), ...state.future].slice(0, HISTORY_LIMIT);
      return {
        nodes: previous.nodes,
        edges: previous.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        past,
        future,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;

      const past = [...state.past.slice(-(HISTORY_LIMIT - 1)), cloneGraph({ nodes: state.nodes, edges: state.edges })];
      const future = state.future.slice(1);
      return {
        nodes: next.nodes,
        edges: next.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        past,
        future,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      };
    }),
  onNodesChange: (changes) =>
    set((state) => {
      const hasGraphChange = changes.some(shouldRecordNodeChange);
      const nodes = orderNodesForGroups(applyNodeChanges(changes, state.nodes));
      const selectedNodeId = changes.some((change) => change.type === 'remove' && change.id === state.selectedNodeId)
        ? null
        : state.selectedNodeId;
      const selectedEdgeId = changes.some(
        (change) =>
          change.type === 'remove' &&
          state.edges.some((edge) => edge.id === state.selectedEdgeId && (edge.source === change.id || edge.target === change.id)),
      )
        ? null
        : state.selectedEdgeId;
      const pastState = hasGraphChange ? pushHistory(state) : { past: state.past, future: state.future };

      return {
        ...pastState,
        nodes,
        edges: hasGraphChange ? presentGraph({ nodes, edges: refreshAvoidanceRoutes(nodes, state.edges) }).edges : state.edges,
        selectedNodeId,
        selectedEdgeId,
        canUndo: pastState.past.length > 0,
        canRedo: pastState.future.length > 0,
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => {
      const hasGraphChange = changes.some((change) => change.type !== 'select');
      const pastState = hasGraphChange ? pushHistory(state) : { past: state.past, future: state.future };
      const edges = applyEdgeChanges(changes, state.edges);

      return {
        ...pastState,
        edges: hasGraphChange ? presentGraph({ nodes: state.nodes, edges }).edges : edges,
        selectedEdgeId: changes.some((change) => change.type === 'remove' && change.id === state.selectedEdgeId)
          ? null
          : state.selectedEdgeId,
        canUndo: pastState.past.length > 0,
        canRedo: pastState.future.length > 0,
      };
    }),
  onConnect: (connection) =>
    set((state) => {
      const pastState = pushHistory(state);
      const sourceColor = state.nodes.find((node) => node.id === connection.source)?.data.accent;
      const nextEdges = addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID().slice(0, 8)}`,
          data: { direction: 'forward', handleMode: connection.sourceHandle || connection.targetHandle ? 'manual' : 'auto', label: '' },
          style: sourceColor ? { stroke: sourceColor, strokeWidth: 2 } : undefined,
        },
        state.edges,
      );

      return {
        ...pastState,
        edges: presentGraph({ nodes: state.nodes, edges: nextEdges }).edges,
        selectedNodeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
}));

