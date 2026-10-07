/**
 * @jest-environment node
 *
 * CLASS GATE (founder-observed, 2026-10-07) — every <Play> URL ends in `.wav`.
 *
 * WHAT HAPPENED
 * The first four real Test-mode calls (one per language, to the founder's phone)
 * were answered, Vobiz downloaded both clips, and then nothing played: each call
 * sat through the keypad timeout and hung up after ~12 s. The URLs were
 * `…/audio.wav?t=<token>`. Vobiz caches a fetched file under its URL and chooses
 * the decoder from the extension, and a URL ending in a query string has none.
 *
 * WHAT THIS GATE CATCHES
 * Not "that one URL" — the class: any audio URL in any XML a Sampark voice
 * response can return (answer, menu keys 1/2/9, no input, opt-out confirm/done)
 * that does not END in `.wav` with no query string or fragment. The checker is
 * proven to fail on the old URL shape first.
 */
import { mintSamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { handleSamparkAnswer, handleSamparkGather } from '@/server/sampark/voice';

import { CALL_ID, ORG, VOBIZ_CALL_UUID, gatherAction, playUrls, setVoiceEnv, tokenOf, world } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

/** A URL a carrier can cache as a playable file: https, path ends in .wav, nothing after it. */
function playableByExtension(url: string): boolean {
    const u = new URL(url);
    return u.protocol === 'https:' && u.search === '' && u.hash === '' && /\.wav$/.test(u.pathname) && url.endsWith('.wav');
}

beforeEach(() => setVoiceEnv());

describe('class gate: every <Play> URL ends in .wav (Vobiz picks the decoder by extension)', () => {
    it('the checker rejects the shape that failed on the real calls', () => {
        expect(playableByExtension('https://x.test/api/webhooks/sampark-voice/audio.wav?t=org~k.1.s')).toBe(false);
        expect(playableByExtension('https://x.test/api/webhooks/sampark-voice/clip/org~k.1.s.wav#x')).toBe(false);
        expect(playableByExtension('http://x.test/api/webhooks/sampark-voice/clip/org~k.1.s.wav')).toBe(false);
        expect(playableByExtension('https://x.test/api/webhooks/sampark-voice/clip/org~k.1.s.wav')).toBe(true);
    });

    it('holds for every XML a notice call can produce: answer, keys 1, 2, 9 then 9, no input', async () => {
        const urls: string[] = [];
        const answer = async () => {
            const w = await world();
            const res = await handleSamparkAnswer(w, { token: await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID)), callUuid: VOBIZ_CALL_UUID });
            urls.push(...playUrls(res.xml));
            return { w, menu: tokenOf(gatherAction(res.xml) as string) };
        };
        for (const digits of ['1', '2', '', '7']) {
            const { w, menu } = await answer();
            urls.push(...playUrls((await handleSamparkGather(w, { token: menu, digits, callUuid: VOBIZ_CALL_UUID })).xml));
        }
        const { w, menu } = await answer();
        const confirm = await handleSamparkGather(w, { token: menu, digits: '9', callUuid: VOBIZ_CALL_UUID });
        urls.push(...playUrls(confirm.xml));
        const optout = tokenOf(gatherAction(confirm.xml) as string);
        urls.push(...playUrls((await handleSamparkGather(w, { token: optout, digits: '9', callUuid: VOBIZ_CALL_UUID })).xml));

        expect(urls.length).toBeGreaterThanOrEqual(10);
        expect(urls.filter((u) => !playableByExtension(u))).toEqual([]);
    });
});
