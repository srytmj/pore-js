import { defineConfig } from 'tsup';

export default defineConfig({
  // `search-worker` is emitted at the dist root so the `new URL(...)` in the
  // (inlined) search controller resolves relative to `dist/index.js`.
  entry: { index: 'src/index.ts', 'search-worker': 'src/search/search-worker.ts' },
  format: ['esm'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Keep `index.js` a single bundle; only `search-worker.js` splits off. The
  // `new URL('./search-worker.js', import.meta.url)` in the controller then
  // resolves next to `dist/index.js`.
  splitting: false,
  target: 'es2022',
  external: ['pdfjs-dist', 'fflate'],
});
