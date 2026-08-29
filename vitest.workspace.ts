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
]);
