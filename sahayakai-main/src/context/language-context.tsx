"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LANGUAGES } from '@/types';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language, persist?: boolean) => Promise<void>;
    t: (key: string) => string;
    isLoaded: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Simple dictionary for primary UI labels
const dictionary: Record<string, Record<Language, string>> = {
    "Home": {
        "English": "Home",
        "Hindi": "होम",
        "Kannada": "ಮನೆ",
        "Tamil": "முகப்பு",
        "Telugu": "హోమ్",
        "Marathi": "होम",
        "Bengali": "হোম",
        "Gujarati": "ઘર",
        "Punjabi": "ਘਰ",
        "Malayalam": "ഹോം",
        "Odia": "ଘର"
    },
    "Community": {
        "English": "Community",
        "Hindi": "समुदाय",
        "Kannada": "ಸಮುದಾಯ",
        "Tamil": "சமூகம்",
        "Telugu": "సంఘం",
        "Marathi": "समुदाय",
        "Bengali": "সম্প্রদায়",
        "Gujarati": "સમુદાય",
        "Punjabi": "ਭਾਈਚਾਰਾ",
        "Malayalam": "കമ്മ്യൂണിറ്റി",
        "Odia": "ସମ୍ପ୍ରଦାୟ"
    },
    "My Library": {
        "English": "My Library",
        "Hindi": "मेरी लाइब्रेरी",
        "Kannada": "ನನ್ನ ಲೈಬ್ರರಿ",
        "Tamil": "என் நூலகம்",
        "Telugu": "నా లైబ్రరీ",
        "Marathi": "माझी लायब्ररी",
        "Bengali": "আমার লাইব্রেরি",
        "Gujarati": "મારી લાઈબ્રେରી",
        "Punjabi": "ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ",
        "Malayalam": "എന്റെ ലൈബ്രറി",
        "Odia": "ମୋର ଲାଇବ୍ରେରୀ"
    },
    "New Folder": {
        "English": "New Folder", "Hindi": "नया फ़ोल्डर", "Kannada": "ಹೊಸ ಫೋಲ್ಡರ್",
        "Tamil": "புதிய கோப்புறை", "Telugu": "కొత్త ఫోల్డర్", "Marathi": "नवीन फोल्डर",
        "Bengali": "নতুন ফোল্ডার", "Gujarati": "નવું ફોલ્ડર", "Punjabi": "ਨਵਾਂ ਫੋਲਡਰ",
        "Malayalam": "പുതിയ ഫോൾഡർ", "Odia": "ନୂତନ ଫୋଲଡର"
    },
    "Create New": {
        "English": "Create New", "Hindi": "नया बनाएं", "Kannada": "ಹೊಸದಾಗಿ ರಚಿಸಿ",
        "Tamil": "புதியதை உருவாக்கு", "Telugu": "కొత్తది సృష్టించు", "Marathi": "नवीन तयार करा",
        "Bengali": "নতুন তৈরি করুন", "Gujarati": "નવું બનાવો", "Punjabi": "ਨਵਾਂ ਬਣਾਓ",
        "Malayalam": "പുതിയത് സൃഷ്ടിക്കുക", "Odia": "ନୂତନ ତିଆରି କର"
    },
    "Teacher": {
        "English": "Teacher", "Hindi": "शिक्षक", "Kannada": "ಶಿಕ್ಷಕ",
        "Tamil": "ஆசிரியர்", "Telugu": "ఉపాధ్యాయుడు", "Marathi": "शिक्षक",
        "Bengali": "শিক্ষক", "Gujarati": "શિક્ષક", "Punjabi": "ਅਧਿਆਪਕ",
        "Malayalam": "അധ്യാപകൻ", "Odia": "ଶିକ୍ଷକ"
    },
    "Finish your Profile": {
        "English": "Finish your Profile",
        "Hindi": "अपनी प्रोफ़ाइल पूरी करें",
        "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ",
        "Tamil": "உங்கள் சுயவிவரத்தை முடிக்கவும்",
        "Telugu": "మీ ప్రొఫైల్‌ను పూర్తి చేయండి",
        "Marathi": "तुमची प्रोफाईल पूर्ण करा",
        "Bengali": "আপনার প্রোফাইল সম্পন্ন করুন",
        "Gujarati": "તમારી પ્રોફાઇલ પૂર્ણ કરો",
        "Punjabi": "ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ",
        "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കുക",
        "Odia": "ଆପଣଙ୍କର ପ୍ରୋଫାଇଲ୍ ସମାପ୍ତ କରନ୍ତୁ"
    },
    "Enter Community": {
        "English": "Enter Community", "Hindi": "समुदाय में प्रवेश करें", "Kannada": "ಸಮುದಾಯಕ್ಕೆ ಪ್ರವೇಶಿಸಿ",
        "Tamil": "சமூகத்தில் நுழையவும்", "Telugu": "సంఘంలో ప్రవేశించండి", "Marathi": "समुदायात प्रवेश करा",
        "Bengali": "সম্প্রদায়ে প্রবেশ করুন", "Gujarati": "સમુદાયમાં પ્રવેશ કરો", "Punjabi": "ਭਾਈਚਾਰੇ ਵਿੱਚ ਦਾਖ਼ਲ ਹੋਵੋ",
        "Malayalam": "കമ്മ്യൂണിറ്റിയിലേക്ക് പ്രവേശിക്കുക", "Odia": "ସମ୍ପ୍ରଦାୟରେ ପ୍ରବେଶ କରନ୍ତୁ"
    },
    "Choose your language": {
        "English": "Choose your language", "Hindi": "अपनी भाषा चुनें", "Kannada": "ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        "Tamil": "உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்", "Telugu": "మీ భాషను ఎంచుకోండి", "Marathi": "तुमची भाषा निवडा",
        "Bengali": "আপনার ভাষা নির্বাচন করুন", "Gujarati": "તમારી ભાષા પસંદ કરો", "Punjabi": "ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ",
        "Malayalam": "നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക", "Odia": "ଆପଣଙ୍କ ଭାଷା ବାଛନ୍ତୁ"
    },
    "What You Teach": {
        "English": "What You Teach", "Hindi": "आप क्या पढ़ाते हैं", "Kannada": "ನೀವು ಏನು ಕಲಿಸುತ್ತೀರಿ",
        "Tamil": "நீங்கள் என்ன கற்பிக்கிறீர்கள்", "Telugu": "మీరు ఏమి బోధిస్తారు", "Marathi": "तुम्ही काय शिकवता",
        "Bengali": "আপনি কী পড়ান", "Gujarati": "તમે શું ભણાવો છો", "Punjabi": "ਤੁਸੀਂ ਕੀ ਪੜ੍ਹਾਉਂਦੇ ਹੋ",
        "Malayalam": "നിങ്ങൾ എന്താണ് പഠിപ്പിക്കുന്നത്", "Odia": "ଆପଣ କ'ଣ ପଢ଼ାନ୍ତି"
    },
    "Your Subjects & Classes": {
        "English": "Your Subjects & Classes", "Hindi": "आपके विषय और कक्षाएं", "Kannada": "ನಿಮ್ಮ ವಿಷಯಗಳು ಮತ್ತು ತರಗತಿಗಳು",
        "Tamil": "உங்கள் பாடங்கள் & வகுப்புகள்", "Telugu": "మీ విషయాలు & తరగతులు", "Marathi": "तुमचे विषय आणि वर्ग",
        "Bengali": "আপনার বিষয় ও ক্লাস", "Gujarati": "તમારા વિષયો અને વર્ગો", "Punjabi": "ਤੁਹਾਡੇ ਵਿਸ਼ੇ ਅਤੇ ਜਮਾਤਾਂ",
        "Malayalam": "നിങ്ങളുടെ വിഷയങ്ങളും ക്ലാസുകളും", "Odia": "ଆପଣଙ୍କର ବିଷୟ ଏବଂ ଶ୍ରେଣୀ"
    },
    "About You": {
        "English": "About You", "Hindi": "आपके बारे में", "Kannada": "ನಿಮ್ಮ ಬಗ್ಗೆ",
        "Tamil": "உங்களைப் பற்றி", "Telugu": "మీ గురించి", "Marathi": "तुमच्याबद्दल",
        "Bengali": "আপনার সম্পর্কে", "Gujarati": "તમારા વિશે", "Punjabi": "ਤੁਹਾਡੇ ਬਾਰੇ",
        "Malayalam": "നിങ്ങളെ കുറിച്ച്", "Odia": "ଆପଣଙ୍କ ବିଷୟରେ"
    },
    "Next Step": {
        "English": "Next Step", "Hindi": "अगला चरण", "Kannada": "ಮುಂದಿನ ಹಂತ",
        "Tamil": "அடுத்த படி", "Telugu": "తదుపరి దశ", "Marathi": "पुढचा टप्पा",
        "Bengali": "পরবর্তী ধাপ", "Gujarati": "આગળનું પગલું", "Punjabi": "ਅਗਲਾ ਕਦਮ",
        "Malayalam": "അടുത്ത ഘട്ടം", "Odia": "ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ"
    },
    "Back": {
        "English": "Back", "Hindi": "वापस", "Kannada": "ಹಿಂದೆ",
        "Tamil": "பின்", "Telugu": "వెనుకకు", "Marathi": "मागे",
        "Bengali": "পিছনে", "Gujarati": "પાછળ", "Punjabi": "ਪਿੱਛੇ",
        "Malayalam": "പിന്നോട്ട്", "Odia": "ପଛକୁ"
    },
    "Skip for now": {
        "English": "Skip for now", "Hindi": "अभी छोड़ें", "Kannada": "ಸದ್ಯಕ್ಕೆ ಬಿಡಿ",
        "Tamil": "இப்போது தவிர்", "Telugu": "ఇప్పటికి వదిలేయండి", "Marathi": "आत्ता सोडा",
        "Bengali": "এখন এড়িয়ে যান", "Gujarati": "હમણાં છોડો", "Punjabi": "ਹੁਣ ਛੱਡੋ",
        "Malayalam": "ഇപ്പോൾ ഒഴിവാക്കുക", "Odia": "ବର୍ତ୍ତମାନ ଛାଡନ୍ତୁ"
    },
    "Continue": {
        "English": "Continue", "Hindi": "जारी रखें", "Kannada": "ಮುಂದುವರಿಸಿ",
        "Tamil": "தொடரவும்", "Telugu": "కొనసాగించండి", "Marathi": "सुरू ठेवा",
        "Bengali": "চালিয়ে যান", "Gujarati": "ચાલુ રાખો", "Punjabi": "ਜਾਰੀ ਰੱਖੋ",
        "Malayalam": "തുടരുക", "Odia": "ଜାରି ରଖନ୍ତୁ"
    },
    // Phase 3/6 (2026-04-24) — sidebar group headers + header affordances
    "Create": {
        "English": "Create", "Hindi": "बनाएँ", "Kannada": "ರಚಿಸಿ",
        "Tamil": "உருவாக்கவும்", "Telugu": "సృష్టించండి", "Marathi": "तयार करा",
        "Bengali": "তৈরি করুন", "Gujarati": "બનાવો", "Punjabi": "ਬਣਾਓ",
        "Malayalam": "സൃഷ്ടിക്കുക", "Odia": "ତିଆରି କରନ୍ତୁ"
    },
    "Assess": {
        "English": "Assess", "Hindi": "आकलन", "Kannada": "ಮೌಲ್ಯಮಾಪನ",
        "Tamil": "மதிப்பீடு", "Telugu": "మూల్యాంకనం", "Marathi": "मूल्यमापन",
        "Bengali": "মূল্যায়ন", "Gujarati": "મૂલ્યાંકન", "Punjabi": "ਮੁਲਾਂਕਣ",
        "Malayalam": "മൂല്യനിർണ്ണയം", "Odia": "ମୂଲ୍ୟାଙ୍କନ"
    },
    "Ask": {
        "English": "Ask", "Hindi": "पूछें", "Kannada": "ಕೇಳಿ",
        "Tamil": "கேள்", "Telugu": "అడగండి", "Marathi": "विचारा",
        "Bengali": "জিজ্ঞাসা", "Gujarati": "પૂછો", "Punjabi": "ਪੁੱਛੋ",
        "Malayalam": "ചോദിക്കൂ", "Odia": "ପଚାରନ୍ତୁ"
    },
    "My work": {
        "English": "My work", "Hindi": "मेरा काम", "Kannada": "ನನ್ನ ಕೆಲಸ",
        "Tamil": "என் வேலை", "Telugu": "నా పని", "Marathi": "माझे काम",
        "Bengali": "আমার কাজ", "Gujarati": "મારું કામ", "Punjabi": "ਮੇਰਾ ਕੰਮ",
        "Malayalam": "എന്റെ ജോലി", "Odia": "ମୋର କାମ"
    },
    "Account": {
        "English": "Account", "Hindi": "खाता", "Kannada": "ಖಾತೆ",
        "Tamil": "கணக்கு", "Telugu": "ఖాతా", "Marathi": "खाते",
        "Bengali": "অ্যাকাউন্ট", "Gujarati": "એકાઉન્ટ", "Punjabi": "ਖਾਤਾ",
        "Malayalam": "അക്കൗണ്ട്", "Odia": "ଖାତା"
    },
    "Search": {
        "English": "Search", "Hindi": "खोजें", "Kannada": "ಹುಡುಕಿ",
        "Tamil": "தேடு", "Telugu": "శోధించండి", "Marathi": "शोधा",
        "Bengali": "অনুসন্ধান", "Gujarati": "શોધો", "Punjabi": "ਖੋਜੋ",
        "Malayalam": "തിരയുക", "Odia": "ଖୋଜନ୍ତୁ"
    },
    "Search tools, pages, actions…": {
        "English": "Search tools, pages, actions…", "Hindi": "टूल्स, पेज, क्रियाएँ खोजें…", "Kannada": "ಪರಿಕರಗಳು, ಪುಟಗಳು, ಕ್ರಿಯೆಗಳನ್ನು ಹುಡುಕಿ…",
        "Tamil": "கருவிகள், பக்கங்கள், செயல்கள் தேடு…", "Telugu": "టూల్స్, పేజీలు, చర్యలు శోధించండి…", "Marathi": "टूल्स, पाने, क्रिया शोधा…",
        "Bengali": "টুল, পেজ, অ্যাকশন অনুসন্ধান করুন…", "Gujarati": "ટૂલ્સ, પેજ, ક્રિયાઓ શોધો…", "Punjabi": "ਟੂਲ, ਪੰਨੇ, ਕਾਰਵਾਈਆਂ ਖੋਜੋ…",
        "Malayalam": "ടൂളുകൾ, പേജുകൾ, ആക്ഷനുകൾ തിരയുക…", "Odia": "ଟୁଲ୍ସ, ପୃଷ୍ଠା, କାର୍ଯ୍ୟ ଖୋଜନ୍ତୁ…"
    },
    "No matches. Try a different word.": {
        "English": "No matches. Try a different word.", "Hindi": "कोई मेल नहीं। दूसरा शब्द आज़माएँ।", "Kannada": "ಯಾವುದೇ ಹೊಂದಿಕೆ ಇಲ್ಲ. ಬೇರೆ ಪದವನ್ನು ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "பொருத்தங்கள் இல்லை. வேறு சொல்லை முயற்சிக்கவும்.", "Telugu": "సరిపోలికలు లేవు. వేరే పదాన్ని ప్రయత్నించండి.", "Marathi": "जुळण्या नाहीत. दुसरा शब्द वापरून पहा.",
        "Bengali": "কোনো মিল নেই। অন্য শব্দ চেষ্টা করুন।", "Gujarati": "કોઈ મેળ નથી. બીજો શબ્દ અજમાવો.", "Punjabi": "ਕੋਈ ਮੇਲ ਨਹੀਂ। ਦੂਜਾ ਸ਼ਬਦ ਅਜ਼ਮਾਓ।",
        "Malayalam": "പൊരുത്തങ്ങളില്ല. മറ്റൊരു വാക്ക് പരീക്ഷിക്കുക.", "Odia": "କୌଣସି ମେଳ ନାହିଁ। ଅନ୍ୟ ଶବ୍ଦ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Change language": {
        "English": "Change language", "Hindi": "भाषा बदलें", "Kannada": "ಭಾಷೆ ಬದಲಾಯಿಸಿ",
        "Tamil": "மொழி மாற்று", "Telugu": "భాష మార్చండి", "Marathi": "भाषा बदला",
        "Bengali": "ভাষা পরিবর্তন করুন", "Gujarati": "ભાષા બદલો", "Punjabi": "ਭਾਸ਼ਾ ਬਦਲੋ",
        "Malayalam": "ഭാഷ മാറ്റുക", "Odia": "ଭାଷା ବଦଳାନ୍ତୁ"
    },
    "Primary navigation": {
        "English": "Primary navigation", "Hindi": "मुख्य नेविगेशन", "Kannada": "ಪ್ರಾಥಮಿಕ ನ್ಯಾವಿಗೇಶನ್",
        "Tamil": "முதன்மை வழிசெலுத்தல்", "Telugu": "ప్రాథమిక నావిగేషన్", "Marathi": "मुख्य नेव्हिगेशन",
        "Bengali": "প্রাথমিক নেভিগেশন", "Gujarati": "પ્રાથમિક નેવિગેશન", "Punjabi": "ਮੁੱਖ ਨੇਵੀਗੇਸ਼ਨ",
        "Malayalam": "പ്രാഥമിക നാവിഗേഷൻ", "Odia": "ପ୍ରାଥମିକ ନେଭିଗେସନ୍"
    },
    // Phase 7 (2026-04-24) — Trust layer
    "Example": {
        "English": "Example", "Hindi": "उदाहरण", "Kannada": "ಉದಾಹರಣೆ",
        "Tamil": "உதாரணம்", "Telugu": "ఉదాహరణ", "Marathi": "उदाहरण",
        "Bengali": "উদাহরণ", "Gujarati": "ઉદાહરણ", "Punjabi": "ਉਦਾਹਰਣ",
        "Malayalam": "ഉദാഹരണം", "Odia": "ଉଦାହରଣ"
    },
    // ==================================================================
    // i18n-completeness (2026-04-25) — every t() call resolves to a
    // native-script translation in all 11 supported languages. No more
    // English fallbacks for sidebar/palette/empty-state.
    // ==================================================================
    "Quiz Generator": {
        "English": "Quiz Generator", "Hindi": "क्विज़ जेनरेटर", "Kannada": "ಪರೀಕ್ಷೆ ಜನರೇಟರ್",
        "Tamil": "வினாடி வினா உருவாக்கி", "Telugu": "క్విజ్ జనరేటర్", "Marathi": "क्विझ जनरेटर",
        "Bengali": "কুইজ জেনারেটর", "Gujarati": "ક્વિઝ જનરેટર", "Punjabi": "ਕਵਿਜ਼ ਜਨਰੇਟਰ",
        "Malayalam": "ക്വിസ് ജനറേറ്റർ", "Odia": "କୁଇଜ୍ ଜେନେରେଟର"
    },
    "Worksheet Wizard": {
        "English": "Worksheet Wizard", "Hindi": "वर्कशीट विज़ार्ड", "Kannada": "ವರ್ಕ್‌ಶೀಟ್ ವಿಜಾರ್ಡ್",
        "Tamil": "பணித்தாள் வழிகாட்டி", "Telugu": "వర్క్‌షీట్ విజార్డ్", "Marathi": "वर्कशीट विझार्ड",
        "Bengali": "ওয়ার্কশীট উইজার্ড", "Gujarati": "વર્કશીટ વિઝાર્ડ", "Punjabi": "ਵਰਕਸ਼ੀਟ ਵਿਜ਼ਾਰਡ",
        "Malayalam": "വർക്ക്‌ഷീറ്റ് വിസാർഡ്", "Odia": "ୱର୍କଶିଟ୍ ୱିଜାର୍ଡ"
    },
    // SaaS-convention transliteration (matches Visual Aid Designer / Content Creator
    // pattern in lines 232-242). "मूल्यांकन स्कैनर" is the dictionary literal but
    // Indian teachers commonly say "असेसमेंट" in code-mixed speech and the sidebar
    // chip needs to fit in a narrow column on mobile. Keeping transliterations
    // short + recognizable.
    "Assessment Scanner": {
        "English": "Assessment Scanner", "Hindi": "असेसमेंट स्कैनर", "Kannada": "ಅಸೆಸ್ಮೆಂಟ್ ಸ್ಕ್ಯಾನರ್",
        "Tamil": "அசெஸ்மென்ட் ஸ்கேனர்", "Telugu": "అసెస్‌మెంట్ స్కానర్", "Marathi": "असेसमेंट स्कॅनर",
        "Bengali": "অ্যাসেসমেন্ট স্ক্যানার", "Gujarati": "અસેસમેન્ટ સ્કેનર", "Punjabi": "ਅਸੈਸਮੈਂਟ ਸਕੈਨਰ",
        "Malayalam": "അസെസ്മെന്റ് സ്കാനർ", "Odia": "ଆସେସମେଣ୍ଟ ସ୍କାନର"
    },
    // Tool-name transliterations: Indian SaaS convention. Real teachers
    // type "विज़ुअल एड", "कंटेंट क्रिएटर", "वर्चुअल फील्ड ट्रिप",
    // "टीचर ट्रेनिंग" — not the dictionary-literal renderings.
    "Visual Aid Designer": {
        "English": "Visual Aid Designer", "Hindi": "विज़ुअल एड डिज़ाइनर", "Kannada": "ವಿಷುಯಲ್ ಏಡ್ ಡಿಸೈನರ್",
        "Tamil": "விஷுவல் எய்ட் டிசைனர்", "Telugu": "విజువల్ ఎయిడ్ డిజైనర్", "Marathi": "व्हिज्युअल एड डिझायनर",
        "Bengali": "ভিজ্যুয়াল এইড ডিজাইনার", "Gujarati": "વિઝ્યુઅલ એઇડ ડિઝાઇનર", "Punjabi": "ਵਿਜ਼ੁਅਲ ਏਡ ਡਿਜ਼ਾਈਨਰ",
        "Malayalam": "വിഷ്വൽ എയ്ഡ് ഡിസൈനർ", "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍ ଡିଜାଇନର"
    },
    "Content Creator": {
        "English": "Content Creator", "Hindi": "कंटेंट क्रिएटर", "Kannada": "ಕಂಟೆಂಟ್ ಕ್ರಿಯೇಟರ್",
        "Tamil": "கண்டென்ட் கிரியேட்டர்", "Telugu": "కంటెంట్ క్రియేటర్", "Marathi": "कंटेंट क्रिएटर",
        "Bengali": "কন্টেন্ট ক্রিয়েটর", "Gujarati": "કન્ટેન્ટ ક્રિએટર", "Punjabi": "ਕੰਟੈਂਟ ਕ੍ਰਿਏਟਰ",
        "Malayalam": "കണ്ടന്റ് ക്രിയേറ്റർ", "Odia": "କଣ୍ଟେଣ୍ଟ କ୍ରିଏଟର"
    },
    "Rubric Generator": {
        "English": "Rubric Generator", "Hindi": "रूब्रिक जेनरेटर", "Kannada": "ರೂಬ್ರಿಕ್ ಜನರೇಟರ್",
        "Tamil": "மதிப்பீட்டு அளவுகோல் உருவாக்கி", "Telugu": "రూబ్రిక్ జనరేటర్", "Marathi": "रुब्रिक जनरेटर",
        "Bengali": "রুব্রিক জেনারেটর", "Gujarati": "રૂબ્રિક જનરેટર", "Punjabi": "ਰੁਬਰਿਕ ਜਨਰੇਟਰ",
        "Malayalam": "റൂബ്രിക് ജനറേറ്റർ", "Odia": "ରୁବ୍ରିକ୍ ଜେନେରେଟର"
    },
    "Exam Paper": {
        "English": "Exam Paper", "Hindi": "परीक्षा पेपर", "Kannada": "ಪರೀಕ್ಷೆ ಪತ್ರಿಕೆ",
        "Tamil": "தேர்வுத்தாள்", "Telugu": "పరీక్ష పేపర్", "Marathi": "परीक्षा पेपर",
        "Bengali": "পরীক্ষার পেপার", "Gujarati": "પરીક્ષા પેપર", "Punjabi": "ਪ੍ਰੀਖਿਆ ਪੇਪਰ",
        "Malayalam": "പരീക്ഷാ പേപ്പർ", "Odia": "ପରୀକ୍ଷା ପତ୍ର"
    },
    "Video Storyteller": {
        "English": "Video Storyteller", "Hindi": "वीडियो स्टोरीटेलर", "Kannada": "ವೀಡಿಯೋ ಕಥೆಗಾರ",
        "Tamil": "வீடியோ கதைசொல்லி", "Telugu": "వీడియో కథకుడు", "Marathi": "व्हिडिओ कथाकार",
        "Bengali": "ভিডিও গল্পকার", "Gujarati": "વિડિઓ વાર્તાકાર", "Punjabi": "ਵੀਡੀਓ ਕਹਾਣੀਕਾਰ",
        "Malayalam": "വീഡിയോ കഥാകാരൻ", "Odia": "ଭିଡିଓ କାହାଣୀକାର"
    },
    "Virtual Field Trip": {
        // "आभासी क्षेत्र यात्रा" reads as "virtual zone journey" — 1990s
        // textbook style. Real teachers say "वर्चुअल फील्ड ट्रिप".
        "English": "Virtual Field Trip", "Hindi": "वर्चुअल फील्ड ट्रिप", "Kannada": "ವರ್ಚುಯಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್",
        "Tamil": "வர்ச்சுவல் ஃபீல்ட் டிரிப்", "Telugu": "వర్చువల్ ఫీల్డ్ ట్రిప్", "Marathi": "व्हर्च्युअल फील्ड ट्रिप",
        "Bengali": "ভার্চুয়াল ফিল্ড ট্রিপ", "Gujarati": "વર્ચ્યુઅલ ફિલ્ડ ટ્રિપ", "Punjabi": "ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ",
        "Malayalam": "വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്", "Odia": "ଭର୍ଚୁଆଲ ଫିଲ୍ଡ ଟ୍ରିପ"
    },
    "Teacher Training": {
        "English": "Teacher Training", "Hindi": "टीचर ट्रेनिंग", "Kannada": "ಟೀಚರ್ ಟ್ರೈನಿಂಗ್",
        "Tamil": "டீச்சர் ட்ரெய்னிங்", "Telugu": "టీచర్ ట్రైనింగ్", "Marathi": "टीचर ट्रेनिंग",
        "Bengali": "টিচার ট্রেনিং", "Gujarati": "ટીચર ટ્રેનિંગ", "Punjabi": "ਟੀਚਰ ਟ੍ਰੇਨਿੰਗ",
        "Malayalam": "ടീച്ചർ ട്രൈനിംഗ്", "Odia": "ଟିଚର ଟ୍ରେନିଂ"
    },
    "Instant Answer": {
        "English": "Instant Answer", "Hindi": "तुरंत उत्तर", "Kannada": "ತತ್‌ಕ್ಷಣದ ಉತ್ತರ",
        "Tamil": "உடனடி பதில்", "Telugu": "తక్షణ సమాధానం", "Marathi": "त्वरित उत्तर",
        "Bengali": "তাত্ক্ষণিক উত্তর", "Gujarati": "તાત્કાલિક જવાબ", "Punjabi": "ਤੁਰੰਤ ਜਵਾਬ",
        "Malayalam": "തൽക്ഷണ ഉത്തരം", "Odia": "ତତ୍‌କ୍ଷଣାତ୍ ଉତ୍ତର"
    },
    "Messages": {
        "English": "Messages", "Hindi": "संदेश", "Kannada": "ಸಂದೇಶಗಳು",
        "Tamil": "செய்திகள்", "Telugu": "సందేశాలు", "Marathi": "संदेश",
        "Bengali": "বার্তা", "Gujarati": "સંદેશા", "Punjabi": "ਸੁਨੇਹੇ",
        "Malayalam": "സന്ദേശങ്ങൾ", "Odia": "ସନ୍ଦେଶ"
    },
    "Impact": {
        "English": "Impact", "Hindi": "प्रभाव", "Kannada": "ಪ್ರಭಾವ",
        "Tamil": "தாக்கம்", "Telugu": "ప్రభావం", "Marathi": "प्रभाव",
        "Bengali": "প্রভাব", "Gujarati": "પ્રભાવ", "Punjabi": "ਪ੍ਰਭਾਵ",
        "Malayalam": "സ്വാധീനം", "Odia": "ପ୍ରଭାବ"
    },
    "Notifications": {
        "English": "Notifications", "Hindi": "सूचनाएँ", "Kannada": "ಅಧಿಸೂಚನೆಗಳು",
        "Tamil": "அறிவிப்புகள்", "Telugu": "నోటిఫికేషన్లు", "Marathi": "सूचना",
        "Bengali": "বিজ্ঞপ্তি", "Gujarati": "સૂચનાઓ", "Punjabi": "ਨੋਟੀਫਿਕੇਸ਼ਨ",
        "Malayalam": "അറിയിപ്പുകൾ", "Odia": "ବିଜ୍ଞପ୍ତି"
    },
    "My Profile": {
        "English": "My Profile", "Hindi": "मेरी प्रोफ़ाइल", "Kannada": "ನನ್ನ ಪ್ರೊಫೈಲ್",
        "Tamil": "என் சுயவிவரம்", "Telugu": "నా ప్రొఫైల్", "Marathi": "माझी प्रोफाइल",
        "Bengali": "আমার প্রোফাইল", "Gujarati": "મારી પ્રોફાઇલ", "Punjabi": "ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ",
        "Malayalam": "എന്റെ പ്രൊഫൈൽ", "Odia": "ମୋର ପ୍ରୋଫାଇଲ୍"
    },
    "Settings": {
        "English": "Settings", "Hindi": "सेटिंग्स", "Kannada": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
        "Tamil": "அமைப்புகள்", "Telugu": "సెట్టింగ్‌లు", "Marathi": "सेटिंग्ज",
        "Bengali": "সেটিংস", "Gujarati": "સેટિંગ્સ", "Punjabi": "ਸੈਟਿੰਗਾਂ",
        "Malayalam": "ക്രമീകരണങ്ങൾ", "Odia": "ସେଟିଂସ"
    },
    "Upgrade": {
        "English": "Upgrade", "Hindi": "अपग्रेड करें", "Kannada": "ಅಪ್‌ಗ್ರೇಡ್",
        "Tamil": "மேம்படுத்து", "Telugu": "అప్‌గ్రేడ్", "Marathi": "अपग्रेड करा",
        "Bengali": "আপগ্রেড", "Gujarati": "અપગ્રેડ", "Punjabi": "ਅਪਗ੍ਰੇਡ",
        "Malayalam": "അപ്‌ഗ്രേഡ്", "Odia": "ଅପଗ୍ରେଡ୍"
    },
    // === Plan tier display names ===
    // NOTE: "Free", "Pro", "School Gold", "School Premium" already defined
    // further down (pricing-page section, ~line 2328). Reused by plan-badge
    // and usage page via t(PLAN_DISPLAY_NAMES[plan]).
    "Current plan:": {
        "English": "Current plan:", "Hindi": "वर्तमान योजना:", "Kannada": "ಪ್ರಸ್ತುತ ಯೋಜನೆ:",
        "Tamil": "தற்போதைய திட்டம்:", "Telugu": "ప్రస్తుత ప్లాన్:", "Marathi": "वर्तमान योजना:",
        "Bengali": "বর্তমান প্ল্যান:", "Gujarati": "વર્તમાન યોજના:", "Punjabi": "ਮੌਜੂਦਾ ਯੋਜਨਾ:",
        "Malayalam": "നിലവിലെ പ്ലാൻ:", "Odia": "ବର୍ତ୍ତମାନ ଯୋଜନା:"
    },
    "Manage subscription.": {
        "English": "Manage subscription.", "Hindi": "सदस्यता प्रबंधित करें।", "Kannada": "ಚಂದಾದಾರಿಕೆಯನ್ನು ನಿರ್ವಹಿಸಿ.",
        "Tamil": "சந்தாவை நிர்வகி.", "Telugu": "సబ్‌స్క్రిప్షన్‌ను నిర్వహించండి.", "Marathi": "सदस्यता व्यवस्थापित करा.",
        "Bengali": "সাবস্ক্রিপশন পরিচালনা করুন।", "Gujarati": "સબ્સ્ક્રિપ્શન મેનેજ કરો.", "Punjabi": "ਗਾਹਕੀ ਪ੍ਰਬੰਧਿਤ ਕਰੋ।",
        "Malayalam": "സബ്സ്ക്രിപ്ഷൻ കൈകാര്യം ചെയ്യുക.", "Odia": "ସବସ୍କ୍ରିପ୍ସନ୍ ପରିଚାଳନା କରନ୍ତୁ।"
    },
    // === Teacher Training page i18n ===
    "Your Question or Challenge": {
        "English": "Your Question or Challenge", "Hindi": "आपका प्रश्न या चुनौती", "Kannada": "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಅಥವಾ ಸವಾಲು",
        "Tamil": "உங்கள் கேள்வி அல்லது சவால்", "Telugu": "మీ ప్రశ్న లేదా సవాలు", "Marathi": "तुमचा प्रश्न किंवा आव्हान",
        "Bengali": "আপনার প্রশ্ন বা চ্যালেঞ্জ", "Gujarati": "તમારો પ્રશ્ન અથવા પડકાર", "Punjabi": "ਤੁਹਾਡਾ ਸਵਾਲ ਜਾਂ ਚੁਣੌਤੀ",
        "Malayalam": "നിങ്ങളുടെ ചോദ്യം അല്ലെങ്കിൽ വെല്ലുവിളി", "Odia": "ଆପଣଙ୍କ ପ୍ରଶ୍ନ କିମ୍ବା ଚ୍ୟାଲେଞ୍ଜ"
    },
    "Quick Ideas": {
        "English": "Quick Ideas", "Hindi": "त्वरित सुझाव", "Kannada": "ತ್ವರಿತ ಆಲೋಚನೆಗಳು",
        "Tamil": "விரைவு யோசனைகள்", "Telugu": "త్వరిత ఆలోచనలు", "Marathi": "जलद कल्पना",
        "Bengali": "দ্রুত ধারণা", "Gujarati": "ઝડપી વિચારો", "Punjabi": "ਤੇਜ਼ ਵਿਚਾਰ",
        "Malayalam": "പെട്ടെന്നുള്ള ആശയങ്ങൾ", "Odia": "ଶୀଘ୍ର ଧାରଣା"
    },
    "Subject": {
        "English": "Subject", "Hindi": "विषय", "Kannada": "ವಿಷಯ",
        "Tamil": "பாடம்", "Telugu": "విషయం", "Marathi": "विषय",
        "Bengali": "বিষয়", "Gujarati": "વિષય", "Punjabi": "ਵਿਸ਼ਾ",
        "Malayalam": "വിഷയം", "Odia": "ବିଷୟ"
    },
    "Pro Tip": {
        "English": "Pro Tip", "Hindi": "प्रो टिप", "Kannada": "ಪ್ರೊ ಸಲಹೆ",
        "Tamil": "சிறப்புக் குறிப்பு", "Telugu": "ప్రో చిట్కా", "Marathi": "प्रो टीप",
        "Bengali": "প্রো টিপ", "Gujarati": "પ્રો ટિપ", "Punjabi": "ਪ੍ਰੋ ਟਿਪ",
        "Malayalam": "പ്രോ നുറുങ്ങ്", "Odia": "ପ୍ରୋ ଟିପ୍"
    },
    "Mention what you have already tried — VIDYA can suggest the next step instead of repeating the basics.": {
        "English": "Mention what you have already tried — VIDYA can suggest the next step instead of repeating the basics.",
        "Hindi": "बताएं कि आपने पहले से क्या आज़माया है — VIDYA बुनियादी बातें दोहराने के बजाय अगला कदम सुझा सकती है।",
        "Kannada": "ನೀವು ಈಗಾಗಲೇ ಏನು ಪ್ರಯತ್ನಿಸಿದ್ದೀರಿ ಎಂದು ತಿಳಿಸಿ — VIDYA ಮೂಲಭೂತ ಅಂಶಗಳನ್ನು ಪುನರಾವರ್ತಿಸುವ ಬದಲು ಮುಂದಿನ ಹೆಜ್ಜೆಯನ್ನು ಸೂಚಿಸಬಹುದು.",
        "Tamil": "நீங்கள் ஏற்கனவே என்ன முயற்சித்துள்ளீர்கள் என்று குறிப்பிடுங்கள் — VIDYA அடிப்படைகளை மீண்டும் சொல்லாமல் அடுத்த படியை பரிந்துரைக்கும்.",
        "Telugu": "మీరు ఇప్పటికే ఏమి ప్రయత్నించారో పేర్కొనండి — VIDYA ప్రాథమికాలను పునరావృతం చేయకుండా తదుపరి దశను సూచించగలదు.",
        "Marathi": "तुम्ही आधीच काय प्रयत्न केले ते सांगा — VIDYA मूलभूत गोष्टी पुन्हा सांगण्याऐवजी पुढची पायरी सुचवू शकते.",
        "Bengali": "আপনি ইতিমধ্যে কী চেষ্টা করেছেন তা উল্লেখ করুন — VIDYA মৌলিক বিষয়গুলি পুনরাবৃত্তি করার পরিবর্তে পরবর্তী পদক্ষেপ পরামর্শ দিতে পারে।",
        "Gujarati": "તમે પહેલેથી શું પ્રયાસ કર્યો છે તે જણાવો — VIDYA મૂળભૂત બાબતો પુનરાવર્તિત કરવાને બદલે આગળનું પગલું સૂચવી શકે છે.",
        "Punjabi": "ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਪਹਿਲਾਂ ਕੀ ਕੋਸ਼ਿਸ਼ ਕੀਤੀ ਹੈ — VIDYA ਮੂਲ ਗੱਲਾਂ ਦੁਹਰਾਉਣ ਦੀ ਬਜਾਏ ਅਗਲਾ ਕਦਮ ਸੁਝਾ ਸਕਦੀ ਹੈ।",
        "Malayalam": "നിങ്ങൾ ഇതിനകം എന്താണ് ശ്രമിച്ചതെന്ന് പറയുക — VIDYA അടിസ്ഥാന കാര്യങ്ങൾ ആവർത്തിക്കുന്നതിന് പകരം അടുത്ത ഘട്ടം നിർദ്ദേശിക്കാം.",
        "Odia": "ଆପଣ ପୂର୍ବରୁ କଣ ଚେଷ୍ଟା କରିଛନ୍ତି ତାହା ଦର୍ଶାନ୍ତୁ — VIDYA ମୌଳିକ ବିଷୟ ପୁନରାବୃତ୍ତି କରିବା ବଦଳରେ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ ସୂଚାଇ ପାରିବ।"
    },
    "Ask follow-up questions. Each answer can be refined: \"That worked, but what about students who still don't engage?\"": {
        "English": "Ask follow-up questions. Each answer can be refined: \"That worked, but what about students who still don't engage?\"",
        "Hindi": "अनुवर्ती प्रश्न पूछें। हर उत्तर को बेहतर किया जा सकता है: \"वह काम किया, लेकिन उन छात्रों का क्या जो अभी भी शामिल नहीं होते?\"",
        "Kannada": "ಮುಂದಿನ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ. ಪ್ರತಿ ಉತ್ತರವನ್ನೂ ಸುಧಾರಿಸಬಹುದು: \"ಅದು ಕೆಲಸ ಮಾಡಿತು, ಆದರೆ ಇನ್ನೂ ಪಾಲ್ಗೊಳ್ಳದ ವಿದ್ಯಾರ್ಥಿಗಳ ಬಗ್ಗೆ ಏನು?\"",
        "Tamil": "தொடர்ச்சியான கேள்விகளைக் கேளுங்கள். ஒவ்வொரு பதிலையும் சீர்திருத்தலாம்: \"அது வேலை செய்தது, ஆனால் இன்னும் ஈடுபடாத மாணவர்கள் பற்றி என்ன?\"",
        "Telugu": "ఫాలో-అప్ ప్రశ్నలను అడగండి. ప్రతి సమాధానాన్ని మెరుగుపరచవచ్చు: \"అది పని చేసింది, కానీ ఇంకా పాల్గొనని విద్యార్థుల గురించి ఏమిటి?\"",
        "Marathi": "पाठपुरावा प्रश्न विचारा. प्रत्येक उत्तर परिष्कृत केले जाऊ शकते: \"ते काम झाले, पण अजूनही सहभागी न होणाऱ्या विद्यार्थ्यांचे काय?\"",
        "Bengali": "ফলো-আপ প্রশ্ন জিজ্ঞাসা করুন। প্রতিটি উত্তর পরিমার্জিত করা যেতে পারে: \"সেটা কাজ করেছে, কিন্তু যে শিক্ষার্থীরা এখনও জড়িত হয় না তাদের কী হবে?\"",
        "Gujarati": "ફોલો-અપ પ્રશ્નો પૂછો. દરેક જવાબને સુધારી શકાય છે: \"તે કામ કર્યું, પરંતુ જે વિદ્યાર્થીઓ હજુ પણ જોડાતા નથી તેમનું શું?\"",
        "Punjabi": "ਅੱਗੇ ਦੇ ਸਵਾਲ ਪੁੱਛੋ। ਹਰ ਜਵਾਬ ਨੂੰ ਨਿਖਾਰਿਆ ਜਾ ਸਕਦਾ ਹੈ: \"ਉਹ ਕੰਮ ਕੀਤਾ, ਪਰ ਉਹਨਾਂ ਵਿਦਿਆਰਥੀਆਂ ਦਾ ਕੀ ਜੋ ਅਜੇ ਵੀ ਨਹੀਂ ਜੁੜਦੇ?\"",
        "Malayalam": "തുടർ ചോദ്യങ്ങൾ ചോദിക്കുക. ഓരോ ഉത്തരവും പരിഷ്കരിക്കാം: \"അത് പ്രവർത്തിച്ചു, പക്ഷേ ഇപ്പോഴും പങ്കെടുക്കാത്ത വിദ്യാർത്ഥികളെക്കുറിച്ച് എന്ത്?\"",
        "Odia": "ଅନୁସରଣ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ। ପ୍ରତ୍ୟେକ ଉତ୍ତରକୁ ସଂସ୍କରଣ କରାଯାଇପାରେ: \"ଏହା କାମ କଲା, କିନ୍ତୁ ଯେଉଁ ଛାତ୍ରମାନେ ଏବେ ବି ଅଂଶ ନେଉନାହାଁନ୍ତି?\""
    },
    "Share what subject or chapter you are teaching — advice is sharper when the context is concrete.": {
        "English": "Share what subject or chapter you are teaching — advice is sharper when the context is concrete.",
        "Hindi": "बताएं कि आप कौन सा विषय या अध्याय पढ़ा रहे हैं — संदर्भ ठोस होने पर सलाह बेहतर होती है।",
        "Kannada": "ನೀವು ಯಾವ ವಿಷಯ ಅಥವಾ ಅಧ್ಯಾಯವನ್ನು ಕಲಿಸುತ್ತಿದ್ದೀರಿ ಎಂದು ಹಂಚಿಕೊಳ್ಳಿ — ಸಂದರ್ಭ ನಿರ್ದಿಷ್ಟವಾಗಿದ್ದಾಗ ಸಲಹೆ ತೀಕ್ಷ್ಣವಾಗಿರುತ್ತದೆ.",
        "Tamil": "நீங்கள் எந்த பாடம் அல்லது அத்தியாயம் கற்பிக்கிறீர்கள் என்பதைப் பகிர்ந்து கொள்ளுங்கள் — சூழல் உறுதியாக இருக்கும் போது ஆலோசனை கூர்மையாக இருக்கும்.",
        "Telugu": "మీరు ఏ విషయం లేదా అధ్యాయం బోధిస్తున్నారో పంచుకోండి — సందర్భం స్పష్టంగా ఉన్నప్పుడు సలహా మరింత పదునుగా ఉంటుంది.",
        "Marathi": "तुम्ही कोणता विषय किंवा धडा शिकवत आहात ते सांगा — संदर्भ ठोस असल्यास सल्ला अधिक धारदार होतो.",
        "Bengali": "আপনি কোন বিষয় বা অধ্যায় পড়াচ্ছেন তা শেয়ার করুন — প্রসঙ্গ সুনির্দিষ্ট হলে পরামর্শ আরও তীক্ষ্ণ হয়।",
        "Gujarati": "તમે કયો વિષય અથવા પ્રકરણ શીખવી રહ્યા છો તે શેર કરો — સંદર્ભ નક્કર હોય ત્યારે સલાહ વધુ તીક્ષ્ણ હોય છે.",
        "Punjabi": "ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਕਿਹੜਾ ਵਿਸ਼ਾ ਜਾਂ ਅਧਿਆਇ ਪੜ੍ਹਾ ਰਹੇ ਹੋ — ਸੰਦਰਭ ਠੋਸ ਹੋਣ ਉੱਤੇ ਸਲਾਹ ਵਧੇਰੇ ਤਿੱਖੀ ਹੁੰਦੀ ਹੈ।",
        "Malayalam": "നിങ്ങൾ ഏത് വിഷയം അല്ലെങ്കിൽ അധ്യായം പഠിപ്പിക്കുന്നു എന്ന് പങ്കിടുക — സന്ദർഭം ദൃഢമായിരിക്കുമ്പോൾ ഉപദേശം മൂർച്ചയുള്ളതാകുന്നു.",
        "Odia": "ଆପଣ କେଉଁ ବିଷୟ କିମ୍ବା ଅଧ୍ୟାୟ ଶିଖାଉଛନ୍ତି ତାହା ଦର୍ଶାନ୍ତୁ — ପ୍ରସଙ୍ଗ ସ୍ପଷ୍ଟ ହେଲେ ପରାମର୍ଶ ଅଧିକ ତୀକ୍ଷ୍ଣ ହୁଏ।"
    },
    "Be specific about your students' age group and the context (e.g., \"Class 5 students in a rural school\").": {
        "English": "Be specific about your students' age group and the context (e.g., \"Class 5 students in a rural school\").",
        "Hindi": "अपने छात्रों के आयु समूह और संदर्भ के बारे में स्पष्ट रहें (उदा., \"ग्रामीण स्कूल में कक्षा 5 के छात्र\")।",
        "Kannada": "ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿಗಳ ವಯೋಮಾನ ಮತ್ತು ಸಂದರ್ಭದ ಬಗ್ಗೆ ನಿರ್ದಿಷ್ಟವಾಗಿರಿ (ಉದಾ., \"ಗ್ರಾಮೀಣ ಶಾಲೆಯಲ್ಲಿ ೫ನೇ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿಗಳು\").",
        "Tamil": "உங்கள் மாணவர்களின் வயது குழு மற்றும் சூழல் பற்றி குறிப்பிட்டிருங்கள் (எ.கா., \"கிராமப்புற பள்ளியில் வகுப்பு 5 மாணவர்கள்\").",
        "Telugu": "మీ విద్యార్థుల వయస్సు మరియు సందర్భం గురించి స్పష్టంగా ఉండండి (ఉదా., \"గ్రామీణ పాఠశాలలో 5వ తరగతి విద్యార్థులు\").",
        "Marathi": "तुमच्या विद्यार्थ्यांच्या वयोगट आणि संदर्भाबद्दल स्पष्ट रहा (उदा., \"ग्रामीण शाळेतील इयत्ता ५ चे विद्यार्थी\").",
        "Bengali": "আপনার ছাত্রদের বয়স গোষ্ঠী এবং প্রসঙ্গ সম্পর্কে নির্দিষ্ট হন (যেমন, \"গ্রামীণ স্কুলে শ্রেণী ৫ এর ছাত্র\")।",
        "Gujarati": "તમારા વિદ્યાર્થીઓના વય જૂથ અને સંદર્ભ વિશે ચોક્કસ રહો (દા.ત., \"ગ્રામીણ શાળામાં ધોરણ 5 ના વિદ્યાર્થીઓ\").",
        "Punjabi": "ਆਪਣੇ ਵਿਦਿਆਰਥੀਆਂ ਦੇ ਉਮਰ ਸਮੂਹ ਅਤੇ ਸੰਦਰਭ ਬਾਰੇ ਖਾਸ ਰਹੋ (ਉਦਾ., \"ਪੇਂਡੂ ਸਕੂਲ ਵਿੱਚ ਜਮਾਤ 5 ਦੇ ਵਿਦਿਆਰਥੀ\")।",
        "Malayalam": "നിങ്ങളുടെ വിദ്യാർത്ഥികളുടെ പ്രായ ഗ്രൂപ്പിനെയും സന്ദർഭത്തെയും കുറിച്ച് വ്യക്തമായിരിക്കുക (ഉദാ., \"ഗ്രാമീണ സ്കൂളിലെ 5-ാം ക്ലാസ് വിദ്യാർത്ഥികൾ\").",
        "Odia": "ଆପଣଙ୍କ ଛାତ୍ରଙ୍କ ବୟସ ଗୋଷ୍ଠୀ ଏବଂ ପ୍ରସଙ୍ଗ ବିଷୟରେ ନିର୍ଦ୍ଦିଷ୍ଟ ହୁଅନ୍ତୁ (ଉଦା., \"ଗ୍ରାମୀଣ ବିଦ୍ୟାଳୟରେ ୫ମ ଶ୍ରେଣୀର ଛାତ୍ର\")।"
    },
    "Get Advice": {
        "English": "Get Advice", "Hindi": "सलाह प्राप्त करें", "Kannada": "ಸಲಹೆ ಪಡೆಯಿರಿ",
        "Tamil": "ஆலோசனை பெறுங்கள்", "Telugu": "సలహా పొందండి", "Marathi": "सल्ला मिळवा",
        "Bengali": "পরামর্শ নিন", "Gujarati": "સલાહ મેળવો", "Punjabi": "ਸਲਾਹ ਲਓ",
        "Malayalam": "ഉപദേശം നേടുക", "Odia": "ପରାମର୍ଶ ନିଅନ୍ତୁ"
    },
    // === Exam Paper page i18n ===
    "Grade Level": {
        "English": "Grade Level", "Hindi": "कक्षा स्तर", "Kannada": "ತರಗತಿ ಮಟ್ಟ",
        "Tamil": "வகுப்பு நிலை", "Telugu": "తరగతి స్థాయి", "Marathi": "इयत्ता स्तर",
        "Bengali": "শ্রেণি স্তর", "Gujarati": "ધોરણ સ્તર", "Punjabi": "ਜਮਾਤ ਪੱਧਰ",
        "Malayalam": "ക്ലാസ് നില", "Odia": "ଶ୍ରେଣୀ ସ୍ତର"
    },
    "Difficulty": {
        "English": "Difficulty", "Hindi": "कठिनाई", "Kannada": "ಕಷ್ಟ",
        "Tamil": "சிரமம்", "Telugu": "కష్టం", "Marathi": "अडचण",
        "Bengali": "কাঠিন্য", "Gujarati": "મુશ્કેલી", "Punjabi": "ਮੁਸ਼ਕਲ",
        "Malayalam": "ബുദ്ധിമുട്ട്", "Odia": "କଠିନତା"
    },
    "Select subject": {
        "English": "Select subject", "Hindi": "विषय चुनें", "Kannada": "ವಿಷಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        "Tamil": "பாடத்தைத் தேர்ந்தெடுக்கவும்", "Telugu": "విషయాన్ని ఎంచుకోండి", "Marathi": "विषय निवडा",
        "Bengali": "বিষয় নির্বাচন করুন", "Gujarati": "વિષય પસંદ કરો", "Punjabi": "ਵਿਸ਼ਾ ਚੁਣੋ",
        "Malayalam": "വിഷയം തിരഞ്ഞെടുക്കുക", "Odia": "ବିଷୟ ବାଛନ୍ତୁ"
    },
    "e.g. Mathematics, Science, English": {
        "English": "e.g. Mathematics, Science, English", "Hindi": "उदा. गणित, विज्ञान, अंग्रेज़ी", "Kannada": "ಉದಾ. ಗಣಿತ, ವಿಜ್ಞಾನ, ಇಂಗ್ಲಿಷ್",
        "Tamil": "எ.கா. கணிதம், அறிவியல், ஆங்கிலம்", "Telugu": "ఉదా. గణితం, సైన్స్, ఇంగ్లీష్", "Marathi": "उदा. गणित, विज्ञान, इंग्रजी",
        "Bengali": "যেমন: গণিত, বিজ্ঞান, ইংরেজি", "Gujarati": "દા.ત. ગણિત, વિજ્ઞાન, અંગ્રેજી", "Punjabi": "ਉਦਾ. ਗਣਿਤ, ਵਿਗਿਆਨ, ਅੰਗਰੇਜ਼ੀ",
        "Malayalam": "ഉദാ. ഗണിതം, സയൻസ്, ഇംഗ്ലീഷ്", "Odia": "ଯଥା: ଗଣିତ, ବିଜ୍ଞାନ, ଇଂରାଜୀ"
    },
    "e.g. Real Numbers, Polynomials, Triangles": {
        "English": "e.g. Real Numbers, Polynomials, Triangles", "Hindi": "उदा. वास्तविक संख्याएँ, बहुपद, त्रिभुज", "Kannada": "ಉದಾ. ವಾಸ್ತವಿಕ ಸಂಖ್ಯೆಗಳು, ಬಹುಪದಿಗಳು, ತ್ರಿಕೋನಗಳು",
        "Tamil": "எ.கா. மெய் எண்கள், பல்லுறுப்புக்கோவைகள், முக்கோணங்கள்", "Telugu": "ఉదా. వాస్తవ సంఖ్యలు, బహుపదాలు, త్రిభుజాలు", "Marathi": "उदा. वास्तविक संख्या, बहुपदी, त्रिकोण",
        "Bengali": "যেমন: বাস্তব সংখ্যা, বহুপদী, ত্রিভুজ", "Gujarati": "દા.ત. વાસ્તવિક સંખ્યાઓ, બહુપદી, ત્રિકોણ", "Punjabi": "ਉਦਾ. ਅਸਲੀ ਸੰਖਿਆਵਾਂ, ਬਹੁਪਦੀ, ਤ੍ਰਿਭੁਜ",
        "Malayalam": "ഉദാ. യഥാർത്ഥ സംഖ്യകൾ, ബഹുപദങ്ങൾ, ത്രികോണങ്ങൾ", "Odia": "ଯଥା: ବାସ୍ତବ ସଂଖ୍ୟା, ବହୁପଦ, ତ୍ରିଭୁଜ"
    },
    "Getting Advice...": {
        "English": "Getting Advice...", "Hindi": "सलाह प्राप्त की जा रही है...", "Kannada": "ಸಲಹೆ ಪಡೆಯಲಾಗುತ್ತಿದೆ...",
        "Tamil": "ஆலோசனை பெறப்படுகிறது...", "Telugu": "సలహా పొందుతున్నాం...", "Marathi": "सल्ला मिळवत आहे...",
        "Bengali": "পরামর্শ নেওয়া হচ্ছে...", "Gujarati": "સલાહ મેળવી રહ્યા છીએ...", "Punjabi": "ਸਲਾਹ ਲੈ ਰਹੇ ਹਾਂ...",
        "Malayalam": "ഉപദേശം ലഭിക്കുന്നു...", "Odia": "ପରାମର୍ଶ ନେଉଛୁ..."
    },
    "Thinking of some helpful advice...": {
        "English": "Thinking of some helpful advice...", "Hindi": "कुछ उपयोगी सलाह के बारे में सोच रहे हैं...", "Kannada": "ಸಹಾಯಕ ಸಲಹೆಯ ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದೇವೆ...",
        "Tamil": "சில பயனுள்ள ஆலோசனைகளைப் பற்றி யோசிக்கிறோம்...", "Telugu": "సహాయకరమైన సలహా గురించి ఆలోచిస్తున్నాం...", "Marathi": "काही उपयुक्त सल्ल्याचा विचार करत आहे...",
        "Bengali": "কিছু সহায়ক পরামর্শ চিন্তা করছি...", "Gujarati": "કેટલીક ઉપયોગી સલાહ વિચારી રહ્યા છીએ...", "Punjabi": "ਕੁਝ ਮਦਦਗਾਰ ਸਲਾਹ ਬਾਰੇ ਸੋਚ ਰਹੇ ਹਾਂ...",
        "Malayalam": "സഹായകരമായ ഉപദേശം ചിന്തിക്കുന്നു...", "Odia": "କିଛି ସହାୟକ ପରାମର୍ଶ ବିଷୟରେ ଚିନ୍ତା କରୁଛୁ..."
    },
    "Result": {
        "English": "Result", "Hindi": "परिणाम", "Kannada": "ಫಲಿತಾಂಶ",
        "Tamil": "முடிவு", "Telugu": "ఫలితం", "Marathi": "परिणाम",
        "Bengali": "ফলাফল", "Gujarati": "પરિણામ", "Punjabi": "ਨਤੀਜਾ",
        "Malayalam": "ഫലം", "Odia": "ଫଳାଫଳ"
    },
    "AI Coach": {
        "English": "AI Coach", "Hindi": "AI कोच", "Kannada": "AI ಕೋಚ್",
        "Tamil": "AI பயிற்சியாளர்", "Telugu": "AI కోచ్", "Marathi": "AI प्रशिक्षक",
        "Bengali": "AI কোচ", "Gujarati": "AI કોચ", "Punjabi": "AI ਕੋਚ",
        "Malayalam": "AI കോച്ച്", "Odia": "AI କୋଚ୍"
    },
    "Sign in to ask the AI Coach": {
        "English": "Sign in to ask the AI Coach", "Hindi": "AI कोच से पूछने के लिए साइन इन करें", "Kannada": "AI ಕೋಚ್ ಅನ್ನು ಕೇಳಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "AI பயிற்சியாளரிடம் கேட்க உள்நுழைக", "Telugu": "AI కోచ్‌ని అడగడానికి సైన్ ఇన్ చేయండి", "Marathi": "AI कोचला विचारण्यासाठी साइन इन करा",
        "Bengali": "AI কোচকে জিজ্ঞাসা করতে সাইন ইন করুন", "Gujarati": "AI કોચને પૂછવા સાઇન ઇન કરો", "Punjabi": "AI ਕੋਚ ਨੂੰ ਪੁੱਛਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "AI കോച്ചിനോട് ചോദിക്കാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "AI କୋଚ୍‌ଙ୍କୁ ପଚାରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Get advice grounded in pedagogical principles — sign in to ask anything about teaching.": {
        "English": "Get advice grounded in pedagogical principles — sign in to ask anything about teaching.",
        "Hindi": "शैक्षणिक सिद्धांतों पर आधारित सलाह प्राप्त करें — पढ़ाने के बारे में कुछ भी पूछने के लिए साइन इन करें।",
        "Kannada": "ಶಿಕ್ಷಣಶಾಸ್ತ್ರ ತತ್ವಗಳ ಮೇಲೆ ಆಧಾರಿತ ಸಲಹೆ ಪಡೆಯಿರಿ — ಬೋಧನೆಯ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "கல்விசார் கொள்கைகளின் அடிப்படையிலான ஆலோசனை பெறுங்கள் — கற்பித்தல் பற்றி எதையும் கேட்க உள்நுழைக.",
        "Telugu": "బోధనా సూత్రాల ఆధారంగా సలహా పొందండి — బోధన గురించి ఏదైనా అడగడానికి సైన్ ఇన్ చేయండి.",
        "Marathi": "शैक्षणिक तत्त्वांवर आधारित सल्ला मिळवा — अध्यापनाबद्दल काहीही विचारण्यासाठी साइन इन करा.",
        "Bengali": "শিক্ষামূলক নীতির উপর ভিত্তি করে পরামর্শ পান — শিক্ষাদান সম্পর্কে কিছু জিজ্ঞাসা করতে সাইন ইন করুন।",
        "Gujarati": "શૈક્ષણિક સિદ્ધાંતો પર આધારિત સલાહ મેળવો — શિક્ષણ વિશે કંઈપણ પૂછવા સાઇન ઇન કરો.",
        "Punjabi": "ਸਿੱਖਿਆ ਸਿਧਾਂਤਾਂ ਉੱਤੇ ਆਧਾਰਿਤ ਸਲਾਹ ਲਓ — ਸਿਖਾਉਣ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "അധ്യാപന തത്വങ്ങളിൽ അധിഷ്ഠിതമായ ഉപദേശം നേടുക — അധ്യാപനത്തെക്കുറിച്ച് എന്തെങ്കിലും ചോദിക്കാൻ സൈൻ ഇൻ ചെയ്യുക.",
        "Odia": "ଶିକ୍ଷା ତତ୍ତ୍ୱ ଉପରେ ଆଧାରିତ ପରାମର୍ଶ ପାଆନ୍ତୁ — ଶିକ୍ଷାଦାନ ବିଷୟରେ କିଛି ବି ପଚାରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Response language": {
        "English": "Response language", "Hindi": "उत्तर की भाषा", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಭಾಷೆ",
        "Tamil": "பதில் மொழி", "Telugu": "ప్రతిస్పందన భాష", "Marathi": "उत्तराची भाषा",
        "Bengali": "উত্তরের ভাষা", "Gujarati": "જવાબ ભાષા", "Punjabi": "ਜਵਾਬ ਦੀ ਭਾਸ਼ਾ",
        "Malayalam": "ഉത്തര ഭാഷ", "Odia": "ଉତ୍ତର ଭାଷା"
    },
    "min": {
        "English": "min", "Hindi": "न्यूनतम", "Kannada": "ಕನಿಷ್ಠ",
        "Tamil": "குறை", "Telugu": "కనిష్ట", "Marathi": "किमान",
        "Bengali": "ন্যূনতম", "Gujarati": "લઘુત્તમ", "Punjabi": "ਘੱਟ",
        "Malayalam": "കുറഞ്ഞത്", "Odia": "ସର୍ବନିମ୍ନ"
    },
    "Continue your last question": {
        "English": "Continue your last question", "Hindi": "अपना पिछला प्रश्न जारी रखें", "Kannada": "ನಿಮ್ಮ ಕೊನೆಯ ಪ್ರಶ್ನೆಯನ್ನು ಮುಂದುವರಿಸಿ",
        "Tamil": "உங்கள் கடைசி கேள்வியைத் தொடரவும்", "Telugu": "మీ చివరి ప్రశ్నను కొనసాగించండి", "Marathi": "तुमचा शेवटचा प्रश्न सुरू ठेवा",
        "Bengali": "আপনার শেষ প্রশ্ন চালিয়ে যান", "Gujarati": "તમારો છેલ્લો પ્રશ્ન ચાલુ રાખો", "Punjabi": "ਆਪਣਾ ਪਿਛਲਾ ਸਵਾਲ ਜਾਰੀ ਰੱਖੋ",
        "Malayalam": "നിങ്ങളുടെ അവസാന ചോദ്യം തുടരുക", "Odia": "ଆପଣଙ୍କ ଶେଷ ପ୍ରଶ୍ନ ଜାରି ରଖନ୍ତୁ"
    },
    "See an example answer": {
        "English": "See an example answer", "Hindi": "एक उदाहरण उत्तर देखें", "Kannada": "ಉದಾಹರಣೆ ಉತ್ತರವನ್ನು ನೋಡಿ",
        "Tamil": "ஒரு உதாரண பதிலைக் காண்க", "Telugu": "ఒక ఉదాహరణ సమాధానం చూడండి", "Marathi": "एक उदाहरण उत्तर पहा",
        "Bengali": "একটি উদাহরণ উত্তর দেখুন", "Gujarati": "એક ઉદાહરણ જવાબ જુઓ", "Punjabi": "ਇੱਕ ਉਦਾਹਰਣ ਜਵਾਬ ਵੇਖੋ",
        "Malayalam": "ഒരു ഉദാഹരണ ഉത്തരം കാണുക", "Odia": "ଗୋଟିଏ ଉଦାହରଣ ଉତ୍ତର ଦେଖନ୍ତୁ"
    },
    "Tap to expand": {
        "English": "Tap to expand", "Hindi": "विस्तार के लिए टैप करें", "Kannada": "ವಿಸ್ತರಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
        "Tamil": "விரிவாக்க தட்டவும்", "Telugu": "విస్తరించడానికి ట్యాప్ చేయండి", "Marathi": "विस्तार करण्यासाठी टॅप करा",
        "Bengali": "প্রসারিত করতে ট্যাপ করুন", "Gujarati": "વિસ્તારવા માટે ટેપ કરો", "Punjabi": "ਫੈਲਾਉਣ ਲਈ ਟੈਪ ਕਰੋ",
        "Malayalam": "വികസിപ്പിക്കാൻ ടാപ്പ് ചെയ്യുക", "Odia": "ବିସ୍ତାର କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ"
    },
    "Q: How do I keep Class 5 students engaged during a 45-minute lesson?": {
        "English": "Q: How do I keep Class 5 students engaged during a 45-minute lesson?",
        "Hindi": "प्र: 45 मिनट के पाठ के दौरान कक्षा 5 के छात्रों को व्यस्त कैसे रखूँ?",
        "Kannada": "ಪ್ರ: 45 ನಿಮಿಷಗಳ ಪಾಠದ ಸಮಯದಲ್ಲಿ ೫ನೇ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಹೇಗೆ ತೊಡಗಿಸಿಕೊಳ್ಳಬೇಕು?",
        "Tamil": "கே: 45 நிமிட பாடத்தின் போது வகுப்பு 5 மாணவர்களை எப்படி ஈடுபடுத்துவது?",
        "Telugu": "ప్ర: 45 నిమిషాల పాఠం సమయంలో 5వ తరగతి విద్యార్థులను ఎలా నిమగ్నం చేయాలి?",
        "Marathi": "प्र: ४५ मिनिटांच्या पाठात इयत्ता ५ चे विद्यार्थी कसे गुंतवून ठेवायचे?",
        "Bengali": "প্র: 45 মিনিটের পাঠের সময় শ্রেণী 5 এর ছাত্রদের কীভাবে নিযুক্ত রাখব?",
        "Gujarati": "પ્ર: 45 મિનિટના પાઠ દરમિયાન ધોરણ 5 ના વિદ્યાર્થીઓને કેવી રીતે વ્યસ્ત રાખવા?",
        "Punjabi": "ਸ: 45 ਮਿੰਟ ਦੇ ਪਾਠ ਦੌਰਾਨ ਜਮਾਤ 5 ਦੇ ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਕਿਵੇਂ ਜੋੜੀ ਰੱਖਾਂ?",
        "Malayalam": "ചോ: 45 മിനിറ്റ് പാഠത്തിൽ 5-ാം ക്ലാസ് വിദ്യാർത്ഥികളെ എങ്ങനെ ഇടപഴകി നിർത്താം?",
        "Odia": "ପ୍ର: ୪୫ ମିନିଟ୍ ପାଠ ସମୟରେ ୫ମ ଶ୍ରେଣୀର ଛାତ୍ରଙ୍କୁ କିପରି ସମ୍ପୃକ୍ତ ରଖିବି?"
    },
    "VIDYA: Break the lesson into three 15-minute chunks…": {
        "English": "VIDYA: Break the lesson into three 15-minute chunks…",
        "Hindi": "VIDYA: पाठ को तीन 15-मिनट के टुकड़ों में बाँटें…",
        "Kannada": "VIDYA: ಪಾಠವನ್ನು ಮೂರು 15-ನಿಮಿಷದ ತುಂಡುಗಳಾಗಿ ವಿಂಗಡಿಸಿ…",
        "Tamil": "VIDYA: பாடத்தை மூன்று 15-நிமிட பகுதிகளாகப் பிரிக்கவும்…",
        "Telugu": "VIDYA: పాఠాన్ని మూడు 15-నిమిషాల భాగాలుగా విభజించండి…",
        "Marathi": "VIDYA: पाठ तीन १५-मिनिटांच्या तुकड्यांमध्ये विभागा…",
        "Bengali": "VIDYA: পাঠকে তিনটি 15-মিনিটের অংশে ভাগ করুন…",
        "Gujarati": "VIDYA: પાઠને ત્રણ 15-મિનિટના ભાગોમાં વિભાજિત કરો…",
        "Punjabi": "VIDYA: ਪਾਠ ਨੂੰ ਤਿੰਨ 15-ਮਿੰਟ ਦੇ ਹਿੱਸਿਆਂ ਵਿੱਚ ਵੰਡੋ…",
        "Malayalam": "VIDYA: പാഠത്തെ മൂന്ന് 15-മിനിറ്റ് ഭാഗങ്ങളായി വിഭജിക്കുക…",
        "Odia": "VIDYA: ପାଠକୁ ତିନୋଟି ୧୫-ମିନିଟ୍ ଖଣ୍ଡରେ ବିଭକ୍ତ କରନ୍ତୁ…"
    },
    "Pedagogy: Spaced repetition": {
        "English": "Pedagogy: Spaced repetition", "Hindi": "शिक्षाशास्त्र: अंतराल पुनरावृत्ति", "Kannada": "ಶಿಕ್ಷಣಶಾಸ್ತ್ರ: ಅಂತರ ಪುನರಾವರ್ತನೆ",
        "Tamil": "கல்வியியல்: இடைவெளி மீண்டும் பயிற்சி", "Telugu": "బోధన: అంతరాల పునరావృత్తి", "Marathi": "शिक्षणशास्त्र: अंतराल पुनरावृत्ती",
        "Bengali": "শিক্ষাবিজ্ঞান: ব্যবধান পুনরাবৃত্তি", "Gujarati": "શિક્ષણશાસ્ત્ર: અંતરાલ પુનરાવર્તન", "Punjabi": "ਪੈਡਾਗੋਜੀ: ਅੰਤਰਾਲ ਦੁਹਰਾਉ",
        "Malayalam": "ബോധനശാസ്ത്രം: ഇടവേള ആവർത്തനം", "Odia": "ଶିକ୍ଷାଶାସ୍ତ୍ର: ଅନ୍ତରାଳ ପୁନରାବୃତ୍ତି"
    },
    "Save to library": {
        "English": "Save to library", "Hindi": "लाइब्रेरी में सहेजें", "Kannada": "ಲೈಬ್ರರಿಗೆ ಉಳಿಸಿ",
        "Tamil": "நூலகத்தில் சேமி", "Telugu": "లైబ్రరీలో సేవ్ చేయండి", "Marathi": "लायब्ररीत जतन करा",
        "Bengali": "লাইব্রেরিতে সংরক্ষণ করুন", "Gujarati": "લાઇબ્રેરીમાં સાચવો", "Punjabi": "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੇਵ ਕਰੋ",
        "Malayalam": "ലൈബ്രറിയിൽ സംരക്ഷിക്കുക", "Odia": "ଲାଇବ୍ରେରୀରେ ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    "Saved to library": {
        "English": "Saved to library", "Hindi": "लाइब्रेरी में सहेजा गया", "Kannada": "ಲೈಬ್ರರಿಗೆ ಉಳಿಸಲಾಗಿದೆ",
        "Tamil": "நூலகத்தில் சேமிக்கப்பட்டது", "Telugu": "లైబ్రరీకి సేవ్ చేయబడింది", "Marathi": "लायब्ररीत जतन केले",
        "Bengali": "লাইব্রেরিতে সংরক্ষিত", "Gujarati": "લાઇબ્રેરીમાં સાચવ્યું", "Punjabi": "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੇਵ ਕੀਤਾ",
        "Malayalam": "ലൈബ്രറിയിൽ സംരക്ഷിച്ചു", "Odia": "ଲାଇବ୍ରେରୀରେ ସଞ୍ଚିତ"
    },
    "Saved to your library": {
        "English": "Saved to your library", "Hindi": "आपकी लाइब्रेरी में सहेजा गया", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿಗೆ ಉಳಿಸಲಾಗಿದೆ",
        "Tamil": "உங்கள் நூலகத்தில் சேமிக்கப்பட்டது", "Telugu": "మీ లైబ్రరీకి సేవ్ చేయబడింది", "Marathi": "तुमच्या लायब्ररीत जतन केले",
        "Bengali": "আপনার লাইব্রেরিতে সংরক্ষিত", "Gujarati": "તમારી લાઇબ્રેરીમાં સાચવ્યું", "Punjabi": "ਤੁਹਾਡੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੇਵ ਕੀਤਾ",
        "Malayalam": "നിങ്ങളുടെ ലൈബ്രറിയിൽ സംരക്ഷിച്ചു", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀରେ ସଞ୍ଚିତ"
    },
    "Saving…": {
        "English": "Saving…", "Hindi": "सहेजा जा रहा है…", "Kannada": "ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
        "Tamil": "சேமிக்கப்படுகிறது…", "Telugu": "సేవ్ చేస్తోంది…", "Marathi": "जतन होत आहे…",
        "Bengali": "সংরক্ষণ হচ্ছে…", "Gujarati": "સાચવી રહ્યા છીએ…", "Punjabi": "ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…",
        "Malayalam": "സംരക്ഷിക്കുന്നു…", "Odia": "ସଞ୍ଚୟ କରୁଛୁ…"
    },
    "Could not save": {
        "English": "Could not save", "Hindi": "सहेज नहीं सका", "Kannada": "ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ",
        "Tamil": "சேமிக்க முடியவில்லை", "Telugu": "సేవ్ చేయలేకపోయింది", "Marathi": "जतन करता आले नाही",
        "Bengali": "সংরক্ষণ করা যায়নি", "Gujarati": "સાચવી શક્યા નહીં", "Punjabi": "ਸੇਵ ਨਹੀਂ ਕਰ ਸਕੇ",
        "Malayalam": "സംരക്ഷിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ସଞ୍ଚୟ କରିପାରିଲୁ ନାହିଁ"
    },
    "For your": {
        "English": "For your", "Hindi": "आपके", "Kannada": "ನಿಮ್ಮ",
        "Tamil": "உங்கள்", "Telugu": "మీ", "Marathi": "तुमच्या",
        "Bengali": "আপনার", "Gujarati": "તમારા", "Punjabi": "ਤੁਹਾਡੇ",
        "Malayalam": "നിങ്ങളുടെ", "Odia": "ଆପଣଙ୍କ"
    },
    // ("students" key already exists later in the file at line ~1542 — reusing.)
    "Personalised": {
        "English": "Personalised", "Hindi": "व्यक्तिगत", "Kannada": "ವೈಯಕ್ತಿಕ",
        "Tamil": "தனிப்பயனாக்கப்பட்டது", "Telugu": "వ్యక్తిగతీకృతం", "Marathi": "वैयक्तिकृत",
        "Bengali": "ব্যক্তিগতকৃত", "Gujarati": "વ્યક્તિગત", "Punjabi": "ਵਿਅਕਤੀਗਤ",
        "Malayalam": "വ്യക്തിഗതമാക്കിയത്", "Odia": "ବ୍ୟକ୍ତିଗତ"
    },
    "Type your question or challenge here…": {
        "English": "Type your question or challenge here…",
        "Hindi": "अपना प्रश्न या चुनौती यहाँ टाइप करें…",
        "Kannada": "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಅಥವಾ ಸವಾಲನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ…",
        "Tamil": "உங்கள் கேள்வி அல்லது சவாலை இங்கே தட்டச்சு செய்யவும்…",
        "Telugu": "మీ ప్రశ్న లేదా సవాలును ఇక్కడ టైప్ చేయండి…",
        "Marathi": "तुमचा प्रश्न किंवा आव्हान येथे टाईप करा…",
        "Bengali": "আপনার প্রশ্ন বা চ্যালেঞ্জ এখানে টাইপ করুন…",
        "Gujarati": "તમારો પ્રશ્ન અથવા પડકાર અહીં ટાઇપ કરો…",
        "Punjabi": "ਆਪਣਾ ਸਵਾਲ ਜਾਂ ਚੁਣੌਤੀ ਇੱਥੇ ਟਾਈਪ ਕਰੋ…",
        "Malayalam": "നിങ്ങളുടെ ചോദ്യം അല്ലെങ്കിൽ വെല്ലുവിളി ഇവിടെ ടൈപ്പ് ചെയ്യുക…",
        "Odia": "ଆପଣଙ୍କ ପ୍ରଶ୍ନ କିମ୍ବା ଚ୍ୟାଲେଞ୍ଜ ଏଠାରେ ଟାଇପ୍ କରନ୍ତୁ…"
    },
    "Privacy": {
        "English": "Privacy", "Hindi": "गोपनीयता", "Kannada": "ಗೌಪ್ಯತೆ",
        "Tamil": "தனியுரிமை", "Telugu": "గోప్యత", "Marathi": "गोपनीयता",
        "Bengali": "গোপনীয়তা", "Gujarati": "ગોપનીયતા", "Punjabi": "ਪ੍ਰਾਈਵੇਸੀ",
        "Malayalam": "സ്വകാര്യത", "Odia": "ଗୋପନୀୟତା"
    },
    "Terms": {
        "English": "Terms", "Hindi": "शर्तें", "Kannada": "ನಿಯಮಗಳು",
        "Tamil": "விதிமுறைகள்", "Telugu": "నిబంధనలు", "Marathi": "अटी",
        "Bengali": "শর্তাবলী", "Gujarati": "શરતો", "Punjabi": "ਸ਼ਰਤਾਂ",
        "Malayalam": "നിബന്ധനകൾ", "Odia": "ସର୍ତ୍ତାବଳୀ"
    },
    // === Tier 1 chrome i18n (community + landing) — 2026-04-26 ===
    "SahayakAI logo": {
        "English": "SahayakAI logo", "Hindi": "SahayakAI लोगो", "Kannada": "SahayakAI ಲೋಗೋ",
        "Tamil": "SahayakAI லோகோ", "Telugu": "SahayakAI లోగో", "Marathi": "SahayakAI लोगो",
        "Bengali": "SahayakAI লোগো", "Gujarati": "SahayakAI લોગો", "Punjabi": "SahayakAI ਲੋਗੋ",
        "Malayalam": "SahayakAI ലോഗോ", "Odia": "SahayakAI ଲୋଗୋ"
    },
    "Withdraw request": {
        "English": "Withdraw request", "Hindi": "अनुरोध वापस लें", "Kannada": "ವಿನಂತಿ ಹಿಂಪಡೆ",
        "Tamil": "கோரிக்கையை திரும்பப் பெறு", "Telugu": "అభ్యర్థనను ఉపసంహరించుకోండి", "Marathi": "विनंती मागे घ्या",
        "Bengali": "অনুরোধ প্রত্যাহার", "Gujarati": "વિનંતી પાછી લો", "Punjabi": "ਬੇਨਤੀ ਵਾਪਸ ਲਓ",
        "Malayalam": "അഭ്യർത്ഥന പിൻവലിക്കുക", "Odia": "ଅନୁରୋଧ ପ୍ରତ୍ୟାହାର କରନ୍ତୁ"
    },
    "Disconnect": {
        "English": "Disconnect", "Hindi": "डिस्कनेक्ट करें", "Kannada": "ಸಂಪರ್ಕ ಕಡಿತಗೊಳಿಸಿ",
        "Tamil": "துண்டிக்க", "Telugu": "డిస్‌కనెక్ట్", "Marathi": "डिस्कनेक्ट करा",
        "Bengali": "সংযোগ বিচ্ছিন্ন করুন", "Gujarati": "ડિસ્કનેક્ટ કરો", "Punjabi": "ਡਿਸਕਨੈਕਟ ਕਰੋ",
        "Malayalam": "ഡിസ്‌കണക്റ്റ് ചെയ്യുക", "Odia": "ବିଚ୍ଛିନ୍ନ କରନ୍ତୁ"
    },
    "Search by name, school, subject…": {
        "English": "Search by name, school, subject…", "Hindi": "नाम, स्कूल, विषय से खोजें…", "Kannada": "ಹೆಸರು, ಶಾಲೆ, ವಿಷಯದಿಂದ ಹುಡುಕಿ…",
        "Tamil": "பெயர், பள்ளி, பாடம் மூலம் தேடவும்…", "Telugu": "పేరు, పాఠశాల, విషయం ద్వారా శోధించండి…", "Marathi": "नाव, शाळा, विषयानुसार शोधा…",
        "Bengali": "নাম, স্কুল, বিষয় দ্বারা অনুসন্ধান করুন…", "Gujarati": "નામ, શાળા, વિષય દ્વારા શોધો…", "Punjabi": "ਨਾਮ, ਸਕੂਲ, ਵਿਸ਼ੇ ਨਾਲ ਖੋਜੋ…",
        "Malayalam": "പേര്, സ്കൂൾ, വിഷയം ഉപയോഗിച്ച് തിരയുക…", "Odia": "ନାମ, ବିଦ୍ୟାଳୟ, ବିଷୟ ଅନୁସାରେ ଖୋଜନ୍ତୁ…"
    },
    "Group discussion": {
        "English": "Group discussion", "Hindi": "समूह चर्चा", "Kannada": "ಗುಂಪು ಚರ್ಚೆ",
        "Tamil": "குழு விவாதம்", "Telugu": "గ్రూప్ చర్చ", "Marathi": "गट चर्चा",
        "Bengali": "গ্রুপ আলোচনা", "Gujarati": "જૂથ ચર્ચા", "Punjabi": "ਸਮੂਹ ਚਰਚਾ",
        "Malayalam": "ഗ്രൂപ്പ് ചർച്ച", "Odia": "ଗୋଷ୍ଠୀ ଆଲୋଚନା"
    },
    "Share something with teachers across Bharat…": {
        "English": "Share something with teachers across Bharat…",
        "Hindi": "भारत भर के शिक्षकों के साथ कुछ साझा करें…",
        "Kannada": "ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಏನನ್ನಾದರೂ ಹಂಚಿಕೊಳ್ಳಿ…",
        "Tamil": "பாரதம் முழுவதும் ஆசிரியர்களுடன் ஏதாவது பகிர்ந்துகொள்ளுங்கள்…",
        "Telugu": "భారతదేశం అంతటా ఉపాధ్యాయులతో ఏదైనా పంచుకోండి…",
        "Marathi": "भारतभरातील शिक्षकांसोबत काहीतरी शेअर करा…",
        "Bengali": "সারা ভারতে শিক্ষকদের সাথে কিছু শেয়ার করুন…",
        "Gujarati": "ભારતભરના શિક્ષકો સાથે કંઈક શેર કરો…",
        "Punjabi": "ਭਾਰਤ ਭਰ ਦੇ ਅਧਿਆਪਕਾਂ ਨਾਲ ਕੁਝ ਸਾਂਝਾ ਕਰੋ…",
        "Malayalam": "ഭാരതത്തിലുടനീളമുള്ള അധ്യാപകരുമായി എന്തെങ്കിലും പങ്കിടുക…",
        "Odia": "ଭାରତ ସାରା ଶିକ୍ଷକମାନଙ୍କ ସହ କିଛି ସେୟାର କରନ୍ତୁ…"
    },
    "Search lessons, quizzes, worksheets…": {
        "English": "Search lessons, quizzes, worksheets…",
        "Hindi": "पाठ, क्विज़, वर्कशीट खोजें…",
        "Kannada": "ಪಾಠಗಳು, ಪರೀಕ್ಷೆಗಳು, ವರ್ಕ್‌ಶೀಟ್‌ಗಳನ್ನು ಹುಡುಕಿ…",
        "Tamil": "பாடங்கள், வினாடி வினாக்கள், பணித்தாள்கள் தேடவும்…",
        "Telugu": "పాఠాలు, క్విజ్‌లు, వర్క్‌షీట్‌లను శోధించండి…",
        "Marathi": "पाठ, क्विझ, वर्कशीट शोधा…",
        "Bengali": "পাঠ, কুইজ, ওয়ার্কশীট অনুসন্ধান করুন…",
        "Gujarati": "પાઠ, ક્વિઝ, વર્કશીટ શોધો…",
        "Punjabi": "ਪਾਠ, ਕਵਿਜ਼, ਵਰਕਸ਼ੀਟ ਖੋਜੋ…",
        "Malayalam": "പാഠങ്ങൾ, ക്വിസുകൾ, വർക്ക്‌ഷീറ്റുകൾ തിരയുക…",
        "Odia": "ପାଠ, କୁଇଜ୍, ୱର୍କଶିଟ୍ ଖୋଜନ୍ତୁ…"
    },
    "Dismiss": {
        "English": "Dismiss", "Hindi": "खारिज करें", "Kannada": "ತಿರಸ್ಕರಿಸಿ",
        "Tamil": "நிராகரி", "Telugu": "విస్మరించండి", "Marathi": "नाकारा",
        "Bengali": "বাতিল করুন", "Gujarati": "નકારો", "Punjabi": "ਖਾਰਜ ਕਰੋ",
        "Malayalam": "നിരസിക്കുക", "Odia": "ଖାରଜ କରନ୍ତୁ"
    },
    "Dismiss signed-out notice": {
        "English": "Dismiss signed-out notice", "Hindi": "साइन-आउट नोटिस खारिज करें", "Kannada": "ಸೈನ್-ಔಟ್ ಸೂಚನೆಯನ್ನು ತಿರಸ್ಕರಿಸಿ",
        "Tamil": "வெளியேறு அறிவிப்பை நிராகரி", "Telugu": "సైన్-అవుట్ నోటీసును విస్మరించండి", "Marathi": "साइन-आउट सूचना नाकारा",
        "Bengali": "সাইন-আউট বিজ্ঞপ্তি বাতিল করুন", "Gujarati": "સાઇન-આઉટ સૂચના નકારો", "Punjabi": "ਸਾਈਨ-ਆਉਟ ਨੋਟਿਸ ਖਾਰਜ ਕਰੋ",
        "Malayalam": "സൈൻ-ഔട്ട് അറിയിപ്പ് നിരസിക്കുക", "Odia": "ସାଇନ୍-ଆଉଟ୍ ବିଜ୍ଞପ୍ତି ଖାରଜ କରନ୍ତୁ"
    },
    "Open Staff Room — chat with every teacher": {
        "English": "Open Staff Room — chat with every teacher",
        "Hindi": "स्टाफ रूम खोलें — हर शिक्षक से चैट करें",
        "Kannada": "ಸಿಬ್ಬಂದಿ ಕೋಣೆ ತೆರೆಯಿರಿ — ಪ್ರತಿಯೊಬ್ಬ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ",
        "Tamil": "ஊழியர் அறையைத் திற — ஒவ்வொரு ஆசிரியருடனும் அரட்டை அடிக்க",
        "Telugu": "స్టాఫ్ రూమ్ తెరువు — ప్రతి ఉపాధ్యాయుడితో చాట్ చేయండి",
        "Marathi": "स्टाफ रूम उघडा — प्रत्येक शिक्षकाशी गप्पा मारा",
        "Bengali": "স্টাফ রুম খুলুন — প্রতিটি শিক্ষকের সাথে চ্যাট করুন",
        "Gujarati": "સ્ટાફ રૂમ ખોલો — દરેક શિક્ષક સાથે ચેટ કરો",
        "Punjabi": "ਸਟਾਫ ਰੂਮ ਖੋਲ੍ਹੋ — ਹਰ ਅਧਿਆਪਕ ਨਾਲ ਚੈਟ ਕਰੋ",
        "Malayalam": "സ്റ്റാഫ് റൂം തുറക്കുക — എല്ലാ അധ്യാപകരുമായും ചാറ്റ് ചെയ്യുക",
        "Odia": "ଷ୍ଟାଫ୍ ରୁମ୍ ଖୋଲନ୍ତୁ — ପ୍ରତ୍ୟେକ ଶିକ୍ଷକଙ୍କ ସହ ଚାଟ୍ କରନ୍ତୁ"
    },
    "Find Teachers — search by subject or school": {
        "English": "Find Teachers — search by subject or school",
        "Hindi": "शिक्षक खोजें — विषय या स्कूल से खोजें",
        "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ — ವಿಷಯ ಅಥವಾ ಶಾಲೆಯಿಂದ ಹುಡುಕಿ",
        "Tamil": "ஆசிரியர்களைக் கண்டறிக — பாடம் அல்லது பள்ளி மூலம் தேடவும்",
        "Telugu": "ఉపాధ్యాయులను కనుగొనండి — విషయం లేదా పాఠశాల ద్వారా శోధించండి",
        "Marathi": "शिक्षक शोधा — विषय किंवा शाळेनुसार शोधा",
        "Bengali": "শিক্ষক খুঁজুন — বিষয় বা স্কুল দ্বারা অনুসন্ধান করুন",
        "Gujarati": "શિક્ષકો શોધો — વિષય અથવા શાળા દ્વારા શોધો",
        "Punjabi": "ਅਧਿਆਪਕਾਂ ਨੂੰ ਲੱਭੋ — ਵਿਸ਼ੇ ਜਾਂ ਸਕੂਲ ਅਨੁਸਾਰ ਖੋਜੋ",
        "Malayalam": "അധ്യാപകരെ കണ്ടെത്തുക — വിഷയം അല്ലെങ്കിൽ സ്കൂൾ ഉപയോഗിച്ച് തിരയുക",
        "Odia": "ଶିକ୍ଷକମାନଙ୍କୁ ଖୋଜନ୍ତୁ — ବିଷୟ କିମ୍ବା ବିଦ୍ୟାଳୟ ଅନୁସାରେ ଖୋଜନ୍ତୁ"
    },
    "Create a Post": {
        "English": "Create a Post", "Hindi": "पोस्ट बनाएँ", "Kannada": "ಪೋಸ್ಟ್ ರಚಿಸಿ",
        "Tamil": "இடுகை உருவாக்கவும்", "Telugu": "పోస్ట్ సృష్టించండి", "Marathi": "पोस्ट तयार करा",
        "Bengali": "একটি পোস্ট তৈরি করুন", "Gujarati": "પોસ્ટ બનાવો", "Punjabi": "ਪੋਸਟ ਬਣਾਓ",
        "Malayalam": "പോസ്റ്റ് സൃഷ്ടിക്കുക", "Odia": "ଏକ ପୋଷ୍ଟ ତିଆରି କରନ୍ତୁ"
    },
    "What's on your mind?": {
        "English": "What's on your mind?", "Hindi": "आपके मन में क्या है?", "Kannada": "ನಿಮ್ಮ ಮನಸ್ಸಿನಲ್ಲಿ ಏನಿದೆ?",
        "Tamil": "உங்கள் மனதில் என்ன?", "Telugu": "మీ మదిలో ఏముంది?", "Marathi": "तुमच्या मनात काय आहे?",
        "Bengali": "আপনার মনে কী আছে?", "Gujarati": "તમારા મનમાં શું છે?", "Punjabi": "ਤੁਹਾਡੇ ਮਨ ਵਿੱਚ ਕੀ ਹੈ?",
        "Malayalam": "നിങ്ങളുടെ മനസ്സിൽ എന്താണ്?", "Odia": "ଆପଣଙ୍କ ମନରେ କଣ ଅଛି?"
    },
    "e.g. Just finished a great lesson on photosynthesis!": {
        "English": "e.g. Just finished a great lesson on photosynthesis!",
        "Hindi": "उदा. अभी प्रकाश संश्लेषण पर एक शानदार पाठ खत्म किया!",
        "Kannada": "ಉದಾ. ಈಗ ತಾನೇ ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಮೇಲೆ ಒಂದು ಅದ್ಭುತ ಪಾಠ ಮುಗಿಸಿದೆ!",
        "Tamil": "எ.கா. இப்போதுதான் ஒளிச்சேர்க்கை குறித்த சிறந்த பாடத்தை முடித்தேன்!",
        "Telugu": "ఉదా. ఇప్పుడే కిరణజన్య సంయోగక్రియపై గొప్ప పాఠాన్ని ముగించాను!",
        "Marathi": "उदा. नुकताच प्रकाशसंश्लेषण वर एक उत्तम पाठ पूर्ण केला!",
        "Bengali": "যেমন: এইমাত্র সালোকসংশ্লেষণের উপর একটি দুর্দান্ত পাঠ শেষ করলাম!",
        "Gujarati": "દા.ત. હમણાં જ પ્રકાશસંશ્લેષણ પર એક શાનદાર પાઠ પૂર્ણ કર્યો!",
        "Punjabi": "ਉਦਾ. ਹੁਣੇ ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਉੱਤੇ ਇੱਕ ਸ਼ਾਨਦਾਰ ਪਾਠ ਖਤਮ ਕੀਤਾ!",
        "Malayalam": "ഉദാ. ഇപ്പോൾ പ്രകാശസംശ്ലേഷണത്തെക്കുറിച്ച് ഒരു ഗംഭീര പാഠം പൂർത്തിയാക്കി!",
        "Odia": "ଯଥା: ଏଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଉପରେ ଗୋଟିଏ ଚମତ୍କାର ପାଠ ସମାପ୍ତ କଲି!"
    },
    // ("See all tools" already defined later — using existing entry)
    "Command palette": {
        "English": "Command palette", "Hindi": "कमांड पैलेट", "Kannada": "ಆಜ್ಞಾ ಪ್ಯಾಲೆಟ್",
        "Tamil": "கட்டளை பலகை", "Telugu": "కమాండ్ ప్యాలెట్", "Marathi": "कमांड पॅलेट",
        "Bengali": "কমান্ড প্যালেট", "Gujarati": "કમાન્ડ પેલેટ", "Punjabi": "ਕਮਾਂਡ ਪੈਲੇਟ",
        "Malayalam": "കമാൻഡ് പാലറ്റ്", "Odia": "କମାଣ୍ଡ ପ୍ୟାଲେଟ୍"
    },
    "navigate": {
        "English": "navigate", "Hindi": "नेविगेट", "Kannada": "ಸಂಚಾರ",
        "Tamil": "செல்", "Telugu": "నావిగేట్", "Marathi": "नेव्हिगेट",
        "Bengali": "নেভিগেট", "Gujarati": "નેવિગેટ", "Punjabi": "ਨੇਵੀਗੇਟ",
        "Malayalam": "നാവിഗേറ്റ്", "Odia": "ନେଭିଗେଟ୍"
    },
    "open": {
        "English": "open", "Hindi": "खोलें", "Kannada": "ತೆರೆಯಿರಿ",
        "Tamil": "திற", "Telugu": "తెరువు", "Marathi": "उघडा",
        "Bengali": "খোলো", "Gujarati": "ખોલો", "Punjabi": "ਖੋਲ੍ਹੋ",
        "Malayalam": "തുറക്കുക", "Odia": "ଖୋଲନ୍ତୁ"
    },
    "Your library is empty": {
        "English": "Your library is empty", "Hindi": "आपकी लाइब्रेरी खाली है", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿ ಖಾಲಿಯಾಗಿದೆ",
        "Tamil": "உங்கள் நூலகம் காலியாக உள்ளது", "Telugu": "మీ లైబ్రరీ ఖాళీగా ఉంది", "Marathi": "तुमची लायब्ररी रिकामी आहे",
        "Bengali": "আপনার লাইব্রেরি খালি", "Gujarati": "તમારી લાઇબ્રેરી ખાલી છે", "Punjabi": "ਤੁਹਾਡੀ ਲਾਇਬ੍ਰੇਰੀ ਖਾਲੀ ਹੈ",
        "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി ശൂന്യമാണ്", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଖାଲି ଅଛି"
    },
    "Lesson plans, quizzes, worksheets, and more will appear here once you create them. Tap below to create your first.": {
        "English": "Lesson plans, quizzes, worksheets, and more will appear here once you create them. Tap below to create your first.",
        "Hindi": "पाठ योजनाएँ, क्विज़, वर्कशीट और अन्य सामग्री यहाँ दिखाई देगी जब आप उन्हें बनाएँगे। पहली बनाने के लिए नीचे टैप करें।",
        "Kannada": "ನೀವು ರಚಿಸಿದಾಗ ಪಾಠ ಯೋಜನೆಗಳು, ಪರೀಕ್ಷೆಗಳು, ವರ್ಕ್‌ಶೀಟ್‌ಗಳು ಮತ್ತು ಇನ್ನಷ್ಟು ಇಲ್ಲಿ ಗೋಚರಿಸುತ್ತವೆ. ನಿಮ್ಮ ಮೊದಲನೆಯದನ್ನು ರಚಿಸಲು ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ.",
        "Tamil": "நீங்கள் உருவாக்கியதும் பாடத்திட்டங்கள், வினாடி வினாக்கள், பணித்தாள்கள் மற்றும் பலவற்றை இங்கே காணலாம். உங்கள் முதலாவதை உருவாக்க கீழே தட்டவும்.",
        "Telugu": "మీరు సృష్టించిన తర్వాత పాఠ్య ప్రణాళికలు, క్విజ్‌లు, వర్క్‌షీట్‌లు మరియు మరిన్ని ఇక్కడ కనిపిస్తాయి. మీ మొదటిది సృష్టించడానికి క్రింద ట్యాప్ చేయండి.",
        "Marathi": "तुम्ही तयार केल्यावर पाठ योजना, क्विझ, वर्कशीट आणि बरेच काही येथे दिसेल. तुमची पहिली तयार करण्यासाठी खाली टॅप करा.",
        "Bengali": "আপনি তৈরি করার পরে পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট এবং আরও অনেক কিছু এখানে প্রদর্শিত হবে। আপনার প্রথমটি তৈরি করতে নীচে ট্যাপ করুন।",
        "Gujarati": "તમે બનાવ્યા પછી પાઠ યોજનાઓ, ક્વિઝ, વર્કશીટ્સ અને વધુ અહીં દેખાશે. તમારી પ્રથમ બનાવવા માટે નીચે ટેપ કરો.",
        "Punjabi": "ਜਦੋਂ ਤੁਸੀਂ ਉਹਨਾਂ ਨੂੰ ਬਣਾਓਗੇ ਤਾਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼, ਵਰਕਸ਼ੀਟਾਂ ਅਤੇ ਹੋਰ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੀਆਂ। ਆਪਣੀ ਪਹਿਲੀ ਬਣਾਉਣ ਲਈ ਹੇਠਾਂ ਟੈਪ ਕਰੋ।",
        "Malayalam": "നിങ്ങൾ സൃഷ്ടിച്ച ശേഷം പാഠ പദ്ധതികൾ, ക്വിസുകൾ, വർക്ക്‌ഷീറ്റുകൾ എന്നിവയും അതിലധികവും ഇവിടെ ദൃശ്യമാകും. ആദ്യത്തേത് സൃഷ്ടിക്കാൻ താഴെ ടാപ്പ് ചെയ്യുക.",
        "Odia": "ଆପଣ ସୃଷ୍ଟି କଲା ପରେ ପାଠ ଯୋଜନା, କୁଇଜ୍, ୱର୍କଶିଟ୍ ଏବଂ ଆହୁରି ଅନେକ ଏଠାରେ ଦେଖାଯିବ। ଆପଣଙ୍କର ପ୍ରଥମଟି ସୃଷ୍ଟି କରିବାକୁ ତଳେ ଟାପ୍ କରନ୍ତୁ।"
    },
    "Create your first lesson plan": {
        "English": "Create your first lesson plan", "Hindi": "अपनी पहली पाठ योजना बनाएँ", "Kannada": "ನಿಮ್ಮ ಮೊದಲ ಪಾಠ ಯೋಜನೆ ರಚಿಸಿ",
        "Tamil": "உங்கள் முதல் பாடத்திட்டத்தை உருவாக்கவும்", "Telugu": "మీ మొదటి పాఠ్య ప్రణాళికను సృష్టించండి", "Marathi": "तुमची पहिली पाठ योजना तयार करा",
        "Bengali": "আপনার প্রথম পাঠ পরিকল্পনা তৈরি করুন", "Gujarati": "તમારી પ્રથમ પાઠ યોજના બનાવો", "Punjabi": "ਆਪਣੀ ਪਹਿਲੀ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ",
        "Malayalam": "നിങ്ങളുടെ ആദ്യ പാഠ പദ്ധതി സൃഷ്ടിക്കുക", "Odia": "ଆପଣଙ୍କର ପ୍ରଥମ ପାଠ ଯୋଜନା ତିଆରି କରନ୍ତୁ"
    },
    "Browse community library": {
        "English": "Browse community library", "Hindi": "समुदाय लाइब्रेरी ब्राउज़ करें", "Kannada": "ಸಮುದಾಯ ಲೈಬ್ರರಿ ವೀಕ್ಷಿಸಿ",
        "Tamil": "சமூக நூலகத்தை உலாவவும்", "Telugu": "కమ్యూనిటీ లైబ్రరీని బ్రౌజ్ చేయండి", "Marathi": "समुदाय लायब्ररी ब्राउझ करा",
        "Bengali": "কমিউনিটি লাইব্রেরি ব্রাউজ করুন", "Gujarati": "સમુદાય લાઇબ્રેરી બ્રાઉઝ કરો", "Punjabi": "ਕਮਿਊਨਿਟੀ ਲਾਇਬ੍ਰੇਰੀ ਬ੍ਰਾਊਜ਼ ਕਰੋ",
        "Malayalam": "കമ്മ്യൂണിറ്റി ലൈബ്രറി ബ്രൗസ് ചെയ്യുക", "Odia": "ସମ୍ପ୍ରଦାୟ ଲାଇବ୍ରେରୀ ବ୍ରାଉଜ୍ କରନ୍ତୁ"
    },
    "No resources match those filters": {
        "English": "No resources match those filters", "Hindi": "उन फ़िल्टर से कोई संसाधन मेल नहीं खाता", "Kannada": "ಆ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಯಾವುದೇ ಸಂಪನ್ಮೂಲ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ",
        "Tamil": "அந்த வடிகட்டிகளுக்கு பொருந்தும் வளங்கள் இல்லை", "Telugu": "ఆ ఫిల్టర్‌లకు సరిపోయే వనరులు లేవు", "Marathi": "त्या फिल्टरशी जुळणारी कोणतीही संसाधने नाहीत",
        "Bengali": "সেই ফিল্টারগুলির সাথে কোনো সম্পদ মেলে না", "Gujarati": "તે ફિલ્ટર્સ સાથે કોઈ સંસાધનો મેળ ખાતા નથી", "Punjabi": "ਉਹਨਾਂ ਫਿਲਟਰਾਂ ਨਾਲ ਕੋਈ ਸਰੋਤ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ",
        "Malayalam": "ആ ഫിൽട്ടറുകളുമായി പൊരുത്തപ്പെടുന്ന വിഭവങ്ങളില്ല", "Odia": "ସେହି ଫିଲ୍ଟର୍ ସହିତ କୌଣସି ସମ୍ବଳ ମେଳ ଖାଉ ନାହିଁ"
    },
    "Try adjusting your filters or clearing them to see everything.": {
        "English": "Try adjusting your filters or clearing them to see everything.",
        "Hindi": "सब कुछ देखने के लिए फ़िल्टर समायोजित करने या उन्हें साफ़ करने का प्रयास करें।",
        "Kannada": "ಎಲ್ಲವನ್ನೂ ನೋಡಲು ನಿಮ್ಮ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಸರಿಹೊಂದಿಸಲು ಅಥವಾ ಅವುಗಳನ್ನು ತೆರವುಗೊಳಿಸಲು ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "எல்லாவற்றையும் பார்க்க உங்கள் வடிப்பான்களை சரிசெய்ய அல்லது அழிக்க முயற்சிக்கவும்.",
        "Telugu": "ప్రతిదీ చూడటానికి మీ ఫిల్టర్‌లను సర్దుబాటు చేయడానికి లేదా వాటిని క్లియర్ చేయడానికి ప్రయత్నించండి.",
        "Marathi": "सर्व काही पाहण्यासाठी तुमचे फिल्टर समायोजित करा किंवा साफ करण्याचा प्रयत्न करा.",
        "Bengali": "সব দেখতে আপনার ফিল্টার সামঞ্জস্য করার বা সেগুলি সাফ করার চেষ্টা করুন।",
        "Gujarati": "બધું જોવા માટે તમારા ફિલ્ટરને સમાયોજિત કરવા અથવા તેને સાફ કરવાનો પ્રયાસ કરો.",
        "Punjabi": "ਸਭ ਕੁਝ ਦੇਖਣ ਲਈ ਆਪਣੇ ਫਿਲਟਰਾਂ ਨੂੰ ਅਨੁਕੂਲ ਕਰਨ ਜਾਂ ਉਹਨਾਂ ਨੂੰ ਸਾਫ਼ ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "എല്ലാം കാണാൻ നിങ്ങളുടെ ഫിൽട്ടറുകൾ ക്രമീകരിക്കാനോ അവ മായ്ക്കാനോ ശ്രമിക്കുക.",
        "Odia": "ସବୁକିଛି ଦେଖିବାକୁ ଆପଣଙ୍କ ଫିଲ୍ଟର୍ ସଜାଡ଼ିବାକୁ ବା ସଫା କରିବାକୁ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Clear all filters": {
        "English": "Clear all filters", "Hindi": "सभी फ़िल्टर साफ़ करें", "Kannada": "ಎಲ್ಲಾ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ",
        "Tamil": "அனைத்து வடிப்பான்களையும் அழி", "Telugu": "అన్ని ఫిల్టర్‌లను క్లియర్ చేయండి", "Marathi": "सर्व फिल्टर साफ करा",
        "Bengali": "সমস্ত ফিল্টার সাফ করুন", "Gujarati": "બધા ફિલ્ટર સાફ કરો", "Punjabi": "ਸਾਰੇ ਫਿਲਟਰ ਸਾਫ਼ ਕਰੋ",
        "Malayalam": "എല്ലാ ഫിൽട്ടറുകളും മായ്ക്കുക", "Odia": "ସମସ୍ତ ଫିଲ୍ଟର୍ ସଫା କରନ୍ତୁ"
    },
    "Photosynthesis — Class 8 Science": {
        "English": "Photosynthesis — Class 8 Science", "Hindi": "प्रकाश संश्लेषण — कक्षा 8 विज्ञान", "Kannada": "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ — ೮ನೇ ತರಗತಿ ವಿಜ್ಞಾನ",
        "Tamil": "ஒளிச்சேர்க்கை — வகுப்பு 8 அறிவியல்", "Telugu": "కిరణజన్య సంయోగక్రియ — 8వ తరగతి సైన్స్", "Marathi": "प्रकाशसंश्लेषण — इयत्ता ८ विज्ञान",
        "Bengali": "সালোকসংশ্লেষণ — ৮ম শ্রেণী বিজ্ঞান", "Gujarati": "પ્રકાશસંશ્લેષણ — ધોરણ 8 વિજ્ઞાન", "Punjabi": "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ — ਜਮਾਤ 8 ਵਿਗਿਆਨ",
        "Malayalam": "പ്രകാശസംശ്ലേഷണം — 8-ാം ക്ലാസ് സയൻസ്", "Odia": "ଆଲୋକ ସଂଶ୍ଳେଷଣ — ଅଷ୍ଟମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ"
    },
    "English": {
        "English": "English", "Hindi": "अंग्रेज़ी", "Kannada": "ಇಂಗ್ಲಿಷ್",
        "Tamil": "ஆங்கிலம்", "Telugu": "ఆంగ్లం", "Marathi": "इंग्रजी",
        "Bengali": "ইংরেজি", "Gujarati": "અંગ્રેજી", "Punjabi": "ਅੰਗਰੇਜ਼ੀ",
        "Malayalam": "ഇംഗ്ലീഷ്", "Odia": "ଇଂରାଜୀ"
    },
    "days ago": {
        "English": "days ago", "Hindi": "दिन पहले", "Kannada": "ದಿನಗಳ ಹಿಂದೆ",
        "Tamil": "நாட்களுக்கு முன்பு", "Telugu": "రోజుల క్రితం", "Marathi": "दिवसांपूर्वी",
        "Bengali": "দিন আগে", "Gujarati": "દિવસ પહેলા", "Punjabi": "ਦਿਨ ਪਹਿਲਾਂ",
        "Malayalam": "ദിവസങ്ങൾക്ക് മുമ്പ്", "Odia": "ଦିନ ପୂର୍ବେ"
    },
    // --- AuthGate strings (4 call sites: my-library, messages, notifications, settings) ---
    "Sign in to open your library": {
        "English": "Sign in to open your library", "Hindi": "अपनी लाइब्रेरी खोलने के लिए साइन इन करें", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿ ತೆರೆಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "உங்கள் நூலகத்தைத் திறக்க உள்நுழைக", "Telugu": "మీ లైబ్రరీని తెరవడానికి సైన్ ఇన్ చేయండి", "Marathi": "तुमची लायब्ररी उघडण्यासाठी साइन इन करा",
        "Bengali": "আপনার লাইব্রেরি খুলতে সাইন ইন করুন", "Gujarati": "તમારી લાઇબ્રેરી ખોલવા માટે સાઇન ઇન કરો", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਖੋਲ੍ਹਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി തുറക്കാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଖୋଲିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Your saved lesson plans, quizzes, worksheets, and resources will appear here.": {
        "English": "Your saved lesson plans, quizzes, worksheets, and resources will appear here.",
        "Hindi": "आपकी सहेजी गई पाठ योजनाएँ, क्विज़, वर्कशीट और संसाधन यहाँ दिखाई देंगे।",
        "Kannada": "ನಿಮ್ಮ ಉಳಿಸಿದ ಪಾಠ ಯೋಜನೆಗಳು, ಪರೀಕ್ಷೆಗಳು, ವರ್ಕ್‌ಶೀಟ್‌ಗಳು ಮತ್ತು ಸಂಪನ್ಮೂಲಗಳು ಇಲ್ಲಿ ಗೋಚರಿಸುತ್ತವೆ.",
        "Tamil": "உங்கள் சேமித்த பாடத்திட்டங்கள், வினாடி வினாக்கள், பணித்தாள்கள் மற்றும் வளங்கள் இங்கே தோன்றும்.",
        "Telugu": "మీరు సేవ్ చేసిన పాఠ్య ప్రణాళికలు, క్విజ్‌లు, వర్క్‌షీట్‌లు మరియు వనరులు ఇక్కడ కనిపిస్తాయి.",
        "Marathi": "तुम्ही जतन केलेल्या पाठ योजना, क्विझ, वर्कशीट आणि संसाधने येथे दिसतील.",
        "Bengali": "আপনার সংরক্ষিত পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট এবং সম্পদ এখানে প্রদর্শিত হবে।",
        "Gujarati": "તમારી સાચવેલી પાઠ યોજનાઓ, ક્વિઝ, વર્કશીટ્સ અને સંસાધનો અહીં દેખાશે.",
        "Punjabi": "ਤੁਹਾਡੀਆਂ ਸੇਵ ਕੀਤੀਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼, ਵਰਕਸ਼ੀਟਾਂ ਅਤੇ ਸਰੋਤ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ।",
        "Malayalam": "നിങ്ങൾ സംരക്ഷിച്ച പാഠ പദ്ധതികൾ, ക്വിസുകൾ, വർക്ക്‌ഷീറ്റുകൾ, വിഭവങ്ങൾ എന്നിവ ഇവിടെ ദൃശ്യമാകും.",
        "Odia": "ଆପଣ ସଞ୍ଚୟ କରିଥିବା ପାଠ ଯୋଜନା, କୁଇଜ୍, ୱର୍କଶିଟ୍ ଏବଂ ସମ୍ବଳ ଏଠାରେ ଦେଖାଯିବ।"
    },
    "Sign in to see your messages": {
        "English": "Sign in to see your messages", "Hindi": "अपने संदेश देखने के लिए साइन इन करें", "Kannada": "ನಿಮ್ಮ ಸಂದೇಶಗಳನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "உங்கள் செய்திகளைப் பார்க்க உள்நுழைக", "Telugu": "మీ సందేశాలను చూడటానికి సైన్ ఇన్ చేయండి", "Marathi": "तुमचे संदेश पाहण्यासाठी साइन इन करा",
        "Bengali": "আপনার বার্তা দেখতে সাইন ইন করুন", "Gujarati": "તમારા સંદેશા જોવા માટે સાઇન ઇન કરો", "Punjabi": "ਆਪਣੇ ਸੁਨੇਹੇ ਵੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "നിങ്ങളുടെ സന്ദേശങ്ങൾ കാണാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ସନ୍ଦେଶ ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in with Google to chat with other teachers and get notified of new replies.": {
        "English": "Sign in with Google to chat with other teachers and get notified of new replies.",
        "Hindi": "अन्य शिक्षकों से चैट करने और नए जवाबों की सूचना पाने के लिए Google से साइन इन करें।",
        "Kannada": "ಇತರ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಲು ಮತ್ತು ಹೊಸ ಉತ್ತರಗಳ ಬಗ್ಗೆ ಸೂಚನೆ ಪಡೆಯಲು Google ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "மற்ற ஆசிரியர்களுடன் அரட்டை அடிக்கவும், புதிய பதில்களை அறியவும் Google உடன் உள்நுழைக.",
        "Telugu": "ఇతర ఉపాధ్యాయులతో చాట్ చేయడానికి మరియు కొత్త ప్రత్యుత్తరాల గురించి తెలుసుకోవడానికి Google తో సైన్ ఇన్ చేయండి.",
        "Marathi": "इतर शिक्षकांशी गप्पा मारण्यासाठी आणि नवीन उत्तरांची सूचना मिळवण्यासाठी Google सह साइन इन करा.",
        "Bengali": "অন্যান্য শিক্ষকদের সাথে চ্যাট করতে এবং নতুন জবাবের নোটিফিকেশন পেতে Google দিয়ে সাইন ইন করুন।",
        "Gujarati": "અન્ય શિક્ષકો સાથે ચેટ કરવા અને નવા જવાબોની સૂચના મેળવવા Google સાથે સાઇન ઇન કરો.",
        "Punjabi": "ਹੋਰ ਅਧਿਆਪਕਾਂ ਨਾਲ ਗੱਲ ਕਰਨ ਅਤੇ ਨਵੇਂ ਜਵਾਬਾਂ ਦੀ ਸੂਚਨਾ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ Google ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "മറ്റ് അധ്യാപകരുമായി ചാറ്റ് ചെയ്യാനും പുതിയ മറുപടികളെക്കുറിച്ച് അറിയിപ്പ് നേടാനും Google ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക.",
        "Odia": "ଅନ୍ୟ ଶିକ୍ଷକମାନଙ୍କ ସହିତ ଚାଟ୍ କରିବାକୁ ଏବଂ ନୂତନ ଉତ୍ତରର ବିଜ୍ଞପ୍ତି ପାଇବାକୁ Google ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Sign in to see notifications": {
        "English": "Sign in to see notifications", "Hindi": "सूचनाएँ देखने के लिए साइन इन करें", "Kannada": "ಅಧಿಸೂಚನೆಗಳನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "அறிவிப்புகளைப் பார்க்க உள்நுழைக", "Telugu": "నోటిఫికేషన్లను చూడటానికి సైన్ ఇన్ చేయండి", "Marathi": "सूचना पाहण्यासाठी साइन इन करा",
        "Bengali": "বিজ্ঞপ্তি দেখতে সাইন ইন করুন", "Gujarati": "સૂચનાઓ જોવા માટે સાઇન ઇન કરો", "Punjabi": "ਨੋਟੀਫਿਕੇਸ਼ਨ ਵੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "അറിയിപ്പുകൾ കാണാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ବିଜ୍ଞପ୍ତି ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to get notified when a fellow teacher connects, replies, or shares a resource.": {
        "English": "Sign in to get notified when a fellow teacher connects, replies, or shares a resource.",
        "Hindi": "जब कोई साथी शिक्षक कनेक्ट करे, जवाब दे, या संसाधन साझा करे तो सूचना पाने के लिए साइन इन करें।",
        "Kannada": "ಸಹ ಶಿಕ್ಷಕರೊಬ್ಬರು ಸಂಪರ್ಕಿಸಿದಾಗ, ಉತ್ತರಿಸಿದಾಗ ಅಥವಾ ಸಂಪನ್ಮೂಲವನ್ನು ಹಂಚಿಕೊಂಡಾಗ ಸೂಚನೆ ಪಡೆಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "ஒரு சக ஆசிரியர் இணைக்கும், பதிலளிக்கும் அல்லது வளத்தைப் பகிரும்போது அறிவிப்பு பெற உள்நுழைக.",
        "Telugu": "తోటి ఉపాధ్యాయుడు కనెక్ట్ అయినప్పుడు, ప్రత్యుత్తరం ఇచ్చినప్పుడు లేదా వనరును పంచుకున్నప్పుడు తెలుసుకోవడానికి సైన్ ఇన్ చేయండి.",
        "Marathi": "एखादा सहकारी शिक्षक कनेक्ट होतो, प्रतिसाद देतो किंवा संसाधन शेअर करतो तेव्हा सूचना मिळवण्यासाठी साइन इन करा.",
        "Bengali": "একজন সহকর্মী শিক্ষক সংযোগ করলে, উত্তর দিলে বা সম্পদ শেয়ার করলে নোটিফিকেশন পেতে সাইন ইন করুন।",
        "Gujarati": "જ્યારે કોઈ સહકર્મચારી શિક્ષક જોડાય, જવાબ આપે અથવા સંસાધન શેર કરે ત્યારે સૂચના મેળવવા સાઇન ઇન કરો.",
        "Punjabi": "ਜਦੋਂ ਕੋਈ ਸਾਥੀ ਅਧਿਆਪਕ ਜੁੜੇ, ਜਵਾਬ ਦੇਵੇ, ਜਾਂ ਸਰੋਤ ਸਾਂਝਾ ਕਰੇ ਤਾਂ ਸੂਚਨਾ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "ഒരു സഹപ്രവർത്തക അധ്യാപകൻ ബന്ധിപ്പിക്കുമ്പോഴോ, മറുപടി നൽകുമ്പോഴോ, വിഭവം പങ്കിടുമ്പോഴോ അറിയിപ്പ് നേടാൻ സൈൻ ഇൻ ചെയ്യുക.",
        "Odia": "ଯେତେବେଳେ ଜଣେ ସହକର୍ମୀ ଶିକ୍ଷକ ସଂଯୋଗ କରନ୍ତି, ଉତ୍ତର ଦିଅନ୍ତି କିମ୍ବା ସମ୍ବଳ ସେୟାର କରନ୍ତି, ବିଜ୍ଞପ୍ତି ପାଇବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Sign in to manage settings": {
        "English": "Sign in to manage settings", "Hindi": "सेटिंग्स प्रबंधित करने के लिए साइन इन करें", "Kannada": "ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "அமைப்புகளை நிர்வகிக்க உள்நுழைக", "Telugu": "సెట్టింగ్‌లను నిర్వహించడానికి సైన్ ఇన్ చేయండి", "Marathi": "सेटिंग्ज व्यवस्थापित करण्यासाठी साइन इन करा",
        "Bengali": "সেটিংস পরিচালনা করতে সাইন ইন করুন", "Gujarati": "સેટિંગ્સ મેનેજ કરવા માટે સાઇન ઇન કરો", "Punjabi": "ਸੈਟਿੰਗਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "ക്രമീകരണങ്ങൾ കൈകാര്യം ചെയ്യാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ସେଟିଂସ ପରିଚାଳନା କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to customise your language, plan preferences, and notification settings.": {
        "English": "Sign in to customise your language, plan preferences, and notification settings.",
        "Hindi": "अपनी भाषा, प्लान प्राथमिकताएँ और सूचना सेटिंग्स अनुकूलित करने के लिए साइन इन करें।",
        "Kannada": "ನಿಮ್ಮ ಭಾಷೆ, ಯೋಜನೆ ಆದ್ಯತೆಗಳು ಮತ್ತು ಅಧಿಸೂಚನೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಕಸ್ಟಮೈಸ್ ಮಾಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "உங்கள் மொழி, திட்ட விருப்பங்கள் மற்றும் அறிவிப்பு அமைப்புகளைத் தனிப்பயனாக்க உள்நுழைக.",
        "Telugu": "మీ భాష, ప్లాన్ ప్రాధాన్యతలు మరియు నోటిఫికేషన్ సెట్టింగ్‌లను అనుకూలీకరించడానికి సైన్ ఇన్ చేయండి.",
        "Marathi": "तुमची भाषा, योजना प्राधान्ये आणि सूचना सेटिंग्ज सानुकूलित करण्यासाठी साइन इन करा.",
        "Bengali": "আপনার ভাষা, প্ল্যান পছন্দ এবং বিজ্ঞপ্তি সেটিংস কাস্টমাইজ করতে সাইন ইন করুন।",
        "Gujarati": "તમારી ભાષા, પ્લાન પસંદગીઓ અને સૂચના સેટિંગ્સ કસ્ટમાઇઝ કરવા સાઇન ઇન કરો.",
        "Punjabi": "ਆਪਣੀ ਭਾਸ਼ਾ, ਪਲੈਨ ਤਰਜੀਹਾਂ ਅਤੇ ਨੋਟੀਫਿਕੇਸ਼ਨ ਸੈਟਿੰਗਾਂ ਅਨੁਕੂਲਿਤ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "നിങ്ങളുടെ ഭാഷ, പ്ലാൻ മുൻഗണനകൾ, അറിയിപ്പ് ക്രമീകരണങ്ങൾ എന്നിവ ഇഷ്ടാനുസൃതമാക്കാൻ സൈൻ ഇൻ ചെയ്യുക.",
        "Odia": "ଆପଣଙ୍କ ଭାଷା, ପ୍ଲାନ୍ ପସନ୍ଦ ଏବଂ ବିଜ୍ଞପ୍ତି ସେଟିଂସ କଷ୍ଟମାଇଜ୍ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Save and continue": {
        "English": "Save and continue", "Hindi": "सहेजें और जारी रखें", "Kannada": "ಉಳಿಸಿ ಮತ್ತು ಮುಂದುವರಿಸಿ",
        "Tamil": "சேமித்து தொடரவும்", "Telugu": "సేవ్ చేసి కొనసాగించండి", "Marathi": "जतन करा आणि सुरू ठेवा",
        "Bengali": "সংরক্ষণ করুন এবং চালিয়ে যান", "Gujarati": "સાચવો અને ચાલુ રાખો", "Punjabi": "ਸੇਵ ਕਰੋ ਅਤੇ ਜਾਰੀ ਰੱਖੋ",
        "Malayalam": "സേവ് ചെയ്ത് തുടരുക", "Odia": "ସଞ୍ଚୟ କରି ଜାରି ରଖନ୍ତୁ"
    },
    "Sample lesson plan": {
        "English": "Sample lesson plan", "Hindi": "नमूना पाठ योजना", "Kannada": "ಮಾದರಿ ಪಾಠ ಯೋಜನೆ",
        "Tamil": "மாதிரி பாடத்திட்டம்", "Telugu": "నమూనా పాఠ్య ప్రణాళిక", "Marathi": "नमुना पाठ योजना",
        "Bengali": "নমুনা পাঠ পরিকল্পনা", "Gujarati": "નમૂનો પાઠ યોજના", "Punjabi": "ਨਮੂਨਾ ਪਾਠ ਯੋਜਨਾ",
        "Malayalam": "സാമ്പിൾ പാഠ പദ്ധതി", "Odia": "ନମୁନା ପାଠ ଯୋଜନା"
    },
    "Create your own": {
        "English": "Create your own", "Hindi": "अपनी बनाएँ", "Kannada": "ನಿಮ್ಮದೇ ರಚಿಸಿ",
        "Tamil": "உங்களுடையதை உருவாக்கவும்", "Telugu": "మీ స్వంతం సృష్టించండి", "Marathi": "स्वतःची तयार करा",
        "Bengali": "আপনার নিজের তৈরি করুন", "Gujarati": "તમારી પોતાની બનાવો", "Punjabi": "ਆਪਣੀ ਬਣਾਓ",
        "Malayalam": "സ്വന്തമായി സൃഷ്ടിക്കുക", "Odia": "ନିଜର ତିଆରି କରନ୍ତୁ"
    },
    "Generating lesson plan": {
        "English": "Generating lesson plan", "Hindi": "पाठ योजना बनाई जा रही है", "Kannada": "ಪಾಠ ಯೋಜನೆ ರಚಿಸಲಾಗುತ್ತಿದೆ",
        "Tamil": "பாடத்திட்டம் உருவாக்கப்படுகிறது", "Telugu": "పాఠ్య ప్రణాళిక రూపొందిస్తున్నాం", "Marathi": "पाठ योजना तयार होत आहे",
        "Bengali": "পাঠ পরিকল্পনা তৈরি হচ্ছে", "Gujarati": "પાઠ યોજના તૈયાર કરી રહ્યા છે", "Punjabi": "ਪਾਠ ਯੋਜਨਾ ਬਣਾਈ ਜਾ ਰਹੀ ਹੈ",
        "Malayalam": "പാഠ പദ്ധതി സൃഷ്ടിക്കുന്നു", "Odia": "ପାଠ ଯୋଜନା ତିଆରି ହେଉଛି"
    },
    "Usually takes 20–30 seconds.": {
        "English": "Usually takes 20–30 seconds.",
        "Hindi": "आमतौर पर 20–30 सेकंड लगते हैं।",
        "Kannada": "ಸಾಮಾನ್ಯವಾಗಿ 20–30 ಸೆಕೆಂಡುಗಳು ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ.",
        "Tamil": "பொதுவாக 20–30 வினாடிகள் ஆகும்.",
        "Telugu": "సాధారణంగా 20–30 సెకన్లు పడుతుంది.",
        "Marathi": "सहसा 20–30 सेकंद लागतात.",
        "Bengali": "সাধারণত 20–30 সেকেন্ড লাগে।",
        "Gujarati": "સામાન્ય રીતે 20–30 સેકન્ડ લાગે છે.",
        "Punjabi": "ਆਮ ਤੌਰ 'ਤੇ 20–30 ਸਕਿੰਟ ਲੱਗਦੇ ਹਨ।",
        "Malayalam": "സാധാരണയായി 20–30 സെക്കൻഡ് എടുക്കും.",
        "Odia": "ସାଧାରଣତଃ 20–30 ସେକେଣ୍ଡ ଲାଗେ।"
    },
    "Learning objectives": {
        "English": "Learning objectives", "Hindi": "शिक्षण उद्देश्य", "Kannada": "ಕಲಿಕೆಯ ಉದ್ದೇಶಗಳು",
        "Tamil": "கற்றல் நோக்கங்கள்", "Telugu": "అభ్యాస లక్ష్యాలు", "Marathi": "शिकण्याची उद्दिष्टे",
        "Bengali": "শেখার লক্ষ্য", "Gujarati": "શીખવાના હેતુઓ", "Punjabi": "ਸਿੱਖਣ ਦੇ ਉਦੇਸ਼",
        "Malayalam": "പഠന ലക്ഷ്യങ്ങൾ", "Odia": "ଶିକ୍ଷଣ ଲକ୍ଷ୍ୟ"
    },
    "Please select your state first.": {
        "English": "Please select your state first.",
        "Hindi": "कृपया पहले अपना राज्य चुनें।",
        "Kannada": "ದಯವಿಟ್ಟು ಮೊದಲು ನಿಮ್ಮ ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
        "Tamil": "தயவுசெய்து முதலில் உங்கள் மாநிலத்தைத் தேர்ந்தெடுக்கவும்.",
        "Telugu": "దయచేసి మొదట మీ రాష్ట్రాన్ని ఎంచుకోండి.",
        "Marathi": "कृपया आधी तुमचे राज्य निवडा.",
        "Bengali": "অনুগ্রহ করে প্রথমে আপনার রাজ্য নির্বাচন করুন।",
        "Gujarati": "કૃપા કરીને પહેલા તમારું રાજ્ય પસંદ કરો.",
        "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ ਆਪਣਾ ਰਾਜ ਚੁਣੋ।",
        "Malayalam": "ദയവായി ആദ്യം നിങ്ങളുടെ സംസ്ഥാനം തിരഞ്ഞെടുക്കുക.",
        "Odia": "ଦୟାକରି ପ୍ରଥମେ ଆପଣଙ୍କ ରାଜ୍ୟ ବାଛନ୍ତୁ।"
    },
    "SahayakAI works in 11 Indian languages.": {
        "English": "SahayakAI works in 11 Indian languages.",
        "Hindi": "SahayakAI 11 भारतीय भाषाओं में काम करता है।",
        "Kannada": "SahayakAI 11 ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.",
        "Tamil": "SahayakAI 11 இந்திய மொழிகளில் வேலை செய்கிறது.",
        "Telugu": "SahayakAI 11 భారతీయ భాషల్లో పనిచేస్తుంది.",
        "Marathi": "SahayakAI 11 भारतीय भाषांमध्ये कार्य करते.",
        "Bengali": "SahayakAI 11টি ভারতীয় ভাষায় কাজ করে।",
        "Gujarati": "SahayakAI 11 ભારતીય ભાષાઓમાં કામ કરે છે.",
        "Punjabi": "SahayakAI 11 ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਕੰਮ ਕਰਦਾ ਹੈ।",
        "Malayalam": "SahayakAI 11 ഇന്ത്യൻ ഭാഷകളിൽ പ്രവർത്തിക്കുന്നു.",
        "Odia": "SahayakAI 11 ଟି ଭାରତୀୟ ଭାଷାରେ କାମ କରେ।"
    },
    "We use this to personalise lesson plans, quizzes, and the community feed.": {
        "English": "We use this to personalise lesson plans, quizzes, and the community feed.",
        "Hindi": "हम इसका उपयोग पाठ योजनाओं, प्रश्नोत्तरी और समुदाय फ़ीड को वैयक्तिकृत करने के लिए करते हैं।",
        "Kannada": "ಪಾಠ ಯೋಜನೆಗಳು, ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಸಮುದಾಯ ಫೀಡ್ ಅನ್ನು ವೈಯಕ್ತಿಕಗೊಳಿಸಲು ನಾವು ಇದನ್ನು ಬಳಸುತ್ತೇವೆ.",
        "Tamil": "பாடத்திட்டங்கள், வினாடி வினாக்கள் மற்றும் சமூக ஊட்டத்தைத் தனிப்பயனாக்க இதைப் பயன்படுத்துகிறோம்.",
        "Telugu": "పాఠ్య ప్రణాళికలు, క్విజ్‌లు మరియు కమ్యూనిటీ ఫీడ్‌ను వ్యక్తిగతీకరించడానికి మేము దీన్ని ఉపయోగిస్తాము.",
        "Marathi": "आम्ही याचा वापर पाठ योजना, प्रश्नमंजूषा आणि समुदाय फीड वैयक्तिकृत करण्यासाठी करतो.",
        "Bengali": "পাঠ পরিকল্পনা, কুইজ এবং কমিউনিটি ফিড কাস্টমাইজ করতে আমরা এটি ব্যবহার করি।",
        "Gujarati": "અમે આનો ઉપયોગ પાઠ યોજનાઓ, ક્વિઝ અને સમુદાય ફીડને વ્યક્તિગત કરવા માટે કરીએ છીએ.",
        "Punjabi": "ਅਸੀਂ ਇਸਦੀ ਵਰਤੋਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕੁਇਜ਼ਾਂ ਅਤੇ ਕਮਿਊਨਿਟੀ ਫੀਡ ਨੂੰ ਨਿੱਜੀ ਬਣਾਉਣ ਲਈ ਕਰਦੇ ਹਾਂ।",
        "Malayalam": "പാഠ പദ്ധതികൾ, ക്വിസുകൾ, കമ്മ്യൂണിറ്റി ഫീഡ് എന്നിവ വ്യക്തിപരമാക്കാൻ ഞങ്ങൾ ഇത് ഉപയോഗിക്കുന്നു.",
        "Odia": "ଆମେ ଏହାକୁ ପାଠ ଯୋଜନା, କୁଇଜ୍ ଓ ସମ୍ପ୍ରଦାୟ ଫିଡ୍ ବ୍ୟକ୍ତିଗତ କରିବା ପାଇଁ ବ୍ୟବହାର କରୁ।"
    },
    "A few more details so we can recommend better content.": {
        "English": "A few more details so we can recommend better content.",
        "Hindi": "कुछ और जानकारी ताकि हम बेहतर सामग्री की सिफ़ारिश कर सकें।",
        "Kannada": "ಉತ್ತಮ ವಿಷಯವನ್ನು ಶಿಫಾರಸು ಮಾಡಲು ಇನ್ನೂ ಕೆಲವು ವಿವರಗಳು.",
        "Tamil": "சிறந்த உள்ளடக்கத்தை பரிந்துரைக்க இன்னும் சில விவரங்கள்.",
        "Telugu": "మెరుగైన కంటెంట్‌ను సిఫారసు చేయడానికి మరికొన్ని వివరాలు.",
        "Marathi": "अधिक चांगली सामग्री शिफारस करण्यासाठी आणखी काही तपशील.",
        "Bengali": "আরও ভালো কন্টেন্ট সুপারিশ করতে আরও কিছু বিবরণ।",
        "Gujarati": "વધુ સારી સામગ્રી સૂચવવા માટે થોડા વધુ વિગતો.",
        "Punjabi": "ਬਿਹਤਰ ਸਮੱਗਰੀ ਸੁਝਾਉਣ ਲਈ ਕੁਝ ਹੋਰ ਵੇਰਵੇ।",
        "Malayalam": "മികച്ച ഉള്ളടക്കം ശുപാർശ ചെയ്യാൻ ഏതാനും വിശദാംശങ്ങൾ കൂടി.",
        "Odia": "ଭଲ ବିଷୟବସ୍ତୁ ସୁପାରିଶ କରିବା ପାଇଁ ଆଉ କିଛି ବିବରଣୀ।"
    },
    "Get Started": {
        "English": "Get Started", "Hindi": "शुरू करें", "Kannada": "ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "தொடங்கு", "Telugu": "ప్రారంభించండి", "Marathi": "सुरू करा",
        "Bengali": "শুরু করুন", "Gujarati": "શરૂ કરો", "Punjabi": "ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "ആരംഭിക്കുക", "Odia": "ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Teachers across Bharat are sharing resources": {
        "English": "Teachers across Bharat are sharing resources on SahayakAI",
        "Hindi": "पूरे भारत के शिक्षक SahayakAI पर संसाधन साझा कर रहे हैं",
        "Kannada": "ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರು SahayakAI ನಲ್ಲಿ ಸಂಪನ್ಮೂಲಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳುತ್ತಿದ್ದಾರೆ",
        "Tamil": "பாரதம் முழுவதும் ஆசிரியர்கள் SahayakAI இல் வளங்களைப் பகிர்கிறார்கள்",
        "Telugu": "భారతదేశంలోని ఉపాధ్యాయులు SahayakAI లో వనరులు పంచుకుంటున్నారు",
        "Marathi": "संपूर्ण भारतातील शिक्षक SahayakAI वर संसाधने शेअर करत आहेत",
        "Bengali": "সারা ভারতের শিক্ষকরা SahayakAI-তে রিসোর্স শেয়ার করছেন",
        "Gujarati": "સમગ્ર ભારતના શિક્ષકો SahayakAI પર સંસાધનો શેર કરી રહ્યા છે",
        "Punjabi": "ਪੂਰੇ ਭਾਰਤ ਦੇ ਅਧਿਆਪਕ SahayakAI 'ਤੇ ਸਰੋਤ ਸਾਂਝੇ ਕਰ ਰਹੇ ਹਨ",
        "Malayalam": "ഭാരതത്തിലെ അധ്യാപകർ SahayakAI-ൽ വിഭവങ്ങൾ പങ്കിടുന്നു",
        "Odia": "ସମସ୍ତ ଭାରତର ଶିକ୍ଷକମାନେ SahayakAI ରେ ସମ୍ବଳ ବାଣ୍ଟୁଛନ୍ତି"
    },
    "Explore Community": {
        "English": "Explore Community", "Hindi": "समुदाय देखें", "Kannada": "ಸಮುದಾಯ ಅನ್ವೇಷಿಸಿ",
        "Tamil": "சமூகத்தை ஆராயுங்கள்", "Telugu": "సంఘాన్ని అన్వేషించండి", "Marathi": "समुदाय पहा",
        "Bengali": "সম্প্রদায় অন্বেষণ করুন", "Gujarati": "સમુદાય શોધો", "Punjabi": "ਭਾਈਚਾਰਾ ਦੇਖੋ",
        "Malayalam": "കമ്മ്യൂണിറ്റി പര്യവേക്ഷിക്കുക", "Odia": "ସମ୍ପ୍ରଦାୟ ଅନ୍ଵେଷଣ କରନ୍ତୁ"
    },
    "Maybe Later": {
        "English": "Maybe Later", "Hindi": "बाद में", "Kannada": "ನಂತರ",
        "Tamil": "பின்னர்", "Telugu": "తర్వాత", "Marathi": "नंतर",
        "Bengali": "পরে", "Gujarati": "પછી", "Punjabi": "ਬਾਅਦ ਵਿੱਚ",
        "Malayalam": "പിന്നീട്", "Odia": "ପରେ"
    },
    "Tell us about your teaching": {
        "English": "Tell us about your teaching", "Hindi": "अपने पढ़ाने के बारे में बताएँ", "Kannada": "ನಿಮ್ಮ ಬೋಧನೆ ಬಗ್ಗೆ ತಿಳಿಸಿ",
        "Tamil": "உங்கள் கற்பித்தல் பற்றி சொல்லுங்கள்", "Telugu": "మీ బోధన గురించి చెప్పండి", "Marathi": "तुमच्या शिकवण्याबद्दल सांगा",
        "Bengali": "আপনার শেখানো সম্পর্কে বলুন", "Gujarati": "તમારા શિક્ષણ વિશે જણાવો", "Punjabi": "ਆਪਣੀ ਪੜ੍ਹਾਈ ਬਾਰੇ ਦੱਸੋ",
        "Malayalam": "നിങ്ങളുടെ അധ്യാപനത്തെ കുറിച്ച് പറയൂ", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷାଦାନ ବିଷୟରେ କୁହନ୍ତୁ"
    },
    "Show me what SahayakAI can do": {
        "English": "Show me what SahayakAI can do", "Hindi": "दिखाएँ SahayakAI क्या कर सकता है", "Kannada": "SahayakAI ಏನು ಮಾಡಬಹುದು ತೋರಿಸಿ",
        "Tamil": "SahayakAI என்ன செய்ய முடியும் காட்டுங்கள்", "Telugu": "SahayakAI ఏమి చేయగలదో చూపించండి", "Marathi": "SahayakAI काय करू शकते ते दाखवा",
        "Bengali": "SahayakAI কী করতে পারে দেখান", "Gujarati": "SahayakAI શું કરી શકે તે બતાવો", "Punjabi": "ਦਿਖਾਓ SahayakAI ਕੀ ਕਰ ਸਕਦਾ ਹੈ",
        "Malayalam": "SahayakAI എന്ത് ചെയ്യാമെന്ന് കാണിക്കൂ", "Odia": "SahayakAI କ'ଣ କରିପାରିବ ଦେଖାନ୍ତୁ"
    },
    "Here is what SahayakAI creates for you": {
        "English": "Here is what SahayakAI creates for you", "Hindi": "ये रहा SahayakAI का बनाया सैम्पल", "Kannada": "SahayakAI ನಿಮಗಾಗಿ ಇದನ್ನು ರಚಿಸಿದೆ",
        "Tamil": "SahayakAI உங்களுக்காக உருவாக்கியது", "Telugu": "SahayakAI మీ కోసం ఇది సృష్టించింది", "Marathi": "SahayakAI ने तुमच्यासाठी हे तयार केले",
        "Bengali": "SahayakAI আপনার জন্য এটি তৈরি করেছে", "Gujarati": "SahayakAI એ તમારા માટે આ બનાવ્યું", "Punjabi": "SahayakAI ਨੇ ਤੁਹਾਡੇ ਲਈ ਇਹ ਬਣਾਇਆ",
        "Malayalam": "SahayakAI നിങ്ങൾക്കായി ഇത് സൃഷ്ടിച്ചു", "Odia": "SahayakAI ଆପଣଙ୍କ ପାଇଁ ଏହା ତିଆରି କଲା"
    },
    "Now create one for your topic": {
        "English": "Now create one for your topic", "Hindi": "अब अपने विषय पर एक बनाएँ", "Kannada": "ಈಗ ನಿಮ್ಮ ವಿಷಯಕ್ಕೆ ಒಂದನ್ನು ರಚಿಸಿ",
        "Tamil": "இப்போது உங்கள் தலைப்பிற்கு ஒன்றை உருவாக்கவும்", "Telugu": "ఇప్పుడు మీ అంశానికి ఒకటి సృష్టించండి", "Marathi": "आता तुमच्या विषयावर एक बनवा",
        "Bengali": "এখন আপনার বিষয়ে একটি তৈরি করুন", "Gujarati": "હવે તમારા વિષય પર એક બનાવો", "Punjabi": "ਹੁਣ ਆਪਣੇ ਵਿਸ਼ੇ ਲਈ ਇੱਕ ਬਣਾਓ",
        "Malayalam": "ഇപ്പോൾ നിങ്ങളുടെ വിഷയത്തിന് ഒന്ന് സൃഷ്ടിക്കുക", "Odia": "ଏବେ ଆପଣଙ୍କ ବିଷୟ ପାଇଁ ଗୋଟିଏ ତିଆରି କରନ୍ତୁ"
    },
    "Save and Start": {
        "English": "Save and Start", "Hindi": "सेव करें और शुरू करें", "Kannada": "ಉಳಿಸಿ ಮತ್ತು ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "சேமித்து தொடங்கு", "Telugu": "సేవ్ చేసి ప్రారంభించండి", "Marathi": "सेव्ह करा आणि सुरू करा",
        "Bengali": "সেভ করুন এবং শুরু করুন", "Gujarati": "સેવ કરો અને શરૂ કરો", "Punjabi": "ਸੇਵ ਕਰੋ ਅਤੇ ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "സേവ് ചെയ്ത് ആരംഭിക്കുക", "Odia": "ସେଭ୍ କରନ୍ତୁ ଏବଂ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "I will explore on my own": {
        "English": "I'll explore on my own", "Hindi": "मैं खुद देखूँगा", "Kannada": "ನಾನೇ ಅನ್ವೇಷಿಸುತ್ತೇನೆ",
        "Tamil": "நானே பார்த்துக் கொள்கிறேன்", "Telugu": "నేనే చూసుకుంటాను", "Marathi": "मी स्वतः पाहतो",
        "Bengali": "আমি নিজে দেখব", "Gujarati": "હું જાતે જોઈશ", "Punjabi": "ਮੈਂ ਆਪ ਦੇਖਾਂਗਾ",
        "Malayalam": "ഞാൻ സ്വയം പര്യവേക്ഷിക്കും", "Odia": "ମୁଁ ନିଜେ ଦେଖିବି"
    },
    "Ideas for your classes": {
        "English": "Ideas for your classes", "Hindi": "आपकी कक्षाओं के लिए आइडिया", "Kannada": "ನಿಮ್ಮ ತರಗತಿಗಳಿಗೆ ಐಡಿಯಾಗಳು",
        "Tamil": "உங்கள் வகுப்புகளுக்கான யோசனைகள்", "Telugu": "మీ తరగతులకు ఆలోచనలు", "Marathi": "तुमच्या वर्गांसाठी कल्पना",
        "Bengali": "আপনার ক্লাসের জন্য আইডিয়া", "Gujarati": "તમારા વર્ગો માટે આઈડિયા", "Punjabi": "ਤੁਹਾਡੀਆਂ ਜਮਾਤਾਂ ਲਈ ਵਿਚਾਰ",
        "Malayalam": "നിങ്ങളുടെ ക്ലാസുകൾക്കുള്ള ആശയങ്ങൾ", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀ ପାଇଁ ଆଇଡିଆ"
    },
    "See all tools": {
        "English": "See all tools", "Hindi": "सभी टूल्स देखें", "Kannada": "ಎಲ್ಲಾ ಟೂಲ್ಸ್ ನೋಡಿ",
        "Tamil": "அனைத்து கருவிகளையும் பார்க்கவும்", "Telugu": "అన్ని టూల్స్ చూడండి", "Marathi": "सर्व टूल्स पहा",
        "Bengali": "সব টুলস দেখুন", "Gujarati": "બધા ટૂલ્સ જુઓ", "Punjabi": "ਸਾਰੇ ਟੂਲ ਦੇਖੋ",
        "Malayalam": "എല്ലാ ടൂളുകളും കാണുക", "Odia": "ସବୁ ଟୁଲ୍ସ ଦେଖନ୍ତୁ"
    },
    "Complete your profile": {
        "English": "Complete your profile", "Hindi": "अपनी प्रोफ़ाइल पूरी करें", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ",
        "Tamil": "உங்கள் சுயவிவரத்தை முடிக்கவும்", "Telugu": "మీ ప్రొఫైల్ పూర్తి చేయండి", "Marathi": "तुमची प्रोफाईल पूर्ण करा",
        "Bengali": "আপনার প্রোফাইল সম্পন্ন করুন", "Gujarati": "તમારી પ્રોફાઇલ પૂર્ણ કરો", "Punjabi": "ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ",
        "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കുക", "Odia": "ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ"
    },
    "Create this": {
        "English": "Create", "Hindi": "बनाएँ", "Kannada": "ರಚಿಸಿ",
        "Tamil": "உருவாக்கு", "Telugu": "సృష్టించండి", "Marathi": "बनवा",
        "Bengali": "তৈরি করুন", "Gujarati": "બનાવો", "Punjabi": "ਬਣਾਓ",
        "Malayalam": "സൃഷ്ടിക്കുക", "Odia": "ତିଆରି କରନ୍ତୁ"
    },
    "Lesson Plan": {
        "English": "Lesson Plan", "Hindi": "पाठ योजना", "Kannada": "ಪಾಠ ಯೋಜನೆ",
        "Tamil": "பாடத் திட்டம்", "Telugu": "పాఠ ప్రణాళిక", "Marathi": "पाठ योजना",
        "Bengali": "পাঠ পরিকল্পনা", "Gujarati": "પાઠ યોજના", "Punjabi": "ਪਾਠ ਯੋਜਨਾ",
        "Malayalam": "പാഠ പദ്ധതി", "Odia": "ପାଠ ଯୋଜନା"
    },
    "Quiz": {
        "English": "Quiz", "Hindi": "क्विज़", "Kannada": "ಕ್ವಿಜ್",
        "Tamil": "வினாடி வினா", "Telugu": "క్విజ్", "Marathi": "क्विझ",
        "Bengali": "কুইজ", "Gujarati": "ક્વિઝ", "Punjabi": "ਕੁਇਜ਼",
        "Malayalam": "ക്വിസ്", "Odia": "କୁଇଜ୍"
    },
    "Visual Aid": {
        "English": "Visual Aid", "Hindi": "विज़ुअल एड", "Kannada": "ವಿಷುಯಲ್ ಏಡ್",
        "Tamil": "காட்சி உதவி", "Telugu": "విజువల్ ఎయిడ్", "Marathi": "व्हिज्युअल एड",
        "Bengali": "ভিজ্যুয়াল এইড", "Gujarati": "વિઝ્યુઅલ એઇડ", "Punjabi": "ਵਿਜ਼ੂਅਲ ਏਡ",
        "Malayalam": "വിഷ്വൽ എയ്ഡ്", "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍"
    },
    "School / Institution Name": {
        "English": "School / Institution Name", "Hindi": "विद्यालय / संस्था का नाम", "Kannada": "ಶಾಲೆ / ಸಂಸ್ಥೆಯ ಹೆಸರು",
        "Tamil": "பள்ளி / நிறுவனத்தின் பெயர்", "Telugu": "పాఠశాల / సంస్థ పేరు", "Marathi": "शाळा / संस्थेचे नाव",
        "Bengali": "বিদ্যালয় / প্রতিষ্ঠানের নাম", "Gujarati": "શાળા / સંસ્થાનું નામ", "Punjabi": "ਸਕੂਲ / ਸੰਸਥਾ ਦਾ ਨਾਮ",
        "Malayalam": "സ്കൂൾ / സ്ഥാപനത്തിന്റെ പേര്", "Odia": "ବିଦ୍ୟାଳୟ / ସଂସ୍ଥାର ନାମ"
    },
    "State": {
        "English": "State", "Hindi": "राज्य", "Kannada": "ರಾಜ್ಯ",
        "Tamil": "மாநிலம்", "Telugu": "రాష్ట్రం", "Marathi": "राज्य",
        "Bengali": "রাজ্য", "Gujarati": "રાજ્ય", "Punjabi": "ਰਾਜ",
        "Malayalam": "സംസ്ഥാനം", "Odia": "ରାଜ୍ୟ"
    },
    "Education Board": {
        "English": "Education Board", "Hindi": "शिक्षा बोर्ड", "Kannada": "ಶಿಕ್ಷಣ ಮಂಡಳಿ",
        "Tamil": "கல்வி வாரியம்", "Telugu": "విద్యా బోర్డు", "Marathi": "शिक्षण मंडळ",
        "Bengali": "শিক্ষা বোর্ড", "Gujarati": "શિક્ષણ બોર્ડ", "Punjabi": "ਸਿੱਖਿਆ ਬੋਰਡ",
        "Malayalam": "വിദ്യാഭ്യാസ ബോർഡ്", "Odia": "ଶିକ୍ଷା ବୋର୍ଡ"
    },
    "Subjects": {
        "English": "Subjects", "Hindi": "विषय", "Kannada": "ವಿಷಯಗಳು",
        "Tamil": "பாடங்கள்", "Telugu": "విషయాలు", "Marathi": "विषय",
        "Bengali": "বিষয়", "Gujarati": "વિષયો", "Punjabi": "ਵਿਸ਼ੇ",
        "Malayalam": "വിഷയങ്ങൾ", "Odia": "ବିଷୟ"
    },
    "Classes": {
        "English": "Classes", "Hindi": "कक्षाएँ", "Kannada": "ತರಗತಿಗಳು",
        "Tamil": "வகுப்புகள்", "Telugu": "తరగతులు", "Marathi": "वर्ग",
        "Bengali": "শ্রেণি", "Gujarati": "વર્ગો", "Punjabi": "ਜਮਾਤਾਂ",
        "Malayalam": "ക്ലാസുകൾ", "Odia": "ଶ୍ରେଣୀ"
    },
    "Join groups and share resources": {
        "English": "Join subject groups, share your lesson plans, and discover what others are creating.",
        "Hindi": "विषय समूहों में शामिल हों, अपनी पाठ योजनाएं साझा करें, और देखें दूसरे क्या बना रहे हैं।",
        "Kannada": "ವಿಷಯ ಗುಂಪುಗಳನ್ನು ಸೇರಿ, ನಿಮ್ಮ ಪಾಠ ಯೋಜನೆಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ, ಮತ್ತು ಇತರರು ಏನು ರಚಿಸುತ್ತಿದ್ದಾರೆ ಎಂದು ಅನ್ವೇಷಿಸಿ।",
        "Tamil": "பாடக் குழுக்களில் சேருங்கள், உங்கள் பாடத் திட்டங்களைப் பகிருங்கள், மற்றவர்கள் என்ன உருவாக்குகிறார்கள் என்பதைக் கண்டறியுங்கள்.",
        "Telugu": "సబ్జెక్ట్ గ్రూపులలో చేరండి, మీ పాఠ ప్రణాళికలను పంచుకోండి, ఇతరులు ఏమి సృష్టిస్తున్నారో కనుగొనండి.",
        "Marathi": "विषय गटात सामील व्हा, तुमच्या पाठ योजना शेअर करा, आणि इतर काय बनवत आहेत ते पहा.",
        "Bengali": "বিষয় গ্রুপে যোগ দিন, আপনার পাঠ পরিকল্পনা শেয়ার করুন, এবং অন্যরা কী তৈরি করছে তা দেখুন।",
        "Gujarati": "વિષય જૂથોમાં જોડાઓ, તમારી પાઠ યોજનાઓ શેર કરો, અને અન્ય શું બનાવી રહ્યા છે તે શોધો.",
        "Punjabi": "ਵਿਸ਼ਾ ਗਰੁੱਪਾਂ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ, ਆਪਣੀਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ ਸਾਂਝੀਆਂ ਕਰੋ, ਅਤੇ ਦੇਖੋ ਦੂਸਰੇ ਕੀ ਬਣਾ ਰਹੇ ਹਨ।",
        "Malayalam": "വിഷയ ഗ്രൂപ്പുകളിൽ ചേരുക, നിങ്ങളുടെ പാഠ പ്ലാനുകൾ പങ്കിടുക, മറ്റുള്ളവർ എന്താണ് സൃഷ്ടിക്കുന്നതെന്ന് കണ്ടെത്തുക.",
        "Odia": "ବିଷୟ ଗ୍ରୁପରେ ଯୋଗ ଦିଅନ୍ତୁ, ଆପଣଙ୍କ ପାଠ ଯୋଜନା ବାଣ୍ଟନ୍ତୁ, ଏବଂ ଅନ୍ୟମାନେ କ'ଣ ତିଆରି କରୁଛନ୍ତି ଦେଖନ୍ତୁ।"
    },
    "Help us personalize your experience": {
        "English": "Help us personalize your experience",
        "Hindi": "आपके अनुभव को बेहतर बनाने में मदद करें",
        "Kannada": "ನಿಮ್ಮ ಅನುಭವವನ್ನು ವೈಯಕ್ತೀಕರಿಸಲು ಸಹಾಯ ಮಾಡಿ",
        "Tamil": "உங்கள் அனுபவத்தைத் தனிப்பயனாக்க உதவுங்கள்",
        "Telugu": "మీ అనుభవాన్ని వ్యక్తిగతీకరించడంలో సహాయపడండి",
        "Marathi": "तुमचा अनुभव वैयक्तिकृत करण्यास मदत करा",
        "Bengali": "আপনার অভিজ্ঞতা ব্যক্তিগতকৃত করতে সাহায্য করুন",
        "Gujarati": "તમારો અનુભવ વ્યક્તિગત બનાવવામાં મદદ કરો",
        "Punjabi": "ਆਪਣਾ ਅਨੁਭਵ ਨਿੱਜੀ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰੋ",
        "Malayalam": "നിങ്ങളുടെ അനുഭവം വ്യക്തിഗതമാക്കാൻ സഹായിക്കുക",
        "Odia": "ଆପଣଙ୍କ ଅନୁଭୂତି ବ୍ୟକ୍ତିଗତ କରିବାରେ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    "Select your state": {
        "English": "Select your state",
        "Hindi": "अपना राज्य चुनें",
        "Kannada": "ನಿಮ್ಮ ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        "Tamil": "உங்கள் மாநிலத்தைத் தேர்ந்தெடுக்கவும்",
        "Telugu": "మీ రాష్ట్రాన్ని ఎంచుకోండి",
        "Marathi": "तुमचे राज्य निवडा",
        "Bengali": "আপনার রাজ্য নির্বাচন করুন",
        "Gujarati": "તમારું રાજ્ય પસંદ કરો",
        "Punjabi": "ਆਪਣਾ ਰਾਜ ਚੁਣੋ",
        "Malayalam": "നിങ്ങളുടെ സംസ്ഥാനം തിരഞ്ഞെടുക്കുക",
        "Odia": "ଆପଣଙ୍କ ରାଜ୍ୟ ବାଛନ୍ତୁ"
    },
    "e.g. Kendriya Vidyalaya, Delhi": {
        "English": "e.g. Kendriya Vidyalaya, Delhi",
        "Hindi": "उदाहरण: केंद्रीय विद्यालय, दिल्ली",
        "Kannada": "ಉದಾಹರಣೆ: ಕೇಂದ್ರೀಯ ವಿದ್ಯಾಲಯ, ದೆಹಲಿ",
        "Tamil": "உதாரணம்: கேந்த்ரிய வித்யாலயா, டெல்லி",
        "Telugu": "ఉదాహరణ: కేంద్రీయ విద్యాలయం, ఢిల్లీ",
        "Marathi": "उदा. केंद्रीय विद्यालय, दिल्ली",
        "Bengali": "উদাহরণ: কেন্দ্রীয় বিদ্যালয়, দিল্লি",
        "Gujarati": "ઉદા. કેન્દ્રીય વિદ્યાલય, દિલ્હી",
        "Punjabi": "ਜਿਵੇਂ ਕੇਂਦਰੀ ਵਿਦਿਆਲਾ, ਦਿੱਲੀ",
        "Malayalam": "ഉദാ. കേന്ദ്രീയ വിദ്യാലയം, ഡൽഹി",
        "Odia": "ଯଥା: କେନ୍ଦ୍ରୀୟ ବିଦ୍ୟାଳୟ, ଦିଲ୍ଲୀ"
    },
    "Learning Objectives": {
        "English": "Learning Objectives",
        "Hindi": "सीखने के उद्देश्य",
        "Kannada": "ಕಲಿಕಾ ಉದ್ದೇಶಗಳು",
        "Tamil": "கற்றல் நோக்கங்கள்",
        "Telugu": "అభ్యాస లక్ష్యాలు",
        "Marathi": "शिकण्याची उद्दिष्टे",
        "Bengali": "শেখার উদ্দেশ্য",
        "Gujarati": "શીખવાના ઉદ્દેશ્યો",
        "Punjabi": "ਸਿੱਖਣ ਦੇ ਉਦੇਸ਼",
        "Malayalam": "പഠന ലക്ഷ്യങ്ങൾ",
        "Odia": "ଶିକ୍ଷା ଉଦ୍ଦେଶ୍ୟ"
    },
    "Activities": {
        "English": "Activities",
        "Hindi": "गतिविधियाँ",
        "Kannada": "ಚಟುವಟಿಕೆಗಳು",
        "Tamil": "செயல்பாடுகள்",
        "Telugu": "కార్యకలాపాలు",
        "Marathi": "कृती",
        "Bengali": "কার্যকলাপ",
        "Gujarati": "પ્રવૃત્તિઓ",
        "Punjabi": "ਗਤੀਵਿਧੀਆਂ",
        "Malayalam": "പ്രവർത്തനങ്ങൾ",
        "Odia": "କାର୍ଯ୍ୟକଳାପ"
    },
    "Show fewer": {
        "English": "Show fewer",
        "Hindi": "कम दिखाएँ",
        "Kannada": "ಕಡಿಮೆ ತೋರಿಸಿ",
        "Tamil": "குறைவாகக் காட்டு",
        "Telugu": "తక్కువ చూపించు",
        "Marathi": "कमी दाखवा",
        "Bengali": "কম দেখান",
        "Gujarati": "ઓછું બતાવો",
        "Punjabi": "ਘੱਟ ਦਿਖਾਓ",
        "Malayalam": "കുറച്ച് കാണിക്കുക",
        "Odia": "କମ ଦେଖାନ୍ତୁ"
    },
    // {n} placeholder is replaced by the real count at render time.
    "Show all {n} activities": {
        "English": "Show all {n} activities",
        "Hindi": "सभी {n} गतिविधियाँ दिखाएँ",
        "Kannada": "ಎಲ್ಲಾ {n} ಚಟುವಟಿಕೆಗಳನ್ನು ತೋರಿಸಿ",
        "Tamil": "அனைத்து {n} செயல்பாடுகளையும் காட்டு",
        "Telugu": "అన్ని {n} కార్యకలాపాలను చూపించు",
        "Marathi": "सर्व {n} कृती दाखवा",
        "Bengali": "সব {n} কার্যকলাপ দেখান",
        "Gujarati": "બધી {n} પ્રવૃત્તિઓ બતાવો",
        "Punjabi": "ਸਾਰੀਆਂ {n} ਗਤੀਵਿਧੀਆਂ ਦਿਖਾਓ",
        "Malayalam": "എല്ലാ {n} പ്രവർത്തനങ്ങളും കാണിക്കുക",
        "Odia": "ସମସ୍ତ {n} କାର୍ଯ୍ୟକଳାପ ଦେଖାନ୍ତୁ"
    },
    // 5E pedagogy phase labels. Data file always stores these in English;
    // t() translates at render time so Hindi + other UIs show the native term.
    "Engage": {
        "English": "Engage",
        "Hindi": "जुड़ाव",
        "Kannada": "ತೊಡಗಿಸು",
        "Tamil": "ஈடுபடுத்து",
        "Telugu": "నిమగ్నమవ్వండి",
        "Marathi": "सहभागी व्हा",
        "Bengali": "যুক্ত হন",
        "Gujarati": "જોડાઓ",
        "Punjabi": "ਜੁੜੋ",
        "Malayalam": "ഇടപെടൽ",
        "Odia": "ଯୋଡ଼ନ୍ତୁ"
    },
    "Explore": {
        "English": "Explore",
        "Hindi": "अन्वेषण",
        "Kannada": "ಅನ್ವೇಷಣೆ",
        "Tamil": "ஆராய்",
        "Telugu": "అన్వేషించండి",
        "Marathi": "शोध",
        "Bengali": "অন্বেষণ",
        "Gujarati": "અન્વેષણ",
        "Punjabi": "ਖੋਜੋ",
        "Malayalam": "പര്യവേക്ഷണം",
        "Odia": "ଅନ୍ୱେଷଣ"
    },
    "Explain": {
        "English": "Explain",
        "Hindi": "व्याख्या",
        "Kannada": "ವಿವರಿಸು",
        "Tamil": "விளக்கு",
        "Telugu": "వివరించండి",
        "Marathi": "स्पष्टीकरण",
        "Bengali": "ব্যাখ্যা",
        "Gujarati": "સમજાવો",
        "Punjabi": "ਸਮਝਾਓ",
        "Malayalam": "വിശദീകരിക്കുക",
        "Odia": "ବ୍ୟାଖ୍ୟା"
    },
    "Elaborate": {
        "English": "Elaborate",
        "Hindi": "विस्तार",
        "Kannada": "ವಿಸ್ತರಿಸು",
        "Tamil": "விரிவுபடுத்து",
        "Telugu": "విస్తరించండి",
        "Marathi": "विस्तार",
        "Bengali": "বিস্তারিত",
        "Gujarati": "વિસ્તૃત કરો",
        "Punjabi": "ਵਿਸਤਾਰ",
        "Malayalam": "വിശദമാക്കുക",
        "Odia": "ବିସ୍ତାର"
    },
    "Evaluate": {
        "English": "Evaluate",
        "Hindi": "मूल्यांकन",
        "Kannada": "ಮೌಲ್ಯಮಾಪನ",
        "Tamil": "மதிப்பீடு",
        "Telugu": "మూల్యాంకనం",
        "Marathi": "मूल्यमापन",
        "Bengali": "মূল্যায়ন",
        "Gujarati": "મૂલ્યાંકન",
        "Punjabi": "ਮੁਲਾਂਕਣ",
        "Malayalam": "വിലയിരുത്തൽ",
        "Odia": "ମୂଲ୍ୟାୟନ"
    },
    "AI-Powered Teaching Assistant for Bharat": {
        "English": "AI-Powered Teaching Assistant for Bharat",
        "Hindi": "भारत के शिक्षकों के लिए AI सहायक",
        "Kannada": "ಭಾರತದ ಶಿಕ್ಷಕರಿಗಾಗಿ AI ಸಹಾಯಕ",
        "Tamil": "பாரதத்தின் ஆசிரியர்களுக்கான AI உதவியாளர்",
        "Telugu": "భారత ఉపాధ్యాయుల కోసం AI సహాయకుడు",
        "Marathi": "भारताच्या शिक्षकांसाठी AI सहाय्यक",
        "Bengali": "ভারতের শিক্ষকদের জন্য AI সহায়ক",
        "Gujarati": "ભારતના શિક્ષકો માટે AI સહાયક",
        "Punjabi": "ਭਾਰਤ ਦੇ ਅਧਿਆਪਕਾਂ ਲਈ AI ਸਹਾਇਕ",
        "Malayalam": "ഭാരതത്തിലെ അധ്യാപകർക്കായുള്ള AI സഹായി",
        "Odia": "ଭାରତର ଶିକ୍ଷକମାନଙ୍କ ପାଇଁ AI ସହାୟକ"
    },
    "Thinking": {
        "English": "Thinking",
        "Hindi": "सोच रहा हूँ",
        "Kannada": "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ",
        "Tamil": "சிந்திக்கிறேன்",
        "Telugu": "ఆలోచిస్తున్నాను",
        "Marathi": "विचार करत आहे",
        "Bengali": "চিন্তা করছি",
        "Gujarati": "વિચારી રહ્યો છું",
        "Punjabi": "ਸੋਚ ਰਿਹਾ ਹਾਂ",
        "Malayalam": "ചിന്തിക്കുന്നു",
        "Odia": "ଚିନ୍ତା କରୁଛି"
    },
    "Answer": {
        "English": "Answer",
        "Hindi": "उत्तर",
        "Kannada": "ಉತ್ತರ",
        "Tamil": "பதில்",
        "Telugu": "సమాధానం",
        "Marathi": "उत्तर",
        "Bengali": "উত্তর",
        "Gujarati": "જવાબ",
        "Punjabi": "ਜਵਾਬ",
        "Malayalam": "ഉത്തരം",
        "Odia": "ଉତ୍ତର"
    },
    "Show different ideas": {
        "English": "Show different ideas",
        "Hindi": "अलग सुझाव दिखाएँ",
        "Kannada": "ಬೇರೆ ಆಲೋಚನೆಗಳನ್ನು ತೋರಿಸಿ",
        "Tamil": "வேறு யோசனைகளைக் காட்டு",
        "Telugu": "వేరే ఆలోచనలను చూపించు",
        "Marathi": "वेगळ्या कल्पना दाखवा",
        "Bengali": "ভিন্ন ধারণা দেখান",
        "Gujarati": "અલગ વિચારો બતાવો",
        "Punjabi": "ਵੱਖ-ਵੱਖ ਸੁਝਾਅ ਦਿਖਾਓ",
        "Malayalam": "വ്യത്യസ്ത ആശയങ്ങൾ കാണിക്കുക",
        "Odia": "ଭିନ୍ନ ଚିନ୍ତାଧାରା ଦେଖାନ୍ତୁ"
    },
    "Sign in with Google": {
        "English": "Sign in with Google",
        "Hindi": "Google से साइन इन करें",
        "Kannada": "Google ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "Google மூலம் உள்நுழைக",
        "Telugu": "Google తో సైన్ ఇన్ చేయండి",
        "Marathi": "Google ने साइन इन करा",
        "Bengali": "Google দিয়ে সাইন ইন করুন",
        "Gujarati": "Google સાથે સાઇન ઇન કરો",
        "Punjabi": "Google ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "Google ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക",
        "Odia": "Google ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign-in Failed": {
        "English": "Sign-in Failed",
        "Hindi": "साइन इन विफल",
        "Kannada": "ಸೈನ್ ಇನ್ ವಿಫಲವಾಗಿದೆ",
        "Tamil": "உள்நுழைவு தோல்வியடைந்தது",
        "Telugu": "సైన్ ఇన్ విఫలమైంది",
        "Marathi": "साइन इन अयशस्वी",
        "Bengali": "সাইন ইন ব্যর্থ",
        "Gujarati": "સાઇન ઇન નિષ્ફળ",
        "Punjabi": "ਸਾਈਨ ਇਨ ਅਸਫਲ",
        "Malayalam": "സൈൻ ഇൻ പരാജയപ്പെട്ടു",
        "Odia": "ସାଇନ୍ ଇନ୍ ବିଫଳ"
    },
    "Please try again.": {
        "English": "Please try again.",
        "Hindi": "कृपया पुनः प्रयास करें।",
        "Kannada": "ದಯವಿಟ್ಟು ಪುನಃ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "કૃપા કરીને ફરીથી પ્રયાસ કરો.",
        "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Load Failed": {
        "English": "Load Failed",
        "Hindi": "लोड विफल",
        "Kannada": "ಲೋಡ್ ವಿಫಲವಾಗಿದೆ",
        "Tamil": "ஏற்றுதல் தோல்வி",
        "Telugu": "లోడ్ విఫలమైంది",
        "Marathi": "लोड अयशस्वी",
        "Bengali": "লোড ব্যর্থ",
        "Gujarati": "લોડ નિષ્ફળ",
        "Punjabi": "ਲੋਡ ਅਸਫਲ",
        "Malayalam": "ലോഡ് പരാജയപ്പെട്ടു",
        "Odia": "ଲୋଡ୍ ବିଫଳ"
    },
    "Generation Failed": {
        "English": "Generation Failed",
        "Hindi": "निर्माण विफल",
        "Kannada": "ರಚನೆ ವಿಫಲವಾಗಿದೆ",
        "Tamil": "உருவாக்கம் தோல்வி",
        "Telugu": "సృష్టి విఫలమైంది",
        "Marathi": "निर्मिती अयशस्वी",
        "Bengali": "তৈরি ব্যর্থ",
        "Gujarati": "સર્જન નિષ્ફળ",
        "Punjabi": "ਨਿਰਮਾਣ ਅਸਫਲ",
        "Malayalam": "സൃഷ്ടി പരാജയപ്പെട്ടു",
        "Odia": "ସୃଷ୍ଟି ବିଫଳ"
    },
    "Planning Failed": {
        "English": "Planning Failed",
        "Hindi": "योजना विफल",
        "Kannada": "ಯೋಜನೆ ವಿಫಲವಾಗಿದೆ",
        "Tamil": "திட்டமிடல் தோல்வி",
        "Telugu": "ప్రణాళిక విఫలమైంది",
        "Marathi": "योजना अयशस्वी",
        "Bengali": "পরিকল্পনা ব্যর্থ",
        "Gujarati": "યોજના નિષ્ફળ",
        "Punjabi": "ਯੋਜਨਾ ਅਸਫਲ",
        "Malayalam": "ആസൂത്രണം പരാജയപ്പെട്ടു",
        "Odia": "ଯୋଜନା ବିଫଳ"
    },
    "Failed to Get Advice": {
        "English": "Failed to Get Advice",
        "Hindi": "सलाह प्राप्त करने में विफल",
        "Kannada": "ಸಲಹೆ ಪಡೆಯಲು ವಿಫಲವಾಯಿತು",
        "Tamil": "ஆலோசனை பெற முடியவில்லை",
        "Telugu": "సలహా పొందడంలో విఫలమయ్యారు",
        "Marathi": "सल्ला मिळविण्यात अयशस्वी",
        "Bengali": "পরামর্শ পেতে ব্যর্থ",
        "Gujarati": "સલાહ મેળવવામાં નિષ્ફળ",
        "Punjabi": "ਸਲਾਹ ਪ੍ਰਾਪਤ ਕਰਨ ਵਿੱਚ ਅਸਫਲ",
        "Malayalam": "ഉപദേശം നേടാൻ പരാജയപ്പെട്ടു",
        "Odia": "ପରାମର୍ଶ ପାଇବାରେ ବିଫଳ"
    },
    "Answer Generation Failed": {
        "English": "Answer Generation Failed",
        "Hindi": "उत्तर निर्माण विफल",
        "Kannada": "ಉತ್ತರ ರಚನೆ ವಿಫಲವಾಗಿದೆ",
        "Tamil": "பதில் உருவாக்கம் தோல்வி",
        "Telugu": "సమాధాన సృష్టి విఫలమైంది",
        "Marathi": "उत्तर निर्मिती अयशस्वी",
        "Bengali": "উত্তর তৈরি ব্যর্থ",
        "Gujarati": "જવાબ સર્જન નિષ્ફળ",
        "Punjabi": "ਜਵਾਬ ਨਿਰਮਾਣ ਅਸਫਲ",
        "Malayalam": "ഉത്തര സൃഷ്ടി പരാജയപ്പെട്ടു",
        "Odia": "ଉତ୍ତର ସୃଷ୍ଟି ବିଫଳ"
    },
    "Session expired. Please log in again.": {
        "English": "Session expired. Please log in again.",
        "Hindi": "सत्र समाप्त हो गया है। कृपया फिर से लॉग इन करें।",
        "Kannada": "ಸೆಷನ್ ಅವಧಿ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಲಾಗಿನ್ ಮಾಡಿ.",
        "Tamil": "அமர்வு காலாவதியானது. மீண்டும் உள்நுழையவும்.",
        "Telugu": "సెషన్ ముగిసింది. దయచేసి మళ్లీ లాగిన్ చేయండి.",
        "Marathi": "सत्र संपले आहे. कृपया पुन्हा लॉग इन करा.",
        "Bengali": "সেশনের মেয়াদ শেষ। অনুগ্রহ করে আবার লগ ইন করুন।",
        "Gujarati": "સત્ર સમાપ્ત થયું છે. કૃપા કરીને ફરી લોગ ઇન કરો.",
        "Punjabi": "ਸੈਸ਼ਨ ਖਤਮ ਹੋ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਲੌਗ ਇਨ ਕਰੋ।",
        "Malayalam": "സെഷൻ കാലഹരണപ്പെട്ടു. ദയവായി വീണ്ടും ലോഗിൻ ചെയ്യുക.",
        "Odia": "ସେସନ୍ ଶେଷ ହୋଇଛି | ଦୟାକରି ପୁଣି ଲଗଇନ୍ କରନ୍ତୁ |"
    },
    "Something went wrong. Please try again.": {
        "English": "Something went wrong. Please try again.",
        "Hindi": "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
        "Kannada": "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.",
        "Punjabi": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "എന്തോ കുഴപ്പമുണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "କିଛି ଭୁଲ ହୋଇଛି | ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ |"
    },
    "Could not save. Please try again.": {
        "English": "Could not save. Please try again.",
        "Hindi": "सहेज नहीं सका। कृपया पुनः प्रयास करें।",
        "Kannada": "ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "సేవ్ చేయలేకపోయింది. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "जतन करता आले नाही. कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "સાચવી શકાયું નથી. કૃપા કરીને ફરી પ્રયાસ કરો.",
        "Punjabi": "ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "സംരക്ഷിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "ସଞ୍ଚୟ କରାଯାଇପାରିଲା ନାହିଁ | ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ |"
    },
    "Could not load the saved visual aid.": {
        "English": "Could not load the saved visual aid.",
        "Hindi": "सहेजी गई दृश्य सहायता लोड नहीं हो सकी।",
        "Kannada": "ಉಳಿಸಿದ ದೃಶ್ಯ ಸಹಾಯವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Tamil": "சேமித்த காட்சி உதவியை ஏற்ற முடியவில்லை.",
        "Telugu": "సేవ్ చేసిన దృశ్య సహాయాన్ని లోడ్ చేయలేకపోయింది.",
        "Marathi": "जतन केलेले दृश्य सहाय्य लोड करता आले नाही.",
        "Bengali": "সংরক্ষিত ভিজ্যুয়াল এইড লোড করা যায়নি।",
        "Gujarati": "સાચવેલી દ્રશ્ય સહાય લોડ કરી શકાઈ નથી.",
        "Punjabi": "ਸੁਰੱਖਿਅਤ ਕੀਤੀ ਵਿਜ਼ੂਅਲ ਏਡ ਲੋਡ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ।",
        "Malayalam": "സംരക്ഷിച്ച ദൃശ്യ സഹായം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.",
        "Odia": "ସଞ୍ଚିତ ଭିଜୁଆଲ୍ ଏଡ୍ ଲୋଡ୍ କରାଯାଇପାରିଲା ନାହିଁ।"
    },
    "Please sign in to generate visual aids": {
        "English": "Please sign in to generate visual aids",
        "Hindi": "दृश्य सहायताएँ बनाने के लिए कृपया साइन इन करें",
        "Kannada": "ದೃಶ್ಯ ಸಹಾಯಗಳನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "காட்சி உதவிகளை உருவாக்க உள்நுழையவும்",
        "Telugu": "దృశ్య సహాయాలను రూపొందించడానికి దయచేసి సైన్ ఇన్ చేయండి",
        "Marathi": "दृश्य सहाय्ये तयार करण्यासाठी कृपया साइन इन करा",
        "Bengali": "ভিজ্যুয়াল এইড তৈরি করতে অনুগ্রহ করে সাইন ইন করুন",
        "Gujarati": "દ્રશ્ય સહાય બનાવવા માટે કૃપા કરીને સાઇન ઇન કરો",
        "Punjabi": "ਵਿਜ਼ੂਅਲ ਏਡ ਬਣਾਉਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "ദൃശ്യ സഹായങ്ങൾ സൃഷ്ടിക്കാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക",
        "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍ ସୃଷ୍ଟି କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "There was an error generating the visual aid. Please try again.": {
        "English": "There was an error generating the visual aid. Please try again.",
        "Hindi": "दृश्य सहायता बनाने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
        "Kannada": "ದೃಶ್ಯ ಸಹಾಯವನ್ನು ರಚಿಸುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "காட்சி உதவியை உருவாக்குவதில் பிழை. மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "దృశ్య సహాయాన్ని రూపొందించడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "दृश्य सहाय्य तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "ভিজ্যুয়াল এইড তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "દ્રશ્ય સહાય બનાવવામાં ભૂલ આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
        "Punjabi": "ਵਿਜ਼ੂਅਲ ਏਡ ਬਣਾਉਣ ਵਿੱਚ ਗਲਤੀ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "ദൃശ്യ സഹായം സൃഷ്ടിക്കുന്നതിൽ പിശക്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍ ସୃଷ୍ଟି କରିବାରେ ତ୍ରୁଟି | ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ |"
    },
    "Could not load the saved worksheet.": {
        "English": "Could not load the saved worksheet.",
        "Hindi": "सहेजी गई वर्कशीट लोड नहीं हो सकी।",
        "Kannada": "ಉಳಿಸಿದ ವರ್ಕ್‌ಶೀಟ್ ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Tamil": "சேமித்த பணித்தாளை ஏற்ற முடியவில்லை.",
        "Telugu": "సేవ్ చేసిన వర్క్‌షీట్‌ని లోడ్ చేయలేకపోయింది.",
        "Marathi": "जतन केलेली वर्कशीट लोड करता आली नाही.",
        "Bengali": "সংরক্ষিত ওয়ার্কশীট লোড করা যায়নি।",
        "Gujarati": "સાચવેલી વર્કશીટ લોડ કરી શકાઈ નથી.",
        "Punjabi": "ਸੁਰੱਖਿਅਤ ਕੀਤੀ ਵਰਕਸ਼ੀਟ ਲੋਡ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ।",
        "Malayalam": "സംരക്ഷിച്ച വർക്ക്ഷീറ്റ് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.",
        "Odia": "ସଞ୍ଚିତ ୱାର୍କସିଟ୍ ଲୋଡ୍ କରାଯାଇପାରିଲା ନାହିଁ।"
    },
    "Please sign in to generate worksheets": {
        "English": "Please sign in to generate worksheets",
        "Hindi": "वर्कशीट बनाने के लिए कृपया साइन इन करें",
        "Kannada": "ವರ್ಕ್‌ಶೀಟ್‌ಗಳನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "பணித்தாள்களை உருவாக்க உள்நுழையவும்",
        "Telugu": "వర్క్‌షీట్‌లను రూపొందించడానికి దయచేసి సైన్ ఇన్ చేయండి",
        "Marathi": "वर्कशीट तयार करण्यासाठी कृपया साइन इन करा",
        "Bengali": "ওয়ার্কশীট তৈরি করতে অনুগ্রহ করে সাইন ইন করুন",
        "Gujarati": "વર્કશીટ બનાવવા માટે કૃપા કરીને સાઇન ઇન કરો",
        "Punjabi": "ਵਰਕਸ਼ੀਟ ਬਣਾਉਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "വർക്ക്ഷീറ്റ് സൃഷ്ടിക്കാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക",
        "Odia": "ୱାର୍କସିଟ୍ ସୃଷ୍ଟି କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "There was an error generating the worksheet. Please try again.": {
        "English": "There was an error generating the worksheet. Please try again.",
        "Hindi": "वर्कशीट बनाने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
        "Kannada": "ವರ್ಕ್‌ಶೀಟ್ ರಚಿಸುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "பணித்தாளை உருவாக்குவதில் பிழை. மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "వర్క్‌షీట్‌ని రూపొందించడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "वर्कशीट तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "ওয়ার্কশীট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "વર્કશીટ બનાવવામાં ભૂલ આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
        "Punjabi": "ਵਰਕਸ਼ੀਟ ਬਣਾਉਣ ਵਿੱਚ ਗਲਤੀ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "വർക്ക്ഷീറ്റ് സൃഷ്ടിക്കുന്നതിൽ പിശക്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "ୱାର୍କସିଟ୍ ସୃଷ୍ଟି କରିବାରେ ତ୍ରୁଟି | ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ |"
    },
    "Could not load the saved quiz.": {
        "English": "Could not load the saved quiz.",
        "Hindi": "सहेजी गई क्विज़ लोड नहीं हो सकी।",
        "Kannada": "ಉಳಿಸಿದ ಪರೀಕ್ಷೆಯನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Tamil": "சேமித்த வினாடி வினாவை ஏற்ற முடியவில்லை.",
        "Telugu": "సేవ్ చేసిన క్విజ్‌ని లోడ్ చేయలేకపోయింది.",
        "Marathi": "जतन केलेली क्विझ लोड करता आली नाही.",
        "Bengali": "সংরক্ষিত কুইজ লোড করা যায়নি।",
        "Gujarati": "સાચવેલી ક્વિઝ લોડ કરી શકાઈ નથી.",
        "Punjabi": "ਸੁਰੱਖਿਅਤ ਕੀਤੀ ਕਵਿਜ਼ ਲੋਡ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ।",
        "Malayalam": "സംരക്ഷിച്ച ക്വിസ് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.",
        "Odia": "ସଞ୍ଚିତ କୁଇଜ୍ ଲୋଡ୍ କରାଯାଇପାରିଲା ନାହିଁ।"
    },
    "Please sign in to generate quizzes": {
        "English": "Please sign in to generate quizzes",
        "Hindi": "क्विज़ बनाने के लिए कृपया साइन इन करें",
        "Kannada": "ಪರೀಕ್ಷೆಗಳನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "வினாடி வினாக்களை உருவாக்க உள்நுழையவும்",
        "Telugu": "క్విజ్‌లను రూపొందించడానికి దయచేసి సైన్ ఇన్ చేయండి",
        "Marathi": "क्विझ तयार करण्यासाठी कृपया साइन इन करा",
        "Bengali": "কুইজ তৈরি করতে অনুগ্রহ করে সাইন ইন করুন",
        "Gujarati": "ક્વિઝ બનાવવા માટે કૃપા કરીને સાઇન ઇન કરો",
        "Punjabi": "ਕਵਿਜ਼ ਬਣਾਉਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "ക്വിസ് സൃഷ്ടിക്കാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക",
        "Odia": "କୁଇଜ୍ ସୃଷ୍ଟି କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "There was an error generating the quiz. Please try again.": {
        "English": "There was an error generating the quiz. Please try again.",
        "Hindi": "क्विज़ बनाने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
        "Kannada": "ಪರೀಕ್ಷೆಯನ್ನು ರಚಿಸುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "Tamil": "வினாடி வினாவை உருவாக்குவதில் பிழை. மீண்டும் முயற்சிக்கவும்.",
        "Telugu": "క్విజ్‌ని రూపొందించడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Marathi": "क्विझ तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.",
        "Bengali": "কুইজ তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "Gujarati": "ક્વિઝ બનાવવામાં ભૂલ આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
        "Punjabi": "ਕਵਿਜ਼ ਬਣਾਉਣ ਵਿੱਚ ਗਲਤੀ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "Malayalam": "ക്വിസ് സൃഷ്ടിക്കുന്നതിൽ പിശക്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        "Odia": "କୁଇଜ୍ ସୃଷ୍ଟି କରିବାରେ ତ୍ରୁଟି | ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ |"
    },
    "Saved to Library": {
        "English": "Saved to Library",
        "Hindi": "लाइब्रेरी में सहेजा गया",
        "Kannada": "ಲೈಬ್ರರಿಗೆ ಉಳಿಸಲಾಗಿದೆ",
        "Tamil": "நூலகத்தில் சேமிக்கப்பட்டது",
        "Telugu": "లైబ్రరీకి సేవ్ చేయబడింది",
        "Marathi": "लायब्ररीत जतन केले",
        "Bengali": "লাইব্রেরিতে সংরক্ষিত",
        "Gujarati": "લાઇબ્રેરીમાં સાચવ્યું",
        "Punjabi": "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕੀਤਾ",
        "Malayalam": "ലൈബ്രറിയിൽ സംരക്ഷിച്ചു",
        "Odia": "ଲାଇବ୍ରେରୀରେ ସଞ୍ଚିତ"
    },
    "Your answer has been saved to your personal library.": {
        "English": "Your answer has been saved to your personal library.",
        "Hindi": "आपका उत्तर आपकी निजी लाइब्रेरी में सहेज लिया गया है।",
        "Kannada": "ನಿಮ್ಮ ಉತ್ತರವನ್ನು ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಲೈಬ್ರರಿಗೆ ಉಳಿಸಲಾಗಿದೆ.",
        "Tamil": "உங்கள் பதில் உங்கள் தனிப்பட்ட நூலகத்தில் சேமிக்கப்பட்டுள்ளது.",
        "Telugu": "మీ సమాధానం మీ వ్యక్తిగత లైబ్రరీలో సేవ్ చేయబడింది.",
        "Marathi": "तुमचे उत्तर तुमच्या वैयक्तिक लायब्ररीत जतन केले आहे.",
        "Bengali": "আপনার উত্তর আপনার ব্যক্তিগত লাইব্রেরিতে সংরক্ষিত হয়েছে।",
        "Gujarati": "તમારો જવાબ તમારી વ્યક્તિગત લાઇબ્રેરીમાં સાચવ્યો છે.",
        "Punjabi": "ਤੁਹਾਡਾ ਜਵਾਬ ਤੁਹਾਡੀ ਨਿੱਜੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕੀਤਾ ਗਿਆ ਹੈ।",
        "Malayalam": "നിങ്ങളുടെ ഉത്തരം നിങ്ങളുടെ വ്യക്തിഗത ലൈബ്രറിയിൽ സംരക്ഷിച്ചു.",
        "Odia": "ଆପଣଙ୍କ ଉତ୍ତର ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ଲାଇବ୍ରେରୀରେ ସଞ୍ଚିତ ହୋଇଛି।"
    },
    "Built for teachers across Bharat. Sign in to save your work and access all tools.": {
        "English": "Built for teachers across Bharat. Sign in to save your work and access all tools.",
        "Hindi": "पूरे भारत के शिक्षकों के लिए बनाया गया। अपना काम सहेजने और सभी टूल्स का उपयोग करने के लिए साइन इन करें।",
        "Kannada": "ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರಿಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಕೆಲಸವನ್ನು ಉಳಿಸಲು ಮತ್ತು ಎಲ್ಲಾ ಸಾಧನಗಳನ್ನು ಪ್ರವೇಶಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "பாரதம் முழுவதிலும் உள்ள ஆசிரியர்களுக்காக உருவாக்கப்பட்டது. உங்கள் வேலையைச் சேமிக்கவும் அனைத்து கருவிகளையும் அணுகவும் உள்நுழையவும்.",
        "Telugu": "భారతదేశంలోని ఉపాధ్యాయుల కోసం నిర్మించబడింది. మీ పనిని సేవ్ చేయడానికి మరియు అన్ని సాధనాలను యాక్సెస్ చేయడానికి సైన్ ఇన్ చేయండి.",
        "Marathi": "संपूर्ण भारतातील शिक्षकांसाठी बनवले. तुमचे काम जतन करण्यासाठी आणि सर्व साधने वापरण्यासाठी साइन इन करा.",
        "Bengali": "সারা ভারতের শিক্ষকদের জন্য তৈরি। আপনার কাজ সংরক্ষণ করতে এবং সমস্ত সরঞ্জাম অ্যাক্সেস করতে সাইন ইন করুন।",
        "Gujarati": "સમગ્ર ભારતના શિક્ષકો માટે બનાવેલું. તમારું કામ સાચવવા અને બધા સાધનો ઍક્સેસ કરવા માટે સાઇન ઇન કરો.",
        "Punjabi": "ਪੂਰੇ ਭਾਰਤ ਦੇ ਅਧਿਆਪਕਾਂ ਲਈ ਬਣਾਇਆ ਗਿਆ। ਆਪਣਾ ਕੰਮ ਸੁਰੱਖਿਅਤ ਕਰਨ ਅਤੇ ਸਾਰੇ ਟੂਲਜ਼ ਤੱਕ ਪਹੁੰਚਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "ഭാരതത്തിലെ അധ്യാപകർക്കായി നിർമ്മിച്ചത്. നിങ്ങളുടെ പ്രവൃത്തി സംരക്ഷിക്കാനും എല്ലാ ഉപകരണങ്ങളും ആക്സസ് ചെയ്യാനും സൈൻ ഇൻ ചെയ്യുക.",
        "Odia": "ଭାରତ ଦେଶର ଶିକ୍ଷକମାନଙ୍କ ପାଇଁ ନିର୍ମିତ। ଆପଣଙ୍କ କାର୍ଯ୍ୟ ସଞ୍ଚୟ କରିବା ଏବଂ ସମସ୍ତ ଉପକରଣକୁ ଅଭିଗମ୍ୟ କରିବା ପାଇଁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Attendance": {
        "English": "Attendance",
        "Hindi": "उपस्थिति",
        "Kannada": "ಹಾಜರಾತಿ",
        "Tamil": "வருகை",
        "Telugu": "హాజరు",
        "Marathi": "उपस्थिती",
        "Bengali": "উপস্থিতি",
        "Gujarati": "હાજરી",
        "Punjabi": "ਹਾਜ਼ਰੀ",
        "Malayalam": "ഹാജർ",
        "Odia": "ଉପସ୍ଥିତି"
    },
    "Manage classes and track daily attendance": {
        "English": "Manage classes and track daily attendance",
        "Hindi": "कक्षाएँ प्रबंधित करें और दैनिक उपस्थिति ट्रैक करें",
        "Kannada": "ತರಗತಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ ಮತ್ತು ದೈನಂದಿನ ಹಾಜರಾತಿಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
        "Tamil": "வகுப்புகளை நிர்வகிக்கவும் தினசரி வருகையைக் கண்காணிக்கவும்",
        "Telugu": "తరగతులను నిర్వహించండి మరియు రోజువారీ హాజరును ట్రాక్ చేయండి",
        "Marathi": "वर्ग व्यवस्थापित करा आणि दैनंदिन उपस्थिती ट्रॅक करा",
        "Bengali": "ক্লাস পরিচালনা করুন এবং দৈনিক উপস্থিতি ট্র্যাক করুন",
        "Gujarati": "વર્ગો મેનેજ કરો અને દૈનિક હાજરી ટ્રેક કરો",
        "Punjabi": "ਜਮਾਤਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ ਅਤੇ ਰੋਜ਼ਾਨਾ ਹਾਜ਼ਰੀ ਟਰੈਕ ਕਰੋ",
        "Malayalam": "ക്ലാസുകൾ നിയന്ത്രിക്കുകയും ദൈനംദിന ഹാജർ ട്രാക്ക് ചെയ്യുകയും ചെയ്യുക",
        "Odia": "ଶ୍ରେଣୀଗୁଡିକୁ ପରିଚାଳନା କରନ୍ତୁ ଏବଂ ଦୈନିକ ଉପସ୍ଥିତି ଟ୍ରାକ୍ କରନ୍ତୁ"
    },
    "New Class": {
        "English": "New Class",
        "Hindi": "नई कक्षा",
        "Kannada": "ಹೊಸ ತರಗತಿ",
        "Tamil": "புதிய வகுப்பு",
        "Telugu": "కొత్త తరగతి",
        "Marathi": "नवीन वर्ग",
        "Bengali": "নতুন ক্লাস",
        "Gujarati": "નવો વર્ગ",
        "Punjabi": "ਨਵੀਂ ਜਮਾਤ",
        "Malayalam": "പുതിയ ക്ലാസ്",
        "Odia": "ନୂଆ ଶ୍ରେଣୀ"
    },
    "Create First Class": {
        "English": "Create First Class",
        "Hindi": "पहली कक्षा बनाएँ",
        "Kannada": "ಮೊದಲ ತರಗತಿ ರಚಿಸಿ",
        "Tamil": "முதல் வகுப்பை உருவாக்கவும்",
        "Telugu": "మొదటి తరగతిని సృష్టించండి",
        "Marathi": "पहिला वर्ग तयार करा",
        "Bengali": "প্রথম ক্লাস তৈরি করুন",
        "Gujarati": "પ્રથમ વર્ગ બનાવો",
        "Punjabi": "ਪਹਿਲੀ ਜਮਾਤ ਬਣਾਓ",
        "Malayalam": "ആദ്യ ക്ലാസ് സൃഷ്ടിക്കുക",
        "Odia": "ପ୍ରଥମ ଶ୍ରେଣୀ ତିଆରି କରନ୍ତୁ"
    },
    "No classes yet": {
        "English": "No classes yet",
        "Hindi": "अभी तक कोई कक्षा नहीं",
        "Kannada": "ಇನ್ನೂ ತರಗತಿಗಳಿಲ್ಲ",
        "Tamil": "இன்னும் வகுப்புகள் இல்லை",
        "Telugu": "ఇంకా తరగతులు లేవు",
        "Marathi": "अद्याप कोणतेही वर्ग नाहीत",
        "Bengali": "এখনও কোনো ক্লাস নেই",
        "Gujarati": "હજી કોઈ વર્ગો નથી",
        "Punjabi": "ਹਾਲੇ ਕੋਈ ਜਮਾਤਾਂ ਨਹੀਂ",
        "Malayalam": "ഇതുവരെ ക്ലാസുകൾ ഇല്ല",
        "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଶ୍ରେଣୀ ନାହିଁ"
    },
    "Create your first class and add students — then take daily attendance in seconds.": {
        "English": "Create your first class and add students — then take daily attendance in seconds.",
        "Hindi": "अपनी पहली कक्षा बनाएँ और छात्र जोड़ें — फिर सेकंड में दैनिक उपस्थिति लें।",
        "Kannada": "ನಿಮ್ಮ ಮೊದಲ ತರಗತಿಯನ್ನು ರಚಿಸಿ ಮತ್ತು ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ — ನಂತರ ಸೆಕೆಂಡುಗಳಲ್ಲಿ ದೈನಂದಿನ ಹಾಜರಾತಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.",
        "Tamil": "உங்கள் முதல் வகுப்பை உருவாக்கி மாணவர்களைச் சேர்க்கவும் — பின்னர் வினாடிகளில் தினசரி வருகை எடுக்கவும்.",
        "Telugu": "మీ మొదటి తరగతిని సృష్టించి విద్యార్థులను జోడించండి — తర్వాత సెకన్లలో రోజువారీ హాజరును తీసుకోండి.",
        "Marathi": "तुमचा पहिला वर्ग तयार करा आणि विद्यार्थी जोडा — नंतर सेकंदांत दैनंदिन उपस्थिती घ्या.",
        "Bengali": "আপনার প্রথম ক্লাস তৈরি করুন এবং শিক্ষার্থী যোগ করুন — তারপর সেকেন্ডে দৈনিক উপস্থিতি নিন।",
        "Gujarati": "તમારો પ્રથમ વર્ગ બનાવો અને વિદ્યાર્થીઓ ઉમેરો — પછી સેકન્ડોમાં દૈનિક હાજરી લો.",
        "Punjabi": "ਆਪਣੀ ਪਹਿਲੀ ਜਮਾਤ ਬਣਾਓ ਅਤੇ ਵਿਦਿਆਰਥੀ ਜੋੜੋ — ਫਿਰ ਸਕਿੰਟਾਂ ਵਿੱਚ ਰੋਜ਼ਾਨਾ ਹਾਜ਼ਰੀ ਲਓ।",
        "Malayalam": "നിങ്ങളുടെ ആദ്യ ക്ലാസ് സൃഷ്ടിച്ച് വിദ്യാർഥികളെ ചേർക്കുക — പിന്നീട് സെക്കൻഡുകളിൽ ദൈനംദിന ഹാജർ എടുക്കുക.",
        "Odia": "ଆପଣଙ୍କ ପ୍ରଥମ ଶ୍ରେଣୀ ତିଆରି କରନ୍ତୁ ଏବଂ ଛାତ୍ରମାନଙ୍କୁ ଯୋଡନ୍ତୁ — ତା'ପରେ ସେକେଣ୍ଡରେ ଦୈନିକ ଉପସ୍ଥିତି ନିଅନ୍ତୁ।"
    },
    "students": {
        "English": "students",
        "Hindi": "छात्र",
        "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳು",
        "Tamil": "மாணவர்கள்",
        "Telugu": "విద్యార్థులు",
        "Marathi": "विद्यार्थी",
        "Bengali": "শিক্ষার্থী",
        "Gujarati": "વિદ્યાર્થીઓ",
        "Punjabi": "ਵਿਦਿਆਰਥੀ",
        "Malayalam": "വിദ്യാർഥികൾ",
        "Odia": "ଛାତ୍ରଛାତ୍ରୀ"
    },
    "Today": {
        "English": "Today",
        "Hindi": "आज",
        "Kannada": "ಇಂದು",
        "Tamil": "இன்று",
        "Telugu": "ఈరోజు",
        "Marathi": "आज",
        "Bengali": "আজ",
        "Gujarati": "આજે",
        "Punjabi": "ਅੱਜ",
        "Malayalam": "ഇന്ന്",
        "Odia": "ଆଜି"
    },
    "Students": {
        "English": "Students",
        "Hindi": "छात्र",
        "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳು",
        "Tamil": "மாணவர்கள்",
        "Telugu": "విద్యార్థులు",
        "Marathi": "विद्यार्थी",
        "Bengali": "শিক্ষার্থী",
        "Gujarati": "વિદ્યાર્થીઓ",
        "Punjabi": "ਵਿਦਿਆਰਥੀ",
        "Malayalam": "വിദ്യാർഥികൾ",
        "Odia": "ଛାତ୍ରଛାତ୍ରୀ"
    },
    "Reports": {
        "English": "Reports",
        "Hindi": "रिपोर्ट",
        "Kannada": "ವರದಿಗಳು",
        "Tamil": "அறிக்கைகள்",
        "Telugu": "నివేదికలు",
        "Marathi": "अहवाल",
        "Bengali": "রিপোর্ট",
        "Gujarati": "અહેવાલો",
        "Punjabi": "ਰਿਪੋਰਟਾਂ",
        "Malayalam": "റിപ്പോർട്ടുകൾ",
        "Odia": "ରିପୋର୍ଟଗୁଡ଼ିକ"
    },
    "Parent Outreach": {
        "English": "Parent Outreach",
        "Hindi": "अभिभावक संपर्क",
        "Kannada": "ಪೋಷಕರ ಸಂಪರ್ಕ",
        "Tamil": "பெற்றோர் தொடர்பு",
        "Telugu": "తల్లిదండ్రుల సంప్రదింపు",
        "Marathi": "पालक संपर्क",
        "Bengali": "অভিভাবক যোগাযোগ",
        "Gujarati": "વાલી સંપર્ક",
        "Punjabi": "ਮਾਪੇ ਸੰਪਰਕ",
        "Malayalam": "രക്ഷിതാക്കളുമായി ബന്ധപ്പെടുക",
        "Odia": "ଅଭିଭାବକ ସମ୍ପର୍କ"
    },
    "Contact": {
        "English": "Contact",
        "Hindi": "संपर्क करें",
        "Kannada": "ಸಂಪರ್ಕಿಸಿ",
        "Tamil": "தொடர்பு",
        "Telugu": "సంప్రదించండి",
        "Marathi": "संपर्क",
        "Bengali": "যোগাযোগ",
        "Gujarati": "સંપર્ક",
        "Punjabi": "ਸੰਪਰਕ",
        "Malayalam": "ബന്ധപ്പെടുക",
        "Odia": "ଯୋଗାଯୋଗ"
    },
    "Attendance Alert": {
        "English": "Attendance Alert",
        "Hindi": "उपस्थिति चेतावनी",
        "Kannada": "ಹಾಜರಾತಿ ಎಚ್ಚರಿಕೆ",
        "Tamil": "வருகை எச்சரிக்கை",
        "Telugu": "హాజరు హెచ్చరిక",
        "Marathi": "उपस्थिती इशारा",
        "Bengali": "উপস্থিতি সতর্কতা",
        "Gujarati": "હાજરી ચેતવણી",
        "Punjabi": "ਹਾਜ਼ਰੀ ਚੇਤਾਵਨੀ",
        "Malayalam": "ഹാജർ മുന്നറിയിപ്പ്",
        "Odia": "ଉପସ୍ଥିତି ସତର୍କତା"
    },
    "absent in a row": {
        "English": "absent in a row",
        "Hindi": "लगातार अनुपस्थित",
        "Kannada": "ಸತತ ಗೈರುಹಾಜರ್",
        "Tamil": "தொடர்ச்சியாக வராதவர்",
        "Telugu": "వరుసగా గైర్హాజరు",
        "Marathi": "सलग गैरहजर",
        "Bengali": "পর পর অনুপস্থিত",
        "Gujarati": "સતત ગેરહાજર",
        "Punjabi": "ਲਗਾਤਾਰ ਗੈਰਹਾਜ਼ਰ",
        "Malayalam": "തുടർച്ചയായി ഹാജരാകാത്ത",
        "Odia": "କ୍ରମାଗତ ଅନୁପସ୍ଥିତ"
    },
    "attendance this month": {
        "English": "attendance this month",
        "Hindi": "इस महीने की उपस्थिति",
        "Kannada": "ಈ ತಿಂಗಳ ಹಾಜರಾತಿ",
        "Tamil": "இந்த மாத வருகை",
        "Telugu": "ఈ నెల హాజరు",
        "Marathi": "या महिन्याची उपस्थिती",
        "Bengali": "এই মাসের উপস্থিতি",
        "Gujarati": "આ મહિનાની હાજરી",
        "Punjabi": "ਇਸ ਮਹੀਨੇ ਦੀ ਹਾਜ਼ਰੀ",
        "Malayalam": "ഈ മാസത്തെ ഹാജർ",
        "Odia": "ଏହି ମାସର ଉପସ୍ଥିତି"
    },
    "Class not found.": {
        "English": "Class not found.",
        "Hindi": "कक्षा नहीं मिली।",
        "Kannada": "ತರಗತಿ ಕಂಡುಬಂದಿಲ್ಲ.",
        "Tamil": "வகுப்பு இல்லை.",
        "Telugu": "తరగతి కనుగొనబడలేదు.",
        "Marathi": "वर्ग सापडला नाही.",
        "Bengali": "ক্লাস পাওয়া যায়নি।",
        "Gujarati": "વર્ગ મળ્યો નથી.",
        "Punjabi": "ਜਮਾਤ ਨਹੀਂ ਮਿਲੀ।",
        "Malayalam": "ക്ലാസ് കണ്ടെത്തിയില്ല.",
        "Odia": "ଶ୍ରେଣୀ ମିଳିଲା ନାହିଁ।"
    },
    "Good Morning": {
        "English": "Good Morning",
        "Hindi": "सुप्रभात",
        "Kannada": "ಶುಭೋದಯ",
        "Tamil": "காலை வணக்கம்",
        "Telugu": "శుభోదయం",
        "Marathi": "शुभ सकाळ",
        "Bengali": "শুভ সকাল",
        "Gujarati": "સુપ્રભાત",
        "Punjabi": "ਸ਼ੁਭ ਸਵੇਰ",
        "Malayalam": "സുപ്രഭാതം",
        "Odia": "ସୁପ୍ରଭାତ"
    },
    "Good Afternoon": {
        "English": "Good Afternoon",
        "Hindi": "नमस्ते",
        "Kannada": "ಶುಭ ಮಧ್ಯಾಹ್ನ",
        "Tamil": "மதிய வணக்கம்",
        "Telugu": "శుభ మధ్యాహ్నం",
        "Marathi": "शुभ दुपार",
        "Bengali": "শুভ দুপুর",
        "Gujarati": "શુભ બપોર",
        "Punjabi": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
        "Malayalam": "ശുഭ മധ്യാഹ്നം",
        "Odia": "ଶୁଭ ଅପରାହ୍ନ"
    },
    "Good Evening": {
        "English": "Good Evening",
        "Hindi": "शुभ संध्या",
        "Kannada": "ಶುಭ ಸಂಜೆ",
        "Tamil": "மாலை வணக்கம்",
        "Telugu": "శుభ సాయంత్రం",
        "Marathi": "शुभ संध्याकाळ",
        "Bengali": "শুভ সন্ধ্যা",
        "Gujarati": "શુભ સાંજ",
        "Punjabi": "ਸ਼ੁਭ ਸ਼ਾਮ",
        "Malayalam": "ശുഭ സായാഹ്നം",
        "Odia": "ଶୁଭ ସନ୍ଧ୍ୟା"
    },
    "I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.": {
        "English": "I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.",
        "Hindi": "मैं SahayakAI हूँ, आपका निजी AI साथी। मैं सेकंडों में पाठ योजनाएँ, प्रश्नोत्तरी और आकर्षक सामग्री बनाने में आपकी मदद कर सकता हूँ।",
        "Kannada": "ನಾನು SahayakAI, ನಿಮ್ಮ ವೈಯಕ್ತಿಕ AI ಸಹಚರ. ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಪಾಠ ಯೋಜನೆಗಳು, ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಆಕರ್ಷಕ ವಿಷಯವನ್ನು ರಚಿಸಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.",
        "Tamil": "நான் SahayakAI, உங்கள் தனிப்பட்ட AI துணை. நொடிகளில் பாடத் திட்டங்கள், வினாடி வினாக்கள் மற்றும் ஈர்க்கக்கூடிய உள்ளடக்கத்தை உருவாக்க உதவுவேன்.",
        "Telugu": "నేను SahayakAI, మీ వ్యక్తిగత AI సహచరుడిని. సెకన్లలో పాఠ ప్రణాళికలు, క్విజ్‌లు మరియు ఆకర్షణీయమైన కంటెంట్‌ను సృష్టించడంలో నేను సహాయం చేయగలను.",
        "Marathi": "मी SahayakAI आहे, तुमचा वैयक्तिक AI सहकारी. मी सेकंदात धडा योजना, प्रश्नमंजुषा आणि आकर्षक सामग्री तयार करण्यात मदत करू शकतो.",
        "Bengali": "আমি SahayakAI, আপনার ব্যক্তিগত AI সঙ্গী। আমি সেকেন্ডে পাঠ পরিকল্পনা, কুইজ এবং আকর্ষণীয় সামগ্রী তৈরি করতে সাহায্য করতে পারি।",
        "Gujarati": "હું SahayakAI છું, તમારો વ્યક્તિગત AI સાથી. હું સેકન્ડોમાં પાઠ યોજનાઓ, ક્વિઝ અને આકર્ષક સામગ્રી બનાવવામાં તમારી મદદ કરી શકું છું.",
        "Punjabi": "ਮੈਂ SahayakAI ਹਾਂ, ਤੁਹਾਡਾ ਨਿੱਜੀ AI ਸਾਥੀ। ਮੈਂ ਸਕਿੰਟਾਂ ਵਿੱਚ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕੁਇਜ਼ ਅਤੇ ਦਿਲਚਸਪ ਸਮੱਗਰੀ ਬਣਾਉਣ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।",
        "Malayalam": "ഞാൻ SahayakAI ആണ്, നിങ്ങളുടെ വ്യക്തിഗത AI കൂട്ടുകാരൻ. സെക്കൻഡുകളിൽ പാഠ പദ്ധതികൾ, ക്വിസുകൾ, ആകർഷകമായ ഉള്ളടക്കം സൃഷ്ടിക്കാൻ എനിക്ക് സഹായിക്കാം.",
        "Odia": "ମୁଁ SahayakAI, ଆପଣଙ୍କର ବ୍ୟକ୍ତିଗତ AI ସାଥୀ। ମୁଁ ସେକେଣ୍ଡରେ ପାଠ ଯୋଜନା, କୁଇଜ୍ ଏବଂ ଆକର୍ଷଣୀୟ ବିଷୟବସ୍ତୁ ସୃଷ୍ଟି କରିବାରେ ସାହାଯ୍ୟ କରିପାରେ।"
    },
    "Tap the mic and speak in any language. SahayakAI understands Hindi, Kannada, Tamil and more!": {
        "English": "Tap the mic and speak in any language. SahayakAI understands Hindi, Kannada, Tamil and more!",
        "Hindi": "माइक दबाएँ और किसी भी भाषा में बोलें। SahayakAI हिंदी, कन्नड़, तमिल और बहुत कुछ समझता है!",
        "Kannada": "ಮೈಕ್ ಟ್ಯಾಪ್ ಮಾಡಿ ಮತ್ತು ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ. SahayakAI ಹಿಂದಿ, ಕನ್ನಡ, ತಮಿಳು ಮತ್ತು ಇನ್ನಷ್ಟು ಭಾಷೆಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ!",
        "Tamil": "மைக்கைத் தட்டி எந்த மொழியிலும் பேசுங்கள். SahayakAI இந்தி, கன்னடம், தமிழ் மற்றும் பல மொழிகளைப் புரிந்துகொள்ளும்!",
        "Telugu": "మైక్‌ను నొక్కి ఏ భాషలో అయినా మాట్లాడండి. SahayakAI హిందీ, కన్నడ, తమిళం మరియు మరిన్నింటిని అర్థం చేసుకుంటుంది!",
        "Marathi": "माइक दाबा आणि कोणत्याही भाषेत बोला. SahayakAI हिंदी, कन्नड, तमिळ आणि बरेच काही समजतो!",
        "Bengali": "মাইক ট্যাপ করে যেকোনো ভাষায় কথা বলুন। SahayakAI হিন্দি, কন্নড়, তামিল এবং আরও ভাষা বুঝতে পারে!",
        "Gujarati": "માઇક પર ટેપ કરો અને કોઈપણ ભાષામાં બોલો. SahayakAI હિન્દી, કન્નડ, તમિલ અને વધુ ભાષાઓ સમજે છે!",
        "Punjabi": "ਮਾਈਕ ਦਬਾਓ ਅਤੇ ਕਿਸੇ ਵੀ ਭਾਸ਼ਾ ਵਿੱਚ ਬੋਲੋ। SahayakAI ਹਿੰਦੀ, ਕੰਨੜ, ਤਮਿਲ ਅਤੇ ਹੋਰ ਭਾਸ਼ਾਵਾਂ ਨੂੰ ਸਮਝਦਾ ਹੈ!",
        "Malayalam": "മൈക്ക് ടാപ്പ് ചെയ്ത് ഏത് ഭാഷയിലും സംസാരിക്കുക. SahayakAI ഹിന്ദി, കന്നഡ, തമിഴ്, കൂടാതെ മറ്റുള്ളവയും മനസ്സിലാക്കുന്നു!",
        "Odia": "ମାଇକ୍ ଟାପ୍ କରି କୌଣସି ଭାଷାରେ କୁହନ୍ତୁ। SahayakAI ହିନ୍ଦୀ, କନ୍ନଡ଼, ତାମିଲ୍ ଏବଂ ଅଧିକ ଭାଷା ବୁଝେ!"
    },
    "Speak your topic": {
        "English": "Speak your topic",
        "Hindi": "अपना विषय बोलें",
        "Kannada": "ನಿಮ್ಮ ವಿಷಯ ಹೇಳಿ",
        "Tamil": "உங்கள் தலைப்பைப் பேசுங்கள்",
        "Telugu": "మీ అంశాన్ని చెప్పండి",
        "Marathi": "तुमचा विषय सांगा",
        "Bengali": "আপনার বিষয় বলুন",
        "Gujarati": "તમારો વિષય બોલો",
        "Punjabi": "ਆਪਣਾ ਵਿਸ਼ਾ ਬੋਲੋ",
        "Malayalam": "നിങ്ങളുടെ വിഷയം പറയുക",
        "Odia": "ଆପଣଙ୍କ ବିଷୟ କୁହନ୍ତୁ"
    },
    "Tap the microphone and tell Sahayak what you want to teach today": {
        "English": "Tap the microphone and tell Sahayak what you want to teach today",
        "Hindi": "माइक्रोफ़ोन दबाएँ और Sahayak को बताएँ कि आज आप क्या पढ़ाना चाहते हैं",
        "Kannada": "ಮೈಕ್ರೋಫೋನ್ ಟ್ಯಾಪ್ ಮಾಡಿ ಮತ್ತು ಇಂದು ನೀವು ಏನು ಕಲಿಸಲು ಬಯಸುತ್ತೀರಿ ಎಂದು Sahayak ಗೆ ತಿಳಿಸಿ",
        "Tamil": "மைக்ரோஃபோனைத் தட்டி, இன்று நீங்கள் என்ன கற்பிக்க விரும்புகிறீர்கள் என்று Sahayak-க்கு சொல்லுங்கள்",
        "Telugu": "మైక్రోఫోన్‌ను నొక్కి, ఈరోజు మీరు ఏమి బోధించాలనుకుంటున్నారో Sahayakకి చెప్పండి",
        "Marathi": "मायक्रोफोन दाबा आणि आज तुम्ही काय शिकवू इच्छिता ते Sahayakला सांगा",
        "Bengali": "মাইক্রোফোন ট্যাপ করুন এবং আজ আপনি কী শেখাতে চান তা Sahayakকে বলুন",
        "Gujarati": "માઇક્રોફોન પર ટેપ કરો અને આજે તમે શું શીખવવા માંગો છો તે Sahayakને જણાવો",
        "Punjabi": "ਮਾਈਕ੍ਰੋਫੋਨ ਦਬਾਓ ਅਤੇ Sahayak ਨੂੰ ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਅੱਜ ਕੀ ਪੜ੍ਹਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ",
        "Malayalam": "മൈക്രോഫോൺ ടാപ്പ് ചെയ്ത് ഇന്ന് നിങ്ങൾ എന്താണ് പഠിപ്പിക്കാൻ ആഗ്രഹിക്കുന്നതെന്ന് Sahayak നോട് പറയുക",
        "Odia": "ମାଇକ୍ରୋଫୋନ୍ ଟାପ୍ କରି ଆଜି ଆପଣ କଣ ଶିଖାଇବାକୁ ଚାହୁଁଛନ୍ତି ତାହା Sahayakକୁ କୁହନ୍ତୁ"
    },
    "Type a topic, e.g. 'Photosynthesis for Class 8'": {
        "English": "Type a topic, e.g. 'Photosynthesis for Class 8'",
        "Hindi": "कोई विषय लिखें, जैसे 'कक्षा 8 के लिए प्रकाश संश्लेषण'",
        "Kannada": "ಒಂದು ವಿಷಯವನ್ನು ಟೈಪ್ ಮಾಡಿ, ಉದಾ. 'ತರಗತಿ 8ಕ್ಕೆ ಪ್ರಕಾಶಸಂಶ್ಲೇಷಣೆ'",
        "Tamil": "ஒரு தலைப்பை உள்ளிடவும், எ.கா. '8ம் வகுப்பிற்கான ஒளிச்சேர்க்கை'",
        "Telugu": "ఒక అంశాన్ని టైప్ చేయండి, ఉదా. '8వ తరగతి కోసం కిరణజన్య సంయోగక్రియ'",
        "Marathi": "एक विषय टाइप करा, उदा. 'इयत्ता 8 साठी प्रकाशसंश्लेषण'",
        "Bengali": "একটি বিষয় টাইপ করুন, যেমন 'অষ্টম শ্রেণীর জন্য সালোকসংশ্লেষণ'",
        "Gujarati": "એક વિષય લખો, દા.ત. 'ધોરણ 8 માટે પ્રકાશસંશ્લેષણ'",
        "Punjabi": "ਇੱਕ ਵਿਸ਼ਾ ਟਾਈਪ ਕਰੋ, ਜਿਵੇਂ 'ਜਮਾਤ 8 ਲਈ ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ'",
        "Malayalam": "ഒരു വിഷയം ടൈപ്പ് ചെയ്യുക, ഉദാ. '8-ാം ക്ലാസിലേക്കുള്ള പ്രകാശസംശ്ലേഷണം'",
        "Odia": "ଏକ ବିଷୟ ଟାଇପ୍ କରନ୍ତୁ, ଯଥା 'ଷଷ୍ଠମ ଶ୍ରେଣୀ ପାଇଁ ଫୋଟୋସିନ୍ଥେସିସ୍'"
    },
    "try: \"Quiz about photosynthesis\" or \"Lesson plan for solar system\"": {
        "English": "try: \"Quiz about photosynthesis\" or \"Lesson plan for solar system\"",
        "Hindi": "आज़माएँ: \"प्रकाश संश्लेषण पर प्रश्नोत्तरी\" या \"सौर मंडल के लिए पाठ योजना\"",
        "Kannada": "ಪ್ರಯತ್ನಿಸಿ: \"ಪ್ರಕಾಶಸಂಶ್ಲೇಷಣೆ ಬಗ್ಗೆ ರಸಪ್ರಶ್ನೆ\" ಅಥವಾ \"ಸೌರಮಂಡಲಕ್ಕಾಗಿ ಪಾಠ ಯೋಜನೆ\"",
        "Tamil": "முயற்சி: \"ஒளிச்சேர்க்கை பற்றிய வினாடி வினா\" அல்லது \"சூரிய மண்டலத்திற்கான பாடத் திட்டம்\"",
        "Telugu": "ప్రయత్నించండి: \"కిరణజన్య సంయోగక్రియపై క్విజ్\" లేదా \"సౌర వ్యవస్థ కోసం పాఠ ప్రణాళిక\"",
        "Marathi": "प्रयत्न करा: \"प्रकाशसंश्लेषणावरील प्रश्नमंजुषा\" किंवा \"सौर मंडळासाठी पाठ योजना\"",
        "Bengali": "চেষ্টা করুন: \"সালোকসংশ্লেষণ সম্পর্কে কুইজ\" বা \"সৌরজগতের জন্য পাঠ পরিকল্পনা\"",
        "Gujarati": "પ્રયાસ કરો: \"પ્રકાશસંશ્લેષણ વિશે ક્વિઝ\" અથવા \"સૌરમંડળ માટે પાઠ યોજના\"",
        "Punjabi": "ਅਜ਼ਮਾਓ: \"ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਬਾਰੇ ਕੁਇਜ਼\" ਜਾਂ \"ਸੌਰ ਮੰਡਲ ਲਈ ਪਾਠ ਯੋਜਨਾ\"",
        "Malayalam": "ശ്രമിക്കുക: \"പ്രകാശസംശ്ലേഷണത്തെക്കുറിച്ചുള്ള ക്വിസ്\" അല്ലെങ്കിൽ \"സൗരയൂഥത്തിനായുള്ള പാഠ പദ്ധതി\"",
        "Odia": "ଚେଷ୍ଟା କରନ୍ତୁ: \"ଫୋଟୋସିନ୍ଥେସିସ୍ ଉପରେ କୁଇଜ୍\" କିମ୍ବା \"ସୌର ମଣ୍ଡଳ ପାଇଁ ପାଠ ଯୋଜନା\""
    },
    "Works in Hindi, Kannada, Tamil + 8 more languages": {
        "English": "Works in Hindi, Kannada, Tamil + 8 more languages",
        "Hindi": "हिंदी, कन्नड़, तमिल और 8 अन्य भाषाओं में काम करता है",
        "Kannada": "ಹಿಂದಿ, ಕನ್ನಡ, ತಮಿಳು ಮತ್ತು ಇನ್ನೂ 8 ಭಾಷೆಗಳಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
        "Tamil": "இந்தி, கன்னடம், தமிழ் மற்றும் மேலும் 8 மொழிகளில் இயங்கும்",
        "Telugu": "హిందీ, కన్నడ, తమిళం మరియు మరో 8 భాషలలో పని చేస్తుంది",
        "Marathi": "हिंदी, कन्नड, तमिळ आणि आणखी 8 भाषांमध्ये कार्य करते",
        "Bengali": "হিন্দি, কন্নড়, তামিল এবং আরও ৮টি ভাষায় কাজ করে",
        "Gujarati": "હિન્દી, કન્નડ, તમિલ અને વધુ 8 ભાષાઓમાં કામ કરે છે",
        "Punjabi": "ਹਿੰਦੀ, ਕੰਨੜ, ਤਮਿਲ ਅਤੇ ਹੋਰ 8 ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਕੰਮ ਕਰਦਾ ਹੈ",
        "Malayalam": "ഹിന്ദി, കന്നഡ, തമിഴ്, കൂടാതെ മറ്റ് 8 ഭാഷകളിലും പ്രവർത്തിക്കുന്നു",
        "Odia": "ହିନ୍ଦୀ, କନ୍ନଡ଼, ତାମିଲ୍ ଏବଂ ଅଧିକ 8 ଭାଷାରେ କାର୍ଯ୍ୟ କରେ"
    },
    "Install SahayakAI": {
        "English": "Install SahayakAI",
        "Hindi": "SahayakAI इंस्टॉल करें",
        "Kannada": "SahayakAI ಅನ್ನು ಸ್ಥಾಪಿಸಿ",
        "Tamil": "SahayakAI ஐ நிறுவவும்",
        "Telugu": "SahayakAIని ఇన్‌స్టాల్ చేయండి",
        "Marathi": "SahayakAI इन्स्टॉल करा",
        "Bengali": "SahayakAI ইনস্টল করুন",
        "Gujarati": "SahayakAI ઇન્સ્ટોલ કરો",
        "Punjabi": "SahayakAI ਇੰਸਟਾਲ ਕਰੋ",
        "Malayalam": "SahayakAI ഇൻസ്റ്റാൾ ചെയ്യുക",
        "Odia": "SahayakAI ଇନଷ୍ଟଲ୍ କରନ୍ତୁ"
    },
    "Add to home screen for quick access & offline use": {
        "English": "Add to home screen for quick access & offline use",
        "Hindi": "त्वरित पहुँच और ऑफ़लाइन उपयोग के लिए होम स्क्रीन पर जोड़ें",
        "Kannada": "ತ್ವರಿತ ಪ್ರವೇಶ ಮತ್ತು ಆಫ್‌ಲೈನ್ ಬಳಕೆಗಾಗಿ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ",
        "Tamil": "விரைவான அணுகல் மற்றும் ஆஃப்லைன் பயன்பாட்டிற்காக முகப்புத் திரையில் சேர்க்கவும்",
        "Telugu": "త్వరిత యాక్సెస్ మరియు ఆఫ్‌లైన్ వినియోగం కోసం హోమ్ స్క్రీన్‌కి జోడించండి",
        "Marathi": "त्वरित प्रवेश आणि ऑफलाइन वापरासाठी होम स्क्रीनवर जोडा",
        "Bengali": "দ্রুত অ্যাক্সেস এবং অফলাইন ব্যবহারের জন্য হোম স্ক্রিনে যোগ করুন",
        "Gujarati": "ઝડપી ઍક્સેસ અને ઑફલાઇન ઉપયોગ માટે હોમ સ્ક્રીન પર ઉમેરો",
        "Punjabi": "ਤੇਜ਼ ਪਹੁੰਚ ਅਤੇ ਔਫਲਾਈਨ ਵਰਤੋਂ ਲਈ ਹੋਮ ਸਕ੍ਰੀਨ ਤੇ ਜੋੜੋ",
        "Malayalam": "വേഗത്തിലുള്ള ആക്‌സസ്സിനും ഓഫ്‌ലൈൻ ഉപയോഗത്തിനുമായി ഹോം സ്ക്രീനിലേക്ക് ചേർക്കുക",
        "Odia": "ଦ୍ରୁତ ପ୍ରବେଶ ଓ ଅଫଲାଇନ୍ ବ୍ୟବହାର ପାଇଁ ହୋମ୍ ସ୍କ୍ରିନ୍ ରେ ଯୋଡନ୍ତୁ"
    },
    "Not Now": {
        "English": "Not Now",
        "Hindi": "अभी नहीं",
        "Kannada": "ಈಗ ಅಲ್ಲ",
        "Tamil": "இப்போது இல்லை",
        "Telugu": "ఇప్పుడు కాదు",
        "Marathi": "आता नाही",
        "Bengali": "এখন নয়",
        "Gujarati": "હમણાં નહીં",
        "Punjabi": "ਹੁਣ ਨਹੀਂ",
        "Malayalam": "ഇപ്പോൾ അല്ല",
        "Odia": "ଏବେ ନୁହେଁ"
    },
    "Install App": {
        "English": "Install App",
        "Hindi": "ऐप इंस्टॉल करें",
        "Kannada": "ಅಪ್ಲಿಕೇಶನ್ ಸ್ಥಾಪಿಸಿ",
        "Tamil": "பயன்பாட்டை நிறுவவும்",
        "Telugu": "యాప్‌ను ఇన్‌స్టాల్ చేయండి",
        "Marathi": "अ‍ॅप इन्स्टॉल करा",
        "Bengali": "অ্যাপ ইনস্টল করুন",
        "Gujarati": "ઍપ ઇન્સ્ટોલ કરો",
        "Punjabi": "ਐਪ ਇੰਸਟਾਲ ਕਰੋ",
        "Malayalam": "ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക",
        "Odia": "ଆପ୍ ଇନଷ୍ଟଲ୍ କରନ୍ତୁ"
    },
    "I'm listening...": {
        "English": "I'm listening...",
        "Hindi": "मैं सुन रहा हूँ...",
        "Kannada": "ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ...",
        "Tamil": "நான் கேட்கிறேன்...",
        "Telugu": "నేను వింటున్నాను...",
        "Marathi": "मी ऐकत आहे...",
        "Bengali": "আমি শুনছি...",
        "Gujarati": "હું સાંભળી રહ્યો છું...",
        "Punjabi": "ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ...",
        "Malayalam": "ഞാൻ കേൾക്കുന്നുണ്ട്...",
        "Odia": "ମୁଁ ଶୁଣୁଛି..."
    },
    "Getting ready…": {
        "English": "Getting ready…",
        "Hindi": "तैयार हो रहा है…",
        "Kannada": "ಸಿದ್ಧವಾಗುತ್ತಿದೆ…",
        "Tamil": "தயாராகிறேன்…",
        "Telugu": "సిద్ధమవుతోంది…",
        "Marathi": "तयार होत आहे…",
        "Bengali": "প্রস্তুত হচ্ছি…",
        "Gujarati": "તૈયાર થઈ રહ્યું છે…",
        "Punjabi": "ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ…",
        "Malayalam": "തയ്യാറാകുന്നു…",
        "Odia": "ପ୍ରସ୍ତୁତ ହେଉଛି…"
    },
    "Thinking…": {
        "English": "Thinking…",
        "Hindi": "सोच रहा हूँ…",
        "Kannada": "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…",
        "Tamil": "சிந்திக்கிறேன்…",
        "Telugu": "ఆలోచిస్తున్నాను…",
        "Marathi": "विचार करत आहे…",
        "Bengali": "ভাবছি…",
        "Gujarati": "વિચારી રહ્યો છું…",
        "Punjabi": "ਸੋਚ ਰਿਹਾ ਹਾਂ…",
        "Malayalam": "ചിന്തിക്കുന്നു…",
        "Odia": "ଚିନ୍ତା କରୁଛି…"
    },
    "Tap to speak": {
        "English": "Tap to speak",
        "Hindi": "बोलने के लिए टैप करें",
        "Kannada": "ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
        "Tamil": "பேச தட்டவும்",
        "Telugu": "మాట్లాడటానికి ట్యాప్ చేయండి",
        "Marathi": "बोलण्यासाठी टॅप करा",
        "Bengali": "কথা বলতে ট্যাপ করুন",
        "Gujarati": "બોલવા માટે ટેપ કરો",
        "Punjabi": "ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ",
        "Malayalam": "സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക",
        "Odia": "କହିବା ପାଇଁ ଟାପ୍ କରନ୍ତୁ"
    },
    // Inline mic button aria-label (Phase 2 FieldRow primitive)
    "Speak instead of typing": {
        "English": "Speak instead of typing",
        "Hindi": "टाइप करने के बजाय बोलें",
        "Kannada": "ಟೈಪ್ ಮಾಡುವ ಬದಲು ಮಾತನಾಡಿ",
        "Tamil": "தட்டச்சு செய்வதற்குப் பதிலாக பேசுங்கள்",
        "Telugu": "టైప్ చేయడానికి బదులుగా మాట్లాడండి",
        "Marathi": "टाईप करण्याऐवजी बोला",
        "Bengali": "টাইপ করার পরিবর্তে বলুন",
        "Gujarati": "ટાઇપ કરવાને બદલે બોલો",
        "Punjabi": "ਟਾਈਪ ਕਰਨ ਦੀ ਬਜਾਏ ਬੋਲੋ",
        "Malayalam": "ടൈപ്പ് ചെയ്യുന്നതിനു പകരം സംസാരിക്കുക",
        "Odia": "ଟାଇପ୍ କରିବା ବଦଳରେ କହନ୍ତୁ"
    },
    // --- Onboarding role picker (Section 0) ---
    // EN + HI + KN translated for the Karnataka pilot. Other 8 languages fall back to English
    // as placeholder (t() returns the entry's English value); replace with native translations
    // when those pilots launch.
    "Your role at school": {
        "English": "Your role at school", "Hindi": "स्कूल में आपकी भूमिका", "Kannada": "ಶಾಲೆಯಲ್ಲಿ ನಿಮ್ಮ ಪಾತ್ರ",
        "Tamil": "Your role at school", "Telugu": "Your role at school", "Marathi": "Your role at school",
        "Bengali": "Your role at school", "Gujarati": "Your role at school", "Punjabi": "Your role at school",
        "Malayalam": "Your role at school", "Odia": "Your role at school"
    },
    "Classroom Teacher": {
        "English": "Classroom Teacher", "Hindi": "कक्षा शिक्षक", "Kannada": "ತರಗತಿ ಶಿಕ್ಷಕ",
        "Tamil": "Classroom Teacher", "Telugu": "Classroom Teacher", "Marathi": "Classroom Teacher",
        "Bengali": "Classroom Teacher", "Gujarati": "Classroom Teacher", "Punjabi": "Classroom Teacher",
        "Malayalam": "Classroom Teacher", "Odia": "Classroom Teacher"
    },
    "Teach one or more classes": {
        "English": "Teach one or more classes", "Hindi": "एक या अधिक कक्षाएँ पढ़ाते हैं", "Kannada": "ಒಂದು ಅಥವಾ ಹೆಚ್ಚಿನ ತರಗತಿಗಳನ್ನು ಕಲಿಸುತ್ತೀರಿ",
        "Tamil": "Teach one or more classes", "Telugu": "Teach one or more classes", "Marathi": "Teach one or more classes",
        "Bengali": "Teach one or more classes", "Gujarati": "Teach one or more classes", "Punjabi": "Teach one or more classes",
        "Malayalam": "Teach one or more classes", "Odia": "Teach one or more classes"
    },
    "HOD / Subject Lead": {
        "English": "HOD / Subject Lead", "Hindi": "विभागाध्यक्ष / विषय प्रमुख", "Kannada": "ವಿಭಾಗ ಮುಖ್ಯಸ್ಥ / ವಿಷಯ ಮುಖ್ಯಸ್ಥ",
        "Tamil": "HOD / Subject Lead", "Telugu": "HOD / Subject Lead", "Marathi": "HOD / Subject Lead",
        "Bengali": "HOD / Subject Lead", "Gujarati": "HOD / Subject Lead", "Punjabi": "HOD / Subject Lead",
        "Malayalam": "HOD / Subject Lead", "Odia": "HOD / Subject Lead"
    },
    "HOD": {
        "English": "HOD", "Hindi": "विभागाध्यक्ष", "Kannada": "ವಿಭಾಗ ಮುಖ್ಯಸ್ಥ",
        "Tamil": "HOD", "Telugu": "HOD", "Marathi": "HOD",
        "Bengali": "HOD", "Gujarati": "HOD", "Punjabi": "HOD",
        "Malayalam": "HOD", "Odia": "HOD"
    },
    "Lead a subject department": {
        "English": "Lead a subject department", "Hindi": "किसी विषय विभाग का नेतृत्व करते हैं", "Kannada": "ವಿಷಯ ವಿಭಾಗವನ್ನು ಮುನ್ನಡೆಸುತ್ತೀರಿ",
        "Tamil": "Lead a subject department", "Telugu": "Lead a subject department", "Marathi": "Lead a subject department",
        "Bengali": "Lead a subject department", "Gujarati": "Lead a subject department", "Punjabi": "Lead a subject department",
        "Malayalam": "Lead a subject department", "Odia": "Lead a subject department"
    },
    "Vice Principal / Coordinator": {
        "English": "Vice Principal / Coordinator", "Hindi": "उप-प्राचार्य / समन्वयक", "Kannada": "ಉಪ ಮುಖ್ಯೋಪಾಧ್ಯಾಯ / ಸಂಯೋಜಕ",
        "Tamil": "Vice Principal / Coordinator", "Telugu": "Vice Principal / Coordinator", "Marathi": "Vice Principal / Coordinator",
        "Bengali": "Vice Principal / Coordinator", "Gujarati": "Vice Principal / Coordinator", "Punjabi": "Vice Principal / Coordinator",
        "Malayalam": "Vice Principal / Coordinator", "Odia": "Vice Principal / Coordinator"
    },
    "Vice Principal": {
        "English": "Vice Principal", "Hindi": "उप-प्राचार्य", "Kannada": "ಉಪ ಮುಖ್ಯೋಪಾಧ್ಯಾಯ",
        "Tamil": "Vice Principal", "Telugu": "Vice Principal", "Marathi": "Vice Principal",
        "Bengali": "Vice Principal", "Gujarati": "Vice Principal", "Punjabi": "Vice Principal",
        "Malayalam": "Vice Principal", "Odia": "Vice Principal"
    },
    "Manage academics for a wing": {
        "English": "Manage academics for a wing", "Hindi": "किसी विंग के शैक्षणिक कार्य संभालते हैं", "Kannada": "ಒಂದು ವಿಭಾಗದ ಶೈಕ್ಷಣಿಕ ಕಾರ್ಯಗಳನ್ನು ನಿರ್ವಹಿಸುತ್ತೀರಿ",
        "Tamil": "Manage academics for a wing", "Telugu": "Manage academics for a wing", "Marathi": "Manage academics for a wing",
        "Bengali": "Manage academics for a wing", "Gujarati": "Manage academics for a wing", "Punjabi": "Manage academics for a wing",
        "Malayalam": "Manage academics for a wing", "Odia": "Manage academics for a wing"
    },
    "Principal / School Admin": {
        "English": "Principal / School Admin", "Hindi": "प्राचार्य / विद्यालय प्रशासक", "Kannada": "ಮುಖ್ಯೋಪಾಧ್ಯಾಯ / ಶಾಲಾ ನಿರ್ವಾಹಕ",
        "Tamil": "Principal / School Admin", "Telugu": "Principal / School Admin", "Marathi": "Principal / School Admin",
        "Bengali": "Principal / School Admin", "Gujarati": "Principal / School Admin", "Punjabi": "Principal / School Admin",
        "Malayalam": "Principal / School Admin", "Odia": "Principal / School Admin"
    },
    "Principal": {
        "English": "Principal", "Hindi": "प्राचार्य", "Kannada": "ಮುಖ್ಯೋಪಾಧ್ಯಾಯ",
        "Tamil": "Principal", "Telugu": "Principal", "Marathi": "Principal",
        "Bengali": "Principal", "Gujarati": "Principal", "Punjabi": "Principal",
        "Malayalam": "Principal", "Odia": "Principal"
    },
    "Run the school": {
        "English": "Run the school", "Hindi": "विद्यालय का संचालन करते हैं", "Kannada": "ಶಾಲೆಯನ್ನು ನಡೆಸುತ್ತೀರಿ",
        "Tamil": "Run the school", "Telugu": "Run the school", "Marathi": "Run the school",
        "Bengali": "Run the school", "Gujarati": "Run the school", "Punjabi": "Run the school",
        "Malayalam": "Run the school", "Odia": "Run the school"
    },
    "Coordinator": {
        "English": "Coordinator", "Hindi": "समन्वयक", "Kannada": "ಸಂಯೋಜಕ",
        "Tamil": "Coordinator", "Telugu": "Coordinator", "Marathi": "Coordinator",
        "Bengali": "Coordinator", "Gujarati": "Coordinator", "Punjabi": "Coordinator",
        "Malayalam": "Coordinator", "Odia": "Coordinator"
    },
    "Exam Controller": {
        "English": "Exam Controller", "Hindi": "परीक्षा नियंत्रक", "Kannada": "ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕ",
        "Tamil": "Exam Controller", "Telugu": "Exam Controller", "Marathi": "Exam Controller",
        "Bengali": "Exam Controller", "Gujarati": "Exam Controller", "Punjabi": "Exam Controller",
        "Malayalam": "Exam Controller", "Odia": "Exam Controller"
    },
    // ---- Marketing pages (added 2026-04-24 for rural-teacher accessibility) ----
    // Translation priority: English + Hindi + Kannada are translated; other 8 languages
    // fall back to English (rolling — contribute via /submit-content in-app form).
    "Listen in your language": {
        "English": "Listen in your language", "Hindi": "अपनी भाषा में सुनें", "Kannada": "ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ",
        "Tamil": "உங்கள் மொழியில் கேளுங்கள்", "Telugu": "మీ భాషలో వినండి", "Marathi": "आपल्या भाषेत ऐका",
        "Bengali": "আপনার ভাষায় শুনুন", "Gujarati": "તમારી ભાષામાં સાંભળો", "Punjabi": "ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸੁਣੋ",
        "Malayalam": "നിങ്ങളുടെ ഭാഷയിൽ കേൾക്കുക", "Odia": "ଆପଣଙ୍କ ଭାଷାରେ ଶୁଣନ୍ତୁ"
    },
    "Stop listening": {
        "English": "Stop listening", "Hindi": "सुनना बंद करें", "Kannada": "ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
        "Tamil": "கேட்பதை நிறுத்து", "Telugu": "వినడం ఆపండి", "Marathi": "ऐकणे थांबवा",
        "Bengali": "শোনা বন্ধ করুন", "Gujarati": "સાંભળવાનું બંધ કરો", "Punjabi": "ਸੁਣਨਾ ਬੰਦ ਕਰੋ",
        "Malayalam": "കേൾക്കുന്നത് നിർത്തുക", "Odia": "ଶୁଣିବା ବନ୍ଦ କରନ୍ତୁ"
    },
    "Language": {
        "English": "Language", "Hindi": "भाषा", "Kannada": "ಭಾಷೆ",
        "Tamil": "மொழி", "Telugu": "భాష", "Marathi": "भाषा",
        "Bengali": "ভাষা", "Gujarati": "ભાષા", "Punjabi": "ਭਾਸ਼ਾ",
        "Malayalam": "ഭാഷ", "Odia": "ଭାଷା"
    },
    "Start free": {
        "English": "Start free", "Hindi": "मुफ्त शुरू करें", "Kannada": "ಉಚಿತವಾಗಿ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "இலவசமாக தொடங்கு", "Telugu": "ఉచితంగా ప్రారంభించండి", "Marathi": "मोफत सुरू करा",
        "Bengali": "বিনামূল্যে শুরু করুন", "Gujarati": "મફત શરૂ કરો", "Punjabi": "ਮੁਫ਼ਤ ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "സൗജന്യമായി ആരംഭിക്കുക", "Odia": "ମାଗଣାରେ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Log in": {
        "English": "Log in", "Hindi": "लॉग इन करें", "Kannada": "ಲಾಗ್ ಇನ್",
        "Tamil": "உள்நுழை", "Telugu": "లాగిన్", "Marathi": "लॉग इन करा",
        "Bengali": "লগ ইন করুন", "Gujarati": "લોગ ઇન કરો", "Punjabi": "ਲੌਗ ਇਨ ਕਰੋ",
        "Malayalam": "ലോഗിൻ ചെയ്യുക", "Odia": "ଲଗ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Pricing, for Indian teachers": {
        "English": "Pricing, for Indian teachers", "Hindi": "भारतीय शिक्षकों के लिए कीमत", "Kannada": "ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ ಬೆಲೆ",
        "Tamil": "இந்திய ஆசிரியர்களுக்கான விலை", "Telugu": "భారతీయ ఉపాధ్యాయుల కోసం ధర", "Marathi": "भारतीय शिक्षकांसाठी किंमत",
        "Bengali": "ভারতীয় শিক্ষকদের জন্য মূল্য", "Gujarati": "ભારતીય શિક્ષકો માટે કિંમત", "Punjabi": "ਭਾਰਤੀ ਅਧਿਆਪਕਾਂ ਲਈ ਕੀਮਤ",
        "Malayalam": "ഇന്ത്യൻ അധ്യാപകർക്കുള്ള വില", "Odia": "ଭାରତୀୟ ଶିକ୍ଷକଙ୍କ ପାଇଁ ମୂଲ୍ୟ"
    },
    "Less than a textbook.": {
        "English": "Less than a textbook.", "Hindi": "एक किताब से भी कम।", "Kannada": "ಪಠ್ಯಪುಸ್ತಕಕ್ಕಿಂತ ಕಡಿಮೆ.",
        "Tamil": "ஒரு பாடப்புத்தகத்தை விட குறைவு.", "Telugu": "పాఠ్యపుస్తకం కంటే తక్కువ.", "Marathi": "पाठ्यपुस्तकापेक्षा कमी.",
        "Bengali": "একটি পাঠ্যবইয়ের চেয়ে কম।", "Gujarati": "પાઠ્યપુસ્તક કરતાં ઓછું.", "Punjabi": "ਇੱਕ ਪਾਠ ਪੁਸਤਕ ਤੋਂ ਘੱਟ।",
        "Malayalam": "ഒരു പാഠപുസ്തകത്തേക്കാൾ കുറവ്.", "Odia": "ଗୋଟିଏ ପାଠ୍ୟପୁସ୍ତକଠାରୁ କମ୍।"
    },
    "Yours to cancel anytime.": {
        "English": "Yours to cancel anytime.", "Hindi": "कभी भी रद्द करें।", "Kannada": "ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಿ.",
        "Tamil": "எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்.", "Telugu": "ఎప్పుడైనా రద్దు చేసుకోవచ్చు.", "Marathi": "कधीही रद्द करा.",
        "Bengali": "যেকোনো সময় বাতিল করুন।", "Gujarati": "ગમે ત્યારે રદ કરો.", "Punjabi": "ਕਦੇ ਵੀ ਰੱਦ ਕਰੋ।",
        "Malayalam": "എപ്പോൾ വേണമെങ്കിലും റദ്ദാക്കാം.", "Odia": "ଯେକୌଣସି ସମୟରେ ବାତିଲ କରନ୍ତୁ।"
    },
    "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.": {
        "English": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Hindi": "हर प्लान में NCERT और 28 राज्य बोर्ड, 11 भारतीय भाषाएँ, और किसी भी एंड्रॉयड फोन पर वॉयस इनपुट शामिल है।",
        "Kannada": "ಪ್ರತಿ ಪ್ಲಾನ್ NCERT ಮತ್ತು 28 ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳು, 11 ಭಾರತೀಯ ಭಾಷೆಗಳು, ಮತ್ತು ಯಾವುದೇ ಆಂಡ್ರಾಯ್ಡ್ ಫೋನ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಅನ್ನು ಒಳಗೊಂಡಿರುತ್ತದೆ.",
        "Tamil": "ஒவ்வொரு திட்டத்திலும் NCERT மற்றும் 28 மாநில வாரியங்கள், 11 இந்திய மொழிகள், மற்றும் எந்த Android ஃபோனிலும் குரல் உள்ளீடு அடங்கும்.",
        "Telugu": "ప్రతి ప్లాన్‌లో NCERT మరియు 28 రాష్ట్ర బోర్డులు, 11 భారతీయ భాషలు, మరియు ఏ Android ఫోన్‌లోనైనా వాయిస్ ఇన్‌పుట్ ఉంటాయి.",
        "Marathi": "प्रत्येक प्लॅनमध्ये NCERT आणि 28 राज्य मंडळे, 11 भारतीय भाषा, आणि कोणत्याही Android फोनवर व्हॉइस इनपुट समाविष्ट आहे.",
        "Bengali": "প্রতিটি প্ল্যানে NCERT এবং 28টি রাজ্য বোর্ড, 11টি ভারতীয় ভাষা, এবং যেকোনো Android ফোনে ভয়েস ইনপুট অন্তর্ভুক্ত রয়েছে।",
        "Gujarati": "દરેક પ્લાનમાં NCERT અને 28 રાજ્ય બોર્ડ, 11 ભારતીય ભાષાઓ, અને કોઈપણ Android ફોન પર વૉઇસ ઇનપુટ સામેલ છે.",
        "Punjabi": "ਹਰੇਕ ਪਲਾਨ ਵਿੱਚ NCERT ਅਤੇ 28 ਰਾਜ ਬੋਰਡ, 11 ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ, ਅਤੇ ਕਿਸੇ ਵੀ Android ਫ਼ੋਨ 'ਤੇ ਵੌਇਸ ਇਨਪੁੱਟ ਸ਼ਾਮਲ ਹੈ।",
        "Malayalam": "ഓരോ പ്ലാനിലും NCERT യും 28 സംസ്ഥാന ബോർഡുകളും, 11 ഇന്ത്യൻ ഭാഷകളും, ഏത് Android ഫോണിലും വോയ്സ് ഇൻപുട്ടും ഉൾപ്പെടുന്നു.",
        "Odia": "ପ୍ରତ୍ୟେକ ପ୍ଲାନରେ NCERT ଏବଂ 28ଟି ରାଜ୍ୟ ବୋର୍ଡ, 11ଟି ଭାରତୀୟ ଭାଷା, ଏବଂ ଯେକୌଣସି Android ଫୋନରେ ଭଏସ୍ ଇନପୁଟ୍ ଅନ୍ତର୍ଭୁକ୍ତ।"
    },
    "Monthly": {
        "English": "Monthly", "Hindi": "मासिक", "Kannada": "ಮಾಸಿಕ",
        "Tamil": "மாதாந்திரம்", "Telugu": "నెలవారీ", "Marathi": "मासिक",
        "Bengali": "মাসিক", "Gujarati": "માસિક", "Punjabi": "ਮਹੀਨਾਵਾਰ",
        "Malayalam": "പ്രതിമാസം", "Odia": "ମାସିକ"
    },
    "Annual": {
        "English": "Annual", "Hindi": "वार्षिक", "Kannada": "ವಾರ್ಷಿಕ",
        "Tamil": "வருடாந்திரம்", "Telugu": "వార్షిక", "Marathi": "वार्षिक",
        "Bengali": "বার্ষিক", "Gujarati": "વાર્ષિક", "Punjabi": "ਸਾਲਾਨਾ",
        "Malayalam": "വാർഷികം", "Odia": "ବାର୍ଷିକ"
    },
    "Save 2 months": {
        "English": "Save 2 months", "Hindi": "2 महीने बचाएं", "Kannada": "2 ತಿಂಗಳು ಉಳಿಸಿ",
        "Tamil": "2 மாதங்கள் சேமியுங்கள்", "Telugu": "2 నెలలు ఆదా చేయండి", "Marathi": "2 महिने वाचवा",
        "Bengali": "2 মাস সাশ্রয় করুন", "Gujarati": "2 મહિના બચાવો", "Punjabi": "2 ਮਹੀਨੇ ਬਚਾਓ",
        "Malayalam": "2 മാസം ലാഭിക്കുക", "Odia": "2 ମାସ ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    "Free": {
        "English": "Free", "Hindi": "मुफ़्त", "Kannada": "ಉಚಿತ",
        "Tamil": "இலவசம்", "Telugu": "ఉచితం", "Marathi": "मोफत",
        "Bengali": "বিনামূল্যে", "Gujarati": "મફત", "Punjabi": "ਮੁਫ਼ਤ",
        "Malayalam": "സൗജന്യം", "Odia": "ମାଗଣା"
    },
    "forever": {
        "English": "forever", "Hindi": "हमेशा के लिए", "Kannada": "ಶಾಶ್ವತವಾಗಿ",
        "Tamil": "எப்போதும்", "Telugu": "ఎల్లప్పుడూ", "Marathi": "कायमस्वरूपी",
        "Bengali": "চিরকাল", "Gujarati": "હંમેશા", "Punjabi": "ਹਮੇਸ਼ਾ ਲਈ",
        "Malayalam": "എന്നും", "Odia": "ସବୁଦିନ ପାଇଁ"
    },
    "Most popular": {
        "English": "Most popular", "Hindi": "सबसे लोकप्रिय", "Kannada": "ಅತ್ಯಂತ ಜನಪ್ರಿಯ",
        "Tamil": "மிகவும் பிரபலம்", "Telugu": "అత్యంత జనాదరణ", "Marathi": "सर्वाधिक लोकप्रिय",
        "Bengali": "সবচেয়ে জনপ্রিয়", "Gujarati": "સૌથી લોકપ્રિય", "Punjabi": "ਸਭ ਤੋਂ ਪ੍ਰਸਿੱਧ",
        "Malayalam": "ഏറ്റവും ജനപ്രിയം", "Odia": "ସର୍ବାଧିକ ଲୋକପ୍ରିୟ"
    },
    "Pro": {
        "English": "Pro", "Hindi": "प्रो", "Kannada": "ಪ್ರೊ",
        "Tamil": "Pro", "Telugu": "Pro", "Marathi": "Pro",
        "Bengali": "Pro", "Gujarati": "Pro", "Punjabi": "Pro",
        "Malayalam": "Pro", "Odia": "Pro"
    },
    "School Gold": {
        "English": "School Gold", "Hindi": "स्कूल गोल्ड", "Kannada": "ಸ್ಕೂಲ್ ಗೋಲ್ಡ್",
        "Tamil": "School Gold", "Telugu": "School Gold", "Marathi": "School Gold",
        "Bengali": "School Gold", "Gujarati": "School Gold", "Punjabi": "School Gold",
        "Malayalam": "School Gold", "Odia": "School Gold"
    },
    "School Premium": {
        "English": "School Premium", "Hindi": "स्कूल प्रीमियम", "Kannada": "ಸ್ಕೂಲ್ ಪ್ರೀಮಿಯಂ",
        "Tamil": "School Premium", "Telugu": "School Premium", "Marathi": "School Premium",
        "Bengali": "School Premium", "Gujarati": "School Premium", "Punjabi": "School Premium",
        "Malayalam": "School Premium", "Odia": "School Premium"
    },
    "/month": {
        "English": "/month", "Hindi": "/माह", "Kannada": "/ತಿಂಗಳು",
        "Tamil": "/மாதம்", "Telugu": "/నెల", "Marathi": "/महिना",
        "Bengali": "/মাস", "Gujarati": "/મહિનો", "Punjabi": "/ਮਹੀਨਾ",
        "Malayalam": "/മാസം", "Odia": "/ମାସ"
    },
    "/year": {
        "English": "/year", "Hindi": "/वर्ष", "Kannada": "/ವರ್ಷ",
        "Tamil": "/வருடம்", "Telugu": "/సంవత్సరం", "Marathi": "/वर्ष",
        "Bengali": "/বছর", "Gujarati": "/વર્ષ", "Punjabi": "/ਸਾਲ",
        "Malayalam": "/വർഷം", "Odia": "/ବର୍ଷ"
    },
    "/teacher/year": {
        "English": "/teacher/year", "Hindi": "/शिक्षक/वर्ष", "Kannada": "/ಶಿಕ್ಷಕ/ವರ್ಷ",
        "Tamil": "/ஆசிரியர்/வருடம்", "Telugu": "/ఉపాధ్యాయుడు/సంవత్సరం", "Marathi": "/शिक्षक/वर्ष",
        "Bengali": "/শিক্ষক/বছর", "Gujarati": "/શિક્ષક/વર્ષ", "Punjabi": "/ਅਧਿਆਪਕ/ਸਾਲ",
        "Malayalam": "/അധ്യാപകൻ/വർഷം", "Odia": "/ଶିକ୍ଷକ/ବର୍ଷ"
    },
    "Start Pro": {
        "English": "Start Pro", "Hindi": "प्रो शुरू करें", "Kannada": "ಪ್ರೊ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "Pro தொடங்கு", "Telugu": "Pro ప్రారంభించండి", "Marathi": "Pro सुरू करा",
        "Bengali": "Pro শুরু করুন", "Gujarati": "Pro શરૂ કરો", "Punjabi": "Pro ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "Pro ആരംഭിക്കുക", "Odia": "Pro ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Book a school demo": {
        "English": "Book a school demo", "Hindi": "स्कूल डेमो बुक करें", "Kannada": "ಸ್ಕೂಲ್ ಡೆಮೊ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "பள்ளி டெமோ புக் செய்யுங்கள்", "Telugu": "స్కూల్ డెమో బుక్ చేయండి", "Marathi": "शाळेचा डेमो बुक करा",
        "Bengali": "স্কুল ডেমো বুক করুন", "Gujarati": "શાળા ડેમો બુક કરો", "Punjabi": "ਸਕੂਲ ਡੈਮੋ ਬੁੱਕ ਕਰੋ",
        "Malayalam": "സ്കൂൾ ഡെമോ ബുക്ക് ചെയ്യുക", "Odia": "ସ୍କୁଲ୍ ଡେମୋ ବୁକ୍ କରନ୍ତୁ"
    },
    "Your plan": {
        "English": "Your plan", "Hindi": "आपका प्लान", "Kannada": "ನಿಮ್ಮ ಪ್ಲಾನ್",
        "Tamil": "உங்கள் திட்டம்", "Telugu": "మీ ప్లాన్", "Marathi": "आपला प्लॅन",
        "Bengali": "আপনার প্ল্যান", "Gujarati": "તમારો પ્લાન", "Punjabi": "ਤੁਹਾਡਾ ਪਲਾਨ",
        "Malayalam": "നിങ്ങളുടെ പ്ലാൻ", "Odia": "ଆପଣଙ୍କ ପ୍ଲାନ୍"
    },
    "Tax included": {
        "English": "Tax included", "Hindi": "टैक्स शामिल", "Kannada": "ತೆರಿಗೆ ಸೇರಿದೆ",
        "Tamil": "வரி உட்பட", "Telugu": "పన్ను కలిపి", "Marathi": "कर समाविष्ट",
        "Bengali": "কর অন্তর্ভুক্ত", "Gujarati": "કર સામેલ", "Punjabi": "ਟੈਕਸ ਸ਼ਾਮਲ",
        "Malayalam": "നികുതി ഉൾപ്പെടെ", "Odia": "କର ଅନ୍ତର୍ଭୁକ୍ତ"
    },
    "7-day refund. Cancel anytime.": {
        "English": "7-day refund. Cancel anytime.", "Hindi": "7 दिन का रिफंड। कभी भी रद्द करें।", "Kannada": "7 ದಿನಗಳ ಮರುಪಾವತಿ. ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಿ.",
        "Tamil": "7-நாள் பணத்திரும்ப பெறல். எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்.", "Telugu": "7-రోజుల రీఫండ్. ఎప్పుడైనా రద్దు చేయవచ్చు.", "Marathi": "7-दिवसांचा परतावा. कधीही रद्द करा.",
        "Bengali": "7-দিনের রিফান্ড। যেকোনো সময় বাতিল করুন।", "Gujarati": "7-દિવસનું રિફંડ. ગમે ત્યારે રદ કરો.", "Punjabi": "7-ਦਿਨ ਦੀ ਵਾਪਸੀ। ਕਦੇ ਵੀ ਰੱਦ ਕਰੋ।",
        "Malayalam": "7-ദിവസത്തെ റീഫണ്ട്. എപ്പോൾ വേണമെങ്കിലും റദ്ദാക്കാം.", "Odia": "7-ଦିନର ରିଫଣ୍ଡ୍। ଯେକୌଣସି ସମୟରେ ବାତିଲ କରନ୍ତୁ।"
    },
    // Terms TL;DR (plain-language summary)
    "In plain words": {
        "English": "In plain words", "Hindi": "आसान शब्दों में", "Kannada": "ಸುಲಭ ಪದಗಳಲ್ಲಿ",
        "Tamil": "எளிய வார்த்தைகளில்", "Telugu": "సులభమైన మాటల్లో", "Marathi": "सोप्या शब्दांत",
        "Bengali": "সহজ কথায়", "Gujarati": "સરળ શબ્દોમાં", "Punjabi": "ਸਾਧਾਰਨ ਸ਼ਬਦਾਂ ਵਿੱਚ",
        "Malayalam": "ലളിതമായ വാക്കുകളിൽ", "Odia": "ସରଳ ଶବ୍ଦରେ"
    },
    "Whatever you create with SahayakAI is yours.": {
        "English": "Whatever you create with SahayakAI is yours.",
        "Hindi": "आप SahayakAI से जो भी बनाते हैं, वह आपका है।",
        "Kannada": "SahayakAI ನೊಂದಿಗೆ ನೀವು ಏನು ರಚಿಸುತ್ತೀರೋ ಅದು ನಿಮ್ಮದು.",
        "Tamil": "SahayakAI உடன் நீங்கள் உருவாக்குவது எதுவாக இருந்தாலும் அது உங்களுடையது.",
        "Telugu": "SahayakAI తో మీరు సృష్టించేది ఏదైనా మీదే.",
        "Marathi": "SahayakAI सह तुम्ही जे काही तयार करता ते तुमचे आहे.",
        "Bengali": "SahayakAI দিয়ে আপনি যা কিছু তৈরি করেন তা আপনার।",
        "Gujarati": "SahayakAI સાથે તમે જે કંઈ બનાવો છો તે તમારું છે.",
        "Punjabi": "SahayakAI ਨਾਲ ਤੁਸੀਂ ਜੋ ਵੀ ਬਣਾਉਂਦੇ ਹੋ, ਉਹ ਤੁਹਾਡਾ ਹੈ।",
        "Malayalam": "SahayakAI ഉപയോഗിച്ച് നിങ്ങൾ സൃഷ്ടിക്കുന്നതെന്തും നിങ്ങളുടേതാണ്.",
        "Odia": "SahayakAI ସହିତ ଆପଣ ଯାହା ସୃଷ୍ଟି କରନ୍ତି, ତାହା ଆପଣଙ୍କର।"
    },
    "You can cancel anytime. 7-day refund on any paid plan.": {
        "English": "You can cancel anytime. 7-day refund on any paid plan.",
        "Hindi": "आप कभी भी रद्द कर सकते हैं। किसी भी भुगतान प्लान पर 7 दिन का रिफंड।",
        "Kannada": "ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಬಹುದು. ಯಾವುದೇ ಪಾವತಿ ಪ್ಲಾನ್‌ನಲ್ಲಿ 7 ದಿನಗಳ ಮರುಪಾವತಿ.",
        "Tamil": "நீங்கள் எப்போது வேண்டுமானாலும் ரத்து செய்யலாம். எந்த பணம் செலுத்தும் திட்டத்திலும் 7-நாள் பணத்திரும்ப பெறல்.",
        "Telugu": "మీరు ఎప్పుడైనా రద్దు చేయవచ్చు. ఏ చెల్లింపు ప్లాన్‌పైనైనా 7-రోజుల రీఫండ్.",
        "Marathi": "तुम्ही कधीही रद्द करू शकता. कोणत्याही सशुल्क प्लॅनवर 7-दिवसांचा परतावा.",
        "Bengali": "আপনি যেকোনো সময় বাতিল করতে পারেন। যেকোনো পেইড প্ল্যানে 7-দিনের রিফান্ড।",
        "Gujarati": "તમે ગમે ત્યારે રદ કરી શકો છો. કોઈપણ પેઇડ પ્લાન પર 7-દિવસનું રિફંડ.",
        "Punjabi": "ਤੁਸੀਂ ਕਦੇ ਵੀ ਰੱਦ ਕਰ ਸਕਦੇ ਹੋ। ਕਿਸੇ ਵੀ ਅਦਾਇਗੀ ਪਲਾਨ 'ਤੇ 7-ਦਿਨ ਦੀ ਵਾਪਸੀ।",
        "Malayalam": "നിങ്ങൾക്ക് എപ്പോൾ വേണമെങ്കിലും റദ്ദാക്കാം. ഏതൊരു പണമടച്ച പ്ലാനിലും 7-ദിവസത്തെ റീഫണ്ട്.",
        "Odia": "ଆପଣ ଯେକୌଣସି ସମୟରେ ବାତିଲ କରିପାରିବେ। ଯେକୌଣସି ଦେୟ ପ୍ଲାନ୍‌ରେ 7-ଦିନର ରିଫଣ୍ଡ୍।"
    },
    "Your data stays in India and you control it.": {
        "English": "Your data stays in India and you control it.",
        "Hindi": "आपका डेटा भारत में रहता है और उस पर आपका नियंत्रण है।",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ ಭಾರತದಲ್ಲಿ ಇರುತ್ತದೆ ಮತ್ತು ಅದನ್ನು ನೀವೇ ನಿಯಂತ್ರಿಸುತ್ತೀರಿ.",
        "Tamil": "உங்கள் தரவு இந்தியாவில் இருக்கிறது மற்றும் அதை நீங்கள் கட்டுப்படுத்துகிறீர்கள்.",
        "Telugu": "మీ డేటా భారతదేశంలోనే ఉంటుంది మరియు మీరే దానిని నియంత్రిస్తారు.",
        "Marathi": "तुमचा डेटा भारतात राहतो आणि तुम्ही त्यावर नियंत्रण ठेवता.",
        "Bengali": "আপনার ডেটা ভারতে থাকে এবং আপনি এটি নিয়ন্ত্রণ করেন।",
        "Gujarati": "તમારો ડેટા ભારતમાં રહે છે અને તમે તેને નિયંત્રિત કરો છો.",
        "Punjabi": "ਤੁਹਾਡਾ ਡਾਟਾ ਭਾਰਤ ਵਿੱਚ ਰਹਿੰਦਾ ਹੈ ਅਤੇ ਤੁਸੀਂ ਇਸਨੂੰ ਕੰਟਰੋਲ ਕਰਦੇ ਹੋ।",
        "Malayalam": "നിങ്ങളുടെ ഡാറ്റ ഇന്ത്യയിൽ തന്നെ തുടരുന്നു, അത് നിങ്ങൾ നിയന്ത്രിക്കുന്നു.",
        "Odia": "ଆପଣଙ୍କ ଡାଟା ଭାରତରେ ରହେ ଏବଂ ଆପଣ ଏହାକୁ ନିୟନ୍ତ୍ରଣ କରନ୍ତି।"
    },
    "SahayakAI never asks for student personal data.": {
        "English": "SahayakAI never asks for student personal data.",
        "Hindi": "SahayakAI कभी भी छात्रों का निजी डेटा नहीं मांगता।",
        "Kannada": "SahayakAI ಎಂದಿಗೂ ವಿದ್ಯಾರ್ಥಿಗಳ ವೈಯಕ್ತಿಕ ಡೇಟಾವನ್ನು ಕೇಳುವುದಿಲ್ಲ.",
        "Tamil": "SahayakAI மாணவர்களின் தனிப்பட்ட தரவை ஒருபோதும் கேட்பதில்லை.",
        "Telugu": "SahayakAI విద్యార్థుల వ్యక్తిగత డేటాను ఎప్పుడూ అడగదు.",
        "Marathi": "SahayakAI कधीही विद्यार्थ्यांचा वैयक्तिक डेटा मागत नाही.",
        "Bengali": "SahayakAI কখনোই শিক্ষার্থীদের ব্যক্তিগত ডেটা চায় না।",
        "Gujarati": "SahayakAI ક્યારેય વિદ્યાર્થીઓનો વ્યક્તિગત ડેટા માંગતું નથી.",
        "Punjabi": "SahayakAI ਕਦੇ ਵੀ ਵਿਦਿਆਰਥੀਆਂ ਦਾ ਨਿੱਜੀ ਡਾਟਾ ਨਹੀਂ ਮੰਗਦਾ।",
        "Malayalam": "SahayakAI വിദ്യാർത്ഥികളുടെ വ്യക്തിഗത ഡാറ്റ ഒരിക്കലും ചോദിക്കുന്നില്ല.",
        "Odia": "SahayakAI କେବେ ବି ଛାତ୍ରମାନଙ୍କର ବ୍ୟକ୍ତିଗତ ଡାଟା ମାଗେ ନାହିଁ।"
    },
    "If there is a problem, email grievance@sargvision.com. We respond within 7 days.": {
        "English": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.",
        "Hindi": "अगर कोई समस्या है, तो grievance@sargvision.com पर ईमेल करें। हम 7 दिनों के भीतर जवाब देते हैं।",
        "Kannada": "ಸಮಸ್ಯೆ ಇದ್ದರೆ, grievance@sargvision.com ಗೆ ಇಮೇಲ್ ಮಾಡಿ. ನಾವು 7 ದಿನಗಳೊಳಗೆ ಉತ್ತರಿಸುತ್ತೇವೆ.",
        "Tamil": "சிக்கல் இருந்தால், grievance@sargvision.com க்கு மின்னஞ்சல் அனுப்பவும். நாங்கள் 7 நாட்களுக்குள் பதிலளிப்போம்.",
        "Telugu": "సమస్య ఉంటే, grievance@sargvision.com కు ఇమెయిల్ చేయండి. మేము 7 రోజుల్లోపు స్పందిస్తాము.",
        "Marathi": "समस्या असल्यास, grievance@sargvision.com वर ईमेल करा. आम्ही 7 दिवसांच्या आत प्रतिसाद देतो.",
        "Bengali": "কোনো সমস্যা হলে, grievance@sargvision.com এ ইমেইল করুন। আমরা 7 দিনের মধ্যে উত্তর দিই।",
        "Gujarati": "જો કોઈ સમસ્યા હોય, તો grievance@sargvision.com પર ઇમેઇલ કરો. અમે 7 દિવસની અંદર જવાબ આપીએ છીએ.",
        "Punjabi": "ਜੇ ਕੋਈ ਸਮੱਸਿਆ ਹੈ, ਤਾਂ grievance@sargvision.com 'ਤੇ ਈਮੇਲ ਕਰੋ। ਅਸੀਂ 7 ਦਿਨਾਂ ਦੇ ਅੰਦਰ ਜਵਾਬ ਦਿੰਦੇ ਹਾਂ।",
        "Malayalam": "ഒരു പ്രശ്നമുണ്ടെങ്കിൽ, grievance@sargvision.com ൽ ഇമെയിൽ അയയ്ക്കുക. ഞങ്ങൾ 7 ദിവസത്തിനുള്ളിൽ മറുപടി നൽകുന്നു.",
        "Odia": "କୌଣସି ସମସ୍ୟା ଥିଲେ, grievance@sargvision.com କୁ ଇମେଲ୍ କରନ୍ତୁ। ଆମେ 7 ଦିନ ମଧ୍ୟରେ ଉତ୍ତର ଦେଉଛୁ।"
    },
    "Full legal terms below": {
        "English": "Full legal terms below", "Hindi": "नीचे पूर्ण कानूनी शर्तें", "Kannada": "ಕೆಳಗೆ ಪೂರ್ಣ ಕಾನೂನು ನಿಯಮಗಳು",
        "Tamil": "முழு சட்டப் பிரிவுகள் கீழே", "Telugu": "పూర్తి చట్టపరమైన నిబంధనలు క్రింద", "Marathi": "खाली संपूर्ण कायदेशीर अटी",
        "Bengali": "নিচে সম্পূর্ণ আইনি শর্তাবলী", "Gujarati": "નીચે સંપૂર્ણ કાનૂની શરતો", "Punjabi": "ਹੇਠਾਂ ਪੂਰੀਆਂ ਕਾਨੂੰਨੀ ਸ਼ਰਤਾਂ",
        "Malayalam": "പൂർണ്ണ നിയമ നിബന്ധനകൾ താഴെ", "Odia": "ତଳେ ସଂପୂର୍ଣ୍ଣ ଆଇନଗତ ସର୍ତ୍ତାବଳୀ"
    },
    "Terms of Service": {
        "English": "Terms of Service", "Hindi": "सेवा की शर्तें", "Kannada": "ಸೇವಾ ನಿಯಮಗಳು",
        "Tamil": "சேவை விதிமுறைகள்", "Telugu": "సేవా నిబంధనలు", "Marathi": "सेवा अटी",
        "Bengali": "পরিষেবার শর্তাবলী", "Gujarati": "સેવાની શરતો", "Punjabi": "ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ",
        "Malayalam": "സേവന നിബന്ധനകൾ", "Odia": "ସେବା ସର୍ତ୍ତାବଳୀ"
    },
    "Legal": {
        "English": "Legal", "Hindi": "कानूनी", "Kannada": "ಕಾನೂನು",
        "Tamil": "சட்டம்", "Telugu": "చట్టపరమైన", "Marathi": "कायदेशीर",
        "Bengali": "আইনি", "Gujarati": "કાનૂની", "Punjabi": "ਕਾਨੂੰਨੀ",
        "Malayalam": "നിയമപരം", "Odia": "ଆଇନଗତ"
    },
    // Post-consent confirmation (added for rural-teacher UX)
    "All set": {
        "English": "All set", "Hindi": "तैयार है", "Kannada": "ಸಿದ್ಧವಾಗಿದೆ",
        "Tamil": "தயார்", "Telugu": "సిద్ధం", "Marathi": "तयार आहे",
        "Bengali": "প্রস্তুত", "Gujarati": "તૈયાર છે", "Punjabi": "ਤਿਆਰ ਹੈ",
        "Malayalam": "തയ്യാർ", "Odia": "ପ୍ରସ୍ତୁତ"
    },
    "Thank you!": {
        "English": "Thank you!", "Hindi": "धन्यवाद!", "Kannada": "ಧನ್ಯವಾದಗಳು!",
        "Tamil": "நன்றி!", "Telugu": "ధన్యవాదాలు!", "Marathi": "धन्यवाद!",
        "Bengali": "ধন্যবাদ!", "Gujarati": "આભાર!", "Punjabi": "ਧੰਨਵਾਦ!",
        "Malayalam": "നന്ദി!", "Odia": "ଧନ୍ୟବାଦ!"
    },
    "Thank you! Your privacy choices are saved.": {
        "English": "Thank you! Your privacy choices are saved.",
        "Hindi": "धन्यवाद! आपकी निजता की पसंद सुरक्षित हो गई है।",
        "Kannada": "ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಗೌಪ್ಯತೆಯ ಆಯ್ಕೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ.",
        "Tamil": "நன்றி! உங்கள் தனியுரிமை விருப்பங்கள் சேமிக்கப்பட்டன.",
        "Telugu": "ధన్యవాదాలు! మీ గోప్యతా ఎంపికలు సేవ్ చేయబడ్డాయి.",
        "Marathi": "धन्यवाद! तुमच्या गोपनीयतेच्या निवडी जतन केल्या आहेत.",
        "Bengali": "ধন্যবাদ! আপনার গোপনীয়তা পছন্দগুলি সংরক্ষিত হয়েছে।",
        "Gujarati": "આભાર! તમારી ગોપનીયતા પસંદગીઓ સાચવવામાં આવી છે.",
        "Punjabi": "ਧੰਨਵਾਦ! ਤੁਹਾਡੀਆਂ ਪਰਦੇਦਾਰੀ ਚੋਣਾਂ ਸੁਰੱਖਿਅਤ ਹੋ ਗਈਆਂ ਹਨ।",
        "Malayalam": "നന്ദി! നിങ്ങളുടെ സ്വകാര്യതാ തിരഞ്ഞെടുപ്പുകൾ സംരക്ഷിച്ചു.",
        "Odia": "ଧନ୍ୟବାଦ! ଆପଣଙ୍କ ଗୋପନୀୟତା ପସନ୍ଦଗୁଡିକ ସଞ୍ଚୟ ହୋଇଛି।"
    },
    "You agreed to these privacy terms.": {
        "English": "You agreed to these privacy terms.",
        "Hindi": "आपने इन निजता शर्तों से सहमति दी है।",
        "Kannada": "ನೀವು ಈ ಗೌಪ್ಯತಾ ನಿಯಮಗಳನ್ನು ಒಪ್ಪಿಕೊಂಡಿದ್ದೀರಿ.",
        "Tamil": "இந்த தனியுரிமை விதிமுறைகளுக்கு நீங்கள் ஒப்புக்கொண்டீர்கள்.",
        "Telugu": "మీరు ఈ గోప్యతా నిబంధనలకు అంగీకరించారు.",
        "Marathi": "तुम्ही या गोपनीयता अटींना सहमती दिली आहे.",
        "Bengali": "আপনি এই গোপনীয়তা শর্তাবলীতে সম্মত হয়েছেন।",
        "Gujarati": "તમે આ ગોપનીયતા શરતો સાથે સંમત થયા છો.",
        "Punjabi": "ਤੁਸੀਂ ਇਹਨਾਂ ਪਰਦੇਦਾਰੀ ਸ਼ਰਤਾਂ ਨਾਲ ਸਹਿਮਤ ਹੋਏ ਹੋ।",
        "Malayalam": "ഈ സ്വകാര്യതാ നിബന്ധനകൾ നിങ്ങൾ അംഗീകരിച്ചു.",
        "Odia": "ଆପଣ ଏହି ଗୋପନୀୟତା ସର୍ତ୍ତାବଳୀକୁ ସମ୍ମତ ହୋଇଛନ୍ତି।"
    },
    "Go to my dashboard": {
        "English": "Go to my dashboard", "Hindi": "मेरे डैशबोर्ड पर जाएं", "Kannada": "ನನ್ನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ",
        "Tamil": "எனது டாஷ்போர்டுக்கு செல்", "Telugu": "నా డాష్‌బోర్డ్‌కు వెళ్లండి", "Marathi": "माझ्या डॅशबोर्डवर जा",
        "Bengali": "আমার ড্যাশবোর্ডে যান", "Gujarati": "મારા ડેશબોર્ડ પર જાઓ", "Punjabi": "ਮੇਰੇ ਡੈਸ਼ਬੋਰਡ 'ਤੇ ਜਾਓ",
        "Malayalam": "എന്റെ ഡാഷ്ബോർഡിലേക്ക് പോകുക", "Odia": "ମୋ ଡ୍ୟାସବୋର୍ଡକୁ ଯାଆନ୍ତୁ"
    },
    "Taking you there in": {
        "English": "Taking you there in", "Hindi": "आपको ले जा रहे हैं", "Kannada": "ನಿಮ್ಮನ್ನು ಕರೆದೊಯ್ಯಲಾಗುತ್ತಿದೆ",
        "Tamil": "உங்களை அழைத்துச் செல்கிறோம்", "Telugu": "మిమ్మల్ని తీసుకువెళుతున్నాం", "Marathi": "तुम्हाला नेत आहोत",
        "Bengali": "আপনাকে নিয়ে যাচ্ছি", "Gujarati": "તમને લઈ જઈ રહ્યા છીએ", "Punjabi": "ਤੁਹਾਨੂੰ ਲਿਜਾ ਰਹੇ ਹਾਂ",
        "Malayalam": "നിങ്ങളെ കൊണ്ടുപോകുന്നു", "Odia": "ଆପଣଙ୍କୁ ନେଇଯାଉଛୁ"
    },
    "Taking you to your dashboard…": {
        "English": "Taking you to your dashboard…",
        "Hindi": "आपको आपके डैशबोर्ड पर ले जा रहे हैं…",
        "Kannada": "ನಿಮ್ಮನ್ನು ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಕರೆದೊಯ್ಯಲಾಗುತ್ತಿದೆ…",
        "Tamil": "உங்களை உங்கள் டாஷ்போர்டுக்கு அழைத்துச் செல்கிறோம்…",
        "Telugu": "మిమ్మల్ని మీ డాష్‌బోర్డ్‌కు తీసుకువెళుతున్నాం…",
        "Marathi": "तुम्हाला तुमच्या डॅशबोर्डवर नेत आहोत…",
        "Bengali": "আপনাকে আপনার ড্যাশবোর্ডে নিয়ে যাচ্ছি…",
        "Gujarati": "તમને તમારા ડેશબોર્ડ પર લઈ જઈ રહ્યા છીએ…",
        "Punjabi": "ਤੁਹਾਨੂੰ ਤੁਹਾਡੇ ਡੈਸ਼ਬੋਰਡ 'ਤੇ ਲਿਜਾ ਰਹੇ ਹਾਂ…",
        "Malayalam": "നിങ്ങളെ നിങ്ങളുടെ ഡാഷ്ബോർഡിലേക്ക് കൊണ്ടുപോകുന്നു…",
        "Odia": "ଆପଣଙ୍କୁ ଆପଣଙ୍କ ଡ୍ୟାସବୋର୍ଡକୁ ନେଇଯାଉଛୁ…"
    },
    "Saved on": {
        "English": "Saved on", "Hindi": "सहेजा गया", "Kannada": "ಉಳಿಸಲಾಗಿದೆ",
        "Tamil": "சேமிக்கப்பட்டது", "Telugu": "సేవ్ చేయబడింది", "Marathi": "जतन केले",
        "Bengali": "সংরক্ষিত", "Gujarati": "સાચવ્યું", "Punjabi": "ਸੁਰੱਖਿਅਤ ਕੀਤਾ",
        "Malayalam": "സംരക്ഷിച്ചു", "Odia": "ସଞ୍ଚିତ"
    },
    "We will ask you again only if we change anything important.": {
        "English": "We will ask you again only if we change anything important.",
        "Hindi": "अगर हम कुछ महत्वपूर्ण बदलेंगे, तभी हम आपसे फिर पूछेंगे।",
        "Kannada": "ಯಾವುದೇ ಪ್ರಮುಖ ಬದಲಾವಣೆಯಿದ್ದರೆ ಮಾತ್ರ ನಾವು ನಿಮ್ಮನ್ನು ಮತ್ತೆ ಕೇಳುತ್ತೇವೆ.",
        "Tamil": "ஏதேனும் முக்கியமான மாற்றம் செய்தால் மட்டுமே நாங்கள் மீண்டும் கேட்போம்.",
        "Telugu": "ముఖ్యమైనది ఏదైనా మారిస్తేనే మేము మిమ్మల్ని మళ్లీ అడుగుతాము.",
        "Marathi": "जर आम्ही महत्त्वाचे काही बदलले तरच आम्ही पुन्हा विचारू.",
        "Bengali": "যদি আমরা গুরুত্বপূর্ণ কিছু পরিবর্তন করি তবেই আমরা আবার জিজ্ঞাসা করব।",
        "Gujarati": "જો અમે કંઈ મહત્વપૂર્ણ બદલીશું, તો જ અમે તમને ફરી પૂછીશું.",
        "Punjabi": "ਜੇ ਅਸੀਂ ਕੁਝ ਮਹੱਤਵਪੂਰਨ ਬਦਲਾਂਗੇ, ਤਾਂ ਹੀ ਅਸੀਂ ਤੁਹਾਨੂੰ ਫਿਰ ਪੁੱਛਾਂਗੇ।",
        "Malayalam": "പ്രധാനപ്പെട്ടത് എന്തെങ്കിലും മാറ്റിയാൽ മാത്രം ഞങ്ങൾ വീണ്ടും ചോദിക്കും.",
        "Odia": "ଯଦି ଆମେ କିଛି ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ବଦଳାଇବୁ, ତେବେ ଆମେ ଆପଣଙ୍କୁ ପୁନଃ ପଚାରିବୁ।"
    },
    // Pricing: volume table + School Starter rail (2026-04-24)
    "Volume pricing": {
        "English": "Volume pricing", "Hindi": "वॉल्यूम मूल्य", "Kannada": "ಪ್ರಮಾಣದ ಬೆಲೆ",
        "Tamil": "அளவு விலை நிர்ணயம்", "Telugu": "వాల్యూమ్ ధర", "Marathi": "व्हॉल्यूम किंमत",
        "Bengali": "ভলিউম মূল্য", "Gujarati": "વોલ્યુમ કિંમત", "Punjabi": "ਵੌਲਿਊਮ ਕੀਮਤ",
        "Malayalam": "വോളിയം വില", "Odia": "ଭଲ୍ୟୁମ୍ ମୂଲ୍ୟ"
    },
    "Custom quote": {
        "English": "Custom quote", "Hindi": "कस्टम कोट", "Kannada": "ಕಸ್ಟಮ್ ಕೋಟ್",
        "Tamil": "தனிப்பயன் மேற்கோள்", "Telugu": "కస్టమ్ కోట్", "Marathi": "कस्टम कोट",
        "Bengali": "কাস্টম কোট", "Gujarati": "કસ્ટમ કોટ", "Punjabi": "ਕਸਟਮ ਕੋਟ",
        "Malayalam": "കസ്റ്റം ക്വോട്ട്", "Odia": "କଷ୍ଟମ୍ କୋଟ୍"
    },
    "Minimum 20 teachers · billed annually": {
        "English": "Minimum 20 teachers · billed annually",
        "Hindi": "न्यूनतम 20 शिक्षक · वार्षिक बिलिंग",
        "Kannada": "ಕನಿಷ್ಠ 20 ಶಿಕ್ಷಕರು · ವಾರ್ಷಿಕ ಬಿಲ್",
        "Tamil": "குறைந்தபட்சம் 20 ஆசிரியர்கள் · வருடாந்திர பில்லிங்", "Telugu": "కనిష్ఠం 20 ఉపాధ్యాయులు · వార్షిక బిల్లింగ్", "Marathi": "किमान 20 शिक्षक · वार्षिक बिलिंग",
        "Bengali": "ন্যূনতম 20 জন শিক্ষক · বার্ষিক বিলিং", "Gujarati": "ઓછામાં ઓછા 20 શિક્ષકો · વાર્ષિક બિલિંગ", "Punjabi": "ਘੱਟੋ-ਘੱਟ 20 ਅਧਿਆਪਕ · ਸਾਲਾਨਾ ਬਿਲਿੰਗ",
        "Malayalam": "കുറഞ്ഞത് 20 അധ്യാപകർ · വാർഷിക ബില്ലിംഗ്", "Odia": "ସର୍ବନିମ୍ନ 20 ଶିକ୍ଷକ · ବାର୍ଷିକ ବିଲିଂ"
    },
    "School Starter": {
        "English": "School Starter", "Hindi": "स्कूल स्टार्टर", "Kannada": "ಸ್ಕೂಲ್ ಸ್ಟಾರ್ಟರ್",
        "Tamil": "School Starter", "Telugu": "School Starter", "Marathi": "School Starter",
        "Bengali": "School Starter", "Gujarati": "School Starter", "Punjabi": "School Starter",
        "Malayalam": "School Starter", "Odia": "School Starter"
    },
    "For small schools (5–19 teachers)": {
        "English": "For small schools (5–19 teachers)",
        "Hindi": "छोटे स्कूलों के लिए (5–19 शिक्षक)",
        "Kannada": "ಚಿಕ್ಕ ಶಾಲೆಗಳಿಗಾಗಿ (5–19 ಶಿಕ್ಷಕರು)",
        "Tamil": "சிறு பள்ளிகளுக்கு (5–19 ஆசிரியர்கள்)", "Telugu": "చిన్న పాఠశాలల కోసం (5–19 ఉపాధ్యాయులు)", "Marathi": "लहान शाळांसाठी (5–19 शिक्षक)",
        "Bengali": "ছোট স্কুলের জন্য (5–19 জন শিক্ষক)", "Gujarati": "નાની શાળાઓ માટે (5–19 શિક્ષકો)", "Punjabi": "ਛੋਟੇ ਸਕੂਲਾਂ ਲਈ (5–19 ਅਧਿਆਪਕ)",
        "Malayalam": "ചെറിയ സ്കൂളുകൾക്കായി (5–19 അധ്യാപകർ)", "Odia": "ଛୋଟ ସ୍କୁଲ୍ ପାଇଁ (5–19 ଶିକ୍ଷକ)"
    },
    "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.": {
        "English": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Hindi": "हर शिक्षक के लिए Pro की सभी सुविधाएँ, साथ में एक सरल प्रिंसिपल डैशबोर्ड और ऑनबोर्डिंग सहायता। 20 शिक्षकों की कोई न्यूनतम सीमा नहीं।",
        "Kannada": "ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ Pro ಎಲ್ಲಾ ವೈಶಿಷ್ಟ್ಯಗಳು, ಜೊತೆಗೆ ಸರಳ ಪ್ರಿನ್ಸಿಪಾಲ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಮತ್ತು ಆನ್‌ಬೋರ್ಡಿಂಗ್ ಸಹಾಯ. 20 ಶಿಕ್ಷಕರ ಕನಿಷ್ಠ ಮಿತಿ ಇಲ್ಲ.",
        "Tamil": "ஒவ்வொரு ஆசிரியருக்கும் Pro இல் உள்ள அனைத்தும், கூடுதலாக ஒரு எளிய principal டாஷ்போர்டு மற்றும் onboarding உதவி. 20-ஆசிரியர் குறைந்தபட்சம் இல்லை.",
        "Telugu": "ప్రతి ఉపాధ్యాయుడికి Pro లోని అన్ని ఫీచర్లు, పాటు సాధారణ principal డాష్‌బోర్డ్ మరియు onboarding సహాయం. 20-ఉపాధ్యాయుల కనీస పరిమితి లేదు.",
        "Marathi": "प्रत्येक शिक्षकासाठी Pro मधील सर्व काही, तसेच एक साधा principal डॅशबोर्ड आणि onboarding मदत. 20-शिक्षक किमान मर्यादा नाही.",
        "Bengali": "প্রতিটি শিক্ষকের জন্য Pro এর সবকিছু, সাথে একটি সাধারণ principal ড্যাশবোর্ড এবং onboarding সহায়তা। 20-শিক্ষক ন্যূনতম নেই।",
        "Gujarati": "દરેક શિક્ષક માટે Pro માં બધું જ, સાથે એક સરળ principal ડેશબોર્ડ અને onboarding સહાય. 20-શિક્ષક ન્યૂનતમ નથી.",
        "Punjabi": "ਹਰੇਕ ਅਧਿਆਪਕ ਲਈ Pro ਵਿੱਚ ਸਭ ਕੁਝ, ਨਾਲ ਹੀ ਇੱਕ ਸਧਾਰਨ principal ਡੈਸ਼ਬੋਰਡ ਅਤੇ onboarding ਮਦਦ। 20-ਅਧਿਆਪਕ ਘੱਟੋ-ਘੱਟ ਨਹੀਂ।",
        "Malayalam": "ഓരോ അധ്യാപകനും Pro ലെ എല്ലാം, കൂടാതെ ലളിതമായ principal ഡാഷ്ബോർഡും onboarding സഹായവും. 20-അധ്യാപക മിനിമം ഇല്ല.",
        "Odia": "ପ୍ରତ୍ୟେକ ଶିକ୍ଷକଙ୍କ ପାଇଁ Pro ର ସବୁକିଛି, ସହିତ ଏକ ସରଳ principal ଡ୍ୟାସବୋର୍ଡ ଏବଂ onboarding ସହାୟତା। 20-ଶିକ୍ଷକ ସର୍ବନିମ୍ନ ନାହିଁ।"
    },
    "Pricing tailored to your school. We come to you.": {
        "English": "Pricing tailored to your school. We come to you.",
        "Hindi": "आपके स्कूल के अनुसार मूल्य। हम आपके पास आते हैं।",
        "Kannada": "ನಿಮ್ಮ ಶಾಲೆಗೆ ಅನುಗುಣವಾಗಿ ಬೆಲೆ. ನಾವು ನಿಮ್ಮ ಬಳಿಗೆ ಬರುತ್ತೇವೆ.",
        "Tamil": "உங்கள் பள்ளிக்கு ஏற்ப விலை. நாங்கள் உங்களிடம் வருகிறோம்.",
        "Telugu": "మీ పాఠశాలకు అనుగుణంగా ధర. మేము మీ వద్దకు వస్తాము.",
        "Marathi": "तुमच्या शाळेनुसार किंमत. आम्ही तुमच्याकडे येतो.",
        "Bengali": "আপনার স্কুলের জন্য তৈরি মূল্য। আমরা আপনার কাছে আসি।",
        "Gujarati": "તમારી શાળાને અનુરૂપ કિંમત. અમે તમારી પાસે આવીએ છીએ.",
        "Punjabi": "ਤੁਹਾਡੇ ਸਕੂਲ ਅਨੁਸਾਰ ਕੀਮਤ। ਅਸੀਂ ਤੁਹਾਡੇ ਕੋਲ ਆਉਂਦੇ ਹਾਂ।",
        "Malayalam": "നിങ്ങളുടെ സ്കൂളിന് അനുയോജ്യമായ വില. ഞങ്ങൾ നിങ്ങളുടെ അടുത്തേക്ക് വരുന്നു.",
        "Odia": "ଆପଣଙ୍କ ସ୍କୁଲ୍ ପାଇଁ ଉପଯୁକ୍ତ ମୂଲ୍ୟ। ଆମେ ଆପଣଙ୍କ ପାଖକୁ ଆସୁଛୁ।"
    },
    "Book a small-school call": {
        "English": "Book a small-school call", "Hindi": "छोटे-स्कूल कॉल बुक करें", "Kannada": "ಚಿಕ್ಕ-ಶಾಲೆ ಕರೆ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "சிறு பள்ளி அழைப்பை புக் செய்யுங்கள்", "Telugu": "చిన్న పాఠశాల కాల్ బుక్ చేయండి", "Marathi": "लहान शाळेचा कॉल बुक करा",
        "Bengali": "ছোট স্কুল কল বুক করুন", "Gujarati": "નાની-શાળા કૉલ બુક કરો", "Punjabi": "ਛੋਟੇ-ਸਕੂਲ ਕਾਲ ਬੁੱਕ ਕਰੋ",
        "Malayalam": "ചെറിയ-സ്കൂൾ കോൾ ബുക്ക് ചെയ്യുക", "Odia": "ଛୋଟ-ସ୍କୁଲ କଲ୍ ବୁକ୍ କରନ୍ତୁ"
    },
    // ---- /pricing tier feature bullets (2026-04-25 i18n fix) ----
    // Free
    "10 lesson plans per month": {
        "English": "10 lesson plans per month", "Hindi": "10 पाठ योजनाएँ प्रति माह", "Kannada": "ತಿಂಗಳಿಗೆ 10 ಪಾಠ ಯೋಜನೆಗಳು",
        "Tamil": "மாதத்திற்கு 10 பாடத் திட்டங்கள்", "Telugu": "నెలకు 10 పాఠ ప్రణాళికలు", "Marathi": "महिन्याला 10 पाठ योजना",
        "Bengali": "প্রতি মাসে 10টি পাঠ পরিকল্পনা", "Gujarati": "મહિને 10 પાઠ યોજનાઓ", "Punjabi": "ਮਹੀਨੇ ਵਿੱਚ 10 ਪਾਠ ਯੋਜਨਾਵਾਂ",
        "Malayalam": "മാസത്തിൽ 10 പാഠ പദ്ധതികൾ", "Odia": "ମାସରେ 10ଟି ପାଠ ଯୋଜନା"
    },
    "5 quizzes + 5 worksheets per month": {
        "English": "5 quizzes + 5 worksheets per month",
        "Hindi": "5 क्विज़ + 5 वर्कशीट प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 5 ಕ್ವಿಜ್ + 5 ವರ್ಕ್‌ಶೀಟ್‌ಗಳು",
        "Tamil": "மாதத்திற்கு 5 quizzes + 5 worksheets", "Telugu": "నెలకు 5 quizzes + 5 worksheets", "Marathi": "महिन्याला 5 quizzes + 5 worksheets",
        "Bengali": "প্রতি মাসে 5টি quizzes + 5টি worksheets", "Gujarati": "મહિને 5 quizzes + 5 worksheets", "Punjabi": "ਮਹੀਨੇ ਵਿੱਚ 5 quizzes + 5 worksheets",
        "Malayalam": "മാസത്തിൽ 5 quizzes + 5 worksheets", "Odia": "ମାସରେ 5ଟି quizzes + 5ଟି worksheets"
    },
    "20 instant answers per day": {
        "English": "20 instant answers per day",
        "Hindi": "20 तुरंत जवाब प्रति दिन",
        "Kannada": "ದಿನಕ್ಕೆ 20 ತತ್‌ಕ್ಷಣ ಉತ್ತರಗಳು",
        "Tamil": "தினமும் 20 உடனடி பதில்கள்", "Telugu": "రోజుకు 20 తక్షణ సమాధానాలు", "Marathi": "दररोज 20 त्वरित उत्तरे",
        "Bengali": "প্রতিদিন 20টি তাত্ক্ষণিক উত্তর", "Gujarati": "દિવસે 20 તાત્કાલિક જવાબો", "Punjabi": "ਰੋਜ਼ਾਨਾ 20 ਤੁਰੰਤ ਜਵਾਬ",
        "Malayalam": "ദിവസവും 20 തൽക്ഷണ ഉത്തരങ്ങൾ", "Odia": "ଦୈନିକ 20ଟି ତତକ୍ଷଣ ଉତ୍ତର"
    },
    "Voice in 11 Indian languages": {
        "English": "Voice in 11 Indian languages",
        "Hindi": "11 भारतीय भाषाओं में वॉयस",
        "Kannada": "11 ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಧ್ವನಿ",
        "Tamil": "11 இந்திய மொழிகளில் குரல்", "Telugu": "11 భారతీయ భాషల్లో వాయిస్", "Marathi": "11 भारतीय भाषांमध्ये व्हॉइस",
        "Bengali": "11টি ভারতীয় ভাষায় ভয়েস", "Gujarati": "11 ભારતીય ભાષાઓમાં વૉઇસ", "Punjabi": "11 ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਵੌਇਸ",
        "Malayalam": "11 ഇന്ത്യൻ ഭാഷകളിൽ വോയ്സ്", "Odia": "11ଟି ଭାରତୀୟ ଭାଷାରେ ଭଏସ୍"
    },
    "Community library access": {
        "English": "Community library access",
        "Hindi": "कम्युनिटी लाइब्रेरी का उपयोग",
        "Kannada": "ಸಮುದಾಯ ಗ್ರಂಥಾಲಯ ಪ್ರವೇಶ",
        "Tamil": "சமூக நூலக அணுகல்", "Telugu": "కమ్యూనిటీ లైబ్రరీ యాక్సెస్", "Marathi": "समुदाय ग्रंथालय प्रवेश",
        "Bengali": "কমিউনিটি লাইব্রেরি অ্যাক্সেস", "Gujarati": "કમ્યુનિટી લાઇબ્રેરી ઍક્સેસ", "Punjabi": "ਕਮਿਊਨਿਟੀ ਲਾਇਬ੍ਰੇਰੀ ਪਹੁੰਚ",
        "Malayalam": "കമ്മ്യൂണിറ്റി ലൈബ്രറി ആക്സസ്", "Odia": "କମ୍ୟୁନିଟି ଲାଇବ୍ରେରୀ ପ୍ରବେଶ"
    },
    "Basic impact dashboard": {
        "English": "Basic impact dashboard",
        "Hindi": "बेसिक इम्पैक्ट डैशबोर्ड",
        "Kannada": "ಮೂಲ ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        "Tamil": "அடிப்படை தாக்க டாஷ்போர்டு", "Telugu": "ప్రాథమిక ప్రభావ డాష్‌బోర్డ్", "Marathi": "मूलभूत प्रभाव डॅशबोर्ड",
        "Bengali": "মৌলিক প্রভাব ড্যাশবোর্ড", "Gujarati": "મૂળભૂત ઇમ્પેક્ટ ડેશબોર્ડ", "Punjabi": "ਬੁਨਿਆਦੀ ਪ੍ਰਭਾਵ ਡੈਸ਼ਬੋਰਡ",
        "Malayalam": "അടിസ്ഥാന ഇംപാക്ട് ഡാഷ്ബോർഡ്", "Odia": "ମୌଳିକ ପ୍ରଭାବ ଡ୍ୟାସବୋର୍ଡ"
    },
    // Pro
    "All 6 tools unlocked": {
        "English": "All 6 tools unlocked",
        "Hindi": "सभी 6 टूल अनलॉक",
        "Kannada": "ಎಲ್ಲ 6 ಪರಿಕರಗಳು ಅನ್‌ಲಾಕ್",
        "Tamil": "அனைத்து 6 கருவிகளும் அன்லாக்", "Telugu": "అన్ని 6 సాధనాలు అన్‌లాక్", "Marathi": "सर्व 6 साधने अनलॉक",
        "Bengali": "সব 6টি টুল আনলক", "Gujarati": "બધાં 6 ટૂલ્સ અનલૉક", "Punjabi": "ਸਾਰੇ 6 ਟੂਲ ਅਨਲੌਕ",
        "Malayalam": "എല്ലാ 6 ഉപകരണങ്ങളും അൺലോക്ക്", "Odia": "ସମସ୍ତ 6ଟି ଟୁଲ୍ ଅନଲକ୍"
    },
    "25 lesson plans per month": {
        "English": "25 lesson plans per month",
        "Hindi": "25 पाठ योजनाएँ प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 25 ಪಾಠ ಯೋಜನೆಗಳು",
        "Tamil": "மாதத்திற்கு 25 பாடத் திட்டங்கள்", "Telugu": "నెలకు 25 పాఠ ప్రణాళికలు", "Marathi": "महिन्याला 25 पाठ योजना",
        "Bengali": "প্রতি মাসে 25টি পাঠ পরিকল্পনা", "Gujarati": "મહિને 25 પાઠ યોજનાઓ", "Punjabi": "ਮਹੀਨੇ ਵਿੱਚ 25 ਪਾਠ ਯੋਜਨਾਵਾਂ",
        "Malayalam": "മാസത്തിൽ 25 പാഠ പദ്ധതികൾ", "Odia": "ମାସରେ 25ଟି ପାଠ ଯୋଜନା"
    },
    "25 quizzes per month": {
        "English": "25 quizzes per month",
        "Hindi": "25 क्विज़ प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 25 ಕ್ವಿಜ್‌ಗಳು",
        "Tamil": "மாதத்திற்கு 25 quizzes", "Telugu": "నెలకు 25 quizzes", "Marathi": "महिन्याला 25 quizzes",
        "Bengali": "প্রতি মাসে 25টি quizzes", "Gujarati": "મહિને 25 quizzes", "Punjabi": "ਮਹੀਨੇ ਵਿੱਚ 25 quizzes",
        "Malayalam": "മാസത്തിൽ 25 quizzes", "Odia": "ମାସରେ 25ଟି quizzes"
    },
    "Unlimited worksheets and rubrics": {
        "English": "Unlimited worksheets and rubrics",
        "Hindi": "असीमित वर्कशीट और रूब्रिक",
        "Kannada": "ಅಪರಿಮಿತ ವರ್ಕ್‌ಶೀಟ್ ಮತ್ತು ರೂಬ್ರಿಕ್‌ಗಳು",
        "Tamil": "வரம்பற்ற worksheets மற்றும் rubrics", "Telugu": "పరిమితి లేని worksheets మరియు rubrics", "Marathi": "अमर्यादित worksheets आणि rubrics",
        "Bengali": "সীমাহীন worksheets এবং rubrics", "Gujarati": "અમર્યાદિત worksheets અને rubrics", "Punjabi": "ਅਣਗਿਣਤ worksheets ਅਤੇ rubrics",
        "Malayalam": "പരിധിയില്ലാത്ത worksheets ഉം rubrics ഉം", "Odia": "ଅସୀମିତ worksheets ଏବଂ rubrics"
    },
    "Unlimited instant answers": {
        "English": "Unlimited instant answers",
        "Hindi": "असीमित तुरंत जवाब",
        "Kannada": "ಅಪರಿಮಿತ ತತ್‌ಕ್ಷಣ ಉತ್ತರಗಳು",
        "Tamil": "வரம்பற்ற உடனடி பதில்கள்", "Telugu": "పరిమితి లేని తక్షణ సమాధానాలు", "Marathi": "अमर्यादित त्वरित उत्तरे",
        "Bengali": "সীমাহীন তাত্ক্ষণিক উত্তর", "Gujarati": "અમર્યાદિત તાત્કાલિક જવાબો", "Punjabi": "ਅਣਗਿਣਤ ਤੁਰੰਤ ਜਵਾਬ",
        "Malayalam": "പരിധിയില്ലാത്ത തൽക്ഷണ ഉത്തരങ്ങൾ", "Odia": "ଅସୀମିତ ତତକ୍ଷଣ ଉତ୍ତର"
    },
    "300 voice cloud minutes per month": {
        "English": "300 voice cloud minutes per month",
        "Hindi": "300 वॉयस क्लाउड मिनट प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 300 ಧ್ವನಿ ಕ್ಲೌಡ್ ನಿಮಿಷಗಳು",
        "Tamil": "மாதத்திற்கு 300 voice cloud நிமிடங்கள்", "Telugu": "నెలకు 300 voice cloud నిమిషాలు", "Marathi": "महिन्याला 300 voice cloud मिनिटे",
        "Bengali": "প্রতি মাসে 300 voice cloud মিনিট", "Gujarati": "મહિને 300 voice cloud મિનિટ", "Punjabi": "ਮਹੀਨੇ ਵਿੱਚ 300 voice cloud ਮਿੰਟ",
        "Malayalam": "മാസത്തിൽ 300 voice cloud മിനിറ്റുകൾ", "Odia": "ମାସରେ 300ଟି voice cloud ମିନିଟ୍"
    },
    "Download as PDF or Word (no watermark)": {
        "English": "Download as PDF or Word (no watermark)",
        "Hindi": "PDF या Word में डाउनलोड करें (बिना वॉटरमार्क)",
        "Kannada": "PDF ಅಥವಾ Word ರೂಪದಲ್ಲಿ ಡೌನ್‌ಲೋಡ್ (ವಾಟರ್‌ಮಾರ್ಕ್ ಇಲ್ಲ)",
        "Tamil": "PDF அல்லது Word ஆக டவுன்லோட் செய்யுங்கள் (வாட்டர்மார்க் இல்லை)",
        "Telugu": "PDF లేదా Word గా డౌన్‌లోడ్ చేయండి (వాటర్‌మార్క్ లేదు)",
        "Marathi": "PDF किंवा Word म्हणून डाउनलोड करा (वॉटरमार्क नाही)",
        "Bengali": "PDF বা Word হিসাবে ডাউনলোড করুন (কোনো ওয়াটারমার্ক নেই)",
        "Gujarati": "PDF અથવા Word તરીકે ડાઉનલોડ કરો (કોઈ વૉટરમાર્ક નહીં)",
        "Punjabi": "PDF ਜਾਂ Word ਵਜੋਂ ਡਾਊਨਲੋਡ ਕਰੋ (ਕੋਈ ਵਾਟਰਮਾਰਕ ਨਹੀਂ)",
        "Malayalam": "PDF അല്ലെങ്കിൽ Word ആയി ഡൗൺലോഡ് ചെയ്യുക (വാട്ടർമാർക്ക് ഇല്ല)",
        "Odia": "PDF କିମ୍ବା Word ଭାବରେ ଡାଉନଲୋଡ୍ କରନ୍ତୁ (କୌଣସି ୱାଟରମାର୍କ ନାହିଁ)"
    },
    "AI-powered parent messages": {
        "English": "AI-powered parent messages",
        "Hindi": "AI-संचालित अभिभावक संदेश",
        "Kannada": "AI-ಚಾಲಿತ ಪೋಷಕ ಸಂದೇಶಗಳು",
        "Tamil": "AI-இயக்கும் பெற்றோர் செய்திகள்", "Telugu": "AI-ఆధారిత తల్లిదండ్రుల సందేశాలు", "Marathi": "AI-संचालित पालक संदेश",
        "Bengali": "AI-চালিত অভিভাবক বার্তা", "Gujarati": "AI-સંચાલિત માતા-પિતા સંદેશા", "Punjabi": "AI-ਸੰਚਾਲਿਤ ਮਾਪੇ ਸੰਦੇਸ਼",
        "Malayalam": "AI-ഉപയോഗിച്ച രക്ഷിതാവ് സന്ദേശങ്ങൾ", "Odia": "AI-ଚାଳିତ ଅଭିଭାବକ ବାର୍ତ୍ତା"
    },
    "Detailed impact dashboard": {
        "English": "Detailed impact dashboard",
        "Hindi": "विस्तृत इम्पैक्ट डैशबोर्ड",
        "Kannada": "ವಿವರವಾದ ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        "Tamil": "விரிவான தாக்க டாஷ்போர்டு", "Telugu": "వివరణాత్మక ప్రభావ డాష్‌బోర్డ్", "Marathi": "तपशीलवार प्रभाव डॅशबोर्ड",
        "Bengali": "বিস্তারিত প্রভাব ড্যাশবোর্ড", "Gujarati": "વિગતવાર ઇમ્પેક્ટ ડેશબોર્ડ", "Punjabi": "ਵਿਸਤ੍ਰਿਤ ਪ੍ਰਭਾਵ ਡੈਸ਼ਬੋਰਡ",
        "Malayalam": "വിശദമായ ഇംപാക്ട് ഡാഷ്ബോർഡ്", "Odia": "ବିସ୍ତୃତ ପ୍ରଭାବ ଡ୍ୟାସବୋର୍ଡ"
    },
    // Gold
    "Everything in Pro, unlimited": {
        "English": "Everything in Pro, unlimited",
        "Hindi": "Pro में सब कुछ, असीमित",
        "Kannada": "Pro ನಲ್ಲಿ ಎಲ್ಲವೂ, ಅಪರಿಮಿತ",
        "Tamil": "Pro இல் உள்ள அனைத்தும், வரம்பற்றது", "Telugu": "Pro లోని అన్నీ, పరిమితి లేకుండా", "Marathi": "Pro मधील सर्व काही, अमर्यादित",
        "Bengali": "Pro এর সবকিছু, সীমাহীন", "Gujarati": "Pro માં બધું જ, અમર્યાદિત", "Punjabi": "Pro ਵਿੱਚ ਸਭ ਕੁਝ, ਅਣਗਿਣਤ",
        "Malayalam": "Pro ലെ എല്ലാം, പരിധിയില്ലാതെ", "Odia": "Pro ର ସବୁକିଛି, ଅସୀମିତ"
    },
    "Principal dashboard + teacher onboarding": {
        "English": "Principal dashboard + teacher onboarding",
        "Hindi": "प्रिंसिपल डैशबोर्ड + शिक्षक ऑनबोर्डिंग",
        "Kannada": "ಪ್ರಿನ್ಸಿಪಾಲ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ + ಶಿಕ್ಷಕರ ಆನ್‌ಬೋರ್ಡಿಂಗ್",
        "Tamil": "Principal டாஷ்போர்டு + ஆசிரியர் onboarding", "Telugu": "Principal డాష్‌బోర్డ్ + ఉపాధ్యాయ onboarding", "Marathi": "Principal डॅशबोर्ड + शिक्षक onboarding",
        "Bengali": "Principal ড্যাশবোর্ড + শিক্ষক onboarding", "Gujarati": "Principal ડેશબોર્ડ + શિક્ષક onboarding", "Punjabi": "Principal ਡੈਸ਼ਬੋਰਡ + ਅਧਿਆਪਕ onboarding",
        "Malayalam": "Principal ഡാഷ്ബോർഡ് + അധ്യാപക onboarding", "Odia": "Principal ଡ୍ୟାସବୋର୍ଡ + ଶିକ୍ଷକ onboarding"
    },
    "1,500 voice cloud minutes per teacher": {
        "English": "1,500 voice cloud minutes per teacher",
        "Hindi": "1,500 वॉयस क्लाउड मिनट प्रति शिक्षक",
        "Kannada": "ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ 1,500 ಧ್ವನಿ ಕ್ಲೌಡ್ ನಿಮಿಷಗಳು",
        "Tamil": "ஆசிரியருக்கு 1,500 voice cloud நிமிடங்கள்", "Telugu": "ఉపాధ్యాయుడికి 1,500 voice cloud నిమిషాలు", "Marathi": "शिक्षकामागे 1,500 voice cloud मिनिटे",
        "Bengali": "প্রতি শিক্ষকের জন্য 1,500 voice cloud মিনিট", "Gujarati": "શિક્ષક દીઠ 1,500 voice cloud મિનિટ", "Punjabi": "ਪ੍ਰਤੀ ਅਧਿਆਪਕ 1,500 voice cloud ਮਿੰਟ",
        "Malayalam": "ഓരോ അധ്യാപകനും 1,500 voice cloud മിനിറ്റുകൾ", "Odia": "ପ୍ରତି ଶିକ୍ଷକଙ୍କ ପାଇଁ 1,500ଟି voice cloud ମିନିଟ୍"
    },
    "WhatsApp Business integration": {
        "English": "WhatsApp Business integration",
        "Hindi": "WhatsApp Business एकीकरण",
        "Kannada": "WhatsApp Business ಸಂಯೋಜನೆ",
        "Tamil": "WhatsApp Business ஒருங்கிணைப்பு", "Telugu": "WhatsApp Business అనుసంధానం", "Marathi": "WhatsApp Business समाकलन",
        "Bengali": "WhatsApp Business সংহতকরণ", "Gujarati": "WhatsApp Business સંકલન", "Punjabi": "WhatsApp Business ਏਕੀਕਰਨ",
        "Malayalam": "WhatsApp Business സംയോജനം", "Odia": "WhatsApp Business ସମନ୍ୱୟ"
    },
    "Priority support in your timezone": {
        "English": "Priority support in your timezone",
        "Hindi": "आपके टाइमज़ोन में प्राथमिकता सहायता",
        "Kannada": "ನಿಮ್ಮ ಸಮಯ ವಲಯದಲ್ಲಿ ಆದ್ಯತೆಯ ಬೆಂಬಲ",
        "Tamil": "உங்கள் நேர மண்டலத்தில் முன்னுரிமை ஆதரவு", "Telugu": "మీ సమయ మండలంలో ప్రాధాన్యత మద్దతు", "Marathi": "तुमच्या टाइमझोनमध्ये प्राधान्य समर्थन",
        "Bengali": "আপনার টাইমজোনে অগ্রাধিকার সহায়তা", "Gujarati": "તમારા ટાઇમઝોનમાં પ્રાથમિકતા સહાય", "Punjabi": "ਤੁਹਾਡੇ ਟਾਈਮਜ਼ੋਨ ਵਿੱਚ ਤਰਜੀਹੀ ਸਹਾਇਤਾ",
        "Malayalam": "നിങ്ങളുടെ ടൈം‌സോണിൽ മുൻഗണനാ പിന്തുണ", "Odia": "ଆପଣଙ୍କ ଟାଇମଜୋନରେ ଅଗ୍ରାଧିକାର ସମର୍ଥନ"
    },
    "Volume discount for 50+ teachers": {
        "English": "Volume discount for 50+ teachers",
        "Hindi": "50+ शिक्षकों के लिए वॉल्यूम डिस्काउंट",
        "Kannada": "50+ ಶಿಕ್ಷಕರಿಗೆ ವಾಲ್ಯೂಮ್ ರಿಯಾಯಿತಿ",
        "Tamil": "50+ ஆசிரியர்களுக்கு வாலியூம் தள்ளுபடி", "Telugu": "50+ ఉపాధ్యాయులకు వాల్యూమ్ తగ్గింపు", "Marathi": "50+ शिक्षकांसाठी व्हॉल्यूम सूट",
        "Bengali": "50+ শিক্ষকের জন্য ভলিউম ছাড়", "Gujarati": "50+ શિક્ષકો માટે વોલ્યુમ ડિસ્કાઉન્ટ", "Punjabi": "50+ ਅਧਿਆਪਕਾਂ ਲਈ ਵੌਲਿਊਮ ਛੋਟ",
        "Malayalam": "50+ അധ്യാപകർക്ക് വോളിയം കിഴിവ്", "Odia": "50+ ଶିକ୍ଷକଙ୍କ ପାଇଁ ଭଲ୍ୟୁମ୍ ରିହାତି"
    },
    "One-time onboarding and training": {
        "English": "One-time onboarding and training",
        "Hindi": "एक बार की ऑनबोर्डिंग और प्रशिक्षण",
        "Kannada": "ಒಂದು-ಬಾರಿ ಆನ್‌ಬೋರ್ಡಿಂಗ್ ಮತ್ತು ತರಬೇತಿ",
        "Tamil": "ஒரு முறை onboarding மற்றும் பயிற்சி", "Telugu": "ఒక్కసారి onboarding మరియు శిక్షణ", "Marathi": "एकदाची onboarding आणि प्रशिक्षण",
        "Bengali": "একবারের onboarding এবং প্রশিক্ষণ", "Gujarati": "એક વખતની onboarding અને તાલીમ", "Punjabi": "ਇੱਕ ਵਾਰ ਦੀ onboarding ਅਤੇ ਸਿਖਲਾਈ",
        "Malayalam": "ഒറ്റത്തവണ onboarding ഉം പരിശീലനവും", "Odia": "ଗୋଟିଏ ଥର onboarding ଏବଂ ତାଲିମ"
    },
    // Volume tier labels
    "20–49 teachers": {
        "English": "20–49 teachers", "Hindi": "20–49 शिक्षक", "Kannada": "20–49 ಶಿಕ್ಷಕರು",
        "Tamil": "20–49 ஆசிரியர்கள்", "Telugu": "20–49 ఉపాధ్యాయులు", "Marathi": "20–49 शिक्षक",
        "Bengali": "20–49 জন শিক্ষক", "Gujarati": "20–49 શિક્ષકો", "Punjabi": "20–49 ਅਧਿਆਪਕ",
        "Malayalam": "20–49 അധ്യാപകർ", "Odia": "20–49 ଶିକ୍ଷକ"
    },
    "50–99 teachers": {
        "English": "50–99 teachers", "Hindi": "50–99 शिक्षक", "Kannada": "50–99 ಶಿಕ್ಷಕರು",
        "Tamil": "50–99 ஆசிரியர்கள்", "Telugu": "50–99 ఉపాధ్యాయులు", "Marathi": "50–99 शिक्षक",
        "Bengali": "50–99 জন শিক্ষক", "Gujarati": "50–99 શિક્ષકો", "Punjabi": "50–99 ਅਧਿਆਪਕ",
        "Malayalam": "50–99 അധ്യാപകർ", "Odia": "50–99 ଶିକ୍ଷକ"
    },
    "100–249 teachers": {
        "English": "100–249 teachers", "Hindi": "100–249 शिक्षक", "Kannada": "100–249 ಶಿಕ್ಷಕರು",
        "Tamil": "100–249 ஆசிரியர்கள்", "Telugu": "100–249 ఉపాధ్యాయులు", "Marathi": "100–249 शिक्षक",
        "Bengali": "100–249 জন শিক্ষক", "Gujarati": "100–249 શિક્ષકો", "Punjabi": "100–249 ਅਧਿਆਪਕ",
        "Malayalam": "100–249 അധ്യാപകർ", "Odia": "100–249 ଶିକ୍ଷକ"
    },
    "250+ teachers (custom quote)": {
        "English": "250+ teachers (custom quote)",
        "Hindi": "250+ शिक्षक (कस्टम कोट)",
        "Kannada": "250+ ಶಿಕ್ಷಕರು (ಕಸ್ಟಮ್ ಕೋಟ್)",
        "Tamil": "250+ ஆசிரியர்கள் (தனிப்பயன் மேற்கோள்)", "Telugu": "250+ ఉపాధ్యాయులు (కస్టమ్ కోట్)", "Marathi": "250+ शिक्षक (कस्टम कोट)",
        "Bengali": "250+ জন শিক্ষক (কাস্টম কোট)", "Gujarati": "250+ શિક્ષકો (કસ્ટમ કોટ)", "Punjabi": "250+ ਅਧਿਆਪਕ (ਕਸਟਮ ਕੋਟ)",
        "Malayalam": "250+ അധ്യാപകർ (കസ്റ്റം ക്വോട്ട്)", "Odia": "250+ ଶିକ୍ଷକ (କଷ୍ଟମ୍ କୋଟ୍)"
    },
    // Nav labels
    "Product": {
        // "उत्पाद" / "உত்பத்தி" etc. read as FMCG (manufactured goods).
        // Indian SaaS convention is to transliterate.
        "English": "Product", "Hindi": "प्रोडक्ट", "Kannada": "ಪ್ರೊಡಕ್ಟ್",
        "Tamil": "ப்ராடக்ட்", "Telugu": "ప్రొడక్ట్", "Marathi": "प्रॉडक्ट",
        "Bengali": "প্রোডাক্ট", "Gujarati": "પ્રોડક્ટ", "Punjabi": "ਪ੍ਰੋਡਕਟ",
        "Malayalam": "പ്രോഡക്ട്", "Odia": "ପ୍ରୋଡକ୍ଟ"
    },
    "Pricing": {
        // Earlier "कीमत" / "बेले" / "విలை" read as "the cost of one item"
        // (e.g. "tamatar ki kimat"). Wrong register for a SaaS pricing
        // page. "मूल्य" / formal-value words used here.
        "English": "Pricing", "Hindi": "मूल्य", "Kannada": "ಮೌಲ್ಯ",
        "Tamil": "திட்டங்கள்", "Telugu": "ప్లాన్లు", "Marathi": "मूल्य",
        "Bengali": "মূল্য", "Gujarati": "મૂલ્ય", "Punjabi": "ਮੁੱਲ",
        "Malayalam": "മൂല്യം", "Odia": "ମୂଲ୍ୟ"
    },
    // Voice cloud quota soft-cap toasts (2026-04-26)
    "Voice cloud quota: 80% used": {
        "English": "Voice cloud quota: 80% used",
        "Hindi": "वॉयस क्लाउड कोटा: 80% उपयोग हुआ",
        "Kannada": "ಧ್ವನಿ ಕ್ಲೌಡ್ ಕೋಟಾ: 80% ಬಳಸಲಾಗಿದೆ",
        "Tamil": "வாய்ஸ் கிளவுட் ஒதுக்கீடு: 80% பயன்படுத்தப்பட்டது",
        "Telugu": "వాయిస్ క్లౌడ్ కోటా: 80% ఉపయోగించబడింది",
        "Marathi": "वॉइस क्लाउड कोटा: 80% वापरले",
        "Bengali": "ভয়েস ক্লাউড কোটা: 80% ব্যবহৃত",
        "Gujarati": "વૉઇસ ક્લાઉડ કોટા: 80% વપરાયું",
        "Punjabi": "ਵੌਇਸ ਕਲਾਉਡ ਕੋਟਾ: 80% ਵਰਤਿਆ ਗਿਆ",
        "Malayalam": "വോയ്‌സ് ക്ലൗഡ് ക്വോട്ട: 80% ഉപയോഗിച്ചു",
        "Odia": "ଭଏସ୍ କ୍ଲାଉଡ୍ କୋଟା: 80% ବ୍ୟବହାର କରାଯାଇଛି"
    },
    "You've used {used} of {limit} cloud voice minutes this month.": {
        "English": "You've used {used} of {limit} cloud voice minutes this month.",
        "Hindi": "आपने इस महीने {limit} में से {used} क्लाउड वॉयस मिनट उपयोग किए हैं।",
        "Kannada": "ಈ ತಿಂಗಳು ನೀವು {limit} ರಲ್ಲಿ {used} ಕ್ಲೌಡ್ ಧ್ವನಿ ನಿಮಿಷಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ.",
        "Tamil": "இந்த மாதம் {limit} இல் {used} கிளவுட் வாய்ஸ் நிமிடங்கள் பயன்படுத்தியுள்ளீர்கள்.",
        "Telugu": "ఈ నెలలో మీరు {limit} లో {used} క్లౌడ్ వాయిస్ నిమిషాలను ఉపయోగించారు.",
        "Marathi": "तुम्ही या महिन्यात {limit} पैकी {used} क्लाउड वॉइस मिनिटे वापरली आहेत.",
        "Bengali": "আপনি এই মাসে {limit} এর মধ্যে {used} ক্লাউড ভয়েস মিনিট ব্যবহার করেছেন।",
        "Gujarati": "આ મહિને તમે {limit} માંથી {used} ક્લાઉડ વૉઇસ મિનિટનો ઉપયોગ કર્યો છે.",
        "Punjabi": "ਤੁਸੀਂ ਇਸ ਮਹੀਨੇ {limit} ਵਿੱਚੋਂ {used} ਕਲਾਉਡ ਵੌਇਸ ਮਿੰਟ ਵਰਤੇ ਹਨ।",
        "Malayalam": "ഈ മാസം നിങ്ങൾ {limit} ൽ {used} ക്ലൗഡ് വോയ്‌സ് മിനിറ്റുകൾ ഉപയോഗിച്ചു.",
        "Odia": "ଆପଣ ଏହି ମାସରେ {limit} ମଧ୍ୟରୁ {used} କ୍ଲାଉଡ୍ ଭଏସ୍ ମିନିଟ୍ ବ୍ୟବହାର କରିଛନ୍ତି।"
    },
    "Voice cloud quota: nearly full": {
        "English": "Voice cloud quota: nearly full",
        "Hindi": "वॉयस क्लाउड कोटा: लगभग समाप्त",
        "Kannada": "ಧ್ವನಿ ಕ್ಲೌಡ್ ಕೋಟಾ: ಬಹುತೇಕ ತುಂಬಿದೆ",
        "Tamil": "வாய்ஸ் கிளவுட் ஒதுக்கீடு: கிட்டத்தட்ட நிரம்பிவிட்டது",
        "Telugu": "వాయిస్ క్లౌడ్ కోటా: దాదాపు నిండిపోయింది",
        "Marathi": "वॉइस क्लाउड कोटा: जवळजवळ संपले",
        "Bengali": "ভয়েস ক্লাউড কোটা: প্রায় শেষ",
        "Gujarati": "વૉઇસ ક્લાઉડ કોટા: લગભગ સમાપ્ત",
        "Punjabi": "ਵੌਇਸ ਕਲਾਉਡ ਕੋਟਾ: ਲਗਭਗ ਖਤਮ",
        "Malayalam": "വോയ്‌സ് ക്ലൗഡ് ക്വോട്ട: ഏതാണ്ട് തീരാറായി",
        "Odia": "ଭଏସ୍ କ୍ଲାଉଡ୍ କୋଟା: ପ୍ରାୟ ସମାପ୍ତ"
    },
    "Only {remaining} cloud voice minutes left this month. Browser voice stays free.": {
        "English": "Only {remaining} cloud voice minutes left this month. Browser voice stays free.",
        "Hindi": "इस महीने केवल {remaining} क्लाउड वॉयस मिनट बचे हैं। ब्राउज़र वॉयस मुफ्त रहता है।",
        "Kannada": "ಈ ತಿಂಗಳು ಕೇವಲ {remaining} ಕ್ಲೌಡ್ ಧ್ವನಿ ನಿಮಿಷಗಳು ಮಾತ್ರ ಉಳಿದಿವೆ. ಬ್ರೌಸರ್ ಧ್ವನಿ ಉಚಿತವಾಗಿರುತ್ತದೆ.",
        "Tamil": "இந்த மாதம் {remaining} கிளவுட் வாய்ஸ் நிமிடங்கள் மட்டுமே மீதம். உலாவி வாய்ஸ் இலவசமாக இருக்கும்.",
        "Telugu": "ఈ నెలలో {remaining} క్లౌడ్ వాయిస్ నిమిషాలు మాత్రమే మిగిలి ఉన్నాయి. బ్రౌజర్ వాయిస్ ఉచితంగా ఉంటుంది.",
        "Marathi": "या महिन्यात फक्त {remaining} क्लाउड वॉइस मिनिटे शिल्लक. ब्राउझर वॉइस मोफत राहते.",
        "Bengali": "এই মাসে শুধুমাত্র {remaining} ক্লাউড ভয়েস মিনিট বাকি। ব্রাউজার ভয়েস বিনামূল্যে থাকে।",
        "Gujarati": "આ મહિને માત્ર {remaining} ક્લાઉડ વૉઇસ મિનિટ બાકી. બ્રાઉઝર વૉઇસ મફત રહે છે.",
        "Punjabi": "ਇਸ ਮਹੀਨੇ ਸਿਰਫ਼ {remaining} ਕਲਾਉਡ ਵੌਇਸ ਮਿੰਟ ਬਾਕੀ ਹਨ। ਬ੍ਰਾਊਜ਼ਰ ਵੌਇਸ ਮੁਫ਼ਤ ਰਹਿੰਦਾ ਹੈ।",
        "Malayalam": "ഈ മാസം {remaining} ക്ലൗഡ് വോയ്‌സ് മിനിറ്റുകൾ മാത്രം ബാക്കി. ബ്രൗസർ വോയ്‌സ് സൗജന്യമാണ്.",
        "Odia": "ଏହି ମାସରେ କେବଳ {remaining} କ୍ଲାଉଡ୍ ଭଏସ୍ ମିନିଟ୍ ବାକି। ବ୍ରାଉଜର୍ ଭଏସ୍ ମାଗଣା ଅଛି।"
    },
    // Premium enterprise differentiators (2026-04-24 pricing review)
    "Chains, government & 250+ teacher schools": {
        "English": "Chains, government & 250+ teacher schools",
        "Hindi": "चेन, सरकार और 250+ शिक्षक वाले स्कूल",
        "Kannada": "ಚೈನ್‌ಗಳು, ಸರ್ಕಾರ ಮತ್ತು 250+ ಶಿಕ್ಷಕರ ಶಾಲೆಗಳು",
        "Tamil": "Chains, government & 250+ teacher schools",
        "Telugu": "Chains, government & 250+ teacher schools",
        "Marathi": "Chains, government & 250+ teacher schools",
        "Bengali": "Chains, government & 250+ teacher schools",
        "Gujarati": "Chains, government & 250+ teacher schools",
        "Punjabi": "Chains, government & 250+ teacher schools",
        "Malayalam": "Chains, government & 250+ teacher schools",
        "Odia": "Chains, government & 250+ teacher schools"
    },
    "Custom agreement, enterprise security, private deployment.": {
        "English": "Custom agreement, enterprise security, private deployment.",
        "Hindi": "कस्टम समझौता, एंटरप्राइज़ सुरक्षा, निजी परिनियोजन।",
        "Kannada": "ಕಸ್ಟಮ್ ಒಪ್ಪಂದ, ಎಂಟರ್‌ಪ್ರೈಸ್ ಭದ್ರತೆ, ಖಾಸಗಿ ನಿಯೋಜನೆ.",
        "Tamil": "Custom agreement, enterprise security, private deployment.",
        "Telugu": "Custom agreement, enterprise security, private deployment.",
        "Marathi": "Custom agreement, enterprise security, private deployment.",
        "Bengali": "Custom agreement, enterprise security, private deployment.",
        "Gujarati": "Custom agreement, enterprise security, private deployment.",
        "Punjabi": "Custom agreement, enterprise security, private deployment.",
        "Malayalam": "Custom agreement, enterprise security, private deployment.",
        "Odia": "Custom agreement, enterprise security, private deployment."
    },
    "What Premium adds on top of Gold": {
        "English": "What Premium adds on top of Gold",
        "Hindi": "Gold के ऊपर Premium में क्या जुड़ता है",
        "Kannada": "Gold ಮೇಲೆ Premium ನಲ್ಲಿ ಏನು ಸೇರುತ್ತದೆ",
        "Tamil": "What Premium adds on top of Gold",
        "Telugu": "What Premium adds on top of Gold",
        "Marathi": "What Premium adds on top of Gold",
        "Bengali": "What Premium adds on top of Gold",
        "Gujarati": "What Premium adds on top of Gold",
        "Punjabi": "What Premium adds on top of Gold",
        "Malayalam": "What Premium adds on top of Gold",
        "Odia": "What Premium adds on top of Gold"
    },
    "Contact SARGVISION": {
        "English": "Contact SARGVISION", "Hindi": "SARGVISION से संपर्क करें", "Kannada": "SARGVISION ಅನ್ನು ಸಂಪರ್ಕಿಸಿ",
        "Tamil": "SARGVISION ஐ தொடர்பு கொள்ளவும்", "Telugu": "SARGVISION ను సంప్రదించండి", "Marathi": "SARGVISION शी संपर्क साधा",
        "Bengali": "SARGVISION এর সাথে যোগাযোগ করুন", "Gujarati": "SARGVISION નો સંપર્ક કરો", "Punjabi": "SARGVISION ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
        "Malayalam": "SARGVISION നെ ബന്ധപ്പെടുക", "Odia": "SARGVISION ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ"
    },
    "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.": {
        "English": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Hindi": "कर्नाटक और तेलंगाना में राज्य शिक्षा हितधारकों और Tier 2 स्कूल चेन के साथ जुड़ रहे हैं।",
        "Kannada": "ಕರ್ನಾಟಕ ಮತ್ತು ತೆಲಂಗಾಣದ ರಾಜ್ಯ ಶಿಕ್ಷಣ ಭಾಗೀದಾರರು ಮತ್ತು ಟಯರ್ 2 ಶಾಲಾ ಸರಪಳಿಗಳೊಂದಿಗೆ ತೊಡಗಿಸಿಕೊಂಡಿದ್ದೇವೆ.",
        "Tamil": "கர்நாடகா மற்றும் தெலுங்கானாவில் மாநில கல்வி பங்குதாரர்கள் மற்றும் Tier 2 பள்ளி சங்கிலிகளுடன் ஈடுபடுகிறோம்.",
        "Telugu": "కర్ణాటక మరియు తెలంగాణలో రాష్ట్ర విద్యా భాగస్వాములు మరియు Tier 2 పాఠశాల చైన్‌లతో నిమగ్నమవుతున్నాము.",
        "Marathi": "कर्नाटक आणि तेलंगणामध्ये राज्य शिक्षण भागधारक आणि Tier 2 शाळा साखळ्यांसोबत संलग्न आहोत.",
        "Bengali": "কর্ণাটক এবং তেলেঙ্গানায় রাজ্য শিক্ষা অংশীদার এবং Tier 2 স্কুল চেইনের সাথে সংযুক্ত হচ্ছি।",
        "Gujarati": "કર્ણાટક અને તેલંગાણામાં રાજ્ય શિક્ષણ હિતધારકો અને Tier 2 શાળા ચેઇન સાથે જોડાઈ રહ્યા છીએ.",
        "Punjabi": "ਕਰਨਾਟਕ ਅਤੇ ਤੇਲੰਗਾਨਾ ਵਿੱਚ ਰਾਜ ਸਿੱਖਿਆ ਹਿੱਸੇਦਾਰਾਂ ਅਤੇ Tier 2 ਸਕੂਲ ਚੇਨਾਂ ਨਾਲ ਜੁੜ ਰਹੇ ਹਾਂ।",
        "Malayalam": "കർണാടകത്തിലും തെലങ്കാനയിലും സംസ്ഥാന വിദ്യാഭ്യാസ പങ്കാളികളുമായും Tier 2 സ്കൂൾ ശൃംഖലകളുമായും ഇടപഴകുന്നു.",
        "Odia": "କର୍ଣ୍ଣାଟକ ଏବଂ ତେଲେଙ୍ଗାନାରେ ରାଜ୍ୟ ଶିକ୍ଷା ଅଂଶୀଦାର ଏବଂ Tier 2 ସ୍କୁଲ୍ ଶୃଙ୍ଖଳା ସହିତ ଜଡିତ ହେଉଛୁ।"
    },
    // Premium feature bullets — English-only for now (highly technical enterprise terms
    // don't translate cleanly; B2B enterprise buyers read English). Listed as keys so
    // t() returns the English fallback.
    "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)": {
        "English": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Hindi": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Kannada": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Tamil": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Telugu": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Marathi": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Bengali": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Gujarati": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Punjabi": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Malayalam": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)",
        "Odia": "SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)"
    },
    "Private deployment on your own cloud (AWS, GCP, or on-prem)": {
        "English": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Hindi": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Kannada": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Tamil": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Telugu": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Marathi": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Bengali": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Gujarati": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Punjabi": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Malayalam": "Private deployment on your own cloud (AWS, GCP, or on-prem)",
        "Odia": "Private deployment on your own cloud (AWS, GCP, or on-prem)"
    },
    "99.9% uptime SLA with written commitments": {
        "English": "99.9% uptime SLA with written commitments",
        "Hindi": "99.9% uptime SLA with written commitments",
        "Kannada": "99.9% uptime SLA with written commitments",
        "Tamil": "99.9% uptime SLA with written commitments",
        "Telugu": "99.9% uptime SLA with written commitments",
        "Marathi": "99.9% uptime SLA with written commitments",
        "Bengali": "99.9% uptime SLA with written commitments",
        "Gujarati": "99.9% uptime SLA with written commitments",
        "Punjabi": "99.9% uptime SLA with written commitments",
        "Malayalam": "99.9% uptime SLA with written commitments",
        "Odia": "99.9% uptime SLA with written commitments"
    },
    "Dedicated customer success manager": {
        "English": "Dedicated customer success manager",
        "Hindi": "समर्पित ग्राहक सफलता प्रबंधक",
        "Kannada": "ಮೀಸಲಾದ ಗ್ರಾಹಕ ಯಶಸ್ಸು ವ್ಯವಸ್ಥಾಪಕ",
        "Tamil": "அர்ப்பணிப்புள்ள வாடிக்கையாளர் வெற்றி மேலாளர்",
        "Telugu": "అంకిత కస్టమర్ సక్సెస్ మేనేజర్",
        "Marathi": "समर्पित ग्राहक यश व्यवस्थापक",
        "Bengali": "নিবেদিত গ্রাহক সাফল্য ব্যবস্থাপক",
        "Gujarati": "સમર્પિત ગ્રાહક સફળતા વ્યવસ્થાપક",
        "Punjabi": "ਸਮਰਪਿਤ ਗਾਹਕ ਸਫਲਤਾ ਪ੍ਰਬੰਧਕ",
        "Malayalam": "സമർപ്പിത കസ്റ്റമർ സക്സസ് മാനേജർ",
        "Odia": "ସମର୍ପିତ ଗ୍ରାହକ ସଫଳତା ପରିଚାଳକ"
    },
    "Audit logs and DPDP compliance reports": {
        "English": "Audit logs and DPDP compliance reports",
        "Hindi": "Audit logs and DPDP compliance reports",
        "Kannada": "Audit logs and DPDP compliance reports",
        "Tamil": "Audit logs and DPDP compliance reports",
        "Telugu": "Audit logs and DPDP compliance reports",
        "Marathi": "Audit logs and DPDP compliance reports",
        "Bengali": "Audit logs and DPDP compliance reports",
        "Gujarati": "Audit logs and DPDP compliance reports",
        "Punjabi": "Audit logs and DPDP compliance reports",
        "Malayalam": "Audit logs and DPDP compliance reports",
        "Odia": "Audit logs and DPDP compliance reports"
    },
    "Custom AI fine-tuning on your board and curriculum": {
        "English": "Custom AI fine-tuning on your board and curriculum",
        "Hindi": "आपके बोर्ड और पाठ्यक्रम पर कस्टम AI फाइन-ट्यूनिंग",
        "Kannada": "ನಿಮ್ಮ ಬೋರ್ಡ್ ಮತ್ತು ಪಠ್ಯಕ್ರಮದ ಮೇಲೆ ಕಸ್ಟಮ್ AI ಫೈನ್-ಟ್ಯೂನಿಂಗ್",
        "Tamil": "உங்கள் வாரியம் மற்றும் பாடத்திட்டத்தில் தனிப்பயன் AI fine-tuning",
        "Telugu": "మీ బోర్డు మరియు పాఠ్యప్రణాళికపై కస్టమ్ AI fine-tuning",
        "Marathi": "आपल्या मंडळ आणि अभ्यासक्रमावर कस्टम AI fine-tuning",
        "Bengali": "আপনার বোর্ড এবং পাঠ্যক্রমে কাস্টম AI fine-tuning",
        "Gujarati": "તમારા બોર્ડ અને અભ્યાસક્રમ પર કસ્ટમ AI fine-tuning",
        "Punjabi": "ਤੁਹਾਡੇ ਬੋਰਡ ਅਤੇ ਪਾਠਕ੍ਰਮ 'ਤੇ ਕਸਟਮ AI fine-tuning",
        "Malayalam": "നിങ്ങളുടെ ബോർഡിലും പാഠ്യപദ്ധതിയിലും കസ്റ്റം AI fine-tuning",
        "Odia": "ଆପଣଙ୍କ ବୋର୍ଡ ଏବଂ ପାଠ୍ୟକ୍ରମ ଉପରେ କଷ୍ଟମ୍ AI fine-tuning"
    },
    "API access and ERP integration (Fedena, Campus, custom)": {
        "English": "API access and ERP integration (Fedena, Campus, custom)",
        "Hindi": "API access and ERP integration (Fedena, Campus, custom)",
        "Kannada": "API access and ERP integration (Fedena, Campus, custom)",
        "Tamil": "API access and ERP integration (Fedena, Campus, custom)",
        "Telugu": "API access and ERP integration (Fedena, Campus, custom)",
        "Marathi": "API access and ERP integration (Fedena, Campus, custom)",
        "Bengali": "API access and ERP integration (Fedena, Campus, custom)",
        "Gujarati": "API access and ERP integration (Fedena, Campus, custom)",
        "Punjabi": "API access and ERP integration (Fedena, Campus, custom)",
        "Malayalam": "API access and ERP integration (Fedena, Campus, custom)",
        "Odia": "API access and ERP integration (Fedena, Campus, custom)"
    },
    "Unlimited voice cloud minutes (no per-teacher cap)": {
        "English": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Hindi": "असीमित वॉयस क्लाउड मिनट (प्रति शिक्षक कोई सीमा नहीं)",
        "Kannada": "ಅನಿಯಮಿತ ಧ್ವನಿ ಕ್ಲೌಡ್ ನಿಮಿಷಗಳು (ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ ಯಾವುದೇ ಮಿತಿ ಇಲ್ಲ)",
        "Tamil": "வரம்பற்ற voice cloud நிமிடங்கள் (ஆசிரியர் வரம்பு இல்லை)",
        "Telugu": "పరిమితి లేని voice cloud నిమిషాలు (ఉపాధ్యాయ పరిమితి లేదు)",
        "Marathi": "अमर्यादित voice cloud मिनिटे (शिक्षकामागे मर्यादा नाही)",
        "Bengali": "সীমাহীন voice cloud মিনিট (শিক্ষক প্রতি সীমা নেই)",
        "Gujarati": "અમર્યાદિત voice cloud મિનિટ (શિક્ષક દીઠ મર્યાદા નથી)",
        "Punjabi": "ਅਣਗਿਣਤ voice cloud ਮਿੰਟ (ਪ੍ਰਤੀ ਅਧਿਆਪਕ ਕੋਈ ਸੀਮਾ ਨਹੀਂ)",
        "Malayalam": "പരിധിയില്ലാത്ത voice cloud മിനിറ്റുകൾ (ഓരോ അധ്യാപകനും പരിധിയില്ല)",
        "Odia": "ଅସୀମିତ voice cloud ମିନିଟ୍ (ପ୍ରତି ଶିକ୍ଷକଙ୍କ ପାଇଁ କୌଣସି ସୀମା ନାହିଁ)"
    },
    "About SahayakAI": {
        "English": "About SahayakAI", "Hindi": "SahayakAI के बारे में", "Kannada": "SahayakAI ಬಗ್ಗೆ",
        "Tamil": "SahayakAI பற்றி", "Telugu": "SahayakAI గురించి", "Marathi": "SahayakAI विषयी",
        "Bengali": "SahayakAI সম্পর্কে", "Gujarati": "SahayakAI વિશે", "Punjabi": "SahayakAI ਬਾਰੇ",
        "Malayalam": "SahayakAI നെക്കുറിച്ച്", "Odia": "SahayakAI ବିଷୟରେ"
    },
    "Our mission": {
        "English": "Our mission", "Hindi": "हमारा मिशन", "Kannada": "ನಮ್ಮ ಧ್ಯೇಯ",
        "Tamil": "Our mission", "Telugu": "Our mission", "Marathi": "Our mission",
        "Bengali": "Our mission", "Gujarati": "Our mission", "Punjabi": "Our mission",
        "Malayalam": "Our mission", "Odia": "Our mission"
    },
    "Message us": {
        "English": "Message us", "Hindi": "हमें संदेश भेजें", "Kannada": "ನಮಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ",
        "Tamil": "Message us", "Telugu": "Message us", "Marathi": "Message us",
        "Bengali": "Message us", "Gujarati": "Message us", "Punjabi": "Message us",
        "Malayalam": "Message us", "Odia": "Message us"
    },
    "Book a demo": {
        "English": "Book a demo", "Hindi": "डेमो बुक करें", "Kannada": "ಡೆಮೊ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "Book a demo", "Telugu": "Book a demo", "Marathi": "Book a demo",
        "Bengali": "Book a demo", "Gujarati": "Book a demo", "Punjabi": "Book a demo",
        "Malayalam": "Book a demo", "Odia": "Book a demo"
    },
    "SahayakAI for Schools": {
        "English": "SahayakAI for Schools", "Hindi": "स्कूलों के लिए SahayakAI", "Kannada": "ಶಾಲೆಗಳಿಗಾಗಿ SahayakAI",
        "Tamil": "SahayakAI for Schools", "Telugu": "SahayakAI for Schools", "Marathi": "SahayakAI for Schools",
        "Bengali": "SahayakAI for Schools", "Gujarati": "SahayakAI for Schools", "Punjabi": "SahayakAI for Schools",
        "Malayalam": "SahayakAI for Schools", "Odia": "SahayakAI for Schools"
    },
    "Book a 30-minute demo": {
        "English": "Book a 30-minute demo", "Hindi": "30 मिनट का डेमो बुक करें", "Kannada": "30 ನಿಮಿಷಗಳ ಡೆಮೊ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "Book a 30-minute demo", "Telugu": "Book a 30-minute demo", "Marathi": "Book a 30-minute demo",
        "Bengali": "Book a 30-minute demo", "Gujarati": "Book a 30-minute demo", "Punjabi": "Book a 30-minute demo",
        "Malayalam": "Book a 30-minute demo", "Odia": "Book a 30-minute demo"
    },

    // ── Landing page (marketing surface, all 11 languages) ──────────────────
    // Hero
    "For schools, chains & governments": {
        "English": "For schools, chains & governments", "Hindi": "स्कूलों, चेन्स और सरकारों के लिए", "Kannada": "ಶಾಲೆಗಳು, ಚೈನ್‌ಗಳು ಮತ್ತು ಸರ್ಕಾರಗಳಿಗಾಗಿ",
        "Tamil": "பள்ளிகள், சங்கிலிகள் & அரசாங்கங்களுக்காக", "Telugu": "పాఠశాలలు, చైన్‌లు & ప్రభుత్వాల కోసం", "Marathi": "शाळा, साखळ्या आणि सरकारांसाठी",
        "Bengali": "স্কুল, চেইন ও সরকারের জন্য", "Gujarati": "શાળાઓ, ચેઇન અને સરકારો માટે", "Punjabi": "ਸਕੂਲਾਂ, ਚੇਨਾਂ ਅਤੇ ਸਰਕਾਰਾਂ ਲਈ",
        "Malayalam": "സ്കൂളുകൾ, ചെയിനുകൾ & സർക്കാരുകൾക്കായി", "Odia": "ବିଦ୍ୟାଳୟ, ଚେନ୍ ଓ ସରକାରଙ୍କ ପାଇଁ"
    },
    "Give your teachers": {
        "English": "Give your teachers", "Hindi": "अपने शिक्षकों को दें", "Kannada": "ನಿಮ್ಮ ಶಿಕ್ಷಕರಿಗೆ ನೀಡಿ",
        "Tamil": "உங்கள் ஆசிரியர்களுக்கு வழங்குங்கள்", "Telugu": "మీ ఉపాధ్యాయులకు ఇవ్వండి", "Marathi": "तुमच्या शिक्षकांना द्या",
        "Bengali": "আপনার শিক্ষকদের দিন", "Gujarati": "તમારા શિક્ષકોને આપો", "Punjabi": "ਆਪਣੇ ਅਧਿਆਪਕਾਂ ਨੂੰ ਦਿਓ",
        "Malayalam": "നിങ്ങളുടെ അധ്യാപകർക്ക് നൽകൂ", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷକମାନଙ୍କୁ ଦିଅନ୍ତୁ"
    },
    "Not just a lesson plan generator.": {
        "English": "Not just a lesson plan generator.", "Hindi": "सिर्फ़ एक पाठ योजना जनरेटर नहीं।", "Kannada": "ಕೇವಲ ಪಾಠ ಯೋಜನೆ ಜನರೇಟರ್ ಅಲ್ಲ.",
        "Tamil": "வெறும் பாட திட்ட உருவாக்கி அல்ல.", "Telugu": "కేవలం పాఠ్య ప్రణాళిక జనరేటర్ కాదు.", "Marathi": "फक्त एक धडा योजना जनरेटर नाही.",
        "Bengali": "শুধু একটি পাঠ পরিকল্পনা জেনারেটর নয়।", "Gujarati": "માત્ર પાઠ યોજના જનરેટર નથી.", "Punjabi": "ਸਿਰਫ਼ ਇੱਕ ਪਾਠ ਯੋਜਨਾ ਜਨਰੇਟਰ ਨਹੀਂ।",
        "Malayalam": "വെറും ഒരു പാഠ പദ്ധതി ജനറേറ്റർ അല്ല.", "Odia": "କେବଳ ଗୋଟିଏ ପାଠ୍ୟ ଯୋଜନା ଜେନେରେଟର ନୁହେଁ।"
    },
    "is the professional infrastructure Indian educators never had — in 11 languages, across 28 state boards, on the cheapest smartphones.": {
        "English": "is the professional infrastructure Indian educators never had — in 11 languages, across 28 state boards, on the cheapest smartphones.",
        "Hindi": "वह पेशेवर बुनियादी ढाँचा है जो भारतीय शिक्षकों के पास कभी नहीं था — 11 भाषाओं में, 28 राज्य बोर्डों पर, सबसे सस्ते स्मार्टफ़ोनों पर।",
        "Kannada": "ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗೆ ಎಂದಿಗೂ ಇಲ್ಲದ ವೃತ್ತಿಪರ ಮೂಲಸೌಕರ್ಯ — 11 ಭಾಷೆಗಳಲ್ಲಿ, 28 ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳಲ್ಲಿ, ಅಗ್ಗದ ಸ್ಮಾರ್ಟ್‌ಫೋನ್‌ಗಳಲ್ಲಿ.",
        "Tamil": "இந்திய ஆசிரியர்களுக்கு என்றுமே இல்லாத தொழில்முறை உள்கட்டமைப்பு — 11 மொழிகளில், 28 மாநில வாரியங்களில், மலிவான ஸ்மார்ட்போன்களில்.",
        "Telugu": "భారతీయ ఉపాధ్యాయులకు ఎన్నడూ లేని వృత్తిపరమైన మౌలిక సదుపాయం — 11 భాషలలో, 28 రాష్ట్ర బోర్డులలో, చౌకైన స్మార్ట్‌ఫోన్లలో.",
        "Marathi": "भारतीय शिक्षकांकडे कधीच नव्हती अशी व्यावसायिक पायाभूत सुविधा — 11 भाषांमध्ये, 28 राज्य मंडळांवर, सर्वात स्वस्त स्मार्टफोनवर.",
        "Bengali": "ভারতীয় শিক্ষকদের কখনও ছিল না এমন পেশাদার অবকাঠামো — ১১টি ভাষায়, ২৮টি রাজ্য বোর্ডে, সবচেয়ে সস্তা স্মার্টফোনে।",
        "Gujarati": "ભારતીય શિક્ષકો પાસે ક્યારેય નહોતું એવું વ્યાવસાયિક માળખું — 11 ભાષાઓમાં, 28 રાજ્ય બોર્ડ પર, સૌથી સસ્તા સ્માર્ટફોન પર.",
        "Punjabi": "ਉਹ ਪੇਸ਼ੇਵਰ ਬੁਨਿਆਦੀ ਢਾਂਚਾ ਜੋ ਭਾਰਤੀ ਅਧਿਆਪਕਾਂ ਕੋਲ ਕਦੇ ਨਹੀਂ ਸੀ — 11 ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ, 28 ਰਾਜ ਬੋਰਡਾਂ ’ਤੇ, ਸਭ ਤੋਂ ਸਸਤੇ ਸਮਾਰਟਫ਼ੋਨਾਂ ’ਤੇ।",
        "Malayalam": "ഇന്ത്യൻ അധ്യാപകർക്ക് ഒരിക്കലും ഇല്ലാതിരുന്ന തൊഴിൽപരമായ അടിസ്ഥാന സൗകര്യം — 11 ഭാഷകളിൽ, 28 സംസ്ഥാന ബോർഡുകളിൽ, ഏറ്റവും വിലകുറഞ്ഞ സ്മാർട്ട്‌ഫോണുകളിൽ.",
        "Odia": "ଭାରତୀୟ ଶିକ୍ଷକମାନଙ୍କ ପାଖରେ କେବେ ନଥିଲା ଯେଉଁ ବୃତ୍ତିଗତ ଭିତ୍ତିଭୂମି — ୧୧ଟି ଭାଷାରେ, ୨୮ଟି ରାଜ୍ୟ ବୋର୍ଡରେ, ସର୍ବନିମ୍ନ ମୂଲ୍ୟର ସ୍ମାର୍ଟଫୋନରେ।"
    },
    "For governments →": {
        "English": "For governments →", "Hindi": "सरकारों के लिए →", "Kannada": "ಸರ್ಕಾರಗಳಿಗಾಗಿ →",
        "Tamil": "அரசாங்கங்களுக்காக →", "Telugu": "ప్రభుత్వాల కోసం →", "Marathi": "सरकारांसाठी →",
        "Bengali": "সরকারের জন্য →", "Gujarati": "સરકારો માટે →", "Punjabi": "ਸਰਕਾਰਾਂ ਲਈ →",
        "Malayalam": "സർക്കാരുകൾക്കായി →", "Odia": "ସରକାରଙ୍କ ପାଇଁ →"
    },
    "Indian languages": {
        "English": "Indian languages", "Hindi": "भारतीय भाषाएँ", "Kannada": "ಭಾರತೀಯ ಭಾಷೆಗಳು",
        "Tamil": "இந்திய மொழிகள்", "Telugu": "భారతీయ భాషలు", "Marathi": "भारतीय भाषा",
        "Bengali": "ভারতীয় ভাষা", "Gujarati": "ભારતીય ભાષાઓ", "Punjabi": "ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ",
        "Malayalam": "ഇന്ത്യൻ ഭാഷകൾ", "Odia": "ଭାରତୀୟ ଭାଷାଗୁଡ଼ିକ"
    },
    "state boards": {
        "English": "state boards", "Hindi": "राज्य बोर्ड", "Kannada": "ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳು",
        "Tamil": "மாநில வாரியங்கள்", "Telugu": "రాష్ట్ర బోర్డులు", "Marathi": "राज्य मंडळे",
        "Bengali": "রাজ্য বোর্ড", "Gujarati": "રાજ્ય બોર્ડ", "Punjabi": "ਰਾਜ ਬੋਰਡ",
        "Malayalam": "സംസ്ഥാന ബോർഡുകൾ", "Odia": "ରାଜ୍ୟ ବୋର୍ଡ"
    },
    "2+ hrs": {
        "English": "2+ hrs", "Hindi": "2+ घंटे", "Kannada": "2+ ಗಂಟೆಗಳು",
        "Tamil": "2+ மணி", "Telugu": "2+ గం.", "Marathi": "2+ तास",
        "Bengali": "২+ ঘণ্টা", "Gujarati": "2+ કલાક", "Punjabi": "2+ ਘੰਟੇ",
        "Malayalam": "2+ മണിക്കൂർ", "Odia": "୨+ ଘଣ୍ଟା"
    },
    "saved daily": {
        "English": "saved daily", "Hindi": "रोज़ बचत", "Kannada": "ಪ್ರತಿದಿನ ಉಳಿತಾಯ",
        "Tamil": "தினமும் சேமிக்கப்பட்டது", "Telugu": "రోజూ ఆదా", "Marathi": "रोज वाचवले",
        "Bengali": "প্রতিদিন সঞ্চিত", "Gujarati": "દરરોજ બચત", "Punjabi": "ਰੋਜ਼ਾਨਾ ਬਚਤ",
        "Malayalam": "ദിവസേന ലാഭം", "Odia": "ପ୍ରତିଦିନ ସଞ୍ଚୟ"
    },
    "~200 hrs/year": {
        "English": "~200 hrs/year", "Hindi": "~200 घंटे/वर्ष", "Kannada": "~200 ಗಂಟೆ/ವರ್ಷ",
        "Tamil": "~200 மணி/ஆண்டு", "Telugu": "~200 గం./సం.", "Marathi": "~200 तास/वर्ष",
        "Bengali": "~২০০ ঘণ্টা/বছর", "Gujarati": "~200 કલાક/વર્ષ", "Punjabi": "~200 ਘੰਟੇ/ਸਾਲ",
        "Malayalam": "~200 മണിക്കൂർ/വർഷം", "Odia": "~୨୦୦ ଘଣ୍ଟା/ବର୍ଷ"
    },
    "per teacher": {
        "English": "per teacher", "Hindi": "प्रति शिक्षक", "Kannada": "ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ",
        "Tamil": "ஒரு ஆசிரியருக்கு", "Telugu": "ఉపాధ్యాయునికి", "Marathi": "प्रति शिक्षक",
        "Bengali": "প্রতি শিক্ষক", "Gujarati": "પ્રતિ શિક્ષક", "Punjabi": "ਪ੍ਰਤੀ ਅਧਿਆਪਕ",
        "Malayalam": "ഓരോ അധ്യാപകനും", "Odia": "ପ୍ରତି ଶିକ୍ଷକ"
    },

    // Pillar names
    "pillar.prep-desk.name": {
        "English": "Prep desk", "Hindi": "तैयारी डेस्क", "Kannada": "ಪ್ರಿಪ್ ಡೆಸ್ಕ್",
        "Tamil": "தயாரிப்பு மேசை", "Telugu": "ప్రిప్ డెస్క్", "Marathi": "तयारी डेस्क",
        "Bengali": "প্রস্তুতি ডেস্ক", "Gujarati": "તૈયારી ડેસ્ક", "Punjabi": "ਤਿਆਰੀ ਡੈਸਕ",
        "Malayalam": "തയ്യാറെടുപ്പ് ഡെസ്ക്", "Odia": "ପ୍ରସ୍ତୁତି ଡେସ୍କ"
    },
    "pillar.ai-co-teacher.name": {
        "English": "AI co-teacher", "Hindi": "AI सह-शिक्षक", "Kannada": "AI ಸಹ-ಶಿಕ್ಷಕ",
        "Tamil": "AI இணை-ஆசிரியர்", "Telugu": "AI సహ-ఉపాధ్యాయుడు", "Marathi": "AI सह-शिक्षक",
        "Bengali": "AI সহ-শিক্ষক", "Gujarati": "AI સહ-શિક્ષક", "Punjabi": "AI ਸਹਿ-ਅਧਿਆਪਕ",
        "Malayalam": "AI സഹ-അധ്യാപകൻ", "Odia": "AI ସହ-ଶିକ୍ଷକ"
    },
    "pillar.parent-hotline.name": {
        "English": "Parent hotline", "Hindi": "अभिभावक हॉटलाइन", "Kannada": "ಪೋಷಕ ಹಾಟ್‌ಲೈನ್",
        "Tamil": "பெற்றோர் ஹாட்லைன்", "Telugu": "తల్లిదండ్రుల హాట్‌లైన్", "Marathi": "पालक हॉटलाइन",
        "Bengali": "অভিভাবক হটলাইন", "Gujarati": "વાલી હોટલાઇન", "Punjabi": "ਮਾਤਾ-ਪਿਤਾ ਹੌਟਲਾਈਨ",
        "Malayalam": "രക്ഷിതാവ് ഹോട്ട്‌ലൈൻ", "Odia": "ଅଭିଭାବକ ହଟ୍‌ଲାଇନ୍"
    },
    "pillar.staffroom.name": {
        "English": "Staffroom", "Hindi": "स्टाफ़रूम", "Kannada": "ಸಿಬ್ಬಂದಿ ಕೊಠಡಿ",
        "Tamil": "ஆசிரியர் அறை", "Telugu": "స్టాఫ్‌రూమ్", "Marathi": "स्टाफरूम",
        "Bengali": "স্টাফরুম", "Gujarati": "સ્ટાફરૂમ", "Punjabi": "ਸਟਾਫ਼ਰੂਮ",
        "Malayalam": "സ്റ്റാഫ്റൂം", "Odia": "ଷ୍ଟାଫରୁମ"
    },
    "pillar.pro-inbox.name": {
        "English": "Pro inbox", "Hindi": "प्रो इनबॉक्स", "Kannada": "ಪ್ರೋ ಇನ್‌ಬಾಕ್ಸ್",
        "Tamil": "புரோ இன்பாக்ஸ்", "Telugu": "ప్రో ఇన్‌బాక్స్", "Marathi": "प्रो इनबॉक्स",
        "Bengali": "প্রো ইনবক্স", "Gujarati": "પ્રો ઇનબૉક્સ", "Punjabi": "ਪ੍ਰੋ ਇਨਬਾਕਸ",
        "Malayalam": "പ്രോ ഇൻബോക്സ്", "Odia": "ପ୍ରୋ ଇନବକ୍ସ"
    },
    "pillar.operating-system.name": {
        "English": "Operating system", "Hindi": "ऑपरेटिंग सिस्टम", "Kannada": "ಆಪರೇಟಿಂಗ್ ಸಿಸ್ಟಮ್",
        "Tamil": "இயக்க அமைப்பு", "Telugu": "ఆపరేటింగ్ సిస్టమ్", "Marathi": "ऑपरेटिंग सिस्टम",
        "Bengali": "অপারেটিং সিস্টেম", "Gujarati": "ઓપરેટિંગ સિસ્ટમ", "Punjabi": "ਆਪਰੇਟਿੰਗ ਸਿਸਟਮ",
        "Malayalam": "ഓപ്പറേറ്റിംഗ് സിസ്റ്റം", "Odia": "ଅପରେଟିଂ ସିଷ୍ଟମ୍"
    },

    // Pillar descriptions
    "pillar.prep-desk.desc": {
        "English": "Voice-first lesson prep · 7 AI tools · 11 languages",
        "Hindi": "आवाज़-पहले पाठ तैयारी · 7 AI टूल · 11 भाषाएँ",
        "Kannada": "ಧ್ವನಿ-ಪ್ರಥಮ ಪಾಠ ತಯಾರಿಕೆ · 7 AI ಸಾಧನಗಳು · 11 ಭಾಷೆಗಳು",
        "Tamil": "குரல்-முதன்மை பாடம் தயாரிப்பு · 7 AI கருவிகள் · 11 மொழிகள்",
        "Telugu": "వాయిస్-ఫస్ట్ పాఠ్య ప్రణాళిక · 7 AI సాధనాలు · 11 భాషలు",
        "Marathi": "आवाज-प्रथम धडा तयारी · 7 AI साधने · 11 भाषा",
        "Bengali": "ভয়েস-ফার্স্ট পাঠ প্রস্তুতি · ৭টি AI টুল · ১১টি ভাষা",
        "Gujarati": "વોઇસ-ફર્સ્ટ પાઠ તૈયારી · 7 AI સાધનો · 11 ભાષાઓ",
        "Punjabi": "ਆਵਾਜ਼-ਪਹਿਲਾਂ ਪਾਠ ਤਿਆਰੀ · 7 AI ਟੂਲ · 11 ਭਾਸ਼ਾਵਾਂ",
        "Malayalam": "ശബ്ദ-പ്രഥമ പാഠ തയ്യാറെടുപ്പ് · 7 AI ഉപകരണങ്ങൾ · 11 ഭാഷകൾ",
        "Odia": "ସ୍ୱର-ପ୍ରଥମ ପାଠ ପ୍ରସ୍ତୁତି · ୭ଟି AI ଉପକରଣ · ୧୧ଟି ଭାଷା"
    },
    "pillar.ai-co-teacher.desc": {
        "English": "VIDYA · persistent pedagogy coach on every page",
        "Hindi": "VIDYA · हर पेज पर लगातार शिक्षण कोच",
        "Kannada": "VIDYA · ಪ್ರತಿ ಪುಟದಲ್ಲೂ ನಿರಂತರ ಶಿಕ್ಷಣ ಕೋಚ್",
        "Tamil": "VIDYA · ஒவ்வொரு பக்கத்திலும் நிலையான கற்பித்தல் பயிற்சியாளர்",
        "Telugu": "VIDYA · ప్రతి పేజీలో నిరంతర బోధన కోచ్",
        "Marathi": "VIDYA · प्रत्येक पानावर सततचा शिक्षण प्रशिक्षक",
        "Bengali": "VIDYA · প্রতিটি পৃষ্ঠায় ধারাবাহিক শিক্ষাদান কোচ",
        "Gujarati": "VIDYA · દરેક પાના પર સતત શિક્ષણ કોચ",
        "Punjabi": "VIDYA · ਹਰ ਪੰਨੇ 'ਤੇ ਨਿਰੰਤਰ ਸਿੱਖਿਆ ਕੋਚ",
        "Malayalam": "VIDYA · എല്ലാ പേജിലും തുടർച്ചയായ അധ്യാപന കോച്ച്",
        "Odia": "VIDYA · ପ୍ରତ୍ୟେକ ପୃଷ୍ଠାରେ ନିରନ୍ତର ଶିକ୍ଷଣ କୋଚ୍"
    },
    "pillar.parent-hotline.desc": {
        "English": "AI voice calls to parents in their own language",
        "Hindi": "अभिभावकों को उनकी ही भाषा में AI वॉयस कॉल",
        "Kannada": "ಪೋಷಕರಿಗೆ ಅವರ ಸ್ವಂತ ಭಾಷೆಯಲ್ಲಿ AI ಧ್ವನಿ ಕರೆಗಳು",
        "Tamil": "பெற்றோருக்கு அவர்களின் சொந்த மொழியில் AI குரல் அழைப்புகள்",
        "Telugu": "తల్లిదండ్రులకు వారి స్వంత భాషలో AI వాయిస్ కాల్‌లు",
        "Marathi": "पालकांना त्यांच्याच भाषेत AI व्हॉइस कॉल्स",
        "Bengali": "অভিভাবকদের নিজস্ব ভাষায় AI ভয়েস কল",
        "Gujarati": "વાલીઓને તેમની પોતાની ભાષામાં AI વોઇસ કૉલ",
        "Punjabi": "ਮਾਤਾ-ਪਿਤਾ ਨੂੰ ਉਹਨਾਂ ਦੀ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ AI ਆਵਾਜ਼ ਕਾਲਾਂ",
        "Malayalam": "രക്ഷിതാക്കൾക്ക് അവരുടെ സ്വന്തം ഭാഷയിൽ AI വോയ്സ് കോളുകൾ",
        "Odia": "ଅଭିଭାବକମାନଙ୍କୁ ସେମାନଙ୍କ ନିଜସ୍ୱ ଭାଷାରେ AI ଭଏସ୍ କଲ୍"
    },
    "pillar.staffroom.desc": {
        "English": "India's first structured professional teacher network",
        "Hindi": "भारत का पहला संरचित पेशेवर शिक्षक नेटवर्क",
        "Kannada": "ಭಾರತದ ಮೊದಲ ರಚನಾತ್ಮಕ ವೃತ್ತಿಪರ ಶಿಕ್ಷಕ ಜಾಲ",
        "Tamil": "இந்தியாவின் முதல் கட்டமைக்கப்பட்ட தொழில்முறை ஆசிரியர் வலையமைப்பு",
        "Telugu": "భారతదేశపు మొదటి నిర్మాణాత్మక వృత్తిపరమైన ఉపాధ్యాయ నెట్‌వర్క్",
        "Marathi": "भारतातील पहिले संरचित व्यावसायिक शिक्षक नेटवर्क",
        "Bengali": "ভারতের প্রথম কাঠামোবদ্ধ পেশাদার শিক্ষক নেটওয়ার্ক",
        "Gujarati": "ભારતનું પ્રથમ સંરચિત વ્યાવસાયિક શિક્ષક નેટવર્ક",
        "Punjabi": "ਭਾਰਤ ਦਾ ਪਹਿਲਾ ਢਾਂਚਾਗਤ ਪੇਸ਼ੇਵਰ ਅਧਿਆਪਕ ਨੈੱਟਵਰਕ",
        "Malayalam": "ഇന്ത്യയിലെ ആദ്യ ഘടനാപരമായ പ്രൊഫഷണൽ അധ്യാപക നെറ്റ്‌വർക്ക്",
        "Odia": "ଭାରତର ପ୍ରଥମ ସଂରଚିତ ବୃତ୍ତିଗତ ଶିକ୍ଷକ ନେଟୱର୍କ"
    },
    "pillar.pro-inbox.desc": {
        "English": "Purpose-built professional messaging, structured + searchable",
        "Hindi": "उद्देश्य-निर्मित पेशेवर संदेश, संरचित + खोज योग्य",
        "Kannada": "ಉದ್ದೇಶ-ನಿರ್ಮಿತ ವೃತ್ತಿಪರ ಸಂದೇಶ, ರಚನಾತ್ಮಕ + ಹುಡುಕಲು ಸಾಧ್ಯ",
        "Tamil": "நோக்கம்-கொண்ட தொழில்முறை செய்தி, கட்டமைக்கப்பட்ட + தேடக்கூடிய",
        "Telugu": "ఉద్దేశ్యం-నిర్మించిన వృత్తిపరమైన మెసేజింగ్, నిర్మాణాత్మక + వెతకగలిగే",
        "Marathi": "उद्देश-निर्मित व्यावसायिक संदेशन, संरचित + शोधण्यायोग्य",
        "Bengali": "উদ্দেশ্য-নির্মিত পেশাদার মেসেজিং, কাঠামোবদ্ধ + অনুসন্ধানযোগ্য",
        "Gujarati": "હેતુ-નિર્મિત વ્યાવસાયિક સંદેશ, સંરચિત + શોધી શકાય તેવું",
        "Punjabi": "ਉਦੇਸ਼-ਨਿਰਮਿਤ ਪੇਸ਼ੇਵਰ ਸੁਨੇਹਾ, ਢਾਂਚਾਗਤ + ਖੋਜਣਯੋਗ",
        "Malayalam": "ഉദ്ദേശ്യ-നിർമിത പ്രൊഫഷണൽ മെസേജിംഗ്, ഘടനാപരമായ + തിരയാവുന്ന",
        "Odia": "ଉଦ୍ଦେଶ୍ୟ-ନିର୍ମିତ ବୃତ୍ତିଗତ ସନ୍ଦେଶ, ସଂରଚିତ + ଖୋଜିବାଯୋଗ୍ୟ"
    },
    "pillar.operating-system.desc": {
        "English": "PWA · 28 state boards · works on the cheapest Android phones",
        "Hindi": "PWA · 28 राज्य बोर्ड · सबसे सस्ते एंड्रॉइड फ़ोनों पर काम करता है",
        "Kannada": "PWA · 28 ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳು · ಅಗ್ಗದ ಆಂಡ್ರಾಯ್ಡ್ ಫೋನ್‌ಗಳಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
        "Tamil": "PWA · 28 மாநில வாரியங்கள் · மலிவான ஆண்ட்ராய்டு போன்களில் இயங்குகிறது",
        "Telugu": "PWA · 28 రాష్ట్ర బోర్డులు · చౌకైన ఆండ్రాయిడ్ ఫోన్‌లలో పనిచేస్తుంది",
        "Marathi": "PWA · 28 राज्य मंडळे · सर्वात स्वस्त अँड्रॉइड फोनवर काम करते",
        "Bengali": "PWA · ২৮টি রাজ্য বোর্ড · সবচেয়ে সস্তা অ্যান্ড্রয়েড ফোনে কাজ করে",
        "Gujarati": "PWA · 28 રાજ્ય બોર્ડ · સૌથી સસ્તા એન્ડ્રોઇડ ફોન પર કામ કરે છે",
        "Punjabi": "PWA · 28 ਰਾਜ ਬੋਰਡ · ਸਭ ਤੋਂ ਸਸਤੇ ਐਂਡਰਾਇਡ ਫ਼ੋਨਾਂ 'ਤੇ ਕੰਮ ਕਰਦਾ ਹੈ",
        "Malayalam": "PWA · 28 സംസ്ഥാന ബോർഡുകൾ · ഏറ്റവും വിലകുറഞ്ഞ ആൻഡ്രോയിഡ് ഫോണുകളിൽ പ്രവർത്തിക്കുന്നു",
        "Odia": "PWA · ୨୮ଟି ରାଜ୍ୟ ବୋର୍ଡ · ସର୍ବନିମ୍ନ ମୂଲ୍ୟର ଆଣ୍ଡ୍ରଏଡ୍ ଫୋନରେ କାମ କରେ"
    },

    // Pillar rotating phrases (slot into "Give your teachers ___")
    "pillar.prep-desk.rotating": {
        "English": "a prep desk.", "Hindi": "एक तैयारी डेस्क।", "Kannada": "ಒಂದು ಪ್ರಿಪ್ ಡೆಸ್ಕ್.",
        "Tamil": "ஒரு தயாரிப்பு மேசை.", "Telugu": "ఒక ప్రిప్ డెస్క్.", "Marathi": "एक तयारी डेस्क.",
        "Bengali": "একটি প্রস্তুতি ডেস্ক।", "Gujarati": "એક તૈયારી ડેસ્ક.", "Punjabi": "ਇੱਕ ਤਿਆਰੀ ਡੈਸਕ।",
        "Malayalam": "ഒരു തയ്യാറെടുപ്പ് ഡെസ്ക്.", "Odia": "ଗୋଟିଏ ପ୍ରସ୍ତୁତି ଡେସ୍କ।"
    },
    "pillar.ai-co-teacher.rotating": {
        "English": "an AI co-teacher.", "Hindi": "एक AI सह-शिक्षक।", "Kannada": "ಒಬ್ಬ AI ಸಹ-ಶಿಕ್ಷಕ.",
        "Tamil": "ஒரு AI இணை-ஆசிரியர்.", "Telugu": "ఒక AI సహ-ఉపాధ్యాయుడు.", "Marathi": "एक AI सह-शिक्षक.",
        "Bengali": "একজন AI সহ-শিক্ষক।", "Gujarati": "એક AI સહ-શિક્ષક.", "Punjabi": "ਇੱਕ AI ਸਹਿ-ਅਧਿਆਪਕ।",
        "Malayalam": "ഒരു AI സഹ-അധ്യാപകൻ.", "Odia": "ଜଣେ AI ସହ-ଶିକ୍ଷକ।"
    },
    "pillar.parent-hotline.rotating": {
        "English": "a parent hotline.", "Hindi": "एक अभिभावक हॉटलाइन।", "Kannada": "ಒಂದು ಪೋಷಕ ಹಾಟ್‌ಲೈನ್.",
        "Tamil": "ஒரு பெற்றோர் ஹாட்லைன்.", "Telugu": "ఒక తల్లిదండ్రుల హాట్‌లైన్.", "Marathi": "एक पालक हॉटलाइन.",
        "Bengali": "একটি অভিভাবক হটলাইন।", "Gujarati": "એક વાલી હોટલાઇન.", "Punjabi": "ਇੱਕ ਮਾਤਾ-ਪਿਤਾ ਹੌਟਲਾਈਨ।",
        "Malayalam": "ഒരു രക്ഷിതാവ് ഹോട്ട്‌ലൈൻ.", "Odia": "ଗୋଟିଏ ଅଭିଭାବକ ହଟ୍‌ଲାଇନ୍।"
    },
    "pillar.staffroom.rotating": {
        "English": "a staffroom.", "Hindi": "एक स्टाफ़रूम।", "Kannada": "ಒಂದು ಸಿಬ್ಬಂದಿ ಕೊಠಡಿ.",
        "Tamil": "ஒரு ஆசிரியர் அறை.", "Telugu": "ఒక స్టాఫ్‌రూమ్.", "Marathi": "एक स्टाफरूम.",
        "Bengali": "একটি স্টাফরুম।", "Gujarati": "એક સ્ટાફરૂમ.", "Punjabi": "ਇੱਕ ਸਟਾਫ਼ਰੂਮ।",
        "Malayalam": "ഒരു സ്റ്റാഫ്റൂം.", "Odia": "ଗୋଟିଏ ଷ୍ଟାଫରୁମ।"
    },
    "pillar.pro-inbox.rotating": {
        "English": "a professional inbox.", "Hindi": "एक पेशेवर इनबॉक्स।", "Kannada": "ಒಂದು ವೃತ್ತಿಪರ ಇನ್‌ಬಾಕ್ಸ್.",
        "Tamil": "ஒரு தொழில்முறை இன்பாக்ஸ்.", "Telugu": "ఒక వృత్తిపరమైన ఇన్‌బాక్స్.", "Marathi": "एक व्यावसायिक इनबॉक्स.",
        "Bengali": "একটি পেশাদার ইনবক্স।", "Gujarati": "એક વ્યાવસાયિક ઇનબૉક્સ.", "Punjabi": "ਇੱਕ ਪੇਸ਼ੇਵਰ ਇਨਬਾਕਸ।",
        "Malayalam": "ഒരു പ്രൊഫഷണൽ ഇൻബോക്സ്.", "Odia": "ଗୋଟିଏ ବୃତ୍ତିଗତ ଇନବକ୍ସ।"
    },
    "pillar.operating-system.rotating": {
        "English": "an operating system.", "Hindi": "एक ऑपरेटिंग सिस्टम।", "Kannada": "ಒಂದು ಆಪರೇಟಿಂಗ್ ಸಿಸ್ಟಮ್.",
        "Tamil": "ஒரு இயக்க அமைப்பு.", "Telugu": "ఒక ఆపరేటింగ్ సిస్టమ్.", "Marathi": "एक ऑपरेटिंग सिस्टम.",
        "Bengali": "একটি অপারেটিং সিস্টেম।", "Gujarati": "એક ઓપરેટિંગ સિસ્ટમ.", "Punjabi": "ਇੱਕ ਆਪਰੇਟਿੰਗ ਸਿਸਟਮ।",
        "Malayalam": "ഒരു ഓപ്പറേറ്റിംഗ് സിസ്റ്റം.", "Odia": "ଗୋଟିଏ ଅପରେଟିଂ ସିଷ୍ଟମ୍।"
    },

    // Quote
    "quote.lakshmi.body": {
        "English": "“I knew what to teach but couldn't write it in English reports. Now I just speak in Kannada, and it creates the plan for me.”",
        "Hindi": "“मुझे पता था क्या पढ़ाना है पर अंग्रेज़ी रिपोर्ट नहीं लिख पाती थी। अब मैं बस कन्नड़ में बोलती हूँ, और यह मेरे लिए योजना बना देता है।”",
        "Kannada": "“ನಾನು ಏನು ಕಲಿಸಬೇಕೆಂದು ತಿಳಿದಿತ್ತು ಆದರೆ ಇಂಗ್ಲಿಷ್ ವರದಿಗಳಲ್ಲಿ ಬರೆಯಲು ಸಾಧ್ಯವಾಗುತ್ತಿರಲಿಲ್ಲ. ಈಗ ನಾನು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತೇನೆ, ಮತ್ತು ಅದು ನನಗಾಗಿ ಯೋಜನೆ ರಚಿಸುತ್ತದೆ.”",
        "Tamil": "“என்ன கற்பிக்க வேண்டும் என்று எனக்குத் தெரியும் ஆனால் ஆங்கில அறிக்கைகளில் எழுத முடியவில்லை. இப்போது நான் கன்னடத்தில் பேசுகிறேன், அது எனக்காக திட்டத்தை உருவாக்குகிறது.”",
        "Telugu": "“ఏం బోధించాలో నాకు తెలుసు కానీ ఇంగ్లీషు నివేదికలలో రాయలేకపోయాను. ఇప్పుడు నేను కన్నడలో మాట్లాడతాను, అది నా కోసం ప్రణాళిక తయారు చేస్తుంది.”",
        "Marathi": "“काय शिकवायचे ते मला माहीत होते पण इंग्रजी अहवालात लिहू शकत नव्हते. आता मी फक्त कन्नडमध्ये बोलते, आणि ते माझ्यासाठी योजना तयार करते.”",
        "Bengali": "“আমি জানতাম কী পড়াতে হবে কিন্তু ইংরেজি প্রতিবেদনে লিখতে পারতাম না। এখন আমি কন্নড়ে বলি, এবং এটি আমার জন্য পরিকল্পনা তৈরি করে।”",
        "Gujarati": "“મને શું ભણાવવું તે ખબર હતી પણ અંગ્રેજી અહેવાલોમાં લખી શકતી નહોતી. હવે હું બસ કન્નડમાં બોલું છું, અને તે મારા માટે યોજના બનાવે છે.”",
        "Punjabi": "“ਮੈਨੂੰ ਪਤਾ ਸੀ ਕੀ ਪੜ੍ਹਾਉਣਾ ਹੈ ਪਰ ਅੰਗਰੇਜ਼ੀ ਰਿਪੋਰਟਾਂ ਵਿੱਚ ਨਹੀਂ ਲਿਖ ਸਕਦੀ ਸੀ। ਹੁਣ ਮੈਂ ਬਸ ਕੰਨੜ ਵਿੱਚ ਬੋਲਦੀ ਹਾਂ, ਅਤੇ ਇਹ ਮੇਰੇ ਲਈ ਯੋਜਨਾ ਬਣਾਉਂਦਾ ਹੈ।”",
        "Malayalam": "“എന്ത് പഠിപ്പിക്കണമെന്ന് എനിക്കറിയാമായിരുന്നു പക്ഷേ ഇംഗ്ലീഷ് റിപ്പോർട്ടുകളിൽ എഴുതാൻ കഴിഞ്ഞില്ല. ഇപ്പോൾ ഞാൻ കന്നഡയിൽ സംസാരിക്കുന്നു, അത് എനിക്ക് വേണ്ടി പദ്ധതി സൃഷ്ടിക്കുന്നു.”",
        "Odia": "“ମୁଁ ଜାଣିଥିଲି କ’ଣ ପଢ଼ାଇବାକୁ କିନ୍ତୁ ଇଂରାଜୀ ରିପୋର୍ଟରେ ଲେଖିପାରୁନଥିଲି। ଏବେ ମୁଁ କେବଳ କନ୍ନଡରେ କହେ, ଏବଂ ଏହା ମୋ ପାଇଁ ଯୋଜନା ତିଆରି କରେ।”"
    },
    "quote.lakshmi.attribution": {
        "English": "— Lakshmi, Teacher, Raichur District",
        "Hindi": "— लक्ष्मी, शिक्षक, रायचूर ज़िला",
        "Kannada": "— ಲಕ್ಷ್ಮೀ, ಶಿಕ್ಷಕಿ, ರಾಯಚೂರು ಜಿಲ್ಲೆ",
        "Tamil": "— லக்ஷ்மி, ஆசிரியை, ரைச்சூர் மாவட்டம்",
        "Telugu": "— లక్ష్మి, ఉపాధ్యాయురాలు, రాయచూర్ జిల్లా",
        "Marathi": "— लक्ष्मी, शिक्षिका, रायचूर जिल्हा",
        "Bengali": "— লক্ষ্মী, শিক্ষিকা, রায়চুর জেলা",
        "Gujarati": "— લક્ષ્મી, શિક્ષિકા, રાયચૂર જિલ્લો",
        "Punjabi": "— ਲਕਸ਼ਮੀ, ਅਧਿਆਪਕਾ, ਰਾਏਚੂਰ ਜ਼ਿਲ੍ਹਾ",
        "Malayalam": "— ലക്ഷ്മി, അധ്യാപിക, റായ്ച്ചൂർ ജില്ല",
        "Odia": "— ଲକ୍ଷ୍ମୀ, ଶିକ୍ଷୟିତ୍ରୀ, ରାୟଚୂର ଜିଲ୍ଲା"
    },

    // Footer
    "footer.tagline": {
        "English": "The Operating System for Teaching in India. A product of SARGVISION Intelligence.",
        "Hindi": "भारत में शिक्षण के लिए ऑपरेटिंग सिस्टम। SARGVISION Intelligence का एक उत्पाद।",
        "Kannada": "ಭಾರತದಲ್ಲಿ ಬೋಧನೆಗಾಗಿ ಆಪರೇಟಿಂಗ್ ಸಿಸ್ಟಮ್. SARGVISION Intelligence ನ ಉತ್ಪನ್ನ.",
        "Tamil": "இந்தியாவில் கற்பித்தலுக்கான இயக்க அமைப்பு. SARGVISION Intelligence இன் தயாரிப்பு.",
        "Telugu": "భారతదేశంలో బోధనకు ఆపరేటింగ్ సిస్టమ్. SARGVISION Intelligence ఉత్పత్తి.",
        "Marathi": "भारतात शिक्षणासाठीचे ऑपरेटिंग सिस्टम. SARGVISION Intelligence चे एक उत्पादन.",
        "Bengali": "ভারতে শিক্ষাদানের জন্য অপারেটিং সিস্টেম। SARGVISION Intelligence এর একটি পণ্য।",
        "Gujarati": "ભારતમાં શિક્ષણ માટેનું ઓપરેટિંગ સિસ્ટમ. SARGVISION Intelligence નું ઉત્પાદન.",
        "Punjabi": "ਭਾਰਤ ਵਿੱਚ ਸਿਖਾਉਣ ਲਈ ਆਪਰੇਟਿੰਗ ਸਿਸਟਮ। SARGVISION Intelligence ਦਾ ਇੱਕ ਉਤਪਾਦ।",
        "Malayalam": "ഇന്ത്യയിൽ പഠിപ്പിക്കലിനുള്ള ഓപ്പറേറ്റിംഗ് സിസ്റ്റം. SARGVISION Intelligence ന്റെ ഉൽപ്പന്നം.",
        "Odia": "ଭାରତରେ ଶିକ୍ଷାଦାନ ପାଇଁ ଅପରେଟିଂ ସିଷ୍ଟମ୍। SARGVISION Intelligence ର ଏକ ଉତ୍ପାଦ।"
    },
    // "Community", "Privacy", "Terms", "Contact" already exist higher in
    // this file (lines 33 / 289 / earlier / 1196). Reusing those — do not
    // re-add or TypeScript will reject duplicate object keys.
    "Made in Bharat 🇮🇳": {
        "English": "Made in Bharat 🇮🇳", "Hindi": "भारत में बना 🇮🇳", "Kannada": "ಭಾರತದಲ್ಲಿ ತಯಾರಿಸಲಾಗಿದೆ 🇮🇳",
        "Tamil": "பாரதத்தில் தயாரிக்கப்பட்டது 🇮🇳", "Telugu": "భారత్‌లో తయారు 🇮🇳", "Marathi": "भारतात बनवले 🇮🇳",
        "Bengali": "ভারতে তৈরি 🇮🇳", "Gujarati": "ભારતમાં બનાવેલ 🇮🇳", "Punjabi": "ਭਾਰਤ ਵਿੱਚ ਬਣਾਇਆ 🇮🇳",
        "Malayalam": "ഭാരതത്തിൽ നിർമിച്ചത് 🇮🇳", "Odia": "ଭାରତରେ ନିର୍ମିତ 🇮🇳"
    },
    "footer.copyright": {
        "English": "© {year} SARGVISION Intelligence Pvt. Ltd. All rights reserved.",
        "Hindi": "© {year} SARGVISION Intelligence Pvt. Ltd. सर्वाधिकार सुरक्षित।",
        "Kannada": "© {year} SARGVISION Intelligence Pvt. Ltd. ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
        "Tamil": "© {year} SARGVISION Intelligence Pvt. Ltd. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
        "Telugu": "© {year} SARGVISION Intelligence Pvt. Ltd. అన్ని హక్కులు రిజర్వ్డ్.",
        "Marathi": "© {year} SARGVISION Intelligence Pvt. Ltd. सर्व हक्क राखीव.",
        "Bengali": "© {year} SARGVISION Intelligence Pvt. Ltd. সমস্ত অধিকার সংরক্ষিত।",
        "Gujarati": "© {year} SARGVISION Intelligence Pvt. Ltd. તમામ અધિકાર સુરક્ષિત.",
        "Punjabi": "© {year} SARGVISION Intelligence Pvt. Ltd. ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ।",
        "Malayalam": "© {year} SARGVISION Intelligence Pvt. Ltd. എല്ലാ അവകാശങ്ങളും സംരക്ഷിതം.",
        "Odia": "© {year} SARGVISION Intelligence Pvt. Ltd. ସମସ୍ତ ଅଧିକାର ସଂରକ୍ଷିତ।"
    },
    "footer.byline": {
        "English": "SahayakAI is a product of SARGVISION Intelligence.",
        "Hindi": "SahayakAI, SARGVISION Intelligence का उत्पाद है।",
        "Kannada": "SahayakAI ಎಂಬುದು SARGVISION Intelligence ನ ಉತ್ಪನ್ನವಾಗಿದೆ.",
        "Tamil": "SahayakAI என்பது SARGVISION Intelligence இன் தயாரிப்பு.",
        "Telugu": "SahayakAI అనేది SARGVISION Intelligence ఉత్పత్తి.",
        "Marathi": "SahayakAI हे SARGVISION Intelligence चे एक उत्पादन आहे.",
        "Bengali": "SahayakAI হলো SARGVISION Intelligence এর একটি পণ্য।",
        "Gujarati": "SahayakAI એ SARGVISION Intelligence નું ઉત્પાદન છે.",
        "Punjabi": "SahayakAI, SARGVISION Intelligence ਦਾ ਇੱਕ ਉਤਪਾਦ ਹੈ।",
        "Malayalam": "SahayakAI എന്നത് SARGVISION Intelligence ന്റെ ഒരു ഉൽപ്പന്നമാണ്.",
        "Odia": "SahayakAI ହେଉଛି SARGVISION Intelligence ର ଏକ ଉତ୍ପାଦ।"
    },
    "Enter Marks": {
        "English": "Enter Marks", "Hindi": "अंक दर्ज करें", "Kannada": "ಅಂಕಗಳನ್ನು ನಮೂದಿಸಿ", "Tamil": "மதிப்பெண்களை உள்ளிடவும்", "Telugu": "మార్కులు నమోదు చేయండి", "Marathi": "गुण प्रविष्ट करा", "Bengali": "নম্বর লিখুন", "Gujarati": "ગુણ દાખલ કરો", "Punjabi": "ਅੰਕ ਦਾਖਲ ਕਰੋ", "Malayalam": "മാർക്ക് നൽകുക", "Odia": "ନମ୍ବର ପ୍ରବେଶ କରନ୍ତୁ"
    },
    "Fill in assessment details and student marks": {
        "English": "Fill in assessment details and student marks", "Hindi": "मूल्यांकन विवरण और छात्र अंक भरें", "Kannada": "ಮೌಲ್ಯಮಾಪನ ವಿವರಗಳು ಮತ್ತು ವಿದ್ಯಾರ್ಥಿಗಳ ಅಂಕಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ", "Tamil": "மதிப்பீட்டு விவரங்கள் மற்றும் மாணவர் மதிப்பெண்களை நிரப்பவும்", "Telugu": "మూల్యాంకన వివరాలు మరియు విద్యార్థుల మార్కులను నింపండి", "Marathi": "मूल्यमापन तपशील आणि विद्यार्थ्यांचे गुण भरा", "Bengali": "মূল্যায়নের বিবরণ এবং শিক্ষার্থীদের নম্বর পূরণ করুন", "Gujarati": "મૂલ્યાંકન વિગતો અને વિદ્યાર્થી ગુણ ભરો", "Punjabi": "ਮੁਲਾਂਕਣ ਵੇਰਵੇ ਅਤੇ ਵਿਦਿਆਰਥੀ ਅੰਕ ਭਰੋ", "Malayalam": "മൂല്യനിർണ്ണയ വിശദാംശങ്ങളും വിദ്യാർഥി മാർക്കും പൂരിപ്പിക്കുക", "Odia": "ମୂଲ୍ୟାୟନ ବିବରଣୀ ଏବଂ ଛାତ୍ର ନମ୍ବର ପୂରଣ କରନ୍ତୁ"
    },
    "Assessment Details": {
        "English": "Assessment Details", "Hindi": "मूल्यांकन विवरण", "Kannada": "ಮೌಲ್ಯಮಾಪನ ವಿವರಗಳು", "Tamil": "மதிப்பீட்டு விவரங்கள்", "Telugu": "మూల్యాంకన వివరాలు", "Marathi": "मूल्यमापन तपशील", "Bengali": "মূল্যায়নের বিবরণ", "Gujarati": "મૂલ્યાંકન વિગતો", "Punjabi": "ਮੁਲਾਂਕਣ ਵੇਰਵੇ", "Malayalam": "മൂല്യനിർണ്ണയ വിശദാംശങ്ങൾ", "Odia": "ମୂଲ୍ୟାୟନ ବିବରଣୀ"
    },
    "Assessment Name": {
        "English": "Assessment Name", "Hindi": "मूल्यांकन का नाम", "Kannada": "ಮೌಲ್ಯಮಾಪನದ ಹೆಸರು", "Tamil": "மதிப்பீட்டின் பெயர்", "Telugu": "మూల్యాంకన పేరు", "Marathi": "मूल्यमापनाचे नाव", "Bengali": "মূল্যায়নের নাম", "Gujarati": "મૂલ્યાંકનનું નામ", "Punjabi": "ਮੁਲਾਂਕਣ ਦਾ ਨਾਮ", "Malayalam": "മൂല്യനിർണ്ണയത്തിന്റെ പേര്", "Odia": "ମୂଲ୍ୟାୟନର ନାମ"
    },
    "e.g. Unit Test 1 - Algebra": {
        "English": "e.g. Unit Test 1 - Algebra", "Hindi": "जैसे यूनिट टेस्ट 1 - बीजगणित", "Kannada": "ಉದಾ. ಯೂನಿಟ್ ಟೆಸ್ಟ್ 1 - ಬೀಜಗಣಿತ", "Tamil": "எ.கா. யூனிட் டெஸ்ட் 1 - இயற்கணிதம்", "Telugu": "ఉదా. యూనిట్ టెస్ట్ 1 - బీజగణితం", "Marathi": "उदा. युनिट टेस्ट 1 - बीजगणित", "Bengali": "যেমন ইউনিট টেস্ট ১ - বীজগণিত", "Gujarati": "દા.ત. યુનિટ ટેસ્ટ 1 - બીજગણિત", "Punjabi": "ਜਿਵੇਂ ਯੂਨਿਟ ਟੈਸਟ 1 - ਬੀਜਗਣਿਤ", "Malayalam": "ഉദാ. യൂണിറ്റ് ടെസ്റ്റ് 1 - ബീജഗണിതം", "Odia": "ଉଦାହରଣ: ୟୁନିଟ୍ ଟେଷ୍ଟ୍ 1 - ବୀଜଗଣିତ"
    },
    "Type": {
        "English": "Type", "Hindi": "प्रकार", "Kannada": "ಪ್ರಕಾರ", "Tamil": "வகை", "Telugu": "రకం", "Marathi": "प्रकार", "Bengali": "ধরন", "Gujarati": "પ્રકાર", "Punjabi": "ਕਿਸਮ", "Malayalam": "തരം", "Odia": "ପ୍ରକାର"
    },
    "Max Marks": {
        "English": "Max Marks", "Hindi": "अधिकतम अंक", "Kannada": "ಗರಿಷ್ಠ ಅಂಕಗಳು", "Tamil": "அதிகபட்ச மதிப்பெண்கள்", "Telugu": "గరిష్ట మార్కులు", "Marathi": "कमाल गुण", "Bengali": "সর্বোচ্চ নম্বর", "Gujarati": "મહત્તમ ગુણ", "Punjabi": "ਵੱਧ ਤੋਂ ਵੱਧ ਅੰਕ", "Malayalam": "പരമാവധി മാർക്ക്", "Odia": "ସର୍ବାଧିକ ନମ୍ବର"
    },
    "Term": {
        "English": "Term", "Hindi": "सत्र", "Kannada": "ಅವಧಿ", "Tamil": "பருவம்", "Telugu": "పదం", "Marathi": "सत्र", "Bengali": "মেয়াদ", "Gujarati": "સત્ર", "Punjabi": "ਸਮਾਂ", "Malayalam": "കാലയളവ്", "Odia": "ସମୟ"
    },
    "Date": {
        "English": "Date", "Hindi": "तारीख़", "Kannada": "ದಿನಾಂಕ", "Tamil": "தேதி", "Telugu": "తేదీ", "Marathi": "तारीख", "Bengali": "তারিখ", "Gujarati": "તારીખ", "Punjabi": "ਮਿਤੀ", "Malayalam": "തീയതി", "Odia": "ତାରିଖ"
    },
    "Academic Year": {
        "English": "Academic Year", "Hindi": "शैक्षणिक वर्ष", "Kannada": "ಶೈಕ್ಷಣಿಕ ವರ್ಷ", "Tamil": "கல்வி ஆண்டு", "Telugu": "విద్యా సంవత్సరం", "Marathi": "शैक्षणिक वर्ष", "Bengali": "শিক্ষাবর্ষ", "Gujarati": "શૈક્ષણિક વર્ષ", "Punjabi": "ਅਕਾਦਮਿਕ ਸਾਲ", "Malayalam": "അക്കാദമിക് വർഷം", "Odia": "ଶିକ୍ଷାବର୍ଷ"
    },
    "No students in this class": {
        "English": "No students in this class", "Hindi": "इस कक्षा में कोई छात्र नहीं", "Kannada": "ಈ ತರಗತಿಯಲ್ಲಿ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ", "Tamil": "இந்த வகுப்பில் மாணவர்கள் இல்லை", "Telugu": "ఈ తరగతిలో విద్యార్థులు లేరు", "Marathi": "या वर्गात कोणतेही विद्यार्थी नाहीत", "Bengali": "এই ক্লাসে কোনো শিক্ষার্থী নেই", "Gujarati": "આ વર્ગમાં કોઈ વિદ્યાર્થી નથી", "Punjabi": "ਇਸ ਜਮਾਤ ਵਿੱਚ ਕੋਈ ਵਿਦਿਆਰਥੀ ਨਹੀਂ", "Malayalam": "ഈ ക്ലാസിൽ വിദ്യാർഥികളില്ല", "Odia": "ଏହି ଶ୍ରେଣୀରେ କୌଣସି ଛାତ୍ର ନାହାନ୍ତି"
    },
    "Add students first from the class page.": {
        "English": "Add students first from the class page.", "Hindi": "पहले कक्षा पृष्ठ से छात्र जोड़ें।", "Kannada": "ಮೊದಲು ತರಗತಿ ಪುಟದಿಂದ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ.", "Tamil": "முதலில் வகுப்பு பக்கத்திலிருந்து மாணவர்களைச் சேர்க்கவும்.", "Telugu": "ముందుగా తరగతి పేజీ నుండి విద్యార్థులను జోడించండి.", "Marathi": "प्रथम वर्ग पृष्ठावरून विद्यार्थी जोडा.", "Bengali": "প্রথমে ক্লাস পৃষ্ঠা থেকে শিক্ষার্থী যোগ করুন।", "Gujarati": "પહેલા વર્ગ પેજ પરથી વિદ્યાર્થીઓ ઉમેરો.", "Punjabi": "ਪਹਿਲਾਂ ਜਮਾਤ ਪੰਨੇ ਤੋਂ ਵਿਦਿਆਰਥੀ ਜੋੜੋ।", "Malayalam": "ആദ്യം ക്ലാസ് പേജിൽ നിന്ന് വിദ്യാർഥികളെ ചേർക്കുക.", "Odia": "ପ୍ରଥମେ ଶ୍ରେଣୀ ପୃଷ୍ଠାରୁ ଛାତ୍ରମାନଙ୍କୁ ଯୋଡନ୍ତୁ।"
    },
    "Roll": {
        "English": "Roll", "Hindi": "रोल", "Kannada": "ರೋಲ್", "Tamil": "எண்", "Telugu": "నంబర్", "Marathi": "रोल", "Bengali": "রোল", "Gujarati": "રોલ", "Punjabi": "ਰੋਲ", "Malayalam": "റോൾ", "Odia": "ରୋଲ"
    },
    "Name": {
        "English": "Name", "Hindi": "नाम", "Kannada": "ಹೆಸರು", "Tamil": "பெயர்", "Telugu": "పేరు", "Marathi": "नाव", "Bengali": "নাম", "Gujarati": "નામ", "Punjabi": "ਨਾਮ", "Malayalam": "പേര്", "Odia": "ନାମ"
    },
    "Marks": {
        "English": "Marks", "Hindi": "अंक", "Kannada": "ಅಂಕಗಳು", "Tamil": "மதிப்பெண்கள்", "Telugu": "మార్కులు", "Marathi": "गुण", "Bengali": "নম্বর", "Gujarati": "ગુણ", "Punjabi": "ਅੰਕ", "Malayalam": "മാർക്ക്", "Odia": "ନମ୍ବର"
    },
    "Grade": {
        "English": "Grade", "Hindi": "ग्रेड", "Kannada": "ಗ್ರೇಡ್", "Tamil": "தரம்", "Telugu": "గ్రేడ్", "Marathi": "श्रेणी", "Bengali": "গ্রেড", "Gujarati": "ગ્રેડ", "Punjabi": "ਗ੍ਰੇਡ", "Malayalam": "ഗ്രേഡ്", "Odia": "ଗ୍ରେଡ୍"
    },
    "Remarks": {
        "English": "Remarks", "Hindi": "टिप्पणी", "Kannada": "ಟಿಪ್ಪಣಿಗಳು", "Tamil": "குறிப்புகள்", "Telugu": "వ్యాఖ్యలు", "Marathi": "टिप्पण्या", "Bengali": "মন্তব্য", "Gujarati": "ટિપ્પણીઓ", "Punjabi": "ਟਿੱਪਣੀਆਂ", "Malayalam": "അഭിപ്രായങ്ങൾ", "Odia": "ମନ୍ତବ୍ୟ"
    },
    "Optional": {
        "English": "Optional", "Hindi": "वैकल्पिक", "Kannada": "ಐಚ್ಛಿಕ", "Tamil": "விருப்பப்படி", "Telugu": "ఐచ్ఛికం", "Marathi": "ऐच्छिक", "Bengali": "ঐচ্ছিক", "Gujarati": "વૈકલ્પિક", "Punjabi": "ਵਿਕਲਪਿਕ", "Malayalam": "ഓപ്ഷണൽ", "Odia": "ବିକଳ୍ପ"
    },
    "Save Marks": {
        "English": "Save Marks", "Hindi": "अंक सहेजें", "Kannada": "ಅಂಕಗಳನ್ನು ಉಳಿಸಿ", "Tamil": "மதிப்பெண்களைச் சேமி", "Telugu": "మార్కులు సేవ్ చేయండి", "Marathi": "गुण जतन करा", "Bengali": "নম্বর সংরক্ষণ করুন", "Gujarati": "ગુણ સાચવો", "Punjabi": "ਅੰਕ ਸੰਭਾਲੋ", "Malayalam": "മാർക്ക് സേവ് ചെയ്യുക", "Odia": "ନମ୍ବର ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    // === i18n Wave 0: 92 missing dictionary entries (assessment-scanner, attendance triage, teacher-training, app-sidebar, profile, pricing, exam-paper) ===
    "1 question is uncertain. Please verify.": {
        "English": "1 question is uncertain. Please verify.", "Hindi": "1 प्रश्न अनिश्चित है। कृपया सत्यापित करें।", "Kannada": "1 ಪ್ರಶ್ನೆ ಅನಿಶ್ಚಿತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ.", "Tamil": "1 கேள்வி உறுதியற்றது. சரிபார்க்கவும்.", "Telugu": "1 ప్రశ్న అనిశ్చితంగా ఉంది. దయచేసి ధృవీకరించండి.", "Marathi": "1 प्रश्न अनिश्चित आहे. कृपया पडताळणी करा.", "Bengali": "1টি প্রশ্ন অনিশ্চিত। অনুগ্রহ করে যাচাই করুন।", "Gujarati": "1 પ્રશ્ન અનિશ્ચિત છે. કૃપા કરી ચકાસો.", "Punjabi": "1 ਸਵਾਲ ਅਨਿਸ਼ਚਿਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਜਾਂਚ ਕਰੋ।", "Malayalam": "1 ചോദ്യം അനിശ്ചിതമാണ്. ദയവായി പരിശോധിക്കുക.", "Odia": "1ଟି ପ୍ରଶ୍ନ ଅନିଶ୍ଚିତ। ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "Add up to": {
        "English": "Add up to", "Hindi": "अधिकतम जोड़ें", "Kannada": "ಗರಿಷ್ಠ ಸೇರಿಸಿ", "Tamil": "அதிகபட்சம் சேர்க்கவும்", "Telugu": "గరిష్టంగా జోడించండి", "Marathi": "जास्तीत जास्त जोडा", "Bengali": "সর্বাধিক যোগ করুন", "Gujarati": "મહત્તમ ઉમેરો", "Punjabi": "ਵੱਧ ਤੋਂ ਵੱਧ ਜੋੜੋ", "Malayalam": "പരമാവധി ചേർക്കുക", "Odia": "ସର୍ବାଧିକ ଯୋଗ କରନ୍ତୁ"
    },
    "At-risk academically": {
        "English": "At-risk academically", "Hindi": "शैक्षणिक रूप से जोखिम में", "Kannada": "ಶೈಕ್ಷಣಿಕವಾಗಿ ಅಪಾಯದಲ್ಲಿ", "Tamil": "கல்வியில் ஆபத்தில்", "Telugu": "విద్యాపరంగా ప్రమాదంలో", "Marathi": "शैक्षणिकदृष्ट्या जोखमीत", "Bengali": "শিক্ষাগতভাবে ঝুঁকিতে", "Gujarati": "શૈક્ષણિક રીતે જોખમમાં", "Punjabi": "ਅਕਾਦਮਿਕ ਤੌਰ 'ਤੇ ਜੋਖਮ ਵਿੱਚ", "Malayalam": "അക്കാദമികമായി അപകടത്തിൽ", "Odia": "ଶିକ୍ଷାଗତ ଭାବେ ବିପଦରେ"
    },
    "Behavioral concern": {
        "English": "Behavioral concern", "Hindi": "व्यवहार संबंधी चिंता", "Kannada": "ವರ್ತನೆಯ ಕಾಳಜಿ", "Tamil": "நடத்தை சார்ந்த கவலை", "Telugu": "ప్రవర్తనా ఆందోళన", "Marathi": "वर्तनासंबंधी चिंता", "Bengali": "আচরণগত উদ্বেগ", "Gujarati": "વર્તણૂક સંબંધી ચિંતા", "Punjabi": "ਵਿਹਾਰ ਸੰਬੰਧੀ ਚਿੰਤਾ", "Malayalam": "പെരുമാറ്റ പ്രശ്നം", "Odia": "ଆଚରଣଗତ ଚିନ୍ତା"
    },
    "Behavioral note": {
        "English": "Behavioral note", "Hindi": "व्यवहार टिप्पणी", "Kannada": "ವರ್ತನೆಯ ಟಿಪ್ಪಣಿ", "Tamil": "நடத்தை குறிப்பு", "Telugu": "ప్రవర్తనా గమనిక", "Marathi": "वर्तन नोंद", "Bengali": "আচরণগত নোট", "Gujarati": "વર્તણૂક નોંધ", "Punjabi": "ਵਿਹਾਰ ਨੋਟ", "Malayalam": "പെരുമാറ്റ കുറിപ്പ്", "Odia": "ଆଚରଣଗତ ଟିପ୍ପଣୀ"
    },
    "Best": {
        "English": "Best", "Hindi": "सर्वश्रेष्ठ", "Kannada": "ಅತ್ಯುತ್ತಮ", "Tamil": "சிறந்தது", "Telugu": "అత్యుత్తమం", "Marathi": "सर्वोत्तम", "Bengali": "সেরা", "Gujarati": "શ્રેષ્ઠ", "Punjabi": "ਵਧੀਆ", "Malayalam": "മികച്ചത്", "Odia": "ସର୍ବୋତ୍ତମ"
    },
    "Best way to introduce a new": {
        "English": "Best way to introduce a new", "Hindi": "नया परिचय देने का सबसे अच्छा तरीका", "Kannada": "ಹೊಸದನ್ನು ಪರಿಚಯಿಸುವ ಅತ್ಯುತ್ತಮ ಮಾರ್ಗ", "Tamil": "புதியதை அறிமுகப்படுத்த சிறந்த வழி", "Telugu": "కొత్తదాన్ని పరిచయం చేయడానికి ఉత్తమ మార్గం", "Marathi": "नवीन ओळख करून देण्याचा सर्वोत्तम मार्ग", "Bengali": "নতুন কিছু পরিচয় করানোর সেরা উপায়", "Gujarati": "નવું રજૂ કરવાનો શ્રેષ્ઠ રસ્તો", "Punjabi": "ਨਵੇਂ ਨੂੰ ਪੇਸ਼ ਕਰਨ ਦਾ ਵਧੀਆ ਤਰੀਕਾ", "Malayalam": "പുതിയത് അവതരിപ്പിക്കാനുള്ള മികച്ച വഴി", "Odia": "ନୂତନ ପରିଚୟ କରାଇବାର ସର୍ବୋତ୍ତମ ଉପାୟ"
    },
    "Best-in-class": {
        "English": "Best-in-class", "Hindi": "अपनी श्रेणी में सर्वश्रेष्ठ", "Kannada": "ತರಗತಿಯಲ್ಲಿ ಅತ್ಯುತ್ತಮ", "Tamil": "வகுப்பில் சிறந்தது", "Telugu": "తరగతిలో అత్యుత్తమం", "Marathi": "वर्गातील सर्वोत्तम", "Bengali": "ক্লাসে সেরা", "Gujarati": "ક્લાસમાં શ્રેષ્ઠ", "Punjabi": "ਕਲਾਸ ਵਿੱਚ ਵਧੀਆ", "Malayalam": "ക്ലാസിലെ മികച്ചത്", "Odia": "ଶ୍ରେଣୀରେ ସର୍ବୋତ୍ତମ"
    },
    "Cancel": {
        "English": "Cancel", "Hindi": "रद्द करें", "Kannada": "ರದ್ದುಗೊಳಿಸಿ", "Tamil": "ரத்து செய்", "Telugu": "రద్దు చేయి", "Marathi": "रद्द करा", "Bengali": "বাতিল করুন", "Gujarati": "રદ કરો", "Punjabi": "ਰੱਦ ਕਰੋ", "Malayalam": "റദ്ദാക്കുക", "Odia": "ବାତିଲ୍ କରନ୍ତୁ"
    },
    "Celebrate": {
        "English": "Celebrate", "Hindi": "मनाएं", "Kannada": "ಸಂಭ್ರಮಿಸಿ", "Tamil": "கொண்டாடு", "Telugu": "జరుపుకోండి", "Marathi": "साजरा करा", "Bengali": "উদযাপন করুন", "Gujarati": "ઉજવણી કરો", "Punjabi": "ਜਸ਼ਨ ਮਨਾਓ", "Malayalam": "ആഘോഷിക്കുക", "Odia": "ଉତ୍ସବ ପାଳନ କରନ୍ତୁ"
    },
    "Class": {
        "English": "Class", "Hindi": "कक्षा", "Kannada": "ತರಗತಿ", "Tamil": "வகுப்பு", "Telugu": "తరగతి", "Marathi": "वर्ग", "Bengali": "শ্রেণি", "Gujarati": "વર્ગ", "Punjabi": "ਜਮਾਤ", "Malayalam": "ക്ലാസ്", "Odia": "ଶ୍ରେଣୀ"
    },
    "Common": {
        "English": "Common", "Hindi": "सामान्य", "Kannada": "ಸಾಮಾನ್ಯ", "Tamil": "பொதுவான", "Telugu": "సాధారణ", "Marathi": "सामान्य", "Bengali": "সাধারণ", "Gujarati": "સામાન્ય", "Punjabi": "ਆਮ", "Malayalam": "സാധാരണ", "Odia": "ସାଧାରଣ"
    },
    "Consecutive absences": {
        "English": "Consecutive absences", "Hindi": "लगातार अनुपस्थिति", "Kannada": "ಸತತ ಗೈರುಹಾಜರಿ", "Tamil": "தொடர்ச்சியான வராமை", "Telugu": "వరుస గైర్హాజరు", "Marathi": "सलग गैरहजेरी", "Bengali": "ক্রমাগত অনুপস্থিতি", "Gujarati": "સતત ગેરહાજરી", "Punjabi": "ਲਗਾਤਾਰ ਗੈਰ-ਹਾਜ਼ਰੀ", "Malayalam": "തുടർച്ചയായ അസാന്നിധ്യം", "Odia": "କ୍ରମାଗତ ଅନୁପସ୍ଥିତି"
    },
    "Copied": {
        "English": "Copied", "Hindi": "कॉपी हो गया", "Kannada": "ನಕಲಿಸಲಾಗಿದೆ", "Tamil": "நகலெடுக்கப்பட்டது", "Telugu": "కాపీ చేయబడింది", "Marathi": "कॉपी केले", "Bengali": "কপি হয়েছে", "Gujarati": "કૉપિ થયું", "Punjabi": "ਕਾਪੀ ਹੋ ਗਿਆ", "Malayalam": "പകർത്തി", "Odia": "କପି ହୋଇଛି"
    },
    "Copy": {
        "English": "Copy", "Hindi": "कॉपी करें", "Kannada": "ನಕಲಿಸಿ", "Tamil": "நகலெடு", "Telugu": "కాపీ చేయండి", "Marathi": "कॉपी करा", "Bengali": "কপি করুন", "Gujarati": "કૉપિ કરો", "Punjabi": "ਕਾਪੀ ਕਰੋ", "Malayalam": "പകർത്തുക", "Odia": "କପି କରନ୍ତୁ"
    },
    "Copy failed": {
        "English": "Copy failed", "Hindi": "कॉपी विफल", "Kannada": "ನಕಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "நகலெடுக்க முடியவில்லை", "Telugu": "కాపీ విఫలమైంది", "Marathi": "कॉपी अयशस्वी", "Bengali": "কপি ব্যর্থ", "Gujarati": "કૉપિ નિષ્ફળ", "Punjabi": "ਕਾਪੀ ਅਸਫਲ", "Malayalam": "പകർത്തൽ പരാജയപ്പെട്ടു", "Odia": "କପି ବିଫଳ"
    },
    "Copy summary": {
        "English": "Copy summary", "Hindi": "सारांश कॉपी करें", "Kannada": "ಸಾರಾಂಶವನ್ನು ನಕಲಿಸಿ", "Tamil": "சுருக்கத்தை நகலெடு", "Telugu": "సారాంశాన్ని కాపీ చేయండి", "Marathi": "सारांश कॉपी करा", "Bengali": "সারসংক্ষেপ কপি করুন", "Gujarati": "સારાંશ કૉપિ કરો", "Punjabi": "ਸਾਰਾਂਸ਼ ਕਾਪੀ ਕਰੋ", "Malayalam": "സംഗ്രഹം പകർത്തുക", "Odia": "ସାରାଂଶ କପି କରନ୍ତୁ"
    },
    "Could not open assessment": {
        "English": "Could not open assessment", "Hindi": "मूल्यांकन नहीं खुल सका", "Kannada": "ಮೌಲ್ಯಮಾಪನವನ್ನು ತೆರೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "மதிப்பீட்டைத் திறக்க முடியவில்லை", "Telugu": "మూల్యాంకనాన్ని తెరవలేకపోయాము", "Marathi": "मूल्यांकन उघडता आले नाही", "Bengali": "মূল্যায়ন খোলা যায়নি", "Gujarati": "મૂલ્યાંકન ખોલી શકાયું નહીં", "Punjabi": "ਮੁਲਾਂਕਣ ਨਹੀਂ ਖੁੱਲ੍ਹ ਸਕਿਆ", "Malayalam": "വിലയിരുത്തൽ തുറക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ମୂଲ୍ୟାୟନ ଖୋଲିହେଲା ନାହିଁ"
    },
    "Edit": {
        "English": "Edit", "Hindi": "संपादित करें", "Kannada": "ಸಂಪಾದಿಸಿ", "Tamil": "திருத்து", "Telugu": "సవరించు", "Marathi": "संपादित करा", "Bengali": "সম্পাদনা করুন", "Gujarati": "સંપાદિત કરો", "Punjabi": "ਸੰਪਾਦਿਤ ਕਰੋ", "Malayalam": "എഡിറ്റ് ചെയ്യുക", "Odia": "ସମ୍ପାଦନ କରନ୍ତୁ"
    },
    "Edit Profile": {
        "English": "Edit Profile", "Hindi": "प्रोफ़ाइल संपादित करें", "Kannada": "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ", "Tamil": "சுயவிவரத்தைத் திருத்து", "Telugu": "ప్రొఫైల్ సవరించు", "Marathi": "प्रोफाइल संपादित करा", "Bengali": "প্রোফাইল সম্পাদনা করুন", "Gujarati": "પ્રોફાઇલ સંપાદિત કરો", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਸੰਪਾਦਿਤ ਕਰੋ", "Malayalam": "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക", "Odia": "ପ୍ରୋଫାଇଲ୍ ସମ୍ପାଦନ କରନ୍ତୁ"
    },
    "Edited": {
        "English": "Edited", "Hindi": "संपादित", "Kannada": "ಸಂಪಾದಿಸಲಾಗಿದೆ", "Tamil": "திருத்தப்பட்டது", "Telugu": "సవరించబడింది", "Marathi": "संपादित केले", "Bengali": "সম্পাদিত", "Gujarati": "સંપાદિત", "Punjabi": "ਸੰਪਾਦਿਤ", "Malayalam": "എഡിറ്റ് ചെയ്തു", "Odia": "ସମ୍ପାଦିତ"
    },
    "Edited by you": {
        "English": "Edited by you", "Hindi": "आपके द्वारा संपादित", "Kannada": "ನಿಮ್ಮಿಂದ ಸಂಪಾದಿಸಲಾಗಿದೆ", "Tamil": "உங்களால் திருத்தப்பட்டது", "Telugu": "మీచే సవరించబడింది", "Marathi": "तुमच्याद्वारे संपादित", "Bengali": "আপনার দ্বারা সম্পাদিত", "Gujarati": "તમારા દ્વારા સંપાદિત", "Punjabi": "ਤੁਹਾਡੇ ਦੁਆਰਾ ਸੰਪਾਦਿਤ", "Malayalam": "നിങ്ങൾ എഡിറ്റ് ചെയ്തു", "Odia": "ଆପଣଙ୍କ ଦ୍ୱାରା ସମ୍ପାଦିତ"
    },
    "Encouraging note for the student.": {
        "English": "Encouraging note for the student.", "Hindi": "छात्र के लिए प्रोत्साहन भरी टिप्पणी।", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗೆ ಪ್ರೋತ್ಸಾಹದಾಯಕ ಟಿಪ್ಪಣಿ.", "Tamil": "மாணவருக்கு ஊக்கமளிக்கும் குறிப்பு.", "Telugu": "విద్యార్థికి ప్రోత్సాహకరమైన గమనిక.", "Marathi": "विद्यार्थ्यासाठी प्रोत्साहनपर टिप्पणी.", "Bengali": "ছাত্রের জন্য উৎসাহজনক নোট।", "Gujarati": "વિદ્યાર્થી માટે પ્રોત્સાહક નોંધ.", "Punjabi": "ਵਿਦਿਆਰਥੀ ਲਈ ਉਤਸ਼ਾਹਜਨਕ ਨੋਟ।", "Malayalam": "വിദ്യാർത്ഥിക്ക് പ്രോത്സാഹനപരമായ കുറിപ്പ്.", "Odia": "ଛାତ୍ର ପାଇଁ ଉତ୍ସାହଜନକ ଟିପ୍ପଣୀ।"
    },
    "Expected": {
        "English": "Expected", "Hindi": "अपेक्षित", "Kannada": "ನಿರೀಕ್ಷಿತ", "Tamil": "எதிர்பார்க்கப்பட்டது", "Telugu": "ఆశించబడింది", "Marathi": "अपेक्षित", "Bengali": "প্রত্যাশিত", "Gujarati": "અપેક્ષિત", "Punjabi": "ਉਮੀਦ ਅਨੁਸਾਰ", "Malayalam": "പ്രതീക്ഷിച്ചത്", "Odia": "ଆଶା କରାଯାଇଥିଲା"
    },
    "Failed to grade assessment": {
        "English": "Failed to grade assessment", "Hindi": "मूल्यांकन का मूल्यांकन विफल", "Kannada": "ಮೌಲ್ಯಮಾಪನ ಶ್ರೇಣೀಕರಣ ವಿಫಲವಾಗಿದೆ", "Tamil": "மதிப்பீட்டை மதிப்பிட முடியவில்லை", "Telugu": "మూల్యాంకన గ్రేడింగ్ విఫలమైంది", "Marathi": "मूल्यांकन तपासणी अयशस्वी", "Bengali": "মূল্যায়ন গ্রেড করতে ব্যর্থ", "Gujarati": "મૂલ્યાંકન ગ્રેડ કરવામાં નિષ્ફળ", "Punjabi": "ਮੁਲਾਂਕਣ ਗ੍ਰੇਡ ਕਰਨ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "വിലയിരുത്തൽ ഗ്രേഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ମୂଲ୍ୟାୟନ ଗ୍ରେଡ୍ କରିବାରେ ବିଫଳ"
    },
    "Feedback": {
        "English": "Feedback", "Hindi": "प्रतिक्रिया", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ", "Tamil": "கருத்து", "Telugu": "ఫీడ్‌బ్యాక్", "Marathi": "अभिप्राय", "Bengali": "মতামত", "Gujarati": "પ્રતિસાદ", "Punjabi": "ਫੀਡਬੈਕ", "Malayalam": "ഫീഡ്‌ബാക്ക്", "Odia": "ମତାମତ"
    },
    "Feedback language": {
        "English": "Feedback language", "Hindi": "प्रतिक्रिया भाषा", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಭಾಷೆ", "Tamil": "கருத்து மொழி", "Telugu": "ఫీడ్‌బ్యాక్ భాష", "Marathi": "अभिप्राय भाषा", "Bengali": "মতামতের ভাষা", "Gujarati": "પ્રતિસાદ ભાષા", "Punjabi": "ਫੀਡਬੈਕ ਭਾਸ਼ਾ", "Malayalam": "ഫീഡ്‌ബാക്ക് ഭാഷ", "Odia": "ମତାମତ ଭାଷା"
    },
    "Fix any OCR error in what the student wrote.": {
        "English": "Fix any OCR error in what the student wrote.", "Hindi": "छात्र ने जो लिखा है उसमें किसी भी OCR त्रुटि को ठीक करें।", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಬರೆದದ್ದರಲ್ಲಿ ಯಾವುದೇ OCR ದೋಷವನ್ನು ಸರಿಪಡಿಸಿ.", "Tamil": "மாணவர் எழுதியதில் உள்ள OCR பிழைகளை சரிசெய்யவும்.", "Telugu": "విద్యార్థి రాసిన దానిలో ఏదైనా OCR లోపాన్ని సరిచేయండి.", "Marathi": "विद्यार्थ्याने जे लिहिले आहे त्यात कोणतीही OCR त्रुटी दुरुस्त करा.", "Bengali": "ছাত্র যা লিখেছে তাতে কোনো OCR ত্রুটি ঠিক করুন।", "Gujarati": "વિદ્યાર્થીએ જે લખ્યું છે તેમાં કોઈપણ OCR ભૂલ સુધારો.", "Punjabi": "ਵਿਦਿਆਰਥੀ ਨੇ ਜੋ ਲਿਖਿਆ ਹੈ ਉਸ ਵਿੱਚ ਕੋਈ ਵੀ OCR ਗਲਤੀ ਠੀਕ ਕਰੋ।", "Malayalam": "വിദ്യാർത്ഥി എഴുതിയതിലെ ഏതെങ്കിലും OCR പിശക് പരിഹരിക്കുക.", "Odia": "ଛାତ୍ର ଲେଖିଥିବା କୌଣସି OCR ତ୍ରୁଟି ସଠିକ୍ କରନ୍ତୁ।"
    },
    "For the student": {
        "English": "For the student", "Hindi": "छात्र के लिए", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಾಗಿ", "Tamil": "மாணவருக்கு", "Telugu": "విద్యార్థి కోసం", "Marathi": "विद्यार्थ्यासाठी", "Bengali": "ছাত্রের জন্য", "Gujarati": "વિદ્યાર્થી માટે", "Punjabi": "ਵਿਦਿਆਰਥੀ ਲਈ", "Malayalam": "വിദ്യാർത്ഥിക്ക്", "Odia": "ଛାତ୍ର ପାଇଁ"
    },
    "Generate": {
        "English": "Generate", "Hindi": "उत्पन्न करें", "Kannada": "ರಚಿಸಿ", "Tamil": "உருவாக்கு", "Telugu": "ఉత్పన్నం చేయి", "Marathi": "तयार करा", "Bengali": "তৈরি করুন", "Gujarati": "બનાવો", "Punjabi": "ਤਿਆਰ ਕਰੋ", "Malayalam": "സൃഷ്ടിക്കുക", "Odia": "ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Grade this page": {
        "English": "Grade this page", "Hindi": "इस पृष्ठ का मूल्यांकन करें", "Kannada": "ಈ ಪುಟವನ್ನು ಶ್ರೇಣೀಕರಿಸಿ", "Tamil": "இந்தப் பக்கத்தை மதிப்பிடு", "Telugu": "ఈ పేజీని గ్రేడ్ చేయండి", "Marathi": "हे पान तपासा", "Bengali": "এই পৃষ্ঠা গ্রেড করুন", "Gujarati": "આ પાનું ગ્રેડ કરો", "Punjabi": "ਇਸ ਪੰਨੇ ਨੂੰ ਗ੍ਰੇਡ ਕਰੋ", "Malayalam": "ഈ പേജ് ഗ്രേഡ് ചെയ്യുക", "Odia": "ଏହି ପୃଷ୍ଠାକୁ ଗ୍ରେଡ୍ କରନ୍ତୁ"
    },
    "Grading could not be completed.": {
        "English": "Grading could not be completed.", "Hindi": "मूल्यांकन पूरा नहीं हो सका।", "Kannada": "ಶ್ರೇಣೀಕರಣವನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "மதிப்பீட்டை முடிக்க முடியவில்லை.", "Telugu": "గ్రేడింగ్‌ను పూర్తి చేయలేకపోయాము.", "Marathi": "तपासणी पूर्ण होऊ शकली नाही.", "Bengali": "গ্রেডিং সম্পূর্ণ করা যায়নি।", "Gujarati": "ગ્રેડિંગ પૂર્ણ થઈ શકી નથી.", "Punjabi": "ਗ੍ਰੇਡਿੰਗ ਪੂਰੀ ਨਹੀਂ ਹੋ ਸਕੀ।", "Malayalam": "ഗ്രേഡിംഗ് പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല.", "Odia": "ଗ୍ରେଡିଂ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇପାରିଲା ନାହିଁ।"
    },
    "Grading...": {
        "English": "Grading...", "Hindi": "मूल्यांकन हो रहा है...", "Kannada": "ಶ್ರೇಣೀಕರಣ ನಡೆಯುತ್ತಿದೆ...", "Tamil": "மதிப்பீடு செய்யப்படுகிறது...", "Telugu": "గ్రేడింగ్ చేస్తోంది...", "Marathi": "तपासणी सुरू आहे...", "Bengali": "গ্রেডিং চলছে...", "Gujarati": "ગ્રેડિંગ થઈ રહ્યું છે...", "Punjabi": "ਗ੍ਰੇਡਿੰਗ ਹੋ ਰਹੀ ਹੈ...", "Malayalam": "ഗ്രേഡിംഗ് നടക്കുന്നു...", "Odia": "ଗ୍ରେଡିଂ ଚାଲିଛି..."
    },
    "How do I assess": {
        "English": "How do I assess", "Hindi": "मैं कैसे मूल्यांकन करूं", "Kannada": "ನಾನು ಹೇಗೆ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಿ", "Tamil": "எப்படி மதிப்பிடுவது", "Telugu": "నేను ఎలా అంచనా వేయాలి", "Marathi": "मी कसे मूल्यांकन करू", "Bengali": "আমি কীভাবে মূল্যায়ন করব", "Gujarati": "હું કેવી રીતે મૂલ્યાંકન કરું", "Punjabi": "ਮੈਂ ਕਿਵੇਂ ਮੁਲਾਂਕਣ ਕਰਾਂ", "Malayalam": "ഞാൻ എങ്ങനെ വിലയിരുത്തണം", "Odia": "ମୁଁ କିପରି ମୂଲ୍ୟାୟନ କରିବି"
    },
    "How do I keep": {
        "English": "How do I keep", "Hindi": "मैं कैसे रखूं", "Kannada": "ನಾನು ಹೇಗೆ ಇಡಲಿ", "Tamil": "எப்படி வைத்திருப்பது", "Telugu": "నేను ఎలా ఉంచాలి", "Marathi": "मी कसे ठेवू", "Bengali": "আমি কীভাবে রাখব", "Gujarati": "હું કેવી રીતે રાખું", "Punjabi": "ਮੈਂ ਕਿਵੇਂ ਰੱਖਾਂ", "Malayalam": "ഞാൻ എങ്ങനെ നിലനിർത്തണം", "Odia": "ମୁଁ କିପରି ରଖିବି"
    },
    "Image quality": {
        "English": "Image quality", "Hindi": "छवि गुणवत्ता", "Kannada": "ಚಿತ್ರ ಗುಣಮಟ್ಟ", "Tamil": "படத் தரம்", "Telugu": "చిత్ర నాణ్యత", "Marathi": "प्रतिमा गुणवत्ता", "Bengali": "চিত্রের মান", "Gujarati": "છબી ગુણવત્તા", "Punjabi": "ਚਿੱਤਰ ਗੁਣਵੱਤਾ", "Malayalam": "ചിത്ര നിലവാരം", "Odia": "ଚିତ୍ର ଗୁଣବତ୍ତା"
    },
    "Includes teacher edits": {
        "English": "Includes teacher edits", "Hindi": "शिक्षक के संपादन शामिल हैं", "Kannada": "ಶಿಕ್ಷಕರ ಸಂಪಾದನೆಗಳನ್ನು ಒಳಗೊಂಡಿದೆ", "Tamil": "ஆசிரியர் திருத்தங்களை உள்ளடக்கியது", "Telugu": "ఉపాధ్యాయుని సవరణలు చేర్చబడ్డాయి", "Marathi": "शिक्षक संपादने समाविष्ट", "Bengali": "শিক্ষকের সম্পাদনা সহ", "Gujarati": "શિક્ષક સંપાદનો સામેલ", "Punjabi": "ਅਧਿਆਪਕ ਸੰਪਾਦਨ ਸ਼ਾਮਲ", "Malayalam": "അധ്യാപകന്റെ എഡിറ്റുകൾ ഉൾപ്പെടുന്നു", "Odia": "ଶିକ୍ଷକଙ୍କ ସମ୍ପାଦନା ଅନ୍ତର୍ଭୁକ୍ତ"
    },
    "Jump to outreach triage": {
        "English": "Jump to outreach triage", "Hindi": "आउटरीच ट्राइएज पर जाएं", "Kannada": "ಔಟ್‌ರೀಚ್ ಟ್ರೈಯೇಜ್‌ಗೆ ತೆರಳಿ", "Tamil": "தொடர்பு வரிசைப்படுத்தலுக்குச் செல்", "Telugu": "ఔట్‌రీచ్ ట్రయేజ్‌కు వెళ్లండి", "Marathi": "आउटरीच ट्रायएजवर जा", "Bengali": "আউটরিচ ট্রায়েজে যান", "Gujarati": "આઉટરીચ ટ્રાયજ પર જાઓ", "Punjabi": "ਆਊਟਰੀਚ ਟ੍ਰਾਏਜ 'ਤੇ ਜਾਓ", "Malayalam": "ഔട്ട്റീച്ച് ട്രയാജിലേക്ക് പോകുക", "Odia": "ଆଉଟ୍‌ରିଚ୍ ଟ୍ରାୟେଜ୍‌କୁ ଯାଆନ୍ତୁ"
    },
    "Log Dashboard": {
        "English": "Log Dashboard", "Hindi": "लॉग डैशबोर्ड", "Kannada": "ಲಾಗ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "Tamil": "பதிவு டாஷ்போர்டு", "Telugu": "లాగ్ డ్యాష్‌బోర్డ్", "Marathi": "लॉग डॅशबोर्ड", "Bengali": "লগ ড্যাশবোর্ড", "Gujarati": "લોગ ડેશબોર્ડ", "Punjabi": "ਲਾਗ ਡੈਸ਼ਬੋਰਡ", "Malayalam": "ലോഗ് ഡാഷ്‌ബോർഡ്", "Odia": "ଲଗ୍ ଡ୍ୟାସବୋର୍ଡ"
    },
    "Marks breakdown": {
        "English": "Marks breakdown", "Hindi": "अंक विवरण", "Kannada": "ಅಂಕಗಳ ವಿಭಾಗ", "Tamil": "மதிப்பெண் பகுப்பு", "Telugu": "మార్కుల విభజన", "Marathi": "गुण विभागणी", "Bengali": "নম্বরের বিশ্লেষণ", "Gujarati": "ગુણ વિભાજન", "Punjabi": "ਅੰਕ ਵੇਰਵਾ", "Malayalam": "മാർക്ക് വിശകലനം", "Odia": "ନମ୍ବର ବିଭାଜନ"
    },
    "Mission Control": {
        "English": "Mission Control", "Hindi": "मिशन कंट्रोल", "Kannada": "ಮಿಷನ್ ಕಂಟ್ರೋಲ್", "Tamil": "மிஷன் கட்டுப்பாடு", "Telugu": "మిషన్ కంట్రోల్", "Marathi": "मिशन कंट्रोल", "Bengali": "মিশন কন্ট্রোল", "Gujarati": "મિશન કંટ્રોલ", "Punjabi": "ਮਿਸ਼ਨ ਕੰਟਰੋਲ", "Malayalam": "മിഷൻ കൺട്രോൾ", "Odia": "ମିଶନ୍ କଣ୍ଟ୍ରୋଲ୍"
    },
    "Needs outreach today": {
        "English": "Needs outreach today", "Hindi": "आज संपर्क की आवश्यकता", "Kannada": "ಇಂದು ಸಂಪರ್ಕದ ಅಗತ್ಯವಿದೆ", "Tamil": "இன்று தொடர்பு கொள்ள வேண்டும்", "Telugu": "ఈరోజు సంప్రదించాల్సిన అవసరం", "Marathi": "आज संपर्क आवश्यक", "Bengali": "আজ যোগাযোগ প্রয়োজন", "Gujarati": "આજે સંપર્કની જરૂર", "Punjabi": "ਅੱਜ ਸੰਪਰਕ ਦੀ ਲੋੜ", "Malayalam": "ഇന്ന് ബന്ധപ്പെടേണ്ടതുണ്ട്", "Odia": "ଆଜି ଯୋଗାଯୋଗ ଆବଶ୍ୟକ"
    },
    "Needs review": {
        "English": "Needs review", "Hindi": "समीक्षा की आवश्यकता है", "Kannada": "ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ", "Tamil": "மறுபரிசீலனை தேவை", "Telugu": "సమీక్ష అవసరం", "Marathi": "पुनरावलोकन आवश्यक", "Bengali": "পর্যালোচনা প্রয়োজন", "Gujarati": "સમીક્ષાની જરૂર", "Punjabi": "ਸਮੀਖਿਆ ਦੀ ਲੋੜ", "Malayalam": "അവലോകനം ആവശ്യം", "Odia": "ସମୀକ୍ଷା ଆବଶ୍ୟକ"
    },
    "Next steps for the teacher": {
        "English": "Next steps for the teacher", "Hindi": "शिक्षक के लिए अगले कदम", "Kannada": "ಶಿಕ್ಷಕರಿಗೆ ಮುಂದಿನ ಹಂತಗಳು", "Tamil": "ஆசிரியருக்கான அடுத்த படிகள்", "Telugu": "ఉపాధ్యాయునికి తదుపరి దశలు", "Marathi": "शिक्षकासाठी पुढील पावले", "Bengali": "শিক্ষকের জন্য পরবর্তী পদক্ষেপ", "Gujarati": "શિક્ષક માટે આગળના પગલાં", "Punjabi": "ਅਧਿਆਪਕ ਲਈ ਅਗਲੇ ਕਦਮ", "Malayalam": "അധ്യാപകന്റെ അടുത്ത ഘട്ടങ്ങൾ", "Odia": "ଶିକ୍ଷକଙ୍କ ପାଇଁ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ"
    },
    "Now supporting six subject families, up to 3 pages per scan": {
        "English": "Now supporting six subject families, up to 3 pages per scan", "Hindi": "अब छह विषय परिवारों का समर्थन, प्रति स्कैन 3 पृष्ठ तक", "Kannada": "ಈಗ ಆರು ವಿಷಯ ಕುಟುಂಬಗಳಿಗೆ ಬೆಂಬಲ, ಪ್ರತಿ ಸ್ಕ್ಯಾನ್‌ಗೆ 3 ಪುಟಗಳವರೆಗೆ", "Tamil": "இப்போது ஆறு பாடக் குடும்பங்களுக்கு ஆதரவு, ஒரு ஸ்கேனுக்கு 3 பக்கங்கள் வரை", "Telugu": "ఇప్పుడు ఆరు సబ్జెక్ట్ కుటుంబాలకు మద్దతు, ఒక్కో స్కాన్‌కు 3 పేజీల వరకు", "Marathi": "आता सहा विषय कुटुंबांना समर्थन, प्रति स्कॅन 3 पृष्ठांपर्यंत", "Bengali": "এখন ছয়টি বিষয় পরিবারকে সমর্থন, প্রতি স্ক্যানে 3 পৃষ্ঠা পর্যন্ত", "Gujarati": "હવે છ વિષય પરિવારોને સમર્થન, સ્કેન દીઠ 3 પાનાં સુધી", "Punjabi": "ਹੁਣ ਛੇ ਵਿਸ਼ਾ ਪਰਿਵਾਰਾਂ ਦਾ ਸਮਰਥਨ, ਪ੍ਰਤੀ ਸਕੈਨ 3 ਪੰਨਿਆਂ ਤੱਕ", "Malayalam": "ഇപ്പോൾ ആറ് വിഷയ കുടുംബങ്ങൾക്ക് പിന്തുണ, ഒരു സ്കാനിന് 3 പേജുകൾ വരെ", "Odia": "ବର୍ତ୍ତମାନ ଛଅଟି ବିଷୟ ପରିବାରକୁ ସମର୍ଥନ, ପ୍ରତି ସ୍କାନକୁ 3ଟି ପୃଷ୍ଠା ପର୍ଯ୍ୟନ୍ତ"
    },
    "Outreach": {
        "English": "Outreach", "Hindi": "संपर्क", "Kannada": "ಸಂಪರ್ಕ", "Tamil": "தொடர்பு", "Telugu": "ఔట్‌రీచ్", "Marathi": "संपर्क", "Bengali": "যোগাযোগ", "Gujarati": "આઉટરીચ", "Punjabi": "ਸੰਪਰਕ", "Malayalam": "ഔട്ട്റീച്ച്", "Odia": "ଯୋଗାଯୋଗ"
    },
    "Overall": {
        "English": "Overall", "Hindi": "कुल मिलाकर", "Kannada": "ಒಟ್ಟಾರೆ", "Tamil": "ஒட்டுமொத்தம்", "Telugu": "మొత్తం", "Marathi": "एकूण", "Bengali": "সামগ্রিক", "Gujarati": "એકંદર", "Punjabi": "ਕੁੱਲ ਮਿਲਾ ਕੇ", "Malayalam": "മൊത്തത്തിൽ", "Odia": "ସମୁଦାୟ"
    },
    "PDF failed": {
        "English": "PDF failed", "Hindi": "PDF विफल", "Kannada": "PDF ವಿಫಲವಾಗಿದೆ", "Tamil": "PDF தோல்வி", "Telugu": "PDF విఫలమైంది", "Marathi": "PDF अयशस्वी", "Bengali": "PDF ব্যর্থ", "Gujarati": "PDF નિષ્ફળ", "Punjabi": "PDF ਅਸਫਲ", "Malayalam": "PDF പരാജയപ്പെട്ടു", "Odia": "PDF ବିଫଳ"
    },
    "Page": {
        "English": "Page", "Hindi": "पृष्ठ", "Kannada": "ಪುಟ", "Tamil": "பக்கம்", "Telugu": "పేజీ", "Marathi": "पान", "Bengali": "পৃষ্ঠা", "Gujarati": "પાનું", "Punjabi": "ਪੰਨਾ", "Malayalam": "പേജ്", "Odia": "ପୃଷ୍ଠା"
    },
    "Parent summary copied to clipboard.": {
        "English": "Parent summary copied to clipboard.", "Hindi": "अभिभावक सारांश क्लिपबोर्ड पर कॉपी हो गया।", "Kannada": "ಪೋಷಕ ಸಾರಾಂಶವನ್ನು ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.", "Tamil": "பெற்றோர் சுருக்கம் கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது.", "Telugu": "తల్లిదండ్రుల సారాంశం క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది.", "Marathi": "पालक सारांश क्लिपबोर्डवर कॉपी केला.", "Bengali": "অভিভাবকের সারসংক্ষেপ ক্লিপবোর্ডে কপি করা হয়েছে।", "Gujarati": "વાલી સારાંશ ક્લિપબોર્ડ પર કૉપિ થયો.", "Punjabi": "ਮਾਪਿਆਂ ਦਾ ਸਾਰਾਂਸ਼ ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਹੋਇਆ।", "Malayalam": "രക്ഷിതാവിന്റെ സംഗ്രഹം ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി.", "Odia": "ଅଭିଭାବକ ସାରାଂଶ କ୍ଲିପବୋର୍ଡକୁ କପି ହୋଇଛି।"
    },
    "Pilot — review grades": {
        "English": "Pilot — review grades", "Hindi": "पायलट — ग्रेड समीक्षा करें", "Kannada": "ಪೈಲಟ್ — ಗ್ರೇಡ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ", "Tamil": "பைலட் — மதிப்பெண்களை மறுபரிசீலனை செய்", "Telugu": "పైలట్ — గ్రేడ్‌లను సమీక్షించండి", "Marathi": "पायलट — ग्रेडचे पुनरावलोकन करा", "Bengali": "পাইলট — গ্রেড পর্যালোচনা করুন", "Gujarati": "પાયલટ — ગ્રેડ સમીક્ષા કરો", "Punjabi": "ਪਾਇਲਟ — ਗ੍ਰੇਡਾਂ ਦੀ ਸਮੀਖਿਆ ਕਰੋ", "Malayalam": "പൈലറ്റ് — ഗ്രേഡുകൾ അവലോകനം ചെയ്യുക", "Odia": "ପାଇଲଟ୍ — ଗ୍ରେଡ୍ ସମୀକ୍ଷା କରନ୍ତୁ"
    },
    "Please sign in to grade assessments": {
        "English": "Please sign in to grade assessments", "Hindi": "मूल्यांकन के लिए कृपया साइन इन करें", "Kannada": "ಮೌಲ್ಯಮಾಪನಗಳನ್ನು ಶ್ರೇಣೀಕರಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "மதிப்பீடுகளை மதிப்பிட உள்நுழையவும்", "Telugu": "మూల్యాంకనాలను గ్రేడ్ చేయడానికి దయచేసి సైన్ ఇన్ చేయండి", "Marathi": "मूल्यांकनांचे ग्रेडिंग करण्यासाठी कृपया साइन इन करा", "Bengali": "মূল্যায়ন গ্রেড করতে অনুগ্রহ করে সাইন ইন করুন", "Gujarati": "મૂલ્યાંકન ગ્રેડ કરવા માટે કૃપા કરી સાઇન ઇન કરો", "Punjabi": "ਮੁਲਾਂਕਣ ਗ੍ਰੇਡ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "വിലയിരുത്തലുകൾ ഗ്രേഡ് ചെയ്യാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക", "Odia": "ମୂଲ୍ୟାୟନ ଗ୍ରେଡ୍ କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Please try again": {
        "English": "Please try again", "Hindi": "कृपया पुनः प्रयास करें", "Kannada": "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "Tamil": "மீண்டும் முயற்சிக்கவும்", "Telugu": "దయచేసి మళ్లీ ప్రయత్నించండి", "Marathi": "कृपया पुन्हा प्रयत्न करा", "Bengali": "অনুগ্রহ করে আবার চেষ্টা করুন", "Gujarati": "કૃપા કરી ફરી પ્રયાસ કરો", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ", "Malayalam": "ദയവായി വീണ്ടും ശ്രമിക്കുക", "Odia": "ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ"
    },
    "Please try again from My Library.": {
        "English": "Please try again from My Library.", "Hindi": "कृपया मेरी लाइब्रेरी से पुनः प्रयास करें।", "Kannada": "ದಯವಿಟ್ಟು ನನ್ನ ಲೈಬ್ರರಿಯಿಂದ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "என் நூலகத்திலிருந்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "దయచేసి నా లైబ్రరీ నుండి మళ్లీ ప్రయత్నించండి.", "Marathi": "कृपया माझ्या लायब्ररीतून पुन्हा प्रयत्न करा.", "Bengali": "অনুগ্রহ করে আমার লাইব্রেরি থেকে আবার চেষ্টা করুন।", "Gujarati": "કૃપા કરી મારી લાઈબ્રેરીમાંથી ફરી પ્રયાસ કરો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਤੋਂ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ദയവായി എന്റെ ലൈബ്രറിയിൽ നിന്ന് വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଦୟାକରି ମୋର ଲାଇବ୍ରେରୀରୁ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Preparing PDF…": {
        "English": "Preparing PDF…", "Hindi": "PDF तैयार हो रहा है…", "Kannada": "PDF ತಯಾರಾಗುತ್ತಿದೆ…", "Tamil": "PDF தயாராகிறது…", "Telugu": "PDF సిద్ధమవుతోంది…", "Marathi": "PDF तयार होत आहे…", "Bengali": "PDF প্রস্তুত হচ্ছে…", "Gujarati": "PDF તૈયાર થઈ રહ્યું છે…", "Punjabi": "PDF ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ…", "Malayalam": "PDF തയ്യാറാക്കുന്നു…", "Odia": "PDF ପ୍ରସ୍ତୁତ ହେଉଛି…"
    },
    "Print / PDF": {
        "English": "Print / PDF", "Hindi": "प्रिंट / PDF", "Kannada": "ಮುದ್ರಿಸಿ / PDF", "Tamil": "அச்சிடு / PDF", "Telugu": "ప్రింట్ / PDF", "Marathi": "प्रिंट / PDF", "Bengali": "প্রিন্ট / PDF", "Gujarati": "પ્રિન્ટ / PDF", "Punjabi": "ਪ੍ਰਿੰਟ / PDF", "Malayalam": "പ്രിന്റ് / PDF", "Odia": "ପ୍ରିଣ୍ଟ୍ / PDF"
    },
    "Quality": {
        "English": "Quality", "Hindi": "गुणवत्ता", "Kannada": "ಗುಣಮಟ್ಟ", "Tamil": "தரம்", "Telugu": "నాణ్యత", "Marathi": "गुणवत्ता", "Bengali": "গুণমান", "Gujarati": "ગુણવત્તા", "Punjabi": "ਗੁਣਵੱਤਾ", "Malayalam": "നിലവാരം", "Odia": "ଗୁଣବତ୍ତା"
    },
    "Remove page": {
        "English": "Remove page", "Hindi": "पृष्ठ हटाएं", "Kannada": "ಪುಟವನ್ನು ತೆಗೆದುಹಾಕಿ", "Tamil": "பக்கத்தை அகற்று", "Telugu": "పేజీని తీసివేయండి", "Marathi": "पान काढून टाका", "Bengali": "পৃষ্ঠা সরান", "Gujarati": "પાનું દૂર કરો", "Punjabi": "ਪੰਨਾ ਹਟਾਓ", "Malayalam": "പേജ് നീക്കം ചെയ്യുക", "Odia": "ପୃଷ୍ଠା ହଟାନ୍ତୁ"
    },
    "Revert to AI values": {
        "English": "Revert to AI values", "Hindi": "AI मानों पर वापस जाएं", "Kannada": "AI ಮೌಲ್ಯಗಳಿಗೆ ಹಿಂತಿರುಗಿ", "Tamil": "AI மதிப்புகளுக்குத் திரும்பு", "Telugu": "AI విలువలకు తిరిగి వెళ్లండి", "Marathi": "AI मूल्यांकडे परत जा", "Bengali": "AI মানগুলিতে ফিরে যান", "Gujarati": "AI મૂલ્યો પર પાછા જાઓ", "Punjabi": "AI ਮੁੱਲਾਂ 'ਤੇ ਵਾਪਸ ਜਾਓ", "Malayalam": "AI മൂല്യങ്ങളിലേക്ക് മടങ്ങുക", "Odia": "AI ମୂଲ୍ୟକୁ ଫେରନ୍ତୁ"
    },
    "Review the AI grades. Edit any score or feedback before sharing.": {
        "English": "Review the AI grades. Edit any score or feedback before sharing.", "Hindi": "AI ग्रेड की समीक्षा करें। साझा करने से पहले कोई भी स्कोर या प्रतिक्रिया संपादित करें।", "Kannada": "AI ಗ್ರೇಡ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಹಂಚಿಕೊಳ್ಳುವ ಮೊದಲು ಯಾವುದೇ ಸ್ಕೋರ್ ಅಥವಾ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಸಂಪಾದಿಸಿ.", "Tamil": "AI மதிப்பெண்களை மறுபரிசீலனை செய்யவும். பகிர்வதற்கு முன் எந்த மதிப்பெண்ணையும் கருத்தையும் திருத்தவும்.", "Telugu": "AI గ్రేడ్‌లను సమీక్షించండి. షేర్ చేసే ముందు ఏదైనా స్కోర్ లేదా ఫీడ్‌బ్యాక్‌ను సవరించండి.", "Marathi": "AI ग्रेडचे पुनरावलोकन करा. शेअर करण्यापूर्वी कोणतेही गुण किंवा अभिप्राय संपादित करा.", "Bengali": "AI গ্রেড পর্যালোচনা করুন। শেয়ার করার আগে যেকোনো স্কোর বা মতামত সম্পাদনা করুন।", "Gujarati": "AI ગ્રેડ સમીક્ષા કરો. શેર કરતા પહેલા કોઈપણ સ્કોર અથવા પ્રતિસાદ સંપાદિત કરો.", "Punjabi": "AI ਗ੍ਰੇਡਾਂ ਦੀ ਸਮੀਖਿਆ ਕਰੋ। ਸਾਂਝਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਕੋਈ ਵੀ ਸਕੋਰ ਜਾਂ ਫੀਡਬੈਕ ਸੰਪਾਦਿਤ ਕਰੋ।", "Malayalam": "AI ഗ്രേഡുകൾ അവലോകനം ചെയ്യുക. പങ്കിടുന്നതിന് മുമ്പ് ഏതെങ്കിലും സ്കോറോ ഫീഡ്‌ബാക്കോ എഡിറ്റ് ചെയ്യുക.", "Odia": "AI ଗ୍ରେଡ୍ ସମୀକ୍ଷା କରନ୍ତୁ। ସେୟାର କରିବା ପୂର୍ବରୁ କୌଣସି ସ୍କୋର କିମ୍ବା ମତାମତ ସମ୍ପାଦନ କରନ୍ତୁ।"
    },
    "Save": {
        "English": "Save", "Hindi": "सहेजें", "Kannada": "ಉಳಿಸಿ", "Tamil": "சேமி", "Telugu": "సేవ్ చేయి", "Marathi": "जतन करा", "Bengali": "সংরক্ষণ করুন", "Gujarati": "સાચવો", "Punjabi": "ਸੰਭਾਲੋ", "Malayalam": "സേവ് ചെയ്യുക", "Odia": "ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    "Save edits": {
        "English": "Save edits", "Hindi": "संपादन सहेजें", "Kannada": "ಸಂಪಾದನೆಗಳನ್ನು ಉಳಿಸಿ", "Tamil": "திருத்தங்களைச் சேமி", "Telugu": "సవరణలను సేవ్ చేయండి", "Marathi": "संपादने जतन करा", "Bengali": "সম্পাদনা সংরক্ষণ করুন", "Gujarati": "સંપાદનો સાચવો", "Punjabi": "ਸੰਪਾਦਨ ਸੰਭਾਲੋ", "Malayalam": "എഡിറ്റുകൾ സേവ് ചെയ്യുക", "Odia": "ସମ୍ପାଦନା ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    "Save failed": {
        "English": "Save failed", "Hindi": "सहेजना विफल", "Kannada": "ಉಳಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ", "Tamil": "சேமிக்க முடியவில்லை", "Telugu": "సేవ్ విఫలమైంది", "Marathi": "जतन अयशस्वी", "Bengali": "সংরক্ষণ ব্যর্থ", "Gujarati": "સાચવવામાં નિષ્ફળ", "Punjabi": "ਸੰਭਾਲਣ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "സേവ് പരാജയപ്പെട്ടു", "Odia": "ସଞ୍ଚୟ ବିଫଳ"
    },
    "Saved": {
        "English": "Saved", "Hindi": "सहेजा गया", "Kannada": "ಉಳಿಸಲಾಗಿದೆ", "Tamil": "சேமிக்கப்பட்டது", "Telugu": "సేవ్ చేయబడింది", "Marathi": "जतन केले", "Bengali": "সংরক্ষিত", "Gujarati": "સાચવ્યું", "Punjabi": "ਸੰਭਾਲਿਆ ਗਿਆ", "Malayalam": "സേവ് ചെയ്തു", "Odia": "ସଞ୍ଚୟ ହୋଇଛି"
    },
    "Saved to My Library": {
        "English": "Saved to My Library", "Hindi": "मेरी लाइब्रेरी में सहेजा गया", "Kannada": "ನನ್ನ ಲೈಬ್ರರಿಗೆ ಉಳಿಸಲಾಗಿದೆ", "Tamil": "என் நூலகத்தில் சேமிக்கப்பட்டது", "Telugu": "నా లైబ్రరీకి సేవ్ చేయబడింది", "Marathi": "माझ्या लायब्ररीत जतन केले", "Bengali": "আমার লাইব্রেরিতে সংরক্ষিত", "Gujarati": "મારી લાઈબ્રેરીમાં સાચવ્યું", "Punjabi": "ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੰਭਾਲਿਆ", "Malayalam": "എന്റെ ലൈബ്രറിയിലേക്ക് സേവ് ചെയ്തു", "Odia": "ମୋର ଲାଇବ୍ରେରୀରେ ସଞ୍ଚୟ ହୋଇଛି"
    },
    "Scan Failed": {
        "English": "Scan Failed", "Hindi": "स्कैन विफल", "Kannada": "ಸ್ಕ್ಯಾನ್ ವಿಫಲವಾಗಿದೆ", "Tamil": "ஸ்கேன் தோல்வி", "Telugu": "స్కాన్ విఫలమైంది", "Marathi": "स्कॅन अयशस्वी", "Bengali": "স্ক্যান ব্যর্থ", "Gujarati": "સ્કેન નિષ્ફળ", "Punjabi": "ਸਕੈਨ ਅਸਫਲ", "Malayalam": "സ്കാൻ പരാജയപ്പെട്ടു", "Odia": "ସ୍କାନ୍ ବିଫଳ"
    },
    "Send to parent": {
        "English": "Send to parent", "Hindi": "अभिभावक को भेजें", "Kannada": "ಪೋಷಕರಿಗೆ ಕಳುಹಿಸಿ", "Tamil": "பெற்றோருக்கு அனுப்பு", "Telugu": "తల్లిదండ్రులకు పంపండి", "Marathi": "पालकांना पाठवा", "Bengali": "অভিভাবককে পাঠান", "Gujarati": "વાલીને મોકલો", "Punjabi": "ਮਾਪਿਆਂ ਨੂੰ ਭੇਜੋ", "Malayalam": "രക്ഷിതാവിന് അയയ്ക്കുക", "Odia": "ଅଭିଭାବକଙ୍କୁ ପଠାନ୍ତୁ"
    },
    "Sign in to save edits": {
        "English": "Sign in to save edits", "Hindi": "संपादन सहेजने के लिए साइन इन करें", "Kannada": "ಸಂಪಾದನೆಗಳನ್ನು ಉಳಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "திருத்தங்களைச் சேமிக்க உள்நுழையவும்", "Telugu": "సవరణలను సేవ్ చేయడానికి సైన్ ఇన్ చేయండి", "Marathi": "संपादने जतन करण्यासाठी साइन इन करा", "Bengali": "সম্পাদনা সংরক্ষণ করতে সাইন ইন করুন", "Gujarati": "સંપાદનો સાચવવા માટે સાઇન ઇન કરો", "Punjabi": "ਸੰਪਾਦਨ ਸੰਭਾਲਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "എഡിറ്റുകൾ സേവ് ചെയ്യാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ସମ୍ପାଦନା ସଞ୍ଚୟ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Start here": {
        "English": "Start here", "Hindi": "यहां से शुरू करें", "Kannada": "ಇಲ್ಲಿಂದ ಪ್ರಾರಂಭಿಸಿ", "Tamil": "இங்கிருந்து தொடங்கு", "Telugu": "ఇక్కడ నుండి ప్రారంభించండి", "Marathi": "येथून सुरुवात करा", "Bengali": "এখান থেকে শুরু করুন", "Gujarati": "અહીંથી શરૂ કરો", "Punjabi": "ਇੱਥੋਂ ਸ਼ੁਰੂ ਕਰੋ", "Malayalam": "ഇവിടെ നിന്ന് ആരംഭിക്കുക", "Odia": "ଏଠାରୁ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Still generating. Open My Library in about a minute, or try again with a chapter selected.": {
        "English": "Still generating. Open My Library in about a minute, or try again with a chapter selected.", "Hindi": "अभी भी बन रहा है। लगभग एक मिनट में मेरी लाइब्रेरी खोलें, या एक अध्याय चुनकर पुनः प्रयास करें।", "Kannada": "ಇನ್ನೂ ರಚಿಸಲಾಗುತ್ತಿದೆ. ಸುಮಾರು ಒಂದು ನಿಮಿಷದಲ್ಲಿ ನನ್ನ ಲೈಬ್ರರಿಯನ್ನು ತೆರೆಯಿರಿ, ಅಥವಾ ಅಧ್ಯಾಯವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "இன்னும் உருவாக்கப்படுகிறது. ஒரு நிமிடத்தில் என் நூலகத்தைத் திறக்கவும், அல்லது ஒரு அத்தியாயத்தைத் தேர்ந்தெடுத்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఇంకా ఉత్పన్నం అవుతోంది. సుమారు ఒక నిమిషంలో నా లైబ్రరీని తెరవండి, లేదా అధ్యాయాన్ని ఎంచుకుని మళ్లీ ప్రయత్నించండి.", "Marathi": "अजूनही तयार होत आहे. सुमारे एका मिनिटात माझी लायब्ररी उघडा, किंवा एक अध्याय निवडून पुन्हा प्रयत्न करा.", "Bengali": "এখনও তৈরি হচ্ছে। প্রায় এক মিনিটের মধ্যে আমার লাইব্রেরি খুলুন, বা একটি অধ্যায় নির্বাচন করে আবার চেষ্টা করুন।", "Gujarati": "હજુ બની રહ્યું છે. લગભગ એક મિનિટમાં મારી લાઈબ્રેરી ખોલો, અથવા પ્રકરણ પસંદ કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਅਜੇ ਵੀ ਬਣ ਰਿਹਾ ਹੈ। ਲਗਭਗ ਇੱਕ ਮਿੰਟ ਵਿੱਚ ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਖੋਲ੍ਹੋ, ਜਾਂ ਇੱਕ ਅਧਿਆਇ ਚੁਣ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഇപ്പോഴും സൃഷ്ടിക്കുന്നു. ഏകദേശം ഒരു മിനിറ്റിനുള്ളിൽ എന്റെ ലൈബ്രറി തുറക്കുക, അല്ലെങ്കിൽ ഒരു അധ്യായം തിരഞ്ഞെടുത്ത് വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଏବେ ବି ସୃଷ୍ଟି ହେଉଛି। ପ୍ରାୟ ଗୋଟିଏ ମିନିଟ୍‌ରେ ମୋର ଲାଇବ୍ରେରୀ ଖୋଲନ୍ତୁ, କିମ୍ବା ଏକ ଅଧ୍ୟାୟ ବାଛି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Student answer pages": {
        "English": "Student answer pages", "Hindi": "छात्र उत्तर पृष्ठ", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಉತ್ತರ ಪುಟಗಳು", "Tamil": "மாணவர் பதில் பக்கங்கள்", "Telugu": "విద్యార్థి సమాధాన పేజీలు", "Marathi": "विद्यार्थी उत्तर पाने", "Bengali": "ছাত্রের উত্তর পৃষ্ঠা", "Gujarati": "વિદ્યાર્થી જવાબ પાનાં", "Punjabi": "ਵਿਦਿਆਰਥੀ ਜਵਾਬ ਪੰਨੇ", "Malayalam": "വിദ്യാർത്ഥി ഉത്തര പേജുകൾ", "Odia": "ଛାତ୍ର ଉତ୍ତର ପୃଷ୍ଠାଗୁଡ଼ିକ"
    },
    "Student wrote": {
        "English": "Student wrote", "Hindi": "छात्र ने लिखा", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಬರೆದರು", "Tamil": "மாணவர் எழுதியது", "Telugu": "విద్యార్థి రాశారు", "Marathi": "विद्यार्थ्याने लिहिले", "Bengali": "ছাত্র লিখেছে", "Gujarati": "વિદ્યાર્થીએ લખ્યું", "Punjabi": "ਵਿਦਿਆਰਥੀ ਨੇ ਲਿਖਿਆ", "Malayalam": "വിദ്യാർത്ഥി എഴുതി", "Odia": "ଛାତ୍ର ଲେଖିଲେ"
    },
    "Teacher review suggested": {
        "English": "Teacher review suggested", "Hindi": "शिक्षक समीक्षा सुझाई गई", "Kannada": "ಶಿಕ್ಷಕ ಪರಿಶೀಲನೆ ಸೂಚಿಸಲಾಗಿದೆ", "Tamil": "ஆசிரியர் மறுபரிசீலனை பரிந்துரைக்கப்பட்டது", "Telugu": "ఉపాధ్యాయ సమీక్ష సూచించబడింది", "Marathi": "शिक्षक पुनरावलोकन सुचवले", "Bengali": "শিক্ষকের পর্যালোচনা প্রস্তাবিত", "Gujarati": "શિક્ષક સમીક્ષા સૂચવેલ", "Punjabi": "ਅਧਿਆਪਕ ਸਮੀਖਿਆ ਸੁਝਾਈ ਗਈ", "Malayalam": "അധ്യാപകന്റെ അവലോകനം ശുപാർശ ചെയ്തു", "Odia": "ଶିକ୍ଷକ ସମୀକ୍ଷା ପ୍ରସ୍ତାବିତ"
    },
    "Teacher-facing notes. Not shown to parent or student.": {
        "English": "Teacher-facing notes. Not shown to parent or student.", "Hindi": "शिक्षक-सामना नोट्स। अभिभावक या छात्र को नहीं दिखाए जाते।", "Kannada": "ಶಿಕ್ಷಕ-ಮುಖಿ ಟಿಪ್ಪಣಿಗಳು. ಪೋಷಕ ಅಥವಾ ವಿದ್ಯಾರ್ಥಿಗೆ ತೋರಿಸಲಾಗುವುದಿಲ್ಲ.", "Tamil": "ஆசிரியர் சார்ந்த குறிப்புகள். பெற்றோருக்கோ மாணவருக்கோ காட்டப்படாது.", "Telugu": "ఉపాధ్యాయ-ముఖ గమనికలు. తల్లిదండ్రులకు లేదా విద్యార్థికి చూపబడవు.", "Marathi": "शिक्षक-समोरील नोट्स. पालक किंवा विद्यार्थ्याला दाखवल्या जात नाहीत.", "Bengali": "শিক্ষক-মুখী নোট। অভিভাবক বা ছাত্রকে দেখানো হয় না।", "Gujarati": "શિક્ષક-મુખી નોંધો. વાલી અથવા વિદ્યાર્થીને બતાવાતી નથી.", "Punjabi": "ਅਧਿਆਪਕ-ਸਾਹਮਣਾ ਨੋਟਸ। ਮਾਪਿਆਂ ਜਾਂ ਵਿਦਿਆਰਥੀ ਨੂੰ ਨਹੀਂ ਦਿਖਾਏ ਜਾਂਦੇ।", "Malayalam": "അധ്യാപകർക്കായുള്ള കുറിപ്പുകൾ. രക്ഷിതാവിനോ വിദ്യാർത്ഥിക്കോ കാണിക്കില്ല.", "Odia": "ଶିକ୍ଷକ-ସମ୍ମୁଖ ଟିପ୍ପଣୀ। ଅଭିଭାବକ କିମ୍ବା ଛାତ୍ରଙ୍କୁ ଦେଖାଯାଏ ନାହିଁ।"
    },
    "The AI returned an incomplete paper. Please try again with a chapter selected.": {
        "English": "The AI returned an incomplete paper. Please try again with a chapter selected.", "Hindi": "AI ने अपूर्ण पेपर लौटाया। कृपया एक अध्याय चुनकर पुनः प्रयास करें।", "Kannada": "AI ಅಪೂರ್ಣ ಪತ್ರಿಕೆಯನ್ನು ಮರಳಿಸಿತು. ದಯವಿಟ್ಟು ಅಧ್ಯಾಯವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "AI முழுமையற்ற தாளை வழங்கியது. ஒரு அத்தியாயத்தைத் தேர்ந்தெடுத்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "AI అసంపూర్ణ పేపర్‌ను అందించింది. దయచేసి అధ్యాయాన్ని ఎంచుకుని మళ్లీ ప్రయత్నించండి.", "Marathi": "AI ने अपूर्ण पेपर परत केला. कृपया एक अध्याय निवडून पुन्हा प्रयत्न करा.", "Bengali": "AI একটি অসম্পূর্ণ পেপার ফিরিয়ে দিয়েছে। অনুগ্রহ করে একটি অধ্যায় নির্বাচন করে আবার চেষ্টা করুন।", "Gujarati": "AI એ અપૂર્ણ પેપર પરત કર્યું. કૃપા કરી પ્રકરણ પસંદ કરીને ફરી પ્રયાસ કરો.", "Punjabi": "AI ਨੇ ਅਧੂਰਾ ਪੇਪਰ ਵਾਪਸ ਕੀਤਾ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਅਧਿਆਇ ਚੁਣ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "AI അപൂർണ്ണമായ പേപ്പർ നൽകി. ദയവായി ഒരു അധ്യായം തിരഞ്ഞെടുത്ത് വീണ്ടും ശ്രമിക്കുക.", "Odia": "AI ଏକ ଅସମ୍ପୂର୍ଣ୍ଣ ପେପର୍ ଫେରାଇଲା। ଦୟାକରି ଏକ ଅଧ୍ୟାୟ ବାଛି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "View in My Library": {
        "English": "View in My Library", "Hindi": "मेरी लाइब्रेरी में देखें", "Kannada": "ನನ್ನ ಲೈಬ್ರರಿಯಲ್ಲಿ ವೀಕ್ಷಿಸಿ", "Tamil": "என் நூலகத்தில் காண்க", "Telugu": "నా లైబ్రరీలో చూడండి", "Marathi": "माझ्या लायब्ररीत पहा", "Bengali": "আমার লাইব্রেরিতে দেখুন", "Gujarati": "મારી લાઈબ્રેરીમાં જુઓ", "Punjabi": "ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਦੇਖੋ", "Malayalam": "എന്റെ ലൈബ്രറിയിൽ കാണുക", "Odia": "ମୋର ଲାଇବ୍ରେରୀରେ ଦେଖନ୍ତୁ"
    },
    "Your edits are stored in My Library.": {
        "English": "Your edits are stored in My Library.", "Hindi": "आपके संपादन मेरी लाइब्रेरी में संग्रहीत हैं।", "Kannada": "ನಿಮ್ಮ ಸಂಪಾದನೆಗಳನ್ನು ನನ್ನ ಲೈಬ್ರರಿಯಲ್ಲಿ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ.", "Tamil": "உங்கள் திருத்தங்கள் என் நூலகத்தில் சேமிக்கப்பட்டுள்ளன.", "Telugu": "మీ సవరణలు నా లైబ్రరీలో నిల్వ చేయబడ్డాయి.", "Marathi": "तुमची संपादने माझ्या लायब्ररीत साठवली आहेत.", "Bengali": "আপনার সম্পাদনাগুলি আমার লাইব্রেরিতে সংরক্ষিত।", "Gujarati": "તમારા સંપાદનો મારી લાઈબ્રેરીમાં સંગ્રહિત છે.", "Punjabi": "ਤੁਹਾਡੇ ਸੰਪਾਦਨ ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੰਭਾਲੇ ਗਏ ਹਨ।", "Malayalam": "നിങ്ങളുടെ എഡിറ്റുകൾ എന്റെ ലൈബ്രറിയിൽ സൂക്ഷിച്ചിരിക്കുന്നു.", "Odia": "ଆପଣଙ୍କ ସମ୍ପାଦନା ମୋର ଲାଇବ୍ରେରୀରେ ସଞ୍ଚୟ ହୋଇଛି।"
    },
    "and how to fix them?": {
        "English": "and how to fix them?", "Hindi": "और उन्हें कैसे ठीक करें?", "Kannada": "ಮತ್ತು ಅವುಗಳನ್ನು ಹೇಗೆ ಸರಿಪಡಿಸುವುದು?", "Tamil": "மற்றும் அவற்றை எவ்வாறு சரிசெய்வது?", "Telugu": "మరియు వాటిని ఎలా సరిచేయాలి?", "Marathi": "आणि त्या कशा सोडवायच्या?", "Bengali": "এবং সেগুলি কীভাবে ঠিক করবেন?", "Gujarati": "અને તેને કેવી રીતે સુધારવી?", "Punjabi": "ਅਤੇ ਉਨ੍ਹਾਂ ਨੂੰ ਕਿਵੇਂ ਠੀਕ ਕਰਨਾ ਹੈ?", "Malayalam": "എങ്ങനെ പരിഹരിക്കാം?", "Odia": "ଏବଂ ସେମାନଙ୍କୁ କିପରି ସଠିକ୍ କରିବେ?"
    },
    "avg · at-risk": {
        "English": "avg · at-risk", "Hindi": "औसत · जोखिम में", "Kannada": "ಸರಾಸರಿ · ಅಪಾಯದಲ್ಲಿ", "Tamil": "சராசரி · ஆபத்தில்", "Telugu": "సగటు · ప్రమాదంలో", "Marathi": "सरासरी · जोखमीत", "Bengali": "গড় · ঝুঁকিতে", "Gujarati": "સરેરાશ · જોખમમાં", "Punjabi": "ਔਸਤ · ਜੋਖਮ ਵਿੱਚ", "Malayalam": "ശരാശരി · അപകടത്തിൽ", "Odia": "ହାରାହାରି · ବିପଦରେ"
    },
    "chapter to": {
        "English": "chapter to", "Hindi": "अध्याय का", "Kannada": "ಅಧ್ಯಾಯವನ್ನು", "Tamil": "அத்தியாயத்தை", "Telugu": "అధ్యాయాన్ని", "Marathi": "अध्याय", "Bengali": "অধ্যায়", "Gujarati": "પ્રકરણ", "Punjabi": "ਅਧਿਆਇ", "Malayalam": "അധ്യായം", "Odia": "ଅଧ୍ୟାୟ"
    },
    "marks": {
        "English": "marks", "Hindi": "अंक", "Kannada": "ಅಂಕಗಳು", "Tamil": "மதிப்பெண்கள்", "Telugu": "మార్కులు", "Marathi": "गुण", "Bengali": "নম্বর", "Gujarati": "ગુણ", "Punjabi": "ਅੰਕ", "Malayalam": "മാർക്കുകൾ", "Odia": "ନମ୍ବର"
    },
    "misconceptions in": {
        "English": "misconceptions in", "Hindi": "में गलतफहमियां", "Kannada": "ನಲ್ಲಿ ತಪ್ಪು ಕಲ್ಪನೆಗಳು", "Tamil": "இல் தவறான கருத்துக்கள்", "Telugu": "లో అపోహలు", "Marathi": "मधील गैरसमज", "Bengali": "মধ্যে ভুল ধারণা", "Gujarati": "માં ગેરસમજ", "Punjabi": "ਵਿੱਚ ਗਲਤਫਹਮੀਆਂ", "Malayalam": "എന്നതിലെ തെറ്റിദ്ധാരണകൾ", "Odia": "ରେ ଭୁଲ ଧାରଣା"
    },
    "no answer written": {
        "English": "no answer written", "Hindi": "कोई उत्तर नहीं लिखा", "Kannada": "ಯಾವುದೇ ಉತ್ತರ ಬರೆದಿಲ್ಲ", "Tamil": "பதில் எழுதப்படவில்லை", "Telugu": "సమాధానం రాయబడలేదు", "Marathi": "उत्तर लिहिले नाही", "Bengali": "কোনো উত্তর লেখা হয়নি", "Gujarati": "કોઈ જવાબ લખ્યો નથી", "Punjabi": "ਕੋਈ ਜਵਾਬ ਨਹੀਂ ਲਿਖਿਆ", "Malayalam": "ഉത്തരം എഴുതിയിട്ടില്ല", "Odia": "କୌଣସି ଉତ୍ତର ଲେଖାଯାଇ ନାହିଁ"
    },
    "page": {
        "English": "page", "Hindi": "पृष्ठ", "Kannada": "ಪುಟ", "Tamil": "பக்கம்", "Telugu": "పేజీ", "Marathi": "पान", "Bengali": "পৃষ্ঠা", "Gujarati": "પાનું", "Punjabi": "ਪੰਨਾ", "Malayalam": "പേജ്", "Odia": "ପୃଷ୍ଠା"
    },
    "pages": {
        "English": "pages", "Hindi": "पृष्ठ", "Kannada": "ಪುಟಗಳು", "Tamil": "பக்கங்கள்", "Telugu": "పేజీలు", "Marathi": "पाने", "Bengali": "পৃষ্ঠাগুলি", "Gujarati": "પાનાં", "Punjabi": "ਪੰਨੇ", "Malayalam": "പേജുകൾ", "Odia": "ପୃଷ୍ଠାଗୁଡ଼ିକ"
    },
    "pages — front + back, or 3 sides of a worksheet.": {
        "English": "pages — front + back, or 3 sides of a worksheet.", "Hindi": "पृष्ठ — आगे + पीछे, या वर्कशीट के 3 ओर।", "Kannada": "ಪುಟಗಳು — ಮುಂಭಾಗ + ಹಿಂಭಾಗ, ಅಥವಾ ವರ್ಕ್‌ಶೀಟ್‌ನ 3 ಬದಿಗಳು.", "Tamil": "பக்கங்கள் — முன் + பின், அல்லது வேலைத்தாளின் 3 பக்கங்கள்.", "Telugu": "పేజీలు — ముందు + వెనుక, లేదా వర్క్‌షీట్‌లోని 3 వైపులు.", "Marathi": "पाने — पुढे + मागे, किंवा वर्कशीटच्या 3 बाजू.", "Bengali": "পৃষ্ঠা — সামনে + পেছনে, বা একটি ওয়ার্কশীটের 3টি দিক।", "Gujarati": "પાનાં — આગળ + પાછળ, અથવા વર્કશીટની 3 બાજુઓ.", "Punjabi": "ਪੰਨੇ — ਅੱਗੇ + ਪਿੱਛੇ, ਜਾਂ ਵਰਕਸ਼ੀਟ ਦੇ 3 ਪਾਸੇ।", "Malayalam": "പേജുകൾ — മുൻഭാഗം + പിൻഭാഗം, അല്ലെങ്കിൽ വർക്ക്‌ഷീറ്റിന്റെ 3 വശങ്ങൾ.", "Odia": "ପୃଷ୍ଠା — ଆଗ + ପଛ, କିମ୍ବା ୱର୍କସିଟ୍‌ର 3 ପାର୍ଶ୍ୱ।"
    },
    "question": {
        "English": "question", "Hindi": "प्रश्न", "Kannada": "ಪ್ರಶ್ನೆ", "Tamil": "கேள்வி", "Telugu": "ప్రశ్న", "Marathi": "प्रश्न", "Bengali": "প্রশ্ন", "Gujarati": "પ્રશ્ન", "Punjabi": "ਸਵਾਲ", "Malayalam": "ചോദ്യം", "Odia": "ପ୍ରଶ୍ନ"
    },
    "questions": {
        "English": "questions", "Hindi": "प्रश्न", "Kannada": "ಪ್ರಶ್ನೆಗಳು", "Tamil": "கேள்விகள்", "Telugu": "ప్రశ్నలు", "Marathi": "प्रश्न", "Bengali": "প্রশ্নগুলি", "Gujarati": "પ્રશ્નો", "Punjabi": "ਸਵਾਲ", "Malayalam": "ചോദ്യങ്ങൾ", "Odia": "ପ୍ରଶ୍ନଗୁଡ଼ିକ"
    },
    "questions are uncertain. Please verify.": {
        "English": "questions are uncertain. Please verify.", "Hindi": "प्रश्न अनिश्चित हैं। कृपया सत्यापित करें।", "Kannada": "ಪ್ರಶ್ನೆಗಳು ಅನಿಶ್ಚಿತವಾಗಿವೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ.", "Tamil": "கேள்விகள் உறுதியற்றவை. சரிபார்க்கவும்.", "Telugu": "ప్రశ్నలు అనిశ్చితంగా ఉన్నాయి. దయచేసి ధృవీకరించండి.", "Marathi": "प्रश्न अनिश्चित आहेत. कृपया पडताळणी करा.", "Bengali": "প্রশ্নগুলি অনিশ্চিত। অনুগ্রহ করে যাচাই করুন।", "Gujarati": "પ્રશ્નો અનિશ્ચિત છે. કૃપા કરી ચકાસો.", "Punjabi": "ਸਵਾਲ ਅਨਿਸ਼ਚਿਤ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਜਾਂਚ ਕਰੋ।", "Malayalam": "ചോദ്യങ്ങൾ അനിശ്ചിതമാണ്. ദയവായി പരിശോധിക്കുക.", "Odia": "ପ୍ରଶ୍ନଗୁଡ଼ିକ ଅନିଶ୍ଚିତ। ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "students focused for the full period?": {
        "English": "students focused for the full period?", "Hindi": "छात्र पूरे पीरियड के लिए केंद्रित?", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳು ಪೂರ್ಣ ಅವಧಿಗೆ ಗಮನಹರಿಸಿದ್ದಾರೆಯೇ?", "Tamil": "மாணவர்கள் முழு கால அளவிற்கும் கவனம் செலுத்துகின்றனரா?", "Telugu": "విద్యార్థులు పూర్తి కాలానికి దృష్టి కేంద్రీకరించారా?", "Marathi": "विद्यार्थी संपूर्ण कालावधीसाठी एकाग्र?", "Bengali": "ছাত্ররা কি পুরো সময়কাল জুড়ে মনোযোগী?", "Gujarati": "વિદ્યાર્થીઓ સંપૂર્ણ સમયગાળા માટે કેન્દ્રિત?", "Punjabi": "ਵਿਦਿਆਰਥੀ ਪੂਰੇ ਪੀਰੀਅਡ ਲਈ ਕੇਂਦਰਿਤ?", "Malayalam": "വിദ്യാർത്ഥികൾ മുഴുവൻ പിരീഡിലും ശ്രദ്ധ കേന്ദ്രീകരിച്ചോ?", "Odia": "ଛାତ୍ରମାନେ ସମ୍ପୂର୍ଣ୍ଣ ସମୟ ପାଇଁ ଧ୍ୟାନ ଦେଇଛନ୍ତି କି?"
    },
    "top performer": {
        "English": "top performer", "Hindi": "शीर्ष प्रदर्शक", "Kannada": "ಉನ್ನತ ಪ್ರದರ್ಶಕ", "Tamil": "சிறந்த செயல்திறன்", "Telugu": "అత్యుత్తమ ప్రదర్శనకారుడు", "Marathi": "अव्वल कामगिरी", "Bengali": "শীর্ষ পারফর্মার", "Gujarati": "ટોચના પ્રદર્શક", "Punjabi": "ਚੋਟੀ ਦੇ ਪ੍ਰਦਰਸ਼ਨਕਾਰ", "Malayalam": "മികച്ച പ്രകടനക്കാരൻ", "Odia": "ଶ୍ରେଷ୍ଠ ପ୍ରଦର୍ଶନକାରୀ"
    },
    "Sign in to see your usage": {
        "English": "Sign in to see your usage", "Hindi": "अपना उपयोग देखने के लिए साइन इन करें", "Kannada": "ನಿಮ್ಮ ಬಳಕೆಯನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "உங்கள் பயன்பாட்டைப் பார்க்க உள்நுழையவும்", "Telugu": "మీ వినియోగాన్ని చూడడానికి సైన్ ఇన్ చేయండి", "Marathi": "तुमचा वापर पाहण्यासाठी साइन इन करा", "Bengali": "আপনার ব্যবহার দেখতে সাইন ইন করুন", "Gujarati": "તમારો વપરાશ જોવા માટે સાઇન ઇન કરો", "Punjabi": "ਆਪਣੀ ਵਰਤੋਂ ਦੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ ഉപയോഗം കാണാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଆପଣଙ୍କର ବ୍ୟବହାର ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to see how many generations you've used this month and what's left on your plan.": {
        "English": "Sign in to see how many generations you've used this month and what's left on your plan.", "Hindi": "इस महीने आपने कितने जनरेशन का उपयोग किया है और आपकी योजना में क्या बचा है, यह देखने के लिए साइन इन करें।", "Kannada": "ಈ ತಿಂಗಳು ನೀವು ಎಷ್ಟು ಜನರೇಷನ್‌ಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ ಮತ್ತು ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಏನು ಉಳಿದಿದೆ ಎಂದು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "இந்த மாதம் நீங்கள் எத்தனை உருவாக்கங்களைப் பயன்படுத்தினீர்கள் மற்றும் உங்கள் திட்டத்தில் என்ன மீதம் உள்ளது என்பதைப் பார்க்க உள்நுழையவும்.", "Telugu": "ఈ నెల మీరు ఎన్ని జనరేషన్‌లను ఉపయోగించారు మరియు మీ ప్లాన్‌లో ఏమి మిగిలింది అనేది చూడడానికి సైన్ ఇన్ చేయండి.", "Marathi": "या महिन्यात तुम्ही किती जनरेशन वापरले आहे आणि तुमच्या प्लॅनमध्ये काय शिल्लक आहे ते पाहण्यासाठी साइन इन करा.", "Bengali": "এই মাসে আপনি কতগুলি জেনারেশন ব্যবহার করেছেন এবং আপনার প্ল্যানে কী বাকি আছে তা দেখতে সাইন ইন করুন।", "Gujarati": "આ મહિને તમે કેટલા જનરેશન વાપર્યા છે અને તમારી પ્લાનમાં શું બાકી છે તે જોવા માટે સાઇન ઇન કરો.", "Punjabi": "ਇਸ ਮਹੀਨੇ ਤੁਸੀਂ ਕਿੰਨੇ ਜਨਰੇਸ਼ਨ ਵਰਤੇ ਹਨ ਅਤੇ ਤੁਹਾਡੇ ਪਲਾਨ ਵਿੱਚ ਕੀ ਬਾਕੀ ਹੈ, ਇਹ ਦੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "ഈ മാസം നിങ്ങൾ എത്ര ജനറേഷനുകൾ ഉപയോഗിച്ചുവെന്നും നിങ്ങളുടെ പ്ലാനിൽ എന്ത് അവശേഷിക്കുന്നുവെന്നും കാണാൻ സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ଏହି ମାସରେ ଆପଣ କେତେ ଜେନେରେସନ୍ ବ୍ୟବହାର କରିଛନ୍ତି ଏବଂ ଆପଣଙ୍କ ପ୍ଲାନରେ କଣ ବାକି ଅଛି ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "understanding without a formal test?": {
        "English": "understanding without a formal test?", "Hindi": "औपचारिक परीक्षण के बिना समझ?", "Kannada": "ಔಪಚಾರಿಕ ಪರೀಕ್ಷೆಯಿಲ್ಲದೆ ತಿಳಿವಳಿಕೆ?", "Tamil": "முறையான தேர்வு இல்லாமல் புரிதல்?", "Telugu": "అధికారిక పరీక్ష లేకుండా అవగాహన?", "Marathi": "औपचारिक चाचणीशिवाय समज?", "Bengali": "আনুষ্ঠানিক পরীক্ষা ছাড়াই বোঝাপড়া?", "Gujarati": "ઔપચારિક પરીક્ષણ વિના સમજ?", "Punjabi": "ਰਸਮੀ ਟੈਸਟ ਤੋਂ ਬਿਨਾਂ ਸਮਝ?", "Malayalam": "ഔദ്യോഗിക പരീക്ഷ കൂടാതെ മനസ്സിലാക്കൽ?", "Odia": "ଔପଚାରିକ ପରୀକ୍ଷା ବିନା ବୁଝାମଣା?"
    },
    // Landing wave 1: sample-output-section, demo-interaction, signed-out-banner, landing-nav
    "Here is what SahayakAI generates in seconds": {
        "English": "Here is what SahayakAI generates in seconds",
        "Hindi": "SahayakAI सेकंडों में यह तैयार करता है",
        "Kannada": "SahayakAI ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಇದನ್ನು ರಚಿಸುತ್ತದೆ",
        "Tamil": "SahayakAI வினாடிகளில் இதை உருவாக்குகிறது",
        "Telugu": "SahayakAI సెకన్లలో దీన్ని రూపొందిస్తుంది",
        "Marathi": "SahayakAI काही सेकंदात हे तयार करते",
        "Bengali": "SahayakAI সেকেন্ডে এটি তৈরি করে",
        "Gujarati": "SahayakAI સેકન્ડમાં આ બનાવે છે",
        "Punjabi": "SahayakAI ਸਕਿੰਟਾਂ ਵਿੱਚ ਇਹ ਤਿਆਰ ਕਰਦਾ ਹੈ",
        "Malayalam": "SahayakAI സെക്കൻഡുകൾക്കുള്ളിൽ ഇത് സൃഷ്ടിക്കുന്നു",
        "Odia": "SahayakAI ସେକେଣ୍ଡରେ ଏହା ତିଆରି କରେ"
    },
    "Lesson Plan: Photosynthesis": {
        "English": "Lesson Plan: Photosynthesis",
        "Hindi": "पाठ योजना: प्रकाश संश्लेषण",
        "Kannada": "ಪಾಠ ಯೋಜನೆ: ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ",
        "Tamil": "பாடம் திட்டம்: ஒளிச்சேர்க்கை",
        "Telugu": "పాఠ ప్రణాళిక: కిరణజన్య సంయోగక్రియ",
        "Marathi": "पाठ योजना: प्रकाशसंश्लेषण",
        "Bengali": "পাঠ পরিকল্পনা: সালোকসংশ্লেষণ",
        "Gujarati": "પાઠ યોજના: પ્રકાશસંશ્લેષણ",
        "Punjabi": "ਪਾਠ ਯੋਜਨਾ: ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ",
        "Malayalam": "പാഠ പദ്ധതി: പ്രകാശസംശ്ലേഷണം",
        "Odia": "ପାଠ ଯୋଜନା: ଆଲୋକ ସଂଶ୍ଳେଷଣ"
    },
    "Class 8 Science | CBSE | 40 minutes": {
        "English": "Class 8 Science | CBSE | 40 minutes",
        "Hindi": "कक्षा 8 विज्ञान | CBSE | 40 मिनट",
        "Kannada": "8ನೇ ತರಗತಿ ವಿಜ್ಞಾನ | CBSE | 40 ನಿಮಿಷಗಳು",
        "Tamil": "வகுப்பு 8 அறிவியல் | CBSE | 40 நிமிடங்கள்",
        "Telugu": "8వ తరగతి సైన్స్ | CBSE | 40 నిమిషాలు",
        "Marathi": "इयत्ता 8 विज्ञान | CBSE | 40 मिनिटे",
        "Bengali": "ক্লাস 8 বিজ্ঞান | CBSE | 40 মিনিট",
        "Gujarati": "ધોરણ 8 વિજ્ઞાન | CBSE | 40 મિનિટ",
        "Punjabi": "ਜਮਾਤ 8 ਵਿਗਿਆਨ | CBSE | 40 ਮਿੰਟ",
        "Malayalam": "ക്ലാസ് 8 സയൻസ് | CBSE | 40 മിനിറ്റ്",
        "Odia": "ଶ୍ରେଣୀ 8 ବିଜ୍ଞାନ | CBSE | 40 ମିନିଟ୍"
    },
    "Generated in 30s": {
        "English": "Generated in 30s",
        "Hindi": "30 सेकंड में तैयार",
        "Kannada": "30 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ರಚಿಸಲಾಗಿದೆ",
        "Tamil": "30 வினாடிகளில் உருவாக்கப்பட்டது",
        "Telugu": "30 సెకన్లలో రూపొందించబడింది",
        "Marathi": "30 सेकंदात तयार",
        "Bengali": "30 সেকেন্ডে তৈরি",
        "Gujarati": "30 સેકન્ડમાં તૈયાર",
        "Punjabi": "30 ਸਕਿੰਟਾਂ ਵਿੱਚ ਤਿਆਰ",
        "Malayalam": "30 സെക്കൻഡിൽ സൃഷ്ടിച്ചു",
        "Odia": "30 ସେକେଣ୍ଡରେ ତିଆରି"
    },
    "Engage (5 min):": {
        "English": "Engage (5 min):",
        "Hindi": "जुड़ाव (5 मिनट):",
        "Kannada": "ತೊಡಗಿಸಿಕೊಳ್ಳಿ (5 ನಿಮಿಷ):",
        "Tamil": "ஈடுபடுத்து (5 நிமிடம்):",
        "Telugu": "ఎంగేజ్ (5 నిమిషాలు):",
        "Marathi": "गुंतवा (5 मिनिटे):",
        "Bengali": "যুক্ত করুন (5 মিনিট):",
        "Gujarati": "જોડાવ (5 મિનિટ):",
        "Punjabi": "ਜੋੜੋ (5 ਮਿੰਟ):",
        "Malayalam": "ഇടപഴകുക (5 മിനിറ്റ്):",
        "Odia": "ସଂଲଗ୍ନ କରନ୍ତୁ (5 ମିନିଟ୍):"
    },
    "Show a wilting plant vs healthy plant. Ask: What does the healthy plant have that the wilting one doesn't?": {
        "English": "Show a wilting plant vs healthy plant. Ask: What does the healthy plant have that the wilting one doesn't?",
        "Hindi": "एक मुरझाया हुआ पौधा और एक स्वस्थ पौधा दिखाएँ। पूछें: स्वस्थ पौधे में ऐसा क्या है जो मुरझाए पौधे में नहीं है?",
        "Kannada": "ಒಣಗುತ್ತಿರುವ ಸಸ್ಯ ಮತ್ತು ಆರೋಗ್ಯಕರ ಸಸ್ಯವನ್ನು ತೋರಿಸಿ. ಕೇಳಿ: ಆರೋಗ್ಯಕರ ಸಸ್ಯದಲ್ಲಿ ಒಣಗುತ್ತಿರುವ ಸಸ್ಯದಲ್ಲಿ ಇಲ್ಲದಿರುವ ಏನು ಇದೆ?",
        "Tamil": "வாடிய தாவரத்தையும் ஆரோக்கியமான தாவரத்தையும் காட்டுங்கள். கேளுங்கள்: வாடிய தாவரத்திடம் இல்லாதது ஆரோக்கியமான தாவரத்திடம் என்ன உள்ளது?",
        "Telugu": "వాడిపోతున్న మొక్క మరియు ఆరోగ్యకరమైన మొక్కను చూపండి. అడగండి: వాడిపోతున్న మొక్కకు లేనిది ఆరోగ్యకరమైన మొక్కకు ఏముంది?",
        "Marathi": "कोमेजलेले झाड आणि निरोगी झाड दाखवा. विचारा: निरोगी झाडामध्ये असे काय आहे जे कोमेजलेल्या झाडामध्ये नाही?",
        "Bengali": "একটি শুকিয়ে যাওয়া গাছ ও একটি সুস্থ গাছ দেখান। জিজ্ঞাসা করুন: সুস্থ গাছে এমন কী আছে যা শুকিয়ে যাওয়া গাছে নেই?",
        "Gujarati": "કરમાયેલો છોડ અને તંદુરસ્ત છોડ બતાવો. પૂછો: તંદુરસ્ત છોડમાં શું છે જે કરમાયેલા છોડમાં નથી?",
        "Punjabi": "ਮੁਰਝਾਇਆ ਪੌਦਾ ਅਤੇ ਤੰਦਰੁਸਤ ਪੌਦਾ ਦਿਖਾਓ। ਪੁੱਛੋ: ਤੰਦਰੁਸਤ ਪੌਦੇ ਵਿੱਚ ਅਜਿਹਾ ਕੀ ਹੈ ਜੋ ਮੁਰਝਾਏ ਪੌਦੇ ਵਿੱਚ ਨਹੀਂ ਹੈ?",
        "Malayalam": "വാടിയ ചെടിയും ആരോഗ്യമുള്ള ചെടിയും കാണിക്കുക. ചോദിക്കുക: വാടിയ ചെടിക്കില്ലാത്തത് ആരോഗ്യമുള്ള ചെടിക്ക് എന്താണുള്ളത്?",
        "Odia": "ଏକ ଶୁଖିଯାଉଥିବା ଗଛ ଓ ଏକ ସୁସ୍ଥ ଗଛ ଦେଖାନ୍ତୁ। ପଚାରନ୍ତୁ: ଶୁଖିଯାଉଥିବା ଗଛରେ ନଥିବା କ’ଣ ସୁସ୍ଥ ଗଛରେ ଅଛି?"
    },
    "Explore (10 min):": {
        "English": "Explore (10 min):",
        "Hindi": "अन्वेषण (10 मिनट):",
        "Kannada": "ಅನ್ವೇಷಿಸಿ (10 ನಿಮಿಷ):",
        "Tamil": "ஆராய்க (10 நிமிடம்):",
        "Telugu": "అన్వేషించండి (10 నిమిషాలు):",
        "Marathi": "अन्वेषण (10 मिनिटे):",
        "Bengali": "অন্বেষণ (10 মিনিট):",
        "Gujarati": "અન્વેષણ (10 મિનિટ):",
        "Punjabi": "ਖੋਜ (10 ਮਿੰਟ):",
        "Malayalam": "പര്യവേക്ഷണം (10 മിനിറ്റ്):",
        "Odia": "ଅନ୍ୱେଷଣ (10 ମିନିଟ୍):"
    },
    "Students test starch presence in leaves kept in dark vs sunlight using iodine...": {
        "English": "Students test starch presence in leaves kept in dark vs sunlight using iodine...",
        "Hindi": "छात्र अंधेरे और धूप में रखे पत्तों में स्टार्च की उपस्थिति आयोडीन से जाँचते हैं...",
        "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳು ಕತ್ತಲೆ ಮತ್ತು ಸೂರ್ಯನ ಬೆಳಕಿನಲ್ಲಿ ಇಟ್ಟ ಎಲೆಗಳಲ್ಲಿ ಪಿಷ್ಟದ ಉಪಸ್ಥಿತಿಯನ್ನು ಅಯೋಡಿನ್‌ನಿಂದ ಪರೀಕ್ಷಿಸುತ್ತಾರೆ...",
        "Tamil": "மாணவர்கள் இருளிலும் சூரிய ஒளியிலும் வைக்கப்பட்ட இலைகளில் மாவுச்சத்து இருப்பதை அயோடின் கொண்டு சோதிக்கின்றனர்...",
        "Telugu": "విద్యార్థులు చీకటిలో మరియు సూర్యకాంతిలో ఉంచిన ఆకులలో పిండి పదార్థాన్ని అయోడిన్‌తో పరీక్షిస్తారు...",
        "Marathi": "विद्यार्थी अंधार आणि सूर्यप्रकाशात ठेवलेल्या पानांमध्ये स्टार्चची उपस्थिती आयोडीनने तपासतात...",
        "Bengali": "শিক্ষার্থীরা অন্ধকার ও সূর্যালোকে রাখা পাতায় আয়োডিন দিয়ে স্টার্চের উপস্থিতি পরীক্ষা করে...",
        "Gujarati": "વિદ્યાર્થીઓ અંધારામાં અને સૂર્યપ્રકાશમાં રાખેલા પાંદડામાં આયોડિન વડે સ્ટાર્ચની હાજરી તપાસે છે...",
        "Punjabi": "ਵਿਦਿਆਰਥੀ ਹਨੇਰੇ ਅਤੇ ਧੁੱਪ ਵਿੱਚ ਰੱਖੇ ਪੱਤਿਆਂ ਵਿੱਚ ਆਇਓਡੀਨ ਨਾਲ ਸਟਾਰਚ ਦੀ ਮੌਜੂਦਗੀ ਦੀ ਜਾਂਚ ਕਰਦੇ ਹਨ...",
        "Malayalam": "വിദ്യാർത്ഥികൾ ഇരുട്ടിലും വെയിലിലും വച്ച ഇലകളിൽ അയോഡിൻ ഉപയോഗിച്ച് അന്നജത്തിന്റെ സാന്നിധ്യം പരിശോധിക്കുന്നു...",
        "Odia": "ଛାତ୍ରମାନେ ଅନ୍ଧାର ଓ ସୂର୍ଯ୍ୟାଲୋକରେ ରଖାଯାଇଥିବା ପତ୍ରରେ ଆୟୋଡିନ୍ ସହାୟତାରେ ଷ୍ଟାର୍ଚ୍ଚର ଉପସ୍ଥିତି ଯାଞ୍ଚ କରନ୍ତି..."
    },
    "Explain (15 min):": {
        "English": "Explain (15 min):",
        "Hindi": "व्याख्या (15 मिनट):",
        "Kannada": "ವಿವರಿಸಿ (15 ನಿಮಿಷ):",
        "Tamil": "விளக்கு (15 நிமிடம்):",
        "Telugu": "వివరించండి (15 నిమిషాలు):",
        "Marathi": "स्पष्ट करा (15 मिनिटे):",
        "Bengali": "ব্যাখ্যা (15 মিনিট):",
        "Gujarati": "સમજાવો (15 મિનિટ):",
        "Punjabi": "ਸਮਝਾਓ (15 ਮਿੰਟ):",
        "Malayalam": "വിശദീകരിക്കുക (15 മിനിറ്റ്):",
        "Odia": "ବ୍ୟାଖ୍ୟା (15 ମିନିଟ୍):"
    },
    "Board diagram of light reaction. Key vocabulary: chlorophyll, stomata, glucose...": {
        "English": "Board diagram of light reaction. Key vocabulary: chlorophyll, stomata, glucose...",
        "Hindi": "बोर्ड पर प्रकाश अभिक्रिया का चित्र। मुख्य शब्दावली: क्लोरोफिल, रंध्र, ग्लूकोज...",
        "Kannada": "ಬೆಳಕಿನ ಪ್ರತಿಕ್ರಿಯೆಯ ಬೋರ್ಡ್ ರೇಖಾಚಿತ್ರ. ಪ್ರಮುಖ ಪದಗಳು: ಕ್ಲೋರೊಫಿಲ್, ಸ್ಟೊಮಾಟಾ, ಗ್ಲೂಕೋಸ್...",
        "Tamil": "ஒளி வினையின் பலகை வரைபடம். முக்கிய சொற்கள்: பசுங்கணிகம், இலைத்துளை, குளுக்கோஸ்...",
        "Telugu": "కాంతి ప్రతిచర్య యొక్క బోర్డు రేఖాచిత్రం. ముఖ్య పదజాలం: క్లోరోఫిల్, స్టోమాటా, గ్లూకోజ్...",
        "Marathi": "प्रकाश अभिक्रियेचे फलक रेखाचित्र. मुख्य शब्दसंग्रह: क्लोरोफिल, पर्णरंध्र, ग्लुकोज...",
        "Bengali": "আলোর বিক্রিয়ার বোর্ড চিত্র। মূল শব্দভাণ্ডার: ক্লোরোফিল, পত্ররন্ধ্র, গ্লুকোজ...",
        "Gujarati": "પ્રકાશ પ્રતિક્રિયાનું બોર્ડ ડાયાગ્રામ. મુખ્ય શબ્દભંડોળ: ક્લોરોફિલ, સ્ટોમેટા, ગ્લુકોઝ...",
        "Punjabi": "ਪ੍ਰਕਾਸ਼ ਪ੍ਰਤੀਕਿਰਿਆ ਦਾ ਬੋਰਡ ਚਿੱਤਰ। ਮੁੱਖ ਸ਼ਬਦਾਵਲੀ: ਕਲੋਰੋਫਿਲ, ਸਟੋਮਾਟਾ, ਗਲੂਕੋਜ਼...",
        "Malayalam": "പ്രകാശ പ്രതിപ്രവർത്തനത്തിന്റെ ബോർഡ് ഡയഗ്രം. പ്രധാന പദാവലി: ക്ലോറോഫിൽ, സ്റ്റോമാറ്റ, ഗ്ലൂക്കോസ്...",
        "Odia": "ଆଲୋକ ପ୍ରତିକ୍ରିୟାର ବୋର୍ଡ ଚିତ୍ର। ମୁଖ୍ୟ ଶବ୍ଦାବଳୀ: କ୍ଲୋରୋଫିଲ୍, ସ୍ଟୋମାଟା, ଗ୍ଲୁକୋଜ୍..."
    },
    "Complete with assessment rubric, homework, and NCERT alignment": {
        "English": "Complete with assessment rubric, homework, and NCERT alignment",
        "Hindi": "मूल्यांकन रुब्रिक, गृहकार्य और NCERT संरेखण के साथ पूर्ण",
        "Kannada": "ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್, ಮನೆಗೆಲಸ ಮತ್ತು NCERT ಜೋಡಣೆಯೊಂದಿಗೆ ಸಂಪೂರ್ಣ",
        "Tamil": "மதிப்பீட்டு அளவுகோல், வீட்டுப்பாடம் மற்றும் NCERT இணைப்புடன் முழுமையானது",
        "Telugu": "మూల్యాంకన రూబ్రిక్, హోమ్‌వర్క్ మరియు NCERT అలైన్‌మెంట్‌తో పూర్తి",
        "Marathi": "मूल्यांकन रुब्रिक, गृहपाठ आणि NCERT संरेखनासह पूर्ण",
        "Bengali": "মূল্যায়ন রুব্রিক, হোমওয়ার্ক ও NCERT সারিবদ্ধতা সহ সম্পূর্ণ",
        "Gujarati": "મૂલ્યાંકન રુબ્રિક, હોમવર્ક અને NCERT સંરેખણ સાથે પૂર્ણ",
        "Punjabi": "ਮੁਲਾਂਕਣ ਰੂਬ੍ਰਿਕ, ਹੋਮਵਰਕ ਅਤੇ NCERT ਅਲਾਈਨਮੈਂਟ ਨਾਲ ਪੂਰਾ",
        "Malayalam": "മൂല്യനിർണ്ണയ റൂബ്രിക്, ഹോംവർക്ക്, NCERT വിന്യാസം എന്നിവയോടെ പൂർണ്ണം",
        "Odia": "ମୂଲ୍ୟାୟନ ରୁବ୍ରିକ୍, ଗୃହକାର୍ଯ୍ୟ ଓ NCERT ସମନ୍ୱୟ ସହିତ ସମ୍ପୂର୍ଣ୍ଣ"
    },
    "See how it works": {
        "English": "See how it works",
        "Hindi": "देखें यह कैसे काम करता है",
        "Kannada": "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ಎಂದು ನೋಡಿ",
        "Tamil": "இது எப்படி வேலை செய்கிறது என்று பாருங்கள்",
        "Telugu": "ఇది ఎలా పనిచేస్తుందో చూడండి",
        "Marathi": "हे कसे काम करते ते पहा",
        "Bengali": "এটি কীভাবে কাজ করে দেখুন",
        "Gujarati": "આ કેવી રીતે કાર્ય કરે છે તે જુઓ",
        "Punjabi": "ਦੇਖੋ ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
        "Malayalam": "ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നുവെന്ന് കാണുക",
        "Odia": "ଏହା କିପରି କାମ କରେ ଦେଖନ୍ତୁ"
    },
    "Voice-first AI for teachers": {
        "English": "Voice-first AI for teachers",
        "Hindi": "शिक्षकों के लिए वॉयस-फर्स्ट AI",
        "Kannada": "ಶಿಕ್ಷಕರಿಗಾಗಿ ಧ್ವನಿ-ಮೊದಲ AI",
        "Tamil": "ஆசிரியர்களுக்கான குரல்-முதல் AI",
        "Telugu": "ఉపాధ్యాయుల కోసం వాయిస్-ఫస్ట్ AI",
        "Marathi": "शिक्षकांसाठी व्हॉइस-फर्स्ट AI",
        "Bengali": "শিক্ষকদের জন্য ভয়েস-ফার্স্ট AI",
        "Gujarati": "શિક્ષકો માટે વૉઇસ-ફર્સ્ટ AI",
        "Punjabi": "ਅਧਿਆਪਕਾਂ ਲਈ ਵੌਇਸ-ਫਸਟ AI",
        "Malayalam": "അധ്യാപകർക്കായി വോയ്സ്-ഫസ്റ്റ് AI",
        "Odia": "ଶିକ୍ଷକମାନଙ୍କ ପାଇଁ ଭଏସ୍-ଫାର୍ଷ୍ଟ AI"
    },
    "Listening...": {
        "English": "Listening...",
        "Hindi": "सुन रहा है...",
        "Kannada": "ಆಲಿಸುತ್ತಿದೆ...",
        "Tamil": "கேட்கிறது...",
        "Telugu": "వింటోంది...",
        "Marathi": "ऐकत आहे...",
        "Bengali": "শুনছে...",
        "Gujarati": "સાંભળી રહ્યું છે...",
        "Punjabi": "ਸੁਣ ਰਿਹਾ ਹੈ...",
        "Malayalam": "കേൾക്കുന്നു...",
        "Odia": "ଶୁଣୁଛି..."
    },
    "Generating quiz...": {
        "English": "Generating quiz...",
        "Hindi": "क्विज़ बना रहा है...",
        "Kannada": "ರಸಪ್ರಶ್ನೆ ರಚಿಸುತ್ತಿದೆ...",
        "Tamil": "வினாடி வினா உருவாக்குகிறது...",
        "Telugu": "క్విజ్ సృష్టిస్తోంది...",
        "Marathi": "क्विझ तयार करत आहे...",
        "Bengali": "কুইজ তৈরি করছে...",
        "Gujarati": "ક્વિઝ બનાવી રહ્યું છે...",
        "Punjabi": "ਕਵਿਜ਼ ਬਣਾ ਰਿਹਾ ਹੈ...",
        "Malayalam": "ക്വിസ് സൃഷ്ടിക്കുന്നു...",
        "Odia": "କୁଇଜ୍ ତିଆରି କରୁଛି..."
    },
    "Quiz: Photosynthesis (Class 8)": {
        "English": "Quiz: Photosynthesis (Class 8)",
        "Hindi": "क्विज़: प्रकाश संश्लेषण (कक्षा 8)",
        "Kannada": "ರಸಪ್ರಶ್ನೆ: ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (8ನೇ ತರಗತಿ)",
        "Tamil": "வினாடி வினா: ஒளிச்சேர்க்கை (வகுப்பு 8)",
        "Telugu": "క్విజ్: కిరణజన్య సంయోగక్రియ (8వ తరగతి)",
        "Marathi": "क्विझ: प्रकाशसंश्लेषण (इयत्ता 8)",
        "Bengali": "কুইজ: সালোকসংশ্লেষণ (ক্লাস 8)",
        "Gujarati": "ક્વિઝ: પ્રકાશસંશ્લેષણ (ધોરણ 8)",
        "Punjabi": "ਕਵਿਜ਼: ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ (ਜਮਾਤ 8)",
        "Malayalam": "ക്വിസ്: പ്രകാശസംശ്ലേഷണം (ക്ലാസ് 8)",
        "Odia": "କୁଇଜ୍: ଆଲୋକ ସଂଶ୍ଳେଷଣ (ଶ୍ରେଣୀ 8)"
    },
    "Replay demo": {
        "English": "Replay demo",
        "Hindi": "डेमो फिर से चलाएँ",
        "Kannada": "ಡೆಮೋ ಮರುಪ್ಲೇ ಮಾಡಿ",
        "Tamil": "டெமோவை மீண்டும் இயக்கு",
        "Telugu": "డెమోను మళ్లీ ప్లే చేయండి",
        "Marathi": "डेमो पुन्हा प्ले करा",
        "Bengali": "ডেমো পুনরায় চালান",
        "Gujarati": "ડેમો ફરી ચલાવો",
        "Punjabi": "ਡੈਮੋ ਮੁੜ ਚਲਾਓ",
        "Malayalam": "ഡെമോ വീണ്ടും പ്ലേ ചെയ്യുക",
        "Odia": "ଡେମୋ ପୁନଃ ଚଲାନ୍ତୁ"
    },
    "by SARGVISION Intelligence": {
        // SARGVISION is a brand name — kept English. "by" is localized.
        "English": "by SARGVISION Intelligence",
        "Hindi": "द्वारा SARGVISION Intelligence",
        "Kannada": "ರಿಂದ SARGVISION Intelligence",
        "Tamil": "வழங்கியது SARGVISION Intelligence",
        "Telugu": "ద్వారా SARGVISION Intelligence",
        "Marathi": "द्वारा SARGVISION Intelligence",
        "Bengali": "দ্বারা SARGVISION Intelligence",
        "Gujarati": "દ્વારા SARGVISION Intelligence",
        "Punjabi": "ਵੱਲੋਂ SARGVISION Intelligence",
        "Malayalam": "നൽകുന്നത് SARGVISION Intelligence",
        "Odia": "ଦ୍ୱାରା SARGVISION Intelligence"
    },
    "See you tomorrow": {
        "English": "See you tomorrow",
        "Hindi": "कल मिलते हैं",
        "Kannada": "ನಾಳೆ ಸಿಗೋಣ",
        "Tamil": "நாளை சந்திப்போம்",
        "Telugu": "రేపు కలుద్దాం",
        "Marathi": "उद्या भेटू",
        "Bengali": "কাল দেখা হবে",
        "Gujarati": "આવતીકાલે મળીશું",
        "Punjabi": "ਕੱਲ੍ਹ ਮਿਲਾਂਗੇ",
        "Malayalam": "നാളെ കാണാം",
        "Odia": "କାଲି ଭେଟିବା"
    },
    "Sign back in": {
        "English": "Sign back in",
        "Hindi": "फिर से साइन इन करें",
        "Kannada": "ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "மீண்டும் உள்நுழைக",
        "Telugu": "మళ్లీ సైన్ ఇన్ చేయండి",
        "Marathi": "पुन्हा साइन इन करा",
        "Bengali": "পুনরায় সাইন ইন করুন",
        "Gujarati": "ફરી સાઇન ઇન કરો",
        "Punjabi": "ਮੁੜ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "വീണ്ടും സൈൻ ഇൻ ചെയ്യുക",
        "Odia": "ପୁନଃ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    // ─── Wave 1: auth-dialog.tsx ───
    "Sign in to continue": {
        "English": "Sign in to continue", "Hindi": "जारी रखने के लिए साइन इन करें", "Kannada": "ಮುಂದುವರಿಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
        "Tamil": "தொடர சைன் இன் செய்யவும்", "Telugu": "కొనసాగడానికి సైన్ ఇన్ చేయండి", "Marathi": "सुरू ठेवण्यासाठी साइन इन करा",
        "Bengali": "চালিয়ে যেতে সাইন ইন করুন", "Gujarati": "ચાલુ રાખવા માટે સાઇન ઇન કરો", "Punjabi": "ਜਾਰੀ ਰੱਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ",
        "Malayalam": "തുടരാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଜାରି ରଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Access your library, track your usage, and pick up where you left off — across every classroom tool.": {
        "English": "Access your library, track your usage, and pick up where you left off — across every classroom tool.",
        "Hindi": "अपनी लाइब्रेरी तक पहुँचें, अपने उपयोग को ट्रैक करें, और जहाँ छोड़ा था वहीं से शुरू करें — हर कक्षा-कक्ष टूल में।",
        "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿಯನ್ನು ಪ್ರವೇಶಿಸಿ, ನಿಮ್ಮ ಬಳಕೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ, ಮತ್ತು ನೀವು ಬಿಟ್ಟ ಸ್ಥಳದಿಂದಲೇ ಮುಂದುವರಿಯಿರಿ — ಪ್ರತಿಯೊಂದು ತರಗತಿ ಸಾಧನದಲ್ಲಿ.",
        "Tamil": "உங்கள் நூலகத்தை அணுகவும், உங்கள் பயன்பாட்டைக் கண்காணிக்கவும், நீங்கள் விட்ட இடத்திலிருந்து தொடரவும் — ஒவ்வொரு வகுப்பறை கருவியிலும்.",
        "Telugu": "మీ లైబ్రరీని యాక్సెస్ చేయండి, మీ వినియోగాన్ని ట్రాక్ చేయండి, మరియు మీరు వదిలిన చోటు నుండే కొనసాగండి — ప్రతి తరగతి గది సాధనంలో.",
        "Marathi": "तुमच्या लायब्ररीत प्रवेश करा, तुमच्या वापराचा मागोवा घ्या, आणि तुम्ही जिथे सोडले होते तिथून सुरू ठेवा — प्रत्येक वर्गखोली साधनात.",
        "Bengali": "আপনার লাইব্রেরি অ্যাক্সেস করুন, আপনার ব্যবহার ট্র্যাক করুন, এবং যেখানে রেখেছিলেন সেখান থেকেই শুরু করুন — প্রতিটি শ্রেণীকক্ষ টুলে।",
        "Gujarati": "તમારી લાઈબ્રેરી ઍક્સેસ કરો, તમારા ઉપયોગને ટ્રૅક કરો, અને જ્યાં છોડ્યું હતું ત્યાંથી જ ચાલુ રાખો — દરેક વર્ગખંડ સાધનમાં.",
        "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਤੱਕ ਪਹੁੰਚ ਕਰੋ, ਆਪਣੀ ਵਰਤੋਂ ਟ੍ਰੈਕ ਕਰੋ, ਅਤੇ ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਹੀ ਸ਼ੁਰੂ ਕਰੋ — ਹਰ ਕਲਾਸਰੂਮ ਟੂਲ ਵਿੱਚ।",
        "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി ആക്സസ് ചെയ്യുക, നിങ്ങളുടെ ഉപയോഗം ട്രാക്ക് ചെയ്യുക, നിങ്ങൾ വിട്ടിടത്തുനിന്ന് തുടരുക — എല്ലാ ക്ലാസ്റൂം ഉപകരണത്തിലും.",
        "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଆକ୍ସେସ୍ କରନ୍ତୁ, ଆପଣଙ୍କ ବ୍ୟବହାର ଟ୍ରାକ୍ କରନ୍ତୁ, ଏବଂ ଯେଉଁଠାରେ ଛାଡ଼ିଥିଲେ ସେଠାରୁ ଆରମ୍ଭ କରନ୍ତୁ — ପ୍ରତ୍ୟେକ ଶ୍ରେଣୀଗୃହ ସାଧନରେ।"
    },
    "By signing in, you agree to the": {
        "English": "By signing in, you agree to the", "Hindi": "साइन इन करके, आप सहमत हैं", "Kannada": "ಸೈನ್ ಇನ್ ಮಾಡುವ ಮೂಲಕ, ನೀವು ಸಮ್ಮತಿಸುತ್ತೀರಿ",
        "Tamil": "சைன் இன் செய்வதன் மூலம், நீங்கள் ஒப்புக்கொள்கிறீர்கள்", "Telugu": "సైన్ ఇన్ చేయడం ద్వారా, మీరు అంగీకరిస్తున్నారు", "Marathi": "साइन इन करून, तुम्ही सहमत आहात",
        "Bengali": "সাইন ইন করে, আপনি সম্মত হচ্ছেন", "Gujarati": "સાઇન ઇન કરીને, તમે સંમત થાઓ છો", "Punjabi": "ਸਾਈਨ ਇਨ ਕਰਕੇ, ਤੁਸੀਂ ਸਹਿਮਤ ਹੋ",
        "Malayalam": "സൈൻ ഇൻ ചെയ്യുന്നതിലൂടെ, നിങ്ങൾ സമ്മതിക്കുന്നു", "Odia": "ସାଇନ୍ ଇନ୍ କରି, ଆପଣ ସମ୍ମତ ହୁଅନ୍ତି"
    },
    "Privacy notice": {
        "English": "Privacy notice", "Hindi": "गोपनीयता सूचना", "Kannada": "ಗೌಪ್ಯತೆ ಸೂಚನೆ",
        "Tamil": "தனியுரிமை அறிவிப்பு", "Telugu": "గోప్యతా నోటీసు", "Marathi": "गोपनीयता सूचना",
        "Bengali": "গোপনীয়তা বিজ্ঞপ্তি", "Gujarati": "ગોપનીયતા સૂચના", "Punjabi": "ਗੋਪਨੀਯਤਾ ਸੂਚਨਾ",
        "Malayalam": "സ്വകാര്യതാ അറിയിപ്പ്", "Odia": "ଗୋପନୀୟତା ସୂଚନା"
    },
    "and Terms.": {
        "English": "and Terms.", "Hindi": "और शर्तें।", "Kannada": "ಮತ್ತು ನಿಯಮಗಳು.",
        "Tamil": "மற்றும் விதிமுறைகள்.", "Telugu": "మరియు నిబంధనలు.", "Marathi": "आणि अटी.",
        "Bengali": "এবং শর্তাবলী।", "Gujarati": "અને શરતો.", "Punjabi": "ਅਤੇ ਨਿਯਮ।",
        "Malayalam": "ഒപ്പം നിബന്ധനകൾ.", "Odia": "ଏବଂ ସର୍ତ୍ତାବଳୀ।"
    },

    // ─── Wave 1: analytics-consent-dialog.tsx (GDPR/DPDP legal copy) ───
    "Help Us Improve SahayakAI": {
        "English": "Help Us Improve SahayakAI", "Hindi": "SahayakAI को बेहतर बनाने में हमारी मदद करें", "Kannada": "SahayakAI ಅನ್ನು ಸುಧಾರಿಸಲು ನಮಗೆ ಸಹಾಯ ಮಾಡಿ",
        "Tamil": "SahayakAI-ஐ மேம்படுத்த எங்களுக்கு உதவுங்கள்", "Telugu": "SahayakAI ను మెరుగుపరచడంలో మాకు సహాయం చేయండి", "Marathi": "SahayakAI सुधारण्यात आम्हाला मदत करा",
        "Bengali": "SahayakAI উন্নত করতে আমাদের সাহায্য করুন", "Gujarati": "SahayakAI સુધારવામાં અમારી મદદ કરો", "Punjabi": "SahayakAI ਨੂੰ ਬਿਹਤਰ ਬਣਾਉਣ ਵਿੱਚ ਸਾਡੀ ਮਦਦ ਕਰੋ",
        "Malayalam": "SahayakAI മെച്ചപ്പെടുത്താൻ ഞങ്ങളെ സഹായിക്കുക", "Odia": "SahayakAI କୁ ଉନ୍ନତ କରିବାରେ ଆମକୁ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    "We'd like to track how you use SahayakAI to:": {
        "English": "We'd like to track how you use SahayakAI to:",
        "Hindi": "हम ट्रैक करना चाहेंगे कि आप SahayakAI का उपयोग कैसे करते हैं ताकि:",
        "Kannada": "ನೀವು SahayakAI ಅನ್ನು ಹೇಗೆ ಬಳಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ನಾವು ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಬಯಸುತ್ತೇವೆ, ಇದರಿಂದ:",
        "Tamil": "நீங்கள் SahayakAI-ஐ எவ்வாறு பயன்படுத்துகிறீர்கள் என்பதைக் கண்காணிக்க விரும்புகிறோம், இதனால்:",
        "Telugu": "మీరు SahayakAI ను ఎలా ఉపయోగిస్తున్నారో ట్రాక్ చేయాలనుకుంటున్నాము, తద్వారా:",
        "Marathi": "तुम्ही SahayakAI चा वापर कसा करता याचा मागोवा घेऊ इच्छितो, जेणेकरून:",
        "Bengali": "আপনি কীভাবে SahayakAI ব্যবহার করেন তা আমরা ট্র্যাক করতে চাই, যাতে:",
        "Gujarati": "તમે SahayakAI નો ઉપયોગ કેવી રીતે કરો છો તે ટ્રૅક કરવા માંગીએ છીએ, જેથી:",
        "Punjabi": "ਅਸੀਂ ਟ੍ਰੈਕ ਕਰਨਾ ਚਾਹਾਂਗੇ ਕਿ ਤੁਸੀਂ SahayakAI ਦੀ ਵਰਤੋਂ ਕਿਵੇਂ ਕਰਦੇ ਹੋ, ਤਾਂ ਜੋ:",
        "Malayalam": "നിങ്ങൾ SahayakAI എങ്ങനെ ഉപയോഗിക്കുന്നു എന്ന് ട്രാക്ക് ചെയ്യാൻ ഞങ്ങൾ ആഗ്രഹിക്കുന്നു, അതുവഴി:",
        "Odia": "ଆପଣ SahayakAI କୁ କିପରି ବ୍ୟବହାର କରନ୍ତି ତାହା ଆମେ ଟ୍ରାକ୍ କରିବାକୁ ଚାହୁଁ, ଯାହାଦ୍ୱାରା:"
    },
    "Improve app performance and fix issues faster": {
        "English": "Improve app performance and fix issues faster",
        "Hindi": "ऐप के प्रदर्शन में सुधार करें और समस्याओं को तेज़ी से ठीक करें",
        "Kannada": "ಆಪ್ ಕಾರ್ಯಕ್ಷಮತೆಯನ್ನು ಸುಧಾರಿಸಿ ಮತ್ತು ಸಮಸ್ಯೆಗಳನ್ನು ವೇಗವಾಗಿ ಸರಿಪಡಿಸಿ",
        "Tamil": "ஆப் செயல்திறனை மேம்படுத்தி, சிக்கல்களை விரைவாக சரிசெய்க",
        "Telugu": "యాప్ పనితీరును మెరుగుపరచండి మరియు సమస్యలను వేగంగా పరిష్కరించండి",
        "Marathi": "अ‍ॅप कार्यप्रदर्शन सुधारा आणि समस्या जलद सोडवा",
        "Bengali": "অ্যাপ পারফরম্যান্স উন্নত করুন এবং সমস্যাগুলি দ্রুত ঠিক করুন",
        "Gujarati": "ઍપ પ્રદર્શન સુધારો અને સમસ્યાઓ ઝડપથી ઠીક કરો",
        "Punjabi": "ਐਪ ਪ੍ਰਦਰਸ਼ਨ ਨੂੰ ਬਿਹਤਰ ਬਣਾਓ ਅਤੇ ਸਮੱਸਿਆਵਾਂ ਨੂੰ ਤੇਜ਼ੀ ਨਾਲ ਠੀਕ ਕਰੋ",
        "Malayalam": "ആപ്പ് പ്രകടനം മെച്ചപ്പെടുത്തി പ്രശ്നങ്ങൾ വേഗത്തിൽ പരിഹരിക്കുക",
        "Odia": "ଆପ୍ ପ୍ରଦର୍ଶନ ଉନ୍ନତ କରନ୍ତୁ ଏବଂ ସମସ୍ୟାଗୁଡ଼ିକୁ ଶୀଘ୍ର ସମାଧାନ କରନ୍ତୁ"
    },
    "Understand which features help teachers most": {
        "English": "Understand which features help teachers most",
        "Hindi": "समझें कि कौन-सी सुविधाएँ शिक्षकों को सबसे अधिक मदद करती हैं",
        "Kannada": "ಯಾವ ವೈಶಿಷ್ಟ್ಯಗಳು ಶಿಕ್ಷಕರಿಗೆ ಹೆಚ್ಚು ಸಹಾಯ ಮಾಡುತ್ತವೆ ಎಂಬುದನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ",
        "Tamil": "எந்த அம்சங்கள் ஆசிரியர்களுக்கு அதிகம் உதவுகின்றன என்பதைப் புரிந்து கொள்ளுங்கள்",
        "Telugu": "ఏ ఫీచర్లు ఉపాధ్యాయులకు ఎక్కువగా సహాయపడతాయో అర్థం చేసుకోండి",
        "Marathi": "कोणती वैशिष्ट्ये शिक्षकांना सर्वाधिक मदत करतात हे समजून घ्या",
        "Bengali": "কোন বৈশিষ্ট্যগুলি শিক্ষকদের সবচেয়ে বেশি সাহায্য করে তা বুঝুন",
        "Gujarati": "કયા ફીચર્સ શિક્ષકોને સૌથી વધુ મદદ કરે છે તે સમજો",
        "Punjabi": "ਸਮਝੋ ਕਿ ਕਿਹੜੇ ਫੀਚਰ ਅਧਿਆਪਕਾਂ ਦੀ ਸਭ ਤੋਂ ਵੱਧ ਮਦਦ ਕਰਦੇ ਹਨ",
        "Malayalam": "ഏതു സവിശേഷതകൾ അധ്യാപകരെ ഏറ്റവും കൂടുതൽ സഹായിക്കുന്നു എന്ന് മനസ്സിലാക്കുക",
        "Odia": "କେଉଁ ବୈଶିଷ୍ଟ୍ୟଗୁଡ଼ିକ ଶିକ୍ଷକମାନଙ୍କୁ ସବୁଠାରୁ ଅଧିକ ସାହାଯ୍ୟ କରନ୍ତି ତାହା ବୁଝନ୍ତୁ"
    },
    "Provide personalized support if you're struggling": {
        "English": "Provide personalized support if you're struggling",
        "Hindi": "यदि आप संघर्ष कर रहे हैं तो व्यक्तिगत सहायता प्रदान करें",
        "Kannada": "ನೀವು ತೊಂದರೆ ಎದುರಿಸುತ್ತಿದ್ದರೆ ವೈಯಕ್ತಿಕ ಬೆಂಬಲವನ್ನು ಒದಗಿಸಿ",
        "Tamil": "நீங்கள் சிரமப்பட்டால் தனிப்பயனாக்கப்பட்ட ஆதரவை வழங்கவும்",
        "Telugu": "మీరు ఇబ్బంది పడుతున్నట్లయితే వ్యక్తిగతీకరించిన మద్దతును అందించండి",
        "Marathi": "तुम्ही अडचणीत असाल तर वैयक्तिकृत समर्थन प्रदान करा",
        "Bengali": "আপনি যদি সমস্যায় পড়েন তবে ব্যক্তিগতকৃত সহায়তা প্রদান করুন",
        "Gujarati": "જો તમે સંઘર્ષ કરી રહ્યા હો તો વ્યક્તિગત સહાય પૂરી પાડો",
        "Punjabi": "ਜੇ ਤੁਸੀਂ ਮੁਸ਼ਕਲ ਵਿੱਚ ਹੋ ਤਾਂ ਨਿੱਜੀ ਸਹਾਇਤਾ ਪ੍ਰਦਾਨ ਕਰੋ",
        "Malayalam": "നിങ്ങൾ ബുദ്ധിമുട്ടുകയാണെങ്കിൽ വ്യക്തിഗത പിന്തുണ നൽകുക",
        "Odia": "ଯଦି ଆପଣ ସଂଘର୍ଷ କରୁଛନ୍ତି ତେବେ ବ୍ୟକ୍ତିଗତ ସହାୟତା ପ୍ରଦାନ କରନ୍ତୁ"
    },
    "Measure our impact on students across India": {
        "English": "Measure our impact on students across India",
        "Hindi": "पूरे भारत के छात्रों पर हमारे प्रभाव को मापें",
        "Kannada": "ಭಾರತದಾದ್ಯಂತ ವಿದ್ಯಾರ್ಥಿಗಳ ಮೇಲೆ ನಮ್ಮ ಪರಿಣಾಮವನ್ನು ಅಳೆಯಿರಿ",
        "Tamil": "இந்தியா முழுவதும் மாணவர்கள் மீதான எங்கள் தாக்கத்தை அளவிடவும்",
        "Telugu": "భారతదేశం అంతటా విద్యార్థులపై మా ప్రభావాన్ని కొలవండి",
        "Marathi": "संपूर्ण भारतातील विद्यार्थ्यांवरील आमचा प्रभाव मोजा",
        "Bengali": "ভারত জুড়ে ছাত্রদের উপর আমাদের প্রভাব পরিমাপ করুন",
        "Gujarati": "ભારતભરના વિદ્યાર્થીઓ પર અમારી અસર માપો",
        "Punjabi": "ਪੂਰੇ ਭਾਰਤ ਦੇ ਵਿਦਿਆਰਥੀਆਂ 'ਤੇ ਸਾਡੇ ਪ੍ਰਭਾਵ ਨੂੰ ਮਾਪੋ",
        "Malayalam": "ഇന്ത്യയിലുടനീളമുള്ള വിദ്യാർത്ഥികളിലുള്ള ഞങ്ങളുടെ സ്വാധീനം അളക്കുക",
        "Odia": "ସମଗ୍ର ଭାରତର ଛାତ୍ରମାନଙ୍କ ଉପରେ ଆମର ପ୍ରଭାବ ମାପନ୍ତୁ"
    },
    "What we'll track:": {
        "English": "What we'll track:", "Hindi": "हम क्या ट्रैक करेंगे:", "Kannada": "ನಾವು ಏನನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡುತ್ತೇವೆ:",
        "Tamil": "நாங்கள் என்ன கண்காணிப்போம்:", "Telugu": "మేము ఏమి ట్రాక్ చేస్తాము:", "Marathi": "आम्ही काय ट्रॅक करू:",
        "Bengali": "আমরা কী ট্র্যাক করব:", "Gujarati": "અમે શું ટ્રૅક કરીશું:", "Punjabi": "ਅਸੀਂ ਕੀ ਟ੍ਰੈਕ ਕਰਾਂਗੇ:",
        "Malayalam": "ഞങ്ങൾ എന്ത് ട്രാക്ക് ചെയ്യും:", "Odia": "ଆମେ କଣ ଟ୍ରାକ୍ କରିବୁ:"
    },
    "Features you use and content you create": {
        "English": "Features you use and content you create",
        "Hindi": "आपके द्वारा उपयोग की जाने वाली सुविधाएँ और आपके द्वारा बनाई गई सामग्री",
        "Kannada": "ನೀವು ಬಳಸುವ ವೈಶಿಷ್ಟ್ಯಗಳು ಮತ್ತು ನೀವು ರಚಿಸುವ ವಿಷಯ",
        "Tamil": "நீங்கள் பயன்படுத்தும் அம்சங்கள் மற்றும் நீங்கள் உருவாக்கும் உள்ளடக்கம்",
        "Telugu": "మీరు ఉపయోగించే ఫీచర్లు మరియు మీరు సృష్టించే కంటెంట్",
        "Marathi": "तुम्ही वापरत असलेली वैशिष्ट्ये आणि तुम्ही तयार करत असलेली सामग्री",
        "Bengali": "আপনি যে বৈশিষ্ট্যগুলি ব্যবহার করেন এবং আপনি যে সামগ্রী তৈরি করেন",
        "Gujarati": "તમે વાપરો છો તે ફીચર્સ અને તમે બનાવો છો તે સામગ્રી",
        "Punjabi": "ਤੁਸੀਂ ਵਰਤਦੇ ਫੀਚਰ ਅਤੇ ਤੁਸੀਂ ਬਣਾਉਂਦੇ ਸਮੱਗਰੀ",
        "Malayalam": "നിങ്ങൾ ഉപയോഗിക്കുന്ന സവിശേഷതകളും നിങ്ങൾ സൃഷ്ടിക്കുന്ന ഉള്ളടക്കവും",
        "Odia": "ଆପଣ ବ୍ୟବହାର କରୁଥିବା ବୈଶିଷ୍ଟ୍ୟ ଏବଂ ଆପଣ ତିଆରି କରୁଥିବା ବିଷୟବସ୍ତୁ"
    },
    "App performance (load times, errors)": {
        "English": "App performance (load times, errors)",
        "Hindi": "ऐप प्रदर्शन (लोड समय, त्रुटियाँ)",
        "Kannada": "ಆಪ್ ಕಾರ್ಯಕ್ಷಮತೆ (ಲೋಡ್ ಸಮಯಗಳು, ದೋಷಗಳು)",
        "Tamil": "ஆப் செயல்திறன் (ஏற்றுதல் நேரங்கள், பிழைகள்)",
        "Telugu": "యాప్ పనితీరు (లోడ్ సమయాలు, లోపాలు)",
        "Marathi": "अ‍ॅप कार्यप्रदर्शन (लोड वेळा, त्रुटी)",
        "Bengali": "অ্যাপ পারফরম্যান্স (লোড সময়, ত্রুটি)",
        "Gujarati": "ઍપ પ્રદર્શન (લોડ સમય, ભૂલો)",
        "Punjabi": "ਐਪ ਪ੍ਰਦਰਸ਼ਨ (ਲੋਡ ਸਮਾਂ, ਗਲਤੀਆਂ)",
        "Malayalam": "ആപ്പ് പ്രകടനം (ലോഡ് സമയങ്ങൾ, പിശകുകൾ)",
        "Odia": "ଆପ୍ ପ୍ରଦର୍ଶନ (ଲୋଡ୍ ସମୟ, ତ୍ରୁଟି)"
    },
    "Your engagement patterns": {
        "English": "Your engagement patterns", "Hindi": "आपके जुड़ाव के पैटर्न", "Kannada": "ನಿಮ್ಮ ತೊಡಗಿಸಿಕೊಳ್ಳುವಿಕೆಯ ಮಾದರಿಗಳು",
        "Tamil": "உங்கள் ஈடுபாட்டு முறைகள்", "Telugu": "మీ నిమగ్నత నమూనాలు", "Marathi": "तुमचे सहभाग नमुने",
        "Bengali": "আপনার সম্পৃক্ততার ধরণ", "Gujarati": "તમારી જોડાણ પેટર્ન", "Punjabi": "ਤੁਹਾਡੇ ਜੁੜਾਅ ਦੇ ਪੈਟਰਨ",
        "Malayalam": "നിങ്ങളുടെ ഇടപഴകൽ പാറ്റേണുകൾ", "Odia": "ଆପଣଙ୍କ ସମ୍ପୃକ୍ତତା ଢାଞ୍ଚା"
    },
    "Privacy Promise:": {
        "English": "Privacy Promise:", "Hindi": "गोपनीयता का वादा:", "Kannada": "ಗೌಪ್ಯತೆ ಭರವಸೆ:",
        "Tamil": "தனியுரிமை வாக்குறுதி:", "Telugu": "గోప్యతా వాగ్దానం:", "Marathi": "गोपनीयतेचे वचन:",
        "Bengali": "গোপনীয়তার প্রতিশ্রুতি:", "Gujarati": "ગોપનીયતા વચન:", "Punjabi": "ਗੋਪਨੀਯਤਾ ਦਾ ਵਾਅਦਾ:",
        "Malayalam": "സ്വകാര്യതാ വാഗ്ദാനം:", "Odia": "ଗୋପନୀୟତା ପ୍ରତିଶ୍ରୁତି:"
    },
    "Your data stays secure in India": {
        "English": "Your data stays secure in India",
        "Hindi": "आपका डेटा भारत में सुरक्षित रहता है",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ ಭಾರತದಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿರುತ್ತದೆ",
        "Tamil": "உங்கள் தரவு இந்தியாவில் பாதுகாப்பாக இருக்கும்",
        "Telugu": "మీ డేటా భారతదేశంలో సురక్షితంగా ఉంటుంది",
        "Marathi": "तुमचा डेटा भारतात सुरक्षित राहतो",
        "Bengali": "আপনার ডেটা ভারতে সুরক্ষিত থাকে",
        "Gujarati": "તમારો ડેટા ભારતમાં સુરક્ષિત રહે છે",
        "Punjabi": "ਤੁਹਾਡਾ ਡੇਟਾ ਭਾਰਤ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਰਹਿੰਦਾ ਹੈ",
        "Malayalam": "നിങ്ങളുടെ ഡാറ്റ ഇന്ത്യയിൽ സുരക്ഷിതമായി തുടരുന്നു",
        "Odia": "ଆପଣଙ୍କ ଡାଟା ଭାରତରେ ସୁରକ୍ଷିତ ରହିଥାଏ"
    },
    "We'll keep data for 1 year, then delete it": {
        "English": "We'll keep data for 1 year, then delete it",
        "Hindi": "हम डेटा को 1 वर्ष तक रखेंगे, फिर हटा देंगे",
        "Kannada": "ನಾವು ಡೇಟಾವನ್ನು 1 ವರ್ಷದವರೆಗೆ ಇಡುತ್ತೇವೆ, ನಂತರ ಅದನ್ನು ಅಳಿಸುತ್ತೇವೆ",
        "Tamil": "நாங்கள் தரவை 1 ஆண்டுக்கு வைத்திருப்போம், பின்னர் அதை நீக்குவோம்",
        "Telugu": "మేము డేటాను 1 సంవత్సరం ఉంచుతాము, తరువాత దానిని తొలగిస్తాము",
        "Marathi": "आम्ही डेटा 1 वर्षासाठी ठेवू, नंतर तो हटवू",
        "Bengali": "আমরা 1 বছরের জন্য ডেটা রাখব, তারপর মুছে দেব",
        "Gujarati": "અમે 1 વર્ષ માટે ડેટા રાખીશું, પછી તેને કાઢી નાખીશું",
        "Punjabi": "ਅਸੀਂ ਡੇਟਾ ਨੂੰ 1 ਸਾਲ ਲਈ ਰੱਖਾਂਗੇ, ਫਿਰ ਇਸਨੂੰ ਮਿਟਾ ਦੇਵਾਂਗੇ",
        "Malayalam": "ഞങ്ങൾ ഡാറ്റ 1 വർഷം സൂക്ഷിക്കും, അതിനുശേഷം അത് ഇല്ലാതാക്കും",
        "Odia": "ଆମେ 1 ବର୍ଷ ପାଇଁ ଡାଟା ରଖିବୁ, ତା'ପରେ ତାହାକୁ ବିଲୋପ କରିବୁ"
    },
    "You can see your own analytics anytime": {
        "English": "You can see your own analytics anytime",
        "Hindi": "आप अपना एनालिटिक्स कभी भी देख सकते हैं",
        "Kannada": "ನೀವು ನಿಮ್ಮ ಸ್ವಂತ ವಿಶ್ಲೇಷಣೆಯನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ನೋಡಬಹುದು",
        "Tamil": "உங்கள் சொந்த அனலிட்டிக்ஸை எப்போது வேண்டுமானாலும் பார்க்கலாம்",
        "Telugu": "మీరు మీ స్వంత అనలిటిక్స్‌ను ఎప్పుడైనా చూడవచ్చు",
        "Marathi": "तुम्ही तुमचे स्वतःचे विश्लेषण कधीही पाहू शकता",
        "Bengali": "আপনি যেকোনো সময় আপনার নিজস্ব বিশ্লেষণ দেখতে পারেন",
        "Gujarati": "તમે ગમે ત્યારે તમારું પોતાનું વિશ્લેષણ જોઈ શકો છો",
        "Punjabi": "ਤੁਸੀਂ ਕਦੇ ਵੀ ਆਪਣੇ ਖੁਦ ਦੇ ਵਿਸ਼ਲੇਸ਼ਣ ਨੂੰ ਦੇਖ ਸਕਦੇ ਹੋ",
        "Malayalam": "നിങ്ങൾക്ക് എപ്പോൾ വേണമെങ്കിലും നിങ്ങളുടെ സ്വന്തം അനലിറ്റിക്സ് കാണാം",
        "Odia": "ଆପଣ ଯେକୌଣସି ସମୟରେ ଆପଣଙ୍କର ନିଜ ଆନାଲିଟିକ୍ସ ଦେଖିପାରିବେ"
    },
    "You can revoke consent anytime in settings": {
        "English": "You can revoke consent anytime in settings",
        "Hindi": "आप सेटिंग्स में कभी भी सहमति वापस ले सकते हैं",
        "Kannada": "ನೀವು ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಯಾವಾಗ ಬೇಕಾದರೂ ಸಮ್ಮತಿಯನ್ನು ಹಿಂಪಡೆಯಬಹುದು",
        "Tamil": "அமைப்புகளில் எப்போது வேண்டுமானாலும் ஒப்புதலை ரத்து செய்யலாம்",
        "Telugu": "మీరు సెట్టింగ్‌లలో ఎప్పుడైనా సమ్మతిని ఉపసంహరించుకోవచ్చు",
        "Marathi": "तुम्ही सेटिंग्जमध्ये कधीही संमती मागे घेऊ शकता",
        "Bengali": "আপনি যেকোনো সময় সেটিংসে সম্মতি প্রত্যাহার করতে পারেন",
        "Gujarati": "તમે ગમે ત્યારે સેટિંગ્સમાં સંમતિ રદ કરી શકો છો",
        "Punjabi": "ਤੁਸੀਂ ਕਦੇ ਵੀ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਸਹਿਮਤੀ ਰੱਦ ਕਰ ਸਕਦੇ ਹੋ",
        "Malayalam": "നിങ്ങൾക്ക് എപ്പോൾ വേണമെങ്കിലും ക്രമീകരണങ്ങളിൽ സമ്മതം പിൻവലിക്കാം",
        "Odia": "ଆପଣ ଯେକୌଣସି ସମୟରେ ସେଟିଂସ୍‌ରେ ସମ୍ମତି ପ୍ରତ୍ୟାହାର କରିପାରିବେ"
    },
    "I understand my activity will be tracked and data kept for 1 year": {
        "English": "I understand my activity will be tracked and data kept for 1 year",
        "Hindi": "मैं समझता हूँ कि मेरी गतिविधि ट्रैक की जाएगी और डेटा 1 वर्ष तक रखा जाएगा",
        "Kannada": "ನನ್ನ ಚಟುವಟಿಕೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಲಾಗುತ್ತದೆ ಮತ್ತು ಡೇಟಾವನ್ನು 1 ವರ್ಷದವರೆಗೆ ಇರಿಸಲಾಗುತ್ತದೆ ಎಂದು ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ",
        "Tamil": "எனது செயல்பாடு கண்காணிக்கப்படும் என்றும் தரவு 1 ஆண்டுக்கு வைக்கப்படும் என்றும் நான் புரிந்துகொள்கிறேன்",
        "Telugu": "నా కార్యకలాపం ట్రాక్ చేయబడుతుందని మరియు డేటా 1 సంవత్సరం ఉంచబడుతుందని నేను అర్థం చేసుకున్నాను",
        "Marathi": "मला समजते की माझ्या क्रियाकलापाचा मागोवा घेतला जाईल आणि डेटा 1 वर्षासाठी ठेवला जाईल",
        "Bengali": "আমি বুঝি যে আমার কার্যকলাপ ট্র্যাক করা হবে এবং ডেটা 1 বছর রাখা হবে",
        "Gujarati": "હું સમજું છું કે મારી પ્રવૃત્તિ ટ્રૅક કરવામાં આવશે અને ડેટા 1 વર્ષ માટે રાખવામાં આવશે",
        "Punjabi": "ਮੈਂ ਸਮਝਦਾ ਹਾਂ ਕਿ ਮੇਰੀ ਗਤੀਵਿਧੀ ਟ੍ਰੈਕ ਕੀਤੀ ਜਾਵੇਗੀ ਅਤੇ ਡੇਟਾ 1 ਸਾਲ ਲਈ ਰੱਖਿਆ ਜਾਵੇਗਾ",
        "Malayalam": "എന്റെ പ്രവർത്തനം ട്രാക്ക് ചെയ്യപ്പെടുമെന്നും ഡാറ്റ 1 വർഷം സൂക്ഷിക്കപ്പെടുമെന്നും ഞാൻ മനസ്സിലാക്കുന്നു",
        "Odia": "ମୁଁ ବୁଝୁଛି ଯେ ମୋର କାର୍ଯ୍ୟକଳାପ ଟ୍ରାକ୍ କରାଯିବ ଏବଂ ଡାଟା 1 ବର୍ଷ ପାଇଁ ରଖାଯିବ"
    },
    "No, Don't Track": {
        "English": "No, Don't Track", "Hindi": "नहीं, ट्रैक न करें", "Kannada": "ಇಲ್ಲ, ಟ್ರ್ಯಾಕ್ ಮಾಡಬೇಡಿ",
        "Tamil": "வேண்டாம், கண்காணிக்க வேண்டாம்", "Telugu": "వద్దు, ట్రాక్ చేయవద్దు", "Marathi": "नाही, ट्रॅक करू नका",
        "Bengali": "না, ট্র্যাক করবেন না", "Gujarati": "ના, ટ્રૅક ન કરો", "Punjabi": "ਨਹੀਂ, ਟ੍ਰੈਕ ਨਾ ਕਰੋ",
        "Malayalam": "വേണ്ട, ട്രാക്ക് ചെയ്യരുത്", "Odia": "ନା, ଟ୍ରାକ୍ କରନ୍ତୁ ନାହିଁ"
    },
    "Yes, Help Improve": {
        "English": "Yes, Help Improve", "Hindi": "हाँ, सुधार में मदद करें", "Kannada": "ಹೌದು, ಸುಧಾರಣೆಗೆ ಸಹಾಯ ಮಾಡಿ",
        "Tamil": "ஆம், மேம்படுத்த உதவுங்கள்", "Telugu": "అవును, మెరుగుపరచడంలో సహాయపడండి", "Marathi": "होय, सुधारण्यात मदत करा",
        "Bengali": "হ্যাঁ, উন্নত করতে সাহায্য করুন", "Gujarati": "હા, સુધારવામાં મદદ કરો", "Punjabi": "ਹਾਂ, ਸੁਧਾਰ ਵਿੱਚ ਮਦਦ ਕਰੋ",
        "Malayalam": "അതെ, മെച്ചപ്പെടുത്താൻ സഹായിക്കുക", "Odia": "ହଁ, ଉନ୍ନତିରେ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    "Saving...": {
        "English": "Saving...", "Hindi": "सहेजा जा रहा है...", "Kannada": "ಉಳಿಸಲಾಗುತ್ತಿದೆ...",
        "Tamil": "சேமிக்கிறது...", "Telugu": "సేవ్ చేస్తోంది...", "Marathi": "जतन करत आहे...",
        "Bengali": "সংরক্ষণ করা হচ্ছে...", "Gujarati": "સાચવી રહ્યું છે...", "Punjabi": "ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ...",
        "Malayalam": "സംരക്ഷിക്കുന്നു...", "Odia": "ସଞ୍ଚୟ କରୁଛି..."
    },
};

// BCP-47 language tags for each Language. Used for:
//   - <html lang> attribute (screen readers, hyphenation, Chrome auto-translate)
//   - Web Speech API's SpeechRecognition.lang (transcription in the right language)
//   - Google Cloud TTS voice selection (already mapped separately in tts/route.ts)
// Kept here (alongside the dictionary) so one edit covers both surfaces.
export const BCP47_MAP: Record<Language, string> = {
    English: 'en-IN',
    Hindi: 'hi-IN',
    Kannada: 'kn-IN',
    Tamil: 'ta-IN',
    Telugu: 'te-IN',
    Marathi: 'mr-IN',
    Bengali: 'bn-IN',
    Gujarati: 'gu-IN',
    Punjabi: 'pa-IN',
    Malayalam: 'ml-IN',
    Odia: 'or-IN',
};

// Sync <html lang> so screen readers pronounce correctly, browsers hyphenate
// in the right script, and Chrome's auto-translate doesn't offer a pointless
// "translate to English" on a Hindi page that is already Hindi.
function syncHtmlLang(lang: Language) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = BCP47_MAP[lang];
}

// Google Fonts families for each Indic script. English uses Inter already
// loaded in layout.tsx — no extra fetch needed. When the user picks a
// non-English language we inject the matching Noto Sans family so
// Devanagari/Tamil/etc. render with real glyph metrics instead of a jagged
// OEM fallback on low-end Androids.
const INDIC_FONT_URL: Partial<Record<Language, string>> = {
    Hindi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
    Marathi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
    Kannada: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap',
    Tamil: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap',
    Telugu: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap',
    Bengali: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap',
    Gujarati: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap',
    Punjabi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap',
    Malayalam: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap',
    Odia: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600;700&display=swap',
};

// Inject the Noto Sans family for the active language if not already loaded.
// English-only sessions pay nothing. Each non-English session downloads ~30 KB
// for its script. Idempotent: re-injecting the same URL is a no-op.
function ensureIndicFontLoaded(lang: Language) {
    if (typeof document === 'undefined') return;
    const url = INDIC_FONT_URL[lang];
    if (!url) return;
    if (document.querySelector(`link[data-indic-font="${lang}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.indicFont = lang;
    document.head.appendChild(link);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('English');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Restore from localStorage immediately (fast, before Firebase)
        try {
            const cached = localStorage.getItem('sahayakai-lang');
            if (cached && LANGUAGES.includes(cached as Language)) {
                setLanguageState(cached as Language);
                syncHtmlLang(cached as Language);
                ensureIndicFontLoaded(cached as Language);
            }
        } catch { /* localStorage unavailable (restricted WebView) */ }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const { profile } = await getProfileData(user.uid);
                if (profile?.preferredLanguage) {
                    setLanguageState(profile.preferredLanguage as Language);
                    syncHtmlLang(profile.preferredLanguage as Language);
                    ensureIndicFontLoaded(profile.preferredLanguage as Language);
                    try { localStorage.setItem('sahayakai-lang', profile.preferredLanguage); } catch {}
                }
            }
            setIsLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    const setLanguage = async (lang: Language, persist: boolean = true) => {
        setLanguageState(lang);
        syncHtmlLang(lang);
        ensureIndicFontLoaded(lang);
        try { localStorage.setItem('sahayakai-lang', lang); } catch {}
        if (!persist) return;

        const user = auth.currentUser;
        if (user) {
            await updateProfileAction(user.uid, { preferredLanguage: lang });

            // Keep VIDYA's jarvis.preferredLanguage in sync (fire-and-forget)
            user.getIdToken().then((idToken) =>
                fetch('/api/vidya/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({ profile: { preferredLanguage: lang } }),
                })
            ).catch(console.warn);
        }
    };

    const t = (key: string): string => {
        if (dictionary[key] && dictionary[key][language]) {
            return dictionary[key][language];
        }
        return key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isLoaded }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
