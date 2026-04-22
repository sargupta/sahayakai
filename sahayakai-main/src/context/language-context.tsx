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
