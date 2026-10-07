/**
 * @jest-environment node
 *
 * renderNoticeScript / variantsFor / audienceLabelFor (SLICE1_CONTRACT §4).
 */

import {
    audienceLabelFor,
    estimateSeconds,
    MESSAGE_AND_MENU_BUDGET_SECONDS,
    renderNoticeScript,
    ScriptRenderError,
    variantsFor,
} from '@/lib/sampark/scripts/render';
import { SAMPLE_CLOSURE, SAMPLE_EVENT, SAMPLE_PTM, SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE } from '@/lib/sampark/scripts/samples';
import { PARENT_LANGUAGES, type Campaign, type PtmFacts } from '@/types/sampark';

const base = { school: SAMPLE_SCHOOL, audience: SAMPLE_SECTION_AUDIENCE } as const;

describe('variantsFor', () => {
    it('emergency closure has today and tomorrow; everything else default', () => {
        expect(variantsFor('emergency_closure')).toEqual(['today', 'tomorrow']);
        expect(variantsFor('ptm_invite')).toEqual(['default']);
        expect(variantsFor('event_invite')).toEqual(['default']);
    });
});

describe('audienceLabelFor', () => {
    const c = (sections: { grade: number; section: string }[]) => ({ audience: { sections } }) as Pick<Campaign, 'audience'>;
    it('one section → that section; none or several → school', () => {
        expect(audienceLabelFor(c([{ grade: 7, section: 'B' }]))).toEqual({ kind: 'section', grade: 7, section: 'B' });
        expect(audienceLabelFor(c([]))).toEqual({ kind: 'school' });
        expect(audienceLabelFor(c([{ grade: 7, section: 'A' }, { grade: 7, section: 'B' }]))).toEqual({ kind: 'school' });
    });
});

