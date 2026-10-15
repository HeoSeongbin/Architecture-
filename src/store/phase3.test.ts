import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphStore } from './useGraphStore';
import { sampleGraph } from '../data/sampleGraph';
import { absolutePosition, nodeSize } from '../utils/graphEditing';
import { encodeStateToUrl, decodeStateFromUrl } from '../utils/urlUtils';
import { normalizeImportedGraph, toExportableGraph } from '../utils/jsonUtils';
import type { ArchitectureNode, GraphState } from '../types/graph';

const store = () => useGraphStore.getState();
const node = (id: string, x = 0, y = 0): ArchitectureNode => ({ ...structuredClone(sampleGraph.nodes[0]), id, position: { x, y } });
const group = (id = 'zone', x = 100, y = 200): ArchitectureNode => ({
  ...node(id, x, y),
  type: 'groupNode',
  style: { width: 600, height: 400 },
  data: { ...node(id).data, kind: 'group', isGroup: true, label: 'VPC' },
});
const select = (...ids: string[]) => {
  store().onNodesChange(store().nodes.map((item) => ({ type: 'select' as const, id: item.id, selected: ids.includes(item.id) })));
  store().selectNode(ids[0] ?? null);
};
beforeEach(() => {
  store().setGraph(structuredClone(sampleGraph));
  useGraphStore.setState({ clipboard: null });
});

