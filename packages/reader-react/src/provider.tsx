import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ReaderSource } from '@pore/reader-core';

interface ReaderProviderValue {
  source: ReaderSource;
}

const ProviderContext = createContext<ReaderProviderValue | null>(null);

export interface ReaderProviderProps {
  source: ReaderSource;
  children: ReactNode;
}

export function ReaderProvider({ source, children }: ReaderProviderProps) {
  const value = useMemo<ReaderProviderValue>(() => ({ source }), [source]);
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useReaderSource(): ReaderSource {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error('useReaderSource must be used within <ReaderProvider>');
  return ctx.source;
}
