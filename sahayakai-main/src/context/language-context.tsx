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
        "Gujarati": "મારી લાઈબ્રેરી",
        "Punjabi": "ਮੇਰੀ ਲਾਇਬ੍ਰੇਰੀ",
        "Malayalam": "എന്റെ ലൈബ്രറി",
        "Odia": "ମୋର ଲାଇବ୍ରେରୀ"
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
    "Visual Aid Designer": {
        "English": "Visual Aid Designer", "Hindi": "दृश्य सहायक डिज़ाइनर", "Kannada": "ದೃಶ್ಯ ಸಹಾಯ ವಿನ್ಯಾಸಕ",
        "Tamil": "காட்சி உதவி வடிவமைப்பாளர்", "Telugu": "విజువల్ ఎయిడ్ డిజైనర్", "Marathi": "व्हिज्युअल एड डिझायनर",
        "Bengali": "ভিজ্যুয়াল এইড ডিজাইনার", "Gujarati": "વિઝ્યુઅલ એઇડ ડિઝાઇનર", "Punjabi": "ਵਿਜ਼ੁਅਲ ਏਡ ਡਿਜ਼ਾਈਨਰ",
        "Malayalam": "വിഷ്വൽ എയ്ഡ് ഡിസൈനർ", "Odia": "ଭିଜୁଆଲ୍ ଏଡ୍ ଡିଜାଇନର"
    },
    "Content Creator": {
        "English": "Content Creator", "Hindi": "सामग्री निर्माता", "Kannada": "ವಿಷಯ ರಚನೆಕಾರ",
        "Tamil": "உள்ளடக்க உருவாக்கி", "Telugu": "కంటెంట్ క్రియేటర్", "Marathi": "सामग्री निर्माता",
        "Bengali": "কন্টেন্ট ক্রিয়েটর", "Gujarati": "કન્ટેન્ટ ક્રિએટર", "Punjabi": "ਸਮੱਗਰੀ ਨਿਰਮਾਤਾ",
        "Malayalam": "ഉള്ളടക്ക നിർമ്മാതാവ്", "Odia": "ବିଷୟବସ୍ତୁ ସ୍ରଷ୍ଟା"
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
        "English": "Virtual Field Trip", "Hindi": "आभासी क्षेत्र यात्रा", "Kannada": "ವಾಸ್ತವ ಕ್ಷೇತ್ರ ಪ್ರವಾಸ",
        "Tamil": "மெய்நிகர் களப்பயணம்", "Telugu": "వర్చువల్ ఫీల్డ్ ట్రిప్", "Marathi": "व्हर्च्युअल फील्ड ट्रिप",
        "Bengali": "ভার্চুয়াল ফিল্ড ট্রিপ", "Gujarati": "વર્ચ્યુઅલ ફિલ્ડ ટ્રિપ", "Punjabi": "ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ",
        "Malayalam": "വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്", "Odia": "ଭର୍ଚୁଆଲ ଫିଲ୍ଡ ଟ୍ରିପ"
    },
    "Teacher Training": {
        "English": "Teacher Training", "Hindi": "शिक्षक प्रशिक्षण", "Kannada": "ಶಿಕ್ಷಕ ತರಬೇತಿ",
        "Tamil": "ஆசிரியர் பயிற்சி", "Telugu": "ఉపాధ్యాయ శిక్షణ", "Marathi": "शिक्षक प्रशिक्षण",
        "Bengali": "শিক্ষক প্রশিক্ষণ", "Gujarati": "શિક્ષક તાલીમ", "Punjabi": "ਅਧਿਆਪਕ ਸਿਖਲਾਈ",
        "Malayalam": "അധ്യാപക പരിശീലനം", "Odia": "ଶିକ୍ଷକ ତାଲିମ"
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
    "Privacy": {
        "English": "Privacy", "Hindi": "गोपनीयता", "Kannada": "ಗೌಪ್ಯತೆ",
        "Tamil": "தனியுரிமை", "Telugu": "గోప్యత", "Marathi": "गोपनीयता",
        "Bengali": "গোপনীয়তা", "Gujarati": "ગોપનીયતા", "Punjabi": "ਪ੍ਰਾਈਵੇਸੀ",
        "Malayalam": "സ്വകാര്യത", "Odia": "ଗୋପନୀୟତା"
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
        "Bengali": "দিন আগে", "Gujarati": "દિવસ પહેલા", "Punjabi": "ਦਿਨ ਪਹਿਲਾਂ",
        "Malayalam": "ദിവസങ്ങൾക്ക് മുമ്പ്", "Odia": "ଦିନ ପୂର୍ବେ"
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
        "English": "Product", "Hindi": "उत्पाद", "Kannada": "ಉತ್ಪನ್ನ",
        "Tamil": "தயாரிப்பு", "Telugu": "ఉత్పత్తి", "Marathi": "उत्पादन",
        "Bengali": "পণ্য", "Gujarati": "ઉત્પાદન", "Punjabi": "ਉਤਪਾਦ",
        "Malayalam": "ഉൽപ്പന്നം", "Odia": "ଉତ୍ପାଦ"
    },
    "Pricing": {
        "English": "Pricing", "Hindi": "कीमत", "Kannada": "ಬೆಲೆ",
        "Tamil": "விலை", "Telugu": "ధర", "Marathi": "किंमत",
        "Bengali": "মূল্য", "Gujarati": "કિંમત", "Punjabi": "ਕੀਮਤ",
        "Malayalam": "വില", "Odia": "ମୂଲ୍ୟ"
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