describe('Phase 3 editing transactions', () => {
  it('deletes a selection and its edges in one undo step', () => {
    select('react', 'nginx');
    store().deleteSelection();
    expect(store().nodes).toHaveLength(6);
    expect(store().edges).toHaveLength(5);
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().nodes).toHaveLength(8);
    expect(store().edges).toHaveLength(7);
    store().redo();
    expect(store().nodes).toHaveLength(6);
  });
  it('copies internal connections with fresh IDs and independent data', () => {
    select('react', 'nginx');
    store().copySelection();
    store().pasteSelection();
    const added = store().nodes.filter((item) => item.selected);
    expect(added).toHaveLength(2);
    expect(store().edges).toHaveLength(8);
    const edge = store().edges.at(-1)!;
    expect(new Set(added.map((item) => item.id))).toEqual(new Set([edge.source, edge.target]));
    expect(added[0].data).not.toBe(store().nodes[0].data);
    expect(added[0].position.x).toBe(sampleGraph.nodes[0].position.x + 48);
    store().pasteSelection();
    expect(store().nodes.at(-2)?.position.x).toBe(sampleGraph.nodes[0].position.x + 96);
    store().undo();
    expect(store().nodes).toHaveLength(10);
  });
  it('copies a group with unselected descendants and remaps nested parent IDs', () => {
    store().setGraph({
      nodes: [group(), { ...group('inner', 30, 40), parentId: 'zone' }, { ...node('child', 10, 20), parentId: 'inner' }],
      edges: [],
    });
    select('zone');
    store().duplicateSelection();
    const pasted = store().nodes.filter((item) => !['zone', 'inner', 'child'].includes(item.id));
    expect(pasted).toHaveLength(3);
    expect(pasted.filter((item) => item.selected)).toHaveLength(1);
    const parent = pasted.find((item) => !item.parentId)!;
    const inner = pasted.find((item) => item.parentId === parent.id)!;
    const child = pasted.find((item) => item.parentId === inner.id)!;
    expect(parent.id).not.toBe('zone');
    expect(child.position).toEqual({ x: 10, y: 20 });
    expect(parent.style).toEqual({ width: 600, height: 400 });
    expect(store().past).toHaveLength(1);
  });
  it('pastes a child independently of its unselected original group', () => {
    store().setGraph({ nodes: [group(), { ...node('child', 10, 20), parentId: 'zone' }], edges: [] });
    select('child');
    store().copySelection();
    store().pasteSelection();
    const pasted = store().nodes.at(-1)!;
    expect(pasted.parentId).toBeUndefined();
    expect(pasted.position).toEqual({ x: 158, y: 268 });
  });
  it('groups a cross-parent selection while preserving absolute positions and undo', () => {
    store().setGraph({ nodes: [group(), { ...node('a', 10, 20), parentId: 'zone' }, node('b', 900, 500)], edges: [] });
    select('a', 'b');
    store().groupSelection();
    const newGroup = store().nodes.find((item) => item.selected)!;
    expect(newGroup.type).toBe('groupNode');
    expect(store().nodes.find((item) => item.id === 'a')?.parentId).toBe(newGroup.id);
    expect(
      absolutePosition(
        store().nodes.find((item) => item.id === 'a')!,
        store().nodes,
      ),
    ).toEqual({ x: 110, y: 220 });
    store().undo();
    expect(store().nodes.find((item) => item.id === 'a')?.parentId).toBe('zone');
  });
  it('rejects group cycles and detaches children without moving them', () => {
    store().setGraph({ nodes: [group(), { ...group('inner', 10, 20), parentId: 'zone' }], edges: [] });
    store().setNodeParent('zone', 'inner');
    expect(store().past).toHaveLength(0);
    store().setNodeParent('inner');
    expect(store().nodes.find((item) => item.id === 'inner')?.position).toEqual({ x: 110, y: 220 });
    store().undo();
    expect(store().nodes.find((item) => item.id === 'inner')?.parentId).toBe('zone');
  });
  it('preserves children on group deletion, including explicit multi-delete rules', () => {
    store().setGraph({ nodes: [group(), { ...node('child', 10, 20), parentId: 'zone' }, node('other')], edges: [] });
    select('zone');
    store().deleteSelection();
    expect(store().nodes.find((item) => item.id === 'child')?.position).toEqual({ x: 110, y: 220 });
    store().undo();
    select('zone', 'child');
    store().deleteSelection();
    expect(store().nodes.map((item) => item.id)).toEqual(['other']);
  });
  it('records reparenting at drag completion in the same history entry', () => {
    store().setGraph({ nodes: [group(), node('child', 0, 0)], edges: [] });
    store().onNodesChange([{ type: 'position', id: 'child', position: { x: 150, y: 250 }, dragging: true }]);
    store().onNodesChange([{ type: 'position', id: 'child', position: { x: 160, y: 260 }, dragging: false }]);
    expect(store().past).toHaveLength(1);
    expect(store().nodes.find((item) => item.id === 'child')?.parentId).toBe('zone');
    expect(
      absolutePosition(
        store().nodes.find((item) => item.id === 'child')!,
        store().nodes,
      ),
    ).toEqual({ x: 160, y: 260 });
    store().undo();
    expect(store().nodes.find((item) => item.id === 'child')?.position).toEqual({ x: 0, y: 0 });
    expect(store().nodes.find((item) => item.id === 'child')?.parentId).toBeUndefined();
  });
  it('records resize gestures once and restores dimensions through undo/redo', () => {
    const original = nodeSize(store().nodes[0]);
    store().beginResize();
    for (const width of [240, 260, 300])
      store().onNodesChange([{ type: 'dimensions', id: 'react', dimensions: { width, height: 160 }, resizing: true, setAttributes: true }]);
    expect(store().past).toHaveLength(0);
    store().onNodesChange([{ type: 'dimensions', id: 'react', resizing: false }]);
    expect(store().past).toHaveLength(1);
    expect(nodeSize(store().nodes[0])).toEqual({ width: 300, height: 160 });
    store().undo();
    expect(nodeSize(store().nodes[0])).toEqual(original);
    store().redo();
    expect(store().nodes[0].style).toEqual({ width: 300, height: 160 });
  });
  it('moves groups with their descendants and restores a batch drag with one undo', () => {
    store().setGraph({ nodes: [group(), { ...node('child', 10, 20), parentId: 'zone' }, node('other', 1000, 0)], edges: [] });
    store().onNodesChange([
      { type: 'position', id: 'zone', position: { x: 200, y: 300 }, dragging: true },
      { type: 'position', id: 'other', position: { x: 1100, y: 100 }, dragging: true },
    ]);
    store().onNodesChange([
      { type: 'position', id: 'zone', position: { x: 250, y: 350 }, dragging: false },
      { type: 'position', id: 'other', position: { x: 1150, y: 150 }, dragging: false },
    ]);
    expect(store().past).toHaveLength(1);
    expect(
      absolutePosition(
        store().nodes.find((item) => item.id === 'child')!,
        store().nodes,
      ),
    ).toEqual({ x: 260, y: 370 });
    store().undo();
    expect(
      absolutePosition(
        store().nodes.find((item) => item.id === 'child')!,
        store().nodes,
      ),
    ).toEqual({ x: 110, y: 220 });
    expect(store().nodes.find((item) => item.id === 'other')?.position).toEqual({ x: 1000, y: 0 });
  });
  it('clamps inspector size and does not record no-op or non-finite values', () => {
    store().resizeNode('react', 10, 10000);
    expect(nodeSize(store().nodes[0])).toEqual({ width: 160, height: 600 });
    store().resizeNode('react', 160, 600);
    store().resizeNode('react', Infinity, 200);
    expect(store().past).toHaveLength(1);
  });
  it('updates common properties as one step and ignores unselected nodes', () => {
    select('react', 'nginx');
    store().updateSelectedNodes({ accent: '#abcdef', subtitle: '공통' });
    expect(
      store()
        .nodes.slice(0, 2)
        .every((item) => item.data.subtitle === '공통'),
    ).toBe(true);
    expect(store().nodes[2].data.subtitle).not.toBe('공통');
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().nodes[0].data.accent).toBe(sampleGraph.nodes[0].data.accent);
  });
  it('aligns nodes across groups in canvas coordinates and distributes clear gaps', () => {
    store().setGraph({
      nodes: [group(), { ...node('a', 10, 20), parentId: 'zone' }, node('b', 500, 300), node('c', 1000, 600)],
      edges: [],
    });
    select('a', 'b', 'c');
    store().alignSelection('top');
    expect(
      store()
        .nodes.filter((item) => item.id !== 'zone')
        .map((item) => absolutePosition(item, store().nodes).y),
    ).toEqual([220, 220, 220]);
    store().alignSelection('horizontal');
    const xs = store()
      .nodes.filter((item) => item.id !== 'zone')
      .map((item) => absolutePosition(item, store().nodes).x);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1]);
  });
  it('selects all without changing history and retains the clipboard across new diagrams', () => {
    store().selectAll();
    expect(store().nodes.every((item) => item.selected)).toBe(true);
    expect(store().canUndo).toBe(false);
    store().copySelection();
    store().replaceGraph({ nodes: [], edges: [] });
    store().pasteSelection();
    expect(store().nodes).toHaveLength(8);
    expect(store().edges).toHaveLength(7);
  });
  it('sets an explicit pixel gap as one undo step', () => {
    store().setGraph({ nodes: [node('a', 0), node('b', 500), node('c', 1000)], edges: [] });
    select('a', 'b', 'c');
    store().spaceSelection('horizontal', 40);
    expect(store().nodes.map((item) => item.position.x)).toEqual([0, 248, 496]);
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().nodes.map((item) => item.position.x)).toEqual([0, 500, 1000]);
    store().spaceSelection('horizontal', -10);
    expect(store().past).toHaveLength(0);
  });
  it('feeds resized node dimensions into the existing layout engine', async () => {
    store().setGraph({ nodes: [node('a'), node('b', 500)], edges: [{ id: 'ab', source: 'a', target: 'b' }] });
    store().resizeNode('a', 800, 400);
    await store().autoLayout();
    const a = store().nodes.find((item) => item.id === 'a')!;
    const b = store().nodes.find((item) => item.id === 'b')!;
    expect(b.position.x).toBeGreaterThanOrEqual(a.position.x + 800);
  });
});