describe('renderNoticeScript', () => {
    it('renders the PTM invitation as one short clip (message + menu) in the spoken register', () => {
        const r = renderNoticeScript({ ...base, purpose: 'ptm_invite', facts: SAMPLE_PTM, language: 'Hindi', variant: 'default' });
        expect(r.clips[0]).toEqual({
            kind: 'message',
            text:
                'नमस्ते! हिलव्यू डेमो स्कूल से क्लास सेवन बी के पेरेंट्स के लिए यह एक रिकॉर्डेड मैसेज है। ' +
                'पेरेंट टीचर मीटिंग शनिवार, दस अक्टूबर को सुबह दस बजे स्कूल हॉल में है। आप ज़रूर आइएगा। ' +
                'आ सकें, तो एक दबाएँ। इस समय आना मुश्किल हो, तो दो दबाएँ। ऐसी कॉल नहीं चाहिए, तो नौ दबाएँ।',
        });
        expect(r.clips.map((c) => c.kind)).toEqual(['message', 'confirm_1', 'confirm_2', 'opt_out_confirm', 'opt_out_done', 'no_input', 'fallback_office']);
    });

    it('renders the Nepali closure draft with today / tomorrow and the bus sentence', () => {
        const today = renderNoticeScript({ ...base, purpose: 'emergency_closure', facts: SAMPLE_CLOSURE, language: 'Nepali', variant: 'today' });
        expect(today.clips[0].text).toContain('आज, बिहीबार, आठ अक्टोबरमा स्कुल बन्द रहन्छ। स्कुल बस पनि चल्दैन।');
        const tomorrow = renderNoticeScript({ ...base, purpose: 'emergency_closure', facts: SAMPLE_CLOSURE, language: 'Nepali', variant: 'tomorrow' });
        expect(tomorrow.clips[0].text).toContain('भोलि, बिहीबार, आठ अक्टोबरमा');
        const running = renderNoticeScript({
            ...base,
            purpose: 'emergency_closure',
            facts: { ...SAMPLE_CLOSURE, busesRunning: true },
            language: 'English',
            variant: 'today',
        });
        expect(running.clips[0].text).toContain('School buses will still run as usual.');
        // Closure menu has no key 2, so no confirm_2 clip.
        expect(today.clips.map((c) => c.kind)).not.toContain('confirm_2');
    });

    it('class-wide notices name no child: the only names are the school and the class', () => {
        for (const language of PARENT_LANGUAGES) {
            const r = renderNoticeScript({ ...base, purpose: 'event_invite', facts: SAMPLE_EVENT, language, variant: 'default' });
            expect(r.clips[0].text).toContain(SAMPLE_SCHOOL.spokenName[language]);
        }
    });

    it('estimates within the 38 s budget for the sample facts in every language', () => {
        for (const language of PARENT_LANGUAGES) {
            for (const [purpose, facts, variants] of [
                ['ptm_invite', SAMPLE_PTM, ['default']],
                ['event_invite', SAMPLE_EVENT, ['default']],
                ['emergency_closure', SAMPLE_CLOSURE, ['today', 'tomorrow']],
            ] as const) {
                for (const variant of variants) {
                    const r = renderNoticeScript({ ...base, purpose, facts, language, variant });
                    expect(r.estimatedSeconds).toBeGreaterThan(10);
                    expect(r.estimatedSeconds).toBeLessThanOrEqual(MESSAGE_AND_MENU_BUDGET_SECONDS);
                    expect(r.warnings).toEqual([]);
                }
            }
        }
    });

    it('uses the measured chars/second from each template file (hi 9.8, en 9.5)', () => {
        expect(estimateSeconds('क'.repeat(98), 'Hindi')).toBe(10);
        expect(estimateSeconds('a'.repeat(95), 'English')).toBe(10);
    });

    it('warns when a message would cross into a second billed minute', () => {
        const longName = { ...SAMPLE_SCHOOL, spokenName: { ...SAMPLE_SCHOOL.spokenName, English: 'Hillview '.repeat(40).trim() } };
        const r = renderNoticeScript({ ...base, school: longName, purpose: 'ptm_invite', facts: SAMPLE_PTM, language: 'English', variant: 'default' });
        expect(r.estimatedSeconds).toBeGreaterThan(38);
        expect(r.warnings.join(' ')).toMatch(/38 s budget/);
    });

    describe('refuses what it cannot say', () => {
        const ptm = (facts: Partial<PtmFacts>) => ({ ...base, purpose: 'ptm_invite' as const, facts: { ...SAMPLE_PTM, ...facts }, language: 'Hindi' as const, variant: 'default' as const });

        it('planned or human-only purposes', () => {
            expect(() => renderNoticeScript({ ...base, purpose: 'fee_due', facts: SAMPLE_PTM, language: 'Hindi', variant: 'default' })).toThrow(/not available/);
            expect(() => renderNoticeScript({ ...base, purpose: 'safeguarding', facts: SAMPLE_PTM, language: 'Hindi', variant: 'default' })).toThrow(ScriptRenderError);
        });

        it('facts of the wrong kind, and the wrong variant', () => {
            expect(() => renderNoticeScript({ ...base, purpose: 'ptm_invite', facts: SAMPLE_EVENT, language: 'Hindi', variant: 'default' })).toThrow(/do not match/);
            expect(() => renderNoticeScript({ ...base, purpose: 'ptm_invite', facts: SAMPLE_PTM, language: 'Hindi', variant: 'today' })).toThrow(/no "today" variant/);
            expect(() => renderNoticeScript({ ...base, purpose: 'emergency_closure', facts: SAMPLE_CLOSURE, language: 'Hindi', variant: 'default' })).toThrow(/today" or "tomorrow/);
        });

        it('a minute that is not 0 or 30, an impossible date, an unknown venue', () => {
            expect(() => renderNoticeScript(ptm({ time: { hour: 10, minute: 45 as 0 } }))).toThrow(/whole and half hours/);
            expect(() => renderNoticeScript(ptm({ date: '2026-02-31' }))).toThrow(/real calendar date/);
            expect(() => renderNoticeScript(ptm({ venueId: 'moon' }))).toThrow(/Unknown venue/);
        });

        it('an unknown event type or closure reason', () => {
            expect(() =>
                renderNoticeScript({ ...base, purpose: 'event_invite', facts: { ...SAMPLE_EVENT, eventType: 'fete' as never }, language: 'Nepali', variant: 'default' }),
            ).toThrow(/event type/);
            expect(() =>
                renderNoticeScript({ ...base, purpose: 'emergency_closure', facts: { ...SAMPLE_CLOSURE, reason: 'snow' as never }, language: 'Nepali', variant: 'today' }),
            ).toThrow(/closure reason/);
        });

        it('a missing spoken name, or one in Latin letters for an Indic language', () => {
            const noName = { ...SAMPLE_SCHOOL, spokenName: { ...SAMPLE_SCHOOL.spokenName, Nepali: '  ' } };
            expect(() => renderNoticeScript({ ...base, school: noName, purpose: 'ptm_invite', facts: SAMPLE_PTM, language: 'Nepali', variant: 'default' })).toThrow(/no spoken name/);
            const latin = { ...SAMPLE_SCHOOL, spokenName: { ...SAMPLE_SCHOOL.spokenName, Hindi: 'Hillview स्कूल' } };
            expect(() => renderNoticeScript({ ...base, school: latin, purpose: 'ptm_invite', facts: SAMPLE_PTM, language: 'Hindi', variant: 'default' })).toThrow(/Latin letters/);
        });

        it('a section it cannot say', () => {
            expect(() => renderNoticeScript({ ...ptm({}), audience: { kind: 'section', grade: 7, section: 'Q' } })).toThrow(ScriptRenderError);
        });
    });
});
