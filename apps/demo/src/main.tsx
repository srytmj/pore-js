import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// self-hosted, bundled — no CDN. Hanken Grotesk = UI, Literata = reading serif.
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/literata/wght.css';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { setPdfWorkerSrc } from 'porejs';
import { App } from './App.js';
import './styles.css';

// Just a URL string — pdf.js itself stays in its own lazy chunk, loaded only
// when a PDF is opened.
setPdfWorkerSrc(pdfWorkerUrl);

// Offline shell + fixture cache. Dev builds skip it (HMR + SW don't mix well).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
