import type { Language, GradeLevel, Subject } from './index';

// ── Core Enums ───────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type OutreachReason =
    | 'consecutive_absences'
    | 'poor_performance'
    | 'behavioral_concern'
    | 'positive_feedback';

export type CallStatus = 'initiated' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'manual';

// ── Firestore: classes/{classId} ─────────────────────────────────────────────

export interface ClassRecord {
    id: string;
    teacherUid: string;
    name: string;           // e.g. "Class 6A"
    subject: Subject;
    gradeLevel: GradeLevel;
    section?: string;       // "A", "B", etc.
    academicYear: string;   // "2025-26"
    studentCount: number;   // denormalized
    createdAt: string;      // ISO string
    updatedAt: string;
}

// ── Firestore: classes/{classId}/students/{studentId} ────────────────────────

export interface Student {
    id: string;
    classId: string;
    rollNumber: number;         // 1–40
    name: string;
    parentPhone: string;        // E.164: +919876543210
    parentLanguage: Language;
    createdAt: string;
    updatedAt: string;
}

// ── Firestore: attendance/{classId}/records/{YYYY-MM-DD} ─────────────────────
// Parent doc attendance/{classId} is an empty container document.

export interface DailyAttendanceRecord {
    classId: string;
    date: string;                              // YYYY-MM-DD
    teacherUid: string;
    records: Record<string, AttendanceStatus>; // studentId → status
    submittedAt: string;                       // ISO string
    isFinalized: boolean;
}

// ── Firestore: parent_outreach/{outreachId} ──────────────────────────────────

export interface TranscriptTurn {
    role: 'agent' | 'parent';
    text: string;
    timestamp: string;
}

export interface CallSummary {
    parentResponse: string;
    parentConcerns: string[];
    parentCommitments: string[];
    actionItemsForTeacher: string[];
    guidanceGiven: string[];
    parentSentiment: 'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' | 'confused';
    callQuality: 'productive' | 'brief' | 'difficult' | 'unanswered';
    followUpNeeded: boolean;
    followUpSuggestion?: string;
    generatedAt: string;
}

/**
 * Structured academic signal fed into the parent-call conversation.
 * Populated by the Contact-Parent modal from the most recent assessments
 * in `classes/{classId}/students/{studentId}/assessments` so the AI-generated
 * message and live-call agent can reference specific test marks instead of
 * relying on attendance-only metrics + free-text teacherNote.
 *
 * All fields optional — absent means "no recent assessment data available".
 * See spawned task "Wire Assessment data into ParentOutreach" for history.
 */
export interface PerformanceContext {
    /** IDs of the most recent assessments (usually 2–3) used to populate this context. */
    recentAssessmentIds?: string[];
    /** Weighted average across the recent assessments (0–100). */
    latestPercentage?: number;
    /** Per-subject breakdown so the AI can cite specific tests. */
    subjectBreakdown?: {
        subject: string;
        name: string;               // e.g. "Unit Test 1 — Fractions & Decimals"
        marksObtained: number;
        maxMarks: number;
        percentage: number;         // 0–100
        date: string;               // YYYY-MM-DD
    }[];
    /** Mirror of StudentPerformanceTrend.isAtRisk — average < 35%. */
    isAtRisk?: boolean;
}

export interface ParentOutreach {
    id: string;
    teacherUid: string;
    classId: string;
    className: string;
    studentId: string;
    studentName: string;
    parentPhone: string;
    parentLanguage: Language;
    reason: OutreachReason;
    teacherNote?: string;
    generatedMessage: string;
    deliveryMethod: 'twilio_call' | 'whatsapp_copy';
    /**
     * Personalization fields consumed by the Exotel streaming voicebot
     * (sahayakai-voice-call). Populated server-side at outreach creation so the
     * agent can greet by subject, name the teacher, and name the school.
     * Optional because the legacy Twilio batch path does not require them.
     */
    subject?: Subject;
    teacherName?: string;
    schoolName?: string;
    callSid?: string;
    callStatus?: CallStatus;
    // Conversational call fields
    transcript?: TranscriptTurn[];
    callSummary?: CallSummary;
    answeredBy?: string;
    callDurationSeconds?: number;
    turnCount?: number;
    /** Which voice pipeline mode was used: 'streaming' (Pipecat) or 'batch' (Twilio Gather/Say) */
    voicePipelineMode?: 'streaming' | 'batch';
    /** Snapshot of recent academic performance, populated when the call is created. */
    performanceContext?: PerformanceContext;
    createdAt: string;
    updatedAt: string;
}

