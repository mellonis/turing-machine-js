import {defineConfig} from 'vitest/config';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    // Reset call-history of vi.fn()/vi.spyOn() between tests so state
    // can't leak across the few tests that use mocks.
    clearMocks: true,
    include: [
      'packages/*/src/**/*.spec.ts',
      'test/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Surface untested files in the report instead of ignoring files that
      // were never imported during the test run.
      all: true,
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/dist/**',
        'vitest.config.ts',
      ],
      // Hard floor for `npm run test:coverage` (CI). Daily `npm test` is
      // unaffected (no coverage run). Numbers chosen as ~current floor with
      // 1-2pt headroom — tighten if real coverage climbs.
      thresholds: {
        statements: 97,
        branches: 90,
        functions: 95,
        lines: 97,
      },
    },
  },
  resolve: {
    // Source-import aliases — same set the moduleNameMapper from the previous
    // jest.config.mjs files mapped, so per-package specs resolve to source
    // instead of requiring a prior build.
    alias: {
      '@turing-machine-js/machine': resolve(root, './packages/machine/src'),
      '@turing-machine-js/builder': resolve(root, './packages/builder/src'),
      '@turing-machine-js/library-binary-numbers': resolve(root, './packages/library-binary-numbers/src'),
      '@turing-machine-js/library-binary-numbers-bare': resolve(root, './packages/library-binary-numbers-bare/src'),
      '@turing-machine-js/visuals': resolve(root, './packages/visuals/src'),
    },
  },
});
