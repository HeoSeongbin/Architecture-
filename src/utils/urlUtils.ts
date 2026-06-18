import base64 from 'base-64';
import { deflate, inflate } from 'pako';
import type {
  ArchitectureEdge,
  ArchitectureEdgeData,
  ArchitectureNode,
  GraphState,
  MinifiedEdge,
  MinifiedGraph,
  MinifiedNode,
} from '../types/graph';
import { getEdgeVisuals } from './edgeUtils';

const minifyDirection = (direction?: ArchitectureEdgeData['direction']) => {
  if (direction === 'reverse') return 'r';
  if (direction === 'bidirectional') return 'b';
  return undefined;
};

const expandDirection = (direction?: MinifiedEdge['d']): ArchitectureEdgeData['direction'] => {
  if (direction === 'r') return 'reverse';
  if (direction === 'b') return 'bidirectional';
  return 'forward';
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBinary = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return binary;
};

const binaryToBytes = (binary: string) => {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toUrlSafe = (value: string) => value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '~');
const fromUrlSafe = (value: string) => value.replaceAll('-', '+').replaceAll('_', '/').replaceAll('~', '=');

const minifyGraph = (state: GraphState): MinifiedGraph => ({
  n: state.nodes.map<MinifiedNode>((node) => ({
    i: node.id,
    t: node.type ?? 'architectureNode',
    p: [Math.round(node.position.x), Math.round(node.position.y)],
    d: node.data,
  })),
  e: state.edges.map<MinifiedEdge>((edge) => ({
    i: edge.id,
    s: edge.source,
    t: edge.target,
    ...(edge.data?.label ? { l: edge.data.label } : {}),
    ...(minifyDirection(edge.data?.direction) ? { d: minifyDirection(edge.data?.direction) } : {}),
  })),
});

const expandGraph = (graph: MinifiedGraph): GraphState => ({
  nodes: graph.n.map<ArchitectureNode>((node) => ({
    id: node.i,
    type: 'architectureNode',
    position: { x: node.p[0], y: node.p[1] },
    data: node.d,
  })),
  edges: graph.e.map<ArchitectureEdge>((edge) => {
    const data: ArchitectureEdgeData = { direction: expandDirection(edge.d), label: edge.l };

    return {
      id: edge.i,
      source: edge.s,
      target: edge.t,
      data,
      label: edge.l,
      ...getEdgeVisuals(data),
    };
  }),
});

export const encodeStateToUrl = (state: GraphState) => {
  if (state.nodes.length === 0 && state.edges.length === 0) return '';

  const json = JSON.stringify(minifyGraph(state));
  const compressed = deflate(textEncoder.encode(json));
  return toUrlSafe(base64.encode(bytesToBinary(compressed)));
};

export const decodeStateFromUrl = (
  hash: string,
): { ok: true; state: GraphState } | { ok: false; state: GraphState; error: unknown } => {
  const value = hash.replace(/^#/, '').trim();
  if (!value) return { ok: true, state: { nodes: [], edges: [] } };

  try {
    const binary = base64.decode(fromUrlSafe(value));
    const inflated = inflate(binaryToBytes(binary));
    const graph = JSON.parse(textDecoder.decode(inflated)) as MinifiedGraph;
    return { ok: true, state: expandGraph(graph) };
  } catch (error) {
    return { ok: false, state: { nodes: [], edges: [] }, error };
  }
};
