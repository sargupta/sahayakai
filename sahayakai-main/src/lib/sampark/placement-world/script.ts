/**
 * Placement World screening call script (SP-11).
 *
 * Invariants:
 *   - Opener states ONLY that the call is from Placement World and is recorded.
 *   - Fee disclosure line appears ONLY in `closing`, never in `opener`.
 *   - Edge cases covered: `wrong_person`, `call_back_later`, `no_answer`, `refuses`.
 */

import type { PlacementEdgeCase, PlacementLanguage } from './types';

export interface PlacementScript {
    language: PlacementLanguage;
    opener: string;
    questions: readonly [string, string, string, string];
    edgeCases: Record<Exclude<PlacementEdgeCase, 'no_answer'>, string>;
    closing: string;
}

const DEFAULT_FEE_TERMS: Record<PlacementLanguage, string> = {
    en: 'a standard placement service fee',
    hi: 'नियमानुसार प्लेसमेंट सेवा शुल्क',
    bn: 'নির্ধারিত প্লেসমেন্ট সার্ভিস ফি',
};

const SCRIPTS: Record<PlacementLanguage, PlacementScript> = {
    en: {
        language: 'en',
        opener:
            'Hello, this is Riya calling from Placement World. Please note that this call is being recorded. Am I speaking with {{candidate_name}}?',
        questions: [
            'Are you currently looking for a job change or available for interviews this week?',
            'Which city or work location do you prefer, and are you comfortable with standard shift timings?',
            'Could you briefly share your total work experience and your current or last role?',
            'What is your expected monthly salary, and how soon could you join if selected?',
        ],
        edgeCases: {
            wrong_person: 'Sorry for the disturbance. I had the wrong contact. Have a good day.',
            call_back_later: 'No problem at all. When would be a better time for Placement World to call you back?',
            refuses: "Understood, I will mark that you are not interested right now and won't trouble you further. Thank you.",
        },
        closing:
            'Thank you for sharing those details, {{candidate_name}}. Please note that Placement World charges {{fee_terms}} as per candidate policy once placement is confirmed. Our team will reach out with matching openings shortly.',
    },
    hi: {
        language: 'hi',
        opener:
            'नमस्ते, मैं प्लेसमेंट वर्ल्ड से रिया बोल रही हूँ। कृपया ध्यान दें कि यह कॉल रिकॉर्ड की जा रही है। क्या मेरी बात {{candidate_name}} से हो रही है?',
        questions: [
            'क्या आप अभी नई नौकरी की तलाश में हैं और इस सप्ताह इंटरव्यू के लिए उपलब्ध हैं?',
            'आप किस शहर या लोकेशन में काम करना पसंद करेंगे, और क्या आप सामान्य शिफ्ट समय के लिए तैयार हैं?',
            'कृपया अपना कुल कार्य अनुभव और अपनी वर्तमान या पिछली भूमिका संक्षेप में बताएं?',
            'आपकी अपेक्षित मासिक सैलरी क्या है, और चयन होने पर आप कितने दिनों में जॉइन कर सकते हैं?',
        ],
        edgeCases: {
            wrong_person: 'असुविधा के लिए क्षमा चाहते हैं, शायद गलत नंबर लग गया। आपका दिन शुभ हो।',
            call_back_later: 'कोई बात नहीं। प्लेसमेंट वर्ल्ड से आपको किस समय दोबारा कॉल करना सही रहेगा?',
            refuses: 'समझ गई, मैं नोट कर लेती हूँ कि आप अभी इच्छुक नहीं हैं और आगे परेशान नहीं करेंगे। धन्यवाद।',
        },
        closing:
            'जानकारी साझा करने के लिए धन्यवाद, {{candidate_name}} जी। कृपया ध्यान दें कि प्लेसमेंट वर्ल्ड की नीति के अनुसार {{fee_terms}} लागू होता है। हमारी टीम जल्द ही उपयुक्त अवसरों के साथ संपर्क करेगी।',
    },
    bn: {
        language: 'bn',
        opener:
            'নমস্কার, আমি প্লেসমেন্ট ওয়ার্ল্ড থেকে রিয়া বলছি। অনুগ্রহ করে জানবেন যে এই কলটি রেকর্ড করা হচ্ছে। আমি কি {{candidate_name}}-এর সাথে কথা বলছি?',
        questions: [
            'আপনি কি বর্তমানে নতুন চাকরির সন্ধান করছেন এবং এই সপ্তাহে ইন্টারভিউয়ের জন্য উপলব্ধ আছেন?',
            'আপনি কোন শহর বা লোকেশনে কাজ করতে পছন্দ করবেন, এবং সাধারণ শিফটের সময়ে কাজ করতে কি আপনি স্বাচ্ছন্দ্যবোধ করেন?',
            'আপনার মোট কাজের অভিজ্ঞতা এবং বর্তমান বা শেষ পদটি সংক্ষেপে বলবেন?',
            'আপনার প্রত্যাশিত মাসিক বেতন কত, এবং নির্বাচিত হলে আপনি কত দিনের মধ্যে জয়েন করতে পারবেন?',
        ],
        edgeCases: {
            wrong_person: 'অসুবিধার জন্য দুঃখিত, সম্ভবত ভুল নম্বরে কল হয়ে গেছে। ভালো থাকবেন।',
            call_back_later: 'কোনো অসুবিধা নেই। প্লেসমেন্ট ওয়ার্ল্ড থেকে কখন আপনাকে আবার কল করলে সুবিধা হবে?',
            refuses: 'বুঝেছি, আমি নোট করে নিচ্ছি যে আপনি এখন আগ্রহী নন এবং আর বিরক্ত করা হবে না। ধন্যবাদ।',
        },
        closing:
            'তথ্য দেওয়ার জন্য ধন্যবাদ, {{candidate_name}}। অনুগ্রহ করে জেনে রাখুন প্লেসমেন্ট ওয়ার্ল্ডের নীতি অনুযায়ী {{fee_terms}} প্রযোজ্য। আমাদের টিম শীঘ্রই উপযুক্ত চাকরির খবর নিয়ে যোগাযোগ করবে।',
    },
};

export function renderPlacementScript(
    language: PlacementLanguage,
    candidateName: string,
    feeTerms?: string,
): PlacementScript {
    const base = SCRIPTS[language];
    const name = candidateName.trim() || 'there';
    const fee = feeTerms?.trim() || DEFAULT_FEE_TERMS[language];
    return {
        language: base.language,
        opener: base.opener.replace(/\{\{candidate_name\}\}/g, name),
        questions: [base.questions[0], base.questions[1], base.questions[2], base.questions[3]],
        edgeCases: { ...base.edgeCases },
        closing: base.closing
            .replace(/\{\{candidate_name\}\}/g, name)
            .replace(/\{\{fee_terms\}\}/g, fee),
    };
}
