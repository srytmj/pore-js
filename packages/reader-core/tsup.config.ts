import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // `search-worker` is emitted at the dist root so the `new URL(...)` in the
  // (inlined) search controller resolves relative to `dist/index.js`.
  entry: {
    index: 'src/index.ts',
    internal: 'src/internal/index.ts',
    'search-worker': 'src/search/search-worker.ts',
  },
  format: ['esm'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Multi-entry (`index` + `internal`): let tsup hoist shared code into chunks
  // rather than duplicating the engine internals into `internal.js`. The
  // `search-worker` entry stays whole; `new Worker(new URL('./search-worker.js',
  // import.meta.url))` in the controller resolves next to `dist/index.js`.
  splitting: true,
  target: 'es2022',
  external: ['pdfjs-dist', 'fflate'],
  define: { __POREJS_VERSION__: JSON.stringify(version) },
});
