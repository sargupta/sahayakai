'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';
import { PLAN_DISPLAY_NAMES } from '@/lib/plan-config';
import type { PlanType } from '@/lib/plan-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CalendarDays, FileSignature, PencilRuler, ClipboardCheck,
    Sparkles, GraduationCap, Globe2, Images, User, MessageCircle,
    Mic, Loader2, ArrowRight, Crown, Infinity, Gauge,
} from 'lucide-react';
import Link from 'next/link';
import { AuthGate } from '@/components/auth/auth-gate';

const FEATURE_META: Record<string, { icon: React.ElementType; label: string; href: string }> = {
    'lesson-plan':       { icon: CalendarDays,   label: 'Lesson Plans',       href: '/lesson-plan' },
    'quiz':              { icon: FileSignature,   label: 'Quizzes',            href: '/quiz-generator' },
    'worksheet':         { icon: PencilRuler,     label: 'Worksheets',         href: '/worksheet-wizard' },
    'rubric':            { icon: ClipboardCheck,  label: 'Rubrics',            href: '/rubric-generator' },
    'instant-answer':    { icon: Sparkles,        label: 'Instant Answers',    href: '/' },
    'teacher-training':  { icon: GraduationCap,   label: 'Teacher Training',   href: '/teacher-training' },
    'virtual-field-trip':{ icon: Globe2,          label: 'Virtual Field Trips', href: '/virtual-field-trip' },
    'visual-aid':        { icon: Images,          label: 'Visual Aids',        href: '/visual-aid-designer' },
    'avatar':            { icon: User,            label: 'AI Avatars',         href: '/avatar-generator' },
    'parent-message':    { icon: MessageCircle,   label: 'Parent Messages',    href: '/messages' },
    'voice-to-text':     { icon: Mic,             label: 'Voice to Text',      href: '/' },
};

