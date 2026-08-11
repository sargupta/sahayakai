/**
 * @fileOverview Letter → speech sanitizer for the parent-call voice pipeline.
 *
 * The Contact-Parent flow historically generated ONE text: a written,
 * letter-register message ("Dear Gauri's Parent/Guardian, … Sincerely,
 * Abhishek Gupta") that was piped verbatim into Twilio `<Say>` — so TTS
 * literally spoke the salutation and the sign-off on the phone.
 *
 * New outreach docs carry a purpose-built `spokenScript` (see
 * parent-message-generator.ts). This module is the fallback for legacy
 * docs that only have the letter: it strips written-channel artifacts
 * so the voice never reads "Dear …" / "Sincerely, <name>" aloud.
 *
 * Deliberately conservative: only removes lines that match known
 * salutation / sign-off shapes. Anything unrecognized passes through
 * unchanged — a slightly formal call beats a truncated one.
 */

// Salutation shapes at the very start of the message, one line.
// English + the common openers the generator produces across the 11
// supported languages (each is the standard "Dear/Respected …" opener).
const SALUTATION_PATTERNS: RegExp[] = [
    /^dear\s[^\n]{0,80}[,:]?\s*$/i,           // Dear Gauri's Parent/Guardian,
    /^respected\s[^\n]{0,80}[,:]?\s*$/i,       // Respected Parent,
    /^(?:प्रिय|आदरणीय|माननीय)\s[^\n]{0,80}[,:।]?\s*$/,   // Hindi/Marathi
    /^(?:প্রিয়|শ্রদ্ধেয়)\s[^\n]{0,80}[,:।]?\s*$/,        // Bengali
    /^(?:அன்புள்ள|மதிப்பிற்குரிய)\s[^\n]{0,80}[,:]?\s*$/,  // Tamil
    /^(?:ప్రియమైన|గౌరవనీయులైన)\s[^\n]{0,80}[,:]?\s*$/,    // Telugu
    /^(?:ಪ್ರೀತಿಯ|ಗೌರವಾನ್ವಿತ)\s[^\n]{0,80}[,:]?\s*$/,      // Kannada
    /^(?:પ્રિય|આદરણીય)\s[^\n]{0,80}[,:]?\s*$/,            // Gujarati
    /^(?:ਪਿਆਰੇ|ਸਤਿਕਾਰਯੋਗ)\s[^\n]{0,80}[,:]?\s*$/,        // Punjabi
    /^(?:പ്രിയ|ബഹുമാനപ്പെട്ട)\s[^\n]{0,80}[,:]?\s*$/,      // Malayalam
    /^(?:ପ୍ରିୟ|ସମ୍ମାନିତ)\s[^\n]{0,80}[,:।]?\s*$/,          // Odia
];

// Sign-off tokens that begin a closing block. Everything from a matched
// line to the end of the text is dropped (the block is the sign-off word
// plus the name/title lines under it).
const SIGNOFF_PATTERNS: RegExp[] = [
    /^(?:sincerely|regards|warm regards|best regards|kind regards|yours(?:\s(?:sincerely|faithfully|truly))?|thank(?:ing)? you[,.]?)\s*[,.]?\s*$/i,
    /^(?:सादर|भवदीय|धन्यवाद सहित|आपका विश्वासी|सधन्यवाद)\s*[,.।]?\s*$/,      // Hindi/Marathi
    /^(?:বিনীত|ভবদীয়|আন্তরিকভাবে|ধন্যবাদান্তে)\s*[,.।]?\s*$/,               // Bengali
    /^(?:இப்படிக்கு|நன்றியுடன்)\s*[,.]?\s*$/,                                // Tamil
    /^(?:భవదీయులు|ధన్యవాదాలతో)\s*[,.]?\s*$/,                                 // Telugu
    /^(?:ವಂದನೆಗಳೊಂದಿಗೆ|ಇಂತಿ ನಿಮ್ಮ)\s*[,.]?\s*$/,                            // Kannada
    /^(?:આપનો વિશ્વાસુ|આભાર સહ)\s*[,.]?\s*$/,                                // Gujarati
    /^(?:ਸ਼ੁਭਚਿੰਤਕ|ਧੰਨਵਾਦ ਸਹਿਤ)\s*[,.]?\s*$/,                               // Punjabi
    /^(?:വിശ്വസ്തതയോടെ|നന്ദിയോടെ)\s*[,.]?\s*$/,                              // Malayalam
    /^(?:ଆପଣଙ୍କ ବିଶ୍ୱସ୍ତ|ଧନ୍ୟବାଦ ସହ)\s*[,.।]?\s*$/,                          // Odia
];

// A sign-off may also be inline: "Sincerely, Abhishek Gupta" on one line.
const INLINE_SIGNOFF =
    /^(?:sincerely|regards|warm regards|best regards|kind regards|yours(?:\s(?:sincerely|faithfully|truly))?)\s*,\s*[^\n]{1,60}$/i;

/**
 * Strip written-letter artifacts (salutation line, sign-off block) from a
 * parent message so it can be spoken over a phone call.
 *
 * Returns the input unchanged when no artifact is recognized.
 */
export function sanitizeLetterForSpeech(text: string): string {
    if (!text) return text;

    const lines = text.split('\n');
    let start = 0;
    let end = lines.length;

    // Skip leading blank lines, then test the first content line for a salutation.
    while (start < end && lines[start].trim() === '') start++;
    if (start < end) {
        const first = lines[start].trim();
        if (SALUTATION_PATTERNS.some((re) => re.test(first))) start++;
    }

    // Scan the last 4 content lines for a sign-off token; cut from there.
    const contentIdx: number[] = [];
    for (let i = end - 1; i >= start && contentIdx.length < 4; i--) {
        if (lines[i].trim() !== '') contentIdx.push(i);
    }
    for (const i of contentIdx) {
        const line = lines[i].trim();
        if (SIGNOFF_PATTERNS.some((re) => re.test(line)) || INLINE_SIGNOFF.test(line)) {
            end = i;
            break;
        }
    }

    const result = lines.slice(start, end).join('\n').trim();
    // Never return an empty script — if stripping ate everything, keep the original.
    return result === '' ? text.trim() : result;
}

/**
 * Pick the text the voice pipeline should speak for an outreach doc:
 * the purpose-built spoken script when present, else the sanitized letter.
 */
export function resolveSpokenMessage(doc: { spokenScript?: unknown; generatedMessage?: unknown }): string {
    const spoken = typeof doc.spokenScript === 'string' ? doc.spokenScript.trim() : '';
    if (spoken) return spoken;
    const letter = typeof doc.generatedMessage === 'string' ? doc.generatedMessage : '';
    return sanitizeLetterForSpeech(letter);
}
