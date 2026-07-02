/**
 * Time-saved estimator for the principal dashboard.
 *
 * Heuristic: each piece of content generated saves a fixed number of minutes
 * versus manual preparation, based on the Karnataka government-school pilot
 * self-reported baselines (N=150, Q4 2025). Numbers are deliberately
 * conservative; the dashboard displays "estimated" and exposes a "see
 * assumptions" link so a principal asking "how did you calculate that?" gets
 * a concrete answer (not a magic number).
 *
 * Baseline times come from the teacher-time research cited in
 * outputs/investment_and_proposals/pitch_strategy_2026/EVIDENCE_AND_SOURCES.md
 * (UNESCO 2023 teacher-time surveys + pilot self-reports).
 *
 * Update these values only with new pilot data; do not tune them to hit a
 * specific demo number.
 */

export const CONTENT_TIME_SAVED_MINUTES = {
    'lesson-plan': 35, // baseline ~45 min, SahayakAI ~5 min output + ~5 min teacher edit
    'quiz': 20, // baseline ~25 min per 3-level quiz
    'worksheet': 15, // baseline ~20 min manual + answer key
    'visual-aid': 10, // baseline ~15 min sketching or sourcing
    'rubric': 25, // baseline ~30 min CCE-aligned rubric
    'exam-paper': 40, // baseline ~60 min board-exam style
    'instant-answer': 3, // teacher research savings
    'field-trip': 30, // virtual field-trip planning
} as const;

export const CONTENT_EDIT_BONUS_MINUTES = 5;

/**
 * Faithful translations of the "assumptions" disclaimer for the 11 supported
 * UI languages. Keyed by ISO uiLangCode. The principal dashboard renders this
 * via `assumptionsRef`, so it must follow the principal's UI language, not the
 * AI-output language. Resolve with `getAssumptionsRef(uiLangCode)`.
 */
