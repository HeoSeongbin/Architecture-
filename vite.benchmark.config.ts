import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base, defineConfig({ build: { outDir: 'benchmark-dist', rollupOptions: { input: 'benchmarks/index.html' } } }));
