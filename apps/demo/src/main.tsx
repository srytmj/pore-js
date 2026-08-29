import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { App } from './App.js';
import './styles.css';

// pdf.js shares GlobalWorkerOptions across every importer of this module
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
