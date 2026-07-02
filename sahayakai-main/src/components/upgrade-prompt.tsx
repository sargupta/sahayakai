'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

interface UpgradePromptProps {
    feature: string;
    used: number;
    limit: number;
    /** If true, renders as a compact inline banner instead of a card */
    inline?: boolean;
}

type IsoCode = 'en' | 'hi' | 'mr' | 'bn' | 'pa' | 'gu' | 'or' | 'ta' | 'te' | 'kn' | 'ml';

/**
 * Translated, already-pluralized feature labels keyed by feature slug -> ISO code.
 * Falls back to a de-slugged English label for unknown features.
 */
const FEATURE_LABELS: Record<string, Record<IsoCode, string>> = {
    'lesson-plan': {
        en: 'lesson plans', hi: 'पाठ योजनाएँ', mr: 'पाठ योजना', bn: 'পাঠ পরিকল্পনা',
        pa: 'ਪਾਠ ਯੋਜਨਾਵਾਂ', gu: 'પાઠ યોજનાઓ', or: 'ପାଠ ଯୋଜନା', ta: 'பாடத் திட்டங்கள்',
        te: 'పాఠ ప్రణాళికలు', kn: 'ಪಾಠ ಯೋಜನೆಗಳು', ml: 'പാഠ പദ്ധതികൾ',
    },
    quiz: {
        en: 'quizzes', hi: 'क्विज़', mr: 'क्विझ', bn: 'কুইজ',
        pa: 'ਕਵਿਜ਼', gu: 'ક્વિઝ', or: 'କୁଇଜ୍', ta: 'வினாடி வினாக்கள்',
        te: 'క్విజ్‌లు', kn: 'ರಸಪ್ರಶ್ನೆಗಳು', ml: 'ക്വിസുകൾ',
    },
    worksheet: {
        en: 'worksheets', hi: 'वर्कशीट', mr: 'वर्कशीट', bn: 'ওয়ার্কশিট',
        pa: 'ਵਰਕਸ਼ੀਟਾਂ', gu: 'વર્કશીટ', or: 'ୱାର୍କସିଟ୍', ta: 'பணித்தாள்கள்',
        te: 'వర్క్‌షీట్‌లు', kn: 'ಕಾರ್ಯಹಾಳೆಗಳು', ml: 'വർക്ക്‌ഷീറ്റുകൾ',
    },
};

/** Inline banner sentence. {used} and {label} are interpolated; {upgrade} is the link. */
const INLINE_BODY: Record<IsoCode, { before: string; after: string }> = {
    en: { before: "You've created {used} {label} this month. ", after: ' for more.' },
    hi: { before: 'आपने इस महीने {used} {label} बनाई हैं। ', after: ' और के लिए।' },
    mr: { before: 'तुम्ही या महिन्यात {used} {label} तयार केल्या आहेत. ', after: ' अधिकसाठी.' },
    bn: { before: 'আপনি এই মাসে {used}টি {label} তৈরি করেছেন। ', after: ' আরও পেতে।' },
    pa: { before: 'ਤੁਸੀਂ ਇਸ ਮਹੀਨੇ {used} {label} ਬਣਾਈਆਂ ਹਨ। ', after: ' ਹੋਰ ਲਈ।' },
    gu: { before: 'તમે આ મહિને {used} {label} બનાવી છે. ', after: ' વધુ માટે.' },
    or: { before: 'ଆପଣ ଏହି ମାସରେ {used}ଟି {label} ସୃଷ୍ଟି କରିଛନ୍ତି। ', after: ' ଅଧିକ ପାଇଁ।' },
    ta: { before: 'இந்த மாதம் நீங்கள் {used} {label} உருவாக்கியுள்ளீர்கள். ', after: ' மேலும் பெற.' },
    te: { before: 'మీరు ఈ నెల {used} {label} సృష్టించారు. ', after: ' మరిన్నింటి కోసం.' },
    kn: { before: 'ನೀವು ಈ ತಿಂಗಳು {used} {label} ರಚಿಸಿದ್ದೀರಿ. ', after: ' ಇನ್ನಷ್ಟಕ್ಕಾಗಿ.' },
    ml: { before: 'നിങ്ങൾ ഈ മാസം {used} {label} സൃഷ്ടിച്ചു. ', after: ' കൂടുതലിന്.' },
};

