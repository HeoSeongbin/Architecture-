import { getAsset } from '../data/assets';
import { useAssetPreferences } from '../store/useAssetPreferences';
import { useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArchitectureEdge } from './CustomEdges/ArchitectureEdge';
import { ArchitectureNodeCard } from './CustomNodes/ArchitectureNodeCard';
import { GroupNodeCard } from './CustomNodes/GroupNodeCard';
import { useGraphStore } from '../store/useGraphStore';
import type { ArchitectureEdge as ArchitectureEdgeType, ArchitectureNode, ArchitectureNodeData } from '../types/graph';
import type { EditorTheme } from '../hooks/useEditorTheme';

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

interface ArchitectureCanvasProps {
  showGrid: boolean;
  theme: EditorTheme;
}

export function ArchitectureCanvas({ showGrid, theme }: ArchitectureCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const addNode = useGraphStore((state) => state.addNode);
  const onNodesChange = useGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange);
  const onConnect = useGraphStore((state) => state.onConnect);
  const selectNode = useGraphStore((state) => state.selectNode);
  const selectEdge = useGraphStore((state) => state.selectEdge);
  const nodeCache = useRef(new WeakMap<ArchitectureNode, ArchitectureNode>());
  const accessibleNodes = useMemo(
    () =>
      nodes.map((node) => {
        const cached = nodeCache.current.get(node);
        if (cached) return cached;
        const named = { ...node, ariaLabel: `${node.data.label}, ${node.type === 'groupNode' ? '그룹' : '노드'}` };
        nodeCache.current.set(node, named);
        return named;
      }),
    [nodes],
  );
  const visibleEdges = useMemo<ArchitectureEdgeType[]>(
    () =>
      edges.map((edge) => {
        const isConnectedToSelectedNode = Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId));
        const presentedEdge = {
          ...edge,
          ariaLabel: `${edge.source}에서 ${edge.target}로 연결${edge.data?.label ? `: ${edge.data.label}` : ''}`,
          ...(edges.length > 200 && edge.animated ? { animated: false } : {}),
        };
        if (!isConnectedToSelectedNode) return presentedEdge;

        return {
          ...presentedEdge,
          style: {
            ...edge.style,
            filter: 'drop-shadow(0 0 5px rgba(15, 23, 42, 0.28))',
            strokeWidth: 4,
          },
          zIndex: 20,
        };
      }),
    [edges, selectedNodeId],
  );
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const rawAsset = event.dataTransfer.getData('application/reactflow');
      if (!rawAsset) return;

      let kind: unknown;
      try {
        const value: unknown = JSON.parse(rawAsset);
        kind = typeof value === 'object' && value !== null && 'kind' in value ? value.kind : undefined;
      } catch {
        return;
      }
      const template = getAsset(kind);
      if (!template) return;
      const asset = { ...template };
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
      useAssetPreferences.getState().recordUse(asset.kind);
    },
    [addNode, nodes, screenToFlowPosition],
  );

  return (
    <div className="min-h-0 flex-1">
      <ReactFlow
        className="architecture-flow"
        colorMode={theme}
        ariaLabelConfig={{
          'node.a11yDescription.default': 'Enter 또는 Space로 선택하고 방향키로 이동하세요. Delete로 삭제하며 Escape로 선택을 해제합니다.',
          'node.a11yDescription.keyboardDisabled': 'Enter 또는 Space로 노드를 선택하세요.',
          'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) =>
            `${({ left: '왼쪽', right: '오른쪽', up: '위', down: '아래' } as Record<string, string>)[direction] ?? direction} 방향으로 이동. 현재 위치 ${Math.round(x)}, ${Math.round(y)}`,
          'edge.a11yDescription.default': 'Enter 또는 Space로 연결선을 선택하고 Delete로 삭제하세요.',
          'controls.ariaLabel': '캔버스 보기 조절',
          'handle.ariaLabel': '연결 지점',
          'controls.zoomIn.ariaLabel': '확대',
          'controls.zoomOut.ariaLabel': '축소',
          'controls.fitView.ariaLabel': '전체 보기',
          'controls.interactive.ariaLabel': '캔버스 조작 잠금 전환',
          'minimap.ariaLabel': '다이어그램 미니맵',
        }}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        selectionKeyCode="Shift"
        selectionOnDrag
        selectionMode={SelectionMode.Full}
        panOnDrag={[1, 2]}
        edgeTypes={edgeTypes}
        edges={visibleEdges}
        elevateNodesOnSelect={false}
        fitView
        minZoom={0.1}
        fitViewOptions={{ padding: 0.25 }}
        nodeTypes={nodeTypes}
        nodes={accessibleNodes}
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
        {showGrid ? (
          <Background color={theme === 'dark' ? '#334155' : '#cbd5e1'} gap={22} size={1.4} variant={BackgroundVariant.Dots} />
        ) : null}
        <Controls position="bottom-right" />
        <MiniMap
          className="!bg-white !shadow-md"
          maskColor={theme === 'dark' ? 'rgba(2, 6, 23, 0.5)' : 'rgba(15, 23, 42, 0.08)'}
          nodeColor={(node) => String((node.data as ArchitectureNodeData).accent ?? '#64748b')}
          pannable
          position="bottom-left"
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
