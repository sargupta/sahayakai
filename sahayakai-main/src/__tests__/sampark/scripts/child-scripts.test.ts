/**
 * @jest-environment node
 *
 * CLASS GATES for the child-specific call scripts (slice 2):
 *   - template parity (all four languages, identical placeholders) and purity
 *     (no Latin letter, ASCII digit or emoji in Indic text) — gate 6, extended;
 *   - the per-sentence Nepali gate passes every Nepali child template and fails
 *     every Hindi one — gate 7, extended;
 *   - no child-specific fact is spoken before the listener check — gate 9;
 *   - a request to talk (A1/A3/A4) never states a concern in audio;
 *   - fee scripts: no amount before the listener check, never a threat, a
 *     consequence, a payment on the call or a request for a number; the OTP
 *     warning is always present; fee calls close at 19:00 IST;
 *   - every new template is flagged "needs native review" in the manifest, and
 *     nothing claims a reviewer.
 */
import manifest from '@/locales/call-scripts/child-notices.review-manifest.json';
import { purposeSpec, ruleDrivenPurposes } from '@/lib/sampark/catalogue';
import { istInstant } from '@/lib/sampark/policy/ist';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import { isSayableAmount } from '@/lib/sampark/rules/evaluate-fees';
import { CONCERN_PURPOSES } from '@/lib/sampark/rules/types';
import { expectedMenuKeys, hasAsciiDigits, hasEmoji, hasLatinLetters, hasUnfilledPlaceholder, menuKeysMentioned, placeholdersIn } from '@/lib/sampark/scripts/parity';
import { checkNepaliSentence, checkNepaliText, splitSentences } from '@/lib/sampark/scripts/purity';
import { SAMPLE_SCHOOL } from '@/lib/sampark/scripts/samples';
import { CHILD_PURPOSES, childScripts, type ChildPurposeId } from '@/lib/sampark/scripts/child-templates';
import { canNameChild, formatAmount, renderChildScript } from '@/lib/sampark/scripts/child-render';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import { PARENT_LANGUAGES, type ParentLanguage } from '@/types/sampark';
import { school } from '../engine/_fixtures';

const INDIC: ParentLanguage[] = ['Hindi', 'Bengali', 'Nepali'];
const NAMES = { English: 'Riya', Hindi: 'रिया', Bengali: 'রিয়া', Nepali: 'रिया' };
const STUDENT = { spokenFirstName: NAMES };
const FEE = { kind: 'fee' as const, dueId: 'd1', amountRupees: 12500, dueDate: '2026-10-15' };
const factsFor = (p: ChildPurposeId) => (p === 'fee_due' || p === 'fee_overdue' ? FEE : null);
const render = (purpose: ChildPurposeId, language: ParentLanguage, facts = factsFor(purpose)) =>
    renderChildScript({ purpose, language, school: SAMPLE_SCHOOL, student: STUDENT, facts });

function leaves(language: ParentLanguage): Map<string, string> {
    const out = new Map<string, string>();
    const f = childScripts(language);
    for (const [p, tpl] of Object.entries(f.purposes)) for (const [k, v] of Object.entries(tpl)) out.set(`purposes.${p}.${k}`, v as string);
    out.set('common.listener_no_input', f.common.listener_no_input);
    return out;
}

