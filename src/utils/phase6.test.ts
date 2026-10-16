import { afterEach, expect, it, vi } from 'vitest';
import { createBenchmarkGraph, summarize } from '../benchmarks/fixtures';
import { hasPersistentGraphChange } from './persistenceChanges';
import { useGraphStore } from '../store/useGraphStore';
import { layoutEngine, LayoutCancelledError } from './layoutEngine';
import { toExportableGraph, parseImportedGraph } from './jsonUtils';
import { encodeStateToUrl, decodeStateFromUrl } from './urlUtils';
afterEach(() => vi.restoreAllMocks());
it('retains edge objects during drag and records a single transform undo', () => {
  const store = useGraphStore;
  store.getState().setGraph(createBenchmarkGraph(300));
  const edges = store.getState().edges;
  const untouched = store.getState().nodes[1];
  for (let i = 0; i < 5; i++)
    store.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: i, y: i }, dragging: true }]);
  expect(store.getState().edges).toBe(edges);
  expect(store.getState().nodes[1]).toBe(untouched);
  expect(store.getState().past).toHaveLength(0);
  store.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 5, y: 5 }, dragging: false }]);
  expect(store.getState().past).toHaveLength(1);
  store.getState().undo();
  expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
});
it('invalidates generated routes once while leaving unrelated edges intact', () => {
  useGraphStore.getState().setGraph(createBenchmarkGraph(10));
  const original = useGraphStore.getState().edges;
  const routed = {
    ...original[0],
    data: {
      ...original[0].data,
      routePoints: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
      ],
    },
  };
  useGraphStore.setState({ edges: [routed, ...original.slice(1)] });
  useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 2, y: 2 }, dragging: true }]);
  const cleared = useGraphStore.getState().edges;
  expect(cleared[0].data?.routePoints).toBeUndefined();
  expect(cleared[1]).toBe(original[1]);
  useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 3, y: 3 }, dragging: true }]);
  expect(useGraphStore.getState().edges).toBe(cleared);
  useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 3, y: 3 }, dragging: false }]);
});
it('ignores UI-only selection/measurements but detects every persisted edit category', () => {
  const graph = createBenchmarkGraph(10);
  expect(
    hasPersistentGraphChange(
      {
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, selected: true, measured: { width: 208, height: 112 } })),
        edges: graph.edges.map((edge) => ({ ...edge, selected: true })),
      },
      graph,
    ),
  ).toBe(false);
  for (const change of [
    { position: { x: 1, y: 2 } },
    { data: { ...graph.nodes[0].data, label: 'changed' } },
    { style: { width: 300 } },
    { parentId: 'group' },
    { width: 300 },
  ])
    expect(hasPersistentGraphChange({ ...graph, nodes: [{ ...graph.nodes[0], ...change }, ...graph.nodes.slice(1)] }, graph)).toBe(true);
  expect(hasPersistentGraphChange({ ...graph, edges: [{ ...graph.edges[0], target: 'bench-8' }, ...graph.edges.slice(1)] }, graph)).toBe(
    true,
  );
});
it('returns cancellation without graph/history mutation and accepts a subsequent layout', async () => {
  useGraphStore.getState().setGraph(createBenchmarkGraph(10));
  const before = toExportableGraph(useGraphStore.getState());
  let reject!: (error: Error) => void;
  const mock = vi.spyOn(layoutEngine, 'layout').mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const result = useGraphStore.getState().autoLayout();
  useGraphStore.getState().cancelAutoLayout();
  reject(new LayoutCancelledError());
  expect(await result).toBe('cancelled');
  expect(toExportableGraph(useGraphStore.getState())).toEqual(before);
  expect(useGraphStore.getState().past).toHaveLength(0);
  mock.mockRestore();
  expect(await useGraphStore.getState().autoLayout()).toBe('applied');
});
it.each([10, 50, 100, 300])('keeps benchmark fixtures and both persistence formats valid at %i nodes', (count) => {
  const graph = createBenchmarkGraph(count);
  expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(graph.edges.length);
  expect(parseImportedGraph(toExportableGraph(graph)).nodes).toHaveLength(count);
  expect(decodeStateFromUrl(encodeStateToUrl(graph)).ok).toBe(true);
});
it('reports empirical percentiles without rounding away maximum samples', () => {
  expect(summarize([10, 1, 3, 2, 4])).toEqual({ samples: 5, medianMs: 3, p95Ms: 10, maxMs: 10 });
});
