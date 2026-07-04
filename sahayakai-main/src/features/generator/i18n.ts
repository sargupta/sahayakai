/**
 * Generator shell copy — 11 languages, keyed by ISO code (same convention
 * as the per-tool dicts in worksheet-wizard / instant-answer).
 *
 * Kept as a module-local dict (not language-context.tsx) because the
 * central dictionary is a shared file owned by another workstream; these
 * two strings are generator-shell-only chrome.
 */

export interface GeneratorShellCopy {
    /** EmptyState title shown in the idle result region. */
    emptyTitle: string;
    /** EmptyState description shown in the idle result region. */
    emptyDescription: string;
}

export const GENERATOR_SHELL_COPY: Record<string, GeneratorShellCopy> = {
    en: {
        emptyTitle: "Your result will appear here",
        emptyDescription: "Fill in the details above and tap Generate.",
    },
    hi: {
        emptyTitle: "आपका परिणाम यहाँ दिखेगा",
        emptyDescription: "ऊपर विवरण भरें और जनरेट पर टैप करें।",
    },
    bn: {
        emptyTitle: "আপনার ফলাফল এখানে দেখা যাবে",
        emptyDescription: "উপরে বিবরণ পূরণ করুন এবং জেনারেট-এ ট্যাপ করুন।",
    },
    te: {
        emptyTitle: "మీ ఫలితం ఇక్కడ కనిపిస్తుంది",
        emptyDescription: "పైన వివరాలు నింపి జనరేట్ నొక్కండి.",
    },
    mr: {
        emptyTitle: "तुमचा निकाल येथे दिसेल",
        emptyDescription: "वर तपशील भरा आणि जनरेट वर टॅप करा.",
    },
    ta: {
        emptyTitle: "உங்கள் முடிவு இங்கே தோன்றும்",
        emptyDescription: "மேலே விவரங்களை நிரப்பி ஜெனரேட்டைத் தட்டவும்.",
    },
    gu: {
        emptyTitle: "તમારું પરિણામ અહીં દેખાશે",
        emptyDescription: "ઉપર વિગતો ભરો અને જનરેટ પર ટૅપ કરો.",
    },
    kn: {
        emptyTitle: "ನಿಮ್ಮ ಫಲಿತಾಂಶ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ",
        emptyDescription: "ಮೇಲೆ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ ಜನರೇಟ್ ಒತ್ತಿರಿ.",
    },
    pa: {
        emptyTitle: "ਤੁਹਾਡਾ ਨਤੀਜਾ ਇੱਥੇ ਦਿਖੇਗਾ",
        emptyDescription: "ਉੱਪਰ ਵੇਰਵੇ ਭਰੋ ਅਤੇ ਜਨਰੇਟ 'ਤੇ ਟੈਪ ਕਰੋ।",
    },
    ml: {
        emptyTitle: "നിങ്ങളുടെ ഫലം ഇവിടെ കാണാം",
        emptyDescription: "മുകളിൽ വിവരങ്ങൾ പൂരിപ്പിച്ച് ജനറേറ്റ് ടാപ്പ് ചെയ്യുക.",
    },
    or: {
        emptyTitle: "ଆପଣଙ୍କ ଫଳାଫଳ ଏଠାରେ ଦେଖାଯିବ",
        emptyDescription: "ଉପରେ ବିବରଣୀ ଭରନ୍ତୁ ଏବଂ ଜେନେରେଟ୍ ଦବାନ୍ତୁ।",
    },
};
