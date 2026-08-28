/**
 * Reading position model — see docs/reader-engine-design.md §5.
 *
 * The Platform stores this opaquely; the engine round-trips it across
 * viewport resizes and devices.
 */
export type Position =
  | { type: 'page'; value: number; total: number }
  | {
      type: 'anchor';
      spine: number;
      block: number;
      offset: number;
      percent: number;
    }
  | { type: 'scroll'; value: number; total: number; page?: number };
