import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
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

const getEdgeHandles = (source?: ArchitectureNode, target?: ArchitectureNode) => {
  if (!source || !target) return {};

  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
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
      ...getEdgeHandles(source, target),
    };
  });

const clearEdgeRoutes = (edges: ArchitectureEdge[]) =>
  edges.map((edge) => ({
    ...edge,
    data: { ...edge.data, routePoints: undefined },
  }));

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
    const presentedGraph = presentGraph(graph);

    return set({
      nodes: presentedGraph.nodes,
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
      const presentedGraph = presentGraph(graph);

      return {
        ...pastState,
        nodes: presentedGraph.nodes,
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
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        selectedEdgeId: null,
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
        edges: presentGraph({ nodes, edges: state.edges }).edges,
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
        const nextHandles = handleMode === 'auto' ? getEdgeHandles(source, target) : connectionHandles;

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
        nodes: [...state.nodes.map((item) => ({ ...item, selected: false })), duplicate],
        selectedNodeId: duplicate.id,
        selectedEdgeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  deleteNode: (nodeId) =>
    set((state) => {
      if (!state.nodes.some((node) => node.id === nodeId)) return state;

      const pastState = pushHistory(state);
      return {
        ...pastState,
        nodes: state.nodes.filter((node) => node.id !== nodeId),
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

    try {
      const layout = await elk.layout(toElkGraph(state.nodes, state.edges));
      const nodes = state.nodes.map((node) => {
        const elkNode = layout.children?.find((item) => item.id === node.id);

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
      const nodes = getLayeredFallbackLayout(latestState.nodes, latestState.edges);
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
      const nodes = applyNodeChanges(changes, state.nodes);
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
        edges: hasGraphChange ? presentGraph({ nodes, edges: clearEdgeRoutes(state.edges) }).edges : state.edges,
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
          data: { direction: 'forward', label: '' },
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
