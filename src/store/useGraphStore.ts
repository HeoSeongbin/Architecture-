import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import type { ArchitectureEdge, ArchitectureNode, GraphState } from '../types/graph';
import { getEdgeVisuals } from '../utils/edgeUtils';

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
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  autoLayout: () => void;
  undo: () => void;
  redo: () => void;
  onNodesChange: (changes: NodeChange<ArchitectureNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ArchitectureEdge>[]) => void;
  onConnect: (connection: Connection) => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  setGraph: (graph) =>
    set({
      nodes: graph.nodes,
      edges: graph.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    }),
  replaceGraph: (graph) =>
    set((state) => {
      const pastState = pushHistory(state);
      return {
        ...pastState,
        nodes: graph.nodes,
        edges: graph.edges,
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
      return {
        ...pastState,
        nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node)),
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
  updateEdgeData: (edgeId, data) =>
    set((state) => {
      if (!state.edges.some((edge) => edge.id === edgeId)) return state;

      const pastState = pushHistory(state);
      return {
        ...pastState,
        edges: state.edges.map((edge) => {
          if (edge.id !== edgeId) return edge;

          const nextData = { ...edge.data, ...data };
          return {
            ...edge,
            data: nextData,
            label: nextData.label,
            ...getEdgeVisuals(nextData),
          };
        }),
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
  autoLayout: () =>
    set((state) => {
      if (state.nodes.length === 0) return state;

      const pastState = pushHistory(state);
      const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
      const outgoing = new Map<string, string[]>();

      state.edges.forEach((edge) => {
        incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
        outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
      });

      const depth = new Map<string, number>();
      const queue = state.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);

      state.nodes.forEach((node) => {
        if (!queue.includes(node.id)) depth.set(node.id, 0);
      });

      queue.forEach((nodeId) => depth.set(nodeId, 0));

      for (let index = 0; index < queue.length; index += 1) {
        const nodeId = queue[index];
        const nextDepth = (depth.get(nodeId) ?? 0) + 1;

        // Prevent infinite loops in circular graphs by capping depth
        if (nextDepth > state.nodes.length) continue;

        (outgoing.get(nodeId) ?? []).forEach((targetId) => {
          if ((depth.get(targetId) ?? -1) < nextDepth) {
            depth.set(targetId, nextDepth);
            queue.push(targetId);
          }
        });
      }

      const columns = new Map<number, ArchitectureNode[]>();
      state.nodes.forEach((node) => {
        const column = depth.get(node.id) ?? 0;
        columns.set(column, [...(columns.get(column) ?? []), node]);
      });

      const nodes = state.nodes.map((node) => {
        const column = depth.get(node.id) ?? 0;
        const columnNodes = columns.get(column) ?? [];
        const row = columnNodes.findIndex((item) => item.id === node.id);

        return {
          ...node,
          position: { x: 80 + column * 280, y: 70 + row * 150 },
          selected: false,
        };
      });

      return {
        ...pastState,
        nodes,
        selectedNodeId: null,
        selectedEdgeId: null,
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
      return {
        ...pastState,
        edges: applyEdgeChanges(changes, state.edges),
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
      return {
        ...pastState,
        edges: addEdge(
          {
            ...connection,
            id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID().slice(0, 8)}`,
            data: { direction: 'forward', label: '' },
            ...getEdgeVisuals({ direction: 'forward', label: '' }),
          },
          state.edges,
        ),
        selectedNodeId: null,
        canUndo: pastState.past.length > 0,
        canRedo: false,
      };
    }),
}));
