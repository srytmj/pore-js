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
  createTextEngine,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_KEYMAP,
  DEFAULT_TEXT_SETTINGS,
  type ImageEngineSettings,
  type Keymap,
  type Position,
  type TextEngineSettings,
  type TocEntry,
  type TurnDirection,
} from '@pore/reader-core';
import { useReaderSource } from './provider.js';

export type ReaderKind = 'image' | 'text';
export type AnySettings = ImageEngineSettings | TextEngineSettings;

export interface ReaderLocation {
  page: number;
  label: string;
  position: Position;
  percent: number;
  chapter?: string;
}

export interface Footnote {
  html: string;
  href: string;
}

export interface ReaderHandle {
  turn(dir: TurnDirection): void;
  goto(target: number | Position): void;
  goToHref(href: string): void;
  setSettings(patch: Partial<AnySettings>): void;
  setKeymap(patch: Partial<Keymap>): void;
}

interface EngineLike {
  mount(): Promise<void>;
  turn(dir: TurnDirection): void;
  goto(target: never): void;
  goToHref?(href: string): void;
  setSettings(patch: never): void;
  setKeymap?(patch: Partial<Keymap>): void;
  on(event: string, handler: (payload: never) => void): () => void;
  destroy(): void;
}

interface ReaderCtx {
  kind: ReaderKind | null;
  location: ReaderLocation | null;
  settings: AnySettings;
  keymap: Keymap;
  toc: TocEntry[];
  footnote: Footnote | null;
  clearFootnote: () => void;
  resumedFromPage: number | null;
  handle: ReaderHandle;
}

const RuntimeContext = createContext<ReaderCtx | null>(null);

export interface ReaderProps {
  bookId: string;
  initialSettings?: Partial<AnySettings>;
  onPositionChange?: (loc: ReaderLocation) => void;
  className?: string;
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
  const engineRef = useRef<EngineLike | null>(null);
  const onPosRef = useRef(onPositionChange);
  onPosRef.current = onPositionChange;

  const [kind, setKind] = useState<ReaderKind | null>(null);
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [settings, setSettings] = useState<AnySettings>(() => ({
    ...DEFAULT_IMAGE_SETTINGS,
    ...initialSettings,
  }));
  const [keymap, setKeymap] = useState<Keymap>(DEFAULT_KEYMAP);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [footnote, setFootnote] = useState<Footnote | null>(null);
  const [resumedFromPage, setResumedFromPage] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const offs: Array<() => void> = [];

    void (async () => {
      const manifest = await source.getManifest(bookId);
      if (disposed) return;
      const isText = manifest.type !== 'image';
      setKind(isText ? 'text' : 'image');
      setSettings(
        isText
          ? { ...DEFAULT_TEXT_SETTINGS, ...initialSettings }
          : { ...DEFAULT_IMAGE_SETTINGS, ...initialSettings },
      );

      const engine = (isText
        ? createTextEngine({
            container: host,
            source,
            bookId,
            ...(initialSettings
              ? { settings: initialSettings as Partial<TextEngineSettings> }
              : {}),
          })
        : createImageEngine({
            container: host,
            source,
            bookId,
            ...(initialSettings
              ? { settings: initialSettings as Partial<ImageEngineSettings> }
              : {}),
          })) as unknown as EngineLike;
      engineRef.current = engine;

      offs.push(
        engine.on('reader:locationchange', (p: never) => {
          const q = p as {
            page: number;
            label: string;
            position: Position;
            percent?: number;
            chapter?: string;
          };
          const loc: ReaderLocation = {
            page: q.page,
            label: q.label,
            position: q.position,
            percent: q.percent ?? 0,
            ...(q.chapter ? { chapter: q.chapter } : {}),
          };
          setLocation(loc);
          onPosRef.current?.(loc);
        }),
        engine.on('reader:resumed', (p: never) => {
          const q = p as { position: Position | null; page?: number };
          setResumedFromPage(q.position ? (q.page ?? 1) : null);
        }),
        engine.on('reader:settingschange', (p: never) => {
          const q = p as { settings: AnySettings; keymap?: Keymap };
          setSettings(q.settings);
          if (q.keymap) setKeymap(q.keymap);
        }),
        engine.on('reader:toc', (p: never) => setToc((p as { toc: TocEntry[] }).toc)),
        engine.on('reader:footnote', (p: never) => setFootnote(p as Footnote)),
      );

      await engine.mount();
    })();

    return () => {
      disposed = true;
      for (const off of offs) off();
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [source, bookId]);

  const handle = useMemo<ReaderHandle>(
    () => ({
      turn: (d) => engineRef.current?.turn(d),
      goto: (t) => engineRef.current?.goto(t as never),
      goToHref: (href) => engineRef.current?.goToHref?.(href),
      setSettings: (patch) => engineRef.current?.setSettings(patch as never),
      setKeymap: (patch) => engineRef.current?.setKeymap?.(patch),
    }),
    [],
  );
  const clearFootnote = useMemo(() => () => setFootnote(null), []);

  useImperativeHandle(ref, () => handle, [handle]);

  const ctx = useMemo<ReaderCtx>(
    () => ({
      kind,
      location,
      settings,
      keymap,
      toc,
      footnote,
      clearFootnote,
      resumedFromPage,
      handle,
    }),
    [kind, location, settings, keymap, toc, footnote, clearFootnote, resumedFromPage, handle],
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

export function useReaderKind(): ReaderKind | null {
  return useRuntime().kind;
}

export function useReaderLocation(): ReaderLocation | null {
  return useRuntime().location;
}

export function useReaderSettings<T extends AnySettings = AnySettings>(): [
  T,
  (patch: Partial<T>) => void,
] {
  const { settings, handle } = useRuntime();
  return [settings as T, handle.setSettings as (patch: Partial<T>) => void];
}

export function useReaderKeymap(): [Keymap, ReaderHandle['setKeymap']] {
  const { keymap, handle } = useRuntime();
  return [keymap, handle.setKeymap];
}

export function useTableOfContents(): TocEntry[] {
  return useRuntime().toc;
}

export function useFootnote(): [Footnote | null, () => void] {
  const { footnote, clearFootnote } = useRuntime();
  return [footnote, clearFootnote];
}

export function useReader(): ReaderHandle {
  return useRuntime().handle;
}

export function useResumedFromPage(): number | null {
  return useRuntime().resumedFromPage;
}
