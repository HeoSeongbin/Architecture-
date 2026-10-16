import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/benchmarks/core.perf.ts'], fileParallelism: false } });
