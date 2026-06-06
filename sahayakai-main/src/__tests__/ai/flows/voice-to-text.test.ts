/**
 * @jest-environment node
 *
 * Lane A5 regression tests for the voice-to-text STT pipeline.
 *
 * Background:
 *   1. Sarvam STT ignores the `expectedLanguage` hint for Punjabi (and other
 *      under-supported Indic languages) and returns transcripts in Devanagari
 *      script labeled as `hi`. The voice-to-text route must detect this and
 *      fall through to the Gemini path (which honours expectedLanguage and
 *      has the forceScript retry).
 *   2. Sarvam emits non-canonical ISO codes — Odia comes back as `od` instead
 *      of the canonical `or` (ISO 639-1). Downstream consumers (TTS,
 *      agent-router) expect `or`. `normalizeIsoLang` is the single output-
 *      boundary normaliser that fixes this and similar provider aliases.
 *
 * These tests pin both behaviours so a future edit can't silently regress.
 * They do NOT hit Sarvam, Gemini, or any external service — they exercise
 * the pure helper functions only.
 */

// Mock @/ai/genkit so the module is loadable in a node test env (the prompt
// builder pulls in Google AI bindings we don't want in unit tests).
// The `mock` prefix is required so Jest's hoisting allows references inside
// the factory before the variable is initialised.
jest.mock('@/ai/genkit', () => {
  const promptFn = jest.fn();
  return {
    __mockPromptFn: promptFn,
    ai: {
      definePrompt: jest.fn().mockImplementation(() => promptFn),
    },
    runResiliently: jest.fn().mockImplementation(
      async (fn: (config: unknown) => Promise<unknown>) => fn({}),
    ),
  };
});
// Pull the mock prompt fn out via require so tests can drive its return value.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockPromptFn = (require('@/ai/genkit') as { __mockPromptFn: jest.Mock }).__mockPromptFn;

import {
  normalizeIsoLang,
  scriptMatchesExpected,
} from '@/ai/flows/voice-to-text';

describe('normalizeIsoLang', () => {
  it('returns undefined for null/undefined/empty input', () => {
    expect(normalizeIsoLang(null)).toBeUndefined();
    expect(normalizeIsoLang(undefined)).toBeUndefined();
    expect(normalizeIsoLang('')).toBeUndefined();
    expect(normalizeIsoLang('   ')).toBeUndefined();
  });

  it('maps Sarvam Odia alias `od` to canonical `or`', () => {
    expect(normalizeIsoLang('od')).toBe('or');
    expect(normalizeIsoLang('OD')).toBe('or');
    expect(normalizeIsoLang('od-IN')).toBe('or');
    expect(normalizeIsoLang('ori')).toBe('or');
  });

  it('maps 3-letter Punjabi aliases to `pa`', () => {
    expect(normalizeIsoLang('pun')).toBe('pa');
    expect(normalizeIsoLang('pnb')).toBe('pa');
  });

  it('maps 3-letter Marathi/Hindi aliases', () => {
    expect(normalizeIsoLang('mar')).toBe('mr');
    expect(normalizeIsoLang('hin')).toBe('hi');
  });

  it('strips BCP-47 region/script suffixes', () => {
    expect(normalizeIsoLang('hi-IN')).toBe('hi');
    expect(normalizeIsoLang('pa_in')).toBe('pa');
    expect(normalizeIsoLang('zh-Hans-CN')).toBe('zh');
    expect(normalizeIsoLang('en-US')).toBe('en');
  });

  it('passes canonical 2-letter codes through unchanged', () => {
    expect(normalizeIsoLang('en')).toBe('en');
    expect(normalizeIsoLang('hi')).toBe('hi');
    expect(normalizeIsoLang('pa')).toBe('pa');
    expect(normalizeIsoLang('or')).toBe('or');
    expect(normalizeIsoLang('bn')).toBe('bn');
  });

  it('passes unknown short codes through (does not invent a mapping)', () => {
    expect(normalizeIsoLang('xx')).toBe('xx');
  });
});

