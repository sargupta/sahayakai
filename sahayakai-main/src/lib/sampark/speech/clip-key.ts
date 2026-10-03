/**
 * Content key for a rendered clip — also its storage key.
 *
 * Same engine, voice, model, language code and text → same audio, so a clip is
 * rendered once and reused across campaigns (the fixed parts of a message are
 * cached; plan §4⑥). Anything that changes the audio changes the key.
 */

import crypto from 'node:crypto';

import type { SpeechEngineConfig } from '@/lib/sampark/languages';

import { GEMINI_TTS_STYLE_PROMPT } from './google-speech';

/** sha256 of `engine|voice|model|languageCode|text` (text NFC-normalised), first 40 hex chars. */
export function clipKey(speech: SpeechEngineConfig, text: string): string {
    const parts = [speech.engine, speech.voice, speech.model ?? '', speech.ttsLanguageCode, text.normalize('NFC')];
    // Pace and style hint change the audio, so a profile that sets them gets its own keys; the
    // shipped defaults (no pace, the legacy hint) append nothing, so existing clips keep their keys.
    if (typeof speech.speakingRate === 'number') parts.push(`rate=${speech.speakingRate}`);
    if (speech.engine === 'gemini-tts' && speech.stylePrompt !== undefined && speech.stylePrompt !== GEMINI_TTS_STYLE_PROMPT) parts.push(`style=${speech.stylePrompt ?? ''}`);
    const material = parts.join('|');
    return crypto.createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 40);
}
