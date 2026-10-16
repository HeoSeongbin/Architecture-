import type { GraphState } from '../types/graph';
// Fast path for selection/measurements: compare only the fields serialized to JSON/URL.
export function hasPersistentGraphChange(next: GraphState, previous: GraphState) {
  if (next.nodes.length !== previous.nodes.length || next.edges.length !== previous.edges.length) return true;
  for (let index = 0; index < next.nodes.length; index++) {
    const a = next.nodes[index],
      b = previous.nodes[index];
    if (a === b) continue;
    if (
      a.id !== b.id ||
      a.type !== b.type ||
      a.parentId !== b.parentId ||
      a.extent !== b.extent ||
      a.data !== b.data ||
      a.position.x !== b.position.x ||
      a.position.y !== b.position.y ||
      a.width !== b.width ||
      a.height !== b.height
    )
      return true;
    if (a.style !== b.style && JSON.stringify(a.style) !== JSON.stringify(b.style)) return true;
  }
  for (let index = 0; index < next.edges.length; index++) {
    const a = next.edges[index],
      b = previous.edges[index];
    if (a === b) continue;
    if (
      a.id !== b.id ||
      a.source !== b.source ||
      a.target !== b.target ||
      a.sourceHandle !== b.sourceHandle ||
      a.targetHandle !== b.targetHandle ||
      a.data !== b.data
    )
      return true;
  }
  return false;
}
