import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArchitectureEdge } from './CustomEdges/ArchitectureEdge';
import { ArchitectureNodeCard } from './CustomNodes/ArchitectureNodeCard';
import { GroupNodeCard } from './CustomNodes/GroupNodeCard';
import { useGraphStore } from '../store/useGraphStore';
import type { ArchitectureNode, ArchitectureNodeData } from '../types/graph';

const nodeTypes: NodeTypes = {
  architectureNode: ArchitectureNodeCard,
  groupNode: GroupNodeCard,
};

const edgeTypes: EdgeTypes = {
  architectureEdge: ArchitectureEdge,
};

const defaultGroupSize = {
  height: 320,
  width: 520,
};

const getNodeSize = (node: ArchitectureNode) => ({
  height: Number(node.height ?? node.measured?.height ?? (node.style as CSSProperties | undefined)?.height ?? defaultGroupSize.height),
  width: Number(node.width ?? node.measured?.width ?? (node.style as CSSProperties | undefined)?.width ?? defaultGroupSize.width),
});

const getAbsolutePosition = (node: ArchitectureNode, nodes: ArchitectureNode[]): { x: number; y: number } => {
  if (!node.parentId) return node.position;
  const parent = nodes.find((item) => item.id === node.parentId);
  if (!parent) return node.position;
  const parentPosition = getAbsolutePosition(parent, nodes);
  return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y };
};

const findGroupAtPosition = (position: { x: number; y: number }, nodes: ArchitectureNode[]) =>
  nodes
    .filter((node) => node.type === 'groupNode' || node.data.isGroup)
    .find((group) => {
      const groupPosition = getAbsolutePosition(group, nodes);
      const size = getNodeSize(group);
      return (
        position.x >= groupPosition.x &&
        position.x <= groupPosition.x + size.width &&
        position.y >= groupPosition.y &&
        position.y <= groupPosition.y + size.height
      );
    });

export function ArchitectureCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const addNode = useGraphStore((state) => state.addNode);
  const assignNodeToGroup = useGraphStore((state) => state.assignNodeToGroup);
  const onNodesChange = useGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange);
  const onConnect = useGraphStore((state) => state.onConnect);
  const selectNode = useGraphStore((state) => state.selectNode);
  const selectEdge = useGraphStore((state) => state.selectEdge);
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const rawAsset = event.dataTransfer.getData('application/reactflow');
      if (!rawAsset) return;

      const asset = JSON.parse(rawAsset) as ArchitectureNodeData;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const isGroup = asset.isGroup || asset.kind === 'group';
      const parentGroup = isGroup ? undefined : findGroupAtPosition(position, nodes);
      const parentPosition = parentGroup ? getAbsolutePosition(parentGroup, nodes) : undefined;
      const node: ArchitectureNode = {
        id: `${asset.kind}-${crypto.randomUUID().slice(0, 8)}`,
        type: isGroup ? 'groupNode' : 'architectureNode',
        position: parentPosition ? { x: position.x - parentPosition.x, y: position.y - parentPosition.y } : position,
        data: asset,
        zIndex: isGroup ? 0 : 1,
        ...(isGroup ? { style: defaultGroupSize } : {}),
        ...(parentGroup ? { parentId: parentGroup.id } : {}),
      };

      addNode(node);
    },
    [addNode, nodes, screenToFlowPosition],
  );

  return (
    <div className="min-h-0 flex-1">
      <ReactFlow
        className="architecture-flow"
        colorMode="light"
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Backspace', 'Delete']}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_, node) => assignNodeToGroup(node.id)}
        onNodesChange={onNodesChange}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
          const selectedNodeId = selectedNodes[0]?.id ?? null;
          selectNode(selectedNodeId);
          selectEdge(selectedNodeId ? null : (selectedEdges[0]?.id ?? null));
        }}
      >
        <Background color="#cbd5e1" gap={22} size={1.4} variant={BackgroundVariant.Dots} />
        <Controls position="bottom-right" />
        <MiniMap
          className="!bg-white !shadow-md"
          maskColor="rgba(15, 23, 42, 0.08)"
          nodeColor={(node) => String((node.data as ArchitectureNodeData).accent ?? '#64748b')}
          pannable
          position="bottom-left"
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
