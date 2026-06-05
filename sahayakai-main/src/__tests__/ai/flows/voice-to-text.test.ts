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
jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: jest.fn().mockReturnValue(jest.fn()),
  },
  runResiliently: jest.fn(),
}));

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
