import {defineConfig} from 'vitest/config';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    include: [
      'packages/*/src/**/*.spec.ts',
      'test/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    // Source-import aliases — match the moduleNameMapper from jest.config.mjs
    // so per-package specs resolve to source instead of requiring a prior build.
    alias: {
      '@turing-machine-js/machine': resolve(root, './packages/machine/src'),
      '@turing-machine-js/builder': resolve(root, './packages/builder/src'),
      '@turing-machine-js/library-binary-numbers': resolve(root, './packages/library-binary-numbers/src'),
      '@turing-machine-js/library-binary-numbers-bare': resolve(root, './packages/library-binary-numbers-bare/src'),
    },
  },
});
