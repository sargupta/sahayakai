"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LANGUAGES } from '@/types';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getProfileData, updateProfileAction } from '@/lib/api/profile';

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
    "Your data is stored on Google Cloud in Singapore (Asia) and you control it.": {
        "English": "Your data is stored on Google Cloud in Singapore (Asia) and you control it.",
        "Hindi": "आपका डेटा Google Cloud पर सिंगापुर (एशिया) में संग्रहीत होता है और उस पर आपका नियंत्रण है।",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ Google Cloud ನಲ್ಲಿ ಸಿಂಗಾಪುರದಲ್ಲಿ (ಏಷ್ಯಾ) ಸಂಗ್ರಹವಾಗುತ್ತದೆ ಮತ್ತು ಅದನ್ನು ನೀವೇ ನಿಯಂತ್ರಿಸುತ್ತೀರಿ.",
        "Tamil": "உங்கள் தரவு Google Cloud இல் சிங்கப்பூரில் (ஆசியா) சேமிக்கப்படுகிறது, அதை நீங்கள் கட்டுப்படுத்துகிறீர்கள்.",
        "Telugu": "మీ డేటా Google Cloud లో సింగపూర్ (ఆసియా)లో నిల్వ చేయబడుతుంది మరియు మీరే దానిని నియంత్రిస్తారు.",
        "Marathi": "तुमचा डेटा Google Cloud वर सिंगापूर (आशिया) येथे साठवला जातो आणि तुम्ही त्यावर नियंत्रण ठेवता.",
        "Bengali": "আপনার ডেটা Google Cloud-এ সিঙ্গাপুরে (এশিয়া) সংরক্ষিত হয় এবং আপনি এটি নিয়ন্ত্রণ করেন।",
        "Gujarati": "તમારો ડેટા Google Cloud પર સિંગાપોર (એશિયા)માં સંગ્રહિત થાય છે અને તમે તેને નિયંત્રિત કરો છો.",
        "Punjabi": "ਤੁਹਾਡਾ ਡਾਟਾ Google Cloud 'ਤੇ ਸਿੰਗਾਪੁਰ (ਏਸ਼ੀਆ) ਵਿੱਚ ਸਟੋਰ ਹੁੰਦਾ ਹੈ ਅਤੇ ਤੁਸੀਂ ਇਸਨੂੰ ਕੰਟਰੋਲ ਕਰਦੇ ਹੋ।",
        "Malayalam": "നിങ്ങളുടെ ഡാറ്റ Google Cloud-ൽ സിംഗപ്പൂരിൽ (ഏഷ്യ) സംഭരിക്കുന്നു, അത് നിങ്ങൾ നിയന്ത്രിക്കുന്നു.",
        "Odia": "ଆପଣଙ୍କ ଡାଟା Google Cloud ରେ ସିଙ୍ଗାପୁର (ଏସିଆ)ରେ ସଂରକ୍ଷିତ ହୁଏ ଏବଂ ଆପଣ ଏହାକୁ ନିୟନ୍ତ୍ରଣ କରନ୍ତି।"
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
    "Your data is stored securely on Google Cloud servers in Singapore (Asia region)": {
        "English": "Your data is stored securely on Google Cloud servers in Singapore (Asia region)",
        "Hindi": "आपका डेटा Google Cloud सर्वर पर सिंगापुर (एशिया क्षेत्र) में सुरक्षित रूप से संग्रहीत होता है",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ Google Cloud ಸರ್ವರ್‌ಗಳಲ್ಲಿ ಸಿಂಗಾಪುರದಲ್ಲಿ (ಏಷ್ಯಾ ಪ್ರದೇಶ) ಸುರಕ್ಷಿತವಾಗಿ ಸಂಗ್ರಹವಾಗುತ್ತದೆ",
        "Tamil": "உங்கள் தரவு Google Cloud சேவையகங்களில் சிங்கப்பூரில் (ஆசியா பகுதி) பாதுகாப்பாக சேமிக்கப்படுகிறது",
        "Telugu": "మీ డేటా Google Cloud సర్వర్లలో సింగపూర్ (ఆసియా ప్రాంతం)లో సురక్షితంగా నిల్వ చేయబడుతుంది",
        "Marathi": "तुमचा डेटा Google Cloud सर्व्हरवर सिंगापूर (आशिया क्षेत्र) येथे सुरक्षितपणे साठवला जातो",
        "Bengali": "আপনার ডেটা Google Cloud সার্ভারে সিঙ্গাপুরে (এশিয়া অঞ্চল) সুরক্ষিতভাবে সংরক্ষিত হয়",
        "Gujarati": "તમારો ડેટા Google Cloud સર્વર પર સિંગાપોર (એશિયા પ્રદેશ)માં સુરક્ષિત રીતે સંગ્રહિત થાય છે",
        "Punjabi": "ਤੁਹਾਡਾ ਡਾਟਾ Google Cloud ਸਰਵਰਾਂ 'ਤੇ ਸਿੰਗਾਪੁਰ (ਏਸ਼ੀਆ ਖੇਤਰ) ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਸਟੋਰ ਹੁੰਦਾ ਹੈ",
        "Malayalam": "നിങ്ങളുടെ ഡാറ്റ Google Cloud സെർവറുകളിൽ സിംഗപ്പൂരിൽ (ഏഷ്യ മേഖല) സുരക്ഷിതമായി സംഭരിക്കുന്നു",
        "Odia": "ଆପଣଙ୍କ ଡାଟା Google Cloud ସର୍ଭରରେ ସିଙ୍ଗାପୁର (ଏସିଆ ଅଞ୍ଚଳ)ରେ ସୁରକ୍ଷିତ ଭାବେ ସଂରକ୍ଷିତ ହୁଏ"
    },
    "Your data is processed outside India; by continuing you consent to this cross-border transfer": {
        "English": "Your data is processed outside India; by continuing you consent to this cross-border transfer",
        "Hindi": "आपका डेटा भारत के बाहर संसाधित होता है; जारी रखकर आप इस सीमा-पार स्थानांतरण के लिए सहमति देते हैं",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ ಭಾರತದ ಹೊರಗೆ ಸಂಸ್ಕರಿಸಲ್ಪಡುತ್ತದೆ; ಮುಂದುವರಿಯುವ ಮೂಲಕ ನೀವು ಈ ಗಡಿ-ದಾಟಿದ ವರ್ಗಾವಣೆಗೆ ಒಪ್ಪಿಗೆ ನೀಡುತ್ತೀರಿ",
        "Tamil": "உங்கள் தரவு இந்தியாவுக்கு வெளியே செயலாக்கப்படுகிறது; தொடர்வதன் மூலம் இந்த எல்லை தாண்டிய பரிமாற்றத்திற்கு நீங்கள் ஒப்புதல் அளிக்கிறீர்கள்",
        "Telugu": "మీ డేటా భారతదేశం వెలుపల ప్రాసెస్ చేయబడుతుంది; కొనసాగించడం ద్వారా మీరు ఈ సరిహద్దు-దాటిన బదిలీకి సమ్మతిస్తారు",
        "Marathi": "तुमचा डेटा भारताबाहेर प्रक्रिया केला जातो; पुढे चालू ठेवून तुम्ही या सीमापार हस्तांतरणास संमती देता",
        "Bengali": "আপনার ডেটা ভারতের বাইরে প্রক্রিয়া করা হয়; চালিয়ে যাওয়ার মাধ্যমে আপনি এই আন্তঃসীমান্ত স্থানান্তরে সম্মতি দেন",
        "Gujarati": "તમારો ડેટા ભારતની બહાર પ્રક્રિયા થાય છે; ચાલુ રાખીને તમે આ સીમાપાર સ્થાનાંતરણ માટે સંમતિ આપો છો",
        "Punjabi": "ਤੁਹਾਡਾ ਡਾਟਾ ਭਾਰਤ ਤੋਂ ਬਾਹਰ ਪ੍ਰੋਸੈੱਸ ਹੁੰਦਾ ਹੈ; ਜਾਰੀ ਰੱਖ ਕੇ ਤੁਸੀਂ ਇਸ ਸਰਹੱਦ-ਪਾਰ ਤਬਾਦਲੇ ਲਈ ਸਹਿਮਤੀ ਦਿੰਦੇ ਹੋ",
        "Malayalam": "നിങ്ങളുടെ ഡാറ്റ ഇന്ത്യയ്ക്ക് പുറത്ത് പ്രോസസ് ചെയ്യുന്നു; തുടരുന്നതിലൂടെ ഈ അതിർത്തി കടന്നുള്ള കൈമാറ്റത്തിന് നിങ്ങൾ സമ്മതിക്കുന്നു",
        "Odia": "ଆପଣଙ୍କ ଡାଟା ଭାରତ ବାହାରେ ପ୍ରକ୍ରିୟାକରଣ ହୁଏ; ଜାରି ରଖି ଆପଣ ଏହି ସୀମା-ପାର ସ୍ଥାନାନ୍ତରଣକୁ ସମ୍ମତି ଦିଅନ୍ତି"
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
    // ── Messages stack (Wave 1 i18n) ──────────────────────────────────────
    "Your Messages": {
        "English": "Your Messages", "Hindi": "आपके संदेश", "Kannada": "ನಿಮ್ಮ ಸಂದೇಶಗಳು",
        "Tamil": "உங்கள் செய்திகள்", "Telugu": "మీ సందేశాలు", "Marathi": "तुमचे संदेश",
        "Bengali": "আপনার বার্তা", "Gujarati": "તમારા સંદેશા", "Punjabi": "ਤੁਹਾਡੇ ਸੁਨੇਹੇ",
        "Malayalam": "നിങ്ങളുടെ സന്ദേശങ്ങൾ", "Odia": "ଆପଣଙ୍କର ସନ୍ଦେଶ"
    },
    "Connect with teachers in the Community to start messaging. When someone accepts your connection request, you can chat here.": {
        "English": "Connect with teachers in the Community to start messaging. When someone accepts your connection request, you can chat here.",
        "Hindi": "संदेश भेजना शुरू करने के लिए समुदाय में शिक्षकों से जुड़ें। जब कोई आपके कनेक्शन अनुरोध को स्वीकार करे, तो आप यहाँ बातचीत कर सकते हैं।",
        "Kannada": "ಸಂದೇಶ ಕಳುಹಿಸಲು ಪ್ರಾರಂಭಿಸಲು ಸಮುದಾಯದಲ್ಲಿ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಿ. ಯಾರಾದರೂ ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿನಂತಿಯನ್ನು ಸ್ವೀಕರಿಸಿದಾಗ, ನೀವು ಇಲ್ಲಿ ಚಾಟ್ ಮಾಡಬಹುದು.",
        "Tamil": "செய்தி அனுப்பத் தொடங்க சமூகத்தில் ஆசிரியர்களுடன் இணையுங்கள். யாராவது உங்கள் இணைப்பு கோரிக்கையை ஏற்றுக்கொண்டால், நீங்கள் இங்கே அரட்டை அடிக்கலாம்.",
        "Telugu": "సందేశం పంపడం ప్రారంభించడానికి సంఘంలోని ఉపాధ్యాయులతో కనెక్ట్ అవ్వండి. ఎవరైనా మీ కనెక్షన్ అభ్యర్థనను అంగీకరించినప్పుడు, మీరు ఇక్కడ చాట్ చేయవచ్చు.",
        "Marathi": "संदेश पाठवण्यास सुरुवात करण्यासाठी समुदायातील शिक्षकांशी जोडा. कोणीतरी तुमची कनेक्शन विनंती स्वीकारली की, तुम्ही येथे चॅट करू शकता.",
        "Bengali": "বার্তা পাঠানো শুরু করতে কমিউনিটিতে শিক্ষকদের সাথে সংযোগ করুন। কেউ আপনার সংযোগের অনুরোধ গ্রহণ করলে, আপনি এখানে চ্যাট করতে পারবেন।",
        "Gujarati": "મેસેજિંગ શરૂ કરવા સમુદાયમાં શિક્ષકો સાથે જોડાઓ. જ્યારે કોઈ તમારી કનેક્શન વિનંતી સ્વીકારે, ત્યારે તમે અહીં ચેટ કરી શકો છો.",
        "Punjabi": "ਸੁਨੇਹਾ ਭੇਜਣਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਭਾਈਚਾਰੇ ਵਿੱਚ ਅਧਿਆਪਕਾਂ ਨਾਲ ਜੁੜੋ। ਜਦੋਂ ਕੋਈ ਤੁਹਾਡੀ ਕਨੈਕਸ਼ਨ ਬੇਨਤੀ ਸਵੀਕਾਰ ਕਰੇ, ਤਾਂ ਤੁਸੀਂ ਇੱਥੇ ਚੈਟ ਕਰ ਸਕਦੇ ਹੋ।",
        "Malayalam": "സന്ദേശം അയക്കാൻ ആരംഭിക്കാൻ കമ്മ്യൂണിറ്റിയിലെ അധ്യാപകരുമായി ബന്ധപ്പെടുക. ആരെങ്കിലും നിങ്ങളുടെ കണക്ഷൻ അഭ്യർത്ഥന സ്വീകരിക്കുമ്പോൾ, നിങ്ങൾക്ക് ഇവിടെ ചാറ്റ് ചെയ്യാം.",
        "Odia": "ସନ୍ଦେଶ ପଠାଇବା ଆରମ୍ଭ କରିବାକୁ ସମ୍ପ୍ରଦାୟର ଶିକ୍ଷକମାନଙ୍କ ସହ ସଂଯୋଗ କରନ୍ତୁ। କେହି ଆପଣଙ୍କର ସଂଯୋଗ ଅନୁରୋଧ ଗ୍ରହଣ କଲେ, ଆପଣ ଏଠାରେ ଚାଟ୍ କରିପାରିବେ।"
    },
    "Find Teachers": {
        "English": "Find Teachers", "Hindi": "शिक्षक खोजें", "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ",
        "Tamil": "ஆசிரியர்களைக் கண்டறிக", "Telugu": "ఉపాధ్యాయులను కనుగొనండి", "Marathi": "शिक्षक शोधा",
        "Bengali": "শিক্ষক খুঁজুন", "Gujarati": "શિક્ષકો શોધો", "Punjabi": "ਅਧਿਆਪਕ ਲੱਭੋ",
        "Malayalam": "അധ്യാപകരെ കണ്ടെത്തുക", "Odia": "ଶିକ୍ଷକ ଖୋଜନ୍ତୁ"
    },
    "Search conversations…": {
        "English": "Search conversations…", "Hindi": "बातचीत खोजें…", "Kannada": "ಸಂಭಾಷಣೆಗಳನ್ನು ಹುಡುಕಿ…",
        "Tamil": "உரையாடல்களைத் தேடு…", "Telugu": "సంభాషణలను శోధించండి…", "Marathi": "संभाषणे शोधा…",
        "Bengali": "কথোপকথন খুঁজুন…", "Gujarati": "વાર્તાલાપો શોધો…", "Punjabi": "ਗੱਲਬਾਤ ਖੋਜੋ…",
        "Malayalam": "സംഭാഷണങ്ങൾ തിരയുക…", "Odia": "କଥୋପକଥନ ଖୋଜନ୍ତୁ…"
    },
    "No messages yet": {
        "English": "No messages yet", "Hindi": "अभी कोई संदेश नहीं", "Kannada": "ಇನ್ನೂ ಯಾವುದೇ ಸಂದೇಶಗಳಿಲ್ಲ",
        "Tamil": "இன்னும் செய்திகள் இல்லை", "Telugu": "ఇంకా సందేశాలు లేవు", "Marathi": "अद्याप कोणतेही संदेश नाहीत",
        "Bengali": "এখনও কোনো বার্তা নেই", "Gujarati": "હજુ સુધી કોઈ સંદેશા નથી", "Punjabi": "ਅਜੇ ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ",
        "Malayalam": "ഇതുവരെ സന്ദേശങ്ങളൊന്നുമില്ല", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ସନ୍ଦେଶ ନାହିଁ"
    },
    "Use the button above to find a teacher and start a conversation.": {
        "English": "Use the button above to find a teacher and start a conversation.",
        "Hindi": "किसी शिक्षक को खोजने और बातचीत शुरू करने के लिए ऊपर दिए बटन का उपयोग करें।",
        "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಲು ಮತ್ತು ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಲು ಮೇಲಿನ ಬಟನ್ ಬಳಸಿ.",
        "Tamil": "ஆசிரியரைக் கண்டறிந்து உரையாடலைத் தொடங்க மேலே உள்ள பொத்தானைப் பயன்படுத்தவும்.",
        "Telugu": "ఉపాధ్యాయుడిని కనుగొనడానికి మరియు సంభాషణను ప్రారంభించడానికి పైన ఉన్న బటన్‌ను ఉపయోగించండి.",
        "Marathi": "शिक्षक शोधण्यासाठी आणि संभाषण सुरू करण्यासाठी वरील बटण वापरा.",
        "Bengali": "একজন শিক্ষক খুঁজে পেতে এবং কথোপকথন শুরু করতে উপরের বোতামটি ব্যবহার করুন।",
        "Gujarati": "શિક્ષક શોધવા અને વાર્તાલાપ શરૂ કરવા માટે ઉપરના બટનનો ઉપયોગ કરો.",
        "Punjabi": "ਅਧਿਆਪਕ ਲੱਭਣ ਅਤੇ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਉੱਪਰ ਦਿੱਤੇ ਬਟਨ ਦੀ ਵਰਤੋਂ ਕਰੋ।",
        "Malayalam": "ഒരു അധ്യാപകനെ കണ്ടെത്താനും സംഭാഷണം ആരംഭിക്കാനും മുകളിലുള്ള ബട്ടൺ ഉപയോഗിക്കുക.",
        "Odia": "ଜଣେ ଶିକ୍ଷକ ଖୋଜିବାକୁ ଏବଂ କଥୋପକଥନ ଆରମ୍ଭ କରିବାକୁ ଉପର ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "New message": {
        "English": "New message", "Hindi": "नया संदेश", "Kannada": "ಹೊಸ ಸಂದೇಶ",
        "Tamil": "புதிய செய்தி", "Telugu": "కొత్త సందేశం", "Marathi": "नवीन संदेश",
        "Bengali": "নতুন বার্তা", "Gujarati": "નવો સંદેશ", "Punjabi": "ਨਵਾਂ ਸੁਨੇਹਾ",
        "Malayalam": "പുതിയ സന്ദേശം", "Odia": "ନୂତନ ସନ୍ଦେଶ"
    },
    "Group": {
        "English": "Group", "Hindi": "समूह", "Kannada": "ಗುಂಪು",
        "Tamil": "குழு", "Telugu": "సమూహం", "Marathi": "गट",
        "Bengali": "গ্রুপ", "Gujarati": "જૂથ", "Punjabi": "ਸਮੂਹ",
        "Malayalam": "ഗ്രൂപ്പ്", "Odia": "ଗୋଷ୍ଠୀ"
    },
    "Chat": {
        "English": "Chat", "Hindi": "चैट", "Kannada": "ಚಾಟ್",
        "Tamil": "அரட்டை", "Telugu": "చాట్", "Marathi": "चॅट",
        "Bengali": "চ্যাট", "Gujarati": "ચેટ", "Punjabi": "ਚੈਟ",
        "Malayalam": "ചാറ്റ്", "Odia": "ଚାଟ୍"
    },
    "Start a conversation": {
        "English": "Start a conversation", "Hindi": "बातचीत शुरू करें", "Kannada": "ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "உரையாடலைத் தொடங்கு", "Telugu": "సంభాషణ ప్రారంభించండి", "Marathi": "संभाषण सुरू करा",
        "Bengali": "কথোপকথন শুরু করুন", "Gujarati": "વાર્તાલાપ શરૂ કરો", "Punjabi": "ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "ഒരു സംഭാഷണം ആരംഭിക്കുക", "Odia": "ଏକ କଥୋପକଥନ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "You: ": {
        "English": "You: ", "Hindi": "आप: ", "Kannada": "ನೀವು: ",
        "Tamil": "நீங்கள்: ", "Telugu": "మీరు: ", "Marathi": "तुम्ही: ",
        "Bengali": "আপনি: ", "Gujarati": "તમે: ", "Punjabi": "ਤੁਸੀਂ: ",
        "Malayalam": "നിങ്ങൾ: ", "Odia": "ଆପଣ: "
    },
    "Start the conversation": {
        "English": "Start the conversation", "Hindi": "बातचीत शुरू करें", "Kannada": "ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "உரையாடலைத் தொடங்கு", "Telugu": "సంభాషణను ప్రారంభించండి", "Marathi": "संभाषण सुरू करा",
        "Bengali": "কথোপকথন শুরু করুন", "Gujarati": "વાર્તાલાપ શરૂ કરો", "Punjabi": "ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ",
        "Malayalam": "സംഭാഷണം ആരംഭിക്കുക", "Odia": "କଥୋପକଥନ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Send a message or share a teaching resource.": {
        "English": "Send a message or share a teaching resource.",
        "Hindi": "संदेश भेजें या शिक्षण संसाधन साझा करें।",
        "Kannada": "ಸಂದೇಶ ಕಳುಹಿಸಿ ಅಥವಾ ಬೋಧನಾ ಸಂಪನ್ಮೂಲವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
        "Tamil": "செய்தி அனுப்பவும் அல்லது கற்பித்தல் வளத்தைப் பகிரவும்.",
        "Telugu": "సందేశం పంపండి లేదా బోధనా వనరును పంచుకోండి.",
        "Marathi": "संदेश पाठवा किंवा शिकवण्याचे साधन शेअर करा.",
        "Bengali": "বার্তা পাঠান বা একটি শিক্ষণ সম্পদ শেয়ার করুন।",
        "Gujarati": "સંદેશ મોકલો અથવા શિક્ષણ સંસાધન શેર કરો.",
        "Punjabi": "ਸੁਨੇਹਾ ਭੇਜੋ ਜਾਂ ਅਧਿਆਪਨ ਸਰੋਤ ਸਾਂਝਾ ਕਰੋ।",
        "Malayalam": "ഒരു സന്ദേശം അയയ്ക്കുക അല്ലെങ്കിൽ ഒരു അധ്യാപന വിഭവം പങ്കിടുക.",
        "Odia": "ଏକ ସନ୍ଦେଶ ପଠାନ୍ତୁ କିମ୍ବା ଶିକ୍ଷାଦାନ ସମ୍ବଳ ସେୟାର କରନ୍ତୁ।"
    },
    "Share a resource": {
        "English": "Share a resource", "Hindi": "संसाधन साझा करें", "Kannada": "ಸಂಪನ್ಮೂಲ ಹಂಚಿಕೊಳ್ಳಿ",
        "Tamil": "ஒரு வளத்தைப் பகிர்", "Telugu": "వనరును పంచుకోండి", "Marathi": "साधन शेअर करा",
        "Bengali": "একটি সম্পদ শেয়ার করুন", "Gujarati": "સંસાધન શેર કરો", "Punjabi": "ਸਰੋਤ ਸਾਂਝਾ ਕਰੋ",
        "Malayalam": "ഒരു വിഭവം പങ്കിടുക", "Odia": "ଏକ ସମ୍ବଳ ସେୟାର କରନ୍ତୁ"
    },
    "Share": {
        "English": "Share", "Hindi": "साझा करें", "Kannada": "ಹಂಚಿಕೊಳ್ಳಿ",
        "Tamil": "பகிர்", "Telugu": "పంచుకోండి", "Marathi": "शेअर करा",
        "Bengali": "শেয়ার করুন", "Gujarati": "શેર કરો", "Punjabi": "ਸਾਂਝਾ ਕਰੋ",
        "Malayalam": "പങ്കിടുക", "Odia": "ସେୟାର କରନ୍ତୁ"
    },
    "Topic / Title *": {
        "English": "Topic / Title *", "Hindi": "विषय / शीर्षक *", "Kannada": "ವಿಷಯ / ಶೀರ್ಷಿಕೆ *",
        "Tamil": "தலைப்பு / பெயர் *", "Telugu": "విషయం / శీర్షిక *", "Marathi": "विषय / शीर्षक *",
        "Bengali": "বিষয় / শিরোনাম *", "Gujarati": "વિષય / શીર્ષક *", "Punjabi": "ਵਿਸ਼ਾ / ਸਿਰਲੇਖ *",
        "Malayalam": "വിഷയം / തലക്കെട്ട് *", "Odia": "ବିଷୟ / ଶିରୋନାମା *"
    },
    "Class (optional)": {
        "English": "Class (optional)", "Hindi": "कक्षा (वैकल्पिक)", "Kannada": "ತರಗತಿ (ಐಚ್ಛಿಕ)",
        "Tamil": "வகுப்பு (விருப்பம்)", "Telugu": "తరగతి (ఐచ్ఛికం)", "Marathi": "वर्ग (ऐच्छिक)",
        "Bengali": "শ্রেণী (ঐচ্ছিক)", "Gujarati": "વર્ગ (વૈકલ્પિક)", "Punjabi": "ਜਮਾਤ (ਵਿਕਲਪਿਕ)",
        "Malayalam": "ക്ലാസ് (ഓപ്ഷണൽ)", "Odia": "ଶ୍ରେଣୀ (ଇଚ୍ଛାଧୀନ)"
    },
    "Subject (optional)": {
        "English": "Subject (optional)", "Hindi": "विषय (वैकल्पिक)", "Kannada": "ವಿಷಯ (ಐಚ್ಛಿಕ)",
        "Tamil": "பாடம் (விருப்பம்)", "Telugu": "సబ్జెక్ట్ (ఐచ్ఛికం)", "Marathi": "विषय (ऐच्छिक)",
        "Bengali": "বিষয় (ঐচ্ছিক)", "Gujarati": "વિષય (વૈકલ્પિક)", "Punjabi": "ਵਿਸ਼ਾ (ਵਿਕਲਪਿਕ)",
        "Malayalam": "വിഷയം (ഓപ്ഷണൽ)", "Odia": "ବିଷୟ (ଇଚ୍ଛାଧୀନ)"
    },
    "Add a message (optional)": {
        "English": "Add a message (optional)", "Hindi": "एक संदेश जोड़ें (वैकल्पिक)", "Kannada": "ಸಂದೇಶ ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)",
        "Tamil": "ஒரு செய்தியைச் சேர் (விருப்பம்)", "Telugu": "సందేశం జోడించండి (ఐచ్ఛికం)", "Marathi": "संदेश जोडा (ऐच्छिक)",
        "Bengali": "একটি বার্তা যোগ করুন (ঐচ্ছিক)", "Gujarati": "સંદેશ ઉમેરો (વૈકલ્પિક)", "Punjabi": "ਸੁਨੇਹਾ ਜੋੜੋ (ਵਿਕਲਪਿਕ)",
        "Malayalam": "ഒരു സന്ദേശം ചേർക്കുക (ഓപ്ഷണൽ)", "Odia": "ଏକ ସନ୍ଦେଶ ଯୋଡନ୍ତୁ (ଇଚ୍ଛାଧୀନ)"
    },
    "Share Resource": {
        "English": "Share Resource", "Hindi": "संसाधन साझा करें", "Kannada": "ಸಂಪನ್ಮೂಲ ಹಂಚಿಕೊಳ್ಳಿ",
        "Tamil": "வளத்தைப் பகிர்", "Telugu": "వనరును పంచుకోండి", "Marathi": "साधन शेअर करा",
        "Bengali": "সম্পদ শেয়ার করুন", "Gujarati": "સંસાધન શેર કરો", "Punjabi": "ਸਰੋਤ ਸਾਂਝਾ ਕਰੋ",
        "Malayalam": "വിഭവം പങ്കിടുക", "Odia": "ସମ୍ବଳ ସେୟାର କରନ୍ତୁ"
    },
    "Sign in to send messages.": {
        "English": "Sign in to send messages.", "Hindi": "संदेश भेजने के लिए साइन इन करें।", "Kannada": "ಸಂದೇಶಗಳನ್ನು ಕಳುಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
        "Tamil": "செய்திகளை அனுப்ப உள்நுழைக.", "Telugu": "సందేశాలను పంపడానికి సైన్ ఇన్ చేయండి.", "Marathi": "संदेश पाठवण्यासाठी साइन इन करा.",
        "Bengali": "বার্তা পাঠাতে সাইন ইন করুন।", "Gujarati": "સંદેશા મોકલવા માટે સાઇન ઇન કરો.", "Punjabi": "ਸੁਨੇਹੇ ਭੇਜਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
        "Malayalam": "സന്ദേശങ്ങൾ അയക്കാൻ സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ସନ୍ଦେଶ ପଠାଇବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Type a message…": {
        "English": "Type a message… (Enter to send, Shift+Enter for new line)",
        "Hindi": "संदेश लिखें… (भेजने के लिए Enter, नई पंक्ति के लिए Shift+Enter)",
        "Kannada": "ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ… (ಕಳುಹಿಸಲು Enter, ಹೊಸ ಸಾಲಿಗಾಗಿ Shift+Enter)",
        "Tamil": "ஒரு செய்தியை தட்டச்சு செய்க… (அனுப்ப Enter, புதிய வரிக்கு Shift+Enter)",
        "Telugu": "సందేశం టైప్ చేయండి… (పంపడానికి Enter, కొత్త లైన్ కోసం Shift+Enter)",
        "Marathi": "संदेश टाइप करा… (पाठवण्यासाठी Enter, नवीन ओळीसाठी Shift+Enter)",
        "Bengali": "একটি বার্তা টাইপ করুন… (পাঠাতে Enter, নতুন লাইনের জন্য Shift+Enter)",
        "Gujarati": "સંદેશ ટાઇપ કરો… (મોકલવા માટે Enter, નવી લાઇન માટે Shift+Enter)",
        "Punjabi": "ਸੁਨੇਹਾ ਟਾਈਪ ਕਰੋ… (ਭੇਜਣ ਲਈ Enter, ਨਵੀਂ ਲਾਈਨ ਲਈ Shift+Enter)",
        "Malayalam": "ഒരു സന്ദേശം ടൈപ്പ് ചെയ്യുക… (അയക്കാൻ Enter, പുതിയ വരിക്ക് Shift+Enter)",
        "Odia": "ଏକ ସନ୍ଦେଶ ଟାଇପ୍ କରନ୍ତୁ… (ପଠାଇବାକୁ Enter, ନୂତନ ଲାଇନ୍ ପାଇଁ Shift+Enter)"
    },
    "Sending…": {
        "English": "Sending…", "Hindi": "भेजा जा रहा है…", "Kannada": "ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…",
        "Tamil": "அனுப்புகிறது…", "Telugu": "పంపుతోంది…", "Marathi": "पाठवत आहे…",
        "Bengali": "পাঠানো হচ্ছে…", "Gujarati": "મોકલી રહ્યું છે…", "Punjabi": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
        "Malayalam": "അയക്കുന്നു…", "Odia": "ପଠାଯାଉଛି…"
    },
    "Send": {
        "English": "Send", "Hindi": "भेजें", "Kannada": "ಕಳುಹಿಸಿ",
        "Tamil": "அனுப்பு", "Telugu": "పంపండి", "Marathi": "पाठवा",
        "Bengali": "পাঠান", "Gujarati": "મોકલો", "Punjabi": "ਭੇਜੋ",
        "Malayalam": "അയക്കുക", "Odia": "ପଠାନ୍ତୁ"
    },
    "Record voice message": {
        "English": "Record voice message", "Hindi": "वॉइस संदेश रिकॉर्ड करें", "Kannada": "ಧ್ವನಿ ಸಂದೇಶವನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಿ",
        "Tamil": "குரல் செய்தியைப் பதிவு செய்க", "Telugu": "వాయిస్ సందేశాన్ని రికార్డ్ చేయండి", "Marathi": "व्हॉइस संदेश रेकॉर्ड करा",
        "Bengali": "ভয়েস বার্তা রেকর্ড করুন", "Gujarati": "વૉઇસ સંદેશ રેકોર્ડ કરો", "Punjabi": "ਆਵਾਜ਼ ਸੁਨੇਹਾ ਰਿਕਾਰਡ ਕਰੋ",
        "Malayalam": "വോയ്സ് സന്ദേശം റെക്കോർഡ് ചെയ്യുക", "Odia": "ଭଏସ୍ ସନ୍ଦେଶ ରେକର୍ଡ କରନ୍ତୁ"
    },
    "Resource": {
        "English": "Resource", "Hindi": "संसाधन", "Kannada": "ಸಂಪನ್ಮೂಲ",
        "Tamil": "வளம்", "Telugu": "వనరు", "Marathi": "साधन",
        "Bengali": "সম্পদ", "Gujarati": "સંસાધન", "Punjabi": "ਸਰੋਤ",
        "Malayalam": "വിഭവം", "Odia": "ସମ୍ବଳ"
    },
    "Open in Tool": {
        "English": "Open in Tool", "Hindi": "टूल में खोलें", "Kannada": "ಟೂಲ್‌ನಲ್ಲಿ ತೆರೆಯಿರಿ",
        "Tamil": "கருவியில் திற", "Telugu": "టూల్‌లో తెరవండి", "Marathi": "टूलमध्ये उघडा",
        "Bengali": "টুলে খুলুন", "Gujarati": "ટૂલમાં ખોલો", "Punjabi": "ਟੂਲ ਵਿੱਚ ਖੋਲ੍ਹੋ",
        "Malayalam": "ടൂളിൽ തുറക്കുക", "Odia": "ଟୁଲରେ ଖୋଲନ୍ତୁ"
    },
    "Worksheet": {
        "English": "Worksheet", "Hindi": "वर्कशीट", "Kannada": "ವರ್ಕ್‌ಶೀಟ್",
        "Tamil": "பணித்தாள்", "Telugu": "వర్క్‌షీట్", "Marathi": "वर्कशीट",
        "Bengali": "ওয়ার্কশীট", "Gujarati": "વર્કશીટ", "Punjabi": "ਵਰਕਸ਼ੀਟ",
        "Malayalam": "വർക്ക്‌ഷീറ്റ്", "Odia": "ୱର୍କସିଟ୍"
    },
    "Field Trip": {
        "English": "Field Trip", "Hindi": "फील्ड ट्रिप", "Kannada": "ಕ್ಷೇತ್ರ ಪ್ರವಾಸ",
        "Tamil": "களப் பயணம்", "Telugu": "క్షేత్ర పర్యటన", "Marathi": "फील्ड ट्रिप",
        "Bengali": "ফিল্ড ট্রিপ", "Gujarati": "ફીલ્ડ ટ્રીપ", "Punjabi": "ਫੀਲਡ ਟ੍ਰਿਪ",
        "Malayalam": "ഫീൽഡ് ട്രിപ്പ്", "Odia": "ଫିଲ୍ଡ ଟ୍ରିପ୍"
    },
    "Rubric": {
        "English": "Rubric", "Hindi": "रूब्रिक", "Kannada": "ರೂಬ್ರಿಕ್",
        "Tamil": "மதிப்பீட்டுக் கட்டகம்", "Telugu": "రూబ్రిక్", "Marathi": "रुब्रिक",
        "Bengali": "রুব্রিক", "Gujarati": "રૂબ્રિક", "Punjabi": "ਰੁਬਰਿਕ",
        "Malayalam": "റൂബ്രിക്", "Odia": "ରୁବ୍ରିକ୍"
    },
    "Training": {
        "English": "Training", "Hindi": "प्रशिक्षण", "Kannada": "ತರಬೇತಿ",
        "Tamil": "பயிற்சி", "Telugu": "శిక్షణ", "Marathi": "प्रशिक्षण",
        "Bengali": "প্রশিক্ষণ", "Gujarati": "તાલીમ", "Punjabi": "ਸਿਖਲਾਈ",
        "Malayalam": "പരിശീലനം", "Odia": "ତାଲିମ୍"
    },
    // --- i18n Wave 1: Notifications ---
    "Loading your updates...": {
        "English": "Loading your updates...", "Hindi": "आपके अपडेट लोड हो रहे हैं...", "Kannada": "ನಿಮ್ಮ ನವೀಕರಣಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...", "Tamil": "உங்கள் புதுப்பிப்புகள் ஏற்றப்படுகின்றன...", "Telugu": "మీ నవీకరణలు లోడ్ అవుతున్నాయి...", "Marathi": "तुमचे अद्यतने लोड होत आहेत...", "Bengali": "আপনার আপডেট লোড হচ্ছে...", "Gujarati": "તમારા અપડેટ્સ લોડ થઈ રહ્યા છે...", "Punjabi": "ਤੁਹਾਡੇ ਅੱਪਡੇਟ ਲੋਡ ਹੋ ਰਹੇ ਹਨ...", "Malayalam": "നിങ്ങളുടെ അപ്ഡേറ്റുകൾ ലോഡ് ചെയ്യുന്നു...", "Odia": "ଆପଣଙ୍କ ଅଦ୍ୟତନଗୁଡ଼ିକ ଲୋଡ୍ ହେଉଛି..."
    },
    "Stay updated with your community activity": {
        "English": "Stay updated with your community activity", "Hindi": "अपनी समुदाय गतिविधि से अपडेट रहें", "Kannada": "ನಿಮ್ಮ ಸಮುದಾಯ ಚಟುವಟಿಕೆಯೊಂದಿಗೆ ನವೀಕೃತರಾಗಿರಿ", "Tamil": "உங்கள் சமூக செயல்பாட்டுடன் புதுப்பித்த நிலையில் இருங்கள்", "Telugu": "మీ సంఘం కార్యకలాపాలతో నవీకరించబడి ఉండండి", "Marathi": "तुमच्या समुदाय क्रियाकलापांसह अद्यतनित रहा", "Bengali": "আপনার সম্প্রদায়ের কার্যকলাপের সাথে আপডেট থাকুন", "Gujarati": "તમારી સમુદાય પ્રવૃત્તિ સાથે અપડેટ રહો", "Punjabi": "ਆਪਣੀ ਭਾਈਚਾਰਕ ਗਤੀਵਿਧੀ ਨਾਲ ਅੱਪਡੇਟ ਰਹੋ", "Malayalam": "നിങ്ങളുടെ കമ്മ്യൂണിറ്റി പ്രവർത്തനങ്ങളുമായി അപ്ഡേറ്റ് ആയിരിക്കുക", "Odia": "ଆପଣଙ୍କ ସମ୍ପ୍ରଦାୟ କାର୍ଯ୍ୟକଳାପ ସହିତ ଅଦ୍ୟତନ ରୁହନ୍ତୁ"
    },
    "Could not mark as read": {
        "English": "Could not mark as read", "Hindi": "पढ़ा हुआ चिह्नित नहीं किया जा सका", "Kannada": "ಓದಿದಂತೆ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "வாசித்ததாக குறிக்க முடியவில்லை", "Telugu": "చదివినట్లు గుర్తు పెట్టలేకపోయాము", "Marathi": "वाचले म्हणून चिन्हांकित करता आले नाही", "Bengali": "পঠিত হিসাবে চিহ্নিত করা যায়নি", "Gujarati": "વાંચ્યું તરીકે ચિહ્નિત કરી શકાયું નથી", "Punjabi": "ਪੜ੍ਹਿਆ ਵਜੋਂ ਨਿਸ਼ਾਨਬੱਧ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ", "Malayalam": "വായിച്ചതായി അടയാളപ്പെടുത്താൻ കഴിഞ്ഞില്ല", "Odia": "ପଢ଼ାଯାଇଥିବା ଭାବେ ଚିହ୍ନଟ କରାଯାଇପାରିଲା ନାହିଁ"
    },
    "Could not mark all as read": {
        "English": "Could not mark all as read", "Hindi": "सभी को पढ़ा हुआ चिह्नित नहीं किया जा सका", "Kannada": "ಎಲ್ಲವನ್ನೂ ಓದಿದಂತೆ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "அனைத்தையும் வாசித்ததாக குறிக்க முடியவில்லை", "Telugu": "అన్నింటినీ చదివినట్లు గుర్తు పెట్టలేకపోయాము", "Marathi": "सर्व वाचले म्हणून चिन्हांकित करता आले नाहीत", "Bengali": "সমস্ত পঠিত হিসাবে চিহ্নিত করা যায়নি", "Gujarati": "બધાને વાંચ્યું તરીકે ચિહ્નિત કરી શકાયું નથી", "Punjabi": "ਸਾਰਿਆਂ ਨੂੰ ਪੜ੍ਹਿਆ ਵਜੋਂ ਨਿਸ਼ਾਨਬੱਧ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ", "Malayalam": "എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്താൻ കഴിഞ്ഞില്ല", "Odia": "ସମସ୍ତଙ୍କୁ ପଢ଼ାଯାଇଥିବା ଭାବେ ଚିହ୍ନଟ କରାଯାଇପାରିଲା ନାହିଁ"
    },
    "Cannot accept: request reference missing": {
        "English": "Cannot accept: request reference missing", "Hindi": "स्वीकार नहीं किया जा सकता: अनुरोध संदर्भ अनुपस्थित", "Kannada": "ಸ್ವೀಕರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ: ವಿನಂತಿ ಉಲ್ಲೇಖ ಕಾಣೆಯಾಗಿದೆ", "Tamil": "ஏற்க முடியாது: கோரிக்கை குறிப்பு இல்லை", "Telugu": "అంగీకరించలేము: అభ్యర్థన సూచన లేదు", "Marathi": "स्वीकारता येणार नाही: विनंती संदर्भ गहाळ", "Bengali": "গ্রহণ করা যাবে না: অনুরোধ রেফারেন্স অনুপস্থিত", "Gujarati": "સ્વીકારી શકાતું નથી: વિનંતી સંદર્ભ ગુમ", "Punjabi": "ਸਵੀਕਾਰ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ: ਬੇਨਤੀ ਹਵਾਲਾ ਗੁੰਮ ਹੈ", "Malayalam": "സ്വീകരിക്കാൻ കഴിയില്ല: അഭ്യർത്ഥന റഫറൻസ് കാണുന്നില്ല", "Odia": "ଗ୍ରହଣ କରାଯାଇପାରିବ ନାହିଁ: ଅନୁରୋଧ ସନ୍ଦର୍ଭ ଅନୁପସ୍ଥିତ"
    },
    "Cannot decline: request reference missing": {
        "English": "Cannot decline: request reference missing", "Hindi": "अस्वीकार नहीं किया जा सकता: अनुरोध संदर्भ अनुपस्थित", "Kannada": "ನಿರಾಕರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ: ವಿನಂತಿ ಉಲ್ಲೇಖ ಕಾಣೆಯಾಗಿದೆ", "Tamil": "மறுக்க முடியாது: கோரிக்கை குறிப்பு இல்லை", "Telugu": "తిరస్కరించలేము: అభ్యర్థన సూచన లేదు", "Marathi": "नाकारता येणार नाही: विनंती संदर्भ गहाळ", "Bengali": "প্রত্যাখ্যান করা যাবে না: অনুরোধ রেফারেন্স অনুপস্থিত", "Gujarati": "નકારી શકાતું નથી: વિનંતી સંદર્ભ ગુમ", "Punjabi": "ਅਸਵੀਕਾਰ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ: ਬੇਨਤੀ ਹਵਾਲਾ ਗੁੰਮ ਹੈ", "Malayalam": "നിരസിക്കാൻ കഴിയില്ല: അഭ്യർത്ഥന റഫറൻസ് കാണുന്നില്ല", "Odia": "ପ୍ରତ୍ୟାଖ୍ୟାନ କରାଯାଇପାରିବ ନାହିଁ: ଅନୁରୋଧ ସନ୍ଦର୍ଭ ଅନୁପସ୍ଥିତ"
    },
    "Could not accept request": {
        "English": "Could not accept request", "Hindi": "अनुरोध स्वीकार नहीं किया जा सका", "Kannada": "ವಿನಂತಿಯನ್ನು ಸ್ವೀಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "கோரிக்கையை ஏற்க முடியவில்லை", "Telugu": "అభ్యర్థనను అంగీకరించలేకపోయాము", "Marathi": "विनंती स्वीकारता आली नाही", "Bengali": "অনুরোধ গ্রহণ করা যায়নি", "Gujarati": "વિનંતી સ્વીકારી શકાઈ નથી", "Punjabi": "ਬੇਨਤੀ ਸਵੀਕਾਰ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ", "Malayalam": "അഭ്യർത്ഥന സ്വീകരിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ଅନୁରୋଧ ଗ୍ରହଣ କରାଯାଇପାରିଲା ନାହିଁ"
    },
    "Could not decline request": {
        "English": "Could not decline request", "Hindi": "अनुरोध अस्वीकार नहीं किया जा सका", "Kannada": "ವಿನಂತಿಯನ್ನು ನಿರಾಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "கோரிக்கையை மறுக்க முடியவில்லை", "Telugu": "అభ్యర్థనను తిరస్కరించలేకపోయాము", "Marathi": "विनंती नाकारता आली नाही", "Bengali": "অনুরোধ প্রত্যাখ্যান করা যায়নি", "Gujarati": "વિનંતી નકારી શકાઈ નથી", "Punjabi": "ਬੇਨਤੀ ਅਸਵੀਕਾਰ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ", "Malayalam": "അഭ്യർത്ഥന നിരസിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ଅନୁରୋଧ ପ୍ରତ୍ୟାଖ୍ୟାନ କରାଯାଇପାରିଲା ନାହିଁ"
    },
    "Connected with": {
        "English": "Connected with", "Hindi": "जुड़े:", "Kannada": "ಸಂಪರ್ಕಗೊಂಡಿದೆ:", "Tamil": "இணைக்கப்பட்டது:", "Telugu": "కనెక్ట్ అయ్యారు:", "Marathi": "जोडले:", "Bengali": "সংযুক্ত হয়েছে:", "Gujarati": "જોડાયા:", "Punjabi": "ਜੁੜੇ:", "Malayalam": "കണക്റ്റ് ചെയ്തു:", "Odia": "ସଂଯୁକ୍ତ:"
    },
    // === Principal / School Dashboard (Wave 1) ===
    "School Dashboard": {
        "English": "School Dashboard", "Hindi": "स्कूल डैशबोर्ड", "Kannada": "ಶಾಲಾ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "Tamil": "பள்ளி டாஷ்போர்டு", "Telugu": "పాఠశాల డ్యాష్‌బోర్డ్", "Marathi": "शाळेचा डॅशबोर्ड", "Bengali": "স্কুল ড্যাশবোর্ড", "Gujarati": "શાળા ડેશબોર્ડ", "Punjabi": "ਸਕੂਲ ਡੈਸ਼ਬੋਰਡ", "Malayalam": "സ്കൂൾ ഡാഷ്‌ബോർഡ്", "Odia": "ବିଦ୍ୟାଳୟ ଡ୍ୟାସବୋର୍ଡ"
    },
    "Week of {date}": {
        "English": "Week of {date}", "Hindi": "{date} का सप्ताह", "Kannada": "{date} ರ ವಾರ", "Tamil": "{date} வாரம்", "Telugu": "{date} వారం", "Marathi": "{date} चा आठवडा", "Bengali": "{date}-এর সপ্তাহ", "Gujarati": "{date} નું અઠવાડિયું", "Punjabi": "{date} ਦਾ ਹਫ਼ਤਾ", "Malayalam": "{date} ആഴ്ച", "Odia": "{date} ର ସପ୍ତାହ"
    },
    "{count} teachers, last 7 days": {
        "English": "{count} teachers, last 7 days", "Hindi": "{count} शिक्षक, पिछले 7 दिन", "Kannada": "{count} ಶಿಕ್ಷಕರು, ಕಳೆದ 7 ದಿನಗಳು", "Tamil": "{count} ஆசிரியர்கள், கடந்த 7 நாட்கள்", "Telugu": "{count} ఉపాధ్యాయులు, గత 7 రోజులు", "Marathi": "{count} शिक्षक, मागील 7 दिवस", "Bengali": "{count} জন শিক্ষক, গত 7 দিন", "Gujarati": "{count} શિક્ષકો, છેલ્લા 7 દિવસ", "Punjabi": "{count} ਅਧਿਆਪਕ, ਪਿਛਲੇ 7 ਦਿਨ", "Malayalam": "{count} അധ്യാപകർ, കഴിഞ്ഞ 7 ദിവസം", "Odia": "{count} ଶିକ୍ଷକ, ଗତ 7 ଦିନ"
    },
    "Demo data": {
        "English": "Demo data", "Hindi": "डेमो डेटा", "Kannada": "ಡೆಮೋ ಡೇಟಾ", "Tamil": "டெமோ தரவு", "Telugu": "డెమో డేటా", "Marathi": "डेमो डेटा", "Bengali": "ডেমো ডেটা", "Gujarati": "ડેમો ડેટા", "Punjabi": "ਡੈਮੋ ਡਾਟਾ", "Malayalam": "ഡെമോ ഡാറ്റ", "Odia": "ଡେମୋ ଡାଟା"
    },
    "This week,": {
        "English": "This week,", "Hindi": "इस सप्ताह,", "Kannada": "ಈ ವಾರ,", "Tamil": "இந்த வாரம்,", "Telugu": "ఈ వారం,", "Marathi": "या आठवड्यात,", "Bengali": "এই সপ্তাহে,", "Gujarati": "આ અઠવાડિયે,", "Punjabi": "ਇਸ ਹਫ਼ਤੇ,", "Malayalam": "ഈ ആഴ്ച,", "Odia": "ଏହି ସପ୍ତାହରେ,"
    },
    "teachers returned": {
        "English": "teachers returned", "Hindi": "शिक्षकों ने वापस लौटाए", "Kannada": "ಶಿಕ್ಷಕರು ಮರಳಿಸಿದರು", "Tamil": "ஆசிரியர்கள் திரும்பப் பெற்றனர்", "Telugu": "ఉపాధ్యాయులు తిరిగి ఇచ్చారు", "Marathi": "शिक्षकांनी परत मिळवले", "Bengali": "শিক্ষকরা ফিরিয়ে দিয়েছেন", "Gujarati": "શિક્ષકોએ પાછા આપ્યા", "Punjabi": "ਅਧਿਆਪਕਾਂ ਨੇ ਵਾਪਸ ਕੀਤੇ", "Malayalam": "അധ്യാപകർ തിരികെ നൽകി", "Odia": "ଶିକ୍ଷକମାନେ ଫେରାଇ ଦେଲେ"
    },
    "hours": {
        "English": "hours", "Hindi": "घंटे", "Kannada": "ಗಂಟೆಗಳು", "Tamil": "மணி நேரம்", "Telugu": "గంటలు", "Marathi": "तास", "Bengali": "ঘণ্টা", "Gujarati": "કલાક", "Punjabi": "ਘੰਟੇ", "Malayalam": "മണിക്കൂർ", "Odia": "ଘଣ୍ଟା"
    },
    "to your school.": {
        "English": "to your school.", "Hindi": "आपके स्कूल को।", "Kannada": "ನಿಮ್ಮ ಶಾಲೆಗೆ.", "Tamil": "உங்கள் பள்ளிக்கு.", "Telugu": "మీ పాఠశాలకు.", "Marathi": "तुमच्या शाळेला.", "Bengali": "আপনার স্কুলকে।", "Gujarati": "તમારી શાળાને.", "Punjabi": "ਤੁਹਾਡੇ ਸਕੂਲ ਨੂੰ।", "Malayalam": "നിങ്ങളുടെ സ്കൂളിന്.", "Odia": "ଆପଣଙ୍କ ବିଦ୍ୟାଳୟକୁ।"
    },
    "That is roughly {hours} hours per teacher.": {
        "English": "That is roughly {hours} hours per teacher.", "Hindi": "यह प्रति शिक्षक लगभग {hours} घंटे है।", "Kannada": "ಅದು ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ ಸುಮಾರು {hours} ಗಂಟೆಗಳು.", "Tamil": "அது ஒரு ஆசிரியருக்கு சுமார் {hours} மணி நேரம்.", "Telugu": "అది ఒక్కో ఉపాధ్యాయుడికి సుమారు {hours} గంటలు.", "Marathi": "ते प्रति शिक्षक अंदाजे {hours} तास आहे.", "Bengali": "এটি প্রতি শিক্ষকের জন্য প্রায় {hours} ঘণ্টা।", "Gujarati": "તે પ્રતિ શિક્ષક આશરે {hours} કલાક છે.", "Punjabi": "ਇਹ ਪ੍ਰਤੀ ਅਧਿਆਪਕ ਲਗਭਗ {hours} ਘੰਟੇ ਹੈ।", "Malayalam": "അത് ഒരു അധ്യാപകന് ഏകദേശം {hours} മണിക്കൂറാണ്.", "Odia": "ତାହା ପ୍ରତି ଶିକ୍ଷକଙ୍କ ପାଇଁ ପ୍ରାୟ {hours} ଘଣ୍ଟା।"
    },
    "Up": {
        "English": "Up", "Hindi": "ऊपर", "Kannada": "ಮೇಲೆ", "Tamil": "மேலே", "Telugu": "పైకి", "Marathi": "वर", "Bengali": "উপরে", "Gujarati": "ઉપર", "Punjabi": "ਉੱਪਰ", "Malayalam": "മുകളിലേക്ക്", "Odia": "ଉପର"
    },
    "Down": {
        "English": "Down", "Hindi": "नीचे", "Kannada": "ಕೆಳಗೆ", "Tamil": "கீழே", "Telugu": "క్రిందికి", "Marathi": "खाली", "Bengali": "নিচে", "Gujarati": "નીચે", "Punjabi": "ਹੇਠਾਂ", "Malayalam": "താഴേക്ക്", "Odia": "ତଳ"
    },
    "active": {
        "English": "active", "Hindi": "सक्रिय", "Kannada": "ಸಕ್ರಿಯ", "Tamil": "செயலில்", "Telugu": "క్రియాశీలం", "Marathi": "सक्रिय", "Bengali": "সক্রিয়", "Gujarati": "સક્રિય", "Punjabi": "ਸਰਗਰਮ", "Malayalam": "സജീവം", "Odia": "ସକ୍ରିୟ"
    },
    "teacher": {
        "English": "teacher", "Hindi": "शिक्षक", "Kannada": "ಶಿಕ್ಷಕ", "Tamil": "ஆசிரியர்", "Telugu": "ఉపాధ్యాయుడు", "Marathi": "शिक्षक", "Bengali": "শিক্ষক", "Gujarati": "શિક્ષક", "Punjabi": "ਅਧਿਆਪਕ", "Malayalam": "അധ്യാപകൻ", "Odia": "ଶିକ୍ଷକ"
    },
    "You can now message them and see their shared resources.": {
        "English": "You can now message them and see their shared resources.", "Hindi": "अब आप उन्हें संदेश भेज सकते हैं और उनके साझा संसाधन देख सकते हैं।", "Kannada": "ಈಗ ನೀವು ಅವರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಬಹುದು ಮತ್ತು ಅವರ ಹಂಚಿಕೊಂಡ ಸಂಪನ್ಮೂಲಗಳನ್ನು ನೋಡಬಹುದು.", "Tamil": "இப்போது நீங்கள் அவர்களுக்கு செய்தி அனுப்பலாம் மற்றும் அவர்களின் பகிரப்பட்ட வளங்களைப் பார்க்கலாம்.", "Telugu": "ఇప్పుడు మీరు వారికి సందేశం పంపగలరు మరియు వారి షేర్ చేసిన వనరులను చూడగలరు.", "Marathi": "आता तुम्ही त्यांना संदेश पाठवू शकता आणि त्यांचे सामायिक केलेले संसाधने पाहू शकता.", "Bengali": "আপনি এখন তাদের বার্তা পাঠাতে পারেন এবং তাদের শেয়ার করা সংস্থানগুলি দেখতে পারেন।", "Gujarati": "હવે તમે તેમને સંદેશ મોકલી શકો છો અને તેમના શેર કરેલા સંસાધનો જોઈ શકો છો.", "Punjabi": "ਹੁਣ ਤੁਸੀਂ ਉਨ੍ਹਾਂ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜ ਸਕਦੇ ਹੋ ਅਤੇ ਉਨ੍ਹਾਂ ਦੇ ਸਾਂਝੇ ਸਰੋਤ ਦੇਖ ਸਕਦੇ ਹੋ।", "Malayalam": "ഇപ്പോൾ നിങ്ങൾക്ക് അവർക്ക് സന്ദേശമയയ്ക്കാനും അവർ പങ്കിട്ട ഉറവിടങ്ങൾ കാണാനും കഴിയും.", "Odia": "ଆପଣ ବର୍ତ୍ତମାନ ସେମାନଙ୍କୁ ବାର୍ତ୍ତା ପଠାଇପାରିବେ ଏବଂ ସେମାନଙ୍କ ସେୟାର କରାଯାଇଥିବା ସମ୍ବଳ ଦେଖିପାରିବେ।"
    },
    "Request declined": {
        "English": "Request declined", "Hindi": "अनुरोध अस्वीकृत", "Kannada": "ವಿನಂತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ", "Tamil": "கோரிக்கை மறுக்கப்பட்டது", "Telugu": "అభ్యర్థన తిరస్కరించబడింది", "Marathi": "विनंती नाकारली", "Bengali": "অনুরোধ প্রত্যাখ্যাত", "Gujarati": "વિનંતી નકારી", "Punjabi": "ਬੇਨਤੀ ਅਸਵੀਕਾਰ ਕੀਤੀ", "Malayalam": "അഭ്യർത്ഥന നിരസിച്ചു", "Odia": "ଅନୁରୋଧ ପ୍ରତ୍ୟାଖ୍ୟାନ ହୋଇଛି"
    },
    "No notifications yet": {
        "English": "No notifications yet", "Hindi": "अभी तक कोई सूचना नहीं", "Kannada": "ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ", "Tamil": "இன்னும் அறிவிப்புகள் இல்லை", "Telugu": "ఇంకా నోటిఫికేషన్‌లు లేవు", "Marathi": "अद्याप कोणत्याही सूचना नाहीत", "Bengali": "এখনও কোনো বিজ্ঞপ্তি নেই", "Gujarati": "હજુ સુધી કોઈ સૂચનાઓ નથી", "Punjabi": "ਅਜੇ ਕੋਈ ਸੂਚਨਾਵਾਂ ਨਹੀਂ", "Malayalam": "ഇതുവരെ അറിയിപ്പുകളൊന്നുമില്ല", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ବିଜ୍ଞପ୍ତି ନାହିଁ"
    },
    "When you gain followers or earn badges, they'll appear here.": {
        "English": "When you gain followers or earn badges, they'll appear here.", "Hindi": "जब आपको फॉलोअर्स मिलेंगे या बैज मिलेंगे, तो वे यहाँ दिखाई देंगे।", "Kannada": "ನೀವು ಅನುಯಾಯಿಗಳನ್ನು ಪಡೆದಾಗ ಅಥವಾ ಬ್ಯಾಡ್ಜ್‌ಗಳನ್ನು ಗಳಿಸಿದಾಗ, ಅವು ಇಲ್ಲಿ ಗೋಚರಿಸುತ್ತವೆ.", "Tamil": "நீங்கள் பின்தொடர்பவர்களைப் பெறும்போது அல்லது பேட்ஜ்களைப் பெறும்போது, அவை இங்கே தோன்றும்.", "Telugu": "మీరు అనుచరులను పొందినప్పుడు లేదా బ్యాడ్జ్‌లు సంపాదించినప్పుడు, అవి ఇక్కడ కనిపిస్తాయి.", "Marathi": "जेव्हा तुम्हाला फॉलोअर्स मिळतील किंवा बॅज मिळतील, तेव्हा ते येथे दिसतील.", "Bengali": "যখন আপনি অনুসরণকারী পান বা ব্যাজ অর্জন করেন, সেগুলি এখানে প্রদর্শিত হবে।", "Gujarati": "જ્યારે તમે અનુયાયીઓ મેળવો છો અથવા બેજ કમાઓ છો, ત્યારે તે અહીં દેખાશે.", "Punjabi": "ਜਦੋਂ ਤੁਹਾਨੂੰ ਫਾਲੋਅਰ ਮਿਲਣਗੇ ਜਾਂ ਬੈਜ ਮਿਲਣਗੇ, ਉਹ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ।", "Malayalam": "നിങ്ങൾക്ക് ഫോളോവേഴ്സ് ലഭിക്കുമ്പോഴോ ബാഡ്ജുകൾ നേടുമ്പോഴോ, അവ ഇവിടെ ദൃശ്യമാകും.", "Odia": "ଯେତେବେଳେ ଆପଣ ଅନୁସରଣକାରୀ ପାଆନ୍ତି କିମ୍ବା ବ୍ୟାଜ୍ ଅର୍ଜନ କରନ୍ତି, ସେଗୁଡ଼ିକ ଏଠାରେ ଦେଖାଯିବ।"
    },
    "Recent Activity": {
        "English": "Recent Activity", "Hindi": "हाल की गतिविधि", "Kannada": "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ", "Tamil": "சமீபத்திய செயல்பாடு", "Telugu": "ఇటీవలి కార్యకలాపం", "Marathi": "अलीकडील क्रियाकलाप", "Bengali": "সাম্প্রতিক কার্যকলাপ", "Gujarati": "તાજેતરની પ્રવૃત્તિ", "Punjabi": "ਹਾਲੀਆ ਗਤੀਵਿਧੀ", "Malayalam": "സമീപകാല പ്രവർത്തനം", "Odia": "ସାମ୍ପ୍ରତିକ କାର୍ଯ୍ୟକଳାପ"
    },
    "Mark all as read": {
        "English": "Mark all as read", "Hindi": "सभी को पढ़ा हुआ चिह्नित करें", "Kannada": "ಎಲ್ಲವನ್ನೂ ಓದಿದಂತೆ ಗುರುತಿಸಿ", "Tamil": "அனைத்தையும் வாசித்ததாக குறிக்கவும்", "Telugu": "అన్నింటినీ చదివినట్లు గుర్తు పెట్టండి", "Marathi": "सर्व वाचले म्हणून चिन्हांकित करा", "Bengali": "সব পঠিত হিসাবে চিহ্নিত করুন", "Gujarati": "બધાને વાંચ્યું તરીકે ચિહ્નિત કરો", "Punjabi": "ਸਾਰਿਆਂ ਨੂੰ ਪੜ੍ਹਿਆ ਨਿਸ਼ਾਨਬੱਧ ਕਰੋ", "Malayalam": "എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക", "Odia": "ସମସ୍ତଙ୍କୁ ପଢ଼ାଯାଇଥିବା ଭାବେ ଚିହ୍ନଟ କରନ୍ତୁ"
    },
    "Accept": {
        "English": "Accept", "Hindi": "स्वीकार करें", "Kannada": "ಸ್ವೀಕರಿಸಿ", "Tamil": "ஏற்கவும்", "Telugu": "అంగీకరించండి", "Marathi": "स्वीकारा", "Bengali": "গ্রহণ করুন", "Gujarati": "સ્વીકારો", "Punjabi": "ਸਵੀਕਾਰ ਕਰੋ", "Malayalam": "സ്വീകരിക്കുക", "Odia": "ଗ୍ରହଣ କରନ୍ତୁ"
    },
    "Decline": {
        "English": "Decline", "Hindi": "अस्वीकार करें", "Kannada": "ನಿರಾಕರಿಸಿ", "Tamil": "மறுக்கவும்", "Telugu": "తిరస్కరించండి", "Marathi": "नाकारा", "Bengali": "প্রত্যাখ্যান করুন", "Gujarati": "નકારો", "Punjabi": "ਅਸਵੀਕਾਰ ਕਰੋ", "Malayalam": "നിരസിക്കുക", "Odia": "ପ୍ରତ୍ୟାଖ୍ୟାନ କରନ୍ତୁ"
    },
    "Connected": {
        "English": "Connected", "Hindi": "जुड़ गए", "Kannada": "ಸಂಪರ್ಕಗೊಂಡಿದೆ", "Tamil": "இணைக்கப்பட்டது", "Telugu": "కనెక్ట్ అయింది", "Marathi": "जोडले", "Bengali": "সংযুক্ত", "Gujarati": "જોડાયેલ", "Punjabi": "ਜੁੜੇ", "Malayalam": "കണക്റ്റ് ചെയ്തു", "Odia": "ସଂଯୁକ୍ତ"
    },
    "Mark read": {
        "English": "Mark read", "Hindi": "पढ़ा हुआ चिह्नित करें", "Kannada": "ಓದಿದಂತೆ ಗುರುತಿಸಿ", "Tamil": "வாசித்ததாக குறிக்கவும்", "Telugu": "చదివినట్లు గుర్తు పెట్టండి", "Marathi": "वाचले म्हणून चिन्हांकित करा", "Bengali": "পঠিত চিহ্নিত করুন", "Gujarati": "વાંચ્યું ચિહ્નિત કરો", "Punjabi": "ਪੜ੍ਹਿਆ ਨਿਸ਼ਾਨਬੱਧ ਕਰੋ", "Malayalam": "വായിച്ചതായി അടയാളപ്പെടുത്തുക", "Odia": "ପଢ଼ାଯାଇଥିବା ଚିହ୍ନଟ କରନ୍ତୁ"
    },
    "View": {
        "English": "View", "Hindi": "देखें", "Kannada": "ವೀಕ್ಷಿಸಿ", "Tamil": "காண்க", "Telugu": "చూడండి", "Marathi": "पहा", "Bengali": "দেখুন", "Gujarati": "જુઓ", "Punjabi": "ਵੇਖੋ", "Malayalam": "കാണുക", "Odia": "ଦେଖନ୍ତୁ"
    },
    "teachers": {
        "English": "teachers", "Hindi": "शिक्षक", "Kannada": "ಶಿಕ್ಷಕರು", "Tamil": "ஆசிரியர்கள்", "Telugu": "ఉపాధ్యాయులు", "Marathi": "शिक्षक", "Bengali": "শিক্ষকরা", "Gujarati": "શિક્ષકો", "Punjabi": "ਅਧਿਆਪਕ", "Malayalam": "അധ്യാപകർ", "Odia": "ଶିକ୍ଷକମାନେ"
    },
    "compared with last week.": {
        "English": "compared with last week.", "Hindi": "पिछले सप्ताह की तुलना में।", "Kannada": "ಕಳೆದ ವಾರಕ್ಕೆ ಹೋಲಿಸಿದರೆ.", "Tamil": "கடந்த வாரத்துடன் ஒப்பிடும்போது.", "Telugu": "గత వారంతో పోలిస్తే.", "Marathi": "मागील आठवड्याच्या तुलनेत.", "Bengali": "গত সপ্তাহের তুলনায়।", "Gujarati": "ગયા અઠવાડિયાની સરખામણીમાં.", "Punjabi": "ਪਿਛਲੇ ਹਫ਼ਤੇ ਦੇ ਮੁਕਾਬਲੇ।", "Malayalam": "കഴിഞ്ഞ ആഴ്ചയുമായി താരതമ്യപ്പെടുത്തുമ്പോൾ.", "Odia": "ଗତ ସପ୍ତାହ ତୁଳନାରେ।"
    },
    "See assumptions": {
        "English": "See assumptions", "Hindi": "अनुमान देखें", "Kannada": "ಊಹೆಗಳನ್ನು ನೋಡಿ", "Tamil": "அனுமானங்களைப் பார்க்க", "Telugu": "ఊహలను చూడండి", "Marathi": "गृहीतके पहा", "Bengali": "অনুমান দেখুন", "Gujarati": "ધારણાઓ જુઓ", "Punjabi": "ਧਾਰਨਾਵਾਂ ਵੇਖੋ", "Malayalam": "അനുമാനങ്ങൾ കാണുക", "Odia": "ଅନୁମାନ ଦେଖନ୍ତୁ"
    },
    "pieces of content": {
        "English": "pieces of content", "Hindi": "सामग्री के टुकड़े", "Kannada": "ವಿಷಯದ ತುಣುಕುಗಳು", "Tamil": "உள்ளடக்கத் துண்டுகள்", "Telugu": "విషయ ముక్కలు", "Marathi": "सामग्रीचे तुकडे", "Bengali": "কন্টেন্টের অংশ", "Gujarati": "સામગ્રીના ટુકડા", "Punjabi": "ਸਮੱਗਰੀ ਦੇ ਟੁਕੜੇ", "Malayalam": "ഉള്ളടക്കത്തിന്റെ ഭാഗങ്ങൾ", "Odia": "ବିଷୟବସ୍ତୁର ଅଂଶ"
    },
    "{count} all-time": {
        "English": "{count} all-time", "Hindi": "कुल {count}", "Kannada": "ಒಟ್ಟು {count}", "Tamil": "மொத்தம் {count}", "Telugu": "మొత్తం {count}", "Marathi": "एकूण {count}", "Bengali": "মোট {count}", "Gujarati": "કુલ {count}", "Punjabi": "ਕੁੱਲ {count}", "Malayalam": "ആകെ {count}", "Odia": "ସମୁଦାୟ {count}"
    },
    "of 13 features used": {
        "English": "of 13 features used", "Hindi": "13 में से उपयोग किए गए फ़ीचर", "Kannada": "13 ರಲ್ಲಿ ಬಳಸಿದ ವೈಶಿಷ್ಟ್ಯಗಳು", "Tamil": "13 இல் பயன்படுத்தப்பட்ட அம்சங்கள்", "Telugu": "13లో వాడిన ఫీచర్లు", "Marathi": "13 पैकी वापरलेली वैशिष्ट्ये", "Bengali": "13টির মধ্যে ব্যবহৃত ফিচার", "Gujarati": "13 માંથી વપરાયેલી સુવિધાઓ", "Punjabi": "13 ਵਿੱਚੋਂ ਵਰਤੀਆਂ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ", "Malayalam": "13ൽ ഉപയോഗിച്ച ഫീച്ചറുകൾ", "Odia": "13 ମଧ୍ୟରୁ ବ୍ୟବହୃତ ବୈଶିଷ୍ଟ୍ୟ"
    },
    "{percent}% use {feature}": {
        "English": "{percent}% use {feature}", "Hindi": "{percent}% {feature} का उपयोग करते हैं", "Kannada": "{percent}% {feature} ಬಳಸುತ್ತಾರೆ", "Tamil": "{percent}% {feature} பயன்படுத்துகின்றனர்", "Telugu": "{percent}% {feature} ఉపయోగిస్తున్నారు", "Marathi": "{percent}% {feature} वापरतात", "Bengali": "{percent}% {feature} ব্যবহার করে", "Gujarati": "{percent}% {feature} નો ઉપયોગ કરે છે", "Punjabi": "{percent}% {feature} ਵਰਤਦੇ ਹਨ", "Malayalam": "{percent}% {feature} ഉപയോഗിക്കുന്നു", "Odia": "{percent}% {feature} ବ୍ୟବହାର କରନ୍ତି"
    },
    "no feature data": {
        "English": "no feature data", "Hindi": "कोई फ़ीचर डेटा नहीं", "Kannada": "ವೈಶಿಷ್ಟ್ಯ ಡೇಟಾ ಇಲ್ಲ", "Tamil": "அம்சத் தரவு இல்லை", "Telugu": "ఫీచర్ డేటా లేదు", "Marathi": "वैशिष्ट्य डेटा नाही", "Bengali": "কোন ফিচার ডেটা নেই", "Gujarati": "કોઈ સુવિધા ડેટા નથી", "Punjabi": "ਕੋਈ ਵਿਸ਼ੇਸ਼ਤਾ ਡਾਟਾ ਨਹੀਂ", "Malayalam": "ഫീച്ചർ ഡാറ്റയില്ല", "Odia": "କୌଣସି ବୈଶିଷ୍ଟ୍ୟ ଡାଟା ନାହିଁ"
    },
    "avg teacher health": {
        "English": "avg teacher health", "Hindi": "औसत शिक्षक स्वास्थ्य", "Kannada": "ಸರಾಸರಿ ಶಿಕ್ಷಕ ಆರೋಗ್ಯ", "Tamil": "சராசரி ஆசிரியர் ஆரோக்கியம்", "Telugu": "సగటు ఉపాధ్యాయ ఆరోగ్యం", "Marathi": "सरासरी शिक्षक आरोग्य", "Bengali": "গড় শিক্ষক স্বাস্থ্য", "Gujarati": "સરેરાશ શિક્ષક આરોગ્ય", "Punjabi": "ਔਸਤ ਅਧਿਆਪਕ ਸਿਹਤ", "Malayalam": "ശരാശരി അധ്യാപക ആരോഗ്യം", "Odia": "ହାରାହାରି ଶିକ୍ଷକ ସ୍ୱାସ୍ଥ୍ୟ"
    },
    "{healthy} healthy, {critical} critical": {
        "English": "{healthy} healthy, {critical} critical", "Hindi": "{healthy} स्वस्थ, {critical} गंभीर", "Kannada": "{healthy} ಆರೋಗ್ಯಕರ, {critical} ಗಂಭೀರ", "Tamil": "{healthy} ஆரோக்கியமானவர், {critical} கடுமையானவர்", "Telugu": "{healthy} ఆరోగ్యకరం, {critical} క్లిష్టం", "Marathi": "{healthy} निरोगी, {critical} गंभीर", "Bengali": "{healthy} সুস্থ, {critical} সংকটাপন্ন", "Gujarati": "{healthy} તંદુરસ્ત, {critical} ગંભીર", "Punjabi": "{healthy} ਤੰਦਰੁਸਤ, {critical} ਨਾਜ਼ੁਕ", "Malayalam": "{healthy} ആരോഗ്യമുള്ളവർ, {critical} ഗുരുതരം", "Odia": "{healthy} ସୁସ୍ଥ, {critical} ସଙ୍କଟାପନ୍ନ"
    },
    "weekly active": {
        "English": "weekly active", "Hindi": "साप्ताहिक सक्रिय", "Kannada": "ಸಾಪ್ತಾಹಿಕ ಸಕ್ರಿಯ", "Tamil": "வாராந்திர செயலில்", "Telugu": "వారానికొక సారి క్రియాశీలం", "Marathi": "साप्ताहिक सक्रिय", "Bengali": "সাপ্তাহিক সক্রিয়", "Gujarati": "સાપ્તાહિક સક્રિય", "Punjabi": "ਹਫ਼ਤਾਵਾਰੀ ਸਰਗਰਮ", "Malayalam": "പ്രതിവാര സജീവം", "Odia": "ସାପ୍ତାହିକ ସକ୍ରିୟ"
    },
    "unchanged vs last week": {
        "English": "unchanged vs last week", "Hindi": "पिछले सप्ताह से अपरिवर्तित", "Kannada": "ಕಳೆದ ವಾರಕ್ಕಿಂತ ಬದಲಾವಣೆಯಿಲ್ಲ", "Tamil": "கடந்த வாரத்திலிருந்து மாறவில்லை", "Telugu": "గత వారంతో పోలిస్తే మార్పులేదు", "Marathi": "मागील आठवड्यापेक्षा अपरिवर्तित", "Bengali": "গত সপ্তাহের তুলনায় অপরিবর্তিত", "Gujarati": "ગયા અઠવાડિયાથી અપરિવર્તિત", "Punjabi": "ਪਿਛਲੇ ਹਫ਼ਤੇ ਤੋਂ ਅਣਬਦਲਿਆ", "Malayalam": "കഴിഞ്ഞ ആഴ്ചയിൽ നിന്ന് മാറ്റമില്ല", "Odia": "ଗତ ସପ୍ତାହ ତୁଳନାରେ ଅପରିବର୍ତ୍ତିତ"
    },
    "{delta} vs last week": {
        "English": "{delta} vs last week", "Hindi": "पिछले सप्ताह बनाम {delta}", "Kannada": "ಕಳೆದ ವಾರಕ್ಕೆ {delta}", "Tamil": "கடந்த வாரத்துடன் {delta}", "Telugu": "గత వారంతో {delta}", "Marathi": "मागील आठवड्याच्या तुलनेत {delta}", "Bengali": "গত সপ্তাহের তুলনায় {delta}", "Gujarati": "ગયા અઠવાડિયા સામે {delta}", "Punjabi": "ਪਿਛਲੇ ਹਫ਼ਤੇ ਦੇ ਮੁਕਾਬਲੇ {delta}", "Malayalam": "കഴിഞ്ഞ ആഴ്ചയുമായി {delta}", "Odia": "ଗତ ସପ୍ତାହ ତୁଳନାରେ {delta}"
    },
    "Teachers who need a check-in": {
        "English": "Teachers who need a check-in", "Hindi": "जिन शिक्षकों से बात करनी चाहिए", "Kannada": "ಮಾತುಕತೆ ಬೇಕಿರುವ ಶಿಕ್ಷಕರು", "Tamil": "உரையாட வேண்டிய ஆசிரியர்கள்", "Telugu": "మాట్లాడవలసిన ఉపాధ్యాయులు", "Marathi": "संपर्क करावा लागणारे शिक्षक", "Bengali": "যাঁদের সঙ্গে কথা বলা প্রয়োজন", "Gujarati": "જે શિક્ષકો સાથે વાત કરવી જરૂરી છે", "Punjabi": "ਜਿਨ੍ਹਾਂ ਅਧਿਆਪਕਾਂ ਨਾਲ ਗੱਲ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ", "Malayalam": "സംഭാഷണം ആവശ്യമുള്ള അധ്യാപകർ", "Odia": "ଯେଉଁ ଶିକ୍ଷକଙ୍କ ସହିତ କଥା ହେବା ଆବଶ୍ୟକ"
    },
    "Ordered by urgency": {
        "English": "Ordered by urgency", "Hindi": "तात्कालिकता के अनुसार क्रमबद्ध", "Kannada": "ತುರ್ತು ಆಧಾರಿತ ಕ್ರಮ", "Tamil": "அவசரத்தின் அடிப்படையில் வரிசை", "Telugu": "అత్యవసరత ఆధారంగా క్రమం", "Marathi": "तातडीच्या क्रमाने", "Bengali": "জরুরিতার ক্রমে", "Gujarati": "તાકીદ મુજબ ક્રમ", "Punjabi": "ਜ਼ਰੂਰੀਅਤ ਅਨੁਸਾਰ ਕ੍ਰਮ", "Malayalam": "അടിയന്തിരതയനുസരിച്ച്", "Odia": "ଜରୁରୀତା ଅନୁଯାୟୀ କ୍ରମ"
    },
    "Nobody is at risk this week. Every teacher on your roster has logged in recently and generated content. Keep doing what you are doing.": {
        "English": "Nobody is at risk this week. Every teacher on your roster has logged in recently and generated content. Keep doing what you are doing.", "Hindi": "इस सप्ताह कोई जोखिम में नहीं है। आपके रोस्टर में हर शिक्षक ने हाल ही में लॉग इन किया है और सामग्री बनाई है। जो आप कर रहे हैं वही करते रहें।", "Kannada": "ಈ ವಾರ ಯಾರೂ ಅಪಾಯದಲ್ಲಿಲ್ಲ. ನಿಮ್ಮ ರೋಸ್ಟರ್‌ನಲ್ಲಿರುವ ಪ್ರತಿಯೊಬ್ಬ ಶಿಕ್ಷಕರೂ ಇತ್ತೀಚೆಗೆ ಲಾಗಿನ್ ಆಗಿ ವಿಷಯವನ್ನು ರಚಿಸಿದ್ದಾರೆ. ನೀವು ಮಾಡುತ್ತಿರುವುದನ್ನು ಮುಂದುವರಿಸಿ.", "Tamil": "இந்த வாரம் யாருக்கும் ஆபத்து இல்லை. உங்கள் பட்டியலில் உள்ள ஒவ்வொரு ஆசிரியரும் சமீபத்தில் உள்நுழைந்து உள்ளடக்கம் உருவாக்கியுள்ளனர். நீங்கள் செய்வதை தொடர்ந்து செய்யுங்கள்.", "Telugu": "ఈ వారం ఎవరూ ప్రమాదంలో లేరు. మీ రోస్టర్‌లోని ప్రతి ఉపాధ్యాయుడు ఇటీవల లాగిన్ అయి కంటెంట్‌ను సృష్టించారు. మీరు చేస్తున్నదాన్ని కొనసాగించండి.", "Marathi": "या आठवड्यात कोणीही धोक्यात नाही. तुमच्या रोस्टरमधील प्रत्येक शिक्षकाने नुकतेच लॉगिन केले आहे आणि सामग्री तयार केली आहे. तुम्ही जे करत आहात ते सुरू ठेवा.", "Bengali": "এই সপ্তাহে কেউ ঝুঁকিতে নেই। আপনার তালিকার প্রতিটি শিক্ষক সম্প্রতি লগ ইন করেছেন এবং কন্টেন্ট তৈরি করেছেন। আপনি যা করছেন তা চালিয়ে যান।", "Gujarati": "આ અઠવાડિયે કોઈ જોખમમાં નથી. તમારા રોસ્ટરમાં દરેક શિક્ષકે તાજેતરમાં લોગ ઇન કર્યું છે અને સામગ્રી બનાવી છે. તમે જે કરી રહ્યા છો તે ચાલુ રાખો.", "Punjabi": "ਇਸ ਹਫ਼ਤੇ ਕੋਈ ਵੀ ਜੋਖਮ ਵਿੱਚ ਨਹੀਂ ਹੈ। ਤੁਹਾਡੇ ਰੋਸਟਰ ਦੇ ਹਰ ਅਧਿਆਪਕ ਨੇ ਹਾਲ ਹੀ ਵਿੱਚ ਲੌਗਇਨ ਕੀਤਾ ਹੈ ਅਤੇ ਸਮੱਗਰੀ ਤਿਆਰ ਕੀਤੀ ਹੈ। ਜੋ ਤੁਸੀਂ ਕਰ ਰਹੇ ਹੋ ਉਹ ਜਾਰੀ ਰੱਖੋ।", "Malayalam": "ഈ ആഴ്ച ആരും അപകടത്തിലല്ല. നിങ്ങളുടെ റോസ്റ്ററിലെ ഓരോ അധ്യാപകനും അടുത്തിടെ ലോഗിൻ ചെയ്ത് ഉള്ളടക്കം സൃഷ്ടിച്ചിട്ടുണ്ട്. നിങ്ങൾ ചെയ്യുന്നത് തുടരുക.", "Odia": "ଏହି ସପ୍ତାହ କେହି ବିପଦରେ ନାହାଁନ୍ତି। ଆପଣଙ୍କ ରୋଷ୍ଟରର ପ୍ରତ୍ୟେକ ଶିକ୍ଷକ ନିକଟରେ ଲଗଇନ୍ କରିଛନ୍ତି ଏବଂ ବିଷୟବସ୍ତୁ ସୃଷ୍ଟି କରିଛନ୍ତି। ଆପଣ ଯାହା କରୁଛନ୍ତି ତାହା ଜାରି ରଖନ୍ତୁ।"
    },
    "active today": {
        "English": "active today", "Hindi": "आज सक्रिय", "Kannada": "ಇಂದು ಸಕ್ರಿಯ", "Tamil": "இன்று செயலில்", "Telugu": "నేడు క్రియాశీలం", "Marathi": "आज सक्रिय", "Bengali": "আজ সক্রিয়", "Gujarati": "આજે સક્રિય", "Punjabi": "ਅੱਜ ਸਰਗਰਮ", "Malayalam": "ഇന്ന് സജീവം", "Odia": "ଆଜି ସକ୍ରିୟ"
    },
    "last used yesterday": {
        "English": "last used yesterday", "Hindi": "अंतिम बार कल उपयोग किया", "Kannada": "ಕೊನೆಯ ಬಾರಿ ನಿನ್ನೆ ಬಳಸಲಾಗಿದೆ", "Tamil": "கடைசியாக நேற்று பயன்படுத்தப்பட்டது", "Telugu": "చివరిసారి నిన్న ఉపయోగించారు", "Marathi": "शेवटचा वापर काल", "Bengali": "শেষ ব্যবহার গতকাল", "Gujarati": "છેલ્લે ગઈ કાલે ઉપયોગ", "Punjabi": "ਆਖਰੀ ਵਾਰ ਕੱਲ੍ਹ ਵਰਤਿਆ", "Malayalam": "അവസാനം ഇന്നലെ ഉപയോഗിച്ചു", "Odia": "ଶେଷଥର କାଲି ବ୍ୟବହାର"
    },
    "last used {days} days ago": {
        "English": "last used {days} days ago", "Hindi": "अंतिम बार {days} दिन पहले उपयोग किया", "Kannada": "ಕೊನೆಯ ಬಾರಿ {days} ದಿನಗಳ ಹಿಂದೆ ಬಳಸಲಾಗಿದೆ", "Tamil": "கடைசியாக {days} நாட்களுக்கு முன் பயன்படுத்தப்பட்டது", "Telugu": "చివరిసారి {days} రోజుల క్రితం ఉపయోగించారు", "Marathi": "शेवटचा वापर {days} दिवसांपूर्वी", "Bengali": "শেষ ব্যবহার {days} দিন আগে", "Gujarati": "છેલ્લે {days} દિવસ પહેલા ઉપયોગ", "Punjabi": "ਆਖਰੀ ਵਾਰ {days} ਦਿਨ ਪਹਿਲਾਂ ਵਰਤਿਆ", "Malayalam": "അവസാനം {days} ദിവസം മുമ്പ് ഉപയോഗിച്ചു", "Odia": "ଶେଷଥର {days} ଦିନ ପୂର୍ବେ ବ୍ୟବହାର"
    },
    "critical": {
        "English": "critical", "Hindi": "गंभीर", "Kannada": "ಗಂಭೀರ", "Tamil": "கடுமையானது", "Telugu": "క్లిష్టం", "Marathi": "गंभीर", "Bengali": "সংকটাপন্ন", "Gujarati": "ગંભીર", "Punjabi": "ਨਾਜ਼ੁਕ", "Malayalam": "ഗുരുതരം", "Odia": "ସଙ୍କଟାପନ୍ନ"
    },
    "at-risk": {
        "English": "at-risk", "Hindi": "जोखिम में", "Kannada": "ಅಪಾಯದಲ್ಲಿ", "Tamil": "ஆபத்தில்", "Telugu": "ప్రమాదంలో", "Marathi": "धोक्यात", "Bengali": "ঝুঁকিতে", "Gujarati": "જોખમમાં", "Punjabi": "ਜੋਖਮ ਵਿੱਚ", "Malayalam": "അപകടത്തിൽ", "Odia": "ବିପଦରେ"
    },
    "What your teachers are using": {
        "English": "What your teachers are using", "Hindi": "आपके शिक्षक क्या उपयोग कर रहे हैं", "Kannada": "ನಿಮ್ಮ ಶಿಕ್ಷಕರು ಏನು ಬಳಸುತ್ತಿದ್ದಾರೆ", "Tamil": "உங்கள் ஆசிரியர்கள் என்ன பயன்படுத்துகின்றனர்", "Telugu": "మీ ఉపాధ్యాయులు ఏం ఉపయోగిస్తున్నారు", "Marathi": "तुमचे शिक्षक काय वापरत आहेत", "Bengali": "আপনার শিক্ষকরা কী ব্যবহার করছেন", "Gujarati": "તમારા શિક્ષકો શું વાપરી રહ્યા છે", "Punjabi": "ਤੁਹਾਡੇ ਅਧਿਆਪਕ ਕੀ ਵਰਤ ਰਹੇ ਹਨ", "Malayalam": "നിങ്ങളുടെ അധ്യാപകർ എന്താണ് ഉപയോഗിക്കുന്നത്", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷକମାନେ କଣ ବ୍ୟବହାର କରୁଛନ୍ତି"
    },
    "No feature usage logged yet. Ask a few teachers to generate their first lesson plan, then come back tomorrow.": {
        "English": "No feature usage logged yet. Ask a few teachers to generate their first lesson plan, then come back tomorrow.", "Hindi": "अभी तक कोई फ़ीचर उपयोग दर्ज नहीं हुआ। कुछ शिक्षकों को अपनी पहली पाठ योजना बनाने के लिए कहें, फिर कल वापस आएं।", "Kannada": "ಇನ್ನೂ ಯಾವುದೇ ವೈಶಿಷ್ಟ್ಯ ಬಳಕೆ ದಾಖಲಾಗಿಲ್ಲ. ಕೆಲವು ಶಿಕ್ಷಕರಿಗೆ ತಮ್ಮ ಮೊದಲ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಲು ತಿಳಿಸಿ, ನಂತರ ನಾಳೆ ಬನ್ನಿ.", "Tamil": "இதுவரை எந்த அம்ச பயன்பாடும் பதிவாகவில்லை. சில ஆசிரியர்களை அவர்களின் முதல் பாடத் திட்டத்தை உருவாக்கச் சொல்லுங்கள், பிறகு நாளை திரும்பவும்.", "Telugu": "ఇంకా ఏ ఫీచర్ వాడకం నమోదు కాలేదు. కొందరు ఉపాధ్యాయులను వారి మొదటి పాఠ ప్రణాళికను సృష్టించమని కోరండి, తర్వాత రేపు తిరిగి రండి.", "Marathi": "अद्याप कोणतेही वैशिष्ट्य वापर नोंदवले गेले नाही. काही शिक्षकांना त्यांची पहिली पाठ योजना तयार करण्यास सांगा, नंतर उद्या परत या.", "Bengali": "এখনও কোন ফিচার ব্যবহার লগ করা হয়নি। কয়েকজন শিক্ষককে তাদের প্রথম পাঠ পরিকল্পনা তৈরি করতে বলুন, তারপর কাল ফিরে আসুন।", "Gujarati": "હજુ સુધી કોઈ સુવિધાનો ઉપયોગ નોંધાયો નથી. કેટલાક શિક્ષકોને તેમની પ્રથમ પાઠ યોજના બનાવવા કહો, પછી આવતી કાલે પાછા આવો.", "Punjabi": "ਅਜੇ ਤੱਕ ਕੋਈ ਵਿਸ਼ੇਸ਼ਤਾ ਵਰਤੋਂ ਦਰਜ ਨਹੀਂ ਹੋਈ। ਕੁਝ ਅਧਿਆਪਕਾਂ ਨੂੰ ਆਪਣੀ ਪਹਿਲੀ ਪਾਠ ਯੋਜਨਾ ਬਣਾਉਣ ਲਈ ਕਹੋ, ਫਿਰ ਕੱਲ੍ਹ ਵਾਪਸ ਆਓ।", "Malayalam": "ഇതുവരെ ഫീച്ചർ ഉപയോഗം രേഖപ്പെടുത്തിയിട്ടില്ല. കുറച്ച് അധ്യാപകരോട് അവരുടെ ആദ്യത്തെ പാഠ പദ്ധതി സൃഷ്ടിക്കാൻ ആവശ്യപ്പെടുക, എന്നിട്ട് നാളെ തിരികെ വരൂ.", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ବୈଶିଷ୍ଟ୍ୟ ବ୍ୟବହାର ଲଗ୍ ହୋଇନାହିଁ। କିଛି ଶିକ୍ଷକଙ୍କୁ ସେମାନଙ୍କର ପ୍ରଥମ ପାଠ ଯୋଜନା ସୃଷ୍ଟି କରିବାକୁ କୁହନ୍ତୁ, ତା'ପରେ କାଲି ଫେରନ୍ତୁ।"
    },

    // Feature labels for principal dashboard (FEATURE_LABEL dict)
    "Lesson plans": {
        "English": "Lesson plans", "Hindi": "पाठ योजनाएं", "Kannada": "ಪಾಠ ಯೋಜನೆಗಳು", "Tamil": "பாடத் திட்டங்கள்", "Telugu": "పాఠ ప్రణాళికలు", "Marathi": "पाठ योजना", "Bengali": "পাঠ পরিকল্পনা", "Gujarati": "પાઠ યોજનાઓ", "Punjabi": "ਪਾਠ ਯੋਜਨਾਵਾਂ", "Malayalam": "പാഠ പദ്ധതികൾ", "Odia": "ପାଠ ଯୋଜନା"
    },
    "Quizzes": {
        "English": "Quizzes", "Hindi": "प्रश्नोत्तरी", "Kannada": "ರಸಪ್ರಶ್ನೆಗಳು", "Tamil": "வினாடி வினா", "Telugu": "క్విజ్‌లు", "Marathi": "प्रश्नमंजुषा", "Bengali": "কুইজ", "Gujarati": "ક્વિઝ", "Punjabi": "ਕੁਇਜ਼", "Malayalam": "ക്വിസുകൾ", "Odia": "କୁଇଜ୍"
    },
    "Worksheets": {
        "English": "Worksheets", "Hindi": "वर्कशीट", "Kannada": "ವರ್ಕ್‌ಶೀಟ್‌ಗಳು", "Tamil": "வேலைத்தாள்கள்", "Telugu": "వర్క్‌షీట్‌లు", "Marathi": "वर्कशीट", "Bengali": "ওয়ার্কশীট", "Gujarati": "વર્કશીટ", "Punjabi": "ਵਰਕਸ਼ੀਟ", "Malayalam": "വർക്ക്‌ഷീറ്റുകൾ", "Odia": "ୱର୍କସିଟ୍"
    },
    "Visual aids": {
        "English": "Visual aids", "Hindi": "दृश्य सहायक", "Kannada": "ದೃಶ್ಯ ಸಹಾಯಕಗಳು", "Tamil": "காட்சி உதவிகள்", "Telugu": "దృశ్య సహాయకాలు", "Marathi": "दृश्य साधने", "Bengali": "ভিজ্যুয়াল এইডস", "Gujarati": "વિઝ્યુઅલ એઇડ્સ", "Punjabi": "ਵਿਜ਼ੂਅਲ ਏਡਜ਼", "Malayalam": "ദൃശ്യ സഹായികൾ", "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍ସ"
    },
    "Rubrics": {
        "English": "Rubrics", "Hindi": "मूल्यांकन मानक", "Kannada": "ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು", "Tamil": "மதிப்பீட்டு அளவுகோல்கள்", "Telugu": "మూల్యాంకన ప్రమాణాలు", "Marathi": "मूल्यांकन निकष", "Bengali": "মূল্যায়ন মানদণ্ড", "Gujarati": "મૂલ્યાંકન માપદંડ", "Punjabi": "ਮੁਲਾਂਕਣ ਮਾਪਦੰਡ", "Malayalam": "മൂല്യനിർണ്ണയ മാനദണ്ഡങ്ങൾ", "Odia": "ମୂଲ୍ୟାୟନ ମାନଦଣ୍ଡ"
    },
    "Exam papers": {
        "English": "Exam papers", "Hindi": "परीक्षा प्रश्न पत्र", "Kannada": "ಪರೀಕ್ಷಾ ಪತ್ರಗಳು", "Tamil": "தேர்வுத் தாள்கள்", "Telugu": "పరీక్షా పత్రాలు", "Marathi": "परीक्षा प्रश्नपत्रिका", "Bengali": "পরীক্ষার প্রশ্নপত্র", "Gujarati": "પરીક્ષા પેપર", "Punjabi": "ਪ੍ਰੀਖਿਆ ਪੇਪਰ", "Malayalam": "പരീക്ഷാ പേപ്പറുകൾ", "Odia": "ପରୀକ୍ଷା ପ୍ରଶ୍ନପତ୍ର"
    },
    "Instant answers": {
        "English": "Instant answers", "Hindi": "त्वरित उत्तर", "Kannada": "ತಕ್ಷಣದ ಉತ್ತರಗಳು", "Tamil": "உடனடி பதில்கள்", "Telugu": "తక్షణ సమాధానాలు", "Marathi": "त्वरित उत्तरे", "Bengali": "তাৎক্ষণিক উত্তর", "Gujarati": "તાત્કાલિક જવાબો", "Punjabi": "ਤੁਰੰਤ ਜਵਾਬ", "Malayalam": "തൽക്ഷണ ഉത്തരങ്ങൾ", "Odia": "ତତ୍କ୍ଷଣାତ୍ ଉତ୍ତର"
    },
    "Video stories": {
        "English": "Video stories", "Hindi": "वीडियो कहानियां", "Kannada": "ವೀಡಿಯೊ ಕಥೆಗಳು", "Tamil": "வீடியோ கதைகள்", "Telugu": "వీడియో కథలు", "Marathi": "व्हिडिओ कथा", "Bengali": "ভিডিও গল্প", "Gujarati": "વિડિઓ વાર્તાઓ", "Punjabi": "ਵੀਡੀਓ ਕਹਾਣੀਆਂ", "Malayalam": "വീഡിയോ കഥകൾ", "Odia": "ଭିଡିଓ କାହାଣୀ"
    },
    "Teacher training": {
        "English": "Teacher training", "Hindi": "शिक्षक प्रशिक्षण", "Kannada": "ಶಿಕ್ಷಕ ತರಬೇತಿ", "Tamil": "ஆசிரியர் பயிற்சி", "Telugu": "ఉపాధ్యాయ శిక్షణ", "Marathi": "शिक्षक प्रशिक्षण", "Bengali": "শিক্ষক প্রশিক্ষণ", "Gujarati": "શિક્ષક તાલીમ", "Punjabi": "ਅਧਿਆਪਕ ਸਿਖਲਾਈ", "Malayalam": "അധ്യാപക പരിശീലനം", "Odia": "ଶିକ୍ଷକ ତାଲିମ"
    },
    "Field trips": {
        "English": "Field trips", "Hindi": "क्षेत्र भ्रमण", "Kannada": "ಕ್ಷೇತ್ರ ಪ್ರವಾಸಗಳು", "Tamil": "களப் பயணங்கள்", "Telugu": "క్షేత్ర యాత్రలు", "Marathi": "क्षेत्रभेटी", "Bengali": "ফিল্ড ট্রিপ", "Gujarati": "ફીલ્ડ ટ્રીપ", "Punjabi": "ਫੀਲਡ ਟ੍ਰਿਪ", "Malayalam": "ഫീൽഡ് ട്രിപ്പുകൾ", "Odia": "କ୍ଷେତ୍ର ଭ୍ରମଣ"
    },
    "Content creator": {
        "English": "Content creator", "Hindi": "सामग्री निर्माता", "Kannada": "ವಿಷಯ ರಚನೆಕಾರ", "Tamil": "உள்ளடக்க உருவாக்குநர்", "Telugu": "కంటెంట్ సృష్టికర్త", "Marathi": "सामग्री निर्माता", "Bengali": "কন্টেন্ট নির্মাতা", "Gujarati": "સામગ્રી સર્જક", "Punjabi": "ਸਮੱਗਰੀ ਨਿਰਮਾਤਾ", "Malayalam": "ഉള്ളടക്ക സ്രഷ്ടാവ്", "Odia": "ବିଷୟବସ୍ତୁ ସ୍ରଷ୍ଟା"
    },
    "Avatar": {
        "English": "Avatar", "Hindi": "अवतार", "Kannada": "ಅವತಾರ", "Tamil": "அவதார்", "Telugu": "అవతారం", "Marathi": "अवतार", "Bengali": "অবতার", "Gujarati": "અવતાર", "Punjabi": "ਅਵਤਾਰ", "Malayalam": "അവതാർ", "Odia": "ଅବତାର"
    },

    // === Empty-state dashboard ===
    "Welcome, {name}": {
        "English": "Welcome, {name}", "Hindi": "स्वागत है, {name}", "Kannada": "ಸ್ವಾಗತ, {name}", "Tamil": "வரவேற்கிறோம், {name}", "Telugu": "స్వాగతం, {name}", "Marathi": "स्वागत आहे, {name}", "Bengali": "স্বাগতম, {name}", "Gujarati": "સ્વાગત છે, {name}", "Punjabi": "ਜੀ ਆਇਆਂ ਨੂੰ, {name}", "Malayalam": "സ്വാഗതം, {name}", "Odia": "ସ୍ୱାଗତ, {name}"
    },
    "Welcome to SahayakAI": {
        "English": "Welcome to SahayakAI", "Hindi": "SahayakAI में आपका स्वागत है", "Kannada": "SahayakAI ಗೆ ಸ್ವಾಗತ", "Tamil": "SahayakAI இல் வரவேற்கிறோம்", "Telugu": "SahayakAI కి స్వాగతం", "Marathi": "SahayakAI मध्ये आपले स्वागत आहे", "Bengali": "SahayakAI-তে স্বাগতম", "Gujarati": "SahayakAI માં સ્વાગત છે", "Punjabi": "SahayakAI ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ", "Malayalam": "SahayakAI ലേക്ക് സ്വാഗതം", "Odia": "SahayakAI କୁ ସ୍ୱାଗତ"
    },
    "Finish setting up your school to see your dashboard.": {
        "English": "Finish setting up your school to see your dashboard.", "Hindi": "अपना डैशबोर्ड देखने के लिए अपने स्कूल की सेटअप पूरी करें।", "Kannada": "ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನೋಡಲು ನಿಮ್ಮ ಶಾಲೆಯ ಸೆಟಪ್ ಪೂರ್ಣಗೊಳಿಸಿ.", "Tamil": "உங்கள் டாஷ்போர்டைப் பார்க்க உங்கள் பள்ளியின் அமைப்பை முடிக்கவும்.", "Telugu": "మీ డ్యాష్‌బోర్డ్ చూడటానికి మీ పాఠశాల సెటప్ పూర్తి చేయండి.", "Marathi": "तुमचा डॅशबोर्ड पाहण्यासाठी तुमच्या शाळेची सेटअप पूर्ण करा.", "Bengali": "আপনার ড্যাশবোর্ড দেখতে আপনার স্কুল সেটআপ সম্পন্ন করুন।", "Gujarati": "તમારું ડેશબોર્ડ જોવા માટે તમારી શાળાનું સેટઅપ પૂર્ણ કરો.", "Punjabi": "ਆਪਣਾ ਡੈਸ਼ਬੋਰਡ ਵੇਖਣ ਲਈ ਆਪਣੇ ਸਕੂਲ ਦਾ ਸੈਟਅੱਪ ਪੂਰਾ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ ഡാഷ്‌ബോർഡ് കാണാൻ നിങ്ങളുടെ സ്കൂൾ സജ്ജീകരണം പൂർത്തിയാക്കുക.", "Odia": "ଆପଣଙ୍କ ଡ୍ୟାସବୋର୍ଡ ଦେଖିବାକୁ ଆପଣଙ୍କ ବିଦ୍ୟାଳୟ ସେଟଅପ୍ ସମାପ୍ତ କରନ୍ତୁ।"
    },
    "Your school-wide analytics will appear here once a few teachers are active.": {
        "English": "Your school-wide analytics will appear here once a few teachers are active.", "Hindi": "कुछ शिक्षकों के सक्रिय होने पर आपके स्कूल-व्यापी विश्लेषण यहां दिखाई देंगे।", "Kannada": "ಕೆಲವು ಶಿಕ್ಷಕರು ಸಕ್ರಿಯವಾದ ನಂತರ ನಿಮ್ಮ ಶಾಲಾ-ವ್ಯಾಪಿ ವಿಶ್ಲೇಷಣೆಗಳು ಇಲ್ಲಿ ಗೋಚರಿಸುತ್ತವೆ.", "Tamil": "சில ஆசிரியர்கள் செயலில் இருந்தவுடன் உங்கள் பள்ளி அளவிலான பகுப்பாய்வுகள் இங்கே தோன்றும்.", "Telugu": "కొందరు ఉపాధ్యాయులు క్రియాశీలంగా ఉన్నాక మీ పాఠశాల-వ్యాప్త విశ్లేషణలు ఇక్కడ కనిపిస్తాయి.", "Marathi": "काही शिक्षक सक्रिय झाल्यानंतर तुमचे शाळा-व्यापी विश्लेषण येथे दिसेल.", "Bengali": "কয়েকজন শিক্ষক সক্রিয় হলে আপনার স্কুল-ব্যাপী বিশ্লেষণ এখানে দেখা যাবে।", "Gujarati": "થોડા શિક્ષકો સક્રિય થયા પછી તમારું શાળા-વ્યાપી વિશ્લેષણ અહીં દેખાશે.", "Punjabi": "ਕੁਝ ਅਧਿਆਪਕਾਂ ਦੇ ਸਰਗਰਮ ਹੋਣ 'ਤੇ ਤੁਹਾਡੇ ਸਕੂਲ-ਵਿਆਪੀ ਵਿਸ਼ਲੇਸ਼ਣ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ।", "Malayalam": "കുറച്ച് അധ്യാപകർ സജീവമായാൽ നിങ്ങളുടെ സ്കൂൾ-വ്യാപക അനലിറ്റിക്സ് ഇവിടെ ദൃശ്യമാകും.", "Odia": "କିଛି ଶିକ୍ଷକ ସକ୍ରିୟ ହେଲେ ଆପଣଙ୍କ ବିଦ୍ୟାଳୟ-ବ୍ୟାପୀ ବିଶ୍ଳେଷଣ ଏଠାରେ ଦେଖାଯିବ।"
    },
    "Invite your teachers": {
        "English": "Invite your teachers", "Hindi": "अपने शिक्षकों को आमंत्रित करें", "Kannada": "ನಿಮ್ಮ ಶಿಕ್ಷಕರನ್ನು ಆಹ್ವಾನಿಸಿ", "Tamil": "உங்கள் ஆசிரியர்களை அழைக்கவும்", "Telugu": "మీ ఉపాధ్యాయులను ఆహ్వానించండి", "Marathi": "तुमच्या शिक्षकांना आमंत्रित करा", "Bengali": "আপনার শিক্ষকদের আমন্ত্রণ জানান", "Gujarati": "તમારા શિક્ષકોને આમંત્રિત કરો", "Punjabi": "ਆਪਣੇ ਅਧਿਆਪਕਾਂ ਨੂੰ ਸੱਦਾ ਦਿਓ", "Malayalam": "നിങ്ങളുടെ അധ്യാപകരെ ക്ഷണിക്കുക", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷକମାନଙ୍କୁ ନିମନ୍ତ୍ରଣ କରନ୍ତୁ"
    },
    "Real analytics start once 3 or more teachers are using SahayakAI. Most schools invite a pilot group of 5 first.": {
        "English": "Real analytics start once 3 or more teachers are using SahayakAI. Most schools invite a pilot group of 5 first.", "Hindi": "वास्तविक विश्लेषण तब शुरू होता है जब 3 या अधिक शिक्षक SahayakAI का उपयोग कर रहे हों। अधिकांश स्कूल पहले 5 के पायलट समूह को आमंत्रित करते हैं।", "Kannada": "3 ಅಥವಾ ಹೆಚ್ಚು ಶಿಕ್ಷಕರು SahayakAI ಬಳಸಲು ಪ್ರಾರಂಭಿಸಿದಾಗ ನಿಜವಾದ ವಿಶ್ಲೇಷಣೆ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ. ಹೆಚ್ಚಿನ ಶಾಲೆಗಳು ಮೊದಲು 5 ಜನರ ಪೈಲಟ್ ಗುಂಪನ್ನು ಆಹ್ವಾನಿಸುತ್ತವೆ.", "Tamil": "3 அல்லது அதற்கு மேற்பட்ட ஆசிரியர்கள் SahayakAI ஐப் பயன்படுத்தத் தொடங்கியதும் உண்மையான பகுப்பாய்வு தொடங்கும். பெரும்பாலான பள்ளிகள் முதலில் 5 பேர் கொண்ட பைலட் குழுவை அழைக்கின்றன.", "Telugu": "3 లేదా అంతకంటే ఎక్కువ ఉపాధ్యాయులు SahayakAI ఉపయోగించడం మొదలుపెట్టినప్పుడు నిజమైన విశ్లేషణలు ప్రారంభమవుతాయి. చాలా పాఠశాలలు మొదట 5 మంది పైలట్ గ్రూపును ఆహ్వానిస్తాయి.", "Marathi": "3 किंवा अधिक शिक्षक SahayakAI वापरण्यास सुरुवात केल्यानंतर खरे विश्लेषण सुरू होते. बहुतेक शाळा प्रथम 5 जणांच्या पायलट गटाला आमंत्रित करतात.", "Bengali": "3 বা তার বেশি শিক্ষক SahayakAI ব্যবহার শুরু করলে আসল বিশ্লেষণ শুরু হয়। বেশিরভাগ স্কুল প্রথমে 5 জনের একটি পাইলট গ্রুপকে আমন্ত্রণ জানায়।", "Gujarati": "3 અથવા વધુ શિક્ષકો SahayakAI નો ઉપયોગ કરવાનું શરૂ કરે છે ત્યારે વાસ્તવિક વિશ્લેષણ શરૂ થાય છે. મોટાભાગની શાળાઓ પ્રથમ 5 ના પાયલોટ જૂથને આમંત્રિત કરે છે.", "Punjabi": "3 ਜਾਂ ਵੱਧ ਅਧਿਆਪਕ SahayakAI ਵਰਤਣਾ ਸ਼ੁਰੂ ਕਰਦੇ ਹਨ ਤਾਂ ਅਸਲੀ ਵਿਸ਼ਲੇਸ਼ਣ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ। ਜ਼ਿਆਦਾਤਰ ਸਕੂਲ ਪਹਿਲਾਂ 5 ਦਾ ਪਾਇਲਟ ਸਮੂਹ ਸੱਦਦੇ ਹਨ।", "Malayalam": "3 അല്ലെങ്കിൽ അതിലധികം അധ്യാപകർ SahayakAI ഉപയോഗിക്കാൻ തുടങ്ങിയാൽ യഥാർത്ഥ അനലിറ്റിക്സ് ആരംഭിക്കും. മിക്ക സ്കൂളുകളും ആദ്യം 5 പേരുടെ പൈലറ്റ് ഗ്രൂപ്പിനെ ക്ഷണിക്കുന്നു.", "Odia": "3 କିମ୍ବା ଅଧିକ ଶିକ୍ଷକ SahayakAI ବ୍ୟବହାର କରିବା ଆରମ୍ଭ କଲେ ପ୍ରକୃତ ବିଶ୍ଳେଷଣ ଆରମ୍ଭ ହୁଏ। ଅଧିକାଂଶ ବିଦ୍ୟାଳୟ ପ୍ରଥମେ 5 ଜଣିଆ ପାଇଲଟ୍ ଗୋଷ୍ଠୀକୁ ନିମନ୍ତ୍ରଣ କରନ୍ତି।"
    },
    "Invite teachers": {
        "English": "Invite teachers", "Hindi": "शिक्षकों को आमंत्रित करें", "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಆಹ್ವಾನಿಸಿ", "Tamil": "ஆசிரியர்களை அழைக்கவும்", "Telugu": "ఉపాధ్యాయులను ఆహ్వానించండి", "Marathi": "शिक्षकांना आमंत्रित करा", "Bengali": "শিক্ষকদের আমন্ত্রণ জানান", "Gujarati": "શિક્ષકોને આમંત્રિત કરો", "Punjabi": "ਅਧਿਆਪਕਾਂ ਨੂੰ ਸੱਦਾ ਦਿਓ", "Malayalam": "അധ്യാപകരെ ക്ഷണിക്കുക", "Odia": "ଶିକ୍ଷକମାନଙ୍କୁ ନିମନ୍ତ୍ରଣ କରନ୍ତୁ"
    },
    "Try the product yourself": {
        "English": "Try the product yourself", "Hindi": "उत्पाद को स्वयं आज़माएं", "Kannada": "ಉತ್ಪನ್ನವನ್ನು ಸ್ವತಃ ಪ್ರಯತ್ನಿಸಿ", "Tamil": "தயாரிப்பை நீங்களே முயற்சி செய்யவும்", "Telugu": "ఉత్పత్తిని మీరే ప్రయత్నించండి", "Marathi": "उत्पादन स्वतः वापरून पहा", "Bengali": "নিজেই পণ্যটি ব্যবহার করে দেখুন", "Gujarati": "ઉત્પાદન જાતે અજમાવો", "Punjabi": "ਉਤਪਾਦ ਖੁਦ ਅਜ਼ਮਾਓ", "Malayalam": "ഉൽപ്പന്നം സ്വയം പരീക്ഷിക്കുക", "Odia": "ଉତ୍ପାଦକୁ ନିଜେ ଚେଷ୍ଟା କରନ୍ତୁ"
    },
    "Generate a lesson plan, quiz, or worksheet the same way your teachers will. Every principal should know what the teacher experience feels like.": {
        "English": "Generate a lesson plan, quiz, or worksheet the same way your teachers will. Every principal should know what the teacher experience feels like.", "Hindi": "वैसे ही पाठ योजना, प्रश्नोत्तरी या वर्कशीट बनाएं जैसे आपके शिक्षक बनाएंगे। हर प्रधानाचार्य को पता होना चाहिए कि शिक्षक का अनुभव कैसा लगता है।", "Kannada": "ನಿಮ್ಮ ಶಿಕ್ಷಕರು ಮಾಡುವಂತೆಯೇ ಪಾಠ ಯೋಜನೆ, ರಸಪ್ರಶ್ನೆ ಅಥವಾ ವರ್ಕ್‌ಶೀಟ್ ರಚಿಸಿ. ಪ್ರತಿ ಪ್ರಾಂಶುಪಾಲರಿಗೂ ಶಿಕ್ಷಕ ಅನುಭವ ಹೇಗಿರುತ್ತದೆ ಎಂದು ತಿಳಿದಿರಬೇಕು.", "Tamil": "உங்கள் ஆசிரியர்களைப் போலவே பாடத் திட்டம், வினாடி வினா அல்லது வேலைத்தாள் உருவாக்கவும். ஒவ்வொரு முதல்வரும் ஆசிரியர் அனுபவம் எப்படி இருக்கும் என்பதை அறிந்திருக்க வேண்டும்.", "Telugu": "మీ ఉపాధ్యాయులు చేసే విధంగానే పాఠ ప్రణాళిక, క్విజ్ లేదా వర్క్‌షీట్‌ను సృష్టించండి. ప్రతి ప్రధానోపాధ్యాయుడు ఉపాధ్యాయ అనుభవం ఎలా ఉంటుందో తెలుసుకోవాలి.", "Marathi": "तुमचे शिक्षक ज्या प्रकारे करतील त्याच पद्धतीने पाठ योजना, प्रश्नमंजुषा किंवा वर्कशीट तयार करा. प्रत्येक मुख्याध्यापकाला शिक्षकाचा अनुभव कसा वाटतो हे माहित असले पाहिजे.", "Bengali": "আপনার শিক্ষকরা যেভাবে তৈরি করবেন সেভাবেই একটি পাঠ পরিকল্পনা, কুইজ বা ওয়ার্কশীট তৈরি করুন। প্রত্যেক প্রধান শিক্ষকের জানা উচিত শিক্ষকের অভিজ্ঞতা কেমন।", "Gujarati": "તમારા શિક્ષકો જે રીતે કરશે તે જ રીતે પાઠ યોજના, ક્વિઝ અથવા વર્કશીટ બનાવો. દરેક આચાર્યને જાણવું જોઈએ કે શિક્ષકનો અનુભવ કેવો લાગે છે.", "Punjabi": "ਆਪਣੇ ਅਧਿਆਪਕਾਂ ਵਾਂਗ ਹੀ ਇੱਕ ਪਾਠ ਯੋਜਨਾ, ਕੁਇਜ਼, ਜਾਂ ਵਰਕਸ਼ੀਟ ਤਿਆਰ ਕਰੋ। ਹਰ ਪ੍ਰਿੰਸੀਪਲ ਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ ਕਿ ਅਧਿਆਪਕ ਦਾ ਅਨੁਭਵ ਕਿਹੋ ਜਿਹਾ ਹੁੰਦਾ ਹੈ।", "Malayalam": "നിങ്ങളുടെ അധ്യാപകർ ചെയ്യുന്ന അതേ രീതിയിൽ ഒരു പാഠ പദ്ധതി, ക്വിസ് അല്ലെങ്കിൽ വർക്ക്‌ഷീറ്റ് സൃഷ്ടിക്കുക. ഓരോ പ്രിൻസിപ്പലും അധ്യാപക അനുഭവം എങ്ങനെ തോന്നുന്നുവെന്ന് അറിയണം.", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷକମାନେ ଯେପରି କରିବେ ସେହିପରି ଏକ ପାଠ ଯୋଜନା, କୁଇଜ୍ କିମ୍ବା ୱର୍କସିଟ୍ ସୃଷ୍ଟି କରନ୍ତୁ। ପ୍ରତ୍ୟେକ ପ୍ରଧାନ ଶିକ୍ଷକ ଜାଣିବା ଉଚିତ ଯେ ଶିକ୍ଷକ ଅଭିଜ୍ଞତା କିପରି ଅନୁଭବ ହୁଏ।"
    },
    "Open teacher tools": {
        "English": "Open teacher tools", "Hindi": "शिक्षक टूल खोलें", "Kannada": "ಶಿಕ್ಷಕ ಪರಿಕರಗಳನ್ನು ತೆರೆಯಿರಿ", "Tamil": "ஆசிரியர் கருவிகளைத் திற", "Telugu": "ఉపాధ్యాయ సాధనాలను తెరవండి", "Marathi": "शिक्षक साधने उघडा", "Bengali": "শিক্ষক টুল খুলুন", "Gujarati": "શિક્ષક સાધનો ખોલો", "Punjabi": "ਅਧਿਆਪਕ ਟੂਲ ਖੋਲ੍ਹੋ", "Malayalam": "അധ്യാപക ഉപകരണങ്ങൾ തുറക്കുക", "Odia": "ଶିକ୍ଷକ ଉପକରଣ ଖୋଲନ୍ତୁ"
    },
    "Preview a full dashboard": {
        "English": "Preview a full dashboard", "Hindi": "पूर्ण डैशबोर्ड का पूर्वावलोकन करें", "Kannada": "ಪೂರ್ಣ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಪೂರ್ವವೀಕ್ಷಣೆ ಮಾಡಿ", "Tamil": "முழு டாஷ்போர்டை முன்னோட்டமிடவும்", "Telugu": "పూర్తి డ్యాష్‌బోర్డ్‌ను పూర్వావలోకనం చేయండి", "Marathi": "संपूर्ण डॅशबोर्डचे पूर्वावलोकन करा", "Bengali": "সম্পূর্ণ ড্যাশবোর্ড প্রিভিউ করুন", "Gujarati": "સંપૂર્ણ ડેશબોર્ડનું પૂર્વાવલોકન કરો", "Punjabi": "ਪੂਰੇ ਡੈਸ਼ਬੋਰਡ ਦੀ ਝਲਕ ਵੇਖੋ", "Malayalam": "പൂർണ്ണ ഡാഷ്‌ബോർഡ് പ്രിവ്യൂ ചെയ്യുക", "Odia": "ସମ୍ପୂର୍ଣ୍ଣ ଡ୍ୟାସବୋର୍ଡ ପୂର୍ବାବଲୋକନ କରନ୍ତୁ"
    },
    "See what this page looks like once your school is active: weekly active teachers, content generated, time saved, feature adoption, at-risk alerts.": {
        "English": "See what this page looks like once your school is active: weekly active teachers, content generated, time saved, feature adoption, at-risk alerts.", "Hindi": "देखें कि आपका स्कूल सक्रिय होने पर यह पेज कैसा दिखता है: साप्ताहिक सक्रिय शिक्षक, उत्पन्न सामग्री, बचाया गया समय, फ़ीचर अपनाना, जोखिम चेतावनी।", "Kannada": "ನಿಮ್ಮ ಶಾಲೆ ಸಕ್ರಿಯವಾದಾಗ ಈ ಪುಟ ಹೇಗೆ ಕಾಣುತ್ತದೆ ಎಂದು ನೋಡಿ: ಸಾಪ್ತಾಹಿಕ ಸಕ್ರಿಯ ಶಿಕ್ಷಕರು, ರಚಿಸಲಾದ ವಿಷಯ, ಉಳಿಸಿದ ಸಮಯ, ವೈಶಿಷ್ಟ್ಯ ಅಳವಡಿಕೆ, ಅಪಾಯ ಎಚ್ಚರಿಕೆಗಳು.", "Tamil": "உங்கள் பள்ளி செயலில் இருக்கும்போது இந்தப் பக்கம் எப்படி இருக்கும் என்பதைப் பாருங்கள்: வாராந்திர செயலில் உள்ள ஆசிரியர்கள், உருவாக்கப்பட்ட உள்ளடக்கம், சேமிக்கப்பட்ட நேரம், அம்ச ஏற்பு, ஆபத்து எச்சரிக்கைகள்.", "Telugu": "మీ పాఠశాల క్రియాశీలంగా ఉన్నప్పుడు ఈ పేజీ ఎలా కనిపిస్తుందో చూడండి: వారానికొక సారి క్రియాశీల ఉపాధ్యాయులు, సృష్టించబడిన కంటెంట్, ఆదా చేసిన సమయం, ఫీచర్ స్వీకరణ, ప్రమాద హెచ్చరికలు.", "Marathi": "तुमची शाळा सक्रिय असताना हे पान कसे दिसते ते पहा: साप्ताहिक सक्रिय शिक्षक, तयार केलेली सामग्री, वाचवलेला वेळ, वैशिष्ट्य स्वीकार, धोका सूचना.", "Bengali": "আপনার স্কুল সক্রিয় হলে এই পৃষ্ঠাটি কেমন দেখাবে দেখুন: সাপ্তাহিক সক্রিয় শিক্ষক, তৈরি কন্টেন্ট, সংরক্ষিত সময়, ফিচার গ্রহণ, ঝুঁকি সতর্কতা।", "Gujarati": "તમારી શાળા સક્રિય હોય ત્યારે આ પાનું કેવું દેખાય છે તે જુઓ: સાપ્તાહિક સક્રિય શિક્ષકો, બનાવેલી સામગ્રી, બચાવેલો સમય, સુવિધા અપનાવવી, જોખમ ચેતવણીઓ.", "Punjabi": "ਵੇਖੋ ਕਿ ਤੁਹਾਡਾ ਸਕੂਲ ਸਰਗਰਮ ਹੋਣ 'ਤੇ ਇਹ ਪੰਨਾ ਕਿਹੋ ਜਿਹਾ ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ: ਹਫ਼ਤਾਵਾਰੀ ਸਰਗਰਮ ਅਧਿਆਪਕ, ਤਿਆਰ ਸਮੱਗਰੀ, ਬਚਾਇਆ ਸਮਾਂ, ਵਿਸ਼ੇਸ਼ਤਾ ਅਪਣਾਉਣਾ, ਜੋਖਮ ਚੇਤਾਵਨੀਆਂ।", "Malayalam": "നിങ്ങളുടെ സ്കൂൾ സജീവമാകുമ്പോൾ ഈ പേജ് എങ്ങനെ കാണപ്പെടും എന്ന് കാണുക: പ്രതിവാര സജീവ അധ്യാപകർ, സൃഷ്ടിച്ച ഉള്ളടക്കം, ലാഭിച്ച സമയം, ഫീച്ചർ സ്വീകരണം, അപകട മുന്നറിയിപ്പുകൾ.", "Odia": "ଆପଣଙ୍କ ବିଦ୍ୟାଳୟ ସକ୍ରିୟ ହେଲେ ଏହି ପୃଷ୍ଠା କିପରି ଦେଖାଯାଏ ଦେଖନ୍ତୁ: ସାପ୍ତାହିକ ସକ୍ରିୟ ଶିକ୍ଷକ, ସୃଷ୍ଟି ହୋଇଥିବା ବିଷୟବସ୍ତୁ, ସଞ୍ଚୟ ହୋଇଥିବା ସମୟ, ବୈଶିଷ୍ଟ୍ୟ ଗ୍ରହଣ, ବିପଦ ସତର୍କତା।"
    },
    "See preview": {
        "English": "See preview", "Hindi": "पूर्वावलोकन देखें", "Kannada": "ಪೂರ್ವವೀಕ್ಷಣೆ ನೋಡಿ", "Tamil": "முன்னோட்டத்தைப் பார்க்க", "Telugu": "పూర్వావలోకనం చూడండి", "Marathi": "पूर्वावलोकन पहा", "Bengali": "প্রিভিউ দেখুন", "Gujarati": "પૂર્વાવલોકન જુઓ", "Punjabi": "ਝਲਕ ਵੇਖੋ", "Malayalam": "പ്രിവ്യൂ കാണുക", "Odia": "ପୂର୍ବାବଲୋକନ ଦେଖନ୍ତୁ"
    },
    "Profile Updated": {
        "English": "Profile Updated", "Hindi": "प्रोफ़ाइल अपडेट हो गई", "Kannada": "ಪ್ರೊಫೈಲ್ ನವೀಕರಿಸಲಾಗಿದೆ", "Tamil": "சுயவிவரம் புதுப்பிக்கப்பட்டது", "Telugu": "ప్రొఫైల్ నవీకరించబడింది", "Marathi": "प्रोफाइल अद्ययावत झाली", "Bengali": "প্রোফাইল আপডেট হয়েছে", "Gujarati": "પ્રોફાઇલ અપડેટ થઈ", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਅੱਪਡੇਟ ਹੋਈ", "Malayalam": "പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്തു", "Odia": "ପ୍ରୋଫାଇଲ୍ ଅପଡେଟ୍ ହୋଇଛି"
    },
    "Your professional profile has been successfully updated.": {
        "English": "Your professional profile has been successfully updated.", "Hindi": "आपकी पेशेवर प्रोफ़ाइल सफलतापूर्वक अपडेट कर दी गई है।", "Kannada": "ನಿಮ್ಮ ವೃತ್ತಿಪರ ಪ್ರೊಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ.", "Tamil": "உங்கள் தொழில்முறை சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது.", "Telugu": "మీ వృత్తిపరమైన ప్రొఫైల్ విజయవంతంగా నవీకరించబడింది.", "Marathi": "तुमची व्यावसायिक प्रोफाइल यशस्वीरित्या अद्ययावत झाली आहे.", "Bengali": "আপনার পেশাদার প্রোফাইল সফলভাবে আপডেট হয়েছে।", "Gujarati": "તમારી વ્યાવસાયિક પ્રોફાઇલ સફળતાપૂર્વક અપડેટ થઈ ગઈ છે.", "Punjabi": "ਤੁਹਾਡੀ ਪੇਸ਼ੇਵਰ ਪ੍ਰੋਫਾਈਲ ਸਫਲਤਾਪੂਰਵਕ ਅੱਪਡੇਟ ਹੋ ਗਈ ਹੈ।", "Malayalam": "നിങ്ങളുടെ പ്രൊഫഷണൽ പ്രൊഫൈൽ വിജയകരമായി അപ്ഡേറ്റ് ചെയ്തു.", "Odia": "ଆପଣଙ୍କର ବୃତ୍ତିଗତ ପ୍ରୋଫାଇଲ୍ ସଫଳତାର ସହ ଅପଡେଟ୍ ହୋଇଛି।"
    },
    "Update Failed": {
        "English": "Update Failed", "Hindi": "अपडेट विफल", "Kannada": "ನವೀಕರಣ ವಿಫಲವಾಗಿದೆ", "Tamil": "புதுப்பித்தல் தோல்வியடைந்தது", "Telugu": "నవీకరణ విఫలమైంది", "Marathi": "अद्यतन अयशस्वी", "Bengali": "আপডেট ব্যর্থ হয়েছে", "Gujarati": "અપડેટ નિષ્ફળ", "Punjabi": "ਅੱਪਡੇਟ ਅਸਫਲ", "Malayalam": "അപ്ഡേറ്റ് പരാജയപ്പെട്ടു", "Odia": "ଅପଡେଟ୍ ବିଫଳ"
    },
    "There was an error updating your profile. Please try again.": {
        "English": "There was an error updating your profile. Please try again.", "Hindi": "आपकी प्रोफ़ाइल अपडेट करने में त्रुटि हुई। कृपया पुनः प्रयास करें।", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ನವೀಕರಿಸುವಲ್ಲಿ ದೋಷ ಉಂಟಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "உங்கள் சுயவிவரத்தைப் புதுப்பிப்பதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "మీ ప్రొఫైల్‌ను నవీకరించడంలో లోపం ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "तुमची प्रोफाइल अद्ययावत करताना त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "আপনার প্রোফাইল আপডেট করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "તમારી પ્રોફાઇલ અપડેટ કરવામાં ભૂલ આવી. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਅੱਪਡੇਟ ਕਰਨ ਵਿੱਚ ਗਲਤੀ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଅପଡେଟ୍ କରିବାରେ ତ୍ରୁଟି ହୋଇଛି। ଦୟାକରି ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Edit Professional Profile": {
        "English": "Edit Professional Profile", "Hindi": "पेशेवर प्रोफ़ाइल संपादित करें", "Kannada": "ವೃತ್ತಿಪರ ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ", "Tamil": "தொழில்முறை சுயவிவரத்தைத் திருத்து", "Telugu": "వృత్తిపరమైన ప్రొఫైల్ సవరించండి", "Marathi": "व्यावसायिक प्रोफाइल संपादित करा", "Bengali": "পেশাদার প্রোফাইল সম্পাদনা করুন", "Gujarati": "વ્યાવસાયિક પ્રોફાઇલ સંપાદિત કરો", "Punjabi": "ਪੇਸ਼ੇਵਰ ਪ੍ਰੋਫਾਈਲ ਸੰਪਾਦਿਤ ਕਰੋ", "Malayalam": "പ്രൊഫഷണൽ പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക", "Odia": "ବୃତ୍ତିଗତ ପ୍ରୋଫାଇଲ୍ ସମ୍ପାଦନ କରନ୍ତୁ"
    },
    "Update your professional details to build trust with other educators.": {
        "English": "Update your professional details to build trust with other educators.", "Hindi": "अन्य शिक्षकों के साथ विश्वास बनाने के लिए अपने पेशेवर विवरण अपडेट करें।", "Kannada": "ಇತರ ಶಿಕ್ಷಕರೊಂದಿಗೆ ವಿಶ್ವಾಸವನ್ನು ಬೆಳೆಸಲು ನಿಮ್ಮ ವೃತ್ತಿಪರ ವಿವರಗಳನ್ನು ನವೀಕರಿಸಿ.", "Tamil": "மற்ற கல்வியாளர்களுடன் நம்பிக்கையை வளர்க்க உங்கள் தொழில்முறை விவரங்களைப் புதுப்பிக்கவும்.", "Telugu": "ఇతర విద్యావేత్తలతో నమ్మకాన్ని పెంపొందించడానికి మీ వృత్తిపరమైన వివరాలను నవీకరించండి.", "Marathi": "इतर शिक्षकांसोबत विश्वास निर्माण करण्यासाठी तुमचे व्यावसायिक तपशील अद्ययावत करा.", "Bengali": "অন্যান্য শিক্ষাবিদদের সাথে বিশ্বাস গড়ে তুলতে আপনার পেশাদার বিবরণ আপডেট করুন।", "Gujarati": "અન્ય શિક્ષકો સાથે વિશ્વાસ બાંધવા માટે તમારી વ્યાવસાયિક વિગતો અપડેટ કરો.", "Punjabi": "ਹੋਰ ਸਿੱਖਿਅਕਾਂ ਨਾਲ ਭਰੋਸਾ ਬਣਾਉਣ ਲਈ ਆਪਣੇ ਪੇਸ਼ੇਵਰ ਵੇਰਵੇ ਅੱਪਡੇਟ ਕਰੋ।", "Malayalam": "മറ്റ് അധ്യാപകരുമായി വിശ്വാസം വളർത്താൻ നിങ്ങളുടെ പ്രൊഫഷണൽ വിശദാംശങ്ങൾ അപ്ഡേറ്റ് ചെയ്യുക.", "Odia": "ଅନ୍ୟ ଶିକ୍ଷାବିତ୍‌ଙ୍କ ସହ ବିଶ୍ୱାସ ଗଢ଼ିବା ପାଇଁ ଆପଣଙ୍କର ବୃତ୍ତିଗତ ବିବରଣୀ ଅପଡେଟ୍ କରନ୍ତୁ।"
    },
    "Display Name": {
        "English": "Display Name", "Hindi": "प्रदर्शन नाम", "Kannada": "ಪ್ರದರ್ಶನ ಹೆಸರು", "Tamil": "காட்சிப் பெயர்", "Telugu": "ప్రదర్శన పేరు", "Marathi": "प्रदर्शन नाव", "Bengali": "প্রদর্শন নাম", "Gujarati": "પ્રદર્શન નામ", "Punjabi": "ਡਿਸਪਲੇ ਨਾਮ", "Malayalam": "പ്രദർശന നാമം", "Odia": "ପ୍ରଦର୍ଶନ ନାମ"
    },
    "Full Name": {
        "English": "Full Name", "Hindi": "पूरा नाम", "Kannada": "ಪೂರ್ಣ ಹೆಸರು", "Tamil": "முழுப் பெயர்", "Telugu": "పూర్తి పేరు", "Marathi": "पूर्ण नाव", "Bengali": "পুরো নাম", "Gujarati": "પૂરું નામ", "Punjabi": "ਪੂਰਾ ਨਾਮ", "Malayalam": "പൂർണ്ണ നാമം", "Odia": "ସମ୍ପୂର୍ଣ୍ଣ ନାମ"
    },
    "Designation": {
        "English": "Designation", "Hindi": "पदनाम", "Kannada": "ಪದನಾಮ", "Tamil": "பதவி", "Telugu": "హోదా", "Marathi": "पदनाम", "Bengali": "পদবী", "Gujarati": "હોદ્દો", "Punjabi": "ਅਹੁਦਾ", "Malayalam": "പദവി", "Odia": "ପଦବୀ"
    },
    "e.g. Science Teacher": {
        "English": "e.g. Science Teacher", "Hindi": "उदा. विज्ञान शिक्षक", "Kannada": "ಉದಾ. ವಿಜ್ಞಾನ ಶಿಕ್ಷಕ", "Tamil": "எ.கா. அறிவியல் ஆசிரியர்", "Telugu": "ఉదా. సైన్స్ ఉపాధ్యాయుడు", "Marathi": "उदा. विज्ञान शिक्षक", "Bengali": "যেমন বিজ্ঞান শিক্ষক", "Gujarati": "દા.ત. વિજ્ઞાન શિક્ષક", "Punjabi": "ਜਿਵੇਂ ਵਿਗਿਆਨ ਅਧਿਆਪਕ", "Malayalam": "ഉദാ. സയൻസ് അധ്യാപകൻ", "Odia": "ଯଥା ବିଜ୍ଞାନ ଶିକ୍ଷକ"
    },
    "Department": {
        "English": "Department", "Hindi": "विभाग", "Kannada": "ವಿಭಾಗ", "Tamil": "துறை", "Telugu": "విభాగం", "Marathi": "विभाग", "Bengali": "বিভাগ", "Gujarati": "વિભાગ", "Punjabi": "ਵਿਭਾਗ", "Malayalam": "വകുപ്പ്", "Odia": "ବିଭାଗ"
    },
    "e.g. STEM": {
        "English": "e.g. STEM", "Hindi": "उदा. STEM", "Kannada": "ಉದಾ. STEM", "Tamil": "எ.கா. STEM", "Telugu": "ఉదా. STEM", "Marathi": "उदा. STEM", "Bengali": "যেমন STEM", "Gujarati": "દા.ત. STEM", "Punjabi": "ਜਿਵੇਂ STEM", "Malayalam": "ഉദാ. STEM", "Odia": "ଯଥା STEM"
    },
    "School / Institution": {
        "English": "School / Institution", "Hindi": "विद्यालय / संस्थान", "Kannada": "ಶಾಲೆ / ಸಂಸ್ಥೆ", "Tamil": "பள்ளி / நிறுவனம்", "Telugu": "పాఠశాల / సంస్థ", "Marathi": "शाळा / संस्था", "Bengali": "বিদ্যালয় / প্রতিষ্ঠান", "Gujarati": "શાળા / સંસ્થા", "Punjabi": "ਸਕੂਲ / ਸੰਸਥਾ", "Malayalam": "സ്കൂൾ / സ്ഥാപനം", "Odia": "ବିଦ୍ୟାଳୟ / ସଂସ୍ଥା"
    },
    "e.g. Delhi Public School": {
        "English": "e.g. Delhi Public School", "Hindi": "उदा. दिल्ली पब्लिक स्कूल", "Kannada": "ಉದಾ. ದೆಹಲಿ ಪಬ್ಲಿಕ್ ಸ್ಕೂಲ್", "Tamil": "எ.கா. டெல்லி பப்ளிக் ஸ்கூல்", "Telugu": "ఉదా. ఢిల్లీ పబ్లిక్ స్కూల్", "Marathi": "उदा. दिल्ली पब्लिक स्कूल", "Bengali": "যেমন দিল্লি পাবলিক স্কুল", "Gujarati": "દા.ત. દિલ્હી પબ્લિક સ્કૂલ", "Punjabi": "ਜਿਵੇਂ ਦਿੱਲੀ ਪਬਲਿਕ ਸਕੂਲ", "Malayalam": "ഉദാ. ഡൽഹി പബ്ലിക് സ്കൂൾ", "Odia": "ଯଥା ଦିଲ୍ଲୀ ପବ୍ଲିକ୍ ସ୍କୁଲ୍"
    },
    "Professional Bio": {
        "English": "Professional Bio", "Hindi": "पेशेवर परिचय", "Kannada": "ವೃತ್ತಿಪರ ಪರಿಚಯ", "Tamil": "தொழில்முறை சுயவிவரம்", "Telugu": "వృత్తిపరమైన పరిచయం", "Marathi": "व्यावसायिक परिचय", "Bengali": "পেশাদার পরিচিতি", "Gujarati": "વ્યાવસાયિક પરિચય", "Punjabi": "ਪੇਸ਼ੇਵਰ ਜਾਣ-ਪਛਾਣ", "Malayalam": "പ്രൊഫഷണൽ ബയോ", "Odia": "ବୃତ୍ତିଗତ ପରିଚୟ"
    },
    "Share a short summary of your teaching philosophy and experience...": {
        "English": "Share a short summary of your teaching philosophy and experience...", "Hindi": "अपनी शिक्षण दृष्टि और अनुभव का संक्षिप्त सारांश साझा करें...", "Kannada": "ನಿಮ್ಮ ಬೋಧನಾ ತತ್ತ್ವಶಾಸ್ತ್ರ ಮತ್ತು ಅನುಭವದ ಸಂಕ್ಷಿಪ್ತ ಸಾರಾಂಶವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ...", "Tamil": "உங்கள் கற்பித்தல் தத்துவம் மற்றும் அனுபவத்தின் சுருக்கமான சுருக்கத்தைப் பகிரவும்...", "Telugu": "మీ బోధనా తత్వశాస్త్రం మరియు అనుభవం యొక్క సంక్షిప్త సారాంశాన్ని పంచుకోండి...", "Marathi": "तुमच्या अध्यापन तत्त्वज्ञानाचा आणि अनुभवाचा थोडक्यात सारांश सामायिक करा...", "Bengali": "আপনার শিক্ষাদানের দর্শন এবং অভিজ্ঞতার একটি সংক্ষিপ্ত সারাংশ শেয়ার করুন...", "Gujarati": "તમારી શિક્ષણ ફિલસૂફી અને અનુભવનો ટૂંકો સારાંશ શેર કરો...", "Punjabi": "ਆਪਣੇ ਅਧਿਆਪਨ ਦਰਸ਼ਨ ਅਤੇ ਅਨੁਭਵ ਦਾ ਸੰਖੇਪ ਸਾਂਝਾ ਕਰੋ...", "Malayalam": "നിങ്ങളുടെ അധ്യാപന തത്വശാസ്ത്രത്തിന്റെയും അനുഭവത്തിന്റെയും ഒരു ഹ്രസ്വ സംഗ്രഹം പങ്കിടുക...", "Odia": "ଆପଣଙ୍କର ଶିକ୍ଷାଦାନ ଦର୍ଶନ ଓ ଅନୁଭବର ସଂକ୍ଷିପ୍ତ ସାରାଂଶ ସେୟାର କରନ୍ତୁ..."
    },
    "Years of Teaching Experience": {
        "English": "Years of Teaching Experience", "Hindi": "अध्यापन अनुभव के वर्ष", "Kannada": "ಬೋಧನಾ ಅನುಭವದ ವರ್ಷಗಳು", "Tamil": "கற்பித்தல் அனுபவ ஆண்டுகள்", "Telugu": "బోధనా అనుభవ సంవత్సరాలు", "Marathi": "अध्यापनाच्या अनुभवाची वर्षे", "Bengali": "শিক্ষকতার অভিজ্ঞতার বছর", "Gujarati": "શિક્ષણ અનુભવના વર્ષો", "Punjabi": "ਅਧਿਆਪਨ ਅਨੁਭਵ ਦੇ ਸਾਲ", "Malayalam": "അധ്യാപന പരിചയത്തിന്റെ വർഷങ്ങൾ", "Odia": "ଶିକ୍ଷାଦାନ ଅନୁଭବର ବର୍ଷ"
    },
    "e.g. 12": {
        "English": "e.g. 12", "Hindi": "उदा. 12", "Kannada": "ಉದಾ. 12", "Tamil": "எ.கா. 12", "Telugu": "ఉదా. 12", "Marathi": "उदा. 12", "Bengali": "যেমন ১২", "Gujarati": "દા.ત. 12", "Punjabi": "ਜਿਵੇਂ 12", "Malayalam": "ഉദാ. 12", "Odia": "ଯଥା 12"
    },
    "School Role": {
        "English": "School Role", "Hindi": "विद्यालय भूमिका", "Kannada": "ಶಾಲೆಯಲ್ಲಿ ಪಾತ್ರ", "Tamil": "பள்ளியின் பங்கு", "Telugu": "పాఠశాలలో పాత్ర", "Marathi": "शाळेतील भूमिका", "Bengali": "বিদ্যালয়ে ভূমিকা", "Gujarati": "શાળામાં ભૂમિકા", "Punjabi": "ਸਕੂਲ ਵਿੱਚ ਭੂਮਿਕਾ", "Malayalam": "സ്കൂൾ ഉത്തരവാദിത്തം", "Odia": "ବିଦ୍ୟାଳୟ ଭୂମିକା"
    },
    "Teacher (no admin role)": {
        "English": "Teacher (no admin role)", "Hindi": "शिक्षक (कोई प्रशासनिक भूमिका नहीं)", "Kannada": "ಶಿಕ್ಷಕ (ಯಾವುದೇ ಆಡಳಿತಾತ್ಮಕ ಪಾತ್ರವಿಲ್ಲ)", "Tamil": "ஆசிரியர் (நிர்வாகப் பங்கு இல்லை)", "Telugu": "ఉపాధ్యాయుడు (నిర్వాహక పాత్ర లేదు)", "Marathi": "शिक्षक (कोणतीही प्रशासकीय भूमिका नाही)", "Bengali": "শিক্ষক (কোনো প্রশাসনিক ভূমিকা নেই)", "Gujarati": "શિક્ષક (કોઈ વહીવટી ભૂમિકા નથી)", "Punjabi": "ਅਧਿਆਪਕ (ਕੋਈ ਪ੍ਰਸ਼ਾਸਕੀ ਭੂਮਿਕਾ ਨਹੀਂ)", "Malayalam": "അധ്യാപകൻ (അഡ്മിൻ പങ്കില്ല)", "Odia": "ଶିକ୍ଷକ (କୌଣସି ପ୍ରଶାସନିକ ଭୂମିକା ନାହିଁ)"
    },
    "Head of Department (HoD)": {
        "English": "Head of Department (HoD)", "Hindi": "विभागाध्यक्ष (HoD)", "Kannada": "ವಿಭಾಗದ ಮುಖ್ಯಸ್ಥ (HoD)", "Tamil": "துறைத் தலைவர் (HoD)", "Telugu": "విభాగాధిపతి (HoD)", "Marathi": "विभाग प्रमुख (HoD)", "Bengali": "বিভাগীয় প্রধান (HoD)", "Gujarati": "વિભાગના વડા (HoD)", "Punjabi": "ਵਿਭਾਗ ਮੁਖੀ (HoD)", "Malayalam": "വകുപ്പ് മേധാവി (HoD)", "Odia": "ବିଭାଗୀୟ ମୁଖ୍ୟ (HoD)"
    },
    "Academic Coordinator": {
        "English": "Academic Coordinator", "Hindi": "शैक्षणिक समन्वयक", "Kannada": "ಶೈಕ್ಷಣಿಕ ಸಮನ್ವಯಕ", "Tamil": "கல்வி ஒருங்கிணைப்பாளர்", "Telugu": "విద్యా సమన్వయకర్త", "Marathi": "शैक्षणिक समन्वयक", "Bengali": "একাডেমিক সমন্বয়কারী", "Gujarati": "શૈક્ષણિક સંયોજક", "Punjabi": "ਅਕਾਦਮਿਕ ਕੋਆਰਡੀਨੇਟਰ", "Malayalam": "അക്കാദമിക് കോർഡിനേറ്റർ", "Odia": "ଶିକ୍ଷାଗତ ସମନ୍ୱୟକାରୀ"
    },
    "Educational Qualifications": {
        "English": "Educational Qualifications", "Hindi": "शैक्षणिक योग्यताएँ", "Kannada": "ಶೈಕ್ಷಣಿಕ ಅರ್ಹತೆಗಳು", "Tamil": "கல்வித் தகுதிகள்", "Telugu": "విద్యా అర్హతలు", "Marathi": "शैक्षणिक पात्रता", "Bengali": "শিক্ষাগত যোগ্যতা", "Gujarati": "શૈક્ષણિક લાયકાતો", "Punjabi": "ਵਿਦਿਅਕ ਯੋਗਤਾਵਾਂ", "Malayalam": "വിദ്യാഭ്യാസ യോഗ്യതകൾ", "Odia": "ଶିକ୍ଷାଗତ ଯୋଗ୍ୟତା"
    },
    "Select all that apply": {
        "English": "Select all that apply", "Hindi": "जो भी लागू हो उन सभी का चयन करें", "Kannada": "ಅನ್ವಯಿಸುವ ಎಲ್ಲವನ್ನೂ ಆಯ್ಕೆಮಾಡಿ", "Tamil": "பொருந்தும் அனைத்தையும் தேர்ந்தெடுக்கவும்", "Telugu": "వర్తించే అన్నింటినీ ఎంచుకోండి", "Marathi": "लागू असलेले सर्व निवडा", "Bengali": "প্রযোজ্য সবগুলি নির্বাচন করুন", "Gujarati": "લાગુ પડતા બધા પસંદ કરો", "Punjabi": "ਲਾਗੂ ਹੋਣ ਵਾਲੇ ਸਾਰੇ ਚੁਣੋ", "Malayalam": "ബാധകമായവയെല്ലാം തിരഞ്ഞെടുക്കുക", "Odia": "ପ୍ରଯୁଜ୍ୟ ସମସ୍ତ ବାଛନ୍ତୁ"
    },
    "Save Changes": {
        "English": "Save Changes", "Hindi": "परिवर्तन सहेजें", "Kannada": "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ", "Tamil": "மாற்றங்களைச் சேமி", "Telugu": "మార్పులను సేవ్ చేయి", "Marathi": "बदल जतन करा", "Bengali": "পরিবর্তনগুলি সংরক্ষণ করুন", "Gujarati": "ફેરફારો સાચવો", "Punjabi": "ਤਬਦੀਲੀਆਂ ਸੰਭਾਲੋ", "Malayalam": "മാറ്റങ്ങൾ സേവ് ചെയ്യുക", "Odia": "ପରିବର୍ତ୍ତନ ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    // === Wave 2: Teacher Training (description only — title already in dict) ===
    "There was an error getting advice. Please try again.": {
        "English": "There was an error getting advice. Please try again.", "Hindi": "सलाह प्राप्त करने में त्रुटि हुई। कृपया पुनः प्रयास करें।", "Kannada": "ಸಲಹೆ ಪಡೆಯುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ஆலோசனை பெறுவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "సలహా పొందడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "सल्ला मिळवण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "পরামর্শ পেতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "સલાહ મેળવવામાં ભૂલ થઈ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਸਲਾਹ ਪ੍ਰਾਪਤ ਕਰਨ ਵਿੱਚ ਗਲਤੀ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഉപദേശം ലഭിക്കുന്നതിൽ പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ପରାମର୍ଶ ପାଇବାରେ ତ୍ରୁଟି ହୋଇଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Wave 6 (post-deploy fix): Dashboard Home + Quiz Generator + Image Uploader + Admin ===
    "Admin": {
        "English": "Admin", "Hindi": "व्यवस्थापक", "Kannada": "ನಿರ್ವಾಹಕ", "Tamil": "நிர்வாகி", "Telugu": "నిర్వాహకుడు", "Marathi": "प्रशासक", "Bengali": "অ্যাডমিন", "Gujarati": "એડમિન", "Punjabi": "ਪ੍ਰਸ਼ਾਸਕ", "Malayalam": "അഡ്മിൻ", "Odia": "ଆଡମିନ୍"
    },
    "Create a quiz on any topic, with various question types.": {
        "English": "Create a quiz on any topic, with various question types.", "Hindi": "किसी भी विषय पर विभिन्न प्रकार के प्रश्नों के साथ क्विज़ बनाएं।", "Kannada": "ವಿವಿಧ ಪ್ರಶ್ನೆ ಪ್ರಕಾರಗಳೊಂದಿಗೆ ಯಾವುದೇ ವಿಷಯದ ಮೇಲೆ ರಸಪ್ರಶ್ನೆಯನ್ನು ರಚಿಸಿ.", "Tamil": "பல்வேறு கேள்வி வகைகளுடன் எந்தவொரு தலைப்பிலும் வினாடி வினாவை உருவாக்கவும்.", "Telugu": "వివిధ ప్రశ్న రకాలతో ఏదైనా అంశంపై క్విజ్‌ను సృష్టించండి.", "Marathi": "विविध प्रश्न प्रकारांसह कोणत्याही विषयावर क्विझ तयार करा.", "Bengali": "বিভিন্ন প্রশ্নের প্রকার সহ যেকোনো বিষয়ে একটি কুইজ তৈরি করুন।", "Gujarati": "વિવિધ પ્રશ્ન પ્રકારો સાથે કોઈપણ વિષય પર ક્વિઝ બનાવો.", "Punjabi": "ਵੱਖ-ਵੱਖ ਸਵਾਲਾਂ ਦੀਆਂ ਕਿਸਮਾਂ ਨਾਲ ਕਿਸੇ ਵੀ ਵਿਸ਼ੇ 'ਤੇ ਕਵਿਜ਼ ਬਣਾਓ।", "Malayalam": "വിവിധ ചോദ്യ തരങ്ങളോടെ ഏതെങ്കിലും വിഷയത്തിൽ ഒരു ക്വിസ് സൃഷ്ടിക്കുക.", "Odia": "ବିଭିନ୍ନ ପ୍ରଶ୍ନ ପ୍ରକାର ସହିତ ଯେକୌଣସି ବିଷୟରେ ଏକ କୁଇଜ୍ ସୃଷ୍ଟି କରନ୍ତୁ।"
    },
    "Add Context (Optional Image)": {
        "English": "Add Context (Optional Image)", "Hindi": "संदर्भ जोड़ें (वैकल्पिक छवि)", "Kannada": "ಸಂದರ್ಭವನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ ಚಿತ್ರ)", "Tamil": "சூழலைச் சேர்க்கவும் (விருப்ப படம்)", "Telugu": "సందర్భాన్ని జోడించండి (ఐచ్ఛిక చిత్రం)", "Marathi": "संदर्भ जोडा (पर्यायी प्रतिमा)", "Bengali": "প্রসঙ্গ যোগ করুন (ঐচ্ছিক ছবি)", "Gujarati": "સંદર્ભ ઉમેરો (વૈકલ્પિક છબી)", "Punjabi": "ਸੰਦਰਭ ਜੋੜੋ (ਵਿਕਲਪਿਕ ਚਿੱਤਰ)", "Malayalam": "സന്ദർഭം ചേർക്കുക (ഓപ്ഷണൽ ചിത്രം)", "Odia": "ପ୍ରସଙ୍ଗ ଯୋଗ କରନ୍ତୁ (ବିକଳ୍ପ ଚିତ୍ର)"
    },
    "e.g., The life cycle of a butterfly, using the uploaded image.": {
        "English": "e.g., The life cycle of a butterfly, using the uploaded image.", "Hindi": "उदा., अपलोड की गई छवि का उपयोग करते हुए, एक तितली का जीवन चक्र।", "Kannada": "ಉದಾ., ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಚಿತ್ರವನ್ನು ಬಳಸಿ ಚಿಟ್ಟೆಯ ಜೀವನ ಚಕ್ರ.", "Tamil": "எ.கா., பதிவேற்றப்பட்ட படத்தைப் பயன்படுத்தி, ஒரு வண்ணத்துப்பூச்சியின் வாழ்க்கைச் சுழற்சி.", "Telugu": "ఉదా., అప్‌లోడ్ చేసిన చిత్రాన్ని ఉపయోగించి సీతాకోకచిలుక జీవిత చక్రం.", "Marathi": "उदा., अपलोड केलेल्या प्रतिमेचा वापर करून फुलपाखराचे जीवनचक्र.", "Bengali": "যেমন, আপলোড করা ছবি ব্যবহার করে একটি প্রজাপতির জীবনচক্র।", "Gujarati": "દા.ત., અપલોડ કરેલી છબીનો ઉપયોગ કરીને પતંગિયાનું જીવનચક્ર.", "Punjabi": "ਉਦਾ., ਅਪਲੋਡ ਕੀਤੀ ਤਸਵੀਰ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਤਿਤਲੀ ਦਾ ਜੀਵਨ ਚੱਕਰ।", "Malayalam": "ഉദാ., അപ്‌ലോഡ് ചെയ്ത ചിത്രം ഉപയോഗിച്ച് ഒരു ചിത്രശലഭത്തിന്റെ ജീവിത ചക്രം.", "Odia": "ଯଥା., ଅପଲୋଡ୍ ହୋଇଥିବା ଚିତ୍ର ବ୍ୟବହାର କରି, ଏକ ପ୍ରଜାପତିର ଜୀବନ ଚକ୍ର।"
    },
    "Number of Questions": {
        "English": "Number of Questions", "Hindi": "प्रश्नों की संख्या", "Kannada": "ಪ್ರಶ್ನೆಗಳ ಸಂಖ್ಯೆ", "Tamil": "கேள்விகளின் எண்ணிக்கை", "Telugu": "ప్రశ్నల సంఖ్య", "Marathi": "प्रश्नांची संख्या", "Bengali": "প্রশ্নের সংখ্যা", "Gujarati": "પ્રશ્નોની સંખ્યા", "Punjabi": "ਸਵਾਲਾਂ ਦੀ ਗਿਣਤੀ", "Malayalam": "ചോദ്യങ്ങളുടെ എണ്ണം", "Odia": "ପ୍ରଶ୍ନ ସଂଖ୍ୟା"
    },
    "Question Types": {
        "English": "Question Types", "Hindi": "प्रश्न प्रकार", "Kannada": "ಪ್ರಶ್ನೆ ಪ್ರಕಾರಗಳು", "Tamil": "கேள்வி வகைகள்", "Telugu": "ప్రశ్న రకాలు", "Marathi": "प्रश्न प्रकार", "Bengali": "প্রশ্নের প্রকার", "Gujarati": "પ્રશ્ન પ્રકારો", "Punjabi": "ਸਵਾਲ ਕਿਸਮਾਂ", "Malayalam": "ചോദ്യ തരങ്ങൾ", "Odia": "ପ୍ରଶ୍ନ ପ୍ରକାର"
    },
    "Multiple Choice": {
        "English": "Multiple Choice", "Hindi": "बहुविकल्पीय", "Kannada": "ಬಹು ಆಯ್ಕೆ", "Tamil": "பல்தேர்வு", "Telugu": "బహుళ ఎంపిక", "Marathi": "बहुपर्यायी", "Bengali": "বহু নির্বাচনী", "Gujarati": "બહુવિકલ્પ", "Punjabi": "ਬਹੁ-ਚੋਣ", "Malayalam": "മൾട്ടിപ്പിൾ ചോയ്സ്", "Odia": "ବହୁ-ବିକଳ୍ପ"
    },
    "True/False": {
        "English": "True/False", "Hindi": "सही/गलत", "Kannada": "ಸರಿ/ತಪ್ಪು", "Tamil": "சரி/தவறு", "Telugu": "ఒప్పు/తప్పు", "Marathi": "खरे/खोटे", "Bengali": "সত্য/মিথ্যা", "Gujarati": "સાચું/ખોટું", "Punjabi": "ਸਹੀ/ਗਲਤ", "Malayalam": "ശരി/തെറ്റ്", "Odia": "ସତ୍ୟ/ମିଥ୍ୟା"
    },
    "True False": {
        "English": "True False", "Hindi": "सही गलत", "Kannada": "ಸರಿ ತಪ್ಪು", "Tamil": "சரி தவறு", "Telugu": "ఒప్పు తప్పు", "Marathi": "खरे खोटे", "Bengali": "সত্য মিথ্যা", "Gujarati": "સાચું ખોટું", "Punjabi": "ਸਹੀ ਗਲਤ", "Malayalam": "ശരി തെറ്റ്", "Odia": "ସତ୍ୟ ମିଥ୍ୟା"
    },
    "Fill in the Blanks": {
        "English": "Fill in the Blanks", "Hindi": "रिक्त स्थान भरें", "Kannada": "ಖಾಲಿ ಜಾಗ ಭರ್ತಿ ಮಾಡಿ", "Tamil": "வெற்றிடங்களை நிரப்பவும்", "Telugu": "ఖాళీలను పూరించండి", "Marathi": "रिकाम्या जागा भरा", "Bengali": "শূন্যস্থান পূরণ করুন", "Gujarati": "ખાલી જગ્યા ભરો", "Punjabi": "ਖਾਲੀ ਥਾਵਾਂ ਭਰੋ", "Malayalam": "വിടവുകൾ പൂരിപ്പിക്കുക", "Odia": "ଖାଲି ସ୍ଥାନ ପୂରଣ କରନ୍ତୁ"
    },
    "Short Answer": {
        "English": "Short Answer", "Hindi": "संक्षिप्त उत्तर", "Kannada": "ಸಣ್ಣ ಉತ್ತರ", "Tamil": "சிறு பதில்", "Telugu": "చిన్న సమాధానం", "Marathi": "लहान उत्तर", "Bengali": "সংক্ষিপ্ত উত্তর", "Gujarati": "ટૂંકો જવાબ", "Punjabi": "ਛੋਟਾ ਜਵਾਬ", "Malayalam": "ഹ്രസ്വ ഉത്തരം", "Odia": "ସଂକ୍ଷିପ୍ତ ଉତ୍ତର"
    },
    "Bloom's Taxonomy Levels": {
        "English": "Bloom's Taxonomy Levels", "Hindi": "ब्लूम की टैक्सोनॉमी स्तर", "Kannada": "ಬ್ಲೂಮ್‌ನ ವರ್ಗೀಕರಣ ಮಟ್ಟಗಳು", "Tamil": "புளூம் வகைப்பாட்டு நிலைகள்", "Telugu": "బ్లూమ్ వర్గీకరణ స్థాయిలు", "Marathi": "ब्लूमचे वर्गीकरण स्तर", "Bengali": "ব্লুমের শ্রেণীবিন্যাস স্তর", "Gujarati": "બ્લૂમની ટેક્સોનોમી સ્તર", "Punjabi": "ਬਲੂਮ ਦੀ ਟੈਕਸਨੋਮੀ ਪੱਧਰ", "Malayalam": "ബ്ലൂമിന്റെ ടാക്സോണമി ലെവലുകൾ", "Odia": "ବ୍ଲୁମଙ୍କ ଟ୍ୟାକ୍ସୋନୋମି ସ୍ତର"
    },
    "Remember": {
        "English": "Remember", "Hindi": "याद रखें", "Kannada": "ನೆನಪಿಡಿ", "Tamil": "நினைவில் கொள்", "Telugu": "గుర్తుంచుకో", "Marathi": "लक्षात ठेवा", "Bengali": "মনে রাখুন", "Gujarati": "યાદ રાખો", "Punjabi": "ਯਾਦ ਰੱਖੋ", "Malayalam": "ഓർമ്മിക്കുക", "Odia": "ମନେରଖନ୍ତୁ"
    },
    "Understand": {
        "English": "Understand", "Hindi": "समझें", "Kannada": "ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ", "Tamil": "புரிந்துகொள்", "Telugu": "అర్థం చేసుకో", "Marathi": "समजून घ्या", "Bengali": "বুঝুন", "Gujarati": "સમજો", "Punjabi": "ਸਮਝੋ", "Malayalam": "മനസ്സിലാക്കുക", "Odia": "ବୁଝନ୍ତୁ"
    },
    "Apply": {
        "English": "Apply", "Hindi": "लागू करें", "Kannada": "ಅನ್ವಯಿಸಿ", "Tamil": "பயன்படுத்து", "Telugu": "ఉపయోగించు", "Marathi": "लागू करा", "Bengali": "প্রয়োগ করুন", "Gujarati": "લાગુ કરો", "Punjabi": "ਲਾਗੂ ਕਰੋ", "Malayalam": "പ്രയോഗിക്കുക", "Odia": "ପ୍ରୟୋଗ କରନ୍ତୁ"
    },
    "Analyze": {
        "English": "Analyze", "Hindi": "विश्लेषण करें", "Kannada": "ವಿಶ್ಲೇಷಿಸಿ", "Tamil": "பகுப்பாய்வு செய்", "Telugu": "విశ్లేషించు", "Marathi": "विश्लेषण करा", "Bengali": "বিশ্লেষণ করুন", "Gujarati": "વિશ્લેષણ કરો", "Punjabi": "ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ", "Malayalam": "വിശകലനം ചെയ്യുക", "Odia": "ବିଶ୍ଳେଷଣ କରନ୍ତୁ"
    },
    "Bloom-hint-Remember": {
        "English": "Recall facts. Goal: Test basic knowledge. (e.g., Dates, Names)", "Hindi": "तथ्यों को याद करें। लक्ष्य: बुनियादी ज्ञान का परीक्षण। (उदा., तिथियाँ, नाम)", "Kannada": "ಸಂಗತಿಗಳನ್ನು ಸ್ಮರಿಸಿ. ಗುರಿ: ಮೂಲಭೂತ ಜ್ಞಾನವನ್ನು ಪರೀಕ್ಷಿಸಿ. (ಉದಾ., ದಿನಾಂಕಗಳು, ಹೆಸರುಗಳು)", "Tamil": "உண்மைகளை நினைவில் கொள்ளுங்கள். குறிக்கோள்: அடிப்படை அறிவைச் சோதிக்கவும். (எ.கா., தேதிகள், பெயர்கள்)", "Telugu": "వాస్తవాలను గుర్తుచేసుకోండి. లక్ష్యం: ప్రాథమిక జ్ఞానాన్ని పరీక్షించండి. (ఉదా., తేదీలు, పేర్లు)", "Marathi": "तथ्ये आठवा. ध्येय: मूलभूत ज्ञानाची चाचणी. (उदा., तारखा, नावे)", "Bengali": "তথ্য মনে রাখুন। লক্ষ্য: মৌলিক জ্ঞান পরীক্ষা। (যেমন, তারিখ, নাম)", "Gujarati": "તથ્યો યાદ કરો. ધ્યેય: મૂળભૂત જ્ઞાનની કસોટી. (દા.ત., તારીખ, નામ)", "Punjabi": "ਤੱਥਾਂ ਨੂੰ ਯਾਦ ਕਰੋ। ਟੀਚਾ: ਬੁਨਿਆਦੀ ਗਿਆਨ ਦੀ ਜਾਂਚ। (ਉਦਾ., ਤਾਰੀਖਾਂ, ਨਾਮ)", "Malayalam": "വസ്തുതകൾ ഓർമ്മിക്കുക. ലക്ഷ്യം: അടിസ്ഥാന അറിവ് പരിശോധിക്കുക. (ഉദാ., തീയതികൾ, പേരുകൾ)", "Odia": "ତଥ୍ୟଗୁଡ଼ିକ ମନେରଖନ୍ତୁ। ଲକ୍ଷ୍ୟ: ମୌଳିକ ଜ୍ଞାନ ପରୀକ୍ଷା। (ଯଥା., ତାରିଖ, ନାମ)"
    },
    "Bloom-hint-Understand": {
        "English": "Explain concepts. Goal: Check comprehension. (e.g., Explain why...)", "Hindi": "अवधारणाओं को समझाएं। लक्ष्य: समझ की जांच। (उदा., क्यों समझाएं...)", "Kannada": "ಪರಿಕಲ್ಪನೆಗಳನ್ನು ವಿವರಿಸಿ. ಗುರಿ: ತಿಳುವಳಿಕೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.", "Tamil": "கருத்துகளை விளக்குங்கள். குறிக்கோள்: புரிதலைச் சரிபார்க்கவும்.", "Telugu": "భావనలను వివరించండి. లక్ష్యం: అవగాహనను తనిఖీ చేయండి.", "Marathi": "संकल्पना समजावून सांगा. ध्येय: समज तपासा.", "Bengali": "ধারণা ব্যাখ্যা করুন। লক্ষ্য: বোঝাপড়া পরীক্ষা।", "Gujarati": "ખ્યાલો સમજાવો. ધ્યેય: સમજ ચકાસો.", "Punjabi": "ਸੰਕਲਪਾਂ ਨੂੰ ਸਮਝਾਓ। ਟੀਚਾ: ਸਮਝ ਦੀ ਜਾਂਚ ਕਰੋ।", "Malayalam": "ആശയങ്ങൾ വിശദീകരിക്കുക. ലക്ഷ്യം: ഗ്രാഹ്യം പരിശോധിക്കുക.", "Odia": "ଧାରଣାଗୁଡ଼ିକୁ ବ୍ୟାଖ୍ୟା କରନ୍ତୁ। ଲକ୍ଷ୍ୟ: ବୁଝାମଣା ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "Bloom-hint-Apply": {
        "English": "Use info in new ways. Goal: Test problem-solving. (e.g., Use X to solve Y)", "Hindi": "नई स्थितियों में उपयोग। लक्ष्य: समस्या समाधान का परीक्षण।", "Kannada": "ಹೊಸ ರೀತಿಯಲ್ಲಿ ಮಾಹಿತಿಯನ್ನು ಬಳಸಿ. ಗುರಿ: ಸಮಸ್ಯೆ-ಪರಿಹಾರವನ್ನು ಪರೀಕ್ಷಿಸಿ.", "Tamil": "தகவலை புதிய வழிகளில் பயன்படுத்தவும். குறிக்கோள்: சிக்கல்-தீர்வைச் சோதிக்கவும்.", "Telugu": "కొత్త మార్గాల్లో సమాచారాన్ని ఉపయోగించండి. లక్ష్యం: సమస్య-పరిష్కారాన్ని పరీక్షించండి.", "Marathi": "नवीन मार्गांनी माहिती वापरा. ध्येय: समस्या-निराकरण तपासा.", "Bengali": "নতুন উপায়ে তথ্য ব্যবহার করুন। লক্ষ্য: সমস্যা-সমাধান পরীক্ষা।", "Gujarati": "નવી રીતે માહિતી વાપરો. ધ્યેય: સમસ્યા-ઉકેલ કસોટી.", "Punjabi": "ਨਵੇਂ ਤਰੀਕਿਆਂ ਨਾਲ ਜਾਣਕਾਰੀ ਵਰਤੋ।", "Malayalam": "പുതിയ വഴികളിൽ വിവരം ഉപയോഗിക്കുക.", "Odia": "ନୂତନ ଉପାୟରେ ସୂଚନା ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "Bloom-hint-Analyze": {
        "English": "Draw connections. Goal: Test logical thinking. (e.g., Compare X and Y)", "Hindi": "संबंध बनाएं। लक्ष्य: तार्किक सोच का परीक्षण।", "Kannada": "ಸಂಪರ್ಕಗಳನ್ನು ಎಳೆಯಿರಿ. ಗುರಿ: ತಾರ್ಕಿಕ ಚಿಂತನೆಯನ್ನು ಪರೀಕ್ಷಿಸಿ.", "Tamil": "தொடர்புகளை வரையவும். குறிக்கோள்: தர்க்க சிந்தனையைச் சோதிக்கவும்.", "Telugu": "కనెక్షన్లను గీయండి. లక్ష్యం: తార్కిక ఆలోచనను పరీక్షించండి.", "Marathi": "संबंध काढा. ध्येय: तार्किक विचार तपासा.", "Bengali": "সংযোগ তৈরি করুন। লক্ষ্য: যৌক্তিক চিন্তা পরীক্ষা।", "Gujarati": "જોડાણ દોરો. ધ્યેય: તાર્કિક વિચાર કસોટી.", "Punjabi": "ਸੰਬੰਧ ਖਿੱਚੋ।", "Malayalam": "ബന്ധങ്ങൾ വരയ്ക്കുക.", "Odia": "ସଂଯୋଗ ଆଙ୍କନ୍ତୁ।"
    },
    "Bloom-hint-Evaluate": {
        "English": "Justify decisions. Goal: Test critical judgment. (e.g., Critique the idea)", "Hindi": "निर्णय का औचित्य। लक्ष्य: आलोचनात्मक निर्णय का परीक्षण।", "Kannada": "ನಿರ್ಧಾರಗಳನ್ನು ಸಮರ್ಥಿಸಿ.", "Tamil": "முடிவுகளை நியாயப்படுத்தவும்.", "Telugu": "నిర్ణయాలను సమర్థించండి.", "Marathi": "निर्णय न्याय्य ठरवा.", "Bengali": "সিদ্ধান্ত সমর্থন করুন।", "Gujarati": "નિર્ણયોને ન્યાયસંગત બનાવો.", "Punjabi": "ਫੈਸਲਿਆਂ ਦਾ ਜਾਇਜ਼ ਠਹਿਰਾਓ।", "Malayalam": "തീരുമാനങ്ങൾ ന്യായീകരിക്കുക.", "Odia": "ନିଷ୍ପତ୍ତିଗୁଡ଼ିକୁ ଯୁକ୍ତିଯୁକ୍ତ କରନ୍ତୁ।"
    },
    "Bloom-hint-Create": {
        "English": "Produce original work. Goal: Test synthesis. (e.g., Design a new X)", "Hindi": "मौलिक कार्य। लक्ष्य: सृजन कौशल का परीक्षण।", "Kannada": "ಮೂಲ ಕೆಲಸವನ್ನು ತಯಾರಿಸಿ.", "Tamil": "அசல் வேலையை உருவாக்கவும்.", "Telugu": "మౌలిక పనిని ఉత్పత్తి చేయండి.", "Marathi": "मूळ कार्य तयार करा.", "Bengali": "মৌলিক কাজ তৈরি করুন।", "Gujarati": "મૂળ કાર્ય બનાવો.", "Punjabi": "ਮੌਲਿਕ ਕੰਮ ਤਿਆਰ ਕਰੋ।", "Malayalam": "മൗലിക സൃഷ്ടി നടത്തുക.", "Odia": "ମୌଳିକ କାର୍ଯ୍ୟ ତିଆରି କରନ୍ତୁ।"
    },
    "Pedagogical Strategy": {
        "English": "Pedagogical Strategy", "Hindi": "शैक्षणिक रणनीति", "Kannada": "ಶಿಕ್ಷಣ ತಂತ್ರ", "Tamil": "கல்வியியல் உத்தி", "Telugu": "బోధనా వ్యూహం", "Marathi": "अध्यापन धोरण", "Bengali": "শিক্ষাগত কৌশল", "Gujarati": "શિક્ષણ વ્યૂહરચના", "Punjabi": "ਸਿੱਖਿਆ ਰਣਨੀਤੀ", "Malayalam": "പെഡഗോഗിക്കൽ തന്ത്രം", "Odia": "ଶିକ୍ଷାଗତ କୌଶଳ"
    },
    "Generate Quiz": {
        "English": "Generate Quiz", "Hindi": "क्विज़ बनाएं", "Kannada": "ರಸಪ್ರಶ್ನೆ ರಚಿಸಿ", "Tamil": "வினாடி வினா உருவாக்கு", "Telugu": "క్విజ్ సృష్టించండి", "Marathi": "क्विझ तयार करा", "Bengali": "কুইজ তৈরি করুন", "Gujarati": "ક્વિઝ બનાવો", "Punjabi": "ਕਵਿਜ਼ ਬਣਾਓ", "Malayalam": "ക്വിസ് സൃഷ്ടിക്കുക", "Odia": "କୁଇଜ୍ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Generating Quiz...": {
        "English": "Generating Quiz...", "Hindi": "क्विज़ बना रहा है...", "Kannada": "ರಸಪ್ರಶ್ನೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "வினாடி வினா உருவாக்குகிறது...", "Telugu": "క్విజ్ సృష్టిస్తోంది...", "Marathi": "क्विझ तयार होत आहे...", "Bengali": "কুইজ তৈরি হচ্ছে...", "Gujarati": "ક્વિઝ બની રહ્યું છે...", "Punjabi": "ਕਵਿਜ਼ ਬਣ ਰਿਹਾ ਹੈ...", "Malayalam": "ക്വിസ് സൃഷ്ടിക്കുന്നു...", "Odia": "କୁଇଜ୍ ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Preparing your quiz questions...": {
        "English": "Preparing your quiz questions...", "Hindi": "आपके प्रश्न तैयार किए जा रहे हैं...", "Kannada": "ನಿಮ್ಮ ರಸಪ್ರಶ್ನೆ ಪ್ರಶ್ನೆಗಳನ್ನು ತಯಾರಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "உங்கள் வினாடி வினா கேள்விகள் தயாராகின்றன...", "Telugu": "మీ క్విజ్ ప్రశ్నలను సిద్ధం చేస్తోంది...", "Marathi": "तुमचे क्विझ प्रश्न तयार होत आहेत...", "Bengali": "আপনার কুইজ প্রশ্ন প্রস্তুত করা হচ্ছে...", "Gujarati": "તમારા ક્વિઝ પ્રશ્નો તૈયાર થઈ રહ્યા છે...", "Punjabi": "ਤੁਹਾਡੇ ਕਵਿਜ਼ ਸਵਾਲ ਤਿਆਰ ਕੀਤੇ ਜਾ ਰਹੇ ਹਨ...", "Malayalam": "നിങ്ങളുടെ ക്വിസ് ചോദ്യങ്ങൾ തയ്യാറാക്കുന്നു...", "Odia": "ଆପଣଙ୍କ କୁଇଜ୍ ପ୍ରଶ୍ନ ପ୍ରସ୍ତୁତ ହେଉଛି..."
    },
    "Drag & drop here or": {
        "English": "Drag & drop here or", "Hindi": "यहां खींचें और छोड़ें या", "Kannada": "ಇಲ್ಲಿಗೆ ಡ್ರ್ಯಾಗ್ & ಡ್ರಾಪ್ ಮಾಡಿ ಅಥವಾ", "Tamil": "இங்கே இழுத்து விடவும் அல்லது", "Telugu": "ఇక్కడ లాగండి మరియు వదలండి లేదా", "Marathi": "येथे ड्रॅग आणि ड्रॉप करा किंवा", "Bengali": "এখানে টেনে আনুন বা", "Gujarati": "અહીં ડ્રેગ અને ડ્રોપ કરો અથવા", "Punjabi": "ਇੱਥੇ ਡ੍ਰੈਗ ਐਂਡ ਡ੍ਰੌਪ ਕਰੋ ਜਾਂ", "Malayalam": "ഇവിടെ ഡ്രാഗ് & ഡ്രോപ്പ് ചെയ്യുക അല്ലെങ്കിൽ", "Odia": "ଏଠାରେ ଡ୍ରାଗ୍ ଓ ଡ୍ରପ୍ କରନ୍ତୁ କିମ୍ବା"
    },
    "browse": {
        "English": "browse", "Hindi": "ब्राउज़ करें", "Kannada": "ಬ್ರೌಸ್ ಮಾಡಿ", "Tamil": "உலாவவும்", "Telugu": "బ్రౌజ్ చేయండి", "Marathi": "ब्राउझ करा", "Bengali": "ব্রাউজ করুন", "Gujarati": "બ્રાઉઝ કરો", "Punjabi": "ਬ੍ਰਾਊਜ਼ ਕਰੋ", "Malayalam": "ബ്രൗസ് ചെയ്യുക", "Odia": "ବ୍ରାଉଜ୍ କରନ୍ତୁ"
    },
    "Image Preview": {
        "English": "Image Preview", "Hindi": "छवि पूर्वावलोकन", "Kannada": "ಚಿತ್ರ ಮುನ್ನೋಟ", "Tamil": "பட முன்னோட்டம்", "Telugu": "చిత్ర పూర్వావలోకనం", "Marathi": "प्रतिमा पूर्वावलोकन", "Bengali": "ছবির প্রিভিউ", "Gujarati": "છબી પૂર્વાવલોકન", "Punjabi": "ਚਿੱਤਰ ਪੂਰਵਦਰਸ਼ਨ", "Malayalam": "ചിത്ര പ്രിവ്യൂ", "Odia": "ଚିତ୍ର ପୂର୍ବାବଲୋକନ"
    },
    "Change": {
        "English": "Change", "Hindi": "बदलें", "Kannada": "ಬದಲಾಯಿಸಿ", "Tamil": "மாற்று", "Telugu": "మార్చు", "Marathi": "बदला", "Bengali": "পরিবর্তন", "Gujarati": "બદલો", "Punjabi": "ਬਦਲੋ", "Malayalam": "മാറ്റുക", "Odia": "ବଦଳାନ୍ତୁ"
    },
    "Upload Error": {
        "English": "Upload Error", "Hindi": "अपलोड त्रुटि", "Kannada": "ಅಪ್‌ಲೋಡ್ ದೋಷ", "Tamil": "பதிவேற்ற பிழை", "Telugu": "అప్‌లోడ్ లోపం", "Marathi": "अपलोड त्रुटी", "Bengali": "আপলোড ত্রুটি", "Gujarati": "અપલોડ ભૂલ", "Punjabi": "ਅਪਲੋਡ ਗਲਤੀ", "Malayalam": "അപ്ലോഡ് പിശക്", "Odia": "ଅପଲୋଡ୍ ତ୍ରୁଟି"
    },
    "File is too large. Please upload an image under 4MB.": {
        "English": "File is too large. Please upload an image under 4MB.", "Hindi": "फ़ाइल बहुत बड़ी है। कृपया 4MB से कम की छवि अपलोड करें।", "Kannada": "ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ. ದಯವಿಟ್ಟು 4MB ಗಿಂತ ಕಡಿಮೆ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.", "Tamil": "கோப்பு மிகப் பெரியது. 4MB க்கும் குறைவான படத்தைப் பதிவேற்றவும்.", "Telugu": "ఫైల్ చాలా పెద్దది. దయచేసి 4MB కంటే తక్కువ చిత్రాన్ని అప్‌లోడ్ చేయండి.", "Marathi": "फाइल खूप मोठी आहे. कृपया 4MB पेक्षा कमी आकाराची प्रतिमा अपलोड करा.", "Bengali": "ফাইলটি খুব বড়। অনুগ্রহ করে 4MB এর কম ছবি আপলোড করুন।", "Gujarati": "ફાઇલ ખૂબ મોટી છે. કૃપા કરી 4MB કરતા ઓછી છબી અપલોડ કરો.", "Punjabi": "ਫਾਈਲ ਬਹੁਤ ਵੱਡੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ 4MB ਤੋਂ ਘੱਟ ਦੀ ਤਸਵੀਰ ਅਪਲੋਡ ਕਰੋ।", "Malayalam": "ഫയൽ വളരെ വലുതാണ്. ദയവായി 4MB-ൽ താഴെയുള്ള ഒരു ചിത്രം അപ്‌ലോഡ് ചെയ്യുക.", "Odia": "ଫାଇଲ୍ ଅତ୍ୟଧିକ ବଡ। ଦୟାକରି 4MB ରୁ କମ୍ ଚିତ୍ର ଅପଲୋଡ୍ କରନ୍ତୁ।"
    },
    "Invalid file type. Please upload a JPEG, PNG, or WEBP image.": {
        "English": "Invalid file type. Please upload a JPEG, PNG, or WEBP image.", "Hindi": "अमान्य फ़ाइल प्रकार। कृपया एक JPEG, PNG, या WEBP छवि अपलोड करें।", "Kannada": "ಅಮಾನ್ಯ ಫೈಲ್ ಪ್ರಕಾರ. ದಯವಿಟ್ಟು JPEG, PNG ಅಥವಾ WEBP ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.", "Tamil": "தவறான கோப்பு வகை. JPEG, PNG அல்லது WEBP படத்தைப் பதிவேற்றவும்.", "Telugu": "చెల్లని ఫైల్ రకం. దయచేసి JPEG, PNG లేదా WEBP చిత్రాన్ని అప్‌లోడ్ చేయండి.", "Marathi": "अवैध फाइल प्रकार. कृपया JPEG, PNG किंवा WEBP प्रतिमा अपलोड करा.", "Bengali": "অবৈধ ফাইলের প্রকার। অনুগ্রহ করে একটি JPEG, PNG বা WEBP ছবি আপলোড করুন।", "Gujarati": "અમાન્ય ફાઇલ પ્રકાર. કૃપા કરી JPEG, PNG અથવા WEBP છબી અપલોડ કરો.", "Punjabi": "ਅਵੈਧ ਫਾਈਲ ਕਿਸਮ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ JPEG, PNG, ਜਾਂ WEBP ਤਸਵੀਰ ਅਪਲੋਡ ਕਰੋ।", "Malayalam": "അസാധുവായ ഫയൽ തരം. ദയവായി ഒരു JPEG, PNG അല്ലെങ്കിൽ WEBP ചിത്രം അപ്ലോഡ് ചെയ്യുക.", "Odia": "ଅବୈଧ ଫାଇଲ୍ ପ୍ରକାର। ଦୟାକରି ଏକ JPEG, PNG, କିମ୍ବା WEBP ଚିତ୍ର ଅପଲୋଡ୍ କରନ୍ତୁ।"
    },
    "Failed to upload image. Please try again.": {
        "English": "Failed to upload image. Please try again.", "Hindi": "छवि अपलोड करने में विफल। कृपया पुन: प्रयास करें।", "Kannada": "ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "படத்தைப் பதிவேற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "చిత్రాన్ని అప్‌లోడ్ చేయడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "प्रतिमा अपलोड करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "ছবি আপলোড করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "છબી અપલોડ કરવામાં નિષ્ફળ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਤਸਵੀਰ ਅਪਲੋਡ ਕਰਨ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ചിത്രം അപ്ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଚିତ୍ର ଅପଲୋଡ୍ କରିବାରେ ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Tamil-bleed cleanup: Dashboard home action cards + toasts ===
    "Start": {
        "English": "Start", "Hindi": "शुरू करें", "Kannada": "ಪ್ರಾರಂಭಿಸಿ", "Tamil": "தொடங்கு", "Telugu": "ప్రారంభించండి", "Marathi": "सुरू करा", "Bengali": "শুরু করুন", "Gujarati": "શરૂ કરો", "Punjabi": "ਸ਼ੁਰੂ ਕਰੋ", "Malayalam": "ആരംഭിക്കുക", "Odia": "ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Sahayak can make mistakes. Please review generated content.": {
        "English": "Sahayak can make mistakes. Please review generated content.", "Hindi": "Sahayak गलतियाँ कर सकता है। कृपया उत्पन्न सामग्री की समीक्षा करें।", "Kannada": "Sahayak ತಪ್ಪುಗಳನ್ನು ಮಾಡಬಹುದು. ರಚಿಸಿದ ವಿಷಯವನ್ನು ಪರಿಶೀಲಿಸಿ.", "Tamil": "Sahayak தவறுகள் செய்யக்கூடும். உருவாக்கப்பட்ட உள்ளடக்கத்தை மறுபரிசீலனை செய்யவும்.", "Telugu": "Sahayak పొరపాట్లు చేయవచ్చు. దయచేసి ఉత్పన్నం చేయబడిన కంటెంట్‌ను సమీక్షించండి.", "Marathi": "Sahayak चुका करू शकतो. कृपया तयार केलेली सामग्री तपासा.", "Bengali": "Sahayak ভুল করতে পারে। অনুগ্রহ করে তৈরি কনটেন্ট পর্যালোচনা করুন।", "Gujarati": "Sahayak ભૂલો કરી શકે છે. કૃપા કરી જનરેટ થયેલી સામગ્રીની સમીક્ષા કરો.", "Punjabi": "Sahayak ਗਲਤੀਆਂ ਕਰ ਸਕਦਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਤਿਆਰ ਕੀਤੀ ਸਮੱਗਰੀ ਦੀ ਸਮੀਖਿਆ ਕਰੋ।", "Malayalam": "Sahayak തെറ്റുകൾ വരുത്താം. ദയവായി ജനറേറ്റ് ചെയ്ത ഉള്ളടക്കം അവലോകനം ചെയ്യുക.", "Odia": "Sahayak ଭୁଲ କରିପାରେ। ଦୟାକରି ଉତ୍ପନ୍ନ ବିଷୟବସ୍ତୁ ସମୀକ୍ଷା କରନ୍ତୁ।"
    },
    "Generate Lesson Plan": {
        "English": "Generate Lesson Plan", "Hindi": "पाठ योजना बनाएं", "Kannada": "ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ", "Tamil": "பாடம் திட்டத்தை உருவாக்கு", "Telugu": "పాఠ ప్రణాళికను సృష్టించండి", "Marathi": "पाठ योजना तयार करा", "Bengali": "পাঠ পরিকল্পনা তৈরি করুন", "Gujarati": "પાઠ યોજના બનાવો", "Punjabi": "ਪਾਠ ਯੋਜਨਾ ਤਿਆਰ ਕਰੋ", "Malayalam": "പാഠ്യപദ്ധതി സൃഷ്ടിക്കുക", "Odia": "ପାଠ ଯୋଜନା ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Close answer": {
        "English": "Close answer", "Hindi": "उत्तर बंद करें", "Kannada": "ಉತ್ತರ ಮುಚ್ಚಿ", "Tamil": "பதிலை மூடு", "Telugu": "సమాధానం మూసివేయండి", "Marathi": "उत्तर बंद करा", "Bengali": "উত্তর বন্ধ করুন", "Gujarati": "જવાબ બંધ કરો", "Punjabi": "ਜਵਾਬ ਬੰਦ ਕਰੋ", "Malayalam": "ഉത്തരം അടയ്ക്കുക", "Odia": "ଉତ୍ତର ବନ୍ଦ କରନ୍ତୁ"
    },
    "Assess Work": {
        "English": "Assess Work", "Hindi": "कार्य का मूल्यांकन", "Kannada": "ಕೆಲಸವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ", "Tamil": "வேலையை மதிப்பிடு", "Telugu": "పనిని అంచనా వేయండి", "Marathi": "कामाचे मूल्यांकन करा", "Bengali": "কাজের মূল্যায়ন করুন", "Gujarati": "કાર્યનું મૂલ્યાંકન કરો", "Punjabi": "ਕੰਮ ਦਾ ਮੁਲਾਂਕਣ ਕਰੋ", "Malayalam": "ജോലി വിലയിരുത്തുക", "Odia": "କାର୍ଯ୍ୟ ମୂଲ୍ୟାୟନ କରନ୍ତୁ"
    },
    "NCERT-aligned plans.": {
        "English": "NCERT-aligned plans.", "Hindi": "NCERT-संरेखित योजनाएं।", "Kannada": "NCERT-ಜೋಡಿಸಲಾದ ಯೋಜನೆಗಳು.", "Tamil": "NCERT-இணைக்கப்பட்ட திட்டங்கள்.", "Telugu": "NCERT-అమర్చబడిన ప్రణాళికలు.", "Marathi": "NCERT-संरेखित योजना.", "Bengali": "NCERT-সংরেখ পরিকল্পনা।", "Gujarati": "NCERT-સંરેખ યોજનાઓ.", "Punjabi": "NCERT-ਅਲਾਈਨਡ ਯੋਜਨਾਵਾਂ।", "Malayalam": "NCERT-വിന്യസിച്ച പദ്ധതികൾ.", "Odia": "NCERT-ସଂରେଖ ଯୋଜନା।"
    },
    "Instant quizzes & worksheets.": {
        "English": "Instant quizzes & worksheets.", "Hindi": "तत्काल क्विज़ और वर्कशीट।", "Kannada": "ತಕ್ಷಣದ ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ವರ್ಕ್‌ಶೀಟ್‌ಗಳು.", "Tamil": "உடனடி வினாடி வினாக்கள் & பணித்தாள்கள்.", "Telugu": "తక్షణ క్విజ్‌లు & వర్క్‌షీట్‌లు.", "Marathi": "त्वरित क्विझ आणि वर्कशीट.", "Bengali": "তাত্ক্ষণিক কুইজ & ওয়ার্কশীট।", "Gujarati": "તાત્કાલિક ક્વિઝ અને વર્કશીટ.", "Punjabi": "ਤੁਰੰਤ ਕਵਿਜ਼ ਅਤੇ ਵਰਕਸ਼ੀਟ।", "Malayalam": "ഉടനടി ക്വിസുകൾ & വർക്ക്‌ഷീറ്റുകൾ.", "Odia": "ତୁରନ୍ତ କୁଇଜ୍ ଓ ୱର୍କସିଟ୍।"
    },
    "Board-aligned papers.": {
        "English": "Board-aligned papers.", "Hindi": "बोर्ड-संरेखित पत्र।", "Kannada": "ಬೋರ್ಡ್-ಜೋಡಿಸಲಾದ ಪತ್ರಿಕೆಗಳು.", "Tamil": "வாரிய-இணைக்கப்பட்ட தாள்கள்.", "Telugu": "బోర్డు-అమర్చబడిన పేపర్లు.", "Marathi": "बोर्ड-संरेखित पेपर्स.", "Bengali": "বোর্ড-সংরেখ পেপার।", "Gujarati": "બોર્ડ-સંરેખ પેપર.", "Punjabi": "ਬੋਰਡ-ਅਲਾਈਨਡ ਪੇਪਰ।", "Malayalam": "ബോർഡ്-വിന്യസിച്ച പേപ്പറുകൾ.", "Odia": "ବୋର୍ଡ-ସଂରେଖ ପେପର।"
    },
    "Practice worksheets.": {
        "English": "Practice worksheets.", "Hindi": "अभ्यास वर्कशीट।", "Kannada": "ಅಭ್ಯಾಸ ವರ್ಕ್‌ಶೀಟ್‌ಗಳು.", "Tamil": "பயிற்சி பணித்தாள்கள்.", "Telugu": "అభ్యాస వర్క్‌షీట్‌లు.", "Marathi": "सराव वर्कशीट.", "Bengali": "অনুশীলন ওয়ার্কশীট।", "Gujarati": "પ્રેક્ટિસ વર્કશીટ.", "Punjabi": "ਅਭਿਆਸ ਵਰਕਸ਼ੀਟ।", "Malayalam": "പരിശീലന വർക്ക്‌ഷീറ്റുകൾ.", "Odia": "ଅଭ୍ୟାସ ୱର୍କସିଟ୍।"
    },
    "Grade handwritten work from a photo.": {
        "English": "Grade handwritten work from a photo.", "Hindi": "एक तस्वीर से हस्तलिखित कार्य का मूल्यांकन करें।", "Kannada": "ಫೋಟೋದಿಂದ ಕೈಯಿಂದ ಬರೆದ ಕೆಲಸವನ್ನು ಗ್ರೇಡ್ ಮಾಡಿ.", "Tamil": "புகைப்படத்திலிருந்து கையால் எழுதிய வேலையை மதிப்பீடு செய்.", "Telugu": "ఫోటో నుండి చేతితో రాసిన పనిని గ్రేడ్ చేయండి.", "Marathi": "फोटोवरून हाताने लिहिलेल्या कामाचे ग्रेड द्या.", "Bengali": "একটি ছবি থেকে হাতে লেখা কাজ গ্রেড করুন।", "Gujarati": "ફોટોમાંથી હસ્તલિખિત કાર્યનું ગ્રેડ આપો.", "Punjabi": "ਫੋਟੋ ਤੋਂ ਹੱਥ ਨਾਲ ਲਿਖੇ ਕੰਮ ਦਾ ਗ੍ਰੇਡ ਦਿਓ।", "Malayalam": "ഫോട്ടോയിൽ നിന്ന് കൈകൊണ്ടെഴുതിയ ജോലി ഗ്രേഡ് ചെയ്യുക.", "Odia": "ଏକ ଫୋଟୋରୁ ହସ୍ତଲିଖିତ କାର୍ଯ୍ୟ ଗ୍ରେଡ୍ କରନ୍ତୁ।"
    },
    "Diagrams & illustrations.": {
        "English": "Diagrams & illustrations.", "Hindi": "आरेख और चित्र।", "Kannada": "ರೇಖಾಚಿತ್ರಗಳು ಮತ್ತು ಚಿತ್ರಣಗಳು.", "Tamil": "வரைபடங்கள் & விளக்கப்படங்கள்.", "Telugu": "రేఖాచిత్రాలు & దృష్టాంతాలు.", "Marathi": "आकृत्या आणि चित्रे.", "Bengali": "চিত্র এবং দৃষ্টান্ত।", "Gujarati": "ડાયાગ્રામ અને ચિત્રો.", "Punjabi": "ਡਾਇਗ੍ਰਾਮ ਅਤੇ ਚਿੱਤਰ।", "Malayalam": "ഡയഗ്രമുകൾ & ചിത്രീകരണങ്ങൾ.", "Odia": "ଚାର୍ଟ ଏବଂ ଚିତ୍ର।"
    },
    "Stories & visual aids.": {
        "English": "Stories & visual aids.", "Hindi": "कहानियाँ और दृश्य सहायक।", "Kannada": "ಕಥೆಗಳು ಮತ್ತು ದೃಶ್ಯ ಸಹಾಯಕಗಳು.", "Tamil": "கதைகள் & காட்சி உதவிகள்.", "Telugu": "కథలు & దృశ్య సహాయకాలు.", "Marathi": "कथा आणि दृश्य साधने.", "Bengali": "গল্প ও ভিজ্যুয়াল এইডস।", "Gujarati": "વાર્તાઓ અને દૃશ્ય સહાય.", "Punjabi": "ਕਹਾਣੀਆਂ ਅਤੇ ਵਿਜ਼ੂਅਲ ਸਹਾਇਤਾ।", "Malayalam": "കഥകൾ & ദൃശ്യ സഹായികൾ.", "Odia": "କାହାଣୀ ଓ ଭିଜୁଆଲ୍ ସହାୟତା।"
    },
    "Quick answers to questions.": {
        "English": "Quick answers to questions.", "Hindi": "प्रश्नों के त्वरित उत्तर।", "Kannada": "ಪ್ರಶ್ನೆಗಳಿಗೆ ತ್ವರಿತ ಉತ್ತರಗಳು.", "Tamil": "கேள்விகளுக்கான விரைவான பதில்கள்.", "Telugu": "ప్రశ్నలకు త్వరిత సమాధానాలు.", "Marathi": "प्रश्नांची त्वरित उत्तरे.", "Bengali": "প্রশ্নের দ্রুত উত্তর।", "Gujarati": "પ્રશ્નોના ઝડપી જવાબો.", "Punjabi": "ਸਵਾਲਾਂ ਦੇ ਤੁਰੰਤ ਜਵਾਬ।", "Malayalam": "ചോദ്യങ്ങൾക്ക് വേഗത്തിലുള്ള ഉത്തരങ്ങൾ.", "Odia": "ପ୍ରଶ୍ନର ତୁରନ୍ତ ଉତ୍ତର।"
    },
    "Professional development.": {
        "English": "Professional development.", "Hindi": "व्यावसायिक विकास।", "Kannada": "ವೃತ್ತಿಪರ ಅಭಿವೃದ್ಧಿ.", "Tamil": "தொழில்முறை வளர்ச்சி.", "Telugu": "వృత్తిపరమైన అభివృద్ధి.", "Marathi": "व्यावसायिक विकास.", "Bengali": "পেশাগত উন্নয়ন।", "Gujarati": "વ્યાવસાયિક વિકાસ.", "Punjabi": "ਪੇਸ਼ੇਵਰ ਵਿਕਾਸ।", "Malayalam": "പ്രൊഫഷണൽ വികസനം.", "Odia": "ବୃତ୍ତିଗତ ବିକାଶ।"
    },
    "Not sure how to help": {
        "English": "Not sure how to help", "Hindi": "मदद कैसे करें यह स्पष्ट नहीं", "Kannada": "ಹೇಗೆ ಸಹಾಯ ಮಾಡಬೇಕೆಂದು ಖಚಿತವಿಲ್ಲ", "Tamil": "எப்படி உதவுவது என்று தெரியவில்லை", "Telugu": "ఎలా సహాయపడాలో తెలియదు", "Marathi": "मदत कशी करावी ते स्पष्ट नाही", "Bengali": "কীভাবে সাহায্য করব নিশ্চিত নই", "Gujarati": "કેવી રીતે મદદ કરવી તે ખાતરી નથી", "Punjabi": "ਮਦਦ ਕਿਵੇਂ ਕਰਨੀ ਹੈ ਯਕੀਨੀ ਨਹੀਂ", "Malayalam": "എങ്ങനെ സഹായിക്കണമെന്ന് ഉറപ്പില്ല", "Odia": "କିପରି ସାହାଯ୍ୟ କରିବି ନିଶ୍ଚିତ ନୁହେଁ"
    },
    "Please try asking to create a lesson plan, quiz, or visual aid.": {
        "English": "Please try asking to create a lesson plan, quiz, or visual aid.", "Hindi": "कृपया एक पाठ योजना, क्विज़, या दृश्य सहायक बनाने का प्रयास करें।", "Kannada": "ದಯವಿಟ್ಟು ಪಾಠ ಯೋಜನೆ, ರಸಪ್ರಶ್ನೆ, ಅಥವಾ ದೃಶ್ಯ ಸಹಾಯಕವನ್ನು ರಚಿಸಲು ಕೇಳಲು ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ஒரு பாடம் திட்டம், வினாடி வினா, அல்லது காட்சி உதவி உருவாக்கக் கேட்க முயற்சிக்கவும்.", "Telugu": "దయచేసి పాఠ ప్రణాళిక, క్విజ్, లేదా దృశ్య సహాయకాన్ని సృష్టించమని అడగడానికి ప్రయత్నించండి.", "Marathi": "कृपया पाठ योजना, क्विझ, किंवा दृश्य सहाय्य तयार करण्यास सांगण्याचा प्रयत्न करा.", "Bengali": "একটি পাঠ পরিকল্পনা, কুইজ বা ভিজ্যুয়াল এইড তৈরি করতে বলার চেষ্টা করুন।", "Gujarati": "કૃપા કરી પાઠ યોજના, ક્વિઝ અથવા વિઝ્યુઅલ સહાય બનાવવાનું પૂછવાનો પ્રયાસ કરો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਪਾਠ ਯੋਜਨਾ, ਕਵਿਜ਼, ਜਾਂ ਵਿਜ਼ੂਅਲ ਸਹਾਇਤਾ ਬਣਾਉਣ ਲਈ ਕਹਿਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ദയവായി ഒരു പാഠ്യപദ്ധതി, ക്വിസ്, അല്ലെങ്കിൽ ദൃശ്യ സഹായം സൃഷ്ടിക്കാൻ ആവശ്യപ്പെടാൻ ശ്രമിക്കുക.", "Odia": "ଦୟାକରି ଏକ ପାଠ ଯୋଜନା, କୁଇଜ୍, କିମ୍ବା ଭିଜୁଆଲ୍ ସହାୟତା ସୃଷ୍ଟି କରିବାକୁ ପଚାରିବାକୁ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Connection Error": {
        "English": "Connection Error", "Hindi": "कनेक्शन त्रुटि", "Kannada": "ಸಂಪರ್ಕ ದೋಷ", "Tamil": "இணைப்பு பிழை", "Telugu": "కనెక్షన్ లోపం", "Marathi": "कनेक्शन त्रुटी", "Bengali": "সংযোগ ত্রুটি", "Gujarati": "કનેક્શન ભૂલ", "Punjabi": "ਕੁਨੈਕਸ਼ਨ ਗਲਤੀ", "Malayalam": "കണക്ഷൻ പിശക്", "Odia": "ସଂଯୋଗ ତ୍ରୁଟି"
    },
    "Could not reach Sahayak. Please try again.": {
        "English": "Could not reach Sahayak. Please try again.", "Hindi": "Sahayak तक नहीं पहुंच सका। कृपया पुनः प्रयास करें।", "Kannada": "Sahayak ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "Sahayak-ஐ அடைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "Sahayak ను చేరుకోలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "Sahayak पर्यंत पोहोचू शकलो नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "Sahayak এ পৌঁছাতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "Sahayak સુધી પહોંચી શકાયું નથી. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "Sahayak ਤੱਕ ਨਹੀਂ ਪਹੁੰਚ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "Sahayak-നെ എത്തിച്ചേരാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "Sahayak ପର୍ଯ୍ୟନ୍ତ ପହଞ୍ଚିପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Wave 6: Grade Level Selector (harvested from local object, now 11 langs) ===
    "Class 1": {
        "English": "Class 1", "Hindi": "पहली कक्षा", "Kannada": "ಒಂದನೇ ತರಗತಿ", "Tamil": "முதலாம் வகுப்பு", "Telugu": "ఒకటవ తరగతి", "Marathi": "इयत्ता पहिली", "Bengali": "প্রথম শ্রেণী", "Gujarati": "પ્રથમ ધોરણ", "Punjabi": "ਪਹਿਲੀ ਜਮਾਤ", "Malayalam": "ഒന്നാം ക്ലാസ്", "Odia": "ପ୍ରଥମ ଶ୍ରେଣୀ"
    },
    "Class 2": {
        "English": "Class 2", "Hindi": "दूसरी कक्षा", "Kannada": "ಎರಡನೇ ತರಗತಿ", "Tamil": "இரண்டாம் வகுப்பு", "Telugu": "రెండవ తరగతి", "Marathi": "इयत्ता दुसरी", "Bengali": "দ্বিতীয় শ্রেণী", "Gujarati": "બીજું ધોરણ", "Punjabi": "ਦੂਜੀ ਜਮਾਤ", "Malayalam": "രണ്ടാം ക്ലാസ്", "Odia": "ଦ୍ୱିତୀୟ ଶ୍ରେଣୀ"
    },
    "Class 3": {
        "English": "Class 3", "Hindi": "तीसरी कक्षा", "Kannada": "ಮೂರನೇ ತರಗತಿ", "Tamil": "மூன்றாம் வகுப்பு", "Telugu": "మూడవ తరగతి", "Marathi": "इयत्ता तिसरी", "Bengali": "তৃতীয় শ্রেণী", "Gujarati": "ત્રીજું ધોરણ", "Punjabi": "ਤੀਜੀ ਜਮਾਤ", "Malayalam": "മൂന്നാം ക്ലാസ്", "Odia": "ତୃତୀୟ ଶ୍ରେଣୀ"
    },
    "Class 4": {
        "English": "Class 4", "Hindi": "चौथी कक्षा", "Kannada": "ನಾಲ್ಕನೇ ತರಗತಿ", "Tamil": "நான்காம் வகுப்பு", "Telugu": "నాల్గవ తరగతి", "Marathi": "इयत्ता चौथी", "Bengali": "চতুর্থ শ্রেণী", "Gujarati": "ચોથું ધોરણ", "Punjabi": "ਚੌਥੀ ਜਮਾਤ", "Malayalam": "നാലാം ക്ലാസ്", "Odia": "ଚତୁର୍ଥ ଶ୍ରେଣୀ"
    },
    "Class 5": {
        "English": "Class 5", "Hindi": "पांचवीं कक्षा", "Kannada": "ಐದನೇ ತರಗತಿ", "Tamil": "ஐந்தாம் வகுப்பு", "Telugu": "ఐదవ తరగతి", "Marathi": "इयत्ता पाचवी", "Bengali": "পঞ্চম শ্রেণী", "Gujarati": "પાંચમું ધોરણ", "Punjabi": "ਪੰਜਵੀਂ ਜਮਾਤ", "Malayalam": "അഞ്ചാം ക്ലാസ്", "Odia": "ପଞ୍ଚମ ଶ୍ରେଣୀ"
    },
    "Class 6": {
        "English": "Class 6", "Hindi": "छठी कक्षा", "Kannada": "ಆರನೇ ತರಗತಿ", "Tamil": "ஆறாம் வகுப்பு", "Telugu": "ఆరవ తరగతి", "Marathi": "इयत्ता सहावी", "Bengali": "ষষ্ঠ শ্রেণী", "Gujarati": "છઠ્ઠું ધોરણ", "Punjabi": "ਛੇਵੀਂ ਜਮਾਤ", "Malayalam": "ആറാം ക്ലാസ്", "Odia": "ଷଷ୍ଠ ଶ୍ରେଣୀ"
    },
    "Class 7": {
        "English": "Class 7", "Hindi": "सातवीं कक्षा", "Kannada": "ಏಳನೇ ತರಗತಿ", "Tamil": "ஏழாம் வகுப்பு", "Telugu": "ఏడవ తరగతి", "Marathi": "इयत्ता सातवी", "Bengali": "সপ্তম শ্রেণী", "Gujarati": "સાતમું ધોરણ", "Punjabi": "ਸੱਤਵੀਂ ਜਮਾਤ", "Malayalam": "ഏഴാം ക്ലാസ്", "Odia": "ସପ୍ତମ ଶ୍ରେଣୀ"
    },
    "Class 8": {
        "English": "Class 8", "Hindi": "आठवीं कक्षा", "Kannada": "ಎಂಟನೇ ತರಗತಿ", "Tamil": "எட்டாம் வகுப்பு", "Telugu": "ఎనిమిదవ తరగతి", "Marathi": "इयत्ता आठवी", "Bengali": "অষ্টম শ্রেণী", "Gujarati": "આઠમું ધોરણ", "Punjabi": "ਅੱਠਵੀਂ ਜਮਾਤ", "Malayalam": "എട്ടാം ക്ലാസ്", "Odia": "ଅଷ୍ଟମ ଶ୍ରେଣୀ"
    },
    "Class 9": {
        "English": "Class 9", "Hindi": "नौवीं कक्षा", "Kannada": "ಒಂಬತ್ತನೇ ತರಗತಿ", "Tamil": "ஒன்பதாம் வகுப்பு", "Telugu": "తొమ్మిదవ తరగతి", "Marathi": "इयत्ता नववी", "Bengali": "নবম শ্রেণী", "Gujarati": "નવમું ધોરણ", "Punjabi": "ਨੌਵੀਂ ਜਮਾਤ", "Malayalam": "ഒൻപതാം ക്ലാസ്", "Odia": "ନବମ ଶ୍ରେଣୀ"
    },
    "Class 10": {
        "English": "Class 10", "Hindi": "दसवीं कक्षा", "Kannada": "ಹತ್ತನೇ ತರಗತಿ", "Tamil": "பத்தாம் வகுப்பு", "Telugu": "పదవ తరగతి", "Marathi": "इयत्ता दहावी", "Bengali": "দশম শ্রেণী", "Gujarati": "દસમું ધોરણ", "Punjabi": "ਦਸਵੀਂ ਜਮਾਤ", "Malayalam": "പത്താം ക്ലാസ്", "Odia": "ଦଶମ ଶ୍ରେଣୀ"
    },
    "Class 11": {
        "English": "Class 11", "Hindi": "ग्यारहवीं कक्षा", "Kannada": "ಹನ್ನೊಂದನೇ ತರಗತಿ", "Tamil": "பதினொன்றாம் வகுப்பு", "Telugu": "పదకొండవ తరగతి", "Marathi": "इयत्ता अकरावी", "Bengali": "একাদশ শ্রেণী", "Gujarati": "અગિયારમું ધોરણ", "Punjabi": "ਗਿਆਰਵੀਂ ਜਮਾਤ", "Malayalam": "പതിനൊന്നാം ക്ലാസ്", "Odia": "ଏକାଦଶ ଶ୍ରେଣୀ"
    },
    "Class 12": {
        "English": "Class 12", "Hindi": "बारहवीं कक्षा", "Kannada": "ಹನ್ನೆರಡನೇ ತರಗತಿ", "Tamil": "பன்னிரண்டாம் வகுப்பு", "Telugu": "పన్నెండవ తరగతి", "Marathi": "इयत्ता बारावी", "Bengali": "দ্বাদশ শ্রেণী", "Gujarati": "બારમું ધોરણ", "Punjabi": "ਬਾਰ੍ਹਵੀਂ ਜਮਾਤ", "Malayalam": "പന്ത്രണ്ടാം ക്ലാസ്", "Odia": "ଦ୍ୱାଦଶ ଶ୍ରେଣୀ"
    },
    "Select a class": {
        "English": "Select a class", "Hindi": "एक कक्षा चुनें", "Kannada": "ಒಂದು ತರಗತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "ஒரு வகுப்பைத் தேர்ந்தெடுக்கவும்", "Telugu": "ఒక తరగతిని ఎంచుకోండి", "Marathi": "एक वर्ग निवडा", "Bengali": "একটি শ্রেণী নির্বাচন করুন", "Gujarati": "એક વર્ગ પસંદ કરો", "Punjabi": "ਇੱਕ ਜਮਾਤ ਚੁਣੋ", "Malayalam": "ഒരു ക്ലാസ് തിരഞ്ഞെടുക്കുക", "Odia": "ଏକ ଶ୍ରେଣୀ ବାଛନ୍ତୁ"
    },
    "Select Class(es)": {
        "English": "Select Class(es)", "Hindi": "कक्षा(एं) चुनें", "Kannada": "ತರಗತಿ(ಗಳನ್ನು) ಆಯ್ಕೆಮಾಡಿ", "Tamil": "வகுப்பு(களை)த் தேர்ந்தெடுக்கவும்", "Telugu": "తరగతి(లను) ఎంచుకోండి", "Marathi": "वर्ग निवडा", "Bengali": "শ্রেণী(গুলি) নির্বাচন করুন", "Gujarati": "વર્ગ(ઓ) પસંદ કરો", "Punjabi": "ਜਮਾਤ(ਾਂ) ਚੁਣੋ", "Malayalam": "ക്ലാസ്(കൾ) തിരഞ്ഞെടുക്കുക", "Odia": "ଶ୍ରେଣୀ(ଗୁଡ଼ିକ) ବାଛନ୍ତୁ"
    },
    "class selected": {
        "English": "class selected", "Hindi": "कक्षा चुनी गई", "Kannada": "ತರಗತಿ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", "Tamil": "வகுப்பு தேர்ந்தெடுக்கப்பட்டது", "Telugu": "తరగతి ఎంచుకోబడింది", "Marathi": "वर्ग निवडला", "Bengali": "শ্রেণী নির্বাচিত", "Gujarati": "વર્ગ પસંદ કરેલ", "Punjabi": "ਜਮਾਤ ਚੁਣੀ", "Malayalam": "ക്ലാസ് തിരഞ്ഞെടുത്തു", "Odia": "ଶ୍ରେଣୀ ବଛାଯାଇଛି"
    },
    "classes selected": {
        "English": "classes selected", "Hindi": "कक्षाएं चुनी गईं", "Kannada": "ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", "Tamil": "வகுப்புகள் தேர்ந்தெடுக்கப்பட்டன", "Telugu": "తరగతులు ఎంచుకోబడ్డాయి", "Marathi": "वर्ग निवडले", "Bengali": "শ্রেণীগুলি নির্বাচিত", "Gujarati": "વર્ગો પસંદ કરેલ", "Punjabi": "ਜਮਾਤਾਂ ਚੁਣੀਆਂ", "Malayalam": "ക്ലാസുകൾ തിരഞ്ഞെടുത്തു", "Odia": "ଶ୍ରେଣୀଗୁଡ଼ିକ ବଛାଯାଇଛି"
    },
    "Select Class Levels": {
        "English": "Select Class Levels", "Hindi": "कक्षा स्तर चुनें", "Kannada": "ತರಗತಿ ಮಟ್ಟಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "வகுப்பு நிலைகளைத் தேர்ந்தெடுக்கவும்", "Telugu": "తరగతి స్థాయిలను ఎంచుకోండి", "Marathi": "वर्ग स्तर निवडा", "Bengali": "শ্রেণী স্তর নির্বাচন করুন", "Gujarati": "વર્ગ સ્તર પસંદ કરો", "Punjabi": "ਜਮਾਤ ਪੱਧਰ ਚੁਣੋ", "Malayalam": "ക്ലാസ് ലെവലുകൾ തിരഞ്ഞെടുക്കുക", "Odia": "ଶ୍ରେଣୀ ସ୍ତର ବାଛନ୍ତୁ"
    },
    // === Wave 6: Subject names (harvested from subject-selector.tsx local object) ===
    "Mathematics": {
        "English": "Mathematics", "Hindi": "गणित", "Kannada": "ಗಣಿತ", "Tamil": "கணிதம்", "Telugu": "గణితం", "Marathi": "गणित", "Bengali": "গণিত", "Gujarati": "ગણિત", "Punjabi": "ਗਣਿਤ", "Malayalam": "ഗണിതം", "Odia": "ଗଣିତ"
    },
    "Science": {
        "English": "Science", "Hindi": "विज्ञान", "Kannada": "ವಿಜ್ಞಾನ", "Tamil": "அறிவியல்", "Telugu": "విజ్ఞానం", "Marathi": "विज्ञान", "Bengali": "বিজ্ঞান", "Gujarati": "વિજ્ઞાન", "Punjabi": "ਵਿਗਿਆਨ", "Malayalam": "ശാസ്ത്രം", "Odia": "ବିଜ୍ଞାନ"
    },
    "Social Science": {
        "English": "Social Science", "Hindi": "सामाजिक विज्ञान", "Kannada": "ಸಮಾಜ ವಿಜ್ಞಾನ", "Tamil": "சமூக அறிவியல்", "Telugu": "సాంఘిక శాస్త్రం", "Marathi": "सामाजिक विज्ञान", "Bengali": "সামাজিক বিজ্ঞান", "Gujarati": "સામાજિક વિજ્ઞાન", "Punjabi": "ਸਮਾਜਿਕ ਵਿਗਿਆਨ", "Malayalam": "സാമൂഹിക ശാസ്ത്രം", "Odia": "ସାମାଜିକ ବିଜ୍ଞାନ"
    },
    "History": {
        "English": "History", "Hindi": "इतिहास", "Kannada": "ಇತಿಹಾಸ", "Tamil": "வரலாறு", "Telugu": "చరిత్ర", "Marathi": "इतिहास", "Bengali": "ইতিহাস", "Gujarati": "ઇતિહાસ", "Punjabi": "ਇਤਿਹਾਸ", "Malayalam": "ചരിത്രം", "Odia": "ଇତିହାସ"
    },
    "Geography": {
        "English": "Geography", "Hindi": "भूगोल", "Kannada": "ಭೂಗೋಳ", "Tamil": "புவியியல்", "Telugu": "భూగోళశాస్త్రం", "Marathi": "भूगोल", "Bengali": "ভূগোল", "Gujarati": "ભૂગોળ", "Punjabi": "ਭੂਗੋਲ", "Malayalam": "ഭൂമിശാസ്ത്രം", "Odia": "ଭୂଗୋଳ"
    },
    "Civics": {
        "English": "Civics", "Hindi": "नागरिक शास्त्र", "Kannada": "ನಾಗರಿಕ ಶಾಸ್ತ್ರ", "Tamil": "குடிமையியல்", "Telugu": "పౌరశాస్త్రం", "Marathi": "नागरिक शास्त्र", "Bengali": "নাগরিক বিজ্ঞান", "Gujarati": "નાગરિક શાસ્ત્ર", "Punjabi": "ਨਾਗਰਿਕ ਸ਼ਾਸਤਰ", "Malayalam": "പൗരധർമ്മം", "Odia": "ନାଗରିକ ଶାସ୍ତ୍ର"
    },
    "Hindi": {
        "English": "Hindi", "Hindi": "हिंदी", "Kannada": "ಹಿಂದಿ", "Tamil": "ஹிந்தி", "Telugu": "హిందీ", "Marathi": "हिंदी", "Bengali": "হিন্দি", "Gujarati": "હિન્દી", "Punjabi": "ਹਿੰਦੀ", "Malayalam": "ഹിന്ദി", "Odia": "ହିନ୍ଦୀ"
    },
    "Sanskrit": {
        "English": "Sanskrit", "Hindi": "संस्कृत", "Kannada": "ಸಂಸ್ಕೃತ", "Tamil": "சமஸ்கிருதம்", "Telugu": "సంస్కృతం", "Marathi": "संस्कृत", "Bengali": "সংস্কৃত", "Gujarati": "સંસ્કૃત", "Punjabi": "ਸੰਸਕ੍ਰਿਤ", "Malayalam": "സംസ്കൃതം", "Odia": "ସଂସ୍କୃତ"
    },
    "Kannada": {
        "English": "Kannada", "Hindi": "कन्नड़", "Kannada": "ಕನ್ನಡ", "Tamil": "கன்னடம்", "Telugu": "కన్నడ", "Marathi": "कन्नड", "Bengali": "কন্নড়", "Gujarati": "કન્નડ", "Punjabi": "ਕੰਨੜ", "Malayalam": "കന്നഡ", "Odia": "କନ୍ନଡ"
    },
    "Computer Science": {
        "English": "Computer Science", "Hindi": "कंप्यूटर विज्ञान", "Kannada": "ಗಣಕವಿಜ್ಞಾನ", "Tamil": "கணினி அறிவியல்", "Telugu": "కంప్యూటర్ సైన్స్", "Marathi": "संगणक विज्ञान", "Bengali": "কম্পিউটার বিজ্ঞান", "Gujarati": "કમ્પ્યુટર વિજ્ઞાન", "Punjabi": "ਕੰਪਿਊਟਰ ਵਿਗਿਆਨ", "Malayalam": "കമ്പ്യൂട്ടർ സയൻസ്", "Odia": "କମ୍ପ୍ୟୁଟର ବିଜ୍ଞାନ"
    },
    "Environmental Studies (EVS)": {
        "English": "Environmental Studies (EVS)", "Hindi": "पर्यावरण अध्ययन (EVS)", "Kannada": "ಪರಿಸರ ಅಧ್ಯಯನ (EVS)", "Tamil": "சுற்றுச்சூழல் ஆய்வுகள் (EVS)", "Telugu": "పర్యావరణ అధ్యయనాలు (EVS)", "Marathi": "पर्यावरण अभ्यास (EVS)", "Bengali": "পরিবেশ অধ্যয়ন (EVS)", "Gujarati": "પર્યાવરણ અભ્યાસ (EVS)", "Punjabi": "ਵਾਤਾਵਰਨ ਅਧਿਐਨ (EVS)", "Malayalam": "പരിസ്ഥിതി പഠനങ്ങൾ (EVS)", "Odia": "ପରିବେଶ ଅଧ୍ୟୟନ (EVS)"
    },
    "General": {
        "English": "General", "Hindi": "सामान्य", "Kannada": "ಸಾಮಾನ್ಯ", "Tamil": "பொதுவான", "Telugu": "సాధారణ", "Marathi": "सामान्य", "Bengali": "সাধারণ", "Gujarati": "સામાન્ય", "Punjabi": "ਆਮ", "Malayalam": "പൊതുവായ", "Odia": "ସାଧାରଣ"
    },
    "Select a subject": {
        "English": "Select a subject", "Hindi": "विषय चुनें", "Kannada": "ವಿಷಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்", "Telugu": "ఒక విషయాన్ని ఎంచుకోండి", "Marathi": "विषय निवडा", "Bengali": "একটি বিষয় নির্বাচন করুন", "Gujarati": "વિષય પસંદ કરો", "Punjabi": "ਇੱਕ ਵਿਸ਼ਾ ਚੁਣੋ", "Malayalam": "ഒരു വിഷയം തിരഞ്ഞെടുക്കുക", "Odia": "ଏକ ବିଷୟ ବାଛନ୍ତୁ"
    },
    // === Wave 6: Rubric Generator (local translations harvested) ===
    "Create clear and fair grading rubrics for any assignment.": {
        "English": "Create clear and fair grading rubrics for any assignment.", "Hindi": "किसी भी असाइनमेंट के लिए स्पष्ट और निष्पक्ष ग्रेडिंग रूब्रिक बनाएं।", "Kannada": "ಯಾವುದೇ ನಿಯೋಜನೆಗಾಗಿ ಸ್ಪಷ್ಟ ಮತ್ತು ನ್ಯಾಯಯುತ ಗ್ರೇಡಿಂಗ್ ರೂಬ್ರಿಕ್‌ಗಳನ್ನು ರಚಿಸಿ.", "Tamil": "எந்தவொரு வேலைக்கும் தெளிவான மற்றும் நியாயமான மதிப்பீட்டு ரூப்ரிக்குகளை உருவாக்கவும்.", "Telugu": "ఏదైనా అసైన్‌మెంట్ కోసం స్పష్టమైన మరియు న్యాయమైన గ్రేడింగ్ రుబ్రిక్‌లను సృష్టించండి.", "Marathi": "कोणत्याही असाइनमेंटसाठी स्पष्ट आणि निष्पक्ष ग्रेडिंग रुब्रिक तयार करा.", "Bengali": "যেকোনো অ্যাসাইনমেন্টের জন্য স্পষ্ট এবং ন্যায্য গ্রেডিং রুব্রিক তৈরি করুন।", "Gujarati": "કોઈપણ અસાઇનમેન્ટ માટે સ્પષ્ટ અને નિષ્પક્ષ ગ્રેડિંગ રુબ્રિક બનાવો.", "Punjabi": "ਕਿਸੇ ਵੀ ਅਸਾਈਨਮੈਂਟ ਲਈ ਸਪਸ਼ਟ ਅਤੇ ਨਿਰਪੱਖ ਗ੍ਰੇਡਿੰਗ ਰੁਬ੍ਰਿਕ ਬਣਾਓ।", "Malayalam": "ഏതെങ്കിലും അസൈൻമെന്റിനായി വ്യക്തവും നീതിയുക്തവുമായ ഗ്രേഡിംഗ് റൂബ്രിക്കുകൾ സൃഷ്ടിക്കുക.", "Odia": "ଯେକୌଣସି ଆସାଇନମେଣ୍ଟ ପାଇଁ ସ୍ପଷ୍ଟ ଏବଂ ନ୍ୟାୟସଙ୍ଗତ ଗ୍ରେଡିଂ ରୁବ୍ରିକ୍ ସୃଷ୍ଟି କରନ୍ତୁ।"
    },
    "What is a Rubric?": {
        "English": "What is a Rubric?", "Hindi": "रूब्रिक क्या है?", "Kannada": "ರೂಬ್ರಿಕ್ ಎಂದರೇನು?", "Tamil": "ரூப்ரிக் என்றால் என்ன?", "Telugu": "రుబ్రిక్ అంటే ఏమిటి?", "Marathi": "रुब्रिक म्हणजे काय?", "Bengali": "রুব্রিক কী?", "Gujarati": "રુબ્રિક શું છે?", "Punjabi": "ਰੁਬ੍ਰਿਕ ਕੀ ਹੈ?", "Malayalam": "എന്താണ് റൂബ്രിക്?", "Odia": "ରୁବ୍ରିକ୍ କଣ?"
    },
    "A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.": {
        "English": "A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.", "Hindi": "रूब्रिक एक स्कोरिंग उपकरण है जो किसी असाइनमेंट या काम के लिए प्रदर्शन अपेक्षाओं का स्पष्ट रूप से प्रतिनिधित्व करता है।", "Kannada": "ರೂಬ್ರಿಕ್ ಎನ್ನುವುದು ಯಾವುದೇ ನಿಯೋಜನೆ ಅಥವಾ ಕೆಲಸಕ್ಕೆ ಪ್ರದರ್ಶನ ನಿರೀಕ್ಷೆಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಪ್ರತಿನಿಧಿಸುವ ಸ್ಕೋರಿಂಗ್ ಸಾಧನವಾಗಿದೆ.", "Tamil": "ரூப்ரிக் என்பது ஒரு வேலை அல்லது பணிக்கான செயல்திறன் எதிர்பார்ப்புகளை வெளிப்படையாக பிரதிநிதித்துவப்படுத்தும் ஒரு மதிப்பீட்டுக் கருவியாகும்.", "Telugu": "రుబ్రిక్ అనేది ఒక అసైన్‌మెంట్ లేదా పని కోసం పనితీరు అంచనాలను స్పష్టంగా సూచించే స్కోరింగ్ సాధనం.", "Marathi": "रुब्रिक हे एक स्कोअरिंग साधन आहे जे असाइनमेंट किंवा कामासाठी कामगिरीच्या अपेक्षांचे स्पष्टपणे प्रतिनिधित्व करते.", "Bengali": "রুব্রিক একটি স্কোরিং টুল যা একটি অ্যাসাইনমেন্ট বা কাজের জন্য পারফরম্যান্স প্রত্যাশাগুলি স্পষ্টভাবে প্রতিনিধিত্ব করে।", "Gujarati": "રુબ્રિક એ સ્કોરિંગ ટૂલ છે જે અસાઇનમેન્ટ અથવા કાર્ય માટેની કામગીરી અપેક્ષાઓને સ્પષ્ટ રીતે રજૂ કરે છે.", "Punjabi": "ਰੁਬ੍ਰਿਕ ਇੱਕ ਸਕੋਰਿੰਗ ਟੂਲ ਹੈ ਜੋ ਅਸਾਈਨਮੈਂਟ ਜਾਂ ਕੰਮ ਲਈ ਪ੍ਰਦਰਸ਼ਨ ਉਮੀਦਾਂ ਨੂੰ ਸਪਸ਼ਟ ਤੌਰ 'ਤੇ ਦਰਸਾਉਂਦਾ ਹੈ।", "Malayalam": "ഒരു അസൈൻമെന്റ് അല്ലെങ്കിൽ ജോലിക്കായുള്ള പ്രകടന പ്രതീക്ഷകളെ വ്യക്തമായി പ്രതിനിധീകരിക്കുന്ന സ്കോറിംഗ് ഉപകരണമാണ് റൂബ്രിക്.", "Odia": "ରୁବ୍ରିକ୍ ହେଉଛି ଏକ ସ୍କୋରିଂ ସାଧନ ଯାହା ଏକ ଆସାଇନମେଣ୍ଟ କିମ୍ବା କାର୍ଯ୍ୟ ପାଇଁ କାର୍ଯ୍ୟଦକ୍ଷତା ଆଶା ସ୍ପଷ୍ଟ ଭାବେ ପ୍ରତିନିଧିତ୍ୱ କରେ।"
    },
    "Why are they important?": {
        "English": "Why are they important?", "Hindi": "वे महत्वपूर्ण क्यों हैं?", "Kannada": "ಅವು ಏಕೆ ಮುಖ್ಯ?", "Tamil": "அவை ஏன் முக்கியம்?", "Telugu": "అవి ఎందుకు ముఖ్యం?", "Marathi": "ते महत्वाचे का आहेत?", "Bengali": "এগুলি কেন গুরুত্বপূর্ণ?", "Gujarati": "તેઓ શા માટે મહત્વપૂર્ણ છે?", "Punjabi": "ਉਹ ਮਹੱਤਵਪੂਰਨ ਕਿਉਂ ਹਨ?", "Malayalam": "അവ എന്തുകൊണ്ട് പ്രധാനമാണ്?", "Odia": "ସେମାନେ କାହିଁକି ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ?"
    },
    "Clarity:": {
        "English": "Clarity:", "Hindi": "स्पष्टता:", "Kannada": "ಸ್ಪಷ್ಟತೆ:", "Tamil": "தெளிவு:", "Telugu": "స్పష్టత:", "Marathi": "स्पष्टता:", "Bengali": "স্পষ্টতা:", "Gujarati": "સ્પષ્ટતા:", "Punjabi": "ਸਪਸ਼ਟਤਾ:", "Malayalam": "വ്യക്തത:", "Odia": "ସ୍ପଷ୍ଟତା:"
    },
    "They demystify assignments by making expectations clear to students before they start.": {
        "English": "They demystify assignments by making expectations clear to students before they start.", "Hindi": "वे छात्रों को शुरू करने से पहले अपेक्षाओं को स्पष्ट करके असाइनमेंट को सरल बनाते हैं।", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳು ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು ನಿರೀಕ್ಷೆಗಳನ್ನು ಸ್ಪಷ್ಟಗೊಳಿಸಿ ನಿಯೋಜನೆಗಳನ್ನು ಸರಳಗೊಳಿಸುತ್ತದೆ.", "Tamil": "மாணவர்கள் தொடங்குவதற்கு முன் எதிர்பார்ப்புகளைத் தெளிவாக்குவதன் மூலம் வேலைகளை எளிதாக்குகின்றனர்.", "Telugu": "విద్యార్థులు ప్రారంభించడానికి ముందు అంచనాలను స్పష్టం చేయడం ద్వారా అసైన్‌మెంట్‌లను సరళీకృతం చేస్తాయి.", "Marathi": "विद्यार्थ्यांना सुरुवात करण्यापूर्वी अपेक्षा स्पष्ट करून ते असाइनमेंट सोपे करतात.", "Bengali": "ছাত্ররা শুরু করার আগে প্রত্যাশাগুলি পরিষ্কার করে অ্যাসাইনমেন্টগুলিকে সরল করে তোলে।", "Gujarati": "વિદ્યાર્થીઓ શરૂ કરતા પહેલા અપેક્ષાઓ સ્પષ્ટ કરીને અસાઇનમેન્ટને સરળ બનાવે છે.", "Punjabi": "ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਸ਼ੁਰੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਉਮੀਦਾਂ ਨੂੰ ਸਪਸ਼ਟ ਕਰਕੇ ਅਸਾਈਨਮੈਂਟਾਂ ਨੂੰ ਸਰਲ ਬਣਾਉਂਦੇ ਹਨ।", "Malayalam": "വിദ്യാർത്ഥികൾ ആരംഭിക്കുന്നതിന് മുമ്പ് പ്രതീക്ഷകൾ വ്യക്തമാക്കിക്കൊണ്ട് അസൈൻമെന്റുകൾ ലളിതമാക്കുന്നു.", "Odia": "ଛାତ୍ରମାନେ ଆରମ୍ଭ କରିବା ପୂର୍ବରୁ ଆଶା ସ୍ପଷ୍ଟ କରି ସେମାନେ ଆସାଇନମେଣ୍ଟକୁ ସରଳ କରନ୍ତି।"
    },
    "Consistency:": {
        "English": "Consistency:", "Hindi": "संगति:", "Kannada": "ಸ್ಥಿರತೆ:", "Tamil": "நிலைத்தன்மை:", "Telugu": "స్థిరత్వం:", "Marathi": "सुसंगती:", "Bengali": "সামঞ্জস্যতা:", "Gujarati": "સુસંગતતા:", "Punjabi": "ਨਿਰੰਤਰਤਾ:", "Malayalam": "സ്ഥിരത:", "Odia": "ସ୍ଥିରତା:"
    },
    "They ensure all students are graded with the same criteria, making assessment fair and objective.": {
        "English": "They ensure all students are graded with the same criteria, making assessment fair and objective.", "Hindi": "वे सुनिश्चित करते हैं कि सभी छात्रों को समान मानदंडों के साथ ग्रेड दिया जाए, जिससे मूल्यांकन निष्पक्ष और वस्तुनिष्ठ हो।", "Kannada": "ಎಲ್ಲಾ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೂ ಒಂದೇ ಮಾನದಂಡಗಳೊಂದಿಗೆ ಗ್ರೇಡ್ ನೀಡಲಾಗುತ್ತದೆ ಎಂದು ಖಚಿತಪಡಿಸುತ್ತದೆ.", "Tamil": "அனைத்து மாணவர்களும் ஒரே அளவுகோல்களுடன் மதிப்பீடு செய்யப்படுவதை உறுதி செய்கின்றன.", "Telugu": "అన్ని విద్యార్థులు ఒకే ప్రమాణాలతో గ్రేడ్ చేయబడతారని నిర్ధారిస్తుంది.", "Marathi": "सर्व विद्यार्थ्यांना समान निकषांसह ग्रेड दिले जातील याची खात्री देतात.", "Bengali": "এগুলি নিশ্চিত করে যে সমস্ত ছাত্রকে একই মানদণ্ড দিয়ে গ্রেড করা হয়।", "Gujarati": "બધા વિદ્યાર્થીઓને સમાન માપદંડ સાથે ગ્રેડ આપવામાં આવે છે તેની ખાતરી કરે છે.", "Punjabi": "ਉਹ ਯਕੀਨੀ ਬਣਾਉਂਦੇ ਹਨ ਕਿ ਸਾਰੇ ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਉਸੇ ਮਾਪਦੰਡ ਨਾਲ ਗ੍ਰੇਡ ਦਿੱਤਾ ਜਾਵੇ।", "Malayalam": "എല്ലാ വിദ്യാർത്ഥികളെയും ഒരേ മാനദണ്ഡങ്ങൾ ഉപയോഗിച്ച് ഗ്രേഡ് ചെയ്യുന്നുവെന്ന് ഉറപ്പാക്കുന്നു.", "Odia": "ସେମାନେ ସୁନିଶ୍ଚିତ କରନ୍ତି ଯେ ସମସ୍ତ ଛାତ୍ରଙ୍କୁ ସମାନ ମାନଦଣ୍ଡ ସହିତ ଗ୍ରେଡ୍ ଦିଆଯାଏ।"
    },
    "Feedback:": {
        "English": "Feedback:", "Hindi": "फीडबैक:", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ:", "Tamil": "கருத்து:", "Telugu": "ఫీడ్‌బ్యాక్:", "Marathi": "अभिप्राय:", "Bengali": "প্রতিক্রিয়া:", "Gujarati": "પ્રતિસાદ:", "Punjabi": "ਫੀਡਬੈਕ:", "Malayalam": "ഫീഡ്‌ബാക്ക്:", "Odia": "ମତାମତ:"
    },
    "They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.": {
        "English": "They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.", "Hindi": "वे विशिष्ट, विस्तृत फीडबैक प्रदान करते हैं जो छात्रों को उनकी ताकत और सुधार के क्षेत्रों को समझने में मदद करता है।", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ತಮ್ಮ ಶಕ್ತಿಗಳು ಮತ್ತು ಸುಧಾರಣೆಯ ಕ್ಷೇತ್ರಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಮಾಡುವ ನಿರ್ದಿಷ್ಟ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಒದಗಿಸುತ್ತದೆ.", "Tamil": "மாணவர்கள் தங்கள் பலங்களையும் முன்னேற்றத்திற்கான பகுதிகளையும் புரிந்துகொள்ள உதவும் குறிப்பிட்ட கருத்துகளை வழங்குகின்றன.", "Telugu": "విద్యార్థులకు తమ బలాలను అర్థం చేసుకోవడంలో సహాయపడే నిర్దిష్ట ఫీడ్‌బ్యాక్‌ను అందిస్తాయి.", "Marathi": "विद्यार्थ्यांना त्यांच्या शक्ती समजून घेण्यास मदत करणारा विशिष्ट अभिप्राय देतात.", "Bengali": "এগুলি নির্দিষ্ট প্রতিক্রিয়া প্রদান করে যা ছাত্রদের তাদের শক্তি বুঝতে সাহায্য করে।", "Gujarati": "વિદ્યાર્થીઓને તેમની શક્તિઓ સમજવામાં મદદ કરતો ચોક્કસ પ્રતિસાદ આપે છે.", "Punjabi": "ਉਹ ਖਾਸ ਫੀਡਬੈਕ ਪ੍ਰਦਾਨ ਕਰਦੇ ਹਨ ਜੋ ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਆਪਣੀਆਂ ਸ਼ਕਤੀਆਂ ਸਮਝਣ ਵਿੱਚ ਮਦਦ ਕਰਦੇ ਹਨ।", "Malayalam": "വിദ്യാർത്ഥികളെ അവരുടെ ശക്തികൾ മനസ്സിലാക്കാൻ സഹായിക്കുന്ന ഫീഡ്‌ബാക്ക് നൽകുന്നു.", "Odia": "ସେମାନେ ନିର୍ଦ୍ଦିଷ୍ଟ ମତାମତ ପ୍ରଦାନ କରନ୍ତି ଯାହା ଛାତ୍ରମାନଙ୍କୁ ସେମାନଙ୍କର ଶକ୍ତି ବୁଝିବାରେ ସାହାଯ୍ୟ କରେ।"
    },
    "Efficiency:": {
        "English": "Efficiency:", "Hindi": "दक्षता:", "Kannada": "ದಕ್ಷತೆ:", "Tamil": "திறன்:", "Telugu": "సామర్థ్యం:", "Marathi": "कार्यक्षमता:", "Bengali": "দক্ষতা:", "Gujarati": "કાર્યક્ષમતા:", "Punjabi": "ਕੁਸ਼ਲਤਾ:", "Malayalam": "കാര്യക്ഷമത:", "Odia": "ଦକ୍ଷତା:"
    },
    "They can make the grading process faster and more straightforward for teachers.": {
        "English": "They can make the grading process faster and more straightforward for teachers.", "Hindi": "वे शिक्षकों के लिए ग्रेडिंग प्रक्रिया को तेज और अधिक सीधा बना सकते हैं।", "Kannada": "ಶಿಕ್ಷಕರಿಗೆ ಗ್ರೇಡಿಂಗ್ ಪ್ರಕ್ರಿಯೆಯನ್ನು ವೇಗವಾಗಿ ಮಾಡಬಹುದು.", "Tamil": "ஆசிரியர்களுக்கு மதிப்பீட்டு செயல்முறையை வேகமாக ஆக்க முடியும்.", "Telugu": "ఉపాధ్యాయులకు గ్రేడింగ్ ప్రక్రియను వేగంగా చేయగలవు.", "Marathi": "ते शिक्षकांसाठी ग्रेडिंग प्रक्रिया जलद बनवू शकतात.", "Bengali": "এগুলি শিক্ষকদের জন্য গ্রেডিং প্রক্রিয়া দ্রুত করতে পারে।", "Gujarati": "તેઓ શિક્ષકો માટે ગ્રેડિંગ પ્રક્રિયા ઝડપી બનાવી શકે છે.", "Punjabi": "ਉਹ ਅਧਿਆਪਕਾਂ ਲਈ ਗ੍ਰੇਡਿੰਗ ਪ੍ਰਕਿਰਿਆ ਨੂੰ ਤੇਜ਼ ਬਣਾ ਸਕਦੇ ਹਨ।", "Malayalam": "അവർക്ക് അധ്യാപകർക്കായി ഗ്രേഡിംഗ് പ്രക്രിയ വേഗത്തിലാക്കാൻ കഴിയും.", "Odia": "ସେମାନେ ଶିକ୍ଷକମାନଙ୍କ ପାଇଁ ଗ୍ରେଡିଂ ପ୍ରକ୍ରିୟାକୁ ଶୀଘ୍ର କରିପାରନ୍ତି।"
    },
    "Assignment Description": {
        "English": "Assignment Description", "Hindi": "असाइनमेंट विवरण", "Kannada": "ನಿಯೋಜನೆ ವಿವರಣೆ", "Tamil": "வேலை விளக்கம்", "Telugu": "అసైన్‌మెంట్ వివరణ", "Marathi": "असाइनमेंट वर्णन", "Bengali": "অ্যাসাইনমেন্ট বিবরণ", "Gujarati": "અસાઇનમેન્ટ વર્ણન", "Punjabi": "ਅਸਾਈਨਮੈਂਟ ਵੇਰਵਾ", "Malayalam": "അസൈൻമെന്റ് വിവരണം", "Odia": "ଆସାଇନମେଣ୍ଟ ବିବରଣୀ"
    },
    "e.g., A project to build a model of the solar system for 6th graders.": {
        "English": "e.g., A project to build a model of the solar system for 6th graders.", "Hindi": "उदा., छठी कक्षा के छात्रों के लिए सौर मंडल का एक मॉडल बनाने की एक परियोजना।", "Kannada": "ಉದಾ., 6 ನೇ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿಗಳಿಗಾಗಿ ಸೌರವ್ಯೂಹದ ಮಾದರಿಯನ್ನು ನಿರ್ಮಿಸುವ ಯೋಜನೆ.", "Tamil": "எ.கா., 6 ஆம் வகுப்பு மாணவர்களுக்காக சூரிய மண்டலத்தின் மாதிரி.", "Telugu": "ఉదా., 6వ తరగతి కోసం సౌర వ్యవస్థ మోడల్ ప్రాజెక్ట్.", "Marathi": "उदा., 6 व्या वर्गातील विद्यार्थ्यांसाठी सौर मंडळाचे मॉडेल.", "Bengali": "যেমন, 6 শ্রেণীর জন্য সৌরজগতের মডেল প্রকল্প।", "Gujarati": "દા.ત., 6 મા ધોરણ માટે સૌરમંડળનું મોડેલ.", "Punjabi": "ਉਦਾ., 6ਵੀਂ ਜਮਾਤ ਲਈ ਸੂਰਜੀ ਮੰਡਲ ਦਾ ਮਾਡਲ।", "Malayalam": "ഉദാ., 6-ാം ഗ്രേഡിന് സൗരയൂഥ മാതൃക.", "Odia": "ଯଥା, 6ଷ୍ଠ ଶ୍ରେଣୀ ପାଇଁ ସୌର ବ୍ୟବସ୍ଥା ମଡେଲ।"
    },
    "Generate Rubric": {
        "English": "Generate Rubric", "Hindi": "रूब्रिक बनाएं", "Kannada": "ರೂಬ್ರಿಕ್ ರಚಿಸಿ", "Tamil": "ரூப்ரிக் உருவாக்கு", "Telugu": "రుబ్రిక్ ఉత్పన్నం చేయండి", "Marathi": "रुब्रिक तयार करा", "Bengali": "রুব্রিক তৈরি করুন", "Gujarati": "રુબ્રિક બનાવો", "Punjabi": "ਰੁਬ੍ਰਿਕ ਤਿਆਰ ਕਰੋ", "Malayalam": "റൂബ്രിക് സൃഷ്ടിക്കുക", "Odia": "ରୁବ୍ରିକ୍ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Generating Rubric...": {
        "English": "Generating Rubric...", "Hindi": "रूब्रिक बना रहा है...", "Kannada": "ರೂಬ್ರಿಕ್ ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "ரூப்ரிக் உருவாக்குகிறது...", "Telugu": "రుబ్రిక్ ఉత్పన్నం అవుతోంది...", "Marathi": "रुब्रिक तयार होत आहे...", "Bengali": "রুব্রিক তৈরি হচ্ছে...", "Gujarati": "રુબ્રિક બની રહ્યું છે...", "Punjabi": "ਰੁਬ੍ਰਿਕ ਬਣ ਰਿਹਾ ਹੈ...", "Malayalam": "റൂബ്രിക് സൃഷ്ടിക്കുന്നു...", "Odia": "ରୁବ୍ରିକ୍ ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Building your rubric...": {
        "English": "Building your rubric...", "Hindi": "आपका रूब्रिक बन रहा है...", "Kannada": "ನಿಮ್ಮ ರೂಬ್ರಿಕ್ ನಿರ್ಮಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "உங்கள் ரூப்ரிக் கட்டப்படுகிறது...", "Telugu": "మీ రుబ్రిక్ నిర్మించబడుతోంది...", "Marathi": "तुमची रुब्रिक तयार होत आहे...", "Bengali": "আপনার রুব্রিক তৈরি হচ্ছে...", "Gujarati": "તમારી રુબ્રિક બની રહી છે...", "Punjabi": "ਤੁਹਾਡੀ ਰੁਬ੍ਰਿਕ ਬਣ ਰਹੀ ਹੈ...", "Malayalam": "നിങ്ങളുടെ റൂബ്രിക് നിർമ്മിക്കുന്നു...", "Odia": "ଆପଣଙ୍କର ରୁବ୍ରିକ୍ ନିର୍ମାଣ ହେଉଛି..."
    },
    // === Wave 5: Attendance Calendar (MONTH_NAMES + headers) ===
    "January": {
        "English": "January", "Hindi": "जनवरी", "Kannada": "ಜನವರಿ", "Tamil": "ஜனவரி", "Telugu": "జనవరి", "Marathi": "जानेवारी", "Bengali": "জানুয়ারি", "Gujarati": "જાન્યુઆરી", "Punjabi": "ਜਨਵਰੀ", "Malayalam": "ജനുവരി", "Odia": "ଜାନୁଆରୀ"
    },
    "February": {
        "English": "February", "Hindi": "फरवरी", "Kannada": "ಫೆಬ್ರವರಿ", "Tamil": "பிப்ரவரி", "Telugu": "ఫిబ్రవరి", "Marathi": "फेब्रुवारी", "Bengali": "ফেব্রুয়ারি", "Gujarati": "ફેબ્રુઆરી", "Punjabi": "ਫਰਵਰੀ", "Malayalam": "ഫെബ്രുവരി", "Odia": "ଫେବୃଆରୀ"
    },
    "March": {
        "English": "March", "Hindi": "मार्च", "Kannada": "ಮಾರ್ಚ್", "Tamil": "மார்ச்", "Telugu": "మార్చి", "Marathi": "मार्च", "Bengali": "মার্চ", "Gujarati": "માર્ચ", "Punjabi": "ਮਾਰਚ", "Malayalam": "മാർച്ച്", "Odia": "ମାର୍ଚ୍ଚ"
    },
    "April": {
        "English": "April", "Hindi": "अप्रैल", "Kannada": "ಏಪ್ರಿಲ್", "Tamil": "ஏப்ரல்", "Telugu": "ఏప్రిల్", "Marathi": "एप्रिल", "Bengali": "এপ্রিল", "Gujarati": "એપ્રિલ", "Punjabi": "ਅਪ੍ਰੈਲ", "Malayalam": "ഏപ്രിൽ", "Odia": "ଅପ୍ରେଲ୍"
    },
    "May": {
        "English": "May", "Hindi": "मई", "Kannada": "ಮೇ", "Tamil": "மே", "Telugu": "మే", "Marathi": "मे", "Bengali": "মে", "Gujarati": "મે", "Punjabi": "ਮਈ", "Malayalam": "മേയ്", "Odia": "ମେ"
    },
    "June": {
        "English": "June", "Hindi": "जून", "Kannada": "ಜೂನ್", "Tamil": "ஜூன்", "Telugu": "జూన్", "Marathi": "जून", "Bengali": "জুন", "Gujarati": "જૂન", "Punjabi": "ਜੂਨ", "Malayalam": "ജൂൺ", "Odia": "ଜୁନ୍"
    },
    "July": {
        "English": "July", "Hindi": "जुलाई", "Kannada": "ಜುಲೈ", "Tamil": "ஜூலை", "Telugu": "జూలై", "Marathi": "जुलै", "Bengali": "জুলাই", "Gujarati": "જુલાઈ", "Punjabi": "ਜੁਲਾਈ", "Malayalam": "ജൂലൈ", "Odia": "ଜୁଲାଇ"
    },
    "August": {
        "English": "August", "Hindi": "अगस्त", "Kannada": "ಆಗಸ್ಟ್", "Tamil": "ஆகஸ்ட்", "Telugu": "ఆగస్టు", "Marathi": "ऑगस्ट", "Bengali": "আগস্ট", "Gujarati": "ઓગસ્ટ", "Punjabi": "ਅਗਸਤ", "Malayalam": "ഓഗസ്റ്റ്", "Odia": "ଅଗଷ୍ଟ"
    },
    "September": {
        "English": "September", "Hindi": "सितंबर", "Kannada": "ಸೆಪ್ಟೆಂಬರ್", "Tamil": "செப்டம்பர்", "Telugu": "సెప్టెంబర్", "Marathi": "सप्टेंबर", "Bengali": "সেপ্টেম্বর", "Gujarati": "સપ્ટેમ્બર", "Punjabi": "ਸਤੰਬਰ", "Malayalam": "സെപ്റ്റംബർ", "Odia": "ସେପ୍ଟେମ୍ବର"
    },
    "October": {
        "English": "October", "Hindi": "अक्टूबर", "Kannada": "ಅಕ್ಟೋಬರ್", "Tamil": "அக்டோபர்", "Telugu": "అక్టోబర్", "Marathi": "ऑक्टोबर", "Bengali": "অক্টোবর", "Gujarati": "ઓક્ટોબર", "Punjabi": "ਅਕਤੂਬਰ", "Malayalam": "ഒക്ടോബർ", "Odia": "ଅକ୍ଟୋବର"
    },
    "November": {
        "English": "November", "Hindi": "नवंबर", "Kannada": "ನವೆಂಬರ್", "Tamil": "நவம்பர்", "Telugu": "నవంబర్", "Marathi": "नोव्हेंबर", "Bengali": "নভেম্বর", "Gujarati": "નવેમ્બર", "Punjabi": "ਨਵੰਬਰ", "Malayalam": "നവംബർ", "Odia": "ନଭେମ୍ବର"
    },
    "December": {
        "English": "December", "Hindi": "दिसंबर", "Kannada": "ಡಿಸೆಂಬರ್", "Tamil": "டிசம்பர்", "Telugu": "డిసెంబర్", "Marathi": "डिसेंबर", "Bengali": "ডিসেম্বর", "Gujarati": "ડિસેમ્બર", "Punjabi": "ਦਸੰਬਰ", "Malayalam": "ഡിസംബർ", "Odia": "ଡିସେମ୍ବର"
    },
    "Student": {
        "English": "Student", "Hindi": "छात्र", "Kannada": "ವಿದ್ಯಾರ್ಥಿ", "Tamil": "மாணவர்", "Telugu": "విద్యార్థి", "Marathi": "विद्यार्थी", "Bengali": "ছাত্র", "Gujarati": "વિદ્યાર્થી", "Punjabi": "ਵਿਦਿਆਰਥੀ", "Malayalam": "വിദ്യാർത്ഥി", "Odia": "ଛାତ୍ର"
    },
    "Present": {
        "English": "Present", "Hindi": "उपस्थित", "Kannada": "ಹಾಜರಿದ್ದಾರೆ", "Tamil": "வந்துள்ளார்", "Telugu": "హాజరు", "Marathi": "उपस्थित", "Bengali": "উপস্থিত", "Gujarati": "હાજર", "Punjabi": "ਹਾਜ਼ਰ", "Malayalam": "ഹാജർ", "Odia": "ଉପସ୍ଥିତ"
    },
    "Absent": {
        "English": "Absent", "Hindi": "अनुपस्थित", "Kannada": "ಗೈರುಹಾಜರ", "Tamil": "வரவில்லை", "Telugu": "గైర్హాజరు", "Marathi": "गैरहजर", "Bengali": "অনুপস্থিত", "Gujarati": "ગેરહાજર", "Punjabi": "ਗੈਰ-ਹਾਜ਼ਰ", "Malayalam": "അസാന്നിധ്യം", "Odia": "ଅନୁପସ୍ଥିତ"
    },
    "Late": {
        "English": "Late", "Hindi": "देर से", "Kannada": "ತಡವಾಗಿ", "Tamil": "தாமதம்", "Telugu": "ఆలస్యం", "Marathi": "उशीर", "Bengali": "দেরি", "Gujarati": "મોડું", "Punjabi": "ਦੇਰ", "Malayalam": "വൈകി", "Odia": "ବିଳମ୍ବ"
    },
    "Days": {
        "English": "Days", "Hindi": "दिन", "Kannada": "ದಿನಗಳು", "Tamil": "நாட்கள்", "Telugu": "రోజులు", "Marathi": "दिवस", "Bengali": "দিন", "Gujarati": "દિવસો", "Punjabi": "ਦਿਨ", "Malayalam": "ദിവസങ്ങൾ", "Odia": "ଦିନ"
    },
    "Rate": {
        "English": "Rate", "Hindi": "दर", "Kannada": "ದರ", "Tamil": "விகிதம்", "Telugu": "రేటు", "Marathi": "दर", "Bengali": "হার", "Gujarati": "દર", "Punjabi": "ਦਰ", "Malayalam": "നിരക്ക്", "Odia": "ହାର"
    },
    "Previous month": {
        "English": "Previous month", "Hindi": "पिछला महीना", "Kannada": "ಹಿಂದಿನ ತಿಂಗಳು", "Tamil": "முந்தைய மாதம்", "Telugu": "మునుపటి నెల", "Marathi": "मागील महिना", "Bengali": "পূর্ববর্তী মাস", "Gujarati": "પાછલો મહિનો", "Punjabi": "ਪਿਛਲਾ ਮਹੀਨਾ", "Malayalam": "മുൻ മാസം", "Odia": "ପୂର୍ବ ମାସ"
    },
    "Next month": {
        "English": "Next month", "Hindi": "अगला महीना", "Kannada": "ಮುಂದಿನ ತಿಂಗಳು", "Tamil": "அடுத்த மாதம்", "Telugu": "తదుపరి నెల", "Marathi": "पुढील महिना", "Bengali": "পরবর্তী মাস", "Gujarati": "આગલો મહિનો", "Punjabi": "ਅਗਲਾ ਮਹੀਨਾ", "Malayalam": "അടുത്ത മാസം", "Odia": "ପରବର୍ତ୍ତୀ ମାସ"
    },
    // === Wave 5: Contact Parent Modal (REASONS, step labels, action buttons) ===
    "Consecutive Absences": {
        "English": "Consecutive Absences", "Hindi": "लगातार अनुपस्थिति", "Kannada": "ಸತತ ಗೈರುಹಾಜರಿ", "Tamil": "தொடர்ச்சியான வராமை", "Telugu": "వరుస గైర్హాజరు", "Marathi": "सलग गैरहजेरी", "Bengali": "ক্রমাগত অনুপস্থিতি", "Gujarati": "સતત ગેરહાજરી", "Punjabi": "ਲਗਾਤਾਰ ਗੈਰ-ਹਾਜ਼ਰੀ", "Malayalam": "തുടർച്ചയായ അസാന്നിധ്യം", "Odia": "କ୍ରମାଗତ ଅନୁପସ୍ଥିତି"
    },
    "Student has been absent for multiple days": {
        "English": "Student has been absent for multiple days", "Hindi": "छात्र कई दिनों से अनुपस्थित है", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಹಲವು ದಿನಗಳಿಂದ ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ", "Tamil": "மாணவர் பல நாட்கள் வரவில்லை", "Telugu": "విద్యార్థి అనేక రోజులు గైర్హాజరయ్యారు", "Marathi": "विद्यार्थी अनेक दिवस गैरहजर आहे", "Bengali": "ছাত্র একাধিক দিন অনুপস্থিত", "Gujarati": "વિદ્યાર્થી અનેક દિવસોથી ગેરહાજર છે", "Punjabi": "ਵਿਦਿਆਰਥੀ ਕਈ ਦਿਨਾਂ ਤੋਂ ਗੈਰ-ਹਾਜ਼ਰ ਹੈ", "Malayalam": "വിദ്യാർത്ഥി പല ദിവസങ്ങളായി ഹാജരായിട്ടില്ല", "Odia": "ଛାତ୍ର କେତେ ଦିନ ଧରି ଅନୁପସ୍ଥିତ"
    },
    "Academic Concern": {
        "English": "Academic Concern", "Hindi": "शैक्षणिक चिंता", "Kannada": "ಶೈಕ್ಷಣಿಕ ಕಾಳಜಿ", "Tamil": "கல்வி கவலை", "Telugu": "విద్యా ఆందోళన", "Marathi": "शैक्षणिक चिंता", "Bengali": "শিক্ষাগত উদ্বেগ", "Gujarati": "શૈક્ષણિક ચિંતા", "Punjabi": "ਅਕਾਦਮਿਕ ਚਿੰਤਾ", "Malayalam": "അക്കാദമിക ആശങ്ക", "Odia": "ଶିକ୍ଷାଗତ ଚିନ୍ତା"
    },
    "Grades or performance has declined": {
        "English": "Grades or performance has declined", "Hindi": "ग्रेड या प्रदर्शन में गिरावट", "Kannada": "ಗ್ರೇಡ್ ಅಥವಾ ಪ್ರದರ್ಶನ ಕುಸಿದಿದೆ", "Tamil": "மதிப்பெண்கள் அல்லது செயல்திறன் குறைந்துள்ளது", "Telugu": "గ్రేడ్‌లు లేదా పనితీరు తగ్గింది", "Marathi": "गुण किंवा कामगिरी कमी झाली", "Bengali": "গ্রেড বা পারফরম্যান্স কমেছে", "Gujarati": "ગ્રેડ અથવા પ્રદર્શન ઘટ્યું", "Punjabi": "ਗ੍ਰੇਡ ਜਾਂ ਪ੍ਰਦਰਸ਼ਨ ਘਟਿਆ", "Malayalam": "ഗ്രേഡുകൾ അല്ലെങ്കിൽ പ്രകടനം കുറഞ്ഞു", "Odia": "ଗ୍ରେଡ୍ କିମ୍ବା ପ୍ରଦର୍ଶନ କମିଛି"
    },
    "Behavioral Concern": {
        "English": "Behavioral Concern", "Hindi": "व्यवहार संबंधी चिंता", "Kannada": "ವರ್ತನೆಯ ಕಾಳಜಿ", "Tamil": "நடத்தை சார்ந்த கவலை", "Telugu": "ప్రవర్తనా ఆందోళన", "Marathi": "वर्तनासंबंधी चिंता", "Bengali": "আচরণগত উদ্বেগ", "Gujarati": "વર્તણૂક સંબંધી ચિંતા", "Punjabi": "ਵਿਹਾਰ ਸੰਬੰਧੀ ਚਿੰਤਾ", "Malayalam": "പെരുമാറ്റ പ്രശ്നം", "Odia": "ଆଚରଣଗତ ଚିନ୍ତା"
    },
    "Classroom behavior needs attention": {
        "English": "Classroom behavior needs attention", "Hindi": "कक्षा का व्यवहार ध्यान देने योग्य है", "Kannada": "ತರಗತಿಯ ವರ್ತನೆಗೆ ಗಮನ ಅಗತ್ಯವಿದೆ", "Tamil": "வகுப்பறை நடத்தை கவனம் தேவைப்படுகிறது", "Telugu": "తరగతి గది ప్రవర్తనకు దృష్టి అవసరం", "Marathi": "वर्गातील वर्तनाकडे लक्ष देणे आवश्यक", "Bengali": "শ্রেণীকক্ষের আচরণে মনোযোগ প্রয়োজন", "Gujarati": "વર્ગખંડ વર્તણૂક પર ધ્યાન જરૂરી", "Punjabi": "ਜਮਾਤ ਵਿੱਚ ਵਿਹਾਰ ਲਈ ਧਿਆਨ ਦੀ ਲੋੜ", "Malayalam": "ക്ലാസ്മുറി പെരുമാറ്റത്തിന് ശ്രദ്ധ വേണം", "Odia": "ଶ୍ରେଣୀଗୃହ ଆଚରଣକୁ ଧ୍ୟାନ ଆବଶ୍ୟକ"
    },
    "Positive Feedback": {
        "English": "Positive Feedback", "Hindi": "सकारात्मक प्रतिक्रिया", "Kannada": "ಸಕಾರಾತ್ಮಕ ಪ್ರತಿಕ್ರಿಯೆ", "Tamil": "நேர்மறையான கருத்து", "Telugu": "సానుకూల ఫీడ్‌బ్యాక్", "Marathi": "सकारात्मक अभिप्राय", "Bengali": "ইতিবাচক প্রতিক্রিয়া", "Gujarati": "સકારાત્મક પ્રતિસાદ", "Punjabi": "ਸਕਾਰਾਤਮਕ ਫੀਡਬੈਕ", "Malayalam": "പോസിറ്റീവ് ഫീഡ്‌ബാക്ക്", "Odia": "ସକାରାତ୍ମକ ମତାମତ"
    },
    "Share an achievement or good news": {
        "English": "Share an achievement or good news", "Hindi": "उपलब्धि या अच्छी खबर साझा करें", "Kannada": "ಸಾಧನೆ ಅಥವಾ ಒಳ್ಳೆಯ ಸುದ್ದಿಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ", "Tamil": "சாதனை அல்லது நல்ல செய்தியைப் பகிரவும்", "Telugu": "ఒక సాధనను లేదా శుభవార్తను పంచుకోండి", "Marathi": "एक उपलब्धी किंवा चांगली बातमी सामायिक करा", "Bengali": "একটি কৃতিত্ব বা ভাল খবর শেয়ার করুন", "Gujarati": "સિદ્ધિ અથવા સારી ખબર શેર કરો", "Punjabi": "ਪ੍ਰਾਪਤੀ ਜਾਂ ਚੰਗੀ ਖ਼ਬਰ ਸਾਂਝੀ ਕਰੋ", "Malayalam": "ഒരു നേട്ടം അല്ലെങ്കിൽ നല്ല വാർത്ത പങ്കിടുക", "Odia": "ଏକ ସଫଳତା କିମ୍ବା ଭଲ ଖବର ସେୟାର କରନ୍ତୁ"
    },
    "Generating...": {
        "English": "Generating...", "Hindi": "उत्पन्न हो रहा है...", "Kannada": "ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "உருவாக்குகிறது...", "Telugu": "ఉత్పన్నం అవుతోంది...", "Marathi": "तयार होत आहे...", "Bengali": "তৈরি হচ্ছে...", "Gujarati": "બની રહ્યું છે...", "Punjabi": "ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "സൃഷ്ടിക്കുന്നു...", "Odia": "ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Generate Message": {
        "English": "Generate Message", "Hindi": "संदेश उत्पन्न करें", "Kannada": "ಸಂದೇಶವನ್ನು ರಚಿಸಿ", "Tamil": "செய்தியை உருவாக்கு", "Telugu": "సందేశాన్ని ఉత్పన్నం చేయండి", "Marathi": "संदेश तयार करा", "Bengali": "বার্তা তৈরি করুন", "Gujarati": "સંદેશ બનાવો", "Punjabi": "ਸੁਨੇਹਾ ਤਿਆਰ ਕਰੋ", "Malayalam": "സന്ദേശം സൃഷ്ടിക്കുക", "Odia": "ସନ୍ଦେଶ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Regenerating...": {
        "English": "Regenerating...", "Hindi": "पुनः उत्पन्न हो रहा है...", "Kannada": "ಮತ್ತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "மீண்டும் உருவாக்குகிறது...", "Telugu": "మళ్లీ ఉత్పన్నం అవుతోంది...", "Marathi": "पुन्हा तयार होत आहे...", "Bengali": "পুনরায় তৈরি হচ্ছে...", "Gujarati": "ફરી બની રહ્યું છે...", "Punjabi": "ਦੁਬਾਰਾ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "വീണ്ടും സൃഷ്ടിക്കുന്നു...", "Odia": "ପୁଣି ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Regenerate": {
        "English": "Regenerate", "Hindi": "पुनः उत्पन्न करें", "Kannada": "ಮತ್ತೆ ರಚಿಸಿ", "Tamil": "மீண்டும் உருவாக்கு", "Telugu": "మళ్లీ ఉత్పన్నం చేయండి", "Marathi": "पुन्हा तयार करा", "Bengali": "পুনরায় তৈরি করুন", "Gujarati": "ફરી બનાવો", "Punjabi": "ਦੁਬਾਰਾ ਤਿਆਰ ਕਰੋ", "Malayalam": "വീണ്ടും സൃഷ്ടിക്കുക", "Odia": "ପୁଣି ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Auto-call is not available for": {
        "English": "Auto-call is not available for", "Hindi": "के लिए ऑटो-कॉल उपलब्ध नहीं है", "Kannada": "ಗಾಗಿ ಆಟೋ-ಕಾಲ್ ಲಭ್ಯವಿಲ್ಲ", "Tamil": "க்கு ஆட்டோ-கால் கிடைக்காது", "Telugu": "కోసం ఆటో-కాల్ అందుబాటులో లేదు", "Marathi": "साठी ऑटो-कॉल उपलब्ध नाही", "Bengali": "এর জন্য অটো-কল উপলব্ধ নয়", "Gujarati": "માટે ઓટો-કૉલ ઉપલબ્ધ નથી", "Punjabi": "ਲਈ ਆਟੋ-ਕਾਲ ਉਪਲਬਧ ਨਹੀਂ ਹੈ", "Malayalam": "എന്നതിന് ഓട്ടോ-കോൾ ലഭ്യമല്ല", "Odia": "ପାଇଁ ଅଟୋ-କଲ୍ ଉପଲବ୍ଧ ନାହିଁ"
    },
    "Use WhatsApp copy instead.": {
        "English": "Use WhatsApp copy instead.", "Hindi": "इसके बजाय WhatsApp कॉपी का उपयोग करें।", "Kannada": "ಬದಲಿಗೆ WhatsApp ನಕಲನ್ನು ಬಳಸಿ.", "Tamil": "மாற்றாக WhatsApp நகலைப் பயன்படுத்தவும்.", "Telugu": "బదులుగా WhatsApp కాపీని ఉపయోగించండి.", "Marathi": "त्याऐवजी WhatsApp कॉपी वापरा.", "Bengali": "পরিবর্তে WhatsApp কপি ব্যবহার করুন।", "Gujarati": "બદલે WhatsApp કૉપિ વાપરો.", "Punjabi": "ਇਸਦੀ ਥਾਂ WhatsApp ਕਾਪੀ ਵਰਤੋ।", "Malayalam": "പകരം WhatsApp പകർപ്പ് ഉപയോഗിക്കുക.", "Odia": "ଏହା ବଦଳରେ WhatsApp କପି ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "Copy for WhatsApp": {
        "English": "Copy for WhatsApp", "Hindi": "WhatsApp के लिए कॉपी करें", "Kannada": "WhatsApp ಗಾಗಿ ನಕಲಿಸಿ", "Tamil": "WhatsApp-க்கு நகலெடு", "Telugu": "WhatsApp కోసం కాపీ చేయండి", "Marathi": "WhatsApp साठी कॉपी करा", "Bengali": "WhatsApp এর জন্য কপি করুন", "Gujarati": "WhatsApp માટે કૉપિ કરો", "Punjabi": "WhatsApp ਲਈ ਕਾਪੀ ਕਰੋ", "Malayalam": "WhatsApp-നായി പകർത്തുക", "Odia": "WhatsApp ପାଇଁ କପି କରନ୍ତୁ"
    },
    "Calling...": {
        "English": "Calling...", "Hindi": "कॉल हो रहा है...", "Kannada": "ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ...", "Tamil": "அழைக்கிறது...", "Telugu": "కాల్ చేస్తోంది...", "Marathi": "कॉल करत आहे...", "Bengali": "কল হচ্ছে...", "Gujarati": "કૉલ થઈ રહ્યો છે...", "Punjabi": "ਕਾਲ ਹੋ ਰਹੀ ਹੈ...", "Malayalam": "വിളിക്കുന്നു...", "Odia": "କଲ୍ କରୁଛି..."
    },
    "Call Parent": {
        "English": "Call Parent", "Hindi": "अभिभावक को कॉल करें", "Kannada": "ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಿ", "Tamil": "பெற்றோரை அழை", "Telugu": "తల్లిదండ్రులకు కాల్ చేయండి", "Marathi": "पालकांना कॉल करा", "Bengali": "অভিভাবককে কল করুন", "Gujarati": "વાલીને કૉલ કરો", "Punjabi": "ਮਾਪਿਆਂ ਨੂੰ ਕਾਲ ਕਰੋ", "Malayalam": "രക്ഷിതാവിനെ വിളിക്കുക", "Odia": "ଅଭିଭାବକଙ୍କୁ କଲ୍ କରନ୍ତୁ"
    },
    "Specific note (optional) — e.g., 'Usually a regular attender; checking if everything is okay at home.'": {
        "English": "Specific note (optional) — e.g., 'Usually a regular attender; checking if everything is okay at home.'", "Hindi": "विशिष्ट टिप्पणी (वैकल्पिक) — जैसे, 'आमतौर पर नियमित आते हैं; जाँच कर रहे हैं कि घर पर सब ठीक है या नहीं।'", "Kannada": "ನಿರ್ದಿಷ್ಟ ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ) — ಉದಾ., 'ಸಾಮಾನ್ಯವಾಗಿ ನಿಯಮಿತ ಹಾಜರಾತಿ; ಮನೆಯಲ್ಲಿ ಎಲ್ಲವೂ ಸರಿಯಾಗಿದೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ.'", "Tamil": "குறிப்பிட்ட குறிப்பு (விருப்பப்படி) — எ.கா., 'வழக்கமாக ஒழுங்காக வரும்; வீட்டில் எல்லாம் சரியாக இருக்கிறதா என்று சரிபார்க்கிறேன்.'", "Telugu": "నిర్దిష్ట గమనిక (ఐచ్ఛికం) — ఉదా., 'సాధారణంగా క్రమం తప్పకుండా హాజరవుతారు; ఇంట్లో అంతా బాగుందా అని తనిఖీ చేస్తున్నాను.'", "Marathi": "विशिष्ट टिप्पणी (ऐच्छिक) — उदा., 'सामान्यतः नियमित हजर असतात; घरी सर्व काही ठीक आहे का तपासत आहे.'", "Bengali": "নির্দিষ্ট নোট (ঐচ্ছিক) — যেমন, 'সাধারণত নিয়মিত উপস্থিত; বাড়িতে সব ঠিক আছে কিনা দেখছি।'", "Gujarati": "વિશિષ્ટ નોંધ (વૈકલ્પિક) — દા.ત., 'સામાન્ય રીતે નિયમિત હાજર; ઘરે બધું ઠીક છે કે કેમ તે તપાસી રહ્યો છું.'", "Punjabi": "ਖਾਸ ਨੋਟ (ਵਿਕਲਪਿਕ) — ਉਦਾ., 'ਆਮ ਤੌਰ 'ਤੇ ਨਿਯਮਿਤ ਹਾਜ਼ਰ; ਚੈੱਕ ਕਰ ਰਿਹਾ ਹਾਂ ਕਿ ਘਰ ਵਿੱਚ ਸਭ ਕੁਝ ਠੀਕ ਹੈ ਜਾਂ ਨਹੀਂ।'", "Malayalam": "നിർദ്ദിഷ്ട കുറിപ്പ് (ഓപ്ഷണൽ) — ഉദാ., 'സാധാരണ പതിവായി ഹാജരാകുന്ന; വീട്ടിൽ എല്ലാം ശരിയാണോ എന്ന് പരിശോധിക്കുന്നു.'", "Odia": "ନିର୍ଦ୍ଦିଷ୍ଟ ଟିପ୍ପଣୀ (ବିକଳ୍ପ) — ଯଥା, 'ସାଧାରଣତଃ ନିୟମିତ ଉପସ୍ଥିତ; ଘରେ ସବୁ ଠିକ୍ ଅଛି କି ଜାଣିବାକୁ ଚାହୁଁଛି।'"
    },
    "Describe the incident — e.g., 'Calling out during lessons this week; took another student's pen on Monday.'": {
        "English": "Describe the incident — e.g., 'Calling out during lessons this week; took another student's pen on Monday.'", "Hindi": "घटना का वर्णन करें — जैसे, 'इस सप्ताह पाठ के दौरान चिल्लाना; सोमवार को दूसरे छात्र की कलम ली।'", "Kannada": "ಘಟನೆಯನ್ನು ವಿವರಿಸಿ — ಉದಾ., 'ಈ ವಾರ ಪಾಠಗಳ ಸಮಯದಲ್ಲಿ ಕೂಗಾಡುವುದು; ಸೋಮವಾರ ಮತ್ತೊಬ್ಬ ವಿದ್ಯಾರ್ಥಿಯ ಪೆನ್ ತೆಗೆದುಕೊಂಡರು.'", "Tamil": "சம்பவத்தை விவரிக்கவும் — எ.கா., 'இந்த வாரம் பாடங்களின் போது சத்தம் போடுவது; திங்கட்கிழமை மற்றொரு மாணவரின் பேனாவை எடுத்தார்.'", "Telugu": "సంఘటనను వివరించండి — ఉదా., 'ఈ వారం పాఠాల సమయంలో అరవడం; సోమవారం మరో విద్యార్థి పెన్ తీసుకున్నారు.'", "Marathi": "घटनेचे वर्णन करा — उदा., 'या आठवड्यात पाठांदरम्यान ओरडणे; सोमवारी दुसऱ्या विद्यार्थ्याची पेन घेतली.'", "Bengali": "ঘটনাটি বর্ণনা করুন — যেমন, 'এই সপ্তাহে পাঠের সময় চিৎকার করা; সোমবার অন্য ছাত্রের কলম নেওয়া।'", "Gujarati": "ઘટનાનું વર્ણન કરો — દા.ત., 'આ અઠવાડિયે પાઠ દરમિયાન બૂમો પાડવી; સોમવારે અન્ય વિદ્યાર્થીની પેન લીધી.'", "Punjabi": "ਘਟਨਾ ਦਾ ਵਰਣਨ ਕਰੋ — ਉਦਾ., 'ਇਸ ਹਫ਼ਤੇ ਪਾਠਾਂ ਦੌਰਾਨ ਚੀਕਣਾ; ਸੋਮਵਾਰ ਨੂੰ ਦੂਜੇ ਵਿਦਿਆਰਥੀ ਦੀ ਪੈਨ ਲਈ।'", "Malayalam": "സംഭവം വിവരിക്കുക — ഉദാ., 'ഈ ആഴ്ച പാഠങ്ങൾക്കിടെ വിളിക്കുന്നു; തിങ്കളാഴ്ച മറ്റൊരു വിദ്യാർത്ഥിയുടെ പേന എടുത്തു.'", "Odia": "ଘଟଣା ବର୍ଣ୍ଣନା କରନ୍ତୁ — ଯଥା, 'ଏହି ସପ୍ତାହ ପାଠ ସମୟରେ ଡାକୁଛନ୍ତି; ସୋମବାର ଅନ୍ୟ ଛାତ୍ରର କଲମ ନେଲେ।'"
    },
    "Specific note (optional) — e.g., 'Scored 6/25 in last unit test; missed 3 homeworks in 2 weeks.'": {
        "English": "Specific note (optional) — e.g., 'Scored 6/25 in last unit test; missed 3 homeworks in 2 weeks.'", "Hindi": "विशिष्ट टिप्पणी (वैकल्पिक) — जैसे, 'पिछले इकाई परीक्षण में 6/25 अंक; 2 सप्ताह में 3 गृहकार्य छूटे।'", "Kannada": "ನಿರ್ದಿಷ್ಟ ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ) — ಉದಾ., 'ಕೊನೆಯ ಯೂನಿಟ್ ಪರೀಕ್ಷೆಯಲ್ಲಿ 6/25 ಅಂಕಗಳು; 2 ವಾರಗಳಲ್ಲಿ 3 ಮನೆಗೆಲಸ ತಪ್ಪಿಸಿಕೊಂಡರು.'", "Tamil": "குறிப்பிட்ட குறிப்பு (விருப்பப்படி) — எ.கா., 'கடைசி அலகு தேர்வில் 6/25 மதிப்பெண்; 2 வாரங்களில் 3 வீட்டுப்பாடம் தவறவிட்டார்.'", "Telugu": "నిర్దిష్ట గమనిక (ఐచ్ఛికం) — ఉదా., 'చివరి యూనిట్ టెస్ట్‌లో 6/25 స్కోర్; 2 వారాల్లో 3 హోంవర్క్ తప్పిపోయింది.'", "Marathi": "विशिष्ट टिप्पणी (ऐच्छिक) — उदा., 'मागील एकक चाचणीत 6/25 गुण; 2 आठवड्यांत 3 गृहपाठ चुकले.'", "Bengali": "নির্দিষ্ট নোট (ঐচ্ছিক) — যেমন, 'গত ইউনিট পরীক্ষায় 6/25 স্কোর; 2 সপ্তাহে 3টি হোমওয়ার্ক বাদ পড়েছে।'", "Gujarati": "વિશિષ્ટ નોંધ (વૈકલ્પિક) — દા.ત., 'છેલ્લા એકમ ટેસ્ટમાં 6/25 ગુણ; 2 અઠવાડિયામાં 3 હોમવર્ક ચૂક્યા.'", "Punjabi": "ਖਾਸ ਨੋਟ (ਵਿਕਲਪਿਕ) — ਉਦਾ., 'ਪਿਛਲੇ ਯੂਨਿਟ ਟੈਸਟ ਵਿੱਚ 6/25 ਅੰਕ; 2 ਹਫ਼ਤਿਆਂ ਵਿੱਚ 3 ਘਰ ਦੇ ਕੰਮ ਖੁੰਝੇ।'", "Malayalam": "നിർദ്ദിഷ്ട കുറിപ്പ് (ഓപ്ഷണൽ) — ഉദാ., 'അവസാന യൂണിറ്റ് ടെസ്റ്റിൽ 6/25 സ്കോർ; 2 ആഴ്ച്ചയിൽ 3 ഹോംവർക്ക് നഷ്ടപ്പെട്ടു.'", "Odia": "ନିର୍ଦ୍ଦିଷ୍ଟ ଟିପ୍ପଣୀ (ବିକଳ୍ପ) — ଯଥା, 'ଶେଷ ୟୁନିଟ୍ ପରୀକ୍ଷାରେ 6/25 ସ୍କୋର; 2 ସପ୍ତାହରେ 3 ଗୃହକାର୍ଯ୍ୟ ବାଦ ପଡିଲା।'"
    },
    "Achievement to celebrate — e.g., 'Helped two classmates with fractions during revision.'": {
        "English": "Achievement to celebrate — e.g., 'Helped two classmates with fractions during revision.'", "Hindi": "मनाने की उपलब्धि — जैसे, 'पुनरावलोकन के दौरान दो सहपाठियों को भिन्न में मदद की।'", "Kannada": "ಆಚರಿಸಲು ಸಾಧನೆ — ಉದಾ., 'ಪರಿಷ್ಕರಣೆ ಸಮಯದಲ್ಲಿ ಇಬ್ಬರು ಸಹಪಾಠಿಗಳಿಗೆ ಭಿನ್ನರಾಶಿಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಿದರು.'", "Tamil": "கொண்டாட வேண்டிய சாதனை — எ.கா., 'மீள்பார்வையின் போது இரண்டு வகுப்புத் தோழர்களுக்கு பின்னங்களில் உதவினார்.'", "Telugu": "జరుపుకోవలసిన సాధన — ఉదా., 'రివిజన్ సమయంలో ఇద్దరు సహవిద్యార్థులకు భిన్నాలతో సహాయం చేశారు.'", "Marathi": "साजरी करण्याची उपलब्धी — उदा., 'पुनरावलोकनादरम्यान दोन वर्गमित्रांना अपूर्णांकांमध्ये मदत केली.'", "Bengali": "উদযাপন করার মতো কৃতিত্ব — যেমন, 'রিভিশনের সময় দুই সহপাঠীকে ভগ্নাংশে সাহায্য করেছে।'", "Gujarati": "ઉજવણી માટેની સિદ્ધિ — દા.ત., 'પુનરાવર્તન દરમિયાન બે સહપાઠીઓને અપૂર્ણાંકોમાં મદદ કરી.'", "Punjabi": "ਜਸ਼ਨ ਮਨਾਉਣ ਯੋਗ ਪ੍ਰਾਪਤੀ — ਉਦਾ., 'ਪੁਨਰ-ਅਵਲੋਕਨ ਦੌਰਾਨ ਦੋ ਜਮਾਤੀਆਂ ਦੀ ਫਰੈਕਸ਼ਨਾਂ ਵਿੱਚ ਮਦਦ ਕੀਤੀ।'", "Malayalam": "ആഘോഷിക്കാനുള്ള നേട്ടം — ഉദാ., 'പുനരവലോകന വേളയിൽ രണ്ട് സഹപാഠികളെ ഭിന്നസംഖ്യകളിൽ സഹായിച്ചു.'", "Odia": "ଉତ୍ସବ ପାଳନ କରିବାର ସଫଳତା — ଯଥା, 'ସମୀକ୍ଷା ସମୟରେ ଦୁଇ ସହପାଠୀଙ୍କୁ ଭଗ୍ନାଂଶରେ ସାହାଯ୍ୟ କଲେ।'"
    },
    "Add specific details (optional)": {
        "English": "Add specific details (optional)", "Hindi": "विशिष्ट विवरण जोड़ें (वैकल्पिक)", "Kannada": "ನಿರ್ದಿಷ್ಟ ವಿವರಗಳನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)", "Tamil": "குறிப்பிட்ட விவரங்களைச் சேர்க்கவும் (விருப்பப்படி)", "Telugu": "నిర్దిష్ట వివరాలను జోడించండి (ఐచ్ఛికం)", "Marathi": "विशिष्ट तपशील जोडा (ऐच्छिक)", "Bengali": "নির্দিষ্ট বিবরণ যোগ করুন (ঐচ্ছিক)", "Gujarati": "વિશિષ્ટ વિગતો ઉમેરો (વૈકલ્પિક)", "Punjabi": "ਖਾਸ ਵੇਰਵੇ ਜੋੜੋ (ਵਿਕਲਪਿਕ)", "Malayalam": "നിർദ്ദിഷ്ട വിശദാംശങ്ങൾ ചേർക്കുക (ഓപ്ഷണൽ)", "Odia": "ନିର୍ଦ୍ଦିଷ୍ଟ ବିବରଣୀ ଯୋଗ କରନ୍ତୁ (ବିକଳ୍ପ)"
    },
    // === Wave 5: VIDYA Voice Assistant ===
    "Hello! I'm VIDYA": {
        "English": "Hello! I'm VIDYA", "Hindi": "नमस्ते! मैं VIDYA हूँ", "Kannada": "ನಮಸ್ಕಾರ! ನಾನು VIDYA", "Tamil": "வணக்கம்! நான் VIDYA", "Telugu": "నమస్కారం! నేను VIDYA", "Marathi": "नमस्कार! मी VIDYA आहे", "Bengali": "নমস্কার! আমি VIDYA", "Gujarati": "નમસ્તે! હું VIDYA છું", "Punjabi": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ VIDYA ਹਾਂ", "Malayalam": "നമസ്കാരം! ഞാൻ VIDYA", "Odia": "ନମସ୍କାର! ମୁଁ VIDYA"
    },
    "Your Senior Pedagogical Mentor. Ask me to create lesson plans, quizzes, worksheets, visual aids, and more — in any Indian language. Speak or type and I'll match your language automatically.": {
        "English": "Your Senior Pedagogical Mentor. Ask me to create lesson plans, quizzes, worksheets, visual aids, and more — in any Indian language. Speak or type and I'll match your language automatically.", "Hindi": "आपका वरिष्ठ शैक्षणिक मार्गदर्शक। पाठ योजना, क्विज़, वर्कशीट, दृश्य सहायक, और बहुत कुछ बनाने के लिए मुझसे पूछें — किसी भी भारतीय भाषा में। बोलें या टाइप करें और मैं आपकी भाषा से स्वचालित रूप से मेल खाऊंगा।", "Kannada": "ನಿಮ್ಮ ಹಿರಿಯ ಶೈಕ್ಷಣಿಕ ಮಾರ್ಗದರ್ಶಕ. ಪಾಠ ಯೋಜನೆಗಳು, ರಸಪ್ರಶ್ನೆಗಳು, ವರ್ಕ್‌ಶೀಟ್‌ಗಳು, ದೃಶ್ಯ ಸಹಾಯಕಗಳು, ಮತ್ತು ಹೆಚ್ಚಿನವುಗಳನ್ನು ರಚಿಸಲು ನನ್ನನ್ನು ಕೇಳಿ — ಯಾವುದೇ ಭಾರತೀಯ ಭಾಷೆಯಲ್ಲಿ. ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ ಮತ್ತು ನಾನು ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಹೊಂದಿಸುತ್ತೇನೆ.", "Tamil": "உங்கள் மூத்த கல்வியியல் வழிகாட்டி. பாடம் திட்டங்கள், வினாடி வினாக்கள், பணித்தாள்கள், காட்சி உதவிகள், மேலும் பலவற்றை உருவாக்க என்னிடம் கேளுங்கள் — எந்த இந்திய மொழியிலும். பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள், நான் தானாகவே உங்கள் மொழியைப் பொருத்துவேன்.", "Telugu": "మీ సీనియర్ బోధనా మార్గదర్శి. పాఠ ప్రణాళికలు, క్విజ్‌లు, వర్క్‌షీట్‌లు, దృశ్య సహాయకాలు మరియు మరిన్నింటిని సృష్టించమని నన్ను అడగండి — ఏదైనా భారతీయ భాషలో. మాట్లాడండి లేదా టైప్ చేయండి, నేను మీ భాషను స్వయంచాలకంగా సరిపోల్చుతాను.", "Marathi": "तुमचा वरिष्ठ अध्यापन मार्गदर्शक. पाठ योजना, क्विझ, वर्कशीट, दृश्य साधने, आणि अधिक तयार करण्यासाठी मला विचारा — कोणत्याही भारतीय भाषेत. बोला किंवा टाइप करा आणि मी तुमची भाषा आपोआप जुळवीन.", "Bengali": "আপনার সিনিয়র শিক্ষা পরামর্শদাতা। যেকোনো ভারতীয় ভাষায় পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট, ভিজ্যুয়াল এইডস এবং আরও তৈরি করতে আমাকে জিজ্ঞাসা করুন। কথা বলুন বা টাইপ করুন এবং আমি স্বয়ংক্রিয়ভাবে আপনার ভাষার সাথে মিলাব।", "Gujarati": "તમારા સિનિયર શૈક્ષણિક માર્ગદર્શક. પાઠ યોજનાઓ, ક્વિઝ, વર્કશીટ્સ, વિઝ્યુઅલ સહાય અને વધુ બનાવવા માટે મને પૂછો — કોઈપણ ભારતીય ભાષામાં. બોલો અથવા ટાઇપ કરો અને હું તમારી ભાષા આપમેળે મેચ કરીશ.", "Punjabi": "ਤੁਹਾਡਾ ਸੀਨੀਅਰ ਸਿੱਖਿਆ ਮਾਰਗਦਰਸ਼ਕ। ਕਿਸੇ ਵੀ ਭਾਰਤੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼, ਵਰਕਸ਼ੀਟਾਂ, ਵਿਜ਼ੂਅਲ ਏਡਜ਼ ਅਤੇ ਹੋਰ ਬਣਾਉਣ ਲਈ ਮੈਨੂੰ ਪੁੱਛੋ। ਬੋਲੋ ਜਾਂ ਟਾਈਪ ਕਰੋ ਅਤੇ ਮੈਂ ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਨੂੰ ਆਪਣੇ ਆਪ ਮਿਲਾਵਾਂਗਾ।", "Malayalam": "നിങ്ങളുടെ സീനിയർ പെഡഗോഗിക്കൽ മെന്റർ. ഏതെങ്കിലും ഇന്ത്യൻ ഭാഷയിൽ പാഠ്യപദ്ധതികൾ, ക്വിസുകൾ, വർക്ക്‌ഷീറ്റുകൾ, ദൃശ്യ സഹായികൾ, എന്നിവ സൃഷ്ടിക്കാൻ എന്നോട് ചോദിക്കുക. സംസാരിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക, ഞാൻ നിങ്ങളുടെ ഭാഷ സ്വയമേവ പൊരുത്തപ്പെടുത്തും.", "Odia": "ଆପଣଙ୍କର ବରିଷ୍ଠ ଶିକ୍ଷାଗତ ମେଣ୍ଟର୍। ଯେକୌଣସି ଭାରତୀୟ ଭାଷାରେ ପାଠ ଯୋଜନା, କୁଇଜ୍, ୱର୍କସିଟ୍, ଭିଜୁଆଲ୍ ସହାୟତା, ଏବଂ ଅଧିକ ତିଆରି କରିବାକୁ ମୋତେ କୁହନ୍ତୁ। କୁହନ୍ତୁ କିମ୍ବା ଟାଇପ୍ କରନ୍ତୁ ଏବଂ ମୁଁ ସ୍ୱୟଂଚାଳିତ ଭାବେ ଆପଣଙ୍କ ଭାଷା ସହିତ ମେଳ କରିବି।"
    },
    "Make a lesson plan": {
        "English": "Make a lesson plan", "Hindi": "एक पाठ योजना बनाएं", "Kannada": "ಪಾಠ ಯೋಜನೆ ಮಾಡಿ", "Tamil": "ஒரு பாடம் திட்டத்தை உருவாக்கு", "Telugu": "పాఠ ప్రణాళిక చేయండి", "Marathi": "एक पाठ योजना तयार करा", "Bengali": "একটি পাঠ পরিকল্পনা তৈরি করুন", "Gujarati": "પાઠ યોજના બનાવો", "Punjabi": "ਇੱਕ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ", "Malayalam": "ഒരു പാഠ്യപദ്ധതി ഉണ്ടാക്കുക", "Odia": "ଏକ ପାଠ ଯୋଜନା ତିଆରି କରନ୍ତୁ"
    },
    "I need a quiz": {
        "English": "I need a quiz", "Hindi": "मुझे एक क्विज़ चाहिए", "Kannada": "ನನಗೆ ರಸಪ್ರಶ್ನೆ ಬೇಕು", "Tamil": "எனக்கு வினாடி வினா வேண்டும்", "Telugu": "నాకు ఒక క్విజ్ కావాలి", "Marathi": "मला एक क्विझ हवी आहे", "Bengali": "আমার একটি কুইজ দরকার", "Gujarati": "મને ક્વિઝ જોઈએ છે", "Punjabi": "ਮੈਨੂੰ ਇੱਕ ਕਵਿਜ਼ ਚਾਹੀਦਾ ਹੈ", "Malayalam": "എനിക്ക് ഒരു ക്വിസ് വേണം", "Odia": "ମୋତେ ଏକ କୁଇଜ୍ ଦରକାର"
    },
    "Create a visual aid": {
        "English": "Create a visual aid", "Hindi": "एक दृश्य सहायक बनाएं", "Kannada": "ದೃಶ್ಯ ಸಹಾಯಕವನ್ನು ರಚಿಸಿ", "Tamil": "ஒரு காட்சி உதவியை உருவாக்கு", "Telugu": "ఒక దృశ్య సహాయకాన్ని సృష్టించండి", "Marathi": "एक दृश्य सहाय्य तयार करा", "Bengali": "একটি ভিজ্যুয়াল এইড তৈরি করুন", "Gujarati": "વિઝ્યુઅલ સહાય બનાવો", "Punjabi": "ਇੱਕ ਵਿਜ਼ੂਅਲ ਸਹਾਇਤਾ ਬਣਾਓ", "Malayalam": "ഒരു ദൃശ്യ സഹായം ഉണ്ടാക്കുക", "Odia": "ଏକ ଭିଜୁଆଲ୍ ସହାୟତା ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Show me videos": {
        "English": "Show me videos", "Hindi": "मुझे वीडियो दिखाओ", "Kannada": "ನನಗೆ ವೀಡಿಯೊಗಳನ್ನು ತೋರಿಸಿ", "Tamil": "எனக்கு வீடியோக்களைக் காட்டு", "Telugu": "నాకు వీడియోలు చూపండి", "Marathi": "मला व्हिडिओ दाखवा", "Bengali": "আমাকে ভিডিও দেখান", "Gujarati": "મને વિડિઓ બતાવો", "Punjabi": "ਮੈਨੂੰ ਵੀਡੀਓ ਦਿਖਾਓ", "Malayalam": "എനിക്ക് വീഡിയോകൾ കാണിക്കൂ", "Odia": "ମୋତେ ଭିଡିଓ ଦେଖାନ୍ତୁ"
    },
    "VIDYA is thinking...": {
        "English": "VIDYA is thinking...", "Hindi": "VIDYA सोच रहा है...", "Kannada": "VIDYA ಯೋಚಿಸುತ್ತಿದೆ...", "Tamil": "VIDYA சிந்திக்கிறது...", "Telugu": "VIDYA ఆలోచిస్తోంది...", "Marathi": "VIDYA विचार करत आहे...", "Bengali": "VIDYA ভাবছে...", "Gujarati": "VIDYA વિચારી રહ્યું છે...", "Punjabi": "VIDYA ਸੋਚ ਰਿਹਾ ਹੈ...", "Malayalam": "VIDYA ചിന്തിക്കുന്നു...", "Odia": "VIDYA ଚିନ୍ତା କରୁଛି..."
    },
    "Type or speak to VIDYA...": {
        "English": "Type or speak to VIDYA...", "Hindi": "VIDYA से टाइप या बोलें...", "Kannada": "VIDYA ಗೆ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ...", "Tamil": "VIDYA-வுக்கு தட்டச்சு செய்யவும் அல்லது பேசவும்...", "Telugu": "VIDYAకి టైప్ చేయండి లేదా మాట్లాడండి...", "Marathi": "VIDYA ला टाइप करा किंवा बोला...", "Bengali": "VIDYA-কে টাইপ করুন বা বলুন...", "Gujarati": "VIDYA સાથે ટાઇપ કરો અથવા બોલો...", "Punjabi": "VIDYA ਨੂੰ ਟਾਈਪ ਕਰੋ ਜਾਂ ਬੋਲੋ...", "Malayalam": "VIDYA-യോട് ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ സംസാരിക്കുക...", "Odia": "VIDYA କୁ ଟାଇପ୍ କରନ୍ତୁ କିମ୍ବା କୁହନ୍ତୁ..."
    },
    "Or tap to speak...": {
        "English": "Or tap to speak...", "Hindi": "या बोलने के लिए टैप करें...", "Kannada": "ಅಥವಾ ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ...", "Tamil": "அல்லது பேச தட்டவும்...", "Telugu": "లేదా మాట్లాడడానికి ట్యాప్ చేయండి...", "Marathi": "किंवा बोलण्यासाठी टॅप करा...", "Bengali": "অথবা কথা বলতে ট্যাপ করুন...", "Gujarati": "અથવા બોલવા માટે ટેપ કરો...", "Punjabi": "ਜਾਂ ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ...", "Malayalam": "അല്ലെങ്കിൽ സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക...", "Odia": "କିମ୍ବା କହିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ..."
    },
    // === Wave 5: Microphone Input toasts ===
    "No speech detected": {
        "English": "No speech detected", "Hindi": "कोई आवाज़ नहीं मिली", "Kannada": "ಯಾವುದೇ ಧ್ವನಿ ಪತ್ತೆಯಾಗಿಲ್ಲ", "Tamil": "எந்த பேச்சும் கண்டறியப்படவில்லை", "Telugu": "ఏ ప్రసంగం గుర్తించబడలేదు", "Marathi": "कोणताही आवाज सापडला नाही", "Bengali": "কোনো কথা সনাক্ত হয়নি", "Gujarati": "કોઈ વાણી શોધાઈ નથી", "Punjabi": "ਕੋਈ ਆਵਾਜ਼ ਨਹੀਂ ਮਿਲੀ", "Malayalam": "സംസാരം കണ്ടെത്തിയില്ല", "Odia": "କୌଣସି ସ୍ୱର ଚିହ୍ନଟ ହୋଇନାହିଁ"
    },
    "Try holding the mic and speaking a bit longer.": {
        "English": "Try holding the mic and speaking a bit longer.", "Hindi": "माइक दबाकर रखें और थोड़ा अधिक बोलने का प्रयास करें।", "Kannada": "ಮೈಕ್ ಹಿಡಿದು ಸ್ವಲ್ಪ ಹೆಚ್ಚು ಸಮಯ ಮಾತನಾಡಲು ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "மைக்கைப் பிடித்துக் கொண்டு கொஞ்சம் அதிக நேரம் பேச முயற்சிக்கவும்.", "Telugu": "మైక్‌ని పట్టుకుని కొంచెం ఎక్కువ సేపు మాట్లాడడానికి ప్రయత్నించండి.", "Marathi": "माइक धरून थोडा अधिक वेळ बोलण्याचा प्रयत्न करा.", "Bengali": "মাইক ধরে রেখে একটু বেশি সময় কথা বলার চেষ্টা করুন।", "Gujarati": "માઇક પકડીને થોડો વધારે સમય બોલવાનો પ્રયાસ કરો.", "Punjabi": "ਮਾਈਕ ਨੂੰ ਦਬਾ ਕੇ ਰੱਖੋ ਅਤੇ ਥੋੜਾ ਜਿਆਦਾ ਬੋਲਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "മൈക്ക് പിടിച്ച് അൽപ്പം കൂടി സംസാരിക്കാൻ ശ്രമിക്കുക.", "Odia": "ମାଇକ୍ ଧରି ଟିକେ ଅଧିକ ସମୟ କହିବାକୁ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "No Speech Detected": {
        "English": "No Speech Detected", "Hindi": "कोई आवाज़ नहीं मिली", "Kannada": "ಯಾವುದೇ ಧ್ವನಿ ಪತ್ತೆಯಾಗಿಲ್ಲ", "Tamil": "எந்த பேச்சும் கண்டறியப்படவில்லை", "Telugu": "ఏ ప్రసంగం గుర్తించబడలేదు", "Marathi": "कोणताही आवाज सापडला नाही", "Bengali": "কোনো কথা সনাক্ত হয়নি", "Gujarati": "કોઈ વાણી શોધાઈ નથી", "Punjabi": "ਕੋਈ ਆਵਾਜ਼ ਨਹੀਂ ਮਿਲੀ", "Malayalam": "സംസാരം കണ്ടെത്തിയില്ല", "Odia": "କୌଣସି ସ୍ୱର ଚିହ୍ନଟ ହୋଇନାହିଁ"
    },
    "We couldn't hear you clearly.": {
        "English": "We couldn't hear you clearly.", "Hindi": "हम आपको स्पष्ट रूप से नहीं सुन सके।", "Kannada": "ನಿಮ್ಮನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಲು ನಮಗೆ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "உங்களை தெளிவாகக் கேட்க முடியவில்லை.", "Telugu": "మిమ్మల్ని స్పష్టంగా వినలేకపోయాము.", "Marathi": "आम्ही तुम्हाला स्पष्टपणे ऐकू शकलो नाही.", "Bengali": "আমরা আপনাকে স্পষ্টভাবে শুনতে পাইনি।", "Gujarati": "અમે તમને સ્પષ્ટ રીતે સાંભળી શકતા નથી.", "Punjabi": "ਅਸੀਂ ਤੁਹਾਨੂੰ ਸਪਸ਼ਟ ਤੌਰ 'ਤੇ ਸੁਣ ਨਹੀਂ ਸਕੇ।", "Malayalam": "നിങ്ങളെ വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല.", "Odia": "ଆମେ ଆପଣଙ୍କୁ ସ୍ପଷ୍ଟ ଭାବେ ଶୁଣିପାରିଲୁ ନାହିଁ।"
    },
    "We didn't catch any audio — please try again.": {
        "English": "We didn't catch any audio — please try again.", "Hindi": "हमें कोई ऑडियो नहीं मिला — कृपया पुनः प्रयास करें।", "Kannada": "ನಮಗೆ ಯಾವುದೇ ಆಡಿಯೊ ಸಿಗಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "எங்களுக்கு எந்த ஆடியோவும் கிடைக்கவில்லை — மீண்டும் முயற்சிக்கவும்.", "Telugu": "మాకు ఏ ఆడియో అందలేదు — దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "आम्हाला कोणताही ऑडिओ मिळाला नाही — कृपया पुन्हा प्रयत्न करा.", "Bengali": "আমরা কোনো অডিও পাইনি — অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "અમને કોઈ ઓડિયો મળ્યો નથી — કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਸਾਨੂੰ ਕੋਈ ਆਡੀਓ ਨਹੀਂ ਮਿਲਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഞങ്ങൾക്ക് ഓഡിയോ ലഭിച്ചില്ല — ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଆମେ କୌଣସି ଅଡିଓ ପାଇଲୁ ନାହିଁ — ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Failed to transcribe audio. Please try again.": {
        "English": "Failed to transcribe audio. Please try again.", "Hindi": "ऑडियो को टेक्स्ट में बदलने में विफल। कृपया पुनः प्रयास करें।", "Kannada": "ಆಡಿಯೊವನ್ನು ಪಠ್ಯಕ್ಕೆ ಪರಿವರ್ತಿಸಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ஆடியோவை உரையாக மாற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఆడియోను లిప్యంతరీకరించడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "ऑडिओ लिप्यंतरण करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "অডিও ট্রান্সক্রাইব করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "ઓડિયો ટ્રાન્સક્રાઇબ કરવામાં નિષ્ફળ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਆਡੀਓ ਨੂੰ ਟ੍ਰਾਂਸਕ੍ਰਾਈਬ ਕਰਨ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഓഡിയോ ട്രാൻസ്ക്രൈബ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଅଡିଓକୁ ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରିବାରେ ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Microphone Access Denied": {
        "English": "Microphone Access Denied", "Hindi": "माइक्रोफ़ोन एक्सेस अस्वीकृत", "Kannada": "ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ", "Tamil": "மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது", "Telugu": "మైక్రోఫోన్ యాక్సెస్ నిరాకరించబడింది", "Marathi": "मायक्रोफोन प्रवेश नाकारला", "Bengali": "মাইক্রোফোন অ্যাক্সেস অস্বীকৃত", "Gujarati": "માઇક્રોફોન ઍક્સેસ નકારી", "Punjabi": "ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਅਸਵੀਕਾਰ", "Malayalam": "മൈക്രോഫോൺ ആക്സസ് നിരസിച്ചു", "Odia": "ମାଇକ୍ରୋଫୋନ୍ ପ୍ରବେଶ ପ୍ରତ୍ୟାଖ୍ୟାନ"
    },
    "Please allow microphone access in your browser settings.": {
        "English": "Please allow microphone access in your browser settings.", "Hindi": "कृपया अपनी ब्राउज़र सेटिंग्स में माइक्रोफ़ोन एक्सेस की अनुमति दें।", "Kannada": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶವನ್ನು ಅನುಮತಿಸಿ.", "Tamil": "உங்கள் உலாவி அமைப்புகளில் மைக்ரோஃபோன் அணுகலை அனுமதிக்கவும்.", "Telugu": "దయచేసి మీ బ్రౌజర్ సెట్టింగ్‌లలో మైక్రోఫోన్ యాక్సెస్‌ను అనుమతించండి.", "Marathi": "कृपया तुमच्या ब्राउझर सेटिंग्जमध्ये मायक्रोफोन प्रवेशास परवानगी द्या.", "Bengali": "অনুগ্রহ করে আপনার ব্রাউজার সেটিংসে মাইক্রোফোন অ্যাক্সেসের অনুমতি দিন।", "Gujarati": "કૃપા કરી તમારી બ્રાઉઝર સેટિંગ્સમાં માઇક્રોફોન ઍક્સેસને મંજૂરી આપો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਬ੍ਰਾਊਜ਼ਰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਦੀ ਆਗਿਆ ਦਿਓ।", "Malayalam": "ദയവായി നിങ്ങളുടെ ബ്രൗസർ ക്രമീകരണങ്ങളിൽ മൈക്രോഫോൺ ആക്സസ് അനുവദിക്കുക.", "Odia": "ଦୟାକରି ଆପଣଙ୍କ ବ୍ରାଉଜର୍ ସେଟିଂରେ ମାଇକ୍ରୋଫୋନ୍ ପ୍ରବେଶକୁ ଅନୁମତି ଦିଅନ୍ତୁ।"
    },
    // === Wave 4: Submit Content + Review Panel ===
    "Submit Content": {
        "English": "Submit Content", "Hindi": "सामग्री जमा करें", "Kannada": "ವಿಷಯವನ್ನು ಸಲ್ಲಿಸಿ", "Tamil": "உள்ளடக்கத்தைச் சமர்ப்பி", "Telugu": "కంటెంట్ సమర్పించండి", "Marathi": "सामग्री सबमिट करा", "Bengali": "কনটেন্ট জমা দিন", "Gujarati": "સામગ્રી સબમિટ કરો", "Punjabi": "ਸਮੱਗਰੀ ਜਮ੍ਹਾਂ ਕਰੋ", "Malayalam": "ഉള്ളടക്കം സമർപ്പിക്കുക", "Odia": "ବିଷୟବସ୍ତୁ ଦାଖଲ କରନ୍ତୁ"
    },
    "This feature is coming soon. Submit your own content to the community library.": {
        "English": "This feature is coming soon. Submit your own content to the community library.", "Hindi": "यह सुविधा जल्द ही आ रही है। समुदाय पुस्तकालय में अपनी सामग्री जमा करें।", "Kannada": "ಈ ವೈಶಿಷ್ಟ್ಯ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ. ಸಮುದಾಯ ಗ್ರಂಥಾಲಯಕ್ಕೆ ನಿಮ್ಮ ಸ್ವಂತ ವಿಷಯವನ್ನು ಸಲ್ಲಿಸಿ.", "Tamil": "இந்த அம்சம் விரைவில் வருகிறது. சமூக நூலகத்திற்கு உங்கள் சொந்த உள்ளடக்கத்தைச் சமர்ப்பிக்கவும்.", "Telugu": "ఈ ఫీచర్ త్వరలో రాబోతుంది. కమ్యూనిటీ లైబ్రరీకి మీ స్వంత కంటెంట్‌ను సమర్పించండి.", "Marathi": "हे वैशिष्ट्य लवकरच येत आहे. समुदाय लायब्ररीत तुमची स्वतःची सामग्री सबमिट करा.", "Bengali": "এই বৈশিষ্ট্য শীঘ্রই আসছে। সম্প্রদায় লাইব্রেরিতে আপনার নিজের কনটেন্ট জমা দিন।", "Gujarati": "આ સુવિધા જલ્દી આવી રહી છે. સમુદાય લાઇબ્રેરીમાં તમારી પોતાની સામગ્રી સબમિટ કરો.", "Punjabi": "ਇਹ ਵਿਸ਼ੇਸ਼ਤਾ ਜਲਦੀ ਆ ਰਹੀ ਹੈ। ਭਾਈਚਾਰਕ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਆਪਣੀ ਸਮੱਗਰੀ ਜਮ੍ਹਾਂ ਕਰੋ।", "Malayalam": "ഈ ഫീച്ചർ ഉടനെ വരുന്നു. കമ്മ്യൂണിറ്റി ലൈബ്രറിയിലേക്ക് നിങ്ങളുടെ സ്വന്തം ഉള്ളടക്കം സമർപ്പിക്കുക.", "Odia": "ଏହି ବୈଶିଷ୍ଟ୍ୟ ଶୀଘ୍ର ଆସୁଛି। ସମ୍ପ୍ରଦାୟ ଲାଇବ୍ରେରୀକୁ ଆପଣଙ୍କର ନିଜର ବିଷୟବସ୍ତୁ ଦାଖଲ କରନ୍ତୁ।"
    },
    "Stay tuned!": {
        "English": "Stay tuned!", "Hindi": "बने रहें!", "Kannada": "ಜೊತೆಗಿರಿ!", "Tamil": "தொடர்ந்து இருங்கள்!", "Telugu": "వేచి ఉండండి!", "Marathi": "थांबा!", "Bengali": "অপেক্ষা করুন!", "Gujarati": "જોડાયેલા રહો!", "Punjabi": "ਜੁੜੇ ਰਹੋ!", "Malayalam": "കാത്തിരിക്കുക!", "Odia": "ସଂଯୁକ୍ତ ରୁହନ୍ତୁ!"
    },
    "Review Panel": {
        "English": "Review Panel", "Hindi": "समीक्षा पैनल", "Kannada": "ವಿಮರ್ಶೆ ಪ್ಯಾನೆಲ್", "Tamil": "மறுபரிசீலனை குழு", "Telugu": "సమీక్షా ప్యానెల్", "Marathi": "पुनरावलोकन पॅनेल", "Bengali": "পর্যালোচনা প্যানেল", "Gujarati": "સમીક્ષા પેનલ", "Punjabi": "ਸਮੀਖਿਆ ਪੈਨਲ", "Malayalam": "അവലോകന പാനൽ", "Odia": "ସମୀକ୍ଷା ପ୍ୟାନେଲ୍"
    },
    "This feature is coming soon. (Admin-only) Review community-submitted content.": {
        "English": "This feature is coming soon. (Admin-only) Review community-submitted content.", "Hindi": "यह सुविधा जल्द ही आ रही है। (केवल व्यवस्थापक) समुदाय द्वारा प्रस्तुत सामग्री की समीक्षा करें।", "Kannada": "ಈ ವೈಶಿಷ್ಟ್ಯ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ. (ನಿರ್ವಾಹಕ ಮಾತ್ರ) ಸಮುದಾಯ ಸಲ್ಲಿಸಿದ ವಿಷಯವನ್ನು ಪರಿಶೀಲಿಸಿ.", "Tamil": "இந்த அம்சம் விரைவில் வருகிறது. (நிர்வாகி மட்டும்) சமூகம் சமர்ப்பித்த உள்ளடக்கத்தை மறுபரிசீலனை செய்யவும்.", "Telugu": "ఈ ఫీచర్ త్వరలో రాబోతుంది. (అడ్మిన్-మాత్రమే) సంఘం సమర్పించిన కంటెంట్‌ను సమీక్షించండి.", "Marathi": "हे वैशिष्ट्य लवकरच येत आहे. (फक्त प्रशासक) समुदायाने सबमिट केलेल्या सामग्रीचे पुनरावलोकन करा.", "Bengali": "এই বৈশিষ্ট্য শীঘ্রই আসছে। (শুধুমাত্র অ্যাডমিন) সম্প্রদায়-জমা দেওয়া কনটেন্ট পর্যালোচনা করুন।", "Gujarati": "આ સુવિધા જલ્દી આવી રહી છે. (ફક્ત એડમિન) સમુદાય દ્વારા સબમિટ કરેલી સામગ્રીની સમીક્ષા કરો.", "Punjabi": "ਇਹ ਵਿਸ਼ੇਸ਼ਤਾ ਜਲਦੀ ਆ ਰਹੀ ਹੈ। (ਸਿਰਫ ਐਡਮਿਨ) ਭਾਈਚਾਰੇ ਦੁਆਰਾ ਜਮ੍ਹਾਂ ਕੀਤੀ ਸਮੱਗਰੀ ਦੀ ਸਮੀਖਿਆ ਕਰੋ।", "Malayalam": "ഈ ഫീച്ചർ ഉടനെ വരുന്നു. (അഡ്മിൻ-മാത്രം) കമ്മ്യൂണിറ്റി-സമർപ്പിച്ച ഉള്ളടക്കം അവലോകനം ചെയ്യുക.", "Odia": "ଏହି ବୈଶିଷ୍ଟ୍ୟ ଶୀଘ୍ର ଆସୁଛି। (ଶୁଦ୍ଧ-ଆଡମିନ୍) ସମ୍ପ୍ରଦାୟ-ଦାଖଲ ବିଷୟବସ୍ତୁ ସମୀକ୍ଷା କରନ୍ତୁ।"
    },
    // === Wave 4: Content Creator ===
    "Content Creator Studio": {
        "English": "Content Creator Studio", "Hindi": "सामग्री निर्माता स्टूडियो", "Kannada": "ವಿಷಯ ರಚಿಸುವವರ ಸ್ಟುಡಿಯೋ", "Tamil": "உள்ளடக்க உருவாக்குநர் ஸ்டுடியோ", "Telugu": "కంటెంట్ క్రియేటర్ స్టూడియో", "Marathi": "सामग्री निर्माता स्टुडिओ", "Bengali": "কনটেন্ট ক্রিয়েটর স্টুডিও", "Gujarati": "સામગ્રી નિર્માતા સ્ટુડિયો", "Punjabi": "ਸਮੱਗਰੀ ਨਿਰਮਾਤਾ ਸਟੂਡੀਓ", "Malayalam": "ഉള്ളടക്ക സ്രഷ്ടാവ് സ്റ്റുഡിയോ", "Odia": "ବିଷୟବସ୍ତୁ ସ୍ରଷ୍ଟା ଷ୍ଟୁଡିଓ"
    },
    "Tools to help you create engaging multimedia content for your classroom.": {
        "English": "Tools to help you create engaging multimedia content for your classroom.", "Hindi": "अपनी कक्षा के लिए आकर्षक मल्टीमीडिया सामग्री बनाने में मदद करने वाले उपकरण।", "Kannada": "ನಿಮ್ಮ ತರಗತಿಗಾಗಿ ಆಕರ್ಷಕ ಮಲ್ಟಿಮೀಡಿಯಾ ವಿಷಯವನ್ನು ರಚಿಸಲು ಸಹಾಯ ಮಾಡುವ ಸಾಧನಗಳು.", "Tamil": "உங்கள் வகுப்பறைக்கான ஈர்க்கும் மல்டிமீடியா உள்ளடக்கத்தை உருவாக்க உதவும் கருவிகள்.", "Telugu": "మీ తరగతి గది కోసం ఆకర్షణీయమైన మల్టీమీడియా కంటెంట్‌ను సృష్టించడంలో సహాయపడే సాధనాలు.", "Marathi": "तुमच्या वर्गासाठी आकर्षक मल्टिमीडिया सामग्री तयार करण्यात मदत करणारी साधने.", "Bengali": "আপনার শ্রেণীকক্ষের জন্য আকর্ষক মাল্টিমিডিয়া কনটেন্ট তৈরি করতে সাহায্য করার সরঞ্জাম।", "Gujarati": "તમારા વર્ગખંડ માટે આકર્ષક મલ્ટિમીડિયા સામગ્રી બનાવવામાં મદદ કરતા સાધનો.", "Punjabi": "ਤੁਹਾਡੀ ਜਮਾਤ ਲਈ ਆਕਰਸ਼ਕ ਮਲਟੀਮੀਡੀਆ ਸਮੱਗਰੀ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਨ ਵਾਲੇ ਟੂਲ।", "Malayalam": "നിങ്ങളുടെ ക്ലാസ്മുറിക്കായി ആകർഷകമായ മൾട്ടിമീഡിയ ഉള്ളടക്കം സൃഷ്ടിക്കാൻ സഹായിക്കുന്ന ഉപകരണങ്ങൾ.", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀଗୃହ ପାଇଁ ଆକର୍ଷଣୀୟ ମଲ୍ଟିମିଡିଆ ବିଷୟବସ୍ତୁ ସୃଷ୍ଟି କରିବାରେ ସାହାଯ୍ୟ କରୁଥିବା ଉପକରଣ।"
    },
    "Create simple line drawings and diagrams for your lessons.": {
        "English": "Create simple line drawings and diagrams for your lessons.", "Hindi": "अपने पाठों के लिए सरल रेखा चित्र और आरेख बनाएं।", "Kannada": "ನಿಮ್ಮ ಪಾಠಗಳಿಗಾಗಿ ಸರಳ ರೇಖೆ ರೇಖಾಚಿತ್ರಗಳು ಮತ್ತು ರೇಖಾಚಿತ್ರಗಳನ್ನು ರಚಿಸಿ.", "Tamil": "உங்கள் பாடங்களுக்கான எளிய கோடு வரைபடங்கள் மற்றும் வரைபடங்களை உருவாக்கவும்.", "Telugu": "మీ పాఠాల కోసం సరళమైన లైన్ డ్రాయింగ్‌లు మరియు రేఖాచిత్రాలను సృష్టించండి.", "Marathi": "तुमच्या पाठांसाठी साधी रेखांकन आणि आकृत्या तयार करा.", "Bengali": "আপনার পাঠের জন্য সাধারণ লাইন আঁকার এবং চিত্র তৈরি করুন।", "Gujarati": "તમારા પાઠ માટે સરળ રેખા ચિત્રો અને આકૃતિઓ બનાવો.", "Punjabi": "ਆਪਣੇ ਪਾਠਾਂ ਲਈ ਸਧਾਰਨ ਲਾਈਨ ਚਿੱਤਰ ਅਤੇ ਡਾਇਗ੍ਰਾਮ ਬਣਾਓ।", "Malayalam": "നിങ്ങളുടെ പാഠങ്ങൾക്കായി ലളിതമായ ലൈൻ ഡ്രോയിംഗുകളും ഡയഗ്രമുകളും സൃഷ്ടിക്കുക.", "Odia": "ଆପଣଙ୍କ ପାଠ ପାଇଁ ସରଳ ରେଖା ଚିତ୍ର ଏବଂ ଚାର୍ଟ ସୃଷ୍ଟି କରନ୍ତୁ।"
    },
    "Create Visuals": {
        "English": "Create Visuals", "Hindi": "दृश्य बनाएं", "Kannada": "ದೃಶ್ಯಗಳನ್ನು ರಚಿಸಿ", "Tamil": "காட்சிகளை உருவாக்கு", "Telugu": "విజువల్స్ సృష్టించండి", "Marathi": "दृश्ये तयार करा", "Bengali": "ভিজ্যুয়াল তৈরি করুন", "Gujarati": "વિઝ્યુઅલ બનાવો", "Punjabi": "ਵਿਜ਼ੂਅਲ ਬਣਾਓ", "Malayalam": "വിഷ്വലുകൾ സൃഷ്ടിക്കുക", "Odia": "ଭିଜୁଆଲ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Plan exciting virtual tours using Google Earth.": {
        "English": "Plan exciting virtual tours using Google Earth.", "Hindi": "Google Earth का उपयोग करके रोमांचक वर्चुअल टूर की योजना बनाएं।", "Kannada": "Google Earth ಬಳಸಿ ರೋಮಾಂಚಕ ವರ್ಚುವಲ್ ಪ್ರವಾಸಗಳನ್ನು ಯೋಜಿಸಿ.", "Tamil": "Google Earth பயன்படுத்தி உற்சாகமான மெய்நிகர் சுற்றுப்பயணங்களைத் திட்டமிடவும்.", "Telugu": "Google Earth ఉపయోగించి ఉత్తేజకరమైన వర్చువల్ టూర్‌లను ప్లాన్ చేయండి.", "Marathi": "Google Earth वापरून रोमांचक आभासी टूरचे नियोजन करा.", "Bengali": "Google Earth ব্যবহার করে আকর্ষণীয় ভার্চুয়াল ট্যুর পরিকল্পনা করুন।", "Gujarati": "Google Earth નો ઉપયોગ કરીને રોમાંચક વર્ચ્યુઅલ ટૂરનું આયોજન કરો.", "Punjabi": "Google Earth ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਦਿਲਚਸਪ ਵਰਚੁਅਲ ਟੂਰ ਦੀ ਯੋਜਨਾ ਬਣਾਓ।", "Malayalam": "Google Earth ഉപയോഗിച്ച് ആവേശകരമായ വെർച്വൽ ടൂറുകൾ ആസൂത്രണം ചെയ്യുക.", "Odia": "Google Earth ବ୍ୟବହାର କରି ଉତ୍ସାହଜନକ ଭର୍ଚୁଆଲ୍ ଭ୍ରମଣ ଯୋଜନା କରନ୍ତୁ।"
    },
    "Plan Trip": {
        "English": "Plan Trip", "Hindi": "यात्रा की योजना बनाएं", "Kannada": "ಪ್ರವಾಸವನ್ನು ಯೋಜಿಸಿ", "Tamil": "பயணத்தைத் திட்டமிடு", "Telugu": "ట్రిప్ ప్లాన్ చేయండి", "Marathi": "सहल नियोजन करा", "Bengali": "ট্যুর পরিকল্পনা করুন", "Gujarati": "ટ્રીપનું આયોજન કરો", "Punjabi": "ਯਾਤਰਾ ਦੀ ਯੋਜਨਾ ਬਣਾਓ", "Malayalam": "യാത്ര ആസൂത്രണം ചെയ്യുക", "Odia": "ଭ୍ରମଣ ଯୋଜନା କରନ୍ତୁ"
    },
    "Discover curated educational videos for your lessons.": {
        "English": "Discover curated educational videos for your lessons.", "Hindi": "अपने पाठों के लिए क्यूरेटेड शैक्षिक वीडियो खोजें।", "Kannada": "ನಿಮ್ಮ ಪಾಠಗಳಿಗಾಗಿ ಆಯ್ಕೆಮಾಡಿದ ಶೈಕ್ಷಣಿಕ ವೀಡಿಯೊಗಳನ್ನು ಅನ್ವೇಷಿಸಿ.", "Tamil": "உங்கள் பாடங்களுக்கான திட்டமிடப்பட்ட கல்வி வீடியோக்களைக் கண்டறியவும்.", "Telugu": "మీ పాఠాల కోసం క్యూరేటెడ్ విద్యా వీడియోలను కనుగొనండి.", "Marathi": "तुमच्या पाठांसाठी क्युरेटेड शैक्षणिक व्हिडिओ शोधा.", "Bengali": "আপনার পাঠের জন্য নির্বাচিত শিক্ষামূলক ভিডিও আবিষ্কার করুন।", "Gujarati": "તમારા પાઠ માટે ક્યુરેટેડ શૈક્ષણિક વિડિઓઝ શોધો.", "Punjabi": "ਆਪਣੇ ਪਾਠਾਂ ਲਈ ਚੁਣੇ ਹੋਏ ਵਿਦਿਅਕ ਵੀਡੀਓ ਦੀ ਖੋਜ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ പാഠങ്ങൾക്കായി ക്യൂറേറ്റ് ചെയ്ത വിദ്യാഭ്യാസ വീഡിയോകൾ കണ്ടെത്തുക.", "Odia": "ଆପଣଙ୍କ ପାଠ ପାଇଁ କ୍ୟୁରେଟ୍ ହୋଇଥିବା ଶିକ୍ଷାଗତ ଭିଡିଓ ଖୋଜନ୍ତୁ।"
    },
    "Browse Videos": {
        "English": "Browse Videos", "Hindi": "वीडियो ब्राउज़ करें", "Kannada": "ವೀಡಿಯೊಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ", "Tamil": "வீடியோக்களை உலாவவும்", "Telugu": "వీడియోలను బ్రౌజ్ చేయండి", "Marathi": "व्हिडिओ ब्राउझ करा", "Bengali": "ভিডিও ব্রাউজ করুন", "Gujarati": "વિડિઓઝ બ્રાઉઝ કરો", "Punjabi": "ਵੀਡੀਓ ਬ੍ਰਾਊਜ਼ ਕਰੋ", "Malayalam": "വീഡിയോകൾ ബ്രൗസ് ചെയ്യുക", "Odia": "ଭିଡିଓ ବ୍ରାଉଜ୍ କରନ୍ତୁ"
    },
    // === Wave 4: Onboarding ===
    "Setup Failed": {
        "English": "Setup Failed", "Hindi": "सेटअप विफल", "Kannada": "ಸೆಟಪ್ ವಿಫಲವಾಗಿದೆ", "Tamil": "அமைப்பு தோல்வி", "Telugu": "సెటప్ విఫలమైంది", "Marathi": "सेटअप अयशस्वी", "Bengali": "সেটআপ ব্যর্থ", "Gujarati": "સેટઅપ નિષ્ફળ", "Punjabi": "ਸੈੱਟਅੱਪ ਅਸਫਲ", "Malayalam": "സജ്ജീകരണം പരാജയപ്പെട്ടു", "Odia": "ସେଟଅପ୍ ବିଫଳ"
    },
    "Could not save your profile. Please try again.": {
        "English": "Could not save your profile. Please try again.", "Hindi": "आपकी प्रोफ़ाइल सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "உங்கள் சுயவிவரத்தைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "మీ ప్రొఫైల్‌ను సేవ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "तुमचे प्रोफाइल जतन करता आले नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "আপনার প্রোফাইল সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "તમારી પ્રોફાઇલ સાચવી શકાઈ નથી. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਸੰਭਾਲੀ ਨਹੀਂ ਜਾ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଆପଣଙ୍କର ପ୍ରୋଫାଇଲ୍ ସଞ୍ଚୟ କରିହେଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Loading...": {
        "English": "Loading...", "Hindi": "लोड हो रहा है...", "Kannada": "ಲೋಡ್ ಆಗುತ್ತಿದೆ...", "Tamil": "ஏற்றுகிறது...", "Telugu": "లోడ్ అవుతోంది...", "Marathi": "लोड होत आहे...", "Bengali": "লোড হচ্ছে...", "Gujarati": "લોડ થઈ રહ્યું છે...", "Punjabi": "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "ലോഡ് ചെയ്യുന്നു...", "Odia": "ଲୋଡ୍ ହେଉଛି..."
    },
    "Enter a topic...": {
        "English": "Enter a topic...", "Hindi": "एक विषय दर्ज करें...", "Kannada": "ವಿಷಯವನ್ನು ನಮೂದಿಸಿ...", "Tamil": "ஒரு தலைப்பை உள்ளிடவும்...", "Telugu": "ఒక అంశాన్ని నమోదు చేయండి...", "Marathi": "विषय प्रविष्ट करा...", "Bengali": "একটি বিষয় লিখুন...", "Gujarati": "વિષય દાખલ કરો...", "Punjabi": "ਇੱਕ ਵਿਸ਼ਾ ਦਰਜ ਕਰੋ...", "Malayalam": "ഒരു വിഷയം നൽകുക...", "Odia": "ଏକ ବିଷୟ ପ୍ରବେଶ କରନ୍ତୁ..."
    },
    // === Wave 4: Teacher Analytics Dashboard ===
    "Unable to refresh — please try again.": {
        "English": "Unable to refresh — please try again.", "Hindi": "रिफ्रेश नहीं हो सका — कृपया पुनः प्रयास करें।", "Kannada": "ರಿಫ್ರೆಶ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "புதுப்பிக்க முடியவில்லை — மீண்டும் முயற்சிக்கவும்.", "Telugu": "రిఫ్రెష్ చేయలేకపోయాము — దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "रिफ्रेश करता आले नाही — कृपया पुन्हा प्रयत्न करा.", "Bengali": "রিফ্রেশ করা যায়নি — অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "રિફ્રેશ થઈ શકતું નથી — કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਰਿਫ੍ਰੈਸ਼ ਨਹੀਂ ਹੋ ਸਕਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "റിഫ്രെഷ് ചെയ്യാൻ കഴിഞ്ഞില്ല — ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରିଫ୍ରେସ୍ କରିହେଲା ନାହିଁ — ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Welcome to your Impact Dashboard": {
        "English": "Welcome to your Impact Dashboard", "Hindi": "अपने प्रभाव डैशबोर्ड में आपका स्वागत है", "Kannada": "ನಿಮ್ಮ ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಸುಸ್ವಾಗತ", "Tamil": "உங்கள் தாக்க டாஷ்போர்டுக்கு வரவேற்கிறோம்", "Telugu": "మీ ఇంపాక్ట్ డ్యాష్‌బోర్డ్‌కు స్వాగతం", "Marathi": "तुमच्या इम्पॅक्ट डॅशबोर्डमध्ये स्वागत आहे", "Bengali": "আপনার ইমপ্যাক্ট ড্যাশবোর্ডে স্বাগতম", "Gujarati": "તમારા ઇમ્પેક્ટ ડેશબોર્ડમાં સ્વાગત છે", "Punjabi": "ਤੁਹਾਡੇ ਪ੍ਰਭਾਵ ਡੈਸ਼ਬੋਰਡ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ", "Malayalam": "നിങ്ങളുടെ ഇംപാക്റ്റ് ഡാഷ്‌ബോർഡിലേക്ക് സ്വാഗതം", "Odia": "ଆପଣଙ୍କ ଇମ୍ପ୍ୟାକ୍ଟ ଡ୍ୟାସବୋର୍ଡକୁ ସ୍ୱାଗତ"
    },
    "Couldn't load your impact": {
        "English": "Couldn't load your impact", "Hindi": "आपका प्रभाव लोड नहीं हो सका", "Kannada": "ನಿಮ್ಮ ಪ್ರಭಾವವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "உங்கள் தாக்கத்தை ஏற்ற முடியவில்லை", "Telugu": "మీ ఇంపాక్ట్‌ను లోడ్ చేయలేకపోయాము", "Marathi": "तुमचा प्रभाव लोड करता आला नाही", "Bengali": "আপনার প্রভাব লোড করা যায়নি", "Gujarati": "તમારી અસર લોડ થઈ શકી નથી", "Punjabi": "ਤੁਹਾਡਾ ਪ੍ਰਭਾਵ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ", "Malayalam": "നിങ്ങളുടെ ഇംപാക്റ്റ് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ଆପଣଙ୍କ ପ୍ରଭାବ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ"
    },
    "Retry": {
        "English": "Retry", "Hindi": "पुनः प्रयास करें", "Kannada": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "Tamil": "மீண்டும் முயற்சி", "Telugu": "మళ్లీ ప్రయత్నించండి", "Marathi": "पुन्हा प्रयत्न करा", "Bengali": "পুনরায় চেষ্টা করুন", "Gujarati": "ફરી પ્રયાસ કરો", "Punjabi": "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ", "Malayalam": "വീണ്ടും ശ്രമിക്കുക", "Odia": "ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ"
    },
    "Your Teaching Impact Score": {
        "English": "Your Teaching Impact Score", "Hindi": "आपका शिक्षण प्रभाव स्कोर", "Kannada": "ನಿಮ್ಮ ಬೋಧನಾ ಪ್ರಭಾವ ಸ್ಕೋರ್", "Tamil": "உங்கள் கற்பித்தல் தாக்க மதிப்பெண்", "Telugu": "మీ బోధనా ఇంపాక్ట్ స్కోర్", "Marathi": "तुमचा अध्यापन प्रभाव स्कोअर", "Bengali": "আপনার শিক্ষাদানের প্রভাব স্কোর", "Gujarati": "તમારો અધ્યાપન અસર સ્કોર", "Punjabi": "ਤੁਹਾਡਾ ਅਧਿਆਪਨ ਪ੍ਰਭਾਵ ਸਕੋਰ", "Malayalam": "നിങ്ങളുടെ അധ്യാപന ഇംപാക്റ്റ് സ്കോർ", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷାଦାନ ପ୍ରଭାବ ସ୍କୋର"
    },
    "Refresh impact score": {
        "English": "Refresh impact score", "Hindi": "प्रभाव स्कोर रिफ्रेश करें", "Kannada": "ಪ್ರಭಾವ ಸ್ಕೋರ್ ರಿಫ್ರೆಶ್ ಮಾಡಿ", "Tamil": "தாக்க மதிப்பெண்ணைப் புதுப்பி", "Telugu": "ఇంపాక్ట్ స్కోర్‌ను రిఫ్రెష్ చేయండి", "Marathi": "प्रभाव स्कोअर रिफ्रेश करा", "Bengali": "প্রভাব স্কোর রিফ্রেশ করুন", "Gujarati": "અસર સ્કોર રિફ્રેશ કરો", "Punjabi": "ਪ੍ਰਭਾਵ ਸਕੋਰ ਨੂੰ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ", "Malayalam": "ഇംപാക്റ്റ് സ്കോർ റിഫ്രെഷ് ചെയ്യുക", "Odia": "ପ୍ରଭାବ ସ୍କୋର୍ ରିଫ୍ରେସ୍ କରନ୍ତୁ"
    },
    // === Wave 4: Content Gallery (My Library) ===
    "Could not load library. Please try again.": {
        "English": "Could not load library. Please try again.", "Hindi": "लाइब्रेरी लोड नहीं हो सकी। कृपया पुनः प्रयास करें।", "Kannada": "ಗ್ರಂಥಾಲಯವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "நூலகத்தை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "లైబ్రరీని లోడ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "लायब्ररी लोड करता आली नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "লাইব্রেরি লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "લાઈબ્રેરી લોડ થઈ શકી નથી. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਲਾਇਬ੍ਰੇਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ലൈബ്രറി ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଲାଇବ୍ରେରୀ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Deleted": {
        "English": "Deleted", "Hindi": "हटाया गया", "Kannada": "ಅಳಿಸಲಾಗಿದೆ", "Tamil": "நீக்கப்பட்டது", "Telugu": "తొలగించబడింది", "Marathi": "हटवले", "Bengali": "মুছে ফেলা হয়েছে", "Gujarati": "ડિલીટ થયું", "Punjabi": "ਮਿਟਾਇਆ ਗਿਆ", "Malayalam": "ഇല്ലാതാക്കി", "Odia": "ବିଲୋପ ହୋଇଛି"
    },
    "removed from your library.": {
        "English": "removed from your library.", "Hindi": "आपकी लाइब्रेरी से हटा दिया गया।", "Kannada": "ನಿಮ್ಮ ಗ್ರಂಥಾಲಯದಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ.", "Tamil": "உங்கள் நூலகத்திலிருந்து அகற்றப்பட்டது.", "Telugu": "మీ లైబ్రరీ నుండి తీసివేయబడింది.", "Marathi": "तुमच्या लायब्ररीतून काढले.", "Bengali": "আপনার লাইব্রেরি থেকে সরানো হয়েছে।", "Gujarati": "તમારી લાઈબ્રેરીમાંથી દૂર કર્યું.", "Punjabi": "ਤੁਹਾਡੀ ਲਾਇਬ੍ਰੇਰੀ ਤੋਂ ਹਟਾਇਆ ਗਿਆ।", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറിയിൽ നിന്ന് നീക്കം ചെയ്തു.", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀରୁ ହଟାଯାଇଛି।"
    },
    "Delete Failed": {
        "English": "Delete Failed", "Hindi": "हटाना विफल", "Kannada": "ಅಳಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ", "Tamil": "நீக்க முடியவில்லை", "Telugu": "తొలగింపు విఫలమైంది", "Marathi": "हटवणे अयशस्वी", "Bengali": "মুছে ফেলা ব্যর্থ", "Gujarati": "ડિલીટ નિષ્ફળ", "Punjabi": "ਮਿਟਾਉਣਾ ਅਸਫਲ", "Malayalam": "ഇല്ലാതാക്കൽ പരാജയപ്പെട്ടു", "Odia": "ବିଲୋପ ବିଫଳ"
    },
    "Could not delete item.": {
        "English": "Could not delete item.", "Hindi": "आइटम हटाया नहीं जा सका।", "Kannada": "ಐಟಂ ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "உருப்படியை நீக்க முடியவில்லை.", "Telugu": "అంశాన్ని తొలగించలేకపోయాము.", "Marathi": "आयटम हटवता आला नाही.", "Bengali": "আইটেম মুছে ফেলা যায়নি।", "Gujarati": "આઇટમ ડિલીટ કરી શકાયું નથી.", "Punjabi": "ਆਈਟਮ ਮਿਟਾਇਆ ਨਹੀਂ ਜਾ ਸਕਿਆ।", "Malayalam": "ഇനം ഇല്ലാതാക്കാൻ കഴിഞ്ഞില്ല.", "Odia": "ବସ୍ତୁ ବିଲୋପ କରିହେଲା ନାହିଁ।"
    },
    "Cannot open this item": {
        "English": "Cannot open this item", "Hindi": "इस आइटम को नहीं खोल सकते", "Kannada": "ಈ ಐಟಂ ಅನ್ನು ತೆರೆಯಲು ಸಾಧ್ಯವಿಲ್ಲ", "Tamil": "இந்த உருப்படியைத் திறக்க முடியாது", "Telugu": "ఈ అంశాన్ని తెరవలేరు", "Marathi": "हा आयटम उघडता येत नाही", "Bengali": "এই আইটেম খোলা যাবে না", "Gujarati": "આ આઇટમ ખોલી શકાતી નથી", "Punjabi": "ਇਸ ਆਈਟਮ ਨੂੰ ਖੋਲ੍ਹਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ", "Malayalam": "ഈ ഇനം തുറക്കാൻ കഴിയില്ല", "Odia": "ଏହି ବସ୍ତୁ ଖୋଲିହେବ ନାହିଁ"
    },
    "Resource type": {
        "English": "Resource type", "Hindi": "संसाधन प्रकार", "Kannada": "ಸಂಪನ್ಮೂಲ ಪ್ರಕಾರ", "Tamil": "வளம் வகை", "Telugu": "వనరు రకం", "Marathi": "संसाधन प्रकार", "Bengali": "সম্পদের ধরন", "Gujarati": "સંસાધન પ્રકાર", "Punjabi": "ਸਾਧਨ ਕਿਸਮ", "Malayalam": "റിസോഴ്സ് തരം", "Odia": "ସମ୍ବଳ ପ୍ରକାର"
    },
    "does not have a viewer yet. Use Download to export it.": {
        "English": "does not have a viewer yet. Use Download to export it.", "Hindi": "के पास अभी तक व्यूअर नहीं है। निर्यात के लिए डाउनलोड का उपयोग करें।", "Kannada": "ಗಾಗಿ ಇನ್ನೂ ವೀಕ್ಷಕವಿಲ್ಲ. ರಫ್ತು ಮಾಡಲು ಡೌನ್‌ಲೋಡ್ ಬಳಸಿ.", "Tamil": "க்கு இன்னும் காட்சியாளர் இல்லை. ஏற்றுமதி செய்ய பதிவிறக்கம் பயன்படுத்தவும்.", "Telugu": "కోసం ఇంకా వీక్షకుడు లేడు. ఎగుమతి చేయడానికి డౌన్‌లోడ్ ఉపయోగించండి.", "Marathi": "साठी अद्याप व्ह्यूअर नाही. निर्यात करण्यासाठी डाउनलोड वापरा.", "Bengali": "এর জন্য এখনও ভিউয়ার নেই। এক্সপোর্ট করতে ডাউনলোড ব্যবহার করুন।", "Gujarati": "માટે હજુ વ્યૂઅર નથી. નિકાસ માટે ડાઉનલોડ વાપરો.", "Punjabi": "ਲਈ ਅਜੇ ਤੱਕ ਦਰਸ਼ਕ ਨਹੀਂ ਹੈ। ਨਿਰਯਾਤ ਲਈ ਡਾਊਨਲੋਡ ਵਰਤੋ।", "Malayalam": "എന്നതിന് ഇതുവരെ വ്യൂവർ ഇല്ല. കയറ്റുമതി ചെയ്യാൻ ഡൗൺലോഡ് ഉപയോഗിക്കുക.", "Odia": "ପାଇଁ ଏପର୍ଯ୍ୟନ୍ତ ଭ୍ୟୁଅର୍ ନାହିଁ। ରପ୍ତାନି କରିବାକୁ ଡାଉନଲୋଡ୍ ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "Preparing PDF...": {
        "English": "Preparing PDF...", "Hindi": "PDF तैयार हो रहा है...", "Kannada": "PDF ತಯಾರಾಗುತ್ತಿದೆ...", "Tamil": "PDF தயாராகிறது...", "Telugu": "PDF సిద్ధమవుతోంది...", "Marathi": "PDF तयार होत आहे...", "Bengali": "PDF প্রস্তুত হচ্ছে...", "Gujarati": "PDF તૈયાર થઈ રહ્યું છે...", "Punjabi": "PDF ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "PDF തയ്യാറാക്കുന്നു...", "Odia": "PDF ପ୍ରସ୍ତୁତ ହେଉଛି..."
    },
    "Opening print dialog for": {
        "English": "Opening print dialog for", "Hindi": "के लिए प्रिंट डायलॉग खोल रहा है", "Kannada": "ಗಾಗಿ ಮುದ್ರಣ ಸಂವಾದವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ", "Tamil": "க்கு அச்சு உரையாடலைத் திறக்கிறது", "Telugu": "కోసం ప్రింట్ డైలాగ్ తెరుస్తోంది", "Marathi": "साठी प्रिंट डायलॉग उघडत आहे", "Bengali": "এর জন্য প্রিন্ট ডায়ালগ খোলা হচ্ছে", "Gujarati": "માટે પ્રિન્ટ ડાયલોગ ખોલી રહ્યું છે", "Punjabi": "ਲਈ ਪ੍ਰਿੰਟ ਡਾਇਲਾਗ ਖੁੱਲ੍ਹ ਰਿਹਾ ਹੈ", "Malayalam": "എന്നതിന് പ്രിന്റ് ഡയലോഗ് തുറക്കുന്നു", "Odia": "ପାଇଁ ପ୍ରିଣ୍ଟ୍ ଡାୟଲଗ୍ ଖୋଲୁଛି"
    },
    "Choose \"Save as PDF\" in the print menu.": {
        "English": "Choose \"Save as PDF\" in the print menu.", "Hindi": "प्रिंट मेनू में \"PDF के रूप में सहेजें\" चुनें।", "Kannada": "ಮುದ್ರಣ ಮೆನುವಿನಲ್ಲಿ \"PDF ಆಗಿ ಉಳಿಸಿ\" ಆಯ್ಕೆಮಾಡಿ.", "Tamil": "அச்சு மெனுவில் \"PDF ஆகச் சேமி\" தேர்வு செய்க.", "Telugu": "ప్రింట్ మెనులో \"PDFగా సేవ్ చేయి\" ఎంచుకోండి.", "Marathi": "प्रिंट मेनूमध्ये \"PDF म्हणून जतन करा\" निवडा.", "Bengali": "প্রিন্ট মেনুতে \"PDF হিসাবে সংরক্ষণ করুন\" বেছে নিন।", "Gujarati": "પ્રિન્ટ મેનુમાં \"PDF તરીકે સાચવો\" પસંદ કરો.", "Punjabi": "ਪ੍ਰਿੰਟ ਮੀਨੂੰ ਵਿੱਚ \"PDF ਵਜੋਂ ਸੰਭਾਲੋ\" ਚੁਣੋ।", "Malayalam": "പ്രിന്റ് മെനുവിൽ \"PDF ആയി സേവ് ചെയ്യുക\" തിരഞ്ഞെടുക്കുക.", "Odia": "ପ୍ରିଣ୍ଟ୍ ମେନୁରେ \"PDF ଭାବେ ସଞ୍ଚୟ କରନ୍ତୁ\" ବାଛନ୍ତୁ।"
    },
    "Popup blocked": {
        "English": "Popup blocked", "Hindi": "पॉपअप अवरुद्ध", "Kannada": "ಪಾಪ್‌ಅಪ್ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ", "Tamil": "பாப்அப் தடுக்கப்பட்டது", "Telugu": "పాపప్ నిరోధించబడింది", "Marathi": "पॉपअप ब्लॉक केले", "Bengali": "পপআপ ব্লক", "Gujarati": "પોપઅપ બ્લોક", "Punjabi": "ਪੌਪਅੱਪ ਬਲੌਕ", "Malayalam": "പോപ്പ്അപ്പ് തടഞ്ഞു", "Odia": "ପପଅପ୍ ବ୍ଲକ୍"
    },
    "Saved as HTML instead. Open the file and press Ctrl/Cmd+P to save as PDF.": {
        "English": "Saved as HTML instead. Open the file and press Ctrl/Cmd+P to save as PDF.", "Hindi": "HTML के रूप में सहेजा गया। फ़ाइल खोलें और PDF के रूप में सहेजने के लिए Ctrl/Cmd+P दबाएं।", "Kannada": "HTML ಆಗಿ ಉಳಿಸಲಾಗಿದೆ. ಫೈಲ್ ತೆರೆಯಿರಿ ಮತ್ತು PDF ಆಗಿ ಉಳಿಸಲು Ctrl/Cmd+P ಒತ್ತಿ.", "Tamil": "HTML ஆகச் சேமிக்கப்பட்டது. கோப்பைத் திறந்து PDF ஆகச் சேமிக்க Ctrl/Cmd+P அழுத்தவும்.", "Telugu": "HTMLగా సేవ్ చేయబడింది. ఫైల్ తెరిచి PDFగా సేవ్ చేయడానికి Ctrl/Cmd+P నొక్కండి.", "Marathi": "HTML म्हणून जतन केले. फाइल उघडा आणि PDF म्हणून जतन करण्यासाठी Ctrl/Cmd+P दाबा.", "Bengali": "HTML হিসাবে সংরক্ষিত। ফাইল খুলুন এবং PDF হিসাবে সংরক্ষণ করতে Ctrl/Cmd+P চাপুন।", "Gujarati": "HTML તરીકે સાચવ્યું. ફાઇલ ખોલો અને PDF તરીકે સાચવવા માટે Ctrl/Cmd+P દબાવો.", "Punjabi": "HTML ਵਜੋਂ ਸੰਭਾਲਿਆ। ਫਾਈਲ ਖੋਲ੍ਹੋ ਅਤੇ PDF ਵਜੋਂ ਸੰਭਾਲਣ ਲਈ Ctrl/Cmd+P ਦਬਾਓ।", "Malayalam": "HTML ആയി സേവ് ചെയ്തു. ഫയൽ തുറന്ന് PDF ആയി സേവ് ചെയ്യാൻ Ctrl/Cmd+P അമർത്തുക.", "Odia": "HTML ଭାବେ ସଞ୍ଚୟ ହୋଇଛି। ଫାଇଲ୍ ଖୋଲନ୍ତୁ ଏବଂ PDF ଭାବେ ସଞ୍ଚୟ କରିବାକୁ Ctrl/Cmd+P ଦବାନ୍ତୁ।"
    },
    "Download Started": {
        "English": "Download Started", "Hindi": "डाउनलोड शुरू", "Kannada": "ಡೌನ್‌ಲೋಡ್ ಪ್ರಾರಂಭವಾಗಿದೆ", "Tamil": "பதிவிறக்கம் தொடங்கியது", "Telugu": "డౌన్‌లోడ్ ప్రారంభమైంది", "Marathi": "डाउनलोड सुरू", "Bengali": "ডাউনলোড শুরু", "Gujarati": "ડાઉનલોડ શરૂ", "Punjabi": "ਡਾਊਨਲੋਡ ਸ਼ੁਰੂ", "Malayalam": "ഡൗൺലോഡ് ആരംഭിച്ചു", "Odia": "ଡାଉନଲୋଡ୍ ଆରମ୍ଭ"
    },
    "Fetching secure link for": {
        "English": "Fetching secure link for", "Hindi": "के लिए सुरक्षित लिंक प्राप्त किया जा रहा है", "Kannada": "ಗಾಗಿ ಸುರಕ್ಷಿತ ಲಿಂಕ್ ಪಡೆಯಲಾಗುತ್ತಿದೆ", "Tamil": "க்கு பாதுகாப்பான இணைப்பு பெறப்படுகிறது", "Telugu": "కోసం సురక్షిత లింక్‌ను పొందుతోంది", "Marathi": "साठी सुरक्षित दुवा मिळवत आहे", "Bengali": "এর জন্য সুরক্ষিত লিঙ্ক পাওয়া হচ্ছে", "Gujarati": "માટે સુરક્ષિત લિંક મેળવી રહ્યું છે", "Punjabi": "ਲਈ ਸੁਰੱਖਿਅਤ ਲਿੰਕ ਪ੍ਰਾਪਤ ਕਰ ਰਿਹਾ ਹੈ", "Malayalam": "എന്നതിന് സുരക്ഷിത ലിങ്ക് നേടുന്നു", "Odia": "ପାଇଁ ସୁରକ୍ଷିତ ଲିଙ୍କ୍ ଆଣୁଛି"
    },
    "content": {
        "English": "content", "Hindi": "सामग्री", "Kannada": "ವಿಷಯ", "Tamil": "உள்ளடக்கம்", "Telugu": "కంటెంట్", "Marathi": "सामग्री", "Bengali": "কনটেন্ট", "Gujarati": "સામગ્રી", "Punjabi": "ਸਮੱਗਰੀ", "Malayalam": "ഉള്ളടക്കം", "Odia": "ବିଷୟବସ୍ତୁ"
    },
    "Download Ready": {
        "English": "Download Ready", "Hindi": "डाउनलोड तैयार", "Kannada": "ಡೌನ್‌ಲೋಡ್ ಸಿದ್ಧ", "Tamil": "பதிவிறக்கம் தயார்", "Telugu": "డౌన్‌లోడ్ సిద్ధం", "Marathi": "डाउनलोड तयार", "Bengali": "ডাউনলোড প্রস্তুত", "Gujarati": "ડાઉનલોડ તૈયાર", "Punjabi": "ਡਾਊਨਲੋਡ ਤਿਆਰ", "Malayalam": "ഡൗൺലോഡ് തയ്യാർ", "Odia": "ଡାଉନଲୋଡ୍ ପ୍ରସ୍ତୁତ"
    },
    "Your file is downloading.": {
        "English": "Your file is downloading.", "Hindi": "आपकी फ़ाइल डाउनलोड हो रही है।", "Kannada": "ನಿಮ್ಮ ಫೈಲ್ ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ.", "Tamil": "உங்கள் கோப்பு பதிவிறக்கம் ஆகிறது.", "Telugu": "మీ ఫైల్ డౌన్‌లోడ్ అవుతోంది.", "Marathi": "तुमची फाइल डाउनलोड होत आहे.", "Bengali": "আপনার ফাইল ডাউনলোড হচ্ছে।", "Gujarati": "તમારી ફાઇલ ડાઉનલોડ થઈ રહી છે.", "Punjabi": "ਤੁਹਾਡੀ ਫਾਈਲ ਡਾਊਨਲੋਡ ਹੋ ਰਹੀ ਹੈ।", "Malayalam": "നിങ്ങളുടെ ഫയൽ ഡൗൺലോഡ് ചെയ്യുന്നു.", "Odia": "ଆପଣଙ୍କ ଫାଇଲ୍ ଡାଉନଲୋଡ୍ ହେଉଛି।"
    },
    "Download Failed": {
        "English": "Download Failed", "Hindi": "डाउनलोड विफल", "Kannada": "ಡೌನ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ", "Tamil": "பதிவிறக்கம் தோல்வி", "Telugu": "డౌన్‌లోడ్ విఫలమైంది", "Marathi": "डाउनलोड अयशस्वी", "Bengali": "ডাউনলোড ব্যর্থ", "Gujarati": "ડાઉનલોડ નિષ્ફળ", "Punjabi": "ਡਾਊਨਲੋਡ ਅਸਫਲ", "Malayalam": "ഡൗൺലോഡ് പരാജയപ്പെട്ടു", "Odia": "ଡାଉନଲୋଡ୍ ବିଫଳ"
    },
    "Failed to save": {
        "English": "Failed to save", "Hindi": "सहेजने में विफल", "Kannada": "ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "சேமிக்க முடியவில்லை", "Telugu": "సేవ్ చేయడంలో విఫలమైంది", "Marathi": "जतन करण्यात अयशस्वी", "Bengali": "সংরক্ষণ করতে ব্যর্থ", "Gujarati": "સાચવવામાં નિષ્ફળ", "Punjabi": "ਸੰਭਾਲਣ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ସଞ୍ଚୟ କରିବାରେ ବିଫଳ"
    },
    "Could not retrieve file.": {
        "English": "Could not retrieve file.", "Hindi": "फ़ाइल प्राप्त नहीं की जा सकी।", "Kannada": "ಫೈಲ್ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "கோப்பைப் பெற முடியவில்லை.", "Telugu": "ఫైల్‌ను తిరిగి పొందలేకపోయాము.", "Marathi": "फाइल मिळवता आली नाही.", "Bengali": "ফাইল পুনরুদ্ধার করা যায়নি।", "Gujarati": "ફાઇલ પુનઃપ્રાપ્ત કરી શકાઈ નથી.", "Punjabi": "ਫਾਈਲ ਪ੍ਰਾਪਤ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕੀ।", "Malayalam": "ഫയൽ വീണ്ടെടുക്കാൻ കഴിഞ്ഞില്ല.", "Odia": "ଫାଇଲ୍ ପୁନରୁଦ୍ଧାର କରିହେଲା ନାହିଁ।"
    },
    // === Wave 3: Attendance (grid + contact-parent-modal toasts) ===
    "Attendance saved": {
        "English": "Attendance saved", "Hindi": "उपस्थिति सहेजी गई", "Kannada": "ಹಾಜರಾತಿ ಉಳಿಸಲಾಗಿದೆ", "Tamil": "வருகை சேமிக்கப்பட்டது", "Telugu": "హాజరు సేవ్ చేయబడింది", "Marathi": "उपस्थिती जतन झाली", "Bengali": "উপস্থিতি সংরক্ষিত", "Gujarati": "હાજરી સાચવી", "Punjabi": "ਹਾਜ਼ਰੀ ਸੰਭਾਲੀ", "Malayalam": "ഹാജർ സേവ് ചെയ്തു", "Odia": "ଉପସ୍ଥିତି ସଞ୍ଚୟ ହୋଇଛି"
    },
    "Failed to generate": {
        "English": "Failed to generate", "Hindi": "उत्पन्न करने में विफल", "Kannada": "ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "உருவாக்க முடியவில்லை", "Telugu": "ఉత్పన్నం చేయడంలో విఫలమైంది", "Marathi": "तयार करण्यात अयशस्वी", "Bengali": "তৈরি করতে ব্যর্থ", "Gujarati": "બનાવવામાં નિષ્ફળ", "Punjabi": "ਤਿਆਰ ਕਰਨ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ସୃଷ୍ଟି କରିବାରେ ବିଫଳ"
    },
    "Call failed": {
        "English": "Call failed", "Hindi": "कॉल विफल", "Kannada": "ಕರೆ ವಿಫಲವಾಗಿದೆ", "Tamil": "அழைப்பு தோல்வி", "Telugu": "కాల్ విఫలమైంది", "Marathi": "कॉल अयशस्वी", "Bengali": "কল ব্যর্থ", "Gujarati": "કૉલ નિષ્ફળ", "Punjabi": "ਕਾਲ ਅਸਫਲ", "Malayalam": "കോൾ പരാജയപ്പെട്ടു", "Odia": "କଲ୍ ବିଫଳ"
    },
    "Copied to clipboard": {
        "English": "Copied to clipboard", "Hindi": "क्लिपबोर्ड पर कॉपी हुआ", "Kannada": "ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ", "Tamil": "கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது", "Telugu": "క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది", "Marathi": "क्लिपबोर्डवर कॉपी केले", "Bengali": "ক্লিপবোর্ডে কপি হয়েছে", "Gujarati": "ક્લિપબોર્ડ પર કૉપિ થયું", "Punjabi": "ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਕੀਤਾ", "Malayalam": "ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി", "Odia": "କ୍ଲିପବୋର୍ଡକୁ କପି ହୋଇଛି"
    },
    "Paste in WhatsApp to send.": {
        "English": "Paste in WhatsApp to send.", "Hindi": "भेजने के लिए WhatsApp में पेस्ट करें।", "Kannada": "ಕಳುಹಿಸಲು WhatsApp ನಲ್ಲಿ ಪೇಸ್ಟ್ ಮಾಡಿ.", "Tamil": "அனுப்ப WhatsApp இல் ஒட்டவும்.", "Telugu": "పంపడానికి WhatsAppలో పేస్ట్ చేయండి.", "Marathi": "पाठवण्यासाठी WhatsApp मध्ये पेस्ट करा.", "Bengali": "পাঠাতে WhatsApp এ পেস্ট করুন।", "Gujarati": "મોકલવા માટે WhatsApp માં પેસ્ટ કરો.", "Punjabi": "ਭੇਜਣ ਲਈ WhatsApp ਵਿੱਚ ਪੇਸਟ ਕਰੋ।", "Malayalam": "അയയ്ക്കാൻ WhatsApp-ൽ പേസ്റ്റ് ചെയ്യുക.", "Odia": "ପଠାଇବାକୁ WhatsApp ରେ ପେଷ୍ଟ କରନ୍ତୁ।"
    },
    // === Wave 3: Attendance subroutes (classId + marks) ===
    "Error loading class": {
        "English": "Error loading class", "Hindi": "कक्षा लोड करने में त्रुटि", "Kannada": "ತರಗತಿ ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ", "Tamil": "வகுப்பை ஏற்றுவதில் பிழை", "Telugu": "తరగతిని లోడ్ చేయడంలో లోపం", "Marathi": "वर्ग लोड करताना त्रुटी", "Bengali": "শ্রেণী লোড করতে ত্রুটি", "Gujarati": "વર્ગ લોડ કરવામાં ભૂલ", "Punjabi": "ਜਮਾਤ ਲੋਡ ਕਰਨ ਵਿੱਚ ਗਲਤੀ", "Malayalam": "ക്ലാസ് ലോഡ് ചെയ്യുന്നതിൽ പിശക്", "Odia": "ଶ୍ରେଣୀ ଲୋଡ୍ କରିବାରେ ତ୍ରୁଟି"
    },
    "Class not found": {
        "English": "Class not found", "Hindi": "कक्षा नहीं मिली", "Kannada": "ತರಗತಿ ಸಿಗಲಿಲ್ಲ", "Tamil": "வகுப்பு கிடைக்கவில்லை", "Telugu": "తరగతి కనుగొనబడలేదు", "Marathi": "वर्ग सापडला नाही", "Bengali": "শ্রেণী পাওয়া যায়নি", "Gujarati": "વર્ગ મળ્યો નથી", "Punjabi": "ਜਮਾਤ ਨਹੀਂ ਮਿਲੀ", "Malayalam": "ക്ലാസ് കണ്ടെത്തിയില്ല", "Odia": "ଶ୍ରେଣୀ ମିଳିଲା ନାହିଁ"
    },
    "This class does not exist or you do not have access.": {
        "English": "This class does not exist or you do not have access.", "Hindi": "यह कक्षा मौजूद नहीं है या आपके पास पहुंच नहीं है।", "Kannada": "ಈ ತರಗತಿ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ ಅಥವಾ ನಿಮಗೆ ಪ್ರವೇಶವಿಲ್ಲ.", "Tamil": "இந்த வகுப்பு இல்லை அல்லது உங்களுக்கு அணுகல் இல்லை.", "Telugu": "ఈ తరగతి ఉనికిలో లేదు లేదా మీకు ప్రాప్యత లేదు.", "Marathi": "हा वर्ग अस्तित्वात नाही किंवा तुम्हाला प्रवेश नाही.", "Bengali": "এই শ্রেণী বিদ্যমান নেই বা আপনার অ্যাক্সেস নেই।", "Gujarati": "આ વર્ગ અસ્તિત્વમાં નથી અથવા તમારી પાસે ઍક્સેસ નથી.", "Punjabi": "ਇਹ ਜਮਾਤ ਮੌਜੂਦ ਨਹੀਂ ਹੈ ਜਾਂ ਤੁਹਾਡੇ ਕੋਲ ਪਹੁੰਚ ਨਹੀਂ ਹੈ।", "Malayalam": "ഈ ക്ലാസ് നിലവിലില്ല അല്ലെങ്കിൽ നിങ്ങൾക്ക് ആക്സസ് ഇല്ല.", "Odia": "ଏହି ଶ୍ରେଣୀ ବିଦ୍ୟମାନ ନାହିଁ କିମ୍ବା ଆପଣଙ୍କର ପ୍ରବେଶ ନାହିଁ।"
    },
    "Assessment name is required": {
        "English": "Assessment name is required", "Hindi": "मूल्यांकन का नाम आवश्यक है", "Kannada": "ಮೌಲ್ಯಮಾಪನದ ಹೆಸರು ಅಗತ್ಯವಿದೆ", "Tamil": "மதிப்பீட்டின் பெயர் தேவை", "Telugu": "మూల్యాంకన పేరు అవసరం", "Marathi": "मूल्यांकनाचे नाव आवश्यक", "Bengali": "মূল্যায়নের নাম প্রয়োজন", "Gujarati": "મૂલ્યાંકનનું નામ જરૂરી છે", "Punjabi": "ਮੁਲਾਂਕਣ ਦਾ ਨਾਮ ਲੋੜੀਂਦਾ ਹੈ", "Malayalam": "വിലയിരുത്തലിന്റെ പേര് ആവശ്യമാണ്", "Odia": "ମୂଲ୍ୟାୟନ ନାମ ଆବଶ୍ୟକ"
    },
    "Please select a subject": {
        "English": "Please select a subject", "Hindi": "कृपया एक विषय चुनें", "Kannada": "ದಯವಿಟ್ಟು ವಿಷಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "தயவுசெய்து ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்", "Telugu": "దయచేసి ఒక విషయాన్ని ఎంచుకోండి", "Marathi": "कृपया विषय निवडा", "Bengali": "অনুগ্রহ করে একটি বিষয় নির্বাচন করুন", "Gujarati": "કૃપા કરી વિષય પસંદ કરો", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵਿਸ਼ਾ ਚੁਣੋ", "Malayalam": "ദയവായി ഒരു വിഷയം തിരഞ്ഞെടുക്കുക", "Odia": "ଦୟାକରି ଏକ ବିଷୟ ବାଛନ୍ତୁ"
    },
    "Max marks must be greater than 0": {
        "English": "Max marks must be greater than 0", "Hindi": "अधिकतम अंक 0 से अधिक होने चाहिए", "Kannada": "ಗರಿಷ್ಠ ಅಂಕಗಳು 0 ಗಿಂತ ಹೆಚ್ಚಿರಬೇಕು", "Tamil": "அதிகபட்ச மதிப்பெண்கள் 0 ஐ விட அதிகமாக இருக்க வேண்டும்", "Telugu": "గరిష్ట మార్కులు 0 కంటే ఎక్కువగా ఉండాలి", "Marathi": "कमाल गुण 0 पेक्षा जास्त असणे आवश्यक", "Bengali": "সর্বোচ্চ নম্বর 0 এর বেশি হতে হবে", "Gujarati": "મહત્તમ ગુણ 0 કરતા વધારે હોવા જોઈએ", "Punjabi": "ਅਧਿਕਤਮ ਅੰਕ 0 ਤੋਂ ਵੱਧ ਹੋਣੇ ਚਾਹੀਦੇ ਹਨ", "Malayalam": "പരമാവധി മാർക്കുകൾ 0-ൽ കൂടുതലായിരിക്കണം", "Odia": "ସର୍ବାଧିକ ନମ୍ବର 0 ରୁ ଅଧିକ ହେବା ଆବଶ୍ୟକ"
    },
    "Invalid marks for": {
        "English": "Invalid marks for", "Hindi": "के लिए अमान्य अंक", "Kannada": "ಗಾಗಿ ಅಮಾನ್ಯ ಅಂಕಗಳು", "Tamil": "க்கு தவறான மதிப்பெண்கள்", "Telugu": "కోసం చెల్లని మార్కులు", "Marathi": "साठी अवैध गुण", "Bengali": "এর জন্য অবৈধ নম্বর", "Gujarati": "માટે અમાન્ય ગુણ", "Punjabi": "ਲਈ ਅਵੈਧ ਅੰਕ", "Malayalam": "എന്നതിന് അസാധുവായ മാർക്കുകൾ", "Odia": "ପାଇଁ ଅବୈଧ ନମ୍ବର"
    },
    "Must be 0 to": {
        "English": "Must be 0 to", "Hindi": "0 से होना चाहिए", "Kannada": "0 ರಿಂದ ಇರಬೇಕು", "Tamil": "0 முதல் இருக்க வேண்டும்", "Telugu": "0 నుండి ఉండాలి", "Marathi": "0 ते असणे आवश्यक", "Bengali": "0 থেকে হতে হবে", "Gujarati": "0 થી હોવા જોઈએ", "Punjabi": "0 ਤੋਂ ਹੋਣੇ ਚਾਹੀਦੇ", "Malayalam": "0 മുതൽ ആയിരിക്കണം", "Odia": "0 ରୁ ହେବା ଆବଶ୍ୟକ"
    },
    "Enter marks for at least one student": {
        "English": "Enter marks for at least one student", "Hindi": "कम से कम एक छात्र के लिए अंक दर्ज करें", "Kannada": "ಕನಿಷ್ಠ ಒಬ್ಬ ವಿದ್ಯಾರ್ಥಿಗೆ ಅಂಕಗಳನ್ನು ನಮೂದಿಸಿ", "Tamil": "குறைந்தபட்சம் ஒரு மாணவருக்கு மதிப்பெண்களை உள்ளிடவும்", "Telugu": "కనీసం ఒక విద్యార్థికి మార్కులు నమోదు చేయండి", "Marathi": "किमान एका विद्यार्थ्यासाठी गुण प्रविष्ट करा", "Bengali": "অন্তত একজন ছাত্রের জন্য নম্বর লিখুন", "Gujarati": "ઓછામાં ઓછા એક વિદ્યાર્થી માટે ગુણ દાખલ કરો", "Punjabi": "ਘੱਟੋ-ਘੱਟ ਇੱਕ ਵਿਦਿਆਰਥੀ ਲਈ ਅੰਕ ਦਰਜ ਕਰੋ", "Malayalam": "കുറഞ്ഞത് ഒരു വിദ്യാർത്ഥിക്കെങ്കിലും മാർക്കുകൾ നൽകുക", "Odia": "ଅନ୍ତତଃ ଜଣେ ଛାତ୍ର ପାଇଁ ନମ୍ବର ପ୍ରବେଶ କରନ୍ତୁ"
    },
    "Marks saved successfully": {
        "English": "Marks saved successfully", "Hindi": "अंक सफलतापूर्वक सहेजे गए", "Kannada": "ಅಂಕಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಉಳಿಸಲಾಗಿದೆ", "Tamil": "மதிப்பெண்கள் வெற்றிகரமாக சேமிக்கப்பட்டன", "Telugu": "మార్కులు విజయవంతంగా సేవ్ చేయబడ్డాయి", "Marathi": "गुण यशस्वीरित्या जतन झाले", "Bengali": "নম্বর সফলভাবে সংরক্ষিত হয়েছে", "Gujarati": "ગુણ સફળતાપૂર્વક સાચવ્યા", "Punjabi": "ਅੰਕ ਸਫਲਤਾਪੂਰਵਕ ਸੰਭਾਲੇ", "Malayalam": "മാർക്കുകൾ വിജയകരമായി സേവ് ചെയ്തു", "Odia": "ନମ୍ବର ସଫଳତାର ସହ ସଞ୍ଚୟ ହୋଇଛି"
    },
    "Failed to save marks": {
        "English": "Failed to save marks", "Hindi": "अंक सहेजने में विफल", "Kannada": "ಅಂಕಗಳನ್ನು ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "மதிப்பெண்களைச் சேமிக்க முடியவில்லை", "Telugu": "మార్కులను సేవ్ చేయడంలో విఫలమైంది", "Marathi": "गुण जतन करण्यात अयशस्वी", "Bengali": "নম্বর সংরক্ষণে ব্যর্থ", "Gujarati": "ગુણ સાચવવામાં નિષ્ફળ", "Punjabi": "ਅੰਕ ਸੰਭਾਲਣ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "മാർക്കുകൾ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ନମ୍ବର ସଞ୍ଚୟ କରିବାରେ ବିଫଳ"
    },
    // === Wave 3: Attendance (page + student-manager + create-class-dialog) ===
    "Failed to load classes": {
        "English": "Failed to load classes", "Hindi": "कक्षाएं लोड करने में विफल", "Kannada": "ತರಗತಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "வகுப்புகளை ஏற்ற முடியவில்லை", "Telugu": "తరగతులను లోడ్ చేయడంలో విఫలమైంది", "Marathi": "वर्ग लोड करण्यात अयशस्वी", "Bengali": "শ্রেণী লোড করতে ব্যর্থ", "Gujarati": "વર્ગો લોડ કરવામાં નિષ્ફળ", "Punjabi": "ਜਮਾਤਾਂ ਲੋਡ ਕਰਨ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "ക്ലാസുകൾ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ଶ୍ରେଣୀ ଲୋଡ୍ କରିବାରେ ବିଫଳ"
    },
    "Please try refreshing the page.": {
        "English": "Please try refreshing the page.", "Hindi": "कृपया पृष्ठ को रिफ्रेश करने का प्रयास करें।", "Kannada": "ದಯವಿಟ್ಟು ಪುಟವನ್ನು ರಿಫ್ರೆಶ್ ಮಾಡಲು ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "பக்கத்தைப் புதுப்பிக்க முயற்சிக்கவும்.", "Telugu": "దయచేసి పేజీని రిఫ్రెష్ చేయడానికి ప్రయత్నించండి.", "Marathi": "कृपया पान रिफ्रेश करण्याचा प्रयत्न करा.", "Bengali": "অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করার চেষ্টা করুন।", "Gujarati": "કૃપા કરી પાનું રિફ્રેશ કરવાનો પ્રયાસ કરો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਪੰਨੇ ਨੂੰ ਰਿਫ੍ਰੈਸ਼ ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ദയവായി പേജ് റിഫ്രെഷ് ചെയ്യാൻ ശ്രമിക്കുക.", "Odia": "ଦୟାକରି ପୃଷ୍ଠାକୁ ରିଫ୍ରେସ୍ କରିବାକୁ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Delete class confirm": {
        "English": "Delete \"{name}\"? This cannot be undone.", "Hindi": "\"{name}\" को हटाएं? यह क्रिया वापस नहीं की जा सकती।", "Kannada": "\"{name}\" ಅಳಿಸಬೇಕೆ? ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.", "Tamil": "\"{name}\" நீக்க வேண்டுமா? இதைத் திரும்பப் பெற முடியாது.", "Telugu": "\"{name}\" తొలగించాలా? దీన్ని రద్దు చేయలేరు.", "Marathi": "\"{name}\" हटवा? हे पूर्ववत करता येणार नाही.", "Bengali": "\"{name}\" মুছবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।", "Gujarati": "\"{name}\" ડિલીટ કરો? આ પૂર્વવત્ કરી શકાશે નહીં.", "Punjabi": "\"{name}\" ਮਿਟਾਓ? ਇਸ ਨੂੰ ਵਾਪਸ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ।", "Malayalam": "\"{name}\" ഇല്ലാതാക്കണോ? ഇത് പഴയപടിയാക്കാൻ കഴിയില്ല.", "Odia": "\"{name}\" ବିଲୋପ କରନ୍ତୁ? ଏହାକୁ ପୂର୍ବାବସ୍ଥାକୁ ଫେରାଯାଇ ପାରିବ ନାହିଁ।"
    },
    "Class deleted": {
        "English": "Class deleted", "Hindi": "कक्षा हटाई गई", "Kannada": "ತರಗತಿ ಅಳಿಸಲಾಗಿದೆ", "Tamil": "வகுப்பு நீக்கப்பட்டது", "Telugu": "తరగతి తొలగించబడింది", "Marathi": "वर्ग हटवला", "Bengali": "শ্রেণী মুছে ফেলা হয়েছে", "Gujarati": "વર્ગ ડિલીટ થયો", "Punjabi": "ਜਮਾਤ ਮਿਟਾਈ", "Malayalam": "ക്ലാസ് ഇല്ലാതാക്കി", "Odia": "ଶ୍ରେଣୀ ବିଲୋପ ହୋଇଛି"
    },
    "Error": {
        "English": "Error", "Hindi": "त्रुटि", "Kannada": "ದೋಷ", "Tamil": "பிழை", "Telugu": "లోపం", "Marathi": "त्रुटी", "Bengali": "ত্রুটি", "Gujarati": "ભૂલ", "Punjabi": "ਗਲਤੀ", "Malayalam": "പിശക്", "Odia": "ତ୍ରୁଟି"
    },
    "Delete class": {
        "English": "Delete class", "Hindi": "कक्षा हटाएं", "Kannada": "ತರಗತಿಯನ್ನು ಅಳಿಸಿ", "Tamil": "வகுப்பை நீக்கு", "Telugu": "తరగతిని తొలగించండి", "Marathi": "वर्ग हटवा", "Bengali": "শ্রেণী মুছুন", "Gujarati": "વર્ગ ડિલીટ કરો", "Punjabi": "ਜਮਾਤ ਮਿਟਾਓ", "Malayalam": "ക്ലാസ് ഇല്ലാതാക്കുക", "Odia": "ଶ୍ରେଣୀ ବିଲୋପ କରନ୍ତୁ"
    },
    "Student updated": {
        "English": "Student updated", "Hindi": "छात्र अपडेट हुआ", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ನವೀಕರಿಸಲಾಗಿದೆ", "Tamil": "மாணவர் புதுப்பிக்கப்பட்டார்", "Telugu": "విద్యార్థి నవీకరించబడ్డాడు", "Marathi": "विद्यार्थी अद्ययावत झाला", "Bengali": "ছাত্র আপডেট হয়েছে", "Gujarati": "વિદ્યાર્થી અપડેટ થયો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਅੱਪਡੇਟ ਹੋਇਆ", "Malayalam": "വിദ്യാർത്ഥി അപ്ഡേറ്റ് ചെയ്തു", "Odia": "ଛାତ୍ର ଅପଡେଟ୍ ହୋଇଛି"
    },
    "Student added": {
        "English": "Student added", "Hindi": "छात्र जोड़ा गया", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಸೇರಿಸಲಾಗಿದೆ", "Tamil": "மாணவர் சேர்க்கப்பட்டார்", "Telugu": "విద్యార్థి జోడించబడ్డాడు", "Marathi": "विद्यार्थी जोडला", "Bengali": "ছাত্র যোগ হয়েছে", "Gujarati": "વિદ્યાર્થી ઉમેરાયો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਜੋੜਿਆ", "Malayalam": "വിദ്യാർത്ഥി ചേർത്തു", "Odia": "ଛାତ୍ର ଯୋଗ ହୋଇଛି"
    },
    "Student removed": {
        "English": "Student removed", "Hindi": "छात्र हटाया गया", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ", "Tamil": "மாணவர் அகற்றப்பட்டார்", "Telugu": "విద్యార్థి తొలగించబడ్డాడు", "Marathi": "विद्यार्थी काढून टाकला", "Bengali": "ছাত্র সরানো হয়েছে", "Gujarati": "વિદ્યાર્થી દૂર કર્યો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਹਟਾਇਆ", "Malayalam": "വിദ്യാർത്ഥിയെ നീക്കം ചെയ്തു", "Odia": "ଛାତ୍ର ହଟାଯାଇଛି"
    },
    "Attendance is a Pro feature. Please upgrade your plan.": {
        "English": "Attendance is a Pro feature. Please upgrade your plan.", "Hindi": "उपस्थिति एक Pro सुविधा है। कृपया अपनी योजना अपग्रेड करें।", "Kannada": "ಹಾಜರಾತಿ Pro ವೈಶಿಷ್ಟ್ಯವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.", "Tamil": "வருகை ஒரு Pro அம்சம். உங்கள் திட்டத்தை மேம்படுத்தவும்.", "Telugu": "హాజరు అనేది Pro ఫీచర్. దయచేసి మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.", "Marathi": "उपस्थिती Pro वैशिष्ट्य आहे. कृपया तुमचा प्लॅन अपग्रेड करा.", "Bengali": "উপস্থিতি একটি Pro বৈশিষ্ট্য। অনুগ্রহ করে আপনার প্ল্যান আপগ্রেড করুন।", "Gujarati": "હાજરી Pro સુવિધા છે. કૃપા કરી તમારી પ્લાન અપગ્રેડ કરો.", "Punjabi": "ਹਾਜ਼ਰੀ ਇੱਕ Pro ਵਿਸ਼ੇਸ਼ਤਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪਲਾਨ ਅਪਗ੍ਰੇਡ ਕਰੋ।", "Malayalam": "ഹാജർ Pro ഫീച്ചറാണ്. ദയവായി നിങ്ങളുടെ പ്ലാൻ അപ്‌ഗ്രേഡ് ചെയ്യുക.", "Odia": "ଉପସ୍ଥିତି ଏକ Pro ବୈଶିଷ୍ଟ୍ୟ। ଦୟାକରି ଆପଣଙ୍କ ପ୍ଲାନ୍ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ।"
    },
    "Remove {name} from this class?": {
        "English": "Remove {name} from this class?", "Hindi": "{name} को इस कक्षा से हटाएं?", "Kannada": "{name} ಅನ್ನು ಈ ತರಗತಿಯಿಂದ ತೆಗೆದುಹಾಕಬೇಕೆ?", "Tamil": "இந்த வகுப்பிலிருந்து {name} அகற்ற வேண்டுமா?", "Telugu": "ఈ తరగతి నుండి {name}ను తీసివేయాలా?", "Marathi": "{name} ला या वर्गातून काढायचे?", "Bengali": "{name} কে এই শ্রেণী থেকে সরাবেন?", "Gujarati": "{name} ને આ વર્ગમાંથી દૂર કરો?", "Punjabi": "{name} ਨੂੰ ਇਸ ਜਮਾਤ ਤੋਂ ਹਟਾਓ?", "Malayalam": "ഈ ക്ലാസിൽ നിന്ന് {name}യെ നീക്കം ചെയ്യണോ?", "Odia": "ଏହି ଶ୍ରେଣୀରୁ {name}ଙ୍କୁ ହଟାନ୍ତୁ?"
    },
    "Add Student": {
        "English": "Add Student", "Hindi": "छात्र जोड़ें", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಸೇರಿಸಿ", "Tamil": "மாணவரைச் சேர்", "Telugu": "విద్యార్థిని జోడించండి", "Marathi": "विद्यार्थी जोडा", "Bengali": "ছাত্র যোগ করুন", "Gujarati": "વિદ્યાર્થી ઉમેરો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਜੋੜੋ", "Malayalam": "വിദ്യാർത്ഥിയെ ചേർക്കുക", "Odia": "ଛାତ୍ର ଯୋଗ କରନ୍ତୁ"
    },
    "No students yet": {
        "English": "No students yet", "Hindi": "अभी तक कोई छात्र नहीं", "Kannada": "ಇನ್ನೂ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ", "Tamil": "இன்னும் மாணவர்கள் இல்லை", "Telugu": "ఇంకా విద్యార్థులు లేరు", "Marathi": "अद्याप विद्यार्थी नाहीत", "Bengali": "এখনও কোনো ছাত্র নেই", "Gujarati": "હજુ સુધી કોઈ વિદ્યાર્થી નથી", "Punjabi": "ਅਜੇ ਕੋਈ ਵਿਦਿਆਰਥੀ ਨਹੀਂ", "Malayalam": "ഇതുവരെ വിദ്യാർത്ഥികളില്ല", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଛାତ୍ର ନାହାଁନ୍ତି"
    },
    "Add students to start taking attendance.": {
        "English": "Add students to start taking attendance.", "Hindi": "उपस्थिति लेना शुरू करने के लिए छात्रों को जोड़ें।", "Kannada": "ಹಾಜರಾತಿ ತೆಗೆದುಕೊಳ್ಳಲು ಪ್ರಾರಂಭಿಸಲು ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ.", "Tamil": "வருகையை எடுக்கத் தொடங்க மாணவர்களைச் சேர்க்கவும்.", "Telugu": "హాజరును తీసుకోవడం ప్రారంభించడానికి విద్యార్థులను జోడించండి.", "Marathi": "उपस्थिती घेणे सुरू करण्यासाठी विद्यार्थी जोडा.", "Bengali": "উপস্থিতি নিতে শুরু করতে ছাত্র যোগ করুন।", "Gujarati": "હાજરી લેવાનું શરૂ કરવા માટે વિદ્યાર્થીઓ ઉમેરો.", "Punjabi": "ਹਾਜ਼ਰੀ ਲੈਣਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਵਿਦਿਆਰਥੀ ਜੋੜੋ।", "Malayalam": "ഹാജർ എടുക്കാൻ ആരംഭിക്കാൻ വിദ്യാർത്ഥികളെ ചേർക്കുക.", "Odia": "ଉପସ୍ଥିତି ନେବାକୁ ଆରମ୍ଭ କରିବାକୁ ଛାତ୍ର ଯୋଗ କରନ୍ତୁ।"
    },
    "Edit Student": {
        "English": "Edit Student", "Hindi": "छात्र संपादित करें", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಸಂಪಾದಿಸಿ", "Tamil": "மாணவரைத் திருத்து", "Telugu": "విద్యార్థిని సవరించండి", "Marathi": "विद्यार्थी संपादित करा", "Bengali": "ছাত্র সম্পাদনা করুন", "Gujarati": "વિદ્યાર્થી સંપાદિત કરો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਸੰਪਾਦਿਤ ਕਰੋ", "Malayalam": "വിദ്യാർത്ഥിയെ എഡിറ്റ് ചെയ്യുക", "Odia": "ଛାତ୍ର ସମ୍ପାଦନ କରନ୍ତୁ"
    },
    "Roll Number *": {
        "English": "Roll Number *", "Hindi": "रोल नंबर *", "Kannada": "ರೋಲ್ ಸಂಖ್ಯೆ *", "Tamil": "வரிசை எண் *", "Telugu": "రోల్ నంబర్ *", "Marathi": "रोल नंबर *", "Bengali": "রোল নম্বর *", "Gujarati": "રોલ નંબર *", "Punjabi": "ਰੋਲ ਨੰਬਰ *", "Malayalam": "റോൾ നമ്പർ *", "Odia": "ରୋଲ୍ ନମ୍ବର *"
    },
    "Student Name *": {
        "English": "Student Name *", "Hindi": "छात्र का नाम *", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು *", "Tamil": "மாணவர் பெயர் *", "Telugu": "విద్యార్థి పేరు *", "Marathi": "विद्यार्थ्याचे नाव *", "Bengali": "ছাত্রের নাম *", "Gujarati": "વિદ્યાર્થીનું નામ *", "Punjabi": "ਵਿਦਿਆਰਥੀ ਦਾ ਨਾਮ *", "Malayalam": "വിദ്യാർത്ഥിയുടെ പേര് *", "Odia": "ଛାତ୍ରଙ୍କ ନାମ *"
    },
    "Full name": {
        "English": "Full name", "Hindi": "पूरा नाम", "Kannada": "ಪೂರ್ಣ ಹೆಸರು", "Tamil": "முழுப் பெயர்", "Telugu": "పూర్తి పేరు", "Marathi": "पूर्ण नाव", "Bengali": "পুরো নাম", "Gujarati": "પૂરું નામ", "Punjabi": "ਪੂਰਾ ਨਾਮ", "Malayalam": "പൂർണ്ണ പേര്", "Odia": "ସମ୍ପୂର୍ଣ୍ଣ ନାମ"
    },
    "Parent's Phone *": {
        "English": "Parent's Phone *", "Hindi": "अभिभावक का फोन *", "Kannada": "ಪೋಷಕರ ಫೋನ್ *", "Tamil": "பெற்றோர் தொலைபேசி *", "Telugu": "తల్లిదండ్రుల ఫోన్ *", "Marathi": "पालकांचा फोन *", "Bengali": "অভিভাবকের ফোন *", "Gujarati": "વાલીનો ફોન *", "Punjabi": "ਮਾਪਿਆਂ ਦਾ ਫੋਨ *", "Malayalam": "രക്ഷിതാവിന്റെ ഫോൺ *", "Odia": "ଅଭିଭାବକଙ୍କ ଫୋନ୍ *"
    },
    "Parent's Language": {
        "English": "Parent's Language", "Hindi": "अभिभावक की भाषा", "Kannada": "ಪೋಷಕರ ಭಾಷೆ", "Tamil": "பெற்றோர் மொழி", "Telugu": "తల్లిదండ్రుల భాష", "Marathi": "पालकांची भाषा", "Bengali": "অভিভাবকের ভাষা", "Gujarati": "વાલીની ભાષા", "Punjabi": "ਮਾਪਿਆਂ ਦੀ ਭਾਸ਼ਾ", "Malayalam": "രക്ഷിതാവിന്റെ ഭാഷ", "Odia": "ଅଭିଭାବକଙ୍କ ଭାଷା"
    },
    // === Wave 3: Create Class Dialog ===
    "Class created": {
        "English": "Class created", "Hindi": "कक्षा बनाई गई", "Kannada": "ತರಗತಿ ರಚಿಸಲಾಗಿದೆ", "Tamil": "வகுப்பு உருவாக்கப்பட்டது", "Telugu": "తరగతి సృష్టించబడింది", "Marathi": "वर्ग तयार झाला", "Bengali": "শ্রেণী তৈরি হয়েছে", "Gujarati": "વર્ગ બનાવ્યો", "Punjabi": "ਜਮਾਤ ਬਣਾਈ ਗਈ", "Malayalam": "ക്ലാസ് സൃഷ്ടിച്ചു", "Odia": "ଶ୍ରେଣୀ ସୃଷ୍ଟି ହୋଇଛି"
    },
    "Failed to create class": {
        "English": "Failed to create class", "Hindi": "कक्षा बनाने में विफल", "Kannada": "ತರಗತಿಯನ್ನು ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "வகுப்பை உருவாக்க முடியவில்லை", "Telugu": "తరగతిని సృష్టించడంలో విఫలమైంది", "Marathi": "वर्ग तयार करण्यात अयशस्वी", "Bengali": "শ্রেণী তৈরি করতে ব্যর্থ", "Gujarati": "વર્ગ બનાવવામાં નિષ્ફળ", "Punjabi": "ਜਮਾਤ ਬਣਾਉਣ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "ക്ലാസ് സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ଶ୍ରେଣୀ ସୃଷ୍ଟି କରିବାରେ ବିଫଳ"
    },
    "Create a Class": {
        "English": "Create a Class", "Hindi": "एक कक्षा बनाएं", "Kannada": "ತರಗತಿಯನ್ನು ರಚಿಸಿ", "Tamil": "ஒரு வகுப்பை உருவாக்கு", "Telugu": "ఒక తరగతిని సృష్టించండి", "Marathi": "वर्ग तयार करा", "Bengali": "একটি শ্রেণী তৈরি করুন", "Gujarati": "વર્ગ બનાવો", "Punjabi": "ਇੱਕ ਜਮਾਤ ਬਣਾਓ", "Malayalam": "ഒരു ക്ലാസ് സൃഷ്ടിക്കുക", "Odia": "ଏକ ଶ୍ରେଣୀ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Class Name *": {
        "English": "Class Name *", "Hindi": "कक्षा का नाम *", "Kannada": "ತರಗತಿಯ ಹೆಸರು *", "Tamil": "வகுப்பின் பெயர் *", "Telugu": "తరగతి పేరు *", "Marathi": "वर्गाचे नाव *", "Bengali": "শ্রেণীর নাম *", "Gujarati": "વર્ગનું નામ *", "Punjabi": "ਜਮਾਤ ਦਾ ਨਾਮ *", "Malayalam": "ക്ലാസിന്റെ പേര് *", "Odia": "ଶ୍ରେଣୀ ନାମ *"
    },
    "e.g. Class 6A": {
        "English": "e.g. Class 6A", "Hindi": "जैसे कक्षा 6A", "Kannada": "ಉದಾ. ತರಗತಿ 6A", "Tamil": "எ.கா. வகுப்பு 6A", "Telugu": "ఉదా. తరగతి 6A", "Marathi": "उदा. वर्ग 6A", "Bengali": "যেমন শ্রেণী 6A", "Gujarati": "દા.ત. વર્ગ 6A", "Punjabi": "ਉਦਾ. ਜਮਾਤ 6A", "Malayalam": "ഉദാ. ക്ലാസ് 6A", "Odia": "ଯଥା. ଶ୍ରେଣୀ 6A"
    },
    "Grade Level *": {
        "English": "Grade Level *", "Hindi": "ग्रेड स्तर *", "Kannada": "ಗ್ರೇಡ್ ಮಟ್ಟ *", "Tamil": "வகுப்பு நிலை *", "Telugu": "గ్రేడ్ స్థాయి *", "Marathi": "इयत्ता पातळी *", "Bengali": "শ্রেণী স্তর *", "Gujarati": "ધોરણ સ્તર *", "Punjabi": "ਜਮਾਤ ਪੱਧਰ *", "Malayalam": "ഗ്രേഡ് ലെവൽ *", "Odia": "ଶ୍ରେଣୀ ସ୍ତର *"
    },
    "e.g. A": {
        "English": "e.g. A", "Hindi": "जैसे A", "Kannada": "ಉದಾ. A", "Tamil": "எ.கா. A", "Telugu": "ఉదా. A", "Marathi": "उदा. A", "Bengali": "যেমন A", "Gujarati": "દા.ત. A", "Punjabi": "ਉਦਾ. A", "Malayalam": "ഉദാ. A", "Odia": "ଯଥା. A"
    },
    "Subject *": {
        "English": "Subject *", "Hindi": "विषय *", "Kannada": "ವಿಷಯ *", "Tamil": "பாடம் *", "Telugu": "విషయం *", "Marathi": "विषय *", "Bengali": "বিষয় *", "Gujarati": "વિષય *", "Punjabi": "ਵਿਸ਼ਾ *", "Malayalam": "വിഷയം *", "Odia": "ବିଷୟ *"
    },
    "Academic Year *": {
        "English": "Academic Year *", "Hindi": "शैक्षणिक वर्ष *", "Kannada": "ಶೈಕ್ಷಣಿಕ ವರ್ಷ *", "Tamil": "கல்வியாண்டு *", "Telugu": "విద్యా సంవత్సరం *", "Marathi": "शैक्षणिक वर्ष *", "Bengali": "শিক্ষাবর্ষ *", "Gujarati": "શૈક્ષણિક વર્ષ *", "Punjabi": "ਅਕਾਦਮਿਕ ਸਾਲ *", "Malayalam": "അക്കാദമിക് വർഷം *", "Odia": "ଶିକ୍ଷାଗତ ବର୍ଷ *"
    },
    "e.g. 2025-26": {
        "English": "e.g. 2025-26", "Hindi": "जैसे 2025-26", "Kannada": "ಉದಾ. 2025-26", "Tamil": "எ.கா. 2025-26", "Telugu": "ఉదా. 2025-26", "Marathi": "उदा. 2025-26", "Bengali": "যেমন 2025-26", "Gujarati": "દા.ત. 2025-26", "Punjabi": "ਉਦਾ. 2025-26", "Malayalam": "ഉദാ. 2025-26", "Odia": "ଯଥା. 2025-26"
    },
    "Create Class": {
        "English": "Create Class", "Hindi": "कक्षा बनाएं", "Kannada": "ತರಗತಿ ರಚಿಸಿ", "Tamil": "வகுப்பை உருவாக்கு", "Telugu": "తరగతి సృష్టించండి", "Marathi": "वर्ग तयार करा", "Bengali": "শ্রেণী তৈরি করুন", "Gujarati": "વર્ગ બનાવો", "Punjabi": "ਜਮਾਤ ਬਣਾਓ", "Malayalam": "ക്ലാസ് സൃഷ്ടിക്കുക", "Odia": "ଶ୍ରେଣୀ ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Section": {
        "English": "Section", "Hindi": "अनुभाग", "Kannada": "ವಿಭಾಗ", "Tamil": "பிரிவு", "Telugu": "విభాగం", "Marathi": "विभाग", "Bengali": "বিভাগ", "Gujarati": "વિભાગ", "Punjabi": "ਸੈਕਸ਼ਨ", "Malayalam": "വിഭാഗം", "Odia": "ବିଭାଗ"
    },
    // === Wave 3: Community page ===
    "Staff Room": {
        "English": "Staff Room", "Hindi": "स्टाफ रूम", "Kannada": "ಸಿಬ್ಬಂದಿ ಕೊಠಡಿ", "Tamil": "ஆசிரியர் அறை", "Telugu": "సిబ్బంది గది", "Marathi": "स्टाफ रूम", "Bengali": "স্টাফ রুম", "Gujarati": "સ્ટાફ રૂમ", "Punjabi": "ਸਟਾਫ਼ ਰੂਮ", "Malayalam": "സ്റ്റാഫ് റൂം", "Odia": "ଷ୍ଟାଫ୍ ରୁମ୍"
    },
    "Open chat": {
        "English": "Open chat", "Hindi": "चैट खोलें", "Kannada": "ಚಾಟ್ ತೆರೆಯಿರಿ", "Tamil": "அரட்டையைத் திற", "Telugu": "చాట్ తెరవండి", "Marathi": "चॅट उघडा", "Bengali": "চ্যাট খুলুন", "Gujarati": "ચેટ ખોલો", "Punjabi": "ਚੈਟ ਖੋਲ੍ਹੋ", "Malayalam": "ചാറ്റ് തുറക്കുക", "Odia": "ଚାଟ୍ ଖୋଲନ୍ତୁ"
    },
    "By subject or school": {
        "English": "By subject or school", "Hindi": "विषय या स्कूल के अनुसार", "Kannada": "ವಿಷಯ ಅಥವಾ ಶಾಲೆಯ ಪ್ರಕಾರ", "Tamil": "பாடம் அல்லது பள்ளி வாரியாக", "Telugu": "విషయం లేదా పాఠశాల ద్వారా", "Marathi": "विषय किंवा शाळेनुसार", "Bengali": "বিষয় বা স্কুল অনুসারে", "Gujarati": "વિષય અથવા શાળા દ્વારા", "Punjabi": "ਵਿਸ਼ੇ ਜਾਂ ਸਕੂਲ ਅਨੁਸਾਰ", "Malayalam": "വിഷയം അല്ലെങ്കിൽ സ്കൂൾ പ്രകാരം", "Odia": "ବିଷୟ କିମ୍ବା ବିଦ୍ୟାଳୟ ଅନୁସାରେ"
    },
    "Welcome!": {
        "English": "Welcome!", "Hindi": "स्वागत है!", "Kannada": "ಸ್ವಾಗತ!", "Tamil": "வரவேற்கிறோம்!", "Telugu": "స్వాగతం!", "Marathi": "स्वागत आहे!", "Bengali": "স্বাগতম!", "Gujarati": "સ્વાગત છે!", "Punjabi": "ਸੁਆਗਤ ਹੈ!", "Malayalam": "സ്വാഗതം!", "Odia": "ସ୍ୱାଗତ!"
    },
    "These groups match your subjects and classes. Post questions, share resources, and connect with fellow teachers.": {
        "English": "These groups match your subjects and classes. Post questions, share resources, and connect with fellow teachers.", "Hindi": "ये समूह आपके विषयों और कक्षाओं से मेल खाते हैं। प्रश्न पोस्ट करें, संसाधन साझा करें, और साथी शिक्षकों से जुड़ें।", "Kannada": "ಈ ಗುಂಪುಗಳು ನಿಮ್ಮ ವಿಷಯಗಳು ಮತ್ತು ತರಗತಿಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ. ಪ್ರಶ್ನೆಗಳನ್ನು ಪೋಸ್ಟ್ ಮಾಡಿ, ಸಂಪನ್ಮೂಲಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ, ಮತ್ತು ಸಹ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಿ.", "Tamil": "இந்த குழுக்கள் உங்கள் பாடங்கள் மற்றும் வகுப்புகளுடன் பொருந்துகின்றன. கேள்விகளைப் பதிவிடுங்கள், வளங்களைப் பகிருங்கள், சக ஆசிரியர்களுடன் இணையுங்கள்.", "Telugu": "ఈ గ్రూపులు మీ సబ్జెక్టులు మరియు తరగతులకు సరిపోతాయి. ప్రశ్నలు పోస్ట్ చేయండి, వనరులను పంచుకోండి, మరియు తోటి ఉపాధ్యాయులతో కనెక్ట్ అవ్వండి.", "Marathi": "हे गट तुमच्या विषयांशी आणि वर्गांशी जुळतात. प्रश्न पोस्ट करा, संसाधने सामायिक करा, आणि सहकारी शिक्षकांशी जोडले जा.", "Bengali": "এই গ্রুপগুলি আপনার বিষয় এবং শ্রেণীর সাথে মেলে। প্রশ্ন পোস্ট করুন, সম্পদ শেয়ার করুন, এবং সহকর্মী শিক্ষকদের সাথে সংযোগ করুন।", "Gujarati": "આ જૂથો તમારા વિષયો અને વર્ગો સાથે મેળ ખાય છે. પ્રશ્નો પોસ્ટ કરો, સંસાધનો શેર કરો, અને સાથી શિક્ષકો સાથે જોડાઓ.", "Punjabi": "ਇਹ ਗਰੁੱਪ ਤੁਹਾਡੇ ਵਿਸ਼ਿਆਂ ਅਤੇ ਕਲਾਸਾਂ ਨਾਲ ਮੇਲ ਖਾਂਦੇ ਹਨ। ਸਵਾਲ ਪੋਸਟ ਕਰੋ, ਸਾਧਨ ਸਾਂਝੇ ਕਰੋ, ਅਤੇ ਸਾਥੀ ਅਧਿਆਪਕਾਂ ਨਾਲ ਜੁੜੋ।", "Malayalam": "ഈ ഗ്രൂപ്പുകൾ നിങ്ങളുടെ വിഷയങ്ങളും ക്ലാസുകളും പൊരുത്തപ്പെടുന്നു. ചോദ്യങ്ങൾ പോസ്റ്റ് ചെയ്യുക, വിഭവങ്ങൾ പങ്കിടുക, സഹ അധ്യാപകരുമായി ബന്ധപ്പെടുക.", "Odia": "ଏହି ଗ୍ରୁପଗୁଡ଼ିକ ଆପଣଙ୍କର ବିଷୟ ଏବଂ ଶ୍ରେଣୀଗୁଡ଼ିକ ସହିତ ମେଳ ଖାଏ। ପ୍ରଶ୍ନ ପୋଷ୍ଟ କରନ୍ତୁ, ସମ୍ବଳ ସେୟାର କରନ୍ତୁ, ଏବଂ ସହ ଶିକ୍ଷକମାନଙ୍କ ସହିତ ସଂଯୋଗ କରନ୍ତୁ।"
    },
    "Join your first group": {
        "English": "Join your first group", "Hindi": "अपने पहले समूह में शामिल हों", "Kannada": "ನಿಮ್ಮ ಮೊದಲ ಗುಂಪಿಗೆ ಸೇರಿ", "Tamil": "உங்கள் முதல் குழுவில் சேருங்கள்", "Telugu": "మీ మొదటి గ్రూపులో చేరండి", "Marathi": "तुमच्या पहिल्या गटात सामील व्हा", "Bengali": "আপনার প্রথম গ্রুপে যোগ দিন", "Gujarati": "તમારા પ્રથમ જૂથમાં જોડાઓ", "Punjabi": "ਆਪਣੇ ਪਹਿਲੇ ਗਰੁੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ", "Malayalam": "നിങ്ങളുടെ ആദ്യ ഗ്രൂപ്പിൽ ചേരുക", "Odia": "ଆପଣଙ୍କର ପ୍ରଥମ ଗ୍ରୁପରେ ଯୋଗ ଦିଅନ୍ତୁ"
    },
    "Groups are how you find teachers in your subject, grade, and area.": {
        "English": "Groups are how you find teachers in your subject, grade, and area.", "Hindi": "समूह आपके विषय, कक्षा और क्षेत्र में शिक्षकों को खोजने का तरीका हैं।", "Kannada": "ಗುಂಪುಗಳು ನಿಮ್ಮ ವಿಷಯ, ತರಗತಿ ಮತ್ತು ಪ್ರದೇಶದಲ್ಲಿ ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕುವ ವಿಧಾನವಾಗಿದೆ.", "Tamil": "உங்கள் பாடம், வகுப்பு மற்றும் பகுதியில் ஆசிரியர்களைக் கண்டறிய குழுக்கள் வழி.", "Telugu": "మీ సబ్జెక్ట్, తరగతి మరియు ప్రాంతంలో ఉపాధ్యాయులను కనుగొనడానికి గ్రూపులు మార్గం.", "Marathi": "तुमच्या विषयात, इयत्तेत आणि क्षेत्रात शिक्षक शोधण्याचा मार्ग म्हणजे गट.", "Bengali": "আপনার বিষয়, শ্রেণী এবং এলাকায় শিক্ষকদের খুঁজে পাওয়ার উপায় হল গ্রুপ।", "Gujarati": "તમારા વિષય, ધોરણ અને વિસ્તારમાં શિક્ષકો શોધવાનો રસ્તો જૂથો છે.", "Punjabi": "ਗਰੁੱਪ ਤੁਹਾਡੇ ਵਿਸ਼ੇ, ਜਮਾਤ ਅਤੇ ਖੇਤਰ ਵਿੱਚ ਅਧਿਆਪਕ ਲੱਭਣ ਦਾ ਤਰੀਕਾ ਹਨ।", "Malayalam": "നിങ്ങളുടെ വിഷയം, ഗ്രേഡ്, പ്രദേശം എന്നിവയിൽ അധ്യാപകരെ കണ്ടെത്താനുള്ള മാർഗ്ഗമാണ് ഗ്രൂപ്പുകൾ.", "Odia": "ଆପଣଙ୍କର ବିଷୟ, ଶ୍ରେଣୀ ଏବଂ ଅଞ୍ଚଳରେ ଶିକ୍ଷକ ଖୋଜିବାର ଉପାୟ ହେଉଛି ଗ୍ରୁପ।"
    },
    "Browse groups": {
        "English": "Browse groups", "Hindi": "समूह ब्राउज़ करें", "Kannada": "ಗುಂಪುಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ", "Tamil": "குழுக்களை உலாவவும்", "Telugu": "గ్రూపులను బ్రౌజ్ చేయండి", "Marathi": "गट ब्राउझ करा", "Bengali": "গ্রুপ ব্রাউজ করুন", "Gujarati": "જૂથો બ્રાઉઝ કરો", "Punjabi": "ਗਰੁੱਪ ਬ੍ਰਾਊਜ਼ ਕਰੋ", "Malayalam": "ഗ്രൂപ്പുകൾ ബ്രൗസ് ചെയ്യുക", "Odia": "ଗ୍ରୁପଗୁଡ଼ିକ ବ୍ରାଉଜ୍ କରନ୍ତୁ"
    },
    // === Wave 3: Settings (Export + Delete Account dialog) ===
    "Large export started. You will be notified when it is ready.": {
        "English": "Large export started. You will be notified when it is ready.", "Hindi": "बड़ा निर्यात शुरू हुआ। तैयार होने पर आपको सूचित किया जाएगा।", "Kannada": "ದೊಡ್ಡ ರಫ್ತು ಪ್ರಾರಂಭವಾಗಿದೆ. ಸಿದ್ಧವಾದಾಗ ನಿಮಗೆ ತಿಳಿಸಲಾಗುತ್ತದೆ.", "Tamil": "பெரிய ஏற்றுமதி தொடங்கியது. தயாரானவுடன் உங்களுக்கு அறிவிக்கப்படும்.", "Telugu": "పెద్ద ఎగుమతి ప్రారంభమైంది. సిద్ధంగా ఉన్నప్పుడు మీకు తెలియజేస్తాము.", "Marathi": "मोठी निर्यात सुरू झाली. तयार झाल्यावर तुम्हाला सूचित केले जाईल.", "Bengali": "বড় এক্সপোর্ট শুরু হয়েছে। প্রস্তুত হলে আপনাকে জানানো হবে।", "Gujarati": "મોટી નિકાસ શરૂ થઈ. તૈયાર થયા પછી તમને જાણ કરવામાં આવશે.", "Punjabi": "ਵੱਡੀ ਨਿਰਯਾਤ ਸ਼ੁਰੂ ਹੋਈ। ਤਿਆਰ ਹੋਣ 'ਤੇ ਤੁਹਾਨੂੰ ਸੂਚਿਤ ਕੀਤਾ ਜਾਵੇਗਾ।", "Malayalam": "വലിയ കയറ്റുമതി ആരംഭിച്ചു. തയ്യാറാകുമ്പോൾ നിങ്ങളെ അറിയിക്കും.", "Odia": "ବଡ ରପ୍ତାନି ଆରମ୍ଭ ହୋଇଛି। ପ୍ରସ୍ତୁତ ହେଲେ ଆପଣଙ୍କୁ ଜଣାଯିବ।"
    },
    "Export failed. Please try again.": {
        "English": "Export failed. Please try again.", "Hindi": "निर्यात विफल। कृपया पुनः प्रयास करें।", "Kannada": "ರಫ್ತು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ஏற்றுமதி தோல்வி. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఎగుమతి విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "निर्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "এক্সপোর্ট ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "નિકાસ નિષ્ફળ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਨਿਰਯਾਤ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "കയറ്റുമതി പരാജയപ്പെട്ടു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରପ୍ତାନି ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Account deletion scheduled. You have 30 days to export your data.": {
        "English": "Account deletion scheduled. You have 30 days to export your data.", "Hindi": "खाता हटाने का समय निर्धारित है। आपके पास अपना डेटा निर्यात करने के लिए 30 दिन हैं।", "Kannada": "ಖಾತೆ ಅಳಿಸುವಿಕೆಯನ್ನು ನಿಗದಿಪಡಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಡೇಟಾವನ್ನು ರಫ್ತು ಮಾಡಲು ನಿಮಗೆ 30 ದಿನಗಳಿವೆ.", "Tamil": "கணக்கு நீக்கம் திட்டமிடப்பட்டது. உங்கள் தரவை ஏற்றுமதி செய்ய உங்களுக்கு 30 நாட்கள் உள்ளன.", "Telugu": "ఖాతా తొలగింపు షెడ్యూల్ చేయబడింది. మీ డేటాను ఎగుమతి చేయడానికి మీకు 30 రోజులు ఉన్నాయి.", "Marathi": "खाते हटवण्याचे नियोजन केले आहे. तुमचा डेटा निर्यात करण्यासाठी तुमच्याकडे 30 दिवस आहेत.", "Bengali": "অ্যাকাউন্ট মুছে ফেলার সময়সূচী তৈরি হয়েছে। আপনার ডেটা এক্সপোর্ট করতে আপনার কাছে 30 দিন আছে।", "Gujarati": "એકાઉન્ટ ડિલીટ કરવાનું શેડ્યૂલ થયું. તમારો ડેટા નિકાસ કરવા માટે તમારી પાસે 30 દિવસ છે.", "Punjabi": "ਖਾਤਾ ਮਿਟਾਉਣਾ ਸ਼ਡਿਊਲ ਕੀਤਾ ਗਿਆ। ਤੁਹਾਡੇ ਡੇਟਾ ਨੂੰ ਨਿਰਯਾਤ ਕਰਨ ਲਈ ਤੁਹਾਡੇ ਕੋਲ 30 ਦਿਨ ਹਨ।", "Malayalam": "അക്കൗണ്ട് ഇല്ലാതാക്കൽ ഷെഡ്യൂൾ ചെയ്തു. നിങ്ങളുടെ ഡാറ്റ കയറ്റുമതി ചെയ്യാൻ നിങ്ങൾക്ക് 30 ദിവസമുണ്ട്.", "Odia": "ଖାତା ବିଲୋପ ନିର୍ଧାରିତ। ଆପଣଙ୍କ ତଥ୍ୟ ରପ୍ତାନି କରିବାକୁ ଆପଣଙ୍କ ପାଖରେ 30 ଦିନ ଅଛି।"
    },
    "Failed to delete account": {
        "English": "Failed to delete account", "Hindi": "खाता हटाने में विफल", "Kannada": "ಖಾತೆಯನ್ನು ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "கணக்கை நீக்க முடியவில்லை", "Telugu": "ఖాతాను తొలగించడంలో విఫలమైంది", "Marathi": "खाते हटवण्यात अयशस्वी", "Bengali": "অ্যাকাউন্ট মুছে ফেলতে ব্যর্থ", "Gujarati": "એકાઉન્ટ ડિલીટ કરવામાં નિષ્ફળ", "Punjabi": "ਖਾਤਾ ਮਿਟਾਉਣ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "അക്കൗണ്ട് ഇല്ലാതാക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ଖାତା ବିଲୋପ କରିବାରେ ବିଫଳ"
    },
    "Failed to delete account. Please try again.": {
        "English": "Failed to delete account. Please try again.", "Hindi": "खाता हटाने में विफल। कृपया पुनः प्रयास करें।", "Kannada": "ಖಾತೆಯನ್ನು ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "கணக்கை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఖాతాను తొలగించడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "खाते हटवण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "অ্যাকাউন্ট মুছে ফেলতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "એકાઉન્ટ ડિલીટ કરવામાં નિષ્ફળ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਖਾਤਾ ਮਿਟਾਉਣ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "അക്കൗണ്ട് ഇല്ലാതാക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଖାତା ବିଲୋପ କରିବାରେ ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Delete Account": {
        "English": "Delete Account", "Hindi": "खाता हटाएं", "Kannada": "ಖಾತೆಯನ್ನು ಅಳಿಸಿ", "Tamil": "கணக்கை நீக்கு", "Telugu": "ఖాతాను తొలగించండి", "Marathi": "खाते हटवा", "Bengali": "অ্যাকাউন্ট মুছুন", "Gujarati": "એકાઉન્ટ ડિલીટ કરો", "Punjabi": "ਖਾਤਾ ਮਿਟਾਓ", "Malayalam": "അക്കൗണ്ട് ഇല്ലാതാക്കുക", "Odia": "ଖାତା ବିଲୋପ କରନ୍ତୁ"
    },
    "30-day grace period to export data": {
        "English": "30-day grace period to export data", "Hindi": "डेटा निर्यात के लिए 30-दिन की रियायत अवधि", "Kannada": "ಡೇಟಾ ರಫ್ತು ಮಾಡಲು 30-ದಿನಗಳ ರಿಯಾಯಿತಿ ಅವಧಿ", "Tamil": "தரவை ஏற்றுமதி செய்ய 30-நாள் சலுகை காலம்", "Telugu": "డేటాను ఎగుమతి చేయడానికి 30-రోజుల గ్రేస్ పీరియడ్", "Marathi": "डेटा निर्यात करण्यासाठी 30-दिवसांचा सवलत कालावधी", "Bengali": "ডেটা এক্সপোর্ট করতে 30-দিনের গ্রেস পিরিয়ড", "Gujarati": "ડેટા નિકાસ માટે 30-દિવસનો ગ્રેસ પીરિયડ", "Punjabi": "ਡੇਟਾ ਨਿਰਯਾਤ ਲਈ 30-ਦਿਨ ਦੀ ਛੋਟ ਮਿਆਦ", "Malayalam": "ഡാറ്റ കയറ്റുമതി ചെയ്യാൻ 30-ദിവസ ഗ്രേസ് പിരീഡ്", "Odia": "ତଥ୍ୟ ରପ୍ତାନି ପାଇଁ 30-ଦିନ ଗ୍ରେସ୍ ଅବଧି"
    },
    "Delete": {
        "English": "Delete", "Hindi": "हटाएं", "Kannada": "ಅಳಿಸಿ", "Tamil": "நீக்கு", "Telugu": "తొలగించు", "Marathi": "हटवा", "Bengali": "মুছুন", "Gujarati": "ડિલીટ", "Punjabi": "ਮਿਟਾਓ", "Malayalam": "ഇല്ലാതാക്കുക", "Odia": "ବିଲୋପ"
    },
    "Are you sure?": {
        "English": "Are you sure?", "Hindi": "क्या आप निश्चित हैं?", "Kannada": "ನೀವು ಖಚಿತವಾಗಿದ್ದೀರಾ?", "Tamil": "உறுதியாகவா?", "Telugu": "మీరు ఖచ్చితంగా ఉన్నారా?", "Marathi": "तुम्हाला खात्री आहे का?", "Bengali": "আপনি কি নিশ্চিত?", "Gujarati": "શું તમે ખાતરી છો?", "Punjabi": "ਕੀ ਤੁਸੀਂ ਯਕੀਨੀ ਹੋ?", "Malayalam": "നിങ്ങൾക്ക് ഉറപ്പാണോ?", "Odia": "ଆପଣ ନିଶ୍ଚିତ କି?"
    },
    "This action will:": {
        "English": "This action will:", "Hindi": "यह क्रिया करेगी:", "Kannada": "ಈ ಕ್ರಿಯೆಯು:", "Tamil": "இந்த செயல்:", "Telugu": "ఈ చర్య:", "Marathi": "ही क्रिया:", "Bengali": "এই ক্রিয়া:", "Gujarati": "આ ક્રિયા:", "Punjabi": "ਇਹ ਕਾਰਵਾਈ:", "Malayalam": "ഈ പ്രവർത്തനം:", "Odia": "ଏହି କାର୍ଯ୍ୟ:"
    },
    "Cancel your subscription (if active)": {
        "English": "Cancel your subscription (if active)", "Hindi": "आपकी सदस्यता रद्द करें (यदि सक्रिय है)", "Kannada": "ನಿಮ್ಮ ಚಂದಾದಾರಿಕೆಯನ್ನು ರದ್ದುಮಾಡಿ (ಸಕ್ರಿಯವಾಗಿದ್ದರೆ)", "Tamil": "உங்கள் சந்தாவை ரத்து செய்யவும் (செயலில் இருந்தால்)", "Telugu": "మీ సబ్‌స్క్రిప్షన్‌ను రద్దు చేయండి (క్రియాశీలంగా ఉంటే)", "Marathi": "तुमची सदस्यता रद्द करा (सक्रिय असल्यास)", "Bengali": "আপনার সদস্যতা বাতিল করুন (যদি সক্রিয় থাকে)", "Gujarati": "તમારી સબ્સ્ક્રિપ્શન રદ કરો (જો સક્રિય હોય)", "Punjabi": "ਆਪਣੀ ਮੈਂਬਰਸ਼ਿਪ ਰੱਦ ਕਰੋ (ਜੇ ਸਰਗਰਮ ਹੈ)", "Malayalam": "നിങ്ങളുടെ സബ്സ്ക്രിപ്ഷൻ റദ്ദാക്കുക (സജീവമാണെങ്കിൽ)", "Odia": "ଆପଣଙ୍କ ସବସ୍କ୍ରିପ୍ସନ୍ ବାତିଲ୍ କରନ୍ତୁ (ଯଦି ସକ୍ରିୟ)"
    },
    "Sign you out immediately": {
        "English": "Sign you out immediately", "Hindi": "आपको तुरंत साइन आउट करें", "Kannada": "ನಿಮ್ಮನ್ನು ತಕ್ಷಣ ಸೈನ್ ಔಟ್ ಮಾಡಿ", "Tamil": "உங்களை உடனடியாக வெளியேற்று", "Telugu": "మిమ్మల్ని వెంటనే సైన్ అవుట్ చేయండి", "Marathi": "तुम्हाला त्वरित साइन आउट करा", "Bengali": "আপনাকে অবিলম্বে সাইন আউট করুন", "Gujarati": "તમને તરત જ સાઇન આઉટ કરો", "Punjabi": "ਤੁਹਾਨੂੰ ਤੁਰੰਤ ਸਾਈਨ ਆਊਟ ਕਰੋ", "Malayalam": "ഉടനെ സൈൻ ഔട്ട് ചെയ്യുക", "Odia": "ଆପଣଙ୍କୁ ତୁରନ୍ତ ସାଇନ୍ ଆଉଟ୍ କରନ୍ତୁ"
    },
    "Give you 30 days to export your data": {
        "English": "Give you 30 days to export your data", "Hindi": "आपको अपना डेटा निर्यात करने के लिए 30 दिन दें", "Kannada": "ನಿಮ್ಮ ಡೇಟಾವನ್ನು ರಫ್ತು ಮಾಡಲು ನಿಮಗೆ 30 ದಿನಗಳನ್ನು ನೀಡಿ", "Tamil": "உங்கள் தரவை ஏற்றுமதி செய்ய உங்களுக்கு 30 நாட்கள் கொடுங்கள்", "Telugu": "మీ డేటాను ఎగుమతి చేయడానికి మీకు 30 రోజులు ఇవ్వండి", "Marathi": "तुमचा डेटा निर्यात करण्यासाठी तुम्हाला 30 दिवस द्या", "Bengali": "আপনার ডেটা এক্সপোর্ট করতে আপনাকে 30 দিন দিন", "Gujarati": "તમારો ડેટા નિકાસ કરવા માટે તમને 30 દિવસ આપો", "Punjabi": "ਤੁਹਾਨੂੰ ਆਪਣੇ ਡੇਟਾ ਨੂੰ ਨਿਰਯਾਤ ਕਰਨ ਲਈ 30 ਦਿਨ ਦਿਓ", "Malayalam": "നിങ്ങളുടെ ഡാറ്റ കയറ്റുമതി ചെയ്യാൻ 30 ദിവസം നൽകുക", "Odia": "ଆପଣଙ୍କ ତଥ୍ୟ ରପ୍ତାନି କରିବାକୁ ଆପଣଙ୍କୁ 30 ଦିନ ଦିଅନ୍ତୁ"
    },
    "Permanently delete everything after 30 days": {
        "English": "Permanently delete everything after 30 days", "Hindi": "30 दिनों के बाद सब कुछ स्थायी रूप से हटा दें", "Kannada": "30 ದಿನಗಳ ನಂತರ ಎಲ್ಲವನ್ನೂ ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ", "Tamil": "30 நாட்களுக்குப் பிறகு அனைத்தையும் நிரந்தரமாக நீக்கு", "Telugu": "30 రోజుల తర్వాత ప్రతిదీ శాశ్వతంగా తొలగించండి", "Marathi": "30 दिवसांनंतर सर्व काही कायमचे हटवा", "Bengali": "30 দিন পরে সবকিছু স্থায়ীভাবে মুছে ফেলুন", "Gujarati": "30 દિવસ પછી બધું કાયમ માટે ડિલીટ કરો", "Punjabi": "30 ਦਿਨਾਂ ਬਾਅਦ ਸਭ ਕੁਝ ਪੱਕੇ ਤੌਰ 'ਤੇ ਮਿਟਾਓ", "Malayalam": "30 ദിവസത്തിന് ശേഷം എല്ലാം ശാശ്വതമായി ഇല്ലാതാക്കുക", "Odia": "30 ଦିନ ପରେ ସବୁକିଛି ସ୍ଥାୟୀ ଭାବେ ବିଲୋପ କରନ୍ତୁ"
    },
    "Type DELETE to confirm:": {
        "English": "Type DELETE to confirm:", "Hindi": "पुष्टि के लिए DELETE टाइप करें:", "Kannada": "ದೃಢೀಕರಿಸಲು DELETE ಎಂದು ಟೈಪ್ ಮಾಡಿ:", "Tamil": "உறுதிப்படுத்த DELETE என தட்டச்சு செய்க:", "Telugu": "నిర్ధారించడానికి DELETE అని టైప్ చేయండి:", "Marathi": "पुष्टी करण्यासाठी DELETE टाइप करा:", "Bengali": "নিশ্চিত করতে DELETE টাইপ করুন:", "Gujarati": "પુષ્ટિ કરવા માટે DELETE ટાઇપ કરો:", "Punjabi": "ਪੁਸ਼ਟੀ ਲਈ DELETE ਟਾਈਪ ਕਰੋ:", "Malayalam": "സ്ഥിരീകരിക്കാൻ DELETE എന്ന് ടൈപ്പ് ചെയ്യുക:", "Odia": "ନିଶ୍ଚିତ କରିବାକୁ DELETE ଟାଇପ୍ କରନ୍ତୁ:"
    },
    "Deleting...": {
        "English": "Deleting...", "Hindi": "हटा रहा है...", "Kannada": "ಅಳಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "நீக்குகிறது...", "Telugu": "తొలగిస్తోంది...", "Marathi": "हटवत आहे...", "Bengali": "মুছে ফেলা হচ্ছে...", "Gujarati": "ડિલીટ થઈ રહ્યું છે...", "Punjabi": "ਮਿਟਾ ਰਿਹਾ ਹੈ...", "Malayalam": "ഇല്ലാതാക്കുന്നു...", "Odia": "ବିଲୋପ କରୁଅଛି..."
    },
    // === Wave 3: Pricing alerts ===
    "Failed to create subscription. Please try again.": {
        "English": "Failed to create subscription. Please try again.", "Hindi": "सदस्यता बनाने में विफल। कृपया पुनः प्रयास करें।", "Kannada": "ಚಂದಾದಾರಿಕೆಯನ್ನು ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "சந்தாவை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "సబ్‌స్క్రిప్షన్‌ను సృష్టించడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "सदस्यता तयार करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "সদস্যতা তৈরি করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "સબ્સ્ક્રિપ્શન બનાવવામાં નિષ્ફળ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਮੈਂਬਰਸ਼ਿਪ ਬਣਾਉਣ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "സബ്സ്ക്രിപ്ഷൻ സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ସବସ୍କ୍ରିପ୍ସନ୍ ସୃଷ୍ଟି କରିବାରେ ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Please enter a valid email address.": {
        "English": "Please enter a valid email address.", "Hindi": "कृपया एक मान्य ईमेल पता दर्ज करें।", "Kannada": "ದಯವಿಟ್ಟು ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.", "Tamil": "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.", "Telugu": "దయచేసి చెల్లుబాటు అయ్యే ఇమెయిల్ చిరునామాను నమోదు చేయండి.", "Marathi": "कृपया वैध ईमेल पत्ता प्रविष्ट करा.", "Bengali": "অনুগ্রহ করে একটি বৈধ ইমেল ঠিকানা লিখুন।", "Gujarati": "કૃપા કરી માન્ય ઇમેઇલ સરનામું દાખલ કરો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਜਾਇਜ਼ ਈਮੇਲ ਪਤਾ ਦਰਜ ਕਰੋ।", "Malayalam": "ദയവായി സാധുവായ ഇമെയിൽ വിലാസം നൽകുക.", "Odia": "ଦୟାକରି ଏକ ବୈଧ ଇମେଲ ଠିକଣା ପ୍ରବେଶ କରନ୍ତୁ।"
    },
    "Could not start checkout. Please try again.": {
        "English": "Could not start checkout. Please try again.", "Hindi": "चेकआउट शुरू नहीं हो सका। कृपया पुनः प्रयास करें।", "Kannada": "ಚೆಕ್‌ಔಟ್ ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "செக்அவுட்டைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "చెక్‌అవుట్ ప్రారంభించలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "चेकआउट सुरू करता आले नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "চেকআউট শুরু করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "ચેકઆઉટ શરૂ કરી શકાયું નહીં. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਚੈੱਕਆਉਟ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ചെക്കൗട്ട് ആരംഭിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଚେକଆଉଟ୍ ଆରମ୍ଭ କରିହେଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Network error. Please check your connection and try again.": {
        "English": "Network error. Please check your connection and try again.", "Hindi": "नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।", "Kannada": "ನೆಟ್ವರ್ಕ್ ದೋಷ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "நெட்வொர்க் பிழை. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "నెట్‌వర్క్ లోపం. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "नेटवर्क त्रुटी. कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.", "Bengali": "নেটওয়ার্ক ত্রুটি। অনুগ্রহ করে আপনার সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।", "Gujarati": "નેટવર્ક ભૂલ. કૃપા કરી તમારું કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.", "Punjabi": "ਨੈੱਟਵਰਕ ਗਲਤੀ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕੁਨੈਕਸ਼ਨ ਚੈੱਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "നെറ്റ്‌വർക്ക് പിശക്. ദയവായി നിങ്ങളുടെ കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.", "Odia": "ନେଟୱର୍କ ତ୍ରୁଟି। ଦୟାକରି ଆପଣଙ୍କ ସଂଯୋଗ ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Wave 3: Profile View ===
    "Loading professional profile...": {
        "English": "Loading professional profile...", "Hindi": "व्यावसायिक प्रोफ़ाइल लोड हो रही है...", "Kannada": "ವೃತ್ತಿಪರ ಪ್ರೊಫೈಲ್ ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...", "Tamil": "தொழில்முறை சுயவிவரம் ஏற்றப்படுகிறது...", "Telugu": "వృత్తిపరమైన ప్రొఫైల్ లోడ్ అవుతోంది...", "Marathi": "व्यावसायिक प्रोफाइल लोड होत आहे...", "Bengali": "পেশাদার প্রোফাইল লোড হচ্ছে...", "Gujarati": "વ્યાવસાયિક પ્રોફાઇલ લોડ થઈ રહી છે...", "Punjabi": "ਪੇਸ਼ੇਵਰ ਪ੍ਰੋਫਾਈਲ ਲੋਡ ਹੋ ਰਹੀ ਹੈ...", "Malayalam": "പ്രൊഫഷണൽ പ്രൊഫൈൽ ലോഡ് ചെയ്യുന്നു...", "Odia": "ବୃତ୍ତିଗତ ପ୍ରୋଫାଇଲ୍ ଲୋଡ୍ ହେଉଛି..."
    },
    "Teacher Sign-in Required": {
        "English": "Teacher Sign-in Required", "Hindi": "शिक्षक साइन-इन आवश्यक", "Kannada": "ಶಿಕ್ಷಕ ಸೈನ್-ಇನ್ ಅಗತ್ಯವಿದೆ", "Tamil": "ஆசிரியர் உள்நுழைவு தேவை", "Telugu": "ఉపాధ్యాయ సైన్-ఇన్ అవసరం", "Marathi": "शिक्षक साइन-इन आवश्यक", "Bengali": "শিক্ষক সাইন-ইন প্রয়োজন", "Gujarati": "શિક્ષક સાઇન-ઇન જરૂરી", "Punjabi": "ਅਧਿਆਪਕ ਸਾਈਨ-ਇਨ ਲੋੜੀਂਦਾ", "Malayalam": "അധ്യാപക സൈൻ-ഇൻ ആവശ്യം", "Odia": "ଶିକ୍ଷକ ସାଇନ୍-ଇନ୍ ଆବଶ୍ୟକ"
    },
    "Please sign in with your professional account to view your profile and certifications.": {
        "English": "Please sign in with your professional account to view your profile and certifications.", "Hindi": "अपनी प्रोफ़ाइल और प्रमाणपत्र देखने के लिए कृपया अपने पेशेवर खाते से साइन इन करें।", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಪ್ರಮಾಣಪತ್ರಗಳನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೃತ್ತಿಪರ ಖಾತೆಯೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "உங்கள் சுயவிவரத்தையும் சான்றிதழ்களையும் காண உங்கள் தொழில்முறை கணக்கில் உள்நுழையவும்.", "Telugu": "మీ ప్రొఫైల్ మరియు సర్టిఫికేట్‌లను చూడడానికి దయచేసి మీ వృత్తిపరమైన ఖాతాతో సైన్ ఇన్ చేయండి.", "Marathi": "तुमची प्रोफाइल आणि प्रमाणपत्रे पाहण्यासाठी कृपया तुमच्या व्यावसायिक खात्याने साइन इन करा.", "Bengali": "আপনার প্রোফাইল এবং সার্টিফিকেট দেখতে অনুগ্রহ করে আপনার পেশাদার অ্যাকাউন্ট দিয়ে সাইন ইন করুন।", "Gujarati": "તમારી પ્રોફાઇલ અને પ્રમાણપત્રો જોવા માટે કૃપા કરી તમારા વ્યાવસાયિક ખાતા સાથે સાઇન ઇન કરો.", "Punjabi": "ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਅਤੇ ਪ੍ਰਮਾਣ ਪੱਤਰ ਦੇਖਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਪੇਸ਼ੇਵਰ ਖਾਤੇ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈലും സർട്ടിഫിക്കറ്റുകളും കാണാൻ ദയവായി നിങ്ങളുടെ പ്രൊഫഷണൽ അക്കൗണ്ടിൽ സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ଆପଣଙ୍କର ପ୍ରୋଫାଇଲ୍ ଏବଂ ସାର୍ଟିଫିକେଟ୍ ଦେଖିବାକୁ ଦୟାକରି ଆପଣଙ୍କର ବୃତ୍ତିଗତ ଖାତା ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Go to Header to Sign In": {
        "English": "Go to Header to Sign In", "Hindi": "साइन इन करने के लिए हेडर पर जाएं", "Kannada": "ಸೈನ್ ಇನ್ ಮಾಡಲು ಹೆಡರ್‌ಗೆ ಹೋಗಿ", "Tamil": "உள்நுழைய தலைப்புக்குச் செல்லவும்", "Telugu": "సైన్ ఇన్ చేయడానికి హెడర్‌కు వెళ్లండి", "Marathi": "साइन इन करण्यासाठी हेडरवर जा", "Bengali": "সাইন ইন করতে হেডারে যান", "Gujarati": "સાઇન ઇન કરવા માટે હેડર પર જાઓ", "Punjabi": "ਸਾਈਨ ਇਨ ਕਰਨ ਲਈ ਹੈਡਰ 'ਤੇ ਜਾਓ", "Malayalam": "സൈൻ ഇൻ ചെയ്യാൻ ഹെഡറിലേക്ക് പോകുക", "Odia": "ସାଇନ୍ ଇନ୍ କରିବାକୁ ହେଡର୍‌କୁ ଯାଆନ୍ତୁ"
    },
    "Profile Not Found": {
        "English": "Profile Not Found", "Hindi": "प्रोफ़ाइल नहीं मिली", "Kannada": "ಪ್ರೊಫೈಲ್ ಸಿಗಲಿಲ್ಲ", "Tamil": "சுயவிவரம் கிடைக்கவில்லை", "Telugu": "ప్రొఫైల్ కనుగొనబడలేదు", "Marathi": "प्रोफाइल सापडली नाही", "Bengali": "প্রোফাইল পাওয়া যায়নি", "Gujarati": "પ્રોફાઇલ મળી નથી", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਨਹੀਂ ਮਿਲੀ", "Malayalam": "പ്രൊഫൈൽ കണ്ടെത്തിയില്ല", "Odia": "ପ୍ରୋଫାଇଲ୍ ମିଳିଲା ନାହିଁ"
    },
    "The teacher profile you are looking for does not exist or has been removed.": {
        "English": "The teacher profile you are looking for does not exist or has been removed.", "Hindi": "आप जिस शिक्षक प्रोफ़ाइल को खोज रहे हैं वह मौजूद नहीं है या हटा दी गई है।", "Kannada": "ನೀವು ಹುಡುಕುತ್ತಿರುವ ಶಿಕ್ಷಕ ಪ್ರೊಫೈಲ್ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ ಅಥವಾ ತೆಗೆದುಹಾಕಲಾಗಿದೆ.", "Tamil": "நீங்கள் தேடும் ஆசிரியர் சுயவிவரம் இல்லை அல்லது அகற்றப்பட்டது.", "Telugu": "మీరు వెతుకుతున్న ఉపాధ్యాయ ప్రొఫైల్ ఉనికిలో లేదు లేదా తొలగించబడింది.", "Marathi": "तुम्ही शोधत असलेली शिक्षक प्रोफाइल अस्तित्वात नाही किंवा काढून टाकली आहे.", "Bengali": "আপনি যে শিক্ষক প্রোফাইল খুঁজছেন তা বিদ্যমান নেই বা সরানো হয়েছে।", "Gujarati": "તમે જે શિક્ષક પ્રોફાઇલ શોધી રહ્યા છો તે અસ્તિત્વમાં નથી અથવા દૂર કરવામાં આવી છે.", "Punjabi": "ਤੁਸੀਂ ਜਿਸ ਅਧਿਆਪਕ ਪ੍ਰੋਫਾਈਲ ਨੂੰ ਲੱਭ ਰਹੇ ਹੋ ਉਹ ਮੌਜੂਦ ਨਹੀਂ ਹੈ ਜਾਂ ਹਟਾਇਆ ਗਿਆ ਹੈ।", "Malayalam": "നിങ്ങൾ തിരയുന്ന അധ്യാപക പ്രൊഫൈൽ നിലവിലില്ല അല്ലെങ്കിൽ നീക്കം ചെയ്തു.", "Odia": "ଆପଣ ଖୋଜୁଥିବା ଶିକ୍ଷକ ପ୍ରୋଫାଇଲ୍ ବିଦ୍ୟମାନ ନାହିଁ କିମ୍ବା ହଟାଯାଇଛି।"
    },
    "Go Back": {
        "English": "Go Back", "Hindi": "वापस जाएं", "Kannada": "ಹಿಂತಿರುಗಿ", "Tamil": "திரும்பிச் செல்", "Telugu": "వెనుకకు వెళ్లండి", "Marathi": "मागे जा", "Bengali": "ফিরে যান", "Gujarati": "પાછા જાઓ", "Punjabi": "ਵਾਪਸ ਜਾਓ", "Malayalam": "തിരികെ പോകുക", "Odia": "ଫେରନ୍ତୁ"
    },
    "Educator": {
        "English": "Educator", "Hindi": "शिक्षक", "Kannada": "ಶಿಕ್ಷಕ", "Tamil": "ஆசிரியர்", "Telugu": "ఉపాధ్యాయుడు", "Marathi": "शिक्षक", "Bengali": "শিক্ষক", "Gujarati": "શિક્ષક", "Punjabi": "ਸਿੱਖਿਅਕ", "Malayalam": "അധ്യാപകൻ", "Odia": "ଶିକ୍ଷକ"
    },
    "Contact Hidden": {
        "English": "Contact Hidden", "Hindi": "संपर्क छिपा हुआ", "Kannada": "ಸಂಪರ್ಕ ಮರೆಯಾಗಿದೆ", "Tamil": "தொடர்பு மறைக்கப்பட்டது", "Telugu": "సంప్రదింపు దాచబడింది", "Marathi": "संपर्क लपवलेला", "Bengali": "যোগাযোগ লুকানো", "Gujarati": "સંપર્ક છુપાયેલ", "Punjabi": "ਸੰਪਰਕ ਲੁਕਿਆ", "Malayalam": "ബന്ധപ്പെടാനുള്ളത് മറച്ചു", "Odia": "ଯୋଗାଯୋଗ ଲୁଚାଯାଇଛି"
    },
    "Verified Educator": {
        "English": "Verified Educator", "Hindi": "सत्यापित शिक्षक", "Kannada": "ಪರಿಶೀಲಿಸಿದ ಶಿಕ್ಷಕ", "Tamil": "சரிபார்க்கப்பட்ட ஆசிரியர்", "Telugu": "ధృవీకరించబడిన ఉపాధ్యాయుడు", "Marathi": "सत्यापित शिक्षक", "Bengali": "যাচাইকৃত শিক্ষক", "Gujarati": "ચકાસાયેલ શિક્ષક", "Punjabi": "ਪ੍ਰਮਾਣਿਤ ਅਧਿਆਪਕ", "Malayalam": "സ്ഥിരീകരിച്ച അധ്യാപകൻ", "Odia": "ଯାଞ୍ଚିତ ଶିକ୍ଷକ"
    },
    "Connect": {
        "English": "Connect", "Hindi": "जुड़ें", "Kannada": "ಸಂಪರ್ಕಿಸಿ", "Tamil": "இணை", "Telugu": "కనెక్ట్", "Marathi": "जोडा", "Bengali": "সংযোগ করুন", "Gujarati": "જોડાઓ", "Punjabi": "ਜੁੜੋ", "Malayalam": "ബന്ധിപ്പിക്കുക", "Odia": "ସଂଯୋଗ କରନ୍ତୁ"
    },
    "Pending": {
        "English": "Pending", "Hindi": "लंबित", "Kannada": "ಬಾಕಿ", "Tamil": "நிலுவையில்", "Telugu": "పెండింగ్", "Marathi": "प्रलंबित", "Bengali": "মুলতুবি", "Gujarati": "બાકી", "Punjabi": "ਬਕਾਇਆ", "Malayalam": "തീർപ്പുകൽപ്പിക്കാത്ത", "Odia": "ବିଚାରାଧୀନ"
    },
    "Message": {
        "English": "Message", "Hindi": "संदेश", "Kannada": "ಸಂದೇಶ", "Tamil": "செய்தி", "Telugu": "సందేశం", "Marathi": "संदेश", "Bengali": "বার্তা", "Gujarati": "સંદેશ", "Punjabi": "ਸੁਨੇਹਾ", "Malayalam": "സന്ദേശം", "Odia": "ସନ୍ଦେଶ"
    },
    "Professional Certifications": {
        "English": "Professional Certifications", "Hindi": "व्यावसायिक प्रमाणपत्र", "Kannada": "ವೃತ್ತಿಪರ ಪ್ರಮಾಣಪತ್ರಗಳು", "Tamil": "தொழில்முறை சான்றிதழ்கள்", "Telugu": "వృత్తిపరమైన సర్టిఫికేట్‌లు", "Marathi": "व्यावसायिक प्रमाणपत्रे", "Bengali": "পেশাদার সার্টিফিকেট", "Gujarati": "વ્યાવસાયિક પ્રમાણપત્રો", "Punjabi": "ਪੇਸ਼ੇਵਰ ਪ੍ਰਮਾਣ ਪੱਤਰ", "Malayalam": "പ്രൊഫഷണൽ സർട്ടിഫിക്കറ്റുകൾ", "Odia": "ବୃତ୍ତିଗତ ସାର୍ଟିଫିକେଟ୍"
    },
    "Government and institutional recognized records.": {
        "English": "Government and institutional recognized records.", "Hindi": "सरकारी और संस्थागत मान्यता प्राप्त रिकॉर्ड।", "Kannada": "ಸರ್ಕಾರಿ ಮತ್ತು ಸಾಂಸ್ಥಿಕ ಮಾನ್ಯತೆ ಪಡೆದ ದಾಖಲೆಗಳು.", "Tamil": "அரசு மற்றும் நிறுவன அங்கீகரிக்கப்பட்ட பதிவுகள்.", "Telugu": "ప్రభుత్వ మరియు సంస్థాగత గుర్తింపు పొందిన రికార్డులు.", "Marathi": "सरकारी आणि संस्थात्मक मान्यताप्राप्त नोंदी.", "Bengali": "সরকারি এবং প্রাতিষ্ঠানিক স্বীকৃত রেকর্ড।", "Gujarati": "સરકારી અને સંસ્થાકીય માન્યતા પ્રાપ્ત રેકોર્ડ.", "Punjabi": "ਸਰਕਾਰੀ ਅਤੇ ਸੰਸਥਾਗਤ ਮਾਨਤਾ ਪ੍ਰਾਪਤ ਰਿਕਾਰਡ।", "Malayalam": "സർക്കാർ, സ്ഥാപന അംഗീകൃത രേഖകൾ.", "Odia": "ସରକାରୀ ଏବଂ ସାଂସ୍ଥାନିକ ସ୍ୱୀକୃତି ପ୍ରାପ୍ତ ରେକର୍ଡ।"
    },
    "Add New": {
        "English": "Add New", "Hindi": "नया जोड़ें", "Kannada": "ಹೊಸದನ್ನು ಸೇರಿಸಿ", "Tamil": "புதியதைச் சேர்", "Telugu": "కొత్తది జోడించండి", "Marathi": "नवीन जोडा", "Bengali": "নতুন যোগ করুন", "Gujarati": "નવું ઉમેરો", "Punjabi": "ਨਵਾਂ ਜੋੜੋ", "Malayalam": "പുതിയത് ചേർക്കുക", "Odia": "ନୂତନ ଯୋଗ କରନ୍ତୁ"
    },
    "No verified certifications found": {
        "English": "No verified certifications found", "Hindi": "कोई सत्यापित प्रमाणपत्र नहीं मिला", "Kannada": "ಪರಿಶೀಲಿಸಿದ ಯಾವುದೇ ಪ್ರಮಾಣಪತ್ರಗಳು ಸಿಗಲಿಲ್ಲ", "Tamil": "சரிபார்க்கப்பட்ட சான்றிதழ்கள் இல்லை", "Telugu": "ధృవీకరించబడిన సర్టిఫికేట్‌లు కనుగొనబడలేదు", "Marathi": "सत्यापित प्रमाणपत्रे सापडली नाहीत", "Bengali": "কোনো যাচাইকৃত সার্টিফিকেট পাওয়া যায়নি", "Gujarati": "કોઈ ચકાસાયેલ પ્રમાણપત્રો મળ્યા નથી", "Punjabi": "ਕੋਈ ਪ੍ਰਮਾਣਿਤ ਪ੍ਰਮਾਣ ਪੱਤਰ ਨਹੀਂ ਮਿਲੇ", "Malayalam": "സ്ഥിരീകരിച്ച സർട്ടിഫിക്കറ്റുകളൊന്നും കണ്ടെത്തിയില്ല", "Odia": "କୌଣସି ଯାଞ୍ଚିତ ସାର୍ଟିଫିକେଟ୍ ମିଳିଲା ନାହିଁ"
    },
    "Verified educator credentials build trust in the community.": {
        "English": "Verified educator credentials build trust in the community.", "Hindi": "सत्यापित शिक्षक प्रमाण समुदाय में विश्वास बनाते हैं।", "Kannada": "ಪರಿಶೀಲಿಸಿದ ಶಿಕ್ಷಕ ಪ್ರಮಾಣಪತ್ರಗಳು ಸಮುದಾಯದಲ್ಲಿ ನಂಬಿಕೆಯನ್ನು ಬೆಳೆಸುತ್ತವೆ.", "Tamil": "சரிபார்க்கப்பட்ட ஆசிரியர் சான்றுகள் சமூகத்தில் நம்பிக்கையை வளர்க்கின்றன.", "Telugu": "ధృవీకరించబడిన ఉపాధ్యాయ ధృవపత్రాలు సంఘంలో నమ్మకాన్ని పెంచుతాయి.", "Marathi": "सत्यापित शिक्षक प्रमाणपत्रे समुदायात विश्वास निर्माण करतात.", "Bengali": "যাচাইকৃত শিক্ষক পরিচয়পত্র সম্প্রদায়ে আস্থা গড়ে তোলে।", "Gujarati": "ચકાસાયેલ શિક્ષક ઓળખપત્રો સમુદાયમાં વિશ્વાસ બનાવે છે.", "Punjabi": "ਪ੍ਰਮਾਣਿਤ ਅਧਿਆਪਕ ਪ੍ਰਮਾਣ ਪੱਤਰ ਭਾਈਚਾਰੇ ਵਿੱਚ ਭਰੋਸਾ ਬਣਾਉਂਦੇ ਹਨ।", "Malayalam": "സ്ഥിരീകരിച്ച അധ്യാപക യോഗ്യതാപത്രങ്ങൾ കമ്മ്യൂണിറ്റിയിൽ വിശ്വാസം വളർത്തുന്നു.", "Odia": "ଯାଞ୍ଚିତ ଶିକ୍ଷକ ପ୍ରମାଣପତ୍ର ସମ୍ପ୍ରଦାୟରେ ବିଶ୍ୱାସ ସୃଷ୍ଟି କରେ।"
    },
    "Start Verification": {
        "English": "Start Verification", "Hindi": "सत्यापन शुरू करें", "Kannada": "ಪರಿಶೀಲನೆ ಪ್ರಾರಂಭಿಸಿ", "Tamil": "சரிபார்ப்பைத் தொடங்கு", "Telugu": "ధృవీకరణను ప్రారంభించండి", "Marathi": "सत्यापन सुरू करा", "Bengali": "যাচাইকরণ শুরু করুন", "Gujarati": "ચકાસણી શરૂ કરો", "Punjabi": "ਤਸਦੀਕ ਸ਼ੁਰੂ ਕਰੋ", "Malayalam": "സ്ഥിരീകരണം ആരംഭിക്കുക", "Odia": "ଯାଞ୍ଚ ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Recently": {
        "English": "Recently", "Hindi": "हाल ही में", "Kannada": "ಇತ್ತೀಚೆಗೆ", "Tamil": "சமீபத்தில்", "Telugu": "ఇటీవల", "Marathi": "अलीकडे", "Bengali": "সম্প্রতি", "Gujarati": "તાજેતરમાં", "Punjabi": "ਹਾਲ ਹੀ ਵਿੱਚ", "Malayalam": "അടുത്തിടെ", "Odia": "ସମ୍ପ୍ରତି"
    },
    "Participated in Educator Hub": {
        "English": "Participated in Educator Hub", "Hindi": "एडुकेटर हब में भाग लिया", "Kannada": "ಶಿಕ್ಷಕ ಹಬ್‌ನಲ್ಲಿ ಭಾಗವಹಿಸಿದರು", "Tamil": "ஆசிரியர் மையத்தில் பங்கேற்றார்", "Telugu": "ఎడ్యుకేటర్ హబ్‌లో పాల్గొన్నారు", "Marathi": "एज्युकेटर हबमध्ये सहभागी", "Bengali": "এডুকেটর হাবে অংশগ্রহণ করেছেন", "Gujarati": "એજ્યુકેટર હબમાં ભાગ લીધો", "Punjabi": "ਐਜੂਕੇਟਰ ਹੱਬ ਵਿੱਚ ਹਿੱਸਾ ਲਿਆ", "Malayalam": "എഡ്യൂക്കേറ്റർ ഹബിൽ പങ്കെടുത്തു", "Odia": "ଏଡୁକେଟର ହବରେ ଭାଗ ନେଲେ"
    },
    "Help others grow!": {
        "English": "Help others grow!", "Hindi": "दूसरों को बढ़ने में मदद करें!", "Kannada": "ಇತರರಿಗೆ ಬೆಳೆಯಲು ಸಹಾಯ ಮಾಡಿ!", "Tamil": "மற்றவர்கள் வளர உதவுங்கள்!", "Telugu": "ఇతరులు పెరగడంలో సహాయపడండి!", "Marathi": "इतरांना वाढण्यात मदत करा!", "Bengali": "অন্যদের বৃদ্ধিতে সাহায্য করুন!", "Gujarati": "બીજાને વધવામાં મદદ કરો!", "Punjabi": "ਦੂਜਿਆਂ ਨੂੰ ਵਧਣ ਵਿੱਚ ਮਦਦ ਕਰੋ!", "Malayalam": "മറ്റുള്ളവരെ വളരാൻ സഹായിക്കുക!", "Odia": "ଅନ୍ୟମାନଙ୍କୁ ବଢ଼ିବାରେ ସାହାଯ୍ୟ କରନ୍ତୁ!"
    },
    "Your teaching experience is invaluable. Join the TeacherConnect network to share your lesson plans.": {
        "English": "Your teaching experience is invaluable. Join the TeacherConnect network to share your lesson plans.", "Hindi": "आपका शिक्षण अनुभव अमूल्य है। अपनी पाठ योजनाएं साझा करने के लिए TeacherConnect नेटवर्क से जुड़ें।", "Kannada": "ನಿಮ್ಮ ಬೋಧನಾ ಅನುಭವ ಅಮೂಲ್ಯವಾಗಿದೆ. ನಿಮ್ಮ ಪಾಠ ಯೋಜನೆಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಲು TeacherConnect ನೆಟ್‌ವರ್ಕ್‌ಗೆ ಸೇರಿ.", "Tamil": "உங்கள் கற்பித்தல் அனுபவம் விலைமதிப்பற்றது. உங்கள் பாடம் திட்டங்களைப் பகிர TeacherConnect நெட்வொர்க்கில் சேருங்கள்.", "Telugu": "మీ బోధనా అనుభవం అమూల్యమైనది. మీ పాఠ ప్రణాళికలను పంచుకోవడానికి TeacherConnect నెట్‌వర్క్‌లో చేరండి.", "Marathi": "तुमचा शिक्षण अनुभव अमूल्य आहे. तुमच्या पाठ योजना सामायिक करण्यासाठी TeacherConnect नेटवर्कमध्ये सामील व्हा.", "Bengali": "আপনার শিক্ষাদান অভিজ্ঞতা অমূল্য। আপনার পাঠ পরিকল্পনা শেয়ার করতে TeacherConnect নেটওয়ার্কে যোগ দিন।", "Gujarati": "તમારો શિક્ષણ અનુભવ અમૂલ્ય છે. તમારી પાઠ યોજનાઓ શેર કરવા માટે TeacherConnect નેટવર્કમાં જોડાઓ.", "Punjabi": "ਤੁਹਾਡਾ ਅਧਿਆਪਨ ਅਨੁਭਵ ਅਨਮੋਲ ਹੈ। ਆਪਣੀਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ ਸਾਂਝੀਆਂ ਕਰਨ ਲਈ TeacherConnect ਨੈੱਟਵਰਕ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ।", "Malayalam": "നിങ്ങളുടെ അധ്യാപന അനുഭവം അമൂല്യമാണ്. നിങ്ങളുടെ പാഠ്യപദ്ധതികൾ പങ്കിടാൻ TeacherConnect നെറ്റ്‌വർക്കിൽ ചേരുക.", "Odia": "ଆପଣଙ୍କର ଶିକ୍ଷାଦାନ ଅଭିଜ୍ଞତା ଅମୂଲ୍ୟ। ଆପଣଙ୍କ ପାଠ ଯୋଜନା ସେୟାର କରିବାକୁ TeacherConnect ନେଟୱର୍କରେ ଯୋଗ ଦିଅନ୍ତୁ।"
    },
    "Enable Activity Feed": {
        "English": "Enable Activity Feed", "Hindi": "गतिविधि फ़ीड सक्षम करें", "Kannada": "ಚಟುವಟಿಕೆ ಫೀಡ್ ಸಕ್ರಿಯಗೊಳಿಸಿ", "Tamil": "செயல்பாட்டு ஊட்டத்தை இயக்கு", "Telugu": "కార్యాచరణ ఫీడ్‌ను ప్రారంభించండి", "Marathi": "क्रियाकलाप फीड सक्षम करा", "Bengali": "কার্যকলাপ ফিড সক্ষম করুন", "Gujarati": "પ્રવૃત્તિ ફીડ સક્ષમ કરો", "Punjabi": "ਗਤੀਵਿਧੀ ਫੀਡ ਨੂੰ ਚਾਲੂ ਕਰੋ", "Malayalam": "പ്രവർത്തന ഫീഡ് പ്രവർത്തനക്ഷമമാക്കുക", "Odia": "କାର୍ଯ୍ୟକଳାପ ଫିଡ୍ ସକ୍ଷମ କରନ୍ତୁ"
    },
    // === Wave 2: Video Storyteller categories ===
    "Top Recommended for You": {
        "English": "Top Recommended for You", "Hindi": "आपके लिए शीर्ष अनुशंसित", "Kannada": "ನಿಮಗಾಗಿ ಉನ್ನತ ಶಿಫಾರಸುಗಳು", "Tamil": "உங்களுக்கான சிறந்த பரிந்துரைகள்", "Telugu": "మీ కోసం ఉత్తమ సిఫార్సులు", "Marathi": "तुमच्यासाठी सर्वोत्तम शिफारसी", "Bengali": "আপনার জন্য শীর্ষ প্রস্তাবিত", "Gujarati": "તમારા માટે ટોચની ભલામણો", "Punjabi": "ਤੁਹਾਡੇ ਲਈ ਚੋਟੀ ਦੀਆਂ ਸਿਫਾਰਸ਼ਾਂ", "Malayalam": "നിങ്ങൾക്കായി മികച്ച ശുപാർശകൾ", "Odia": "ଆପଣଙ୍କ ପାଇଁ ଶୀର୍ଷ ସୁପାରିଶଗୁଡ଼ିକ"
    },
    "Storytelling for Your Subjects": {
        "English": "Storytelling for Your Subjects", "Hindi": "आपके विषयों के लिए कहानी सुनाना", "Kannada": "ನಿಮ್ಮ ವಿಷಯಗಳಿಗಾಗಿ ಕಥೆ ಹೇಳುವಿಕೆ", "Tamil": "உங்கள் பாடங்களுக்கான கதை சொல்லல்", "Telugu": "మీ సబ్జెక్టుల కోసం కథలు చెప్పడం", "Marathi": "तुमच्या विषयांसाठी कथाकथन", "Bengali": "আপনার বিষয়ের জন্য গল্প বলা", "Gujarati": "તમારા વિષયો માટે વાર્તા કહેવી", "Punjabi": "ਤੁਹਾਡੇ ਵਿਸ਼ਿਆਂ ਲਈ ਕਹਾਣੀ ਸੁਣਾਉਣਾ", "Malayalam": "നിങ്ങളുടെ വിഷയങ്ങൾക്കായി കഥപറച്ചിൽ", "Odia": "ଆପଣଙ୍କ ବିଷୟ ପାଇଁ କାହାଣୀ କହିବା"
    },
    "Pedagogy & Teaching Methods": {
        "English": "Pedagogy & Teaching Methods", "Hindi": "शिक्षाशास्त्र और शिक्षण विधियाँ", "Kannada": "ಶಿಕ್ಷಣಶಾಸ್ತ್ರ ಮತ್ತು ಬೋಧನಾ ವಿಧಾನಗಳು", "Tamil": "கல்வியியல் & கற்பித்தல் முறைகள்", "Telugu": "బోధనా శాస్త్రం & బోధనా పద్ధతులు", "Marathi": "अध्यापनशास्त्र आणि शिक्षण पद्धती", "Bengali": "শিক্ষাশাস্ত্র ও শিক্ষণ পদ্ধতি", "Gujarati": "શિક્ષણશાસ્ત્ર અને શિક્ષણ પદ્ધતિઓ", "Punjabi": "ਸਿੱਖਿਆ ਸ਼ਾਸਤਰ ਅਤੇ ਅਧਿਆਪਨ ਵਿਧੀਆਂ", "Malayalam": "പെഡഗോഗി & അധ്യാപന രീതികൾ", "Odia": "ଶିକ୍ଷାଶାସ୍ତ୍ର ଓ ଶିକ୍ଷାଦାନ ପଦ୍ଧତି"
    },
    "Government Updates": {
        "English": "Government Updates", "Hindi": "सरकारी अपडेट", "Kannada": "ಸರ್ಕಾರಿ ನವೀಕರಣಗಳು", "Tamil": "அரசு புதுப்பிப்புகள்", "Telugu": "ప్రభుత్వ నవీకరణలు", "Marathi": "सरकारी अद्यतने", "Bengali": "সরকারি আপডেট", "Gujarati": "સરકારી અપડેટ્સ", "Punjabi": "ਸਰਕਾਰੀ ਅੱਪਡੇਟ", "Malayalam": "സർക്കാർ അപ്ഡേറ്റുകൾ", "Odia": "ସରକାରୀ ଅଦ୍ୟତନଗୁଡ଼ିକ"
    },
    "Teacher Training Courses": {
        "English": "Teacher Training Courses", "Hindi": "शिक्षक प्रशिक्षण पाठ्यक्रम", "Kannada": "ಶಿಕ್ಷಕ ತರಬೇತಿ ಕೋರ್ಸ್‌ಗಳು", "Tamil": "ஆசிரியர் பயிற்சி பாடநெறிகள்", "Telugu": "ఉపాధ్యాయ శిక్షణా కోర్సులు", "Marathi": "शिक्षक प्रशिक्षण अभ्यासक्रम", "Bengali": "শিক্ষক প্রশিক্ষণ কোর্স", "Gujarati": "શિક્ષક તાલીમ અભ્યાસક્રમો", "Punjabi": "ਅਧਿਆਪਕ ਸਿਖਲਾਈ ਕੋਰਸ", "Malayalam": "അധ്യാപക പരിശീലന കോഴ്സുകൾ", "Odia": "ଶିକ୍ଷକ ତାଲିମ୍ ପାଠ୍ୟକ୍ରମ"
    },
    // === Wave 2: Lesson Plan paywall toasts ===
    "Pro Feature": {
        "English": "Pro Feature", "Hindi": "प्रो सुविधा", "Kannada": "Pro ವೈಶಿಷ್ಟ್ಯ", "Tamil": "Pro அம்சம்", "Telugu": "Pro ఫీచర్", "Marathi": "Pro वैशिष्ट्य", "Bengali": "Pro বৈশিষ্ট্য", "Gujarati": "Pro સુવિધા", "Punjabi": "Pro ਵਿਸ਼ੇਸ਼ਤਾ", "Malayalam": "Pro ഫീച്ചർ", "Odia": "Pro ବୈଶିଷ୍ଟ୍ୟ"
    },
    "Upgrade to Pro to copy and export lesson plans.": {
        "English": "Upgrade to Pro to copy and export lesson plans.", "Hindi": "पाठ योजनाओं को कॉपी और निर्यात करने के लिए Pro में अपग्रेड करें।", "Kannada": "ಪಾಠ ಯೋಜನೆಗಳನ್ನು ನಕಲಿಸಲು ಮತ್ತು ರಫ್ತು ಮಾಡಲು Pro ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.", "Tamil": "பாடம் திட்டங்களை நகலெடுக்கவும் ஏற்றுமதி செய்யவும் Pro-வுக்கு மேம்படுத்தவும்.", "Telugu": "పాఠ ప్రణాళికలను కాపీ చేయడానికి మరియు ఎగుమతి చేయడానికి Proకి అప్‌గ్రేడ్ చేయండి.", "Marathi": "पाठ योजना कॉपी आणि निर्यात करण्यासाठी Pro वर अपग्रेड करा.", "Bengali": "পাঠ পরিকল্পনা কপি এবং রপ্তানি করতে Pro-তে আপগ্রেড করুন।", "Gujarati": "પાઠ યોજનાઓ કૉપિ અને નિકાસ કરવા માટે Proમાં અપગ્રેડ કરો.", "Punjabi": "ਪਾਠ ਯੋਜਨਾਵਾਂ ਨੂੰ ਕਾਪੀ ਕਰਨ ਅਤੇ ਨਿਰਯਾਤ ਕਰਨ ਲਈ Pro ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰੋ।", "Malayalam": "പാഠ്യപദ്ധതികൾ പകർത്താനും കയറ്റുമതി ചെയ്യാനും Pro ലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യുക.", "Odia": "ପାଠ ଯୋଜନା କପି ଏବଂ ରପ୍ତାନି କରିବାକୁ Pro କୁ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ।"
    },
    "Upgrade to Pro to download PDF.": {
        "English": "Upgrade to Pro to download PDF.", "Hindi": "PDF डाउनलोड करने के लिए Pro में अपग्रेड करें।", "Kannada": "PDF ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು Pro ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.", "Tamil": "PDF பதிவிறக்கம் செய்ய Pro-வுக்கு மேம்படுத்தவும்.", "Telugu": "PDF డౌన్‌లోడ్ చేయడానికి Proకి అప్‌గ్రేడ్ చేయండి.", "Marathi": "PDF डाउनलोड करण्यासाठी Pro वर अपग्रेड करा.", "Bengali": "PDF ডাউনলোড করতে Pro-তে আপগ্রেড করুন।", "Gujarati": "PDF ડાઉનલોડ કરવા માટે Proમાં અપગ્રેડ કરો.", "Punjabi": "PDF ਡਾਊਨਲੋਡ ਕਰਨ ਲਈ Pro ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰੋ।", "Malayalam": "PDF ഡൗൺലോഡ് ചെയ്യാൻ Pro ലേക്ക് അപ്‌ഗ്രേഡ് ചെയ്യുക.", "Odia": "PDF ଡାଉନଲୋଡ୍ କରିବାକୁ Pro କୁ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ।"
    },
    // === Wave 2: Exam Paper ===
    "Board Exam Paper Generator": {
        "English": "Board Exam Paper Generator", "Hindi": "बोर्ड परीक्षा पेपर जनरेटर", "Kannada": "ಬೋರ್ಡ್ ಪರೀಕ್ಷಾ ಪತ್ರಿಕೆ ಜನರೇಟರ್", "Tamil": "வாரிய தேர்வுத் தாள் ஜெனரேட்டர்", "Telugu": "బోర్డు పరీక్షా పేపర్ జనరేటర్", "Marathi": "बोर्ड परीक्षा पेपर जनरेटर", "Bengali": "বোর্ড পরীক্ষার পেপার জেনারেটর", "Gujarati": "બોર્ડ પરીક્ષા પેપર જનરેટર", "Punjabi": "ਬੋਰਡ ਪ੍ਰੀਖਿਆ ਪੇਪਰ ਜਨਰੇਟਰ", "Malayalam": "ബോർഡ് പരീക്ഷാ പേപ്പർ ജനറേറ്റർ", "Odia": "ବୋର୍ଡ ପରୀକ୍ଷା ପେପର ଜେନେରେଟର"
    },
    "Generate board-pattern question papers with answer keys": {
        "English": "Generate board-pattern question papers with answer keys", "Hindi": "उत्तर कुंजी के साथ बोर्ड-पैटर्न प्रश्न पत्र बनाएं", "Kannada": "ಉತ್ತರ ಕೀಲಿಯೊಂದಿಗೆ ಬೋರ್ಡ್-ಮಾದರಿಯ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸಿ", "Tamil": "பதில் சாவியுடன் வாரிய-முறை வினாத்தாள்களை உருவாக்கவும்", "Telugu": "సమాధాన కీలతో బోర్డు-నమూనా ప్రశ్నపత్రాలను రూపొందించండి", "Marathi": "उत्तर कीसह बोर्ड-नमुना प्रश्नपत्रिका तयार करा", "Bengali": "উত্তর কী সহ বোর্ড-প্যাটার্ন প্রশ্নপত্র তৈরি করুন", "Gujarati": "ઉત્તર કી સાથે બોર્ડ-પેટર્ન પ્રશ્નપત્ર બનાવો", "Punjabi": "ਉੱਤਰ ਕੁੰਜੀ ਨਾਲ ਬੋਰਡ-ਪੈਟਰਨ ਪ੍ਰਸ਼ਨ ਪੱਤਰ ਬਣਾਓ", "Malayalam": "ഉത്തര കീ സഹിതം ബോർഡ്-മാതൃകാ ചോദ്യപേപ്പറുകൾ സൃഷ്ടിക്കുക", "Odia": "ଉତ୍ତର କୀ ସହିତ ବୋର୍ଡ-ପ୍ୟାଟର୍ନ ପ୍ରଶ୍ନ ପତ୍ର ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "Board": {
        "English": "Board", "Hindi": "बोर्ड", "Kannada": "ಬೋರ್ಡ್", "Tamil": "வாரியம்", "Telugu": "బోర్డు", "Marathi": "बोर्ड", "Bengali": "বোর্ড", "Gujarati": "બોર્ડ", "Punjabi": "ਬੋਰਡ", "Malayalam": "ബോർഡ്", "Odia": "ବୋର୍ଡ"
    },
    "No blueprint for": {
        "English": "No blueprint for", "Hindi": "के लिए कोई ब्लूप्रिंट नहीं", "Kannada": "ಗಾಗಿ ಬ್ಲೂಪ್ರಿಂಟ್ ಇಲ್ಲ", "Tamil": "க்கான வரைபடம் இல்லை", "Telugu": "కోసం బ్లూప్రింట్ లేదు", "Marathi": "साठी कोणताही ब्लूप्रिंट नाही", "Bengali": "এর জন্য কোনো ব্লুপ্রিন্ট নেই", "Gujarati": "માટે કોઈ બ્લુપ્રિન્ટ નથી", "Punjabi": "ਲਈ ਕੋਈ ਬਲੂਪ੍ਰਿੰਟ ਨਹੀਂ", "Malayalam": "നായി ബ്ലൂപ്രിന്റ് ഇല്ല", "Odia": "ପାଇଁ କୌଣସି ବ୍ଲୁପ୍ରିଣ୍ଟ ନାହିଁ"
    },
    "AI will generate a standard pattern.": {
        "English": "AI will generate a standard pattern.", "Hindi": "AI एक मानक पैटर्न तैयार करेगा।", "Kannada": "AI ಪ್ರಮಾಣಿತ ಮಾದರಿಯನ್ನು ರಚಿಸುತ್ತದೆ.", "Tamil": "AI ஒரு நிலையான வடிவத்தை உருவாக்கும்.", "Telugu": "AI ఒక ప్రామాణిక నమూనాను రూపొందిస్తుంది.", "Marathi": "AI एक मानक नमुना तयार करेल.", "Bengali": "AI একটি মানক প্যাটার্ন তৈরি করবে।", "Gujarati": "AI એક પ્રમાણભૂત પેટર્ન બનાવશે.", "Punjabi": "AI ਇੱਕ ਮਿਆਰੀ ਪੈਟਰਨ ਬਣਾਏਗਾ।", "Malayalam": "AI ഒരു സ്റ്റാൻഡേർഡ് പാറ്റേൺ സൃഷ്ടിക്കും.", "Odia": "AI ଏକ ମାନକ ପ୍ୟାଟର୍ନ ସୃଷ୍ଟି କରିବ।"
    },
    "Chapters": {
        "English": "Chapters", "Hindi": "अध्याय", "Kannada": "ಅಧ್ಯಾಯಗಳು", "Tamil": "அத்தியாயங்கள்", "Telugu": "అధ్యాయాలు", "Marathi": "अध्याय", "Bengali": "অধ্যায়সমূহ", "Gujarati": "પ્રકરણો", "Punjabi": "ਅਧਿਆਏ", "Malayalam": "അധ്യായങ്ങൾ", "Odia": "ଅଧ୍ୟାୟଗୁଡ଼ିକ"
    },
    "(optional — select from list or type below)": {
        "English": "(optional — select from list or type below)", "Hindi": "(वैकल्पिक — सूची से चुनें या नीचे टाइप करें)", "Kannada": "(ಐಚ್ಛಿಕ — ಪಟ್ಟಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ)", "Tamil": "(விருப்பப்படி — பட்டியலிலிருந்து தேர்வுசெய்யவும் அல்லது கீழே தட்டச்சு செய்யவும்)", "Telugu": "(ఐచ్ఛికం — జాబితా నుండి ఎంచుకోండి లేదా క్రింద టైప్ చేయండి)", "Marathi": "(ऐच्छिक — यादीतून निवडा किंवा खाली टाइप करा)", "Bengali": "(ঐচ্ছিক — তালিকা থেকে নির্বাচন করুন বা নিচে টাইপ করুন)", "Gujarati": "(વૈકલ્પિક — સૂચિમાંથી પસંદ કરો અથવા નીચે ટાઇપ કરો)", "Punjabi": "(ਵਿਕਲਪਿਕ — ਸੂਚੀ ਵਿੱਚੋਂ ਚੁਣੋ ਜਾਂ ਹੇਠਾਂ ਟਾਈਪ ਕਰੋ)", "Malayalam": "(ഓപ്ഷണൽ — ലിസ്റ്റിൽ നിന്ന് തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ താഴെ ടൈപ്പ് ചെയ്യുക)", "Odia": "(ବିକଳ୍ପ — ତାଲିକାରୁ ବାଛନ୍ତୁ କିମ୍ବା ତଳେ ଟାଇପ୍ କରନ୍ତୁ)"
    },
    "selected": {
        "English": "selected", "Hindi": "चयनित", "Kannada": "ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ", "Tamil": "தேர்ந்தெடுக்கப்பட்டது", "Telugu": "ఎంచుకోబడింది", "Marathi": "निवडले", "Bengali": "নির্বাচিত", "Gujarati": "પસંદ કરેલ", "Punjabi": "ਚੁਣੇ ਗਏ", "Malayalam": "തിരഞ്ഞെടുത്തു", "Odia": "ବଛାଯାଇଛି"
    },
    "Clear all": {
        "English": "Clear all", "Hindi": "सभी हटाएं", "Kannada": "ಎಲ್ಲವನ್ನೂ ತೆಗೆದುಹಾಕಿ", "Tamil": "அனைத்தையும் அழி", "Telugu": "అన్నీ క్లియర్ చేయండి", "Marathi": "सर्व काढा", "Bengali": "সব মুছুন", "Gujarati": "બધું સાફ કરો", "Punjabi": "ਸਭ ਸਾਫ਼ ਕਰੋ", "Malayalam": "എല്ലാം മായ്ക്കുക", "Odia": "ସବୁ ସଫା କରନ୍ତୁ"
    },
    "Include Answer Key": {
        "English": "Include Answer Key", "Hindi": "उत्तर कुंजी शामिल करें", "Kannada": "ಉತ್ತರ ಕೀಲಿಯನ್ನು ಸೇರಿಸಿ", "Tamil": "பதில் சாவியை சேர்க்கவும்", "Telugu": "సమాధాన కీని చేర్చండి", "Marathi": "उत्तर की समाविष्ट करा", "Bengali": "উত্তর কী অন্তর্ভুক্ত করুন", "Gujarati": "ઉત્તર કી શામેલ કરો", "Punjabi": "ਉੱਤਰ ਕੁੰਜੀ ਸ਼ਾਮਲ ਕਰੋ", "Malayalam": "ഉത്തര കീ ഉൾപ്പെടുത്തുക", "Odia": "ଉତ୍ତର କୀ ଅନ୍ତର୍ଭୁକ୍ତ କରନ୍ତୁ"
    },
    "Include Marking Scheme": {
        "English": "Include Marking Scheme", "Hindi": "अंकन योजना शामिल करें", "Kannada": "ಅಂಕ ಹಂಚಿಕೆ ಯೋಜನೆಯನ್ನು ಸೇರಿಸಿ", "Tamil": "மதிப்பெண் திட்டத்தை சேர்க்கவும்", "Telugu": "మార్కింగ్ స్కీమ్‌ను చేర్చండి", "Marathi": "गुण योजना समाविष्ट करा", "Bengali": "মার্কিং স্কিম অন্তর্ভুক্ত করুন", "Gujarati": "માર્કિંગ સ્કીમ શામેલ કરો", "Punjabi": "ਅੰਕ ਦੇਣ ਦੀ ਯੋਜਨਾ ਸ਼ਾਮਲ ਕਰੋ", "Malayalam": "മാർക്കിംഗ് സ്കീം ഉൾപ്പെടുത്തുക", "Odia": "ମାର୍କିଂ ସ୍କିମ୍ ଅନ୍ତର୍ଭୁକ୍ତ କରନ୍ତୁ"
    },
    "Generating your exam paper...": {
        "English": "Generating your exam paper...", "Hindi": "आपका परीक्षा पेपर बन रहा है...", "Kannada": "ನಿಮ್ಮ ಪರೀಕ್ಷಾ ಪತ್ರಿಕೆಯನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "உங்கள் தேர்வுத் தாள் உருவாக்கப்படுகிறது...", "Telugu": "మీ పరీక్షా పేపర్‌ను రూపొందిస్తోంది...", "Marathi": "तुमचा परीक्षा पेपर तयार होत आहे...", "Bengali": "আপনার পরীক্ষার পেপার তৈরি হচ্ছে...", "Gujarati": "તમારું પરીક્ષા પેપર બની રહ્યું છે...", "Punjabi": "ਤੁਹਾਡਾ ਪ੍ਰੀਖਿਆ ਪੇਪਰ ਬਣ ਰਿਹਾ ਹੈ...", "Malayalam": "നിങ്ങളുടെ പരീക്ഷാ പേപ്പർ സൃഷ്ടിക്കുന്നു...", "Odia": "ଆପଣଙ୍କ ପରୀକ୍ଷା ପେପର ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Generate Paper": {
        "English": "Generate Paper", "Hindi": "पेपर बनाएं", "Kannada": "ಪತ್ರಿಕೆ ರಚಿಸಿ", "Tamil": "தாளை உருவாக்கு", "Telugu": "పేపర్ రూపొందించండి", "Marathi": "पेपर तयार करा", "Bengali": "পেপার তৈরি করুন", "Gujarati": "પેપર બનાવો", "Punjabi": "ਪੇਪਰ ਬਣਾਓ", "Malayalam": "പേപ്പർ സൃഷ്ടിക്കുക", "Odia": "ପେପର ସୃଷ୍ଟି କରନ୍ତୁ"
    },
    "General Instructions": {
        "English": "General Instructions", "Hindi": "सामान्य निर्देश", "Kannada": "ಸಾಮಾನ್ಯ ಸೂಚನೆಗಳು", "Tamil": "பொது வழிமுறைகள்", "Telugu": "సాధారణ సూచనలు", "Marathi": "सामान्य सूचना", "Bengali": "সাধারণ নির্দেশাবলী", "Gujarati": "સામાન્ય સૂચનાઓ", "Punjabi": "ਆਮ ਹਦਾਇਤਾਂ", "Malayalam": "പൊതു നിർദ്ദേശങ്ങൾ", "Odia": "ସାଧାରଣ ନିର୍ଦ୍ଦେଶାବଳୀ"
    },
    "Answer Key": {
        "English": "Answer Key", "Hindi": "उत्तर कुंजी", "Kannada": "ಉತ್ತರ ಕೀಲಿ", "Tamil": "பதில் சாவி", "Telugu": "సమాధాన కీ", "Marathi": "उत्तर की", "Bengali": "উত্তর কী", "Gujarati": "ઉત્તર કી", "Punjabi": "ਉੱਤਰ ਕੁੰਜੀ", "Malayalam": "ഉത്തര കീ", "Odia": "ଉତ୍ତର କୀ"
    },
    "Marking Scheme": {
        "English": "Marking Scheme", "Hindi": "अंकन योजना", "Kannada": "ಅಂಕ ಹಂಚಿಕೆ ಯೋಜನೆ", "Tamil": "மதிப்பெண் திட்டம்", "Telugu": "మార్కింగ్ స్కీమ్", "Marathi": "गुण योजना", "Bengali": "মার্কিং স্কিম", "Gujarati": "માર્કિંગ સ્કીમ", "Punjabi": "ਅੰਕ ਦੇਣ ਦੀ ਯੋਜਨਾ", "Malayalam": "മാർക്കിംഗ് സ്കീം", "Odia": "ମାର୍କିଂ ସ୍କିମ୍"
    },
    "Blueprint Summary": {
        "English": "Blueprint Summary", "Hindi": "ब्लूप्रिंट सारांश", "Kannada": "ಬ್ಲೂಪ್ರಿಂಟ್ ಸಾರಾಂಶ", "Tamil": "வரைபடச் சுருக்கம்", "Telugu": "బ్లూప్రింట్ సారాంశం", "Marathi": "ब्लूप्रिंट सारांश", "Bengali": "ব্লুপ্রিন্ট সারসংক্ষেপ", "Gujarati": "બ્લુપ્રિન્ટ સારાંશ", "Punjabi": "ਬਲੂਪ੍ਰਿੰਟ ਸਾਰਾਂਸ਼", "Malayalam": "ബ്ലൂപ്രിന്റ് സംഗ്രഹം", "Odia": "ବ୍ଲୁପ୍ରିଣ୍ଟ ସାରାଂଶ"
    },
    "Chapter-wise": {
        "English": "Chapter-wise", "Hindi": "अध्याय-वार", "Kannada": "ಅಧ್ಯಾಯವಾರು", "Tamil": "அத்தியாயம்-வாரியாக", "Telugu": "అధ్యాయం వారీగా", "Marathi": "अध्यायानुसार", "Bengali": "অধ্যায়-অনুসারে", "Gujarati": "પ્રકરણ-વાર", "Punjabi": "ਅਧਿਆਇ-ਵਾਰ", "Malayalam": "അധ്യായം തിരിച്ച്", "Odia": "ଅଧ୍ୟାୟ-ୱାରୀ"
    },
    "Save to Library": {
        "English": "Save to Library", "Hindi": "लाइब्रेरी में सहेजें", "Kannada": "ಲೈಬ್ರರಿಗೆ ಉಳಿಸಿ", "Tamil": "நூலகத்தில் சேமி", "Telugu": "లైబ్రరీకి సేవ్ చేయండి", "Marathi": "लायब्ररीत जतन करा", "Bengali": "লাইব্রেরিতে সংরক্ষণ করুন", "Gujarati": "લાઈબ્રેરીમાં સાચવો", "Punjabi": "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੰਭਾਲੋ", "Malayalam": "ലൈബ്രറിയിലേക്ക് സേവ് ചെയ്യുക", "Odia": "ଲାଇବ୍ରେରୀରେ ସଞ୍ଚୟ କରନ୍ତୁ"
    },
    "PDF (Coming Soon)": {
        "English": "PDF (Coming Soon)", "Hindi": "PDF (जल्द आ रहा है)", "Kannada": "PDF (ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ)", "Tamil": "PDF (விரைவில் வருகிறது)", "Telugu": "PDF (త్వరలో వస్తోంది)", "Marathi": "PDF (लवकरच येत आहे)", "Bengali": "PDF (শীঘ্রই আসছে)", "Gujarati": "PDF (જલ્દી આવી રહ્યું છે)", "Punjabi": "PDF (ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ)", "Malayalam": "PDF (ഉടനെ വരുന്നു)", "Odia": "PDF (ଶୀଘ୍ର ଆସୁଛି)"
    },
    "No sections were generated. Please try again.": {
        "English": "No sections were generated. Please try again.", "Hindi": "कोई खंड उत्पन्न नहीं हुआ। कृपया पुनः प्रयास करें।", "Kannada": "ಯಾವುದೇ ವಿಭಾಗಗಳನ್ನು ರಚಿಸಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "எந்த பகுதியும் உருவாக்கப்படவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఏ విభాగాలు ఉత్పన్నం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "कोणतेही विभाग तयार झाले नाहीत. कृपया पुन्हा प्रयत्न करा.", "Bengali": "কোনো বিভাগ তৈরি হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "કોઈ વિભાગ બન્યો નથી. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਕੋਈ ਭਾਗ ਨਹੀਂ ਬਣਾਏ ਗਏ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "വിഭാഗങ്ങളൊന്നും സൃഷ്ടിച്ചിട്ടില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "କୌଣସି ବିଭାଗ ସୃଷ୍ଟି ହୋଇନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "PDF export coming soon": {
        "English": "PDF export coming soon", "Hindi": "PDF निर्यात जल्द ही आ रहा है", "Kannada": "PDF ರಫ್ತು ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ", "Tamil": "PDF ஏற்றுமதி விரைவில் வருகிறது", "Telugu": "PDF ఎగుమతి త్వరలో వస్తోంది", "Marathi": "PDF निर्यात लवकरच येत आहे", "Bengali": "PDF এক্সপোর্ট শীঘ্রই আসছে", "Gujarati": "PDF નિકાસ જલ્દી આવી રહી છે", "Punjabi": "PDF ਨਿਰਯਾਤ ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ", "Malayalam": "PDF കയറ്റുമതി ഉടനെ വരുന്നു", "Odia": "PDF ରପ୍ତାନି ଶୀଘ୍ର ଆସୁଛି"
    },
    "chapter": {
        "English": "chapter", "Hindi": "अध्याय", "Kannada": "ಅಧ್ಯಾಯ", "Tamil": "அத்தியாயம்", "Telugu": "అధ్యాయం", "Marathi": "अध्याय", "Bengali": "অধ্যায়", "Gujarati": "પ્રકરણ", "Punjabi": "ਅਧਿਆਇ", "Malayalam": "അധ്യായം", "Odia": "ଅଧ୍ୟାୟ"
    },
    "chapters": {
        "English": "chapters", "Hindi": "अध्याय", "Kannada": "ಅಧ್ಯಾಯಗಳು", "Tamil": "அத்தியாயங்கள்", "Telugu": "అధ్యాయాలు", "Marathi": "अध्याय", "Bengali": "অধ্যায়গুলি", "Gujarati": "પ્રકરણો", "Punjabi": "ਅਧਿਆਏ", "Malayalam": "അധ്യായങ്ങൾ", "Odia": "ଅଧ୍ୟାୟଗୁଡ଼ିକ"
    },
    // === Wave 2: Rubric Generator ===
    "Could not load the saved rubric.": {
        "English": "Could not load the saved rubric.", "Hindi": "सहेजी गई रूब्रिक लोड नहीं हो सकी।", "Kannada": "ಉಳಿಸಿದ ರೂಬ್ರಿಕ್ ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "சேமிக்கப்பட்ட ரூப்ரிக்கை ஏற்ற முடியவில்லை.", "Telugu": "సేవ్ చేసిన రుబ్రిక్‌ను లోడ్ చేయలేకపోయాము.", "Marathi": "जतन केलेली रुब्रिक लोड करता आली नाही.", "Bengali": "সংরক্ষিত রুব্রিক লোড করা যায়নি।", "Gujarati": "સાચવેલ રુબ્રિક લોડ થઈ શકી નથી.", "Punjabi": "ਸੰਭਾਲੀ ਰੁਬ੍ਰਿਕ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।", "Malayalam": "സേവ് ചെയ്ത റൂബ്രിക് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.", "Odia": "ସଞ୍ଚୟ ହୋଇଥିବା ରୁବ୍ରିକ୍ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।"
    },
    "There was an error generating the rubric. Please try again.": {
        "English": "There was an error generating the rubric. Please try again.", "Hindi": "रूब्रिक बनाने में त्रुटि हुई। कृपया पुनः प्रयास करें।", "Kannada": "ರೂಬ್ರಿಕ್ ರಚಿಸುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ரூப்ரிக்கை உருவாக்குவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "రుబ్రిక్ ఉత్పన్నం చేయడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "रुब्रिक तयार करण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "রুব্রিক তৈরি করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "રુબ્રિક બનાવવામાં ભૂલ થઈ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਰੁਬ੍ਰਿਕ ਬਣਾਉਣ ਵਿੱਚ ਗਲਤੀ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "റൂബ്രിക് സൃഷ്ടിക്കുന്നതിൽ പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରୁବ୍ରିକ୍ ସୃଷ୍ଟି କରିବାରେ ତ୍ରୁଟି ହୋଇଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Wave 2: Visual Aid Designer ===
    "Already in Library": {
        "English": "Already in Library", "Hindi": "पहले से ही लाइब्रेरी में", "Kannada": "ಈಗಾಗಲೇ ಲೈಬ್ರರಿಯಲ್ಲಿದೆ", "Tamil": "ஏற்கனவே நூலகத்தில் உள்ளது", "Telugu": "ఇప్పటికే లైబ్రరీలో ఉంది", "Marathi": "आधीच लायब्ररीत आहे", "Bengali": "ইতিমধ্যে লাইব্রেরিতে আছে", "Gujarati": "પહેલેથી જ લાઈબ્રેરીમાં છે", "Punjabi": "ਪਹਿਲਾਂ ਹੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਹੈ", "Malayalam": "ഇതിനകം ലൈബ്രറിയിലുണ്ട്", "Odia": "ପୂର୍ବରୁ ଲାଇବ୍ରେରୀରେ ଅଛି"
    },
    "This visual aid was saved automatically when generated.": {
        "English": "This visual aid was saved automatically when generated.", "Hindi": "यह दृश्य सहायता बनाते समय स्वचालित रूप से सहेज ली गई थी।", "Kannada": "ಈ ದೃಶ್ಯ ಸಹಾಯವನ್ನು ರಚಿಸಿದಾಗ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಉಳಿಸಲಾಗಿದೆ.", "Tamil": "இந்த காட்சி உதவி உருவாக்கப்பட்டபோது தானாகவே சேமிக்கப்பட்டது.", "Telugu": "ఈ దృశ్య సహాయం ఉత్పన్నం చేసినప్పుడు స్వయంచాలకంగా సేవ్ చేయబడింది.", "Marathi": "हे दृश्य साधन तयार झाल्यावर आपोआप जतन केले गेले.", "Bengali": "এই ভিজ্যুয়াল এইডটি তৈরি হওয়ার সময় স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছিল।", "Gujarati": "આ વિઝ્યુઅલ સહાય બનાવતી વખતે આપમેળે સાચવી દેવામાં આવી હતી.", "Punjabi": "ਇਹ ਵਿਜ਼ੂਅਲ ਸਹਾਇਤਾ ਬਣਾਉਣ ਵੇਲੇ ਆਪਣੇ ਆਪ ਸੰਭਾਲ ਲਈ ਗਈ ਸੀ।", "Malayalam": "ഈ ദൃശ്യ സഹായം സൃഷ്ടിക്കുമ്പോൾ സ്വയമേവ സേവ് ചെയ്തു.", "Odia": "ଏହି ଦୃଶ୍ୟ ସହାୟତା ସୃଷ୍ଟି ସମୟରେ ସ୍ୱୟଂଚାଳିତ ଭାବେ ସଞ୍ଚୟ ହୋଇଥିଲା।"
    },
    // === Wave 2: Virtual Field Trip ===
    "Could not load the saved field trip.": {
        "English": "Could not load the saved field trip.", "Hindi": "सहेजी गई वर्चुअल फील्ड ट्रिप लोड नहीं हो सकी।", "Kannada": "ಉಳಿಸಿದ ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್ ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "சேமிக்கப்பட்ட மெய்நிகர் கள உலாவை ஏற்ற முடியவில்லை.", "Telugu": "సేవ్ చేసిన వర్చువల్ ఫీల్డ్ ట్రిప్‌ను లోడ్ చేయలేకపోయాము.", "Marathi": "जतन केलेली व्हर्च्युअल फील्ड ट्रिप लोड करता आली नाही.", "Bengali": "সংরক্ষিত ভার্চুয়াল ফিল্ড ট্রিপ লোড করা যায়নি।", "Gujarati": "સાચવેલ વર્ચ્યુઅલ ફીલ્ડ ટ્રીપ લોડ થઈ શકી નથી.", "Punjabi": "ਸੰਭਾਲੀ ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।", "Malayalam": "സേവ് ചെയ്ത വെർച്വൽ ഫീൽഡ് ട്രിപ്പ് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.", "Odia": "ସଞ୍ଚୟ ହୋଇଥିବା ଭର୍ଚୁଆଲ୍ ଫିଲ୍ଡ ଟ୍ରିପ୍ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।"
    },
    "There was an error planning the virtual trip. Please try again.": {
        "English": "There was an error planning the virtual trip. Please try again.", "Hindi": "वर्चुअल ट्रिप की योजना बनाने में त्रुटि हुई। कृपया पुनः प्रयास करें।", "Kannada": "ವರ್ಚುವಲ್ ಟ್ರಿಪ್ ಯೋಜಿಸುವಲ್ಲಿ ದೋಷ ಉಂಟಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "மெய்நிகர் உலாவைத் திட்டமிடுவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "వర్చువల్ ట్రిప్ ప్లాన్ చేయడంలో లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "व्हर्च्युअल ट्रिपची योजना करण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "ভার্চুয়াল ট্রিপ পরিকল্পনা করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "વર્ચ્યુઅલ ટ્રીપનું આયોજન કરવામાં ભૂલ થઈ. કૃપા કરી ફરી પ્રયાસ કરો.", "Punjabi": "ਵਰਚੁਅਲ ਟ੍ਰਿਪ ਦੀ ਯੋਜਨਾ ਬਣਾਉਣ ਵਿੱਚ ਗਲਤੀ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "വെർച്വൽ ട്രിപ്പ് ആസൂത്രണം ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଭର୍ଚୁଆଲ୍ ଟ୍ରିପ୍ ଯୋଜନା କରିବାରେ ତ୍ରୁଟି ହୋଇଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    // === Wave 2: share-to-community-cta ===
    "Shared to Community": {
        "English": "Shared to Community", "Hindi": "समुदाय में साझा किया गया", "Kannada": "ಸಮುದಾಯಕ್ಕೆ ಹಂಚಿಕೊಳ್ಳಲಾಗಿದೆ", "Tamil": "சமூகத்துடன் பகிரப்பட்டது", "Telugu": "సంఘంతో పంచుకోబడింది", "Marathi": "समुदायात सामायिक केले", "Bengali": "সম্প্রদায়ে শেয়ার করা হয়েছে", "Gujarati": "સમુદાયમાં શેર કર્યું", "Punjabi": "ਭਾਈਚਾਰੇ ਵਿੱਚ ਸਾਂਝਾ ਕੀਤਾ", "Malayalam": "കമ്മ്യൂണിറ്റിയിൽ പങ്കിട്ടു", "Odia": "ସମ୍ପ୍ରଦାୟରେ ସେୟାର କରାଗଲା"
    },
    "Other teachers can now find this in the Community Library.": {
        "English": "Other teachers can now find this in the Community Library.", "Hindi": "अन्य शिक्षक अब इसे समुदाय पुस्तकालय में पा सकते हैं।", "Kannada": "ಇತರ ಶಿಕ್ಷಕರು ಈಗ ಇದನ್ನು ಸಮುದಾಯ ಗ್ರಂಥಾಲಯದಲ್ಲಿ ಕಾಣಬಹುದು.", "Tamil": "மற்ற ஆசிரியர்கள் இதை இப்போது சமூக நூலகத்தில் காணலாம்.", "Telugu": "ఇతర ఉపాధ్యాయులు ఇప్పుడు దీన్ని కమ్యూనిటీ లైబ్రరీలో కనుగొనగలరు.", "Marathi": "इतर शिक्षक आता हे समुदाय लायब्ररीत शोधू शकतात.", "Bengali": "অন্য শিক্ষকরা এখন এটি সম্প্রদায় লাইব্রেরিতে খুঁজে পাবেন।", "Gujarati": "અન્ય શિક્ષકો હવે આને સમુદાય લાઇબ્રેરીમાં શોધી શકે છે.", "Punjabi": "ਹੋਰ ਅਧਿਆਪਕ ਹੁਣ ਇਸਨੂੰ ਭਾਈਚਾਰਕ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਲੱਭ ਸਕਦੇ ਹਨ।", "Malayalam": "മറ്റ് അധ്യാപകർക്ക് ഇപ്പോൾ ഇത് കമ്മ്യൂണിറ്റി ലൈബ്രറിയിൽ കണ്ടെത്താനാകും.", "Odia": "ଅନ୍ୟ ଶିକ୍ଷକମାନେ ବର୍ତ୍ତମାନ ଏହାକୁ ସମ୍ପ୍ରଦାୟ ଲାଇବ୍ରେରୀରେ ପାଇବେ।"
    },
    "Could not share": {
        "English": "Could not share", "Hindi": "साझा नहीं किया जा सका", "Kannada": "ಹಂಚಿಕೊಳ್ಳಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "பகிர முடியவில்லை", "Telugu": "పంచుకోలేకపోయాము", "Marathi": "सामायिक करता आले नाही", "Bengali": "শেয়ার করা যায়নি", "Gujarati": "શેર કરી શકાયું નહીં", "Punjabi": "ਸਾਂਝਾ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ", "Malayalam": "പങ്കിടാൻ കഴിഞ്ഞില്ല", "Odia": "ସେୟାର କରିହେଲା ନାହିଁ"
    },
    "Sharing...": {
        "English": "Sharing...", "Hindi": "साझा हो रहा है...", "Kannada": "ಹಂಚಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ...", "Tamil": "பகிரப்படுகிறது...", "Telugu": "పంచుకుంటోంది...", "Marathi": "सामायिक करत आहे...", "Bengali": "শেয়ার হচ্ছে...", "Gujarati": "શેર થઈ રહ્યું છે...", "Punjabi": "ਸਾਂਝਾ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "പങ്കിടുന്നു...", "Odia": "ସେୟାର କରୁଅଛି..."
    },
    "Share to Community": {
        "English": "Share to Community", "Hindi": "समुदाय में साझा करें", "Kannada": "ಸಮುದಾಯಕ್ಕೆ ಹಂಚಿಕೊಳ್ಳಿ", "Tamil": "சமூகத்துடன் பகிர்", "Telugu": "సంఘంతో పంచుకోండి", "Marathi": "समुदायात सामायिक करा", "Bengali": "সম্প্রদায়ে শেয়ার করুন", "Gujarati": "સમુદાયમાં શેર કરો", "Punjabi": "ਭਾਈਚਾਰੇ ਵਿੱਚ ਸਾਂਝਾ ਕਰੋ", "Malayalam": "കമ്മ്യൂണിറ്റിയിൽ പങ്കിടുക", "Odia": "ସମ୍ପ୍ରଦାୟରେ ସେୟାର କରନ୍ତୁ"
    },
    "Was this helpful?": {
        "English": "Was this helpful?", "Hindi": "क्या यह सहायक था?", "Kannada": "ಇದು ಸಹಾಯಕವಾಗಿತ್ತೇ?", "Tamil": "இது பயனுள்ளதாக இருந்ததா?", "Telugu": "ఇది సహాయకరంగా ఉందా?", "Marathi": "हे उपयुक्त होते का?", "Bengali": "এটি কি সহায়ক ছিল?", "Gujarati": "શું આ મદદરૂપ હતું?", "Punjabi": "ਕੀ ਇਹ ਮਦਦਗਾਰ ਸੀ?", "Malayalam": "ഇത് സഹായകരമായിരുന്നോ?", "Odia": "ଏହା ସହାୟକ ଥିଲା କି?"
    },
    "How can we improve?": {
        "English": "How can we improve?", "Hindi": "हम कैसे सुधार कर सकते हैं?", "Kannada": "ನಾವು ಹೇಗೆ ಸುಧಾರಿಸಬಹುದು?", "Tamil": "நாங்கள் எப்படி மேம்படுத்தலாம்?", "Telugu": "మేము ఎలా మెరుగుపరచగలము?", "Marathi": "आम्ही कसे सुधारणा करू शकतो?", "Bengali": "আমরা কীভাবে উন্নতি করতে পারি?", "Gujarati": "અમે કેવી રીતે સુધારી શકીએ?", "Punjabi": "ਅਸੀਂ ਕਿਵੇਂ ਸੁਧਾਰ ਕਰ ਸਕਦੇ ਹਾਂ?", "Malayalam": "ഞങ്ങൾക്ക് എങ്ങനെ മെച്ചപ്പെടുത്താം?", "Odia": "ଆମେ କିପରି ଉନ୍ନତି କରିପାରିବା?"
    },
    "We're sorry the result wasn't what you expected. Please tell us what went wrong so we can fix it.": {
        "English": "We're sorry the result wasn't what you expected. Please tell us what went wrong so we can fix it.", "Hindi": "हमें खेद है कि परिणाम आपकी अपेक्षा के अनुरूप नहीं था। कृपया हमें बताएं कि क्या गलत हुआ ताकि हम इसे ठीक कर सकें।", "Kannada": "ಫಲಿತಾಂಶವು ನೀವು ನಿರೀಕ್ಷಿಸಿದಂತಿರಲಿಲ್ಲ ಎಂದು ನಮಗೆ ವಿಷಾದವಿದೆ. ದಯವಿಟ್ಟು ಏನು ತಪ್ಪಾಗಿದೆ ಎಂದು ತಿಳಿಸಿ ಇದರಿಂದ ನಾವು ಸರಿಪಡಿಸಬಹುದು.", "Tamil": "முடிவு நீங்கள் எதிர்பார்த்தபடி இல்லாமைக்கு வருந்துகிறோம். தயவுசெய்து என்ன தவறு என்று எங்களிடம் கூறுங்கள், அதனால் நாங்கள் சரிசெய்யலாம்.", "Telugu": "ఫలితం మీరు ఆశించినట్లు లేకపోవడం పట్ల క్షమించండి. ఏమి తప్పు జరిగిందో దయచేసి మాకు చెప్పండి, మేము సరిచేస్తాము.", "Marathi": "निकाल तुमच्या अपेक्षेप्रमाणे नव्हता याबद्दल आम्हाला खेद आहे. कृपया काय चुकले ते सांगा जेणेकरून आम्ही ते दुरुस्त करू शकू.", "Bengali": "ফলাফল আপনার প্রত্যাশা অনুযায়ী না হওয়ায় আমরা দুঃখিত। অনুগ্রহ করে আমাদের জানান কী ভুল হয়েছে যাতে আমরা ঠিক করতে পারি।", "Gujarati": "પરિણામ તમારી અપેક્ષા મુજબ ન હતું તે માટે અમે દિલગીર છીએ. કૃપા કરી અમને જણાવો કે શું ખોટું થયું જેથી અમે તેને ઠીક કરી શકીએ.", "Punjabi": "ਨਤੀਜਾ ਤੁਹਾਡੀ ਉਮੀਦ ਅਨੁਸਾਰ ਨਹੀਂ ਸੀ, ਇਸ ਲਈ ਅਸੀਂ ਮੁਆਫੀ ਚਾਹੁੰਦੇ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਨੂੰ ਦੱਸੋ ਕਿ ਕੀ ਗਲਤ ਹੋਇਆ ਤਾਂ ਜੋ ਅਸੀਂ ਠੀਕ ਕਰ ਸਕੀਏ।", "Malayalam": "ഫലം നിങ്ങൾ പ്രതീക്ഷിച്ചതുപോലെ ആയിരുന്നില്ല എന്നതിൽ ഞങ്ങൾ ഖേദിക്കുന്നു. എന്താണ് തെറ്റിയത് എന്ന് ദയവായി പറയൂ, ഞങ്ങൾക്ക് അത് പരിഹരിക്കാം.", "Odia": "ଫଳାଫଳ ଆପଣଙ୍କ ଆଶା ଅନୁଯାୟୀ ନ ଥିଲା ବୋଲି ଆମେ ଦୁଃଖିତ। ଦୟାକରି କୁହନ୍ତୁ କଣ ଭୁଲ ହୋଇଥିଲା ଯାହାଫଳରେ ଆମେ ସେହାକୁ ଠିକ୍ କରିପାରିବା।"
    },
    "e.g., The objectives were too vague, or the generated activities were not age-appropriate...": {
        "English": "e.g., The objectives were too vague, or the generated activities were not age-appropriate...", "Hindi": "उदा., उद्देश्य बहुत अस्पष्ट थे, या निर्मित गतिविधियाँ आयु-उपयुक्त नहीं थीं...", "Kannada": "ಉದಾ., ಉದ್ದೇಶಗಳು ತುಂಬಾ ಅಸ್ಪಷ್ಟವಾಗಿದ್ದವು, ಅಥವಾ ಉತ್ಪಾದಿಸಿದ ಚಟುವಟಿಕೆಗಳು ವಯಸ್ಸಿಗೆ ಸೂಕ್ತವಾಗಿರಲಿಲ್ಲ...", "Tamil": "எ.கா., குறிக்கோள்கள் மிகவும் தெளிவற்றதாக இருந்தன, அல்லது உருவாக்கப்பட்ட செயல்பாடுகள் வயதுக்கு ஏற்றதாக இல்லை...", "Telugu": "ఉదా., లక్ష్యాలు చాలా అస్పష్టంగా ఉన్నాయి, లేదా రూపొందించబడిన కార్యకలాపాలు వయస్సుకు తగినవి కాదు...", "Marathi": "उदा., उद्दिष्टे खूप अस्पष्ट होती, किंवा निर्माण केलेले उपक्रम वयोमानानुसार नव्हते...", "Bengali": "যেমন, উদ্দেশ্যগুলি অত্যন্ত অস্পষ্ট ছিল, বা তৈরি করা ক্রিয়াকলাপগুলি বয়স-উপযুক্ত ছিল না...", "Gujarati": "દા.ત., ઉદ્દેશ્યો ખૂબ અસ્પષ્ટ હતા, અથવા ઉત્પન્ન કરેલી પ્રવૃત્તિઓ ઉંમર-યોગ્ય ન હતી...", "Punjabi": "ਜਿਵੇਂ, ਉਦੇਸ਼ ਬਹੁਤ ਅਸਪਸ਼ਟ ਸਨ, ਜਾਂ ਤਿਆਰ ਕੀਤੀਆਂ ਗਤੀਵਿਧੀਆਂ ਉਮਰ-ਅਨੁਕੂਲ ਨਹੀਂ ਸਨ...", "Malayalam": "ഉദാ., ലക്ഷ്യങ്ങൾ വളരെ അവ്യക്തമായിരുന്നു, അല്ലെങ്കിൽ സൃഷ്ടിച്ച പ്രവർത്തനങ്ങൾ പ്രായത്തിന് അനുയോജ്യമല്ലായിരുന്നു...", "Odia": "ଉଦାହରଣ, ଉଦ୍ଦେଶ୍ୟଗୁଡ଼ିକ ବହୁତ ଅସ୍ପଷ୍ଟ ଥିଲା, କିମ୍ବା ସୃଷ୍ଟ କାର୍ଯ୍ୟକ୍ରମ ବୟସ-ଉପଯୁକ୍ତ ନ ଥିଲା..."
    },
    "AI Training Data": {
        "English": "AI Training Data", "Hindi": "AI प्रशिक्षण डेटा", "Kannada": "AI ತರಬೇತಿ ಡೇಟಾ", "Tamil": "AI பயிற்சி தரவு", "Telugu": "AI శిక్షణ డేటా", "Marathi": "AI प्रशिक्षण डेटा", "Bengali": "AI প্রশিক্ষণ ডেটা", "Gujarati": "AI તાલીમ ડેટા", "Punjabi": "AI ਸਿਖਲਾਈ ਡਾਟਾ", "Malayalam": "AI പരിശീലന ഡാറ്റ", "Odia": "AI ତାଲିମ ଡାଟା"
    },
    "Activity": {
        "English": "Activity", "Hindi": "गतिविधि", "Kannada": "ಚಟುವಟಿಕೆ", "Tamil": "செயல்பாடு", "Telugu": "కార్యకలాపం", "Marathi": "क्रियाकलाप", "Bengali": "কার্যকলাপ", "Gujarati": "પ્રવૃત્તિ", "Punjabi": "ਗਤੀਵਿਧੀ", "Malayalam": "പ്രവർത്തനം", "Odia": "କାର୍ଯ୍ୟକଳାପ"
    },
    "Add students first to take attendance.": {
        "English": "Add students first to take attendance.", "Hindi": "उपस्थिति लेने के लिए पहले छात्र जोड़ें।", "Kannada": "ಹಾಜರಾತಿ ತೆಗೆದುಕೊಳ್ಳಲು ಮೊದಲು ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ.", "Tamil": "வருகையை எடுக்க முதலில் மாணவர்களைச் சேர்க்கவும்.", "Telugu": "హాజరు తీసుకోవడానికి ముందుగా విద్యార్థులను జోడించండి.", "Marathi": "उपस्थिती घेण्यासाठी आधी विद्यार्थी जोडा.", "Bengali": "উপস্থিতি নিতে প্রথমে শিক্ষার্থী যোগ করুন।", "Gujarati": "હાજરી લેવા માટે પહેલા વિદ્યાર્થીઓ ઉમેરો.", "Punjabi": "ਹਾਜ਼ਰੀ ਲੈਣ ਲਈ ਪਹਿਲਾਂ ਵਿਦਿਆਰਥੀ ਸ਼ਾਮਲ ਕਰੋ।", "Malayalam": "ഹാജർ എടുക്കാൻ ആദ്യം വിദ്യാർത്ഥികളെ ചേർക്കുക.", "Odia": "ଉପସ୍ଥାନ ନେବା ପାଇଁ ପ୍ରଥମେ ଛାତ୍ରମାନଙ୍କୁ ଯୋଗ କରନ୍ତୁ।"
    },
    "Adds up to your overall score of": {
        "English": "Adds up to your overall score of", "Hindi": "आपके कुल स्कोर में जुड़ता है", "Kannada": "ನಿಮ್ಮ ಒಟ್ಟಾರೆ ಸ್ಕೋರ್‌ಗೆ ಸೇರುತ್ತದೆ", "Tamil": "உங்கள் ஒட்டுமொத்த மதிப்பெண்ணில் சேர்க்கப்படுகிறது", "Telugu": "మీ మొత్తం స్కోర్‌కు జోడిస్తుంది", "Marathi": "तुमच्या एकूण गुणांमध्ये जोडले जाते", "Bengali": "আপনার সামগ্রিক স্কোরে যোগ হয়", "Gujarati": "તમારા કુલ સ્કોરમાં ઉમેરાય છે", "Punjabi": "ਤੁਹਾਡੇ ਕੁੱਲ ਸਕੋਰ ਵਿੱਚ ਜੋੜਿਆ ਜਾਂਦਾ ਹੈ", "Malayalam": "നിങ്ങളുടെ മൊത്തം സ്കോറിലേക്ക് കൂട്ടുന്നു", "Odia": "ଆପଣଙ୍କ ସମୁଦାୟ ସ୍କୋରରେ ଯୋଗ ହୁଏ"
    },
    "Administrative Role": {
        "English": "Administrative Role", "Hindi": "प्रशासनिक भूमिका", "Kannada": "ಆಡಳಿತಾತ್ಮಕ ಪಾತ್ರ", "Tamil": "நிர்வாகப் பங்கு", "Telugu": "నిర్వాహక పాత్ర", "Marathi": "प्रशासकीय भूमिका", "Bengali": "প্রশাসনিক ভূমিকা", "Gujarati": "વહીવટી ભૂમિકા", "Punjabi": "ਪ੍ਰਸ਼ਾਸਨਿਕ ਭੂਮਿਕਾ", "Malayalam": "ഭരണപരമായ പങ്ക്", "Odia": "ପ୍ରଶାସନିକ ଭୂମିକା"
    },
    "All Classes": {
        "English": "All Classes", "Hindi": "सभी कक्षाएँ", "Kannada": "ಎಲ್ಲಾ ತರಗತಿಗಳು", "Tamil": "அனைத்து வகுப்புகள்", "Telugu": "అన్ని తరగతులు", "Marathi": "सर्व वर्ग", "Bengali": "সব ক্লাস", "Gujarati": "બધા વર્ગો", "Punjabi": "ਸਾਰੀਆਂ ਜਮਾਤਾਂ", "Malayalam": "എല്ലാ ക്ലാസുകളും", "Odia": "ସମସ୍ତ ଶ୍ରେଣୀ"
    },
    "All Present": {
        "English": "All Present", "Hindi": "सभी उपस्थित", "Kannada": "ಎಲ್ಲರೂ ಹಾಜರು", "Tamil": "அனைவரும் வருகை", "Telugu": "అందరూ హాజరు", "Marathi": "सर्व उपस्थित", "Bengali": "সবাই উপস্থিত", "Gujarati": "બધા હાજર", "Punjabi": "ਸਾਰੇ ਹਾਜ਼ਰ", "Malayalam": "എല്ലാവരും ഹാജർ", "Odia": "ସମସ୍ତେ ଉପସ୍ଥିତ"
    },
    "All Resources": {
        "English": "All Resources", "Hindi": "सभी संसाधन", "Kannada": "ಎಲ್ಲಾ ಸಂಪನ್ಮೂಲಗಳು", "Tamil": "அனைத்து வளங்கள்", "Telugu": "అన్ని వనరులు", "Marathi": "सर्व संसाधने", "Bengali": "সব রিসোর্স", "Gujarati": "બધા સંસાધનો", "Punjabi": "ਸਾਰੇ ਸਰੋਤ", "Malayalam": "എല്ലാ വിഭവങ്ങളും", "Odia": "ସମସ୍ତ ସମ୍ବଳ"
    },
    "All Subjects": {
        "English": "All Subjects", "Hindi": "सभी विषय", "Kannada": "ಎಲ್ಲಾ ವಿಷಯಗಳು", "Tamil": "அனைத்து பாடங்கள்", "Telugu": "అన్ని విషయాలు", "Marathi": "सर्व विषय", "Bengali": "সব বিষয়", "Gujarati": "બધા વિષયો", "Punjabi": "ਸਾਰੇ ਵਿਸ਼ੇ", "Malayalam": "എല്ലാ വിഷയങ്ങളും", "Odia": "ସମସ୍ତ ବିଷୟ"
    },
    "All types": {
        "English": "All types", "Hindi": "सभी प्रकार", "Kannada": "ಎಲ್ಲಾ ಪ್ರಕಾರಗಳು", "Tamil": "அனைத்து வகைகள்", "Telugu": "అన్ని రకాలు", "Marathi": "सर्व प्रकार", "Bengali": "সব ধরনের", "Gujarati": "બધા પ્રકારો", "Punjabi": "ਸਾਰੇ ਕਿਸਮਾਂ", "Malayalam": "എല്ലാ തരങ്ങളും", "Odia": "ସମସ୍ତ ପ୍ରକାର"
    },
    "Allow anonymized content to improve AI models": {
        "English": "Allow anonymized content to improve AI models", "Hindi": "AI मॉडल सुधारने के लिए अनाम सामग्री की अनुमति दें", "Kannada": "AI ಮಾದರಿಗಳನ್ನು ಸುಧಾರಿಸಲು ಅನಾಮಧೇಯ ವಿಷಯವನ್ನು ಅನುಮತಿಸಿ", "Tamil": "AI மாதிரிகளை மேம்படுத்த அநாமதேய உள்ளடக்கத்தை அனுமதிக்கவும்", "Telugu": "AI మోడళ్లను మెరుగుపరచడానికి అనామక కంటెంట్‌ను అనుమతించండి", "Marathi": "AI मॉडेल सुधारण्यासाठी निनावी सामग्रीला परवानगी द्या", "Bengali": "AI মডেল উন্নত করতে বেনামী কনটেন্ট অনুমতি দিন", "Gujarati": "AI મોડેલ સુધારવા માટે અનામી સામગ્રીને મંજૂરી આપો", "Punjabi": "AI ਮਾਡਲ ਸੁਧਾਰਨ ਲਈ ਗੁਮਨਾਮ ਸਮੱਗਰੀ ਦੀ ਆਗਿਆ ਦਿਓ", "Malayalam": "AI മോഡലുകൾ മെച്ചപ്പെടുത്താൻ അജ്ഞാത ഉള്ളടക്കം അനുവദിക്കുക", "Odia": "AI ମଡେଲ ଉନ୍ନତ କରିବାକୁ ଅଜ୍ଞାତ ବିଷୟବସ୍ତୁକୁ ଅନୁମତି ଦିଅନ୍ତୁ"
    },
    "Almost there!": {
        "English": "Almost there!", "Hindi": "लगभग पूरा!", "Kannada": "ಬಹುತೇಕ ಆಯಿತು!", "Tamil": "கிட்டத்தட்ட முடிந்தது!", "Telugu": "దాదాపు పూర్తయింది!", "Marathi": "जवळजवळ झाले!", "Bengali": "প্রায় শেষ!", "Gujarati": "લગભગ પૂર્ણ!", "Punjabi": "ਲਗਭਗ ਪੂਰਾ!", "Malayalam": "ഏതാണ്ട് ആയി!", "Odia": "ପ୍ରାୟ ଶେଷ!"
    },
    "Already connected": {
        "English": "Already connected", "Hindi": "पहले से जुड़े हैं", "Kannada": "ಈಗಾಗಲೇ ಸಂಪರ್ಕಿತ", "Tamil": "ஏற்கனவே இணைக்கப்பட்டது", "Telugu": "ఇప్పటికే కనెక్ట్ అయ్యారు", "Marathi": "आधीच जोडलेले", "Bengali": "ইতিমধ্যে সংযুক্ত", "Gujarati": "પહેલેથી જોડાયેલ", "Punjabi": "ਪਹਿਲਾਂ ਹੀ ਜੁੜੇ ਹੋਏ", "Malayalam": "ഇതിനകം ബന്ധിപ്പിച്ചു", "Odia": "ପୂର୍ବରୁ ସଂଯୁକ୍ତ"
    },
    "An open chat room for every teacher on SahayakAI. Ask questions, share ideas, say hello.": {
        "English": "An open chat room for every teacher on SahayakAI. Ask questions, share ideas, say hello.", "Hindi": "SahayakAI के हर शिक्षक के लिए एक खुला चैट रूम। प्रश्न पूछें, विचार साझा करें, नमस्ते कहें।", "Kannada": "SahayakAI ನಲ್ಲಿರುವ ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ ಮುಕ್ತ ಚಾಟ್ ರೂಮ್. ಪ್ರಶ್ನೆ ಕೇಳಿ, ಆಲೋಚನೆಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ, ನಮಸ್ಕಾರ ಹೇಳಿ.", "Tamil": "SahayakAI-ல் உள்ள ஒவ்வொரு ஆசிரியருக்கும் ஒரு திறந்த அரட்டை அறை. கேள்விகள் கேளுங்கள், கருத்துக்களைப் பகிருங்கள், வணக்கம் சொல்லுங்கள்.", "Telugu": "SahayakAI లోని ప్రతి ఉపాధ్యాయుడికి ఓపెన్ చాట్ రూమ్. ప్రశ్నలు అడగండి, ఆలోచనలు పంచుకోండి, నమస్కారం చెప్పండి.", "Marathi": "SahayakAI वरील प्रत्येक शिक्षकासाठी खुली चॅट रूम. प्रश्न विचारा, कल्पना शेअर करा, नमस्कार करा.", "Bengali": "SahayakAI-এর প্রতিটি শিক্ষকের জন্য একটি উন্মুক্ত চ্যাট রুম। প্রশ্ন করুন, ভাবনা ভাগ করুন, হ্যালো বলুন।", "Gujarati": "SahayakAI પરના દરેક શિક્ષક માટે ખુલ્લો ચેટ રૂમ. પ્રશ્નો પૂછો, વિચારો વહેંચો, હેલો કહો.", "Punjabi": "SahayakAI ਉੱਤੇ ਹਰ ਅਧਿਆਪਕ ਲਈ ਖੁੱਲ੍ਹਾ ਚੈਟ ਰੂਮ। ਸਵਾਲ ਪੁੱਛੋ, ਵਿਚਾਰ ਸਾਂਝੇ ਕਰੋ, ਹੈਲੋ ਕਹੋ।", "Malayalam": "SahayakAI-യിലെ എല്ലാ അധ്യാപകർക്കും ഒരു തുറന്ന ചാറ്റ് റൂം. ചോദ്യങ്ങൾ ചോദിക്കുക, ആശയങ്ങൾ പങ്കിടുക, ഹലോ പറയുക.", "Odia": "SahayakAI ରେ ପ୍ରତ୍ୟେକ ଶିକ୍ଷକଙ୍କ ପାଇଁ ଏକ ଖୋଲା ଚାଟ୍ ରୁମ୍। ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ, ଚିନ୍ତା ବାଣ୍ଟନ୍ତୁ, ନମସ୍କାର କୁହନ୍ତୁ।"
    },
    "Answer:": {
        "English": "Answer:", "Hindi": "उत्तर:", "Kannada": "ಉತ್ತರ:", "Tamil": "பதில்:", "Telugu": "సమాధానం:", "Marathi": "उत्तर:", "Bengali": "উত্তর:", "Gujarati": "જવાબ:", "Punjabi": "ਜਵਾਬ:", "Malayalam": "ഉത്തരം:", "Odia": "ଉତ୍ତର:"
    },
    "App interface & AI output language": {
        "English": "App interface & AI output language", "Hindi": "ऐप इंटरफ़ेस और AI आउटपुट भाषा", "Kannada": "ಅಪ್ಲಿಕೇಶನ್ ಇಂಟರ್‌ಫೇಸ್ ಮತ್ತು AI ಔಟ್‌ಪುಟ್ ಭಾಷೆ", "Tamil": "ஆப் இடைமுகம் & AI வெளியீட்டு மொழி", "Telugu": "యాప్ ఇంటర్‌ఫేస్ & AI అవుట్‌పుట్ భాష", "Marathi": "अ‍ॅप इंटरफेस आणि AI आउटपुट भाषा", "Bengali": "অ্যাপ ইন্টারফেস ও AI আউটপুট ভাষা", "Gujarati": "એપ ઇન્ટરફેસ અને AI આઉટપુટ ભાષા", "Punjabi": "ਐਪ ਇੰਟਰਫੇਸ ਅਤੇ AI ਆਉਟਪੁੱਟ ਭਾਸ਼ਾ", "Malayalam": "ആപ്പ് ഇന്റർഫേസ് & AI ഔട്ട്‌പുട്ട് ഭാഷ", "Odia": "ଆପ୍ ଇଣ୍ଟରଫେସ୍ ଓ AI ଆଉଟପୁଟ୍ ଭାଷା"
    },
    "Ask VIDYA": {
        "English": "Ask VIDYA", "Hindi": "VIDYA से पूछें", "Kannada": "VIDYA ಯನ್ನು ಕೇಳಿ", "Tamil": "VIDYA-விடம் கேளுங்கள்", "Telugu": "VIDYA ను అడగండి", "Marathi": "VIDYA ला विचारा", "Bengali": "VIDYA কে জিজ্ঞাসা করুন", "Gujarati": "VIDYA ને પૂછો", "Punjabi": "VIDYA ਨੂੰ ਪੁੱਛੋ", "Malayalam": "VIDYA-യോട് ചോദിക്കുക", "Odia": "VIDYA କୁ ପଚାରନ୍ତୁ"
    },
    "At-risk": {
        "English": "At-risk", "Hindi": "जोखिम में", "Kannada": "ಅಪಾಯದಲ್ಲಿ", "Tamil": "ஆபத்தில்", "Telugu": "ప్రమాదంలో", "Marathi": "धोक्यात", "Bengali": "ঝুঁকিতে", "Gujarati": "જોખમમાં", "Punjabi": "ਜੋਖਮ ਵਿੱਚ", "Malayalam": "അപകടത്തിൽ", "Odia": "ବିପଦରେ"
    },
    "Attendance Saved": {
        "English": "Attendance Saved", "Hindi": "उपस्थिति सहेजी गई", "Kannada": "ಹಾಜರಾತಿ ಉಳಿಸಲಾಗಿದೆ", "Tamil": "வருகை சேமிக்கப்பட்டது", "Telugu": "హాజరు సేవ్ చేయబడింది", "Marathi": "उपस्थिती जतन केली", "Bengali": "উপস্থিতি সংরক্ষিত", "Gujarati": "હાજરી સાચવી", "Punjabi": "ਹਾਜ਼ਰੀ ਸੁਰੱਖਿਅਤ", "Malayalam": "ഹാജർ സംരക്ഷിച്ചു", "Odia": "ଉପସ୍ଥାନ ସଂରକ୍ଷିତ"
    },
    "Based on activity, engagement, success rate, and growth": {
        "English": "Based on activity, engagement, success rate, and growth", "Hindi": "गतिविधि, सहभागिता, सफलता दर और वृद्धि के आधार पर", "Kannada": "ಚಟುವಟಿಕೆ, ತೊಡಗಿಸಿಕೊಳ್ಳುವಿಕೆ, ಯಶಸ್ಸಿನ ದರ ಮತ್ತು ಬೆಳವಣಿಗೆಯ ಆಧಾರದ ಮೇಲೆ", "Tamil": "செயல்பாடு, ஈடுபாடு, வெற்றி விகிதம் மற்றும் வளர்ச்சியின் அடிப்படையில்", "Telugu": "కార్యకలాపం, నిమగ్నత, విజయ రేటు మరియు వృద్ధి ఆధారంగా", "Marathi": "क्रियाकलाप, सहभाग, यश दर आणि वाढीवर आधारित", "Bengali": "কার্যকলাপ, সম্পৃক্ততা, সাফল্যের হার ও বৃদ্ধির উপর ভিত্তি করে", "Gujarati": "પ્રવૃત્તિ, જોડાણ, સફળતા દર અને વૃદ્ધિના આધારે", "Punjabi": "ਗਤੀਵਿਧੀ, ਸ਼ਮੂਲੀਅਤ, ਸਫਲਤਾ ਦਰ ਅਤੇ ਵਿਕਾਸ ਦੇ ਆਧਾਰ 'ਤੇ", "Malayalam": "പ്രവർത്തനം, ഇടപഴകൽ, വിജയ നിരക്ക്, വളർച്ച എന്നിവയെ അടിസ്ഥാനമാക്കി", "Odia": "କାର୍ଯ୍ୟକଳାପ, ସମ୍ପୃକ୍ତି, ସଫଳତା ହାର ଓ ବୃଦ୍ଧି ଆଧାରରେ"
    },
    "Be the first to share a lesson plan or quiz. Your contribution helps teachers across Bharat.": {
        "English": "Be the first to share a lesson plan or quiz. Your contribution helps teachers across Bharat.", "Hindi": "पाठ योजना या प्रश्नोत्तरी साझा करने वाले पहले बनें। आपका योगदान भारत भर के शिक्षकों की मदद करता है।", "Kannada": "ಪಾಠ ಯೋಜನೆ ಅಥವಾ ರಸಪ್ರಶ್ನೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳುವ ಮೊದಲಿಗರಾಗಿರಿ. ನಿಮ್ಮ ಕೊಡುಗೆ ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರಿಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.", "Tamil": "பாடத் திட்டம் அல்லது வினாடி வினாவைப் பகிரும் முதல் நபராக இருங்கள். உங்கள் பங்களிப்பு பாரதம் முழுவதும் உள்ள ஆசிரியர்களுக்கு உதவுகிறது.", "Telugu": "పాఠ ప్రణాళిక లేదా క్విజ్‌ను పంచుకునే మొదటి వ్యక్తి అవ్వండి. మీ సహకారం భారతదేశం అంతటా ఉపాధ్యాయులకు సహాయపడుతుంది.", "Marathi": "धडा योजना किंवा प्रश्नमंजुषा शेअर करणारे पहिले व्हा. तुमचे योगदान भारतभरातील शिक्षकांना मदत करते.", "Bengali": "পাঠ পরিকল্পনা বা কুইজ ভাগ করে নেওয়া প্রথম ব্যক্তি হন। আপনার অবদান ভারতজুড়ে শিক্ষকদের সাহায্য করে।", "Gujarati": "પાઠ યોજના કે ક્વિઝ વહેંચનાર પ્રથમ બનો. તમારું યોગદાન ભારતભરના શિક્ષકોને મદદ કરે છે.", "Punjabi": "ਪਾਠ ਯੋਜਨਾ ਜਾਂ ਕਵਿਜ਼ ਸਾਂਝੀ ਕਰਨ ਵਾਲੇ ਪਹਿਲੇ ਬਣੋ। ਤੁਹਾਡਾ ਯੋਗਦਾਨ ਭਾਰਤ ਭਰ ਦੇ ਅਧਿਆਪਕਾਂ ਦੀ ਮਦਦ ਕਰਦਾ ਹੈ।", "Malayalam": "പാഠ പദ്ധതി അല്ലെങ്കിൽ ക്വിസ് പങ്കിടുന്ന ആദ്യ വ്യക്തിയാകുക. നിങ്ങളുടെ സംഭാവന ഭാരതത്തിലെ അധ്യാപകരെ സഹായിക്കുന്നു.", "Odia": "ପାଠ ଯୋଜନା କିମ୍ବା କୁଇଜ୍ ବାଣ୍ଟିବାରେ ପ୍ରଥମ ହୁଅନ୍ତୁ। ଆପଣଙ୍କ ଯୋଗଦାନ ଭାରତର ଶିକ୍ଷକମାନଙ୍କୁ ସାହାଯ୍ୟ କରେ।"
    },
    "Be the first to share something with fellow teachers.": {
        "English": "Be the first to share something with fellow teachers.", "Hindi": "साथी शिक्षकों के साथ कुछ साझा करने वाले पहले बनें।", "Kannada": "ಸಹ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಏನನ್ನಾದರೂ ಹಂಚಿಕೊಳ್ಳುವ ಮೊದಲಿಗರಾಗಿರಿ.", "Tamil": "சக ஆசிரியர்களுடன் ஏதாவது பகிரும் முதல் நபராக இருங்கள்.", "Telugu": "తోటి ఉపాధ్యాయులతో ఏదైనా పంచుకునే మొదటి వ్యక్తి అవ్వండి.", "Marathi": "सहकारी शिक्षकांसोबत काहीतरी शेअर करणारे पहिले व्हा.", "Bengali": "সহকর্মী শিক্ষকদের সাথে কিছু ভাগ করে নেওয়া প্রথম ব্যক্তি হন।", "Gujarati": "સાથી શિક્ષકો સાથે કંઈક વહેંચનાર પ્રથમ બનો.", "Punjabi": "ਸਾਥੀ ਅਧਿਆਪਕਾਂ ਨਾਲ ਕੁਝ ਸਾਂਝਾ ਕਰਨ ਵਾਲੇ ਪਹਿਲੇ ਬਣੋ।", "Malayalam": "സഹ അധ്യാപകരുമായി എന്തെങ്കിലും പങ്കിടുന്ന ആദ്യ വ്യക്തിയാകുക.", "Odia": "ସହକର୍ମୀ ଶିକ୍ଷକମାନଙ୍କ ସହ କିଛି ବାଣ୍ଟିବାରେ ପ୍ରଥମ ହୁଅନ୍ତୁ।"
    },
    "Browse All Teachers": {
        "English": "Browse All Teachers", "Hindi": "सभी शिक्षक देखें", "Kannada": "ಎಲ್ಲಾ ಶಿಕ್ಷಕರನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "அனைத்து ஆசிரியர்களையும் பார்க்கவும்", "Telugu": "అన్ని ఉపాధ్యాయులను బ్రౌజ్ చేయండి", "Marathi": "सर्व शिक्षक पहा", "Bengali": "সব শিক্ষক দেখুন", "Gujarati": "બધા શિક્ષકો જુઓ", "Punjabi": "ਸਾਰੇ ਅਧਿਆਪਕ ਵੇਖੋ", "Malayalam": "എല്ലാ അധ്യാപകരെയും കാണുക", "Odia": "ସମସ୍ତ ଶିକ୍ଷକ ଦେଖନ୍ତୁ"
    },
    "Browse all groups": {
        "English": "Browse all groups", "Hindi": "सभी समूह देखें", "Kannada": "ಎಲ್ಲಾ ಗುಂಪುಗಳನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "அனைத்து குழுக்களையும் பார்க்கவும்", "Telugu": "అన్ని గ్రూపులను బ్రౌజ్ చేయండి", "Marathi": "सर्व गट पहा", "Bengali": "সব গ্রুপ দেখুন", "Gujarati": "બધા જૂથો જુઓ", "Punjabi": "ਸਾਰੇ ਗਰੁੱਪ ਵੇਖੋ", "Malayalam": "എല്ലാ ഗ്രൂപ്പുകളും കാണുക", "Odia": "ସମସ୍ତ ଗୋଷ୍ଠୀ ଦେଖନ୍ତୁ"
    },
    "Call completed": {
        "English": "Call completed", "Hindi": "कॉल पूर्ण हुई", "Kannada": "ಕರೆ ಪೂರ್ಣಗೊಂಡಿದೆ", "Tamil": "அழைப்பு முடிந்தது", "Telugu": "కాల్ పూర్తయింది", "Marathi": "कॉल पूर्ण झाला", "Bengali": "কল সম্পন্ন", "Gujarati": "કૉલ પૂર્ણ", "Punjabi": "ਕਾਲ ਪੂਰੀ ਹੋਈ", "Malayalam": "കോൾ പൂർത്തിയായി", "Odia": "କଲ୍ ସମ୍ପୂର୍ଣ୍ଣ"
    },
    "Certifications": {
        "English": "Certifications", "Hindi": "प्रमाणपत्र", "Kannada": "ಪ್ರಮಾಣಪತ್ರಗಳು", "Tamil": "சான்றிதழ்கள்", "Telugu": "ధృవపత్రాలు", "Marathi": "प्रमाणपत्रे", "Bengali": "সার্টিফিকেশন", "Gujarati": "પ્રમાણપત્રો", "Punjabi": "ਪ੍ਰਮਾਣ-ਪੱਤਰ", "Malayalam": "സർട്ടിഫിക്കേഷനുകൾ", "Odia": "ପ୍ରମାଣପତ୍ର"
    },
    "Change photo": {
        "English": "Change photo", "Hindi": "फोटो बदलें", "Kannada": "ಫೋಟೋ ಬದಲಾಯಿಸಿ", "Tamil": "புகைப்படத்தை மாற்றவும்", "Telugu": "ఫోటో మార్చండి", "Marathi": "फोटो बदला", "Bengali": "ছবি পরিবর্তন করুন", "Gujarati": "ફોટો બદલો", "Punjabi": "ਫੋਟੋ ਬਦਲੋ", "Malayalam": "ഫോട്ടോ മാറ്റുക", "Odia": "ଫଟୋ ବଦଳାନ୍ତୁ"
    },
    "Choose which group to post in.": {
        "English": "Choose which group to post in.", "Hindi": "किस समूह में पोस्ट करना है चुनें।", "Kannada": "ಯಾವ ಗುಂಪಿನಲ್ಲಿ ಪೋಸ್ಟ್ ಮಾಡಬೇಕೆಂದು ಆಯ್ಕೆಮಾಡಿ.", "Tamil": "எந்த குழுவில் இடுகையிட வேண்டும் என்பதைத் தேர்ந்தெடுக்கவும்.", "Telugu": "ఏ గ్రూపులో పోస్ట్ చేయాలో ఎంచుకోండి.", "Marathi": "कोणत्या गटात पोस्ट करायचे ते निवडा.", "Bengali": "কোন গ্রুপে পোস্ট করবেন তা বেছে নিন।", "Gujarati": "કયા જૂથમાં પોસ્ટ કરવી તે પસંદ કરો.", "Punjabi": "ਚੁਣੋ ਕਿਸ ਗਰੁੱਪ ਵਿੱਚ ਪੋਸਟ ਕਰਨੀ ਹੈ।", "Malayalam": "ഏത് ഗ്രൂപ്പിൽ പോസ്റ്റ് ചെയ്യണമെന്ന് തിരഞ്ഞെടുക്കുക.", "Odia": "କେଉଁ ଗୋଷ୍ଠୀରେ ପୋଷ୍ଟ କରିବେ ତାହା ବାଛନ୍ତୁ।"
    },
    "Class:": {
        "English": "Class:", "Hindi": "कक्षा:", "Kannada": "ತರಗತಿ:", "Tamil": "வகுப்பு:", "Telugu": "తరగతి:", "Marathi": "वर्ग:", "Bengali": "ক্লাস:", "Gujarati": "વર્ગ:", "Punjabi": "ਜਮਾਤ:", "Malayalam": "ക്ലാസ്:", "Odia": "ଶ୍ରେଣୀ:"
    },
    "Clear Context": {
        "English": "Clear Context", "Hindi": "संदर्भ साफ़ करें", "Kannada": "ಸಂದರ್ಭವನ್ನು ತೆರವುಗೊಳಿಸಿ", "Tamil": "சூழலை அழிக்கவும்", "Telugu": "సందర్భాన్ని క్లియర్ చేయండి", "Marathi": "संदर्भ साफ करा", "Bengali": "প্রসঙ্গ মুছুন", "Gujarati": "સંદર્ભ સાફ કરો", "Punjabi": "ਸੰਦਰਭ ਸਾਫ਼ ਕਰੋ", "Malayalam": "സന്ദർഭം മായ്ക്കുക", "Odia": "ପ୍ରସଙ୍ଗ ସଫା କରନ୍ତୁ"
    },
    "Clear filters": {
        "English": "Clear filters", "Hindi": "फ़िल्टर साफ़ करें", "Kannada": "ಫಿಲ್ಟರ್‌ಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ", "Tamil": "வடிகட்டிகளை அழிக்கவும்", "Telugu": "ఫిల్టర్‌లను క్లియర్ చేయండి", "Marathi": "फिल्टर साफ करा", "Bengali": "ফিল্টার মুছুন", "Gujarati": "ફિલ્ટર સાફ કરો", "Punjabi": "ਫਿਲਟਰ ਸਾਫ਼ ਕਰੋ", "Malayalam": "ഫിൽട്ടറുകൾ മായ്ക്കുക", "Odia": "ଫିଲ୍ଟର ସଫା କରନ୍ତୁ"
    },
    "Comment": {
        "English": "Comment", "Hindi": "टिप्पणी", "Kannada": "ಕಾಮೆಂಟ್", "Tamil": "கருத்து", "Telugu": "వ్యాఖ్య", "Marathi": "टिप्पणी", "Bengali": "মন্তব্য", "Gujarati": "ટિપ્પણી", "Punjabi": "ਟਿੱਪਣੀ", "Malayalam": "അഭിപ്രായം", "Odia": "ମନ୍ତବ୍ୟ"
    },
    "Community Library": {
        "English": "Community Library", "Hindi": "समुदाय पुस्तकालय", "Kannada": "ಸಮುದಾಯ ಗ್ರಂಥಾಲಯ", "Tamil": "சமூக நூலகம்", "Telugu": "కమ్యూనిటీ లైబ్రరీ", "Marathi": "समुदाय ग्रंथालय", "Bengali": "কমিউনিটি লাইব্রেরি", "Gujarati": "સમુદાય પુસ્તકાલય", "Punjabi": "ਕਮਿਊਨਿਟੀ ਲਾਇਬ੍ਰੇਰੀ", "Malayalam": "കമ്മ്യൂണിറ്റി ലൈബ്രറി", "Odia": "ସମୁଦାୟ ଗ୍ରନ୍ଥାଗାର"
    },
    "Community Visibility": {
        "English": "Community Visibility", "Hindi": "समुदाय दृश्यता", "Kannada": "ಸಮುದಾಯ ಗೋಚರತೆ", "Tamil": "சமூகத் தெரிவுநிலை", "Telugu": "కమ్యూనిటీ దృశ్యత", "Marathi": "समुदाय दृश्यता", "Bengali": "কমিউনিটি দৃশ্যমানতা", "Gujarati": "સમુદાય દૃશ્યતા", "Punjabi": "ਕਮਿਊਨਿਟੀ ਦਿੱਖ", "Malayalam": "കമ്മ്യൂണിറ്റി ദൃശ്യത", "Odia": "ସମୁଦାୟ ଦୃଶ୍ୟତା"
    },
    "Complete your professional profile to join the community.": {
        "English": "Complete your professional profile to join the community.", "Hindi": "समुदाय में शामिल होने के लिए अपनी पेशेवर प्रोफ़ाइल पूरी करें।", "Kannada": "ಸಮುದಾಯವನ್ನು ಸೇರಲು ನಿಮ್ಮ ವೃತ್ತಿಪರ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ.", "Tamil": "சமூகத்தில் சேர உங்கள் தொழில்முறை சுயவிவரத்தை முடிக்கவும்.", "Telugu": "కమ్యూనిటీలో చేరడానికి మీ వృత్తిపరమైన ప్రొఫైల్‌ను పూర్తి చేయండి.", "Marathi": "समुदायात सामील होण्यासाठी तुमची व्यावसायिक प्रोफाइल पूर्ण करा.", "Bengali": "কমিউনিটিতে যোগ দিতে আপনার পেশাদার প্রোফাইল সম্পূর্ণ করুন।", "Gujarati": "સમુદાયમાં જોડાવા તમારી વ્યાવસાયિક પ્રોફાઇલ પૂર્ણ કરો.", "Punjabi": "ਕਮਿਊਨਿਟੀ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਆਪਣੀ ਪੇਸ਼ੇਵਰ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ।", "Malayalam": "കമ്മ്യൂണിറ്റിയിൽ ചേരാൻ നിങ്ങളുടെ പ്രൊഫഷണൽ പ്രൊഫൈൽ പൂർത്തിയാക്കുക.", "Odia": "ସମୁଦାୟରେ ଯୋଗ ଦେବାକୁ ଆପଣଙ୍କ ବୃତ୍ତିଗତ ପ୍ରୋଫାଇଲ୍ ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ।"
    },
    "Concerns Raised": {
        "English": "Concerns Raised", "Hindi": "उठाई गई चिंताएँ", "Kannada": "ಎತ್ತಲಾದ ಕಳವಳಗಳು", "Tamil": "எழுப்பப்பட்ட கவலைகள்", "Telugu": "లేవనెత్తిన ఆందోళనలు", "Marathi": "उपस्थित केलेल्या चिंता", "Bengali": "উত্থাপিত উদ্বেগ", "Gujarati": "ઉઠાવેલી ચિંતાઓ", "Punjabi": "ਉਠਾਏ ਗਏ ਫਿਕਰ", "Malayalam": "ഉന്നയിച്ച ആശങ്കകൾ", "Odia": "ଉଠାଯାଇଥିବା ଚିନ୍ତା"
    },
    "Confirm": {
        "English": "Confirm", "Hindi": "पुष्टि करें", "Kannada": "ದೃಢೀಕರಿಸಿ", "Tamil": "உறுதிப்படுத்தவும்", "Telugu": "నిర్ధారించండి", "Marathi": "पुष्टी करा", "Bengali": "নিশ্চিত করুন", "Gujarati": "પુષ્ટિ કરો", "Punjabi": "ਪੁਸ਼ਟੀ ਕਰੋ", "Malayalam": "സ്ഥിരീകരിക്കുക", "Odia": "ନିଶ୍ଚିତ କରନ୍ତୁ"
    },
    "Connection request sent": {
        "English": "Connection request sent", "Hindi": "कनेक्शन अनुरोध भेजा गया", "Kannada": "ಸಂಪರ್ಕ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ", "Tamil": "இணைப்பு கோரிக்கை அனுப்பப்பட்டது", "Telugu": "కనెక్షన్ అభ్యర్థన పంపబడింది", "Marathi": "कनेक्शन विनंती पाठवली", "Bengali": "সংযোগ অনুরোধ পাঠানো হয়েছে", "Gujarati": "જોડાણ વિનંતી મોકલી", "Punjabi": "ਕਨੈਕਸ਼ਨ ਬੇਨਤੀ ਭੇਜੀ", "Malayalam": "കണക്ഷൻ അഭ്യർത്ഥന അയച്ചു", "Odia": "ସଂଯୋଗ ଅନୁରୋଧ ପଠାଗଲା"
    },
    "Content created and feature diversity": {
        "English": "Content created and feature diversity", "Hindi": "बनाई गई सामग्री और फ़ीचर विविधता", "Kannada": "ರಚಿಸಿದ ವಿಷಯ ಮತ್ತು ವೈಶಿಷ್ಟ್ಯ ವೈವಿಧ್ಯತೆ", "Tamil": "உருவாக்கப்பட்ட உள்ளடக்கம் மற்றும் அம்ச பன்முகத்தன்மை", "Telugu": "సృష్టించిన కంటెంట్ మరియు ఫీచర్ వైవిధ్యం", "Marathi": "तयार केलेली सामग्री आणि वैशिष्ट्य विविधता", "Bengali": "তৈরি কনটেন্ট ও ফিচার বৈচিত্র্য", "Gujarati": "બનાવેલી સામગ્રી અને ફીચર વિવિધતા", "Punjabi": "ਬਣਾਈ ਸਮੱਗਰੀ ਅਤੇ ਫੀਚਰ ਵਿਭਿੰਨਤਾ", "Malayalam": "സൃഷ്ടിച്ച ഉള്ളടക്കവും ഫീച്ചർ വൈവിധ്യവും", "Odia": "ସୃଷ୍ଟି ବିଷୟବସ୍ତୁ ଓ ଫିଚର୍ ବିବିଧତା"
    },
    "Content from teachers you follow will appear here.": {
        "English": "Content from teachers you follow will appear here.", "Hindi": "जिन शिक्षकों को आप फ़ॉलो करते हैं उनकी सामग्री यहाँ दिखेगी।", "Kannada": "ನೀವು ಅನುಸರಿಸುವ ಶಿಕ್ಷಕರ ವಿಷಯವು ಇಲ್ಲಿ ಗೋಚರಿಸುತ್ತದೆ.", "Tamil": "நீங்கள் பின்தொடரும் ஆசிரியர்களின் உள்ளடக்கம் இங்கே தோன்றும்.", "Telugu": "మీరు అనుసరించే ఉపాధ్యాయుల కంటెంట్ ఇక్కడ కనిపిస్తుంది.", "Marathi": "तुम्ही फॉलो करत असलेल्या शिक्षकांची सामग्री येथे दिसेल.", "Bengali": "আপনি যে শিক্ষকদের অনুসরণ করেন তাদের কনটেন্ট এখানে দেখাবে।", "Gujarati": "તમે અનુસરો છો તે શિક્ષકોની સામગ્રી અહીં દેખાશે.", "Punjabi": "ਜਿਨ੍ਹਾਂ ਅਧਿਆਪਕਾਂ ਨੂੰ ਤੁਸੀਂ ਫਾਲੋ ਕਰਦੇ ਹੋ ਉਨ੍ਹਾਂ ਦੀ ਸਮੱਗਰੀ ਇੱਥੇ ਦਿਖੇਗੀ।", "Malayalam": "നിങ്ങൾ പിന്തുടരുന്ന അധ്യാപകരുടെ ഉള്ളടക്കം ഇവിടെ ദൃശ്യമാകും.", "Odia": "ଆପଣ ଅନୁସରଣ କରୁଥିବା ଶିକ୍ଷକମାନଙ୍କ ବିଷୟବସ୍ତୁ ଏଠାରେ ଦେଖାଯିବ।"
    },
    "Continue to payment": {
        "English": "Continue to payment", "Hindi": "भुगतान पर जाएँ", "Kannada": "ಪಾವತಿಗೆ ಮುಂದುವರಿಯಿರಿ", "Tamil": "கட்டணத்திற்குச் செல்லவும்", "Telugu": "చెల్లింపుకు కొనసాగండి", "Marathi": "देयकाकडे जा", "Bengali": "পেমেন্টে যান", "Gujarati": "ચુકવણી પર જાઓ", "Punjabi": "ਭੁਗਤਾਨ ਤੇ ਜਾਓ", "Malayalam": "പേയ്മെന്റിലേക്ക് തുടരുക", "Odia": "ଦେୟକୁ ଯାଆନ୍ତୁ"
    },
    "Control how your data is used": {
        "English": "Control how your data is used", "Hindi": "अपने डेटा के उपयोग को नियंत्रित करें", "Kannada": "ನಿಮ್ಮ ಡೇಟಾವನ್ನು ಹೇಗೆ ಬಳಸಲಾಗುತ್ತದೆ ಎಂಬುದನ್ನು ನಿಯಂತ್ರಿಸಿ", "Tamil": "உங்கள் தரவு எவ்வாறு பயன்படுத்தப்படுகிறது என்பதைக் கட்டுப்படுத்தவும்", "Telugu": "మీ డేటా ఎలా ఉపయోగించబడుతుందో నియంత్రించండి", "Marathi": "तुमचा डेटा कसा वापरला जातो ते नियंत्रित करा", "Bengali": "আপনার ডেটা কীভাবে ব্যবহার হয় নিয়ন্ত্রণ করুন", "Gujarati": "તમારો ડેટા કેવી રીતે વપરાય તે નિયંત્રિત કરો", "Punjabi": "ਆਪਣਾ ਡਾਟਾ ਕਿਵੇਂ ਵਰਤਿਆ ਜਾਂਦਾ ਹੈ ਉਸ ਨੂੰ ਕੰਟਰੋਲ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ ഡാറ്റ എങ്ങനെ ഉപയോഗിക്കുന്നു എന്ന് നിയന്ത്രിക്കുക", "Odia": "ଆପଣଙ୍କ ଡାଟା କିପରି ବ୍ୟବହାର ହୁଏ ତାହା ନିୟନ୍ତ୍ରଣ କରନ୍ତୁ"
    },
    "Could not join group": {
        "English": "Could not join group", "Hindi": "समूह में शामिल नहीं हो सके", "Kannada": "ಗುಂಪು ಸೇರಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "குழுவில் சேர முடியவில்லை", "Telugu": "గ్రూపులో చేరలేకపోయారు", "Marathi": "गटात सामील होऊ शकले नाही", "Bengali": "গ্রুপে যোগ দেওয়া যায়নি", "Gujarati": "જૂથમાં જોડાઈ શકાયું નહીં", "Punjabi": "ਗਰੁੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਨਹੀਂ ਹੋ ਸਕੇ", "Malayalam": "ഗ്രൂപ്പിൽ ചേരാൻ കഴിഞ്ഞില്ല", "Odia": "ଗୋଷ୍ଠୀରେ ଯୋଗ ଦେଇ ପାରିଲେ ନାହିଁ"
    },
    "Could not load teachers": {
        "English": "Could not load teachers", "Hindi": "शिक्षक लोड नहीं हो सके", "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "ஆசிரியர்களை ஏற்ற முடியவில்லை", "Telugu": "ఉపాధ్యాయులను లోడ్ చేయలేకపోయాము", "Marathi": "शिक्षक लोड करता आले नाहीत", "Bengali": "শিক্ষকদের লোড করা যায়নি", "Gujarati": "શિક્ષકો લોડ થઈ શક્યા નહીં", "Punjabi": "ਅਧਿਆਪਕ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੇ", "Malayalam": "അധ്യാപകരെ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ଶିକ୍ଷକମାନଙ୍କୁ ଲୋଡ୍ କରିପାରିଲେ ନାହିଁ"
    },
    "Could not save feedback. Please check your connection.": {
        "English": "Could not save feedback. Please check your connection.", "Hindi": "प्रतिक्रिया सहेजी नहीं जा सकी। कृपया अपना कनेक्शन जाँचें।", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ.", "Tamil": "கருத்தை சேமிக்க முடியவில்லை. உங்கள் இணைப்பை சரிபார்க்கவும்.", "Telugu": "ఫీడ్‌బ్యాక్ సేవ్ చేయలేకపోయాము. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేయండి.", "Marathi": "अभिप्राय जतन करता आला नाही. कृपया तुमचे कनेक्शन तपासा.", "Bengali": "প্রতিক্রিয়া সংরক্ষণ করা যায়নি। অনুগ্রহ করে আপনার সংযোগ চেক করুন।", "Gujarati": "પ્રતિસાદ સાચવી શકાયો નહીં. કૃપા કરી તમારું જોડાણ તપાસો.", "Punjabi": "ਫੀਡਬੈਕ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਚੈੱਕ ਕਰੋ।", "Malayalam": "ഫീഡ്‌ബാക്ക് സംരക്ഷിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി നിങ്ങളുടെ കണക്ഷൻ പരിശോധിക്കുക.", "Odia": "ମତାମତ ସଂରକ୍ଷଣ କରିପାରିଲେ ନାହିଁ। ଦୟାକରି ଆପଣଙ୍କ ସଂଯୋଗ ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "Could not save resource": {
        "English": "Could not save resource", "Hindi": "संसाधन सहेजा नहीं जा सका", "Kannada": "ಸಂಪನ್ಮೂಲವನ್ನು ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "வளத்தைச் சேமிக்க முடியவில்லை", "Telugu": "వనరును సేవ్ చేయలేకపోయాము", "Marathi": "संसाधन जतन करता आले नाही", "Bengali": "রিসোর্স সংরক্ষণ করা যায়নি", "Gujarati": "સંસાધન સાચવી શકાયું નહીં", "Punjabi": "ਸਰੋਤ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਹੋ ਸਕਿਆ", "Malayalam": "വിഭവം സംരക്ഷിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ସମ୍ବଳ ସଂରକ୍ଷଣ କରିପାରିଲେ ନାହିଁ"
    },
    "Could not send request": {
        "English": "Could not send request", "Hindi": "अनुरोध भेजा नहीं जा सका", "Kannada": "ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "கோரிக்கை அனுப்ப முடியவில்லை", "Telugu": "అభ్యర్థన పంపలేకపోయాము", "Marathi": "विनंती पाठवता आली नाही", "Bengali": "অনুরোধ পাঠানো যায়নি", "Gujarati": "વિનંતી મોકલી શકાઈ નહીં", "Punjabi": "ਬੇਨਤੀ ਨਹੀਂ ਭੇਜੀ ਜਾ ਸਕੀ", "Malayalam": "അഭ്യർത്ഥന അയയ്ക്കാൻ കഴിഞ്ഞില്ല", "Odia": "ଅନୁରୋଧ ପଠାଇ ପାରିଲେ ନାହିଁ"
    },
    "Could not update like": {
        "English": "Could not update like", "Hindi": "लाइक अपडेट नहीं हो सका", "Kannada": "ಲೈಕ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "லைக்கை புதுப்பிக்க முடியவில்லை", "Telugu": "లైక్ అప్‌డేట్ చేయలేకపోయాము", "Marathi": "लाइक अपडेट करता आला नाही", "Bengali": "লাইক আপডেট করা যায়নি", "Gujarati": "લાઇક અપડેટ થઈ શકી નહીં", "Punjabi": "ਲਾਈਕ ਅਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕੀ", "Malayalam": "ലൈക്ക് അപ്‌ഡേറ്റ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ଲାଇକ୍ ଅପଡେଟ୍ କରିପାରିଲେ ନାହିଁ"
    },
    "Could not update profile.": {
        "English": "Could not update profile.", "Hindi": "प्रोफ़ाइल अपडेट नहीं हो सकी।", "Kannada": "ಪ್ರೊಫೈಲ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", "Tamil": "சுயவிவரத்தை புதுப்பிக்க முடியவில்லை.", "Telugu": "ప్రొఫైల్ అప్‌డేట్ చేయలేకపోయాము.", "Marathi": "प्रोफाइल अपडेट करता आली नाही.", "Bengali": "প্রোফাইল আপডেট করা যায়নি।", "Gujarati": "પ્રોફાઇલ અપડેટ થઈ શકી નહીં.", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਅਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕੀ।", "Malayalam": "പ്രൊഫൈൽ അപ്‌ഡേറ്റ് ചെയ്യാൻ കഴിഞ്ഞില്ല.", "Odia": "ପ୍ରୋଫାଇଲ୍ ଅପଡେଟ୍ କରିପାରିଲେ ନାହିଁ।"
    },
    "Create Post": {
        "English": "Create Post", "Hindi": "पोस्ट बनाएँ", "Kannada": "ಪೋಸ್ಟ್ ರಚಿಸಿ", "Tamil": "இடுகையை உருவாக்கவும்", "Telugu": "పోస్ట్ సృష్టించండి", "Marathi": "पोस्ट तयार करा", "Bengali": "পোস্ট তৈরি করুন", "Gujarati": "પોસ્ટ બનાવો", "Punjabi": "ਪੋਸਟ ਬਣਾਓ", "Malayalam": "പോസ്റ്റ് സൃഷ്ടിക്കുക", "Odia": "ପୋଷ୍ଟ ତିଆରି କରନ୍ତୁ"
    },
    "Created successfully! You can view and edit this from your library.": {
        "English": "Created successfully! You can view and edit this from your library.", "Hindi": "सफलतापूर्वक बनाया गया! आप इसे अपनी लाइब्रेरी से देख और संपादित कर सकते हैं।", "Kannada": "ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ! ನಿಮ್ಮ ಗ್ರಂಥಾಲಯದಿಂದ ಇದನ್ನು ವೀಕ್ಷಿಸಿ ಮತ್ತು ಸಂಪಾದಿಸಬಹುದು.", "Tamil": "வெற்றிகரமாக உருவாக்கப்பட்டது! உங்கள் நூலகத்திலிருந்து இதைப் பார்த்து திருத்தலாம்.", "Telugu": "విజయవంతంగా సృష్టించబడింది! మీ లైబ్రరీ నుండి దీన్ని వీక్షించి సవరించవచ్చు.", "Marathi": "यशस्वीरित्या तयार केले! तुम्ही हे तुमच्या ग्रंथालयातून पाहू आणि संपादित करू शकता.", "Bengali": "সফলভাবে তৈরি! আপনি এটি আপনার লাইব্রেরি থেকে দেখতে ও সম্পাদনা করতে পারেন।", "Gujarati": "સફળતાપૂર્વક બનાવ્યું! તમે આને તમારી પુસ્તકાલયમાંથી જોઈ અને સંપાદિત કરી શકો છો.", "Punjabi": "ਸਫਲਤਾਪੂਰਵਕ ਬਣਾਇਆ! ਤੁਸੀਂ ਇਸਨੂੰ ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਤੋਂ ਵੇਖ ਅਤੇ ਸੰਪਾਦਿਤ ਕਰ ਸਕਦੇ ਹੋ।", "Malayalam": "വിജയകരമായി സൃഷ്ടിച്ചു! നിങ്ങളുടെ ലൈബ്രറിയിൽ നിന്ന് ഇത് കാണാനും എഡിറ്റ് ചെയ്യാനും കഴിയും.", "Odia": "ସଫଳଭାବେ ତିଆରି ହେଲା! ଆପଣ ଏହାକୁ ଆପଣଙ୍କ ଗ୍ରନ୍ଥାଗାରରୁ ଦେଖି ଓ ସମ୍ପାଦନ କରିପାରିବେ।"
    },
    "Criteria": {
        "English": "Criteria", "Hindi": "मानदंड", "Kannada": "ಮಾನದಂಡಗಳು", "Tamil": "அளவுகோல்கள்", "Telugu": "ప్రమాణాలు", "Marathi": "निकष", "Bengali": "মানদণ্ড", "Gujarati": "માપદંડ", "Punjabi": "ਮਾਪਦੰਡ", "Malayalam": "മാനദണ്ഡങ്ങൾ", "Odia": "ମାନଦଣ୍ଡ"
    },
    "Curated educational videos for Indian classrooms": {
        "English": "Curated educational videos for Indian classrooms", "Hindi": "भारतीय कक्षाओं के लिए चुनिंदा शैक्षिक वीडियो", "Kannada": "ಭಾರತೀಯ ತರಗತಿಗಳಿಗಾಗಿ ಆಯ್ದ ಶೈಕ್ಷಣಿಕ ವೀಡಿಯೊಗಳು", "Tamil": "இந்திய வகுப்பறைகளுக்கான தேர்ந்தெடுக்கப்பட்ட கல்வி வீடியோக்கள்", "Telugu": "భారతీయ తరగతి గదుల కోసం ఎంపిక చేసిన విద్యా వీడియోలు", "Marathi": "भारतीय वर्गांसाठी निवडक शैक्षणिक व्हिडिओ", "Bengali": "ভারতীয় ক্লাসরুমের জন্য বাছাই করা শিক্ষামূলক ভিডিও", "Gujarati": "ભારતીય વર્ગો માટે પસંદગીના શૈક્ષણિક વિડિઓ", "Punjabi": "ਭਾਰਤੀ ਕਲਾਸਰੂਮਾਂ ਲਈ ਚੁਣੀਆਂ ਵਿਦਿਅਕ ਵੀਡੀਓਜ਼", "Malayalam": "ഇന്ത്യൻ ക്ലാസ്റൂമുകൾക്കായി തിരഞ്ഞെടുത്ത വിദ്യാഭ്യാസ വീഡിയോകൾ", "Odia": "ଭାରତୀୟ ଶ୍ରେଣୀଗୃହ ପାଇଁ ବଛାଯାଇଥିବା ଶିକ୍ଷାଗତ ଭିଡିଓ"
    },
    "Curating your videos…": {
        "English": "Curating your videos…", "Hindi": "आपके वीडियो चुने जा रहे हैं…", "Kannada": "ನಿಮ್ಮ ವೀಡಿಯೊಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗುತ್ತಿದೆ…", "Tamil": "உங்கள் வீடியோக்கள் தேர்ந்தெடுக்கப்படுகின்றன…", "Telugu": "మీ వీడియోలను ఎంపిక చేస్తోంది…", "Marathi": "तुमचे व्हिडिओ निवडले जात आहेत…", "Bengali": "আপনার ভিডিও বাছাই করা হচ্ছে…", "Gujarati": "તમારા વિડિઓ પસંદ કરી રહ્યા છીએ…", "Punjabi": "ਤੁਹਾਡੀਆਂ ਵੀਡੀਓਜ਼ ਚੁਣ ਰਹੇ ਹਾਂ…", "Malayalam": "നിങ്ങളുടെ വീഡിയോകൾ തിരഞ്ഞെടുക്കുന്നു…", "Odia": "ଆପଣଙ୍କ ଭିଡିଓ ବଛାଯାଉଛି…"
    },
    "Day Streak": {
        "English": "Day Streak", "Hindi": "दिनों की लकीर", "Kannada": "ದಿನಗಳ ಸರಣಿ", "Tamil": "தினசரி தொடர்", "Telugu": "రోజువారీ స్ట్రీక్", "Marathi": "दिवसांची मालिका", "Bengali": "দিনের ধারা", "Gujarati": "દિવસોની શ્રેણી", "Punjabi": "ਦਿਨਾਂ ਦੀ ਲੜੀ", "Malayalam": "ദിന സ്ട്രീക്ക്", "Odia": "ଦିନର ଧାରା"
    },
    "Description": {
        "English": "Description", "Hindi": "विवरण", "Kannada": "ವಿವರಣೆ", "Tamil": "விளக்கம்", "Telugu": "వివరణ", "Marathi": "वर्णन", "Bengali": "বিবরণ", "Gujarati": "વર્ણન", "Punjabi": "ਵੇਰਵਾ", "Malayalam": "വിവരണം", "Odia": "ବିବରଣୀ"
    },
    "Difficulty Level": {
        "English": "Difficulty Level", "Hindi": "कठिनाई स्तर", "Kannada": "ಕಷ್ಟದ ಮಟ್ಟ", "Tamil": "சிரம நிலை", "Telugu": "కష్ట స్థాయి", "Marathi": "अडचण पातळी", "Bengali": "কঠিনতার স্তর", "Gujarati": "મુશ્કેલી સ્તર", "Punjabi": "ਔਖਾਈ ਪੱਧਰ", "Malayalam": "ബുദ്ധിമുട്ട് നില", "Odia": "କଠିନତା ସ୍ତର"
    },
    "Discover Groups": {
        "English": "Discover Groups", "Hindi": "समूह खोजें", "Kannada": "ಗುಂಪುಗಳನ್ನು ಅನ್ವೇಷಿಸಿ", "Tamil": "குழுக்களைக் கண்டறி", "Telugu": "గ్రూపులను కనుగొనండి", "Marathi": "गट शोधा", "Bengali": "গ্রুপ আবিষ্কার করুন", "Gujarati": "જૂથો શોધો", "Punjabi": "ਗਰੁੱਪ ਲੱਭੋ", "Malayalam": "ഗ്രൂപ്പുകൾ കണ്ടെത്തുക", "Odia": "ଗୋଷ୍ଠୀ ଖୋଜନ୍ତୁ"
    },
    "Discover and share educational resources with fellow teachers.": {
        "English": "Discover and share educational resources with fellow teachers.", "Hindi": "साथी शिक्षकों के साथ शैक्षिक संसाधन खोजें और साझा करें।", "Kannada": "ಸಹ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಶೈಕ್ಷಣಿಕ ಸಂಪನ್ಮೂಲಗಳನ್ನು ಅನ್ವೇಷಿಸಿ ಮತ್ತು ಹಂಚಿಕೊಳ್ಳಿ.", "Tamil": "சக ஆசிரியர்களுடன் கல்வி வளங்களைக் கண்டறிந்து பகிரவும்.", "Telugu": "తోటి ఉపాధ్యాయులతో విద్యా వనరులను కనుగొని పంచుకోండి.", "Marathi": "सहकारी शिक्षकांसोबत शैक्षणिक संसाधने शोधा आणि शेअर करा.", "Bengali": "সহকর্মী শিক্ষকদের সাথে শিক্ষামূলক সম্পদ আবিষ্কার ও শেয়ার করুন।", "Gujarati": "સહ-શિક્ષકો સાથે શૈક્ષણિક સંસાધનો શોધો અને શેર કરો.", "Punjabi": "ਸਾਥੀ ਅਧਿਆਪਕਾਂ ਨਾਲ ਵਿਦਿਅਕ ਸਮੱਗਰੀ ਖੋਜੋ ਅਤੇ ਸਾਂਝੀ ਕਰੋ।", "Malayalam": "സഹ അധ്യാപകരുമായി വിദ്യാഭ്യാസ വിഭവങ്ങൾ കണ്ടെത്തി പങ്കിടുക.", "Odia": "ସହକର୍ମୀ ଶିକ୍ଷକମାନଙ୍କ ସହ ଶିକ୍ଷାଗତ ସମ୍ବଳ ଖୋଜନ୍ତୁ ଓ ବାଣ୍ଟନ୍ତୁ।"
    },
    "Dismiss checklist": {
        "English": "Dismiss checklist", "Hindi": "चेकलिस्ट हटाएं", "Kannada": "ಪರಿಶೀಲನಾ ಪಟ್ಟಿಯನ್ನು ತೆಗೆದುಹಾಕಿ", "Tamil": "சரிபார்ப்புப் பட்டியலை மூடு", "Telugu": "చెక్‌లిస్ట్‌ను తొలగించండి", "Marathi": "तपासणी सूची काढा", "Bengali": "চেকলিস্ট সরান", "Gujarati": "ચેકલિસ્ટ દૂર કરો", "Punjabi": "ਚੈੱਕਲਿਸਟ ਹਟਾਓ", "Malayalam": "ചെക്ക്‌ലിസ്റ്റ് നീക്കം ചെയ്യുക", "Odia": "ଚେକଲିଷ୍ଟ ହଟାନ୍ତୁ"
    },
    "Download": {
        "English": "Download", "Hindi": "डाउनलोड", "Kannada": "ಡೌನ್‌ಲೋಡ್", "Tamil": "பதிவிறக்கம்", "Telugu": "డౌన్‌లోడ్", "Marathi": "डाउनलोड", "Bengali": "ডাউনলোড", "Gujarati": "ડાઉનલોડ", "Punjabi": "ਡਾਊਨਲੋਡ", "Malayalam": "ഡൗൺലോഡ്", "Odia": "ଡାଉନଲୋଡ୍"
    },
    "Download all content as ZIP": {
        "English": "Download all content as ZIP", "Hindi": "सभी सामग्री ZIP के रूप में डाउनलोड करें", "Kannada": "ಎಲ್ಲಾ ವಿಷಯವನ್ನು ZIP ಆಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ", "Tamil": "அனைத்து உள்ளடக்கத்தையும் ZIP ஆகப் பதிவிறக்கவும்", "Telugu": "మొత్తం కంటెంట్‌ను ZIPగా డౌన్‌లోడ్ చేయండి", "Marathi": "सर्व सामग्री ZIP म्हणून डाउनलोड करा", "Bengali": "সমস্ত কন্টেন্ট ZIP হিসাবে ডাউনলোড করুন", "Gujarati": "બધી સામગ્રી ZIP તરીકે ડાઉનલોડ કરો", "Punjabi": "ਸਾਰੀ ਸਮੱਗਰੀ ZIP ਵਜੋਂ ਡਾਊਨਲੋਡ ਕਰੋ", "Malayalam": "എല്ലാ ഉള്ളടക്കവും ZIP ആയി ഡൗൺലോഡ് ചെയ്യുക", "Odia": "ସମସ୍ତ ବିଷୟବସ୍ତୁ ZIP ଭାବେ ଡାଉନଲୋଡ୍ କରନ୍ତୁ"
    },
    "Email address": {
        "English": "Email address", "Hindi": "ईमेल पता", "Kannada": "ಇಮೇಲ್ ವಿಳಾಸ", "Tamil": "மின்னஞ்சல் முகவரி", "Telugu": "ఇమెయిల్ చిరునామా", "Marathi": "ईमेल पत्ता", "Bengali": "ইমেল ঠিকানা", "Gujarati": "ઈમેલ સરનામું", "Punjabi": "ਈਮੇਲ ਪਤਾ", "Malayalam": "ഇമെയിൽ വിലാസം", "Odia": "ଇମେଲ୍ ଠିକଣା"
    },
    "Enable notifications to never miss a message from fellow teachers.": {
        "English": "Enable notifications to never miss a message from fellow teachers.", "Hindi": "साथी शिक्षकों के संदेशों से न चूकने के लिए सूचनाएं चालू करें।", "Kannada": "ಸಹ ಶಿಕ್ಷಕರ ಸಂದೇಶಗಳನ್ನು ತಪ್ಪಿಸದಂತೆ ಅಧಿಸೂಚನೆಗಳನ್ನು ಆನ್ ಮಾಡಿ.", "Tamil": "சக ஆசிரியர்களின் செய்தியைத் தவறவிடாமல் இருக்க அறிவிப்புகளை இயக்கவும்.", "Telugu": "తోటి ఉపాధ్యాయుల సందేశాన్ని కోల్పోకుండా నోటిఫికేషన్‌లను ఆన్ చేయండి.", "Marathi": "सहकारी शिक्षकांचा संदेश चुकू नये म्हणून सूचना सुरू करा.", "Bengali": "সহকর্মী শিক্ষকদের বার্তা মিস না করতে নোটিফিকেশন চালু করুন।", "Gujarati": "સહ-શિક્ષકોનો સંદેશ ચૂકી ન જાવ તે માટે સૂચનાઓ ચાલુ કરો.", "Punjabi": "ਸਾਥੀ ਅਧਿਆਪਕਾਂ ਦਾ ਸੁਨੇਹਾ ਕਦੇ ਨਾ ਖੁੰਝਾਉਣ ਲਈ ਸੂਚਨਾਵਾਂ ਚਾਲੂ ਕਰੋ।", "Malayalam": "സഹ അധ്യാപകരുടെ സന്ദേശം നഷ്ടപ്പെടാതിരിക്കാൻ അറിയിപ്പുകൾ ഓണാക്കുക.", "Odia": "ସହକର୍ମୀ ଶିକ୍ଷକମାନଙ୍କ ସନ୍ଦେଶ ନ ହରାଇବାକୁ ବିଜ୍ଞପ୍ତି ସକ୍ରିୟ କରନ୍ତୁ।"
    },
    "Engagement": {
        "English": "Engagement", "Hindi": "सहभागिता", "Kannada": "ತೊಡಗಿಸಿಕೊಳ್ಳುವಿಕೆ", "Tamil": "ஈடுபாடு", "Telugu": "నిమగ్నత", "Marathi": "सहभाग", "Bengali": "সম্পৃক্ততা", "Gujarati": "જોડાણ", "Punjabi": "ਸ਼ਮੂਲੀਅਤ", "Malayalam": "ഇടപെടൽ", "Odia": "ସମ୍ପୃକ୍ତି"
    },
    "Error signing out": {
        "English": "Error signing out", "Hindi": "साइन आउट करने में त्रुटि", "Kannada": "ಸೈನ್ ಔಟ್ ಮಾಡುವಲ್ಲಿ ದೋಷ", "Tamil": "வெளியேறுவதில் பிழை", "Telugu": "సైన్ అవుట్ చేయడంలో లోపం", "Marathi": "साइन आउट करताना त्रुटी", "Bengali": "সাইন আউটে ত্রুটি", "Gujarati": "સાઇન આઉટ કરવામાં ભૂલ", "Punjabi": "ਸਾਈਨ ਆਉਟ ਕਰਨ ਵਿੱਚ ਗਲਤੀ", "Malayalam": "സൈൻ ഔട്ട് ചെയ്യുന്നതിൽ പിശക്", "Odia": "ସାଇନ୍ ଆଉଟ୍ କରିବାରେ ତ୍ରୁଟି"
    },
    "Excellent": {
        "English": "Excellent", "Hindi": "उत्कृष्ट", "Kannada": "ಅತ್ಯುತ್ತಮ", "Tamil": "சிறந்தது", "Telugu": "అద్భుతం", "Marathi": "उत्कृष्ट", "Bengali": "চমৎকার", "Gujarati": "ઉત્તમ", "Punjabi": "ਸ਼ਾਨਦਾਰ", "Malayalam": "മികച്ചത്", "Odia": "ଉତ୍କୃଷ୍ଟ"
    },
    "Explore Groups": {
        "English": "Explore Groups", "Hindi": "समूह देखें", "Kannada": "ಗುಂಪುಗಳನ್ನು ಅನ್ವೇಷಿಸಿ", "Tamil": "குழுக்களை ஆராயவும்", "Telugu": "గ్రూపులను అన్వేషించండి", "Marathi": "गट एक्सप्लोर करा", "Bengali": "গ্রুপ অন্বেষণ করুন", "Gujarati": "જૂથો એક્સપ્લોર કરો", "Punjabi": "ਗਰੁੱਪ ਵੇਖੋ", "Malayalam": "ഗ്രൂപ്പുകൾ പര്യവേക്ഷണം ചെയ്യുക", "Odia": "ଗୋଷ୍ଠୀ ଅନ୍ୱେଷଣ କରନ୍ତୁ"
    },
    "Export": {
        "English": "Export", "Hindi": "निर्यात", "Kannada": "ರಫ್ತು", "Tamil": "ஏற்றுமதி", "Telugu": "ఎగుమతి", "Marathi": "निर्यात", "Bengali": "এক্সপোর্ট", "Gujarati": "નિકાસ", "Punjabi": "ਨਿਰਯਾਤ", "Malayalam": "കയറ്റുമതി", "Odia": "ରପ୍ତାନି"
    },
    "Export Your Data": {
        "English": "Export Your Data", "Hindi": "अपना डेटा निर्यात करें", "Kannada": "ನಿಮ್ಮ ಡೇಟಾವನ್ನು ರಫ್ತು ಮಾಡಿ", "Tamil": "உங்கள் தரவை ஏற்றுமதி செய்யவும்", "Telugu": "మీ డేటాను ఎగుమతి చేయండి", "Marathi": "तुमचा डेटा निर्यात करा", "Bengali": "আপনার ডেটা এক্সপোর্ট করুন", "Gujarati": "તમારો ડેટા નિકાસ કરો", "Punjabi": "ਆਪਣਾ ਡੇਟਾ ਨਿਰਯਾਤ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ ഡാറ്റ കയറ്റുമതി ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ଡାଟା ରପ୍ତାନି କରନ୍ତୁ"
    },
    "Failed to create post. Please try again.": {
        "English": "Failed to create post. Please try again.", "Hindi": "पोस्ट बनाने में विफल। कृपया पुनः प्रयास करें।", "Kannada": "ಪೋಸ್ಟ್ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "இடுகையை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "పోస్ట్‌ను సృష్టించడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "पोस्ट तयार करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.", "Bengali": "পোস্ট তৈরি করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "પોસ્ટ બનાવવામાં નિષ્ફળ. કૃપા કરી ફરી પ્રયત્ન કરો.", "Punjabi": "ਪੋਸਟ ਬਣਾਉਣ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "പോസ്റ്റ് സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ପୋଷ୍ଟ ସୃଷ୍ଟି କରିବାରେ ବିଫଳ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Failed to post": {
        "English": "Failed to post", "Hindi": "पोस्ट करने में विफल", "Kannada": "ಪೋಸ್ಟ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ", "Tamil": "இடுகையிட முடியவில்லை", "Telugu": "పోస్ట్ చేయడంలో విఫలమైంది", "Marathi": "पोस्ट करण्यात अयशस्वी", "Bengali": "পোস্ট করতে ব্যর্থ", "Gujarati": "પોસ્ટ કરવામાં નિષ્ફળ", "Punjabi": "ਪੋਸਟ ਕਰਨ ਵਿੱਚ ਅਸਫਲ", "Malayalam": "പോസ്റ്റ് ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ପୋଷ୍ଟ କରିବାରେ ବିଫଳ"
    },
    "Feedback Received": {
        "English": "Feedback Received", "Hindi": "प्रतिक्रिया प्राप्त हुई", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಸ್ವೀಕರಿಸಲಾಗಿದೆ", "Tamil": "கருத்து பெறப்பட்டது", "Telugu": "అభిప్రాయం స్వీకరించబడింది", "Marathi": "अभिप्राय प्राप्त झाला", "Bengali": "মতামত পাওয়া গেছে", "Gujarati": "પ્રતિસાદ મળ્યો", "Punjabi": "ਫੀਡਬੈਕ ਪ੍ਰਾਪਤ ਹੋਇਆ", "Malayalam": "ഫീഡ്ബാക്ക് ലഭിച്ചു", "Odia": "ମତାମତ ପ୍ରାପ୍ତ ହୋଇଛି"
    },
    "Fetching your creative workspace...": {
        "English": "Fetching your creative workspace...", "Hindi": "आपका रचनात्मक कार्यक्षेत्र लाया जा रहा है...", "Kannada": "ನಿಮ್ಮ ಸೃಜನಶೀಲ ಕಾರ್ಯಸ್ಥಳವನ್ನು ತರಲಾಗುತ್ತಿದೆ...", "Tamil": "உங்கள் படைப்பாற்றல் பணியிடம் கொண்டுவரப்படுகிறது...", "Telugu": "మీ సృజనాత్మక వర్క్‌స్పేస్‌ను తీసుకువస్తోంది...", "Marathi": "तुमचा सर्जनशील कार्यक्षेत्र आणत आहे...", "Bengali": "আপনার সৃজনশীল কর্মক্ষেত্র আনা হচ্ছে...", "Gujarati": "તમારું સર્જનાત્મક કાર્યક્ષેત્ર લાવી રહ્યા છીએ...", "Punjabi": "ਤੁਹਾਡਾ ਰਚਨਾਤਮਕ ਕਾਰਜਖੇਤਰ ਲਿਆਇਆ ਜਾ ਰਿਹਾ ਹੈ...", "Malayalam": "നിങ്ങളുടെ സർഗ്ഗാത്മക വർക്ക്‌സ്പേസ് കൊണ്ടുവരുന്നു...", "Odia": "ଆପଣଙ୍କ ସୃଜନଶୀଳ କାର୍ଯ୍ୟକ୍ଷେତ୍ର ଅଣାଯାଉଛି..."
    },
    "Field Trips": {
        "English": "Field Trips", "Hindi": "क्षेत्र भ्रमण", "Kannada": "ಕ್ಷೇತ್ರ ಪ್ರವಾಸಗಳು", "Tamil": "கள வருகைகள்", "Telugu": "క్షేత్ర పర్యటనలు", "Marathi": "क्षेत्रीय सहली", "Bengali": "ফিল্ড ট্রিপ", "Gujarati": "ક્ષેત્ર પ્રવાસ", "Punjabi": "ਖੇਤਰੀ ਯਾਤਰਾਵਾਂ", "Malayalam": "ഫീൽഡ് ട്രിപ്പുകൾ", "Odia": "କ୍ଷେତ୍ର ଭ୍ରମଣ"
    },
    "Find teachers to follow": {
        "English": "Find teachers to follow", "Hindi": "फॉलो करने के लिए शिक्षक खोजें", "Kannada": "ಅನುಸರಿಸಲು ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ", "Tamil": "பின்தொடர ஆசிரியர்களைக் கண்டறிக", "Telugu": "అనుసరించడానికి ఉపాధ్యాయులను కనుగొనండి", "Marathi": "फॉलो करण्यासाठी शिक्षक शोधा", "Bengali": "ফলো করার জন্য শিক্ষক খুঁজুন", "Gujarati": "ફોલો કરવા માટે શિક્ષકો શોધો", "Punjabi": "ਫਾਲੋ ਕਰਨ ਲਈ ਅਧਿਆਪਕ ਲੱਭੋ", "Malayalam": "ഫോളോ ചെയ്യാൻ അധ്യാപകരെ കണ്ടെത്തുക", "Odia": "ଅନୁସରଣ କରିବାକୁ ଶିକ୍ଷକ ଖୋଜନ୍ତୁ"
    },
    "Finding Bharat-first content for your classroom": {
        "English": "Finding Bharat-first content for your classroom", "Hindi": "आपकी कक्षा के लिए भारत-केंद्रित सामग्री खोज रहे हैं", "Kannada": "ನಿಮ್ಮ ತರಗತಿಗಾಗಿ ಭಾರತ-ಮೊದಲ ವಿಷಯವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ", "Tamil": "உங்கள் வகுப்பறைக்கான பாரத-முதல் உள்ளடக்கத்தைக் கண்டறிகிறது", "Telugu": "మీ తరగతి గది కోసం భారత్-మొదటి కంటెంట్‌ను కనుగొంటోంది", "Marathi": "तुमच्या वर्गासाठी भारत-केंद्रित सामग्री शोधत आहे", "Bengali": "আপনার শ্রেণীকক্ষের জন্য ভারত-কেন্দ্রিক কন্টেন্ট খোঁজা হচ্ছে", "Gujarati": "તમારા વર્ગખંડ માટે ભારત-પ્રથમ સામગ્રી શોધી રહ્યા છીએ", "Punjabi": "ਤੁਹਾਡੀ ਜਮਾਤ ਲਈ ਭਾਰਤ-ਪਹਿਲ ਸਮੱਗਰੀ ਲੱਭ ਰਹੇ ਹਾਂ", "Malayalam": "നിങ്ങളുടെ ക്ലാസ്സ്മുറിക്കായി ഭാരത്-ആദ്യ ഉള്ളടക്കം കണ്ടെത്തുന്നു", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀଗୃହ ପାଇଁ ଭାରତ-ପ୍ରଥମ ବିଷୟବସ୍ତୁ ଖୋଜୁଛି"
    },
    "Finish your profile to continue.": {
        "English": "Finish your profile to continue.", "Hindi": "जारी रखने के लिए अपनी प्रोफ़ाइल पूरी करें।", "Kannada": "ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ.", "Tamil": "தொடர உங்கள் சுயவிவரத்தை முடிக்கவும்.", "Telugu": "కొనసాగడానికి మీ ప్రొఫైల్‌ను పూర్తి చేయండి.", "Marathi": "सुरू ठेवण्यासाठी तुमची प्रोफाइल पूर्ण करा.", "Bengali": "চালিয়ে যেতে আপনার প্রোফাইল সম্পূর্ণ করুন।", "Gujarati": "ચાલુ રાખવા માટે તમારી પ્રોફાઇલ પૂર્ણ કરો.", "Punjabi": "ਜਾਰੀ ਰੱਖਣ ਲਈ ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ।", "Malayalam": "തുടരാൻ നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കുക.", "Odia": "ଜାରି ରଖିବାକୁ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ।"
    },
    "Follow-up Recommended": {
        "English": "Follow-up Recommended", "Hindi": "अनुवर्ती कार्रवाई की सिफारिश", "Kannada": "ಮುಂದಿನ ಕ್ರಮವನ್ನು ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ", "Tamil": "தொடர் நடவடிக்கை பரிந்துரைக்கப்படுகிறது", "Telugu": "తదుపరి చర్య సిఫార్సు చేయబడింది", "Marathi": "पाठपुरावा करण्याची शिफारस", "Bengali": "ফলো-আপ সুপারিশকৃত", "Gujarati": "ફોલો-અપ ભલામણ કરેલ", "Punjabi": "ਫਾਲੋ-ਅਪ ਦੀ ਸਿਫਾਰਸ਼", "Malayalam": "തുടർനടപടി ശുപാർശ ചെയ്യുന്നു", "Odia": "ଅନୁସରଣ ସୁପାରିଶ"
    },
    "Followers": {
        "English": "Followers", "Hindi": "फॉलोअर्स", "Kannada": "ಅನುಯಾಯಿಗಳು", "Tamil": "பின்தொடர்பவர்கள்", "Telugu": "అనుచరులు", "Marathi": "अनुयायी", "Bengali": "অনুসরণকারী", "Gujarati": "અનુયાયીઓ", "Punjabi": "ਫਾਲੋਅਰ", "Malayalam": "പിന്തുടരുന്നവർ", "Odia": "ଅନୁସରଣକାରୀ"
    },
    "Following": {
        "English": "Following", "Hindi": "फॉलो किए जा रहे", "Kannada": "ಅನುಸರಿಸುತ್ತಿರುವವರು", "Tamil": "பின்தொடர்கிறது", "Telugu": "అనుసరిస్తున్నారు", "Marathi": "अनुसरण करत आहे", "Bengali": "অনুসরণ করছেন", "Gujarati": "અનુસરી રહ્યા છો", "Punjabi": "ਫਾਲੋ ਕਰ ਰਹੇ", "Malayalam": "പിന്തുടരുന്നു", "Odia": "ଅନୁସରଣ କରୁଛନ୍ତି"
    },
    "Generate your first lesson plan to start your impact journey. Every resource you create reflects in your Activity, Engagement, Success Rate, and Growth scores.": {
        "English": "Generate your first lesson plan to start your impact journey. Every resource you create reflects in your Activity, Engagement, Success Rate, and Growth scores.", "Hindi": "अपनी प्रभाव यात्रा शुरू करने के लिए अपनी पहली पाठ योजना बनाएं। आप जो भी संसाधन बनाते हैं वह आपकी गतिविधि, सहभागिता, सफलता दर और विकास स्कोर में दिखाई देता है।", "Kannada": "ನಿಮ್ಮ ಪ್ರಭಾವ ಪ್ರಯಾಣವನ್ನು ಆರಂಭಿಸಲು ನಿಮ್ಮ ಮೊದಲ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ. ನೀವು ರಚಿಸುವ ಪ್ರತಿಯೊಂದು ಸಂಪನ್ಮೂಲವೂ ನಿಮ್ಮ ಚಟುವಟಿಕೆ, ತೊಡಗಿಸಿಕೊಳ್ಳುವಿಕೆ, ಯಶಸ್ಸಿನ ದರ ಮತ್ತು ಬೆಳವಣಿಗೆ ಸ್ಕೋರ್‌ಗಳಲ್ಲಿ ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ.", "Tamil": "உங்கள் தாக்கப் பயணத்தைத் தொடங்க உங்கள் முதல் பாடத் திட்டத்தை உருவாக்கவும். நீங்கள் உருவாக்கும் ஒவ்வொரு வளமும் உங்கள் செயல்பாடு, ஈடுபாடு, வெற்றி விகிதம் மற்றும் வளர்ச்சி மதிப்பெண்களில் பிரதிபலிக்கிறது.", "Telugu": "మీ ప్రభావ ప్రయాణాన్ని ప్రారంభించడానికి మీ మొదటి పాఠ ప్రణాళికను రూపొందించండి. మీరు సృష్టించే ప్రతి వనరు మీ కార్యకలాపం, నిమగ్నత, విజయ రేటు మరియు వృద్ధి స్కోర్‌లలో ప్రతిబింబిస్తుంది.", "Marathi": "तुमचा प्रभाव प्रवास सुरू करण्यासाठी तुमची पहिली पाठ योजना तयार करा. तुम्ही तयार केलेले प्रत्येक संसाधन तुमच्या क्रियाकलाप, सहभाग, यश दर आणि विकास गुणांमध्ये प्रतिबिंबित होते.", "Bengali": "আপনার প্রভাব যাত্রা শুরু করতে আপনার প্রথম পাঠ পরিকল্পনা তৈরি করুন। আপনি যে প্রতিটি সম্পদ তৈরি করেন তা আপনার কার্যকলাপ, সম্পৃক্ততা, সাফল্যের হার এবং বৃদ্ধির স্কোরে প্রতিফলিত হয়।", "Gujarati": "તમારી અસર યાત્રા શરૂ કરવા તમારી પ્રથમ પાઠ યોજના બનાવો. તમે બનાવેલ દરેક સંસાધન તમારી પ્રવૃત્તિ, જોડાણ, સફળતા દર અને વૃદ્ધિ સ્કોરમાં પ્રતિબિંબિત થાય છે.", "Punjabi": "ਆਪਣੀ ਪ੍ਰਭਾਵ ਯਾਤਰਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਪਹਿਲੀ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ। ਤੁਹਾਡੇ ਦੁਆਰਾ ਬਣਾਇਆ ਹਰ ਸਾਧਨ ਤੁਹਾਡੀ ਗਤੀਵਿਧੀ, ਸ਼ਮੂਲੀਅਤ, ਸਫਲਤਾ ਦਰ ਅਤੇ ਵਿਕਾਸ ਸਕੋਰ ਵਿੱਚ ਪ੍ਰਤੀਬਿੰਬਿਤ ਹੁੰਦਾ ਹੈ।", "Malayalam": "നിങ്ങളുടെ സ്വാധീന യാത്ര ആരംഭിക്കാൻ നിങ്ങളുടെ ആദ്യ പാഠ പദ്ധതി സൃഷ്ടിക്കുക. നിങ്ങൾ സൃഷ്ടിക്കുന്ന ഓരോ വിഭവവും നിങ്ങളുടെ പ്രവർത്തനം, ഇടപെടൽ, വിജയ നിരക്ക്, വളർച്ച സ്കോറുകളിൽ പ്രതിഫലിക്കുന്നു.", "Odia": "ଆପଣଙ୍କ ପ୍ରଭାବ ଯାତ୍ରା ଆରମ୍ଭ କରିବାକୁ ଆପଣଙ୍କ ପ୍ରଥମ ପାଠ ଯୋଜନା ସୃଷ୍ଟି କରନ୍ତୁ। ଆପଣ ସୃଷ୍ଟି କରୁଥିବା ପ୍ରତ୍ୟେକ ସମ୍ବଳ ଆପଣଙ୍କ କାର୍ଯ୍ୟକଳାପ, ସମ୍ପୃକ୍ତି, ସଫଳତା ହାର ଓ ଅଭିବୃଦ୍ଧି ସ୍କୋରରେ ପ୍ରତିଫଳିତ ହୁଏ।"
    },
    "Generating summary...": {
        "English": "Generating summary...", "Hindi": "सारांश तैयार किया जा रहा है...", "Kannada": "ಸಾರಾಂಶ ರಚಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "சுருக்கம் உருவாக்கப்படுகிறது...", "Telugu": "సారాంశం రూపొందించబడుతోంది...", "Marathi": "सारांश तयार होत आहे...", "Bengali": "সারাংশ তৈরি হচ্ছে...", "Gujarati": "સારાંશ બનાવી રહ્યા છીએ...", "Punjabi": "ਸੰਖੇਪ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ...", "Malayalam": "സംഗ്രഹം സൃഷ്ടിക്കുന്നു...", "Odia": "ସାରାଂଶ ସୃଷ୍ଟି ହେଉଛି..."
    },
    "Generation quality and low friction": {
        "English": "Generation quality and low friction", "Hindi": "जनरेशन गुणवत्ता और कम बाधा", "Kannada": "ರಚನೆಯ ಗುಣಮಟ್ಟ ಮತ್ತು ಕಡಿಮೆ ತೊಂದರೆ", "Tamil": "உருவாக்கத் தரம் மற்றும் குறைந்த தடை", "Telugu": "ఉత్పత్తి నాణ్యత మరియు తక్కువ ఇబ్బంది", "Marathi": "निर्मिती गुणवत्ता आणि कमी अडथळा", "Bengali": "জেনারেশন গুণমান এবং কম বাধা", "Gujarati": "જનરેશન ગુણવત્તા અને ઓછી અડચણ", "Punjabi": "ਜਨਰੇਸ਼ਨ ਗੁਣਵੱਤਾ ਅਤੇ ਘੱਟ ਰੁਕਾਵਟ", "Malayalam": "ജനറേഷൻ ഗുണനിലവാരവും കുറഞ്ഞ തടസ്സവും", "Odia": "ସୃଷ୍ଟି ଗୁଣବତ୍ତା ଓ କମ୍ ବାଧା"
    },
    "Getting Started": {
        "English": "Getting Started", "Hindi": "शुरुआत करें", "Kannada": "ಪ್ರಾರಂಭಿಸುವುದು", "Tamil": "தொடங்குதல்", "Telugu": "ప్రారంభం", "Marathi": "सुरुवात करा", "Bengali": "শুরু করুন", "Gujarati": "શરૂઆત કરો", "Punjabi": "ਸ਼ੁਰੂਆਤ ਕਰੋ", "Malayalam": "തുടങ്ങാം", "Odia": "ଆରମ୍ଭ କରନ୍ତୁ"
    },
    "Go Home": {
        "English": "Go Home", "Hindi": "होम पर जाएं", "Kannada": "ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ", "Tamil": "முகப்புக்குச் செல்", "Telugu": "హోమ్‌కి వెళ్లండి", "Marathi": "मुख्यपृष्ठावर जा", "Bengali": "হোমে যান", "Gujarati": "હોમ પર જાઓ", "Punjabi": "ਘਰ ਜਾਓ", "Malayalam": "ഹോമിലേക്ക് പോകുക", "Odia": "ହୋମକୁ ଯାଆନ୍ତୁ"
    },
    "Good": {
        "English": "Good", "Hindi": "अच्छा", "Kannada": "ಚೆನ್ನಾಗಿದೆ", "Tamil": "நல்லது", "Telugu": "మంచిది", "Marathi": "चांगले", "Bengali": "ভালো", "Gujarati": "સારું", "Punjabi": "ਚੰਗਾ", "Malayalam": "നല്ലത്", "Odia": "ଭଲ"
    },
    "Got it": {
        "English": "Got it", "Hindi": "समझ गया", "Kannada": "ಅರ್ಥವಾಯಿತು", "Tamil": "புரிந்தது", "Telugu": "అర్థమైంది", "Marathi": "समजले", "Bengali": "বুঝেছি", "Gujarati": "સમજાયું", "Punjabi": "ਸਮਝ ਗਿਆ", "Malayalam": "മനസ്സിലായി", "Odia": "ବୁଝିଲି"
    },
    "Great work this month!": {
        "English": "Great work this month!", "Hindi": "इस महीने शानदार काम!", "Kannada": "ಈ ತಿಂಗಳು ಅದ್ಭುತ ಕೆಲಸ!", "Tamil": "இந்த மாதம் சிறப்பான வேலை!", "Telugu": "ఈ నెల అద్భుతమైన పని!", "Marathi": "या महिन्यात उत्तम काम!", "Bengali": "এই মাসে দারুণ কাজ!", "Gujarati": "આ મહિને ઉત્તમ કામ!", "Punjabi": "ਇਸ ਮਹੀਨੇ ਸ਼ਾਨਦਾਰ ਕੰਮ!", "Malayalam": "ഈ മാസം മികച്ച ജോലി!", "Odia": "ଏହି ମାସରେ ଉତ୍କୃଷ୍ଟ କାର୍ଯ୍ୟ!"
    },
    "Grid view": {
        "English": "Grid view", "Hindi": "ग्रिड दृश्य", "Kannada": "ಗ್ರಿಡ್ ವೀಕ್ಷಣೆ", "Tamil": "கட்டக் காட்சி", "Telugu": "గ్రిడ్ వీక్షణ", "Marathi": "ग्रिड दृश्य", "Bengali": "গ্রিড দৃশ্য", "Gujarati": "ગ્રિડ વ્યૂ", "Punjabi": "ਗਰਿੱਡ ਦ੍ਰਿਸ਼", "Malayalam": "ഗ്രിഡ് കാഴ്ച", "Odia": "ଗ୍ରିଡ୍ ଦୃଶ୍ୟ"
    },
    "Growth": {
        "English": "Growth", "Hindi": "विकास", "Kannada": "ಬೆಳವಣಿಗೆ", "Tamil": "வளர்ச்சி", "Telugu": "వృద్ధి", "Marathi": "विकास", "Bengali": "বৃদ্ধি", "Gujarati": "વૃદ્ધિ", "Punjabi": "ਵਿਕਾਸ", "Malayalam": "വളർച്ച", "Odia": "ଅଭିବୃଦ୍ଧି"
    },
    "Guidance Shared with Parent": {
        "English": "Guidance Shared with Parent", "Hindi": "अभिभावक के साथ मार्गदर्शन साझा किया गया", "Kannada": "ಪೋಷಕರೊಂದಿಗೆ ಮಾರ್ಗದರ್ಶನ ಹಂಚಿಕೊಳ್ಳಲಾಗಿದೆ", "Tamil": "பெற்றோருடன் வழிகாட்டுதல் பகிரப்பட்டது", "Telugu": "తల్లిదండ్రులతో మార్గదర్శనం పంచుకోబడింది", "Marathi": "पालकांसोबत मार्गदर्शन शेअर केले", "Bengali": "অভিভাবকের সাথে নির্দেশনা শেয়ার করা হয়েছে", "Gujarati": "વાલી સાથે માર્ગદર્શન શેર કર્યું", "Punjabi": "ਮਾਪਿਆਂ ਨਾਲ ਮਾਰਗਦਰਸ਼ਨ ਸਾਂਝਾ ਕੀਤਾ", "Malayalam": "രക്ഷിതാവുമായി മാർഗ്ഗനിർദ്ദേശം പങ്കിട്ടു", "Odia": "ଅଭିଭାବକଙ୍କ ସହ ମାର୍ଗଦର୍ଶନ ବାଣ୍ଟାଗଲା"
    },
    "Help AI tailor responses to your experience level": {
        "English": "Help AI tailor responses to your experience level", "Hindi": "AI को आपके अनुभव स्तर के अनुसार उत्तर देने में मदद करें", "Kannada": "ನಿಮ್ಮ ಅನುಭವದ ಮಟ್ಟಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯೆಗಳನ್ನು ರೂಪಿಸಲು AI ಗೆ ಸಹಾಯ ಮಾಡಿ", "Tamil": "உங்கள் அனுபவ நிலைக்கு ஏற்ப பதில்களை வடிவமைக்க AI க்கு உதவுங்கள்", "Telugu": "మీ అనుభవ స్థాయికి ప్రతిస్పందనలను అనుకూలీకరించడంలో AIకి సహాయపడండి", "Marathi": "तुमच्या अनुभव पातळीनुसार उत्तरे तयार करण्यासाठी AI ला मदत करा", "Bengali": "আপনার অভিজ্ঞতার স্তরে উত্তর তৈরি করতে AI-কে সাহায্য করুন", "Gujarati": "તમારા અનુભવ સ્તર પ્રમાણે જવાબો ઘડવામાં AIને મદદ કરો", "Punjabi": "ਤੁਹਾਡੇ ਅਨੁਭਵ ਪੱਧਰ ਅਨੁਸਾਰ ਜਵਾਬ ਘੜਨ ਵਿੱਚ AI ਦੀ ਮਦਦ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ അനുഭവ നിലവാരത്തിന് അനുസരിച്ച് പ്രതികരണങ്ങൾ ക്രമീകരിക്കാൻ AI യെ സഹായിക്കുക", "Odia": "ଆପଣଙ୍କ ଅଭିଜ୍ଞତା ସ୍ତର ଅନୁଯାୟୀ ଉତ୍ତର ଗଠନ କରିବାରେ AIକୁ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    "Help improve SahayakAI with anonymized usage patterns": {
        "English": "Help improve SahayakAI with anonymized usage patterns", "Hindi": "अनाम उपयोग पैटर्न के साथ SahayakAI को बेहतर बनाने में मदद करें", "Kannada": "ಅನಾಮಧೇಯ ಬಳಕೆಯ ಮಾದರಿಗಳೊಂದಿಗೆ SahayakAI ಅನ್ನು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡಿ", "Tamil": "அநாமதேய பயன்பாட்டு முறைகளுடன் SahayakAI ஐ மேம்படுத்த உதவுங்கள்", "Telugu": "అనామక వినియోగ నమూనాలతో SahayakAI ని మెరుగుపరచడంలో సహాయపడండి", "Marathi": "निनावी वापर पद्धतींसह SahayakAI सुधारण्यात मदत करा", "Bengali": "বেনামী ব্যবহারের ধরন দিয়ে SahayakAI উন্নত করতে সাহায্য করুন", "Gujarati": "અનામી ઉપયોગ પેટર્ન સાથે SahayakAI ને સુધારવામાં મદદ કરો", "Punjabi": "ਗੁਮਨਾਮ ਵਰਤੋਂ ਪੈਟਰਨ ਨਾਲ SahayakAI ਨੂੰ ਬਿਹਤਰ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰੋ", "Malayalam": "അജ്ഞാത ഉപയോഗ പാറ്റേണുകൾ ഉപയോഗിച്ച് SahayakAI മെച്ചപ്പെടുത്താൻ സഹായിക്കുക", "Odia": "ଅଜ୍ଞାତ ବ୍ୟବହାର ପଦ୍ଧତି ସହ SahayakAIକୁ ଉନ୍ନତ କରିବାରେ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    "Higher limits, better AI, export, parent messaging": {
        "English": "Higher limits, better AI, export, parent messaging", "Hindi": "उच्च सीमाएं, बेहतर AI, निर्यात, अभिभावक संदेश", "Kannada": "ಹೆಚ್ಚಿನ ಮಿತಿಗಳು, ಉತ್ತಮ AI, ರಫ್ತು, ಪೋಷಕರ ಸಂದೇಶ", "Tamil": "அதிக வரம்புகள், சிறந்த AI, ஏற்றுமதி, பெற்றோர் செய்தி", "Telugu": "అధిక పరిమితులు, మెరుగైన AI, ఎగుమతి, తల్లిదండ్రుల సందేశం", "Marathi": "उच्च मर्यादा, चांगले AI, निर्यात, पालक संदेश", "Bengali": "উচ্চ সীমা, উন্নত AI, এক্সপোর্ট, অভিভাবক বার্তা", "Gujarati": "ઉચ્ચ મર્યાદાઓ, સારું AI, નિકાસ, વાલી સંદેશ", "Punjabi": "ਉੱਚ ਸੀਮਾਵਾਂ, ਬਿਹਤਰ AI, ਨਿਰਯਾਤ, ਮਾਪੇ ਸੁਨੇਹਾ", "Malayalam": "ഉയർന്ന പരിധികൾ, മികച്ച AI, കയറ്റുമതി, രക്ഷിതാവിന് സന്ദേശം", "Odia": "ଉଚ୍ଚ ସୀମା, ଉନ୍ନତ AI, ରପ୍ତାନି, ଅଭିଭାବକ ସନ୍ଦେଶ"
    },
    "How often you use the app and session quality": {
        "English": "How often you use the app and session quality", "Hindi": "आप ऐप का कितनी बार उपयोग करते हैं और सत्र की गुणवत्ता", "Kannada": "ನೀವು ಆಪ್ ಅನ್ನು ಎಷ್ಟು ಬಾರಿ ಬಳಸುತ್ತೀರಿ ಮತ್ತು ಸೆಷನ್ ಗುಣಮಟ್ಟ", "Tamil": "நீங்கள் எவ்வளவு அடிக்கடி பயன்பாட்டைப் பயன்படுத்துகிறீர்கள் மற்றும் அமர்வு தரம்", "Telugu": "మీరు యాప్‌ను ఎంత తరచుగా ఉపయోగిస్తారు మరియు సెషన్ నాణ్యత", "Marathi": "तुम्ही अॅप किती वेळा वापरता आणि सत्र गुणवत्ता", "Bengali": "আপনি কতবার অ্যাপ ব্যবহার করেন এবং সেশনের গুণমান", "Gujarati": "તમે કેટલી વાર એપ વાપરો છો અને સત્ર ગુણવત્તા", "Punjabi": "ਤੁਸੀਂ ਐਪ ਕਿੰਨੀ ਵਾਰ ਵਰਤਦੇ ਹੋ ਅਤੇ ਸੈਸ਼ਨ ਗੁਣਵੱਤਾ", "Malayalam": "നിങ്ങൾ ആപ്പ് എത്ര തവണ ഉപയോഗിക്കുന്നു, സെഷൻ ഗുണനിലവാരം", "Odia": "ଆପଣ କେତେ ଥର ଆପ୍ ବ୍ୟବହାର କରନ୍ତି ଓ ସେସନ୍ ଗୁଣବତ୍ତା"
    },
    "Impact Dashboard": {
        "English": "Impact Dashboard", "Hindi": "प्रभाव डैशबोर्ड", "Kannada": "ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "Tamil": "தாக்க டாஷ்போர்டு", "Telugu": "ప్రభావ డాష్‌బోర్డ్", "Marathi": "प्रभाव डॅशबोर्ड", "Bengali": "প্রভাব ড্যাশবোর্ড", "Gujarati": "અસર ડેશબોર્ડ", "Punjabi": "ਪ੍ਰਭਾਵ ਡੈਸ਼ਬੋਰਡ", "Malayalam": "ഇംപാക്ട് ഡാഷ്‌ബോർഡ്", "Odia": "ପ୍ରଭାବ ଡାସବୋର୍ଡ"
    },
    "JPG, PNG, or WebP. Max 4MB.": {
        "English": "JPG, PNG, or WebP. Max 4MB.", "Hindi": "JPG, PNG, या WebP। अधिकतम 4MB।", "Kannada": "JPG, PNG, ಅಥವಾ WebP. ಗರಿಷ್ಠ 4MB.", "Tamil": "JPG, PNG, அல்லது WebP. அதிகபட்சம் 4MB.", "Telugu": "JPG, PNG, లేదా WebP. గరిష్టం 4MB.", "Marathi": "JPG, PNG, किंवा WebP. कमाल 4MB.", "Bengali": "JPG, PNG, বা WebP। সর্বোচ্চ 4MB।", "Gujarati": "JPG, PNG, અથવા WebP. મહત્તમ 4MB.", "Punjabi": "JPG, PNG, ਜਾਂ WebP। ਵੱਧ ਤੋਂ ਵੱਧ 4MB।", "Malayalam": "JPG, PNG, അല്ലെങ്കിൽ WebP. പരമാവധി 4MB.", "Odia": "JPG, PNG, କିମ୍ବା WebP। ସର୍ବାଧିକ 4MB।"
    },
    "Join": {
        "English": "Join", "Hindi": "जुड़ें", "Kannada": "ಸೇರಿ", "Tamil": "சேர்", "Telugu": "చేరండి", "Marathi": "सामील व्हा", "Bengali": "যোগ দিন", "Gujarati": "જોડાઓ", "Punjabi": "ਸ਼ਾਮਲ ਹੋਵੋ", "Malayalam": "ചേരുക", "Odia": "ଯୋଗ ଦିଅନ୍ତୁ"
    },
    "Join this group to share, post, and chat with members": {
        "English": "Join this group to share, post, and chat with members", "Hindi": "सदस्यों के साथ साझा करने, पोस्ट करने और चैट करने के लिए इस समूह में शामिल हों", "Kannada": "ಸದಸ್ಯರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಲು, ಪೋಸ್ಟ್ ಮಾಡಲು ಮತ್ತು ಚಾಟ್ ಮಾಡಲು ಈ ಗುಂಪಿಗೆ ಸೇರಿ", "Tamil": "உறுப்பினர்களுடன் பகிர, இடுகையிட மற்றும் அரட்டையடிக்க இந்தக் குழுவில் சேருங்கள்", "Telugu": "సభ్యులతో పంచుకోవడానికి, పోస్ట్ చేయడానికి మరియు చాట్ చేయడానికి ఈ గ్రూపులో చేరండి", "Marathi": "सदस्यांसोबत शेअर, पोस्ट आणि चॅट करण्यासाठी या गटात सामील व्हा", "Bengali": "সদস্যদের সাথে শেয়ার, পোস্ট ও চ্যাট করতে এই গ্রুপে যোগ দিন", "Gujarati": "સભ્યો સાથે શેર, પોસ્ટ અને ચેટ કરવા આ જૂથમાં જોડાઓ", "Punjabi": "ਮੈਂਬਰਾਂ ਨਾਲ ਸਾਂਝਾ, ਪੋਸਟ ਅਤੇ ਚੈਟ ਕਰਨ ਲਈ ਇਸ ਗਰੁੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ", "Malayalam": "അംഗങ്ങളുമായി പങ്കിടാനും പോസ്റ്റ് ചെയ്യാനും ചാറ്റ് ചെയ്യാനും ഈ ഗ്രൂപ്പിൽ ചേരുക", "Odia": "ସଦସ୍ୟମାନଙ୍କ ସହ ବାଣ୍ଟିବା, ପୋଷ୍ଟ କରିବା ଓ ଚାଟ୍ କରିବାକୁ ଏହି ଗୋଷ୍ଠୀରେ ଯୋଗ ଦିଅନ୍ତୁ"
    },
    "Joined": {
        "English": "Joined", "Hindi": "जुड़ गए", "Kannada": "ಸೇರಿದ್ದೀರಿ", "Tamil": "சேர்ந்தது", "Telugu": "చేరారు", "Marathi": "सामील झाले", "Bengali": "যোগ দিয়েছেন", "Gujarati": "જોડાયા", "Punjabi": "ਸ਼ਾਮਲ ਹੋਏ", "Malayalam": "ചേർന്നു", "Odia": "ଯୋଗ ଦେଇଛନ୍ତି"
    },
    "Joined group": {
        "English": "Joined group", "Hindi": "समूह में शामिल हुए", "Kannada": "ಗುಂಪಿಗೆ ಸೇರಿದ್ದೀರಿ", "Tamil": "குழுவில் சேர்ந்தது", "Telugu": "గ్రూపులో చేరారు", "Marathi": "गटात सामील झाले", "Bengali": "গ্রুপে যোগ দিয়েছেন", "Gujarati": "જૂથમાં જોડાયા", "Punjabi": "ਗਰੁੱਪ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਏ", "Malayalam": "ഗ്രൂപ്പിൽ ചേർന്നു", "Odia": "ଗୋଷ୍ଠୀରେ ଯୋଗ ଦେଇଛନ୍ତି"
    },
    "Joining": {
        "English": "Joining", "Hindi": "जुड़ रहे हैं", "Kannada": "ಸೇರುತ್ತಿದ್ದೀರಿ", "Tamil": "சேர்கிறது", "Telugu": "చేరుతున్నారు", "Marathi": "सामील होत आहे", "Bengali": "যোগ দিচ্ছেন", "Gujarati": "જોડાઈ રહ્યા છો", "Punjabi": "ਸ਼ਾਮਲ ਹੋ ਰਹੇ", "Malayalam": "ചേരുന്നു", "Odia": "ଯୋଗ ଦେଉଛନ୍ତି"
    },
    "Just your email to continue": {
        "English": "Just your email to continue", "Hindi": "जारी रखने के लिए केवल आपका ईमेल", "Kannada": "ಮುಂದುವರಿಯಲು ಕೇವಲ ನಿಮ್ಮ ಇಮೇಲ್", "Tamil": "தொடர உங்கள் மின்னஞ்சல் மட்டும்", "Telugu": "కొనసాగడానికి కేవలం మీ ఇమెయిల్", "Marathi": "सुरू ठेवण्यासाठी फक्त तुमचा ईमेल", "Bengali": "চালিয়ে যেতে শুধু আপনার ইমেল", "Gujarati": "ચાલુ રાખવા માટે ફક્ત તમારો ઈમેલ", "Punjabi": "ਜਾਰੀ ਰੱਖਣ ਲਈ ਸਿਰਫ਼ ਤੁਹਾਡਾ ਈਮੇਲ", "Malayalam": "തുടരാൻ നിങ്ങളുടെ ഇമെയിൽ മാത്രം", "Odia": "ଜାରି ରଖିବାକୁ କେବଳ ଆପଣଙ୍କ ଇମେଲ୍"
    },
    "Keywords:": {
        "English": "Keywords:", "Hindi": "मुख्य शब्द:", "Kannada": "ಕೀವರ್ಡ್‌ಗಳು:", "Tamil": "முக்கிய சொற்கள்:", "Telugu": "కీవర్డ్‌లు:", "Marathi": "मुख्य शब्द:", "Bengali": "কীওয়ার্ড:", "Gujarati": "કીવર્ડ્સ:", "Punjabi": "ਕੀਵਰਡ:", "Malayalam": "കീവേഡുകൾ:", "Odia": "କୀୱାର୍ଡ:"
    },
    "Language:": {
        "English": "Language:", "Hindi": "भाषा:", "Kannada": "ಭಾಷೆ:", "Tamil": "மொழி:", "Telugu": "భాష:", "Marathi": "भाषा:", "Bengali": "ভাষা:", "Gujarati": "ભાષા:", "Punjabi": "ਭਾਸ਼ਾ:", "Malayalam": "ഭാഷ:", "Odia": "ଭାଷା:"
    },
    "Last Active": {
        "English": "Last Active", "Hindi": "अंतिम सक्रिय", "Kannada": "ಕೊನೆಯ ಸಕ್ರಿಯ", "Tamil": "கடைசியாக செயலில்", "Telugu": "చివరిసారి యాక్టివ్", "Marathi": "शेवटचे सक्रिय", "Bengali": "সর্বশেষ সক্রিয়", "Gujarati": "છેલ્લે સક્રિય", "Punjabi": "ਆਖਰੀ ਸਰਗਰਮ", "Malayalam": "അവസാനം സജീവം", "Odia": "ଶେଷ ସକ୍ରିୟ"
    },
    "Learning Outcomes:": {
        "English": "Learning Outcomes:", "Hindi": "अधिगम परिणाम:", "Kannada": "ಕಲಿಕೆಯ ಫಲಿತಾಂಶಗಳು:", "Tamil": "கற்றல் விளைவுகள்:", "Telugu": "అభ్యాస ఫలితాలు:", "Marathi": "अध्ययन निष्पत्ती:", "Bengali": "শিক্ষার ফলাফল:", "Gujarati": "શિક્ષણ પરિણામો:", "Punjabi": "ਸਿੱਖਣ ਨਤੀਜੇ:", "Malayalam": "പഠന ഫലങ്ങൾ:", "Odia": "ଶିକ୍ଷଣ ଫଳାଫଳ:"
    },
    "Lesson Plans": {
        "English": "Lesson Plans", "Hindi": "पाठ योजनाएं", "Kannada": "ಪಾಠ ಯೋಜನೆಗಳು", "Tamil": "பாடத் திட்டங்கள்", "Telugu": "పాఠ ప్రణాళికలు", "Marathi": "पाठ योजना", "Bengali": "পাঠ পরিকল্পনা", "Gujarati": "પાઠ યોજનાઓ", "Punjabi": "ਪਾਠ ਯੋਜਨਾਵਾਂ", "Malayalam": "പാഠ പദ്ധതികൾ", "Odia": "ପାଠ ଯୋଜନା"
    },
    "Limit reached": {
        "English": "Limit reached", "Hindi": "सीमा पूरी हुई", "Kannada": "ಮಿತಿ ತಲುಪಿದೆ", "Tamil": "வரம்பு அடைந்தது", "Telugu": "పరిమితి చేరుకుంది", "Marathi": "मर्यादा गाठली", "Bengali": "সীমা শেষ", "Gujarati": "મર્યાદા પૂરી", "Punjabi": "ਸੀਮਾ ਪੂਰੀ ਹੋਈ", "Malayalam": "പരിധി എത്തി", "Odia": "ସୀମା ପହଞ୍ଚିଲା"
    },
    "List view": {
        "English": "List view", "Hindi": "सूची दृश्य", "Kannada": "ಪಟ್ಟಿ ನೋಟ", "Tamil": "பட்டியல் காட்சி", "Telugu": "జాబితా వీక్షణ", "Marathi": "यादी दृश्य", "Bengali": "তালিকা ভিউ", "Gujarati": "યાદી દૃશ્ય", "Punjabi": "ਸੂਚੀ ਦ੍ਰਿਸ਼", "Malayalam": "ലിസ്റ്റ് കാഴ്ച", "Odia": "ତାଲିକା ଦୃଶ୍ୟ"
    },
    "Load Recommendations": {
        "English": "Load Recommendations", "Hindi": "सुझाव लोड करें", "Kannada": "ಶಿಫಾರಸುಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ", "Tamil": "பரிந்துரைகளை ஏற்று", "Telugu": "సిఫార్సులను లోడ్ చేయండి", "Marathi": "शिफारशी लोड करा", "Bengali": "সুপারিশ লোড করুন", "Gujarati": "ભલામણો લોડ કરો", "Punjabi": "ਸਿਫ਼ਾਰਸ਼ਾਂ ਲੋਡ ਕਰੋ", "Malayalam": "ശുപാർശകൾ ലോഡ് ചെയ്യുക", "Odia": "ସୁପାରିଶଗୁଡ଼ିକ ଲୋଡ୍ କରନ୍ତୁ"
    },
    "Loading pricing…": {
        "English": "Loading pricing…", "Hindi": "मूल्य निर्धारण लोड हो रहा है…", "Kannada": "ಬೆಲೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ…", "Tamil": "விலை ஏற்றப்படுகிறது…", "Telugu": "ధర లోడ్ అవుతోంది…", "Marathi": "किंमत लोड होत आहे…", "Bengali": "মূল্য লোড হচ্ছে…", "Gujarati": "કિંમત લોડ થઈ રહી છે…", "Punjabi": "ਕੀਮਤ ਲੋਡ ਹੋ ਰਹੀ ਹੈ…", "Malayalam": "വില ലോഡ് ചെയ്യുന്നു…", "Odia": "ମୂଲ୍ୟ ଲୋଡ୍ ହେଉଛି…"
    },
    "Loading recent marks…": {
        "English": "Loading recent marks…", "Hindi": "हाल के अंक लोड हो रहे हैं…", "Kannada": "ಇತ್ತೀಚಿನ ಅಂಕಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…", "Tamil": "சமீபத்திய மதிப்பெண்கள் ஏற்றப்படுகின்றன…", "Telugu": "ఇటీవలి మార్కులు లోడ్ అవుతున్నాయి…", "Marathi": "अलीकडील गुण लोड होत आहेत…", "Bengali": "সাম্প্রতিক নম্বর লোড হচ্ছে…", "Gujarati": "તાજેતરના ગુણ લોડ થઈ રહ્યા છે…", "Punjabi": "ਹਾਲੀਆ ਅੰਕ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…", "Malayalam": "സമീപകാല മാർക്കുകൾ ലോഡ് ചെയ്യുന്നു…", "Odia": "ସମ୍ପ୍ରତି ନମ୍ବର ଲୋଡ୍ ହେଉଛି…"
    },
    "Loading recent wins…": {
        "English": "Loading recent wins…", "Hindi": "हाल की उपलब्धियाँ लोड हो रही हैं…", "Kannada": "ಇತ್ತೀಚಿನ ಸಾಧನೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…", "Tamil": "சமீபத்திய வெற்றிகள் ஏற்றப்படுகின்றன…", "Telugu": "ఇటీవలి విజయాలు లోడ్ అవుతున్నాయి…", "Marathi": "अलीकडील यश लोड होत आहेत…", "Bengali": "সাম্প্রতিক সাফল্য লোড হচ্ছে…", "Gujarati": "તાજેતરની સફળતાઓ લોડ થઈ રહી છે…", "Punjabi": "ਹਾਲੀਆ ਪ੍ਰਾਪਤੀਆਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ…", "Malayalam": "സമീപകാല നേട്ടങ്ങൾ ലോഡ് ചെയ്യുന്നു…", "Odia": "ସମ୍ପ୍ରତି ସଫଳତା ଲୋଡ୍ ହେଉଛି…"
    },
    "Logging you in...": {
        "English": "Logging you in...", "Hindi": "आपको लॉग इन किया जा रहा है...", "Kannada": "ನಿಮ್ಮನ್ನು ಲಾಗಿನ್ ಮಾಡಲಾಗುತ್ತಿದೆ...", "Tamil": "உள்நுழைகிறீர்கள்...", "Telugu": "మిమ్మల్ని లాగిన్ చేస్తోంది...", "Marathi": "तुम्हाला लॉग इन करत आहे...", "Bengali": "আপনাকে লগ ইন করা হচ্ছে...", "Gujarati": "તમને લોગ ઇન કરી રહ્યા છીએ...", "Punjabi": "ਤੁਹਾਨੂੰ ਲੌਗ ਇਨ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...", "Malayalam": "നിങ്ങളെ ലോഗിൻ ചെയ്യുന്നു...", "Odia": "ଆପଣଙ୍କୁ ଲଗଇନ କରାଯାଉଛି..."
    },
    "Make your profile visible to other teachers": {
        "English": "Make your profile visible to other teachers", "Hindi": "अपनी प्रोफ़ाइल अन्य शिक्षकों को दिखाएँ", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಅನ್ನು ಇತರ ಶಿಕ್ಷಕರಿಗೆ ಗೋಚರಿಸುವಂತೆ ಮಾಡಿ", "Tamil": "உங்கள் சுயவிவரத்தை மற்ற ஆசிரியர்களுக்கு காண்பிக்கவும்", "Telugu": "మీ ప్రొఫైల్‌ను ఇతర ఉపాధ్యాయులకు కనిపించేలా చేయండి", "Marathi": "तुमचे प्रोफाइल इतर शिक्षकांना दिसू द्या", "Bengali": "অন্য শিক্ষকদের কাছে আপনার প্রোফাইল দৃশ্যমান করুন", "Gujarati": "તમારી પ્રોફાઇલ અન્ય શિક્ષકોને દૃશ્યમાન કરો", "Punjabi": "ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਹੋਰ ਅਧਿਆਪਕਾਂ ਨੂੰ ਦਿਖਾਓ", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ മറ്റ് അധ്യാപകർക്ക് ദൃശ്യമാക്കുക", "Odia": "ଅନ୍ୟ ଶିକ୍ଷକଙ୍କୁ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଦୃଶ୍ୟମାନ କରନ୍ତୁ"
    },
    "Manage Plan": {
        "English": "Manage Plan", "Hindi": "योजना प्रबंधित करें", "Kannada": "ಯೋಜನೆ ನಿರ್ವಹಿಸಿ", "Tamil": "திட்டத்தை நிர்வகி", "Telugu": "ప్లాన్ నిర్వహించండి", "Marathi": "योजना व्यवस्थापित करा", "Bengali": "প্ল্যান পরিচালনা করুন", "Gujarati": "પ્લાન મેનેજ કરો", "Punjabi": "ਯੋਜਨਾ ਪ੍ਰਬੰਧਿਤ ਕਰੋ", "Malayalam": "പ്ലാൻ കൈകാര്യം ചെയ്യുക", "Odia": "ଯୋଜନା ପରିଚାଳନା କରନ୍ତୁ"
    },
    "Manage your preferences, plan, and data": {
        "English": "Manage your preferences, plan, and data", "Hindi": "अपनी प्राथमिकताएँ, योजना और डेटा प्रबंधित करें", "Kannada": "ನಿಮ್ಮ ಆದ್ಯತೆಗಳು, ಯೋಜನೆ ಮತ್ತು ಡೇಟಾ ನಿರ್ವಹಿಸಿ", "Tamil": "உங்கள் விருப்பங்கள், திட்டம் மற்றும் தரவை நிர்வகிக்கவும்", "Telugu": "మీ ప్రాధాన్యతలు, ప్లాన్ మరియు డేటాను నిర్వహించండి", "Marathi": "तुमच्या प्राधान्यांना, योजनेला आणि डेटाला व्यवस्थापित करा", "Bengali": "আপনার পছন্দ, প্ল্যান এবং ডেটা পরিচালনা করুন", "Gujarati": "તમારી પસંદગીઓ, પ્લાન અને ડેટા મેનેજ કરો", "Punjabi": "ਆਪਣੀਆਂ ਤਰਜੀਹਾਂ, ਯੋਜਨਾ ਅਤੇ ਡੇਟਾ ਪ੍ਰਬੰਧਿਤ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ മുൻഗണനകൾ, പ്ലാൻ, ഡാറ്റ എന്നിവ കൈകാര്യം ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ପସନ୍ଦ, ଯୋଜନା ଓ ଡାଟା ପରିଚାଳନା କରନ୍ତୁ"
    },
    "Manage your subscription": {
        "English": "Manage your subscription", "Hindi": "अपनी सदस्यता प्रबंधित करें", "Kannada": "ನಿಮ್ಮ ಚಂದಾದಾರಿಕೆ ನಿರ್ವಹಿಸಿ", "Tamil": "உங்கள் சந்தாவை நிர்வகிக்கவும்", "Telugu": "మీ సబ్‌స్క్రిప్షన్‌ను నిర్వహించండి", "Marathi": "तुमचे सदस्यत्व व्यवस्थापित करा", "Bengali": "আপনার সাবস্ক্রিপশন পরিচালনা করুন", "Gujarati": "તમારું સબ્સ્ક્રિપ્શન મેનેજ કરો", "Punjabi": "ਆਪਣੀ ਮੈਂਬਰਸ਼ਿਪ ਪ੍ਰਬੰਧਿਤ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ സബ്സ്ക്രിപ്ഷൻ കൈകാര്യം ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ସବସ୍କ୍ରିପସନ ପରିଚାଳନା କରନ୍ତୁ"
    },
    "Memory is clear. I have no context of prior conversations.": {
        "English": "Memory is clear. I have no context of prior conversations.", "Hindi": "मेमोरी साफ़ है। मेरे पास पिछली बातचीत का कोई संदर्भ नहीं है।", "Kannada": "ಸ್ಮರಣೆ ಸ್ಪಷ್ಟವಾಗಿದೆ. ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳ ಸಂದರ್ಭ ನನ್ನ ಬಳಿ ಇಲ್ಲ.", "Tamil": "நினைவகம் காலி. முந்தைய உரையாடல்களின் சூழல் என்னிடம் இல்லை.", "Telugu": "మెమొరీ క్లియర్ చేయబడింది. మునుపటి సంభాషణల సందర్భం నాకు లేదు.", "Marathi": "स्मृती रिकामी आहे. मागील संभाषणांचा संदर्भ माझ्याकडे नाही.", "Bengali": "মেমরি পরিষ্কার। আগের কথোপকথনের কোনো প্রসঙ্গ আমার কাছে নেই।", "Gujarati": "મેમરી સ્પષ્ટ છે. અગાઉની વાતચીતનો કોઈ સંદર્ભ મારી પાસે નથી.", "Punjabi": "ਮੈਮੋਰੀ ਸਾਫ਼ ਹੈ। ਪਿਛਲੀਆਂ ਗੱਲਾਂਬਾਤਾਂ ਦਾ ਕੋਈ ਪ੍ਰਸੰਗ ਮੇਰੇ ਕੋਲ ਨਹੀਂ ਹੈ।", "Malayalam": "മെമ്മറി ക്ലിയറാണ്. മുൻ സംഭാഷണങ്ങളുടെ സന്ദർഭം എനിക്കില്ല.", "Odia": "ସ୍ମୃତି ସଫା। ପୂର୍ବ ବାର୍ତ୍ତାଳାପର କୌଣସି ପ୍ରସଙ୍ଗ ମୋ ପାଖରେ ନାହିଁ।"
    },
    "Message copied!": {
        "English": "Message copied!", "Hindi": "संदेश कॉपी हो गया!", "Kannada": "ಸಂದೇಶ ನಕಲಿಸಲಾಗಿದೆ!", "Tamil": "செய்தி நகலெடுக்கப்பட்டது!", "Telugu": "సందేశం కాపీ చేయబడింది!", "Marathi": "संदेश कॉपी झाला!", "Bengali": "বার্তা কপি হয়েছে!", "Gujarati": "સંદેશ કોપી થયો!", "Punjabi": "ਸੁਨੇਹਾ ਕਾਪੀ ਹੋ ਗਿਆ!", "Malayalam": "സന്ദേശം പകർത്തി!", "Odia": "ବାର୍ତ୍ତା କପି ହୋଇଛି!"
    },
    "My Groups": {
        "English": "My Groups", "Hindi": "मेरे समूह", "Kannada": "ನನ್ನ ಗುಂಪುಗಳು", "Tamil": "எனது குழுக்கள்", "Telugu": "నా గ్రూపులు", "Marathi": "माझे गट", "Bengali": "আমার গ্রুপ", "Gujarati": "મારા જૂથો", "Punjabi": "ਮੇਰੇ ਸਮੂਹ", "Malayalam": "എന്റെ ഗ്രൂപ്പുകൾ", "Odia": "ମୋର ଗୋଷ୍ଠୀ"
    },
    "NCERT Subject": {
        "English": "NCERT Subject", "Hindi": "NCERT विषय", "Kannada": "NCERT ವಿಷಯ", "Tamil": "NCERT பாடம்", "Telugu": "NCERT సబ్జెక్ట్", "Marathi": "NCERT विषय", "Bengali": "NCERT বিষয়", "Gujarati": "NCERT વિષય", "Punjabi": "NCERT ਵਿਸ਼ਾ", "Malayalam": "NCERT വിഷയം", "Odia": "NCERT ବିଷୟ"
    },
    "Need more?": {
        "English": "Need more?", "Hindi": "और चाहिए?", "Kannada": "ಇನ್ನಷ್ಟು ಬೇಕೇ?", "Tamil": "மேலும் வேண்டுமா?", "Telugu": "మరిన్ని కావాలా?", "Marathi": "अधिक हवे?", "Bengali": "আরো প্রয়োজন?", "Gujarati": "વધુ જોઈએ?", "Punjabi": "ਹੋਰ ਚਾਹੀਦਾ?", "Malayalam": "കൂടുതൽ വേണോ?", "Odia": "ଅଧିକ ଆବଶ୍ୟକ?"
    },
    "Needs Attention": {
        "English": "Needs Attention", "Hindi": "ध्यान देने की आवश्यकता", "Kannada": "ಗಮನ ಬೇಕು", "Tamil": "கவனம் தேவை", "Telugu": "శ్రద్ధ అవసరం", "Marathi": "लक्ष आवश्यक", "Bengali": "মনোযোগ প্রয়োজন", "Gujarati": "ધ્યાન જરૂરી", "Punjabi": "ਧਿਆਨ ਲੋੜੀਂਦਾ", "Malayalam": "ശ്രദ്ധ ആവശ്യം", "Odia": "ଧ୍ୟାନ ଆବଶ୍ୟକ"
    },
    "New Message": {
        "English": "New Message", "Hindi": "नया संदेश", "Kannada": "ಹೊಸ ಸಂದೇಶ", "Tamil": "புதிய செய்தி", "Telugu": "కొత్త సందేశం", "Marathi": "नवीन संदेश", "Bengali": "নতুন বার্তা", "Gujarati": "નવો સંદેશ", "Punjabi": "ਨਵਾਂ ਸੁਨੇਹਾ", "Malayalam": "പുതിയ സന്ദേശം", "Odia": "ନୂଆ ବାର୍ତ୍ତା"
    },
    "Next: Add Note": {
        "English": "Next: Add Note", "Hindi": "अगला: नोट जोड़ें", "Kannada": "ಮುಂದೆ: ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ", "Tamil": "அடுத்து: குறிப்பு சேர்", "Telugu": "తర్వాత: గమనిక జోడించండి", "Marathi": "पुढे: नोट जोडा", "Bengali": "পরবর্তী: নোট যোগ করুন", "Gujarati": "આગળ: નોંધ ઉમેરો", "Punjabi": "ਅੱਗੇ: ਨੋਟ ਜੋੜੋ", "Malayalam": "അടുത്തത്: കുറിപ്പ് ചേർക്കുക", "Odia": "ପରବର୍ତ୍ତୀ: ନୋଟ୍ ଯୋଡନ୍ତୁ"
    },
    "No assessment data yet. Add specific scores in the note below.": {
        "English": "No assessment data yet. Add specific scores in the note below.", "Hindi": "अभी तक कोई आकलन डेटा नहीं है। नीचे नोट में विशिष्ट अंक जोड़ें।", "Kannada": "ಇನ್ನೂ ಮೌಲ್ಯಮಾಪನ ಡೇಟಾ ಇಲ್ಲ. ಕೆಳಗಿನ ಟಿಪ್ಪಣಿಯಲ್ಲಿ ನಿರ್ದಿಷ್ಟ ಅಂಕಗಳನ್ನು ಸೇರಿಸಿ.", "Tamil": "மதிப்பீட்டு தரவு இன்னும் இல்லை. கீழே உள்ள குறிப்பில் குறிப்பிட்ட மதிப்பெண்களைச் சேர்க்கவும்.", "Telugu": "ఇంకా అంచనా డేటా లేదు. క్రింది గమనికలో నిర్దిష్ట స్కోర్‌లను జోడించండి.", "Marathi": "अद्याप मूल्यांकन डेटा नाही. खालील नोटमध्ये विशिष्ट गुण जोडा.", "Bengali": "এখনও কোনো মূল্যায়ন ডেটা নেই। নীচের নোটে নির্দিষ্ট নম্বর যোগ করুন।", "Gujarati": "હજુ સુધી મૂલ્યાંકન ડેટા નથી. નીચેની નોંધમાં ચોક્કસ ગુણ ઉમેરો.", "Punjabi": "ਅਜੇ ਕੋਈ ਮੁਲਾਂਕਣ ਡੇਟਾ ਨਹੀਂ। ਹੇਠਾਂ ਨੋਟ ਵਿੱਚ ਖਾਸ ਅੰਕ ਜੋੜੋ।", "Malayalam": "ഇതുവരെ വിലയിരുത്തൽ ഡാറ്റയില്ല. താഴെയുള്ള കുറിപ്പിൽ നിർദ്ദിഷ്ട സ്കോറുകൾ ചേർക്കുക.", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ ମୂଲ୍ୟାୟନ ଡାଟା ନାହିଁ। ତଳ ନୋଟରେ ନିର୍ଦ୍ଦିଷ୍ଟ ସ୍କୋର ଯୋଡନ୍ତୁ।"
    },
    "No attendance data for this month.": {
        "English": "No attendance data for this month.", "Hindi": "इस माह का कोई उपस्थिति डेटा नहीं है।", "Kannada": "ಈ ತಿಂಗಳಿನ ಹಾಜರಾತಿ ಡೇಟಾ ಇಲ್ಲ.", "Tamil": "இந்த மாதத்திற்கான வருகை தரவு இல்லை.", "Telugu": "ఈ నెల హాజరు డేటా లేదు.", "Marathi": "या महिन्यासाठी उपस्थिती डेटा नाही.", "Bengali": "এই মাসের জন্য কোনো উপস্থিতি ডেটা নেই।", "Gujarati": "આ મહિના માટે હાજરી ડેટા નથી.", "Punjabi": "ਇਸ ਮਹੀਨੇ ਲਈ ਹਾਜ਼ਰੀ ਡੇਟਾ ਨਹੀਂ।", "Malayalam": "ഈ മാസത്തെ ഹാജർ ഡാറ്റയില്ല.", "Odia": "ଏହି ମାସର ଉପସ୍ଥିତି ଡାଟା ନାହିଁ।"
    },
    "No other teachers registered yet.": {
        "English": "No other teachers registered yet.", "Hindi": "अभी तक कोई अन्य शिक्षक पंजीकृत नहीं हैं।", "Kannada": "ಇನ್ನೂ ಬೇರೆ ಶಿಕ್ಷಕರು ನೋಂದಾಯಿಸಿಲ್ಲ.", "Tamil": "வேறு ஆசிரியர்கள் இன்னும் பதிவு செய்யவில்லை.", "Telugu": "ఇంకా ఇతర ఉపాధ్యాయులు నమోదు కాలేదు.", "Marathi": "अद्याप इतर शिक्षक नोंदणीकृत नाहीत.", "Bengali": "এখনও অন্য কোনো শিক্ষক নিবন্ধন করেননি।", "Gujarati": "હજુ સુધી અન્ય શિક્ષકો નોંધાયા નથી.", "Punjabi": "ਅਜੇ ਹੋਰ ਕੋਈ ਅਧਿਆਪਕ ਰਜਿਸਟਰ ਨਹੀਂ ਹੋਏ।", "Malayalam": "മറ്റ് അധ്യാപകർ ഇതുവരെ രജിസ്റ്റർ ചെയ്തിട്ടില്ല.", "Odia": "ଅନ୍ୟ ଶିକ୍ଷକମାନେ ଏପର୍ଯ୍ୟନ୍ତ ପଞ୍ଜୀକୃତ ହୋଇନାହାନ୍ତି।"
    },
    "No posts yet. Be the first to share something!": {
        "English": "No posts yet. Be the first to share something!", "Hindi": "अभी तक कोई पोस्ट नहीं। पहले साझा करने वाले बनें!", "Kannada": "ಇನ್ನೂ ಪೋಸ್ಟ್‌ಗಳಿಲ್ಲ. ಮೊದಲು ಹಂಚಿಕೊಳ್ಳಿ!", "Tamil": "இன்னும் இடுகைகள் இல்லை. முதலில் பகிர்ந்து கொள்ளுங்கள்!", "Telugu": "ఇంకా పోస్ట్‌లు లేవు. మొదట భాగస్వామ్యం చేయండి!", "Marathi": "अद्याप पोस्ट नाहीत. प्रथम काहीतरी शेअर करा!", "Bengali": "এখনও কোনো পোস্ট নেই। প্রথম শেয়ার করুন!", "Gujarati": "હજુ સુધી કોઈ પોસ્ટ નથી. પ્રથમ શેર કરનાર બનો!", "Punjabi": "ਅਜੇ ਕੋਈ ਪੋਸਟ ਨਹੀਂ। ਪਹਿਲਾਂ ਸਾਂਝਾ ਕਰੋ!", "Malayalam": "ഇതുവരെ പോസ്റ്റുകളില്ല. ആദ്യം പങ്കിടുക!", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ପୋଷ୍ଟ ନାହିଁ। ପ୍ରଥମେ ସେୟାର କରନ୍ତୁ!"
    },
    "No recent achievement on record. Describe what you want to celebrate in the note below.": {
        "English": "No recent achievement on record. Describe what you want to celebrate in the note below.", "Hindi": "रिकॉर्ड में कोई हालिया उपलब्धि नहीं। नीचे नोट में बताएँ कि आप क्या जश्न मनाना चाहते हैं।", "Kannada": "ದಾಖಲೆಯಲ್ಲಿ ಇತ್ತೀಚಿನ ಸಾಧನೆ ಇಲ್ಲ. ಕೆಳಗಿನ ಟಿಪ್ಪಣಿಯಲ್ಲಿ ನೀವು ಆಚರಿಸಲು ಬಯಸುವದನ್ನು ವಿವರಿಸಿ.", "Tamil": "சமீபத்திய சாதனை பதிவில் இல்லை. நீங்கள் என்ன கொண்டாட விரும்புகிறீர்கள் என்பதை கீழே உள்ள குறிப்பில் விவரிக்கவும்.", "Telugu": "రికార్డులో ఇటీవలి విజయం లేదు. మీరు ఏమి జరుపుకోవాలనుకుంటున్నారో క్రింది గమనికలో వివరించండి.", "Marathi": "रेकॉर्डवर अलीकडील यश नाही. खालील नोटमध्ये तुम्हाला काय साजरे करायचे आहे ते वर्णन करा.", "Bengali": "রেকর্ডে সাম্প্রতিক কোনো অর্জন নেই। আপনি কী উদযাপন করতে চান তা নীচের নোটে বর্ণনা করুন।", "Gujarati": "રેકોર્ડ પર તાજેતરની સિદ્ધિ નથી. તમે શું ઉજવવા માગો છો તે નીચેની નોંધમાં વર્ણવો.", "Punjabi": "ਰਿਕਾਰਡ ਵਿੱਚ ਕੋਈ ਹਾਲੀਆ ਪ੍ਰਾਪਤੀ ਨਹੀਂ। ਤੁਸੀਂ ਕੀ ਮਨਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ, ਹੇਠਾਂ ਨੋਟ ਵਿੱਚ ਦੱਸੋ।", "Malayalam": "റെക്കോർഡിൽ സമീപകാല നേട്ടമില്ല. നിങ്ങൾക്ക് ആഘോഷിക്കാൻ ആഗ്രഹിക്കുന്നത് താഴെയുള്ള കുറിപ്പിൽ വിവരിക്കുക.", "Odia": "ରେକର୍ଡରେ ସମ୍ପ୍ରତି ସଫଳତା ନାହିଁ। ଆପଣ କଣ ଉତ୍ସବ କରିବାକୁ ଚାହାନ୍ତି ତାହା ତଳ ନୋଟରେ ବର୍ଣ୍ଣନା କରନ୍ତୁ।"
    },
    "No resources yet": {
        "English": "No resources yet", "Hindi": "अभी तक कोई संसाधन नहीं", "Kannada": "ಇನ್ನೂ ಸಂಪನ್ಮೂಲಗಳಿಲ್ಲ", "Tamil": "இன்னும் வளங்கள் இல்லை", "Telugu": "ఇంకా వనరులు లేవు", "Marathi": "अद्याप संसाधने नाहीत", "Bengali": "এখনও কোনো রিসোর্স নেই", "Gujarati": "હજુ સુધી કોઈ સંસાધનો નથી", "Punjabi": "ਅਜੇ ਕੋਈ ਸਰੋਤ ਨਹੀਂ", "Malayalam": "ഇതുവരെ വിഭവങ്ങളില്ല", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ସମ୍ବଳ ନାହିଁ"
    },
    "No suggestions yet": {
        "English": "No suggestions yet", "Hindi": "अभी तक कोई सुझाव नहीं", "Kannada": "ಇನ್ನೂ ಸಲಹೆಗಳಿಲ್ಲ", "Tamil": "இன்னும் பரிந்துரைகள் இல்லை", "Telugu": "ఇంకా సూచనలు లేవు", "Marathi": "अद्याप सूचना नाहीत", "Bengali": "এখনও কোনো সুপারিশ নেই", "Gujarati": "હજુ સુધી કોઈ સૂચનો નથી", "Punjabi": "ਅਜੇ ਕੋਈ ਸੁਝਾਅ ਨਹੀਂ", "Malayalam": "ഇതുവരെ നിർദ്ദേശങ്ങളില്ല", "Odia": "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ସୁପାରିଶ ନାହିଁ"
    },
    "No teachers found": {
        "English": "No teachers found", "Hindi": "कोई शिक्षक नहीं मिले", "Kannada": "ಯಾವುದೇ ಶಿಕ್ಷಕರು ಸಿಗಲಿಲ್ಲ", "Tamil": "ஆசிரியர்கள் இல்லை", "Telugu": "ఉపాధ్యాయులు దొరకలేదు", "Marathi": "कोणतेही शिक्षक सापडले नाहीत", "Bengali": "কোনো শিক্ষক পাওয়া যায়নি", "Gujarati": "કોઈ શિક્ષકો મળ્યા નથી", "Punjabi": "ਕੋਈ ਅਧਿਆਪਕ ਨਹੀਂ ਮਿਲੇ", "Malayalam": "അധ്യാപകരെ കണ്ടെത്തിയില്ല", "Odia": "କୌଣସି ଶିକ୍ଷକ ମିଳିଲେ ନାହିଁ"
    },
    "Nothing here yet": {
        "English": "Nothing here yet", "Hindi": "अभी यहाँ कुछ नहीं है", "Kannada": "ಇಲ್ಲಿ ಇನ್ನೂ ಏನೂ ಇಲ್ಲ", "Tamil": "இங்கே இன்னும் ஏதும் இல்லை", "Telugu": "ఇక్కడ ఇంకా ఏమీ లేదు", "Marathi": "येथे अद्याप काहीही नाही", "Bengali": "এখানে এখনও কিছু নেই", "Gujarati": "અહીં હજુ કંઈ નથી", "Punjabi": "ਇੱਥੇ ਅਜੇ ਕੁਝ ਨਹੀਂ", "Malayalam": "ഇവിടെ ഇതുവരെ ഒന്നുമില്ല", "Odia": "ଏଠାରେ ଏପର୍ଯ୍ୟନ୍ତ କିଛି ନାହିଁ"
    },
    "Official source": {
        "English": "Official source", "Hindi": "आधिकारिक स्रोत", "Kannada": "ಅಧಿಕೃತ ಮೂಲ", "Tamil": "அதிகாரப்பூர்வ ஆதாரம்", "Telugu": "అధికారిక మూలం", "Marathi": "अधिकृत स्रोत", "Bengali": "অফিসিয়াল সূত্র", "Gujarati": "અધિકૃત સ્રોત", "Punjabi": "ਅਧਿਕਾਰਤ ਸਰੋਤ", "Malayalam": "ഔദ്യോഗിക ഉറവിടം", "Odia": "ସରକାରୀ ଉତ୍ସ"
    },
    "Open VIDYA Mentor": {
        "English": "Open VIDYA Mentor", "Hindi": "VIDYA मेंटर खोलें", "Kannada": "VIDYA ಮೆಂಟರ್ ತೆರೆಯಿರಿ", "Tamil": "VIDYA மென்டரைத் திற", "Telugu": "VIDYA మెంటర్ తెరవండి", "Marathi": "VIDYA मेंटर उघडा", "Bengali": "VIDYA মেন্টর খুলুন", "Gujarati": "VIDYA મેન્ટર ખોલો", "Punjabi": "VIDYA ਮੈਂਟਰ ਖੋਲ੍ਹੋ", "Malayalam": "VIDYA മെന്റർ തുറക്കുക", "Odia": "VIDYA ମେଣ୍ଟର ଖୋଲନ୍ତୁ"
    },
    "Overall Score": {
        "English": "Overall Score", "Hindi": "कुल अंक", "Kannada": "ಒಟ್ಟಾರೆ ಅಂಕ", "Tamil": "ஒட்டுமொத்த மதிப்பெண்", "Telugu": "మొత్తం స్కోర్", "Marathi": "एकूण गुण", "Bengali": "সামগ্রিক স্কোর", "Gujarati": "કુલ સ્કોર", "Punjabi": "ਕੁੱਲ ਅੰਕ", "Malayalam": "മൊത്തം സ്കോർ", "Odia": "ସମୁଦାୟ ସ୍କୋର"
    },
    "Page Not Found": {
        "English": "Page Not Found", "Hindi": "पृष्ठ नहीं मिला", "Kannada": "ಪುಟ ಸಿಗಲಿಲ್ಲ", "Tamil": "பக்கம் கிடைக்கவில்லை", "Telugu": "పేజీ దొరకలేదు", "Marathi": "पृष्ठ सापडले नाही", "Bengali": "পৃষ্ঠা পাওয়া যায়নি", "Gujarati": "પેજ મળ્યું નથી", "Punjabi": "ਪੰਨਾ ਨਹੀਂ ਮਿਲਿਆ", "Malayalam": "പേജ് കണ്ടെത്തിയില്ല", "Odia": "ପୃଷ୍ଠା ମିଳିଲା ନାହିଁ"
    },
    "Parent Commitments": {
        "English": "Parent Commitments", "Hindi": "अभिभावक प्रतिबद्धताएँ", "Kannada": "ಪೋಷಕ ಬದ್ಧತೆಗಳು", "Tamil": "பெற்றோர் உறுதிமொழிகள்", "Telugu": "తల్లిదండ్రుల నిబద్ధతలు", "Marathi": "पालक वचनबद्धता", "Bengali": "অভিভাবকের প্রতিশ্রুতি", "Gujarati": "વાલી પ્રતિબદ્ધતાઓ", "Punjabi": "ਮਾਪਿਆਂ ਦੀਆਂ ਵਚਨਬੱਧਤਾਵਾਂ", "Malayalam": "രക്ഷിതാക്കളുടെ പ്രതിബദ്ധതകൾ", "Odia": "ଅଭିଭାବକ ପ୍ରତିବଦ୍ଧତା"
    },
    "Parent Response": {
        "English": "Parent Response", "Hindi": "अभिभावक प्रतिक्रिया", "Kannada": "ಪೋಷಕ ಪ್ರತಿಕ್ರಿಯೆ", "Tamil": "பெற்றோர் பதில்", "Telugu": "తల్లిదండ్రుల ప్రతిస్పందన", "Marathi": "पालक प्रतिसाद", "Bengali": "অভিভাবকের প্রতিক্রিয়া", "Gujarati": "વાલી પ્રતિસાદ", "Punjabi": "ਮਾਪਿਆਂ ਦਾ ਜਵਾਬ", "Malayalam": "രക്ഷിതാവിന്റെ പ്രതികരണം", "Odia": "ଅଭିଭାବକ ପ୍ରତିକ୍ରିୟା"
    },
    "People You May Know": {
        "English": "People You May Know", "Hindi": "लोग जिन्हें आप जानते होंगे", "Kannada": "ನಿಮಗೆ ಪರಿಚಿತರಾಗಿರಬಹುದು", "Tamil": "உங்களுக்குத் தெரிந்திருக்கக்கூடியவர்கள்", "Telugu": "మీకు తెలిసిన వ్యక్తులు", "Marathi": "तुम्हाला माहित असू शकणारे लोक", "Bengali": "যাদের আপনি চিনতে পারেন", "Gujarati": "તમે જાણતા હો તેવા લોકો", "Punjabi": "ਲੋਕ ਜਿਨ੍ਹਾਂ ਨੂੰ ਤੁਸੀਂ ਜਾਣ ਸਕਦੇ ਹੋ", "Malayalam": "നിങ്ങൾക്ക് അറിയാവുന്നവർ", "Odia": "ଆପଣ ଜାଣିପାରନ୍ତି ଏପରି ଲୋକ"
    },
    "Personalization is loading. Showing recommended Indian educational videos.": {
        "English": "Personalization is loading. Showing recommended Indian educational videos.", "Hindi": "वैयक्तिकरण लोड हो रहा है। अनुशंसित भारतीय शैक्षिक वीडियो दिखाए जा रहे हैं।", "Kannada": "ವೈಯಕ್ತೀಕರಣ ಲೋಡ್ ಆಗುತ್ತಿದೆ. ಶಿಫಾರಸು ಮಾಡಿದ ಭಾರತೀಯ ಶೈಕ್ಷಣಿಕ ವೀಡಿಯೋಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ.", "Tamil": "தனிப்பயனாக்கம் ஏற்றப்படுகிறது. பரிந்துரைக்கப்பட்ட இந்திய கல்வி வீடியோக்கள் காட்டப்படுகின்றன.", "Telugu": "వ్యక్తిగతీకరణ లోడ్ అవుతోంది. సిఫార్సు చేయబడిన భారతీయ విద్యా వీడియోలను చూపుతోంది.", "Marathi": "वैयक्तिकरण लोड होत आहे. शिफारस केलेले भारतीय शैक्षणिक व्हिडिओ दाखवत आहे.", "Bengali": "ব্যক্তিগতকরণ লোড হচ্ছে। প্রস্তাবিত ভারতীয় শিক্ষামূলক ভিডিও দেখানো হচ্ছে।", "Gujarati": "વ્યક્તિગતકરણ લોડ થઈ રહ્યું છે. ભલામણ કરેલા ભારતીય શૈક્ષણિક વિડિઓ બતાવી રહ્યા છીએ.", "Punjabi": "ਨਿੱਜੀਕਰਨ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ। ਸਿਫ਼ਾਰਸ਼ ਕੀਤੇ ਭਾਰਤੀ ਵਿਦਿਅਕ ਵੀਡੀਓ ਦਿਖਾ ਰਹੇ ਹਾਂ।", "Malayalam": "വ്യക്തിഗതമാക്കൽ ലോഡ് ചെയ്യുന്നു. ശുപാർശ ചെയ്ത ഇന്ത്യൻ വിദ്യാഭ്യാസ വീഡിയോകൾ കാണിക്കുന്നു.", "Odia": "ବ୍ୟକ୍ତିଗତକରଣ ଲୋଡ୍ ହେଉଛି। ସୁପାରିଶ କରାଯାଇଥିବା ଭାରତୀୟ ଶିକ୍ଷାଗତ ଭିଡିଓ ଦେଖାଯାଉଛି।"
    },
    "Pick what to generate next:": {
        "English": "Pick what to generate next:", "Hindi": "अगला क्या जनरेट करना है, चुनें:", "Kannada": "ಮುಂದೆ ಏನು ರಚಿಸಬೇಕೆಂದು ಆಯ್ಕೆಮಾಡಿ:", "Tamil": "அடுத்து என்ன உருவாக்க வேண்டும் என்பதைத் தேர்ந்தெடுக்கவும்:", "Telugu": "తర్వాత ఏమి సృష్టించాలో ఎంచుకోండి:", "Marathi": "पुढे काय तयार करायचे ते निवडा:", "Bengali": "পরবর্তীতে কী তৈরি করবেন তা বেছে নিন:", "Gujarati": "આગળ શું જનરેટ કરવું તે પસંદ કરો:", "Punjabi": "ਅੱਗੇ ਕੀ ਬਣਾਉਣਾ ਹੈ, ਚੁਣੋ:", "Malayalam": "അടുത്തതായി എന്ത് സൃഷ്ടിക്കണമെന്ന് തിരഞ്ഞെടുക്കുക:", "Odia": "ପରବର୍ତ୍ତୀ କଣ ସୃଷ୍ଟି କରିବେ ବାଛନ୍ତୁ:"
    },
    "Plan & Billing": {
        "English": "Plan & Billing", "Hindi": "योजना और बिलिंग", "Kannada": "ಯೋಜನೆ ಮತ್ತು ಬಿಲ್ಲಿಂಗ್", "Tamil": "திட்டம் & பில்லிங்", "Telugu": "ప్లాన్ & బిల్లింగ్", "Marathi": "योजना आणि बिलिंग", "Bengali": "প্ল্যান ও বিলিং", "Gujarati": "પ્લાન અને બિલિંગ", "Punjabi": "ਯੋਜਨਾ ਅਤੇ ਬਿਲਿੰਗ", "Malayalam": "പ്ലാൻ & ബില്ലിംഗ്", "Odia": "ଯୋଜନା ଓ ବିଲିଂ"
    },
    "Please check your connection and try again.": {
        "English": "Please check your connection and try again.", "Hindi": "कृपया अपना कनेक्शन जाँचें और पुनः प्रयास करें।", "Kannada": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.", "Bengali": "অনুগ্রহ করে আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", "Gujarati": "કૃપા કરીને તમારું કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ദയവായി നിങ്ങളുടെ കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଦୟାକରି ଆପଣଙ୍କ ସଂଯୋଗ ଯାଞ୍ଚ କରି ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Please log in to generate exam papers.": {
        "English": "Please log in to generate exam papers.", "Hindi": "परीक्षा पत्र जनरेट करने के लिए कृपया लॉग इन करें।", "Kannada": "ಪರೀಕ್ಷಾ ಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಮಾಡಿ.", "Tamil": "தேர்வுத் தாள்களை உருவாக்க உள்நுழையவும்.", "Telugu": "పరీక్షా పత్రాలను రూపొందించడానికి దయచేసి లాగిన్ చేయండి.", "Marathi": "परीक्षा पेपर तयार करण्यासाठी कृपया लॉग इन करा.", "Bengali": "পরীক্ষার পত্র তৈরি করতে অনুগ্রহ করে লগ ইন করুন।", "Gujarati": "પરીક્ષા પેપર જનરેટ કરવા માટે કૃપા કરીને લોગ ઇન કરો.", "Punjabi": "ਪ੍ਰੀਖਿਆ ਪੇਪਰ ਬਣਾਉਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਲੌਗ ਇਨ ਕਰੋ।", "Malayalam": "പരീക്ഷാ പേപ്പറുകൾ സൃഷ്ടിക്കാൻ ദയവായി ലോഗിൻ ചെയ്യുക.", "Odia": "ପରୀକ୍ଷା ପତ୍ର ସୃଷ୍ଟି କରିବାକୁ ଦୟାକରି ଲଗଇନ କରନ୍ତୁ।"
    },
    "Please select a grade level first to see NCERT chapters.": {
        "English": "Please select a grade level first to see NCERT chapters.", "Hindi": "NCERT अध्याय देखने के लिए कृपया पहले कक्षा स्तर चुनें।", "Kannada": "NCERT ಅಧ್ಯಾಯಗಳನ್ನು ನೋಡಲು ದಯವಿಟ್ಟು ಮೊದಲು ತರಗತಿಯ ಮಟ್ಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ.", "Tamil": "NCERT அத்தியாயங்களைப் பார்க்க முதலில் வகுப்பு நிலையைத் தேர்ந்தெடுக்கவும்.", "Telugu": "NCERT అధ్యాయాలను చూడటానికి దయచేసి మొదట గ్రేడ్ స్థాయిని ఎంచుకోండి.", "Marathi": "NCERT धडे पाहण्यासाठी कृपया प्रथम इयत्ता निवडा.", "Bengali": "NCERT অধ্যায় দেখতে অনুগ্রহ করে প্রথমে শ্রেণী নির্বাচন করুন।", "Gujarati": "NCERT પ્રકરણો જોવા માટે કૃપા કરીને પ્રથમ ધોરણ પસંદ કરો.", "Punjabi": "NCERT ਅਧਿਆਏ ਵੇਖਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ ਜਮਾਤ ਚੁਣੋ।", "Malayalam": "NCERT അധ്യായങ്ങൾ കാണാൻ ദയവായി ആദ്യം ഗ്രേഡ് നില തിരഞ്ഞെടുക്കുക.", "Odia": "NCERT ଅଧ୍ୟାୟ ଦେଖିବାକୁ ଦୟାକରି ପ୍ରଥମେ ଶ୍ରେଣୀ ବାଛନ୍ତୁ।"
    },
    "Please sign in": {
        "English": "Please sign in", "Hindi": "कृपया साइन इन करें", "Kannada": "ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "உள்நுழையவும்", "Telugu": "దయచేసి సైన్ ఇన్ చేయండి", "Marathi": "कृपया साइन इन करा", "Bengali": "অনুগ্রহ করে সাইন ইন করুন", "Gujarati": "કૃપા કરીને સાઇન ઇન કરો", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "ദയവായി സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଦୟାକରି ସାଇନ ଇନ କରନ୍ତୁ"
    },
    "Populating teacher directory...": {
        "English": "Populating teacher directory...", "Hindi": "शिक्षक निर्देशिका भरी जा रही है...", "Kannada": "ಶಿಕ್ಷಕರ ಡೈರೆಕ್ಟರಿ ತುಂಬುತ್ತಿದೆ...", "Tamil": "ஆசிரியர் கோப்பகம் நிரப்பப்படுகிறது...", "Telugu": "ఉపాధ్యాయుల డైరెక్టరీ నింపబడుతోంది...", "Marathi": "शिक्षक निर्देशिका भरली जात आहे...", "Bengali": "শিক্ষক ডিরেক্টরি পূরণ করা হচ্ছে...", "Gujarati": "શિક્ષક ડિરેક્ટરી ભરાઈ રહી છે...", "Punjabi": "ਅਧਿਆਪਕ ਡਾਇਰੈਕਟਰੀ ਭਰੀ ਜਾ ਰਹੀ ਹੈ...", "Malayalam": "അധ്യാപക ഡയറക്ടറി പൂരിപ്പിക്കുന്നു...", "Odia": "ଶିକ୍ଷକ ଡିରେକ୍ଟରୀ ଭର୍ତ୍ତି ହେଉଛି..."
    },
    "Post created!": {
        "English": "Post created!", "Hindi": "पोस्ट बन गई!", "Kannada": "ಪೋಸ್ಟ್ ರಚಿಸಲಾಗಿದೆ!", "Tamil": "இடுகை உருவாக்கப்பட்டது!", "Telugu": "పోస్ట్ సృష్టించబడింది!", "Marathi": "पोस्ट तयार झाली!", "Bengali": "পোস্ট তৈরি হয়েছে!", "Gujarati": "પોસ્ટ બની!", "Punjabi": "ਪੋਸਟ ਬਣ ਗਈ!", "Malayalam": "പോസ്റ്റ് സൃഷ്ടിച്ചു!", "Odia": "ପୋଷ୍ଟ ସୃଷ୍ଟି ହୋଇଛି!"
    },
    "Posted!": {
        "English": "Posted!", "Hindi": "पोस्ट हो गया!", "Kannada": "ಪೋಸ್ಟ್ ಆಗಿದೆ!", "Tamil": "இடப்பட்டது!", "Telugu": "పోస్ట్ చేయబడింది!", "Marathi": "पोस्ट केले!", "Bengali": "পোস্ট হয়েছে!", "Gujarati": "પોસ્ટ થયું!", "Punjabi": "ਪੋਸਟ ਹੋ ਗਿਆ!", "Malayalam": "പോസ്റ്റ് ചെയ്തു!", "Odia": "ପୋଷ୍ଟ ହୋଇଛି!"
    },
    "Posts from teachers in your groups and the daily SahayakAI education briefing will appear here.": {
        "English": "Posts from teachers in your groups and the daily SahayakAI education briefing will appear here.", "Hindi": "आपके समूहों के शिक्षकों की पोस्ट और दैनिक SahayakAI शिक्षा ब्रीफिंग यहाँ दिखाई देगी।", "Kannada": "ನಿಮ್ಮ ಗುಂಪುಗಳ ಶಿಕ್ಷಕರ ಪೋಸ್ಟ್‌ಗಳು ಮತ್ತು ದೈನಂದಿನ SahayakAI ಶಿಕ್ಷಣ ಬ್ರೀಫಿಂಗ್ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.", "Tamil": "உங்கள் குழுக்களில் உள்ள ஆசிரியர்களின் இடுகைகள் மற்றும் தினசரி SahayakAI கல்வி தகவல் இங்கே தோன்றும்.", "Telugu": "మీ గ్రూపులలోని ఉపాధ్యాయుల పోస్ట్‌లు మరియు రోజువారీ SahayakAI విద్యా బ్రీఫింగ్ ఇక్కడ కనిపిస్తాయి.", "Marathi": "तुमच्या गटांतील शिक्षकांच्या पोस्ट आणि दैनंदिन SahayakAI शिक्षण ब्रीफिंग येथे दिसेल.", "Bengali": "আপনার গ্রুপের শিক্ষকদের পোস্ট এবং দৈনিক SahayakAI শিক্ষা ব্রিফিং এখানে দেখা যাবে।", "Gujarati": "તમારા જૂથોના શિક્ષકોની પોસ્ટ અને દૈનિક SahayakAI શિક્ષણ બ્રીફિંગ અહીં દેખાશે.", "Punjabi": "ਤੁਹਾਡੇ ਸਮੂਹਾਂ ਦੇ ਅਧਿਆਪਕਾਂ ਦੀਆਂ ਪੋਸਟਾਂ ਅਤੇ ਰੋਜ਼ਾਨਾ SahayakAI ਸਿੱਖਿਆ ਬ੍ਰੀਫਿੰਗ ਇੱਥੇ ਦਿਖਾਈ ਦੇਵੇਗੀ।", "Malayalam": "നിങ്ങളുടെ ഗ്രൂപ്പുകളിലെ അധ്യാപകരുടെ പോസ്റ്റുകളും ദൈനംദിന SahayakAI വിദ്യാഭ്യാസ ബ്രീഫിംഗും ഇവിടെ ദൃശ്യമാകും.", "Odia": "ଆପଣଙ୍କ ଗୋଷ୍ଠୀର ଶିକ୍ଷକଙ୍କ ପୋଷ୍ଟ ଓ ଦୈନିକ SahayakAI ଶିକ୍ଷା ବ୍ରିଫିଂ ଏଠାରେ ଦେଖାଯିବ।"
    },
    "Privacy & Data": {
        "English": "Privacy & Data", "Hindi": "गोपनीयता और डेटा", "Kannada": "ಗೌಪ್ಯತೆ ಮತ್ತು ಡೇಟಾ", "Tamil": "தனியுரிமை & தரவு", "Telugu": "గోప్యత & డేటా", "Marathi": "गोपनीयता आणि डेटा", "Bengali": "গোপনীয়তা ও ডেটা", "Gujarati": "ગોપનીયતા અને ડેટા", "Punjabi": "ਗੋਪਨੀਯਤਾ ਅਤੇ ਡੇਟਾ", "Malayalam": "സ്വകാര്യത & ഡാറ്റ", "Odia": "ଗୋପନୀୟତା ଓ ଡାଟା"
    },
    "Product Updates": {
        "English": "Product Updates", "Hindi": "उत्पाद अपडेट", "Kannada": "ಉತ್ಪನ್ನ ನವೀಕರಣಗಳು", "Tamil": "தயாரிப்பு புதுப்பிப்புகள்", "Telugu": "ఉత్పత్తి అప్‌డేట్‌లు", "Marathi": "उत्पादन अद्यतने", "Bengali": "প্রোডাক্ট আপডেট", "Gujarati": "પ્રોડક્ટ અપડેટ", "Punjabi": "ਉਤਪਾਦ ਅੱਪਡੇਟ", "Malayalam": "ഉൽപ്പന്ന അപ്ഡേറ്റുകൾ", "Odia": "ଉତ୍ପାଦ ଅଦ୍ୟତନ"
    },
    "Professional Profile": {
        "English": "Professional Profile", "Hindi": "व्यावसायिक प्रोफ़ाइल", "Kannada": "ವೃತ್ತಿಪರ ಪ್ರೊಫೈಲ್", "Tamil": "தொழில்முறை சுயவிவரம்", "Telugu": "వృత్తిపరమైన ప్రొఫైల్", "Marathi": "व्यावसायिक प्रोफाइल", "Bengali": "পেশাদার প্রোফাইল", "Gujarati": "વ્યવસાયિક પ્રોફાઇલ", "Punjabi": "ਪੇਸ਼ੇਵਰ ਪ੍ਰੋਫਾਈਲ", "Malayalam": "പ്രൊഫഷണൽ പ്രൊഫൈൽ", "Odia": "ବୃତ୍ତିଗତ ପ୍ରୋଫାଇଲ୍"
    },
    "Profile": {
        "English": "Profile", "Hindi": "प्रोफ़ाइल", "Kannada": "ಪ್ರೊಫೈಲ್", "Tamil": "சுயவிவரம்", "Telugu": "ప్రొఫైల్", "Marathi": "प्रोफाइल", "Bengali": "প্রোফাইল", "Gujarati": "પ્રોફાઇલ", "Punjabi": "ਪ੍ਰੋਫਾਈਲ", "Malayalam": "പ്രൊഫൈൽ", "Odia": "ପ୍ରୋଫାଇଲ୍"
    },
    "Profile Photo": {
        "English": "Profile Photo", "Hindi": "प्रोफ़ाइल फ़ोटो", "Kannada": "ಪ್ರೊಫೈಲ್ ಫೋಟೋ", "Tamil": "சுயவிவர புகைப்படம்", "Telugu": "ప్రొఫైల్ ఫోటో", "Marathi": "प्रोफाइल फोटो", "Bengali": "প্রোফাইল ফটো", "Gujarati": "પ્રોફાઇલ ફોટો", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਫੋਟੋ", "Malayalam": "പ്രൊഫൈൽ ഫോട്ടോ", "Odia": "ପ୍ରୋଫାଇଲ୍ ଫଟୋ"
    },
    "Profile setup required": {
        "English": "Profile setup required", "Hindi": "प्रोफ़ाइल सेटअप आवश्यक", "Kannada": "ಪ್ರೊಫೈಲ್ ಸೆಟಪ್ ಅಗತ್ಯವಿದೆ", "Tamil": "சுயவிவர அமைப்பு தேவை", "Telugu": "ప్రొఫైల్ సెటప్ అవసరం", "Marathi": "प्रोफाइल सेटअप आवश्यक", "Bengali": "প্রোফাইল সেটআপ প্রয়োজন", "Gujarati": "પ્રોફાઇલ સેટઅપ જરૂરી", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਸੈਟਅੱਪ ਲੋੜੀਂਦਾ", "Malayalam": "പ്രൊഫൈൽ സജ്ജീകരണം ആവശ്യം", "Odia": "ପ୍ରୋଫାଇଲ୍ ସେଟଅପ୍ ଆବଶ୍ୟକ"
    },
    "Profile updated": {
        "English": "Profile updated", "Hindi": "प्रोफ़ाइल अपडेट हो गई", "Kannada": "ಪ್ರೊಫೈಲ್ ನವೀಕರಿಸಲಾಗಿದೆ", "Tamil": "சுயவிவரம் புதுப்பிக்கப்பட்டது", "Telugu": "ప్రొఫైల్ నవీకరించబడింది", "Marathi": "प्रोफाइल अद्यतनित केले", "Bengali": "প্রোফাইল আপডেট হয়েছে", "Gujarati": "પ્રોફાઇલ અપડેટ થઈ", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਅੱਪਡੇਟ ਹੋ ਗਈ", "Malayalam": "പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്തു", "Odia": "ପ୍ରୋଫାଇଲ୍ ଅଦ୍ୟତନ ହୋଇଛି"
    },
    "Pull to refresh or try again later.": {
        "English": "Pull to refresh or try again later.", "Hindi": "रिफ्रेश करने के लिए खींचें या बाद में पुनः प्रयास करें।", "Kannada": "ರಿಫ್ರೆಶ್ ಮಾಡಲು ಎಳೆಯಿರಿ ಅಥವಾ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "புதுப்பிக்க இழுக்கவும் அல்லது பின்னர் முயற்சிக்கவும்.", "Telugu": "రిఫ్రెష్ చేయడానికి లాగండి లేదా తర్వాత మళ్లీ ప్రయత్నించండి.", "Marathi": "रिफ्रेश करण्यासाठी खाली खेचा किंवा नंतर पुन्हा प्रयत्न करा.", "Bengali": "রিফ্রেশ করতে টানুন বা পরে আবার চেষ্টা করুন।", "Gujarati": "રિફ્રેશ કરવા માટે ખેંચો અથવા પછી ફરી પ્રયાસ કરો.", "Punjabi": "ਰਿਫਰੈਸ਼ ਕਰਨ ਲਈ ਖਿੱਚੋ ਜਾਂ ਬਾਅਦ ਵਿੱਚ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "പുതുക്കാൻ വലിക്കുക അല്ലെങ്കിൽ പിന്നീട് ശ്രമിക്കുക.", "Odia": "ରିଫ୍ରେସ କରିବାକୁ ଟାଣନ୍ତୁ କିମ୍ବା ପରେ ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Qualifications": {
        "English": "Qualifications", "Hindi": "योग्यताएँ", "Kannada": "ಅರ್ಹತೆಗಳು", "Tamil": "தகுதிகள்", "Telugu": "అర్హతలు", "Marathi": "पात्रता", "Bengali": "যোগ্যতা", "Gujarati": "લાયકાત", "Punjabi": "ਯੋਗਤਾਵਾਂ", "Malayalam": "യോഗ്യതകൾ", "Odia": "ଯୋଗ୍ୟତା"
    },
    "Ready to explore?": {
        "English": "Ready to explore?", "Hindi": "खोजने के लिए तैयार?", "Kannada": "ಅನ್ವೇಷಿಸಲು ಸಿದ್ಧರೇ?", "Tamil": "ஆராய தயாரா?", "Telugu": "అన్వేషించడానికి సిద్ధంగా ఉన్నారా?", "Marathi": "एक्सप्लोर करण्यास तयार?", "Bengali": "অন্বেষণ করতে প্রস্তুত?", "Gujarati": "અન્વેષણ કરવા તૈયાર?", "Punjabi": "ਖੋਜਣ ਲਈ ਤਿਆਰ?", "Malayalam": "പര്യവേക്ഷണത്തിന് തയ്യാറാണോ?", "Odia": "ଅନୁସନ୍ଧାନ ପାଇଁ ପ୍ରସ୍ତୁତ?"
    },
    "Receive notifications about new features": {
        "English": "Receive notifications about new features", "Hindi": "नई सुविधाओं की सूचनाएँ प्राप्त करें", "Kannada": "ಹೊಸ ವೈಶಿಷ್ಟ್ಯಗಳ ಬಗ್ಗೆ ಅಧಿಸೂಚನೆಗಳನ್ನು ಸ್ವೀಕರಿಸಿ", "Tamil": "புதிய அம்சங்கள் குறித்த அறிவிப்புகளைப் பெறுங்கள்", "Telugu": "కొత్త ఫీచర్ల గురించి నోటిఫికేషన్‌లను స్వీకరించండి", "Marathi": "नवीन वैशिष्ट्यांबद्दल सूचना मिळवा", "Bengali": "নতুন বৈশিষ্ট্য সম্পর্কে বিজ্ঞপ্তি পান", "Gujarati": "નવી સુવિધાઓ વિશે સૂચનાઓ મેળવો", "Punjabi": "ਨਵੀਆਂ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਬਾਰੇ ਸੂਚਨਾਵਾਂ ਪ੍ਰਾਪਤ ਕਰੋ", "Malayalam": "പുതിയ ഫീച്ചറുകളെക്കുറിച്ചുള്ള അറിയിപ്പുകൾ സ്വീകരിക്കുക", "Odia": "ନୂତନ ବୈଶିଷ୍ଟ୍ୟଗୁଡ଼ିକ ବିଷୟରେ ବିଜ୍ଞପ୍ତି ପ୍ରାପ୍ତ କରନ୍ତୁ"
    },
    "Record your acceptance": {
        "English": "Record your acceptance", "Hindi": "अपनी स्वीकृति दर्ज करें", "Kannada": "ನಿಮ್ಮ ಸ್ವೀಕಾರವನ್ನು ದಾಖಲಿಸಿ", "Tamil": "உங்கள் ஒப்புதலைப் பதிவு செய்யுங்கள்", "Telugu": "మీ అంగీకారాన్ని నమోదు చేయండి", "Marathi": "तुमची स्वीकृती नोंदवा", "Bengali": "আপনার সম্মতি রেকর্ড করুন", "Gujarati": "તમારી સ્વીકૃતિ નોંધો", "Punjabi": "ਆਪਣੀ ਸਵੀਕ੍ਰਿਤੀ ਦਰਜ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ സമ്മതം രേഖപ്പെടുത്തുക", "Odia": "ଆପଣଙ୍କ ସ୍ୱୀକୃତି ରେକର୍ଡ କରନ୍ତୁ"
    },
    "Refresh": {
        "English": "Refresh", "Hindi": "रिफ़्रेश करें", "Kannada": "ರಿಫ್ರೆಶ್", "Tamil": "புதுப்பி", "Telugu": "రిఫ్రెష్", "Marathi": "रिफ्रेश करा", "Bengali": "রিফ্রেশ করুন", "Gujarati": "રિફ્રેશ કરો", "Punjabi": "ਰਿਫ੍ਰੈਸ਼ ਕਰੋ", "Malayalam": "പുതുക്കുക", "Odia": "ରିଫ୍ରେସ୍ କରନ୍ତୁ"
    },
    "Remove custom photo": {
        "English": "Remove custom photo", "Hindi": "कस्टम फ़ोटो हटाएँ", "Kannada": "ಕಸ್ಟಮ್ ಫೋಟೋವನ್ನು ತೆಗೆದುಹಾಕಿ", "Tamil": "தனிப்பயன் புகைப்படத்தை அகற்று", "Telugu": "కస్టమ్ ఫోటోను తీసివేయండి", "Marathi": "कस्टम फोटो काढून टाका", "Bengali": "কাস্টম ছবি সরান", "Gujarati": "કસ્ટમ ફોટો દૂર કરો", "Punjabi": "ਕਸਟਮ ਫੋਟੋ ਹਟਾਓ", "Malayalam": "ഇഷ്ടാനുസൃത ഫോട്ടോ നീക്കം ചെയ്യുക", "Odia": "କଷ୍ଟମ ଫଟୋ ହଟାନ୍ତୁ"
    },
    "Request already pending": {
        "English": "Request already pending", "Hindi": "अनुरोध पहले से लंबित है", "Kannada": "ವಿನಂತಿ ಈಗಾಗಲೇ ಬಾಕಿ ಇದೆ", "Tamil": "கோரிக்கை ஏற்கனவே நிலுவையில் உள்ளது", "Telugu": "అభ్యర్థన ఇప్పటికే పెండింగ్‌లో ఉంది", "Marathi": "विनंती आधीच प्रलंबित आहे", "Bengali": "অনুরোধ ইতিমধ্যে মুলতুবি রয়েছে", "Gujarati": "વિનંતી પહેલેથી જ બાકી છે", "Punjabi": "ਬੇਨਤੀ ਪਹਿਲਾਂ ਹੀ ਬਕਾਇਆ ਹੈ", "Malayalam": "അഭ്യർത്ഥന ഇതിനകം തീർപ്പാക്കാത്തതാണ്", "Odia": "ଅନୁରୋଧ ପୂର୍ବରୁ ବିଚାରାଧୀନ"
    },
    "Request sent": {
        "English": "Request sent", "Hindi": "अनुरोध भेजा गया", "Kannada": "ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ", "Tamil": "கோரிக்கை அனுப்பப்பட்டது", "Telugu": "అభ్యర్థన పంపబడింది", "Marathi": "विनंती पाठवली", "Bengali": "অনুরোধ পাঠানো হয়েছে", "Gujarati": "વિનંતી મોકલી", "Punjabi": "ਬੇਨਤੀ ਭੇਜੀ ਗਈ", "Malayalam": "അഭ്യർത്ഥന അയച്ചു", "Odia": "ଅନୁରୋଧ ପଠାଗଲା"
    },
    "Reset Session": {
        "English": "Reset Session", "Hindi": "सत्र रीसेट करें", "Kannada": "ಸೆಷನ್ ರೀಸೆಟ್ ಮಾಡಿ", "Tamil": "அமர்வை மீட்டமை", "Telugu": "సెషన్‌ను రీసెట్ చేయండి", "Marathi": "सत्र रीसेट करा", "Bengali": "সেশন রিসেট করুন", "Gujarati": "સત્ર રીસેટ કરો", "Punjabi": "ਸੈਸ਼ਨ ਰੀਸੈੱਟ ਕਰੋ", "Malayalam": "സെഷൻ പുനഃസജ്ജമാക്കുക", "Odia": "ସେସନ୍ ରିସେଟ୍ କରନ୍ତୁ"
    },
    "Resources Available": {
        "English": "Resources Available", "Hindi": "उपलब्ध संसाधन", "Kannada": "ಲಭ್ಯವಿರುವ ಸಂಪನ್ಮೂಲಗಳು", "Tamil": "கிடைக்கும் வளங்கள்", "Telugu": "అందుబాటులో ఉన్న వనరులు", "Marathi": "उपलब्ध संसाधने", "Bengali": "উপলব্ধ সংস্থান", "Gujarati": "ઉપલબ્ધ સંસાધનો", "Punjabi": "ਉਪਲਬਧ ਸਰੋਤ", "Malayalam": "ലഭ്യമായ വിഭവങ്ങൾ", "Odia": "ଉପଲବ୍ଧ ସମ୍ବଳ"
    },
    "Return Home": {
        "English": "Return Home", "Hindi": "होम पर वापस जाएँ", "Kannada": "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ", "Tamil": "முகப்புக்குத் திரும்பு", "Telugu": "హోమ్‌కు తిరిగి వెళ్ళండి", "Marathi": "होमवर परत जा", "Bengali": "হোমে ফিরে যান", "Gujarati": "હોમ પર પાછા જાઓ", "Punjabi": "ਹੋਮ ਉੱਤੇ ਵਾਪਸ ਜਾਓ", "Malayalam": "ഹോമിലേക്ക് മടങ്ങുക", "Odia": "ହୋମକୁ ଫେରନ୍ତୁ"
    },
    "SahayakAI Assistant": {
        "English": "SahayakAI Assistant", "Hindi": "SahayakAI सहायक", "Kannada": "SahayakAI ಸಹಾಯಕ", "Tamil": "SahayakAI உதவியாளர்", "Telugu": "SahayakAI అసిస్టెంట్", "Marathi": "SahayakAI सहाय्यक", "Bengali": "SahayakAI সহকারী", "Gujarati": "SahayakAI સહાયક", "Punjabi": "SahayakAI ਸਹਾਇਕ", "Malayalam": "SahayakAI അസിസ്റ്റന്റ്", "Odia": "SahayakAI ସହାୟକ"
    },
    "Save Profile": {
        "English": "Save Profile", "Hindi": "प्रोफ़ाइल सहेजें", "Kannada": "ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ", "Tamil": "சுயவிவரத்தைச் சேமி", "Telugu": "ప్రొఫైల్‌ను సేవ్ చేయండి", "Marathi": "प्रोफाइल जतन करा", "Bengali": "প্রোফাইল সংরক্ষণ করুন", "Gujarati": "પ્રોફાઇલ સાચવો", "Punjabi": "ਪ੍ਰੋਫਾਈਲ ਸੰਭਾਲੋ", "Malayalam": "പ്രൊഫൈൽ സംരക്ഷിക്കുക", "Odia": "ପ୍ରୋଫାଇଲ୍ ସେଭ୍ କରନ୍ତୁ"
    },
    "Score Breakdown": {
        "English": "Score Breakdown", "Hindi": "स्कोर विवरण", "Kannada": "ಸ್ಕೋರ್ ವಿಭಜನೆ", "Tamil": "மதிப்பெண் விவரம்", "Telugu": "స్కోర్ వివరణ", "Marathi": "गुण विभाजन", "Bengali": "স্কোর বিশ্লেষণ", "Gujarati": "સ્કોર વિગત", "Punjabi": "ਸਕੋਰ ਵੇਰਵਾ", "Malayalam": "സ്കോർ വിശദാംശം", "Odia": "ସ୍କୋର ବିଭାଜନ"
    },
    "Search for lesson plans, quizzes, and more...": {
        "English": "Search for lesson plans, quizzes, and more...", "Hindi": "पाठ योजनाएँ, क्विज़ और अन्य खोजें...", "Kannada": "ಪಾಠ ಯೋಜನೆಗಳು, ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಇನ್ನಷ್ಟು ಹುಡುಕಿ...", "Tamil": "பாடத் திட்டங்கள், வினாடி வினாக்கள் மற்றும் பலவற்றைத் தேடுங்கள்...", "Telugu": "పాఠ ప్రణాళికలు, క్విజ్‌లు మరియు మరిన్ని కోసం శోధించండి...", "Marathi": "पाठ योजना, क्विझ आणि बरेच काही शोधा...", "Bengali": "পাঠ পরিকল্পনা, কুইজ এবং আরও অনেক কিছু খুঁজুন...", "Gujarati": "પાઠ યોજનાઓ, ક્વિઝ અને વધુ શોધો...", "Punjabi": "ਪਾਠ ਯੋਜਨਾਵਾਂ, ਕਵਿਜ਼ ਅਤੇ ਹੋਰ ਖੋਜੋ...", "Malayalam": "പാഠ പദ്ധതികൾ, ക്വിസുകൾ എന്നിവയും അതിലധികവും തിരയുക...", "Odia": "ପାଠ ଯୋଜନା, କୁଇଜ୍ ଏବଂ ଅଧିକ ଖୋଜନ୍ତୁ..."
    },
    "Search teachers across Bharat by subject, grade, school, or area. Send a connect request to start a conversation.": {
        "English": "Search teachers across Bharat by subject, grade, school, or area. Send a connect request to start a conversation.", "Hindi": "विषय, कक्षा, स्कूल या क्षेत्र के आधार पर पूरे भारत के शिक्षकों को खोजें। बातचीत शुरू करने के लिए कनेक्ट अनुरोध भेजें।", "Kannada": "ವಿಷಯ, ತರಗತಿ, ಶಾಲೆ ಅಥವಾ ಪ್ರದೇಶದ ಆಧಾರದ ಮೇಲೆ ಭಾರತದಾದ್ಯಂತ ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ. ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಸಂಪರ್ಕ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಿ.", "Tamil": "பாடம், வகுப்பு, பள்ளி அல்லது பகுதி அடிப்படையில் பாரதம் முழுவதும் உள்ள ஆசிரியர்களைத் தேடுங்கள். உரையாடலைத் தொடங்க இணைப்புக் கோரிக்கையை அனுப்புங்கள்.", "Telugu": "విషయం, తరగతి, పాఠశాల లేదా ప్రాంతం ఆధారంగా భారతదేశం అంతటా ఉపాధ్యాయులను శోధించండి. సంభాషణను ప్రారంభించడానికి కనెక్ట్ అభ్యర్థన పంపండి.", "Marathi": "विषय, इयत्ता, शाळा किंवा क्षेत्रानुसार संपूर्ण भारतातील शिक्षक शोधा. संभाषण सुरू करण्यासाठी कनेक्ट विनंती पाठवा.", "Bengali": "বিষয়, শ্রেণী, স্কুল বা এলাকা অনুসারে ভারত জুড়ে শিক্ষকদের খুঁজুন। কথোপকথন শুরু করতে কানেক্ট অনুরোধ পাঠান।", "Gujarati": "વિષય, ધોરણ, શાળા અથવા વિસ્તાર પ્રમાણે ભારતભરના શિક્ષકોને શોધો. વાતચીત શરૂ કરવા માટે કનેક્ટ વિનંતી મોકલો.", "Punjabi": "ਵਿਸ਼ੇ, ਜਮਾਤ, ਸਕੂਲ ਜਾਂ ਖੇਤਰ ਅਨੁਸਾਰ ਭਾਰਤ ਭਰ ਦੇ ਅਧਿਆਪਕਾਂ ਨੂੰ ਖੋਜੋ। ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਕਨੈਕਟ ਬੇਨਤੀ ਭੇਜੋ।", "Malayalam": "വിഷയം, ക്ലാസ്, സ്കൂൾ അല്ലെങ്കിൽ പ്രദേശം എന്നിവ പ്രകാരം ഭാരതത്തിലുടനീളമുള്ള അധ്യാപകരെ തിരയുക. സംഭാഷണം ആരംഭിക്കാൻ കണക്റ്റ് അഭ്യർത്ഥന അയക്കുക.", "Odia": "ବିଷୟ, ଶ୍ରେଣୀ, ସ୍କୁଲ କିମ୍ବା ଅଞ୍ଚଳ ଅନୁଯାୟୀ ଭାରତର ସମସ୍ତ ଶିକ୍ଷକଙ୍କୁ ଖୋଜନ୍ତୁ। କଥୋପକଥନ ଆରମ୍ଭ କରିବାକୁ କନେକ୍ଟ ଅନୁରୋଧ ପଠାନ୍ତୁ।"
    },
    "Search teachers…": {
        "English": "Search teachers…", "Hindi": "शिक्षकों को खोजें…", "Kannada": "ಶಿಕ್ಷಕರನ್ನು ಹುಡುಕಿ…", "Tamil": "ஆசிரியர்களைத் தேடுங்கள்…", "Telugu": "ఉపాధ్యాయులను శోధించండి…", "Marathi": "शिक्षक शोधा…", "Bengali": "শিক্ষকদের খুঁজুন…", "Gujarati": "શિક્ષકોને શોધો…", "Punjabi": "ਅਧਿਆਪਕਾਂ ਨੂੰ ਖੋਜੋ…", "Malayalam": "അധ്യാപകരെ തിരയുക…", "Odia": "ଶିକ୍ଷକଙ୍କୁ ଖୋଜନ୍ତୁ…"
    },
    "Search topics, chapters, concepts…": {
        "English": "Search topics, chapters, concepts…", "Hindi": "विषय, अध्याय, अवधारणाएँ खोजें…", "Kannada": "ವಿಷಯಗಳು, ಅಧ್ಯಾಯಗಳು, ಪರಿಕಲ್ಪನೆಗಳನ್ನು ಹುಡುಕಿ…", "Tamil": "தலைப்புகள், அத்தியாயங்கள், கருத்துகளைத் தேடுங்கள்…", "Telugu": "అంశాలు, అధ్యాయాలు, భావనలను శోధించండి…", "Marathi": "विषय, धडे, संकल्पना शोधा…", "Bengali": "বিষয়, অধ্যায়, ধারণা খুঁজুন…", "Gujarati": "વિષયો, પ્રકરણો, ખ્યાલો શોધો…", "Punjabi": "ਵਿਸ਼ੇ, ਅਧਿਆਏ, ਸੰਕਲਪ ਖੋਜੋ…", "Malayalam": "വിഷയങ്ങൾ, അധ്യായങ്ങൾ, ആശയങ്ങൾ തിരയുക…", "Odia": "ବିଷୟ, ଅଧ୍ୟାୟ, ଧାରଣା ଖୋଜନ୍ତୁ…"
    },
    "Search your library": {
        "English": "Search your library", "Hindi": "अपनी लाइब्रेरी खोजें", "Kannada": "ನಿಮ್ಮ ಗ್ರಂಥಾಲಯವನ್ನು ಹುಡುಕಿ", "Tamil": "உங்கள் நூலகத்தைத் தேடுங்கள்", "Telugu": "మీ లైబ్రరీని శోధించండి", "Marathi": "तुमची लायब्ररी शोधा", "Bengali": "আপনার লাইব্রেরি খুঁজুন", "Gujarati": "તમારી લાઇબ્રેરી શોધો", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਖੋਜੋ", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി തിരയുക", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଖୋଜନ୍ତୁ"
    },
    "Search your library...": {
        "English": "Search your library...", "Hindi": "अपनी लाइब्रेरी खोजें...", "Kannada": "ನಿಮ್ಮ ಗ್ರಂಥಾಲಯವನ್ನು ಹುಡುಕಿ...", "Tamil": "உங்கள் நூலகத்தைத் தேடுங்கள்...", "Telugu": "మీ లైబ్రరీని శోధించండి...", "Marathi": "तुमची लायब्ररी शोधा...", "Bengali": "আপনার লাইব্রেরি খুঁজুন...", "Gujarati": "તમારી લાઇબ્રેરી શોધો...", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਖੋਜੋ...", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി തിരയുക...", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଖୋଜନ୍ତୁ..."
    },
    "See you again soon!": {
        "English": "See you again soon!", "Hindi": "जल्द ही फिर मिलेंगे!", "Kannada": "ಶೀಘ್ರದಲ್ಲೇ ಮತ್ತೆ ಭೇಟಿಯಾಗೋಣ!", "Tamil": "விரைவில் மீண்டும் சந்திப்போம்!", "Telugu": "త్వరలో మళ్ళీ కలుద్దాం!", "Marathi": "लवकरच पुन्हा भेटू!", "Bengali": "শীঘ্রই আবার দেখা হবে!", "Gujarati": "જલ્દી ફરી મળીશું!", "Punjabi": "ਜਲਦੀ ਫਿਰ ਮਿਲਾਂਗੇ!", "Malayalam": "ഉടൻ വീണ്ടും കാണാം!", "Odia": "ଶୀଘ୍ର ପୁଣି ଭେଟିବା!"
    },
    "Select": {
        "English": "Select", "Hindi": "चुनें", "Kannada": "ಆಯ್ಕೆಮಾಡಿ", "Tamil": "தேர்ந்தெடு", "Telugu": "ఎంచుకోండి", "Marathi": "निवडा", "Bengali": "নির্বাচন করুন", "Gujarati": "પસંદ કરો", "Punjabi": "ਚੁਣੋ", "Malayalam": "തിരഞ്ഞെടുക്കുക", "Odia": "ବାଛନ୍ତୁ"
    },
    "Select a class above to link an NCERT chapter.": {
        "English": "Select a class above to link an NCERT chapter.", "Hindi": "NCERT अध्याय जोड़ने के लिए ऊपर एक कक्षा चुनें।", "Kannada": "NCERT ಅಧ್ಯಾಯವನ್ನು ಲಿಂಕ್ ಮಾಡಲು ಮೇಲೆ ಒಂದು ತರಗತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.", "Tamil": "NCERT அத்தியாயத்தை இணைக்க மேலே ஒரு வகுப்பைத் தேர்ந்தெடுக்கவும்.", "Telugu": "NCERT అధ్యాయాన్ని లింక్ చేయడానికి పైన ఒక తరగతిని ఎంచుకోండి.", "Marathi": "NCERT धडा जोडण्यासाठी वर एक इयत्ता निवडा.", "Bengali": "NCERT অধ্যায় লিঙ্ক করতে উপরে একটি শ্রেণী নির্বাচন করুন।", "Gujarati": "NCERT પ્રકરણ લિંક કરવા માટે ઉપર એક ધોરણ પસંદ કરો.", "Punjabi": "NCERT ਅਧਿਆਏ ਲਿੰਕ ਕਰਨ ਲਈ ਉੱਪਰ ਇੱਕ ਜਮਾਤ ਚੁਣੋ।", "Malayalam": "NCERT അധ്യായം ലിങ്ക് ചെയ്യാൻ മുകളിൽ ഒരു ക്ലാസ് തിരഞ്ഞെടുക്കുക.", "Odia": "NCERT ଅଧ୍ୟାୟ ଲିଙ୍କ କରିବାକୁ ଉପରେ ଗୋଟିଏ ଶ୍ରେଣୀ ବାଛନ୍ତୁ।"
    },
    "Select a group": {
        "English": "Select a group", "Hindi": "एक समूह चुनें", "Kannada": "ಗುಂಪನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "ஒரு குழுவைத் தேர்ந்தெடு", "Telugu": "ఒక గ్రూపును ఎంచుకోండి", "Marathi": "गट निवडा", "Bengali": "একটি গোষ্ঠী নির্বাচন করুন", "Gujarati": "જૂથ પસંદ કરો", "Punjabi": "ਇੱਕ ਸਮੂਹ ਚੁਣੋ", "Malayalam": "ഒരു ഗ്രൂപ്പ് തിരഞ്ഞെടുക്കുക", "Odia": "ଗୋଟିଏ ଗୋଷ୍ଠୀ ବାଛନ୍ତୁ"
    },
    "Select a language": {
        "English": "Select a language", "Hindi": "एक भाषा चुनें", "Kannada": "ಒಂದು ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "ஒரு மொழியைத் தேர்ந்தெடு", "Telugu": "ఒక భాషను ఎంచుకోండి", "Marathi": "एक भाषा निवडा", "Bengali": "একটি ভাষা নির্বাচন করুন", "Gujarati": "ભાષા પસંદ કરો", "Punjabi": "ਇੱਕ ਭਾਸ਼ਾ ਚੁਣੋ", "Malayalam": "ഒരു ഭാഷ തിരഞ്ഞെടുക്കുക", "Odia": "ଗୋଟିଏ ଭାଷା ବାଛନ୍ତୁ"
    },
    "Select difficulty": {
        "English": "Select difficulty", "Hindi": "कठिनाई चुनें", "Kannada": "ಕಷ್ಟ ಮಟ್ಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "சிரம நிலையைத் தேர்ந்தெடு", "Telugu": "కష్టతరాన్ని ఎంచుకోండి", "Marathi": "अडचण निवडा", "Bengali": "কঠিনতা নির্বাচন করুন", "Gujarati": "મુશ્કેલી પસંદ કરો", "Punjabi": "ਮੁਸ਼ਕਲ ਚੁਣੋ", "Malayalam": "ബുദ്ധിമുട്ട് തിരഞ്ഞെടുക്കുക", "Odia": "କଠିନତା ବାଛନ୍ତୁ"
    },
    "Select reason for outreach:": {
        "English": "Select reason for outreach:", "Hindi": "संपर्क का कारण चुनें:", "Kannada": "ಸಂಪರ್ಕದ ಕಾರಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ:", "Tamil": "தொடர்புக்கான காரணத்தைத் தேர்ந்தெடு:", "Telugu": "సంప్రదింపు కారణాన్ని ఎంచుకోండి:", "Marathi": "संपर्काचे कारण निवडा:", "Bengali": "যোগাযোগের কারণ নির্বাচন করুন:", "Gujarati": "સંપર્કનું કારણ પસંદ કરો:", "Punjabi": "ਸੰਪਰਕ ਦਾ ਕਾਰਨ ਚੁਣੋ:", "Malayalam": "ബന്ധപ്പെടാനുള്ള കാരണം തിരഞ്ഞെടുക്കുക:", "Odia": "ସମ୍ପର୍କର କାରଣ ବାଛନ୍ତୁ:"
    },
    "Select resources": {
        "English": "Select resources", "Hindi": "संसाधन चुनें", "Kannada": "ಸಂಪನ್ಮೂಲಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "வளங்களைத் தேர்ந்தெடு", "Telugu": "వనరులను ఎంచుకోండి", "Marathi": "संसाधने निवडा", "Bengali": "সংস্থান নির্বাচন করুন", "Gujarati": "સંસાધનો પસંદ કરો", "Punjabi": "ਸਰੋਤ ਚੁਣੋ", "Malayalam": "വിഭവങ്ങൾ തിരഞ്ഞെടുക്കുക", "Odia": "ସମ୍ବଳ ବାଛନ୍ତୁ"
    },
    "Select role": {
        "English": "Select role", "Hindi": "भूमिका चुनें", "Kannada": "ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "பங்கைத் தேர்ந்தெடு", "Telugu": "పాత్రను ఎంచుకోండి", "Marathi": "भूमिका निवडा", "Bengali": "ভূমিকা নির্বাচন করুন", "Gujarati": "ભૂમિકા પસંદ કરો", "Punjabi": "ਭੂਮਿਕਾ ਚੁਣੋ", "Malayalam": "റോൾ തിരഞ്ഞെടുക്കുക", "Odia": "ଭୂମିକା ବାଛନ୍ତୁ"
    },
    "Select your classes": {
        "English": "Select your classes", "Hindi": "अपनी कक्षाएँ चुनें", "Kannada": "ನಿಮ್ಮ ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "உங்கள் வகுப்புகளைத் தேர்ந்தெடு", "Telugu": "మీ తరగతులను ఎంచుకోండి", "Marathi": "तुमच्या इयत्ता निवडा", "Bengali": "আপনার শ্রেণী নির্বাচন করুন", "Gujarati": "તમારા ધોરણો પસંદ કરો", "Punjabi": "ਆਪਣੀਆਂ ਜਮਾਤਾਂ ਚੁਣੋ", "Malayalam": "നിങ്ങളുടെ ക്ലാസുകൾ തിരഞ്ഞെടുക്കുക", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀ ବାଛନ୍ତୁ"
    },
    "Select your role at school": {
        "English": "Select your role at school", "Hindi": "स्कूल में अपनी भूमिका चुनें", "Kannada": "ಶಾಲೆಯಲ್ಲಿ ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "பள்ளியில் உங்கள் பங்கைத் தேர்ந்தெடு", "Telugu": "పాఠశాలలో మీ పాత్రను ఎంచుకోండి", "Marathi": "शाळेतील तुमची भूमिका निवडा", "Bengali": "স্কুলে আপনার ভূমিকা নির্বাচন করুন", "Gujarati": "શાળામાં તમારી ભૂમિકા પસંદ કરો", "Punjabi": "ਸਕੂਲ ਵਿੱਚ ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ", "Malayalam": "സ്കൂളിലെ നിങ്ങളുടെ റോൾ തിരഞ്ഞെടുക്കുക", "Odia": "ସ୍କୁଲରେ ଆପଣଙ୍କ ଭୂମିକା ବାଛନ୍ତୁ"
    },
    "Select your subjects": {
        "English": "Select your subjects", "Hindi": "अपने विषय चुनें", "Kannada": "ನಿಮ್ಮ ವಿಷಯಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", "Tamil": "உங்கள் பாடங்களைத் தேர்ந்தெடு", "Telugu": "మీ విషయాలను ఎంచుకోండి", "Marathi": "तुमचे विषय निवडा", "Bengali": "আপনার বিষয় নির্বাচন করুন", "Gujarati": "તમારા વિષયો પસંદ કરો", "Punjabi": "ਆਪਣੇ ਵਿਸ਼ੇ ਚੁਣੋ", "Malayalam": "നിങ്ങളുടെ വിഷയങ്ങൾ തിരഞ്ഞെടുക്കുക", "Odia": "ଆପଣଙ୍କ ବିଷୟ ବାଛନ୍ତୁ"
    },
    "Share your classroom activities, ask questions, or just say hi!": {
        "English": "Share your classroom activities, ask questions, or just say hi!", "Hindi": "अपनी कक्षा की गतिविधियाँ साझा करें, प्रश्न पूछें, या बस हाय कहें!", "Kannada": "ನಿಮ್ಮ ತರಗತಿ ಚಟುವಟಿಕೆಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ, ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ, ಅಥವಾ ಸುಮ್ಮನೆ ಹಾಯ್ ಹೇಳಿ!", "Tamil": "உங்கள் வகுப்பறை செயல்பாடுகளைப் பகிரவும், கேள்விகள் கேட்கவும், அல்லது வெறுமனே வணக்கம் சொல்லவும்!", "Telugu": "మీ తరగతి గది కార్యకలాపాలను పంచుకోండి, ప్రశ్నలు అడగండి లేదా కేవలం హాయ్ చెప్పండి!", "Marathi": "तुमच्या वर्गातील क्रियाकलाप शेअर करा, प्रश्न विचारा किंवा फक्त हाय म्हणा!", "Bengali": "আপনার ক্লাসরুমের কার্যকলাপ শেয়ার করুন, প্রশ্ন জিজ্ঞাসা করুন, বা শুধু হাই বলুন!", "Gujarati": "તમારી વર્ગખંડ પ્રવૃત્તિઓ શેર કરો, પ્રશ્નો પૂછો અથવા ફક્ત હાય કહો!", "Punjabi": "ਆਪਣੀਆਂ ਕਲਾਸਰੂਮ ਗਤੀਵਿਧੀਆਂ ਸਾਂਝੀਆਂ ਕਰੋ, ਸਵਾਲ ਪੁੱਛੋ ਜਾਂ ਬਸ ਹਾਏ ਕਹੋ!", "Malayalam": "നിങ്ങളുടെ ക്ലാസ്റൂം പ്രവർത്തനങ്ങൾ പങ്കിടുക, ചോദ്യങ്ങൾ ചോദിക്കുക, അല്ലെങ്കിൽ വെറുതെ ഹായ് പറയുക!", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀକକ୍ଷ କାର୍ଯ୍ୟକଳାପ ଅଂଶୀଦାର କରନ୍ତୁ, ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ, କିମ୍ବା କେବଳ ହାଏ କୁହନ୍ତୁ!"
    },
    "Share your first post above to start the conversation.": {
        "English": "Share your first post above to start the conversation.", "Hindi": "बातचीत शुरू करने के लिए ऊपर अपनी पहली पोस्ट साझा करें।", "Kannada": "ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಮೇಲೆ ನಿಮ್ಮ ಮೊದಲ ಪೋಸ್ಟ್ ಹಂಚಿಕೊಳ್ಳಿ.", "Tamil": "உரையாடலைத் தொடங்க மேலே உங்கள் முதல் இடுகையைப் பகிரவும்.", "Telugu": "సంభాషణను ప్రారంభించడానికి పైన మీ మొదటి పోస్ట్‌ను పంచుకోండి.", "Marathi": "संभाषण सुरू करण्यासाठी वर तुमची पहिली पोस्ट शेअर करा.", "Bengali": "কথোপকথন শুরু করতে উপরে আপনার প্রথম পোস্ট শেয়ার করুন।", "Gujarati": "વાતચીત શરૂ કરવા માટે ઉપર તમારી પ્રથમ પોસ્ટ શેર કરો.", "Punjabi": "ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਉੱਪਰ ਆਪਣੀ ਪਹਿਲੀ ਪੋਸਟ ਸਾਂਝੀ ਕਰੋ।", "Malayalam": "സംഭാഷണം ആരംഭിക്കാൻ മുകളിൽ നിങ്ങളുടെ ആദ്യ പോസ്റ്റ് പങ്കിടുക.", "Odia": "କଥୋପକଥନ ଆରମ୍ଭ କରିବାକୁ ଉପରେ ଆପଣଙ୍କ ପ୍ରଥମ ପୋଷ୍ଟ ଅଂଶୀଦାର କରନ୍ତୁ।"
    },
    "Share, learn, and grow with teachers across Bharat": {
        "English": "Share, learn, and grow with teachers across Bharat", "Hindi": "पूरे भारत के शिक्षकों के साथ साझा करें, सीखें और बढ़ें", "Kannada": "ಭಾರತದಾದ್ಯಂತದ ಶಿಕ್ಷಕರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ, ಕಲಿಯಿರಿ ಮತ್ತು ಬೆಳೆಯಿರಿ", "Tamil": "பாரதம் முழுவதும் உள்ள ஆசிரியர்களுடன் பகிரவும், கற்கவும், வளரவும்", "Telugu": "భారతదేశం అంతటా ఉపాధ్యాయులతో పంచుకోండి, నేర్చుకోండి మరియు ఎదగండి", "Marathi": "संपूर्ण भारतातील शिक्षकांसोबत शेअर करा, शिका आणि वाढा", "Bengali": "ভারত জুড়ে শিক্ষকদের সাথে শেয়ার করুন, শিখুন এবং বেড়ে উঠুন", "Gujarati": "ભારતભરના શિક્ષકો સાથે શેર કરો, શીખો અને વિકસો", "Punjabi": "ਭਾਰਤ ਭਰ ਦੇ ਅਧਿਆਪਕਾਂ ਨਾਲ ਸਾਂਝਾ ਕਰੋ, ਸਿੱਖੋ ਅਤੇ ਵਧੋ", "Malayalam": "ഭാരതത്തിലുടനീളമുള്ള അധ്യാപകരുമായി പങ്കിടുക, പഠിക്കുക, വളരുക", "Odia": "ଭାରତର ସମସ୍ତ ଶିକ୍ଷକଙ୍କ ସହ ଅଂଶୀଦାର କରନ୍ତୁ, ଶିଖନ୍ତୁ ଏବଂ ବଢ଼ନ୍ତୁ"
    },
    "Shared Resources": {
        "English": "Shared Resources", "Hindi": "साझा संसाधन", "Kannada": "ಹಂಚಿಕೊಂಡ ಸಂಪನ್ಮೂಲಗಳು", "Tamil": "பகிரப்பட்ட வளங்கள்", "Telugu": "షేర్ చేసిన వనరులు", "Marathi": "शेअर केलेली संसाधने", "Bengali": "শেয়ার করা সংস্থান", "Gujarati": "શેર કરેલા સંસાધનો", "Punjabi": "ਸਾਂਝੇ ਸਰੋਤ", "Malayalam": "പങ്കിട്ട വിഭവങ്ങൾ", "Odia": "ଅଂଶୀଦାର ସମ୍ବଳ"
    },
    "Showing curated content": {
        "English": "Showing curated content", "Hindi": "क्यूरेटेड सामग्री दिखाई जा रही है", "Kannada": "ಆಯ್ದ ವಿಷಯವನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ", "Tamil": "தேர்வு செய்யப்பட்ட உள்ளடக்கம் காட்டப்படுகிறது", "Telugu": "క్యూరేట్ చేసిన కంటెంట్‌ను చూపుతోంది", "Marathi": "निवडक सामग्री दाखवत आहे", "Bengali": "কিউরেটেড কন্টেন্ট দেখানো হচ্ছে", "Gujarati": "ક્યુરેટેડ સામગ્રી બતાવી રહ્યું છે", "Punjabi": "ਚੁਣੀ ਹੋਈ ਸਮੱਗਰੀ ਦਿਖਾ ਰਿਹਾ ਹੈ", "Malayalam": "തിരഞ്ഞെടുത്ത ഉള്ളടക്കം കാണിക്കുന്നു", "Odia": "ବାଛିତ ବିଷୟବସ୍ତୁ ଦେଖାଯାଉଛି"
    },
    "Showing last good values": {
        "English": "Showing last good values", "Hindi": "अंतिम सही मान दिखाए जा रहे हैं", "Kannada": "ಕೊನೆಯ ಸರಿಯಾದ ಮೌಲ್ಯಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ", "Tamil": "கடைசி சரியான மதிப்புகள் காட்டப்படுகின்றன", "Telugu": "చివరి మంచి విలువలను చూపుతోంది", "Marathi": "शेवटची चांगली मूल्ये दाखवत आहे", "Bengali": "শেষ ভালো মান দেখানো হচ্ছে", "Gujarati": "છેલ્લા સારા મૂલ્યો બતાવી રહ્યું છે", "Punjabi": "ਆਖਰੀ ਵਧੀਆ ਮੁੱਲ ਦਿਖਾ ਰਿਹਾ ਹੈ", "Malayalam": "അവസാന നല്ല മൂല്യങ്ങൾ കാണിക്കുന്നു", "Odia": "ଶେଷ ଭଲ ମୂଲ୍ୟ ଦେଖାଯାଉଛି"
    },
    "Sidebar": {
        "English": "Sidebar", "Hindi": "साइडबार", "Kannada": "ಸೈಡ್‌ಬಾರ್", "Tamil": "பக்கப்பட்டி", "Telugu": "సైడ్‌బార్", "Marathi": "साइडबार", "Bengali": "সাইডবার", "Gujarati": "સાઇડબાર", "Punjabi": "ਸਾਈਡਬਾਰ", "Malayalam": "സൈഡ്ബാർ", "Odia": "ସାଇଡବାର"
    },
    "Sign in to acknowledge these commitments.": {
        "English": "Sign in to acknowledge these commitments.", "Hindi": "इन प्रतिबद्धताओं को स्वीकार करने के लिए साइन इन करें।", "Kannada": "ಈ ಬದ್ಧತೆಗಳನ್ನು ಒಪ್ಪಿಕೊಳ್ಳಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "இந்த உறுதிமொழிகளை ஒப்புக்கொள்ள உள்நுழையவும்.", "Telugu": "ఈ నిబద్ధతలను అంగీకరించడానికి సైన్ ఇన్ చేయండి.", "Marathi": "या वचनबद्धता मान्य करण्यासाठी साइन इन करा.", "Bengali": "এই প্রতিশ্রুতিগুলি স্বীকার করতে সাইন ইন করুন।", "Gujarati": "આ પ્રતિબદ્ધતાઓ સ્વીકારવા માટે સાઇન ઇન કરો.", "Punjabi": "ਇਹਨਾਂ ਵਚਨਬੱਧਤਾਵਾਂ ਨੂੰ ਸਵੀਕਾਰ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "ഈ പ്രതിബദ്ധതകൾ അംഗീകരിക്കാൻ സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ଏହି ପ୍ରତିବଦ୍ଧତାଗୁଡ଼ିକୁ ସ୍ୱୀକାର କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Sign in to like resources": {
        "English": "Sign in to like resources", "Hindi": "संसाधनों को लाइक करने के लिए साइन इन करें", "Kannada": "ಸಂಪನ್ಮೂಲಗಳನ್ನು ಲೈಕ್ ಮಾಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "வளங்களை விரும்ப உள்நுழையவும்", "Telugu": "వనరులను లైక్ చేయడానికి సైన్ ఇన్ చేయండి", "Marathi": "संसाधने आवडण्यासाठी साइन इन करा", "Bengali": "সংস্থান লাইক করতে সাইন ইন করুন", "Gujarati": "સંસાધનો લાઇક કરવા માટે સાઇન ઇન કરો", "Punjabi": "ਸਰੋਤਾਂ ਨੂੰ ਪਸੰਦ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "വിഭവങ്ങൾ ലൈക്ക് ചെയ്യാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ସମ୍ବଳଗୁଡ଼ିକୁ ଲାଇକ୍ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to participate in community chat.": {
        "English": "Sign in to participate in community chat.", "Hindi": "समुदाय चैट में भाग लेने के लिए साइन इन करें।", "Kannada": "ಸಮುದಾಯ ಚಾಟ್‌ನಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "சமூக அரட்டையில் பங்கேற்க உள்நுழையவும்.", "Telugu": "కమ్యూనిటీ చాట్‌లో పాల్గొనడానికి సైన్ ఇన్ చేయండి.", "Marathi": "समुदाय चॅटमध्ये सहभागी होण्यासाठी साइन इन करा.", "Bengali": "কমিউনিটি চ্যাটে অংশগ্রহণ করতে সাইন ইন করুন।", "Gujarati": "સમુદાય ચેટમાં ભાગ લેવા માટે સાઇન ઇન કરો.", "Punjabi": "ਕਮਿਊਨਿਟੀ ਚੈਟ ਵਿੱਚ ਹਿੱਸਾ ਲੈਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "കമ്മ്യൂണിറ്റി ചാറ്റിൽ പങ്കെടുക്കാൻ സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ସମୁଦାୟ ଚାଟରେ ଅଂଶଗ୍ରହଣ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Sign in to save resources": {
        "English": "Sign in to save resources", "Hindi": "संसाधन सहेजने के लिए साइन इन करें", "Kannada": "ಸಂಪನ್ಮೂಲಗಳನ್ನು ಉಳಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "வளங்களைச் சேமிக்க உள்நுழையவும்", "Telugu": "వనరులను సేవ్ చేయడానికి సైన్ ఇన్ చేయండి", "Marathi": "संसाधने जतन करण्यासाठी साइन इन करा", "Bengali": "সংস্থান সংরক্ষণ করতে সাইন ইন করুন", "Gujarati": "સંસાધનો સાચવવા માટે સાઇન ઇન કરો", "Punjabi": "ਸਰੋਤਾਂ ਨੂੰ ਸੰਭਾਲਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "വിഭവങ്ങൾ സംരക്ഷിക്കാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ସମ୍ବଳ ସେଭ୍ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to see your impact": {
        "English": "Sign in to see your impact", "Hindi": "अपना प्रभाव देखने के लिए साइन इन करें", "Kannada": "ನಿಮ್ಮ ಪ್ರಭಾವವನ್ನು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "உங்கள் தாக்கத்தைக் காண உள்நுழையவும்", "Telugu": "మీ ప్రభావాన్ని చూడటానికి సైన్ ఇన్ చేయండి", "Marathi": "तुमचा प्रभाव पाहण्यासाठी साइन इन करा", "Bengali": "আপনার প্রভাব দেখতে সাইন ইন করুন", "Gujarati": "તમારી અસર જોવા માટે સાઇન ઇન કરો", "Punjabi": "ਆਪਣਾ ਪ੍ਰਭਾਵ ਦੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ സ്വാധീനം കാണാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ପ୍ରଭାବ ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign in to share": {
        "English": "Sign in to share", "Hindi": "साझा करने के लिए साइन इन करें", "Kannada": "ಹಂಚಿಕೊಳ್ಳಲು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "பகிர உள்நுழையவும்", "Telugu": "షేర్ చేయడానికి సైన్ ఇన్ చేయండి", "Marathi": "शेअर करण्यासाठी साइन इन करा", "Bengali": "শেয়ার করতে সাইন ইন করুন", "Gujarati": "શેર કરવા માટે સાઇન ઇન કરો", "Punjabi": "ਸਾਂਝਾ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "പങ്കിടാൻ സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଅଂଶୀଦାର କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Sign out": {
        "English": "Sign out", "Hindi": "साइन आउट", "Kannada": "ಸೈನ್ ಔಟ್", "Tamil": "வெளியேறு", "Telugu": "సైన్ అవుట్", "Marathi": "साइन आउट", "Bengali": "সাইন আউট", "Gujarati": "સાઇન આઉટ", "Punjabi": "ਸਾਈਨ ਆਉਟ", "Malayalam": "സൈൻ ഔട്ട്", "Odia": "ସାଇନ୍ ଆଉଟ୍"
    },
    "Sign-in failed": {
        "English": "Sign-in failed", "Hindi": "साइन-इन विफल", "Kannada": "ಸೈನ್-ಇನ್ ವಿಫಲವಾಗಿದೆ", "Tamil": "உள்நுழைவு தோல்வியடைந்தது", "Telugu": "సైన్-ఇన్ విఫలమైంది", "Marathi": "साइन-इन अयशस्वी", "Bengali": "সাইন-ইন ব্যর্থ", "Gujarati": "સાઇન-ઇન નિષ્ફળ", "Punjabi": "ਸਾਈਨ-ਇਨ ਅਸਫਲ", "Malayalam": "സൈൻ-ഇൻ പരാജയപ്പെട്ടു", "Odia": "ସାଇନ୍-ଇନ୍ ବିଫଳ"
    },
    "Signed Out": {
        "English": "Signed Out", "Hindi": "साइन आउट हो गए", "Kannada": "ಸೈನ್ ಔಟ್ ಆಗಿದೆ", "Tamil": "வெளியேறப்பட்டது", "Telugu": "సైన్ అవుట్ అయ్యారు", "Marathi": "साइन आउट केले", "Bengali": "সাইন আউট হয়েছে", "Gujarati": "સાઇન આઉટ થયા", "Punjabi": "ਸਾਈਨ ਆਉਟ ਹੋ ਗਏ", "Malayalam": "സൈൻ ഔട്ട് ചെയ്തു", "Odia": "ସାଇନ୍ ଆଉଟ୍ ହୋଇଗଲା"
    },
    "Something went wrong": {
        "English": "Something went wrong", "Hindi": "कुछ गलत हो गया", "Kannada": "ಏನೋ ತಪ್ಪಾಗಿದೆ", "Tamil": "ஏதோ தவறு ஏற்பட்டது", "Telugu": "ఏదో తప్పు జరిగింది", "Marathi": "काहीतरी चूक झाली", "Bengali": "কিছু ভুল হয়েছে", "Gujarati": "કંઈક ખોટું થયું", "Punjabi": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ", "Malayalam": "എന്തോ തെറ്റ് സംഭവിച്ചു", "Odia": "କିଛି ଭୁଲ ହୋଇଛି"
    },
    "Something went wrong recording your acceptance. Please try again.": {
        "English": "Something went wrong recording your acceptance. Please try again.", "Hindi": "आपकी स्वीकृति दर्ज करने में कुछ गलत हो गया। कृपया पुनः प्रयास करें।", "Kannada": "ನಿಮ್ಮ ಸ್ವೀಕಾರವನ್ನು ದಾಖಲಿಸುವಲ್ಲಿ ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "உங்கள் ஒப்புதலைப் பதிவு செய்வதில் ஏதோ தவறு ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "మీ అంగీకారాన్ని నమోదు చేయడంలో ఏదో తప్పు జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.", "Marathi": "तुमची स्वीकृती नोंदवताना काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "আপনার সম্মতি রেকর্ড করতে কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "તમારી સ્વીકૃતિ નોંધવામાં કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਤੁਹਾਡੀ ਸਵੀਕ੍ਰਿਤੀ ਦਰਜ ਕਰਨ ਵਿੱਚ ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ സമ്മതം രേഖപ്പെടുത്തുന്നതിൽ എന്തോ തെറ്റ് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଆପଣଙ୍କ ସ୍ୱୀକୃତି ରେକର୍ଡ କରିବାରେ କିଛି ଭୁଲ ହୋଇଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Something went wrong!": {
        "English": "Something went wrong!", "Hindi": "कुछ गलत हो गया!", "Kannada": "ಏನೋ ತಪ್ಪಾಗಿದೆ!", "Tamil": "ஏதோ தவறு ஏற்பட்டது!", "Telugu": "ఏదో తప్పు జరిగింది!", "Marathi": "काहीतरी चूक झाली!", "Bengali": "কিছু ভুল হয়েছে!", "Gujarati": "કંઈક ખોટું થયું!", "Punjabi": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ!", "Malayalam": "എന്തോ തെറ്റ് സംഭവിച്ചു!", "Odia": "କିଛି ଭୁଲ ହୋଇଛି!"
    },
    "Starting…": {
        "English": "Starting…", "Hindi": "शुरू हो रहा है…", "Kannada": "ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ…", "Tamil": "தொடங்குகிறது…", "Telugu": "ప్రారంభమవుతోంది…", "Marathi": "सुरू होत आहे…", "Bengali": "শুরু হচ্ছে…", "Gujarati": "શરૂ થઈ રહ્યું છે…", "Punjabi": "ਸ਼ੁਰੂ ਹੋ ਰਿਹਾ ਹੈ…", "Malayalam": "ആരംഭിക്കുന്നു…", "Odia": "ଆରମ୍ଭ ହେଉଛି…"
    },
    "Students Impacted": {
        "English": "Students Impacted", "Hindi": "प्रभावित विद्यार्थी", "Kannada": "ಪ್ರಭಾವಿತ ವಿದ್ಯಾರ್ಥಿಗಳು", "Tamil": "பாதிக்கப்பட்ட மாணவர்கள்", "Telugu": "ప్రభావితమైన విద్యార్థులు", "Marathi": "प्रभावित विद्यार्थी", "Bengali": "প্রভাবিত শিক্ষার্থী", "Gujarati": "પ્રભાવિત વિદ્યાર્થીઓ", "Punjabi": "ਪ੍ਰਭਾਵਿਤ ਵਿਦਿਆਰਥੀ", "Malayalam": "സ്വാധീനിച്ച വിദ്യാർത്ഥികൾ", "Odia": "ପ୍ରଭାବିତ ଛାତ୍ର"
    },
    "Subject:": {
        "English": "Subject:", "Hindi": "विषय:", "Kannada": "ವಿಷಯ:", "Tamil": "பாடம்:", "Telugu": "విషయం:", "Marathi": "विषय:", "Bengali": "বিষয়:", "Gujarati": "વિષય:", "Punjabi": "ਵਿਸ਼ਾ:", "Malayalam": "വിഷയം:", "Odia": "ବିଷୟ:"
    },
    "Submit Feedback": {
        "English": "Submit Feedback", "Hindi": "प्रतिक्रिया भेजें", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಿ", "Tamil": "கருத்தைச் சமர்ப்பி", "Telugu": "ఫీడ్‌బ్యాక్ సమర్పించండి", "Marathi": "अभिप्राय सबमिट करा", "Bengali": "মতামত জমা দিন", "Gujarati": "પ્રતિસાદ સબમિટ કરો", "Punjabi": "ਫੀਡਬੈਕ ਜਮ੍ਹਾਂ ਕਰੋ", "Malayalam": "ഫീഡ്‌ബാക്ക് സമർപ്പിക്കുക", "Odia": "ମତାମତ ଦାଖଲ କରନ୍ତୁ"
    },
    "Submitting...": {
        "English": "Submitting...", "Hindi": "जमा हो रहा है...", "Kannada": "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...", "Tamil": "சமர்ப்பிக்கப்படுகிறது...", "Telugu": "సమర్పిస్తోంది...", "Marathi": "सबमिट करत आहे...", "Bengali": "জমা দেওয়া হচ্ছে...", "Gujarati": "સબમિટ થઈ રહ્યું છે...", "Punjabi": "ਜਮ੍ਹਾਂ ਕਰ ਰਿਹਾ ਹੈ...", "Malayalam": "സമർപ്പിക്കുന്നു...", "Odia": "ଦାଖଲ କରାଯାଉଛି..."
    },
    "Success": {
        "English": "Success", "Hindi": "सफलता", "Kannada": "ಯಶಸ್ಸು", "Tamil": "வெற்றி", "Telugu": "విజయం", "Marathi": "यश", "Bengali": "সফলতা", "Gujarati": "સફળતા", "Punjabi": "ਸਫਲਤਾ", "Malayalam": "വിജയം", "Odia": "ସଫଳତା"
    },
    "Success Rate": {
        "English": "Success Rate", "Hindi": "सफलता दर", "Kannada": "ಯಶಸ್ಸಿನ ದರ", "Tamil": "வெற்றி விகிதம்", "Telugu": "విజయ రేటు", "Marathi": "यशस्वी दर", "Bengali": "সাফল্যের হার", "Gujarati": "સફળતા દર", "Punjabi": "ਸਫਲਤਾ ਦਰ", "Malayalam": "വിജയ നിരക്ക്", "Odia": "ସଫଳତା ହାର"
    },
    "Suggested for You": {
        "English": "Suggested for You", "Hindi": "आपके लिए सुझाव", "Kannada": "ನಿಮಗಾಗಿ ಸಲಹೆ", "Tamil": "உங்களுக்கான பரிந்துரை", "Telugu": "మీ కోసం సూచనలు", "Marathi": "तुमच्यासाठी सुचवलेले", "Bengali": "আপনার জন্য প্রস্তাবিত", "Gujarati": "તમારા માટે સૂચન", "Punjabi": "ਤੁਹਾਡੇ ਲਈ ਸੁਝਾਅ", "Malayalam": "നിങ്ങൾക്കായി നിർദ്ദേശിച്ചത്", "Odia": "ଆପଣଙ୍କ ପାଇଁ ପରାମର୍ଶ"
    },
    "Summary will appear when the call ends": {
        "English": "Summary will appear when the call ends", "Hindi": "कॉल समाप्त होने पर सारांश दिखाई देगा", "Kannada": "ಕರೆ ಮುಗಿದಾಗ ಸಾರಾಂಶ ಕಾಣಿಸುತ್ತದೆ", "Tamil": "அழைப்பு முடிந்ததும் சுருக்கம் தோன்றும்", "Telugu": "కాల్ ముగిసినప్పుడు సారాంశం కనిపిస్తుంది", "Marathi": "कॉल संपल्यावर सारांश दिसेल", "Bengali": "কল শেষ হলে সারসংক্ষেপ দেখা যাবে", "Gujarati": "કોલ સમાપ્ત થયા પછી સારાંશ દેખાશે", "Punjabi": "ਕਾਲ ਖਤਮ ਹੋਣ 'ਤੇ ਸੰਖੇਪ ਦਿਖਾਈ ਦੇਵੇਗਾ", "Malayalam": "കോൾ അവസാനിക്കുമ്പോൾ സംഗ്രഹം ദൃശ്യമാകും", "Odia": "କଲ୍ ଶେଷ ହେଲେ ସାରାଂଶ ଦେଖାଯିବ"
    },
    "Synced to cloud": {
        "English": "Synced to cloud", "Hindi": "क्लाउड पर सिंक हो गया", "Kannada": "ಕ್ಲೌಡ್‌ಗೆ ಸಿಂಕ್ ಆಗಿದೆ", "Tamil": "கிளவுட்டில் ஒத்திசைக்கப்பட்டது", "Telugu": "క్లౌడ్‌కి సింక్ చేయబడింది", "Marathi": "क्लाउडवर सिंक केले", "Bengali": "ক্লাউডে সিঙ্ক হয়েছে", "Gujarati": "ક્લાઉડ પર સિંક થયું", "Punjabi": "ਕਲਾਊਡ 'ਤੇ ਸਿੰਕ ਹੋਇਆ", "Malayalam": "ക്ലൗഡിലേക്ക് സമന്വയിപ്പിച്ചു", "Odia": "କ୍ଲାଉଡ୍‌ରେ ସିଙ୍କ୍ ହୋଇଛି"
    },
    "Tap to cycle:": {
        "English": "Tap to cycle:", "Hindi": "बदलने के लिए टैप करें:", "Kannada": "ಬದಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ:", "Tamil": "மாற்ற தட்டவும்:", "Telugu": "మార్చడానికి ట్యాప్ చేయండి:", "Marathi": "बदलण्यासाठी टॅप करा:", "Bengali": "পরিবর্তন করতে ট্যাপ করুন:", "Gujarati": "બદલવા માટે ટૅપ કરો:", "Punjabi": "ਬਦਲਣ ਲਈ ਟੈਪ ਕਰੋ:", "Malayalam": "മാറ്റാൻ ടാപ്പ് ചെയ്യുക:", "Odia": "ବଦଳାଇବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ:"
    },
    "Tap to reply": {
        "English": "Tap to reply", "Hindi": "जवाब देने के लिए टैप करें", "Kannada": "ಉತ್ತರಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ", "Tamil": "பதிலளிக்க தட்டவும்", "Telugu": "ప్రత్యుత్తరం ఇవ్వడానికి ట్యాప్ చేయండి", "Marathi": "उत्तर देण्यासाठी टॅप करा", "Bengali": "উত্তর দিতে ট্যাপ করুন", "Gujarati": "જવાબ આપવા માટે ટૅપ કરો", "Punjabi": "ਜਵਾਬ ਦੇਣ ਲਈ ਟੈਪ ਕਰੋ", "Malayalam": "മറുപടി നൽകാൻ ടാപ്പ് ചെയ്യുക", "Odia": "ଉତ୍ତର ଦେବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ"
    },
    "Tap to retry": {
        "English": "Tap to retry", "Hindi": "पुनः प्रयास के लिए टैप करें", "Kannada": "ಮರುಪ್ರಯತ್ನಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ", "Tamil": "மீண்டும் முயற்சிக்க தட்டவும்", "Telugu": "మళ్లీ ప్రయత్నించడానికి ట్యాప్ చేయండి", "Marathi": "पुन्हा प्रयत्न करण्यासाठी टॅप करा", "Bengali": "আবার চেষ্টা করতে ট্যাপ করুন", "Gujarati": "ફરી પ્રયાસ કરવા ટૅપ કરો", "Punjabi": "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ", "Malayalam": "വീണ്ടും ശ്രമിക്കാൻ ടാപ്പ് ചെയ്യുക", "Odia": "ପୁନଃଚେଷ୍ଟା କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ"
    },
    "Thank you! Your feedback helps us improve.": {
        "English": "Thank you! Your feedback helps us improve.", "Hindi": "धन्यवाद! आपकी प्रतिक्रिया हमें बेहतर बनाने में मदद करती है।", "Kannada": "ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆ ನಮಗೆ ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.", "Tamil": "நன்றி! உங்கள் கருத்து எங்களை மேம்படுத்த உதவுகிறது.", "Telugu": "ధన్యవాదాలు! మీ అభిప్రాయం మాకు మెరుగుపరచడానికి సహాయపడుతుంది.", "Marathi": "धन्यवाद! तुमचा अभिप्राय आम्हाला सुधारण्यास मदत करतो.", "Bengali": "ধন্যবাদ! আপনার মতামত আমাদের উন্নত করতে সাহায্য করে।", "Gujarati": "આભાર! તમારો પ્રતિસાદ અમને સુધારવામાં મદદ કરે છે.", "Punjabi": "ਧੰਨਵਾਦ! ਤੁਹਾਡੀ ਫੀਡਬੈਕ ਸਾਨੂੰ ਸੁਧਾਰਨ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ।", "Malayalam": "നന്ദി! നിങ്ങളുടെ പ്രതികരണം മെച്ചപ്പെടുത്താൻ സഹായിക്കുന്നു.", "Odia": "ଧନ୍ୟବାଦ! ଆପଣଙ୍କ ମତାମତ ଆମକୁ ଉନ୍ନତ କରିବାରେ ସାହାଯ୍ୟ କରେ।"
    },
    "The AI does": {
        "English": "The AI does", "Hindi": "AI करता है", "Kannada": "AI ಮಾಡುತ್ತದೆ", "Tamil": "AI செய்கிறது", "Telugu": "AI చేస్తుంది", "Marathi": "AI करते", "Bengali": "AI করে", "Gujarati": "AI કરે છે", "Punjabi": "AI ਕਰਦਾ ਹੈ", "Malayalam": "AI ചെയ്യുന്നു", "Odia": "AI କରେ"
    },
    "This feature is coming soon. Generate beautiful visual aids from a simple description!": {
        "English": "This feature is coming soon. Generate beautiful visual aids from a simple description!", "Hindi": "यह सुविधा जल्द आ रही है। एक सरल विवरण से सुंदर दृश्य सामग्री बनाएँ!", "Kannada": "ಈ ವೈಶಿಷ್ಟ್ಯ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ. ಸರಳ ವಿವರಣೆಯಿಂದ ಸುಂದರ ದೃಶ್ಯ ಸಾಧನಗಳನ್ನು ರಚಿಸಿ!", "Tamil": "இந்த அம்சம் விரைவில் வரும். ஒரு எளிய விளக்கத்திலிருந்து அழகான காட்சி உதவிகளை உருவாக்குங்கள்!", "Telugu": "ఈ ఫీచర్ త్వరలో వస్తోంది. సాధారణ వివరణ నుండి అందమైన దృశ్య సహాయాలను రూపొందించండి!", "Marathi": "हे वैशिष्ट्य लवकरच येत आहे. साध्या वर्णनातून सुंदर दृश्य साधने तयार करा!", "Bengali": "এই ফিচার শীঘ্রই আসছে। সহজ বিবরণ থেকে সুন্দর ভিজ্যুয়াল এইড তৈরি করুন!", "Gujarati": "આ સુવિધા જલ્દી આવી રહી છે. સરળ વર્ણનમાંથી સુંદર દ્રશ્ય સહાય બનાવો!", "Punjabi": "ਇਹ ਸੁਵਿਧਾ ਜਲਦੀ ਆ ਰਹੀ ਹੈ। ਸਧਾਰਨ ਵਰਣਨ ਤੋਂ ਸੁੰਦਰ ਵਿਜ਼ੂਅਲ ਏਡਜ਼ ਬਣਾਓ!", "Malayalam": "ഈ ഫീച്ചർ ഉടൻ വരുന്നു. ലളിതമായ വിവരണത്തിൽ നിന്ന് മനോഹരമായ വിഷ്വൽ എയ്ഡ്സ് സൃഷ്ടിക്കുക!", "Odia": "ଏହି ବୈଶିଷ୍ଟ୍ୟ ଶୀଘ୍ର ଆସୁଛି। ସରଳ ବର୍ଣ୍ଣନାରୁ ସୁନ୍ଦର ଭିଜୁଆଲ୍ ଏଡ୍ ତିଆରି କରନ୍ତୁ!"
    },
    "Toggle Sidebar": {
        "English": "Toggle Sidebar", "Hindi": "साइडबार टॉगल करें", "Kannada": "ಸೈಡ್‌ಬಾರ್ ಟಾಗಲ್ ಮಾಡಿ", "Tamil": "பக்கப்பட்டியை மாற்று", "Telugu": "సైడ్‌బార్ టోగుల్ చేయండి", "Marathi": "साइडबार टॉगल करा", "Bengali": "সাইডবার টগল করুন", "Gujarati": "સાઇડબાર ટૉગલ કરો", "Punjabi": "ਸਾਈਡਬਾਰ ਟੌਗਲ ਕਰੋ", "Malayalam": "സൈഡ്ബാർ ടോഗിൾ ചെയ്യുക", "Odia": "ସାଇଡବାର୍ ଟୋଗଲ୍ କରନ୍ତୁ"
    },
    "Trending": {
        "English": "Trending", "Hindi": "ट्रेंडिंग", "Kannada": "ಟ್ರೆಂಡಿಂಗ್", "Tamil": "டிரெண்டிங்", "Telugu": "ట్రెండింగ్", "Marathi": "ट्रेंडिंग", "Bengali": "ট্রেন্ডিং", "Gujarati": "ટ્રેન્ડિંગ", "Punjabi": "ਟ੍ਰੈਂਡਿੰਗ", "Malayalam": "ട്രെൻഡിംഗ്", "Odia": "ଟ୍ରେଣ୍ଡିଂ"
    },
    "Try Again": {
        "English": "Try Again", "Hindi": "पुनः प्रयास करें", "Kannada": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "Tamil": "மீண்டும் முயற்சிக்கவும்", "Telugu": "మళ్లీ ప్రయత్నించండి", "Marathi": "पुन्हा प्रयत्न करा", "Bengali": "আবার চেষ্টা করুন", "Gujarati": "ફરી પ્રયાસ કરો", "Punjabi": "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ", "Malayalam": "വീണ്ടും ശ്രമിക്കുക", "Odia": "ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ"
    },
    "Try again": {
        "English": "Try again", "Hindi": "पुनः प्रयास करें", "Kannada": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "Tamil": "மீண்டும் முயற்சிக்கவும்", "Telugu": "మళ్లీ ప్రయత్నించండి", "Marathi": "पुन्हा प्रयत्न करा", "Bengali": "আবার চেষ্টা করুন", "Gujarati": "ફરી પ્રયાસ કરો", "Punjabi": "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ", "Malayalam": "വീണ്ടും ശ്രമിക്കുക", "Odia": "ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ"
    },
    "Try rephrasing your question.": {
        "English": "Try rephrasing your question.", "Hindi": "अपना प्रश्न दूसरे शब्दों में पूछें।", "Kannada": "ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಬೇರೆ ರೀತಿಯಲ್ಲಿ ಕೇಳಿ.", "Tamil": "உங்கள் கேள்வியை வேறு வார்த்தைகளில் கேளுங்கள்.", "Telugu": "మీ ప్రశ్నను వేరే విధంగా అడగండి.", "Marathi": "तुमचा प्रश्न वेगळ्या शब्दांत विचारा.", "Bengali": "আপনার প্রশ্নটি অন্যভাবে জিজ্ঞাসা করুন।", "Gujarati": "તમારો પ્રશ્ન અલગ રીતે પૂછો.", "Punjabi": "ਆਪਣਾ ਸਵਾਲ ਵੱਖਰੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਪੁੱਛੋ।", "Malayalam": "നിങ്ങളുടെ ചോദ്യം മറ്റൊരു രീതിയിൽ ചോദിക്കുക.", "Odia": "ଆପଣଙ୍କ ପ୍ରଶ୍ନକୁ ଅନ୍ୟ ପ୍ରକାରେ ପଚାରନ୍ତୁ।"
    },
    "Type:": {
        "English": "Type:", "Hindi": "प्रकार:", "Kannada": "ಪ್ರಕಾರ:", "Tamil": "வகை:", "Telugu": "రకం:", "Marathi": "प्रकार:", "Bengali": "প্রকার:", "Gujarati": "પ્રકાર:", "Punjabi": "ਕਿਸਮ:", "Malayalam": "തരം:", "Odia": "ପ୍ରକାର:"
    },
    "Unlimited on your plan": {
        "English": "Unlimited on your plan", "Hindi": "आपकी योजना पर असीमित", "Kannada": "ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ ಅನಿಯಮಿತ", "Tamil": "உங்கள் திட்டத்தில் வரம்பற்றது", "Telugu": "మీ ప్లాన్‌లో అపరిమితం", "Marathi": "तुमच्या योजनेवर अमर्यादित", "Bengali": "আপনার প্ল্যানে আনলিমিটেড", "Gujarati": "તમારા પ્લાન પર અમર્યાદિત", "Punjabi": "ਤੁਹਾਡੇ ਪਲਾਨ 'ਤੇ ਅਸੀਮਤ", "Malayalam": "നിങ്ങളുടെ പ്ലാനിൽ പരിധിയില്ലാത്തത്", "Odia": "ଆପଣଙ୍କ ପ୍ଲାନରେ ଅସୀମିତ"
    },
    "Updated": {
        "English": "Updated", "Hindi": "अपडेट किया गया", "Kannada": "ನವೀಕರಿಸಲಾಗಿದೆ", "Tamil": "புதுப்பிக்கப்பட்டது", "Telugu": "నవీకరించబడింది", "Marathi": "अद्यतनित", "Bengali": "আপডেট করা হয়েছে", "Gujarati": "અપડેટ થયું", "Punjabi": "ਅੱਪਡੇਟ ਕੀਤਾ", "Malayalam": "അപ്ഡേറ്റ് ചെയ്തു", "Odia": "ଅଦ୍ୟତନ କରାଯାଇଛି"
    },
    "Upgrade to Pro": {
        "English": "Upgrade to Pro", "Hindi": "प्रो में अपग्रेड करें", "Kannada": "ಪ್ರೊಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ", "Tamil": "ப்ரோவிற்கு மேம்படுத்து", "Telugu": "ప్రోకి అప్‌గ్రేడ్ చేయండి", "Marathi": "प्रो वर अपग्रेड करा", "Bengali": "প্রো-তে আপগ্রেড করুন", "Gujarati": "પ્રો પર અપગ્રેડ કરો", "Punjabi": "ਪ੍ਰੋ ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰੋ", "Malayalam": "പ്രോയിലേക്ക് അപ്ഗ്രേഡ് ചെയ്യുക", "Odia": "ପ୍ରୋକୁ ଅପଗ୍ରେଡ୍ କରନ୍ତୁ"
    },
    "Upload photo": {
        "English": "Upload photo", "Hindi": "फ़ोटो अपलोड करें", "Kannada": "ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ", "Tamil": "புகைப்படத்தைப் பதிவேற்று", "Telugu": "ఫోటోను అప్‌లోడ్ చేయండి", "Marathi": "फोटो अपलोड करा", "Bengali": "ছবি আপলোড করুন", "Gujarati": "ફોટો અપલોડ કરો", "Punjabi": "ਫੋਟੋ ਅੱਪਲੋਡ ਕਰੋ", "Malayalam": "ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക", "Odia": "ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ"
    },
    "Usage Analytics": {
        "English": "Usage Analytics", "Hindi": "उपयोग विश्लेषण", "Kannada": "ಬಳಕೆ ವಿಶ್ಲೇಷಣೆ", "Tamil": "பயன்பாட்டு பகுப்பாய்வு", "Telugu": "వినియోగ విశ్లేషణ", "Marathi": "वापर विश्लेषण", "Bengali": "ব্যবহার বিশ্লেষণ", "Gujarati": "ઉપયોગ વિશ્લેષણ", "Punjabi": "ਵਰਤੋਂ ਵਿਸ਼ਲੇਸ਼ਣ", "Malayalam": "ഉപയോഗ വിശകലനം", "Odia": "ବ୍ୟବହାର ବିଶ୍ଳେଷଣ"
    },
    "Use the filters above to find videos for your classroom.": {
        "English": "Use the filters above to find videos for your classroom.", "Hindi": "अपनी कक्षा के लिए वीडियो खोजने हेतु ऊपर के फ़िल्टर का उपयोग करें।", "Kannada": "ನಿಮ್ಮ ತರಗತಿಗಾಗಿ ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಲು ಮೇಲಿನ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಬಳಸಿ.", "Tamil": "உங்கள் வகுப்பறைக்கான வீடியோக்களைக் கண்டறிய மேலே உள்ள வடிகட்டிகளைப் பயன்படுத்தவும்.", "Telugu": "మీ తరగతి గది కోసం వీడియోలను కనుగొనడానికి పైన ఉన్న ఫిల్టర్‌లను ఉపయోగించండి.", "Marathi": "तुमच्या वर्गासाठी व्हिडिओ शोधण्यासाठी वरील फिल्टर वापरा.", "Bengali": "আপনার ক্লাসরুমের জন্য ভিডিও খুঁজতে উপরের ফিল্টার ব্যবহার করুন।", "Gujarati": "તમારા વર્ગખંડ માટે વિડિઓઝ શોધવા માટે ઉપરના ફિલ્ટરનો ઉપયોગ કરો.", "Punjabi": "ਆਪਣੀ ਕਲਾਸ ਲਈ ਵੀਡੀਓ ਲੱਭਣ ਲਈ ਉੱਪਰਲੇ ਫਿਲਟਰ ਵਰਤੋ।", "Malayalam": "നിങ്ങളുടെ ക്ലാസ്സിനായി വീഡിയോകൾ കണ്ടെത്താൻ മുകളിലുള്ള ഫിൽട്ടറുകൾ ഉപയോഗിക്കുക.", "Odia": "ଆପଣଙ୍କ ଶ୍ରେଣୀଗୃହ ପାଇଁ ଭିଡିଓ ଖୋଜିବାକୁ ଉପରେ ଥିବା ଫିଲ୍ଟର ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "VIDYA Memory": {
        "English": "VIDYA Memory", "Hindi": "VIDYA मेमोरी", "Kannada": "VIDYA ಮೆಮೊರಿ", "Tamil": "VIDYA நினைவகம்", "Telugu": "VIDYA మెమరీ", "Marathi": "VIDYA मेमरी", "Bengali": "VIDYA মেমরি", "Gujarati": "VIDYA મેમરી", "Punjabi": "VIDYA ਮੈਮੋਰੀ", "Malayalam": "VIDYA മെമ്മറി", "Odia": "VIDYA ମେମୋରୀ"
    },
    "VIDYA could not act on that": {
        "English": "VIDYA could not act on that", "Hindi": "VIDYA उस पर कार्य नहीं कर सकी", "Kannada": "VIDYA ಅದರ ಮೇಲೆ ಕಾರ್ಯನಿರ್ವಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", "Tamil": "VIDYA அதன் மீது செயல்பட முடியவில்லை", "Telugu": "VIDYA దానిపై చర్య తీసుకోలేకపోయింది", "Marathi": "VIDYA त्यावर कृती करू शकली नाही", "Bengali": "VIDYA সেটিতে কাজ করতে পারেনি", "Gujarati": "VIDYA તેના પર કાર્ય કરી શકી નહીં", "Punjabi": "VIDYA ਉਸ 'ਤੇ ਕਾਰਵਾਈ ਨਹੀਂ ਕਰ ਸਕੀ", "Malayalam": "VIDYA-യ്ക്ക് അതിൽ പ്രവർത്തിക്കാൻ കഴിഞ്ഞില്ല", "Odia": "VIDYA ତାହାରେ କାର୍ଯ୍ୟ କରିପାରିଲା ନାହିଁ"
    },
    "VIDYA had nothing to say": {
        "English": "VIDYA had nothing to say", "Hindi": "VIDYA के पास कहने को कुछ नहीं था", "Kannada": "VIDYA ಗೆ ಹೇಳಲು ಏನೂ ಇರಲಿಲ್ಲ", "Tamil": "VIDYA-விற்கு சொல்ல எதுவும் இல்லை", "Telugu": "VIDYA కి చెప్పడానికి ఏమీ లేదు", "Marathi": "VIDYA कडे सांगण्यासारखे काही नव्हते", "Bengali": "VIDYA-র বলার কিছু ছিল না", "Gujarati": "VIDYA પાસે કહેવા માટે કંઈ નહોતું", "Punjabi": "VIDYA ਕੋਲ ਕਹਿਣ ਲਈ ਕੁਝ ਨਹੀਂ ਸੀ", "Malayalam": "VIDYA-യ്ക്ക് പറയാൻ ഒന്നുമില്ലായിരുന്നു", "Odia": "VIDYA ପାଖରେ କହିବାକୁ କିଛି ନଥିଲା"
    },
    "VIDYA picked a tool I do not recognise": {
        "English": "VIDYA picked a tool I do not recognise", "Hindi": "VIDYA ने ऐसा टूल चुना जिसे मैं नहीं पहचानती", "Kannada": "VIDYA ನಾನು ಗುರುತಿಸದ ಸಾಧನವನ್ನು ಆಯ್ಕೆ ಮಾಡಿತು", "Tamil": "VIDYA எனக்கு தெரியாத ஒரு கருவியைத் தேர்ந்தெடுத்தது", "Telugu": "VIDYA నాకు తెలియని ఒక సాధనాన్ని ఎంచుకుంది", "Marathi": "VIDYA ने मला माहित नसलेले साधन निवडले", "Bengali": "VIDYA এমন একটি টুল বেছে নিয়েছে যা আমি চিনি না", "Gujarati": "VIDYA એ સાધન પસંદ કર્યું જે હું ઓળખતી નથી", "Punjabi": "VIDYA ਨੇ ਅਜਿਹਾ ਟੂਲ ਚੁਣਿਆ ਜੋ ਮੈਂ ਨਹੀਂ ਪਛਾਣਦੀ", "Malayalam": "VIDYA എനിക്ക് അറിയാത്ത ഒരു ഉപകരണം തിരഞ്ഞെടുത്തു", "Odia": "VIDYA ମୁଁ ଚିହ୍ନୁ ନଥିବା ଏକ ଟୁଲ୍ ବାଛିଲେ"
    },
    "View All": {
        "English": "View All", "Hindi": "सभी देखें", "Kannada": "ಎಲ್ಲವನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "அனைத்தையும் காண்க", "Telugu": "అన్నీ చూడండి", "Marathi": "सर्व पहा", "Bengali": "সব দেখুন", "Gujarati": "બધું જુઓ", "Punjabi": "ਸਾਰੇ ਵੇਖੋ", "Malayalam": "എല്ലാം കാണുക", "Odia": "ସମସ୍ତ ଦେଖନ୍ତୁ"
    },
    "View Memory": {
        "English": "View Memory", "Hindi": "मेमोरी देखें", "Kannada": "ಮೆಮೊರಿ ವೀಕ್ಷಿಸಿ", "Tamil": "நினைவகத்தைக் காண்க", "Telugu": "మెమరీని చూడండి", "Marathi": "मेमरी पहा", "Bengali": "মেমরি দেখুন", "Gujarati": "મેમરી જુઓ", "Punjabi": "ਮੈਮੋਰੀ ਵੇਖੋ", "Malayalam": "മെമ്മറി കാണുക", "Odia": "ମେମୋରୀ ଦେଖନ୍ତୁ"
    },
    "View Plans": {
        "English": "View Plans", "Hindi": "योजनाएँ देखें", "Kannada": "ಯೋಜನೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "திட்டங்களைக் காண்க", "Telugu": "ప్లాన్‌లను చూడండి", "Marathi": "योजना पहा", "Bengali": "প্ল্যান দেখুন", "Gujarati": "પ્લાન જુઓ", "Punjabi": "ਪਲਾਨ ਵੇਖੋ", "Malayalam": "പ്ലാനുകൾ കാണുക", "Odia": "ପ୍ଲାନ୍ ଦେଖନ୍ତୁ"
    },
    "View Usage": {
        "English": "View Usage", "Hindi": "उपयोग देखें", "Kannada": "ಬಳಕೆಯನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "பயன்பாட்டைக் காண்க", "Telugu": "వినియోగాన్ని చూడండి", "Marathi": "वापर पहा", "Bengali": "ব্যবহার দেখুন", "Gujarati": "ઉપયોગ જુઓ", "Punjabi": "ਵਰਤੋਂ ਵੇਖੋ", "Malayalam": "ഉപയോഗം കാണുക", "Odia": "ବ୍ୟବହାର ଦେଖନ୍ତୁ"
    },
    "View all": {
        "English": "View all", "Hindi": "सभी देखें", "Kannada": "ಎಲ್ಲವನ್ನು ವೀಕ್ಷಿಸಿ", "Tamil": "அனைத்தையும் காண்க", "Telugu": "అన్నీ చూడండి", "Marathi": "सर्व पहा", "Bengali": "সব দেখুন", "Gujarati": "બધું જુઓ", "Punjabi": "ਸਾਰੇ ਵੇਖੋ", "Malayalam": "എല്ലാം കാണുക", "Odia": "ସମସ୍ତ ଦେଖନ୍ତୁ"
    },
    "Visual Aids": {
        "English": "Visual Aids", "Hindi": "दृश्य सामग्री", "Kannada": "ದೃಶ್ಯ ಸಾಧನಗಳು", "Tamil": "காட்சி உதவிகள்", "Telugu": "దృశ్య సహాయాలు", "Marathi": "दृश्य साधने", "Bengali": "ভিজ্যুয়াল এইড", "Gujarati": "દ્રશ્ય સહાય", "Punjabi": "ਵਿਜ਼ੂਅਲ ਏਡਜ਼", "Malayalam": "വിഷ്വൽ എയ്ഡ്സ്", "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍"
    },
    "We apologize for the inconvenience. An unexpected error has occurred.": {
        "English": "We apologize for the inconvenience. An unexpected error has occurred.", "Hindi": "असुविधा के लिए हम क्षमा चाहते हैं। एक अप्रत्याशित त्रुटि हुई है।", "Kannada": "ಅನಾನುಕೂಲತೆಗಾಗಿ ಕ್ಷಮಿಸಿ. ಒಂದು ಅನಿರೀಕ್ಷಿತ ದೋಷ ಸಂಭವಿಸಿದೆ.", "Tamil": "சிரமத்திற்கு வருந்துகிறோம். எதிர்பாராத பிழை ஏற்பட்டுள்ளது.", "Telugu": "అసౌకర్యానికి క్షమించండి. ఊహించని లోపం సంభవించింది.", "Marathi": "गैरसोयीबद्दल आम्ही दिलगीर आहोत. एक अनपेक्षित त्रुटी आली आहे.", "Bengali": "অসুবিধার জন্য আমরা দুঃখিত। একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।", "Gujarati": "અસુવિધા બદલ અમે દિલગીર છીએ. એક અણધારી ભૂલ આવી છે.", "Punjabi": "ਅਸੁਵਿਧਾ ਲਈ ਮਾਫੀ। ਇੱਕ ਅਚਾਨਕ ਗਲਤੀ ਹੋਈ ਹੈ।", "Malayalam": "അസൗകര്യത്തിന് ക്ഷമിക്കണം. അപ്രതീക്ഷിത പിശക് സംഭവിച്ചു.", "Odia": "ଅସୁବିଧା ପାଇଁ କ୍ଷମା କରନ୍ତୁ। ଏକ ଅପ୍ରତ୍ୟାଶିତ ତ୍ରୁଟି ଘଟିଛି।"
    },
    "Week-over-week improvement and streaks": {
        "English": "Week-over-week improvement and streaks", "Hindi": "साप्ताहिक सुधार और निरंतरता", "Kannada": "ವಾರಕ್ಕೊಮ್ಮೆ ಸುಧಾರಣೆ ಮತ್ತು ಸ್ಟ್ರೀಕ್‌ಗಳು", "Tamil": "வாரந்தோறும் முன்னேற்றமும் தொடர்ச்சியும்", "Telugu": "వారం వారం మెరుగుదల మరియు స్ట్రీక్‌లు", "Marathi": "साप्ताहिक सुधारणा आणि सातत्य", "Bengali": "সাপ্তাহিক উন্নতি ও ধারাবাহিকতা", "Gujarati": "સાપ્તાહિક સુધારો અને સાતત્ય", "Punjabi": "ਹਫ਼ਤਾਵਾਰ ਸੁਧਾਰ ਅਤੇ ਲਗਾਤਾਰਤਾ", "Malayalam": "ആഴ്ചതോറുമുള്ള മെച്ചപ്പെടുത്തലും തുടർച്ചയും", "Odia": "ସାପ୍ତାହିକ ଉନ୍ନତି ଏବଂ ଧାରାବାହିକତା"
    },
    "Welcome back!": {
        "English": "Welcome back!", "Hindi": "वापसी पर स्वागत है!", "Kannada": "ಮರಳಿ ಸ್ವಾಗತ!", "Tamil": "மீண்டும் வருக!", "Telugu": "తిరిగి స్వాగతం!", "Marathi": "पुन्हा स्वागत आहे!", "Bengali": "ফিরে আসার জন্য স্বাগতম!", "Gujarati": "પાછા આવવા બદલ સ્વાગત છે!", "Punjabi": "ਵਾਪਸੀ 'ਤੇ ਜੀ ਆਇਆਂ ਨੂੰ!", "Malayalam": "തിരികെ സ്വാഗതം!", "Odia": "ସ୍ୱାଗତ!"
    },
    "What did you try today?": {
        "English": "What did you try today?", "Hindi": "आज आपने क्या आज़माया?", "Kannada": "ಇಂದು ನೀವು ಏನು ಪ್ರಯತ್ನಿಸಿದ್ದೀರಿ?", "Tamil": "இன்று நீங்கள் என்ன முயற்சித்தீர்கள்?", "Telugu": "ఈరోజు మీరు ఏమి ప్రయత్నించారు?", "Marathi": "आज तुम्ही काय प्रयत्न केले?", "Bengali": "আজ আপনি কী চেষ্টা করেছেন?", "Gujarati": "આજે તમે શું પ્રયાસ કર્યો?", "Punjabi": "ਅੱਜ ਤੁਸੀਂ ਕੀ ਕੋਸ਼ਿਸ਼ ਕੀਤੀ?", "Malayalam": "ഇന്ന് നിങ്ങൾ എന്താണ് ശ്രമിച്ചത്?", "Odia": "ଆଜି ଆପଣ କଣ ଚେଷ୍ଟା କଲେ?"
    },
    "Write something": {
        "English": "Write something", "Hindi": "कुछ लिखें", "Kannada": "ಏನಾದರೂ ಬರೆಯಿರಿ", "Tamil": "ஏதாவது எழுதவும்", "Telugu": "ఏదైనా రాయండి", "Marathi": "काहीतरी लिहा", "Bengali": "কিছু লিখুন", "Gujarati": "કંઈક લખો", "Punjabi": "ਕੁਝ ਲਿਖੋ", "Malayalam": "എന്തെങ്കിലും എഴുതുക", "Odia": "କିଛି ଲେଖନ୍ତୁ"
    },
    "Years of Experience": {
        "English": "Years of Experience", "Hindi": "अनुभव के वर्ष", "Kannada": "ಅನುಭವದ ವರ್ಷಗಳು", "Tamil": "அனுபவ ஆண்டுகள்", "Telugu": "అనుభవ సంవత్సరాలు", "Marathi": "अनुभवाची वर्षे", "Bengali": "অভিজ্ঞতার বছর", "Gujarati": "અનુભવના વર્ષો", "Punjabi": "ਅਨੁਭਵ ਦੇ ਸਾਲ", "Malayalam": "പ്രവൃത്തി പരിചയ വർഷങ്ങൾ", "Odia": "ଅନୁଭବର ବର୍ଷ"
    },
    "You can try again later or use WhatsApp instead.": {
        "English": "You can try again later or use WhatsApp instead.", "Hindi": "आप बाद में पुनः प्रयास कर सकते हैं या इसके बजाय WhatsApp का उपयोग करें।", "Kannada": "ನೀವು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಬಹುದು ಅಥವಾ ಬದಲಿಗೆ WhatsApp ಬಳಸಬಹುದು.", "Tamil": "நீங்கள் பின்னர் மீண்டும் முயற்சிக்கலாம் அல்லது WhatsApp-ஐப் பயன்படுத்தலாம்.", "Telugu": "మీరు తర్వాత మళ్లీ ప్రయత్నించవచ్చు లేదా బదులుగా WhatsApp ఉపయోగించవచ్చు.", "Marathi": "तुम्ही नंतर पुन्हा प्रयत्न करू शकता किंवा त्याऐवजी WhatsApp वापरू शकता.", "Bengali": "আপনি পরে আবার চেষ্টা করতে পারেন বা পরিবর্তে WhatsApp ব্যবহার করতে পারেন।", "Gujarati": "તમે પછી ફરી પ્રયાસ કરી શકો છો અથવા તેના બદલે WhatsApp વાપરી શકો છો.", "Punjabi": "ਤੁਸੀਂ ਬਾਅਦ ਵਿੱਚ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰ ਸਕਦੇ ਹੋ ਜਾਂ ਇਸ ਦੀ ਥਾਂ WhatsApp ਵਰਤ ਸਕਦੇ ਹੋ।", "Malayalam": "നിങ്ങൾക്ക് പിന്നീട് വീണ്ടും ശ്രമിക്കാം അല്ലെങ്കിൽ പകരം WhatsApp ഉപയോഗിക്കാം.", "Odia": "ଆପଣ ପରେ ପୁନଃ ଚେଷ୍ଟା କରିପାରିବେ କିମ୍ବା ବଦଳରେ WhatsApp ବ୍ୟବହାର କରିପାରିବେ।"
    },
    "You need to be signed in to post.": {
        "English": "You need to be signed in to post.", "Hindi": "पोस्ट करने के लिए आपको साइन इन होना चाहिए।", "Kannada": "ಪೋಸ್ಟ್ ಮಾಡಲು ನೀವು ಸೈನ್ ಇನ್ ಆಗಿರಬೇಕು.", "Tamil": "பதிவிட நீங்கள் உள்நுழைந்திருக்க வேண்டும்.", "Telugu": "పోస్ట్ చేయడానికి మీరు సైన్ ఇన్ అయి ఉండాలి.", "Marathi": "पोस्ट करण्यासाठी तुम्हाला साइन इन करावे लागेल.", "Bengali": "পোস্ট করতে আপনাকে সাইন ইন করতে হবে।", "Gujarati": "પોસ્ટ કરવા માટે તમારે સાઇન ઇન કરવું પડશે.", "Punjabi": "ਪੋਸਟ ਕਰਨ ਲਈ ਤੁਹਾਨੂੰ ਸਾਈਨ ਇਨ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।", "Malayalam": "പോസ്റ്റ് ചെയ്യാൻ നിങ്ങൾ സൈൻ ഇൻ ചെയ്തിരിക്കണം.", "Odia": "ପୋଷ୍ଟ କରିବାକୁ ଆପଣଙ୍କୁ ସାଇନ୍ ଇନ୍ ହେବାକୁ ପଡିବ।"
    },
    "Your Action Items": {
        "English": "Your Action Items", "Hindi": "आपके कार्य आइटम", "Kannada": "ನಿಮ್ಮ ಕ್ರಿಯಾ ಐಟಂಗಳು", "Tamil": "உங்கள் செயல் பட்டியல்", "Telugu": "మీ చర్య అంశాలు", "Marathi": "तुमची कृती कामे", "Bengali": "আপনার করণীয় কাজ", "Gujarati": "તમારી કાર્ય બાબતો", "Punjabi": "ਤੁਹਾਡੇ ਕਾਰਜ ਆਈਟਮ", "Malayalam": "നിങ്ങളുടെ പ്രവർത്തന ഇനങ്ങൾ", "Odia": "ଆପଣଙ୍କ କାର୍ଯ୍ୟ ତାଲିକା"
    },
    "Your photo appears on your library, community posts, and profile. By default we use your Google account photo — upload a custom one to override it.": {
        "English": "Your photo appears on your library, community posts, and profile. By default we use your Google account photo — upload a custom one to override it.", "Hindi": "आपकी फ़ोटो आपकी लाइब्रेरी, सामुदायिक पोस्ट और प्रोफ़ाइल पर दिखती है। डिफ़ॉल्ट रूप से हम आपके Google खाते की फ़ोटो उपयोग करते हैं — इसे बदलने के लिए कस्टम फ़ोटो अपलोड करें।", "Kannada": "ನಿಮ್ಮ ಫೋಟೋ ನಿಮ್ಮ ಗ್ರಂಥಾಲಯ, ಸಮುದಾಯ ಪೋಸ್ಟ್‌ಗಳು ಮತ್ತು ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ. ಪೂರ್ವನಿಯೋಜಿತವಾಗಿ ನಾವು ನಿಮ್ಮ Google ಖಾತೆಯ ಫೋಟೋ ಬಳಸುತ್ತೇವೆ — ಅದನ್ನು ಬದಲಾಯಿಸಲು ಕಸ್ಟಮ್ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.", "Tamil": "உங்கள் புகைப்படம் உங்கள் நூலகம், சமூக இடுகைகள் மற்றும் சுயவிவரத்தில் தோன்றும். இயல்பாக நாங்கள் உங்கள் Google கணக்கின் புகைப்படத்தைப் பயன்படுத்துகிறோம் — அதை மாற்ற தனிப்பயன் புகைப்படத்தைப் பதிவேற்றவும்.", "Telugu": "మీ ఫోటో మీ లైబ్రరీ, కమ్యూనిటీ పోస్ట్‌లు మరియు ప్రొఫైల్‌లో కనిపిస్తుంది. డిఫాల్ట్‌గా మేము మీ Google ఖాతా ఫోటోను ఉపయోగిస్తాము — దాన్ని భర్తీ చేయడానికి కస్టమ్ ఫోటోను అప్‌లోడ్ చేయండి.", "Marathi": "तुमचा फोटो तुमच्या लायब्ररी, समुदाय पोस्ट आणि प्रोफाइलवर दिसतो. डीफॉल्टनुसार आम्ही तुमच्या Google खात्याचा फोटो वापरतो — तो बदलण्यासाठी कस्टम फोटो अपलोड करा.", "Bengali": "আপনার ছবি আপনার লাইব্রেরি, কমিউনিটি পোস্ট ও প্রোফাইলে দেখা যায়। ডিফল্টভাবে আমরা আপনার Google অ্যাকাউন্টের ছবি ব্যবহার করি — তা বদলাতে কাস্টম ছবি আপলোড করুন।", "Gujarati": "તમારો ફોટો તમારી લાઇબ્રેરી, કમ્યુનિટી પોસ્ટ અને પ્રોફાઇલ પર દેખાય છે. ડિફોલ્ટ રૂપે અમે તમારા Google એકાઉન્ટનો ફોટો વાપરીએ છીએ — તેને બદલવા માટે કસ્ટમ ફોટો અપલોડ કરો.", "Punjabi": "ਤੁਹਾਡੀ ਫੋਟੋ ਤੁਹਾਡੀ ਲਾਇਬਰੇਰੀ, ਕਮਿਊਨਿਟੀ ਪੋਸਟਾਂ ਅਤੇ ਪ੍ਰੋਫਾਈਲ 'ਤੇ ਦਿਖਾਈ ਦਿੰਦੀ ਹੈ। ਡਿਫਾਲਟ ਤੌਰ 'ਤੇ ਅਸੀਂ ਤੁਹਾਡੇ Google ਖਾਤੇ ਦੀ ਫੋਟੋ ਵਰਤਦੇ ਹਾਂ — ਇਸਨੂੰ ਬਦਲਣ ਲਈ ਕਸਟਮ ਫੋਟੋ ਅੱਪਲੋਡ ਕਰੋ।", "Malayalam": "നിങ്ങളുടെ ഫോട്ടോ നിങ്ങളുടെ ലൈബ്രറി, കമ്മ്യൂണിറ്റി പോസ്റ്റുകൾ, പ്രൊഫൈൽ എന്നിവയിൽ ദൃശ്യമാകും. സ്ഥിരസ്ഥിതിയായി ഞങ്ങൾ നിങ്ങളുടെ Google അക്കൗണ്ട് ഫോട്ടോ ഉപയോഗിക്കുന്നു — അത് മാറ്റാൻ കസ്റ്റം ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക.", "Odia": "ଆପଣଙ୍କ ଫଟୋ ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ, ସମ୍ପ୍ରଦାୟ ପୋଷ୍ଟ ଏବଂ ପ୍ରୋଫାଇଲରେ ଦେଖାଯାଏ। ଡିଫଲ୍ଟ ଭାବେ ଆମେ ଆପଣଙ୍କ Google ଆକାଉଣ୍ଟ ଫଟୋ ବ୍ୟବହାର କରୁ — ତାହାକୁ ବଦଳାଇବାକୁ କଷ୍ଟମ୍ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ।"
    },
    "Your post cannot be empty.": {
        "English": "Your post cannot be empty.", "Hindi": "आपकी पोस्ट खाली नहीं हो सकती।", "Kannada": "ನಿಮ್ಮ ಪೋಸ್ಟ್ ಖಾಲಿಯಾಗಿರಲು ಸಾಧ್ಯವಿಲ್ಲ.", "Tamil": "உங்கள் இடுகை காலியாக இருக்க முடியாது.", "Telugu": "మీ పోస్ట్ ఖాళీగా ఉండకూడదు.", "Marathi": "तुमची पोस्ट रिकामी असू शकत नाही.", "Bengali": "আপনার পোস্ট খালি হতে পারে না।", "Gujarati": "તમારી પોસ્ટ ખાલી હોઈ શકતી નથી.", "Punjabi": "ਤੁਹਾਡੀ ਪੋਸਟ ਖਾਲੀ ਨਹੀਂ ਹੋ ਸਕਦੀ।", "Malayalam": "നിങ്ങളുടെ പോസ്റ്റ് ശൂന്യമാകാൻ കഴിയില്ല.", "Odia": "ଆପଣଙ୍କ ପୋଷ୍ଟ ଖାଲି ହୋଇପାରିବ ନାହିଁ।"
    },
    "Your post has been shared with the community.": {
        "English": "Your post has been shared with the community.", "Hindi": "आपकी पोस्ट समुदाय के साथ साझा कर दी गई है।", "Kannada": "ನಿಮ್ಮ ಪೋಸ್ಟ್ ಸಮುದಾಯದೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಲಾಗಿದೆ.", "Tamil": "உங்கள் இடுகை சமூகத்துடன் பகிரப்பட்டுள்ளது.", "Telugu": "మీ పోస్ట్ కమ్యూనిటీతో పంచుకోబడింది.", "Marathi": "तुमची पोस्ट समुदायासोबत शेअर केली आहे.", "Bengali": "আপনার পোস্ট কমিউনিটির সাথে শেয়ার করা হয়েছে।", "Gujarati": "તમારી પોસ્ટ સમુદાય સાથે શેર કરવામાં આવી છે.", "Punjabi": "ਤੁਹਾਡੀ ਪੋਸਟ ਕਮਿਊਨਿਟੀ ਨਾਲ ਸਾਂਝੀ ਕੀਤੀ ਗਈ ਹੈ।", "Malayalam": "നിങ്ങളുടെ പോസ്റ്റ് കമ്മ്യൂണിറ്റിയുമായി പങ്കിട്ടു.", "Odia": "ଆପଣଙ୍କ ପୋଷ୍ଟ ସମ୍ପ୍ରଦାୟ ସହିତ ସେୟାର କରାଯାଇଛି।"
    },
    "Your profile is now complete.": {
        "English": "Your profile is now complete.", "Hindi": "आपकी प्रोफ़ाइल अब पूर्ण है।", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಈಗ ಪೂರ್ಣಗೊಂಡಿದೆ.", "Tamil": "உங்கள் சுயவிவரம் இப்போது முழுமையானது.", "Telugu": "మీ ప్రొఫైల్ ఇప్పుడు పూర్తయింది.", "Marathi": "तुमची प्रोफाइल आता पूर्ण आहे.", "Bengali": "আপনার প্রোফাইল এখন সম্পূর্ণ।", "Gujarati": "તમારી પ્રોફાઇલ હવે પૂર્ણ છે.", "Punjabi": "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਹੁਣ ਪੂਰੀ ਹੈ।", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ ഇപ്പോൾ പൂർണ്ണമാണ്.", "Odia": "ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଏବେ ସମ୍ପୂର୍ଣ୍ଣ।"
    },
    "Your profile:": {
        "English": "Your profile:", "Hindi": "आपकी प्रोफ़ाइल:", "Kannada": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್:", "Tamil": "உங்கள் சுயவிவரம்:", "Telugu": "మీ ప్రొఫైల్:", "Marathi": "तुमची प्रोफाइल:", "Bengali": "আপনার প্রোফাইল:", "Gujarati": "તમારી પ્રોફાઇલ:", "Punjabi": "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ:", "Malayalam": "നിങ്ങളുടെ പ്രൊഫൈൽ:", "Odia": "ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍:"
    },
    "Your score grows as you create lesson plans, worksheets, and other resources.": {
        "English": "Your score grows as you create lesson plans, worksheets, and other resources.", "Hindi": "जैसे-जैसे आप पाठ योजना, वर्कशीट और अन्य संसाधन बनाते हैं, आपका स्कोर बढ़ता है।", "Kannada": "ನೀವು ಪಾಠ ಯೋಜನೆಗಳು, ವರ್ಕ್‌ಶೀಟ್‌ಗಳು ಮತ್ತು ಇತರ ಸಂಪನ್ಮೂಲಗಳನ್ನು ರಚಿಸುತ್ತಿದ್ದಂತೆ ನಿಮ್ಮ ಸ್ಕೋರ್ ಬೆಳೆಯುತ್ತದೆ.", "Tamil": "நீங்கள் பாட திட்டங்கள், பணித்தாள்கள் மற்றும் பிற ஆதாரங்களை உருவாக்கும்போது உங்கள் மதிப்பெண் வளர்கிறது.", "Telugu": "మీరు పాఠ ప్రణాళికలు, వర్క్‌షీట్‌లు మరియు ఇతర వనరులను సృష్టించినప్పుడు మీ స్కోర్ పెరుగుతుంది.", "Marathi": "तुम्ही पाठ योजना, वर्कशीट आणि इतर संसाधने तयार करता तसा तुमचा स्कोर वाढतो.", "Bengali": "আপনি যখন পাঠ পরিকল্পনা, ওয়ার্কশিট ও অন্যান্য সম্পদ তৈরি করেন, আপনার স্কোর বাড়ে।", "Gujarati": "જેમ તમે પાઠ યોજનાઓ, વર્કશીટ અને અન્ય સંસાધનો બનાવો છો તેમ તમારો સ્કોર વધે છે.", "Punjabi": "ਜਿਵੇਂ-ਜਿਵੇਂ ਤੁਸੀਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਵਰਕਸ਼ੀਟਾਂ ਅਤੇ ਹੋਰ ਸਰੋਤ ਬਣਾਉਂਦੇ ਹੋ, ਤੁਹਾਡਾ ਸਕੋਰ ਵਧਦਾ ਹੈ।", "Malayalam": "നിങ്ങൾ പാഠ പദ്ധതികൾ, വർക്ക്‌ഷീറ്റുകൾ, മറ്റ് വിഭവങ്ങൾ സൃഷ്ടിക്കുമ്പോൾ നിങ്ങളുടെ സ്കോർ വർദ്ധിക്കുന്നു.", "Odia": "ଆପଣ ପାଠ ଯୋଜନା, ୱର୍କଶିଟ୍ ଏବଂ ଅନ୍ୟ ସମ୍ବଳ ତିଆରି କଲେ ଆପଣଙ୍କ ସ୍କୋର ବଢ଼େ।"
    },
    "Your teaching philosophy...": {
        "English": "Your teaching philosophy...", "Hindi": "आपका शिक्षण दर्शन...", "Kannada": "ನಿಮ್ಮ ಬೋಧನಾ ತತ್ತ್ವ...", "Tamil": "உங்கள் கற்பித்தல் தத்துவம்...", "Telugu": "మీ బోధనా తత్వం...", "Marathi": "तुमचे शिक्षण तत्त्वज्ञान...", "Bengali": "আপনার শিক্ষাদর্শন...", "Gujarati": "તમારી શિક્ષણ ફિલસૂફી...", "Punjabi": "ਤੁਹਾਡਾ ਅਧਿਆਪਨ ਦਰਸ਼ਨ...", "Malayalam": "നിങ്ങളുടെ അധ്യാപന തത്വശാസ്ത്രം...", "Odia": "ଆପଣଙ୍କ ଶିକ୍ଷାଦାନ ଦର୍ଶନ..."
    },
    "e.g. 8": {
        "English": "e.g. 8", "Hindi": "उदा. 8", "Kannada": "ಉದಾ. 8", "Tamil": "எ.கா. 8", "Telugu": "ఉదా. 8", "Marathi": "उदा. 8", "Bengali": "যেমন 8", "Gujarati": "દા.ત. 8", "Punjabi": "ਉਦਾ. 8", "Malayalam": "ഉദാ. 8", "Odia": "ଯଥା 8"
    },
    "have classroom observations. Add a 1-2 sentence note below so the message is specific. Examples teachers commonly cite:": {
        "English": "have classroom observations. Add a 1-2 sentence note below so the message is specific. Examples teachers commonly cite:", "Hindi": "कक्षा अवलोकन हैं। संदेश विशिष्ट हो इसके लिए नीचे 1-2 वाक्य का नोट जोड़ें। शिक्षक आमतौर पर जिन उदाहरणों का उल्लेख करते हैं:", "Kannada": "ತರಗತಿಯ ಅವಲೋಕನಗಳಿವೆ. ಸಂದೇಶ ನಿರ್ದಿಷ್ಟವಾಗಿರಲು ಕೆಳಗೆ 1-2 ವಾಕ್ಯದ ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ. ಶಿಕ್ಷಕರು ಸಾಮಾನ್ಯವಾಗಿ ಉಲ್ಲೇಖಿಸುವ ಉದಾಹರಣೆಗಳು:", "Tamil": "வகுப்பறை அவதானிப்புகள் உள்ளன. செய்தி குறிப்பிட்டதாக இருக்க கீழே 1-2 வாக்கிய குறிப்பைச் சேர்க்கவும். ஆசிரியர்கள் பொதுவாக மேற்கோள் காட்டும் எடுத்துக்காட்டுகள்:", "Telugu": "తరగతి గది పరిశీలనలు ఉన్నాయి. సందేశం నిర్దిష్టంగా ఉండేందుకు క్రింద 1-2 వాక్యాల నోట్ జోడించండి. ఉపాధ్యాయులు సాధారణంగా ప్రస్తావించే ఉదాహరణలు:", "Marathi": "वर्ग निरीक्षणे आहेत. संदेश विशिष्ट होण्यासाठी खाली 1-2 वाक्यांची नोंद जोडा. शिक्षक सहसा देत असलेली उदाहरणे:", "Bengali": "শ্রেণীকক্ষ পর্যবেক্ষণ রয়েছে। বার্তাটি নির্দিষ্ট হওয়ার জন্য নিচে 1-2 বাক্যের নোট যোগ করুন। শিক্ষকরা সাধারণত যে উদাহরণগুলি উল্লেখ করেন:", "Gujarati": "વર્ગખંડ અવલોકનો છે. સંદેશ ચોક્કસ બને તે માટે નીચે 1-2 વાક્યની નોંધ ઉમેરો. શિક્ષકો સામાન્ય રીતે ઉલ્લેખ કરે છે તે ઉદાહરણો:", "Punjabi": "ਕਲਾਸਰੂਮ ਨਿਰੀਖਣ ਹਨ। ਸੁਨੇਹਾ ਖਾਸ ਹੋਣ ਲਈ ਹੇਠਾਂ 1-2 ਵਾਕਾਂ ਦਾ ਨੋਟ ਜੋੜੋ। ਅਧਿਆਪਕ ਆਮ ਤੌਰ 'ਤੇ ਜਿਨ੍ਹਾਂ ਉਦਾਹਰਣਾਂ ਦਾ ਜ਼ਿਕਰ ਕਰਦੇ ਹਨ:", "Malayalam": "ക്ലാസ്സ്മുറി നിരീക്ഷണങ്ങളുണ്ട്. സന്ദേശം നിർദ്ദിഷ്ടമാകാൻ താഴെ 1-2 വാക്യങ്ങളുള്ള കുറിപ്പ് ചേർക്കുക. അധ്യാപകർ സാധാരണയായി ഉദ്ധരിക്കുന്ന ഉദാഹരണങ്ങൾ:", "Odia": "ଶ୍ରେଣୀଗୃହ ପର୍ଯ୍ୟବେକ୍ଷଣ ଅଛି। ସନ୍ଦେଶ ନିର୍ଦ୍ଦିଷ୍ଟ ହେବା ପାଇଁ ତଳେ 1-2 ବାକ୍ୟର ଟିପ୍ପଣୀ ଯୋଗ କରନ୍ତୁ। ଶିକ୍ଷକମାନେ ସାଧାରଣତଃ ଯେଉଁ ଉଦାହରଣ ଦିଅନ୍ତି:"
    },
    "not": {
        "English": "not", "Hindi": "नहीं", "Kannada": "ಇಲ್ಲ", "Tamil": "இல்லை", "Telugu": "కాదు", "Marathi": "नाही", "Bengali": "নয়", "Gujarati": "નહીં", "Punjabi": "ਨਹੀਂ", "Malayalam": "അല്ല", "Odia": "ନୁହେଁ"
    },
    "District / Region": {
        "English": "District / Region", "Hindi": "जिला / क्षेत्र", "Kannada": "ಜಿಲ್ಲೆ / ಪ್ರದೇಶ", "Tamil": "மாவட்டம் / பகுதி", "Telugu": "జిల్లా / ప్రాంతం", "Marathi": "जिल्हा / प्रदेश", "Bengali": "জেলা / অঞ্চল", "Gujarati": "જિલ્લો / પ્રદેશ", "Punjabi": "ਜ਼ਿਲ੍ਹਾ / ਖੇਤਰ", "Malayalam": "ജില്ല / പ്രദേശം", "Odia": "ଜିଲ୍ଲା / ଅଞ୍ଚଳ"
    },
    "e.g. North Delhi": {
        "English": "e.g. North Delhi", "Hindi": "उदा. उत्तरी दिल्ली", "Kannada": "ಉದಾ. ಉತ್ತರ ದೆಹಲಿ", "Tamil": "எ.கா. வட டெல்லி", "Telugu": "ఉదా. ఉత్తర ఢిల్లీ", "Marathi": "उदा. उत्तर दिल्ली", "Bengali": "যেমন উত্তর দিল্লি", "Gujarati": "દા.ત. ઉત્તર દિલ્હી", "Punjabi": "ਜਿਵੇਂ ਉੱਤਰੀ ਦਿੱਲੀ", "Malayalam": "ഉദാ. നോർത്ത് ഡൽഹി", "Odia": "ଉଦାହରଣ. ଉତ୍ତର ଦିଲ୍ଲୀ"
    },
    "e.g. Senior Teacher": {
        "English": "e.g. Senior Teacher", "Hindi": "उदा. वरिष्ठ शिक्षक", "Kannada": "ಉದಾ. ಹಿರಿಯ ಶಿಕ್ಷಕ", "Tamil": "எ.கா. மூத்த ஆசிரியர்", "Telugu": "ఉదా. సీనియర్ ఉపాధ్యాయుడు", "Marathi": "उदा. वरिष्ठ शिक्षक", "Bengali": "যেমন সিনিয়র শিক্ষক", "Gujarati": "દા.ત. વરિષ્ઠ શિક્ષક", "Punjabi": "ਜਿਵੇਂ ਸੀਨੀਅਰ ਅਧਿਆਪਕ", "Malayalam": "ഉദാ. സീനിയർ അധ്യാപകൻ", "Odia": "ଉଦାହରଣ. ବରିଷ୍ଠ ଶିକ୍ଷକ"
    },
    "you@example.com": {
        "English": "you@example.com", "Hindi": "you@example.com", "Kannada": "you@example.com", "Tamil": "you@example.com", "Telugu": "you@example.com", "Marathi": "you@example.com", "Bengali": "you@example.com", "Gujarati": "you@example.com", "Punjabi": "you@example.com", "Malayalam": "you@example.com", "Odia": "you@example.com"
    },
    "Math": {
        "English": "Math", "Hindi": "गणित", "Kannada": "ಗಣಿತ", "Tamil": "கணிதம்", "Telugu": "గణితం", "Marathi": "गणित", "Bengali": "গণিত", "Gujarati": "ગણિત", "Punjabi": "ਗਣਿਤ", "Malayalam": "ഗണിതം", "Odia": "ଗଣିତ"
    },
    "Physics": {
        "English": "Physics", "Hindi": "भौतिकी", "Kannada": "ಭೌತಶಾಸ್ತ್ರ", "Tamil": "இயற்பியல்", "Telugu": "భౌతిక శాస్త్రం", "Marathi": "भौतिकशास्त्र", "Bengali": "পদার্থবিজ্ঞান", "Gujarati": "ભૌતિકશાસ્ત્ર", "Punjabi": "ਭੌਤਿਕ ਵਿਗਿਆਨ", "Malayalam": "ഭൗതികശാസ്ത്രം", "Odia": "ପଦାର୍ଥ ବିଜ୍ଞାନ"
    },
    "Chemistry": {
        "English": "Chemistry", "Hindi": "रसायन विज्ञान", "Kannada": "ರಸಾಯನಶಾಸ್ತ್ರ", "Tamil": "வேதியியல்", "Telugu": "రసాయన శాస్త్రం", "Marathi": "रसायनशास्त्र", "Bengali": "রসায়ন", "Gujarati": "રસાયણશાસ્ત્ર", "Punjabi": "ਰਸਾਇਣ ਵਿਗਿਆਨ", "Malayalam": "രസതന്ത്രം", "Odia": "ରସାୟନ ବିଜ୍ଞାନ"
    },
    "Biology": {
        "English": "Biology", "Hindi": "जीव विज्ञान", "Kannada": "ಜೀವಶಾಸ್ತ್ರ", "Tamil": "உயிரியல்", "Telugu": "జీవ శాస్త్రం", "Marathi": "जीवशास्त्र", "Bengali": "জীববিজ্ঞান", "Gujarati": "જીવવિજ્ઞાન", "Punjabi": "ਜੀਵ ਵਿਗਿਆਨ", "Malayalam": "ജീവശാസ്ത്രം", "Odia": "ଜୀବ ବିଜ୍ଞାନ"
    },
    "EVS": {
        "English": "EVS", "Hindi": "पर्यावरण अध्ययन", "Kannada": "ಪರಿಸರ ಅಧ್ಯಯನ", "Tamil": "சுற்றுச்சூழல் ஆய்வு", "Telugu": "పర్యావరణ అధ్యయనం", "Marathi": "पर्यावरण अभ्यास", "Bengali": "পরিবেশ বিদ্যা", "Gujarati": "પર્યાવરણ અભ્યાસ", "Punjabi": "ਵਾਤਾਵਰਣ ਅਧਿਐਨ", "Malayalam": "പരിസ്ഥിതി പഠനം", "Odia": "ପରିବେଶ ଅଧ୍ୟୟନ"
    },
    "Environmental Studies": {
        "English": "Environmental Studies", "Hindi": "पर्यावरण अध्ययन", "Kannada": "ಪರಿಸರ ಅಧ್ಯಯನಗಳು", "Tamil": "சுற்றுச்சூழல் ஆய்வுகள்", "Telugu": "పర్యావరణ అధ్యయనాలు", "Marathi": "पर्यावरण अभ्यास", "Bengali": "পরিবেশ বিদ্যা", "Gujarati": "પર્યાવરણ અભ્યાસ", "Punjabi": "ਵਾਤਾਵਰਣ ਅਧਿਐਨ", "Malayalam": "പരിസ്ഥിതി പഠനങ്ങൾ", "Odia": "ପରିବେଶ ଅଧ୍ୟୟନ"
    },
    "Social Studies": {
        "English": "Social Studies", "Hindi": "सामाजिक अध्ययन", "Kannada": "ಸಮಾಜ ಅಧ್ಯಯನ", "Tamil": "சமூக அறிவியல்", "Telugu": "సాంఘిక శాస్త్రం", "Marathi": "समाजशास्त्र", "Bengali": "সমাজ বিদ্যা", "Gujarati": "સામાજિક અભ્યાસ", "Punjabi": "ਸਮਾਜਿਕ ਅਧਿਐਨ", "Malayalam": "സാമൂഹ്യപഠനം", "Odia": "ସାମାଜିକ ଅଧ୍ୟୟନ"
    },
    "Tamil": {
        "English": "Tamil", "Hindi": "तमिल", "Kannada": "ತಮಿಳು", "Tamil": "தமிழ்", "Telugu": "తమిళం", "Marathi": "तमिळ", "Bengali": "তামিল", "Gujarati": "તમિલ", "Punjabi": "ਤਮਿਲ", "Malayalam": "തമിഴ്", "Odia": "ତାମିଲ"
    },
    "Telugu": {
        "English": "Telugu", "Hindi": "तेलुगु", "Kannada": "ತೆಲುಗು", "Tamil": "தெலுங்கு", "Telugu": "తెలుగు", "Marathi": "तेलुगू", "Bengali": "তেলুগু", "Gujarati": "તેલુગુ", "Punjabi": "ਤੇਲਗੂ", "Malayalam": "തെലുങ്ക്", "Odia": "ତେଲୁଗୁ"
    },
    "Bengali": {
        "English": "Bengali", "Hindi": "बंगाली", "Kannada": "ಬಂಗಾಳಿ", "Tamil": "வங்காளம்", "Telugu": "బెంగాలీ", "Marathi": "बंगाली", "Bengali": "বাংলা", "Gujarati": "બંગાળી", "Punjabi": "ਬੰਗਾਲੀ", "Malayalam": "ബംഗാളി", "Odia": "ବଙ୍ଗଳା"
    },
    "Gujarati": {
        "English": "Gujarati", "Hindi": "गुजराती", "Kannada": "ಗುಜರಾತಿ", "Tamil": "குஜராத்தி", "Telugu": "గుజరాతీ", "Marathi": "गुजराती", "Bengali": "গুজরাটি", "Gujarati": "ગુજરાતી", "Punjabi": "ਗੁਜਰਾਤੀ", "Malayalam": "ഗുജറാത്തി", "Odia": "ଗୁଜରାଟୀ"
    },
    "Marathi": {
        "English": "Marathi", "Hindi": "मराठी", "Kannada": "ಮರಾಠಿ", "Tamil": "மராத்தி", "Telugu": "మరాఠీ", "Marathi": "मराठी", "Bengali": "মারাঠি", "Gujarati": "મરાઠી", "Punjabi": "ਮਰਾਠੀ", "Malayalam": "മറാത്തി", "Odia": "ମରାଠୀ"
    },
    "Punjabi": {
        "English": "Punjabi", "Hindi": "पंजाबी", "Kannada": "ಪಂಜಾಬಿ", "Tamil": "பஞ்சாபி", "Telugu": "పంజాబీ", "Marathi": "पंजाबी", "Bengali": "পাঞ্জাবি", "Gujarati": "પંજાબી", "Punjabi": "ਪੰਜਾਬੀ", "Malayalam": "പഞ്ചാബി", "Odia": "ପଞ୍ଜାବୀ"
    },
    "Malayalam": {
        "English": "Malayalam", "Hindi": "मलयालम", "Kannada": "ಮಲಯಾಳಂ", "Tamil": "மலையாளம்", "Telugu": "మలయాళం", "Marathi": "मल्याळम", "Bengali": "মালয়ালম", "Gujarati": "મલયાલમ", "Punjabi": "ਮਲਯਾਲਮ", "Malayalam": "മലയാളം", "Odia": "ମଲୟାଲମ"
    },
    "Odia": {
        "English": "Odia", "Hindi": "ओड़िया", "Kannada": "ಒಡಿಯಾ", "Tamil": "ஒடியா", "Telugu": "ఒడియా", "Marathi": "ओडिया", "Bengali": "ওড়িয়া", "Gujarati": "ઓડિયા", "Punjabi": "ਉੜੀਆ", "Malayalam": "ഒഡിയ", "Odia": "ଓଡ଼ିଆ"
    },
    "Urdu": {
        "English": "Urdu", "Hindi": "उर्दू", "Kannada": "ಉರ್ದು", "Tamil": "உருது", "Telugu": "ఉర్దూ", "Marathi": "उर्दू", "Bengali": "উর্দু", "Gujarati": "ઉર્દૂ", "Punjabi": "ਉਰਦੂ", "Malayalam": "ഉറുദു", "Odia": "ଉର୍ଦୁ"
    },
    "Physical Education": {
        "English": "Physical Education", "Hindi": "शारीरिक शिक्षा", "Kannada": "ದೈಹಿಕ ಶಿಕ್ಷಣ", "Tamil": "உடற்கல்வி", "Telugu": "శారీరక విద్య", "Marathi": "शारीरिक शिक्षण", "Bengali": "শারীরিক শিক্ষা", "Gujarati": "શારીરિક શિક્ષણ", "Punjabi": "ਸਰੀਰਕ ਸਿੱਖਿਆ", "Malayalam": "ശാരീരിക വിദ്യാഭ്യാസം", "Odia": "ଶାରୀରିକ ଶିକ୍ଷା"
    },
    "Health Education": {
        "English": "Health Education", "Hindi": "स्वास्थ्य शिक्षा", "Kannada": "ಆರೋಗ್ಯ ಶಿಕ್ಷಣ", "Tamil": "சுகாதாரக் கல்வி", "Telugu": "ఆరోగ్య విద్య", "Marathi": "आरोग्य शिक्षण", "Bengali": "স্বাস্থ্য শিক্ষা", "Gujarati": "સ્વાસ્થ્ય શિક્ષણ", "Punjabi": "ਸਿਹਤ ਸਿੱਖਿਆ", "Malayalam": "ആരോഗ്യ വിദ്യാഭ്യാസം", "Odia": "ସ୍ୱାସ୍ଥ୍ୟ ଶିକ୍ଷା"
    },
    "Information Technology": {
        "English": "Information Technology", "Hindi": "सूचना प्रौद्योगिकी", "Kannada": "ಮಾಹಿತಿ ತಂತ್ರಜ್ಞಾನ", "Tamil": "தகவல் தொழில்நுட்பம்", "Telugu": "సమాచార సాంకేతికత", "Marathi": "माहिती तंत्रज्ञान", "Bengali": "তথ্য প্রযুক্তি", "Gujarati": "માહિતી ટેકનોલોજી", "Punjabi": "ਸੂਚਨਾ ਤਕਨਾਲੋਜੀ", "Malayalam": "വിവര സാങ്കേതികവിദ്യ", "Odia": "ସୂଚନା ପ୍ରଯୁକ୍ତି"
    },
    "Primary Education": {
        "English": "Primary Education", "Hindi": "प्राथमिक शिक्षा", "Kannada": "ಪ್ರಾಥಮಿಕ ಶಿಕ್ಷಣ", "Tamil": "தொடக்கக் கல்வி", "Telugu": "ప్రాథమిక విద్య", "Marathi": "प्राथमिक शिक्षण", "Bengali": "প্রাথমিক শিক্ষা", "Gujarati": "પ્રાથમિક શિક્ષણ", "Punjabi": "ਮੁੱਢਲੀ ਸਿੱਖਿਆ", "Malayalam": "പ്രാഥമിക വിദ്യാഭ്യാസം", "Odia": "ପ୍ରାଥମିକ ଶିକ୍ଷା"
    },
    "Economics": {
        "English": "Economics", "Hindi": "अर्थशास्त्र", "Kannada": "ಅರ್ಥಶಾಸ್ತ್ರ", "Tamil": "பொருளியல்", "Telugu": "ఆర్థిక శాస్త్రం", "Marathi": "अर्थशास्त्र", "Bengali": "অর্থনীতি", "Gujarati": "અર્થશાસ્ત્ર", "Punjabi": "ਅਰਥ ਸ਼ਾਸਤਰ", "Malayalam": "സാമ്പത്തിക ശാസ്ത്രം", "Odia": "ଅର୍ଥଶାସ୍ତ୍ର"
    },
    "General Knowledge": {
        "English": "General Knowledge", "Hindi": "सामान्य ज्ञान", "Kannada": "ಸಾಮಾನ್ಯ ಜ್ಞಾನ", "Tamil": "பொது அறிவு", "Telugu": "సాధారణ జ్ఞానం", "Marathi": "सामान्य ज्ञान", "Bengali": "সাধারণ জ্ঞান", "Gujarati": "સામાન્ય જ્ઞાન", "Punjabi": "ਆਮ ਜਾਣਕਾਰੀ", "Malayalam": "പൊതുവിജ്ഞാനം", "Odia": "ସାଧାରଣ ଜ୍ଞାନ"
    },
    "Art": {
        "English": "Art", "Hindi": "कला", "Kannada": "ಕಲೆ", "Tamil": "கலை", "Telugu": "కళ", "Marathi": "कला", "Bengali": "কলা", "Gujarati": "કલા", "Punjabi": "ਕਲਾ", "Malayalam": "കല", "Odia": "କଳା"
    },
    "Music": {
        "English": "Music", "Hindi": "संगीत", "Kannada": "ಸಂಗೀತ", "Tamil": "இசை", "Telugu": "సంగీతం", "Marathi": "संगीत", "Bengali": "সংগীত", "Gujarati": "સંગીત", "Punjabi": "ਸੰਗੀਤ", "Malayalam": "സംഗീതം", "Odia": "ସଙ୍ଗୀତ"
    },
    "Moral Science": {
        "English": "Moral Science", "Hindi": "नैतिक शिक्षा", "Kannada": "ನೈತಿಕ ಶಿಕ್ಷಣ", "Tamil": "ஒழுக்க அறிவியல்", "Telugu": "నైతిక శాస్త్రం", "Marathi": "नैतिक शिक्षण", "Bengali": "নৈতিক শিক্ষা", "Gujarati": "નૈતિક શિક્ષણ", "Punjabi": "ਨੈਤਿਕ ਸਿੱਖਿਆ", "Malayalam": "ധാർമിക ശാസ്ത്രം", "Odia": "ନୈତିକ ଶିକ୍ଷା"
    },
    "Assessment result": {
        "English": "Assessment result", "Hindi": "मूल्यांकन परिणाम", "Kannada": "ಮೌಲ್ಯಮಾಪನ ಫಲಿತಾಂಶ", "Tamil": "மதிப்பீட்டு முடிவு", "Telugu": "మూల్యాంకన ఫలితం", "Marathi": "मूल्यांकन निकाल", "Bengali": "মূল্যায়ন ফলাফল", "Gujarati": "મૂલ્યાંકન પરિણામ", "Punjabi": "ਮੁਲਾਂਕਣ ਨਤੀਜਾ", "Malayalam": "മൂല്യനിർണ്ണയ ഫലം", "Odia": "ମୂଲ୍ୟାଙ୍କନ ଫଳାଫଳ"
    },
    "AI-graded against the rubric below.": {
        "English": "AI-graded against the rubric below.", "Hindi": "नीचे दिए गए रूब्रिक के अनुसार AI द्वारा मूल्यांकित।", "Kannada": "ಕೆಳಗಿನ ರೂಬ್ರಿಕ್‌ಗೆ ಅನುಗುಣವಾಗಿ AI ಮೌಲ್ಯಮಾಪನ ಮಾಡಿದೆ.", "Tamil": "கீழே உள்ள மதிப்பீட்டுத் தரக்கூறுப்படி AI மதிப்பெண் வழங்கியது.", "Telugu": "క్రింది రూబ్రిక్ ఆధారంగా AI గ్రేడ్ చేసింది.", "Marathi": "खालील रुब्रिकनुसार AI ने मूल्यांकन केले.", "Bengali": "নীচের রুব্রিক অনুসারে AI মূল্যায়ন করেছে।", "Gujarati": "નીચેના રૂબ્રિક અનુસાર AI દ્વારા ગ્રેડ આપવામાં આવ્યો.", "Punjabi": "ਹੇਠਾਂ ਦਿੱਤੇ ਰੁਬਰਿਕ ਅਨੁਸਾਰ AI ਨੇ ਗ੍ਰੇਡ ਕੀਤਾ।", "Malayalam": "താഴെയുള്ള റൂബ്രിക്ക് അനുസരിച്ച് AI ഗ്രേഡ് ചെയ്തു.", "Odia": "ତଳେ ଦିଆଯାଇଥିବା ରୁବ୍ରିକ୍ ଅନୁଯାୟୀ AI ଗ୍ରେଡ୍ କରିଛି।"
    },
    "AI-generated grade. Please verify the transcript and feedback before sharing with the student or parent.": {
        "English": "AI-generated grade. Please verify the transcript and feedback before sharing with the student or parent.", "Hindi": "AI द्वारा उत्पन्न ग्रेड। छात्र या अभिभावक के साथ साझा करने से पहले कृपया प्रतिलेख और प्रतिक्रिया सत्यापित करें।", "Kannada": "AI-ರಚಿತ ಗ್ರೇಡ್. ವಿದ್ಯಾರ್ಥಿ ಅಥವಾ ಪೋಷಕರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳುವ ಮೊದಲು ದಯವಿಟ್ಟು ಪ್ರತಿಲಿಪಿ ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.", "Tamil": "AI உருவாக்கிய மதிப்பெண். மாணவர் அல்லது பெற்றோருடன் பகிர்வதற்கு முன் படியெடுப்பையும் கருத்தையும் சரிபார்க்கவும்.", "Telugu": "AI రూపొందించిన గ్రేడ్. విద్యార్థి లేదా తల్లిదండ్రులతో పంచుకునే ముందు ట్రాన్‌స్క్రిప్ట్ మరియు ఫీడ్‌బ్యాక్‌ను దయచేసి ధృవీకరించండి.", "Marathi": "AI-निर्मित ग्रेड. विद्यार्थी किंवा पालकांसोबत शेअर करण्यापूर्वी कृपया ट्रान्सक्रिप्ट आणि अभिप्राय तपासा.", "Bengali": "AI-উৎপন্ন গ্রেড। ছাত্র বা অভিভাবকের সাথে শেয়ার করার আগে অনুগ্রহ করে প্রতিলিপি ও মতামত যাচাই করুন।", "Gujarati": "AI-જનરેટ કરેલ ગ્રેડ. વિદ્યાર્થી અથવા વાલી સાથે શેર કરતા પહેલા કૃપા કરીને ટ્રાન્સક્રિપ્ટ અને પ્રતિસાદ ચકાસો.", "Punjabi": "AI ਦੁਆਰਾ ਬਣਾਇਆ ਗ੍ਰੇਡ। ਵਿਦਿਆਰਥੀ ਜਾਂ ਮਾਪਿਆਂ ਨਾਲ ਸਾਂਝਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਕਿਰਪਾ ਕਰਕੇ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਅਤੇ ਫੀਡਬੈਕ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।", "Malayalam": "AI സൃഷ്ടിച്ച ഗ്രേഡ്. വിദ്യാർത്ഥിയുമായോ രക്ഷിതാവുമായോ പങ്കിടുന്നതിന് മുമ്പ് ദയവായി ട്രാൻസ്ക്രിപ്റ്റും ഫീഡ്ബാക്കും പരിശോധിക്കുക.", "Odia": "AI ଦ୍ୱାରା ସୃଷ୍ଟି ଗ୍ରେଡ୍। ଛାତ୍ର କିମ୍ବା ଅଭିଭାବକଙ୍କ ସହିତ ସେୟାର କରିବା ପୂର୍ବରୁ ଦୟାକରି ଟ୍ରାନ୍ସକ୍ରିପ୍ଟ ଓ ମତାମତ ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "{{earned}} of {{total}} points": {
        "English": "{{earned}} of {{total}} points", "Hindi": "{{total}} में से {{earned}} अंक", "Kannada": "{{total}} ಅಂಕಗಳಲ್ಲಿ {{earned}}", "Tamil": "{{total}} மதிப்பெண்களில் {{earned}}", "Telugu": "{{total}} పాయింట్లలో {{earned}}", "Marathi": "{{total}} पैकी {{earned}} गुण", "Bengali": "{{total}} এর মধ্যে {{earned}} পয়েন্ট", "Gujarati": "{{total}} માંથી {{earned}} પોઇન્ટ", "Punjabi": "{{total}} ਵਿੱਚੋਂ {{earned}} ਅੰਕ", "Malayalam": "{{total}} പോയിന്റിൽ {{earned}}", "Odia": "{{total}} ମଧ୍ୟରୁ {{earned}} ପଏଣ୍ଟ"
    },
    "Per-criterion scores": {
        "English": "Per-criterion scores", "Hindi": "मानदंड-वार अंक", "Kannada": "ಮಾನದಂಡವಾರು ಅಂಕಗಳು", "Tamil": "அளவுகோல் வாரியான மதிப்பெண்கள்", "Telugu": "ప్రమాణాల వారీ స్కోర్లు", "Marathi": "निकषनिहाय गुण", "Bengali": "মানদণ্ড-ভিত্তিক স্কোর", "Gujarati": "માપદંડ-વાર સ્કોર", "Punjabi": "ਮਾਪਦੰਡ-ਅਨੁਸਾਰ ਅੰਕ", "Malayalam": "മാനദണ്ഡ പ്രകാരമുള്ള സ്കോറുകൾ", "Odia": "ମାନଦଣ୍ଡ ଅନୁଯାୟୀ ସ୍କୋର"
    },
    "Criterion": {
        "English": "Criterion", "Hindi": "मानदंड", "Kannada": "ಮಾನದಂಡ", "Tamil": "அளவுகோல்", "Telugu": "ప్రమాణం", "Marathi": "निकष", "Bengali": "মানদণ্ড", "Gujarati": "માપદંડ", "Punjabi": "ਮਾਪਦੰਡ", "Malayalam": "മാനദണ്ഡം", "Odia": "ମାନଦଣ୍ଡ"
    },
    "Level": {
        "English": "Level", "Hindi": "स्तर", "Kannada": "ಮಟ್ಟ", "Tamil": "நிலை", "Telugu": "స్థాయి", "Marathi": "स्तर", "Bengali": "স্তর", "Gujarati": "સ્તર", "Punjabi": "ਪੱਧਰ", "Malayalam": "നില", "Odia": "ସ୍ତର"
    },
    "Points": {
        "English": "Points", "Hindi": "अंक", "Kannada": "ಅಂಕಗಳು", "Tamil": "மதிப்பெண்கள்", "Telugu": "పాయింట్లు", "Marathi": "गुण", "Bengali": "পয়েন্ট", "Gujarati": "પોઇન્ટ", "Punjabi": "ਅੰਕ", "Malayalam": "പോയിന്റുകൾ", "Odia": "ପଏଣ୍ଟ"
    },
    "Confidence": {
        "English": "Confidence", "Hindi": "विश्वास स्तर", "Kannada": "ವಿಶ್ವಾಸ", "Tamil": "நம்பகத்தன்மை", "Telugu": "విశ్వాసం", "Marathi": "विश्वास", "Bengali": "আত্মবিশ্বাস", "Gujarati": "વિશ્વાસ", "Punjabi": "ਭਰੋਸਾ", "Malayalam": "ആത്മവിശ്വാസം", "Odia": "ଆତ୍ମବିଶ୍ୱାସ"
    },
    "Strengths": {
        "English": "Strengths", "Hindi": "मजबूत पक्ष", "Kannada": "ಸಾಮರ್ಥ್ಯಗಳು", "Tamil": "வலிமைகள்", "Telugu": "బలాలు", "Marathi": "बलस्थाने", "Bengali": "শক্তি", "Gujarati": "મજબૂત બાજુઓ", "Punjabi": "ਮਜ਼ਬੂਤੀਆਂ", "Malayalam": "ശക്തികൾ", "Odia": "ଶକ୍ତି"
    },
    "Things to improve": {
        "English": "Things to improve", "Hindi": "सुधार के क्षेत्र", "Kannada": "ಸುಧಾರಿಸಬೇಕಾದ ಅಂಶಗಳು", "Tamil": "மேம்படுத்த வேண்டியவை", "Telugu": "మెరుగుపరచవలసిన అంశాలు", "Marathi": "सुधारण्याच्या गोष्टी", "Bengali": "উন্নতির জায়গা", "Gujarati": "સુધારવાની બાબતો", "Punjabi": "ਸੁਧਾਰਨ ਵਾਲੀਆਂ ਗੱਲਾਂ", "Malayalam": "മെച്ചപ്പെടുത്തേണ്ട കാര്യങ്ങൾ", "Odia": "ଉନ୍ନତି କରିବାକୁ ଥିବା ବିଷୟ"
    },
    "Next steps": {
        "English": "Next steps", "Hindi": "अगले कदम", "Kannada": "ಮುಂದಿನ ಹಂತಗಳು", "Tamil": "அடுத்த படிகள்", "Telugu": "తదుపరి దశలు", "Marathi": "पुढील पावले", "Bengali": "পরবর্তী ধাপ", "Gujarati": "આગળના પગલાં", "Punjabi": "ਅਗਲੇ ਕਦਮ", "Malayalam": "അടുത്ത ഘട്ടങ്ങൾ", "Odia": "ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ"
    },
    "Note for the student": {
        "English": "Note for the student", "Hindi": "छात्र के लिए नोट", "Kannada": "ವಿದ್ಯಾರ್ಥಿಗಾಗಿ ಸೂಚನೆ", "Tamil": "மாணவருக்கான குறிப்பு", "Telugu": "విద్యార్థి కోసం గమనిక", "Marathi": "विद्यार्थ्यासाठी टीप", "Bengali": "ছাত্রের জন্য নোট", "Gujarati": "વિદ્યાર્થી માટે નોંધ", "Punjabi": "ਵਿਦਿਆਰਥੀ ਲਈ ਨੋਟ", "Malayalam": "വിദ്യാർത്ഥിക്കുള്ള കുറിപ്പ്", "Odia": "ଛାତ୍ର ପାଇଁ ଟିପ୍ପଣୀ"
    },
    "What the AI read": {
        "English": "What the AI read", "Hindi": "AI ने क्या पढ़ा", "Kannada": "AI ಏನು ಓದಿತು", "Tamil": "AI என்ன படித்தது", "Telugu": "AI ఏమి చదివింది", "Marathi": "AI ने काय वाचले", "Bengali": "AI কী পড়েছে", "Gujarati": "AI એ શું વાંચ્યું", "Punjabi": "AI ਨੇ ਕੀ ਪੜ੍ਹਿਆ", "Malayalam": "AI എന്താണ് വായിച്ചത്", "Odia": "AI କଣ ପଢ଼ିଲା"
    },
    "Edit if any line looks wrong, then save to keep your version.": {
        "English": "Edit if any line looks wrong, then save to keep your version.", "Hindi": "यदि कोई पंक्ति गलत लगे तो संपादित करें, फिर अपना संस्करण रखने के लिए सहेजें।", "Kannada": "ಯಾವುದೇ ಸಾಲು ತಪ್ಪಾಗಿ ಕಂಡರೆ ಸಂಪಾದಿಸಿ, ನಂತರ ನಿಮ್ಮ ಆವೃತ್ತಿ ಉಳಿಸಲು ಸೇವ್ ಮಾಡಿ.", "Tamil": "ஏதேனும் வரி தவறாக இருந்தால் திருத்தி, உங்கள் பதிப்பை வைத்திருக்க சேமிக்கவும்.", "Telugu": "ఏదైనా లైన్ తప్పుగా అనిపిస్తే సవరించండి, ఆపై మీ వెర్షన్‌ను ఉంచడానికి సేవ్ చేయండి.", "Marathi": "एखादी ओळ चुकीची दिसल्यास संपादित करा, नंतर तुमची आवृत्ती ठेवण्यासाठी सेव्ह करा.", "Bengali": "কোনো লাইন ভুল মনে হলে সম্পাদনা করুন, তারপর আপনার সংস্করণ রাখতে সংরক্ষণ করুন।", "Gujarati": "જો કોઈ લાઇન ખોટી લાગે તો સંપાદિત કરો, પછી તમારી આવૃત્તિ રાખવા માટે સાચવો.", "Punjabi": "ਜੇ ਕੋਈ ਲਾਈਨ ਗਲਤ ਲੱਗੇ ਤਾਂ ਸੰਪਾਦਿਤ ਕਰੋ, ਫਿਰ ਆਪਣਾ ਸੰਸਕਰਣ ਰੱਖਣ ਲਈ ਸੇਵ ਕਰੋ।", "Malayalam": "ഏതെങ്കിലും വരി തെറ്റാണെന്ന് തോന്നിയാൽ എഡിറ്റ് ചെയ്യുക, പിന്നെ നിങ്ങളുടെ പതിപ്പ് നിലനിർത്താൻ സേവ് ചെയ്യുക.", "Odia": "କୌଣସି ଲାଇନ୍ ଭୁଲ୍ ଲାଗିଲେ ସମ୍ପାଦନ କରନ୍ତୁ, ତାପରେ ଆପଣଙ୍କ ସଂସ୍କରଣ ରଖିବାକୁ ସେଭ୍ କରନ୍ତୁ।"
    },
    "Save edited transcript": {
        "English": "Save edited transcript", "Hindi": "संपादित प्रतिलेख सहेजें", "Kannada": "ಸಂಪಾದಿಸಿದ ಪ್ರತಿಲಿಪಿ ಉಳಿಸಿ", "Tamil": "திருத்திய படியெடுப்பைச் சேமி", "Telugu": "సవరించిన ట్రాన్‌స్క్రిప్ట్ సేవ్ చేయండి", "Marathi": "संपादित ट्रान्सक्रिप्ट सेव्ह करा", "Bengali": "সম্পাদিত প্রতিলিপি সংরক্ষণ করুন", "Gujarati": "સંપાદિત ટ્રાન્સક્રિપ્ટ સાચવો", "Punjabi": "ਸੰਪਾਦਿਤ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਸੇਵ ਕਰੋ", "Malayalam": "എഡിറ്റ് ചെയ്ത ട്രാൻസ്ക്രിപ്റ്റ് സേവ് ചെയ്യുക", "Odia": "ସମ୍ପାଦିତ ଟ୍ରାନ୍ସକ୍ରିପ୍ଟ ସେଭ୍ କରନ୍ତୁ"
    },
    "Model confidence": {
        "English": "Model confidence", "Hindi": "मॉडल विश्वास", "Kannada": "ಮಾದರಿಯ ವಿಶ್ವಾಸ", "Tamil": "மாதிரியின் நம்பகத்தன்மை", "Telugu": "మోడల్ విశ్వాసం", "Marathi": "मॉडेलचा विश्वास", "Bengali": "মডেল আত্মবিশ্বাস", "Gujarati": "મોડેલ વિશ્વાસ", "Punjabi": "ਮਾਡਲ ਭਰੋਸਾ", "Malayalam": "മോഡൽ ആത്മവിശ്വാസം", "Odia": "ମଡେଲ୍ ଆତ୍ମବିଶ୍ୱାସ"
    },
    "Play feedback": {
        "English": "Play feedback", "Hindi": "प्रतिक्रिया चलाएं", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಪ್ಲೇ ಮಾಡಿ", "Tamil": "கருத்தை இயக்கு", "Telugu": "ఫీడ్‌బ్యాక్ ప్లే చేయండి", "Marathi": "अभिप्राय प्ले करा", "Bengali": "মতামত চালান", "Gujarati": "પ્રતિસાદ ચલાવો", "Punjabi": "ਫੀਡਬੈਕ ਚਲਾਓ", "Malayalam": "ഫീഡ്ബാക്ക് പ്ലേ ചെയ്യുക", "Odia": "ମତାମତ ଚଲାନ୍ତୁ"
    },
    "Stop playback": {
        "English": "Stop playback", "Hindi": "प्लेबैक रोकें", "Kannada": "ಪ್ಲೇಬ್ಯಾಕ್ ನಿಲ್ಲಿಸಿ", "Tamil": "இயக்கத்தை நிறுத்து", "Telugu": "ప్లేబ్యాక్ ఆపండి", "Marathi": "प्लेबॅक थांबवा", "Bengali": "প্লেব্যাক বন্ধ করুন", "Gujarati": "પ્લેબેક બંધ કરો", "Punjabi": "ਪਲੇਬੈਕ ਰੋਕੋ", "Malayalam": "പ്ലേബാക്ക് നിർത്തുക", "Odia": "ପ୍ଲେବ୍ୟାକ୍ ବନ୍ଦ କରନ୍ତୁ"
    },
    "Loading audio…": {
        "English": "Loading audio…", "Hindi": "ऑडियो लोड हो रहा है…", "Kannada": "ಆಡಿಯೋ ಲೋಡ್ ಆಗುತ್ತಿದೆ…", "Tamil": "ஆடியோ ஏற்றப்படுகிறது…", "Telugu": "ఆడియో లోడ్ అవుతోంది…", "Marathi": "ऑडिओ लोड होत आहे…", "Bengali": "অডিও লোড হচ্ছে…", "Gujarati": "ઓડિયો લોડ થઈ રહ્યો છે…", "Punjabi": "ਆਡੀਓ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", "Malayalam": "ഓഡിയോ ലോഡ് ചെയ്യുന്നു…", "Odia": "ଅଡିଓ ଲୋଡ୍ ହେଉଛି…"
    },
    "Could not play feedback. Please try again.": {
        "English": "Could not play feedback. Please try again.", "Hindi": "प्रतिक्रिया नहीं चला सका। कृपया पुनः प्रयास करें।", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಪ್ಲೇ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "கருத்தை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఫీడ్‌బ్యాక్ ప్లే చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "अभिप्राय प्ले करता आला नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "মতামত চালানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "પ્રતિસાદ ચલાવી શકાયો નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਫੀਡਬੈਕ ਚਲਾਇਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഫീഡ്ബാക്ക് പ്ലേ ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ମତାମତ ଚଲାଯାଇପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Download PDF": {
        "English": "Download PDF", "Hindi": "PDF डाउनलोड करें", "Kannada": "PDF ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ", "Tamil": "PDF பதிவிறக்கவும்", "Telugu": "PDF డౌన్‌లోడ్ చేయండి", "Marathi": "PDF डाउनलोड करा", "Bengali": "PDF ডাউনলোড করুন", "Gujarati": "PDF ડાઉનલોડ કરો", "Punjabi": "PDF ਡਾਊਨਲੋਡ ਕਰੋ", "Malayalam": "PDF ഡൗൺലോഡ് ചെയ്യുക", "Odia": "PDF ଡାଉନଲୋଡ୍ କରନ୍ତୁ"
    },
    "PDF download failed.": {
        "English": "PDF download failed.", "Hindi": "PDF डाउनलोड विफल।", "Kannada": "PDF ಡೌನ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ.", "Tamil": "PDF பதிவிறக்கம் தோல்வியடைந்தது.", "Telugu": "PDF డౌన్‌లోడ్ విఫలమైంది.", "Marathi": "PDF डाउनलोड अयशस्वी.", "Bengali": "PDF ডাউনলোড ব্যর্থ হয়েছে।", "Gujarati": "PDF ડાઉનલોડ નિષ્ફળ.", "Punjabi": "PDF ਡਾਊਨਲੋਡ ਅਸਫਲ।", "Malayalam": "PDF ഡൗൺലോഡ് പരാജയപ്പെട്ടു.", "Odia": "PDF ଡାଉନଲୋଡ୍ ବିଫଳ ହେଲା।"
    },
    "Copied feedback to clipboard.": {
        "English": "Copied feedback to clipboard.", "Hindi": "प्रतिक्रिया क्लिपबोर्ड पर कॉपी हुई।", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.", "Tamil": "கருத்து கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது.", "Telugu": "ఫీడ్‌బ్యాక్ క్లిప్‌బోర్డ్‌కి కాపీ చేయబడింది.", "Marathi": "अभिप्राय क्लिपबोर्डवर कॉपी केला.", "Bengali": "মতামত ক্লিপবোর্ডে কপি করা হয়েছে।", "Gujarati": "પ્રતિસાદ ક્લિપબોર્ડ પર કૉપિ થયો.", "Punjabi": "ਫੀਡਬੈਕ ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਕੀਤਾ।", "Malayalam": "ഫീഡ്ബാക്ക് ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി.", "Odia": "ମତାମତ କ୍ଲିପବୋର୍ଡକୁ କପି ହୋଇଛି।"
    },
    "Share failed.": {
        "English": "Share failed.", "Hindi": "साझा करना विफल।", "Kannada": "ಹಂಚಿಕೆ ವಿಫಲವಾಗಿದೆ.", "Tamil": "பகிர்வு தோல்வியடைந்தது.", "Telugu": "షేర్ విఫలమైంది.", "Marathi": "शेअर करणे अयशस्वी.", "Bengali": "শেয়ার ব্যর্থ হয়েছে।", "Gujarati": "શેર નિષ્ફળ.", "Punjabi": "ਸਾਂਝਾ ਕਰਨਾ ਅਸਫਲ।", "Malayalam": "പങ്കിടൽ പരാജയപ്പെട്ടു.", "Odia": "ସେୟାର ବିଫଳ ହେଲା।"
    },
    "Heads up": {
        "English": "Heads up", "Hindi": "ध्यान दें", "Kannada": "ಗಮನಿಸಿ", "Tamil": "கவனிக்கவும்", "Telugu": "గమనిక", "Marathi": "लक्ष द्या", "Bengali": "লক্ষ্য করুন", "Gujarati": "ધ્યાન આપો", "Punjabi": "ਧਿਆਨ ਦਿਓ", "Malayalam": "ശ്രദ്ധിക്കുക", "Odia": "ଧ୍ୟାନ ଦିଅନ୍ତୁ"
    },
    "The page looked blank or unreadable. Score set to 0.": {
        "English": "The page looked blank or unreadable. Score set to 0.", "Hindi": "पृष्ठ खाली या अपठनीय दिखाई दिया। स्कोर 0 कर दिया गया।", "Kannada": "ಪುಟ ಖಾಲಿ ಅಥವಾ ಓದಲಾಗದಂತೆ ಕಂಡಿತು. ಸ್ಕೋರ್ 0 ಗೆ ಹೊಂದಿಸಲಾಗಿದೆ.", "Tamil": "பக்கம் காலியாக அல்லது படிக்க முடியாததாக தோன்றியது. மதிப்பெண் 0 ஆக அமைக்கப்பட்டது.", "Telugu": "పేజీ ఖాళీగా లేదా చదవలేనట్లుగా కనిపించింది. స్కోర్ 0 కు సెట్ చేయబడింది.", "Marathi": "पृष्ठ रिकामे किंवा वाचण्यायोग्य नसलेले दिसले. गुण 0 केले.", "Bengali": "পৃষ্ঠাটি ফাঁকা বা অপাঠ্য মনে হয়েছে। স্কোর 0 করা হয়েছে।", "Gujarati": "પાનું ખાલી અથવા અવાંચ્ય દેખાયું. સ્કોર 0 સેટ કર્યો.", "Punjabi": "ਪੰਨਾ ਖਾਲੀ ਜਾਂ ਅਪੜ੍ਹਨਯੋਗ ਲੱਗਾ। ਸਕੋਰ 0 ਕਰ ਦਿੱਤਾ।", "Malayalam": "പേജ് ശൂന്യമോ വായിക്കാനാകാത്തതോ ആയി കണ്ടു. സ്കോർ 0 ആക്കി.", "Odia": "ପୃଷ୍ଠା ଖାଲି କିମ୍ବା ଅପଠନୀୟ ଦେଖାଗଲା। ସ୍କୋର 0 କୁ ସେଟ୍ କରାଗଲା।"
    },
    "Low-contrast photo — accuracy may be reduced.": {
        "English": "Low-contrast photo — accuracy may be reduced.", "Hindi": "कम कॉन्ट्रास्ट वाला फोटो, सटीकता कम हो सकती है।", "Kannada": "ಕಡಿಮೆ ಕಾಂಟ್ರಾಸ್ಟ್ ಫೋಟೋ, ನಿಖರತೆ ಕಡಿಮೆಯಾಗಬಹುದು.", "Tamil": "குறைந்த மாறுபாடு கொண்ட புகைப்படம், துல்லியம் குறையக்கூடும்.", "Telugu": "తక్కువ కాంట్రాస్ట్ ఫోటో, ఖచ్చితత్వం తగ్గవచ్చు.", "Marathi": "कमी कॉन्ट्रास्ट फोटो, अचूकता कमी होऊ शकते.", "Bengali": "কম কনট্রাস্ট ছবি, নির্ভুলতা কমতে পারে।", "Gujarati": "ઓછા કોન્ટ્રાસ્ટવાળો ફોટો, ચોકસાઈ ઘટી શકે છે.", "Punjabi": "ਘੱਟ ਕੰਟ੍ਰਾਸਟ ਵਾਲੀ ਫੋਟੋ, ਸ਼ੁੱਧਤਾ ਘੱਟ ਸਕਦੀ ਹੈ।", "Malayalam": "കുറഞ്ഞ കോൺട്രാസ്റ്റുള്ള ഫോട്ടോ, കൃത്യത കുറയാം.", "Odia": "କମ୍ କଣ୍ଟ୍ରାଷ୍ଟ୍ ଫଟୋ, ସଠିକତା କମିପାରେ।"
    },
    "Some regions of the page were partial or unclear.": {
        "English": "Some regions of the page were partial or unclear.", "Hindi": "पृष्ठ के कुछ हिस्से अधूरे या अस्पष्ट थे।", "Kannada": "ಪುಟದ ಕೆಲವು ಭಾಗಗಳು ಭಾಗಶಃ ಅಥವಾ ಅಸ್ಪಷ್ಟವಾಗಿದ್ದವು.", "Tamil": "பக்கத்தின் சில பகுதிகள் பகுதியளவில் அல்லது தெளிவாக இல்லை.", "Telugu": "పేజీలోని కొన్ని ప్రాంతాలు పాక్షికంగా లేదా అస్పష్టంగా ఉన్నాయి.", "Marathi": "पृष्ठाचे काही भाग अपूर्ण किंवा अस्पष्ट होते.", "Bengali": "পৃষ্ঠার কিছু অংশ আংশিক বা অস্পষ্ট ছিল।", "Gujarati": "પાનાંના કેટલાક ભાગ આંશિક અથવા અસ્પષ્ટ હતા.", "Punjabi": "ਪੰਨੇ ਦੇ ਕੁਝ ਹਿੱਸੇ ਅਧੂਰੇ ਜਾਂ ਅਸਪਸ਼ਟ ਸਨ।", "Malayalam": "പേജിന്റെ ചില ഭാഗങ്ങൾ ഭാഗികമോ വ്യക്തമല്ലാത്തതോ ആയിരുന്നു.", "Odia": "ପୃଷ୍ଠାର କିଛି ଅଞ୍ଚଳ ଆଂଶିକ କିମ୍ବା ଅସ୍ପଷ୍ଟ ଥିଲା।"
    },
    "AI's grade was contradicted by a blank transcript and was reset to 0.": {
        "English": "AI's grade was contradicted by a blank transcript and was reset to 0.", "Hindi": "AI के ग्रेड का खाली प्रतिलेख से विरोधाभास हुआ और इसे 0 कर दिया गया।", "Kannada": "AI ಗ್ರೇಡ್‌ಗೆ ಖಾಲಿ ಪ್ರತಿಲಿಪಿ ವಿರೋಧಿಸಿತು ಮತ್ತು ಅದನ್ನು 0 ಗೆ ಮರುಹೊಂದಿಸಲಾಯಿತು.", "Tamil": "AI இன் மதிப்பெண்ணுக்கு வெற்று படியெடுப்பு முரண்பட்டு 0 ஆக மீட்டமைக்கப்பட்டது.", "Telugu": "AI గ్రేడ్‌ని ఖాళీ ట్రాన్‌స్క్రిప్ట్ విరుద్ధంగా ఉంది, దానిని 0 కి రీసెట్ చేశాం.", "Marathi": "AI च्या ग्रेडला रिक्त ट्रान्सक्रिप्टने विरोध केला आणि तो 0 वर रीसेट केला.", "Bengali": "AI-এর গ্রেডের সাথে ফাঁকা প্রতিলিপির বিরোধ হয়েছে এবং তা 0 তে রিসেট করা হয়েছে।", "Gujarati": "AI ના ગ્રેડનો ખાલી ટ્રાન્સક્રિપ્ટ સાથે વિરોધ થયો અને તે 0 પર રીસેટ કરાયો.", "Punjabi": "AI ਦੇ ਗ੍ਰੇਡ ਦਾ ਖਾਲੀ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਨਾਲ ਵਿਰੋਧ ਹੋਇਆ ਅਤੇ ਇਸਨੂੰ 0 'ਤੇ ਰੀਸੈੱਟ ਕੀਤਾ ਗਿਆ।", "Malayalam": "AI യുടെ ഗ്രേഡിന് ശൂന്യമായ ട്രാൻസ്ക്രിപ്റ്റ് വിരുദ്ധമായതിനാൽ 0 ആയി പുനഃസജ്ജമാക്കി.", "Odia": "AI ର ଗ୍ରେଡ୍ ଖାଲି ଟ୍ରାନ୍ସକ୍ରିପ୍ଟ ସହ ବିରୋଧ ହେଲା ଏବଂ 0 କୁ ରିସେଟ୍ କରାଗଲା।"
    },
    "Feedback language did not match the requested language.": {
        "English": "Feedback language did not match the requested language.", "Hindi": "प्रतिक्रिया की भाषा अनुरोधित भाषा से मेल नहीं खाई।", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಭಾಷೆ ಕೋರಿದ ಭಾಷೆಗೆ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ.", "Tamil": "கருத்து மொழி கோரிய மொழியுடன் பொருந்தவில்லை.", "Telugu": "ఫీడ్‌బ్యాక్ భాష అభ్యర్థించిన భాషతో సరిపోలలేదు.", "Marathi": "अभिप्रायाची भाषा विनंती केलेल्या भाषेशी जुळली नाही.", "Bengali": "মতামতের ভাষা অনুরোধকৃত ভাষার সাথে মেলেনি।", "Gujarati": "પ્રતિસાદની ભાષા વિનંતી કરેલી ભાષા સાથે મેળ ખાધી નહીં.", "Punjabi": "ਫੀਡਬੈਕ ਦੀ ਭਾਸ਼ਾ ਬੇਨਤੀ ਕੀਤੀ ਭਾਸ਼ਾ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਧੀ।", "Malayalam": "ഫീഡ്ബാക്ക് ഭാഷ അഭ്യർത്ഥിച്ച ഭാഷയുമായി പൊരുത്തപ്പെട്ടില്ല.", "Odia": "ମତାମତର ଭାଷା ଅନୁରୋଧ କରାଯାଇଥିବା ଭାଷା ସହ ମେଳ ଖାଇଲା ନାହିଁ।"
    },
    "SahayakAI Assessment": {
        "English": "SahayakAI Assessment", "Hindi": "SahayakAI मूल्यांकन", "Kannada": "SahayakAI ಮೌಲ್ಯಮಾಪನ", "Tamil": "SahayakAI மதிப்பீடு", "Telugu": "SahayakAI మూల్యాంకనం", "Marathi": "SahayakAI मूल्यांकन", "Bengali": "SahayakAI মূল্যায়ন", "Gujarati": "SahayakAI મૂલ્યાંકન", "Punjabi": "SahayakAI ਮੁਲਾਂਕਣ", "Malayalam": "SahayakAI മൂല്യനിർണ്ണയം", "Odia": "SahayakAI ମୂଲ୍ୟାଙ୍କନ"
    },
    "Assess a Student's Work": {
        "English": "Assess a Student's Work", "Hindi": "छात्र के कार्य का मूल्यांकन करें", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ", "Tamil": "மாணவரின் பணியை மதிப்பிடுங்கள்", "Telugu": "విద్యార్థి పనిని మూల్యాంకనం చేయండి", "Marathi": "विद्यार्थ्याच्या कामाचे मूल्यांकन करा", "Bengali": "ছাত্রের কাজ মূল্যায়ন করুন", "Gujarati": "વિદ્યાર્થીના કાર્યનું મૂલ્યાંકન કરો", "Punjabi": "ਵਿਦਿਆਰਥੀ ਦੇ ਕੰਮ ਦਾ ਮੁਲਾਂਕਣ ਕਰੋ", "Malayalam": "വിദ്യാർത്ഥിയുടെ ജോലി മൂല്യനിർണ്ണയം ചെയ്യുക", "Odia": "ଛାତ୍ରର କାର୍ଯ୍ୟ ମୂଲ୍ୟାଙ୍କନ କରନ୍ତୁ"
    },
    "Take one photo of a student's handwritten assignment. The AI will transcribe, score against a rubric, and suggest what to work on next.": {
        "English": "Take one photo of a student's handwritten assignment. The AI will transcribe, score against a rubric, and suggest what to work on next.", "Hindi": "छात्र के हस्तलिखित कार्य की एक फोटो लें। AI उसे लिपिबद्ध करेगा, रूब्रिक के अनुसार अंक देगा और आगे क्या करना है यह सुझाएगा।", "Kannada": "ವಿದ್ಯಾರ್ಥಿಯ ಕೈಬರಹದ ಕಾರ್ಯದ ಒಂದು ಫೋಟೋ ತೆಗೆಯಿರಿ. AI ಅದನ್ನು ಲಿಪ್ಯಂತರಿಸಿ, ರೂಬ್ರಿಕ್‌ಗೆ ಅನುಗುಣವಾಗಿ ಅಂಕ ನೀಡಿ, ಮುಂದೆ ಏನು ಮಾಡಬೇಕೆಂದು ಸೂಚಿಸುತ್ತದೆ.", "Tamil": "மாணவரின் கையெழுத்து பணியின் ஒரு புகைப்படத்தை எடுக்கவும். AI அதை எழுத்துப்பெயர்த்து, மதிப்பீட்டுத் தரக்கூறுப்படி மதிப்பெண் வழங்கி, அடுத்து என்ன செய்ய வேண்டும் என்பதை பரிந்துரைக்கும்.", "Telugu": "విద్యార్థి చేతిరాత అసైన్‌మెంట్ యొక్క ఒక ఫోటో తీయండి. AI దానిని ట్రాన్‌స్క్రైబ్ చేసి, రూబ్రిక్ ఆధారంగా స్కోర్ చేసి, తదుపరి ఏమి చేయాలో సూచిస్తుంది.", "Marathi": "विद्यार्थ्याच्या हस्तलिखित कामाचा एक फोटो घ्या. AI तो लिप्यंतरीत करेल, रुब्रिकनुसार गुण देईल आणि पुढे काय करायचे ते सुचवेल.", "Bengali": "ছাত্রের হাতে লেখা অ্যাসাইনমেন্টের একটি ছবি তুলুন। AI সেটি প্রতিলিপি করবে, রুব্রিক অনুযায়ী স্কোর দেবে এবং পরবর্তীতে কী করতে হবে তা পরামর্শ দেবে।", "Gujarati": "વિદ્યાર્થીના હસ્તલિખિત કાર્યનો એક ફોટો લો. AI તેને લિપ્યંતર કરશે, રૂબ્રિક અનુસાર સ્કોર આપશે અને આગળ શું કરવું તે સૂચવશે.", "Punjabi": "ਵਿਦਿਆਰਥੀ ਦੇ ਹੱਥ ਲਿਖੇ ਕੰਮ ਦੀ ਇੱਕ ਫੋਟੋ ਲਓ। AI ਇਸਨੂੰ ਲਿਪੀਅੰਤਰ ਕਰੇਗਾ, ਰੁਬਰਿਕ ਅਨੁਸਾਰ ਅੰਕ ਦੇਵੇਗਾ ਅਤੇ ਅੱਗੇ ਕੀ ਕਰਨਾ ਹੈ ਉਸਦੀ ਸਿਫਾਰਸ਼ ਕਰੇਗਾ।", "Malayalam": "വിദ്യാർത്ഥിയുടെ കൈയെഴുത്ത് അസൈൻമെന്റിന്റെ ഒരു ഫോട്ടോ എടുക്കുക. AI അത് ട്രാൻസ്ക്രൈബ് ചെയ്ത്, റൂബ്രിക്ക് അനുസരിച്ച് സ്കോർ നൽകി, അടുത്തത് എന്ത് ചെയ്യണമെന്ന് നിർദ്ദേശിക്കും.", "Odia": "ଛାତ୍ରର ହସ୍ତଲିଖିତ କାର୍ଯ୍ୟର ଗୋଟିଏ ଫଟୋ ନିଅନ୍ତୁ। AI ତାହାକୁ ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରିବ, ରୁବ୍ରିକ୍ ଅନୁଯାୟୀ ସ୍କୋର ଦେବ ଏବଂ ପରବର୍ତ୍ତୀ କଣ କରିବାକୁ ସୁପାରିଶ କରିବ।"
    },
    "Photo": {
        "English": "Photo", "Hindi": "फोटो", "Kannada": "ಫೋಟೋ", "Tamil": "புகைப்படம்", "Telugu": "ఫోటో", "Marathi": "फोटो", "Bengali": "ছবি", "Gujarati": "ફોટો", "Punjabi": "ਫੋਟੋ", "Malayalam": "ഫോട്ടോ", "Odia": "ଫଟୋ"
    },
    "About this assignment": {
        "English": "About this assignment", "Hindi": "इस असाइनमेंट के बारे में", "Kannada": "ಈ ಅಸೈನ್‌ಮೆಂಟ್ ಬಗ್ಗೆ", "Tamil": "இந்த பணி பற்றி", "Telugu": "ఈ అసైన్‌మెంట్ గురించి", "Marathi": "या असाइनमेंटबद्दल", "Bengali": "এই অ্যাসাইনমেন্ট সম্পর্কে", "Gujarati": "આ અસાઇનમેન્ટ વિશે", "Punjabi": "ਇਸ ਅਸਾਈਨਮੈਂਟ ਬਾਰੇ", "Malayalam": "ഈ അസൈൻമെന്റിനെക്കുറിച്ച്", "Odia": "ଏହି ଆସାଇନମେଣ୍ଟ ବିଷୟରେ"
    },
    "Helps the AI calibrate its feedback to the right class and subject.": {
        "English": "Helps the AI calibrate its feedback to the right class and subject.", "Hindi": "AI को सही कक्षा और विषय के अनुसार फीडबैक देने में मदद करता है।", "Kannada": "ಸರಿಯಾದ ತರಗತಿ ಮತ್ತು ವಿಷಯಕ್ಕೆ ತಕ್ಕಂತೆ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡಲು AI ಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.", "Tamil": "சரியான வகுப்பு மற்றும் பாடத்திற்கு ஏற்ப கருத்து வழங்க AI க்கு உதவுகிறது.", "Telugu": "సరైన తరగతి మరియు సబ్జెక్ట్‌కు అనుగుణంగా ఫీడ్‌బ్యాక్ ఇవ్వడానికి AIకి సహాయపడుతుంది.", "Marathi": "योग्य वर्ग आणि विषयासाठी अभिप्राय देण्यास AI ला मदत करते.", "Bengali": "সঠিক শ্রেণি ও বিষয়ের অনুযায়ী ফিডব্যাক দিতে AI-কে সাহায্য করে।", "Gujarati": "યોગ્ય વર્ગ અને વિષય માટે પ્રતિસાદ આપવામાં AI ને મદદ કરે છે.", "Punjabi": "ਸਹੀ ਜਮਾਤ ਅਤੇ ਵਿਸ਼ੇ ਅਨੁਸਾਰ ਫੀਡਬੈਕ ਦੇਣ ਵਿੱਚ AI ਦੀ ਮਦਦ ਕਰਦਾ ਹੈ।", "Malayalam": "ശരിയായ ക്ലാസിനും വിഷയത്തിനും അനുസരിച്ച് ഫീഡ്ബാക്ക് നൽകാൻ AI-യെ സഹായിക്കുന്നു.", "Odia": "ସଠିକ୍ ଶ୍ରେଣୀ ଓ ବିଷୟ ଅନୁଯାୟୀ ମତାମତ ଦେବାରେ AI କୁ ସାହାଯ୍ୟ କରେ।"
    },
    "Student handle (optional)": {
        "English": "Student handle (optional)", "Hindi": "विद्यार्थी पहचान (वैकल्पिक)", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಗುರುತು (ಐಚ್ಛಿಕ)", "Tamil": "மாணவர் அடையாளம் (விருப்பத்தேர்வு)", "Telugu": "విద్యార్థి గుర్తింపు (ఐచ్ఛికం)", "Marathi": "विद्यार्थी ओळख (पर्यायी)", "Bengali": "শিক্ষার্থীর পরিচয় (ঐচ্ছিক)", "Gujarati": "વિદ્યાર્થી ઓળખ (વૈકલ્પિક)", "Punjabi": "ਵਿਦਿਆਰਥੀ ਪਛਾਣ (ਵਿਕਲਪਿਕ)", "Malayalam": "വിദ്യാർത്ഥി ഐഡി (ഓപ്ഷണൽ)", "Odia": "ଛାତ୍ର ପରିଚୟ (ବୈକଳ୍ପିକ)"
    },
    "Use a roll number or alias — never the student's name.": {
        "English": "Use a roll number or alias — never the student's name.", "Hindi": "रोल नंबर या उपनाम का उपयोग करें, विद्यार्थी का नाम नहीं।", "Kannada": "ರೋಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಉಪನಾಮ ಬಳಸಿ, ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರನ್ನು ಎಂದಿಗೂ ಬಳಸಬೇಡಿ.", "Tamil": "ரோல் எண் அல்லது புனைப்பெயரைப் பயன்படுத்தவும், மாணவரின் பெயரை ஒருபோதும் பயன்படுத்த வேண்டாம்.", "Telugu": "రోల్ నంబర్ లేదా మారుపేరు వాడండి, విద్యార్థి పేరు ఎప్పుడూ వాడకండి.", "Marathi": "रोल नंबर किंवा टोपणनाव वापरा, विद्यार्थ्याचे नाव कधीही वापरू नका.", "Bengali": "রোল নম্বর বা ছদ্মনাম ব্যবহার করুন, শিক্ষার্থীর নাম কখনোই নয়।", "Gujarati": "રોલ નંબર અથવા ઉપનામ વાપરો, વિદ્યાર્થીનું નામ ક્યારેય નહીં.", "Punjabi": "ਰੋਲ ਨੰਬਰ ਜਾਂ ਉਪਨਾਮ ਵਰਤੋ, ਵਿਦਿਆਰਥੀ ਦਾ ਨਾਮ ਕਦੇ ਨਹੀਂ।", "Malayalam": "റോൾ നമ്പറോ വിളിപ്പേരോ ഉപയോഗിക്കുക, വിദ്യാർത്ഥിയുടെ പേര് ഒരിക്കലും ഉപയോഗിക്കരുത്.", "Odia": "ରୋଲ ନମ୍ବର କିମ୍ବା ଉପନାମ ବ୍ୟବହାର କରନ୍ତୁ, ଛାତ୍ରର ନାମ କେବେ ନୁହେଁ।"
    },
    "e.g. roll-23": {
        "English": "e.g. roll-23", "Hindi": "उदा. roll-23", "Kannada": "ಉದಾ. roll-23", "Tamil": "எ.கா. roll-23", "Telugu": "ఉదా. roll-23", "Marathi": "उदा. roll-23", "Bengali": "যেমন roll-23", "Gujarati": "દા.ત. roll-23", "Punjabi": "ਜਿਵੇਂ roll-23", "Malayalam": "ഉദാ. roll-23", "Odia": "ଯଥା roll-23"
    },
    "Grade this assignment": {
        "English": "Grade this assignment", "Hindi": "इस असाइनमेंट का मूल्यांकन करें", "Kannada": "ಈ ಅಸೈನ್‌ಮೆಂಟ್ ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ", "Tamil": "இந்த பணியை மதிப்பிடவும்", "Telugu": "ఈ అసైన్‌మెంట్‌ను మూల్యాంకనం చేయండి", "Marathi": "या असाइनमेंटचे मूल्यांकन करा", "Bengali": "এই অ্যাসাইনমেন্ট মূল্যায়ন করুন", "Gujarati": "આ અસાઇનમેન્ટનું મૂલ્યાંકન કરો", "Punjabi": "ਇਸ ਅਸਾਈਨਮੈਂਟ ਦਾ ਮੁਲਾਂਕਣ ਕਰੋ", "Malayalam": "ഈ അസൈൻമെന്റ് മൂല്യനിർണ്ണയം ചെയ്യുക", "Odia": "ଏହି ଆସାଇନମେଣ୍ଟ ମୂଲ୍ୟାଙ୍କନ କରନ୍ତୁ"
    },
    "Add a photo first": {
        "English": "Add a photo first", "Hindi": "पहले एक फ़ोटो जोड़ें", "Kannada": "ಮೊದಲು ಫೋಟೋ ಸೇರಿಸಿ", "Tamil": "முதலில் ஒரு புகைப்படத்தைச் சேர்க்கவும்", "Telugu": "ముందుగా ఫోటో జోడించండి", "Marathi": "प्रथम फोटो जोडा", "Bengali": "প্রথমে একটি ছবি যোগ করুন", "Gujarati": "પહેલા એક ફોટો ઉમેરો", "Punjabi": "ਪਹਿਲਾਂ ਇੱਕ ਫੋਟੋ ਜੋੜੋ", "Malayalam": "ആദ്യം ഒരു ഫോട്ടോ ചേർക്കുക", "Odia": "ପ୍ରଥମେ ଏକ ଫଟୋ ଯୋଡନ୍ତୁ"
    },
    "Grading…": {
        "English": "Grading…", "Hindi": "मूल्यांकन हो रहा है…", "Kannada": "ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ…", "Tamil": "மதிப்பிடப்படுகிறது…", "Telugu": "మూల్యాంకనం జరుగుతోంది…", "Marathi": "मूल्यांकन सुरू आहे…", "Bengali": "মূল্যায়ন চলছে…", "Gujarati": "મૂલ્યાંકન થઈ રહ્યું છે…", "Punjabi": "ਮੁਲਾਂਕਣ ਜਾਰੀ ਹੈ…", "Malayalam": "മൂല്യനിർണ്ണയം നടക്കുന്നു…", "Odia": "ମୂଲ୍ୟାଙ୍କନ ଚାଲିଛି…"
    },
    "Reading the handwriting…": {
        "English": "Reading the handwriting…", "Hindi": "हस्तलेख पढ़ा जा रहा है…", "Kannada": "ಕೈಬರಹ ಓದಲಾಗುತ್ತಿದೆ…", "Tamil": "கையெழுத்தைப் படிக்கிறது…", "Telugu": "చేతిరాత చదువుతోంది…", "Marathi": "हस्ताक्षर वाचत आहे…", "Bengali": "হাতের লেখা পড়া হচ্ছে…", "Gujarati": "હસ્તાક્ષર વાંચાઈ રહ્યું છે…", "Punjabi": "ਹੱਥ ਲਿਖਤ ਪੜ੍ਹੀ ਜਾ ਰਹੀ ਹੈ…", "Malayalam": "കൈയക്ഷരം വായിക്കുന്നു…", "Odia": "ହସ୍ତଲିପି ପଢ଼ାଯାଉଛି…"
    },
    "Verifying the transcription…": {
        "English": "Verifying the transcription…", "Hindi": "लिप्यंतरण की पुष्टि की जा रही है…", "Kannada": "ಲಿಪ್ಯಂತರ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…", "Tamil": "படியெடுத்தலை சரிபார்க்கிறது…", "Telugu": "ట్రాన్స్‌క్రిప్షన్ ధృవీకరిస్తోంది…", "Marathi": "लिप्यंतरण तपासत आहे…", "Bengali": "প্রতিলিপি যাচাই করা হচ্ছে…", "Gujarati": "ટ્રાન્સક્રિપ્શન ચકાસાઈ રહ્યું છે…", "Punjabi": "ਟ੍ਰਾਂਸਕ੍ਰਿਪਸ਼ਨ ਜਾਂਚੀ ਜਾ ਰਹੀ ਹੈ…", "Malayalam": "ട്രാൻസ്ക്രിപ്ഷൻ പരിശോധിക്കുന്നു…", "Odia": "ଲିପ୍ୟନ୍ତରଣ ଯାଞ୍ଚ କରାଯାଉଛି…"
    },
    "Scoring against the rubric…": {
        "English": "Scoring against the rubric…", "Hindi": "रूब्रिक के अनुसार अंक दिए जा रहे हैं…", "Kannada": "ರೂಬ್ರಿಕ್‌ಗೆ ಅನುಗುಣವಾಗಿ ಅಂಕಗಳು ನೀಡಲಾಗುತ್ತಿವೆ…", "Tamil": "மதிப்பீட்டு அளவைப்படி மதிப்பெண் வழங்கப்படுகிறது…", "Telugu": "రూబ్రిక్ ప్రకారం స్కోర్ చేస్తోంది…", "Marathi": "रुब्रिकनुसार गुण देत आहे…", "Bengali": "রুব্রিক অনুযায়ী নম্বর দেওয়া হচ্ছে…", "Gujarati": "રૂબ્રિક પ્રમાણે ગુણ આપાઈ રહ્યા છે…", "Punjabi": "ਰੁਬ੍ਰਿਕ ਅਨੁਸਾਰ ਅੰਕ ਦਿੱਤੇ ਜਾ ਰਹੇ ਹਨ…", "Malayalam": "റൂബ്രിക് അനുസരിച്ച് സ്കോർ ചെയ്യുന്നു…", "Odia": "ରୁବ୍ରିକ ଅନୁଯାୟୀ ସ୍କୋର କରାଯାଉଛି…"
    },
    "Writing feedback…": {
        "English": "Writing feedback…", "Hindi": "फीडबैक लिखा जा रहा है…", "Kannada": "ಪ್ರತಿಕ್ರಿಯೆ ಬರೆಯಲಾಗುತ್ತಿದೆ…", "Tamil": "கருத்து எழுதப்படுகிறது…", "Telugu": "ఫీడ్‌బ్యాక్ రాస్తోంది…", "Marathi": "अभिप्राय लिहित आहे…", "Bengali": "ফিডব্যাক লেখা হচ্ছে…", "Gujarati": "પ્રતિસાદ લખાઈ રહ્યો છે…", "Punjabi": "ਫੀਡਬੈਕ ਲਿਖੀ ਜਾ ਰਹੀ ਹੈ…", "Malayalam": "ഫീഡ്ബാക്ക് എഴുതുന്നു…", "Odia": "ମତାମତ ଲେଖାଯାଉଛି…"
    },
    "Wrapping up…": {
        "English": "Wrapping up…", "Hindi": "समाप्त किया जा रहा है…", "Kannada": "ಮುಗಿಸಲಾಗುತ್ತಿದೆ…", "Tamil": "முடிக்கப்படுகிறது…", "Telugu": "ముగిస్తోంది…", "Marathi": "पूर्ण करत आहे…", "Bengali": "শেষ করা হচ্ছে…", "Gujarati": "પૂર્ણ થઈ રહ્યું છે…", "Punjabi": "ਸਮਾਪਤ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ…", "Malayalam": "പൂർത്തിയാക്കുന്നു…", "Odia": "ସମାପ୍ତ କରାଯାଉଛି…"
    },
    "Could not grade this work": {
        "English": "Could not grade this work", "Hindi": "इस कार्य का मूल्यांकन नहीं हो सका", "Kannada": "ಈ ಕೆಲಸ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗಲಿಲ್ಲ", "Tamil": "இந்த வேலையை மதிப்பிட முடியவில்லை", "Telugu": "ఈ పనిని మూల్యాంకనం చేయలేకపోయింది", "Marathi": "या कामाचे मूल्यांकन करता आले नाही", "Bengali": "এই কাজ মূল্যায়ন করা যায়নি", "Gujarati": "આ કાર્યનું મૂલ્યાંકન કરી શકાયું નહીં", "Punjabi": "ਇਸ ਕੰਮ ਦਾ ਮੁਲਾਂਕਣ ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਿਆ", "Malayalam": "ഈ ജോലി മൂല്യനിർണ്ണയം ചെയ്യാൻ കഴിഞ്ഞില്ല", "Odia": "ଏହି କାର୍ଯ୍ୟ ମୂଲ୍ୟାଙ୍କନ କରାଯାଇପାରିଲା ନାହିଁ"
    },
    "Something went wrong. Please retake the photo and try again.": {
        "English": "Something went wrong. Please retake the photo and try again.", "Hindi": "कुछ गड़बड़ हुई। कृपया फिर से फ़ोटो लें और प्रयास करें।", "Kannada": "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಫೋಟೋವನ್ನು ಮತ್ತೆ ತೆಗೆದು ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "ஏதோ தவறு நடந்தது. மீண்டும் புகைப்படத்தை எடுத்து முயற்சிக்கவும்.", "Telugu": "ఏదో పొరపాటు జరిగింది. దయచేసి ఫోటోను మళ్లీ తీసి ప్రయత్నించండి.", "Marathi": "काहीतरी चूक झाली. कृपया फोटो पुन्हा घ्या आणि पुन्हा प्रयत्न करा.", "Bengali": "কিছু সমস্যা হয়েছে। অনুগ্রহ করে আবার ছবি তুলে চেষ্টা করুন।", "Gujarati": "કંઈક ખોટું થયું. કૃપા કરીને ફોટો ફરીથી લો અને પ્રયત્ન કરો.", "Punjabi": "ਕੁਝ ਗਲਤ ਹੋਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਫੋਟੋ ਲਓ ਅਤੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "എന്തോ പിശക് സംഭവിച്ചു. ദയവായി ഫോട്ടോ വീണ്ടും എടുത്ത് ശ്രമിക്കുക.", "Odia": "କିଛି ଭୁଲ ହୋଇଛି। ଦୟାକରି ଫଟୋ ପୁଣି ଉଠାନ୍ତୁ ଓ ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "You've hit today's grading limit. Try again tomorrow or upgrade your plan.": {
        "English": "You've hit today's grading limit. Try again tomorrow or upgrade your plan.", "Hindi": "आज की मूल्यांकन सीमा पूरी हो गई है। कल पुनः प्रयास करें या अपनी योजना अपग्रेड करें।", "Kannada": "ಇಂದಿನ ಮೌಲ್ಯಮಾಪನ ಮಿತಿ ತಲುಪಿದೆ. ನಾಳೆ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ನಿಮ್ಮ ಯೋಜನೆಯನ್ನು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.", "Tamil": "இன்றைய மதிப்பீட்டு வரம்பை அடைந்துவிட்டீர்கள். நாளை மீண்டும் முயற்சிக்கவும் அல்லது உங்கள் திட்டத்தை மேம்படுத்தவும்.", "Telugu": "ఈరోజు మూల్యాంకన పరిమితి చేరుకుంది. రేపు మళ్లీ ప్రయత్నించండి లేదా మీ ప్లాన్‌ను అప్‌గ్రేడ్ చేయండి.", "Marathi": "आजची मूल्यांकन मर्यादा संपली आहे. उद्या पुन्हा प्रयत्न करा किंवा आपली योजना अपग्रेड करा.", "Bengali": "আজকের মূল্যায়ন সীমা শেষ হয়েছে। কাল আবার চেষ্টা করুন বা প্ল্যান আপগ্রেড করুন।", "Gujarati": "આજની મૂલ્યાંકન મર્યાદા પૂરી થઈ ગઈ છે. કાલે ફરી પ્રયત્ન કરો અથવા તમારી યોજના અપગ્રેડ કરો.", "Punjabi": "ਅੱਜ ਦੀ ਮੁਲਾਂਕਣ ਸੀਮਾ ਪੂਰੀ ਹੋ ਗਈ ਹੈ। ਕੱਲ੍ਹ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਆਪਣੀ ਯੋਜਨਾ ਅੱਪਗ੍ਰੇਡ ਕਰੋ।", "Malayalam": "ഇന്നത്തെ മൂല്യനിർണ്ണയ പരിധി കഴിഞ്ഞു. നാളെ വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ നിങ്ങളുടെ പ്ലാൻ അപ്‌ഗ്രേഡ് ചെയ്യുക.", "Odia": "ଆଜିର ମୂଲ୍ୟାଙ୍କନ ସୀମା ସରିଯାଇଛି। କାଲି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା ଆପଣଙ୍କ ଯୋଜନା ଅପଗ୍ରେଡ କରନ୍ତୁ।"
    },
    "Grading is not available on your current plan.": {
        "English": "Grading is not available on your current plan.", "Hindi": "आपकी वर्तमान योजना में मूल्यांकन उपलब्ध नहीं है।", "Kannada": "ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಯೋಜನೆಯಲ್ಲಿ ಮೌಲ್ಯಮಾಪನ ಲಭ್ಯವಿಲ್ಲ.", "Tamil": "உங்கள் தற்போதைய திட்டத்தில் மதிப்பீடு கிடைக்காது.", "Telugu": "మీ ప్రస్తుత ప్లాన్‌లో మూల్యాంకనం అందుబాటులో లేదు.", "Marathi": "तुमच्या सध्याच्या योजनेत मूल्यांकन उपलब्ध नाही.", "Bengali": "আপনার বর্তমান প্ল্যানে মূল্যায়ন উপলব্ধ নয়।", "Gujarati": "તમારી વર્તમાન યોજનામાં મૂલ્યાંકન ઉપલબ્ધ નથી.", "Punjabi": "ਤੁਹਾਡੀ ਮੌਜੂਦਾ ਯੋਜਨਾ ਵਿੱਚ ਮੁਲਾਂਕਣ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।", "Malayalam": "നിങ്ങളുടെ നിലവിലെ പ്ലാനിൽ മൂല്യനിർണ്ണയം ലഭ്യമല്ല.", "Odia": "ଆପଣଙ୍କ ବର୍ତ୍ତମାନ ଯୋଜନାରେ ମୂଲ୍ୟାଙ୍କନ ଉପଲବ୍ଧ ନାହିଁ।"
    },
    "AI service is busy. Please try again in a minute.": {
        "English": "AI service is busy. Please try again in a minute.", "Hindi": "AI सेवा व्यस्त है। कृपया एक मिनट में पुनः प्रयास करें।", "Kannada": "AI ಸೇವೆ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಒಂದು ನಿಮಿಷದಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "AI சேவை பணியில் உள்ளது. ஒரு நிமிடத்தில் மீண்டும் முயற்சிக்கவும்.", "Telugu": "AI సేవ బిజీగా ఉంది. దయచేసి ఒక నిమిషంలో మళ్లీ ప్రయత్నించండి.", "Marathi": "AI सेवा व्यस्त आहे. कृपया एका मिनिटात पुन्हा प्रयत्न करा.", "Bengali": "AI পরিষেবা ব্যস্ত। অনুগ্রহ করে এক মিনিট পরে আবার চেষ্টা করুন।", "Gujarati": "AI સેવા વ્યસ્ત છે. કૃપા કરીને એક મિનિટ પછી ફરી પ્રયત્ન કરો.", "Punjabi": "AI ਸੇਵਾ ਰੁਝੀ ਹੋਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਮਿੰਟ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "AI സേവനം തിരക്കിലാണ്. ദയവായി ഒരു മിനിറ്റിനു ശേഷം വീണ്ടും ശ്രമിക്കുക.", "Odia": "AI ସେବା ବ୍ୟସ୍ତ ଅଛି। ଦୟାକରି ଗୋଟିଏ ମିନିଟ୍ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Please sign in to grade student work.": {
        "English": "Please sign in to grade student work.", "Hindi": "विद्यार्थी कार्य का मूल्यांकन करने के लिए कृपया साइन इन करें।", "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಕೆಲಸವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "மாணவர் வேலையை மதிப்பிட சைன் இன் செய்யவும்.", "Telugu": "విద్యార్థి పనిని మూల్యాంకనం చేయడానికి దయచేసి సైన్ ఇన్ చేయండి.", "Marathi": "विद्यार्थ्यांचे काम मूल्यांकन करण्यासाठी कृपया साइन इन करा.", "Bengali": "শিক্ষার্থীর কাজ মূল্যায়ন করতে অনুগ্রহ করে সাইন ইন করুন।", "Gujarati": "વિદ્યાર્થીના કાર્યનું મૂલ્યાંકન કરવા માટે કૃપા કરીને સાઇન ઇન કરો.", "Punjabi": "ਵਿਦਿਆਰਥੀ ਦੇ ਕੰਮ ਦਾ ਮੁਲਾਂਕਣ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "വിദ്യാർത്ഥിയുടെ ജോലി മൂല്യനിർണ്ണയം ചെയ്യാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ଛାତ୍ର କାର୍ଯ୍ୟ ମୂଲ୍ୟାଙ୍କନ କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Sign in with Google to grade a handwritten assignment in seconds.": {
        "English": "Sign in with Google to grade a handwritten assignment in seconds.", "Hindi": "हस्तलिखित असाइनमेंट को सेकंडों में मूल्यांकन करने के लिए Google से साइन इन करें।", "Kannada": "ಕೈಬರಹದ ಅಸೈನ್‌ಮೆಂಟ್ ಅನ್ನು ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು Google ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "கையெழுத்து பணியை வினாடிகளில் மதிப்பிட Google உடன் சைன் இன் செய்யவும்.", "Telugu": "చేతిరాత అసైన్‌మెంట్‌ను సెకన్లలో మూల్యాంకనం చేయడానికి Googleతో సైన్ ఇన్ చేయండి.", "Marathi": "हस्तलिखित असाइनमेंट सेकंदात मूल्यांकन करण्यासाठी Google ने साइन इन करा.", "Bengali": "হাতে লেখা অ্যাসাইনমেন্ট সেকেন্ডে মূল্যায়ন করতে Google দিয়ে সাইন ইন করুন।", "Gujarati": "હસ્તલિખિત અસાઇનમેન્ટને સેકન્ડમાં મૂલ્યાંકન કરવા માટે Google થી સાઇન ઇન કરો.", "Punjabi": "ਹੱਥ ਲਿਖਤ ਅਸਾਈਨਮੈਂਟ ਨੂੰ ਸਕਿੰਟਾਂ ਵਿੱਚ ਮੁਲਾਂਕਣ ਕਰਨ ਲਈ Google ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "കൈയക്ഷര അസൈൻമെന്റ് സെക്കൻഡുകൾക്കുള്ളിൽ മൂല്യനിർണ്ണയം ചെയ്യാൻ Google ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ହସ୍ତଲିଖିତ ଆସାଇନମେଣ୍ଟକୁ କିଛି ସେକେଣ୍ଡରେ ମୂଲ୍ୟାଙ୍କନ କରିବାକୁ Google ସହ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Grading rubric": {
        "English": "Grading rubric", "Hindi": "मूल्यांकन रूब्रिक", "Kannada": "ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್", "Tamil": "மதிப்பீட்டு அளவை", "Telugu": "మూల్యాంకన రూబ్రిక్", "Marathi": "मूल्यांकन रुब्रिक", "Bengali": "মূল্যায়ন রুব্রিক", "Gujarati": "મૂલ્યાંકન રૂબ્રિક", "Punjabi": "ਮੁਲਾਂਕਣ ਰੁਬ੍ਰਿਕ", "Malayalam": "മൂല്യനിർണ്ണയ റൂബ്രിക്", "Odia": "ମୂଲ୍ୟାଙ୍କନ ରୁବ୍ରିକ"
    },
    "How should the AI grade this work?": {
        "English": "How should the AI grade this work?", "Hindi": "AI को इस कार्य का मूल्यांकन कैसे करना चाहिए?", "Kannada": "AI ಈ ಕೆಲಸವನ್ನು ಹೇಗೆ ಮೌಲ್ಯಮಾಪನ ಮಾಡಬೇಕು?", "Tamil": "AI இந்த வேலையை எவ்வாறு மதிப்பிட வேண்டும்?", "Telugu": "AI ఈ పనిని ఎలా మూల్యాంకనం చేయాలి?", "Marathi": "AI ने हे काम कसे मूल्यांकन करावे?", "Bengali": "AI কীভাবে এই কাজ মূল্যায়ন করবে?", "Gujarati": "AI એ આ કાર્યનું મૂલ્યાંકન કેવી રીતે કરવું જોઈએ?", "Punjabi": "AI ਨੂੰ ਇਹ ਕੰਮ ਕਿਵੇਂ ਮੁਲਾਂਕਣ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ?", "Malayalam": "AI ഈ ജോലി എങ്ങനെ മൂല്യനിർണ്ണയം ചെയ്യണം?", "Odia": "AI ଏହି କାର୍ଯ୍ୟକୁ କିପରି ମୂଲ୍ୟାଙ୍କନ କରିବ?"
    },
    "Let AI choose a rubric": {
        "English": "Let AI choose a rubric", "Hindi": "AI को रूब्रिक चुनने दें", "Kannada": "AI ರೂಬ್ರಿಕ್ ಆಯ್ಕೆ ಮಾಡಲಿ", "Tamil": "AI ஒரு மதிப்பீட்டு அளவையை தேர்ந்தெடுக்கட்டும்", "Telugu": "AI రూబ్రిక్ ఎంచుకోనివ్వండి", "Marathi": "AI ला रुब्रिक निवडू द्या", "Bengali": "AI কে রুব্রিক বেছে নিতে দিন", "Gujarati": "AI ને રૂબ્રિક પસંદ કરવા દો", "Punjabi": "AI ਨੂੰ ਰੁਬ੍ਰਿਕ ਚੁਣਨ ਦਿਓ", "Malayalam": "AI റൂബ്രിക് തിരഞ്ഞെടുക്കട്ടെ", "Odia": "AI କୁ ରୁବ୍ରିକ ବାଛିବାକୁ ଦିଅନ୍ତୁ"
    },
    "Quickest. Uses a balanced 4-criterion rubric.": {
        "English": "Quickest. Uses a balanced 4-criterion rubric.", "Hindi": "सबसे तेज़। संतुलित 4-मानदंड रूब्रिक का उपयोग करता है।", "Kannada": "ಅತ್ಯಂತ ವೇಗ. ಸಮತೋಲಿತ 4-ಮಾನದಂಡದ ರೂಬ್ರಿಕ್ ಬಳಸುತ್ತದೆ.", "Tamil": "வேகமானது. சமநிலையான 4-அளவுகோல் மதிப்பீட்டு அளவையைப் பயன்படுத்துகிறது.", "Telugu": "అత్యంత వేగవంతం. సమతుల్య 4-ప్రమాణ రూబ్రిక్‌ను ఉపయోగిస్తుంది.", "Marathi": "सर्वात जलद. संतुलित 4-निकष रुब्रिक वापरते.", "Bengali": "দ্রুততম। সুষম 4-মাপকাঠির রুব্রিক ব্যবহার করে।", "Gujarati": "સૌથી ઝડપી. સંતુલિત 4-માપદંડ રૂબ્રિક વાપરે છે.", "Punjabi": "ਸਭ ਤੋਂ ਤੇਜ਼। ਸੰਤੁਲਿਤ 4-ਮਾਪਦੰਡ ਰੁਬ੍ਰਿਕ ਵਰਤਦਾ ਹੈ।", "Malayalam": "ഏറ്റവും വേഗത. സന്തുലിതമായ 4-മാനദണ്ഡ റൂബ്രിക് ഉപയോഗിക്കുന്നു.", "Odia": "ସବୁଠାରୁ ଦ୍ରୁତ। ସନ୍ତୁଳିତ 4-ମାନଦଣ୍ଡ ରୁବ୍ରିକ ବ୍ୟବହାର କରେ।"
    },
    "Generate a new rubric": {
        "English": "Generate a new rubric", "Hindi": "नया रूब्रिक तैयार करें", "Kannada": "ಹೊಸ ರೂಬ್ರಿಕ್ ರಚಿಸಿ", "Tamil": "புதிய மதிப்பீட்டு அளவையை உருவாக்கவும்", "Telugu": "కొత్త రూబ్రిక్ సృష్టించండి", "Marathi": "नवीन रुब्रिक तयार करा", "Bengali": "নতুন রুব্রিক তৈরি করুন", "Gujarati": "નવો રૂબ્રિક બનાવો", "Punjabi": "ਨਵਾਂ ਰੁਬ੍ਰਿਕ ਬਣਾਓ", "Malayalam": "പുതിയ റൂബ്രിക് സൃഷ്ടിക്കുക", "Odia": "ନୂଆ ରୁବ୍ରିକ ତିଆରି କରନ୍ତୁ"
    },
    "Tell us what the assignment was; AI builds a fresh rubric.": {
        "English": "Tell us what the assignment was; AI builds a fresh rubric.", "Hindi": "हमें बताएँ कि असाइनमेंट क्या था; AI नया रूब्रिक तैयार करेगा।", "Kannada": "ಅಸೈನ್‌ಮೆಂಟ್ ಏನು ಎಂದು ತಿಳಿಸಿ; AI ಹೊಸ ರೂಬ್ರಿಕ್ ರಚಿಸುತ್ತದೆ.", "Tamil": "பணி என்னவென்று கூறுங்கள்; AI புதிய மதிப்பீட்டு அளவையை உருவாக்கும்.", "Telugu": "అసైన్‌మెంట్ ఏమిటో చెప్పండి; AI తాజా రూబ్రిక్‌ను రూపొందిస్తుంది.", "Marathi": "असाइनमेंट काय होते ते सांगा; AI नवीन रुब्रिक तयार करेल.", "Bengali": "অ্যাসাইনমেন্ট কী ছিল বলুন; AI নতুন রুব্রিক তৈরি করবে।", "Gujarati": "અસાઇનમેન્ટ શું હતું તે જણાવો; AI નવો રૂબ્રિક બનાવશે.", "Punjabi": "ਸਾਨੂੰ ਦੱਸੋ ਕਿ ਅਸਾਈਨਮੈਂਟ ਕੀ ਸੀ; AI ਨਵਾਂ ਰੁਬ੍ਰਿਕ ਬਣਾਏਗਾ।", "Malayalam": "അസൈൻമെന്റ് എന്തായിരുന്നു എന്ന് പറയുക; AI പുതിയ റൂബ്രിക് നിർമ്മിക്കും.", "Odia": "ଆସାଇନମେଣ୍ଟ କ'ଣ ଥିଲା କୁହନ୍ତୁ; AI ନୂଆ ରୁବ୍ରିକ ତିଆରି କରିବ।"
    },
    "Pick from My Library": {
        "English": "Pick from My Library", "Hindi": "मेरी लाइब्रेरी से चुनें", "Kannada": "ನನ್ನ ಲೈಬ್ರರಿಯಿಂದ ಆಯ್ಕೆ ಮಾಡಿ", "Tamil": "என் நூலகத்திலிருந்து தேர்வு செய்யவும்", "Telugu": "నా లైబ్రరీ నుండి ఎంచుకోండి", "Marathi": "माझ्या लायब्ररीतून निवडा", "Bengali": "আমার লাইব্রেরি থেকে বেছে নিন", "Gujarati": "મારી લાઇબ્રેરીમાંથી પસંદ કરો", "Punjabi": "ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚੋਂ ਚੁਣੋ", "Malayalam": "എന്റെ ലൈബ്രറിയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക", "Odia": "ମୋ ଲାଇବ୍ରେରୀରୁ ବାଛନ୍ତୁ"
    },
    "Reuse a rubric you've already generated.": {
        "English": "Reuse a rubric you've already generated.", "Hindi": "पहले से तैयार रूब्रिक का पुनः उपयोग करें।", "Kannada": "ಈಗಾಗಲೇ ರಚಿಸಿದ ರೂಬ್ರಿಕ್ ಅನ್ನು ಮರುಬಳಸಿ.", "Tamil": "ஏற்கனவே உருவாக்கிய மதிப்பீட்டு அளவையை மீண்டும் பயன்படுத்தவும்.", "Telugu": "ఇప్పటికే రూపొందించిన రూబ్రిక్‌ను తిరిగి ఉపయోగించండి.", "Marathi": "आधीच तयार केलेली रुब्रिक पुन्हा वापरा.", "Bengali": "আগে তৈরি করা রুব্রিক পুনরায় ব্যবহার করুন।", "Gujarati": "પહેલેથી બનાવેલા રૂબ્રિકનો ફરી ઉપયોગ કરો.", "Punjabi": "ਪਹਿਲਾਂ ਬਣਾਏ ਰੁਬ੍ਰਿਕ ਨੂੰ ਮੁੜ ਵਰਤੋ।", "Malayalam": "ഇതിനകം സൃഷ്ടിച്ച റൂബ്രിക് വീണ്ടും ഉപയോഗിക്കുക.", "Odia": "ପୂର୍ବରୁ ତିଆରି କରିଥିବା ରୁବ୍ରିକକୁ ପୁଣି ବ୍ୟବହାର କରନ୍ତୁ।"
    },
    "e.g. Class 5 science worksheet on the water cycle, 10 short-answer questions": {
        "English": "e.g. Class 5 science worksheet on the water cycle, 10 short-answer questions", "Hindi": "उदा. कक्षा 5 विज्ञान वर्कशीट, जलचक्र पर, 10 लघु-उत्तर प्रश्न", "Kannada": "ಉದಾ. 5ನೇ ತರಗತಿ ವಿಜ್ಞಾನ ವರ್ಕ್‌ಶೀಟ್, ಜಲಚಕ್ರ, 10 ಸಣ್ಣ ಉತ್ತರ ಪ್ರಶ್ನೆಗಳು", "Tamil": "எ.கா. 5ம் வகுப்பு அறிவியல் பயிற்சித்தாள், நீர் சுழற்சி பற்றி, 10 சிறு-விடை கேள்விகள்", "Telugu": "ఉదా. 5వ తరగతి సైన్స్ వర్క్‌షీట్, నీటి చక్రంపై, 10 చిన్న సమాధాన ప్రశ్నలు", "Marathi": "उदा. इयत्ता 5 विज्ञान वर्कशीट, जलचक्रावर, 10 लघु-उत्तरी प्रश्न", "Bengali": "যেমন ৫ম শ্রেণির বিজ্ঞান ওয়ার্কশিট, জলচক্রের উপর, ১০টি সংক্ষিপ্ত-উত্তরের প্রশ্ন", "Gujarati": "દા.ત. વર્ગ 5 વિજ્ઞાન વર્કશીટ, જળચક્ર પર, 10 ટૂંકા જવાબના પ્રશ્નો", "Punjabi": "ਜਿਵੇਂ ਜਮਾਤ 5 ਵਿਗਿਆਨ ਵਰਕਸ਼ੀਟ, ਜਲਚੱਕਰ ਉੱਤੇ, 10 ਛੋਟੇ-ਜਵਾਬ ਪ੍ਰਸ਼ਨ", "Malayalam": "ഉദാ. അഞ്ചാം ക്ലാസ് സയൻസ് വർക്ക്‌ഷീറ്റ്, ജലചക്രത്തെക്കുറിച്ച്, 10 ചെറുത്തരചോദ്യങ്ങൾ", "Odia": "ଯଥା ୫ମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ୱାର୍କସିଟ୍, ଜଳଚକ୍ର ଉପରେ, ୧୦ଟି ଛୋଟ-ଉତ୍ତର ପ୍ରଶ୍ନ"
    },
    "What was the assignment?": {
        "English": "What was the assignment?", "Hindi": "असाइनमेंट क्या था?", "Kannada": "ಅಸೈನ್‌ಮೆಂಟ್ ಏನು ಆಗಿತ್ತು?", "Tamil": "பணி என்ன ஆகும்?", "Telugu": "అసైన్‌మెంట్ ఏమిటి?", "Marathi": "असाइनमेंट काय होते?", "Bengali": "অ্যাসাইনমেন্ট কী ছিল?", "Gujarati": "અસાઇનમેન્ટ શું હતું?", "Punjabi": "ਅਸਾਈਨਮੈਂਟ ਕੀ ਸੀ?", "Malayalam": "അസൈൻമെന്റ് എന്തായിരുന്നു?", "Odia": "ଆସାଇନମେଣ୍ଟ କ'ଣ ଥିଲା?"
    },
    "Generate rubric": {
        "English": "Generate rubric", "Hindi": "रूब्रिक तैयार करें", "Kannada": "ರೂಬ್ರಿಕ್ ರಚಿಸಿ", "Tamil": "மதிப்பீட்டு அளவையை உருவாக்கவும்", "Telugu": "రూబ్రిక్ సృష్టించండి", "Marathi": "रुब्रिक तयार करा", "Bengali": "রুব্রিক তৈরি করুন", "Gujarati": "રૂબ્રિક બનાવો", "Punjabi": "ਰੁਬ੍ਰਿਕ ਬਣਾਓ", "Malayalam": "റൂബ്രിക് സൃഷ്ടിക്കുക", "Odia": "ରୁବ୍ରିକ ତିଆରି କରନ୍ତୁ"
    },
    "Generating…": {
        "English": "Generating…", "Hindi": "तैयार किया जा रहा है…", "Kannada": "ರಚಿಸಲಾಗುತ್ತಿದೆ…", "Tamil": "உருவாக்கப்படுகிறது…", "Telugu": "సృష్టిస్తోంది…", "Marathi": "तयार करत आहे…", "Bengali": "তৈরি হচ্ছে…", "Gujarati": "બનાવાઈ રહ્યું છે…", "Punjabi": "ਬਣਾਇਆ ਜਾ ਰਿਹਾ ਹੈ…", "Malayalam": "സൃഷ്ടിക്കുന്നു…", "Odia": "ତିଆରି କରାଯାଉଛି…"
    },
    "Choose a saved rubric": {
        "English": "Choose a saved rubric", "Hindi": "सहेजा गया रूब्रिक चुनें", "Kannada": "ಉಳಿಸಿದ ರೂಬ್ರಿಕ್ ಆಯ್ಕೆ ಮಾಡಿ", "Tamil": "சேமித்த மதிப்பீட்டு அளவையைத் தேர்வு செய்யவும்", "Telugu": "సేవ్ చేసిన రూబ్రిక్ ఎంచుకోండి", "Marathi": "सेव्ह केलेली रुब्रिक निवडा", "Bengali": "সংরক্ষিত রুব্রিক বেছে নিন", "Gujarati": "સાચવેલો રૂબ્રિક પસંદ કરો", "Punjabi": "ਸੰਭਾਲਿਆ ਹੋਇਆ ਰੁਬ੍ਰਿਕ ਚੁਣੋ", "Malayalam": "സേവ് ചെയ്ത റൂബ്രിക് തിരഞ്ഞെടുക്കുക", "Odia": "ସଞ୍ଚୟ କରାଯାଇଥିବା ରୁବ୍ରିକ ବାଛନ୍ତୁ"
    },
    "You haven't saved any rubrics yet. Switch to 'Generate' to make one.": {
        "English": "You haven't saved any rubrics yet. Switch to 'Generate' to make one.", "Hindi": "आपने अभी तक कोई रूब्रिक नहीं सहेजा है। एक बनाने के लिए 'Generate' पर जाएँ।", "Kannada": "ನೀವು ಯಾವುದೇ ರೂಬ್ರಿಕ್ ಉಳಿಸಿಲ್ಲ. ಒಂದನ್ನು ರಚಿಸಲು 'Generate' ಗೆ ಬದಲಾಯಿಸಿ.", "Tamil": "நீங்கள் இதுவரை எந்த மதிப்பீட்டு அளவையும் சேமிக்கவில்லை. ஒன்றை உருவாக்க 'Generate' க்கு மாறவும்.", "Telugu": "మీరు ఇంకా ఏ రూబ్రిక్‌ను సేవ్ చేయలేదు. ఒకటి సృష్టించడానికి 'Generate'కి మారండి.", "Marathi": "तुम्ही अद्याप कोणतीही रुब्रिक सेव्ह केलेली नाही. एक तयार करण्यासाठी 'Generate' वर जा.", "Bengali": "আপনি এখনও কোনো রুব্রিক সংরক্ষণ করেননি। একটি তৈরি করতে 'Generate'-এ যান।", "Gujarati": "તમે હજુ સુધી કોઈ રૂબ્રિક સાચવ્યો નથી. એક બનાવવા માટે 'Generate' પર જાઓ.", "Punjabi": "ਤੁਸੀਂ ਹਾਲੇ ਤੱਕ ਕੋਈ ਰੁਬ੍ਰਿਕ ਨਹੀਂ ਸੰਭਾਲਿਆ। ਇੱਕ ਬਣਾਉਣ ਲਈ 'Generate' ਉੱਤੇ ਜਾਓ।", "Malayalam": "നിങ്ങൾ ഇതുവരെ ഒരു റൂബ്രിക്കും സേവ് ചെയ്തിട്ടില്ല. ഒന്ന് സൃഷ്ടിക്കാൻ 'Generate'-ലേക്ക് മാറുക.", "Odia": "ଆପଣ ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ରୁବ୍ରିକ ସଞ୍ଚୟ କରିନାହାନ୍ତି। ଗୋଟିଏ ତିଆରି କରିବାକୁ 'Generate'କୁ ଯାଆନ୍ତୁ।"
    },
    "Loading your saved rubrics…": {
        "English": "Loading your saved rubrics…", "Hindi": "आपके सहेजे गए रूब्रिक लोड हो रहे हैं…", "Kannada": "ನಿಮ್ಮ ಉಳಿಸಿದ ರೂಬ್ರಿಕ್‌ಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…", "Tamil": "உங்கள் சேமித்த மதிப்பீட்டு அளவைகள் ஏற்றப்படுகின்றன…", "Telugu": "మీ సేవ్ చేసిన రూబ్రిక్‌లు లోడ్ అవుతున్నాయి…", "Marathi": "तुमच्या सेव्ह केलेल्या रुब्रिक्स लोड होत आहेत…", "Bengali": "আপনার সংরক্ষিত রুব্রিকগুলি লোড হচ্ছে…", "Gujarati": "તમારા સાચવેલા રૂબ્રિક લોડ થઈ રહ્યા છે…", "Punjabi": "ਤੁਹਾਡੇ ਸੰਭਾਲੇ ਹੋਏ ਰੁਬ੍ਰਿਕ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…", "Malayalam": "നിങ്ങളുടെ സേവ് ചെയ്ത റൂബ്രിക്കുകൾ ലോഡ് ചെയ്യുന്നു…", "Odia": "ଆପଣଙ୍କ ସଞ୍ଚୟ ରୁବ୍ରିକଗୁଡ଼ିକ ଲୋଡ୍ ହେଉଛି…"
    },
    "Rubric ready: {{title}}": {
        "English": "Rubric ready: {{title}}", "Hindi": "रूब्रिक तैयार: {{title}}", "Kannada": "ರೂಬ್ರಿಕ್ ಸಿದ್ಧ: {{title}}", "Tamil": "மதிப்பீட்டு அளவை தயார்: {{title}}", "Telugu": "రూబ్రిక్ సిద్ధం: {{title}}", "Marathi": "रुब्रिक तयार: {{title}}", "Bengali": "রুব্রিক প্রস্তুত: {{title}}", "Gujarati": "રૂબ્રિક તૈયાર: {{title}}", "Punjabi": "ਰੁਬ੍ਰਿਕ ਤਿਆਰ: {{title}}", "Malayalam": "റൂബ്രിക് തയ്യാർ: {{title}}", "Odia": "ରୁବ୍ରିକ ପ୍ରସ୍ତୁତ: {{title}}"
    },
    "Could not generate the rubric. Please try again.": {
        "English": "Could not generate the rubric. Please try again.", "Hindi": "रूब्रिक तैयार नहीं हो सका। कृपया पुनः प्रयास करें।", "Kannada": "ರೂಬ್ರಿಕ್ ರಚಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "மதிப்பீட்டு அளவையை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "రూబ్రిక్ సృష్టించలేకపోయింది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "रुब्रिक तयार करता आली नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "রুব্রিক তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "રૂબ્રિક બનાવી શકાયો નહીં. કૃપા કરીને ફરી પ્રયત્ન કરો.", "Punjabi": "ਰੁਬ੍ਰਿਕ ਬਣਾਇਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "റൂബ്രിക് സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରୁବ୍ରିକ ତିଆରି କରାଯାଇପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Could not load your saved rubrics.": {
        "English": "Could not load your saved rubrics.", "Hindi": "आपके सहेजे गए रूब्रिक लोड नहीं हो सके।", "Kannada": "ನಿಮ್ಮ ಉಳಿಸಿದ ರೂಬ್ರಿಕ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.", "Tamil": "உங்கள் சேமித்த மதிப்பீட்டு அளவைகளை ஏற்ற முடியவில்லை.", "Telugu": "మీ సేవ్ చేసిన రూబ్రిక్‌లను లోడ్ చేయలేకపోయింది.", "Marathi": "तुमच्या सेव्ह केलेल्या रुब्रिक्स लोड होऊ शकल्या नाहीत.", "Bengali": "আপনার সংরক্ষিত রুব্রিকগুলি লোড করা যায়নি।", "Gujarati": "તમારા સાચવેલા રૂબ્રિક લોડ થઈ શક્યા નહીં.", "Punjabi": "ਤੁਹਾਡੇ ਸੰਭਾਲੇ ਰੁਬ੍ਰਿਕ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੇ।", "Malayalam": "നിങ്ങളുടെ സേവ് ചെയ്ത റൂബ്രിക്കുകൾ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല.", "Odia": "ଆପଣଙ୍କ ସଞ୍ଚୟ ରୁବ୍ରିକଗୁଡ଼ିକ ଲୋଡ୍ କରାଯାଇପାରିଲା ନାହିଁ।"
    },
    "Ready to prep your": {
        "English": "Ready to prep your", "Hindi": "क्या आप तैयार हैं अपनी", "Kannada": "ನಿಮ್ಮ", "Tamil": "உங்கள்", "Telugu": "మీ", "Marathi": "तुमच्या", "Bengali": "আপনার", "Gujarati": "તમારા", "Punjabi": "ਆਪਣੀ", "Malayalam": "നിങ്ങളുടെ", "Odia": "ଆପଣଙ୍କ"
    },
    "class? Just ask me to generate anything.": {
        "English": "class? Just ask me to generate anything.", "Hindi": "क्लास तैयार करने के लिए? कुछ भी बनाने के लिए मुझसे कहें।", "Kannada": "ತರಗತಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಲು ಸಿದ್ಧವಿರಾ? ಏನನ್ನಾದರೂ ರಚಿಸಲು ನನ್ನನ್ನು ಕೇಳಿ.", "Tamil": "வகுப்பை தயார் செய்ய? எதையும் உருவாக்க என்னிடம் கேளுங்கள்.", "Telugu": "క్లాస్‌ను సిద్ధం చేయడానికి సిద్ధంగా ఉన్నారా? ఏదైనా రూపొందించడానికి నన్ను అడగండి.", "Marathi": "वर्ग तयार करण्यासाठी तयार आहात? काहीही तयार करण्यासाठी मला विचारा.", "Bengali": "ক্লাসের প্রস্তুতির জন্য? কিছু তৈরি করতে আমাকে বলুন।", "Gujarati": "વર્ગની તૈયારી માટે તૈયાર છો? કંઈપણ બનાવવા માટે મને કહો.", "Punjabi": "ਜਮਾਤ ਦੀ ਤਿਆਰੀ ਲਈ ਤਿਆਰ ਹੋ? ਕੁਝ ਵੀ ਬਣਾਉਣ ਲਈ ਮੈਨੂੰ ਕਹੋ।", "Malayalam": "ക്ലാസ് തയ്യാറാക്കാൻ തയ്യാറാണോ? എന്തും സൃഷ്ടിക്കാൻ എന്നോട് ചോദിക്കൂ.", "Odia": "କ୍ଲାସ୍ ପ୍ରସ୍ତୁତ କରିବାକୁ ପ୍ରସ୍ତୁତ? କିଛି ସୃଷ୍ଟି କରିବାକୁ ମୋତେ କୁହନ୍ତୁ।"
    },
    "remaining": {
        "English": "remaining", "Hindi": "शेष", "Kannada": "ಉಳಿದಿದೆ", "Tamil": "மீதம்", "Telugu": "మిగిలి ఉంది", "Marathi": "उरलेले", "Bengali": "অবশিষ্ট", "Gujarati": "બાકી", "Punjabi": "ਬਾਕੀ", "Malayalam": "ശേഷിക്കുന്നു", "Odia": "ବାକି"
    },
    "Loading chapters...": {
        "English": "Loading chapters...", "Hindi": "अध्याय लोड हो रहे हैं...", "Kannada": "ಅಧ್ಯಾಯಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...", "Tamil": "அத்தியாயங்கள் ஏற்றப்படுகின்றன...", "Telugu": "అధ్యాయాలు లోడ్ అవుతున్నాయి...", "Marathi": "अध्याय लोड होत आहेत...", "Bengali": "অধ্যায় লোড হচ্ছে...", "Gujarati": "પ્રકરણો લોડ થઈ રહ્યા છે...", "Punjabi": "ਅਧਿਆਏ ਲੋਡ ਹੋ ਰਹੇ ਹਨ...", "Malayalam": "അധ്യായങ്ങൾ ലോഡ് ചെയ്യുന്നു...", "Odia": "ଅଧ୍ୟାୟଗୁଡ଼ିକ ଲୋଡ୍ ହେଉଛି..."
    },
    "No chapters found": {
        "English": "No chapters found", "Hindi": "कोई अध्याय नहीं मिला", "Kannada": "ಯಾವುದೇ ಅಧ್ಯಾಯಗಳು ಕಂಡುಬಂದಿಲ್ಲ", "Tamil": "அத்தியாயங்கள் எதுவும் இல்லை", "Telugu": "అధ్యాయాలు కనుగొనబడలేదు", "Marathi": "कोणतेही अध्याय आढळले नाहीत", "Bengali": "কোনো অধ্যায় পাওয়া যায়নি", "Gujarati": "કોઈ પ્રકરણો મળ્યા નથી", "Punjabi": "ਕੋਈ ਅਧਿਆਏ ਨਹੀਂ ਮਿਲੇ", "Malayalam": "അധ്യായങ്ങളൊന്നും കണ്ടെത്തിയില്ല", "Odia": "କୌଣସି ଅଧ୍ୟାୟ ମିଳିଲା ନାହିଁ"
    },
    "Select chapter": {
        "English": "Select chapter", "Hindi": "अध्याय चुनें", "Kannada": "ಅಧ್ಯಾಯ ಆಯ್ಕೆಮಾಡಿ", "Tamil": "அத்தியாயத்தைத் தேர்ந்தெடுக்கவும்", "Telugu": "అధ్యాయాన్ని ఎంచుకోండి", "Marathi": "अध्याय निवडा", "Bengali": "অধ্যায় নির্বাচন করুন", "Gujarati": "પ્રકરણ પસંદ કરો", "Punjabi": "ਅਧਿਆਏ ਚੁਣੋ", "Malayalam": "അധ്യായം തിരഞ്ഞെടുക്കുക", "Odia": "ଅଧ୍ୟାୟ ବାଛନ୍ତୁ"
    },
    "CBSE": {
        "English": "CBSE", "Hindi": "CBSE", "Kannada": "CBSE", "Tamil": "CBSE", "Telugu": "CBSE", "Marathi": "CBSE", "Bengali": "CBSE", "Gujarati": "CBSE", "Punjabi": "CBSE", "Malayalam": "CBSE", "Odia": "CBSE"
    },
    "ICSE / ISC": {
        "English": "ICSE / ISC", "Hindi": "ICSE / ISC", "Kannada": "ICSE / ISC", "Tamil": "ICSE / ISC", "Telugu": "ICSE / ISC", "Marathi": "ICSE / ISC", "Bengali": "ICSE / ISC", "Gujarati": "ICSE / ISC", "Punjabi": "ICSE / ISC", "Malayalam": "ICSE / ISC", "Odia": "ICSE / ISC"
    },
    "Andhra Pradesh State Board": {
        "English": "Andhra Pradesh State Board", "Hindi": "Andhra Pradesh State Board", "Kannada": "Andhra Pradesh State Board", "Tamil": "Andhra Pradesh State Board", "Telugu": "Andhra Pradesh State Board", "Marathi": "Andhra Pradesh State Board", "Bengali": "Andhra Pradesh State Board", "Gujarati": "Andhra Pradesh State Board", "Punjabi": "Andhra Pradesh State Board", "Malayalam": "Andhra Pradesh State Board", "Odia": "Andhra Pradesh State Board"
    },
    "Assam State Board (SEBA)": {
        "English": "Assam State Board (SEBA)", "Hindi": "Assam State Board (SEBA)", "Kannada": "Assam State Board (SEBA)", "Tamil": "Assam State Board (SEBA)", "Telugu": "Assam State Board (SEBA)", "Marathi": "Assam State Board (SEBA)", "Bengali": "Assam State Board (SEBA)", "Gujarati": "Assam State Board (SEBA)", "Punjabi": "Assam State Board (SEBA)", "Malayalam": "Assam State Board (SEBA)", "Odia": "Assam State Board (SEBA)"
    },
    "Bihar State Board (BSEB)": {
        "English": "Bihar State Board (BSEB)", "Hindi": "Bihar State Board (BSEB)", "Kannada": "Bihar State Board (BSEB)", "Tamil": "Bihar State Board (BSEB)", "Telugu": "Bihar State Board (BSEB)", "Marathi": "Bihar State Board (BSEB)", "Bengali": "Bihar State Board (BSEB)", "Gujarati": "Bihar State Board (BSEB)", "Punjabi": "Bihar State Board (BSEB)", "Malayalam": "Bihar State Board (BSEB)", "Odia": "Bihar State Board (BSEB)"
    },
    "Chhattisgarh State Board (CGBSE)": {
        "English": "Chhattisgarh State Board (CGBSE)", "Hindi": "Chhattisgarh State Board (CGBSE)", "Kannada": "Chhattisgarh State Board (CGBSE)", "Tamil": "Chhattisgarh State Board (CGBSE)", "Telugu": "Chhattisgarh State Board (CGBSE)", "Marathi": "Chhattisgarh State Board (CGBSE)", "Bengali": "Chhattisgarh State Board (CGBSE)", "Gujarati": "Chhattisgarh State Board (CGBSE)", "Punjabi": "Chhattisgarh State Board (CGBSE)", "Malayalam": "Chhattisgarh State Board (CGBSE)", "Odia": "Chhattisgarh State Board (CGBSE)"
    },
    "Goa Board of Secondary Education": {
        "English": "Goa Board of Secondary Education", "Hindi": "Goa Board of Secondary Education", "Kannada": "Goa Board of Secondary Education", "Tamil": "Goa Board of Secondary Education", "Telugu": "Goa Board of Secondary Education", "Marathi": "Goa Board of Secondary Education", "Bengali": "Goa Board of Secondary Education", "Gujarati": "Goa Board of Secondary Education", "Punjabi": "Goa Board of Secondary Education", "Malayalam": "Goa Board of Secondary Education", "Odia": "Goa Board of Secondary Education"
    },
    "Gujarat State Board (GSEB)": {
        "English": "Gujarat State Board (GSEB)", "Hindi": "Gujarat State Board (GSEB)", "Kannada": "Gujarat State Board (GSEB)", "Tamil": "Gujarat State Board (GSEB)", "Telugu": "Gujarat State Board (GSEB)", "Marathi": "Gujarat State Board (GSEB)", "Bengali": "Gujarat State Board (GSEB)", "Gujarati": "Gujarat State Board (GSEB)", "Punjabi": "Gujarat State Board (GSEB)", "Malayalam": "Gujarat State Board (GSEB)", "Odia": "Gujarat State Board (GSEB)"
    },
    "Haryana State Board (HBSE)": {
        "English": "Haryana State Board (HBSE)", "Hindi": "Haryana State Board (HBSE)", "Kannada": "Haryana State Board (HBSE)", "Tamil": "Haryana State Board (HBSE)", "Telugu": "Haryana State Board (HBSE)", "Marathi": "Haryana State Board (HBSE)", "Bengali": "Haryana State Board (HBSE)", "Gujarati": "Haryana State Board (HBSE)", "Punjabi": "Haryana State Board (HBSE)", "Malayalam": "Haryana State Board (HBSE)", "Odia": "Haryana State Board (HBSE)"
    },
    "Himachal Pradesh State Board (HPBOSE)": {
        "English": "Himachal Pradesh State Board (HPBOSE)", "Hindi": "Himachal Pradesh State Board (HPBOSE)", "Kannada": "Himachal Pradesh State Board (HPBOSE)", "Tamil": "Himachal Pradesh State Board (HPBOSE)", "Telugu": "Himachal Pradesh State Board (HPBOSE)", "Marathi": "Himachal Pradesh State Board (HPBOSE)", "Bengali": "Himachal Pradesh State Board (HPBOSE)", "Gujarati": "Himachal Pradesh State Board (HPBOSE)", "Punjabi": "Himachal Pradesh State Board (HPBOSE)", "Malayalam": "Himachal Pradesh State Board (HPBOSE)", "Odia": "Himachal Pradesh State Board (HPBOSE)"
    },
    "Jharkhand Academic Council (JAC)": {
        "English": "Jharkhand Academic Council (JAC)", "Hindi": "Jharkhand Academic Council (JAC)", "Kannada": "Jharkhand Academic Council (JAC)", "Tamil": "Jharkhand Academic Council (JAC)", "Telugu": "Jharkhand Academic Council (JAC)", "Marathi": "Jharkhand Academic Council (JAC)", "Bengali": "Jharkhand Academic Council (JAC)", "Gujarati": "Jharkhand Academic Council (JAC)", "Punjabi": "Jharkhand Academic Council (JAC)", "Malayalam": "Jharkhand Academic Council (JAC)", "Odia": "Jharkhand Academic Council (JAC)"
    },
    "Karnataka State Board (KSEEB)": {
        "English": "Karnataka State Board (KSEEB)", "Hindi": "Karnataka State Board (KSEEB)", "Kannada": "Karnataka State Board (KSEEB)", "Tamil": "Karnataka State Board (KSEEB)", "Telugu": "Karnataka State Board (KSEEB)", "Marathi": "Karnataka State Board (KSEEB)", "Bengali": "Karnataka State Board (KSEEB)", "Gujarati": "Karnataka State Board (KSEEB)", "Punjabi": "Karnataka State Board (KSEEB)", "Malayalam": "Karnataka State Board (KSEEB)", "Odia": "Karnataka State Board (KSEEB)"
    },
    "Kerala State Board (SCERT)": {
        "English": "Kerala State Board (SCERT)", "Hindi": "Kerala State Board (SCERT)", "Kannada": "Kerala State Board (SCERT)", "Tamil": "Kerala State Board (SCERT)", "Telugu": "Kerala State Board (SCERT)", "Marathi": "Kerala State Board (SCERT)", "Bengali": "Kerala State Board (SCERT)", "Gujarati": "Kerala State Board (SCERT)", "Punjabi": "Kerala State Board (SCERT)", "Malayalam": "Kerala State Board (SCERT)", "Odia": "Kerala State Board (SCERT)"
    },
    "Madhya Pradesh State Board (MPBSE)": {
        "English": "Madhya Pradesh State Board (MPBSE)", "Hindi": "Madhya Pradesh State Board (MPBSE)", "Kannada": "Madhya Pradesh State Board (MPBSE)", "Tamil": "Madhya Pradesh State Board (MPBSE)", "Telugu": "Madhya Pradesh State Board (MPBSE)", "Marathi": "Madhya Pradesh State Board (MPBSE)", "Bengali": "Madhya Pradesh State Board (MPBSE)", "Gujarati": "Madhya Pradesh State Board (MPBSE)", "Punjabi": "Madhya Pradesh State Board (MPBSE)", "Malayalam": "Madhya Pradesh State Board (MPBSE)", "Odia": "Madhya Pradesh State Board (MPBSE)"
    },
    "Maharashtra State Board (MSBSHSE)": {
        "English": "Maharashtra State Board (MSBSHSE)", "Hindi": "Maharashtra State Board (MSBSHSE)", "Kannada": "Maharashtra State Board (MSBSHSE)", "Tamil": "Maharashtra State Board (MSBSHSE)", "Telugu": "Maharashtra State Board (MSBSHSE)", "Marathi": "Maharashtra State Board (MSBSHSE)", "Bengali": "Maharashtra State Board (MSBSHSE)", "Gujarati": "Maharashtra State Board (MSBSHSE)", "Punjabi": "Maharashtra State Board (MSBSHSE)", "Malayalam": "Maharashtra State Board (MSBSHSE)", "Odia": "Maharashtra State Board (MSBSHSE)"
    },
    "Manipur State Board (COHSEM)": {
        "English": "Manipur State Board (COHSEM)", "Hindi": "Manipur State Board (COHSEM)", "Kannada": "Manipur State Board (COHSEM)", "Tamil": "Manipur State Board (COHSEM)", "Telugu": "Manipur State Board (COHSEM)", "Marathi": "Manipur State Board (COHSEM)", "Bengali": "Manipur State Board (COHSEM)", "Gujarati": "Manipur State Board (COHSEM)", "Punjabi": "Manipur State Board (COHSEM)", "Malayalam": "Manipur State Board (COHSEM)", "Odia": "Manipur State Board (COHSEM)"
    },
    "Meghalaya State Board (MBOSE)": {
        "English": "Meghalaya State Board (MBOSE)", "Hindi": "Meghalaya State Board (MBOSE)", "Kannada": "Meghalaya State Board (MBOSE)", "Tamil": "Meghalaya State Board (MBOSE)", "Telugu": "Meghalaya State Board (MBOSE)", "Marathi": "Meghalaya State Board (MBOSE)", "Bengali": "Meghalaya State Board (MBOSE)", "Gujarati": "Meghalaya State Board (MBOSE)", "Punjabi": "Meghalaya State Board (MBOSE)", "Malayalam": "Meghalaya State Board (MBOSE)", "Odia": "Meghalaya State Board (MBOSE)"
    },
    "Nagaland State Board (NBSE)": {
        "English": "Nagaland State Board (NBSE)", "Hindi": "Nagaland State Board (NBSE)", "Kannada": "Nagaland State Board (NBSE)", "Tamil": "Nagaland State Board (NBSE)", "Telugu": "Nagaland State Board (NBSE)", "Marathi": "Nagaland State Board (NBSE)", "Bengali": "Nagaland State Board (NBSE)", "Gujarati": "Nagaland State Board (NBSE)", "Punjabi": "Nagaland State Board (NBSE)", "Malayalam": "Nagaland State Board (NBSE)", "Odia": "Nagaland State Board (NBSE)"
    },
    "Odisha State Board (BSE Odisha)": {
        "English": "Odisha State Board (BSE Odisha)", "Hindi": "Odisha State Board (BSE Odisha)", "Kannada": "Odisha State Board (BSE Odisha)", "Tamil": "Odisha State Board (BSE Odisha)", "Telugu": "Odisha State Board (BSE Odisha)", "Marathi": "Odisha State Board (BSE Odisha)", "Bengali": "Odisha State Board (BSE Odisha)", "Gujarati": "Odisha State Board (BSE Odisha)", "Punjabi": "Odisha State Board (BSE Odisha)", "Malayalam": "Odisha State Board (BSE Odisha)", "Odia": "Odisha State Board (BSE Odisha)"
    },
    "Punjab State Board (PSEB)": {
        "English": "Punjab State Board (PSEB)", "Hindi": "Punjab State Board (PSEB)", "Kannada": "Punjab State Board (PSEB)", "Tamil": "Punjab State Board (PSEB)", "Telugu": "Punjab State Board (PSEB)", "Marathi": "Punjab State Board (PSEB)", "Bengali": "Punjab State Board (PSEB)", "Gujarati": "Punjab State Board (PSEB)", "Punjabi": "Punjab State Board (PSEB)", "Malayalam": "Punjab State Board (PSEB)", "Odia": "Punjab State Board (PSEB)"
    },
    "Rajasthan State Board (RBSE)": {
        "English": "Rajasthan State Board (RBSE)", "Hindi": "Rajasthan State Board (RBSE)", "Kannada": "Rajasthan State Board (RBSE)", "Tamil": "Rajasthan State Board (RBSE)", "Telugu": "Rajasthan State Board (RBSE)", "Marathi": "Rajasthan State Board (RBSE)", "Bengali": "Rajasthan State Board (RBSE)", "Gujarati": "Rajasthan State Board (RBSE)", "Punjabi": "Rajasthan State Board (RBSE)", "Malayalam": "Rajasthan State Board (RBSE)", "Odia": "Rajasthan State Board (RBSE)"
    },
    "Tamil Nadu State Board (SSLC)": {
        "English": "Tamil Nadu State Board (SSLC)", "Hindi": "Tamil Nadu State Board (SSLC)", "Kannada": "Tamil Nadu State Board (SSLC)", "Tamil": "Tamil Nadu State Board (SSLC)", "Telugu": "Tamil Nadu State Board (SSLC)", "Marathi": "Tamil Nadu State Board (SSLC)", "Bengali": "Tamil Nadu State Board (SSLC)", "Gujarati": "Tamil Nadu State Board (SSLC)", "Punjabi": "Tamil Nadu State Board (SSLC)", "Malayalam": "Tamil Nadu State Board (SSLC)", "Odia": "Tamil Nadu State Board (SSLC)"
    },
    "Telangana State Board (TSBIE)": {
        "English": "Telangana State Board (TSBIE)", "Hindi": "Telangana State Board (TSBIE)", "Kannada": "Telangana State Board (TSBIE)", "Tamil": "Telangana State Board (TSBIE)", "Telugu": "Telangana State Board (TSBIE)", "Marathi": "Telangana State Board (TSBIE)", "Bengali": "Telangana State Board (TSBIE)", "Gujarati": "Telangana State Board (TSBIE)", "Punjabi": "Telangana State Board (TSBIE)", "Malayalam": "Telangana State Board (TSBIE)", "Odia": "Telangana State Board (TSBIE)"
    },
    "Tripura State Board (TBSE)": {
        "English": "Tripura State Board (TBSE)", "Hindi": "Tripura State Board (TBSE)", "Kannada": "Tripura State Board (TBSE)", "Tamil": "Tripura State Board (TBSE)", "Telugu": "Tripura State Board (TBSE)", "Marathi": "Tripura State Board (TBSE)", "Bengali": "Tripura State Board (TBSE)", "Gujarati": "Tripura State Board (TBSE)", "Punjabi": "Tripura State Board (TBSE)", "Malayalam": "Tripura State Board (TBSE)", "Odia": "Tripura State Board (TBSE)"
    },
    "UP Board (UPMSP)": {
        "English": "UP Board (UPMSP)", "Hindi": "UP Board (UPMSP)", "Kannada": "UP Board (UPMSP)", "Tamil": "UP Board (UPMSP)", "Telugu": "UP Board (UPMSP)", "Marathi": "UP Board (UPMSP)", "Bengali": "UP Board (UPMSP)", "Gujarati": "UP Board (UPMSP)", "Punjabi": "UP Board (UPMSP)", "Malayalam": "UP Board (UPMSP)", "Odia": "UP Board (UPMSP)"
    },
    "Uttarakhand State Board (UBSE)": {
        "English": "Uttarakhand State Board (UBSE)", "Hindi": "Uttarakhand State Board (UBSE)", "Kannada": "Uttarakhand State Board (UBSE)", "Tamil": "Uttarakhand State Board (UBSE)", "Telugu": "Uttarakhand State Board (UBSE)", "Marathi": "Uttarakhand State Board (UBSE)", "Bengali": "Uttarakhand State Board (UBSE)", "Gujarati": "Uttarakhand State Board (UBSE)", "Punjabi": "Uttarakhand State Board (UBSE)", "Malayalam": "Uttarakhand State Board (UBSE)", "Odia": "Uttarakhand State Board (UBSE)"
    },
    "West Bengal State Board (WBBSE)": {
        "English": "West Bengal State Board (WBBSE)", "Hindi": "West Bengal State Board (WBBSE)", "Kannada": "West Bengal State Board (WBBSE)", "Tamil": "West Bengal State Board (WBBSE)", "Telugu": "West Bengal State Board (WBBSE)", "Marathi": "West Bengal State Board (WBBSE)", "Bengali": "West Bengal State Board (WBBSE)", "Gujarati": "West Bengal State Board (WBBSE)", "Punjabi": "West Bengal State Board (WBBSE)", "Malayalam": "West Bengal State Board (WBBSE)", "Odia": "West Bengal State Board (WBBSE)"
    },
    "Delhi Board (DBSE)": {
        "English": "Delhi Board (DBSE)", "Hindi": "Delhi Board (DBSE)", "Kannada": "Delhi Board (DBSE)", "Tamil": "Delhi Board (DBSE)", "Telugu": "Delhi Board (DBSE)", "Marathi": "Delhi Board (DBSE)", "Bengali": "Delhi Board (DBSE)", "Gujarati": "Delhi Board (DBSE)", "Punjabi": "Delhi Board (DBSE)", "Malayalam": "Delhi Board (DBSE)", "Odia": "Delhi Board (DBSE)"
    },
    "Puducherry Board": {
        "English": "Puducherry Board", "Hindi": "Puducherry Board", "Kannada": "Puducherry Board", "Tamil": "Puducherry Board", "Telugu": "Puducherry Board", "Marathi": "Puducherry Board", "Bengali": "Puducherry Board", "Gujarati": "Puducherry Board", "Punjabi": "Puducherry Board", "Malayalam": "Puducherry Board", "Odia": "Puducherry Board"
    },
    "Easy": {
        "English": "Easy", "Hindi": "आसान", "Kannada": "ಸುಲಭ", "Tamil": "எளிது", "Telugu": "సులభం", "Marathi": "सोपे", "Bengali": "সহজ", "Gujarati": "સરળ", "Punjabi": "ਸੌਖਾ", "Malayalam": "എളുപ്പം", "Odia": "ସହଜ"
    },
    "Moderate": {
        "English": "Moderate", "Hindi": "मध्यम", "Kannada": "ಮಧ್ಯಮ", "Tamil": "மிதமான", "Telugu": "మధ్యస్థం", "Marathi": "मध्यम", "Bengali": "মাঝারি", "Gujarati": "મધ્યમ", "Punjabi": "ਦਰਮਿਆਨਾ", "Malayalam": "ഇടത്തരം", "Odia": "ମଧ୍ୟମ"
    },
    "Hard": {
        "English": "Hard", "Hindi": "कठिन", "Kannada": "ಕಠಿಣ", "Tamil": "கடினம்", "Telugu": "కష్టం", "Marathi": "कठीण", "Bengali": "কঠিন", "Gujarati": "અઘરું", "Punjabi": "ਔਖਾ", "Malayalam": "കഠിനം", "Odia": "କଠିନ"
    },
    "Mixed": {
        "English": "Mixed", "Hindi": "मिश्रित", "Kannada": "ಮಿಶ್ರ", "Tamil": "கலப்பு", "Telugu": "మిశ్రమం", "Marathi": "मिश्र", "Bengali": "মিশ্র", "Gujarati": "મિશ્ર", "Punjabi": "ਮਿਸ਼ਰਤ", "Malayalam": "മിശ്രിതം", "Odia": "ମିଶ୍ରିତ"
    },
    "Track lesson plans created, students reached, and classroom time saved.": {
        "English": "Track lesson plans created, students reached, and classroom time saved.", "Hindi": "बनाई गई पाठ योजनाएँ, पहुँचे हुए विद्यार्थी और बचाया गया कक्षा समय ट्रैक करें।", "Kannada": "ರಚಿಸಿದ ಪಾಠ ಯೋಜನೆಗಳು, ತಲುಪಿದ ವಿದ್ಯಾರ್ಥಿಗಳು ಮತ್ತು ಉಳಿಸಿದ ತರಗತಿ ಸಮಯವನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.", "Tamil": "உருவாக்கப்பட்ட பாடத் திட்டங்கள், சென்றடைந்த மாணவர்கள் மற்றும் சேமிக்கப்பட்ட வகுப்பறை நேரத்தைக் கண்காணிக்கவும்.", "Telugu": "సృష్టించిన పాఠ ప్రణాళికలు, చేరిన విద్యార్థులు మరియు ఆదా చేసిన తరగతి సమయాన్ని ట్రాక్ చేయండి.", "Marathi": "तयार केलेल्या पाठ योजना, पोहोचलेले विद्यार्थी आणि वाचवलेला वर्ग वेळ ट्रॅक करा.", "Bengali": "তৈরি করা পাঠ পরিকল্পনা, পৌঁছানো শিক্ষার্থী এবং সাশ্রয় করা শ্রেণিকক্ষের সময় ট্র্যাক করুন।", "Gujarati": "બનાવેલી પાઠ યોજનાઓ, પહોંચેલા વિદ્યાર્થીઓ અને બચાવેલો વર્ગખંડ સમય ટ્રૅક કરો.", "Punjabi": "ਬਣਾਈਆਂ ਪਾਠ ਯੋਜਨਾਵਾਂ, ਪਹੁੰਚੇ ਵਿਦਿਆਰਥੀ ਅਤੇ ਬਚਾਇਆ ਜਮਾਤ ਸਮਾਂ ਟ੍ਰੈਕ ਕਰੋ।", "Malayalam": "സൃഷ്ടിച്ച പാഠ പദ്ധതികൾ, എത്തിച്ചേർന്ന വിദ്യാർത്ഥികൾ, ലാഭിച്ച ക്ലാസ് മുറി സമയം എന്നിവ ട്രാക്ക് ചെയ്യുക.", "Odia": "ତିଆରି ହୋଇଥିବା ପାଠ ଯୋଜନା, ପହଞ୍ଚିଥିବା ଛାତ୍ରଛାତ୍ରୀ ଏବଂ ସଞ୍ଚୟ ହୋଇଥିବା ଶ୍ରେଣୀକକ୍ଷ ସମୟ ଟ୍ରାକ୍ କରନ୍ତୁ।"
    },
    "Add Certification": {
        "English": "Add Certification", "Hindi": "प्रमाणन जोड़ें", "Kannada": "ಪ್ರಮಾಣೀಕರಣ ಸೇರಿಸಿ", "Tamil": "சான்றிதழ் சேர்க்கவும்", "Telugu": "ధృవీకరణ జోడించండి", "Marathi": "प्रमाणपत्र जोडा", "Bengali": "সার্টিফিকেশন যোগ করুন", "Gujarati": "પ્રમાણપત્ર ઉમેરો", "Punjabi": "ਪ੍ਰਮਾਣੀਕਰਨ ਜੋੜੋ", "Malayalam": "സർട്ടിഫിക്കേഷൻ ചേർക്കുക", "Odia": "ପ୍ରମାଣପତ୍ର ଯୋଡନ୍ତୁ"
    },
    "Add a professional credential. It will be marked pending until verified.": {
        "English": "Add a professional credential. It will be marked pending until verified.", "Hindi": "एक पेशेवर प्रमाण-पत्र जोड़ें। सत्यापित होने तक इसे लंबित के रूप में चिह्नित किया जाएगा।", "Kannada": "ವೃತ್ತಿಪರ ಪ್ರಮಾಣಪತ್ರವನ್ನು ಸೇರಿಸಿ. ಪರಿಶೀಲನೆಯಾಗುವವರೆಗೆ ಅದನ್ನು ಬಾಕಿ ಎಂದು ಗುರುತಿಸಲಾಗುತ್ತದೆ.", "Tamil": "ஒரு தொழில்முறை சான்றிதழைச் சேர்க்கவும். சரிபார்க்கப்படும் வரை அது நிலுவையில் உள்ளதாகக் குறிக்கப்படும்.", "Telugu": "ఒక వృత్తిపరమైన ధృవీకరణ పత్రాన్ని జోడించండి. ధృవీకరించబడే వరకు ఇది పెండింగ్‌గా గుర్తించబడుతుంది.", "Marathi": "व्यावसायिक प्रमाणपत्र जोडा. पडताळणी होईपर्यंत ते प्रलंबित म्हणून चिन्हांकित केले जाईल.", "Bengali": "একটি পেশাদার শংসাপত্র যোগ করুন। যাচাই না হওয়া পর্যন্ত এটি মুলতুবি হিসেবে চিহ্নিত থাকবে।", "Gujarati": "એક વ્યાવસાયિક પ્રમાણપત્ર ઉમેરો. ચકાસણી થાય ત્યાં સુધી તેને બાકી તરીકે ચિહ્નિત કરવામાં આવશે.", "Punjabi": "ਇੱਕ ਪੇਸ਼ੇਵਰ ਪ੍ਰਮਾਣ-ਪੱਤਰ ਜੋੜੋ। ਤਸਦੀਕ ਹੋਣ ਤੱਕ ਇਸਨੂੰ ਬਕਾਇਆ ਵਜੋਂ ਨਿਸ਼ਾਨਬੱਧ ਕੀਤਾ ਜਾਵੇਗਾ।", "Malayalam": "ഒരു പ്രൊഫഷണൽ ക്രെഡൻഷ്യൽ ചേർക്കുക. പരിശോധിക്കുന്നതുവരെ ഇത് തീർപ്പുകൽപ്പിക്കാത്തതായി അടയാളപ്പെടുത്തും.", "Odia": "ଗୋଟିଏ ବୃତ୍ତିଗତ ପ୍ରମାଣପତ୍ର ଯୋଡନ୍ତୁ। ଯାଞ୍ଚ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏହାକୁ ବିଚାରାଧୀନ ଭାବେ ଚିହ୍ନଟ କରାଯିବ।"
    },
    "Certification Name": {
        "English": "Certification Name", "Hindi": "प्रमाणन का नाम", "Kannada": "ಪ್ರಮಾಣೀಕರಣ ಹೆಸರು", "Tamil": "சான்றிதழ் பெயர்", "Telugu": "ధృవీకరణ పేరు", "Marathi": "प्रमाणपत्राचे नाव", "Bengali": "সার্টিফিকেশনের নাম", "Gujarati": "પ્રમાણપત્રનું નામ", "Punjabi": "ਪ੍ਰਮਾਣੀਕਰਨ ਦਾ ਨਾਮ", "Malayalam": "സർട്ടിഫിക്കേഷൻ പേര്", "Odia": "ପ୍ରମାଣପତ୍ର ନାମ"
    },
    "Certification submitted": {
        "English": "Certification submitted", "Hindi": "प्रमाणन सबमिट किया गया", "Kannada": "ಪ್ರಮಾಣೀಕರಣ ಸಲ್ಲಿಸಲಾಗಿದೆ", "Tamil": "சான்றிதழ் சமர்ப்பிக்கப்பட்டது", "Telugu": "ధృవీకరణ సమర్పించబడింది", "Marathi": "प्रमाणपत्र सादर केले", "Bengali": "সার্টিফিকেশন জমা দেওয়া হয়েছে", "Gujarati": "પ્રમાણપત્ર સબમિટ કર્યું", "Punjabi": "ਪ੍ਰਮਾਣੀਕਰਨ ਜਮ੍ਹਾਂ ਕੀਤਾ ਗਿਆ", "Malayalam": "സർട്ടിഫിക്കേഷൻ സമർപ്പിച്ചു", "Odia": "ପ୍ରମାଣପତ୍ର ଦାଖଲ ହୋଇଛି"
    },
    "Could not add certification": {
        "English": "Could not add certification", "Hindi": "प्रमाणन नहीं जोड़ा जा सका", "Kannada": "ಪ್ರಮಾಣೀಕರಣವನ್ನು ಸೇರಿಸಲಾಗಲಿಲ್ಲ", "Tamil": "சான்றிதழைச் சேர்க்க முடியவில்லை", "Telugu": "ధృవీకరణను జోడించలేకపోయాం", "Marathi": "प्रमाणपत्र जोडता आले नाही", "Bengali": "সার্টিফিকেশন যোগ করা যায়নি", "Gujarati": "પ્રમાણપત્ર ઉમેરી શકાયું નહીં", "Punjabi": "ਪ੍ਰਮਾਣੀਕਰਨ ਜੋੜਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ", "Malayalam": "സർട്ടിഫിക്കേഷൻ ചേർക്കാനായില്ല", "Odia": "ପ୍ରମାଣପତ୍ର ଯୋଡାଯାଇ ପାରିଲା ନାହିଁ"
    },
    "Issue Date": {
        "English": "Issue Date", "Hindi": "जारी करने की तिथि", "Kannada": "ವಿತರಣಾ ದಿನಾಂಕ", "Tamil": "வழங்கிய தேதி", "Telugu": "జారీ తేదీ", "Marathi": "जारी दिनांक", "Bengali": "ইস্যু তারিখ", "Gujarati": "જારી તારીખ", "Punjabi": "ਜਾਰੀ ਮਿਤੀ", "Malayalam": "ഇഷ്യൂ തീയതി", "Odia": "ଜାରି ତାରିଖ"
    },
    "Issuing Body": {
        "English": "Issuing Body", "Hindi": "जारी करने वाली संस्था", "Kannada": "ವಿತರಣಾ ಸಂಸ್ಥೆ", "Tamil": "வழங்கும் அமைப்பு", "Telugu": "జారీ చేసే సంస్థ", "Marathi": "जारी करणारी संस्था", "Bengali": "ইস্যুকারী সংস্থা", "Gujarati": "જારી કરનાર સંસ્થા", "Punjabi": "ਜਾਰੀ ਕਰਨ ਵਾਲੀ ਸੰਸਥਾ", "Malayalam": "ഇഷ്യൂ ചെയ്യുന്ന സ്ഥാപനം", "Odia": "ଜାରିକାରୀ ସଂସ୍ଥା"
    },
    "Your credential was added and is pending verification.": {
        "English": "Your credential was added and is pending verification.", "Hindi": "आपका प्रमाण-पत्र जोड़ दिया गया है और सत्यापन के लिए लंबित है।", "Kannada": "ನಿಮ್ಮ ಪ್ರಮಾಣಪತ್ರವನ್ನು ಸೇರಿಸಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಗೆ ಬಾಕಿ ಇದೆ.", "Tamil": "உங்கள் சான்றிதழ் சேர்க்கப்பட்டது மற்றும் சரிபார்ப்புக்காக நிலுவையில் உள்ளது.", "Telugu": "మీ ధృవీకరణ పత్రం జోడించబడింది మరియు ధృవీకరణ కోసం పెండింగ్‌లో ఉంది.", "Marathi": "तुमचे प्रमाणपत्र जोडले गेले आहे आणि पडताळणीसाठी प्रलंबित आहे.", "Bengali": "আপনার শংসাপত্র যোগ করা হয়েছে এবং যাচাইয়ের জন্য মুলতুবি রয়েছে।", "Gujarati": "તમારું પ્રમાણપત્ર ઉમેરવામાં આવ્યું છે અને ચકાસણી માટે બાકી છે.", "Punjabi": "ਤੁਹਾਡਾ ਪ੍ਰਮਾਣ-ਪੱਤਰ ਜੋੜ ਦਿੱਤਾ ਗਿਆ ਹੈ ਅਤੇ ਤਸਦੀਕ ਲਈ ਬਕਾਇਆ ਹੈ।", "Malayalam": "നിങ്ങളുടെ ക്രെഡൻഷ്യൽ ചേർത്തു, പരിശോധനയ്ക്കായി തീർപ്പുകൽപ്പിക്കാതെ കിടക്കുന്നു.", "Odia": "ଆପଣଙ୍କ ପ୍ରମାଣପତ୍ର ଯୋଡାଯାଇଛି ଏବଂ ଯାଞ୍ଚ ପାଇଁ ବିଚାରାଧୀନ ଅଛି।"
    },
    "e.g. B.Ed, CTET, Diploma in Education": {
        "English": "e.g. B.Ed, CTET, Diploma in Education", "Hindi": "जैसे B.Ed, CTET, Diploma in Education", "Kannada": "ಉದಾ. B.Ed, CTET, Diploma in Education", "Tamil": "எ.கா. B.Ed, CTET, Diploma in Education", "Telugu": "ఉదా. B.Ed, CTET, Diploma in Education", "Marathi": "उदा. B.Ed, CTET, Diploma in Education", "Bengali": "যেমন B.Ed, CTET, Diploma in Education", "Gujarati": "દા.ત. B.Ed, CTET, Diploma in Education", "Punjabi": "ਜਿਵੇਂ B.Ed, CTET, Diploma in Education", "Malayalam": "ഉദാ. B.Ed, CTET, Diploma in Education", "Odia": "ଯେପରି B.Ed, CTET, Diploma in Education"
    },
    "e.g. NCTE, State Board, University": {
        "English": "e.g. NCTE, State Board, University", "Hindi": "जैसे NCTE, State Board, University", "Kannada": "ಉದಾ. NCTE, State Board, University", "Tamil": "எ.கா. NCTE, State Board, University", "Telugu": "ఉదా. NCTE, State Board, University", "Marathi": "उदा. NCTE, State Board, University", "Bengali": "যেমন NCTE, State Board, University", "Gujarati": "દા.ત. NCTE, State Board, University", "Punjabi": "ਜਿਵੇਂ NCTE, State Board, University", "Malayalam": "ഉദാ. NCTE, State Board, University", "Odia": "ଯେପରି NCTE, State Board, University"
    },
    "Appearance": {
        "English": "Appearance", "Hindi": "दिखावट", "Kannada": "ಗೋಚರಿಕೆ", "Tamil": "தோற்றம்", "Telugu": "రూపం", "Marathi": "देखावा", "Bengali": "চেহারা", "Gujarati": "દેખાવ", "Punjabi": "ਦਿੱਖ", "Malayalam": "രൂപഭാവം", "Odia": "ଦୃଶ୍ୟ"
    },
    "Theme": {
        "English": "Theme", "Hindi": "थीम", "Kannada": "ಥೀಮ್", "Tamil": "தீம்", "Telugu": "థీమ్", "Marathi": "थीम", "Bengali": "থিম", "Gujarati": "થીમ", "Punjabi": "ਥੀਮ", "Malayalam": "തീം", "Odia": "ଥିମ୍"
    },
    "Light": {
        "English": "Light", "Hindi": "लाइट", "Kannada": "ಲೈಟ್", "Tamil": "ஒளி", "Telugu": "లైట్", "Marathi": "लाइट", "Bengali": "লাইট", "Gujarati": "લાઇટ", "Punjabi": "ਲਾਈਟ", "Malayalam": "ലൈറ്റ്", "Odia": "ଲାଇଟ୍"
    },
    "Dark": {
        "English": "Dark", "Hindi": "डार्क", "Kannada": "ಡಾರ್ಕ್", "Tamil": "இருள்", "Telugu": "డార్క్", "Marathi": "डार्क", "Bengali": "ডার্ক", "Gujarati": "ડાર્ક", "Punjabi": "ਡਾਰਕ", "Malayalam": "ഡാർക്ക്", "Odia": "ଡାର୍କ"
    },
    "Toggle theme": {
        "English": "Toggle theme", "Hindi": "थीम बदलें", "Kannada": "ಥೀಮ್ ಬದಲಿಸಿ", "Tamil": "தீமை மாற்று", "Telugu": "థీమ్ మార్చండి", "Marathi": "थीम बदला", "Bengali": "থিম পরিবর্তন করুন", "Gujarati": "થીમ બદલો", "Punjabi": "ਥੀਮ ਬਦਲੋ", "Malayalam": "തീം മാറ്റുക", "Odia": "ଥିମ୍ ବଦଳାନ୍ତୁ"
    },
    "Select your board": {
        "English": "Select your board", "Hindi": "अपना बोर्ड चुनें", "Kannada": "ನಿಮ್ಮ ಬೋರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ", "Tamil": "உங்கள் வாரியத்தைத் தேர்ந்தெடுக்கவும்", "Telugu": "మీ బోర్డును ఎంచుకోండి", "Marathi": "तुमचे मंडळ निवडा", "Bengali": "আপনার বোর্ড নির্বাচন করুন", "Gujarati": "તમારું બોર્ડ પસંદ કરો", "Punjabi": "ਆਪਣਾ ਬੋਰਡ ਚੁਣੋ", "Malayalam": "നിങ്ങളുടെ ബോർഡ് തിരഞ്ഞെടുക്കുക", "Odia": "ଆପଣଙ୍କ ବୋର୍ଡ ବାଛନ୍ତୁ"
    },
    "Selected:": {
        "English": "Selected:", "Hindi": "चयनित:", "Kannada": "ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ:", "Tamil": "தேர்ந்தெடுக்கப்பட்டது:", "Telugu": "ఎంచుకున్నవి:", "Marathi": "निवडलेले:", "Bengali": "নির্বাচিত:", "Gujarati": "પસંદ કરેલ:", "Punjabi": "ਚੁਣਿਆ ਗਿਆ:", "Malayalam": "തിരഞ്ഞെടുത്തത്:", "Odia": "ବଛାଯାଇଛି:"
    },
    "Shared": {
        "English": "Shared", "Hindi": "साझा किया गया", "Kannada": "ಹಂಚಲಾಗಿದೆ", "Tamil": "பகிரப்பட்டது", "Telugu": "షేర్ చేయబడింది", "Marathi": "शेअर केले", "Bengali": "শেয়ার করা হয়েছে", "Gujarati": "શેર કર્યું", "Punjabi": "ਸਾਂਝਾ ਕੀਤਾ", "Malayalam": "പങ്കിട്ടു", "Odia": "ସେୟାର କରାଯାଇଛି"
    },
    "We use your board to align AI-generated papers, quizzes and lessons.": {
        "English": "We use your board to align AI-generated papers, quizzes and lessons.", "Hindi": "हम AI-जनित पेपर, क्विज़ और पाठों को संरेखित करने के लिए आपके बोर्ड का उपयोग करते हैं।", "Kannada": "AI-ರಚಿತ ಪತ್ರಿಕೆಗಳು, ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಪಾಠಗಳನ್ನು ಹೊಂದಿಸಲು ನಾವು ನಿಮ್ಮ ಬೋರ್ಡ್ ಬಳಸುತ್ತೇವೆ.", "Tamil": "AI உருவாக்கிய தாள்கள், வினாடி வினாக்கள் மற்றும் பாடங்களைச் சீரமைக்க உங்கள் வாரியத்தைப் பயன்படுத்துகிறோம்.", "Telugu": "AI రూపొందించిన పేపర్లు, క్విజ్‌లు మరియు పాఠాలను సర్దుబాటు చేయడానికి మేము మీ బోర్డును ఉపయోగిస్తాము.", "Marathi": "AI-निर्मित पेपर, क्विझ आणि धडे संरेखित करण्यासाठी आम्ही तुमचे मंडळ वापरतो.", "Bengali": "AI-উত্পন্ন পেপার, কুইজ এবং পাঠ সারিবদ্ধ করতে আমরা আপনার বোর্ড ব্যবহার করি।", "Gujarati": "AI-જનરેટેડ પેપર, ક્વિઝ અને પાઠને સંરેખિત કરવા માટે અમે તમારા બોર્ડનો ઉપયોગ કરીએ છીએ.", "Punjabi": "ਅਸੀਂ AI ਦੁਆਰਾ ਬਣਾਏ ਪੇਪਰ, ਕਵਿਜ਼ ਅਤੇ ਪਾਠਾਂ ਨੂੰ ਇਕਸਾਰ ਕਰਨ ਲਈ ਤੁਹਾਡੇ ਬੋਰਡ ਦੀ ਵਰਤੋਂ ਕਰਦੇ ਹਾਂ।", "Malayalam": "AI സൃഷ്ടിച്ച പേപ്പറുകൾ, ക്വിസുകൾ, പാഠങ്ങൾ എന്നിവ ക്രമീകരിക്കാൻ ഞങ്ങൾ നിങ്ങളുടെ ബോർഡ് ഉപയോഗിക്കുന്നു.", "Odia": "AI ଦ୍ୱାରା ସୃଷ୍ଟ ପେପର, କୁଇଜ୍ ଏବଂ ପାଠ ସଜାଡ଼ିବାକୁ ଆମେ ଆପଣଙ୍କ ବୋର୍ଡ ବ୍ୟବହାର କରୁ।"
    },
    "Attach from My Library": {
        "English": "Attach from My Library", "Hindi": "My Library से जोड़ें", "Kannada": "My Library ಯಿಂದ ಲಗತ್ತಿಸಿ", "Tamil": "My Library இலிருந்து இணைக்கவும்", "Telugu": "My Library నుండి జోడించండి", "Marathi": "My Library मधून जोडा", "Bengali": "My Library থেকে যুক্ত করুন", "Gujarati": "My Library માંથી જોડો", "Punjabi": "My Library ਤੋਂ ਜੋੜੋ", "Malayalam": "My Library-യിൽ നിന്ന് ചേർക്കുക", "Odia": "My Library ରୁ ଯୋଡ଼ନ୍ତୁ"
    },
    "Could not send voice message": {
        "English": "Could not send voice message", "Hindi": "वॉइस संदेश नहीं भेजा जा सका", "Kannada": "ಧ್ವನಿ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ", "Tamil": "குரல் செய்தியை அனுப்ப முடியவில்லை", "Telugu": "వాయిస్ సందేశాన్ని పంపలేకపోయాం", "Marathi": "व्हॉइस संदेश पाठवता आला नाही", "Bengali": "ভয়েস বার্তা পাঠানো গেল না", "Gujarati": "વૉઇસ સંદેશ મોકલી શકાયો નહીં", "Punjabi": "ਵੌਇਸ ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜਿਆ ਜਾ ਸਕਿਆ", "Malayalam": "വോയ്സ് സന്ദേശം അയയ്ക്കാനായില്ല", "Odia": "ଭଏସ୍ ସନ୍ଦେଶ ପଠାଯାଇ ପାରିଲା ନାହିଁ"
    },
    "Could not start recording. Please try again.": {
        "English": "Could not start recording. Please try again.", "Hindi": "रिकॉर्डिंग शुरू नहीं हो सकी। कृपया फिर से कोशिश करें।", "Kannada": "ರೆಕಾರ್ಡಿಂಗ್ ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "பதிவைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "రికార్డింగ్ ప్రారంభించలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "रेकॉर्डिंग सुरू करता आली नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "রেকর্ডিং শুরু করা গেল না। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "રેકોર્ડિંગ શરૂ કરી શકાયું નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਰਿਕਾਰਡਿੰਗ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "റെക്കോർഡിംഗ് ആരംഭിക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରେକର୍ଡିଂ ଆରମ୍ଭ କରାଯାଇ ପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Microphone unavailable": {
        "English": "Microphone unavailable", "Hindi": "माइक्रोफ़ोन उपलब्ध नहीं है", "Kannada": "ಮೈಕ್ರೊಫೋನ್ ಲಭ್ಯವಿಲ್ಲ", "Tamil": "மைக்ரோஃபோன் கிடைக்கவில்லை", "Telugu": "మైక్రోఫోన్ అందుబాటులో లేదు", "Marathi": "मायक्रोफोन उपलब्ध नाही", "Bengali": "মাইক্রোফোন উপলব্ধ নেই", "Gujarati": "માઇક્રોફોન ઉપલબ્ધ નથી", "Punjabi": "ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਉਪਲਬਧ ਨਹੀਂ ਹੈ", "Malayalam": "മൈക്രോഫോൺ ലഭ്യമല്ല", "Odia": "ମାଇକ୍ରୋଫୋନ୍ ଉପଲବ୍ଧ ନାହିଁ"
    },
    "No audio was captured. Please try again.": {
        "English": "No audio was captured. Please try again.", "Hindi": "कोई ऑडियो रिकॉर्ड नहीं हुआ। कृपया फिर से कोशिश करें।", "Kannada": "ಯಾವುದೇ ಆಡಿಯೋ ಸೆರೆಹಿಡಿಯಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "எந்த ஆடியோவும் பதிவாகவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఎలాంటి ఆడియో రికార్డ్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "कोणताही ऑडिओ रेकॉर्ड झाला नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "কোনো অডিও রেকর্ড হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "કોઈ ઑડિયો કૅપ્ચર થયો નથી. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਕੋਈ ਆਡੀਓ ਰਿਕਾਰਡ ਨਹੀਂ ਹੋਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഓഡിയോ ഒന്നും റെക്കോർഡ് ചെയ്തില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "କୌଣସି ଅଡିଓ ରେକର୍ଡ ହୋଇନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "No saved resources yet": {
        "English": "No saved resources yet", "Hindi": "अभी तक कोई सहेजा गया संसाधन नहीं", "Kannada": "ಇನ್ನೂ ಯಾವುದೇ ಉಳಿಸಿದ ಸಂಪನ್ಮೂಲಗಳಿಲ್ಲ", "Tamil": "இதுவரை சேமித்த வளங்கள் இல்லை", "Telugu": "ఇంకా సేవ్ చేసిన వనరులు ఏవీ లేవు", "Marathi": "अद्याप कोणतीही जतन केलेली संसाधने नाहीत", "Bengali": "এখনও কোনো সংরক্ষিত রিসোর্স নেই", "Gujarati": "હજી સુધી કોઈ સાચવેલ સંસાધન નથી", "Punjabi": "ਅਜੇ ਤੱਕ ਕੋਈ ਸੰਭਾਲੇ ਸਰੋਤ ਨਹੀਂ", "Malayalam": "ഇതുവരെ സംരക്ഷിച്ച വിഭവങ്ങളൊന്നുമില്ല", "Odia": "ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ସଞ୍ଚିତ ସମ୍ବଳ ନାହିଁ"
    },
    "Nothing recorded": {
        "English": "Nothing recorded", "Hindi": "कुछ भी रिकॉर्ड नहीं हुआ", "Kannada": "ಏನೂ ರೆಕಾರ್ಡ್ ಆಗಿಲ್ಲ", "Tamil": "எதுவும் பதிவாகவில்லை", "Telugu": "ఏదీ రికార్డ్ కాలేదు", "Marathi": "काहीही रेकॉर्ड झाले नाही", "Bengali": "কিছুই রেকর্ড হয়নি", "Gujarati": "કંઈ રેકોર્ડ થયું નથી", "Punjabi": "ਕੁਝ ਵੀ ਰਿਕਾਰਡ ਨਹੀਂ ਹੋਇਆ", "Malayalam": "ഒന്നും റെക്കോർഡ് ചെയ്തിട്ടില്ല", "Odia": "କିଛି ରେକର୍ଡ ହୋଇନାହିଁ"
    },
    "Pick a saved resource to share in this chat.": {
        "English": "Pick a saved resource to share in this chat.", "Hindi": "इस चैट में साझा करने के लिए एक सहेजा गया संसाधन चुनें।", "Kannada": "ಈ ಚಾಟ್‌ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಲು ಉಳಿಸಿದ ಸಂಪನ್ಮೂಲವನ್ನು ಆಯ್ಕೆಮಾಡಿ.", "Tamil": "இந்த அரட்டையில் பகிர ஒரு சேமித்த வளத்தைத் தேர்ந்தெடுக்கவும்.", "Telugu": "ఈ చాట్‌లో షేర్ చేయడానికి సేవ్ చేసిన వనరును ఎంచుకోండి.", "Marathi": "या चॅटमध्ये शेअर करण्यासाठी जतन केलेले संसाधन निवडा.", "Bengali": "এই চ্যাটে শেয়ার করতে একটি সংরক্ষিত রিসোর্স বেছে নিন।", "Gujarati": "આ ચૅટમાં શેર કરવા માટે સાચવેલ સંસાધન પસંદ કરો.", "Punjabi": "ਇਸ ਚੈਟ ਵਿੱਚ ਸਾਂਝਾ ਕਰਨ ਲਈ ਇੱਕ ਸੰਭਾਲਿਆ ਸਰੋਤ ਚੁਣੋ।", "Malayalam": "ഈ ചാറ്റിൽ പങ്കിടാൻ സംരക്ഷിച്ച വിഭവം തിരഞ്ഞെടുക്കുക.", "Odia": "ଏହି ଚାଟ୍‌ରେ ସେୟାର କରିବାକୁ ଏକ ସଞ୍ଚିତ ସମ୍ବଳ ବାଛନ୍ତୁ।"
    },
    "Please allow microphone access to record a voice message.": {
        "English": "Please allow microphone access to record a voice message.", "Hindi": "वॉइस संदेश रिकॉर्ड करने के लिए कृपया माइक्रोफ़ोन एक्सेस की अनुमति दें।", "Kannada": "ಧ್ವನಿ ಸಂದೇಶ ರೆಕಾರ್ಡ್ ಮಾಡಲು ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶಕ್ಕೆ ಅನುಮತಿ ನೀಡಿ.", "Tamil": "குரல் செய்தியைப் பதிவு செய்ய மைக்ரோஃபோன் அணுகலை அனுமதிக்கவும்.", "Telugu": "వాయిస్ సందేశాన్ని రికార్డ్ చేయడానికి దయచేసి మైక్రోఫోన్ యాక్సెస్‌ను అనుమతించండి.", "Marathi": "व्हॉइस संदेश रेकॉर्ड करण्यासाठी कृपया मायक्रोफोन प्रवेशास परवानगी द्या.", "Bengali": "ভয়েস বার্তা রেকর্ড করতে অনুগ্রহ করে মাইক্রোফোন অ্যাক্সেসের অনুমতি দিন।", "Gujarati": "વૉઇસ સંદેશ રેકોર્ડ કરવા માટે કૃપા કરીને માઇક્રોફોન ઍક્સેસની મંજૂરી આપો.", "Punjabi": "ਵੌਇਸ ਸੁਨੇਹਾ ਰਿਕਾਰਡ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਪਹੁੰਚ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ।", "Malayalam": "വോയ്സ് സന്ദേശം റെക്കോർഡ് ചെയ്യാൻ ദയവായി മൈക്രോഫോൺ ആക്സസ് അനുവദിക്കുക.", "Odia": "ଭଏସ୍ ସନ୍ଦେଶ ରେକର୍ଡ କରିବାକୁ ଦୟାକରି ମାଇକ୍ରୋଫୋନ୍ ଆକ୍ସେସ୍ ଅନୁମତି ଦିଅନ୍ତୁ।"
    },
    "Please sign in to send a voice message.": {
        "English": "Please sign in to send a voice message.", "Hindi": "वॉइस संदेश भेजने के लिए कृपया साइन इन करें।", "Kannada": "ಧ್ವನಿ ಸಂದೇಶ ಕಳುಹಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ.", "Tamil": "குரல் செய்தியை அனுப்ப உள்நுழையவும்.", "Telugu": "వాయిస్ సందేశాన్ని పంపడానికి దయచేసి సైన్ ఇన్ చేయండి.", "Marathi": "व्हॉइस संदेश पाठवण्यासाठी कृपया साइन इन करा.", "Bengali": "ভয়েস বার্তা পাঠাতে অনুগ্রহ করে সাইন ইন করুন।", "Gujarati": "વૉઇસ સંદેશ મોકલવા માટે કૃપા કરીને સાઇન ઇન કરો.", "Punjabi": "ਵੌਇਸ ਸੁਨੇਹਾ ਭੇਜਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ।", "Malayalam": "വോയ്സ് സന്ദേശം അയയ്ക്കാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക.", "Odia": "ଭଏସ୍ ସନ୍ଦେଶ ପଠାଇବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।"
    },
    "Please sign in to view your library": {
        "English": "Please sign in to view your library", "Hindi": "अपनी लाइब्रेरी देखने के लिए कृपया साइन इन करें", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿ ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ", "Tamil": "உங்கள் நூலகத்தைப் பார்க்க உள்நுழையவும்", "Telugu": "మీ లైబ్రరీని చూడటానికి దయచేసి సైన్ ఇన్ చేయండి", "Marathi": "तुमची लायब्ररी पाहण्यासाठी कृपया साइन इन करा", "Bengali": "আপনার লাইব্রেরি দেখতে অনুগ্রহ করে সাইন ইন করুন", "Gujarati": "તમારી લાઇબ્રેરી જોવા માટે કૃપા કરીને સાઇન ઇન કરો", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਵੇਖਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਈਨ ਇਨ ਕਰੋ", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി കാണാൻ ദയവായി സൈൻ ഇൻ ചെയ്യുക", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଦେଖିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ"
    },
    "Recording failed": {
        "English": "Recording failed", "Hindi": "रिकॉर्डिंग विफल रही", "Kannada": "ರೆಕಾರ್ಡಿಂಗ್ ವಿಫಲವಾಗಿದೆ", "Tamil": "பதிவு தோல்வியடைந்தது", "Telugu": "రికార్డింగ్ విఫలమైంది", "Marathi": "रेकॉर्डिंग अयशस्वी झाली", "Bengali": "রেকর্ডিং ব্যর্থ হয়েছে", "Gujarati": "રેકોર્ડિંગ નિષ્ફળ થયું", "Punjabi": "ਰਿਕਾਰਡਿੰਗ ਅਸਫਲ ਰਹੀ", "Malayalam": "റെക്കോർഡിംഗ് പരാജയപ്പെട്ടു", "Odia": "ରେକର୍ଡିଂ ବିଫଳ ହେଲା"
    },
    "Recording not supported": {
        "English": "Recording not supported", "Hindi": "रिकॉर्डिंग समर्थित नहीं है", "Kannada": "ರೆಕಾರ್ಡಿಂಗ್ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ", "Tamil": "பதிவு ஆதரிக்கப்படவில்லை", "Telugu": "రికార్డింగ్ మద్దతు లేదు", "Marathi": "रेकॉर्डिंग समर्थित नाही", "Bengali": "রেকর্ডিং সমর্থিত নয়", "Gujarati": "રેકોર્ડિંગ સમર્થિત નથી", "Punjabi": "ਰਿਕਾਰਡਿੰਗ ਸਮਰਥਿਤ ਨਹੀਂ ਹੈ", "Malayalam": "റെക്കോർഡിംഗ് പിന്തുണയ്ക്കുന്നില്ല", "Odia": "ରେକର୍ଡିଂ ସମର୍ଥିତ ନୁହେଁ"
    },
    "Save a resource to your library, then attach it here.": {
        "English": "Save a resource to your library, then attach it here.", "Hindi": "अपनी लाइब्रेरी में कोई संसाधन सहेजें, फिर उसे यहाँ जोड़ें।", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿಗೆ ಸಂಪನ್ಮೂಲವನ್ನು ಉಳಿಸಿ, ನಂತರ ಅದನ್ನು ಇಲ್ಲಿ ಲಗತ್ತಿಸಿ.", "Tamil": "உங்கள் நூலகத்தில் ஒரு வளத்தைச் சேமித்து, பிறகு அதை இங்கே இணைக்கவும்.", "Telugu": "మీ లైబ్రరీలో ఒక వనరును సేవ్ చేసి, ఆపై దాన్ని ఇక్కడ జోడించండి.", "Marathi": "तुमच्या लायब्ररीमध्ये एखादे संसाधन जतन करा, मग ते येथे जोडा.", "Bengali": "আপনার লাইব্রেরিতে একটি রিসোর্স সংরক্ষণ করুন, তারপর সেটি এখানে যুক্ত করুন।", "Gujarati": "તમારી લાઇબ્રેરીમાં સંસાધન સાચવો, પછી તેને અહીં જોડો.", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਇੱਕ ਸਰੋਤ ਸੰਭਾਲੋ, ਫਿਰ ਉਸਨੂੰ ਇੱਥੇ ਜੋੜੋ।", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറിയിൽ ഒരു വിഭവം സംരക്ഷിക്കുക, എന്നിട്ട് അത് ഇവിടെ ചേർക്കുക.", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀରେ ଏକ ସମ୍ବଳ ସଞ୍ଚୟ କରନ୍ତୁ, ତାପରେ ଏହାକୁ ଏଠାରେ ଯୋଡ଼ନ୍ତୁ।"
    },
    "Search your library…": {
        "English": "Search your library…", "Hindi": "अपनी लाइब्रेरी खोजें…", "Kannada": "ನಿಮ್ಮ ಲೈಬ್ರರಿ ಹುಡುಕಿ…", "Tamil": "உங்கள் நூலகத்தில் தேடுங்கள்…", "Telugu": "మీ లైబ్రరీని శోధించండి…", "Marathi": "तुमची लायब्ररी शोधा…", "Bengali": "আপনার লাইব্রেরি খুঁজুন…", "Gujarati": "તમારી લાઇબ્રેરી શોધો…", "Punjabi": "ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਖੋਜੋ…", "Malayalam": "നിങ്ങളുടെ ലൈബ്രറി തിരയുക…", "Odia": "ଆପଣଙ୍କ ଲାଇବ୍ରେରୀ ଖୋଜନ୍ତୁ…"
    },
    "Sign in required": {
        "English": "Sign in required", "Hindi": "साइन इन आवश्यक है", "Kannada": "ಸೈನ್ ಇನ್ ಅಗತ್ಯವಿದೆ", "Tamil": "உள்நுழைவு தேவை", "Telugu": "సైన్ ఇన్ అవసరం", "Marathi": "साइन इन आवश्यक आहे", "Bengali": "সাইন ইন প্রয়োজন", "Gujarati": "સાઇન ઇન જરૂરી છે", "Punjabi": "ਸਾਈਨ ਇਨ ਲੋੜੀਂਦਾ ਹੈ", "Malayalam": "സൈൻ ഇൻ ആവശ്യമാണ്", "Odia": "ସାଇନ୍ ଇନ୍ ଆବଶ୍ୟକ"
    },
    "Something went wrong while recording. Please try again.": {
        "English": "Something went wrong while recording. Please try again.", "Hindi": "रिकॉर्डिंग के दौरान कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।", "Kannada": "ರೆಕಾರ್ಡಿಂಗ್ ಮಾಡುವಾಗ ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "பதிவு செய்யும்போது ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.", "Telugu": "రికార్డింగ్ చేస్తున్నప్పుడు ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "रेकॉर्डिंग करताना काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.", "Bengali": "রেকর্ড করার সময় কিছু একটা সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "રેકોર્ડિંગ દરમિયાન કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਰਿਕਾਰਡਿੰਗ ਦੌਰਾਨ ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "റെക്കോർഡ് ചെയ്യുമ്പോൾ എന്തോ പിഴച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ରେକର୍ଡ କରିବା ସମୟରେ କିଛି ଭୁଲ୍ ହୋଇଗଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Upload failed. Please check your connection and try again.": {
        "English": "Upload failed. Please check your connection and try again.", "Hindi": "अपलोड विफल रहा। कृपया अपना कनेक्शन जाँचें और फिर से कोशिश करें।", "Kannada": "ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "பதிவேற்றம் தோல்வியடைந்தது. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "Telugu": "అప్‌లోడ్ విఫలమైంది. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "अपलोड अयशस्वी झाले. कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.", "Bengali": "আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", "Gujarati": "અપલોડ નિષ્ફળ થયું. કૃપા કરીને તમારું કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.", "Punjabi": "ਅੱਪਲੋਡ ਅਸਫਲ ਰਿਹਾ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "അപ്‌ലോഡ് പരാജയപ്പെട്ടു. ദയവായി നിങ്ങളുടെ കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଅପଲୋଡ୍ ବିଫଳ ହେଲା। ଦୟାକରି ଆପଣଙ୍କ ସଂଯୋଗ ଯାଞ୍ଚ କରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Your browser does not support voice recording.": {
        "English": "Your browser does not support voice recording.", "Hindi": "आपका ब्राउज़र वॉइस रिकॉर्डिंग का समर्थन नहीं करता।", "Kannada": "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿ ರೆಕಾರ್ಡಿಂಗ್ ಅನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.", "Tamil": "உங்கள் உலாவி குரல் பதிவை ஆதரிக்கவில்லை.", "Telugu": "మీ బ్రౌజర్ వాయిస్ రికార్డింగ్‌కు మద్దతు ఇవ్వదు.", "Marathi": "तुमचा ब्राउझर व्हॉइस रेकॉर्डिंगला समर्थन देत नाही.", "Bengali": "আপনার ব্রাউজার ভয়েস রেকর্ডিং সমর্থন করে না।", "Gujarati": "તમારું બ્રાઉઝર વૉઇસ રેકોર્ડિંગને સમર્થન આપતું નથી.", "Punjabi": "ਤੁਹਾਡਾ ਬ੍ਰਾਊਜ਼ਰ ਵੌਇਸ ਰਿਕਾਰਡਿੰਗ ਦਾ ਸਮਰਥਨ ਨਹੀਂ ਕਰਦਾ।", "Malayalam": "നിങ്ങളുടെ ബ്രൗസർ വോയ്സ് റെക്കോർഡിംഗ് പിന്തുണയ്ക്കുന്നില്ല.", "Odia": "ଆପଣଙ୍କ ବ୍ରାଉଜର୍ ଭଏସ୍ ରେକର୍ଡିଂକୁ ସମର୍ଥନ କରେ ନାହିଁ।"
    },
    "Usage": {
        "English": "Usage", "Hindi": "उपयोग", "Kannada": "ಬಳಕೆ", "Tamil": "பயன்பாடு", "Telugu": "వినియోగం", "Marathi": "वापर", "Bengali": "ব্যবহার", "Gujarati": "વપરાશ", "Punjabi": "ਵਰਤੋਂ", "Malayalam": "ഉപയോഗം", "Odia": "ବ୍ୟବହାର"
    },
    "Resets {date}": {
        "English": "Resets {date}", "Hindi": "{date} को रीसेट होगा", "Kannada": "{date} ರಂದು ಮರುಹೊಂದಿಸಲಾಗುತ್ತದೆ", "Tamil": "{date} அன்று மீட்டமைக்கப்படும்", "Telugu": "{date}న రీసెట్ అవుతుంది", "Marathi": "{date} रोजी रीसेट होईल", "Bengali": "{date} তারিখে রিসেট হবে", "Gujarati": "{date} ના રોજ રીસેટ થશે", "Punjabi": "{date} ਨੂੰ ਰੀਸੈੱਟ ਹੋਵੇਗਾ", "Malayalam": "{date}ന് റീസെറ്റ് ചെയ്യും", "Odia": "{date}ରେ ରିସେଟ୍ ହେବ"
    },
    "Limit reached, resets {date}": {
        "English": "Limit reached, resets {date}", "Hindi": "सीमा समाप्त, {date} को रीसेट होगा", "Kannada": "ಮಿತಿ ತಲುಪಿದೆ, {date} ರಂದು ಮರುಹೊಂದಿಸಲಾಗುತ್ತದೆ", "Tamil": "வரம்பு எட்டப்பட்டது, {date} அன்று மீட்டமைக்கப்படும்", "Telugu": "పరిమితి చేరుకుంది, {date}న రీసెట్ అవుతుంది", "Marathi": "मर्यादा संपली, {date} रोजी रीसेट होईल", "Bengali": "সীমা শেষ, {date} তারিখে রিসেট হবে", "Gujarati": "મર્યાદા પૂરી, {date} ના રોજ રીસેટ થશે", "Punjabi": "ਸੀਮਾ ਪੂਰੀ, {date} ਨੂੰ ਰੀਸੈੱਟ ਹੋਵੇਗਾ", "Malayalam": "പരിധി തീർന്നു, {date}ന് റീസെറ്റ് ചെയ്യും", "Odia": "ସୀମା ସରିଲା, {date}ରେ ରିସେଟ୍ ହେବ"
    },
    "{count} remaining": {
        "English": "{count} remaining", "Hindi": "{count} शेष", "Kannada": "{count} ಉಳಿದಿದೆ", "Tamil": "{count} மீதம்", "Telugu": "{count} మిగిలి ఉంది", "Marathi": "{count} शिल्लक", "Bengali": "{count} অবশিষ্ট", "Gujarati": "{count} બાકી", "Punjabi": "{count} ਬਾਕੀ", "Malayalam": "{count} ശേഷിക്കുന്നു", "Odia": "{count} ବାକି"
    },
    "Tamil keyboard": {
        "English": "Tamil keyboard", "Hindi": "तमिल कीबोर्ड", "Kannada": "ತಮಿಳು ಕೀಬೋರ್ಡ್", "Tamil": "தமிழ் விசைப்பலகை", "Telugu": "తమిళ కీబోర్డ్", "Marathi": "तमिळ कीबोर्ड", "Bengali": "তামিল কীবোর্ড", "Gujarati": "તમિલ કીબોર્ડ", "Punjabi": "ਤਮਿਲ ਕੀਬੋਰਡ", "Malayalam": "തമിഴ് കീബോർഡ്", "Odia": "ତାମିଲ କୀବୋର୍ଡ"
    },
    "ABC": {
        "English": "ABC", "Hindi": "ABC", "Kannada": "ABC", "Tamil": "ABC", "Telugu": "ABC", "Marathi": "ABC", "Bengali": "ABC", "Gujarati": "ABC", "Punjabi": "ABC", "Malayalam": "ABC", "Odia": "ABC"
    },
    "Space": {
        "English": "Space", "Hindi": "स्पेस", "Kannada": "ಸ್ಪೇಸ್", "Tamil": "இடைவெளி", "Telugu": "స్పేస్", "Marathi": "स्पेस", "Bengali": "স্পেস", "Gujarati": "સ્પેસ", "Punjabi": "ਸਪੇਸ", "Malayalam": "സ്പേസ്", "Odia": "ସ୍ପେସ୍"
    },
    "Backspace": {
        "English": "Backspace", "Hindi": "बैकस्पेस", "Kannada": "ಬ್ಯಾಕ್‌ಸ್ಪೇಸ್", "Tamil": "பின்னழி", "Telugu": "బ్యాక్‌స్పేస్", "Marathi": "बॅकस्पेस", "Bengali": "ব্যাকস্পেস", "Gujarati": "બેકસ્પેસ", "Punjabi": "ਬੈਕਸਪੇਸ", "Malayalam": "ബാക്ക്സ്പേസ്", "Odia": "ବ୍ୟାକ୍‌ସ୍ପେସ୍"
    },
    "Close": {
        "English": "Close", "Hindi": "बंद करें", "Kannada": "ಮುಚ್ಚಿ", "Tamil": "மூடு", "Telugu": "మూసివేయి", "Marathi": "बंद करा", "Bengali": "বন্ধ করুন", "Gujarati": "બંધ કરો", "Punjabi": "ਬੰਦ ਕਰੋ", "Malayalam": "അടയ്ക്കുക", "Odia": "ବନ୍ଦ କରନ୍ତୁ"
    },
    "MCQ": {
        "English": "MCQ", "Hindi": "MCQ", "Kannada": "MCQ", "Tamil": "MCQ", "Telugu": "MCQ", "Marathi": "MCQ", "Bengali": "MCQ", "Gujarati": "MCQ", "Punjabi": "MCQ", "Malayalam": "MCQ", "Odia": "MCQ"
    },
    "VSA": {
        "English": "VSA", "Hindi": "VSA", "Kannada": "VSA", "Tamil": "VSA", "Telugu": "VSA", "Marathi": "VSA", "Bengali": "VSA", "Gujarati": "VSA", "Punjabi": "VSA", "Malayalam": "VSA", "Odia": "VSA"
    },
    "SA": {
        "English": "SA", "Hindi": "SA", "Kannada": "SA", "Tamil": "SA", "Telugu": "SA", "Marathi": "SA", "Bengali": "SA", "Gujarati": "SA", "Punjabi": "SA", "Malayalam": "SA", "Odia": "SA"
    },
    "LA": {
        "English": "LA", "Hindi": "LA", "Kannada": "LA", "Tamil": "LA", "Telugu": "LA", "Marathi": "LA", "Bengali": "LA", "Gujarati": "LA", "Punjabi": "LA", "Malayalam": "LA", "Odia": "LA"
    },
    "Case Study": {
        "English": "Case Study", "Hindi": "केस अध्ययन", "Kannada": "ಪ್ರಕರಣ ಅಧ್ಯಯನ", "Tamil": "வழக்கு ஆய்வு", "Telugu": "కేస్ స్టడీ", "Marathi": "केस अभ्यास", "Bengali": "কেস স্টাডি", "Gujarati": "કેસ સ્ટડી", "Punjabi": "ਕੇਸ ਸਟੱਡੀ", "Malayalam": "കേസ് സ്റ്റഡി", "Odia": "କେସ୍ ଷ୍ଟଡି"
    },
    "A-R": {
        "English": "A-R", "Hindi": "A-R", "Kannada": "A-R", "Tamil": "A-R", "Telugu": "A-R", "Marathi": "A-R", "Bengali": "A-R", "Gujarati": "A-R", "Punjabi": "A-R", "Malayalam": "A-R", "Odia": "A-R"
    },
    "Map": {
        "English": "Map", "Hindi": "मानचित्र", "Kannada": "ನಕ್ಷೆ", "Tamil": "வரைபடம்", "Telugu": "మ్యాప్", "Marathi": "नकाशा", "Bengali": "মানচিত্র", "Gujarati": "નકશો", "Punjabi": "ਨਕਸ਼ਾ", "Malayalam": "ഭൂപടം", "Odia": "ମ୍ୟାପ"
    },
    "Source": {
        "English": "Source", "Hindi": "स्रोत", "Kannada": "ಮೂಲ", "Tamil": "மூலம்", "Telugu": "మూలం", "Marathi": "स्रोत", "Bengali": "উৎস", "Gujarati": "સ્રોત", "Punjabi": "ਸਰੋਤ", "Malayalam": "സ്രോതസ്സ്", "Odia": "ଉତ୍ସ"
    },
    "just now": {
        "English": "just now", "Hindi": "अभी", "Kannada": "ಈಗಷ್ಟೇ", "Tamil": "இப்போதே", "Telugu": "ఇప్పుడే", "Marathi": "आत्ताच", "Bengali": "এইমাত্র", "Gujarati": "હમણાં જ", "Punjabi": "ਹੁਣੇ", "Malayalam": "ഇപ്പോൾ", "Odia": "ବର୍ତ୍ତମାନ"
    },
    "m ago": {
        "English": "m ago", "Hindi": "मिनट पहले", "Kannada": "ನಿಮಿಷ ಹಿಂದೆ", "Tamil": "நிமிடம் முன்", "Telugu": "నిమి క్రితం", "Marathi": "मिनिटांपूर्वी", "Bengali": "মিনিট আগে", "Gujarati": "મિનિટ પહેલાં", "Punjabi": "ਮਿੰਟ ਪਹਿਲਾਂ", "Malayalam": "മിനിറ്റ് മുമ്പ്", "Odia": "ମିନିଟ ପୂର୍ବେ"
    },
    "h ago": {
        "English": "h ago", "Hindi": "घंटे पहले", "Kannada": "ಗಂಟೆ ಹಿಂದೆ", "Tamil": "மணி முன்", "Telugu": "గం క్రితం", "Marathi": "तासांपूर्वी", "Bengali": "ঘণ্টা আগে", "Gujarati": "કલાક પહેલાં", "Punjabi": "ਘੰਟੇ ਪਹਿਲਾਂ", "Malayalam": "മണിക്കൂർ മുമ്പ്", "Odia": "ଘଣ୍ଟା ପୂର୍ବେ"
    },
    "d ago": {
        "English": "d ago", "Hindi": "दिन पहले", "Kannada": "ದಿನ ಹಿಂದೆ", "Tamil": "நாள் முன்", "Telugu": "రోజు క్రితం", "Marathi": "दिवसांपूर्वी", "Bengali": "দিন আগে", "Gujarati": "દિવસ પહેલાં", "Punjabi": "ਦਿਨ ਪਹਿਲਾਂ", "Malayalam": "ദിവസം മുമ്പ്", "Odia": "ଦିନ ପୂର୍ବେ"
    },
    "Please add at least one chapter for this board / grade / subject. We only have official blueprints for CBSE Class 9 and Class 10 Mathematics and Science.": {
        "English": "Please add at least one chapter for this board / grade / subject. We only have official blueprints for CBSE Class 9 and Class 10 Mathematics and Science.", "Hindi": "कृपया इस बोर्ड / कक्षा / विषय के लिए कम से कम एक अध्याय जोड़ें। हमारे पास केवल CBSE कक्षा 9 और 10 गणित और विज्ञान के लिए आधिकारिक ब्लूप्रिंट हैं।", "Kannada": "ದಯವಿಟ್ಟು ಈ ಬೋರ್ಡ್ / ತರಗತಿ / ವಿಷಯಕ್ಕೆ ಕನಿಷ್ಠ ಒಂದು ಅಧ್ಯಾಯ ಸೇರಿಸಿ. ನಮ್ಮಲ್ಲಿ CBSE ತರಗತಿ 9 ಮತ್ತು 10 ಗಣಿತ ಮತ್ತು ವಿಜ್ಞಾನಕ್ಕೆ ಮಾತ್ರ ಅಧಿಕೃತ ಬ್ಲೂಪ್ರಿಂಟ್‌ಗಳಿವೆ.", "Tamil": "இந்த வாரியம் / வகுப்பு / பாடத்திற்கு குறைந்தது ஒரு அத்தியாயத்தைச் சேர்க்கவும். எங்களிடம் CBSE வகுப்பு 9 மற்றும் 10 கணிதம் மற்றும் அறிவியலுக்கான அதிகாரப்பூர்வ வரைபடங்கள் மட்டுமே உள்ளன.", "Telugu": "దయచేసి ఈ బోర్డు / తరగతి / విషయానికి కనీసం ఒక అధ్యాయాన్ని జోడించండి. మాకు CBSE తరగతి 9 మరియు 10 గణితం మరియు సైన్స్ కోసం మాత్రమే అధికారిక బ్లూప్రింట్‌లు ఉన్నాయి.", "Marathi": "कृपया या मंडळ / इयत्ता / विषयासाठी किमान एक अध्याय जोडा. आमच्याकडे फक्त CBSE इयत्ता 9 आणि 10 गणित आणि विज्ञानासाठी अधिकृत ब्लूप्रिंट आहेत.", "Bengali": "অনুগ্রহ করে এই বোর্ড / শ্রেণী / বিষয়ের জন্য কমপক্ষে একটি অধ্যায় যোগ করুন। আমাদের কাছে শুধুমাত্র CBSE শ্রেণী 9 এবং 10 গণিত ও বিজ্ঞানের জন্য অফিসিয়াল ব্লুপ্রিন্ট আছে।", "Gujarati": "કૃપા કરી આ બોર્ડ / ધોરણ / વિષય માટે ઓછામાં ઓછું એક પ્રકરણ ઉમેરો. અમારી પાસે ફક્ત CBSE ધોરણ 9 અને 10 ગણિત અને વિજ્ઞાન માટેના સત્તાવાર બ્લુપ્રિન્ટ છે.", "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਬੋਰਡ / ਜਮਾਤ / ਵਿਸ਼ੇ ਲਈ ਘੱਟੋ ਘੱਟ ਇੱਕ ਅਧਿਆਏ ਜੋੜੋ। ਸਾਡੇ ਕੋਲ ਸਿਰਫ਼ CBSE ਜਮਾਤ 9 ਅਤੇ 10 ਗਣਿਤ ਅਤੇ ਵਿਗਿਆਨ ਲਈ ਅਧਿਕਾਰਤ ਬਲੂਪ੍ਰਿੰਟ ਹਨ।", "Malayalam": "ഈ ബോർഡ് / ക്ലാസ് / വിഷയത്തിന് കുറഞ്ഞത് ഒരു അധ്യായം ചേർക്കുക. ഞങ്ങൾക്ക് CBSE ക്ലാസ് 9, 10 ഗണിതം, ശാസ്ത്രം എന്നിവയ്ക്ക് മാത്രമേ ഔദ്യോഗിക ബ്ലൂപ്രിന്റുകൾ ഉള്ളൂ.", "Odia": "ଦୟାକରି ଏହି ବୋର୍ଡ / ଶ୍ରେଣୀ / ବିଷୟ ପାଇଁ ଅତିକମ୍ ଏକ ଅଧ୍ୟାୟ ଯୋଡନ୍ତୁ। ଆମ ପାଖରେ କେବଳ CBSE ଶ୍ରେଣୀ 9 ଏବଂ 10 ଗଣିତ ଏବଂ ବିଜ୍ଞାନ ପାଇଁ ସରକାରୀ ବ୍ଲୁପ୍ରିଣ୍ଟ ଅଛି।"
    },
    "Voice messages are not enabled on this account yet. Please try again later or contact support.": {
        "English": "Voice messages are not enabled on this account yet. Please try again later or contact support.", "Hindi": "इस खाते पर वॉइस मैसेज अभी सक्षम नहीं हैं। कृपया बाद में पुनः प्रयास करें या सहायता से संपर्क करें।", "Kannada": "ಈ ಖಾತೆಯಲ್ಲಿ ವಾಯ್ಸ್ ಸಂದೇಶಗಳು ಇನ್ನೂ ಸಕ್ರಿಯವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ.", "Tamil": "இந்த கணக்கில் குரல் செய்திகள் இன்னும் இயக்கப்படவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும் அல்லது ஆதரவை தொடர்பு கொள்ளவும்.", "Telugu": "ఈ ఖాతాలో వాయిస్ సందేశాలు ఇంకా ప్రారంభించబడలేదు. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి లేదా మద్దతును సంప్రదించండి.", "Marathi": "या खात्यावर व्हॉइस मेसेज अद्याप सक्षम नाहीत. कृपया नंतर पुन्हा प्रयत्न करा किंवा समर्थनाशी संपर्क साधा.", "Bengali": "এই অ্যাকাউন্টে ভয়েস মেসেজ এখনও সক্ষম নয়। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা সহায়তার সাথে যোগাযোগ করুন।", "Gujarati": "આ એકાઉન્ટ પર વોઇસ મેસેજ હજુ સક્ષમ નથી. કૃપા કરી પછી ફરી પ્રયત્ન કરો અથવા સપોર્ટનો સંપર્ક કરો.", "Punjabi": "ਇਸ ਖਾਤੇ 'ਤੇ ਆਵਾਜ਼ ਸੰਦੇਸ਼ ਹਾਲੇ ਚਾਲੂ ਨਹੀਂ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਸਹਾਇਤਾ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।", "Malayalam": "ഈ അക്കൗണ്ടിൽ വോയ്സ് സന്ദേശങ്ങൾ ഇതുവരെ പ്രവർത്തനക്ഷമമല്ല. പിന്നീട് വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ പിന്തുണയെ ബന്ധപ്പെടുക.", "Odia": "ଏହି ଆକାଉଣ୍ଟରେ ଭଏସ୍ ବାର୍ତ୍ତା ଏପର୍ଯ୍ୟନ୍ତ ସକ୍ଷମ ହୋଇନାହିଁ। ଦୟାକରି ପରେ ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା ସମର୍ଥନ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।"
    },
    "Help others grow": {
        "English": "Help others grow", "Hindi": "दूसरों को आगे बढ़ाने में मदद करें", "Kannada": "ಇತರರ ಬೆಳವಣಿಗೆಯಲ್ಲಿ ಸಹಾಯ ಮಾಡಿ", "Tamil": "மற்றவர்களின் வளர்ச்சிக்கு உதவுங்கள்", "Telugu": "ఇతరుల ఎదుగుదలకు సహాయపడండి", "Marathi": "इतरांना वाढण्यास मदत करा", "Bengali": "অন্যদের বৃদ্ধিতে সাহায্য করুন", "Gujarati": "બીજાઓને આગળ વધવામાં મદદ કરો", "Punjabi": "ਦੂਜਿਆਂ ਨੂੰ ਅੱਗੇ ਵਧਣ ਵਿੱਚ ਮਦਦ ਕਰੋ", "Malayalam": "മറ്റുള്ളവരുടെ വളർച്ചയ്ക്ക് സഹായിക്കുക", "Odia": "ଅନ୍ୟମାନଙ୍କୁ ବଢ଼ିବାରେ ସାହାଯ୍ୟ କରନ୍ତୁ"
    },
    // Used by fanoutNewTeacherJoinedNotification — {name} and {school} substituted server-side.
    "{name} joined SahayakAI from {school}": {
        "English": "{name} joined SahayakAI from {school}",
        "Hindi": "{name} ने {school} से SahayakAI जॉइन किया",
        "Kannada": "{name} ಅವರು {school} ನಿಂದ SahayakAI ಸೇರಿದರು",
        "Tamil": "{name} {school} இலிருந்து SahayakAI இல் சேர்ந்தார்",
        "Telugu": "{name} {school} నుండి SahayakAI లో చేరారు",
        "Marathi": "{name} यांनी {school} मधून SahayakAI जॉइन केले",
        "Bengali": "{name} {school} থেকে SahayakAI-তে যোগ দিয়েছেন",
        "Gujarati": "{name} એ {school} માંથી SahayakAI જોઈન કર્યું",
        "Punjabi": "{name} ਨੇ {school} ਤੋਂ SahayakAI ਜੁਆਇਨ ਕੀਤਾ",
        "Malayalam": "{name} {school} ൽ നിന്ന് SahayakAI യിൽ ചേർന്നു",
        "Odia": "{name} {school} ରୁ SahayakAI ରେ ଯୋଗ ଦେଲେ"
    },
    // ── Labs park (tranche 2, 2026-07-03) ──────────────────────────
    "Labs": {
        "English": "Labs",
        "Hindi": "लैब्स",
        "Kannada": "ಲ್ಯಾಬ್ಸ್",
        "Tamil": "லேப்ஸ்",
        "Telugu": "ల్యాబ్స్",
        "Marathi": "लॅब्स",
        "Bengali": "ল্যাবস",
        "Gujarati": "લેબ્સ",
        "Punjabi": "ਲੈਬਸ",
        "Malayalam": "ലാബ്സ്",
        "Odia": "ଲ୍ୟାବ୍ସ",
    },
    "Experimental tools.": {
        "English": "Experimental tools.",
        "Hindi": "प्रयोगात्मक उपकरण।",
        "Kannada": "ಪ್ರಾಯೋಗಿಕ ಸಾಧನಗಳು.",
        "Tamil": "சோதனைக் கருவிகள்.",
        "Telugu": "ప్రయోగాత్మక సాధనాలు.",
        "Marathi": "प्रायोगिक साधने.",
        "Bengali": "পরীক্ষামূলক টুল।",
        "Gujarati": "પ્રાયોગિક સાધનો.",
        "Punjabi": "ਪ੍ਰਯੋਗਾਤਮਕ ਟੂਲ।",
        "Malayalam": "പരീക്ഷണാത്മക ഉപകരണങ്ങൾ.",
        "Odia": "ପରୀକ୍ଷାମୂଳକ ଉପକରଣ।",
    },
    "Fair grading criteria.": {
        "English": "Fair grading criteria.",
        "Hindi": "निष्पक्ष मूल्यांकन मानदंड।",
        "Kannada": "ನ್ಯಾಯಯುತ ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು.",
        "Tamil": "நியாயமான மதிப்பீட்டு அளவுகோல்கள்.",
        "Telugu": "న్యాయమైన మూల్యాంకన ప్రమాణాలు.",
        "Marathi": "निष्पक्ष मूल्यमापन निकष.",
        "Bengali": "ন্যায্য মূল্যায়নের মানদণ্ড।",
        "Gujarati": "ન્યાયી મૂલ્યાંકન માપદંડ.",
        "Punjabi": "ਨਿਰਪੱਖ ਮੁਲਾਂਕਣ ਮਾਪਦੰਡ।",
        "Malayalam": "നീതിയുക്തമായ മൂല്യനിർണ്ണയ മാനദണ്ഡങ്ങൾ.",
        "Odia": "ନିରପେକ୍ଷ ମୂଲ୍ୟାଙ୍କନ ମାନଦଣ୍ଡ।",
    },
    "This is a Labs tool. It works, but we are still improving it.": {
        "English": "This is a Labs tool. It works, but we are still improving it.",
        "Hindi": "यह एक लैब्स टूल है। यह काम करता है, पर हम इसे और बेहतर बना रहे हैं।",
        "Kannada": "ಇದು ಲ್ಯಾಬ್ಸ್ ಸಾಧನ. ಇದು ಕೆಲಸ ಮಾಡುತ್ತದೆ, ಆದರೆ ನಾವು ಇದನ್ನು ಇನ್ನಷ್ಟು ಸುಧಾರಿಸುತ್ತಿದ್ದೇವೆ.",
        "Tamil": "இது ஒரு லேப்ஸ் கருவி. இது செயல்படுகிறது, ஆனால் நாங்கள் இதை மேலும் மேம்படுத்தி வருகிறோம்.",
        "Telugu": "ఇది ల్యాబ్స్ సాధనం. ఇది పనిచేస్తుంది, కానీ మేము దీన్ని మరింత మెరుగుపరుస్తున్నాము.",
        "Marathi": "हे एक लॅब्स साधन आहे. ते काम करते, पण आम्ही ते आणखी सुधारत आहोत.",
        "Bengali": "এটি একটি ল্যাবস টুল। এটি কাজ করে, তবে আমরা এটিকে আরও উন্নত করছি।",
        "Gujarati": "આ એક લેબ્સ સાધન છે. તે કામ કરે છે, પણ અમે તેને વધુ સુધારી રહ્યા છીએ.",
        "Punjabi": "ਇਹ ਇੱਕ ਲੈਬਸ ਟੂਲ ਹੈ। ਇਹ ਕੰਮ ਕਰਦਾ ਹੈ, ਪਰ ਅਸੀਂ ਇਸਨੂੰ ਹੋਰ ਬਿਹਤਰ ਬਣਾ ਰਹੇ ਹਾਂ।",
        "Malayalam": "ഇത് ഒരു ലാബ്സ് ഉപകരണമാണ്. ഇത് പ്രവർത്തിക്കുന്നു, പക്ഷേ ഞങ്ങൾ ഇത് കൂടുതൽ മെച്ചപ്പെടുത്തുകയാണ്.",
        "Odia": "ଏହା ଏକ ଲ୍ୟାବ୍ସ ଉପକରଣ। ଏହା କାମ କରେ, କିନ୍ତୁ ଆମେ ଏହାକୁ ଆହୁରି ଉନ୍ନତ କରୁଛୁ।",
    },
    "See all Labs tools": {
        "English": "See all Labs tools",
        "Hindi": "सभी लैब्स टूल देखें",
        "Kannada": "ಎಲ್ಲಾ ಲ್ಯಾಬ್ಸ್ ಸಾಧನಗಳನ್ನು ನೋಡಿ",
        "Tamil": "அனைத்து லேப்ஸ் கருவிகளையும் காண்க",
        "Telugu": "అన్ని ల్యాబ్స్ సాధనాలను చూడండి",
        "Marathi": "सर्व लॅब्स साधने पहा",
        "Bengali": "সব ল্যাবস টুল দেখুন",
        "Gujarati": "બધા લેબ્સ સાધનો જુઓ",
        "Punjabi": "ਸਾਰੇ ਲੈਬਸ ਟੂਲ ਵੇਖੋ",
        "Malayalam": "എല്ലാ ലാബ്സ് ഉപകരണങ്ങളും കാണുക",
        "Odia": "ସମସ୍ତ ଲ୍ୟାବ୍ସ ଉପକରଣ ଦେଖନ୍ତୁ",
    },
    "Tools we are still improving. They work, but you may find rough edges while we polish them.": {
        "English": "Tools we are still improving. They work, but you may find rough edges while we polish them.",
        "Hindi": "ऐसे टूल जिन्हें हम अभी बेहतर बना रहे हैं। ये काम करते हैं, पर पूरी तरह निखरने तक कुछ कमियाँ मिल सकती हैं।",
        "Kannada": "ನಾವು ಇನ್ನೂ ಸುಧಾರಿಸುತ್ತಿರುವ ಸಾಧನಗಳು. ಅವು ಕೆಲಸ ಮಾಡುತ್ತವೆ, ಆದರೆ ಕೆಲವು ಕೊರತೆಗಳು ಕಾಣಬಹುದು.",
        "Tamil": "நாங்கள் இன்னும் மேம்படுத்தி வரும் கருவிகள். அவை செயல்படுகின்றன, ஆனால் சில குறைகள் இருக்கலாம்.",
        "Telugu": "మేము ఇంకా మెరుగుపరుస్తున్న సాధనాలు. అవి పనిచేస్తాయి, కానీ కొన్ని లోపాలు కనబడవచ్చు.",
        "Marathi": "आम्ही अजून सुधारत असलेली साधने. ती काम करतात, पण काही उणिवा दिसू शकतात.",
        "Bengali": "যে টুলগুলো আমরা এখনও উন্নত করছি। এগুলো কাজ করে, তবে কিছু ত্রুটি চোখে পড়তে পারে।",
        "Gujarati": "જે સાધનો અમે હજી સુધારી રહ્યા છીએ. તે કામ કરે છે, પણ થોડી ખામીઓ દેખાઈ શકે છે.",
        "Punjabi": "ਉਹ ਟੂਲ ਜੋ ਅਸੀਂ ਹਾਲੇ ਬਿਹਤਰ ਬਣਾ ਰਹੇ ਹਾਂ। ਇਹ ਕੰਮ ਕਰਦੇ ਹਨ, ਪਰ ਕੁਝ ਕਮੀਆਂ ਮਿਲ ਸਕਦੀਆਂ ਹਨ।",
        "Malayalam": "ഞങ്ങൾ ഇപ്പോഴും മെച്ചപ്പെടുത്തിക്കൊണ്ടിരിക്കുന്ന ഉപകരണങ്ങൾ. അവ പ്രവർത്തിക്കുന്നു, പക്ഷേ ചില പോരായ്മകൾ കണ്ടേക്കാം.",
        "Odia": "ଆମେ ଏବେ ବି ଉନ୍ନତ କରୁଥିବା ଉପକରଣ। ସେଗୁଡ଼ିକ କାମ କରେ, କିନ୍ତୁ କିଛି ତ୍ରୁଟି ଦେଖାଯାଇପାରେ।",
    },
    "Scan and grade answer sheets.": {
        "English": "Scan and grade answer sheets.",
        "Hindi": "उत्तर पुस्तिकाएँ स्कैन कर जाँचें।",
        "Kannada": "ಉತ್ತರ ಪತ್ರಿಕೆಗಳನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ.",
        "Tamil": "விடைத்தாள்களை ஸ்கேன் செய்து மதிப்பிடுங்கள்.",
        "Telugu": "జవాబు పత్రాలను స్కాన్ చేసి మూల్యాంకనం చేయండి.",
        "Marathi": "उत्तरपत्रिका स्कॅन करून तपासा.",
        "Bengali": "উত্তরপত্র স্ক্যান করে মূল্যায়ন করুন।",
        "Gujarati": "જવાબવહી સ્કેન કરીને તપાસો.",
        "Punjabi": "ਉੱਤਰ ਪੱਤਰੀਆਂ ਸਕੈਨ ਕਰਕੇ ਜਾਂਚੋ।",
        "Malayalam": "ഉത്തരക്കടലാസുകൾ സ്കാൻ ചെയ്ത് മൂല്യനിർണ്ണയം ചെയ്യുക.",
        "Odia": "ଉତ୍ତର ଖାତା ସ୍କାନ କରି ମୂଲ୍ୟାଙ୍କନ କରନ୍ତୁ।",
    },
    "Curated videos for your topic.": {
        "English": "Curated videos for your topic.",
        "Hindi": "आपके विषय के लिए चुने हुए वीडियो।",
        "Kannada": "ನಿಮ್ಮ ವಿಷಯಕ್ಕೆ ಆಯ್ದ ವೀಡಿಯೊಗಳು.",
        "Tamil": "உங்கள் தலைப்பிற்கான தேர்ந்தெடுத்த வீடியோக்கள்.",
        "Telugu": "మీ అంశానికి ఎంపిక చేసిన వీడియోలు.",
        "Marathi": "तुमच्या विषयासाठी निवडक व्हिडिओ.",
        "Bengali": "আপনার বিষয়ের জন্য বাছাই করা ভিডিও।",
        "Gujarati": "તમારા વિષય માટે પસંદ કરેલા વિડિઓ.",
        "Punjabi": "ਤੁਹਾਡੇ ਵਿਸ਼ੇ ਲਈ ਚੁਣੀਆਂ ਵੀਡੀਓ।",
        "Malayalam": "നിങ്ങളുടെ വിഷയത്തിനായി തിരഞ്ഞെടുത്ത വീഡിയോകൾ.",
        "Odia": "ଆପଣଙ୍କ ବିଷୟ ପାଇଁ ବଛା ଭିଡିଓ।",
    },
    "Explore places from the classroom.": {
        "English": "Explore places from the classroom.",
        "Hindi": "कक्षा से ही दुनिया की सैर करें।",
        "Kannada": "ತರಗತಿಯಿಂದಲೇ ಸ್ಥಳಗಳನ್ನು ಅನ್ವೇಷಿಸಿ.",
        "Tamil": "வகுப்பறையிலிருந்தே இடங்களை ஆராயுங்கள்.",
        "Telugu": "తరగతి గది నుండే ప్రదేశాలను అన్వేషించండి.",
        "Marathi": "वर्गातूनच ठिकाणे एक्सप्लोर करा.",
        "Bengali": "শ্রেণিকক্ষ থেকেই বিভিন্ন স্থান ঘুরে দেখুন।",
        "Gujarati": "વર્ગખંડમાંથી જ સ્થળોની શોધ કરો.",
        "Punjabi": "ਕਲਾਸਰੂਮ ਤੋਂ ਹੀ ਥਾਵਾਂ ਦੀ ਸੈਰ ਕਰੋ।",
        "Malayalam": "ക്ലാസ്മുറിയിൽ നിന്നുതന്നെ സ്ഥലങ്ങൾ പര്യവേക്ഷണം ചെയ്യുക.",
        "Odia": "ଶ୍ରେଣୀଗୃହରୁ ହିଁ ସ୍ଥାନମାନ ବୁଲି ଦେଖନ୍ତୁ।",
    },
    "Your usage and time saved.": {
        "English": "Your usage and time saved.",
        "Hindi": "आपका उपयोग और बचाया गया समय।",
        "Kannada": "ನಿಮ್ಮ ಬಳಕೆ ಮತ್ತು ಉಳಿಸಿದ ಸಮಯ.",
        "Tamil": "உங்கள் பயன்பாடு மற்றும் சேமித்த நேரம்.",
        "Telugu": "మీ వినియోగం మరియు ఆదా అయిన సమయం.",
        "Marathi": "तुमचा वापर आणि वाचलेला वेळ.",
        "Bengali": "আপনার ব্যবহার ও সাশ্রয় হওয়া সময়।",
        "Gujarati": "તમારો ઉપયોગ અને બચેલો સમય.",
        "Punjabi": "ਤੁਹਾਡੀ ਵਰਤੋਂ ਅਤੇ ਬਚਾਇਆ ਸਮਾਂ।",
        "Malayalam": "നിങ്ങളുടെ ഉപയോഗവും ലാഭിച്ച സമയവും.",
        "Odia": "ଆପଣଙ୍କ ବ୍ୟବହାର ଏବଂ ବଞ୍ଚିଥିବା ସମୟ।",
    },
    // Dashboard-home redesign (tranche 6/7): recents strip + compact prep-tool row.
    "Continue where you left off": {
        "English": "Continue where you left off",
        "Hindi": "जहाँ छोड़ा था वहीं से जारी रखें",
        "Kannada": "ನೀವು ನಿಲ್ಲಿಸಿದ ಸ್ಥಳದಿಂದ ಮುಂದುವರಿಸಿ",
        "Tamil": "நிறுத்திய இடத்திலிருந்து தொடருங்கள்",
        "Telugu": "మీరు ఆపిన చోటు నుండి కొనసాగించండి",
        "Marathi": "जिथे थांबलात तिथून पुढे सुरू ठेवा",
        "Bengali": "যেখানে থেমেছিলেন সেখান থেকে চালিয়ে যান",
        "Gujarati": "જ્યાં અટક્યા હતા ત્યાંથી આગળ વધો",
        "Punjabi": "ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਜਾਰੀ ਰੱਖੋ",
        "Malayalam": "നിർത്തിയിടത്തു നിന്ന് തുടരുക",
        "Odia": "ଯେଉଁଠି ଛାଡିଥିଲେ ସେଠାରୁ ଜାରି ରଖନ୍ତୁ",
    },
    "Prep tools": {
        "English": "Prep tools",
        "Hindi": "तैयारी के टूल",
        "Kannada": "ತಯಾರಿ ಟೂಲ್‌ಗಳು",
        "Tamil": "தயாரிப்புக் கருவிகள்",
        "Telugu": "సిద్ధత సాధనాలు",
        "Marathi": "तयारीची साधने",
        "Bengali": "প্রস্তুতির টুল",
        "Gujarati": "તૈયારીનાં સાધનો",
        "Punjabi": "ਤਿਆਰੀ ਦੇ ਟੂਲ",
        "Malayalam": "തയ്യാറെടുപ്പ് ടൂളുകൾ",
        "Odia": "ପ୍ରସ୍ତୁତି ଉପକରଣ",
    },
    "Explore Labs": {
        "English": "Explore Labs",
        "Hindi": "लैब्स देखें",
        "Kannada": "ಲ್ಯಾಬ್ಸ್ ಅನ್ವೇಷಿಸಿ",
        "Tamil": "லேப்ஸ் ஆராயுங்கள்",
        "Telugu": "ల్యాబ్స్ అన్వేషించండి",
        "Marathi": "लॅब्स एक्सप्लोर करा",
        "Bengali": "ল্যাবস ঘুরে দেখুন",
        "Gujarati": "લેબ્સ જુઓ",
        "Punjabi": "ਲੈਬਜ਼ ਦੇਖੋ",
        "Malayalam": "ലാബ്സ് പര്യവേക്ഷണം ചെയ്യുക",
        "Odia": "ଲ୍ୟାବ୍ସ ଦେଖନ୍ତୁ",
    },
    // === Moderation v1 (tranche 6/7): block / report / blocked-users management ===
    "Block": {
        "English": "Block", "Hindi": "ब्लॉक करें", "Kannada": "ನಿರ್ಬಂಧಿಸಿ", "Tamil": "தடு", "Telugu": "బ్లాక్ చేయండి", "Marathi": "ब्लॉक करा", "Bengali": "ব্লক করুন", "Gujarati": "બ્લોક કરો", "Punjabi": "ਬਲਾਕ ਕਰੋ", "Malayalam": "ബ്ലോക്ക് ചെയ്യുക", "Odia": "ବ୍ଲକ୍ କରନ୍ତୁ"
    },
    "Unblock": {
        "English": "Unblock", "Hindi": "अनब्लॉक करें", "Kannada": "ನಿರ್ಬಂಧ ತೆಗೆಯಿರಿ", "Tamil": "தடை நீக்கு", "Telugu": "అన్‌బ్లాక్ చేయండి", "Marathi": "अनब्लॉक करा", "Bengali": "আনব্লক করুন", "Gujarati": "અનબ્લોક કરો", "Punjabi": "ਅਨਬਲਾਕ ਕਰੋ", "Malayalam": "അൺബ്ലോക്ക് ചെയ്യുക", "Odia": "ଅନବ୍ଲକ୍ କରନ୍ତୁ"
    },
    "Report": {
        "English": "Report", "Hindi": "रिपोर्ट करें", "Kannada": "ವರದಿ ಮಾಡಿ", "Tamil": "புகார் அளி", "Telugu": "నివేదించండి", "Marathi": "तक्रार नोंदवा", "Bengali": "রিপোর্ট করুন", "Gujarati": "જાણ કરો", "Punjabi": "ਰਿਪੋਰਟ ਕਰੋ", "Malayalam": "റിപ്പോർട്ട് ചെയ്യുക", "Odia": "ରିପୋର୍ଟ କରନ୍ତୁ"
    },
    "More options": {
        "English": "More options", "Hindi": "अधिक विकल्प", "Kannada": "ಇನ್ನಷ್ಟು ಆಯ್ಕೆಗಳು", "Tamil": "மேலும் விருப்பங்கள்", "Telugu": "మరిన్ని ఎంపికలు", "Marathi": "अधिक पर्याय", "Bengali": "আরও বিকল্প", "Gujarati": "વધુ વિકલ્પો", "Punjabi": "ਹੋਰ ਵਿਕਲਪ", "Malayalam": "കൂടുതൽ ഓപ്ഷനുകൾ", "Odia": "ଅଧିକ ବିକଳ୍ପ"
    },
    "Block this teacher?": {
        "English": "Block this teacher?", "Hindi": "इस शिक्षक को ब्लॉक करें?", "Kannada": "ಈ ಶಿಕ್ಷಕರನ್ನು ನಿರ್ಬಂಧಿಸುವುದೇ?", "Tamil": "இந்த ஆசிரியரைத் தடுக்கவா?", "Telugu": "ఈ ఉపాధ్యాయుడిని బ్లాక్ చేయాలా?", "Marathi": "या शिक्षकांना ब्लॉक करायचे का?", "Bengali": "এই শিক্ষককে ব্লক করবেন?", "Gujarati": "આ શિક્ષકને બ્લોક કરવા છે?", "Punjabi": "ਕੀ ਇਸ ਅਧਿਆਪਕ ਨੂੰ ਬਲਾਕ ਕਰਨਾ ਹੈ?", "Malayalam": "ഈ അധ്യാപകനെ ബ്ലോക്ക് ചെയ്യണോ?", "Odia": "ଏହି ଶିକ୍ଷକଙ୍କୁ ବ୍ଲକ୍ କରିବେ କି?"
    },
    "They will not be able to message you, and you will not see their posts or shared resources. They will not be notified.": {
        "English": "They will not be able to message you, and you will not see their posts or shared resources. They will not be notified.",
        "Hindi": "वे आपको संदेश नहीं भेज पाएँगे, और आपको उनकी पोस्ट या साझा सामग्री नहीं दिखेगी। उन्हें इसकी सूचना नहीं दी जाएगी।",
        "Kannada": "ಅವರು ನಿಮಗೆ ಸಂದೇಶ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗುವುದಿಲ್ಲ, ಮತ್ತು ಅವರ ಪೋಸ್ಟ್‌ಗಳು ಅಥವಾ ಹಂಚಿದ ಸಂಪನ್ಮೂಲಗಳು ನಿಮಗೆ ಕಾಣಿಸುವುದಿಲ್ಲ. ಅವರಿಗೆ ಈ ಬಗ್ಗೆ ತಿಳಿಸಲಾಗುವುದಿಲ್ಲ.",
        "Tamil": "அவர்கள் உங்களுக்குச் செய்தி அனுப்ப முடியாது, மேலும் அவர்களின் பதிவுகள் அல்லது பகிர்ந்த வளங்கள் உங்களுக்குத் தெரியாது. அவர்களுக்கு இது குறித்து அறிவிக்கப்படாது.",
        "Telugu": "వారు మీకు సందేశం పంపలేరు, మరియు వారి పోస్టులు లేదా పంచుకున్న వనరులు మీకు కనిపించవు. వారికి దీని గురించి తెలియజేయబడదు.",
        "Marathi": "ते तुम्हाला संदेश पाठवू शकणार नाहीत, आणि त्यांच्या पोस्ट किंवा शेअर केलेली साधने तुम्हाला दिसणार नाहीत. त्यांना याची सूचना दिली जाणार नाही.",
        "Bengali": "তাঁরা আপনাকে বার্তা পাঠাতে পারবেন না, এবং তাঁদের পোস্ট বা শেয়ার করা সামগ্রী আপনি দেখতে পাবেন না। তাঁদের এ বিষয়ে জানানো হবে না।",
        "Gujarati": "તેઓ તમને સંદેશ મોકલી શકશે નહીં, અને તેમની પોસ્ટ કે શેર કરેલી સામગ્રી તમને દેખાશે નહીં. તેમને આની જાણ કરવામાં આવશે નહીં.",
        "Punjabi": "ਉਹ ਤੁਹਾਨੂੰ ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜ ਸਕਣਗੇ, ਅਤੇ ਉਨ੍ਹਾਂ ਦੀਆਂ ਪੋਸਟਾਂ ਜਾਂ ਸਾਂਝੇ ਕੀਤੇ ਸਰੋਤ ਤੁਹਾਨੂੰ ਨਹੀਂ ਦਿਖਣਗੇ। ਉਨ੍ਹਾਂ ਨੂੰ ਇਸ ਬਾਰੇ ਸੂਚਿਤ ਨਹੀਂ ਕੀਤਾ ਜਾਵੇਗਾ।",
        "Malayalam": "അവർക്ക് നിങ്ങൾക്ക് സന്ദേശം അയയ്ക്കാൻ കഴിയില്ല, അവരുടെ പോസ്റ്റുകളോ പങ്കിട്ട ഉറവിടങ്ങളോ നിങ്ങൾ കാണില്ല. അവരെ ഇതേക്കുറിച്ച് അറിയിക്കില്ല.",
        "Odia": "ସେମାନେ ଆପଣଙ୍କୁ ବାର୍ତ୍ତା ପଠାଇପାରିବେ ନାହିଁ, ଏବଂ ସେମାନଙ୍କ ପୋଷ୍ଟ କିମ୍ବା ସହଭାଗ କରାଯାଇଥିବା ସାମଗ୍ରୀ ଆପଣ ଦେଖିପାରିବେ ନାହିଁ। ସେମାନଙ୍କୁ ଏ ବିଷୟରେ ସୂଚନା ଦିଆଯିବ ନାହିଁ।"
    },
    "User blocked": {
        "English": "User blocked", "Hindi": "उपयोगकर्ता ब्लॉक किया गया", "Kannada": "ಬಳಕೆದಾರರನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ", "Tamil": "பயனர் தடுக்கப்பட்டார்", "Telugu": "వినియోగదారు బ్లాక్ చేయబడ్డారు", "Marathi": "वापरकर्ता ब्लॉक केला", "Bengali": "ব্যবহারকারীকে ব্লক করা হয়েছে", "Gujarati": "વપરાશકર્તા બ્લોક થયા", "Punjabi": "ਵਰਤੋਂਕਾਰ ਬਲਾਕ ਕੀਤਾ ਗਿਆ", "Malayalam": "ഉപയോക്താവിനെ ബ്ലോക്ക് ചെയ്തു", "Odia": "ବ୍ୟବହାରକାରୀଙ୍କୁ ବ୍ଲକ୍ କରାଗଲା"
    },
    "User unblocked": {
        "English": "User unblocked", "Hindi": "उपयोगकर्ता अनब्लॉक किया गया", "Kannada": "ಬಳಕೆದಾರರ ನಿರ್ಬಂಧ ತೆಗೆಯಲಾಗಿದೆ", "Tamil": "பயனர் தடை நீக்கப்பட்டார்", "Telugu": "వినియోగదారు అన్‌బ్లాక్ చేయబడ్డారు", "Marathi": "वापरकर्ता अनब्लॉक केला", "Bengali": "ব্যবহারকারীকে আনব্লক করা হয়েছে", "Gujarati": "વપરાશકર્તા અનબ્લોક થયા", "Punjabi": "ਵਰਤੋਂਕਾਰ ਅਨਬਲਾਕ ਕੀਤਾ ਗਿਆ", "Malayalam": "ഉപയോക്താവിനെ അൺബ്ലോക്ക് ചെയ്തു", "Odia": "ବ୍ୟବହାରକାରୀଙ୍କୁ ଅନବ୍ଲକ୍ କରାଗଲା"
    },
    "Blocked users": {
        "English": "Blocked users", "Hindi": "ब्लॉक किए गए उपयोगकर्ता", "Kannada": "ನಿರ್ಬಂಧಿಸಿದ ಬಳಕೆದಾರರು", "Tamil": "தடுக்கப்பட்ட பயனர்கள்", "Telugu": "బ్లాక్ చేసిన వినియోగదారులు", "Marathi": "ब्लॉक केलेले वापरकर्ते", "Bengali": "ব্লক করা ব্যবহারকারী", "Gujarati": "બ્લોક કરેલા વપરાશકર્તાઓ", "Punjabi": "ਬਲਾਕ ਕੀਤੇ ਵਰਤੋਂਕਾਰ", "Malayalam": "ബ്ലോക്ക് ചെയ്ത ഉപയോക്താക്കൾ", "Odia": "ବ୍ଲକ୍ କରାଯାଇଥିବା ବ୍ୟବହାରକାରୀ"
    },
    "You have not blocked anyone.": {
        "English": "You have not blocked anyone.", "Hindi": "आपने किसी को ब्लॉक नहीं किया है।", "Kannada": "ನೀವು ಯಾರನ್ನೂ ನಿರ್ಬಂಧಿಸಿಲ್ಲ.", "Tamil": "நீங்கள் யாரையும் தடுக்கவில்லை.", "Telugu": "మీరు ఎవరినీ బ్లాక్ చేయలేదు.", "Marathi": "तुम्ही कोणालाही ब्लॉक केलेले नाही.", "Bengali": "আপনি কাউকে ব্লক করেননি।", "Gujarati": "તમે કોઈને બ્લોક કર્યા નથી.", "Punjabi": "ਤੁਸੀਂ ਕਿਸੇ ਨੂੰ ਬਲਾਕ ਨਹੀਂ ਕੀਤਾ।", "Malayalam": "നിങ്ങൾ ആരെയും ബ്ലോക്ക് ചെയ്തിട്ടില്ല.", "Odia": "ଆପଣ କାହାରିକୁ ବ୍ଲକ୍ କରିନାହାଁନ୍ତି।"
    },
    "Report content": {
        "English": "Report content", "Hindi": "सामग्री की रिपोर्ट करें", "Kannada": "ವಿಷಯವನ್ನು ವರದಿ ಮಾಡಿ", "Tamil": "உள்ளடக்கத்தைப் புகாரளி", "Telugu": "కంటెంట్‌ను నివేదించండి", "Marathi": "मजकुराची तक्रार करा", "Bengali": "সামগ্রীর রিপোর্ট করুন", "Gujarati": "સામગ્રીની જાણ કરો", "Punjabi": "ਸਮੱਗਰੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ", "Malayalam": "ഉള്ളടക്കം റിപ്പോർട്ട് ചെയ്യുക", "Odia": "ବିଷୟବସ୍ତୁ ରିପୋର୍ଟ କରନ୍ତୁ"
    },
    "Why are you reporting this?": {
        "English": "Why are you reporting this?", "Hindi": "आप इसकी रिपोर्ट क्यों कर रहे हैं?", "Kannada": "ನೀವು ಇದನ್ನು ಏಕೆ ವರದಿ ಮಾಡುತ್ತಿದ್ದೀರಿ?", "Tamil": "நீங்கள் ஏன் இதைப் புகாரளிக்கிறீர்கள்?", "Telugu": "మీరు దీన్ని ఎందుకు నివేదిస్తున్నారు?", "Marathi": "तुम्ही याची तक्रार का करत आहात?", "Bengali": "আপনি কেন এটির রিপোর্ট করছেন?", "Gujarati": "તમે આની જાણ કેમ કરી રહ્યા છો?", "Punjabi": "ਤੁਸੀਂ ਇਸ ਦੀ ਰਿਪੋਰਟ ਕਿਉਂ ਕਰ ਰਹੇ ਹੋ?", "Malayalam": "നിങ്ങൾ എന്തുകൊണ്ട് ഇത് റിപ്പോർട്ട് ചെയ്യുന്നു?", "Odia": "ଆପଣ ଏହାକୁ କାହିଁକି ରିପୋର୍ଟ କରୁଛନ୍ତି?"
    },
    "Harassment": {
        "English": "Harassment", "Hindi": "उत्पीड़न", "Kannada": "ಕಿರುಕುಳ", "Tamil": "துன்புறுத்தல்", "Telugu": "వేధింపు", "Marathi": "छळ", "Bengali": "হয়রানি", "Gujarati": "હેરાનગતિ", "Punjabi": "ਪਰੇਸ਼ਾਨੀ", "Malayalam": "പീഡനം", "Odia": "ହଇରାଣ"
    },
    "Inappropriate content": {
        "English": "Inappropriate content", "Hindi": "अनुचित सामग्री", "Kannada": "ಅನುಚಿತ ವಿಷಯ", "Tamil": "பொருத்தமற்ற உள்ளடக்கம்", "Telugu": "అనుచిత కంటెంట్", "Marathi": "अयोग्य मजकूर", "Bengali": "অনুপযুক্ত সামগ্রী", "Gujarati": "અયોગ્ય સામગ્રી", "Punjabi": "ਅਣਉਚਿਤ ਸਮੱਗਰੀ", "Malayalam": "അനുചിതമായ ഉള്ളടക്കം", "Odia": "ଅନୁପଯୁକ୍ତ ବିଷୟବସ୍ତୁ"
    },
    "Spam": {
        "English": "Spam", "Hindi": "स्पैम", "Kannada": "ಸ್ಪ್ಯಾಮ್", "Tamil": "ஸ்பேம்", "Telugu": "స్పామ్", "Marathi": "स्पॅम", "Bengali": "স্প্যাম", "Gujarati": "સ્પામ", "Punjabi": "ਸਪੈਮ", "Malayalam": "സ്പാം", "Odia": "ସ୍ପାମ୍"
    },
    "Other": {
        "English": "Other", "Hindi": "अन्य", "Kannada": "ಇತರೆ", "Tamil": "மற்றவை", "Telugu": "ఇతర", "Marathi": "इतर", "Bengali": "অন্যান্য", "Gujarati": "અન્ય", "Punjabi": "ਹੋਰ", "Malayalam": "മറ്റുള്ളവ", "Odia": "ଅନ୍ୟାନ୍ୟ"
    },
    "Add details (optional)": {
        "English": "Add details (optional)", "Hindi": "विवरण जोड़ें (वैकल्पिक)", "Kannada": "ವಿವರ ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)", "Tamil": "விவரங்களைச் சேர்க்கவும் (விருப்பத்திற்குரியது)", "Telugu": "వివరాలు జోడించండి (ఐచ్ఛికం)", "Marathi": "तपशील जोडा (ऐच्छिक)", "Bengali": "বিবরণ যোগ করুন (ঐচ্ছিক)", "Gujarati": "વિગતો ઉમેરો (વૈકલ્પિક)", "Punjabi": "ਵੇਰਵੇ ਜੋੜੋ (ਵਿਕਲਪਿਕ)", "Malayalam": "വിശദാംശങ്ങൾ ചേർക്കുക (ഐച്ഛികം)", "Odia": "ବିବରଣୀ ଯୋଡନ୍ତୁ (ଇଚ୍ଛାଧୀନ)"
    },
    "Submit report": {
        "English": "Submit report", "Hindi": "रिपोर्ट सबमिट करें", "Kannada": "ವರದಿ ಸಲ್ಲಿಸಿ", "Tamil": "புகாரைச் சமர்ப்பிக்கவும்", "Telugu": "నివేదికను సమర్పించండి", "Marathi": "तक्रार सबमिट करा", "Bengali": "রিপোর্ট জমা দিন", "Gujarati": "રિપોર્ટ સબમિટ કરો", "Punjabi": "ਰਿਪੋਰਟ ਜਮ੍ਹਾਂ ਕਰੋ", "Malayalam": "റിപ്പോർട്ട് സമർപ്പിക്കുക", "Odia": "ରିପୋର୍ଟ ଦାଖଲ କରନ୍ତୁ"
    },
    "Report submitted": {
        "English": "Report submitted", "Hindi": "रिपोर्ट सबमिट हो गई", "Kannada": "ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ", "Tamil": "புகார் சமர்ப்பிக்கப்பட்டது", "Telugu": "నివేదిక సమర్పించబడింది", "Marathi": "तक्रार सबमिट झाली", "Bengali": "রিপোর্ট জমা হয়েছে", "Gujarati": "રિપોર્ટ સબમિટ થયો", "Punjabi": "ਰਿਪੋਰਟ ਜਮ੍ਹਾਂ ਹੋ ਗਈ", "Malayalam": "റിപ്പോർട്ട് സമർപ്പിച്ചു", "Odia": "ରିପୋର୍ଟ ଦାଖଲ ହୋଇଛି"
    },
    "Thank you. Our team will review this report.": {
        "English": "Thank you. Our team will review this report.", "Hindi": "धन्यवाद। हमारी टीम इस रिपोर्ट की समीक्षा करेगी।", "Kannada": "ಧನ್ಯವಾದಗಳು. ನಮ್ಮ ತಂಡ ಈ ವರದಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.", "Tamil": "நன்றி. எங்கள் குழு இந்தப் புகாரை ஆய்வு செய்யும்.", "Telugu": "ధన్యవాదాలు. మా బృందం ఈ నివేదికను సమీక్షిస్తుంది.", "Marathi": "धन्यवाद. आमची टीम या तक्रारीचे पुनरावलोकन करेल.", "Bengali": "ধন্যবাদ। আমাদের দল এই রিপোর্টটি পর্যালোচনা করবে।", "Gujarati": "આભાર. અમારી ટીમ આ રિપોર્ટની સમીક્ષા કરશે.", "Punjabi": "ਧੰਨਵਾਦ। ਸਾਡੀ ਟੀਮ ਇਸ ਰਿਪੋਰਟ ਦੀ ਸਮੀਖਿਆ ਕਰੇਗੀ।", "Malayalam": "നന്ദി. ഞങ്ങളുടെ ടീം ഈ റിപ്പോർട്ട് പരിശോധിക്കും.", "Odia": "ଧନ୍ୟବାଦ। ଆମ ଦଳ ଏହି ରିପୋର୍ଟର ସମୀକ୍ଷା କରିବେ।"
    },
    "Could not complete this action. Please try again.": {
        "English": "Could not complete this action. Please try again.", "Hindi": "यह कार्रवाई पूरी नहीं हो सकी। कृपया फिर से प्रयास करें।", "Kannada": "ಈ ಕ್ರಿಯೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "Tamil": "இந்தச் செயலை நிறைவேற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Telugu": "ఈ చర్యను పూర్తి చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.", "Marathi": "ही क्रिया पूर्ण होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.", "Bengali": "এই কাজটি সম্পূর্ণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", "Gujarati": "આ ક્રિયા પૂર્ણ થઈ શકી નથી. કૃપા કરીને ફરી પ્રયાસ કરો.", "Punjabi": "ਇਹ ਕਾਰਵਾਈ ਪੂਰੀ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "Malayalam": "ഈ പ്രവർത്തനം പൂർത്തിയാക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.", "Odia": "ଏହି କାର୍ଯ୍ୟ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।"
    },
    "Cannot message this user": {
        "English": "Cannot message this user", "Hindi": "इस उपयोगकर्ता को संदेश नहीं भेजा जा सकता", "Kannada": "ಈ ಬಳಕೆದಾರರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ", "Tamil": "இந்தப் பயனருக்குச் செய்தி அனுப்ப முடியாது", "Telugu": "ఈ వినియోగదారుకు సందేశం పంపడం సాధ్యం కాదు", "Marathi": "या वापरकर्त्याला संदेश पाठवता येणार नाही", "Bengali": "এই ব্যবহারকারীকে বার্তা পাঠানো যাবে না", "Gujarati": "આ વપરાશકર્તાને સંદેશ મોકલી શકાતો નથી", "Punjabi": "ਇਸ ਵਰਤੋਂਕਾਰ ਨੂੰ ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜਿਆ ਜਾ ਸਕਦਾ", "Malayalam": "ഈ ഉപയോക്താവിന് സന്ദേശം അയയ്ക്കാൻ കഴിയില്ല", "Odia": "ଏହି ବ୍ୟବହାରକାରୀଙ୍କୁ ବାର୍ତ୍ତା ପଠାଯାଇପାରିବ ନାହିଁ"
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

// Indic fonts are SELF-HOSTED via next/font in src/app/layout.tsx (Phase 0,
// 2026-07-03) — every Noto Sans family ships as a build-time @font-face with
// a CSS variable, and globals.css maps :lang() to the right family. Syncing
// <html lang> (syncHtmlLang above) is therefore all this provider needs to
// do; the old runtime Google-Fonts injection (INDIC_FONT_URL +
// ensureIndicFontLoaded) is retired.

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
            }
        } catch { /* localStorage unavailable (restricted WebView) */ }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const { profile } = await getProfileData(user.uid);
                if (profile?.preferredLanguage) {
                    setLanguageState(profile.preferredLanguage as Language);
                    syncHtmlLang(profile.preferredLanguage as Language);
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