describe('extended data compatibility', () => {
  it.each(['solid', 'dashed', 'dotted'] as const)('persists %s lines, paths, arrows, size and groups through both formats', (lineStyle) => {
    store().resizeNode('react', 320, 180);
    select('react', 'nginx');
    store().groupSelection();
    store().updateEdgeData(store().edges[0].id, {
      lineStyle,
      pathStyle: 'straight',
      arrowStyle: 'open',
      color: '#aabbcc',
      direction: 'bidirectional',
    });
    const graph: GraphState = { nodes: store().nodes, edges: store().edges };
    const url = decodeStateFromUrl(encodeStateToUrl(graph));
    expect(url.ok).toBe(true);
    const json = normalizeImportedGraph(JSON.parse(JSON.stringify(toExportableGraph(graph))));
    for (const result of [url.state, json!]) {
      expect(result.edges[0].data?.lineStyle ?? 'solid').toBe(lineStyle);
      expect(result.edges[0].data).toMatchObject({ pathStyle: 'straight', arrowStyle: 'open', color: '#aabbcc' });
      expect(nodeSize(result.nodes.find((item) => item.id === 'react')!)).toEqual({ width: 320, height: 180 });
      expect(result.nodes.find((item) => item.id === 'react')?.parentId).toBeTruthy();
    }
  });
  it('applies edge dash patterns and marker style with undo/redo', () => {
    const id = store().edges[0].id;
    store().updateEdgeData(id, { lineStyle: 'dotted', arrowStyle: 'none', color: '#abcdef' });
    expect(store().edges[0].style).toMatchObject({ stroke: '#abcdef', strokeDasharray: '2 5' });
    expect(store().edges[0].markerEnd).toBeUndefined();
    store().undo();
    expect(store().edges[0].markerEnd).toBeDefined();
    store().redo();
    expect(store().edges[0].style?.stroke).toBe('#abcdef');
  });
  it('rejects invalid new properties while still accepting the original sample', () => {
    expect(normalizeImportedGraph(sampleGraph)).not.toBeNull();
    const bad = structuredClone(sampleGraph);
    bad.edges[0].data = { color: 'javascript:bad' };
    expect(normalizeImportedGraph(bad)).toBeNull();
    bad.edges = [];
    bad.nodes[0].style = { width: -1, height: 100 };
    expect(normalizeImportedGraph(bad)).toBeNull();
  });
});
