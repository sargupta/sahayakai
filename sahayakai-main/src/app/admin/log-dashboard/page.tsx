'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Terminal,
    AlertCircle,
    Info,
    AlertTriangle,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Filter,
    Search,
    Activity
} from 'lucide-react';
import { getLogsAction } from '@/app/actions/logs';
import { LogEntryDTO } from '@/lib/services/log-service';
import { format } from 'date-fns';
import { hi, bn, ta, te, kn, gu, enIN, type Locale } from 'date-fns/locale';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

// Component-local chrome translations, keyed by the 11 ISO UI-language codes.
const LOCAL_T: Record<string, Record<string, string>> = {
    systemLogs: {
        en: 'System Logs', hi: 'सिस्टम लॉग', mr: 'सिस्टम लॉग', bn: 'সিস্টেম লগ', pa: 'ਸਿਸਟਮ ਲੌਗ', gu: 'સિસ્ટમ લોગ', or: 'ସିଷ୍ଟମ୍ ଲଗ୍', ta: 'கணினி பதிவுகள்', te: 'సిస్టమ్ లాగ్‌లు', kn: 'ಸಿಸ್ಟಮ್ ಲಾಗ್‌ಗಳು', ml: 'സിസ്റ്റം ലോഗുകൾ'
    },
    subtitle: {
        en: 'Real-time infrastructure and AI flow visibility from GCP Logging.',
        hi: 'GCP लॉगिंग से रीयल-टाइम इन्फ्रास्ट्रक्चर और AI फ़्लो की दृश्यता।',
        mr: 'GCP लॉगिंगमधून रिअल-टाइम इन्फ्रास्ट्रक्चर आणि AI फ्लो दृश्यमानता.',
        bn: 'GCP লগিং থেকে রিয়েল-টাইম পরিকাঠামো এবং AI ফ্লো দৃশ্যমানতা।',
        pa: 'GCP ਲੌਗਿੰਗ ਤੋਂ ਰੀਅਲ-ਟਾਈਮ ਬੁਨਿਆਦੀ ਢਾਂਚਾ ਅਤੇ AI ਫਲੋ ਦੀ ਦਿੱਖ।',
        gu: 'GCP લોગિંગથી રીઅલ-ટાઇમ ઇન્ફ્રાસ્ટ્રક્ચર અને AI ફ્લો દૃશ્યતા.',
        or: 'GCP ଲଗିଂରୁ ରିଅଲ୍-ଟାଇମ୍ ଭିତ୍ତିଭୂମି ଏବଂ AI ଫ୍ଲୋ ଦୃଶ୍ୟମାନତା।',
        ta: 'GCP லாக்கிங்கிலிருந்து நிகழ்நேர உள்கட்டமைப்பு மற்றும் AI ஓட்ட தெரிவுநிலை.',
        te: 'GCP లాగింగ్ నుండి రియల్-టైమ్ మౌలిక సదుపాయాలు మరియు AI ఫ్లో దృశ్యమానత.',
        kn: 'GCP ಲಾಗಿಂಗ್‌ನಿಂದ ರಿಯಲ್-ಟೈಮ್ ಮೂಲಸೌಕರ್ಯ ಮತ್ತು AI ಫ್ಲೋ ಗೋಚರತೆ.',
        ml: 'GCP ലോഗിംഗിൽ നിന്നുള്ള തത്സമയ ഇൻഫ്രാസ്ട്രക്ചറും AI ഫ്ലോ ദൃശ്യതയും.'
    },
    filterBySeverity: {
        en: 'Filter by Severity:', hi: 'गंभीरता के अनुसार फ़िल्टर करें:', mr: 'तीव्रतेनुसार फिल्टर करा:', bn: 'গুরুত্ব অনুসারে ফিল্টার করুন:', pa: 'ਗੰਭੀਰਤਾ ਅਨੁਸਾਰ ਫਿਲਟਰ ਕਰੋ:', gu: 'ગંભીરતા પ્રમાણે ફિલ્ટર કરો:', or: 'ଗମ୍ଭୀରତା ଅନୁସାରେ ଫିଲ୍ଟର୍ କରନ୍ତୁ:', ta: 'தீவிரத்தன்மை அடிப்படையில் வடிகட்டு:', te: 'తీవ్రత ఆధారంగా ఫిల్టర్ చేయండి:', kn: 'ತೀವ್ರತೆಯ ಆಧಾರದ ಮೇಲೆ ಫಿಲ್ಟರ್ ಮಾಡಿ:', ml: 'തീവ്രത അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക:'
    },
    syncing: {
        en: 'Syncing with GCP...', hi: 'GCP के साथ सिंक हो रहा है...', mr: 'GCP सोबत सिंक होत आहे...', bn: 'GCP-এর সাথে সিঙ্ক হচ্ছে...', pa: 'GCP ਨਾਲ ਸਿੰਕ ਹੋ ਰਿਹਾ ਹੈ...', gu: 'GCP સાથે સિંક થઈ રહ્યું છે...', or: 'GCP ସହିତ ସିଙ୍କ୍ ହେଉଛି...', ta: 'GCP உடன் ஒத்திசைக்கிறது...', te: 'GCP తో సింక్ అవుతోంది...', kn: 'GCP ಜೊತೆ ಸಿಂಕ್ ಆಗುತ್ತಿದೆ...', ml: 'GCP-യുമായി സമന്വയിപ്പിക്കുന്നു...'
    },
    fetchError: {
        en: 'An unexpected error occurred while fetching logs.',
        hi: 'लॉग प्राप्त करते समय एक अप्रत्याशित त्रुटि हुई।',
        mr: 'लॉग मिळवताना एक अनपेक्षित त्रुटी आली.',
        bn: 'লগ আনার সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।',
        pa: 'ਲੌਗ ਪ੍ਰਾਪਤ ਕਰਦੇ ਸਮੇਂ ਇੱਕ ਅਣਕਿਆਸੀ ਗਲਤੀ ਹੋਈ।',
        gu: 'લૉગ મેળવતી વખતે એક અણધારી ભૂલ આવી.',
        or: 'ଲଗ୍ ଆଣିବା ସମୟରେ ଏକ ଅପ୍ରତ୍ୟାଶିତ ତ୍ରୁଟି ଘଟିଲା।',
        ta: 'பதிவுகளைப் பெறும்போது எதிர்பாராத பிழை ஏற்பட்டது.',
        te: 'లాగ్‌లను పొందుతున్నప్పుడు ఊహించని లోపం సంభవించింది.',
        kn: 'ಲಾಗ್‌ಗಳನ್ನು ಪಡೆಯುವಾಗ ಅನಿರೀಕ್ಷಿತ ದೋಷ ಸಂಭವಿಸಿದೆ.',
        ml: 'ലോഗുകൾ ലഭ്യമാക്കുമ്പോൾ അപ്രതീക്ഷിത പിശക് സംഭവിച്ചു.'
    },
    liveStream: {
        en: 'Live Stream', hi: 'लाइव स्ट्रीम', mr: 'लाइव्ह स्ट्रीम', bn: 'লাইভ স্ট্রিম', pa: 'ਲਾਈਵ ਸਟ੍ਰੀਮ', gu: 'લાઇવ સ્ટ્રીમ', or: 'ଲାଇଭ୍ ଷ୍ଟ୍ରିମ୍', ta: 'நேரடி ஸ்ட்ரீம்', te: 'లైవ్ స్ట్రీమ్', kn: 'ಲೈವ್ ಸ್ಟ್ರೀಮ್', ml: 'ലൈവ് സ്ട്രീം'
    },
    last50: {
        en: 'Last 50 Entries', hi: 'अंतिम 50 प्रविष्टियाँ', mr: 'शेवटच्या 50 नोंदी', bn: 'সর্বশেষ 50টি এন্ট্রি', pa: 'ਆਖਰੀ 50 ਐਂਟਰੀਆਂ', gu: 'છેલ્લી 50 એન્ટ્રીઓ', or: 'ଶେଷ 50 ଏଣ୍ଟ୍ରି', ta: 'கடைசி 50 உள்ளீடுகள்', te: 'చివరి 50 ఎంట్రీలు', kn: 'ಕೊನೆಯ 50 ನಮೂದುಗಳು', ml: 'അവസാന 50 എൻട്രികൾ'
    },
    noLogs: {
        en: 'No logs found for this filter in the last period.',
        hi: 'पिछली अवधि में इस फ़िल्टर के लिए कोई लॉग नहीं मिला।',
        mr: 'मागील कालावधीत या फिल्टरसाठी कोणतेही लॉग आढळले नाहीत.',
        bn: 'গত সময়কালে এই ফিল্টারের জন্য কোনো লগ পাওয়া যায়নি।',
        pa: 'ਪਿਛਲੇ ਸਮੇਂ ਵਿੱਚ ਇਸ ਫਿਲਟਰ ਲਈ ਕੋਈ ਲੌਗ ਨਹੀਂ ਮਿਲਿਆ।',
        gu: 'છેલ્લા સમયગાળામાં આ ફિલ્ટર માટે કોઈ લૉગ મળ્યો નથી.',
        or: 'ଶେଷ ସମୟ ଅବଧିରେ ଏହି ଫିଲ୍ଟର୍ ପାଇଁ କୌଣସି ଲଗ୍ ମିଳିଲା ନାହିଁ।',
        ta: 'கடந்த காலகட்டத்தில் இந்த வடிப்பானுக்கு பதிவுகள் எதுவும் இல்லை.',
        te: 'గత కాలంలో ఈ ఫిల్టర్ కోసం లాగ్‌లు ఏవీ కనుగొనబడలేదు.',
        kn: 'ಕಳೆದ ಅವಧಿಯಲ್ಲಿ ಈ ಫಿಲ್ಟರ್‌ಗಾಗಿ ಯಾವುದೇ ಲಾಗ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ.',
        ml: 'കഴിഞ്ഞ കാലയളവിൽ ഈ ഫിൽട്ടറിനായി ലോഗുകളൊന്നും കണ്ടെത്തിയില്ല.'
    }
};