// ── Computed (not stored) ────────────────────────────────────────────────────

export interface StudentAttendanceSummary {
    studentId: string;
    studentName: string;
    rollNumber: number;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    attendanceRate: number;        // 0–100
    consecutiveAbsences: number;   // current streak
}

// ── Twilio language codes for <Say> ──────────────────────────────────────────

// All 11 languages supported via Google TTS voices on Twilio.
// Neural2 (best) for hi/en, Wavenet for most others, Standard for te (no Wavenet).
export const TWILIO_LANGUAGE_MAP: Record<Language, string | null> = {
    English:   'en-IN',
    Hindi:     'hi-IN',
    Kannada:   'kn-IN',
    Tamil:     'ta-IN',
    Telugu:    'te-IN',
    Malayalam: 'ml-IN',
    Bengali:   'bn-IN',
    Marathi:   'mr-IN',
    Gujarati:  'gu-IN',
    Punjabi:   'pa-IN',
    // F8-02 fix (P0): Odia has no native Google TTS voice on Twilio. Previously
    // this was `null`, then `LANG_MAP[lang] ?? 'en-IN'` rendered Odia text
    // through an English voice — completely broken outreach. We fall back to
    // 'hi-IN' to match the Odia→Hindi TTS fallback used elsewhere in the app
    // (Hindi voice over Odia text is the standard regional substitution we ship).
    Odia:      'hi-IN',
};

// Female voices preferred — warmer tone for parent communication.
// Tier: Neural2 > Wavenet > Standard
export const TWILIO_VOICE_MAP: Record<Language, string> = {
    English:   'Google.en-IN-Neural2-A',   // Neural2 female — most natural
    Hindi:     'Google.hi-IN-Neural2-A',   // Neural2 female — most natural
    Kannada:   'Google.kn-IN-Wavenet-A',   // Wavenet female
    Tamil:     'Google.ta-IN-Wavenet-A',   // Wavenet female
    Telugu:    'Google.te-IN-Standard-A',  // Standard female (no Wavenet available)
    Malayalam: 'Google.ml-IN-Wavenet-A',   // Wavenet female
    Bengali:   'Google.bn-IN-Wavenet-A',   // Wavenet female
    Marathi:   'Google.mr-IN-Wavenet-A',   // Wavenet female
    Gujarati:  'Google.gu-IN-Wavenet-A',   // Wavenet female
    Punjabi:   'Google.pa-IN-Wavenet-A',   // Wavenet female
    Odia:      'Google.hi-IN-Neural2-A',   // F8-02: Hindi fallback (no Odia voice on Twilio)
};

// ── Conversational call prompts per language ─────────────────────────────────
// Used by TwiML for the interactive parent call agent.

interface CallPrompts {
    greeting: string;          // Opening line when call connects
    inviteResponse: string;    // After teacher message — invite parent to speak
    waitingPrompt: string;     // Gentle nudge while waiting for speech
    didntHear: string;         // If speech timeout on first try
    noResponseGoodbye: string; // If parent doesn't speak at all
    thanks: string;            // Closing line
    /**
     * Round-2 audit P1 DPDP-1 (30-agent review, group G2):
     * DPDP Act 2023 (enforced Nov 2026) requires itemised notice
     * BEFORE personal data collection. The prologue is gated behind
     * `consentNoticeEnabled` in the feature flags doc — defaults OFF
     * until all 11 languages have legally-reviewed translations.
     *
     * Format (when added): one short sentence stating that the call
     * is recorded, AI-processed, and stored. Parent can press 2 to
     * end immediately if they don't consent.
     *
     * Currently filled in for `en-IN` only — translation gap is
     * tracked in `.claude/plans/dpdp-compliance.md`.
     */
    consentPrologue?: string;
}

