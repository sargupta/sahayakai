/**
 * Content key for a rendered clip — also its storage key.
 *
 * Same engine, voice, model, language code and text → same audio, so a clip is
 * rendered once and reused across campaigns (the fixed parts of a message are
 * cached; plan §4⑥). Anything that changes the audio changes the key.
 */

import crypto from 'node:crypto';

import type { SpeechEngineConfig } from '@/lib/sampark/languages';

/** sha256 of `engine|voice|model|languageCode|text` (text NFC-normalised), first 40 hex chars. */
export function clipKey(speech: SpeechEngineConfig, text: string): string {
    const material = [speech.engine, speech.voice, speech.model ?? '', speech.ttsLanguageCode, text.normalize('NFC')].join('|');
    return crypto.createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 40);
}
