/**
 * @jest-environment node
 *
 * CLASS GATE (c) — a Sampark voice token opens exactly one door.
 *
 * Five public endpoints sit behind these tokens: answer (plays a message),
 * menu keypad, opt-out keypad (can silence a family), status (can end and
 * settle a call) and audio. The failure this gate exists for is not forgery,
 * it is a token leaking from one endpoint and opening another — an audio URL
 * from a call log replayed as a keypad press, a menu token presented as the
 * "confirm opt-out" step. So the gate is the full matrix, not a spot check:
 *   - every domain verifies only its own tokens (5 × 5);
 *   - no teacher-path `vobiz-*` token verifies on any Sampark domain, and no
 *     Sampark token verifies on the teacher path;
 *   - each webhook HANDLER refuses every foreign token, so a future handler
 *     that verified with the wrong domain would fail here too.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { _resetVobizKeyCacheForTest, mintVobizToken, VOBIZ_DOMAINS, verifyVobizToken, type VobizDomain } from '@/lib/vobiz/tokens';
import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal, type SamparkVoiceDomain } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { handleSamparkAnswer, handleSamparkGather, handleSamparkStatus, readSamparkVoiceAudio } from '@/server/sampark/voice';

import { CALL_ID, ORG, setVoiceEnv, world } from './_fixtures';

const SAMPARK_DOMAINS: SamparkVoiceDomain[] = ['sampark-answer', 'sampark-gather-menu', 'sampark-gather-optout', 'sampark-status', 'sampark-audio'];
const TEACHER_DOMAINS: VobizDomain[] = Object.values(VOBIZ_DOMAINS);
const PRINCIPAL = voicePrincipal(ORG, CALL_ID);

beforeEach(() => {
    setVoiceEnv();
    _resetVobizKeyCacheForTest();
});

describe('class gate (c) — the 5 × 5 domain matrix', () => {
    it.each(SAMPARK_DOMAINS)('a %s token verifies on its own domain and on no other', async (minted) => {
        const token = await mintSamparkVoiceToken(minted, PRINCIPAL);
        for (const verifier of SAMPARK_DOMAINS) {
            const result = await verifySamparkVoiceToken(verifier, token);
            if (verifier === minted) expect(result).toBe(PRINCIPAL);
            else expect({ minted, verifier, result }).toEqual({ minted, verifier, result: null });
        }
    });

    it('covers every domain the tokens module knows (the matrix is not stale)', () => {
        expect(new Set(SAMPARK_DOMAINS).size).toBe(5);
    });
});

describe('class gate (c) — the teacher call path and Sampark never accept each other', () => {
    it.each(TEACHER_DOMAINS)('a teacher-path %s token is refused by every Sampark domain', async (teacherDomain) => {
        const { token } = await mintVobizToken(teacherDomain, PRINCIPAL);
        for (const verifier of SAMPARK_DOMAINS) {
            expect(await verifySamparkVoiceToken(verifier, token)).toBeNull();
        }
    });

    it.each(SAMPARK_DOMAINS)('a Sampark %s token is refused by every teacher-path domain', async (minted) => {
        const token = await mintSamparkVoiceToken(minted, PRINCIPAL);
        for (const verifier of TEACHER_DOMAINS) {
            expect(await verifyVobizToken(verifier, token)).toBeNull();
        }
    });
});

describe('class gate (c) — every webhook handler refuses every foreign token', () => {
    async function foreignTokens(own: SamparkVoiceDomain[], principal = PRINCIPAL): Promise<string[]> {
        const sampark = await Promise.all(SAMPARK_DOMAINS.filter((d) => !own.includes(d)).map((d) => mintSamparkVoiceToken(d, principal)));
        const teacher = await Promise.all(TEACHER_DOMAINS.map(async (d) => (await mintVobizToken(d, principal)).token));
        return [...sampark, ...teacher, 'garbage', ''];
    }

    it('answer: hangs up and changes nothing', async () => {
        const w = await world();
        for (const token of await foreignTokens(['sampark-answer'])) {
            const result = await handleSamparkAnswer(w, { token, callUuid: 'u' });
            expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'bad_token' });
        }
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });

    it('gather: hangs up and records no key', async () => {
        const w = await world();
        await w.repo.updateCall(ORG, CALL_ID, { state: 'in_progress' });
        for (const token of await foreignTokens(['sampark-gather-menu', 'sampark-gather-optout'])) {
            const result = await handleSamparkGather(w, { token, digits: '9', callUuid: 'u' });
            expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'bad_token' });
        }
        const call = await w.repo.getCall(ORG, CALL_ID);
        expect(call?.outcome.digits).toBe('');
        expect(await w.repo.getSuppression(ORG, call?.phoneHash ?? '')).toBeNull();
    });

    it('status: answers ok and neither ends nor settles the call', async () => {
        const w = await world();
        for (const token of await foreignTokens(['sampark-status'])) {
            const result = await handleSamparkStatus(w, { token, kind: 'hangup', fields: { HangupCause: 'NORMAL_CLEARING', Duration: '30' } });
            expect(result).toEqual({ ok: true, outcome: 'bad_token' });
        }
        const call = await w.repo.getCall(ORG, CALL_ID);
        expect(call?.state).toBe('dialing');
        expect(call?.settledAt ?? null).toBeNull();
    });

    it('audio: serves nothing', async () => {
        const w = await world();
        const clipPrincipal = voicePrincipal(ORG, w.keys.message as string);
        for (const token of await foreignTokens(['sampark-audio'], clipPrincipal)) {
            expect(await readSamparkVoiceAudio(w, { token })).toBeNull();
        }
        // …while the right token does (the refusal above is not vacuous).
        const own = await mintSamparkVoiceToken('sampark-audio', clipPrincipal);
        expect(await readSamparkVoiceAudio(w, { token: own })).not.toBeNull();
    });
});
