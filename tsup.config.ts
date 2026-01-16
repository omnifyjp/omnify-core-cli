import { defineConfig } from 'tsup';

export default defineConfig([
  // メインライブラリエクスポート（shebangなし）
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2022',
  },
  // CLI runner (with shebang)
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    target: 'es2022',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
