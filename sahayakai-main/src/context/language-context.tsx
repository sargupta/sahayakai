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
        "Tamil": "Listen in your language", "Telugu": "Listen in your language", "Marathi": "Listen in your language",
        "Bengali": "Listen in your language", "Gujarati": "Listen in your language", "Punjabi": "Listen in your language",
        "Malayalam": "Listen in your language", "Odia": "Listen in your language"
    },
    "Stop listening": {
        "English": "Stop listening", "Hindi": "सुनना बंद करें", "Kannada": "ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
        "Tamil": "Stop listening", "Telugu": "Stop listening", "Marathi": "Stop listening",
        "Bengali": "Stop listening", "Gujarati": "Stop listening", "Punjabi": "Stop listening",
        "Malayalam": "Stop listening", "Odia": "Stop listening"
    },
    "Language": {
        "English": "Language", "Hindi": "भाषा", "Kannada": "ಭಾಷೆ",
        "Tamil": "Language", "Telugu": "Language", "Marathi": "Language",
        "Bengali": "Language", "Gujarati": "Language", "Punjabi": "Language",
        "Malayalam": "Language", "Odia": "Language"
    },
    "Start free": {
        "English": "Start free", "Hindi": "मुफ्त शुरू करें", "Kannada": "ಉಚಿತವಾಗಿ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "Start free", "Telugu": "Start free", "Marathi": "Start free",
        "Bengali": "Start free", "Gujarati": "Start free", "Punjabi": "Start free",
        "Malayalam": "Start free", "Odia": "Start free"
    },
    "Log in": {
        "English": "Log in", "Hindi": "लॉग इन करें", "Kannada": "ಲಾಗ್ ಇನ್",
        "Tamil": "Log in", "Telugu": "Log in", "Marathi": "Log in",
        "Bengali": "Log in", "Gujarati": "Log in", "Punjabi": "Log in",
        "Malayalam": "Log in", "Odia": "Log in"
    },
    "Pricing, for Indian teachers": {
        "English": "Pricing, for Indian teachers", "Hindi": "भारतीय शिक्षकों के लिए कीमत", "Kannada": "ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ ಬೆಲೆ",
        "Tamil": "Pricing, for Indian teachers", "Telugu": "Pricing, for Indian teachers", "Marathi": "Pricing, for Indian teachers",
        "Bengali": "Pricing, for Indian teachers", "Gujarati": "Pricing, for Indian teachers", "Punjabi": "Pricing, for Indian teachers",
        "Malayalam": "Pricing, for Indian teachers", "Odia": "Pricing, for Indian teachers"
    },
    "Less than a textbook.": {
        "English": "Less than a textbook.", "Hindi": "एक किताब से भी कम।", "Kannada": "ಪಠ್ಯಪುಸ್ತಕಕ್ಕಿಂತ ಕಡಿಮೆ.",
        "Tamil": "Less than a textbook.", "Telugu": "Less than a textbook.", "Marathi": "Less than a textbook.",
        "Bengali": "Less than a textbook.", "Gujarati": "Less than a textbook.", "Punjabi": "Less than a textbook.",
        "Malayalam": "Less than a textbook.", "Odia": "Less than a textbook."
    },
    "Yours to cancel anytime.": {
        "English": "Yours to cancel anytime.", "Hindi": "कभी भी रद्द करें।", "Kannada": "ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಿ.",
        "Tamil": "Yours to cancel anytime.", "Telugu": "Yours to cancel anytime.", "Marathi": "Yours to cancel anytime.",
        "Bengali": "Yours to cancel anytime.", "Gujarati": "Yours to cancel anytime.", "Punjabi": "Yours to cancel anytime.",
        "Malayalam": "Yours to cancel anytime.", "Odia": "Yours to cancel anytime."
    },
    "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.": {
        "English": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Hindi": "हर प्लान में NCERT और 28 राज्य बोर्ड, 11 भारतीय भाषाएँ, और किसी भी एंड्रॉयड फोन पर वॉयस इनपुट शामिल है।",
        "Kannada": "ಪ್ರತಿ ಪ್ಲಾನ್ NCERT ಮತ್ತು 28 ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳು, 11 ಭಾರತೀಯ ಭಾಷೆಗಳು, ಮತ್ತು ಯಾವುದೇ ಆಂಡ್ರಾಯ್ಡ್ ಫೋನ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಅನ್ನು ಒಳಗೊಂಡಿರುತ್ತದೆ.",
        "Tamil": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Telugu": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Marathi": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Bengali": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Gujarati": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Punjabi": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Malayalam": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.",
        "Odia": "Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone."
    },
    "Monthly": {
        "English": "Monthly", "Hindi": "मासिक", "Kannada": "ಮಾಸಿಕ",
        "Tamil": "Monthly", "Telugu": "Monthly", "Marathi": "Monthly",
        "Bengali": "Monthly", "Gujarati": "Monthly", "Punjabi": "Monthly",
        "Malayalam": "Monthly", "Odia": "Monthly"
    },
    "Annual": {
        "English": "Annual", "Hindi": "वार्षिक", "Kannada": "ವಾರ್ಷಿಕ",
        "Tamil": "Annual", "Telugu": "Annual", "Marathi": "Annual",
        "Bengali": "Annual", "Gujarati": "Annual", "Punjabi": "Annual",
        "Malayalam": "Annual", "Odia": "Annual"
    },
    "Save 2 months": {
        "English": "Save 2 months", "Hindi": "2 महीने बचाएं", "Kannada": "2 ತಿಂಗಳು ಉಳಿಸಿ",
        "Tamil": "Save 2 months", "Telugu": "Save 2 months", "Marathi": "Save 2 months",
        "Bengali": "Save 2 months", "Gujarati": "Save 2 months", "Punjabi": "Save 2 months",
        "Malayalam": "Save 2 months", "Odia": "Save 2 months"
    },
    "Free": {
        "English": "Free", "Hindi": "मुफ़्त", "Kannada": "ಉಚಿತ",
        "Tamil": "Free", "Telugu": "Free", "Marathi": "Free",
        "Bengali": "Free", "Gujarati": "Free", "Punjabi": "Free",
        "Malayalam": "Free", "Odia": "Free"
    },
    "forever": {
        "English": "forever", "Hindi": "हमेशा के लिए", "Kannada": "ಶಾಶ್ವತವಾಗಿ",
        "Tamil": "forever", "Telugu": "forever", "Marathi": "forever",
        "Bengali": "forever", "Gujarati": "forever", "Punjabi": "forever",
        "Malayalam": "forever", "Odia": "forever"
    },
    "Most popular": {
        "English": "Most popular", "Hindi": "सबसे लोकप्रिय", "Kannada": "ಅತ್ಯಂತ ಜನಪ್ರಿಯ",
        "Tamil": "Most popular", "Telugu": "Most popular", "Marathi": "Most popular",
        "Bengali": "Most popular", "Gujarati": "Most popular", "Punjabi": "Most popular",
        "Malayalam": "Most popular", "Odia": "Most popular"
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
        "Tamil": "/month", "Telugu": "/month", "Marathi": "/month",
        "Bengali": "/month", "Gujarati": "/month", "Punjabi": "/month",
        "Malayalam": "/month", "Odia": "/month"
    },
    "/year": {
        "English": "/year", "Hindi": "/वर्ष", "Kannada": "/ವರ್ಷ",
        "Tamil": "/year", "Telugu": "/year", "Marathi": "/year",
        "Bengali": "/year", "Gujarati": "/year", "Punjabi": "/year",
        "Malayalam": "/year", "Odia": "/year"
    },
    "/teacher/year": {
        "English": "/teacher/year", "Hindi": "/शिक्षक/वर्ष", "Kannada": "/ಶಿಕ್ಷಕ/ವರ್ಷ",
        "Tamil": "/teacher/year", "Telugu": "/teacher/year", "Marathi": "/teacher/year",
        "Bengali": "/teacher/year", "Gujarati": "/teacher/year", "Punjabi": "/teacher/year",
        "Malayalam": "/teacher/year", "Odia": "/teacher/year"
    },
    "Start Pro": {
        "English": "Start Pro", "Hindi": "प्रो शुरू करें", "Kannada": "ಪ್ರೊ ಪ್ರಾರಂಭಿಸಿ",
        "Tamil": "Start Pro", "Telugu": "Start Pro", "Marathi": "Start Pro",
        "Bengali": "Start Pro", "Gujarati": "Start Pro", "Punjabi": "Start Pro",
        "Malayalam": "Start Pro", "Odia": "Start Pro"
    },
    "Book a school demo": {
        "English": "Book a school demo", "Hindi": "स्कूल डेमो बुक करें", "Kannada": "ಸ್ಕೂಲ್ ಡೆಮೊ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "Book a school demo", "Telugu": "Book a school demo", "Marathi": "Book a school demo",
        "Bengali": "Book a school demo", "Gujarati": "Book a school demo", "Punjabi": "Book a school demo",
        "Malayalam": "Book a school demo", "Odia": "Book a school demo"
    },
    "Your plan": {
        "English": "Your plan", "Hindi": "आपका प्लान", "Kannada": "ನಿಮ್ಮ ಪ್ಲಾನ್",
        "Tamil": "Your plan", "Telugu": "Your plan", "Marathi": "Your plan",
        "Bengali": "Your plan", "Gujarati": "Your plan", "Punjabi": "Your plan",
        "Malayalam": "Your plan", "Odia": "Your plan"
    },
    "Tax included": {
        "English": "Tax included", "Hindi": "टैक्स शामिल", "Kannada": "ತೆರಿಗೆ ಸೇರಿದೆ",
        "Tamil": "Tax included", "Telugu": "Tax included", "Marathi": "Tax included",
        "Bengali": "Tax included", "Gujarati": "Tax included", "Punjabi": "Tax included",
        "Malayalam": "Tax included", "Odia": "Tax included"
    },
    "7-day refund. Cancel anytime.": {
        "English": "7-day refund. Cancel anytime.", "Hindi": "7 दिन का रिफंड। कभी भी रद्द करें।", "Kannada": "7 ದಿನಗಳ ಮರುಪಾವತಿ. ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಿ.",
        "Tamil": "7-day refund. Cancel anytime.", "Telugu": "7-day refund. Cancel anytime.", "Marathi": "7-day refund. Cancel anytime.",
        "Bengali": "7-day refund. Cancel anytime.", "Gujarati": "7-day refund. Cancel anytime.", "Punjabi": "7-day refund. Cancel anytime.",
        "Malayalam": "7-day refund. Cancel anytime.", "Odia": "7-day refund. Cancel anytime."
    },
    // Terms TL;DR (plain-language summary)
    "In plain words": {
        "English": "In plain words", "Hindi": "आसान शब्दों में", "Kannada": "ಸುಲಭ ಪದಗಳಲ್ಲಿ",
        "Tamil": "In plain words", "Telugu": "In plain words", "Marathi": "In plain words",
        "Bengali": "In plain words", "Gujarati": "In plain words", "Punjabi": "In plain words",
        "Malayalam": "In plain words", "Odia": "In plain words"
    },
    "Whatever you create with SahayakAI is yours.": {
        "English": "Whatever you create with SahayakAI is yours.",
        "Hindi": "आप SahayakAI से जो भी बनाते हैं, वह आपका है।",
        "Kannada": "SahayakAI ನೊಂದಿಗೆ ನೀವು ಏನು ರಚಿಸುತ್ತೀರೋ ಅದು ನಿಮ್ಮದು.",
        "Tamil": "Whatever you create with SahayakAI is yours.", "Telugu": "Whatever you create with SahayakAI is yours.", "Marathi": "Whatever you create with SahayakAI is yours.",
        "Bengali": "Whatever you create with SahayakAI is yours.", "Gujarati": "Whatever you create with SahayakAI is yours.", "Punjabi": "Whatever you create with SahayakAI is yours.",
        "Malayalam": "Whatever you create with SahayakAI is yours.", "Odia": "Whatever you create with SahayakAI is yours."
    },
    "You can cancel anytime. 7-day refund on any paid plan.": {
        "English": "You can cancel anytime. 7-day refund on any paid plan.",
        "Hindi": "आप कभी भी रद्द कर सकते हैं। किसी भी भुगतान प्लान पर 7 दिन का रिफंड।",
        "Kannada": "ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ರದ್ದುಮಾಡಬಹುದು. ಯಾವುದೇ ಪಾವತಿ ಪ್ಲಾನ್‌ನಲ್ಲಿ 7 ದಿನಗಳ ಮರುಪಾವತಿ.",
        "Tamil": "You can cancel anytime. 7-day refund on any paid plan.", "Telugu": "You can cancel anytime. 7-day refund on any paid plan.", "Marathi": "You can cancel anytime. 7-day refund on any paid plan.",
        "Bengali": "You can cancel anytime. 7-day refund on any paid plan.", "Gujarati": "You can cancel anytime. 7-day refund on any paid plan.", "Punjabi": "You can cancel anytime. 7-day refund on any paid plan.",
        "Malayalam": "You can cancel anytime. 7-day refund on any paid plan.", "Odia": "You can cancel anytime. 7-day refund on any paid plan."
    },
    "Your data stays in India and you control it.": {
        "English": "Your data stays in India and you control it.",
        "Hindi": "आपका डेटा भारत में रहता है और उस पर आपका नियंत्रण है।",
        "Kannada": "ನಿಮ್ಮ ಡೇಟಾ ಭಾರತದಲ್ಲಿ ಇರುತ್ತದೆ ಮತ್ತು ಅದನ್ನು ನೀವೇ ನಿಯಂತ್ರಿಸುತ್ತೀರಿ.",
        "Tamil": "Your data stays in India and you control it.", "Telugu": "Your data stays in India and you control it.", "Marathi": "Your data stays in India and you control it.",
        "Bengali": "Your data stays in India and you control it.", "Gujarati": "Your data stays in India and you control it.", "Punjabi": "Your data stays in India and you control it.",
        "Malayalam": "Your data stays in India and you control it.", "Odia": "Your data stays in India and you control it."
    },
    "SahayakAI never asks for student personal data.": {
        "English": "SahayakAI never asks for student personal data.",
        "Hindi": "SahayakAI कभी भी छात्रों का निजी डेटा नहीं मांगता।",
        "Kannada": "SahayakAI ಎಂದಿಗೂ ವಿದ್ಯಾರ್ಥಿಗಳ ವೈಯಕ್ತಿಕ ಡೇಟಾವನ್ನು ಕೇಳುವುದಿಲ್ಲ.",
        "Tamil": "SahayakAI never asks for student personal data.", "Telugu": "SahayakAI never asks for student personal data.", "Marathi": "SahayakAI never asks for student personal data.",
        "Bengali": "SahayakAI never asks for student personal data.", "Gujarati": "SahayakAI never asks for student personal data.", "Punjabi": "SahayakAI never asks for student personal data.",
        "Malayalam": "SahayakAI never asks for student personal data.", "Odia": "SahayakAI never asks for student personal data."
    },
    "If there is a problem, email grievance@sargvision.com. We respond within 7 days.": {
        "English": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.",
        "Hindi": "अगर कोई समस्या है, तो grievance@sargvision.com पर ईमेल करें। हम 7 दिनों के भीतर जवाब देते हैं।",
        "Kannada": "ಸಮಸ್ಯೆ ಇದ್ದರೆ, grievance@sargvision.com ಗೆ ಇಮೇಲ್ ಮಾಡಿ. ನಾವು 7 ದಿನಗಳೊಳಗೆ ಉತ್ತರಿಸುತ್ತೇವೆ.",
        "Tamil": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.", "Telugu": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.", "Marathi": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.",
        "Bengali": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.", "Gujarati": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.", "Punjabi": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.",
        "Malayalam": "If there is a problem, email grievance@sargvision.com. We respond within 7 days.", "Odia": "If there is a problem, email grievance@sargvision.com. We respond within 7 days."
    },
    "Full legal terms below": {
        "English": "Full legal terms below", "Hindi": "नीचे पूर्ण कानूनी शर्तें", "Kannada": "ಕೆಳಗೆ ಪೂರ್ಣ ಕಾನೂನು ನಿಯಮಗಳು",
        "Tamil": "Full legal terms below", "Telugu": "Full legal terms below", "Marathi": "Full legal terms below",
        "Bengali": "Full legal terms below", "Gujarati": "Full legal terms below", "Punjabi": "Full legal terms below",
        "Malayalam": "Full legal terms below", "Odia": "Full legal terms below"
    },
    "Terms of Service": {
        "English": "Terms of Service", "Hindi": "सेवा की शर्तें", "Kannada": "ಸೇವಾ ನಿಯಮಗಳು",
        "Tamil": "Terms of Service", "Telugu": "Terms of Service", "Marathi": "Terms of Service",
        "Bengali": "Terms of Service", "Gujarati": "Terms of Service", "Punjabi": "Terms of Service",
        "Malayalam": "Terms of Service", "Odia": "Terms of Service"
    },
    "Legal": {
        "English": "Legal", "Hindi": "कानूनी", "Kannada": "ಕಾನೂನು",
        "Tamil": "Legal", "Telugu": "Legal", "Marathi": "Legal",
        "Bengali": "Legal", "Gujarati": "Legal", "Punjabi": "Legal",
        "Malayalam": "Legal", "Odia": "Legal"
    },
    // Post-consent confirmation (added for rural-teacher UX)
    "All set": {
        "English": "All set", "Hindi": "तैयार है", "Kannada": "ಸಿದ್ಧವಾಗಿದೆ",
        "Tamil": "All set", "Telugu": "All set", "Marathi": "All set",
        "Bengali": "All set", "Gujarati": "All set", "Punjabi": "All set",
        "Malayalam": "All set", "Odia": "All set"
    },
    "Thank you!": {
        "English": "Thank you!", "Hindi": "धन्यवाद!", "Kannada": "ಧನ್ಯವಾದಗಳು!",
        "Tamil": "Thank you!", "Telugu": "Thank you!", "Marathi": "Thank you!",
        "Bengali": "Thank you!", "Gujarati": "Thank you!", "Punjabi": "Thank you!",
        "Malayalam": "Thank you!", "Odia": "Thank you!"
    },
    "Thank you! Your privacy choices are saved.": {
        "English": "Thank you! Your privacy choices are saved.",
        "Hindi": "धन्यवाद! आपकी निजता की पसंद सुरक्षित हो गई है।",
        "Kannada": "ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಗೌಪ್ಯತೆಯ ಆಯ್ಕೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ.",
        "Tamil": "Thank you! Your privacy choices are saved.",
        "Telugu": "Thank you! Your privacy choices are saved.",
        "Marathi": "Thank you! Your privacy choices are saved.",
        "Bengali": "Thank you! Your privacy choices are saved.",
        "Gujarati": "Thank you! Your privacy choices are saved.",
        "Punjabi": "Thank you! Your privacy choices are saved.",
        "Malayalam": "Thank you! Your privacy choices are saved.",
        "Odia": "Thank you! Your privacy choices are saved."
    },
    "You agreed to these privacy terms.": {
        "English": "You agreed to these privacy terms.",
        "Hindi": "आपने इन निजता शर्तों से सहमति दी है।",
        "Kannada": "ನೀವು ಈ ಗೌಪ್ಯತಾ ನಿಯಮಗಳನ್ನು ಒಪ್ಪಿಕೊಂಡಿದ್ದೀರಿ.",
        "Tamil": "You agreed to these privacy terms.",
        "Telugu": "You agreed to these privacy terms.",
        "Marathi": "You agreed to these privacy terms.",
        "Bengali": "You agreed to these privacy terms.",
        "Gujarati": "You agreed to these privacy terms.",
        "Punjabi": "You agreed to these privacy terms.",
        "Malayalam": "You agreed to these privacy terms.",
        "Odia": "You agreed to these privacy terms."
    },
    "Go to my dashboard": {
        "English": "Go to my dashboard", "Hindi": "मेरे डैशबोर्ड पर जाएं", "Kannada": "ನನ್ನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ",
        "Tamil": "Go to my dashboard", "Telugu": "Go to my dashboard", "Marathi": "Go to my dashboard",
        "Bengali": "Go to my dashboard", "Gujarati": "Go to my dashboard", "Punjabi": "Go to my dashboard",
        "Malayalam": "Go to my dashboard", "Odia": "Go to my dashboard"
    },
    "Taking you there in": {
        "English": "Taking you there in", "Hindi": "आपको ले जा रहे हैं", "Kannada": "ನಿಮ್ಮನ್ನು ಕರೆದೊಯ್ಯಲಾಗುತ್ತಿದೆ",
        "Tamil": "Taking you there in", "Telugu": "Taking you there in", "Marathi": "Taking you there in",
        "Bengali": "Taking you there in", "Gujarati": "Taking you there in", "Punjabi": "Taking you there in",
        "Malayalam": "Taking you there in", "Odia": "Taking you there in"
    },
    "Taking you to your dashboard…": {
        "English": "Taking you to your dashboard…",
        "Hindi": "आपको आपके डैशबोर्ड पर ले जा रहे हैं…",
        "Kannada": "ನಿಮ್ಮನ್ನು ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಕರೆದೊಯ್ಯಲಾಗುತ್ತಿದೆ…",
        "Tamil": "Taking you to your dashboard…",
        "Telugu": "Taking you to your dashboard…",
        "Marathi": "Taking you to your dashboard…",
        "Bengali": "Taking you to your dashboard…",
        "Gujarati": "Taking you to your dashboard…",
        "Punjabi": "Taking you to your dashboard…",
        "Malayalam": "Taking you to your dashboard…",
        "Odia": "Taking you to your dashboard…"
    },
    "Saved on": {
        "English": "Saved on", "Hindi": "सहेजा गया", "Kannada": "ಉಳಿಸಲಾಗಿದೆ",
        "Tamil": "Saved on", "Telugu": "Saved on", "Marathi": "Saved on",
        "Bengali": "Saved on", "Gujarati": "Saved on", "Punjabi": "Saved on",
        "Malayalam": "Saved on", "Odia": "Saved on"
    },
    "We will ask you again only if we change anything important.": {
        "English": "We will ask you again only if we change anything important.",
        "Hindi": "अगर हम कुछ महत्वपूर्ण बदलेंगे, तभी हम आपसे फिर पूछेंगे।",
        "Kannada": "ಯಾವುದೇ ಪ್ರಮುಖ ಬದಲಾವಣೆಯಿದ್ದರೆ ಮಾತ್ರ ನಾವು ನಿಮ್ಮನ್ನು ಮತ್ತೆ ಕೇಳುತ್ತೇವೆ.",
        "Tamil": "We will ask you again only if we change anything important.",
        "Telugu": "We will ask you again only if we change anything important.",
        "Marathi": "We will ask you again only if we change anything important.",
        "Bengali": "We will ask you again only if we change anything important.",
        "Gujarati": "We will ask you again only if we change anything important.",
        "Punjabi": "We will ask you again only if we change anything important.",
        "Malayalam": "We will ask you again only if we change anything important.",
        "Odia": "We will ask you again only if we change anything important."
    },
    // Pricing: volume table + School Starter rail (2026-04-24)
    "Volume pricing": {
        "English": "Volume pricing", "Hindi": "वॉल्यूम मूल्य", "Kannada": "ಪ್ರಮಾಣದ ಬೆಲೆ",
        "Tamil": "Volume pricing", "Telugu": "Volume pricing", "Marathi": "Volume pricing",
        "Bengali": "Volume pricing", "Gujarati": "Volume pricing", "Punjabi": "Volume pricing",
        "Malayalam": "Volume pricing", "Odia": "Volume pricing"
    },
    "Custom quote": {
        "English": "Custom quote", "Hindi": "कस्टम कोट", "Kannada": "ಕಸ್ಟಮ್ ಕೋಟ್",
        "Tamil": "Custom quote", "Telugu": "Custom quote", "Marathi": "Custom quote",
        "Bengali": "Custom quote", "Gujarati": "Custom quote", "Punjabi": "Custom quote",
        "Malayalam": "Custom quote", "Odia": "Custom quote"
    },
    "Minimum 20 teachers · billed annually": {
        "English": "Minimum 20 teachers · billed annually",
        "Hindi": "न्यूनतम 20 शिक्षक · वार्षिक बिलिंग",
        "Kannada": "ಕನಿಷ್ಠ 20 ಶಿಕ್ಷಕರು · ವಾರ್ಷಿಕ ಬಿಲ್",
        "Tamil": "Minimum 20 teachers · billed annually", "Telugu": "Minimum 20 teachers · billed annually", "Marathi": "Minimum 20 teachers · billed annually",
        "Bengali": "Minimum 20 teachers · billed annually", "Gujarati": "Minimum 20 teachers · billed annually", "Punjabi": "Minimum 20 teachers · billed annually",
        "Malayalam": "Minimum 20 teachers · billed annually", "Odia": "Minimum 20 teachers · billed annually"
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
        "Tamil": "For small schools (5–19 teachers)", "Telugu": "For small schools (5–19 teachers)", "Marathi": "For small schools (5–19 teachers)",
        "Bengali": "For small schools (5–19 teachers)", "Gujarati": "For small schools (5–19 teachers)", "Punjabi": "For small schools (5–19 teachers)",
        "Malayalam": "For small schools (5–19 teachers)", "Odia": "For small schools (5–19 teachers)"
    },
    "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.": {
        "English": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Hindi": "हर शिक्षक के लिए Pro की सभी सुविधाएँ, साथ में एक सरल प्रिंसिपल डैशबोर्ड और ऑनबोर्डिंग सहायता। 20 शिक्षकों की कोई न्यूनतम सीमा नहीं।",
        "Kannada": "ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ Pro ಎಲ್ಲಾ ವೈಶಿಷ್ಟ್ಯಗಳು, ಜೊತೆಗೆ ಸರಳ ಪ್ರಿನ್ಸಿಪಾಲ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಮತ್ತು ಆನ್‌ಬೋರ್ಡಿಂಗ್ ಸಹಾಯ. 20 ಶಿಕ್ಷಕರ ಕನಿಷ್ಠ ಮಿತಿ ಇಲ್ಲ.",
        "Tamil": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Telugu": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Marathi": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Bengali": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Gujarati": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Punjabi": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Malayalam": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.",
        "Odia": "Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum."
    },
    "Pricing tailored to your school. We come to you.": {
        "English": "Pricing tailored to your school. We come to you.",
        "Hindi": "आपके स्कूल के अनुसार मूल्य। हम आपके पास आते हैं।",
        "Kannada": "ನಿಮ್ಮ ಶಾಲೆಗೆ ಅನುಗುಣವಾಗಿ ಬೆಲೆ. ನಾವು ನಿಮ್ಮ ಬಳಿಗೆ ಬರುತ್ತೇವೆ.",
        "Tamil": "Pricing tailored to your school. We come to you.",
        "Telugu": "Pricing tailored to your school. We come to you.",
        "Marathi": "Pricing tailored to your school. We come to you.",
        "Bengali": "Pricing tailored to your school. We come to you.",
        "Gujarati": "Pricing tailored to your school. We come to you.",
        "Punjabi": "Pricing tailored to your school. We come to you.",
        "Malayalam": "Pricing tailored to your school. We come to you.",
        "Odia": "Pricing tailored to your school. We come to you."
    },
    "Book a small-school call": {
        "English": "Book a small-school call", "Hindi": "छोटे-स्कूल कॉल बुक करें", "Kannada": "ಚಿಕ್ಕ-ಶಾಲೆ ಕರೆ ಬುಕ್ ಮಾಡಿ",
        "Tamil": "Book a small-school call", "Telugu": "Book a small-school call", "Marathi": "Book a small-school call",
        "Bengali": "Book a small-school call", "Gujarati": "Book a small-school call", "Punjabi": "Book a small-school call",
        "Malayalam": "Book a small-school call", "Odia": "Book a small-school call"
    },
    // ---- /pricing tier feature bullets (2026-04-25 i18n fix) ----
    // Free
    "10 lesson plans per month": {
        "English": "10 lesson plans per month", "Hindi": "10 पाठ योजनाएँ प्रति माह", "Kannada": "ತಿಂಗಳಿಗೆ 10 ಪಾಠ ಯೋಜನೆಗಳು",
        "Tamil": "10 lesson plans per month", "Telugu": "10 lesson plans per month", "Marathi": "10 lesson plans per month",
        "Bengali": "10 lesson plans per month", "Gujarati": "10 lesson plans per month", "Punjabi": "10 lesson plans per month",
        "Malayalam": "10 lesson plans per month", "Odia": "10 lesson plans per month"
    },
    "5 quizzes + 5 worksheets per month": {
        "English": "5 quizzes + 5 worksheets per month",
        "Hindi": "5 क्विज़ + 5 वर्कशीट प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 5 ಕ್ವಿಜ್ + 5 ವರ್ಕ್‌ಶೀಟ್‌ಗಳು",
        "Tamil": "5 quizzes + 5 worksheets per month", "Telugu": "5 quizzes + 5 worksheets per month", "Marathi": "5 quizzes + 5 worksheets per month",
        "Bengali": "5 quizzes + 5 worksheets per month", "Gujarati": "5 quizzes + 5 worksheets per month", "Punjabi": "5 quizzes + 5 worksheets per month",
        "Malayalam": "5 quizzes + 5 worksheets per month", "Odia": "5 quizzes + 5 worksheets per month"
    },
    "20 instant answers per day": {
        "English": "20 instant answers per day",
        "Hindi": "20 तुरंत जवाब प्रति दिन",
        "Kannada": "ದಿನಕ್ಕೆ 20 ತತ್‌ಕ್ಷಣ ಉತ್ತರಗಳು",
        "Tamil": "20 instant answers per day", "Telugu": "20 instant answers per day", "Marathi": "20 instant answers per day",
        "Bengali": "20 instant answers per day", "Gujarati": "20 instant answers per day", "Punjabi": "20 instant answers per day",
        "Malayalam": "20 instant answers per day", "Odia": "20 instant answers per day"
    },
    "Voice in 11 Indian languages": {
        "English": "Voice in 11 Indian languages",
        "Hindi": "11 भारतीय भाषाओं में वॉयस",
        "Kannada": "11 ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಧ್ವನಿ",
        "Tamil": "Voice in 11 Indian languages", "Telugu": "Voice in 11 Indian languages", "Marathi": "Voice in 11 Indian languages",
        "Bengali": "Voice in 11 Indian languages", "Gujarati": "Voice in 11 Indian languages", "Punjabi": "Voice in 11 Indian languages",
        "Malayalam": "Voice in 11 Indian languages", "Odia": "Voice in 11 Indian languages"
    },
    "Community library access": {
        "English": "Community library access",
        "Hindi": "कम्युनिटी लाइब्रेरी का उपयोग",
        "Kannada": "ಸಮುದಾಯ ಗ್ರಂಥಾಲಯ ಪ್ರವೇಶ",
        "Tamil": "Community library access", "Telugu": "Community library access", "Marathi": "Community library access",
        "Bengali": "Community library access", "Gujarati": "Community library access", "Punjabi": "Community library access",
        "Malayalam": "Community library access", "Odia": "Community library access"
    },
    "Basic impact dashboard": {
        "English": "Basic impact dashboard",
        "Hindi": "बेसिक इम्पैक्ट डैशबोर्ड",
        "Kannada": "ಮೂಲ ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        "Tamil": "Basic impact dashboard", "Telugu": "Basic impact dashboard", "Marathi": "Basic impact dashboard",
        "Bengali": "Basic impact dashboard", "Gujarati": "Basic impact dashboard", "Punjabi": "Basic impact dashboard",
        "Malayalam": "Basic impact dashboard", "Odia": "Basic impact dashboard"
    },
    // Pro
    "All 6 tools unlocked": {
        "English": "All 6 tools unlocked",
        "Hindi": "सभी 6 टूल अनलॉक",
        "Kannada": "ಎಲ್ಲ 6 ಪರಿಕರಗಳು ಅನ್‌ಲಾಕ್",
        "Tamil": "All 6 tools unlocked", "Telugu": "All 6 tools unlocked", "Marathi": "All 6 tools unlocked",
        "Bengali": "All 6 tools unlocked", "Gujarati": "All 6 tools unlocked", "Punjabi": "All 6 tools unlocked",
        "Malayalam": "All 6 tools unlocked", "Odia": "All 6 tools unlocked"
    },
    "25 lesson plans per month": {
        "English": "25 lesson plans per month",
        "Hindi": "25 पाठ योजनाएँ प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 25 ಪಾಠ ಯೋಜನೆಗಳು",
        "Tamil": "25 lesson plans per month", "Telugu": "25 lesson plans per month", "Marathi": "25 lesson plans per month",
        "Bengali": "25 lesson plans per month", "Gujarati": "25 lesson plans per month", "Punjabi": "25 lesson plans per month",
        "Malayalam": "25 lesson plans per month", "Odia": "25 lesson plans per month"
    },
    "25 quizzes per month": {
        "English": "25 quizzes per month",
        "Hindi": "25 क्विज़ प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 25 ಕ್ವಿಜ್‌ಗಳು",
        "Tamil": "25 quizzes per month", "Telugu": "25 quizzes per month", "Marathi": "25 quizzes per month",
        "Bengali": "25 quizzes per month", "Gujarati": "25 quizzes per month", "Punjabi": "25 quizzes per month",
        "Malayalam": "25 quizzes per month", "Odia": "25 quizzes per month"
    },
    "Unlimited worksheets and rubrics": {
        "English": "Unlimited worksheets and rubrics",
        "Hindi": "असीमित वर्कशीट और रूब्रिक",
        "Kannada": "ಅಪರಿಮಿತ ವರ್ಕ್‌ಶೀಟ್ ಮತ್ತು ರೂಬ್ರಿಕ್‌ಗಳು",
        "Tamil": "Unlimited worksheets and rubrics", "Telugu": "Unlimited worksheets and rubrics", "Marathi": "Unlimited worksheets and rubrics",
        "Bengali": "Unlimited worksheets and rubrics", "Gujarati": "Unlimited worksheets and rubrics", "Punjabi": "Unlimited worksheets and rubrics",
        "Malayalam": "Unlimited worksheets and rubrics", "Odia": "Unlimited worksheets and rubrics"
    },
    "Unlimited instant answers": {
        "English": "Unlimited instant answers",
        "Hindi": "असीमित तुरंत जवाब",
        "Kannada": "ಅಪರಿಮಿತ ತತ್‌ಕ್ಷಣ ಉತ್ತರಗಳು",
        "Tamil": "Unlimited instant answers", "Telugu": "Unlimited instant answers", "Marathi": "Unlimited instant answers",
        "Bengali": "Unlimited instant answers", "Gujarati": "Unlimited instant answers", "Punjabi": "Unlimited instant answers",
        "Malayalam": "Unlimited instant answers", "Odia": "Unlimited instant answers"
    },
    "300 voice cloud minutes per month": {
        "English": "300 voice cloud minutes per month",
        "Hindi": "300 वॉयस क्लाउड मिनट प्रति माह",
        "Kannada": "ತಿಂಗಳಿಗೆ 300 ಧ್ವನಿ ಕ್ಲೌಡ್ ನಿಮಿಷಗಳು",
        "Tamil": "300 voice cloud minutes per month", "Telugu": "300 voice cloud minutes per month", "Marathi": "300 voice cloud minutes per month",
        "Bengali": "300 voice cloud minutes per month", "Gujarati": "300 voice cloud minutes per month", "Punjabi": "300 voice cloud minutes per month",
        "Malayalam": "300 voice cloud minutes per month", "Odia": "300 voice cloud minutes per month"
    },
    "Download as PDF or Word (no watermark)": {
        "English": "Download as PDF or Word (no watermark)",
        "Hindi": "PDF या Word में डाउनलोड करें (बिना वॉटरमार्क)",
        "Kannada": "PDF ಅಥವಾ Word ರೂಪದಲ್ಲಿ ಡೌನ್‌ಲೋಡ್ (ವಾಟರ್‌ಮಾರ್ಕ್ ಇಲ್ಲ)",
        "Tamil": "Download as PDF or Word (no watermark)", "Telugu": "Download as PDF or Word (no watermark)", "Marathi": "Download as PDF or Word (no watermark)",
        "Bengali": "Download as PDF or Word (no watermark)", "Gujarati": "Download as PDF or Word (no watermark)", "Punjabi": "Download as PDF or Word (no watermark)",
        "Malayalam": "Download as PDF or Word (no watermark)", "Odia": "Download as PDF or Word (no watermark)"
    },
    "AI-powered parent messages": {
        "English": "AI-powered parent messages",
        "Hindi": "AI-संचालित अभिभावक संदेश",
        "Kannada": "AI-ಚಾಲಿತ ಪೋಷಕ ಸಂದೇಶಗಳು",
        "Tamil": "AI-powered parent messages", "Telugu": "AI-powered parent messages", "Marathi": "AI-powered parent messages",
        "Bengali": "AI-powered parent messages", "Gujarati": "AI-powered parent messages", "Punjabi": "AI-powered parent messages",
        "Malayalam": "AI-powered parent messages", "Odia": "AI-powered parent messages"
    },
    "Detailed impact dashboard": {
        "English": "Detailed impact dashboard",
        "Hindi": "विस्तृत इम्पैक्ट डैशबोर्ड",
        "Kannada": "ವಿವರವಾದ ಪ್ರಭಾವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        "Tamil": "Detailed impact dashboard", "Telugu": "Detailed impact dashboard", "Marathi": "Detailed impact dashboard",
        "Bengali": "Detailed impact dashboard", "Gujarati": "Detailed impact dashboard", "Punjabi": "Detailed impact dashboard",
        "Malayalam": "Detailed impact dashboard", "Odia": "Detailed impact dashboard"
    },
    // Gold
    "Everything in Pro, unlimited": {
        "English": "Everything in Pro, unlimited",
        "Hindi": "Pro में सब कुछ, असीमित",
        "Kannada": "Pro ನಲ್ಲಿ ಎಲ್ಲವೂ, ಅಪರಿಮಿತ",
        "Tamil": "Everything in Pro, unlimited", "Telugu": "Everything in Pro, unlimited", "Marathi": "Everything in Pro, unlimited",
        "Bengali": "Everything in Pro, unlimited", "Gujarati": "Everything in Pro, unlimited", "Punjabi": "Everything in Pro, unlimited",
        "Malayalam": "Everything in Pro, unlimited", "Odia": "Everything in Pro, unlimited"
    },
    "Principal dashboard + teacher onboarding": {
        "English": "Principal dashboard + teacher onboarding",
        "Hindi": "प्रिंसिपल डैशबोर्ड + शिक्षक ऑनबोर्डिंग",
        "Kannada": "ಪ್ರಿನ್ಸಿಪಾಲ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ + ಶಿಕ್ಷಕರ ಆನ್‌ಬೋರ್ಡಿಂಗ್",
        "Tamil": "Principal dashboard + teacher onboarding", "Telugu": "Principal dashboard + teacher onboarding", "Marathi": "Principal dashboard + teacher onboarding",
        "Bengali": "Principal dashboard + teacher onboarding", "Gujarati": "Principal dashboard + teacher onboarding", "Punjabi": "Principal dashboard + teacher onboarding",
        "Malayalam": "Principal dashboard + teacher onboarding", "Odia": "Principal dashboard + teacher onboarding"
    },
    "1,500 voice cloud minutes per teacher": {
        "English": "1,500 voice cloud minutes per teacher",
        "Hindi": "1,500 वॉयस क्लाउड मिनट प्रति शिक्षक",
        "Kannada": "ಪ್ರತಿ ಶಿಕ್ಷಕರಿಗೆ 1,500 ಧ್ವನಿ ಕ್ಲೌಡ್ ನಿಮಿಷಗಳು",
        "Tamil": "1,500 voice cloud minutes per teacher", "Telugu": "1,500 voice cloud minutes per teacher", "Marathi": "1,500 voice cloud minutes per teacher",
        "Bengali": "1,500 voice cloud minutes per teacher", "Gujarati": "1,500 voice cloud minutes per teacher", "Punjabi": "1,500 voice cloud minutes per teacher",
        "Malayalam": "1,500 voice cloud minutes per teacher", "Odia": "1,500 voice cloud minutes per teacher"
    },
    "WhatsApp Business integration": {
        "English": "WhatsApp Business integration",
        "Hindi": "WhatsApp Business एकीकरण",
        "Kannada": "WhatsApp Business ಸಂಯೋಜನೆ",
        "Tamil": "WhatsApp Business integration", "Telugu": "WhatsApp Business integration", "Marathi": "WhatsApp Business integration",
        "Bengali": "WhatsApp Business integration", "Gujarati": "WhatsApp Business integration", "Punjabi": "WhatsApp Business integration",
        "Malayalam": "WhatsApp Business integration", "Odia": "WhatsApp Business integration"
    },
    "Priority support in your timezone": {
        "English": "Priority support in your timezone",
        "Hindi": "आपके टाइमज़ोन में प्राथमिकता सहायता",
        "Kannada": "ನಿಮ್ಮ ಸಮಯ ವಲಯದಲ್ಲಿ ಆದ್ಯತೆಯ ಬೆಂಬಲ",
        "Tamil": "Priority support in your timezone", "Telugu": "Priority support in your timezone", "Marathi": "Priority support in your timezone",
        "Bengali": "Priority support in your timezone", "Gujarati": "Priority support in your timezone", "Punjabi": "Priority support in your timezone",
        "Malayalam": "Priority support in your timezone", "Odia": "Priority support in your timezone"
    },
    "Volume discount for 50+ teachers": {
        "English": "Volume discount for 50+ teachers",
        "Hindi": "50+ शिक्षकों के लिए वॉल्यूम डिस्काउंट",
        "Kannada": "50+ ಶಿಕ್ಷಕರಿಗೆ ವಾಲ್ಯೂಮ್ ರಿಯಾಯಿತಿ",
        "Tamil": "Volume discount for 50+ teachers", "Telugu": "Volume discount for 50+ teachers", "Marathi": "Volume discount for 50+ teachers",
        "Bengali": "Volume discount for 50+ teachers", "Gujarati": "Volume discount for 50+ teachers", "Punjabi": "Volume discount for 50+ teachers",
        "Malayalam": "Volume discount for 50+ teachers", "Odia": "Volume discount for 50+ teachers"
    },
    "One-time onboarding and training": {
        "English": "One-time onboarding and training",
        "Hindi": "एक बार की ऑनबोर्डिंग और प्रशिक्षण",
        "Kannada": "ಒಂದು-ಬಾರಿ ಆನ್‌ಬೋರ್ಡಿಂಗ್ ಮತ್ತು ತರಬೇತಿ",
        "Tamil": "One-time onboarding and training", "Telugu": "One-time onboarding and training", "Marathi": "One-time onboarding and training",
        "Bengali": "One-time onboarding and training", "Gujarati": "One-time onboarding and training", "Punjabi": "One-time onboarding and training",
        "Malayalam": "One-time onboarding and training", "Odia": "One-time onboarding and training"
    },
    // Volume tier labels
    "20–49 teachers": {
        "English": "20–49 teachers", "Hindi": "20–49 शिक्षक", "Kannada": "20–49 ಶಿಕ್ಷಕರು",
        "Tamil": "20–49 teachers", "Telugu": "20–49 teachers", "Marathi": "20–49 teachers",
        "Bengali": "20–49 teachers", "Gujarati": "20–49 teachers", "Punjabi": "20–49 teachers",
        "Malayalam": "20–49 teachers", "Odia": "20–49 teachers"
    },
    "50–99 teachers": {
        "English": "50–99 teachers", "Hindi": "50–99 शिक्षक", "Kannada": "50–99 ಶಿಕ್ಷಕರು",
        "Tamil": "50–99 teachers", "Telugu": "50–99 teachers", "Marathi": "50–99 teachers",
        "Bengali": "50–99 teachers", "Gujarati": "50–99 teachers", "Punjabi": "50–99 teachers",
        "Malayalam": "50–99 teachers", "Odia": "50–99 teachers"
    },
    "100–249 teachers": {
        "English": "100–249 teachers", "Hindi": "100–249 शिक्षक", "Kannada": "100–249 ಶಿಕ್ಷಕರು",
        "Tamil": "100–249 teachers", "Telugu": "100–249 teachers", "Marathi": "100–249 teachers",
        "Bengali": "100–249 teachers", "Gujarati": "100–249 teachers", "Punjabi": "100–249 teachers",
        "Malayalam": "100–249 teachers", "Odia": "100–249 teachers"
    },
    "250+ teachers (custom quote)": {
        "English": "250+ teachers (custom quote)",
        "Hindi": "250+ शिक्षक (कस्टम कोट)",
        "Kannada": "250+ ಶಿಕ್ಷಕರು (ಕಸ್ಟಮ್ ಕೋಟ್)",
        "Tamil": "250+ teachers (custom quote)", "Telugu": "250+ teachers (custom quote)", "Marathi": "250+ teachers (custom quote)",
        "Bengali": "250+ teachers (custom quote)", "Gujarati": "250+ teachers (custom quote)", "Punjabi": "250+ teachers (custom quote)",
        "Malayalam": "250+ teachers (custom quote)", "Odia": "250+ teachers (custom quote)"
    },
    // Nav labels
    "Product": {
        "English": "Product", "Hindi": "उत्पाद", "Kannada": "ಉತ್ಪನ್ನ",
        "Tamil": "Product", "Telugu": "Product", "Marathi": "Product",
        "Bengali": "Product", "Gujarati": "Product", "Punjabi": "Product",
        "Malayalam": "Product", "Odia": "Product"
    },
    "Pricing": {
        "English": "Pricing", "Hindi": "कीमत", "Kannada": "ಬೆಲೆ",
        "Tamil": "Pricing", "Telugu": "Pricing", "Marathi": "Pricing",
        "Bengali": "Pricing", "Gujarati": "Pricing", "Punjabi": "Pricing",
        "Malayalam": "Pricing", "Odia": "Pricing"
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
        "Tamil": "Contact SARGVISION", "Telugu": "Contact SARGVISION", "Marathi": "Contact SARGVISION",
        "Bengali": "Contact SARGVISION", "Gujarati": "Contact SARGVISION", "Punjabi": "Contact SARGVISION",
        "Malayalam": "Contact SARGVISION", "Odia": "Contact SARGVISION"
    },
    "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.": {
        "English": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Hindi": "कर्नाटक और तेलंगाना में राज्य शिक्षा हितधारकों और Tier 2 स्कूल चेन के साथ जुड़ रहे हैं।",
        "Kannada": "ಕರ್ನಾಟಕ ಮತ್ತು ತೆಲಂಗಾಣದ ರಾಜ್ಯ ಶಿಕ್ಷಣ ಭಾಗೀದಾರರು ಮತ್ತು ಟಯರ್ 2 ಶಾಲಾ ಸರಪಳಿಗಳೊಂದಿಗೆ ತೊಡಗಿಸಿಕೊಂಡಿದ್ದೇವೆ.",
        "Tamil": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Telugu": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Marathi": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Bengali": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Gujarati": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Punjabi": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Malayalam": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.",
        "Odia": "Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana."
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
        "Tamil": "Dedicated customer success manager",
        "Telugu": "Dedicated customer success manager",
        "Marathi": "Dedicated customer success manager",
        "Bengali": "Dedicated customer success manager",
        "Gujarati": "Dedicated customer success manager",
        "Punjabi": "Dedicated customer success manager",
        "Malayalam": "Dedicated customer success manager",
        "Odia": "Dedicated customer success manager"
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
        "Tamil": "Custom AI fine-tuning on your board and curriculum",
        "Telugu": "Custom AI fine-tuning on your board and curriculum",
        "Marathi": "Custom AI fine-tuning on your board and curriculum",
        "Bengali": "Custom AI fine-tuning on your board and curriculum",
        "Gujarati": "Custom AI fine-tuning on your board and curriculum",
        "Punjabi": "Custom AI fine-tuning on your board and curriculum",
        "Malayalam": "Custom AI fine-tuning on your board and curriculum",
        "Odia": "Custom AI fine-tuning on your board and curriculum"
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
        "Tamil": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Telugu": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Marathi": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Bengali": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Gujarati": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Punjabi": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Malayalam": "Unlimited voice cloud minutes (no per-teacher cap)",
        "Odia": "Unlimited voice cloud minutes (no per-teacher cap)"
    },
    "About SahayakAI": {
        "English": "About SahayakAI", "Hindi": "SahayakAI के बारे में", "Kannada": "SahayakAI ಬಗ್ಗೆ",
        "Tamil": "About SahayakAI", "Telugu": "About SahayakAI", "Marathi": "About SahayakAI",
        "Bengali": "About SahayakAI", "Gujarati": "About SahayakAI", "Punjabi": "About SahayakAI",
        "Malayalam": "About SahayakAI", "Odia": "About SahayakAI"
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