describe('child scripts: coverage and parity (gate 6 extended)', () => {
    it('every rule-driven purpose in the catalogue has a template in every language, and no extras', () => {
        const rd = ruleDrivenPurposes().map((s) => s.id).sort();
        expect([...CHILD_PURPOSES].sort()).toEqual(rd);
        for (const language of PARENT_LANGUAGES) expect(Object.keys(childScripts(language).purposes).sort()).toEqual(rd);
    });
    it('all four languages have the same paths with identical placeholder sets', () => {
        const [ref, ...rest] = PARENT_LANGUAGES;
        const refLeaves = leaves(ref);
        for (const language of rest) {
            const l = leaves(language);
            expect([...l.keys()].sort()).toEqual([...refLeaves.keys()].sort());
            for (const [path, text] of refLeaves) {
                expect({ language, path, slots: placeholdersIn(l.get(path)!).join(',') }).toEqual({ language, path, slots: placeholdersIn(text).join(',') });
            }
        }
    });
    it('every purpose has the clips its catalogue menu needs (confirm_1/confirm_2)', () => {
        for (const p of CHILD_PURPOSES) {
            const menu = purposeSpec(p).menu!;
            for (const language of PARENT_LANGUAGES) {
                const tpl = childScripts(language).purposes[p];
                expect({ language, p, confirm1: !!tpl.confirm_1 }).toEqual({ language, p, confirm1: menu.key1 !== null });
                expect({ language, p, confirm2: !!tpl.confirm_2 }).toEqual({ language, p, confirm2: menu.key2 !== null });
            }
        }
    });
    it('menus offer exactly the keys in the catalogue MenuSpec', () => {
        for (const p of CHILD_PURPOSES) {
            const expected = [...expectedMenuKeys(purposeSpec(p).menu!)].sort();
            for (const language of PARENT_LANGUAGES) {
                const menu = childScripts(language).purposes[p].menu;
                expect({ language, p, keys: [...menuKeysMentioned(menu, language)].sort() }).toEqual({ language, p, keys: expected });
            }
        }
    });
    it('the listener check asks for key 1 and only key 1', () => {
        for (const p of CHILD_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                expect([...menuKeysMentioned(childScripts(language).purposes[p].listenerCheck, language)]).toEqual(['1']);
            }
        }
    });
});

describe('child scripts: purity (no Latin letters, ASCII digits or emoji in Indic text)', () => {
    it('raw Indic templates are clean', () => {
        for (const language of INDIC) {
            for (const [path, text] of leaves(language)) {
                const bare = text.replace(/\{[^{}]*\}/g, '');
                expect({ language, path, latin: hasLatinLetters(bare), digits: hasAsciiDigits(bare), emoji: hasEmoji(text) }).toEqual({ language, path, latin: false, digits: false, emoji: false });
            }
        }
    });
    it('every rendered clip, for every purpose and language, is clean and has no unfilled placeholder', () => {
        for (const p of CHILD_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                for (const clip of render(p, language).clips) {
                    expect(hasUnfilledPlaceholder(clip.text)).toBe(false);
                    expect(hasEmoji(clip.text)).toBe(false);
                    if (language !== 'English') {
                        expect({ language, p, kind: clip.kind, latin: hasLatinLetters(clip.text), digits: hasAsciiDigits(clip.text) }).toEqual({ language, p, kind: clip.kind, latin: false, digits: false });
                    }
                }
            }
        }
    });
    it('message and menu fit the 60-second billing unit by estimate', () => {
        for (const p of CHILD_PURPOSES) for (const language of PARENT_LANGUAGES) expect(render(p, language).warnings).toEqual([]);
    });
});

describe('child scripts: the Nepali-versus-Hindi gate (gate 7 extended)', () => {
    it('passes every sentence of every Nepali child template', () => {
        for (const [path, text] of leaves('Nepali')) {
            const result = checkNepaliText(text);
            expect({ path, failures: result.sentences.filter((s) => !s.ok).map((s) => `${s.sentence} [${s.reason}]`) }).toEqual({ path, failures: [] });
        }
    });
    it('passes every sentence of every RENDERED Nepali clip (names, amounts and dates filled in)', () => {
        for (const p of CHILD_PURPOSES) {
            for (const clip of render(p, 'Nepali').clips) {
                const result = checkNepaliText(clip.text);
                expect({ p, kind: clip.kind, failures: result.sentences.filter((s) => !s.ok).map((s) => s.sentence) }).toEqual({ p, kind: clip.kind, failures: [] });
            }
        }
    });
    it('NEGATIVE CONTROL: fails every Hindi child sentence that has words (proves the gate has teeth)', () => {
        let checked = 0;
        for (const [path, text] of leaves('Hindi')) {
            for (const sentence of splitSentences(text)) {
                const v = checkNepaliSentence(sentence);
                checked++;
                expect({ path, sentence, ok: v.ok }).toEqual({ path, sentence, ok: false });
            }
        }
        expect(checked).toBeGreaterThan(60);
    });
});

