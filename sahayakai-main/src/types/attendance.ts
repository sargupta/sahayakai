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
    Odia:      null, // No Google TTS voice available for Odia
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
    Odia:      'Google.en-IN-Neural2-A',   // Fallback (Odia not in TWILIO_LANGUAGE_MAP)
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
}

export const CALL_MENU_PROMPTS: Record<string, CallPrompts> = {
    'en-IN': {
        greeting:          'Namaste. This is an important message from your child\'s school.',
        inviteResponse:    'If you have any questions, concerns, or anything you would like to share, please go ahead and speak. You can also press 2 to end the call anytime.',
        waitingPrompt:     'Please go ahead, I\'m listening.',
        didntHear:         'I\'m sorry, I could not hear you clearly. Could you please speak again?',
        noResponseGoodbye: 'It seems we could not connect. The teacher\'s message has been delivered. The school will try again if needed. Thank you. Goodbye.',
        thanks:            'Thank you for your time. We are partners in your child\'s success. Goodbye.',
    },
    'hi-IN': {
        greeting:          'नमस्ते। यह आपके बच्चे के स्कूल से एक ज़रूरी संदेश है।',
        inviteResponse:    'अगर आपके कोई सवाल हैं, कोई चिंता है, या कुछ बताना चाहते हैं, तो कृपया बोलिए। कॉल खत्म करने के लिए 2 दबाएँ।',
        waitingPrompt:     'कृपया बोलिए, मैं सुन रहा हूँ।',
        didntHear:         'माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलिए।',
        noResponseGoodbye: 'लगता है हम जुड़ नहीं पाए। शिक्षक का संदेश पहुँच गया है। ज़रूरत होने पर स्कूल फिर से कॉल करेगा। धन्यवाद। नमस्कार।',
        thanks:            'आपके समय के लिए धन्यवाद। हम आपके बच्चे की प्रगति में आपके साथी हैं। नमस्कार।',
    },
    'kn-IN': {
        greeting:          'ನಮಸ್ಕಾರ. ಇದು ನಿಮ್ಮ ಮಗುವಿನ ಶಾಲೆಯಿಂದ ಒಂದು ಮುಖ್ಯ ಸಂದೇಶ.',
        inviteResponse:    'ನಿಮಗೆ ಏನಾದರೂ ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ ಅಥವಾ ಹಂಚಿಕೊಳ್ಳಬೇಕಾದರೆ ದಯವಿಟ್ಟು ಮಾತನಾಡಿ. ಕರೆ ಮುಗಿಸಲು 2 ಒತ್ತಿ.',
        waitingPrompt:     'ದಯವಿಟ್ಟು ಮಾತನಾಡಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.',
        didntHear:         'ಕ್ಷಮಿಸಿ, ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
        noResponseGoodbye: 'ನಾವು ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಆಗಲಿಲ್ಲ. ಶಿಕ್ಷಕರ ಸಂದೇಶ ತಲುಪಿದೆ. ಅಗತ್ಯವಿದ್ದರೆ ಶಾಲೆ ಮತ್ತೆ ಕರೆ ಮಾಡುತ್ತದೆ. ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.',
        thanks:            'ನಿಮ್ಮ ಸಮಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಮಗುವಿನ ಯಶಸ್ಸಿನಲ್ಲಿ ನಾವು ನಿಮ್ಮ ಪಾಲುದಾರರು. ನಮಸ್ಕಾರ.',
    },
    'ta-IN': {
        greeting:          'வணக்கம். இது உங்கள் குழந்தையின் பள்ளியிலிருந்து ஒரு முக்கிய செய்தி.',
        inviteResponse:    'உங்களுக்கு ஏதாவது கேள்விகள் அல்லது கவலைகள் இருந்தால், தயவுசெய்து பேசுங்கள். அழைப்பை முடிக்க 2 அழுத்தவும்.',
        waitingPrompt:     'தயவுசெய்து பேசுங்கள், நான் கேட்டுக்கொண்டிருக்கிறேன்.',
        didntHear:         'மன்னிக்கவும், தெளிவாக கேட்கவில்லை. மீண்டும் பேசுங்கள்.',
        noResponseGoodbye: 'தொடர்பு ஏற்படவில்லை. ஆசிரியரின் செய்தி அனுப்பப்பட்டுள்ளது. தேவைப்பட்டால் பள்ளி மீண்டும் அழைக்கும். நன்றி. வணக்கம்.',
        thanks:            'உங்கள் நேரத்திற்கு நன்றி. உங்கள் குழந்தையின் வெற்றியில் நாங்கள் உங்கள் பங்குதாரர்கள். வணக்கம்.',
    },
    'te-IN': {
        greeting:          'నమస్కారం. ఇది మీ బిడ్డ పాఠశాల నుండి ఒక ముఖ్యమైన సందేశం.',
        inviteResponse:    'మీకు ఏమైనా ప్రశ్నలు ఉంటే లేదా చెప్పాలనుకుంటే దయచేసి మాట్లాడండి. కాల్ ముగించడానికి 2 నొక్కండి.',
        waitingPrompt:     'దయచేసి మాట్లాడండి, నేను వింటున్నాను.',
        didntHear:         'క్షమించండి, స్పష్టంగా వినలేదు. దయచేసి మళ్ళీ చెప్పండి.',
        noResponseGoodbye: 'సంప్రదింపు జరగలేదు. టీచర్ సందేశం అందింది. అవసరమైతే పాఠశాల మళ్ళీ కాల్ చేస్తుంది. ధన్యవాదాలు. నమస్కారం.',
        thanks:            'మీ సమయానికి ధన్యవాదాలు. మీ బిడ్డ విజయంలో మేము మీ భాగస్వాములం. నమస్కారం.',
    },
    'ml-IN': {
        greeting:          'നമസ്കാരം. ഇത് നിങ്ങളുടെ കുട്ടിയുടെ സ്കൂളിൽ നിന്നുള്ള ഒരു പ്രധാന സന്ദേശമാണ്.',
        inviteResponse:    'നിങ്ങൾക്ക് എന്തെങ്കിലും ചോദ്യങ്ങളോ ആശങ്കകളോ ഉണ്ടെങ്കിൽ ദയവായി സംസാരിക്കുക. കോൾ അവസാനിപ്പിക്കാൻ 2 അമർത്തുക.',
        waitingPrompt:     'ദയവായി സംസാരിക്കുക, ഞാൻ കേൾക്കുന്നുണ്ട്.',
        didntHear:         'ക്ഷമിക്കണം, വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും പറയുക.',
        noResponseGoodbye: 'ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. ടീച്ചറിന്റെ സന്ദേശം എത്തിയിട്ടുണ്ട്. ആവശ്യമെങ്കിൽ സ്കൂൾ വീണ്ടും വിളിക്കും. നന്ദി. നമസ്കാരം.',
        thanks:            'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നിങ്ങളുടെ കുട്ടിയുടെ വിജയത്തിൽ ഞങ്ങൾ നിങ്ങളുടെ പങ്കാളികളാണ്. നമസ്കാരം.',
    },
    'bn-IN': {
        greeting:          'নমস্কার। এটি আপনার সন্তানের স্কুল থেকে একটি গুরুত্বপূর্ণ বার্তা।',
        inviteResponse:    'আপনার কোনো প্রশ্ন বা উদ্বেগ থাকলে দয়া করে বলুন। কল শেষ করতে 2 চাপুন।',
        waitingPrompt:     'দয়া করে বলুন, আমি শুনছি।',
        didntHear:         'দুঃখিত, স্পষ্টভাবে শুনতে পাইনি। দয়া করে আবার বলুন।',
        noResponseGoodbye: 'যোগাযোগ হলো না। শিক্ষকের বার্তা পৌঁছে গেছে। প্রয়োজনে স্কুল আবার কল করবে। ধন্যবাদ। নমস্কার।',
        thanks:            'আপনার সময়ের জন্য ধন্যবাদ। আপনার সন্তানের সাফল্যে আমরা আপনার সঙ্গী। নমস্কার।',
    },
    'mr-IN': {
        greeting:          'नमस्कार. हा तुमच्या मुलाच्या शाळेकडून एक महत्त्वाचा संदेश आहे.',
        inviteResponse:    'तुम्हाला काही प्रश्न असतील किंवा काही सांगायचे असेल तर कृपया बोला. कॉल संपवण्यासाठी 2 दाबा.',
        waitingPrompt:     'कृपया बोला, मी ऐकतो आहे.',
        didntHear:         'माफ करा, नीट ऐकू आले नाही. कृपया पुन्हा बोला.',
        noResponseGoodbye: 'संपर्क होऊ शकला नाही. शिक्षकांचा संदेश पोहोचला आहे. गरज असल्यास शाळा पुन्हा कॉल करेल. धन्यवाद. नमस्कार.',
        thanks:            'तुमच्या वेळेबद्दल धन्यवाद. तुमच्या मुलाच्या यशात आम्ही तुमचे भागीदार आहोत. नमस्कार.',
    },
    'gu-IN': {
        greeting:          'નમસ્તે. આ તમારા બાળકની શાળામાંથી એક મહત્વપૂર્ણ સંદેશ છે.',
        inviteResponse:    'તમને કોઈ પ્રશ્ન હોય કે કંઈ કહેવું હોય તો કૃપા કરીને બોલો. કૉલ સમાપ્ત કરવા 2 દબાવો.',
        waitingPrompt:     'કૃપા કરીને બોલો, હું સાંભળું છું.',
        didntHear:         'માફ કરશો, સ્પષ્ટ સંભળાયું નહીં. કૃપા કરીને ફરી બોલો.',
        noResponseGoodbye: 'સંપર્ક થઈ શક્યો નહીં. શિક્ષકનો સંદેશ પહોંચ્યો છે. જરૂર હશે તો શાળા ફરી કૉલ કરશે. આભાર. નમસ્તે.',
        thanks:            'તમારા સમય બદલ આભાર. તમારા બાળકની સફળતામાં અમે તમારા ભાગીદાર છીએ. નમસ્તે.',
    },
    'pa-IN': {
        greeting:          'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਤੁਹਾਡੇ ਬੱਚੇ ਦੇ ਸਕੂਲ ਤੋਂ ਇੱਕ ਜ਼ਰੂਰੀ ਸੁਨੇਹਾ ਹੈ।',
        inviteResponse:    'ਜੇ ਤੁਹਾਡੇ ਕੋਈ ਸਵਾਲ ਜਾਂ ਚਿੰਤਾ ਹੈ ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ। ਕਾਲ ਖ਼ਤਮ ਕਰਨ ਲਈ 2 ਦਬਾਓ।',
        waitingPrompt:     'ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ, ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।',
        didntHear:         'ਮਾਫ਼ ਕਰਨਾ, ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲੋ।',
        noResponseGoodbye: 'ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਅਧਿਆਪਕ ਦਾ ਸੁਨੇਹਾ ਪਹੁੰਚ ਗਿਆ ਹੈ। ਲੋੜ ਪੈਣ ਤੇ ਸਕੂਲ ਫ਼ਿਰ ਕਾਲ ਕਰੇਗਾ। ਧੰਨਵਾਦ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।',
        thanks:            'ਤੁਹਾਡੇ ਸਮੇਂ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਸਫ਼ਲਤਾ ਵਿੱਚ ਅਸੀਂ ਤੁਹਾਡੇ ਭਾਈਵਾਲ ਹਾਂ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।',
    },
};
