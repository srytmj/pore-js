import { describe, expect, it, vi } from 'vitest';
import {
  createTtsController,
  segmentSentences,
  type TtsSynthLike,
  type TtsUtteranceLike,
  type TtsVoiceLike,
} from './tts.js';

describe('segmentSentences', () => {
  it('splits on sentence-ending punctuation', () => {
    const spans = segmentSentences('Hello world. How are you? Fine!');
    expect(spans.map((s) => s.text)).toEqual(['Hello world.', 'How are you?', 'Fine!']);
  });

  it('returns the exact offsets into the source text', () => {
    const text = 'Hello world. How are you?';
    const spans = segmentSentences(text);
    for (const s of spans) {
      expect(text.slice(s.start, s.end).trim()).toBe(s.text);
    }
  });

  it('returns an empty array for blank text', () => {
    expect(segmentSentences('   ')).toEqual([]);
    expect(segmentSentences('')).toEqual([]);
  });

  it('handles text with no terminal punctuation as one sentence', () => {
    const spans = segmentSentences('just a fragment with no ending');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.text).toBe('just a fragment with no ending');
  });
});

/** A fake synth that resolves `onend` on the next microtask, so the controller's state machine advances one step per `await`. */
function fakeSynth(voices: TtsVoiceLike[] = []) {
  const spoken: string[] = [];
  const synth: TtsSynthLike = {
    speak: vi.fn((u: TtsUtteranceLike) => {
      spoken.push(u.rate + ':' + (u.voice?.voiceURI ?? '-'));
      queueMicrotask(() => u.onend?.());
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => voices,
  };
  return { synth, spoken };
}

function createUtterance(_text: string): TtsUtteranceLike {
  return { rate: 1, voice: null, onend: null, onerror: null };
}

describe('createTtsController', () => {
  it('speaks each sentence in order, then reports done when the spine has none left and advanceSpine returns false', async () => {
    const { synth } = fakeSynth();
    const states: boolean[] = [];
    const spoken: Array<{ block: number; text: string } | null> = [];
    const controller = createTtsController({
      synth,
      createUtterance,
      getSentences: () => [
        { block: 0, start: 0, end: 5, text: 'One.' },
        { block: 0, start: 6, end: 11, text: 'Two.' },
      ],
      onSentence: (s) => spoken.push(s ? { block: s.block, text: s.text } : null),
      advanceSpine: async () => false,
      onStateChange: (s) => states.push(s.playing),
    });

    controller.play();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(spoken.map((s) => s?.text ?? null)).toEqual(['One.', 'Two.', null]);
    expect(states.at(-1)).toBe(false);
  });

  it('advances to the next spine mid-playback when advanceSpine resolves true', async () => {
    const { synth } = fakeSynth();
    let spine = 0;
    const spoken: string[] = [];
    const controller = createTtsController({
      synth,
      createUtterance,
      getSentences: () =>
        spine === 0
          ? [{ block: 0, start: 0, end: 5, text: 'First spine.' }]
          : [{ block: 0, start: 0, end: 6, text: 'Second spine.' }],
      onSentence: (s) => s && spoken.push(s.text),
      advanceSpine: async () => {
        if (spine === 0) {
          spine = 1;
          return true;
        }
        return false;
      },
      onStateChange: () => {},
    });

    controller.play();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(spoken).toEqual(['First spine.', 'Second spine.']);
  });

  it('stop() prevents a pending onend/advanceSpine from resurrecting playback', async () => {
    const { synth } = fakeSynth();
    const spoken: string[] = [];
    const controller = createTtsController({
      synth,
      createUtterance,
      getSentences: () => [{ block: 0, start: 0, end: 5, text: 'Only.' }],
      onSentence: (s) => s && spoken.push(s.text),
      advanceSpine: async () => true, // would otherwise loop forever
      onStateChange: () => {},
    });

    controller.play();
    controller.stop();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(controller.getState().playing).toBe(false);
    // the one sentence may have already been queued for speak() before stop(), but no further advance happens
    expect(spoken.length).toBeLessThanOrEqual(1);
  });

  it('pause()/resume() delegate to the synth without restarting the current sentence', () => {
    const { synth } = fakeSynth();
    const controller = createTtsController({
      synth,
      createUtterance,
      getSentences: () => [{ block: 0, start: 0, end: 5, text: 'Hi.' }],
      onSentence: () => {},
      advanceSpine: async () => false,
      onStateChange: () => {},
    });
    controller.play();
    controller.pause();
    expect(synth.pause).toHaveBeenCalled();
    expect(controller.getState().playing).toBe(false);
    controller.resume();
    expect(synth.resume).toHaveBeenCalled();
    expect(controller.getState().playing).toBe(true);
  });

  it('applies rate/voice to subsequent utterances', () => {
    const { synth, spoken } = fakeSynth();
    const controller = createTtsController({
      synth,
      createUtterance,
      getSentences: () => [{ block: 0, start: 0, end: 5, text: 'Hi.' }],
      onSentence: () => {},
      advanceSpine: async () => false,
      onStateChange: () => {},
    });
    controller.setRate(1.5);
    controller.setVoice({ voiceURI: 'v1', name: 'Voice One', lang: 'en-US' });
    controller.play();
    expect(spoken[0]).toBe('1.5:v1');
  });
});
