import { useRef } from 'react';

export interface SampleBook {
  id: string;
  label: string;
  /** One line on what engine mode / feature this sample shows off. */
  blurb: string;
  settings?: Record<string, unknown>;
}

export function Landing({
  books,
  onFiles,
  onSample,
}: {
  books: SampleBook[];
  onFiles: (files: FileList | File[]) => void;
  onSample: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="landing">
      <div className="landing__inner">
        <header className="landing__head">
          <h1 className="landing__title">Pore.js</h1>
          <p className="landing__tagline">
            A source-agnostic web reader for manga, comics, and books.
          </p>
        </header>

        <section className="landing__section">
          <h2 className="landing__h2">Open your own</h2>
          <button
            type="button"
            className="landing__drop"
            onClick={() => inputRef.current?.click()}
          >
            <span className="landing__drop-icon" aria-hidden>
              ⬆
            </span>
            <span className="landing__drop-title">Drop a file here, or click to choose</span>
            <span className="landing__drop-hint">
              EPUB · PDF · CBZ / ZIP · a folder of images — it stays in your browser, nothing is
              uploaded
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".epub,.pdf,.cbz,.zip,image/*"
            className="landing__file"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
            }}
          />
        </section>

        <section className="landing__section">
          <h2 className="landing__h2">Or try every mode</h2>
          <ul className="landing__samples">
            {books.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onSample(b.id)}>
                  <span className="landing__sample-label">{b.label}</span>
                  <span className="landing__sample-blurb">{b.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
