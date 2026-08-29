import { describe, expect, it } from 'vitest';
import type { Chapter } from './reader-engine.js';
import { PaceEstimator, chapterProgress } from './progress.js';

const chs = (starts: number[]): Chapter[] =>
  starts.map((startPage, i) => ({
    id: `c${i}`,
    label: `Chapter ${i + 1}`,
    startPage,
    startPercent: 0,
  }));

describe('chapterProgress', () => {
  it('locates the current chapter and pages left before the next', () => {
    const r = chapterProgress(chs([0, 10, 20]), 12, 30);
    expect(r.index).toBe(1);
    expect(r.label).toBe('Chapter 2');
    expect(r.pagesLeftInChapter).toBe(20 - 1 - 12); // 7
  });

  it('uses the book total for the last chapter', () => {
    const r = chapterProgress(chs([0, 10, 20]), 25, 30);
    expect(r.index).toBe(2);
    expect(r.pagesLeftInChapter).toBe(30 - 1 - 25); // 4
  });

  it('falls back to whole-book pages left with no chapters', () => {
    expect(chapterProgress([], 3, 10)).toEqual({
      index: 0,
      label: '',
      pagesLeftInChapter: 6,
    });
  });
});

describe('PaceEstimator', () => {
  it('eases toward the observed dwell time', () => {
    const p = new PaceEstimator(10);
    let t = 1_000_000;
    p.mark(t);
    for (let i = 0; i < 20; i++) {
      t += 4000; // 4s per page
      p.mark(t);
    }
    expect(p.secondsPerPage).toBeGreaterThan(4);
    expect(p.secondsPerPage).toBeLessThan(5);
  });

  it('ignores implausible gaps and rounds minutes left', () => {
    const p = new PaceEstimator(12);
    p.mark(0);
    p.mark(500); // <1s, ignored
    p.mark(10_000_000); // >120s, ignored
    expect(p.secondsPerPage).toBe(12);
    expect(p.minutesLeft(10)).toBe(2); // 120s -> 2 min
    expect(p.minutesLeft(0)).toBe(0);
  });
});
