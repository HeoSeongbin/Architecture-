/// <reference types="node" />
import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { BENCHMARK_SIZES, createBenchmarkGraph, summarize, type BenchmarkScenario } from './fixtures';
import { encodeStateToUrl, decodeStateFromUrl } from '../utils/urlUtils';
import { parseImportedGraph, toExportableGraph } from '../utils/jsonUtils';
import { layoutGraph } from '../utils/layoutGraph';
import { useGraphStore } from '../store/useGraphStore';

it('records reproducible core timings without claiming browser rendering performance', async () => {
  const rows: unknown[] = [];
  for (const scenario of ['chain', 'dense'] as BenchmarkScenario[])
    for (const count of BENCHMARK_SIZES) {
      const graph = createBenchmarkGraph(count, scenario);
      const hash = encodeStateToUrl(graph);
      const json = JSON.stringify(toExportableGraph(graph));
      const operations: Record<string, ReturnType<typeof summarize>> = {};
      const memoryBefore = process.memoryUsage().heapUsed;
      const sync = (name: string, action: () => void, setup = () => {}, samples = 15) => {
        setup();
        action(); // warmup excluded
        const values: number[] = [];
        for (let i = 0; i < samples; i++) {
          setup();
          const start = performance.now();
          action();
          values.push(performance.now() - start);
        }
        operations[name] = summarize(values);
      };
      sync('encode', () => {
        encodeStateToUrl(graph);
      });
      sync('decode', () => {
        expect(decodeStateFromUrl(hash).ok).toBe(true);
      });
      sync('jsonExport', () => {
        JSON.stringify(toExportableGraph(graph));
      });
      sync('jsonImport', () => {
        parseImportedGraph(JSON.parse(json));
      });
      sync(
        'selection30',
        () => {
          for (let i = 0; i < 30; i++) useGraphStore.getState().onNodesChange([{ type: 'select', id: 'bench-0', selected: i % 2 === 0 }]);
        },
        () => useGraphStore.getState().setGraph(graph),
      );
      sync(
        'drag30',
        () => {
          for (let i = 0; i < 30; i++)
            useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: i * 2, y: i }, dragging: true }]);
          useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 60, y: 30 }, dragging: false }]);
        },
        () => useGraphStore.getState().setGraph(graph),
      );
      await layoutGraph(graph); // warm engine
      const layout: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = await layoutGraph(graph);
        expect(result.fallback).toBe(false);
        layout.push(performance.now() - start);
      }
      operations.layout = summarize(layout);
      const row = {
        count,
        edges: graph.edges.length,
        scenario,
        hashLength: hash.length,
        jsonBytes: Buffer.byteLength(json),
        heapDeltaBytes: process.memoryUsage().heapUsed - memoryBefore,
        operations,
      };
      rows.push(row);
      console.info(`BENCH ${scenario} ${count}: ${JSON.stringify(operations)}`);
    }
  mkdirSync('docs/benchmarks', { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    runtime: process.version,
    platform: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model,
    note: 'Node core only, warmup excluded; heap delta is GC-dependent and is not peak/retained/native memory.',
    rows,
  };
  writeFileSync(process.env.BENCH_REPORT ?? 'docs/benchmarks/core-latest.json', JSON.stringify(report, null, 2) + '\n');
}, 240000);