describe('gate 9: no child-specific fact is spoken before the listener check', () => {
    it('the listener check uses only {schoolName} and {childName}, in every language', () => {
        for (const p of CHILD_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                expect({ language, p, slots: placeholdersIn(childScripts(language).purposes[p].listenerCheck) }).toEqual({ language, p, slots: ['childName', 'schoolName'] });
            }
        }
    });
    it('the listener check is the first clip and the facts are only in the clip after it', () => {
        for (const p of CHILD_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                const clips = render(p, language).clips;
                expect(clips[0].kind).toBe('listener_check');
                expect(clips[1].kind).toBe('message');
            }
        }
    });
    it('the listener check carries no amount, no date and no digit, whatever the facts', () => {
        for (const amountRupees of [100, 12500, 45000, 250000, 6_000_900]) {
            if (!isSayableAmount(amountRupees)) continue;
            for (const dueDate of ['2026-10-05', '2026-12-31']) {
                for (const language of PARENT_LANGUAGES) {
                    const rendered = render('fee_due', language, { kind: 'fee', dueId: 'd', amountRupees, dueDate });
                    const check = rendered.clips[0].text;
                    expect(hasAsciiDigits(check.replace('press 1', ''))).toBe(false);
                    const amountWords = formatAmount(amountRupees, language);
                    expect(check.includes(amountWords)).toBe(false);
                    expect(rendered.clips[1].text).toContain(amountWords);
                    // the child's name IS spoken (that is the point of the check) and nothing about money
                    expect(check).toContain(NAMES[language]);
                    expect(check.includes(childScripts(language).amount.thousand)).toBe(false);
                    expect(check.includes(childScripts(language).amount.hundred)).toBe(false);
                }
            }
        }
    });
    it('detector: a template whose check carried {amount} would fail the slot rule', () => {
        expect(placeholdersIn('Namaste. {schoolName} for {childName}: fee {amount}')).not.toEqual(['childName', 'schoolName']);
    });
    it('if the parent never presses 1, the fallback says nothing about the child', () => {
        for (const p of CHILD_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                const clip = render(p, language).clips.find((c) => c.kind === 'listener_no_input')!;
                expect(clip.text.includes(NAMES[language])).toBe(false);
                expect(hasAsciiDigits(clip.text)).toBe(false);
            }
        }
    });
});

/** Words that would state or hint at a concern, per language. A request to talk must contain none. */
const CONCERN_WORDS: Record<ParentLanguage, RegExp> = {
    English: /\b(absent|absence|attendance|present|marks?|scores?|grades?|exams?|tests?|fail\w*|behaviou?r\w*|conduct|discipline\w*|misbehav\w*|complain\w*|problems?|poor|low|concerns?|trouble|worr\w*|bad|fight\w*|punish\w*|struggl\w*|weak|decline|drop\w*)\b/i,
    Hindi: /(अनुपस्थित|हाज़िरी|उपस्थिति|अंक|नंबर|परीक्षा|टेस्ट|फेल|व्यवहार|अनुशासन|शिकायत|समस्या|चिंता|कमज़ोर|ख़राब|खराब|लड़ाई|सज़ा|गैरहाज़िर|पिछड़)/,
    Bengali: /(অনুপস্থিত|হাজিরা|উপস্থিতি|নম্বর|পরীক্ষা|ফেল|আচরণ|শৃঙ্খলা|অভিযোগ|সমস্যা|চিন্তা|দুর্বল|খারাপ|ঝগড়া|শাস্তি)/,
    Nepali: /(अनुपस्थित|उपस्थिति|अङ्क|परीक्षा|फेल|व्यवहार|अनुशासन|उजुरी|समस्या|चिन्ता|कमजोर|नराम्रो|झगडा|सजाय|पछि परे)/,
};

