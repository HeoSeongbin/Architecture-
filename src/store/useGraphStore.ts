import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { layoutGraph, type LayoutOptions } from '../utils/layoutGraph';
import { layoutEngine, LayoutCancelledError } from '../utils/layoutEngine';
import type { ArchitectureEdge, ArchitectureEdgeData, ArchitectureNode, GraphState } from '../types/graph';
import { presentGraph } from '../utils/edgeUtils';
import { toExportableGraph } from '../utils/jsonUtils';
import {
  absolutePosition,
  nodeSize,
  isGroup,
  orderParentsFirst,
  reparentNodes,
  removeElements,
  copySubgraph,
  pasteSubgraph,
  alignNodes,
  groupNodes,
  nodeLimits,
  type Alignment,
} from '../utils/graphEditing';

const HISTORY_LIMIT = 80;
let pendingMove: GraphState | undefined;
let pendingResize = false;
const movedNodeIds = new Set<string>();
let pasteCount = 0;
let layoutRequest = 0;
const resetTransform = () => {
  pendingMove = undefined;
  pendingResize = false;
  movedNodeIds.clear();
};

const cloneGraph = (graph: GraphState): GraphState => ({
  nodes: structuredClone(graph.nodes),
  edges: structuredClone(graph.edges),
});

const pushHistory = <T extends GraphStore>(state: T) => ({
  past: [...state.past.slice(-(HISTORY_LIMIT - 1)), cloneGraph({ nodes: state.nodes, edges: state.edges })],
  future: [],
});

const shouldRecordNodeChange = (change: NodeChange<ArchitectureNode>) => {
  if (change.type === 'select') return false;
  if (change.type === 'dimensions') return change.resizing === false || Boolean(change.setAttributes);
  if (change.type === 'position') return change.dragging !== true && Boolean(change.position);
  return true;
};

const selectedMoveRoots = (nodes: ArchitectureNode[]) => {
  const roots: string[] = [];
  for (const node of nodes) {
    if (!movedNodeIds.has(node.id)) continue;
    let parent = node.parentId;
    const visited = new Set<string>();
    let movedAncestor = false;
    while (parent && !visited.has(parent)) {
      if (movedNodeIds.has(parent)) {
        movedAncestor = true;
        break;
      }
      visited.add(parent);
      parent = nodes.find((item) => item.id === parent)?.parentId;
    }
    if (!movedAncestor) roots.push(node.id);
  }
  return roots;
};
const graphSignature = (graph: GraphState) => JSON.stringify(toExportableGraph(graph));
const selectionIds = (state: GraphStore) =>
  new Set(state.nodes.filter((node) => node.selected || node.id === state.selectedNodeId).map((node) => node.id));
const commitGraph = (state: GraphStore, graph: GraphState, before: GraphState = state) => {
  if (graphSignature(before) === graphSignature(graph)) return state;
  const history = pushHistory({ ...state, ...before });
  const presented = presentGraph({ nodes: orderParentsFirst(graph.nodes), edges: clearEdgeRoutes(graph.edges) });
  return {
    ...presented,
    ...history,
    canUndo: true,
    canRedo: false,
    selectedNodeId: presented.nodes.find((node) => node.selected)?.id ?? null,
    selectedEdgeId: presented.edges.find((edge) => edge.selected)?.id ?? null,
  };
};

const clearEdgeRoutes = (edges: ArchitectureEdge[]) =>
  edges.some((edge) => edge.data?.routePoints !== undefined)
    ? edges.map((edge) =>
        edge.data?.routePoints === undefined
          ? edge
          : {
              ...edge,
              data: { ...edge.data, routePoints: undefined },
            },
      )
    : edges;

const getEdgeHandles = (source?: ArchitectureNode, target?: ArchitectureNode) => {
  if (!source || !target) return {};
  const nodes = useGraphStore.getState().nodes;
  const a = absolutePosition(source, nodes),
    b = absolutePosition(target, nodes);
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { sourceHandle: dx >= 0 ? 'right' : 'left', targetHandle: dx >= 0 ? 'left' : 'right' }
    : { sourceHandle: dy >= 0 ? 'bottom' : 'top', targetHandle: dy >= 0 ? 'top' : 'bottom' };
};

