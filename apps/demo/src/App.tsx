import { DEFAULT_IMAGE_SETTINGS, DemoSource, VERSION } from '@pore/reader-core';
import { ReaderProvider } from '@pore/reader-react';
import { useMemo } from 'react';

export function App() {
  const source = useMemo(() => new DemoSource(), []);

  return (
    <ReaderProvider source={source}>
      <main className="shell">
        <h1>Pore.js</h1>
        <p>
          Reader engine scaffold — <code>@pore/reader-core@{VERSION}</code>. The image engine lands
          in M0.
        </p>
        <pre>{JSON.stringify(DEFAULT_IMAGE_SETTINGS, null, 2)}</pre>
      </main>
    </ReaderProvider>
  );
}
