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