export const CALL_MENU_PROMPTS: Record<string, CallPrompts> = {
    'en-IN': {
        greeting:          'Namaste. This is an important message from your child\'s school.',
        inviteResponse:    'If you have any questions, concerns, or anything you would like to share, please go ahead and speak. You can also press 2 to end the call anytime.',
        waitingPrompt:     'Please go ahead, I\'m listening.',
        didntHear:         'I\'m sorry, I could not hear you clearly. Could you please speak again?',
        noResponseGoodbye: 'It seems we could not connect. The teacher\'s message has been delivered. The school will try again if needed. Thank you. Goodbye.',
        thanks:            'Thank you for your time. We are partners in your child\'s success. Goodbye.',
        // DPDP Act 2023 notice — gated by `consentNoticeEnabled` feature
        // flag, default OFF until other-language translations land.
        consentPrologue:   'This call may be recorded and processed by an AI system to help your child\'s teacher. If you do not wish to continue, please press 2 to end the call now.',
    },
    'hi-IN': {
        greeting:          'नमस्ते। यह आपके बच्चे के स्कूल से एक ज़रूरी संदेश है।',
        inviteResponse:    'अगर आपके कोई सवाल हैं, कोई चिंता है, या कुछ बताना चाहते हैं, तो कृपया बोलिए। कॉल खत्म करने के लिए 2 दबाएँ।',
        waitingPrompt:     'कृपया बोलिए, मैं सुन रहा हूँ।',
        didntHear:         'माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलिए।',
        noResponseGoodbye: 'लगता है हम जुड़ नहीं पाए। शिक्षक का संदेश पहुँच गया है। ज़रूरत होने पर स्कूल फिर से कॉल करेगा। धन्यवाद। नमस्कार।',
        thanks:            'आपके समय के लिए धन्यवाद। हम आपके बच्चे की प्रगति में आपके साथी हैं। नमस्कार।',
        consentPrologue:   'यह कॉल रिकॉर्ड की जा सकती है और आपके बच्चे के शिक्षक की मदद के लिए एक एआई प्रणाली द्वारा संसाधित की जा सकती है। यदि आप जारी नहीं रखना चाहते, तो कृपया कॉल समाप्त करने के लिए अभी 2 दबाएँ।',
    },
    'kn-IN': {
        greeting:          'ನಮಸ್ಕಾರ. ಇದು ನಿಮ್ಮ ಮಗುವಿನ ಶಾಲೆಯಿಂದ ಒಂದು ಮುಖ್ಯ ಸಂದೇಶ.',
        inviteResponse:    'ನಿಮಗೆ ಏನಾದರೂ ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ ಅಥವಾ ಹಂಚಿಕೊಳ್ಳಬೇಕಾದರೆ ದಯವಿಟ್ಟು ಮಾತನಾಡಿ. ಕರೆ ಮುಗಿಸಲು 2 ಒತ್ತಿ.',
        waitingPrompt:     'ದಯವಿಟ್ಟು ಮಾತನಾಡಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.',
        didntHear:         'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
        noResponseGoodbye: 'ನಾವು ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಆಗಲಿಲ್ಲ. ಶಿಕ್ಷಕರ ಸಂದೇಶ ತಲುಪಿದೆ. ಅಗತ್ಯವಿದ್ದರೆ ಶಾಲೆ ಮತ್ತೆ ಕರೆ ಮಾಡುತ್ತದೆ. ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.',
        thanks:            'ನಿಮ್ಮ ಸಮಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಮಗುವಿನ ಯಶಸ್ಸಿನಲ್ಲಿ ನಾವು ನಿಮ್ಮ ಪಾಲುದಾರರು. ನಮಸ್ಕಾರ.',
        consentPrologue:   'ಈ ಕರೆಯನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಬಹುದು ಮತ್ತು ನಿಮ್ಮ ಮಗುವಿನ ಶಿಕ್ಷಕರಿಗೆ ಸಹಾಯ ಮಾಡಲು ಎಐ ವ್ಯವಸ್ಥೆಯಿಂದ ಸಂಸ್ಕರಿಸಬಹುದು. ನೀವು ಮುಂದುವರಿಯಲು ಬಯಸದಿದ್ದರೆ, ದಯವಿಟ್ಟು ಕರೆ ಮುಗಿಸಲು ಈಗ 2 ಒತ್ತಿ.',
    },
    'ta-IN': {
        greeting:          'வணக்கம். இது உங்கள் குழந்தையின் பள்ளியிலிருந்து ஒரு முக்கிய செய்தி.',
        inviteResponse:    'உங்களுக்கு ஏதாவது கேள்விகள் அல்லது கவலைகள் இருந்தால், தயவுசெய்து பேசுங்கள். அழைப்பை முடிக்க 2 அழுத்தவும்.',
        waitingPrompt:     'தயவுசெய்து பேசுங்கள், நான் கேட்டுக்கொண்டிருக்கிறேன்.',
        didntHear:         'மன்னிக்கவும், தெளிவாக கேட்கவில்லை. மீண்டும் பேசுங்கள்.',
        noResponseGoodbye: 'தொடர்பு ஏற்படவில்லை. ஆசிரியரின் செய்தி அனுப்பப்பட்டுள்ளது. தேவைப்பட்டால் பள்ளி மீண்டும் அழைக்கும். நன்றி. வணக்கம்.',
        thanks:            'உங்கள் நேரத்திற்கு நன்றி. உங்கள் குழந்தையின் வெற்றியில் நாங்கள் உங்கள் பங்குதாரர்கள். வணக்கம்.',
        consentPrologue:   'இந்த அழைப்பு பதிவு செய்யப்படலாம், மேலும் உங்கள் குழந்தையின் ஆசிரியருக்கு உதவ ஒரு AI அமைப்பால் செயலாக்கப்படலாம். நீங்கள் தொடர விரும்பவில்லை என்றால், அழைப்பை முடிக்க இப்போது 2 ஐ அழுத்தவும்.',
    },
    'te-IN': {
        greeting:          'నమస్కారం. ఇది మీ బిడ్డ పాఠశాల నుండి ఒక ముఖ్యమైన సందేశం.',
        inviteResponse:    'మీకు ఏమైనా ప్రశ్నలు ఉంటే లేదా చెప్పాలనుకుంటే దయచేసి మాట్లాడండి. కాల్ ముగించడానికి 2 నొక్కండి.',
        waitingPrompt:     'దయచేసి మాట్లాడండి, నేను వింటున్నాను.',
        didntHear:         'క్షమించండి, స్పష్టంగా వినలేదు. దయచేసి మళ్ళీ చెప్పండి.',
        noResponseGoodbye: 'సంప్రదింపు జరగలేదు. టీచర్ సందేశం అందింది. అవసరమైతే పాఠశాల మళ్ళీ కాల్ చేస్తుంది. ధన్యవాదాలు. నమస్కారం.',
        thanks:            'మీ సమయానికి ధన్యవాదాలు. మీ బిడ్డ విజయంలో మేము మీ భాగస్వాములం. నమస్కారం.',
        consentPrologue:   'ఈ కాల్ రికార్డ్ చేయబడవచ్చు మరియు మీ బిడ్డ ఉపాధ్యాయునికి సహాయం చేయడానికి ఒక AI వ్యవస్థ ద్వారా ప్రాసెస్ చేయబడవచ్చు. మీరు కొనసాగించడానికి ఇష్టపడకపోతే, దయచేసి కాల్ ముగించడానికి ఇప్పుడు 2 నొక్కండి.',
    },
    'ml-IN': {
        greeting:          'നമസ്കാരം. ഇത് നിങ്ങളുടെ കുട്ടിയുടെ സ്കൂളിൽ നിന്നുള്ള ഒരു പ്രധാന സന്ദേശമാണ്.',
        inviteResponse:    'നിങ്ങൾക്ക് എന്തെങ്കിലും ചോദ്യങ്ങളോ ആശങ്കകളോ ഉണ്ടെങ്കിൽ ദയവായി സംസാരിക്കുക. കോൾ അവസാനിപ്പിക്കാൻ 2 അമർത്തുക.',
        waitingPrompt:     'ദയവായി സംസാരിക്കുക, ഞാൻ കേൾക്കുന്നുണ്ട്.',
        didntHear:         'ക്ഷമിക്കണം, വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും പറയുക.',
        noResponseGoodbye: 'ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. ടീച്ചറിന്റെ സന്ദേശം എത്തിയിട്ടുണ്ട്. ആവശ്യമെങ്കിൽ സ്കൂൾ വീണ്ടും വിളിക്കും. നന്ദി. നമസ്കാരം.',
        thanks:            'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നിങ്ങളുടെ കുട്ടിയുടെ വിജയത്തിൽ ഞങ്ങൾ നിങ്ങളുടെ പങ്കാളികളാണ്. നമസ്കാരം.',
        consentPrologue:   'ഈ കോൾ റെക്കോർഡ് ചെയ്യപ്പെടാം, നിങ്ങളുടെ കുട്ടിയുടെ അധ്യാപകനെ സഹായിക്കാൻ ഒരു AI സംവിധാനം ഇത് പ്രോസസ് ചെയ്യാം. തുടരാൻ താൽപ്പര്യമില്ലെങ്കിൽ, ദയവായി കോൾ അവസാനിപ്പിക്കാൻ ഇപ്പോൾ 2 അമർത്തുക.',
    },
    'bn-IN': {
        greeting:          'নমস্কার। এটি আপনার সন্তানের স্কুল থেকে একটি গুরুত্বপূর্ণ বার্তা।',
        inviteResponse:    'আপনার কোনো প্রশ্ন বা উদ্বেগ থাকলে দয়া করে বলুন। কল শেষ করতে 2 চাপুন।',
        waitingPrompt:     'দয়া করে বলুন, আমি শুনছি।',
        didntHear:         'দুঃখিত, স্পষ্টভাবে শুনতে পাইনি। দয়া করে আবার বলুন।',
        noResponseGoodbye: 'যোগাযোগ হলো না। শিক্ষকের বার্তা পৌঁছে গেছে। প্রয়োজনে স্কুল আবার কল করবে। ধন্যবাদ। নমস্কার।',
        thanks:            'আপনার সময়ের জন্য ধন্যবাদ। আপনার সন্তানের সাফল্যে আমরা আপনার সঙ্গী। নমস্কার।',
        consentPrologue:   'এই কলটি রেকর্ড করা হতে পারে এবং আপনার সন্তানের শিক্ষককে সাহায্য করার জন্য একটি AI সিস্টেম দ্বারা প্রক্রিয়া করা হতে পারে। আপনি চালিয়ে যেতে না চাইলে, কল শেষ করতে এখন 2 চাপুন।',
    },
    'mr-IN': {
        greeting:          'नमस्कार. हा तुमच्या मुलाच्या शाळेकडून एक महत्त्वाचा संदेश आहे.',
        inviteResponse:    'तुम्हाला काही प्रश्न असतील किंवा काही सांगायचे असेल तर कृपया बोला. कॉल संपवण्यासाठी 2 दाबा.',
        waitingPrompt:     'कृपया बोला, मी ऐकतो आहे.',
        didntHear:         'माफ करा, नीट ऐकू आले नाही. कृपया पुन्हा बोला.',
        noResponseGoodbye: 'संपर्क होऊ शकला नाही. शिक्षकांचा संदेश पोहोचला आहे. गरज असल्यास शाळा पुन्हा कॉल करेल. धन्यवाद. नमस्कार.',
        thanks:            'तुमच्या वेळेबद्दल धन्यवाद. तुमच्या मुलाच्या यशात आम्ही तुमचे भागीदार आहोत. नमस्कार.',
        consentPrologue:   'हा कॉल रेकॉर्ड केला जाऊ शकतो आणि तुमच्या मुलाच्या शिक्षकांना मदत करण्यासाठी एआय प्रणालीद्वारे प्रक्रिया केली जाऊ शकते. तुम्हाला पुढे चालू ठेवायचे नसेल, तर कृपया कॉल संपवण्यासाठी आता 2 दाबा.',
    },
    'gu-IN': {
        greeting:          'નમસ્તે. આ તમારા બાળકની શાળામાંથી એક મહત્વપૂર્ણ સંદેશ છે.',
        inviteResponse:    'તમને કોઈ પ્રશ્ન હોય કે કંઈ કહેવું હોય તો કૃપા કરીને બોલો. કૉલ સમાપ્ત કરવા 2 દબાવો.',
        waitingPrompt:     'કૃપા કરીને બોલો, હું સાંભળું છું.',
        didntHear:         'માફ કરશો, સ્પષ્ટ સંભળાયું નહીં. કૃપા કરીને ફરી બોલો.',
        noResponseGoodbye: 'સંપર્ક થઈ શક્યો નહીં. શિક્ષકનો સંદેશ પહોંચ્યો છે. જરૂર હશે તો શાળા ફરી કૉલ કરશે. આભાર. નમસ્તે.',
        thanks:            'તમારા સમય બદલ આભાર. તમારા બાળકની સફળતામાં અમે તમારા ભાગીદાર છીએ. નમસ્તે.',
        consentPrologue:   'આ કૉલ રેકોર્ડ થઈ શકે છે અને તમારા બાળકના શિક્ષકને મદદ કરવા માટે એક AI સિસ્ટમ દ્વારા પ્રક્રિયા થઈ શકે છે. જો તમે ચાલુ રાખવા ન માંગતા હો, તો કૃપા કરીને કૉલ સમાપ્ત કરવા હમણાં 2 દબાવો.',
    },
    'pa-IN': {
        greeting:          'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਤੁਹਾਡੇ ਬੱਚੇ ਦੇ ਸਕੂਲ ਤੋਂ ਇੱਕ ਜ਼ਰੂਰੀ ਸੁਨੇਹਾ ਹੈ।',
        inviteResponse:    'ਜੇ ਤੁਹਾਡੇ ਕੋਈ ਸਵਾਲ ਜਾਂ ਚਿੰਤਾ ਹੈ ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ। ਕਾਲ ਖ਼ਤਮ ਕਰਨ ਲਈ 2 ਦਬਾਓ।',
        waitingPrompt:     'ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ, ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।',
        didntHear:         'ਮਾਫ਼ ਕਰਨਾ, ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲੋ।',
        noResponseGoodbye: 'ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਅਧਿਆਪਕ ਦਾ ਸੁਨੇਹਾ ਪਹੁੰਚ ਗਿਆ ਹੈ। ਲੋੜ ਪੈਣ ਤੇ ਸਕੂਲ ਫ਼ਿਰ ਕਾਲ ਕਰੇਗਾ। ਧੰਨਵਾਦ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।',
        thanks:            'ਤੁਹਾਡੇ ਸਮੇਂ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਸਫ਼ਲਤਾ ਵਿੱਚ ਅਸੀਂ ਤੁਹਾਡੇ ਭਾਈਵਾਲ ਹਾਂ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।',
        consentPrologue:   'ਇਹ ਕਾਲ ਰਿਕਾਰਡ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ ਅਤੇ ਤੁਹਾਡੇ ਬੱਚੇ ਦੇ ਅਧਿਆਪਕ ਦੀ ਮਦਦ ਲਈ ਇੱਕ AI ਸਿਸਟਮ ਦੁਆਰਾ ਸੰਸਾਧਿਤ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ। ਜੇ ਤੁਸੀਂ ਜਾਰੀ ਨਹੀਂ ਰੱਖਣਾ ਚਾਹੁੰਦੇ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਕਾਲ ਖ਼ਤਮ ਕਰਨ ਲਈ ਹੁਣ 2 ਦਬਾਓ।',
    },
};

/**
 * Version stamp recorded on the outreach doc when the consent/AI-disclosure
 * prologue is played. Bump whenever the `consentPrologue` wording changes so
 * the audit trail can prove which notice text a parent actually heard.
 */
export const CONSENT_NOTICE_VERSION = '2026-06-10';

/**
 * Retention window for stored call transcripts + summaries (parent_outreach).
 * DPDP Act 2023 storage-limitation: a parent's voice-derived transcript is
 * personal data on a minor's household and must not be kept indefinitely.
 * Enforced by the `parent-outreach-cleanup` lifecycle job via `transcriptExpiresAt`.
 */
export const PARENT_OUTREACH_RETENTION_DAYS = 90;
