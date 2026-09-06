import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/reader-core',
  {
    test: {
      name: 'reader-react',
      root: './packages/reader-react',
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'demo',
      root: './apps/demo',
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    // Real-book corpus — excluded from `pnpm test`, run via `pnpm test:corpus`.
    // Needs `pnpm build` + `node scripts/fetch-corpus.mjs`; skips when empty.
    test: {
      name: 'corpus',
      include: ['test/corpus/**/*.test.ts'],
      environment: 'jsdom',
      testTimeout: 30_000,
    },
  },
]);