/** Full-card body paragraph. {used} and {label} are interpolated. */
const CARD_BODY: Record<IsoCode, string> = {
    en: "You've created {used} {label} — that's {used} lessons your students benefited from. Upgrade to Pro for higher limits and better AI quality.",
    hi: 'आपने {used} {label} बनाई हैं — यानी {used} पाठ जिनसे आपके विद्यार्थियों को लाभ हुआ। उच्च सीमाओं और बेहतर AI गुणवत्ता के लिए Pro में अपग्रेड करें।',
    mr: 'तुम्ही {used} {label} तयार केल्या आहेत — म्हणजे {used} पाठ ज्यांचा तुमच्या विद्यार्थ्यांना फायदा झाला. उच्च मर्यादा आणि उत्तम AI गुणवत्तेसाठी Pro वर अपग्रेड करा.',
    bn: 'আপনি {used}টি {label} তৈরি করেছেন — অর্থাৎ {used}টি পাঠ যা থেকে আপনার শিক্ষার্থীরা উপকৃত হয়েছে। উচ্চতর সীমা এবং উন্নত AI মানের জন্য Pro-তে আপগ্রেড করুন।',
    pa: 'ਤੁਸੀਂ {used} {label} ਬਣਾਈਆਂ ਹਨ — ਯਾਨੀ {used} ਪਾਠ ਜਿਨ੍ਹਾਂ ਤੋਂ ਤੁਹਾਡੇ ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਲਾਭ ਹੋਇਆ। ਉੱਚ ਸੀਮਾਵਾਂ ਅਤੇ ਬਿਹਤਰ AI ਗੁਣਵੱਤਾ ਲਈ Pro ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰੋ।',
    gu: 'તમે {used} {label} બનાવી છે — એટલે કે {used} પાઠ જેનાથી તમારા વિદ્યાર્થીઓને લાભ થયો. ઉચ્ચ મર્યાદાઓ અને વધુ સારી AI ગુણવત્તા માટે Proમાં અપગ્રેડ કરો.',
    or: 'ଆପଣ {used} {label} ସୃଷ୍ଟି କରିଛନ୍ତି — ଅର୍ଥାତ୍ {used} ପାଠ ଯାହାଠାରୁ ଆପଣଙ୍କ ଛାତ୍ରମାନେ ଲାଭବାନ ହୋଇଛନ୍ତି। ଅଧିକ ସୀମା ଏବଂ ଭଲ AI ଗୁଣବତ୍ତା ପାଇଁ Pro କୁ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ।',
    ta: 'நீங்கள் {used} {label} உருவாக்கியுள்ளீர்கள் — அதாவது உங்கள் மாணவர்கள் பயனடைந்த {used} பாடங்கள். அதிக வரம்புகள் மற்றும் சிறந்த AI தரத்திற்கு Pro-வுக்கு மேம்படுத்தவும்.',
    te: 'మీరు {used} {label} సృష్టించారు — అంటే మీ విద్యార్థులకు ప్రయోజనం చేకూర్చిన {used} పాఠాలు. ఎక్కువ పరిమితులు మరియు మెరుగైన AI నాణ్యత కోసం Proకి అప్‌గ్రేడ్ చేయండి.',
    kn: 'ನೀವು {used} {label} ರಚಿಸಿದ್ದೀರಿ — ಅಂದರೆ ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಪ್ರಯೋಜನವಾದ {used} ಪಾಠಗಳು. ಹೆಚ್ಚಿನ ಮಿತಿಗಳು ಮತ್ತು ಉತ್ತಮ AI ಗುಣಮಟ್ಟಕ್ಕಾಗಿ Pro ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.',
    ml: 'നിങ്ങൾ {used} {label} സൃഷ്ടിച്ചു — അതായത് നിങ്ങളുടെ വിദ്യാർത്ഥികൾക്ക് പ്രയോജനപ്പെട്ട {used} പാഠങ്ങൾ. ഉയർന്ന പരിധികൾക്കും മികച്ച AI ഗുണനിലവാരത്തിനും Pro ലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യുക.',
};

/** Primary CTA button label, with price. */
const CTA_LABEL: Record<IsoCode, string> = {
    en: 'Upgrade to Pro — ₹149/month',
    hi: 'Pro में अपग्रेड करें — ₹149/माह',
    mr: 'Pro वर अपग्रेड करा — ₹149/महिना',
    bn: 'Pro-তে আপগ্রেড করুন — ₹149/মাস',
    pa: 'Pro ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰੋ — ₹149/ਮਹੀਨਾ',
    gu: 'Proમાં અપગ્રેડ કરો — ₹149/મહિનો',
    or: 'Pro କୁ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ — ₹149/ମାସ',
    ta: 'Pro-வுக்கு மேம்படுத்தவும் — ₹149/மாதம்',
    te: 'Proకి అప్‌గ్రేడ్ చేయండి — ₹149/నెల',
    kn: 'Pro ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ — ₹149/ತಿಂಗಳು',
    ml: 'Pro ലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യുക — ₹149/മാസം',
};

/**
 * Shown when a user hits their usage limit.
 * Positive framing: celebrates what they've done, then nudges upgrade.
 */
export function UpgradePrompt({ feature, used, limit, inline }: UpgradePromptProps) {
    const { t, language } = useLanguage();
    const uiLangCode = (LANGUAGE_TO_ISO[language] ?? 'en') as IsoCode;

    // Translated, pre-pluralized feature label; fall back to de-slugged English.
    const featureLabel =
        FEATURE_LABELS[feature]?.[uiLangCode] ?? `${feature.replace(/-/g, ' ')}s`;

    if (inline) {
        const body = INLINE_BODY[uiLangCode] ?? INLINE_BODY.en;
        const before = body.before
            .replace('{used}', String(used))
            .replace('{label}', featureLabel);
        return (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-2.5 text-sm dark:border-amber-800/60 dark:bg-amber-950/80">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-200">
                    {before}
                    <Link href="/pricing" className="font-medium underline underline-offset-2">
                        {t("Upgrade to Pro")}
                    </Link>
                    {body.after}
                </span>
            </div>
        );
    }

    const cardBody = (CARD_BODY[uiLangCode] ?? CARD_BODY.en)
        .replace(/\{used\}/g, String(used))
        .replace('{label}', featureLabel);
    const ctaLabel = CTA_LABEL[uiLangCode] ?? CTA_LABEL.en;

    return (
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:border-amber-800/60 dark:from-amber-950/60 dark:to-orange-950/40">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <Sparkles className="h-8 w-8 text-amber-600" />
                <div>
                    <h3 className="font-headline text-lg font-semibold text-amber-900 dark:text-amber-100">
                        {t("Great work this month!")}
                    </h3>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        {cardBody}
                    </p>
                </div>
                <Button asChild className="bg-amber-500 hover:bg-amber-600 shadow-sm">
                    <Link href="/pricing">
                        <Sparkles className="mr-2 h-4 w-4" />
                        {ctaLabel}
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