describe('proposals never state a concern in audio (A1, A3, A4 are requests to talk)', () => {
    it('the three concern purposes are exactly the catalogue\'s Fri/Sat purposes', () => {
        expect([...CONCERN_PURPOSES].sort()).toEqual(['academic_talk', 'attendance_talk', 'conduct_talk']);
    });
    it('a concern purpose takes no fact at all: only the school and the child are named', () => {
        for (const p of CONCERN_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                for (const [path, text] of Object.entries(childScripts(language).purposes[p as ChildPurposeId])) {
                    for (const slot of placeholdersIn(text as string)) expect({ language, p, path, slot, ok: ['schoolName', 'childName'].includes(slot) }).toEqual({ language, p, path, slot, ok: true });
                }
            }
        }
        expect(() => render('academic_talk', 'English', FEE)).toThrow(ScriptRenderError);
    });
    it('no rendered clip contains concern vocabulary, in any language', () => {
        for (const p of CONCERN_PURPOSES) {
            for (const language of PARENT_LANGUAGES) {
                for (const clip of render(p as ChildPurposeId, language).clips) {
                    expect({ language, p, kind: clip.kind, concern: CONCERN_WORDS[language].exec(clip.text)?.[0] ?? null }).toEqual({ language, p, kind: clip.kind, concern: null });
                }
            }
        }
    });
    it('the three requests to talk sound identical, so a parent cannot tell which rule fired', () => {
        for (const language of PARENT_LANGUAGES) {
            const [a, b, c] = CONCERN_PURPOSES.map((p) => render(p as ChildPurposeId, language).clips.map((x) => x.text).join('|'));
            expect(a).toBe(b);
            expect(b).toBe(c);
        }
    });
    it('the vocabulary detector actually fires on a concern sentence', () => {
        expect(CONCERN_WORDS.English.test("Riya has been absent and her marks are low")).toBe(true);
        expect(CONCERN_WORDS.Hindi.test('रिया का व्यवहार ठीक नहीं है')).toBe(true);
        expect(CONCERN_WORDS.Bengali.test('রিয়ার আচরণ নিয়ে অভিযোগ আছে')).toBe(true);
        expect(CONCERN_WORDS.Nepali.test('रियाको व्यवहारमा समस्या छ')).toBe(true);
        expect(CONCERN_WORDS.English.test('would like to speak with you this week about how Riya is doing at school')).toBe(false);
    });
});

