import { architectureAssets } from '../data/assets';
import type { GraphState } from '../types/graph';

export const BENCHMARK_SIZES = [10, 50, 100, 300] as const;
export type BenchmarkScenario = 'chain' | 'dense';
export function createBenchmarkGraph(count: number, scenario: BenchmarkScenario = 'dense'): GraphState {
  const columns = Math.ceil(Math.sqrt(count));
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `bench-${index}`,
    type: 'architectureNode' as const,
    position: { x: (index % columns) * 256, y: Math.floor(index / columns) * 160 },
    data: { ...architectureAssets[index % architectureAssets.length], label: `노드 ${index + 1}`, note: '재현 가능한 성능 측정 데이터' },
  }));
  const edges: GraphState['edges'] = [];
  const connect = (source: number, target: number, suffix: string) => {
    if (source === target || target >= count) return;
    edges.push({
      id: `edge-${source}-${target}-${suffix}`,
      source: `bench-${source}`,
      target: `bench-${target}`,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: { label: 'HTTPS', labelMode: 'protocol' },
    });
  };
  for (let index = 0; index < count; index++) {
    connect(index, index + 1, 'chain');
    if (scenario === 'dense') {
      connect(index, index + 7, 'skip');
      connect(index, index + columns, 'row');
      if (index > 0 && index % 20 === 0) connect(index, index - 10, 'cycle');
    }
  }
  return { nodes, edges };
}
export function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(2)),
    p95Ms: Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2)),
    maxMs: Number(sorted.at(-1)!.toFixed(2)),
  };
}
