import { afterEach, expect, it, vi } from 'vitest';
import { deflate, inflate } from 'pako';
import legacyJson from '../test/fixtures/legacy-graph.json';
import legacyHash from '../test/fixtures/legacy-hash.txt?raw';
import { parseImportedGraph, toExportableGraph } from './jsonUtils';
import { decodeStateFromUrl, encodeStateToUrl } from './urlUtils';
import { DATA_VERSION, GRAPH_LIMITS } from './graphValidation';
import { DEFAULT_LAYOUT, layoutEngine, layoutGraph } from './layoutGraph';
import { sampleGraph } from '../data/sampleGraph';
import { isGroup, nodeSize } from './graphEditing';
import type { GraphState } from '../types/graph';
import { useGraphStore } from '../store/useGraphStore';

afterEach(() => vi.restoreAllMocks());
const pack = (value: unknown) =>
  btoa(String.fromCharCode(...deflate(typeof value === 'string' ? value : JSON.stringify(value))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '~');
it('migrates fixed legacy URL and JSON fixtures and writes version 1', () => {
  const old = parseImportedGraph(legacyJson);
  const decoded = decodeStateFromUrl(legacyHash);
  expect(decoded.ok).toBe(true);
  expect(decoded.state.edges[0].data).toMatchObject({ label: 'HTTPS', direction: 'forward', labelMode: 'protocol' });
  expect(parseImportedGraph({ version: DATA_VERSION, ...toExportableGraph(old) }).nodes).toEqual(old.nodes);
  const encoded = encodeStateToUrl(old).replaceAll('-', '+').replaceAll('_', '/').replaceAll('~', '=');
  expect(
    JSON.parse(
      inflate(
        Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
        { to: 'string' },
      ),
    ).v,
  ).toBe(1);
});
it.each([0, 2, '1', null])('rejects unsupported versions %s in both formats', (version) => {
  expect(() => parseImportedGraph({ ...legacyJson, version })).toThrow('지원하지 않는 데이터 버전');
  const result = decodeStateFromUrl(pack({ v: version, n: [], e: [] }));
  expect(result.ok).toBe(false);
});
it('rejects compressed bombs during inflate and oversized encoded input before decode', () => {
  const bomb = pack(' '.repeat(GRAPH_LIMITS.bytes + 1));
  const result = decodeStateFromUrl(bomb);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(String(result.error)).toContain('5 MiB');
  expect(decodeStateFromUrl('a'.repeat(GRAPH_LIMITS.hash + 1)).ok).toBe(false);
  expect(decodeStateFromUrl(legacyHash.slice(0, -8)).ok).toBe(false);
});
it('rejects excessive counts, text and nesting', () => {
  expect(() => parseImportedGraph({ nodes: Array.from({ length: 1001 }, () => legacyJson.nodes[0]), edges: [] })).toThrow('1000');
  expect(() => parseImportedGraph({ nodes: [], edges: Array.from({ length: 5001 }, () => ({})) })).toThrow('5000');
  const graph = structuredClone(sampleGraph);
  graph.nodes[0].data.note = 'x'.repeat(GRAPH_LIMITS.text + 1);
  expect(() => parseImportedGraph(graph)).toThrow('10000');
  const nodes = Array.from({ length: 34 }, (_, index) => ({
    ...sampleGraph.nodes[0],
    id: String(index),
    type: 'groupNode' as const,
    parentId: index ? String(index - 1) : undefined,
  }));
  expect(() => parseImportedGraph({ nodes, edges: [] })).toThrow('깊이');
});
it.each([
  ['kind', 'unknown'],
  ['category', 'Invalid'],
  ['accent', 'red'],
  ['note', 123],
])('reports invalid node field %s without silently changing it', (field, value) => {
  const graph = structuredClone(sampleGraph);
  Object.assign(graph.nodes[0].data, { [field]: value });
  expect(() => parseImportedGraph(graph)).toThrow(`nodes[0].${field}`);
});
it.each([
  ['direction', 'wrong'],
  ['manualLabelOffsetX', Infinity],
  ['handleMode', 'wrong'],
  ['showEndpoints', 1],
])('validates edge field %s', (field, value) => {
  const graph = structuredClone(sampleGraph);
  graph.edges[0].data = { ...graph.edges[0].data, [field]: value };
  expect(() => parseImportedGraph(graph)).toThrow(`edges[0].${field}`);
});
it.each([{ d: 'wrong' }, { a: 'x' }, { c: '' }, { m: 0 }])('validates compact enums and optional fields %j', (fields) => {
  expect(decodeStateFromUrl(pack({ n: [], e: [{ i: 'edge', s: 'a', t: 'b', ...fields }] })).ok).toBe(false);
});

const nested = (): GraphState => ({
  nodes: [
    { ...sampleGraph.nodes[0], id: 'outer', type: 'groupNode', data: { ...sampleGraph.nodes[0].data, kind: 'group', isGroup: true } },
    {
      ...sampleGraph.nodes[0],
      id: 'inner',
      type: 'groupNode',
      parentId: 'outer',
      data: { ...sampleGraph.nodes[0].data, kind: 'group', isGroup: true },
    },
    { ...sampleGraph.nodes[0], id: 'a', parentId: 'inner', style: { width: 700, height: 200 } },
    { ...sampleGraph.nodes[0], id: 'b', parentId: 'inner' },
    { ...sampleGraph.nodes[0], id: 'c', parentId: 'outer' },
    { ...sampleGraph.nodes[0], id: 'outside' },
    { ...sampleGraph.nodes[0], id: 'disconnected' },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'ba', source: 'b', target: 'a' },
    { id: 'cross', source: 'b', target: 'c' },
    { id: 'out', source: 'c', target: 'outside' },
  ],
});
function checkBounds(graph: GraphState) {
  for (const node of graph.nodes) {
    expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
    if (node.parentId) {
      const parent = graph.nodes.find((item) => item.id === node.parentId)!;
      expect(node.position.x).toBeGreaterThanOrEqual(32);
      expect(node.position.y).toBeGreaterThanOrEqual(88);
      expect(node.position.x + nodeSize(node).width).toBeLessThanOrEqual(nodeSize(parent).width - 32);
      expect(node.position.y + nodeSize(node).height).toBeLessThanOrEqual(nodeSize(parent).height - 32);
    }
    for (const other of graph.nodes.filter((item) => item !== node && item.parentId === node.parentId)) {
      const overlap =
        node.position.x < other.position.x + nodeSize(other).width &&
        node.position.x + nodeSize(node).width > other.position.x &&
        node.position.y < other.position.y + nodeSize(other).height &&
        node.position.y + nodeSize(node).height > other.position.y;
      expect(overlap).toBe(false);
    }
  }
}
it.each(['LR', 'TB', 'RL', 'BT'] as const)(
  'lays out nested groups, cycles and disconnected components with real sizes in %s',
  async (direction) => {
    const original = nested();
    const { graph, fallback } = await layoutGraph(original, { direction, layerGap: 90, nodeGap: 60 });
    expect(fallback).toBe(false);
    expect(original.nodes[2].position).toEqual(sampleGraph.nodes[0].position);
    checkBounds(graph);
    expect(graph.nodes.filter(isGroup)).toHaveLength(2);
    expect(decodeStateFromUrl(encodeStateToUrl(graph)).ok).toBe(true);
    expect(parseImportedGraph(toExportableGraph(graph)).nodes).toHaveLength(7);
  },
);
it.each(['LR', 'TB', 'RL', 'BT'] as const)('respects directed edges and configured spacing in %s', async (direction) => {
  const { graph } = await layoutGraph(parseImportedGraph(legacyJson), { direction, layerGap: 200, nodeGap: 100 });
  const [a, b] = graph.nodes;
  if (direction === 'LR') expect(b.position.x - a.position.x - nodeSize(a).width).toBeGreaterThanOrEqual(200);
  if (direction === 'RL') expect(a.position.x - b.position.x - nodeSize(b).width).toBeGreaterThanOrEqual(200);
  if (direction === 'TB') expect(b.position.y - a.position.y - nodeSize(a).height).toBeGreaterThanOrEqual(200);
  if (direction === 'BT') expect(a.position.y - b.position.y - nodeSize(b).height).toBeGreaterThanOrEqual(200);
});
it('uses fallback with groups and preserves manual handles on engine failure', async () => {
  vi.spyOn(layoutEngine, 'layout').mockRejectedValue(new Error('engine failure'));
  const original = nested();
  original.edges[0] = {
    ...original.edges[0],
    sourceHandle: 'top',
    targetHandle: 'bottom',
    data: { handleMode: 'manual', lineStyle: 'dotted' },
  };
  const { graph, fallback } = await layoutGraph(original, { ...DEFAULT_LAYOUT, direction: 'BT' });
  expect(fallback).toBe(true);
  checkBounds(graph);
  expect(graph.edges[0]).toMatchObject({ sourceHandle: 'top', targetHandle: 'bottom', data: { lineStyle: 'dotted' } });
});
it('records one layout undo/redo including resized groups', async () => {
  const store = useGraphStore;
  store.getState().setGraph(nested());
  await store.getState().autoLayout({ ...DEFAULT_LAYOUT, direction: 'TB' });
  const result = toExportableGraph(store.getState());
  expect(store.getState().past).toHaveLength(1);
  store.getState().undo();
  expect(store.getState().nodes).toEqual(nested().nodes.map((node) => ({ ...node, zIndex: isGroup(node) ? 0 : 2 })));
  store.getState().redo();
  expect(toExportableGraph(store.getState())).toEqual(result);
});
it('rejects stale layouts after edit and undo even if content matches again', async () => {
  useGraphStore.getState().setGraph(sampleGraph);
  const pending = useGraphStore.getState().autoLayout();
  useGraphStore.getState().updateNodeData('react', { label: 'temporary' });
  useGraphStore.getState().undo();
  expect(await pending).toBe('stale');
  expect(useGraphStore.getState().canRedo).toBe(true);
});
it('does not cancel layout for selection-only changes', async () => {
  useGraphStore.getState().setGraph(sampleGraph);
  const pending = useGraphStore.getState().autoLayout();
  useGraphStore.getState().selectAll();
  expect(await pending).toBe('applied');
});
