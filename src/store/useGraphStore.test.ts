import { beforeEach, describe, expect, it } from 'vitest';
import { sampleGraph } from '../data/sampleGraph';
import { useGraphStore } from './useGraphStore';

const store = () => useGraphStore.getState();
beforeEach(() => store().setGraph(structuredClone(sampleGraph)));

describe('graph store regression', () => {
  it('adds, duplicates and restores nodes through undo/redo', () => {
    store().addNode({ ...sampleGraph.nodes[0], id: 'added' });
    expect(
      store()
        .nodes.filter((node) => node.selected)
        .map((node) => node.id),
    ).toEqual(['added']);
    store().duplicateNode('added');
    expect(store().nodes).toHaveLength(10);
    expect(new Set(store().nodes.map((node) => node.id)).size).toBe(10);
    store().undo();
    expect(store().nodes).toHaveLength(9);
    store().redo();
    expect(store().nodes).toHaveLength(10);
  });
  it('deletes connected edges and restores them', () => {
    store().deleteNode('nginx');
    expect(store().edges.some((edge) => edge.source === 'nginx' || edge.target === 'nginx')).toBe(false);
    store().undo();
    expect(store().edges).toHaveLength(7);
  });
  it('records a drag before the first movement', () => {
    const before = store().nodes[0].position;
    store().onNodesChange([{ type: 'position', id: 'react', position: { x: 500, y: 500 }, dragging: true }]);
    store().onNodesChange([{ type: 'position', id: 'react', position: { x: 600, y: 600 }, dragging: false }]);
    store().undo();
    expect(store().nodes[0].position).toEqual(before);
    store().redo();
    expect(store().nodes[0].position).toEqual({ x: 600, y: 600 });
  });
  it('does not record selection or measured dimensions', () => {
    store().onNodesChange([
      { type: 'select', id: 'react', selected: true },
      { type: 'dimensions', id: 'react', dimensions: { width: 208, height: 112 } },
    ]);
    expect(store().canUndo).toBe(false);
  });
  it('records batch deletion atomically and retains group children at absolute positions', () => {
    const group = { ...sampleGraph.nodes[0], id: 'group', type: 'groupNode' as const, position: { x: 100, y: 200 } };
    store().setGraph({ nodes: [group, { ...sampleGraph.nodes[0], parentId: 'group', position: { x: 10, y: 20 } }], edges: [] });
    store().onNodesChange([{ type: 'remove', id: 'group' }]);
    expect(store().nodes[0].parentId).toBeUndefined();
    expect(store().nodes[0].position).toEqual({ x: 110, y: 220 });
    store().undo();
    expect(store().nodes).toHaveLength(2);
  });
  it('connects, edits and deletes edges', () => {
    store().onConnect({ source: 'react', target: 'mssql', sourceHandle: 'right', targetHandle: 'left' });
    const id = store().edges.at(-1)!.id;
    store().updateEdgeData(id, { label: 'SQL', direction: 'bidirectional' });
    expect(store().edges.at(-1)?.data?.renderLabel).toBe('SQL');
    store().deleteEdge(id);
    expect(store().edges).toHaveLength(7);
    store().undo();
    expect(store().edges).toHaveLength(8);
  });
  it('limits history to 80 and clears redo after a new edit', () => {
    for (let i = 0; i < 90; i++) store().updateNodeData('react', { label: String(i) });
    expect(store().past).toHaveLength(80);
    store().undo();
    store().updateNodeData('react', { label: 'new' });
    expect(store().canRedo).toBe(false);
  });
  it('lays out the sample with finite positions and undo', async () => {
    const original = store().nodes.map((node) => node.position);
    await store().autoLayout();
    expect(store().nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
    expect(store().canUndo).toBe(true);
    store().undo();
    expect(store().nodes.map((node) => node.position)).toEqual(original);
  });
  it('does not overwrite edits made while layout is pending', async () => {
    const layout = store().autoLayout();
    store().updateNodeData('react', { label: 'keep this edit' });
    await layout;
    expect(store().nodes[0].data.label).toBe('keep this edit');
    expect(store().past).toHaveLength(1);
  });
  it('handles an empty layout', async () => {
    store().setGraph({ nodes: [], edges: [] });
    await expect(store().autoLayout()).resolves.toBeUndefined();
    expect(store().canUndo).toBe(false);
  });
});