// date-fns locales by ISO; mr/or/pa/ml lack a date-fns locale -> fall back to enIN.
const DATE_LOCALES: Record<string, Locale> = {
    en: enIN, hi, bn, ta, te, kn, gu, mr: hi, or: enIN, pa: enIN, ml: enIN
};

export default function AdminLogDashboard() {
    const { language, t } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || 'en';
    const tl = (key: string) => LOCAL_T[key]?.[uiLangCode] ?? LOCAL_T[key]?.en ?? key;
    const dateLocale = DATE_LOCALES[uiLangCode] || enIN;
    const [logs, setLogs] = useState<LogEntryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getLogsAction(50, severityFilter);
            if (result.error) {
                setError(result.error);
            } else {
                setLogs(result.logs || []);
            }
        } catch (err) {
            setError(LOCAL_T.fetchError[uiLangCode] ?? LOCAL_T.fetchError.en);
        } finally {
            setLoading(false);
        }
    }, [severityFilter, uiLangCode]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getSeverityBadge = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'ERROR':
            case 'CRITICAL':
                return <Badge variant="destructive" className="gap-1 px-2.5 py-1"><AlertCircle className="h-3 w-3" /> {severity}</Badge>;
            case 'WARNING':
                return <Badge className="bg-amber-500 text-white gap-1 px-2.5 py-1 hover:bg-amber-600 border-none"><AlertTriangle className="h-3 w-3" /> {severity}</Badge>;
            default:
                return <Badge variant="secondary" className="gap-1 px-2.5 py-1"><Info className="h-3 w-3" /> {severity}</Badge>;
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        {tl('systemLogs')}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {tl('subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchLogs}
                        disabled={loading}
                        className="gap-2 backdrop-blur-sm bg-background/50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {t('Refresh')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Filters Card */}
                <Card className="border-none shadow-soft bg-secondary/30 backdrop-blur-md">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            {tl('filterBySeverity')}
                        </div>
                        <div className="flex gap-2">
                            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((lvl) => (
                                <Button
                                    key={lvl}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSeverityFilter(lvl)}
                                    className={
                                        severityFilter === lvl
                                            ? 'rounded-full px-4 bg-foreground text-background border-foreground hover:bg-foreground/90'
                                            : 'rounded-full px-4 bg-transparent border-border text-muted-foreground hover:bg-muted/40'
                                    }
                                >
                                    {lvl}
                                </Button>
                            ))}
                        </div>
                        {loading && <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                            <Activity className="h-3 w-3 animate-pulse text-primary" />
                            {tl('syncing')}
                        </div>}
                    </CardContent>
                </Card>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Logs Table */}
                <Card className="border-none shadow-xl bg-background/50 backdrop-blur-xl overflow-hidden ring-1 ring-border/50">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-primary" />
                                {tl('liveStream')}
                            </CardTitle>
                            <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                {tl('last50')}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                            {logs.length === 0 && !loading ? (
                                <div className="p-12 text-center">
                                    <Terminal className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-muted-foreground">{tl('noLogs')}</p>
                                </div>
                            ) : (
                                logs.map((log, index) => {
                                    const logId = `${log.timestamp}-${index}`;
                                    const isExpanded = expandedId === logId;

                                    return (
                                        <div key={logId} className="group hover:bg-muted/30 transition-colors">
                                            <div
                                                className="flex items-center p-4 cursor-pointer"
                                                onClick={() => toggleExpand(logId)}
                                            >
                                                <div className="mr-3 text-muted-foreground/50">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                                <div className="w-48 flex-shrink-0 text-xs font-mono text-muted-foreground tabular-nums">
                                                    {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss', { locale: dateLocale })}
                                                </div>
                                                <div className="w-32 flex-shrink-0">
                                                    {getSeverityBadge(log.severity)}
                                                </div>
                                                <div className="flex-grow min-w-0 px-4">
                                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                        {log.message}
                                                    </p>
                                                    {log.service && (
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tighter bg-muted px-1.5 py-0.5 rounded ml-2">
                                                            {log.service}
                                                        </span>
                                                    )}
                                                </div>
                                                {log.requestId && (
                                                    <div className="hidden lg:block text-[10px] font-mono text-muted-foreground/50">
                                                        Req: {log.requestId.substring(0, 8)}...
                                                    </div>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="px-12 pb-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="bg-black/90 rounded-lg p-4 text-[13px] font-mono text-emerald-400 overflow-x-auto shadow-inner border border-white/5">
                                                        <div className="flex items-center justify-between mb-2 text-muted-foreground/50 border-b border-white/5 pb-2">
                                                            <span>Extended Attributes</span>
                                                            {log.requestId && <span>Request ID: {log.requestId}</span>}
                                                        </div>
                                                        <pre className="mt-2 text-emerald-300">
                                                            {JSON.stringify(
                                                                {
                                                                    service: log.service,
                                                                    operation: log.operation,
                                                                    userId: log.userId,
                                                                    errorId: log.errorId,
                                                                    ...log.metadata
                                                                },
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                        {log.errorId && (
                                                            <div className="mt-4 p-2 bg-red-900/30 border border-red-500/30 rounded text-red-300 text-xs">
                                                                <span className="font-bold">Error ID Reference:</span> {log.errorId}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
