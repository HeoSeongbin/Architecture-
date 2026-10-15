import { parseImportedGraph } from './jsonUtils';
import { DATA_VERSION, GRAPH_LIMITS, checkVersion, record, fail, GraphDataError } from './graphValidation';
import base64 from 'base-64';
import { deflate, Inflate } from 'pako';
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
  v: DATA_VERSION,
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
    ...(edge.data?.color ? { c: edge.data.color } : {}),
    ...(edge.data?.lineStyle && edge.data.lineStyle !== 'solid' ? { k: edge.data.lineStyle } : {}),
    ...(edge.data?.pathStyle && edge.data.pathStyle !== 'smoothstep' ? { q: edge.data.pathStyle } : {}),
    ...(edge.data?.arrowStyle && edge.data.arrowStyle !== 'closed' ? { u: edge.data.arrowStyle } : {}),
    ...(edge.data?.label ? { l: edge.data.label } : {}),
    ...(minifyDirection(edge.data?.direction) ? { d: minifyDirection(edge.data?.direction) } : {}),
    ...(minifyLabelMode(edge.data?.labelMode, edge.data?.showEndpoints)
      ? { m: minifyLabelMode(edge.data?.labelMode, edge.data?.showEndpoints) }
      : {}),
    ...(minifyLabelOrientation(edge.data?.labelOrientation) ? { r: minifyLabelOrientation(edge.data?.labelOrientation) } : {}),
    ...(edge.data?.handleMode === 'manual' ? { h: 1 as const } : {}),
    ...(edge.data?.manualLabelOffsetX ? { ox: Math.round(edge.data.manualLabelOffsetX) } : {}),
    ...(edge.data?.manualLabelOffsetY ? { oy: Math.round(edge.data.manualLabelOffsetY) } : {}),
    ...(minifyHandle(edge.sourceHandle) ? { a: minifyHandle(edge.sourceHandle) } : {}),
    ...(minifyHandle(edge.targetHandle) ? { z: minifyHandle(edge.targetHandle) } : {}),
    ...(edge.data?.showEndpoints ? { x: 1 as const } : {}),
  })),
});

