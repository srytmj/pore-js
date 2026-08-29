import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  createImageEngine,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_KEYMAP,
  type ImageEngine,
  type ImageEngineEvents,
  type ImageEngineSettings,
  type Keymap,
  type Position,
  type TurnDirection,
} from '@pore/reader-core';
import { useReaderSource } from './provider.js';

export interface ReaderLocation {
  page: number;
  label: string;
  position: Position;
  chapter?: string;
}

export interface ReaderHandle {
  turn(dir: TurnDirection): void;
  goto(page: number): void;
  setSettings(patch: Partial<ImageEngineSettings>): void;
  setKeymap(patch: Partial<Keymap>): void;
}

interface ReaderCtx {
  location: ReaderLocation | null;
  settings: ImageEngineSettings;
  keymap: Keymap;
  resumedFromPage: number | null;
  handle: ReaderHandle;
}

const RuntimeContext = createContext<ReaderCtx | null>(null);

export interface ReaderProps {
  bookId: string;
  initialSettings?: Partial<ImageEngineSettings>;
  onPositionChange?: (loc: ReaderLocation) => void;
  className?: string;
  /** Chrome (bars, toasts, settings panels) rendered above the reader surface, inside the hook context. */
  children?: ReactNode;
  ref?: Ref<ReaderHandle>;
}

export function Reader({
  bookId,
  initialSettings,
  onPositionChange,
  className,
  children,
  ref,
}: ReaderProps) {
  const source = useReaderSource();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ImageEngine | null>(null);
  const onPosRef = useRef(onPositionChange);
  onPosRef.current = onPositionChange;

  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [settings, setSettings] = useState<ImageEngineSettings>(() => ({
    ...DEFAULT_IMAGE_SETTINGS,
    ...initialSettings,
  }));
  const [keymap, setKeymap] = useState<Keymap>(DEFAULT_KEYMAP);
  const [resumedFromPage, setResumedFromPage] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = createImageEngine({
      container: host,
      source,
      bookId,
      ...(initialSettings ? { settings: initialSettings } : {}),
    });
    engineRef.current = engine;

    const offs: Array<() => void> = [
      engine.on('reader:locationchange', (p: ImageEngineEvents['reader:locationchange']) => {
        const loc: ReaderLocation = {
          page: p.page,
          label: p.label,
          position: p.position,
          ...(p.chapter ? { chapter: p.chapter } : {}),
        };
        setLocation(loc);
        onPosRef.current?.(loc);
      }),
      engine.on('reader:resumed', (p) => {
        setResumedFromPage(p.position && p.page > 0 ? p.page : null);
      }),
      engine.on('reader:settingschange', (p) => {
        setSettings(p.settings);
        setKeymap(p.keymap);
      }),
    ];

    void engine.mount();
    return () => {
      for (const off of offs) off();
      engine.destroy();
      engineRef.current = null;
    };
    // remount only when the book or source changes
  }, [source, bookId]);

  const handle = useMemo<ReaderHandle>(
    () => ({
      turn: (d) => engineRef.current?.turn(d),
      goto: (p) => engineRef.current?.goto(p),
      setSettings: (patch) => engineRef.current?.setSettings(patch),
      setKeymap: (patch) => engineRef.current?.setKeymap(patch),
    }),
    [],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  const ctx = useMemo<ReaderCtx>(
    () => ({ location, settings, keymap, resumedFromPage, handle }),
    [location, settings, keymap, resumedFromPage, handle],
  );

  return (
    <RuntimeContext.Provider value={ctx}>
      {children}
      <div ref={hostRef} className={className} style={{ flex: 1, minHeight: 0, width: '100%' }} />
    </RuntimeContext.Provider>
  );
}

function useRuntime(): ReaderCtx {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('Reader hooks must be used inside <Reader>');
  return ctx;
}

export function useReaderLocation(): ReaderLocation | null {
  return useRuntime().location;
}

export function useReaderSettings(): [ImageEngineSettings, ReaderHandle['setSettings']] {
  const { settings, handle } = useRuntime();
  return [settings, handle.setSettings];
}

export function useReaderKeymap(): [Keymap, ReaderHandle['setKeymap']] {
  const { keymap, handle } = useRuntime();
  return [keymap, handle.setKeymap];
}

export function useReader(): ReaderHandle {
  return useRuntime().handle;
}

export function useResumedFromPage(): number | null {
  return useRuntime().resumedFromPage;
}
