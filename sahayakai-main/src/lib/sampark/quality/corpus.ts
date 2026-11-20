/**
 * The fixed test set for the call-quality bench (scripts/sampark/call-quality-bench.ts).
 *
 * Two kinds of item per language:
 *   - agent lines: what a parent HEARS (opener, the PTM fact line, a goodbye). Every voice
 *     engine speaks them; recognisers transcribe them back, and native listeners score them.
 *   - parent replies: what a parent SAYS (yes, a different time, call later, stop, and one
 *     code-mixed line). Rendered once in a neutral voice, sent over a phone-quality channel,
 *     and transcribed by every recogniser.
 *
 * `mustHear` are the words a call depends on (a day, a time, yes/no, stop): a recogniser that
 * drops one has failed the turn whatever its overall error rate. A time is one item ("ten thirty",
 * "साढ़े दस"): the matcher folds half-hours into a single token, as the probe does. The texts are synthetic —
 * no child, family or number — and use the spoken register of the call scripts
 * (CONVERSATION_PLAN.md §6). Drafted, not yet reviewed by native speakers: review before
 * treating a non-English score as final. Bump BENCH_CORPUS_VERSION on any change, so results
 * from different corpora are never compared.
 */

import type { ParentLanguage } from '@/types/sampark';

export const BENCH_CORPUS_VERSION = 1;

export type ReplyIntent = 'yes' | 'reschedule' | 'callback' | 'stop' | 'question';

export interface AgentLine {
    id: string;
    text: string;
    mustHear: string[];
}

export interface ParentReply {
    id: string;
    text: string;
    mustHear: string[];
    intent: ReplyIntent;
    /** Mixes English words into the language. Recognisers may write those words in either script, so its error rate is shown apart. */
    codeMixed?: boolean;
}

export interface LanguageCorpus {
    agentLines: AgentLine[];
    parentReplies: ParentReply[];
}

