"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    Zap,
    Mic,
    Search,
    Database,
    TrendingUp,
    AlertTriangle,
    ShieldCheck,
    Coins
} from "lucide-react";
import { getDailyCostsAction } from "@/app/actions/profile";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";

// ── Component-LOCAL i18n table (keyed by uiLangCode ISO) ──────────────────
// Interface chrome on the admin cost dashboard follows the app UI language,
// not the AI-output language. Resolved via LANGUAGE_TO_ISO[language].
type LangCode = "en" | "hi" | "mr" | "bn" | "pa" | "gu" | "or" | "ta" | "te" | "kn" | "ml";

const I18N: Record<string, Record<LangCode, string>> = {
    CRITICAL: {
        en: "CRITICAL", hi: "गंभीर", mr: "गंभीर", bn: "গুরুতর", pa: "ਗੰਭੀਰ",
        gu: "ગંભીર", or: "ଗୁରୁତର", ta: "மிக முக்கியம்", te: "క్లిష్టమైనది",
        kn: "ಗಂಭೀರ", ml: "ഗുരുതരം",
    },
    WARNING: {
        en: "WARNING", hi: "चेतावनी", mr: "इशारा", bn: "সতর্কতা", pa: "ਚੇਤਾਵਨੀ",
        gu: "ચેતવણી", or: "ଚେତାବନୀ", ta: "எச்சரிக்கை", te: "హెచ్చరిక",
        kn: "ಎಚ್ಚರಿಕೆ", ml: "മുന്നറിയിപ്പ്",
    },
    HEALTHY: {
        en: "HEALTHY", hi: "स्वस्थ", mr: "निरोगी", bn: "সুস্থ", pa: "ਤੰਦਰੁਸਤ",
        gu: "સ્વસ્થ", or: "ସୁସ୍ଥ", ta: "ஆரோக்கியம்", te: "ఆరోగ్యకరం",
        kn: "ಆರೋಗ್ಯಕರ", ml: "ആരോഗ്യകരം",
    },
    Limit: {
        en: "Limit", hi: "सीमा", mr: "मर्यादा", bn: "সীমা", pa: "ਸੀਮਾ",
        gu: "મર્યાદા", or: "ସୀମା", ta: "வரம்பு", te: "పరిమితి",
        kn: "ಮಿತಿ", ml: "പരിധി",
    },
    Usage: {
        en: "Usage", hi: "उपयोग", mr: "वापर", bn: "ব্যবহার", pa: "ਵਰਤੋਂ",
        gu: "વપરાશ", or: "ବ୍ୟବହାର", ta: "பயன்பாடு", te: "వినియోగం",
        kn: "ಬಳಕೆ", ml: "ഉപയോഗം",
    },
    SyncingCosts: {
        en: "Syncing real-time costs...",
        hi: "रीयल-टाइम लागत सिंक हो रही है...",
        mr: "रिअल-टाइम खर्च सिंक होत आहे...",
        bn: "রিয়েল-টাইম খরচ সিঙ্ক হচ্ছে...",
        pa: "ਰੀਅਲ-ਟਾਈਮ ਲਾਗਤਾਂ ਸਿੰਕ ਹੋ ਰਹੀਆਂ ਹਨ...",
        gu: "રિયલ-ટાઇમ ખર્ચ સિંક થઈ રહ્યો છે...",
        or: "ରିଅଲ-ଟାଇମ୍ ଖର୍ଚ୍ଚ ସିଙ୍କ ହେଉଛି...",
        ta: "நிகழ்நேரச் செலவுகள் ஒத்திசைக்கப்படுகின்றன...",
        te: "రియల్-టైమ్ ఖర్చులు సింక్ అవుతున్నాయి...",
        kn: "ರಿಯಲ್-ಟೈಮ್ ವೆಚ್ಚಗಳು ಸಿಂಕ್ ಆಗುತ್ತಿವೆ...",
        ml: "തത്സമയ ചെലവുകൾ സിങ്ക് ചെയ്യുന്നു...",
    },
    RealTimeMonitoring: {
        en: "REAL-TIME MONITORING",
        hi: "रीयल-टाइम निगरानी",
        mr: "रिअल-टाइम देखरेख",
        bn: "রিয়েল-টাইম পর্যবেক্ষণ",
        pa: "ਰੀਅਲ-ਟਾਈਮ ਨਿਗਰਾਨੀ",
        gu: "રિયલ-ટાઇમ મોનિટરિંગ",
        or: "ରିଅଲ-ଟାଇମ୍ ନିରୀକ୍ଷଣ",
        ta: "நிகழ்நேர கண்காணிப்பு",
        te: "రియల్-టైమ్ పర్యవేక్షణ",
        kn: "ರಿಯಲ್-ಟೈಮ್ ಮೇಲ್ವಿಚಾರಣೆ",
        ml: "തത്സമയ നിരീക്ഷണം",
    },
    MissionControl: {
        en: "Mission Control",
        hi: "मिशन कंट्रोल",
        mr: "मिशन कंट्रोल",
        bn: "মিশন কন্ট্রোল",
        pa: "ਮਿਸ਼ਨ ਕੰਟਰੋਲ",
        gu: "મિશન કંટ્રોલ",
        or: "ମିଶନ୍ କଣ୍ଟ୍ରୋଲ୍",
        ta: "மிஷன் கட்டுப்பாடு",
        te: "మిషన్ కంట్రోల్",
        kn: "ಮಿಷನ್ ಕಂಟ್ರೋಲ್",
        ml: "മിഷൻ കൺട്രോൾ",
    },
    AndCosts: {
        en: "& Costs",
        hi: "और लागत",
        mr: "आणि खर्च",
        bn: "ও খরচ",
        pa: "ਅਤੇ ਲਾਗਤਾਂ",
        gu: "અને ખર્ચ",
        or: "ଓ ଖର୍ଚ୍ଚ",
        ta: "மற்றும் செலவுகள்",
        te: "& ఖర్చులు",
        kn: "ಮತ್ತು ವೆಚ್ಚಗಳು",
        ml: "& ചെലവുകൾ",
    },
    HeaderSubtitle: {
        en: "Live operational transparency for SahayakAI. Monitoring API quotas, infrastructure spend, and resource health.",
        hi: "SahayakAI के लिए लाइव परिचालन पारदर्शिता। API कोटा, अवसंरचना खर्च और संसाधन स्वास्थ्य की निगरानी।",
        mr: "SahayakAI साठी थेट परिचालन पारदर्शकता. API कोटा, पायाभूत सुविधा खर्च आणि संसाधन आरोग्याची देखरेख.",
        bn: "SahayakAI-এর জন্য লাইভ পরিচালনাগত স্বচ্ছতা। API কোটা, পরিকাঠামো ব্যয় এবং সম্পদের স্বাস্থ্য পর্যবেক্ষণ।",
        pa: "SahayakAI ਲਈ ਲਾਈਵ ਸੰਚਾਲਨ ਪਾਰਦਰਸ਼ਤਾ। API ਕੋਟਾ, ਬੁਨਿਆਦੀ ਢਾਂਚਾ ਖਰਚ ਅਤੇ ਸਰੋਤ ਸਿਹਤ ਦੀ ਨਿਗਰਾਨੀ।",
        gu: "SahayakAI માટે જીવંત પરિચાલન પારદર્શિતા. API ક્વોટા, ઈન્ફ્રાસ્ટ્રક્ચર ખર્ચ અને સંસાધન આરોગ્યનું મોનિટરિંગ.",
        or: "SahayakAI ପାଇଁ ଲାଇଭ୍ ପରିଚାଳନା ସ୍ୱଚ୍ଛତା। API କୋଟା, ଭିତ୍ତିଭୂମି ଖର୍ଚ୍ଚ ଏବଂ ସମ୍ବଳ ସ୍ୱାସ୍ଥ୍ୟ ନିରୀକ୍ଷଣ।",
        ta: "SahayakAI-க்கான நேரடி செயல்பாட்டு வெளிப்படைத்தன்மை. API ஒதுக்கீடுகள், உள்கட்டமைப்பு செலவு மற்றும் வள ஆரோக்கியத்தைக் கண்காணித்தல்.",
        te: "SahayakAI కోసం ప్రత్యక్ష నిర్వహణ పారదర్శకత. API కోటాలు, మౌలిక సదుపాయాల ఖర్చు మరియు వనరుల ఆరోగ్యాన్ని పర్యవేక్షించడం.",
        kn: "SahayakAI ಗಾಗಿ ನೇರ ಕಾರ್ಯಾಚರಣೆ ಪಾರದರ್ಶಕತೆ. API ಕೋಟಾಗಳು, ಮೂಲಸೌಕರ್ಯ ವೆಚ್ಚ ಮತ್ತು ಸಂಪನ್ಮೂಲ ಆರೋಗ್ಯವನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡುವುದು.",
        ml: "SahayakAI-നുള്ള തത്സമയ പ്രവർത്തന സുതാര്യത. API ക്വോട്ടകൾ, ഇൻഫ്രാസ്ട്രക്ചർ ചെലവ്, റിസോഴ്സ് ആരോഗ്യം എന്നിവ നിരീക്ഷിക്കുന്നു.",
    },
    GeminiSpendTitle: {
        en: "Gemini Spend", hi: "जेमिनी खर्च", mr: "जेमिनी खर्च", bn: "জেমিনি ব্যয়",
        pa: "ਜੈਮਿਨੀ ਖਰਚ", gu: "જેમિની ખર્ચ", or: "ଜେମିନି ଖର୍ଚ୍ଚ", ta: "ஜெமினி செலவு",
        te: "జెమిని ఖర్చు", kn: "ಜೆಮಿನಿ ವೆಚ್ಚ", ml: "ജെമിനി ചെലവ്",
    },
    GeminiSpendDesc: {
        en: "Daily estimated spend on Gemini 2.0 Flash APIs.",
        hi: "जेमिनी 2.0 फ्लैश API पर दैनिक अनुमानित खर्च।",
        mr: "जेमिनी 2.0 फ्लॅश API वर दैनिक अंदाजित खर्च.",
        bn: "জেমিনি 2.0 ফ্ল্যাশ API-তে দৈনিক আনুমানিক ব্যয়।",
        pa: "ਜੈਮਿਨੀ 2.0 ਫਲੈਸ਼ API 'ਤੇ ਰੋਜ਼ਾਨਾ ਅਨੁਮਾਨਿਤ ਖਰਚ।",
        gu: "જેમિની 2.0 ફ્લેશ API પર દૈનિક અંદાજિત ખર્ચ.",
        or: "ଜେମିନି 2.0 ଫ୍ଲାସ୍ API ରେ ଦୈନିକ ଆନୁମାନିକ ଖର୍ଚ୍ଚ।",
        ta: "ஜெமினி 2.0 ஃபிளாஷ் API-களில் தினசரி மதிப்பிடப்பட்ட செலவு.",
        te: "జెమిని 2.0 ఫ్లాష్ API లపై రోజువారీ అంచనా ఖర్చు.",
        kn: "ಜೆಮಿನಿ 2.0 ಫ್ಲ್ಯಾಷ್ API ಗಳ ಮೇಲೆ ದೈನಂದಿನ ಅಂದಾಜು ವೆಚ್ಚ.",
        ml: "ജെമിനി 2.0 ഫ്ലാഷ് API-കളിലെ പ്രതിദിന കണക്കാക്കിയ ചെലവ്.",
    },
    TtsVolumeTitle: {
        en: "TTS Volume", hi: "TTS मात्रा", mr: "TTS खंड", bn: "TTS পরিমাণ",
        pa: "TTS ਮਾਤਰਾ", gu: "TTS જથ્થો", or: "TTS ପରିମାଣ", ta: "TTS அளவு",
        te: "TTS పరిమాణం", kn: "TTS ಪ್ರಮಾಣ", ml: "TTS അളവ്",
    },
    TtsVolumeDesc: {
        en: "Google Cloud Text-to-Speech character usage.",
        hi: "गूगल क्लाउड टेक्स्ट-टू-स्पीच वर्ण उपयोग।",
        mr: "गूगल क्लाउड टेक्स्ट-टू-स्पीच वर्ण वापर.",
        bn: "গুগল ক্লাউড টেক্সট-টু-স্পিচ অক্ষর ব্যবহার।",
        pa: "ਗੂਗਲ ਕਲਾਉਡ ਟੈਕਸਟ-ਟੂ-ਸਪੀਚ ਅੱਖਰ ਵਰਤੋਂ।",
        gu: "ગૂગલ ક્લાઉડ ટેક્સ્ટ-ટૂ-સ્પીચ અક્ષર વપરાશ.",
        or: "ଗୁଗଲ କ୍ଲାଉଡ୍ ଟେକ୍ସଟ-ଟୁ-ସ୍ପିଚ୍ ଅକ୍ଷର ବ୍ୟବହାର।",
        ta: "கூகுள் கிளவுட் டெக்ஸ்ட்-டு-ஸ்பீச் எழுத்து பயன்பாடு.",
        te: "గూగుల్ క్లౌడ్ టెక్స్ట్-టు-స్పీచ్ అక్షర వినియోగం.",
        kn: "ಗೂಗಲ್ ಕ್ಲೌಡ್ ಟೆಕ್ಸ್ಟ್-ಟು-ಸ್ಪೀಚ್ ಅಕ್ಷರ ಬಳಕೆ.",
        ml: "ഗൂഗിൾ ക്ലൗഡ് ടെക്സ്റ്റ്-ടു-സ്പീച്ച് അക്ഷര ഉപയോഗം.",
    },
    GroundingTitle: {
        en: "Grounding API", hi: "ग्राउंडिंग API", mr: "ग्राउंडिंग API", bn: "গ্রাউন্ডিং API",
        pa: "ਗ੍ਰਾਊਂਡਿੰਗ API", gu: "ગ્રાઉન્ડિંગ API", or: "ଗ୍ରାଉଣ୍ଡିଂ API", ta: "கிரவுண்டிங் API",
        te: "గ్రౌండింగ్ API", kn: "ಗ್ರೌಂಡಿಂಗ್ API", ml: "ഗ്രൗണ്ടിംഗ് API",
    },
    GroundingDesc: {
        en: "Live Google Search grounding for Instant Answers.",
        hi: "तत्काल उत्तरों के लिए लाइव गूगल सर्च ग्राउंडिंग।",
        mr: "तत्काळ उत्तरांसाठी थेट गूगल सर्च ग्राउंडिंग.",
        bn: "তাৎক্ষণিক উত্তরের জন্য লাইভ গুগল সার্চ গ্রাউন্ডিং।",
        pa: "ਤੁਰੰਤ ਜਵਾਬਾਂ ਲਈ ਲਾਈਵ ਗੂਗਲ ਖੋਜ ਗ੍ਰਾਊਂਡਿੰਗ।",
        gu: "ઇન્સ્ટન્ટ જવાબો માટે જીવંત ગૂગલ સર્ચ ગ્રાઉન્ડિંગ.",
        or: "ତତକ୍ଷଣାତ୍ ଉତ୍ତର ପାଇଁ ଲାଇଭ୍ ଗୁଗଲ ସର୍ଚ୍ଚ ଗ୍ରାଉଣ୍ଡିଂ।",
        ta: "உடனடி பதில்களுக்கான நேரடி கூகுள் தேடல் கிரவுண்டிங்.",
        te: "తక్షణ సమాధానాల కోసం ప్రత్యక్ష గూగుల్ సెర్చ్ గ్రౌండింగ్.",
        kn: "ತ್ವರಿತ ಉತ್ತರಗಳಿಗಾಗಿ ನೇರ ಗೂಗಲ್ ಸರ್ಚ್ ಗ್ರೌಂಡಿಂಗ್.",
        ml: "ഇൻസ്റ്റന്റ് ഉത്തരങ്ങൾക്കായി തത്സമയ ഗൂഗിൾ സെർച്ച് ഗ്രൗണ്ടിംഗ്.",
    },
    FirestoreTitle: {
        en: "Firestore Writes", hi: "फायरस्टोर राइट्स", mr: "फायरस्टोर राइट्स", bn: "ফায়ারস্টোর রাইট",
        pa: "ਫਾਇਰਸਟੋਰ ਰਾਈਟਸ", gu: "ફાયરસ્ટોર રાઇટ્સ", or: "ଫାୟାରଷ୍ଟୋର ରାଇଟ୍ସ", ta: "ஃபயர்ஸ்டோர் எழுத்துகள்",
        te: "ఫైర్‌స్టోర్ రైట్‌లు", kn: "ಫೈರ್‌ಸ್ಟೋರ್ ರೈಟ್‌ಗಳು", ml: "ഫയർസ്റ്റോർ റൈറ്റുകൾ",
    },
    FirestoreDesc: {
        en: "Atomic database updates and content persistence.",
        hi: "परमाणविक डेटाबेस अपडेट और सामग्री संग्रहण।",
        mr: "अणुस्तरीय डेटाबेस अद्यतने आणि सामग्री जतन.",
        bn: "অ্যাটমিক ডেটাবেস আপডেট এবং কন্টেন্ট সংরক্ষণ।",
        pa: "ਐਟਮਿਕ ਡੇਟਾਬੇਸ ਅੱਪਡੇਟ ਅਤੇ ਸਮੱਗਰੀ ਸੰਭਾਲ।",
        gu: "એટોમિક ડેટાબેઝ અપડેટ અને સામગ્રી જાળવણી.",
        or: "ଆଟୋମିକ୍ ଡାଟାବେସ୍ ଅଦ୍ୟତନ ଏବଂ ବିଷୟବସ୍ତୁ ସଂରକ୍ଷଣ।",
        ta: "அணு அளவிலான தரவுத்தள புதுப்பிப்புகள் மற்றும் உள்ளடக்க சேமிப்பு.",
        te: "అటామిక్ డేటాబేస్ నవీకరణలు మరియు కంటెంట్ నిలుపుదల.",
        kn: "ಅಣು ಮಟ್ಟದ ಡೇಟಾಬೇಸ್ ನವೀಕರಣಗಳು ಮತ್ತು ವಿಷಯ ಸಂಗ್ರಹಣೆ.",
        ml: "ആറ്റോമിക് ഡാറ്റാബേസ് അപ്ഡേറ്റുകളും ഉള്ളടക്ക സംരക്ഷണവും.",
    },
    ImageGenTitle: {
        en: "Image Gen", hi: "इमेज जनरेशन", mr: "इमेज जनरेशन", bn: "ইমেজ জেন",
        pa: "ਇਮੇਜ ਜਨਰੇਸ਼ਨ", gu: "ઇમેજ જનરેશન", or: "ଇମେଜ ଜେନ୍", ta: "பட உருவாக்கம்",
        te: "ఇమేజ్ జెన్", kn: "ಇಮೇಜ್ ಜೆನ್", ml: "ഇമേജ് ജെൻ",
    },
    ImageGenDesc: {
        en: "Daily AI image generation for Visual Aids.",
        hi: "विजुअल एड्स के लिए दैनिक AI छवि निर्माण।",
        mr: "व्हिज्युअल एड्ससाठी दैनिक AI प्रतिमा निर्मिती.",
        bn: "ভিজ্যুয়াল এইডসের জন্য দৈনিক AI চিত্র তৈরি।",
        pa: "ਵਿਜ਼ੂਅਲ ਏਡਜ਼ ਲਈ ਰੋਜ਼ਾਨਾ AI ਚਿੱਤਰ ਨਿਰਮਾਣ।",
        gu: "વિઝ્યુઅલ એઇડ્સ માટે દૈનિક AI છબી નિર્માણ.",
        or: "ଭିଜୁଆଲ ଏଡ୍ସ ପାଇଁ ଦୈନିକ AI ଚିତ୍ର ସୃଷ୍ଟି।",
        ta: "காட்சி உதவிகளுக்கான தினசரி AI பட உருவாக்கம்.",
        te: "విజువల్ ఎయిడ్స్ కోసం రోజువారీ AI చిత్ర ఉత్పత్తి.",
        kn: "ದೃಶ್ಯ ಸಾಧನಗಳಿಗಾಗಿ ದೈನಂದಿನ AI ಚಿತ್ರ ರಚನೆ.",
        ml: "വിഷ്വൽ എയ്ഡുകൾക്കായി പ്രതിദിന AI ഇമേജ് നിർമ്മാണം.",
    },
    UnitUSD: {
        en: "USD", hi: "USD", mr: "USD", bn: "USD", pa: "USD", gu: "USD",
        or: "USD", ta: "USD", te: "USD", kn: "USD", ml: "USD",
    },
    UnitChars: {
        en: "Chars", hi: "वर्ण", mr: "वर्ण", bn: "অক্ষর", pa: "ਅੱਖਰ", gu: "અક્ષરો",
        or: "ଅକ୍ଷର", ta: "எழுத்துகள்", te: "అక్షరాలు", kn: "ಅಕ್ಷರಗಳು", ml: "അക്ഷരങ്ങൾ",
    },
    UnitCalls: {
        en: "Calls", hi: "कॉल", mr: "कॉल", bn: "কল", pa: "ਕਾਲਾਂ", gu: "કૉલ્સ",
        or: "କଲ୍", ta: "அழைப்புகள்", te: "కాల్‌లు", kn: "ಕರೆಗಳು", ml: "കോളുകൾ",
    },
    UnitWrites: {
        en: "Writes", hi: "राइट्स", mr: "राइट्स", bn: "রাইট", pa: "ਰਾਈਟਸ", gu: "રાઇટ્સ",
        or: "ରାଇଟ୍ସ", ta: "எழுத்துகள்", te: "రైట్‌లు", kn: "ರೈಟ್‌ಗಳು", ml: "റൈറ്റുകൾ",
    },
    UnitImages: {
        en: "Images", hi: "छवियाँ", mr: "प्रतिमा", bn: "ছবি", pa: "ਤਸਵੀਰਾਂ", gu: "છબીઓ",
        or: "ଚିତ୍ର", ta: "படங்கள்", te: "చిత్రాలు", kn: "ಚಿತ್ರಗಳು", ml: "ചിത്രങ്ങൾ",
    },
    SystemStatus: {
        en: "System Status", hi: "सिस्टम स्थिति", mr: "सिस्टम स्थिती", bn: "সিস্টেম অবস্থা",
        pa: "ਸਿਸਟਮ ਸਥਿਤੀ", gu: "સિસ્ટમ સ્થિતિ", or: "ସିଷ୍ଟମ୍ ସ୍ଥିତି", ta: "கணினி நிலை",
        te: "సిస్టమ్ స్థితి", kn: "ಸಿಸ್ಟಮ್ ಸ್ಥಿತಿ", ml: "സിസ്റ്റം നില",
    },
    HealthMetrics: {
        en: "Platform-wide health metrics.",
        hi: "प्लेटफ़ॉर्म-व्यापी स्वास्थ्य मीट्रिक।",
        mr: "प्लॅटफॉर्म-व्यापी आरोग्य मापदंड.",
        bn: "প্ল্যাটফর্ম-ব্যাপী স্বাস্থ্য মেট্রিক।",
        pa: "ਪਲੇਟਫਾਰਮ-ਵਿਆਪਕ ਸਿਹਤ ਮੈਟ੍ਰਿਕਸ।",
        gu: "પ્લેટફોર્મ-વ્યાપી આરોગ્ય મેટ્રિક્સ.",
        or: "ପ୍ଲାଟଫର୍ମ-ବ୍ୟାପୀ ସ୍ୱାସ୍ଥ୍ୟ ମେଟ୍ରିକ୍ସ।",
        ta: "தளம் முழுவதிலான ஆரோக்கிய அளவீடுகள்.",
        te: "ప్లాట్‌ఫారం-వ్యాప్త ఆరోగ్య కొలమానాలు.",
        kn: "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್-ವ್ಯಾಪಿ ಆರೋಗ್ಯ ಮಾಪನಗಳು.",
        ml: "പ്ലാറ്റ്‌ഫോം-വ്യാപക ആരോഗ്യ മെട്രിക്കുകൾ.",
    },
    CloudRunOk: {
        en: "Cloud Run: Asia-South1 OK",
        hi: "क्लाउड रन: एशिया-साउथ1 ठीक",
        mr: "क्लाउड रन: आशिया-साउथ1 ठीक",
        bn: "ক্লাউড রান: এশিয়া-সাউথ1 ঠিক",
        pa: "ਕਲਾਉਡ ਰਨ: ਏਸ਼ੀਆ-ਸਾਊਥ1 ਠੀਕ",
        gu: "ક્લાઉડ રન: એશિયા-સાઉથ1 ઠીક",
        or: "କ୍ଲାଉଡ୍ ରନ୍: ଏସିଆ-ସାଉଥ1 ଠିକ୍",
        ta: "கிளவுட் ரன்: ஆசியா-சவுத்1 சரி",
        te: "క్లౌడ్ రన్: ఆసియా-సౌత్1 సరే",
        kn: "ಕ್ಲೌಡ್ ರನ್: ಏಷ್ಯಾ-ಸೌತ್1 ಸರಿ",
        ml: "ക്ലൗഡ് റൺ: ഏഷ്യ-സൗത്ത്1 ശരി",
    },
    ApiLatency: {
        en: "API Latency: 420ms (Avg)",
        hi: "API विलंबता: 420ms (औसत)",
        mr: "API विलंब: 420ms (सरासरी)",
        bn: "API ল্যাটেন্সি: 420ms (গড়)",
        pa: "API ਲੇਟੈਂਸੀ: 420ms (ਔਸਤ)",
        gu: "API લેટન્સી: 420ms (સરેરાશ)",
        or: "API ବିଳମ୍ବ: 420ms (ହାରାହାରି)",
        ta: "API தாமதம்: 420ms (சராசரி)",
        te: "API లేటెన్సీ: 420ms (సగటు)",
        kn: "API ಲೇಟೆನ್ಸಿ: 420ms (ಸರಾಸರಿ)",
        ml: "API ലേറ്റൻസി: 420ms (ശരാശരി)",
    },
    SafeToScale: {
        en: "SAFE TO SCALE",
        hi: "स्केल करना सुरक्षित",
        mr: "स्केल करणे सुरक्षित",
        bn: "স্কেল করা নিরাপদ",
        pa: "ਸਕੇਲ ਕਰਨਾ ਸੁਰੱਖਿਅਤ",
        gu: "સ્કેલ કરવું સલામત",
        or: "ସ୍କେଲ୍ କରିବା ସୁରକ୍ଷିତ",
        ta: "அளவிடப் பாதுகாப்பானது",
        te: "స్కేల్ చేయడం సురక్షితం",
        kn: "ಸ್ಕೇಲ್ ಮಾಡಲು ಸುರಕ್ಷಿತ",
        ml: "സ്കെയിൽ ചെയ്യാൻ സുരക്ഷിതം",
    },
    BillingSafeguards: {
        en: "Billing Safeguards",
        hi: "बिलिंग सुरक्षा उपाय",
        mr: "बिलिंग सुरक्षा उपाय",
        bn: "বিলিং সুরক্ষা ব্যবস্থা",
        pa: "ਬਿਲਿੰਗ ਸੁਰੱਖਿਆ ਉਪਾਅ",
        gu: "બિલિંગ સુરક્ષા પગલાં",
        or: "ବିଲିଂ ସୁରକ୍ଷା ବ୍ୟବସ୍ଥା",
        ta: "பில்லிங் பாதுகாப்புகள்",
        te: "బిల్లింగ్ భద్రతా చర్యలు",
        kn: "ಬಿಲ್ಲಿಂಗ್ ಸುರಕ್ಷತಾ ಕ್ರಮಗಳು",
        ml: "ബില്ലിംഗ് സുരക്ഷാ നടപടികൾ",
    },
    BillingSafeguardsDesc: {
        en: "Alerts are integrated with Google Cloud Billing. If thresholds are breached, the system will prioritize traffic for verified educators and temporarily restrict high-cost autonomous agents.",
        hi: "अलर्ट गूगल क्लाउड बिलिंग के साथ एकीकृत हैं। यदि सीमाएँ पार होती हैं, तो सिस्टम सत्यापित शिक्षकों के लिए ट्रैफ़िक को प्राथमिकता देगा और उच्च-लागत वाले स्वायत्त एजेंटों को अस्थायी रूप से प्रतिबंधित करेगा।",
        mr: "अलर्ट गूगल क्लाउड बिलिंगसह एकत्रित आहेत. जर मर्यादा ओलांडल्या गेल्या, तर सिस्टम सत्यापित शिक्षकांसाठी रहदारीला प्राधान्य देईल आणि उच्च-खर्चाच्या स्वायत्त एजंटांना तात्पुरते मर्यादित करेल.",
        bn: "অ্যালার্ট গুগল ক্লাউড বিলিংয়ের সাথে একীভূত। থ্রেশহোল্ড অতিক্রম করলে, সিস্টেম যাচাইকৃত শিক্ষকদের জন্য ট্রাফিককে অগ্রাধিকার দেবে এবং উচ্চ-ব্যয়ের স্বায়ত্তশাসিত এজেন্টদের সাময়িকভাবে সীমাবদ্ধ করবে।",
        pa: "ਅਲਰਟ ਗੂਗਲ ਕਲਾਉਡ ਬਿਲਿੰਗ ਨਾਲ ਏਕੀਕ੍ਰਿਤ ਹਨ। ਜੇ ਸੀਮਾਵਾਂ ਪਾਰ ਹੁੰਦੀਆਂ ਹਨ, ਤਾਂ ਸਿਸਟਮ ਪ੍ਰਮਾਣਿਤ ਅਧਿਆਪਕਾਂ ਲਈ ਟ੍ਰੈਫਿਕ ਨੂੰ ਤਰਜੀਹ ਦੇਵੇਗਾ ਅਤੇ ਉੱਚ-ਲਾਗਤ ਵਾਲੇ ਖੁਦਮੁਖਤਿਆਰ ਏਜੰਟਾਂ ਨੂੰ ਅਸਥਾਈ ਤੌਰ 'ਤੇ ਸੀਮਤ ਕਰੇਗਾ।",
        gu: "અલર્ટ ગૂગલ ક્લાઉડ બિલિંગ સાથે સંકલિત છે. જો થ્રેશોલ્ડ ઓળંગાય, તો સિસ્ટમ ચકાસાયેલ શિક્ષકો માટે ટ્રાફિકને પ્રાધાન્ય આપશે અને ઉચ્ચ-ખર્ચવાળા સ્વાયત્ત એજન્ટોને અસ્થાયી રૂપે પ્રતિબંધિત કરશે.",
        or: "ଆଲର୍ଟ ଗୁଗଲ କ୍ଲାଉଡ୍ ବିଲିଂ ସହିତ ସମନ୍ୱିତ। ଯଦି ସୀମା ଅତିକ୍ରମ ହୁଏ, ତେବେ ସିଷ୍ଟମ୍ ଯାଞ୍ଚିତ ଶିକ୍ଷକମାନଙ୍କ ପାଇଁ ଟ୍ରାଫିକକୁ ପ୍ରାଥମିକତା ଦେବ ଏବଂ ଉଚ୍ଚ-ଖର୍ଚ୍ଚ ସ୍ୱୟଂଚାଳିତ ଏଜେଣ୍ଟମାନଙ୍କୁ ଅସ୍ଥାୟୀ ଭାବେ ସୀମିତ କରିବ।",
        ta: "எச்சரிக்கைகள் கூகுள் கிளவுட் பில்லிங்குடன் ஒருங்கிணைக்கப்பட்டுள்ளன. வரம்புகள் மீறப்பட்டால், சரிபார்க்கப்பட்ட ஆசிரியர்களுக்கான போக்குவரத்துக்கு கணினி முன்னுரிமை அளிக்கும் மற்றும் அதிக செலவு கொண்ட தன்னாட்சி முகவர்களை தற்காலிகமாக கட்டுப்படுத்தும்.",
        te: "హెచ్చరికలు గూగుల్ క్లౌడ్ బిల్లింగ్‌తో అనుసంధానించబడ్డాయి. పరిమితులు మించిపోతే, సిస్టమ్ ధృవీకరించబడిన ఉపాధ్యాయుల కోసం ట్రాఫిక్‌కు ప్రాధాన్యత ఇస్తుంది మరియు అధిక-ఖర్చు స్వయంప్రతిపత్త ఏజెంట్లను తాత్కాలికంగా పరిమితం చేస్తుంది.",
        kn: "ಎಚ್ಚರಿಕೆಗಳು ಗೂಗಲ್ ಕ್ಲೌಡ್ ಬಿಲ್ಲಿಂಗ್‌ನೊಂದಿಗೆ ಸಂಯೋಜಿಸಲ್ಪಟ್ಟಿವೆ. ಮಿತಿಗಳು ಮೀರಿದರೆ, ಸಿಸ್ಟಮ್ ಪರಿಶೀಲಿಸಿದ ಶಿಕ್ಷಕರಿಗೆ ಸಂಚಾರಕ್ಕೆ ಆದ್ಯತೆ ನೀಡುತ್ತದೆ ಮತ್ತು ಹೆಚ್ಚಿನ-ವೆಚ್ಚದ ಸ್ವಾಯತ್ತ ಏಜೆಂಟ್‌ಗಳನ್ನು ತಾತ್ಕಾಲಿಕವಾಗಿ ನಿರ್ಬಂಧಿಸುತ್ತದೆ.",
        ml: "അലേർട്ടുകൾ ഗൂഗിൾ ക്ലൗഡ് ബില്ലിംഗുമായി സംയോജിപ്പിച്ചിരിക്കുന്നു. പരിധികൾ ലംഘിക്കപ്പെട്ടാൽ, സിസ്റ്റം പരിശോധിച്ച അധ്യാപകർക്കായി ട്രാഫിക്കിന് മുൻഗണന നൽകുകയും ഉയർന്ന ചെലവുള്ള സ്വയംഭരണ ഏജന്റുമാരെ താൽക്കാലികമായി നിയന്ത്രിക്കുകയും ചെയ്യും.",
    },
};