describe('scriptMatchesExpected — Punjabi/Devanagari mismatch (Lane A5)', () => {
  // The exact failure mode: Sarvam returns Punjabi audio transcribed in
  // Devanagari script (Hindi-looking). The user asked for Punjabi (`pa`,
  // Gurmukhi script). This MUST be detected as a mismatch so the route can
  // fall through to Gemini.
  const PUNJABI_AUDIO_AS_DEVANAGARI = 'मैं अमृतसर जा रहा हूँ';

  it('detects Punjabi audio returned in Devanagari script as a mismatch', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'pa')).toBe(false);
  });

  it('accepts proper Gurmukhi-script Punjabi', () => {
    const realPunjabi = 'ਮੈਂ ਅੰਮ੍ਰਿਤਸਰ ਜਾ ਰਿਹਾ ਹਾਂ';
    expect(scriptMatchesExpected(realPunjabi, 'pa')).toBe(true);
  });

  it('still accepts Devanagari text when expected language IS Hindi', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'hi')).toBe(true);
  });

  it('still accepts Devanagari text when expected language IS Marathi', () => {
    // Marathi uses Devanagari too — must not be flagged as mismatch.
    const marathi = 'मी अमृतसरला जात आहे';
    expect(scriptMatchesExpected(marathi, 'mr')).toBe(true);
  });

  it('flags Gujarati expected but Devanagari returned', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'gu')).toBe(false);
  });

  it('flags Bengali expected but Devanagari returned', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'bn')).toBe(false);
  });

  it('flags Odia expected but Devanagari returned', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'or')).toBe(false);
  });

  it('passes when text is short / mostly English (no false positives)', () => {
    expect(scriptMatchesExpected('Hello world', 'pa')).toBe(true);
    expect(scriptMatchesExpected('OK', 'pa')).toBe(true);
  });

  it('passes when expected language is English or undefined', () => {
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, 'en')).toBe(true);
    expect(scriptMatchesExpected(PUNJABI_AUDIO_AS_DEVANAGARI, undefined)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2b regression — empty Gemini transcription returns soft-empty, not throw
// See qa/results/lane-F/VIDYA_VOICE_DEBUG.md and VIDYA_VOICE_FIX.md.
//
// Prior behaviour: on silent / sub-threshold audio Gemini returns an empty
// string and the flow threw "Empty transcription returned from model" → 500.
// The client retried 3× (microphone-input.tsx), burning cost and crashing the
// UI to a destructive toast.
//
// Fixed behaviour: return `{ text: '', language: <expected> }` so the route
// returns HTTP 200 and the UI renders a friendly "I didn't catch that".
// ─────────────────────────────────────────────────────────────────────────────
describe('voiceToText soft-empty handling', () => {
  beforeEach(() => {
    mockPromptFn.mockReset();
  });

  it('returns soft-empty (no throw) when Gemini returns empty text — voiceToText', async () => {
    mockPromptFn.mockResolvedValue({ output: { text: '', language: '' } });
    const { voiceToText } = await import('@/ai/flows/voice-to-text');
    const result = await voiceToText({
      audioDataUri: 'data:audio/webm;base64,AAAA',
      expectedLanguage: 'hi',
    });
    expect(result).toEqual({ text: '', language: 'hi' });
  });

  it('returns soft-empty (no throw) when Gemini returns empty text — voiceToTextFormData', async () => {
    mockPromptFn.mockResolvedValue({ output: { text: '', language: '' } });
    const { voiceToTextFormData } = await import('@/ai/flows/voice-to-text');
    const fd = new FormData();
    const blob = new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'audio/webm;codecs=opus' });
    fd.set('audio', blob as unknown as File, 'voice.webm');
    fd.set('language', 'bn');
    const result = await voiceToTextFormData(fd);
    expect(result.text).toBe('');
    expect(result.language).toBe('bn');
  });

  it('also handles null output from the prompt — voiceToText', async () => {
    mockPromptFn.mockResolvedValue({ output: null });
    const { voiceToText } = await import('@/ai/flows/voice-to-text');
    const result = await voiceToText({
      audioDataUri: 'data:audio/webm;base64,AAAA',
      expectedLanguage: 'en',
    });
    expect(result).toEqual({ text: '', language: 'en' });
  });
});
