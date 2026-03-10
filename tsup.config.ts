import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'core/index': 'src/core/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist',
    clean: true,
    splitting: false,
  },
  {
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    platform: 'browser',
    splitting: false,
  },
  {
    entry: {
      'node/index': 'src/node/index.ts',
      'node/cli': 'src/node/cli.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist',
    platform: 'node',
    splitting: false,
  },
]);