describe('fee scripts (plan §2C)', () => {
    const THREATS: Record<ParentLanguage, RegExp> = {
        English: /\b(penalt\w*|fines?|late fee|action|legal\w*|court|cancel\w*|struck|strike|expel\w*|suspend\w*|consequence\w*|or else|must pay|pay now|immediately|failure to)\b/i,
        Hindi: /(जुर्माना|कार्रवाई|कानूनी|नाम काट|निष्कासित|निलंबित|अदालत|तुरंत जमा|अभी जमा)/,
        Bengali: /(জরিমানা|ব্যবস্থা নেওয়া|আইনি|নাম কাটা|বহিষ্কার|আদালত|এক্ষুনি জমা)/,
        Nepali: /(जरिवाना|कारबाही|कानुनी|नाम काट|निष्कासन|अदालत|तुरुन्तै तिर)/,
    };
    const NUMBER_REQUEST: Record<ParentLanguage, RegExp> = {
        English: /\b(tell|give|read|send|share|provide)\b[^.]*\b(your|the)\b[^.]*\b(number|card|account|pin|password|details)\b/i,
        Hindi: /(नंबर बताएँ|कार्ड नंबर|खाता नंबर|पिन बताएँ|विवरण भेजें)/,
        Bengali: /(নম্বর বলুন|কার্ড নম্বর|অ্যাকাউন্ট নম্বর|পিন বলুন)/,
        Nepali: /(नम्बर भन्नुहोस्|कार्ड नम्बर|खाता नम्बर|पिन भन्नुहोस्)/,
    };
    const OTP: Record<ParentLanguage, string> = { English: 'never share an OTP', Hindi: 'ओटीपी न बताएँ', Bengali: 'ওটিপি বলবেন না', Nepali: 'ओटीपी नभन्नुहोस्' };
    const COUNTER: Record<ParentLanguage, string> = { English: "school counter or in its app", Hindi: 'स्कूल के काउंटर या ऐप', Bengali: 'স্কুলের কাউন্টার বা অ্যাপ', Nepali: 'स्कुलको काउन्टर वा एप' };

    it.each(['fee_due', 'fee_overdue'] as const)('%s: carries the OTP warning and the counter-or-app instruction, in every language', (p) => {
        for (const language of PARENT_LANGUAGES) {
            const message = render(p, language).clips.find((c) => c.kind === 'message')!.text;
            expect(message).toContain(OTP[language]);
            expect(message).toContain(COUNTER[language]);
        }
    });
    it.each(['fee_due', 'fee_overdue'] as const)('%s: no threat, no consequence, no payment on the call, no request for a number', (p) => {
        for (const language of PARENT_LANGUAGES) {
            for (const clip of render(p, language).clips) {
                expect({ language, kind: clip.kind, threat: THREATS[language].exec(clip.text)?.[0] ?? null }).toEqual({ language, kind: clip.kind, threat: null });
                expect({ language, kind: clip.kind, ask: NUMBER_REQUEST[language].exec(clip.text)?.[0] ?? null }).toEqual({ language, kind: clip.kind, ask: null });
            }
        }
    });
    it('offers the family a way to speak to accounts, including if paying is difficult (key 2), and key 1 for already paid', () => {
        expect(purposeSpec('fee_due').menu).toMatchObject({ key1: 'already_paid', key2: 'talk_to_accounts' });
        expect(purposeSpec('fee_overdue').menu).toMatchObject({ key1: 'already_paid', key2: 'talk_to_accounts' });
    });
    it('detectors fire on planted threats', () => {
        expect(THREATS.English.test('A late fee will be charged')).toBe(true);
        expect(THREATS.Hindi.test('जुर्माना लगेगा')).toBe(true);
        expect(NUMBER_REQUEST.English.test('Please tell us your card number')).toBe(true);
    });
    it('closes at 19:00 IST: 18:59 is allowed, 19:00 and 09:59 are not, and the next opening is 10:00', () => {
        const s = school();
        const spec = purposeSpec('fee_due');
        expect(spec.windowEndHour).toBe(19);
        const wed = (h: number, m: number) => istInstant('2026-10-07', h, m);
        expect(samparkWindowVerdict(s, spec, wed(18, 59)).allowed).toBe(true);
        expect(samparkWindowVerdict(s, spec, wed(19, 0)).allowed).toBe(false);
        expect(samparkWindowVerdict(s, spec, wed(9, 59)).allowed).toBe(false);
        expect(samparkWindowVerdict(s, spec, wed(10, 0)).allowed).toBe(true);
        expect(samparkWindowVerdict(s, spec, wed(19, 30)).nextAllowedAt?.toISOString()).toBe(istInstant('2026-10-08', 10, 0).toISOString());
        // a school that allows until 20:00 is still held to 19:00 for fees; a purpose without the field keeps 20:00
        expect(samparkWindowVerdict(s, purposeSpec('academic_talk'), wed(19, 30)).allowed).toBe(true);
    });
    it('both fee purposes allow at most two attempts', () => {
        expect(purposeSpec('fee_due').maxAttempts).toBe(2);
        expect(purposeSpec('fee_overdue').maxAttempts).toBe(2);
    });
});

