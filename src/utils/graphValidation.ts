import { architectureNodeKinds } from '../types/graph';
export const DATA_VERSION = 1;
export const GRAPH_LIMITS = { nodes: 1000, edges: 5000, bytes: 5 * 1024 * 1024, hash: 1024 * 1024, depth: 32, text: 10000 };
export const URL_WARNING_LENGTH = 8000;
export const URL_MAX_LENGTH = 64000;
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export class GraphDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GraphDataError';
  }
}
export const fail = (path: string, message: string): never => {
  throw new GraphDataError('invalid', `${path}: ${message}`);
};
export const checkVersion = (value: unknown) => {
  if (value !== undefined && value !== DATA_VERSION)
    throw new GraphDataError('version', `지원하지 않는 데이터 버전(${String(value)})입니다. 지원 버전: ${DATA_VERSION}`);
};
const choices = (value: unknown, allowed: string[], path: string) => {
  if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) fail(path, '지원하지 않는 값입니다.');
};
const finite = (value: unknown, path: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '유한한 숫자가 필요합니다.');
};
const text = (value: unknown, path: string, required = true) => {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || value.length > GRAPH_LIMITS.text) fail(path, `문자열은 ${GRAPH_LIMITS.text}자 이하여야 합니다.`);
};
const color = (value: unknown, path: string) => {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) fail(path, '#RRGGBB 색상이 필요합니다.');
};
export function validateGraphInput(value: unknown): asserts value is { nodes: unknown[]; edges: unknown[] } {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) fail('문서', 'nodes/edges 배열이 필요합니다.');
  const graph = value as Record<string, unknown> & { nodes: unknown[]; edges: unknown[] };
  checkVersion(graph.version);
  if (graph.nodes.length > GRAPH_LIMITS.nodes || graph.edges.length > GRAPH_LIMITS.edges)
    throw new GraphDataError('size', `노드 ${GRAPH_LIMITS.nodes}개, 연결 ${GRAPH_LIMITS.edges}개까지 지원합니다.`);
  graph.nodes.forEach((raw, index) => {
    const path = `nodes[${index}]`;
    if (!record(raw) || !record(raw.data) || !record(raw.position)) fail(path, '노드 구조가 잘못되었습니다.');
    const node = raw as Record<string, unknown> & { data: Record<string, unknown>; position: Record<string, unknown> };
    text(node.id, `${path}.id`);
    if (!node.id) fail(path, '빈 ID입니다.');
    choices(node.type, ['architectureNode', 'groupNode'], `${path}.type`);
    finite(node.position.x, `${path}.x`);
    finite(node.position.y, `${path}.y`);
    choices(node.data.kind, [...architectureNodeKinds], `${path}.kind`);
    choices(node.data.category, ['Database', 'Server', 'Application', 'Cloud', 'Network', 'Group'], `${path}.category`);
    for (const field of ['kind', 'category', 'label', 'subtitle']) text(node.data[field], `${path}.${field}`);
    text(node.data.note, `${path}.note`, false);
    color(node.data.accent, `${path}.accent`);
    if (node.data.isGroup !== undefined && typeof node.data.isGroup !== 'boolean') fail(path, 'isGroup은 boolean이어야 합니다.');
    if (node.parentId !== undefined) text(node.parentId, `${path}.parentId`);
    choices(node.extent, ['parent'], `${path}.extent`);
    if (node.extent && !node.parentId) fail(path, 'extent에는 parentId가 필요합니다.');
    if (node.style !== undefined && !record(node.style)) fail(path, 'style은 객체여야 합니다.');
    for (const field of ['width', 'height']) {
      const size = record(node.style) ? node.style[field] : undefined;
      if (size !== undefined) {
        finite(size, `${path}.${field}`);
        if ((size as number) <= 0) fail(path, '크기는 양수여야 합니다.');
      }
    }
  });
  graph.edges.forEach((raw, index) => {
    const path = `edges[${index}]`;
    if (!record(raw)) fail(path, '연결은 객체여야 합니다.');
    const edge = raw as Record<string, unknown>;
    for (const field of ['id', 'source', 'target']) {
      text(edge[field], `${path}.${field}`);
      if (!edge[field]) fail(path, '빈 ID입니다.');
    }
    text(edge.label, `${path}.label`, false);
    for (const field of ['sourceHandle', 'targetHandle'])
      if (edge[field] != null) choices(edge[field], ['top', 'right', 'bottom', 'left'], `${path}.${field}`);
    if (edge.data !== undefined && !record(edge.data)) fail(path, 'data는 객체여야 합니다.');
    const data = record(edge.data) ? edge.data : {};
    const enums = {
      direction: ['forward', 'reverse', 'bidirectional'],
      handleMode: ['auto', 'manual'],
      labelMode: ['hidden', 'protocol', 'compact', 'full'],
      labelOrientation: ['auto', 'horizontal', 'vertical', 'verticalClockwise', 'verticalCounterclockwise'],
      lineStyle: ['solid', 'dashed', 'dotted'],
      pathStyle: ['smoothstep', 'step', 'straight'],
      arrowStyle: ['closed', 'open', 'none'],
    };
    for (const [field, options] of Object.entries(enums)) choices(data[field], options, `${path}.${field}`);
    text(data.label, `${path}.label`, false);
    if (data.color !== undefined) color(data.color, `${path}.color`);
    for (const field of ['manualLabelOffsetX', 'manualLabelOffsetY'])
      if (data[field] !== undefined) finite(data[field], `${path}.${field}`);
    if (data.showEndpoints !== undefined && typeof data.showEndpoints !== 'boolean')
      fail(`${path}.showEndpoints`, 'showEndpoints는 boolean이어야 합니다.');
  });
}