// Component-local translation table for FEATURE_META labels, keyed by ISO code.
// Resolved by uiLangCode so feature names follow the app UI language even when
// the shared dictionary lacks a key. (B1-HARDCODED-ENGLISH)
const FEATURE_LABELS: Record<string, Record<string, string>> = {
    'lesson-plan': {
        en: 'Lesson Plans', hi: 'पाठ योजनाएं', mr: 'पाठ योजना', bn: 'পাঠ পরিকল্পনা',
        pa: 'ਪਾਠ ਯੋਜਨਾਵਾਂ', gu: 'પાઠ યોજનાઓ', or: 'ପାଠ ଯୋଜନା', ta: 'பாடத் திட்டங்கள்',
        te: 'పాఠ ప్రణాళికలు', kn: 'ಪಾಠ ಯೋಜನೆಗಳು', ml: 'പാഠ പദ്ധതികൾ',
    },
    'quiz': {
        en: 'Quizzes', hi: 'प्रश्नोत्तरी', mr: 'प्रश्नमंजुषा', bn: 'কুইজ',
        pa: 'ਕੁਇਜ਼', gu: 'ક્વિઝ', or: 'କୁଇଜ୍', ta: 'வினாடி வினா',
        te: 'క్విజ్‌లు', kn: 'ರಸಪ್ರಶ್ನೆಗಳು', ml: 'ക്വിസുകൾ',
    },
    'worksheet': {
        en: 'Worksheets', hi: 'वर्कशीट', mr: 'वर्कशीट', bn: 'ওয়ার্কশীট',
        pa: 'ਵਰਕਸ਼ੀਟ', gu: 'વર્કશીટ', or: 'ୱର୍କସିଟ୍', ta: 'வேலைத்தாள்கள்',
        te: 'వర్క్‌షీట్‌లు', kn: 'ವರ್ಕ್‌ಶೀಟ್‌ಗಳು', ml: 'വർക്ക്‌ഷീറ്റുകൾ',
    },
    'rubric': {
        en: 'Rubrics', hi: 'मूल्यांकन मानक', mr: 'मूल्यांकन निकष', bn: 'মূল্যায়ন মানদণ্ড',
        pa: 'ਮੁਲਾਂਕਣ ਮਾਪਦੰਡ', gu: 'મૂલ્યાંકન માપદંડ', or: 'ମୂଲ୍ୟାୟନ ମାନଦଣ୍ଡ', ta: 'மதிப்பீட்டு அளவுகோல்கள்',
        te: 'మూల్యాంకన ప్రమాణాలు', kn: 'ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು', ml: 'മൂല്യനിർണ്ണയ മാനദണ്ഡങ്ങൾ',
    },
    'instant-answer': {
        en: 'Instant Answers', hi: 'तुरंत उत्तर', mr: 'त्वरित उत्तरे', bn: 'তাৎক্ষণিক উত্তর',
        pa: 'ਤੁਰੰਤ ਜਵਾਬ', gu: 'તાત્કાલિક જવાબો', or: 'ତୁରନ୍ତ ଉତ୍ତର', ta: 'உடனடி பதில்கள்',
        te: 'తక్షణ సమాధానాలు', kn: 'ತಕ್ಷಣದ ಉತ್ತರಗಳು', ml: 'തൽക്ഷണ ഉത്തരങ്ങൾ',
    },
    'teacher-training': {
        en: 'Teacher Training', hi: 'टीचर ट्रेनिंग', mr: 'शिक्षक प्रशिक्षण', bn: 'শিক্ষক প্রশিক্ষণ',
        pa: 'ਅਧਿਆਪਕ ਸਿਖਲਾਈ', gu: 'શિક્ષક તાલીમ', or: 'ଶିକ୍ଷକ ତାଲିମ୍', ta: 'ஆசிரியர் பயிற்சி',
        te: 'ఉపాధ్యాయ శిక్షణ', kn: 'ಶಿಕ್ಷಕ ತರಬೇತಿ', ml: 'അധ്യാപക പരിശീലനം',
    },
    'virtual-field-trip': {
        en: 'Virtual Field Trips', hi: 'वर्चुअल फील्ड ट्रिप', mr: 'व्हर्च्युअल फील्ड ट्रिप', bn: 'ভার্চুয়াল ফিল্ড ট্রিপ',
        pa: 'ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ', gu: 'વર્ચ્યુઅલ ફીલ્ડ ટ્રિપ', or: 'ଭର୍ଚୁଆଲ୍ ଫିଲ୍ଡ ଟ୍ରିପ୍', ta: 'மெய்நிகர் கள பயணங்கள்',
        te: 'వర్చువల్ ఫీల్డ్ ట్రిప్‌లు', kn: 'ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್‌ಗಳು', ml: 'വെർച്വൽ ഫീൽഡ് ട്രിപ്പുകൾ',
    },
    'visual-aid': {
        en: 'Visual Aids', hi: 'दृश्य सामग्री', mr: 'दृश्य साधने', bn: 'ভিজ্যুয়াল এইড',
        pa: 'ਵਿਜ਼ੂਅਲ ਏਡਜ਼', gu: 'દ્રશ્ય સહાય', or: 'ଭିଜୁଆଲ୍ ଏଡ୍', ta: 'காட்சி உதவிகள்',
        te: 'దృశ్య సహాయాలు', kn: 'ದೃಶ್ಯ ಸಾಧನಗಳು', ml: 'വിഷ്വൽ എയ്ഡ്സ്',
    },
    'avatar': {
        en: 'AI Avatars', hi: 'एआई अवतार', mr: 'एआय अवतार', bn: 'এআই অবতার',
        pa: 'ਏਆਈ ਅਵਤਾਰ', gu: 'એઆઈ અવતાર', or: 'ଏଆଇ ଅବତାର', ta: 'AI அவதாரங்கள்',
        te: 'AI అవతారాలు', kn: 'AI ಅವತಾರಗಳು', ml: 'AI അവതാരങ്ങൾ',
    },
    'parent-message': {
        en: 'Parent Messages', hi: 'अभिभावक संदेश', mr: 'पालक संदेश', bn: 'অভিভাবক বার্তা',
        pa: 'ਮਾਪੇ ਸੁਨੇਹੇ', gu: 'વાલી સંદેશા', or: 'ଅଭିଭାବକ ବାର୍ତ୍ତା', ta: 'பெற்றோர் செய்திகள்',
        te: 'తల్లిదండ్రుల సందేశాలు', kn: 'ಪೋಷಕರ ಸಂದೇಶಗಳು', ml: 'രക്ഷിതാക്കളുടെ സന്ദേശങ്ങൾ',
    },
    'voice-to-text': {
        en: 'Voice to Text', hi: 'आवाज से टेक्स्ट', mr: 'आवाज ते मजकूर', bn: 'ভয়েস থেকে টেক্সট',
        pa: 'ਆਵਾਜ਼ ਤੋਂ ਟੈਕਸਟ', gu: 'અવાજથી ટેક્સ્ટ', or: 'ସ୍ୱର ରୁ ଟେକ୍ସଟ୍', ta: 'குரல் முதல் உரை',
        te: 'వాయిస్ నుండి టెక్స్ట్', kn: 'ಧ್ವನಿಯಿಂದ ಪಠ್ಯ', ml: 'ശബ്ദത്തിൽ നിന്ന് ടെക്സ്റ്റ്',
    },
};

// BCP-47 locale tags by UI ISO code, for date formatting. (B7-LOCALE-FORMAT)
const ISO_TO_BCP47: Record<string, string> = {
    en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN',
    or: 'or-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
};

function getBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function getBarBg(pct: number): string {
    if (pct >= 90) return 'bg-red-100 dark:bg-red-950';
    if (pct >= 70) return 'bg-amber-100 dark:bg-amber-950';
    return 'bg-emerald-100 dark:bg-emerald-950';
}

export default function UsagePage() {
    const { user } = useAuth();
    const { usage, plan, isPro, loading } = useSubscription();
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] ?? 'en';
    const featureLabel = (key: string): string => {
        const entry = FEATURE_LABELS[key];
        if (!entry) return FEATURE_META[key]?.label ?? key;
        return entry[uiLangCode] ?? entry.en;
    };

    if (!user) {
        return (
            <AuthGate
                icon={Gauge}
                title={t("Sign in to see your usage")}
                description={t("Sign in to see how many generations you've used this month and what's left on your plan.")}
            >
                {null}
            </AuthGate>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const limited: { key: string; used: number; limit: number; pct: number }[] = [];
    const unlimited: { key: string; used: number }[] = [];

    for (const [feature, info] of Object.entries(usage)) {
        if (info.limit === -1) {
            unlimited.push({ key: feature, used: info.used });
        } else if (info.limit > 0) {
            const pct = Math.round((info.used / info.limit) * 100);
            limited.push({ key: feature, used: info.used, limit: info.limit, pct });
        }
    }

    limited.sort((a, b) => b.pct - a.pct);

    const planLabel = t(PLAN_DISPLAY_NAMES[plan as PlanType] ?? (plan.charAt(0).toUpperCase() + plan.slice(1)));
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1, 1);
    const resetLabel = resetDate.toLocaleDateString(ISO_TO_BCP47[uiLangCode] ?? 'en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h1 className="text-xl sm:text-2xl font-headline font-bold tracking-tight">{t("Usage")}</h1>
                    <p className="text-xs text-muted-foreground">{t("Resets {date}").replace("{date}", resetLabel)}</p>
                </div>
                <Badge
                    variant="outline"
                    className={isPro
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-muted text-muted-foreground border-border'
                    }
                >
                    {isPro && <Crown className="h-3 w-3 mr-1" />}
                    {planLabel}
                </Badge>
            </div>

            {/* Limited features — stacked cards */}
            {limited.map((f) => {
                const meta = FEATURE_META[f.key];
                const Icon = meta?.icon ?? Sparkles;
                const remaining = f.limit - f.used;
                return (
                    <Card key={f.key} className="overflow-hidden">
                        <CardContent className="py-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Link
                                    href={meta?.href ?? '#'}
                                    className="flex items-center gap-2.5 text-sm font-medium hover:underline"
                                >
                                    <div className="p-1.5 rounded-lg bg-muted/50">
                                        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                    </div>
                                    {FEATURE_LABELS[f.key] ? featureLabel(f.key) : (meta?.label ? t(meta.label) : f.key)}
                                </Link>
                                <span className="text-lg font-semibold tabular-nums">
                                    {f.used}<span className="text-muted-foreground text-sm font-normal">/{f.limit}</span>
                                </span>
                            </div>
                            <div className={`h-2.5 w-full rounded-full overflow-hidden ${getBarBg(f.pct)}`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(f.pct)}`}
                                    style={{ width: `${Math.max(Math.min(f.pct, 100), 1)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {remaining <= 0
                                    ? <span className="text-red-600 font-medium">{t("Limit reached, resets {date}").replace("{date}", resetLabel)}</span>
                                    : remaining <= 2
                                        ? <span className="text-amber-600">{t("{count} remaining").replace("{count}", String(remaining))}</span>
                                        : t("{count} remaining").replace("{count}", String(remaining))
                                }
                            </p>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Unlimited features */}
            {unlimited.length > 0 && (
                <Card>
                    <CardContent className="py-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("Unlimited on your plan")}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {unlimited.map((f) => {
                                const meta = FEATURE_META[f.key];
                                const Icon = meta?.icon ?? Sparkles;
                                return (
                                    <div key={f.key} className="flex items-center gap-2.5 text-sm">
                                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate">{FEATURE_LABELS[f.key] ? featureLabel(f.key) : (meta?.label ? t(meta.label) : f.key)}</span>
                                        <Infinity className="h-3.5 w-3.5 ml-auto text-emerald-500 shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upgrade CTA */}
            {!isPro && (
                <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
                    <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-5">
                        <div>
                            <p className="text-sm font-semibold">{t("Need more?")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {t("Higher limits, better AI, export, parent messaging")}
                            </p>
                        </div>
                        <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 shrink-0">
                            <Link href="/pricing">
                                {t("View Plans")} <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
