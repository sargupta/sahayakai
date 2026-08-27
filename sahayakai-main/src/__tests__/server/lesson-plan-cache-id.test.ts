/**
 * @jest-environment node
 *
 * Class gate for `cached_lesson_plans` document ids.
 *
 * `cached_lesson_plans` is a SHARED cache: the document id is the only thing
 * separating one teacher's plan from another's. The v1 id slugified
 * `topic-grade-language` down to [a-z0-9-], which erased every non-Latin
 * character, so ten of the eleven supported languages produced ids that
 * encoded nothing but the topic's character count — six unrelated Hindi
 * topics all resolved to "----------------7-hi" and served each other's
 * lesson plans.
 *
 * This gate is deliberately written against the *class* of defect rather
 * than that one string: any future id scheme that discards script must fail
 * `distinct topics -> distinct ids` in every language the app ships.
 */

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getDbMock = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: (...args: any[]) => getDbMock(...args),
}));

import {
    generateCacheId,
    getCachedLessonPlan,
    saveLessonPlanToCache,
} from '@/server/lesson-plan';

/**
 * Six unrelated Class 7 science/civics topics per script. Within a script
 * these share nothing but their alphabet — exactly the case the slug id
 * could not tell apart.
 */
const TOPICS_BY_LANGUAGE: Record<string, string[]> = {
    hindi: ['प्रकाश संश्लेषण', 'भारत का संविधान', 'अपवर्तन के नियम', 'ध्वनि की तरंगें', 'बल तथा गति नियम', 'मानव पाचन तंत्र'],
    bengali: ['সালোকসংশ্লেষণ', 'ভারতের সংবিধান', 'প্রতিসরণের সূত্র', 'শব্দের তরঙ্গ', 'বল ও গতির সূত্র', 'মানব পাচনতন্ত্র'],
    tamil: ['ஒளிச்சேர்க்கை', 'இந்திய அரசியலமைப்பு', 'ஒளி விலகல் விதிகள்', 'ஒலி அலைகள்', 'விசை மற்றும் இயக்கம்', 'மனித செரிமான மண்டலம்'],
    telugu: ['కిరణజన్య సంయోగక్రియ', 'భారత రాజ్యాంగం', 'వక్రీభవన నియమాలు', 'ధ్వని తరంగాలు', 'బలం మరియు గమనం', 'మానవ జీర్ణవ్యవస్థ'],
    kannada: ['ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ', 'ಭಾರತದ ಸಂವಿಧಾನ', 'ವಕ್ರೀಭವನದ ನಿಯಮಗಳು', 'ಶಬ್ದ ತರಂಗಗಳು', 'ಬಲ ಮತ್ತು ಚಲನೆ', 'ಮಾನವ ಜೀರ್ಣಾಂಗ ವ್ಯವಸ್ಥೆ'],
    malayalam: ['പ്രകാശസംശ്ലേഷണം', 'ഇന്ത്യൻ ഭരണഘടന', 'അപവർത്തന നിയമങ്ങൾ', 'ശബ്ദ തരംഗങ്ങൾ', 'ബലവും ചലനവും', 'മനുഷ്യ ദഹനവ്യവസ്ഥ'],
    marathi: ['प्रकाशसंश्लेषण', 'भारताचे संविधान', 'अपवर्तनाचे नियम', 'ध्वनी लहरी', 'बल आणि गती', 'मानवी पचनसंस्था'],
    gujarati: ['પ્રકાશસંશ્લેષણ', 'ભારતનું બંધારણ', 'વક્રીભવનના નિયમો', 'ધ્વનિ તરંગો', 'બળ અને ગતિ', 'માનવ પાચનતંત્ર'],
    punjabi: ['ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ', 'ਭਾਰਤ ਦਾ ਸੰਵਿਧਾਨ', 'ਅਪਵਰਤਨ ਦੇ ਨਿਯਮ', 'ਧੁਨੀ ਤਰੰਗਾਂ', 'ਬਲ ਅਤੇ ਗਤੀ', 'ਮਨੁੱਖੀ ਪਾਚਨ ਤੰਤਰ'],
    odia: ['ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'ଭାରତର ସମ୍ବିଧାନ', 'ଅପବର୍ତ୍ତନ ନିୟମ', 'ଶବ୍ଦ ତରଙ୍ଗ', 'ବଳ ଏବଂ ଗତି', 'ମାନବ ପାଚନ ତନ୍ତ୍ର'],
    english: ['Photosynthesis', 'The Constitution of India', 'Laws of Refraction', 'Sound Waves', 'Force and Motion', 'Human Digestive System'],
};

/** Records every doc id the module hands to Firestore. */
function makeSpyDb(docIds: string[]) {
    return {
        collection: (name: string) => {
            expect(name).toBe('cached_lesson_plans');
            return {
                doc: (id: string) => {
                    docIds.push(id);
                    return {
                        get: async () => ({ exists: false }),
                        set: async () => undefined,
                        delete: async () => undefined,
                    };
                },
            };
        },
    };
}

describe('cached_lesson_plans doc id — Indic collision gate', () => {
    it.each(Object.keys(TOPICS_BY_LANGUAGE))(
        'gives six unrelated %s topics six distinct ids',
        (language) => {
            const ids = TOPICS_BY_LANGUAGE[language].map(t => generateCacheId(t, 'Class 7', language));
            expect(ids.every(id => typeof id === 'string')).toBe(true);
            expect(new Set(ids).size).toBe(TOPICS_BY_LANGUAGE[language].length);
        },
    );

    it('never collapses a topic to punctuation — the id must depend on the script', () => {
        // The v1 defect in one assertion: two unrelated Hindi topics of the
        // SAME character count got the same id, because length was the only
        // thing that survived the slug. Keep these two equal-length.
        const waterCycle = 'जल चक्र';
        const lawsOfForce = 'बल नियम';
        expect(waterCycle).toHaveLength(lawsOfForce.length);
        expect(generateCacheId(waterCycle, 'Class 7', 'hindi'))
            .not.toBe(generateCacheId(lawsOfForce, 'Class 7', 'hindi'));
    });

    it('keeps every script distinct from every other at the same length', () => {
        const all = Object.entries(TOPICS_BY_LANGUAGE).flatMap(
            ([language, topics]) => topics.map(t => generateCacheId(t, 'Class 7', language)),
        );
        expect(new Set(all).size).toBe(all.length);
    });
});

describe('cached_lesson_plans doc id — identity', () => {
    it('is stable across calls for identical inputs (the cache still hits)', () => {
        const first = generateCacheId('प्रकाश संश्लेषण', 'Class 7', 'hindi');
        const second = generateCacheId('  प्रकाश संश्लेषण  ', 'Class 7', 'hindi');
        expect(first).toBe(second);
        expect(first).not.toBeNull();
    });

    it('ignores Unicode normalisation form, so two keyboards agree', () => {
        // Bengali ো is U+09CB composed and U+09C7 U+09BE decomposed. Both are
        // what a real IME emits, they render identically, and without an NFC
        // pass the two spellings of one topic would sit in two cache entries.
        const composed = 'সালোকসংশ্লেষণ'.normalize('NFC');
        const decomposed = 'সালোকসংশ্লেষণ'.normalize('NFD');
        expect(composed).not.toBe(decomposed); // genuinely different code points
        expect(generateCacheId(composed, 'Class 7', 'bengali'))
            .toBe(generateCacheId(decomposed, 'Class 7', 'bengali'));
    });

    it('keeps grade in the identity', () => {
        expect(generateCacheId('प्रकाश संश्लेषण', 'Class 7', 'hindi'))
            .not.toBe(generateCacheId('प्रकाश संश्लेषण', 'Class 8', 'hindi'));
    });

    it('keeps language in the identity', () => {
        expect(generateCacheId('Photosynthesis', 'Class 7', 'hindi'))
            .not.toBe(generateCacheId('Photosynthesis', 'Class 7', 'bengali'));
    });

    it('cannot be forged by moving a separator into the topic', () => {
        expect(generateCacheId('gravity|Class 7', 'Class 8', 'english'))
            .not.toBe(generateCacheId('gravity', 'Class 7|Class 8', 'english'));
    });

    it('still refuses to build an id for PII topics', () => {
        expect(generateCacheId('call me on 9876543210', 'Class 7', 'hindi')).toBeNull();
        expect(generateCacheId('mail teacher@school.in', 'Class 7', 'hindi')).toBeNull();
    });
});

describe('cached_lesson_plans doc id — poisoned v1 documents', () => {
    it('is versioned so it can never resolve to a v1 document', () => {
        const id = generateCacheId('प्रकाश संश्लेषण', 'Class 7', 'hindi')!;
        // v1 ids were `${topic}-${grade}-${lang}` slugged to [a-z0-9-], so
        // they contain at least two '-' and never a '_'. Requiring the '_'
        // prefix is what keeps the new scheme off the poisoned documents.
        expect(id.startsWith('v2_')).toBe(true);
        expect(id).toMatch(/^v2_[0-9a-f]{64}$/);
        expect(id).not.toMatch(/^-+\d*-[a-z]+$/);
    });
});

describe('cached_lesson_plans doc id — both call sites use it', () => {
    beforeEach(() => {
        getDbMock.mockReset();
    });

    it('reads and writes the SAME id, and different topics touch different docs', async () => {
        const touched: string[] = [];
        getDbMock.mockResolvedValue(makeSpyDb(touched));

        await getCachedLessonPlan('प्रकाश संश्लेषण', 'Class 7', 'hindi');
        await saveLessonPlanToCache({ title: 'x' } as any, 'प्रकाश संश्लेषण', 'Class 7', 'hindi');
        await getCachedLessonPlan('भारत का संविधान', 'Class 7', 'hindi');

        expect(touched).toHaveLength(3);
        expect(touched[0]).toBe(generateCacheId('प्रकाश संश्लेषण', 'Class 7', 'hindi'));
        expect(touched[1]).toBe(touched[0]); // save targets the doc the read looked for
        expect(touched[2]).not.toBe(touched[0]); // unrelated topic, unrelated doc
    });
});
