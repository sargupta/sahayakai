/**
 * The call synopsis (src/lib/sampark/conversation/synopsis.ts): the rules synopsis only restates
 * stored facts; a model synopsis is accepted only when well formed and never claims a callback
 * was scheduled (only a person scheduling it in the calendar does that).
 */

import { acceptSynopsis, collectedCallbackRequest, rulesSynopsis, synopsisNeedsWrite, type SynopsisInput } from '@/lib/sampark/conversation/synopsis';

const NOW = '2026-10-30T10:00:00.000Z';
const OPENING = 'Namaste, this is Riya, an AI assistant calling from the school. This conversation is transcribed by our service providers.';

function input(over: Partial<SynopsisInput> = {}): SynopsisInput {
    return {
        purposeLabel: 'PTM invitation',
        announcement: 'PTM on Saturday at 10 AM.',
        outcome: 'completed',
        durationSeconds: 26,
        answers: {},
        stopRequested: false,
        transcript: [
            { role: 'agent', message: OPENING, timeInCallSecs: 0 },
            { role: 'user', message: 'I am busy, call me tomorrow at 5 PM.', timeInCallSecs: 9 },
        ],
        ...over,
    };
}

describe('rulesSynopsis', () => {
    it('always 3–6 bullets, restating outcome, disclosure and answers', () => {
        const s = rulesSynopsis(input({ answers: { ptm_attendance: 'can_attend', ptm_meeting_mode: 'not_applicable' } }), NOW);
        expect(s.source).toBe('rules');
        expect(s.bullets.length).toBeGreaterThanOrEqual(3);
        expect(s.bullets.length).toBeLessThanOrEqual(6);
        expect(s.bullets[0]).toBe('PTM invitation call: the call connected and ended normally, 26 s.');
        expect(s.bullets).toContain('Riya introduced herself as an AI assistant and said the call is transcribed.');
        expect(s.bullets).toContain('Riya collected 1 answer from the listener.'); // not_applicable is not an answer
    });

    it('claims a disclosure only when the opening says it', () => {
        const s = rulesSynopsis(input({ transcript: [{ role: 'agent', message: 'Hello, this is the school.', timeInCallSecs: 0 }] }), NOW);
        expect(s.bullets.join(' ')).not.toMatch(/AI assistant|transcribed/);
        expect(s.bullets).toContain('The listener did not speak.');
    });

    it('a collected callback request is a request, never a scheduled callback', () => {
        const s = rulesSynopsis(input({ answers: { callback_requested_time: 'tomorrow at 5 PM' } }), NOW);
        expect(s.callbackRequest).toBe('tomorrow at 5 PM');
        expect(s.bullets).toContain('Asked to be called back: "tomorrow at 5 PM".');
        expect(s.bullets.join(' ')).not.toMatch(/scheduled|booked|arranged/i);
    });

    it('a call nobody answered says so without inventing a conversation', () => {
        const s = rulesSynopsis(input({ outcome: 'no_answer', durationSeconds: null, transcript: [] }), NOW);
        expect(s.bullets[0]).toBe('PTM invitation call: nobody answered.');
        expect(s.bullets.join(' ')).not.toMatch(/listener replied|introduced/);
        expect(s.bullets.length).toBe(3);
    });

    it('a stop request is reported as pending office confirmation', () => {
        expect(rulesSynopsis(input({ stopRequested: true }), NOW).bullets).toContain('Asked not to be called again; the office should confirm.');
    });
});

describe('acceptSynopsis', () => {
    const ok = ['Riya shared the PTM date.', 'The parent said they were busy.', 'The parent asked to be called tomorrow at 5 PM.'];

    it('accepts 3–6 clean bullets and strips list markers', () => {
        expect(acceptSynopsis({ bullets: ok.map((b) => `- ${b}`), callbackRequest: 'tomorrow at 5 PM' }, NOW)).toEqual({ bullets: ok, callbackRequest: 'tomorrow at 5 PM', source: 'ai', generatedAt: NOW });
    });

    it.each([
        ['too few', { bullets: ok.slice(0, 2) }],
        ['too many', { bullets: [...ok, ...ok, 'x'] }],
        ['a placeholder', { bullets: [...ok.slice(0, 2), 'The parent {{name}} agreed.'] }],
        ['a null', { bullets: [...ok.slice(0, 2), 'Callback time: null'] }],
        ['a scheduled callback', { bullets: [...ok.slice(0, 2), 'A callback was scheduled for 5 PM.'] }],
        ['a booked call back', { bullets: [...ok.slice(0, 2), 'Riya booked a call-back for tomorrow.'] }],
        ['no bullets', {}],
    ])('rejects %s', (_label, raw) => {
        expect(acceptSynopsis(raw, NOW)).toBeNull();
    });

    it('a "null" callback request means none', () => {
        expect(acceptSynopsis({ bullets: ok, callbackRequest: 'null' }, NOW)?.callbackRequest).toBeNull();
    });
});

describe('synopsisNeedsWrite', () => {
    const base = { bullets: ['a', 'b', 'c'], callbackRequest: null, source: 'ai' as const, generatedAt: 'x' };
    it('writes a missing synopsis, upgrades a provisional one only with turns, a final one only with more turns', () => {
        expect(synopsisNeedsWrite(null, 0)).toBe(true);
        expect(synopsisNeedsWrite({ ...base, source: 'rules', status: 'provisional', transcriptTurns: 0 }, 0)).toBe(false);
        expect(synopsisNeedsWrite({ ...base, source: 'rules', status: 'provisional', transcriptTurns: 0 }, 2)).toBe(true);
        expect(synopsisNeedsWrite({ ...base, status: 'final', transcriptTurns: 3 }, 3)).toBe(false);
        expect(synopsisNeedsWrite({ ...base, status: 'final', transcriptTurns: 3 }, 1)).toBe(false);
        expect(synopsisNeedsWrite({ ...base, status: 'final', transcriptTurns: 1 }, 3)).toBe(true);
        expect(synopsisNeedsWrite(base, 9)).toBe(false); // early final record without a turn count: kept
    });
});

describe('collectedCallbackRequest', () => {
    it.each([[undefined, null], ['no', null], ['not_applicable', null], ['  after 6 pm  ', 'after 6 pm']])('%p → %p', (v, expected) => {
        expect(collectedCallbackRequest(v === undefined ? {} : { callback_requested_time: v })).toBe(expected);
    });
});