describe('amounts are spoken from the reviewed lexicon, or refused', () => {
    it('12500 in four languages', () => {
        expect(formatAmount(12500, 'English')).toBe('twelve thousand five hundred rupees');
        expect(formatAmount(12500, 'Hindi')).toBe('बारह हज़ार पाँच सौ रुपये');
        expect(formatAmount(12500, 'Bengali')).toBe('বারো হাজার পাঁচ শো টাকা');
        expect(formatAmount(12500, 'Nepali')).toBe('बाह्र हजार पाँच सय रुपैयाँ');
    });
    it('lakhs and round thousands', () => {
        expect(formatAmount(250000, 'English')).toBe('two lakh fifty thousand rupees');
        expect(formatAmount(5000, 'Nepali')).toBe('पाँच हजार रुपैयाँ');
        expect(formatAmount(100, 'Hindi')).toBe('एक सौ रुपये');
    });
    it('refuses what it cannot say reliably', () => {
        for (const bad of [0, 99, 12550, 75000, 12500.5, -100, Number.NaN]) {
            expect(() => formatAmount(bad, 'English')).toThrow(ScriptRenderError);
        }
    });
    it('every sayable amount in a sweep renders without digits or Latin in Indic, and passes the Nepali gate', () => {
        for (let amount = 100; amount <= 60_900; amount += 1700) {
            if (amount % 100 !== 0) continue;
            for (const language of PARENT_LANGUAGES) {
                const words = formatAmount(amount, language);
                expect(hasAsciiDigits(words)).toBe(false);
                if (language !== 'English') expect(hasLatinLetters(words)).toBe(false);
                if (language === 'Nepali') expect(checkNepaliText(words).ok).toBe(true);
            }
        }
    });
});

describe('the renderer fails closed', () => {
    it('refuses a child with no reviewed spoken name in the language, or a Latin name in an Indic language', () => {
        const noNepali = { spokenFirstName: { English: 'Riya', Hindi: 'रिया' } };
        expect(() => renderChildScript({ purpose: 'academic_talk', language: 'Nepali', school: SAMPLE_SCHOOL, student: noNepali, facts: null })).toThrow(/no reviewed spoken first name in Nepali/);
        expect(() => renderChildScript({ purpose: 'academic_talk', language: 'Hindi', school: SAMPLE_SCHOOL, student: { spokenFirstName: { Hindi: 'Riya' } }, facts: null })).toThrow(/Latin letters/);
        expect(canNameChild(noNepali, 'Nepali')).toBe(false);
        expect(canNameChild(noNepali, 'Hindi')).toBe(true);
    });
    it('refuses fee facts that are missing, and a purpose with no child template', () => {
        expect(() => render('fee_due', 'English', null as never)).toThrow(/needs fee facts/);
        expect(() => renderChildScript({ purpose: 'ptm_invite' as never, language: 'English', school: SAMPLE_SCHOOL, student: STUDENT, facts: null })).toThrow(/no child-specific template/);
    });
});

describe('native-review manifest: nothing here is claimed correct', () => {
    it('lists every template purpose and flags every language as needing review, with no reviewer', () => {
        expect([...manifest.purposes].sort()).toEqual([...CHILD_PURPOSES].sort());
        for (const language of PARENT_LANGUAGES) {
            const entry = manifest.languages[language];
            expect(entry.status).toBe('needs native review');
            expect(entry.reviewedBy).toBeNull();
            expect(entry.concerns.length).toBeGreaterThan(0);
            expect(childScripts(language)._meta.reviewedBy).toBeNull();
            expect(childScripts(language)._meta.reviewStatus).toMatch(/needs native-speaker sign-off/);
        }
        expect(manifest.languages.Nepali.concerns.join(' ')).toMatch(/native speaker must read every line/);
    });
});
