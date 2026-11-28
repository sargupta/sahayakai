/**
 * Multilingual post-stay feedback scripts (English, Hindi, Bengali) for AtithiVani (SP-10).
 * Every opener includes the recording notice and opt-out instruction before any questions.
 */

import type { AtithiLanguage } from './types';

export interface AtithiScript {
    language: AtithiLanguage;
    opener: string;
    questions: readonly [string, string, string];
    closePositive: string;
    closeIssue: string;
    closeOptOut: string;
}

const SCRIPTS: Record<AtithiLanguage, AtithiScript> = {
    en: {
        language: 'en',
        opener:
            'Hello {{guest_name}}, this is Riya calling from {{hotel_name}} regarding your recent stay. ' +
            'This call may be recorded for service quality, and you can ask not to be called anytime. ' +
            'Do you have one minute to share quick feedback?',
        questions: [
            'How was your overall stay with us—on a scale of 1 to 5, or in your own words?',
            'Were your room, cleanliness, and check-in comfortable?',
            'Is there anything our team did well, or anything we could improve for your next visit?',
        ],
        closePositive:
            'Thank you so much for your time, {{guest_name}}. We have saved your feedback for the {{hotel_name}} team and hope to welcome you back soon.',
        closeIssue:
            "I'm sorry about that, {{guest_name}}. I have flagged this for the {{hotel_name}} duty manager right away. Thank you for letting us know.",
        closeOptOut:
            'Understood, {{guest_name}}. I have noted your preference and we will not call again. Thank you.',
    },
    hi: {
        language: 'hi',
        opener:
            'नमस्ते {{guest_name}} जी, मैं {{hotel_name}} से रिया बोल रही हूँ आपके हाल के स्टे के बारे में। ' +
            'सेवा की गुणवत्ता के लिए यह कॉल रिकॉर्ड की जा सकती है, और आप कभी भी कॉल न करने के लिए कह सकते हैं। ' +
            'क्या आपके पास फीडबैक देने के लिए एक मिनट है?',
        questions: [
            'आपका पूरा अनुभव कैसा रहा—1 से 5 के बीच या अपने शब्दों में बताइए?',
            'क्या कमरा, सफाई और चेक-इन का अनुभव आरामदायक था?',
            'क्या कोई ऐसी बात है जो हमारी टीम ने अच्छी की, या अगली बार हम क्या बेहतर कर सकते हैं?',
        ],
        closePositive:
            'आपके समय के लिए बहुत धन्यवाद, {{guest_name}} जी। हमने आपका फीडबैक {{hotel_name}} टीम के लिए सेव कर लिया है। फिर स्वागत करने की उम्मीद करते हैं।',
        closeIssue:
            'इस असुविधा के लिए क्षमा चाहते हैं, {{guest_name}} जी। मैंने यह तुरंत {{hotel_name}} के ड्यूटी मैनेजर को भेज दिया है। बताने के लिए धन्यवाद।',
        closeOptOut:
            'ठीक है {{guest_name}} जी, मैंने नोट कर लिया है—अब आपको दोबारा कॉल नहीं आएगा। धन्यवाद।',
    },
    bn: {
        language: 'bn',
        opener:
            'নমস্কার {{guest_name}}, আমি {{hotel_name}} থেকে রিয়া বলছি আপনার সাম্প্রতিক থাকার অভিজ্ঞতা নিয়ে। ' +
            'পরিষেবার মানের জন্য এই কলটি রেকর্ড করা হতে পারে, এবং আপনি যেকোনো সময় কল না করার কথা বলতে পারেন। ' +
            'একটু মতামত দেওয়ার জন্য কি এক মিনিট সময় হবে?',
        questions: [
            'আপনার সামগ্রিক থাকার অভিজ্ঞতা কেমন ছিল—১ থেকে ৫-এর মধ্যে বা নিজের কথায় বলবেন?',
            'ঘর, পরিচ্ছন্নতা এবং চেক-ইন কি আরামদায়ক ছিল?',
            'আমাদের টিমের কোন কাজটি ভালো লেগেছে, বা পরের বার আমরা কী আরও ভালো করতে পারি?',
        ],
        closePositive:
            'আপনার সময়ের জন্য অনেক ধন্যবাদ, {{guest_name}}। আমরা আপনার মতামত {{hotel_name}} টিমের জন্য সংরক্ষণ করেছি। আবার স্বাগত জানানোর আশা রাখি।',
        closeIssue:
            'এই অসুবিধার জন্য দুঃখিত, {{guest_name}}। আমি এটি এখনই {{hotel_name}}-এর ডিউটি ম্যানেজারকে জানিয়ে দিচ্ছি। জানানোর জন্য ধন্যবাদ।',
        closeOptOut:
            'বুঝেছি {{guest_name}}, আমি এটি নোট করে নিয়েছি—আমরা আর কল করব না। ধন্যবাদ।',
    },
};

function fillVars(template: string, guestName: string, hotelName: string): string {
    return template
        .replace(/\{\{guest_name\}\}/g, guestName.trim() || 'Guest')
        .replace(/\{\{hotel_name\}\}/g, hotelName.trim() || 'the hotel');
}

export function getAtithiScript(language: AtithiLanguage): AtithiScript {
    return SCRIPTS[language];
}

export function renderAtithiScript(language: AtithiLanguage, guestName: string, hotelName: string): AtithiScript {
    const base = getAtithiScript(language);
    return {
        language: base.language,
        opener: fillVars(base.opener, guestName, hotelName),
        questions: [base.questions[0], base.questions[1], base.questions[2]],
        closePositive: fillVars(base.closePositive, guestName, hotelName),
        closeIssue: fillVars(base.closeIssue, guestName, hotelName),
        closeOptOut: fillVars(base.closeOptOut, guestName, hotelName),
    };
}
