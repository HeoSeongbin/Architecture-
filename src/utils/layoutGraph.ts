import { layoutEngine, LayoutCancelledError } from './layoutEngine';
export { layoutEngine } from './layoutEngine';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { GraphState } from '../types/graph';
import { absolutePosition, isGroup, nodeSize, orderParentsFirst } from './graphEditing';

export interface LayoutOptions {
  direction: 'LR' | 'TB' | 'RL' | 'BT';
  layerGap: number;
  nodeGap: number;
}
export const DEFAULT_LAYOUT: LayoutOptions = { direction: 'LR', layerGap: 130, nodeGap: 70 };
export async function layoutGraph(graph: GraphState, options: LayoutOptions = DEFAULT_LAYOUT) {
  if (
    !['LR', 'TB', 'RL', 'BT'].includes(options.direction) ||
    ![options.layerGap, options.nodeGap].every((value) => Number.isFinite(value) && value >= 20 && value <= 500)
  )
    throw new Error('정렬 간격은 20–500px이어야 합니다.');
  const nodes = structuredClone(graph.nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let fallback = false;
  const arrange = async (parentId?: string) => {
    const siblings = nodes.filter((node) => node.parentId === parentId);
    for (const group of siblings.filter(isGroup)) await arrange(group.id);
    if (!siblings.length) return;
    const ids = new Set(siblings.map((node) => node.id));
    const project = (id: string) => {
      let node = byId.get(id);
      while (node && !ids.has(node.id)) node = node.parentId ? byId.get(node.parentId) : undefined;
      return node?.id;
    };
    const connections = graph.edges.flatMap((edge) => {
      const source = project(edge.source),
        target = project(edge.target);
      return source && target && source !== target ? [{ id: edge.id, sources: [source], targets: [target] }] : [];
    });
    let positions: ElkNode[];
    try {
      const result = await layoutEngine.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': { LR: 'RIGHT', TB: 'DOWN', RL: 'LEFT', BT: 'UP' }[options.direction],
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.spacing.nodeNode': String(options.nodeGap),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerGap),
          'elk.spacing.componentComponent': String(options.nodeGap),
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        },
        children: siblings.map((node) => ({ id: node.id, ...nodeSize(node) })),
        edges: connections,
      });
      positions = result.children ?? [];
      if (positions.length !== siblings.length || positions.some((node) => !Number.isFinite(node.x) || !Number.isFinite(node.y)))
        throw new Error('Invalid layout');
    } catch (error) {
      if (error instanceof LayoutCancelledError) throw error;
      fallback = true;
      let cursor = 0;
      const vertical = options.direction === 'TB' || options.direction === 'BT';
      const ordered = options.direction === 'RL' || options.direction === 'BT' ? [...siblings].reverse() : siblings;
      positions = ordered.map((node) => {
        const position = { id: node.id, x: vertical ? 0 : cursor, y: vertical ? cursor : 0 };
        cursor += (vertical ? nodeSize(node).height : nodeSize(node).width) + options.layerGap;
        return position;
      });
    }
    const padding = parentId ? { x: 32, y: 88 } : { x: 80, y: 80 };
    for (const position of positions) {
      const node = byId.get(position.id)!;
      node.position = { x: padding.x + position.x!, y: padding.y + position.y! };
      node.selected = false;
    }
    if (parentId) {
      const parent = byId.get(parentId)!;
      parent.style = {
        ...parent.style,
        width: Math.max(280, ...siblings.map((node) => node.position.x + nodeSize(node).width + 32)),
        height: Math.max(180, ...siblings.map((node) => node.position.y + nodeSize(node).height + 32)),
      };
    }
  };
  await arrange();
  if (
    nodes.some(
      (node) =>
        ![node.position.x, node.position.y, node.position.x + nodeSize(node).width, node.position.y + nodeSize(node).height].every(
          Number.isFinite,
        ),
    )
  ) {
    throw new Error('노드 좌표/크기가 너무 커서 안전하게 배치할 수 없습니다. 현재 작업은 유지됩니다.');
  }
  const edges = graph.edges.map((edge) => {
    const source = byId.get(edge.source),
      target = byId.get(edge.target);
    let handles = {};
    if (source && target && edge.data?.handleMode !== 'manual') {
      const a = absolutePosition(source, nodes),
        b = absolutePosition(target, nodes);
      const dx = b.x + nodeSize(target).width / 2 - a.x - nodeSize(source).width / 2;
      const dy = b.y + nodeSize(target).height / 2 - a.y - nodeSize(source).height / 2;
      handles =
        Math.abs(dx) >= Math.abs(dy)
          ? { sourceHandle: dx >= 0 ? 'right' : 'left', targetHandle: dx >= 0 ? 'left' : 'right' }
          : { sourceHandle: dy >= 0 ? 'bottom' : 'top', targetHandle: dy >= 0 ? 'top' : 'bottom' };
    }
    return { ...edge, ...handles, selected: false, data: { ...edge.data, routePoints: undefined } };
  });
  return { graph: { nodes: orderParentsFirst(nodes), edges }, fallback };
}
