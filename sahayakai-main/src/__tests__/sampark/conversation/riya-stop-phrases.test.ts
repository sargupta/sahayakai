/**
 * @jest-environment node
 *
 * Class gate — spoken opt-out in every language a family answers in (audit gap 2).
 *
 * Bug class: a parent says "stop calling me" in their own language and nothing is noticed,
 * so the school keeps calling a family that asked it not to. Riya speaks English, but parents
 * reply in Hindi, Bengali or Nepali, and the recogniser writes that in native script or in
 * Latin letters. Each language therefore has positives in both scripts, and near-misses that
 * must NOT match (a callback request is not an opt-out). Every pattern must be exercised by at
 * least one positive, so a pattern cannot be added without a test.
 */
import { foldForStopMatch, STOP_PHRASES, transcriptRequestsStop } from '@/lib/sampark/conversation/webhook';
import { PARENT_LANGUAGE_INFO } from '@/lib/sampark/languages';

const user = (message: string) => [{ role: 'user' as const, message, timeInCallSecs: 3 }];

const POSITIVES: Record<keyof typeof STOP_PHRASES, string[]> = {
    English: [
        'Please stop calling me.',
        "Don't call me again",
        'Do not call this number',
        'Never call here',
        'Remove my number from your list',
        'unsubscribe',
        'Don’t call us', // curly apostrophe
    ],
    Hindi: [
        'मुझे फ़ोन मत करो',
        'बार बार कॉल मत कीजिए',
        'कृपया फोन न करें',
        'फोन करना बंद करो',
        'कॉल करना बन्द कीजिए',
        'मेरा नंबर हटा दीजिए',
        'phone mat karo please',
        'dobara call mat kijiye',
        'call na karein',
        'phone karna band karo',
        'mera number hata do',
    ],
    Bengali: [
        'আর ফোন করবেন না',
        'আমাকে কল কোরো না',
        'ফোন করা বন্ধ করুন',
        'আমার নম্বর মুছে দিন',
        'আমার নম্বর সরিয়ে দিন', // য় folds to য + nukta → nukta removed
        'phone korben na',
        'call kora bondho korun',
    ],
    Nepali: [
        'फेरि फोन नगर्नुहोस्',
        'कल नगर्नूस्',
        'फोन गर्न बन्द गर्नुहोस्',
        'मेरो नम्बर हटाउनुहोस्',
        'phone nagarnu hai',
        'call garna banda garnuhos',
    ],
};

const NEAR_MISSES: string[] = [
    'Yes I will come',
    'Call me later, I am driving',
    'Can you call my husband instead?',
    'phone mat kaato, main sun raha hoon', // don't hang up
    'फ़ोन मत काटो', // don't hang up
    'main call na kar paya', // I couldn't call
    'मैं कल नगर निगम जाऊँगा', // tomorrow I'll go to the municipal corporation
    'abhi nahi, baad mein call karna', // callback, not opt-out
    'পরে ফোন করবেন', // call later
    'पछि फोन गर्नुहोस्', // call later (Nepali)
    'I will call the school',
];

describe('transcriptRequestsStop', () => {
    for (const [language, examples] of Object.entries(POSITIVES)) {
        it.each(examples)(`${language}: "%s" is a stop request`, (text) => {
            expect(transcriptRequestsStop(user(text))).toBe(true);
        });
    }

    it.each(NEAR_MISSES)('"%s" is not a stop request', (text) => {
        expect(transcriptRequestsStop(user(text))).toBe(false);
    });

    it("only the listener's words count, never Riya's", () => {
        expect(transcriptRequestsStop([{ role: 'agent', message: 'फ़ोन मत करो', timeInCallSecs: 1 }])).toBe(false);
    });

    it('every pattern is exercised by at least one positive example', () => {
        for (const [language, patterns] of Object.entries(STOP_PHRASES)) {
            const folded = POSITIVES[language as keyof typeof STOP_PHRASES].map(foldForStopMatch);
            for (const re of patterns) expect({ language, pattern: String(re), matched: folded.some((t) => re.test(t)) }).toMatchObject({ matched: true });
        }
    });

    it('covers every parent language Sampark supports, in native script and Latin letters', () => {
        for (const language of Object.keys(PARENT_LANGUAGE_INFO)) {
            expect(STOP_PHRASES).toHaveProperty(language);
            const examples = POSITIVES[language as keyof typeof STOP_PHRASES];
            expect(examples.some((t) => /[a-z]/i.test(t))).toBe(true);
            if (language !== 'English') expect(examples.some((t) => /[ऀ-৿]/.test(t))).toBe(true);
        }
    });

    it('folding makes nukta and spelling variants one word', () => {
        expect(foldForStopMatch('फ़ोन')).toBe(foldForStopMatch('फोन'));
        expect(foldForStopMatch('Stop   calling!')).toBe('stop calling');
        expect(foldForStopMatch('बंद करो।')).toBe('बंद करो');
    });
});
