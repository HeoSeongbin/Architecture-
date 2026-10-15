import { describe, expect, it } from 'vitest';
import base64 from 'base-64';
import { deflate } from 'pako';
import { sampleGraph } from '../data/sampleGraph';
import { decodeStateFromUrl, encodeStateToUrl } from './urlUtils';
import { normalizeImportedGraph, toExportableGraph } from './jsonUtils';

describe('URL compatibility', () => {
  it('round trips the existing sample and Korean text', () => {
    const graph = structuredClone(sampleGraph);
    graph.nodes[0].data.label = '사용자 <>& / 🚀';
    const result = decodeStateFromUrl(`#${encodeStateToUrl(graph)}`);
    expect(result.ok).toBe(true);
    expect(result.state.nodes).toEqual(graph.nodes);
    expect(result.state.edges.map((edge) => edge.data?.label)).toEqual(graph.edges.map((edge) => edge.data?.label));
  });
  it('restores legacy minified data without optional fields', () => {
    const legacy = {
      n: sampleGraph.nodes.map((node) => ({ i: node.id, t: node.type, p: [node.position.x, node.position.y], d: node.data })),
      e: [{ i: 'legacy', s: 'react', t: 'nginx', l: 'HTTPS' }],
    };
    const hash = base64
      .encode(String.fromCharCode(...deflate(JSON.stringify(legacy))))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '~');
    const decoded = decodeStateFromUrl(hash);
    expect(decoded.ok).toBe(true);
    expect(decoded.state.edges[0].data).toMatchObject({ label: 'HTTPS', direction: 'forward', labelMode: 'protocol' });
  });
  it('handles empty and corrupt URLs safely', () => {
    expect(encodeStateToUrl({ nodes: [], edges: [] })).toBe('');
    expect(decodeStateFromUrl('')).toEqual({ ok: true, state: { nodes: [], edges: [] } });
    expect(decodeStateFromUrl('#broken').ok).toBe(false);
  });
  it('round trips 300 nodes', () => {
    const nodes = Array.from({ length: 300 }, (_, i) => ({ ...sampleGraph.nodes[0], id: `node-${i}` }));
    expect(decodeStateFromUrl(encodeStateToUrl({ nodes, edges: [] })).state.nodes).toHaveLength(300);
  });
});

describe('JSON import and export', () => {
  it('round trips sample, group dimensions, parent and manual edge settings', () => {
    const graph = structuredClone(sampleGraph);
    graph.nodes.unshift({
      ...graph.nodes[0],
      id: 'group',
      type: 'groupNode',
      style: { width: 600, height: 400 },
      data: { ...graph.nodes[0].data, kind: 'group', isGroup: true },
    });
    graph.nodes[1].parentId = 'group';
    graph.edges[0].data = {
      direction: 'reverse',
      labelMode: 'full',
      labelOrientation: 'verticalCounterclockwise',
      handleMode: 'manual',
      manualLabelOffsetX: 30,
    };
    const result = normalizeImportedGraph(JSON.parse(JSON.stringify(toExportableGraph(graph))));
    expect(result?.nodes[0].style).toEqual({ width: 600, height: 400 });
    expect(result?.nodes[1].parentId).toBe('group');
    expect(result?.edges[0].data).toMatchObject(graph.edges[0].data!);
    const decoded = decodeStateFromUrl(encodeStateToUrl(graph));
    expect(decoded.state.nodes[1].parentId).toBe('group');
    expect(decoded.state.nodes[0].style).toEqual({ width: 600, height: 400 });
    expect(decoded.state.edges[0].data).toMatchObject(graph.edges[0].data!);
  });
  it.each([null, {}, { nodes: [{}], edges: [] }, { nodes: [], edges: [{}] }])('rejects malformed data atomically: %j', (value) => {
    expect(normalizeImportedGraph(value)).toBeNull();
  });
  it('rejects duplicate IDs, dangling edges, missing parents and cycles', () => {
    expect(normalizeImportedGraph({ nodes: [sampleGraph.nodes[0], sampleGraph.nodes[0]], edges: [] })).toBeNull();
    expect(normalizeImportedGraph({ nodes: [], edges: sampleGraph.edges })).toBeNull();
    expect(normalizeImportedGraph({ nodes: [{ ...sampleGraph.nodes[0], parentId: 'missing' }], edges: [] })).toBeNull();
    expect(normalizeImportedGraph({ nodes: [{ ...sampleGraph.nodes[0], type: 'groupNode', parentId: 'react' }], edges: [] })).toBeNull();
  });
  it('rejects non-finite coordinates and retains legacy edge labels', () => {
    expect(normalizeImportedGraph({ nodes: [{ ...sampleGraph.nodes[0], position: { x: Infinity, y: 0 } }], edges: [] })).toBeNull();
    expect(
      normalizeImportedGraph({ nodes: sampleGraph.nodes, edges: [{ id: 'old', source: 'react', target: 'nginx', label: '기존' }] })
        ?.edges[0].data?.label,
    ).toBe('기존');
  });
});
