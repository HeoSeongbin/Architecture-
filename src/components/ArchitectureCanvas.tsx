import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  ViewportPortal,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArchitectureEdge } from './CustomEdges/ArchitectureEdge';
import { ArchitectureNodeCard } from './CustomNodes/ArchitectureNodeCard';
import { useGraphStore } from '../store/useGraphStore';
import type { ArchitectureNode, ArchitectureNodeData } from '../types/graph';

const nodeTypes: NodeTypes = {
  architectureNode: ArchitectureNodeCard,
};

const edgeTypes: EdgeTypes = {
  architectureEdge: ArchitectureEdge,
};

const laneLabels = ['Client', 'Gateway', 'Backend', 'Services', 'Events', 'Data', 'Cloud'];

const getLaneIndex = (node: ArchitectureNode) => {
  const text = `${node.data.kind} ${node.data.category} ${node.data.label} ${node.data.subtitle} ${node.data.note ?? ''}`.toLowerCase();

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

export function ArchitectureCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const addNode = useGraphStore((state) => state.addNode);
  const onNodesChange = useGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange);
  const onConnect = useGraphStore((state) => state.onConnect);
  const selectNode = useGraphStore((state) => state.selectNode);
  const selectEdge = useGraphStore((state) => state.selectEdge);
  const lanes = useMemo(() => {
    const grouped = new Map<number, ArchitectureNode[]>();

    nodes.forEach((node) => {
      const lane = getLaneIndex(node);
      grouped.set(lane, [...(grouped.get(lane) ?? []), node]);
    });

    return Array.from(grouped.entries()).map(([lane, laneNodes]) => {
      const minX = Math.min(...laneNodes.map((node) => node.position.x));
      const maxX = Math.max(...laneNodes.map((node) => node.position.x));
      const minY = Math.min(...laneNodes.map((node) => node.position.y));
      const maxY = Math.max(...laneNodes.map((node) => node.position.y));

      return {
        height: Math.max(220, maxY - minY + 220),
        label: laneLabels[lane] ?? 'Layer',
        width: Math.max(280, maxX - minX + 280),
        x: minX - 40,
        y: minY - 70,
      };
    });
  }, [nodes]);

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
      const node: ArchitectureNode = {
        id: `${asset.kind}-${crypto.randomUUID().slice(0, 8)}`,
        type: 'architectureNode',
        position,
        data: asset,
      };

      addNode(node);
    },
    [addNode, screenToFlowPosition],
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
        onNodesChange={onNodesChange}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
          const selectedNodeId = selectedNodes[0]?.id ?? null;
          selectNode(selectedNodeId);
          selectEdge(selectedNodeId ? null : (selectedEdges[0]?.id ?? null));
        }}
      >
        <ViewportPortal>
          {lanes.map((lane) => (
            <div
              className="architecture-lane"
              key={`${lane.label}-${lane.x}-${lane.y}`}
              style={{ height: lane.height, transform: `translate(${lane.x}px, ${lane.y}px)`, width: lane.width }}
            >
              <div className="architecture-lane-label">{lane.label}</div>
            </div>
          ))}
        </ViewportPortal>
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
