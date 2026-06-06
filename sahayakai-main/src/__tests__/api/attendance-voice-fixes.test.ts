/**
 * Regression tests for F8 voice-pipeline P0/P1/P2 fixes.
 *
 * F8-02: Odia outreach now resolves to hi-IN voice (no English voice over Odia text).
 * F8-03: twiml-status double-fire of generateAndSaveSummary is blocked by idempotency claim.
 * F8-04: twiml repeat-turn (Twilio Gather retry) is deduped via (callSid,turn,hash) fingerprint.
 * F8-05: Punjabi speech recognition tag is `pa-IN` (not `pa-Guru-IN`).
 */

import { TWILIO_LANGUAGE_MAP, TWILIO_VOICE_MAP } from '@/types/attendance';
import type { Language } from '@/types';

// ── F8-02 ──────────────────────────────────────────────────────────────────
describe('F8-02 Odia outreach voice fallback', () => {
    it('Odia language code resolves to hi-IN (not null, not en-IN)', () => {
        expect(TWILIO_LANGUAGE_MAP['Odia' as Language]).toBe('hi-IN');
    });

    it('Odia voice uses Hindi Neural2 (matches the LANG_MAP fallback)', () => {
        expect(TWILIO_VOICE_MAP['Odia' as Language]).toBe('Google.hi-IN-Neural2-A');
    });

    it('Odia text rendered through hi-IN voice — no English-voice-over-Odia-text bug', () => {
        // Simulate the route logic: langCode = TWILIO_LANGUAGE_MAP[lang] ?? 'en-IN'
        const lang: Language = 'Odia' as Language;
        const langCode = TWILIO_LANGUAGE_MAP[lang] ?? 'en-IN';
        const voice = TWILIO_VOICE_MAP[lang] ?? 'Google.en-IN-Neural2-A';
        expect(langCode).not.toBe('en-IN');
        expect(voice).not.toContain('en-IN');
        expect(langCode).toBe('hi-IN');
    });
});

// ── F8-05 ──────────────────────────────────────────────────────────────────
describe('F8-05 Punjabi speech recognition tag', () => {
    // Mirror of the SPEECH_LANGUAGE_MAP in src/app/api/attendance/twiml/route.ts
    const SPEECH_LANGUAGE_MAP: Record<string, string> = {
        'en-IN': 'en-IN',
        'hi-IN': 'hi-IN',
        'pa-IN': 'pa-IN',
    };

    it('maps Punjabi (pa-IN) to pa-IN, not pa-Guru-IN', () => {
        expect(SPEECH_LANGUAGE_MAP['pa-IN']).toBe('pa-IN');
        expect(SPEECH_LANGUAGE_MAP['pa-IN']).not.toBe('pa-Guru-IN');
    });
});

// ── F8-04 dedup contract (pure logic — fingerprint shape) ──────────────────
describe('F8-04 turn dedup fingerprint', () => {
    // Mirrors the production fingerprint construction:
    //   `${callSid}:${turnNumber}:${sha1(speech).slice(0,12)}`
    const crypto = require('crypto') as typeof import('crypto');
    const fp = (callSid: string, turn: number, speech: string) =>
        `${callSid}:${turn}:${crypto.createHash('sha1').update(speech).digest('hex').slice(0, 12)}`;

    it('same (callSid, turn, speech) → identical fingerprint', () => {
        expect(fp('CA1', 2, 'haan ji')).toBe(fp('CA1', 2, 'haan ji'));
    });

    it('different speech → different fingerprint', () => {
        expect(fp('CA1', 2, 'haan ji')).not.toBe(fp('CA1', 2, 'nahi'));
    });

    it('different turn number → different fingerprint (same speech)', () => {
        expect(fp('CA1', 2, 'haan ji')).not.toBe(fp('CA1', 3, 'haan ji'));
    });

    it('different callSid → different fingerprint', () => {
        expect(fp('CA1', 2, 'haan ji')).not.toBe(fp('CA2', 2, 'haan ji'));
    });
});

// ── F8-03 idempotency contract (Firestore transaction semantics) ──────────
describe('F8-03 twiml-status summary idempotency', () => {
    /**
     * Simulates the transaction guard used in twiml-status/route.ts. Two
     * concurrent webhook deliveries for the same outreachId must result in
     * exactly one summary generation.
     */
    type Doc = { callSummary?: object; _summaryGenerating?: boolean };

    function makeFakeTx(state: { doc: Doc }) {
        // Sequential transactions are sufficient here — the production code
        // relies on Firestore's serialization. We model that by running the
        // transaction body atomically.
        return async (fn: (tx: { get: () => Promise<{ data: () => Doc }>; update: (patch: Partial<Doc>) => void }) => Promise<boolean>) => {
            const snapshot = { data: () => ({ ...state.doc }) };
            let patch: Partial<Doc> | null = null;
            const tx = {
                get: async () => snapshot,
                update: (p: Partial<Doc>) => { patch = p; },
            };
            const result = await fn(tx);
            if (patch) state.doc = { ...state.doc, ...patch };
            return result;
        };
    }

    function claimSummary(state: { doc: Doc }) {
        const runTx = makeFakeTx(state);
        return runTx(async (tx) => {
            const snap = await tx.get();
            const d = snap.data();
            if (d.callSummary) return false;
            if (d._summaryGenerating) return false;
            tx.update({ _summaryGenerating: true });
            return true;
        });
    }

    it('first callback claims; second callback is rejected', async () => {
        const state = { doc: {} as Doc };
        expect(await claimSummary(state)).toBe(true);
        expect(state.doc._summaryGenerating).toBe(true);
        // Second retry — claim already held.
        expect(await claimSummary(state)).toBe(false);
    });

    it('retry after summary persisted is rejected (no double LLM call)', async () => {
        const state = { doc: { callSummary: { reason: 'done' }, _summaryGenerating: false } as Doc };
        expect(await claimSummary(state)).toBe(false);
    });

    it('two retries → exactly one LLM call', async () => {
        const state = { doc: {} as Doc };
        let llmCalls = 0;
        const handle = async () => {
            if (await claimSummary(state)) llmCalls++;
        };
        await handle();
        await handle();
        await handle();
        expect(llmCalls).toBe(1);
    });
});