function tr(key: keyof typeof I18N, uiLangCode: string): string {
    const row = I18N[key];
    return row[(uiLangCode as LangCode)] ?? row.en;
}

interface MetricCardProps {
    title: string;
    value: number;
    threshold: number;
    unit: string;
    icon: React.ElementType;
    color: string;
    description: string;
    uiLangCode: string;
}

function MetricCard({ title, value, threshold, unit, icon: Icon, color, description, uiLangCode }: MetricCardProps) {
    const percentage = Math.min(100, (value / threshold) * 100);
    const isOverThreshold = value >= threshold;
    const isWarning = value >= threshold * 0.8;

    return (
        <Card className="bg-card border border-border shadow-elevated transition-all duration-300 hover:shadow-primary/10">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className={cn("p-2 rounded-xl", color)}>
                        <div className="bg-muted rounded-full p-2">
                            <Icon className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    {isOverThreshold ? (
                        <Badge variant="destructive" className="animate-pulse">{tr("CRITICAL", uiLangCode)}</Badge>
                    ) : isWarning ? (
                        <Badge className="bg-orange-500 hover:bg-orange-600">{tr("WARNING", uiLangCode)}</Badge>
                    ) : (
                        <Badge variant="outline" className="text-green-600 border-green-200">{tr("HEALTHY", uiLangCode)}</Badge>
                    )}
                </div>
                <CardTitle className="text-xl font-black mt-4 font-headline tracking-tight">{title}</CardTitle>
                <CardDescription className="text-muted-foreground font-medium">{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                            <span className="text-3xl font-black text-foreground tracking-tighter">
                                {value.toLocaleString()}
                                <span className="text-sm text-muted-foreground ml-1 font-bold">{unit}</span>
                            </span>
                        </div>
                        <span className="text-sm font-bold text-muted-foreground">
                            {tr("Limit", uiLangCode)}: {threshold.toLocaleString()}
                        </span>
                    </div>
                    <div className="space-y-2">
                        <Progress value={percentage} className="h-2 bg-muted [&>div]:rounded-full" />
                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <span>0%</span>
                            <span>{percentage.toFixed(1)}% {tr("Usage", uiLangCode)}</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminCostDashboard() {
    const { language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || "en";
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getDailyCostsAction(1);
                if (data && data.length > 0) {
                    setStats(data[0].metrics);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Fallback data if no tracking yet today
    const currentMetrics = stats || {
        gemini_tokens: 0,
        tts_characters: 0,
        image_generations: 0,
        grounding_calls: 0,
        firestore_writes: 0,
        estimated_spend_usd: 0
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 py-20 animate-pulse text-center">
                <ShieldCheck className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
                <h2 className="text-2xl font-black text-muted-foreground font-headline">{tr("SyncingCosts", uiLangCode)}</h2>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-12 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-wide">
                    <Coins className="h-4 w-4" />
                    {tr("RealTimeMonitoring", uiLangCode)}
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-foreground font-headline tracking-tight leading-none">
                    {tr("MissionControl", uiLangCode)} <span className="text-primary">{tr("AndCosts", uiLangCode)}</span>
                </h1>
                <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                    {tr("HeaderSubtitle", uiLangCode)}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title={tr("GeminiSpendTitle", uiLangCode)}
                    value={currentMetrics.estimated_spend_usd}
                    threshold={50}
                    unit={tr("UnitUSD", uiLangCode)}
                    icon={Zap}
                    color="bg-purple-500 shadow-lg shadow-purple-500/30"
                    description={tr("GeminiSpendDesc", uiLangCode)}
                    uiLangCode={uiLangCode}
                />
                <MetricCard
                    title={tr("TtsVolumeTitle", uiLangCode)}
                    value={currentMetrics.tts_characters}
                    threshold={5000000}
                    unit={tr("UnitChars", uiLangCode)}
                    icon={Mic}
                    color="bg-blue-500 shadow-lg shadow-blue-500/30"
                    description={tr("TtsVolumeDesc", uiLangCode)}
                    uiLangCode={uiLangCode}
                />
                <MetricCard
                    title={tr("GroundingTitle", uiLangCode)}
                    value={currentMetrics.grounding_calls}
                    threshold={1000}
                    unit={tr("UnitCalls", uiLangCode)}
                    icon={Search}
                    color="bg-orange-500 shadow-lg shadow-orange-500/30"
                    description={tr("GroundingDesc", uiLangCode)}
                    uiLangCode={uiLangCode}
                />
                <MetricCard
                    title={tr("FirestoreTitle", uiLangCode)}
                    value={currentMetrics.firestore_writes}
                    threshold={10000}
                    unit={tr("UnitWrites", uiLangCode)}
                    icon={Database}
                    color="bg-indigo-500 shadow-lg shadow-indigo-500/30"
                    description={tr("FirestoreDesc", uiLangCode)}
                    uiLangCode={uiLangCode}
                />
                <MetricCard
                    title={tr("ImageGenTitle", uiLangCode)}
                    value={currentMetrics.image_generations}
                    threshold={500}
                    unit={tr("UnitImages", uiLangCode)}
                    icon={TrendingUp}
                    color="bg-pink-500 shadow-lg shadow-pink-500/30"
                    description={tr("ImageGenDesc", uiLangCode)}
                    uiLangCode={uiLangCode}
                />
                <Card className="bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Activity className="h-32 w-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl tracking-tight">{tr("SystemStatus", uiLangCode)}</CardTitle>
                        <CardDescription className="text-slate-400 font-medium">{tr("HealthMetrics", uiLangCode)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
                            <span className="text-sm font-bold tracking-widest uppercase">{tr("CloudRunOk", uiLangCode)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
                            <span className="text-sm font-bold tracking-widest uppercase">{tr("ApiLatency", uiLangCode)}</span>
                        </div>
                        <div className="pt-4">
                            <Badge className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold p-3">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                {tr("SafeToScale", uiLangCode)}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-slate-50/50 p-8 rounded-[2.5rem]">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-10 w-10 text-orange-600" />
                    </div>
                    <div className="space-y-2 text-center md:text-left">
                        <h3 className="text-2xl font-black text-foreground font-headline">{tr("BillingSafeguards", uiLangCode)}</h3>
                        <p className="text-muted-foreground font-medium">
                            {tr("BillingSafeguardsDesc", uiLangCode)}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
