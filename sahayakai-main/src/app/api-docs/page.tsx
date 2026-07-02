
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

const SwaggerClient = dynamic(() => import('@/components/swagger-client'), { ssr: false });

// Component-local i18n (keeps the brand token "SahayakAI" untranslated).
const HEADING: Record<string, string> = {
    en: 'SahayakAI API Documentation', hi: 'SahayakAI API दस्तावेज़',
    mr: 'SahayakAI API दस्तऐवज', bn: 'SahayakAI API ডকুমেন্টেশন',
    pa: 'SahayakAI API ਦਸਤਾਵੇਜ਼', gu: 'SahayakAI API દસ્તાવેજ',
    or: 'SahayakAI API ଡକ୍ୟୁମେଣ୍ଟେସନ', ta: 'SahayakAI API ஆவணம்',
    te: 'SahayakAI API డాక్యుమెంటేషన్', kn: 'SahayakAI API ದಾಖಲಾತಿ',
    ml: 'SahayakAI API ഡോക്യുമെന്റേഷൻ',
};
const LOADING: Record<string, string> = {
    en: 'Loading API docs...', hi: 'API दस्तावेज़ लोड हो रहे हैं...',
    mr: 'API दस्तऐवज लोड होत आहेत...', bn: 'API ডকুমেন্ট লোড হচ্ছে...',
    pa: 'API ਦਸਤਾਵੇਜ਼ ਲੋਡ ਹੋ ਰਹੇ ਹਨ...', gu: 'API દસ્તાવેજ લોડ થઈ રહ્યા છે...',
    or: 'API ଡକ୍ୟୁମେଣ୍ଟ ଲୋଡ୍ ହେଉଛି...', ta: 'API ஆவணங்கள் ஏற்றப்படுகின்றன...',
    te: 'API పత్రాలు లోడ్ అవుతున్నాయి...', kn: 'API ದಾಖಲೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    ml: 'API രേഖകൾ ലോഡ് ചെയ്യുന്നു...',
};

export default function ApiDocsPage() {
    const [spec, setSpec] = useState<Record<string, any> | null>(null);
    const { language } = useLanguage();
    const ui = LANGUAGE_TO_ISO[language] ?? 'en';

    useEffect(() => {
        fetch('/api/api-docs')
            .then(r => r.json())
            .then(setSpec)
            .catch(console.error);
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">{HEADING[ui] ?? HEADING.en}</h1>
            {spec ? <SwaggerClient spec={spec} /> : <p>{LOADING[ui] ?? LOADING.en}</p>}
        </div>
    );
}