const isGroupNode = isGroup;
const getNodeSize = nodeSize;
const getAbsolutePosition = absolutePosition;

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

const orderNodesForGroups = orderParentsFirst;

interface GraphStore extends GraphState {
  clipboard: GraphState | null;
  selectAll: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  updateSelectedNodes: (data: Partial<ArchitectureNode['data']>) => void;
  alignSelection: (alignment: Alignment) => void;
  spaceSelection: (axis: 'horizontal' | 'vertical', gap: number) => void;
  groupSelection: () => void;
  setNodeParent: (nodeId: string, parentId?: string) => void;
  resizeNode: (nodeId: string, width: number, height: number) => void;
  beginResize: () => void;
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
  autoLayout: (options?: LayoutOptions) => Promise<'applied' | 'fallback' | 'stale' | 'cancelled' | undefined>;
  cancelAutoLayout: () => void;
  undo: () => void;
  redo: () => void;
  onNodesChange: (changes: NodeChange<ArchitectureNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ArchitectureEdge>[]) => void;
  onConnect: (connection: Connection) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  clipboard: null,
  selectAll: () =>
    set((state) => ({
      nodes: state.nodes.map((node) => ({ ...node, selected: true })),
      edges: state.edges.map((edge) => ({ ...edge, selected: true })),
      selectedNodeId: state.nodes[0]?.id ?? null,
      selectedEdgeId: null,
    })),
  copySelection: () => {
    const state = get();
    const graph = copySubgraph(state, selectionIds(state));
    if (graph.nodes.length) {
      pasteCount = 0;
      set({ clipboard: graph });
    }
  },
  pasteSelection: () =>
    set((state) => (state.clipboard ? commitGraph(state, pasteSubgraph(state, state.clipboard, 48 * ++pasteCount)) : state)),
  duplicateSelection: () =>
    set((state) => {
      const graph = copySubgraph(state, selectionIds(state));
      return graph.nodes.length ? commitGraph(state, pasteSubgraph(state, graph)) : state;
    }),
  deleteSelection: () =>
    set((state) =>
      commitGraph(
        state,
        removeElements(
          state,
          selectionIds(state),
          new Set(state.edges.filter((edge) => edge.selected || edge.id === state.selectedEdgeId).map((edge) => edge.id)),
        ),
      ),
    ),
  updateSelectedNodes: (data) =>
    set((state) => {
      const ids = selectionIds(state);
      return commitGraph(state, {
        ...state,
        nodes: state.nodes.map((node) => (ids.has(node.id) ? { ...node, data: { ...node.data, ...data } } : node)),
      });
    }),
  alignSelection: (alignment) =>
    set((state) => commitGraph(state, { ...state, nodes: alignNodes(state.nodes, selectionIds(state), alignment) })),
  spaceSelection: (axis, gap) =>
    set((state) =>
      Number.isFinite(gap) && gap >= 0 && gap <= 2000
        ? commitGraph(state, { ...state, nodes: alignNodes(state.nodes, selectionIds(state), axis, gap) })
        : state,
    ),
  groupSelection: () => set((state) => commitGraph(state, groupNodes(state, selectionIds(state)))),
  setNodeParent: (nodeId, parentId) =>
    set((state) => commitGraph(state, { ...state, nodes: reparentNodes(state.nodes, new Set([nodeId]), parentId) })),
  resizeNode: (nodeId, width, height) =>
    set((state) => {
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node || !Number.isFinite(width) || !Number.isFinite(height)) return state;
      const limits = nodeLimits(node);
      const size = {
        width: Math.round(Math.max(limits.minWidth, Math.min(limits.maxWidth, width))),
        height: Math.round(Math.max(limits.minHeight, Math.min(limits.maxHeight, height))),
      };
      return commitGraph(state, {
        ...state,
        nodes: state.nodes.map((item) => (item.id === nodeId ? { ...item, ...size, style: { ...item.style, ...size } } : item)),
      });
    }),
  beginResize: () => {
    if (!pendingMove) pendingMove = cloneGraph(get());
    pendingResize = true;
  },
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  setGraph: (graph) => {
    resetTransform();
    const presentedGraph = presentGraph(graph);

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
      resetTransform();
      const pastState = pushHistory(state);
      const presentedGraph = presentGraph(graph);

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
        nodes: orderNodesForGroups([...state.nodes.map((item) => ({ ...item, selected: false })), { ...node, selected: true }]),
        edges: state.edges.map((edge) => ({ ...edge, selected: false })),
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
        edges: presentGraph({ nodes, edges: clearEdgeRoutes(state.edges) }).edges,
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
              data?.pathStyle !== undefined ||
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
      const graph = copySubgraph(state, new Set([nodeId]));
      return graph.nodes.length ? commitGraph(state, pasteSubgraph(state, graph)) : state;
    }),
  deleteNode: (nodeId) =>
    set((state) => {
      const nodeToDelete = state.nodes.find((node) => node.id === nodeId);
      if (!nodeToDelete) return state;

      const pastState = pushHistory(state);
      const nodes = orderNodesForGroups(
        state.nodes
          .filter((node) => node.id !== nodeId)
          .map((node) => {
            if (node.parentId !== nodeId) return node;

            const absolutePosition = getAbsolutePosition(node, state.nodes);
            const { parentId: _parentId, extent: _extent, ...rest } = node;
            return {
              ...rest,
              position: absolutePosition,
            };
          }),
      );

      return {
        ...pastState,
        nodes,
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId: state.edges.some((edge) => edge.id === state.selectedEdgeId && (edge.source === nodeId || edge.target === nodeId))
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
  autoLayout: async (options) => {
    const state = get();
    if (!state.nodes.length) return;
    const request = ++layoutRequest;
    const signature = graphSignature(state);
    let result: Awaited<ReturnType<typeof layoutGraph>>;
    try {
      result = await layoutGraph(state, options);
    } catch (error) {
      if (error instanceof LayoutCancelledError) return 'cancelled';
      throw error;
    }
    if (request !== layoutRequest || get().past !== state.past || pendingMove || graphSignature(get()) !== signature) return 'stale';
    resetTransform();
    set(commitGraph(get(), result.graph));
    return result.fallback ? 'fallback' : 'applied';
  },
  cancelAutoLayout: () => {
    layoutRequest++;
    layoutEngine.cancel();
  },
  undo: () =>
    set((state) => {
      resetTransform();
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
      resetTransform();
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
      const starting = changes.some(
        (change) => (change.type === 'position' && change.dragging === true) || (change.type === 'dimensions' && change.resizing === true),
      );
      if (starting && !pendingMove) {
        resetTransform();
        pendingMove = cloneGraph(state);
      }
      if (changes.some((change) => change.type === 'dimensions' && change.resizing === true)) pendingResize = true;
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) movedNodeIds.add(change.id);
      });
      const finished = changes.some(
        (change) =>
          (change.type === 'position' && change.dragging === false) || (change.type === 'dimensions' && change.resizing === false),
      );
      const removedIds = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
      const surviving = removeElements(state, removedIds);
      let nodes = applyNodeChanges(changes, surviving.nodes);
      if (changes.some((change) => change.type === 'add' || change.type === 'replace' || change.type === 'remove'))
        nodes = orderNodesForGroups(nodes);
      // Persist explicit resize dimensions; measured-only changes never create history.
      if (changes.some((change) => change.type === 'dimensions' && change.setAttributes))
        nodes = nodes.map((node) => {
          const sizeChange = changes.find(
            (change) => change.type === 'dimensions' && change.id === node.id && change.dimensions && change.setAttributes,
          );
          return sizeChange?.type === 'dimensions' ? { ...node, style: { ...node.style, ...sizeChange.dimensions } } : node;
        });
      if (finished && !pendingResize) {
        const roots = new Set(selectedMoveRoots(nodes));
        for (const id of movedNodeIds) {
          if (roots.has(id)) nodes = syncNodeGroup(id, nodes);
        }
      }
      const graph = { nodes, edges: surviving.edges };
      if (pendingMove && !finished && !removedIds.size) return { ...graph, edges: clearEdgeRoutes(graph.edges) };
      if (changes.some(shouldRecordNodeChange) || (finished && pendingMove)) {
        const before = pendingMove ?? state;
        const result = commitGraph(state, graph, before);
        resetTransform();
        return result;
      }
      return { nodes, selectedNodeId: nodes.some((node) => node.id === state.selectedNodeId) ? state.selectedNodeId : null };
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
