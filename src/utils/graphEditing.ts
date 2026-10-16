import type { ArchitectureNode, GraphState } from '../types/graph';

export const isGroup = (node: ArchitectureNode) => node.type === 'groupNode' || node.data.isGroup === true || node.data.kind === 'group';
export const nodeLimits = (node: ArchitectureNode) =>
  isGroup(node)
    ? { minWidth: 280, minHeight: 180, maxWidth: 8000, maxHeight: 8000 }
    : { minWidth: 160, minHeight: 112, maxWidth: 800, maxHeight: 600 };
export const nodeSize = (node: ArchitectureNode) => ({
  width: Number(node.style?.width ?? node.width ?? node.measured?.width ?? (isGroup(node) ? 520 : 208)),
  height: Number(node.style?.height ?? node.height ?? node.measured?.height ?? (isGroup(node) ? 320 : 112)),
});
export function absolutePosition(node: ArchitectureNode, nodes: ArchitectureNode[]) {
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodes.find((item) => item.id === parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}
export function orderParentsFirst(nodes: ArchitectureNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result: ArchitectureNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (node: ArchitectureNode) => {
    if (visited.has(node.id) || visiting.has(node.id)) return;
    visiting.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) visit(parent);
    visited.add(node.id);
    result.push(node);
  };
  nodes.filter(isGroup).forEach(visit);
  nodes.forEach(visit);
  return result;
}
export function reparentNodes(nodes: ArchitectureNode[], ids: Set<string>, parentId?: string) {
  const parent = nodes.find((node) => node.id === parentId);
  if (parentId && (!parent || !isGroup(parent))) return nodes;
  const ancestorIds = new Set<string>();
  let ancestor = parent;
  while (ancestor && !ancestorIds.has(ancestor.id)) {
    ancestorIds.add(ancestor.id);
    ancestor = nodes.find((node) => node.id === ancestor?.parentId);
  }
  if ([...ids].some((id) => ancestorIds.has(id))) return nodes;
  const parentPosition = parent ? absolutePosition(parent, nodes) : { x: 0, y: 0 };
  return nodes.map((node) => {
    if (!ids.has(node.id) || node.parentId === parentId) return node;
    const position = absolutePosition(node, nodes);
    const { parentId: _parent, extent: _extent, ...rest } = node;
    return { ...rest, ...(parentId ? { parentId } : {}), position: { x: position.x - parentPosition.x, y: position.y - parentPosition.y } };
  });
}
export function removeElements(graph: GraphState, nodeIds: Set<string>, edgeIds = new Set<string>()): GraphState {
  if (!nodeIds.size && !edgeIds.size) return graph;
  const nodes = graph.nodes
    .filter((node) => !nodeIds.has(node.id))
    .map((node) => {
      if (!node.parentId || !nodeIds.has(node.parentId)) return node;
      const { parentId: _parent, extent: _extent, ...rest } = node;
      return { ...rest, position: absolutePosition(node, graph.nodes) };
    });
  return { nodes, edges: graph.edges.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)) };
}
export function selectedRoots(nodes: ArchitectureNode[], ids: Set<string>) {
  return nodes.filter((node) => {
    if (!ids.has(node.id)) return false;
    const visited = new Set<string>();
    let parent = node.parentId;
    while (parent && !visited.has(parent)) {
      if (ids.has(parent)) return false;
      visited.add(parent);
      parent = nodes.find((item) => item.id === parent)?.parentId;
    }
    return true;
  });
}
export function copySubgraph(graph: GraphState, nodeIds: Set<string>): GraphState {
  const ids = new Set(nodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    graph.nodes.forEach((node) => {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    });
  }
  return structuredClone({
    nodes: graph.nodes
      .filter((node) => ids.has(node.id))
      .map((node) => {
        const {
          parentId,
          extent: _extent,
          measured: _measured,
          selected: _selected,
          dragging: _dragging,
          resizing: _resizing,
          ...rest
        } = node;
        return {
          ...rest,
          ...(parentId && ids.has(parentId)
            ? { parentId, ...(node.extent === 'parent' ? { extent: 'parent' as const } : {}) }
            : { position: absolutePosition(node, graph.nodes) }),
        };
      }),
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  });
}
export function pasteSubgraph(graph: GraphState, clipboard: GraphState, offset = 48): GraphState {
  const ids = new Map(clipboard.nodes.map((node) => [node.id, `${node.data.kind}-${crypto.randomUUID()}`]));
  return {
    nodes: [
      ...graph.nodes.map((node) => ({ ...node, selected: false })),
      ...structuredClone(clipboard.nodes).map((node) => ({
        ...node,
        id: ids.get(node.id)!,
        selected: !(node.parentId && ids.has(node.parentId)),
        ...(node.parentId && ids.has(node.parentId) ? { parentId: ids.get(node.parentId) } : { parentId: undefined }),
        position: node.parentId && ids.has(node.parentId) ? node.position : { x: node.position.x + offset, y: node.position.y + offset },
      })),
    ],
    edges: [
      ...graph.edges.map((edge) => ({ ...edge, selected: false })),
      ...structuredClone(clipboard.edges).map((edge) => ({
        ...edge,
        id: `edge-${crypto.randomUUID()}`,
        source: ids.get(edge.source)!,
        target: ids.get(edge.target)!,
        selected: false,
        data: { ...edge.data, routePoints: undefined },
      })),
    ],
  };
}
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical';
export function alignNodes(nodes: ArchitectureNode[], ids: Set<string>, alignment: Alignment, gapOverride?: number) {
  const roots = selectedRoots(nodes, ids);
  if (roots.length < ((alignment === 'horizontal' || alignment === 'vertical') && gapOverride === undefined ? 3 : 2)) return nodes;
  const items = roots.map((node) => ({ node, ...absolutePosition(node, nodes), ...nodeSize(node) }));
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  const positions = new Map<string, { x: number; y: number }>();
  if (alignment === 'horizontal' || alignment === 'vertical') {
    const horizontal = alignment === 'horizontal';
    const sorted = [...items].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const span = horizontal ? right - left : bottom - top;
    const gap =
      gapOverride ??
      Math.max(0, (span - sorted.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0)) / (items.length - 1));
    let position = horizontal ? left : top;
    sorted.forEach((item) => {
      positions.set(item.node.id, horizontal ? { x: position, y: item.y } : { x: item.x, y: position });
      position += (horizontal ? item.width : item.height) + gap;
    });
  } else
    items.forEach((item) =>
      positions.set(item.node.id, {
        x:
          alignment === 'left'
            ? left
            : alignment === 'center'
              ? (left + right - item.width) / 2
              : alignment === 'right'
                ? right - item.width
                : item.x,
        y:
          alignment === 'top'
            ? top
            : alignment === 'middle'
              ? (top + bottom - item.height) / 2
              : alignment === 'bottom'
                ? bottom - item.height
                : item.y,
      }),
    );
  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return node;
    const parent = nodes.find((item) => item.id === node.parentId);
    const origin = parent ? absolutePosition(parent, nodes) : { x: 0, y: 0 };
    return { ...node, position: { x: position.x - origin.x, y: position.y - origin.y } };
  });
}
export function groupNodes(graph: GraphState, ids: Set<string>): GraphState {
  const roots = selectedRoots(graph.nodes, ids);
  if (!roots.length) return graph;
  const items = roots.map((node) => ({ ...absolutePosition(node, graph.nodes), ...nodeSize(node) }));
  const position = { x: Math.min(...items.map((item) => item.x)) - 32, y: Math.min(...items.map((item) => item.y)) - 88 };
  const width = Math.max(280, Math.max(...items.map((item) => item.x + item.width)) - position.x + 32);
  const height = Math.max(180, Math.max(...items.map((item) => item.y + item.height)) - position.y + 32);
  if (width > 8000 || height > 8000) return graph;
  const group: ArchitectureNode = {
    id: `group-${crypto.randomUUID()}`,
    type: 'groupNode',
    position,
    selected: true,
    zIndex: 0,
    style: { width, height },
    data: { kind: 'group', label: '새 그룹', subtitle: '논리적 영역', category: 'Group', accent: '#475569', isGroup: true },
  };
  const nodes = [...graph.nodes.map((node) => ({ ...node, selected: false })), group];
  return {
    nodes: reparentNodes(nodes, new Set(roots.map((node) => node.id)), group.id),
    edges: graph.edges.map((edge) => ({ ...edge, selected: false })),
  };
}
