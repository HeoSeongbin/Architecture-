import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createBenchmarkGraph, BENCHMARK_SIZES } = await server.ssrLoadModule('/src/benchmarks/fixtures.ts');
  await mkdir('benchmarks/fixtures', { recursive: true });
  for (const count of BENCHMARK_SIZES)
    for (const scenario of ['chain', 'dense']) {
      await writeFile(
        `benchmarks/fixtures/${scenario}-${count}.json`,
        JSON.stringify({ version: 1, ...createBenchmarkGraph(count, scenario) }, null, 2) + '\n',
      );
    }
} finally {
  await server.close();
}