const expandGraph = (graph: MinifiedGraph): GraphState => {
  const nodes = graph.n.map<ArchitectureNode>((node) => ({
    id: node.i,
    type: node.t === 'groupNode' ? 'groupNode' : 'architectureNode',
    position: { x: node.p[0], y: node.p[1] },
    data: node.d,
    ...(node.g ? { parentId: node.g } : {}),
    ...(node.e === 1 ? { extent: 'parent' as const } : {}),
    ...(node.w || node.h
      ? { style: { width: node.w ?? (node.t === 'groupNode' ? 520 : 208), height: node.h ?? (node.t === 'groupNode' ? 320 : 112) } }
      : {}),
  }));

  const edges = graph.e.map<ArchitectureEdge>((edge) => {
    const data: ArchitectureEdgeData = {
      ...(edge.c ? { color: edge.c } : {}),
      ...(edge.k ? { lineStyle: edge.k } : {}),
      ...(edge.q ? { pathStyle: edge.q } : {}),
      ...(edge.u ? { arrowStyle: edge.u } : {}),
      direction: expandDirection(edge.d),
      label: edge.l,
      labelMode: expandLabelMode(edge.m, edge.x === 1),
      labelOrientation: expandLabelOrientation(edge.r),
      handleMode: edge.h === 1 ? 'manual' : 'auto',
      manualLabelOffsetX: edge.ox,
      manualLabelOffsetY: edge.oy,
      showEndpoints: edge.x === 1 || edge.m === 'c' || edge.m === 'f',
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

  if (state.nodes.length > GRAPH_LIMITS.nodes || state.edges.length > GRAPH_LIMITS.edges)
    throw new GraphDataError('size', '노드/연결 개수 제한을 초과했습니다. JSON으로 백업하세요.');
  const json = JSON.stringify(minifyGraph(state));
  const bytes = textEncoder.encode(json);
  if (bytes.length > GRAPH_LIMITS.bytes) throw new GraphDataError('size', '저장 데이터가 5 MiB를 초과했습니다. JSON으로 백업하세요.');
  const compressed = deflate(bytes);
  return toUrlSafe(base64.encode(bytesToBinary(compressed)));
};

export const decodeStateFromUrl = (hash: string): { ok: true; state: GraphState } | { ok: false; state: GraphState; error: unknown } => {
  const value = hash.replace(/^#/, '').trim();
  if (!value) return { ok: true, state: { nodes: [], edges: [] } };

  try {
    if (value.length > GRAPH_LIMITS.hash) throw new GraphDataError('size', '압축 URL이 1 MiB를 초과했습니다. JSON 파일을 사용하세요.');
    if (!/^[A-Za-z0-9_-]+~{0,2}$/.test(value)) fail('URL', 'Base64 형식이 잘못되었습니다.');
    const inflater = new Inflate({ chunkSize: 16384 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    inflater.onData = (chunk: Uint8Array) => {
      size += chunk.length;
      if (size > GRAPH_LIMITS.bytes) throw new GraphDataError('size', '압축 해제 데이터가 5 MiB를 초과했습니다.');
      chunks.push(chunk);
    };
    inflater.push(binaryToBytes(base64.decode(fromUrlSafe(value))), true);
    if (inflater.err || !('ended' in inflater && inflater.ended)) fail('URL', '압축 데이터가 손상되었거나 잘렸습니다.');
    const inflated = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      inflated.set(chunk, offset);
      offset += chunk.length;
    }
    const graph: unknown = JSON.parse(textDecoder.decode(inflated));
    validateCompact(graph);
    return { ok: true, state: parseImportedGraph(expandGraph(graph)) };
  } catch (error) {
    return { ok: false, state: { nodes: [], edges: [] }, error };
  }
};

function validateCompact(value: unknown): asserts value is MinifiedGraph {
  if (!record(value)) fail('URL', '문서 객체가 필요합니다.');
  const graph = value as Record<string, unknown>;
  checkVersion(graph.v);
  if (!Array.isArray(graph.n) || !Array.isArray(graph.e)) fail('URL', 'n/e 배열이 필요합니다.');
  const nodes = graph.n as unknown[],
    edges = graph.e as unknown[];
  if (nodes.length > GRAPH_LIMITS.nodes || edges.length > GRAPH_LIMITS.edges)
    throw new GraphDataError('size', '노드/연결 개수 제한을 초과했습니다.');
  nodes.forEach((node, index) => {
    if (!record(node) || !Array.isArray(node.p) || node.p.length !== 2) fail(`n[${index}]`, '좌표 배열이 필요합니다.');
    const raw = node as Record<string, unknown>;
    if (raw.t !== undefined && !['architectureNode', 'groupNode'].includes(String(raw.t))) fail(`n[${index}].t`, '잘못된 노드 종류입니다.');
    if (raw.e !== undefined && raw.e !== 1) fail(`n[${index}].e`, '잘못된 extent입니다.');
    for (const field of ['w', 'h'])
      if (raw[field] !== undefined && (typeof raw[field] !== 'number' || !Number.isFinite(raw[field]) || Number(raw[field]) <= 0))
        fail(`n[${index}].${field}`, '양수 크기가 필요합니다.');
  });
  const enums: Record<string, unknown[]> = {
    d: ['r', 'b'],
    m: ['h', 'c', 'f'],
    r: ['h', 'v', 'w'],
    h: [1],
    x: [1],
    a: ['t', 'r', 'b', 'l'],
    z: ['t', 'r', 'b', 'l'],
  };
  edges.forEach((edge, index) => {
    if (!record(edge)) fail(`e[${index}]`, '연결 객체가 필요합니다.');
    const raw = edge as Record<string, unknown>;
    for (const field of ['i', 's', 't', 'l', 'c', 'k', 'q', 'u'])
      if (raw[field] !== undefined && (typeof raw[field] !== 'string' || !raw[field]))
        fail(`e[${index}].${field}`, '빈 문자열이 아닌 문자열이 필요합니다.');
    for (const [key, options] of Object.entries(enums))
      if (raw[key] !== undefined && !options.includes(raw[key])) fail(`e[${index}].${key}`, '지원하지 않는 값입니다.');
  });
}