export const BENCH_CORPUS: Readonly<Record<ParentLanguage, LanguageCorpus>> = {
    English: {
        agentLines: [
            { id: 'opener', text: 'Hello, this is Riya, an AI assistant calling on behalf of Hillview School. Is this a good time to talk?', mustHear: ['Riya', 'Hillview'] },
            { id: 'ptm', text: 'The parent teacher meeting for Class Seven B is on Saturday, the seventeenth of October, at ten thirty in the morning.', mustHear: ['Saturday', 'seventeenth', 'October', 'ten thirty'] },
            { id: 'goodbye', text: 'Thank you. We will see you on Saturday. Have a good day.', mustHear: ['Saturday'] },
        ],
        parentReplies: [
            { id: 'yes', text: 'Yes, I will come on Saturday.', mustHear: ['yes', 'Saturday'], intent: 'yes' },
            { id: 'reschedule', text: "Sorry, I can't come at ten thirty. Can we do it at twelve?", mustHear: ['twelve'], intent: 'reschedule' },
            { id: 'callback', text: 'Please call me after six in the evening.', mustHear: ['six', 'evening'], intent: 'callback' },
            { id: 'stop', text: 'Please stop calling this number.', mustHear: ['stop'], intent: 'stop' },
            { id: 'question', text: 'Which room is the meeting in?', mustHear: ['room'], intent: 'question' },
        ],
    },
    Hindi: {
        agentLines: [
            { id: 'opener', text: 'नमस्ते, मैं रिया हूँ, हिलव्यू स्कूल की ओर से एआई असिस्टेंट। क्या अभी बात करने का सही समय है?', mustHear: ['रिया', 'हिलव्यू'] },
            { id: 'ptm', text: 'क्लास सेवन बी की पेरेंट टीचर मीटिंग शनिवार, सत्रह अक्टूबर को सुबह साढ़े दस बजे है।', mustHear: ['शनिवार', 'सत्रह', 'अक्टूबर', 'साढ़े दस'] },
            { id: 'goodbye', text: 'धन्यवाद। शनिवार को मिलते हैं।', mustHear: ['शनिवार'] },
        ],
        parentReplies: [
            { id: 'yes', text: 'हाँ जी, मैं शनिवार को आऊँगा।', mustHear: ['हाँ', 'शनिवार'], intent: 'yes' },
            { id: 'reschedule', text: 'साढ़े दस बजे नहीं आ पाऊँगा, बारह बजे हो सकता है?', mustHear: ['बारह'], intent: 'reschedule' },
            { id: 'callback', text: 'शाम छह बजे के बाद फ़ोन कीजिए।', mustHear: ['शाम', 'छह'], intent: 'callback' },
            { id: 'stop', text: 'कृपया इस नंबर पर फ़ोन मत कीजिए।', mustHear: ['मत'], intent: 'stop' },
            { id: 'mixed', text: 'हाँ, मैं आऊँगा, मीटिंग सैटरडे को है ना?', mustHear: ['हाँ'], intent: 'yes', codeMixed: true },
        ],
    },
    Bengali: {
        agentLines: [
            { id: 'opener', text: 'নমস্কার, আমি রিয়া, হিলভিউ স্কুলের পক্ষ থেকে এআই অ্যাসিস্ট্যান্ট। এখন কি কথা বলা যাবে?', mustHear: ['হিলভিউ'] },
            { id: 'ptm', text: 'ক্লাস সেভেন বি সেকশনের প্যারেন্ট টিচার মিটিং শনিবার, সতেরোই অক্টোবর, সকাল সাড়ে দশটায়।', mustHear: ['শনিবার', 'অক্টোবর', 'সকাল', 'সাড়ে দশটায়'] },
            { id: 'goodbye', text: 'ধন্যবাদ। শনিবার দেখা হবে।', mustHear: ['শনিবার'] },
        ],
        parentReplies: [
            { id: 'yes', text: 'হ্যাঁ, আমি শনিবার আসব।', mustHear: ['হ্যাঁ', 'শনিবার'], intent: 'yes' },
            { id: 'reschedule', text: 'সাড়ে দশটায় পারব না, বারোটায় হবে?', mustHear: ['বারোটায়'], intent: 'reschedule' },
            { id: 'callback', text: 'সন্ধ্যা ছটার পরে ফোন করবেন।', mustHear: ['সন্ধ্যা'], intent: 'callback' },
            { id: 'stop', text: 'এই নম্বরে আর ফোন করবেন না।', mustHear: ['না'], intent: 'stop' },
            { id: 'mixed', text: 'হ্যাঁ, আমি আসব, মিটিংটা স্যাটারডে তো?', mustHear: ['হ্যাঁ'], intent: 'yes', codeMixed: true },
        ],
    },
    Nepali: {
        agentLines: [
            { id: 'opener', text: 'नमस्ते, म रिया, हिलभ्यू स्कुलको तर्फबाट एआई सहायक। अहिले कुरा गर्न मिल्छ?', mustHear: ['हिलभ्यू'] },
            { id: 'ptm', text: 'क्लास सेभेन बीको प्यारेन्ट टिचर मिटिङ शनिबार, अक्टोबर सत्र गते, बिहान साढे दस बजे हुन्छ।', mustHear: ['शनिबार', 'अक्टोबर', 'साढे दस'] },
            { id: 'goodbye', text: 'धन्यवाद। शनिबार भेटौँला।', mustHear: ['शनिबार'] },
        ],
        parentReplies: [
            { id: 'yes', text: 'हजुर, म शनिबार आउँछु।', mustHear: ['हजुर', 'शनिबार'], intent: 'yes' },
            { id: 'reschedule', text: 'साढे दस बजे सक्दिन, बाह्र बजे मिल्छ?', mustHear: ['बाह्र'], intent: 'reschedule' },
            { id: 'callback', text: 'बेलुका छ बजेपछि फोन गर्नुहोस्।', mustHear: ['बेलुका'], intent: 'callback' },
            { id: 'stop', text: 'यो नम्बरमा फेरि फोन नगर्नुहोस्।', mustHear: ['नगर्नुहोस्'], intent: 'stop' },
            { id: 'mixed', text: 'हजुर, म आउँछु, मिटिङ सटरडे हो नि?', mustHear: ['हजुर'], intent: 'yes', codeMixed: true },
        ],
    },
};
