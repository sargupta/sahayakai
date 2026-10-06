/**
 * @jest-environment node
 *
 * The audio behind every <Play>. CLASS GATE (e), serving half: even with a
 * valid audio token, a clip that failed or skipped its transcribe-back check,
 * belongs to another school, or has no bytes, is never served.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { parseWav } from '@/server/sampark/audio-format';
import { mintSamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { readSamparkVoiceAudio } from '@/server/sampark/voice';

import { ORG, setVoiceEnv, world } from './_fixtures';

beforeEach(() => setVoiceEnv());

async function audioToken(orgId: string, key: string): Promise<string> {
    return mintSamparkVoiceToken('sampark-audio', voicePrincipal(orgId, key));
}

describe('readSamparkVoiceAudio', () => {
    it('serves a verified clip as 16-bit PCM WAV (never μ-law)', async () => {
        const w = await world();
        const wav = await readSamparkVoiceAudio(w, { token: await audioToken(ORG, w.keys.message as string) });
        expect(wav).not.toBeNull();
        const layout = parseWav(wav as Buffer);
        expect(layout).toMatchObject({ formatTag: 1, bitsPerSample: 16, sampleRate: 8000, channels: 1 });
        expect(layout.dataLength).toBe(2000 * 2);
    });

    it.each([['failed'], ['skipped']] as const)('never serves a clip whose check is %s', async (fate) => {
        const w = await world({ clips: (k) => (k === 'message' ? fate : 'passed') });
        expect(await readSamparkVoiceAudio(w, { token: await audioToken(ORG, w.keys.message as string) })).toBeNull();
    });

    it('never serves another school’s clip, even with a validly signed token for it', async () => {
        const w = await world();
        expect(await readSamparkVoiceAudio(w, { token: await audioToken('other-school', w.keys.message as string) })).toBeNull();
    });

    it('404s an unknown key and a clip with metadata but no bytes', async () => {
        const w = await world();
        expect(await readSamparkVoiceAudio(w, { token: await audioToken(ORG, 'f'.repeat(40)) })).toBeNull();
        const bytesless = { ...w, store: { ...w.store, get: async () => null } };
        expect(await readSamparkVoiceAudio(bytesless, { token: await audioToken(ORG, w.keys.message as string) })).toBeNull();
    });

    it('serves nothing with the kill switch off or Sampark off', async () => {
        const w = await world();
        const token = await audioToken(ORG, w.keys.message as string);
        setVoiceEnv({ SAMPARK_LIVE_DIAL_ENABLED: undefined });
        expect(await readSamparkVoiceAudio(w, { token })).toBeNull();
        setVoiceEnv({ SAMPARK_ENABLED: 'false' });
        expect(await readSamparkVoiceAudio(w, { token })).toBeNull();
    });

    it('refuses a key that is not a plain content hash', async () => {
        const w = await world();
        expect(await readSamparkVoiceAudio(w, { token: await audioToken(ORG, 'clips/secret-file') })).toBeNull();
        expect(await readSamparkVoiceAudio(w, { token: await audioToken(ORG, 'short') })).toBeNull();
    });
});
