import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ReaderSource } from '@pore/reader-core';

interface ReaderContextValue {
  source: ReaderSource;
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

export interface ReaderProviderProps {
  source: ReaderSource;
  children: ReactNode;
}

export function ReaderProvider({ source, children }: ReaderProviderProps) {
  const value = useMemo<ReaderContextValue>(() => ({ source }), [source]);
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReaderContext(): ReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error('useReaderContext must be used within <ReaderProvider>');
  return ctx;
}