export const TIME_SAVED_ASSUMPTIONS_BY_LANG: Record<string, string> = {
    en: 'Based on self-reported baselines from the Karnataka government-school pilot (N=150, Q4 2025). Numbers are conservative estimates, not measured outcomes.',
    hi: 'कर्नाटक सरकारी-स्कूल पायलट (N=150, चौथी तिमाही 2025) से स्व-रिपोर्ट किए गए आधारभूत आँकड़ों पर आधारित। संख्याएँ रूढ़िवादी अनुमान हैं, मापे गए परिणाम नहीं।',
    mr: 'कर्नाटक सरकारी-शाळा पायलट (N=150, चौथी तिमाही 2025) मधील स्व-नोंदवलेल्या आधारभूत आकड्यांवर आधारित. आकडे हे पुराणमतवादी अंदाज आहेत, मोजलेले निष्कर्ष नाहीत.',
    bn: 'কর্ণাটক সরকারি-স্কুল পাইলট (N=150, চতুর্থ ত্রৈমাসিক 2025) থেকে স্ব-প্রতিবেদিত ভিত্তিমান অনুসারে। সংখ্যাগুলি রক্ষণশীল অনুমান, পরিমাপ করা ফলাফল নয়।',
    pa: 'ਕਰਨਾਟਕ ਸਰਕਾਰੀ-ਸਕੂਲ ਪਾਇਲਟ (N=150, ਚੌਥੀ ਤਿਮਾਹੀ 2025) ਤੋਂ ਸਵੈ-ਰਿਪੋਰਟ ਕੀਤੇ ਆਧਾਰ-ਅੰਕੜਿਆਂ ਉੱਤੇ ਆਧਾਰਿਤ। ਅੰਕੜੇ ਰੂੜੀਵਾਦੀ ਅੰਦਾਜ਼ੇ ਹਨ, ਮਾਪੇ ਗਏ ਨਤੀਜੇ ਨਹੀਂ।',
    gu: 'કર્ણાટક સરકારી-શાળા પાઇલટ (N=150, ચોથો ત્રિમાસ 2025) માંથી સ્વ-અહેવાલિત આધારભૂત આંકડાઓ પર આધારિત. સંખ્યાઓ રૂઢિચુસ્ત અંદાજો છે, માપેલા પરિણામો નથી.',
    or: 'କର୍ଣ୍ଣାଟକ ସରକାରୀ-ବିଦ୍ୟାଳୟ ପାଇଲଟ୍ (N=150, ଚତୁର୍ଥ ତ୍ରୟମାସ 2025)ରୁ ସ୍ୱ-ବିବରଣୀ ଆଧାରିତ ମୂଳାଙ୍କ ଉପରେ ଆଧାରିତ। ସଂଖ୍ୟାଗୁଡ଼ିକ ରକ୍ଷଣଶୀଳ ଆକଳନ, ମାପିତ ଫଳାଫଳ ନୁହେଁ।',
    ta: 'கர்நாடக அரசுப் பள்ளி பைலட் (N=150, காலாண்டு 4, 2025) இல் இருந்து சுயமாக அறிக்கையிடப்பட்ட அடிப்படை மதிப்புகளை அடிப்படையாகக் கொண்டது. எண்கள் பழமைவாத மதிப்பீடுகளே, அளவிடப்பட்ட விளைவுகள் அல்ல.',
    te: 'కర్ణాటక ప్రభుత్వ-పాఠశాల పైలట్ (N=150, త్రైమాసికం 4, 2025) నుండి స్వీయ-నివేదిత ప్రాతిపదిక విలువల ఆధారంగా. సంఖ్యలు సంప్రదాయవాద అంచనాలు, కొలిచిన ఫలితాలు కావు.',
    kn: 'ಕರ್ನಾಟಕ ಸರ್ಕಾರಿ-ಶಾಲಾ ಪ್ರಾಯೋಗಿಕ ಯೋಜನೆ (N=150, ತ್ರೈಮಾಸಿಕ 4, 2025) ನಿಂದ ಸ್ವಯಂ-ವರದಿ ಮಾಡಿದ ಆಧಾರ ಮೌಲ್ಯಗಳ ಮೇಲೆ ಆಧಾರಿತ. ಸಂಖ್ಯೆಗಳು ಸಂಪ್ರದಾಯವಾದಿ ಅಂದಾಜುಗಳು, ಅಳೆದ ಫಲಿತಾಂಶಗಳಲ್ಲ.',
    ml: 'കർണാടക സർക്കാർ-സ്കൂൾ പൈലറ്റിൽ (N=150, പാദം 4, 2025) നിന്നുള്ള സ്വയം-റിപ്പോർട്ട് ചെയ്ത അടിസ്ഥാന മൂല്യങ്ങളെ ആധാരമാക്കിയുള്ളത്. സംഖ്യകൾ യാഥാസ്ഥിതിക കണക്കുകൂട്ടലുകളാണ്, അളന്ന ഫലങ്ങളല്ല.',
};

/** Resolve the assumptions disclaimer for a given UI language ISO code. */
export function getAssumptionsRef(uiLangCode?: string): string {
    return (
        (uiLangCode && TIME_SAVED_ASSUMPTIONS_BY_LANG[uiLangCode]) ||
        TIME_SAVED_ASSUMPTIONS_BY_LANG.en
    );
}

export type ContentType = keyof typeof CONTENT_TIME_SAVED_MINUTES;

export interface TimeSavedInput {
    /** Count of `content_created` events by content_type in the window. */
    contentByType: Partial<Record<ContentType, number>>;
    /** Count of `content_edited` events in the window (any type). */
    editsCount?: number;
    /**
     * UI language ISO code (uiLangCode) of the viewer. Drives the language of
     * the `assumptionsRef` disclaimer chrome. Defaults to English when omitted.
     */
    uiLangCode?: string;
}

export interface TimeSavedResult {
    totalMinutes: number;
    totalHours: number;
    byType: Partial<Record<ContentType, number>>;
    assumptionsRef: string;
}

export function estimateTimeSaved(input: TimeSavedInput): TimeSavedResult {
    const byType: Partial<Record<ContentType, number>> = {};
    let totalMinutes = 0;

    for (const [type, count] of Object.entries(input.contentByType) as Array<[ContentType, number]>) {
        const minutesPerItem = CONTENT_TIME_SAVED_MINUTES[type];
        if (minutesPerItem === undefined) continue;
        const saved = (count || 0) * minutesPerItem;
        byType[type] = saved;
        totalMinutes += saved;
    }

    const edits = input.editsCount ?? 0;
    totalMinutes += edits * CONTENT_EDIT_BONUS_MINUTES;

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
        totalMinutes,
        totalHours,
        byType,
        assumptionsRef: getAssumptionsRef(input.uiLangCode),
    };
}
