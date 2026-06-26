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
import { presentGraph } from './edgeUtils';

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

const minifyLabelMode = (labelMode?: ArchitectureEdgeData['labelMode'], showEndpoints?: boolean) => {
  const mode = labelMode ?? (showEndpoints ? 'compact' : 'protocol');
  if (mode === 'hidden') return 'h';
  if (mode === 'compact') return 'c';
  if (mode === 'full') return 'f';
  return undefined;
};

const expandLabelMode = (labelMode?: MinifiedEdge['m'], showEndpoints?: boolean): ArchitectureEdgeData['labelMode'] => {
  if (labelMode === 'h') return 'hidden';
  if (labelMode === 'c') return 'compact';
  if (labelMode === 'f') return 'full';
  return showEndpoints ? 'compact' : 'protocol';
};

const minifyLabelOrientation = (orientation?: ArchitectureEdgeData['labelOrientation']) => {
  if (orientation === 'horizontal') return 'h';
  if (orientation === 'vertical' || orientation === 'verticalClockwise') return 'v';
  if (orientation === 'verticalCounterclockwise') return 'w';
  return undefined;
};

const expandLabelOrientation = (orientation?: MinifiedEdge['r']): ArchitectureEdgeData['labelOrientation'] => {
  if (orientation === 'h') return 'horizontal';
  if (orientation === 'v') return 'verticalClockwise';
  if (orientation === 'w') return 'verticalCounterclockwise';
  return 'auto';
};

const minifyHandle = (handle?: string | null): MinifiedEdge['a'] => {
  if (handle === 'top') return 't';
  if (handle === 'right') return 'r';
  if (handle === 'bottom') return 'b';
  if (handle === 'left') return 'l';
  return undefined;
};

const expandHandle = (handle?: MinifiedEdge['a']) => {
  if (handle === 't') return 'top';
  if (handle === 'r') return 'right';
  if (handle === 'b') return 'bottom';
  if (handle === 'l') return 'left';
  return undefined;
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
    ...(node.parentId ? { g: node.parentId } : {}),
    ...(node.extent === 'parent' ? { e: 1 as const } : {}),
    ...(typeof (node.style?.width ?? node.width) === 'number' ? { w: Math.round(Number(node.style?.width ?? node.width)) } : {}),
    ...(typeof (node.style?.height ?? node.height) === 'number' ? { h: Math.round(Number(node.style?.height ?? node.height)) } : {}),
  })),
  e: state.edges.map<MinifiedEdge>((edge) => ({
    i: edge.id,
    s: edge.source,
    t: edge.target,
    ...(edge.data?.label ? { l: edge.data.label } : {}),
    ...(minifyDirection(edge.data?.direction) ? { d: minifyDirection(edge.data?.direction) } : {}),
    ...(minifyLabelMode(edge.data?.labelMode, edge.data?.showEndpoints) ? { m: minifyLabelMode(edge.data?.labelMode, edge.data?.showEndpoints) } : {}),
    ...(minifyLabelOrientation(edge.data?.labelOrientation) ? { r: minifyLabelOrientation(edge.data?.labelOrientation) } : {}),
    ...(edge.data?.handleMode === 'manual' ? { h: 1 as const } : {}),
    ...(edge.data?.manualLabelOffsetX ? { ox: Math.round(edge.data.manualLabelOffsetX) } : {}),
    ...(edge.data?.manualLabelOffsetY ? { oy: Math.round(edge.data.manualLabelOffsetY) } : {}),
    ...(minifyHandle(edge.sourceHandle) ? { a: minifyHandle(edge.sourceHandle) } : {}),
    ...(minifyHandle(edge.targetHandle) ? { z: minifyHandle(edge.targetHandle) } : {}),
    ...(edge.data?.showEndpoints ? { x: 1 as const } : {}),
    ...(edge.data?.routing === 'avoid' ? { v: 1 as const } : {}),
  })),
});

const expandGraph = (graph: MinifiedGraph): GraphState => {
  const nodes = graph.n.map<ArchitectureNode>((node) => ({
    id: node.i,
    type: node.t === 'groupNode' ? 'groupNode' : node.t === 'blockNode' ? 'blockNode' : 'architectureNode',
    position: { x: node.p[0], y: node.p[1] },
    data: node.d,
    ...(node.g ? { parentId: node.g } : {}),
    ...(node.e === 1 ? { extent: 'parent' as const } : {}),
    ...(node.w || node.h ? { style: { width: node.w ?? 520, height: node.h ?? 320 } } : {}),
  }));

  const edges = graph.e.map<ArchitectureEdge>((edge) => {
    const data: ArchitectureEdgeData = {
      direction: expandDirection(edge.d),
      label: edge.l,
      labelMode: expandLabelMode(edge.m, edge.x === 1),
      labelOrientation: expandLabelOrientation(edge.r),
      handleMode: edge.h === 1 ? 'manual' : 'auto',
      manualLabelOffsetX: edge.ox,
      manualLabelOffsetY: edge.oy,
      showEndpoints: edge.x === 1 || edge.m === 'c' || edge.m === 'f',
      routing: edge.v === 1 ? 'avoid' : undefined,
    };

    return {
      id: edge.i,
      source: edge.s,
      target: edge.t,
      data,
      label: edge.l,
      sourceHandle: expandHandle(edge.a),
      targetHandle: expandHandle(edge.z),
    };
  });

  return presentGraph({ nodes, edges });
};

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

