'use client';

import { useState } from 'react';
import { Wrench, CheckCircle, Search, Rocket, Hourglass, FileText, Download, XCircle, BookOpen } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

// Component-local translation table, resolved by uiLangCode (app UI language).
const PLAYGROUND_TEXT: Record<string, Record<string, string>> = {
    title: {
        en: 'SahayakAI API Playground',
        hi: 'सहायकAI API प्लेग्राउंड',
        mr: 'सहायकAI API प्लेग्राउंड',
        bn: 'সহায়কAI API প্লেগ্রাউন্ড',
        pa: 'ਸਹਾਇਕAI API ਪਲੇਗ੍ਰਾਊਂਡ',
        gu: 'સહાયકAI API પ્લેગ્રાઉન્ડ',
        or: 'ସହାୟକAI API ପ୍ଲେଗ୍ରାଉଣ୍ଡ',
        ta: 'சகாயக்AI API பிளேகிரவுண்ட்',
        te: 'సహాయక్AI API ప్లేగ్రౌండ్',
        kn: 'ಸಹಾಯಕAI API ಪ್ಲೇಗ್ರೌಂಡ್',
        ml: 'സഹായക്AI API പ്ലേഗ്രൗണ്ട്',
    },
    subtitle: {
        en: 'Interactive API testing for all 22 SahayakAI endpoints',
        hi: 'सभी 22 सहायकAI एंडपॉइंट्स के लिए इंटरैक्टिव API परीक्षण',
        mr: 'सर्व 22 सहायकAI एंडपॉइंट्ससाठी संवादात्मक API चाचणी',
        bn: 'সমস্ত 22টি সহায়কAI এন্ডপয়েন্টের জন্য ইন্টারঅ্যাক্টিভ API পরীক্ষা',
        pa: 'ਸਾਰੇ 22 ਸਹਾਇਕAI ਐਂਡਪੌਇੰਟਾਂ ਲਈ ਇੰਟਰਐਕਟਿਵ API ਜਾਂਚ',
        gu: 'બધા 22 સહાયકAI એન્ડપોઇન્ટ માટે ઇન્ટરેક્ટિવ API પરીક્ષણ',
        or: 'ସମସ୍ତ 22ଟି ସହାୟକAI ଏଣ୍ଡପଏଣ୍ଟ ପାଇଁ ଇଣ୍ଟରାକ୍ଟିଭ API ପରୀକ୍ଷଣ',
        ta: 'அனைத்து 22 சகாயக்AI எண்ட்பாயிண்ட்களுக்கான ஊடாடும் API சோதனை',
        te: 'మొత్తం 22 సహాయక్AI ఎండ్‌పాయింట్‌ల కోసం ఇంటరాక్టివ్ API పరీక్ష',
        kn: 'ಎಲ್ಲಾ 22 ಸಹಾಯಕAI ಎಂಡ್‌ಪಾಯಿಂಟ್‌ಗಳಿಗೆ ಸಂವಾದಾತ್ಮಕ API ಪರೀಕ್ಷೆ',
        ml: 'എല്ലാ 22 സഹായക്AI എൻഡ്‌പോയിന്റുകൾക്കുമുള്ള ഇന്ററാക്ടീവ് API പരിശോധന',
    },
    specsAvailable: {
        en: '14 Specs Available',
        hi: '14 स्पेक्स उपलब्ध',
        mr: '14 स्पेक्स उपलब्ध',
        bn: '14টি স্পেক উপলব্ধ',
        pa: '14 ਸਪੈਕਸ ਉਪਲਬਧ',
        gu: '14 સ્પેક્સ ઉપલબ્ધ',
        or: '14ଟି ସ୍ପେକ୍ ଉପଲବ୍ଧ',
        ta: '14 விவரக்குறிப்புகள் கிடைக்கின்றன',
        te: '14 స్పెక్‌లు అందుబాటులో ఉన్నాయి',
        kn: '14 ಸ್ಪೆಕ್‌ಗಳು ಲಭ್ಯವಿದೆ',
        ml: '14 സ്‌പെക്കുകൾ ലഭ്യമാണ്',
    },
    endpoints: {
        en: '22 Endpoints',
        hi: '22 एंडपॉइंट्स',
        mr: '22 एंडपॉइंट्स',
        bn: '22টি এন্ডপয়েন্ট',
        pa: '22 ਐਂਡਪੌਇੰਟ',
        gu: '22 એન્ડપોઇન્ટ',
        or: '22ଟି ଏଣ୍ଡପଏଣ୍ଟ',
        ta: '22 எண்ட்பாயிண்ட்கள்',
        te: '22 ఎండ్‌పాయింట్‌లు',
        kn: '22 ಎಂಡ್‌ಪಾಯಿಂಟ್‌ಗಳು',
        ml: '22 എൻഡ്‌പോയിന്റുകൾ',
    },
    selectApi: {
        en: 'Select API',
        hi: 'API चुनें',
        mr: 'API निवडा',
        bn: 'API নির্বাচন করুন',
        pa: 'API ਚੁਣੋ',
        gu: 'API પસંદ કરો',
        or: 'API ଚୟନ କରନ୍ତୁ',
        ta: 'API தேர்ந்தெடுக்கவும்',
        te: 'API ఎంచుకోండి',
        kn: 'API ಆಯ್ಕೆಮಾಡಿ',
        ml: 'API തിരഞ്ഞെടുക്കുക',
    },
    quickTests: {
        en: 'Quick Tests',
        hi: 'त्वरित परीक्षण',
        mr: 'जलद चाचण्या',
        bn: 'দ্রুত পরীক্ষা',
        pa: 'ਤੇਜ਼ ਜਾਂਚਾਂ',
        gu: 'ઝડપી પરીક્ષણો',
        or: 'ଶୀଘ୍ର ପରୀକ୍ଷଣ',
        ta: 'விரைவு சோதனைகள்',
        te: 'శీఘ్ర పరీక్షలు',
        kn: 'ತ್ವರಿತ ಪರೀಕ್ಷೆಗಳು',
        ml: 'പെട്ടെന്നുള്ള പരിശോധനകൾ',
    },
    checkSystemHealth: {
        en: 'Check System Health',
        hi: 'सिस्टम स्वास्थ्य जाँचें',
        mr: 'सिस्टम आरोग्य तपासा',
        bn: 'সিস্টেম স্বাস্থ্য পরীক্ষা করুন',
        pa: 'ਸਿਸਟਮ ਸਿਹਤ ਜਾਂਚੋ',
        gu: 'સિસ્ટમ આરોગ્ય તપાસો',
        or: 'ସିଷ୍ଟମ ସ୍ୱାସ୍ଥ୍ୟ ଯାଞ୍ଚ କରନ୍ତୁ',
        ta: 'அமைப்பின் ஆரோக்கியத்தைச் சரிபார்க்கவும்',
        te: 'సిస్టమ్ ఆరోగ్యాన్ని తనిఖీ చేయండి',
        kn: 'ಸಿಸ್ಟಮ್ ಆರೋಗ್ಯವನ್ನು ಪರಿಶೀಲಿಸಿ',
        ml: 'സിസ്റ്റം ആരോഗ്യം പരിശോധിക്കുക',
    },
    enterUserId: {
        en: 'Please enter a User ID',
        hi: 'कृपया एक User ID दर्ज करें',
        mr: 'कृपया एक User ID प्रविष्ट करा',
        bn: 'অনুগ্রহ করে একটি User ID লিখুন',
        pa: 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ User ID ਦਾਖਲ ਕਰੋ',
        gu: 'કૃપા કરીને એક User ID દાખલ કરો',
        or: 'ଦୟାକରି ଏକ User ID ପ୍ରବେଶ କରନ୍ତୁ',
        ta: 'தயவுசெய்து ஒரு User ID ஐ உள்ளிடவும்',
        te: 'దయచేసి ఒక User ID నమోదు చేయండి',
        kn: 'ದಯವಿಟ್ಟು ಒಂದು User ID ನಮೂದಿಸಿ',
        ml: 'ദയവായി ഒരു User ID നൽകുക',
    },
    userIdLabel: {
        en: 'User ID (Firebase UID)',
        hi: 'User ID (Firebase UID)',
        mr: 'User ID (Firebase UID)',
        bn: 'User ID (Firebase UID)',
        pa: 'User ID (Firebase UID)',
        gu: 'User ID (Firebase UID)',
        or: 'User ID (Firebase UID)',
        ta: 'User ID (Firebase UID)',
        te: 'User ID (Firebase UID)',
        kn: 'User ID (Firebase UID)',
        ml: 'User ID (Firebase UID)',
    },
    uidHint: {
        en: 'Get UID from Firebase Console (users collection) or use script: npm run teacher:lookup email@example.com',
        hi: 'Firebase Console (users संग्रह) से UID प्राप्त करें या स्क्रिप्ट का उपयोग करें: npm run teacher:lookup email@example.com',
        mr: 'Firebase Console (users संग्रह) मधून UID मिळवा किंवा स्क्रिप्ट वापरा: npm run teacher:lookup email@example.com',
        bn: 'Firebase Console (users সংগ্রহ) থেকে UID নিন বা স্ক্রিপ্ট ব্যবহার করুন: npm run teacher:lookup email@example.com',
        pa: 'Firebase Console (users ਸੰਗ੍ਰਹਿ) ਤੋਂ UID ਪ੍ਰਾਪਤ ਕਰੋ ਜਾਂ ਸਕ੍ਰਿਪਟ ਵਰਤੋ: npm run teacher:lookup email@example.com',
        gu: 'Firebase Console (users સંગ્રહ) માંથી UID મેળવો અથવા સ્ક્રિપ્ટ વાપરો: npm run teacher:lookup email@example.com',
        or: 'Firebase Console (users ସଂଗ୍ରହ) ରୁ UID ପ୍ରାପ୍ତ କରନ୍ତୁ କିମ୍ବା ସ୍କ୍ରିପ୍ଟ ବ୍ୟବହାର କରନ୍ତୁ: npm run teacher:lookup email@example.com',
        ta: 'Firebase Console (users தொகுப்பு) இலிருந்து UID ஐப் பெறவும் அல்லது ஸ்கிரிப்ட்டைப் பயன்படுத்தவும்: npm run teacher:lookup email@example.com',
        te: 'Firebase Console (users సేకరణ) నుండి UID పొందండి లేదా స్క్రిప్ట్ ఉపయోగించండి: npm run teacher:lookup email@example.com',
        kn: 'Firebase Console (users ಸಂಗ್ರಹ) ನಿಂದ UID ಪಡೆಯಿರಿ ಅಥವಾ ಸ್ಕ್ರಿಪ್ಟ್ ಬಳಸಿ: npm run teacher:lookup email@example.com',
        ml: 'Firebase Console (users ശേഖരം) ൽ നിന്ന് UID നേടുക അല്ലെങ്കിൽ സ്ക്രിപ്റ്റ് ഉപയോഗിക്കുക: npm run teacher:lookup email@example.com',
    },
    testing: {
        en: 'Testing...',
        hi: 'परीक्षण हो रहा है...',
        mr: 'चाचणी सुरू आहे...',
        bn: 'পরীক্ষা চলছে...',
        pa: 'ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ...',
        gu: 'પરીક્ષણ થઈ રહ્યું છે...',
        or: 'ପରୀକ୍ଷଣ ଚାଲିଛି...',
        ta: 'சோதிக்கப்படுகிறது...',
        te: 'పరీక్షిస్తోంది...',
        kn: 'ಪರೀಕ್ಷಿಸಲಾಗುತ್ತಿದೆ...',
        ml: 'പരിശോധിക്കുന്നു...',
    },
    expectedResponse: {
        en: 'Expected Response:',
        hi: 'अपेक्षित प्रतिक्रिया:',
        mr: 'अपेक्षित प्रतिसाद:',
        bn: 'প্রত্যাশিত প্রতিক্রিয়া:',
        pa: 'ਅਨੁਮਾਨਿਤ ਜਵਾਬ:',
        gu: 'અપેક્ષિત પ્રતિસાદ:',
        or: 'ଆଶା କରାଯାଉଥିବା ପ୍ରତିକ୍ରିୟା:',
        ta: 'எதிர்பார்க்கப்படும் பதில்:',
        te: 'ఆశించిన ప్రతిస్పందన:',
        kn: 'ನಿರೀಕ್ಷಿತ ಪ್ರತಿಕ್ರಿಯೆ:',
        ml: 'പ്രതീക്ഷിക്കുന്ന പ്രതികരണം:',
    },
    specAvailable: {
        en: 'OpenAPI Spec Available',
        hi: 'OpenAPI स्पेक उपलब्ध',
        mr: 'OpenAPI स्पेक उपलब्ध',
        bn: 'OpenAPI স্পেক উপলব্ধ',
        pa: 'OpenAPI ਸਪੈਕ ਉਪਲਬਧ',
        gu: 'OpenAPI સ્પેક ઉપલબ્ધ',
        or: 'OpenAPI ସ୍ପେକ୍ ଉପଲବ୍ଧ',
        ta: 'OpenAPI விவரக்குறிப்பு கிடைக்கிறது',
        te: 'OpenAPI స్పెక్ అందుబాటులో ఉంది',
        kn: 'OpenAPI ಸ್ಪೆಕ್ ಲಭ್ಯವಿದೆ',
        ml: 'OpenAPI സ്‌പെക് ലഭ്യമാണ്',
    },
    specComingSoon: {
        en: 'This API has a complete OpenAPI specification. Interactive testing for this endpoint coming soon!',
        hi: 'इस API में एक पूर्ण OpenAPI विनिर्देश है। इस एंडपॉइंट के लिए इंटरैक्टिव परीक्षण जल्द ही आ रहा है!',
        mr: 'या API मध्ये संपूर्ण OpenAPI तपशील आहे. या एंडपॉइंटसाठी संवादात्मक चाचणी लवकरच येत आहे!',
        bn: 'এই API-তে একটি সম্পূর্ণ OpenAPI স্পেসিফিকেশন রয়েছে। এই এন্ডপয়েন্টের জন্য ইন্টারঅ্যাক্টিভ পরীক্ষা শীঘ্রই আসছে!',
        pa: 'ਇਸ API ਵਿੱਚ ਇੱਕ ਪੂਰਾ OpenAPI ਵੇਰਵਾ ਹੈ। ਇਸ ਐਂਡਪੌਇੰਟ ਲਈ ਇੰਟਰਐਕਟਿਵ ਜਾਂਚ ਜਲਦੀ ਆ ਰਹੀ ਹੈ!',
        gu: 'આ API માં સંપૂર્ણ OpenAPI સ્પષ્ટીકરણ છે. આ એન્ડપોઇન્ટ માટે ઇન્ટરેક્ટિવ પરીક્ષણ ટૂંક સમયમાં આવી રહ્યું છે!',
        or: 'ଏହି API ରେ ଏକ ସମ୍ପୂର୍ଣ୍ଣ OpenAPI ବିବରଣୀ ଅଛି। ଏହି ଏଣ୍ଡପଏଣ୍ଟ ପାଇଁ ଇଣ୍ଟରାକ୍ଟିଭ ପରୀକ୍ଷଣ ଶୀଘ୍ର ଆସୁଛି!',
        ta: 'இந்த API இல் முழுமையான OpenAPI விவரக்குறிப்பு உள்ளது. இந்த எண்ட்பாயிண்டுக்கான ஊடாடும் சோதனை விரைவில் வருகிறது!',
        te: 'ఈ API కి పూర్తి OpenAPI స్పెసిఫికేషన్ ఉంది. ఈ ఎండ్‌పాయింట్ కోసం ఇంటరాక్టివ్ పరీక్ష త్వరలో వస్తోంది!',
        kn: 'ಈ API ಸಂಪೂರ್ಣ OpenAPI ವಿವರಣೆಯನ್ನು ಹೊಂದಿದೆ. ಈ ಎಂಡ್‌ಪಾಯಿಂಟ್‌ಗೆ ಸಂವಾದಾತ್ಮಕ ಪರೀಕ್ಷೆ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ!',
        ml: 'ഈ API യ്ക്ക് ഒരു പൂർണ്ണമായ OpenAPI സ്‌പെസിഫിക്കേഷൻ ഉണ്ട്. ഈ എൻഡ്‌പോയിന്റിനായുള്ള ഇന്ററാക്ടീവ് പരിശോധന ഉടൻ വരുന്നു!',
    },
    downloadSpec: {
        en: 'Download Spec',
        hi: 'स्पेक डाउनलोड करें',
        mr: 'स्पेक डाउनलोड करा',
        bn: 'স্পেক ডাউনলোড করুন',
        pa: 'ਸਪੈਕ ਡਾਊਨਲੋਡ ਕਰੋ',
        gu: 'સ્પેક ડાઉનલોડ કરો',
        or: 'ସ୍ପେକ୍ ଡାଉନଲୋଡ୍ କରନ୍ତୁ',
        ta: 'விவரக்குறிப்பைப் பதிவிறக்கவும்',
        te: 'స్పెక్ డౌన్‌లోడ్ చేయండి',
        kn: 'ಸ್ಪೆಕ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
        ml: 'സ്‌പെക് ഡൗൺലോഡ് ചെയ്യുക',
    },
    errorLabel: {
        en: 'Error',
        hi: 'त्रुटि',
        mr: 'त्रुटी',
        bn: 'ত্রুটি',
        pa: 'ਗਲਤੀ',
        gu: 'ભૂલ',
        or: 'ତ୍ରୁଟି',
        ta: 'பிழை',
        te: 'లోపం',
        kn: 'ದೋಷ',
        ml: 'പിശക്',
    },
    responseLabel: {
        en: 'Response:',
        hi: 'प्रतिक्रिया:',
        mr: 'प्रतिसाद:',
        bn: 'প্রতিক্রিয়া:',
        pa: 'ਜਵਾਬ:',
        gu: 'પ્રતિસાદ:',
        or: 'ପ୍ରତିକ୍ରିୟା:',
        ta: 'பதில்:',
        te: 'ప్రతిస్పందన:',
        kn: 'ಪ್ರತಿಕ್ರಿಯೆ:',
        ml: 'പ്രതികരണം:',
    },
    fullApiDocs: {
        en: 'Full API Documentation',
        hi: 'पूर्ण API दस्तावेज़',
        mr: 'संपूर्ण API दस्तऐवज',
        bn: 'সম্পূর্ণ API ডকুমেন্টেশন',
        pa: 'ਪੂਰਾ API ਦਸਤਾਵੇਜ਼',
        gu: 'સંપૂર્ણ API દસ્તાવેજીકરણ',
        or: 'ସମ୍ପୂର୍ଣ୍ଣ API ଡକୁମେଣ୍ଟେସନ୍',
        ta: 'முழு API ஆவணப்படுத்தல்',
        te: 'పూర్తి API డాక్యుమెంటేషన్',
        kn: 'ಪೂರ್ಣ API ದಸ್ತಾವೇಜನ',
        ml: 'പൂർണ്ണ API ഡോക്യുമെന്റേഷൻ',
    },
    docsSubtitle: {
        en: 'View complete OpenAPI 3.0 specifications for all 22 endpoints',
        hi: 'सभी 22 एंडपॉइंट्स के लिए पूर्ण OpenAPI 3.0 विनिर्देश देखें',
        mr: 'सर्व 22 एंडपॉइंट्ससाठी संपूर्ण OpenAPI 3.0 तपशील पहा',
        bn: 'সমস্ত 22টি এন্ডপয়েন্টের জন্য সম্পূর্ণ OpenAPI 3.0 স্পেসিফিকেশন দেখুন',
        pa: 'ਸਾਰੇ 22 ਐਂਡਪੌਇੰਟਾਂ ਲਈ ਪੂਰੇ OpenAPI 3.0 ਵੇਰਵੇ ਵੇਖੋ',
        gu: 'બધા 22 એન્ડપોઇન્ટ માટે સંપૂર્ણ OpenAPI 3.0 સ્પષ્ટીકરણ જુઓ',
        or: 'ସମସ୍ତ 22ଟି ଏଣ୍ଡପଏଣ୍ଟ ପାଇଁ ସମ୍ପୂର୍ଣ୍ଣ OpenAPI 3.0 ବିବରଣୀ ଦେଖନ୍ତୁ',
        ta: 'அனைத்து 22 எண்ட்பாயிண்ட்களுக்கான முழுமையான OpenAPI 3.0 விவரக்குறிப்புகளைக் காண்க',
        te: 'మొత్తం 22 ఎండ్‌పాయింట్‌ల కోసం పూర్తి OpenAPI 3.0 స్పెసిఫికేషన్‌లను చూడండి',
        kn: 'ಎಲ್ಲಾ 22 ಎಂಡ್‌ಪಾಯಿಂಟ್‌ಗಳಿಗೆ ಸಂಪೂರ್ಣ OpenAPI 3.0 ವಿವರಣೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
        ml: 'എല്ലാ 22 എൻഡ്‌പോയിന്റുകൾക്കുമുള്ള പൂർണ്ണമായ OpenAPI 3.0 സ്‌പെസിഫിക്കേഷനുകൾ കാണുക',
    },
    teacherLookupGuide: {
        en: 'Teacher Lookup Guide',
        hi: 'शिक्षक खोज मार्गदर्शिका',
        mr: 'शिक्षक शोध मार्गदर्शक',
        bn: 'শিক্ষক অনুসন্ধান নির্দেশিকা',
        pa: 'ਅਧਿਆਪਕ ਖੋਜ ਗਾਈਡ',
        gu: 'શિક્ષક શોધ માર્ગદર્શિકા',
        or: 'ଶିକ୍ଷକ ଖୋଜ ମାର୍ଗଦର୍ଶିକା',
        ta: 'ஆசிரியர் தேடல் வழிகாட்டி',
        te: 'ఉపాధ్యాయ శోధన గైడ్',
        kn: 'ಶಿಕ್ಷಕ ಹುಡುಕಾಟ ಮಾರ್ಗದರ್ಶಿ',
        ml: 'അധ്യാപക തിരയൽ ഗൈഡ്',
    },
    monitoringGuide: {
        en: 'Monitoring Guide',
        hi: 'निगरानी मार्गदर्शिका',
        mr: 'देखरेख मार्गदर्शक',
        bn: 'মনিটরিং নির্দেশিকা',
        pa: 'ਨਿਗਰਾਨੀ ਗਾਈਡ',
        gu: 'મોનિટરિંગ માર્ગદર્શિકા',
        or: 'ମନିଟରିଂ ମାର୍ଗଦର୍ଶିକା',
        ta: 'கண்காணிப்பு வழிகாட்டி',
        te: 'మానిటరింగ్ గైడ్',
        kn: 'ಮೇಲ್ವಿಚಾರಣೆ ಮಾರ್ಗದರ್ಶಿ',
        ml: 'നിരീക്ഷണ ഗൈഡ്',
    },
};

export default function APIPlayground() {
    const { language: uiLanguage } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] || 'en';
    const tp = (key: keyof typeof PLAYGROUND_TEXT) =>
        PLAYGROUND_TEXT[key][uiLangCode] ?? PLAYGROUND_TEXT[key].en;
    const [selectedSpec, setSelectedSpec] = useState('analytics');
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const specs = {
        analytics: { name: 'Teacher Analytics', file: 'analytics.yaml' },
        'auth-user': { name: 'Auth & User', file: 'auth-user.yaml' },
        assistant: { name: 'Voice Assistant', file: 'assistant.yaml' },
        'lesson-plan': { name: 'Lesson Plan Generator', file: 'lesson-plan.yaml' },
        quiz: { name: 'Quiz Generator', file: 'quiz-generator.yaml' },
        worksheet: { name: 'Worksheet Wizard', file: 'worksheet.yaml' },
        'visual-aid': { name: 'Visual Aid Designer', file: 'visual-aid.yaml' },
        'instant-answer': { name: 'Instant Answer', file: 'instant-answer.yaml' },
        rubric: { name: 'Rubric Generator', file: 'rubric.yaml' },
        'teacher-training': { name: 'Teacher Training', file: 'teacher-training.yaml' },
        'virtual-field-trip': { name: 'Virtual Field Trip', file: 'virtual-field-trip.yaml' },
        intent: { name: 'Intent Router', file: 'intent.yaml' },
        content: { name: 'Content Management', file: 'content-management.yaml' },
        system: { name: 'System Health', file: 'system.yaml' },
    };

    const testTeacherHealth = async () => {
        if (!userId) {
            setError('Please enter a User ID');
            return;
        }

        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch(`/api/analytics/teacher-health/${userId}`);
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testProfileCheck = async () => {
        if (!userId) {
            setError('Please enter a User ID');
            return;
        }

        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch(`/api/auth/profile-check?uid=${userId}`);
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testSystemHealth = async () => {
        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-card rounded-xl shadow-soft border border-border p-6 mb-6 border-t-4 border-t-primary">
                    <h1 className="text-3xl font-headline font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
                        <Wrench className="h-7 w-7" /> SahayakAI API Playground
                    </h1>
                    <p className="text-muted-foreground">
                        Interactive API testing for all 22 SahayakAI endpoints
                    </p>
                    <div className="mt-4 flex gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> 14 Specs Available
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            22 Endpoints
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Spec Selector */}
                    <div className="lg:col-span-1">
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
                            <h2 className="text-xl font-bold mb-4">Select API</h2>
                            <div className="space-y-2">
                                {Object.entries(specs).map(([key, spec]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedSpec(key)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition ${selectedSpec === key
                                                ? 'bg-primary text-primary-foreground font-medium border border-primary'
                                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                    >
                                        {spec.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6 mt-6">
                            <h2 className="text-xl font-bold mb-4">Quick Tests</h2>
                            <div className="space-y-3">
                                <button
                                    onClick={testSystemHealth}
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                                >
                                    <Search className="h-4 w-4 inline-block mr-1" /> Check System Health
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Test Interface */}
                    <div className="lg:col-span-2">
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
                            <h2 className="text-xl font-bold mb-4">
                                {specs[selectedSpec as keyof typeof specs].name}
                            </h2>

                            {/* Teacher Analytics Test */}
                            {selectedSpec === 'analytics' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            User ID (Firebase UID)
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            placeholder="nYqFxBohXrSaL3EBF1f3M2x0pLf2"
                                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Get UID from Firebase Console (users collection) or use script: npm run teacher:lookup email@example.com
                                        </p>
                                    </div>

                                    <button
                                        onClick={testTeacherHealth}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/analytics/teacher-health/{'{userId}'}</>}
                                    </button>

                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm font-medium text-blue-900 mb-2">Expected Response:</p>
                                        <pre className="text-xs text-blue-800 overflow-x-auto">
                                            {`{
  "score": 78,
  "risk_level": "healthy",
  "activity_score": 25,
  "engagement_score": 28,
  "success_score": 15,
  "growth_score": 10,
  "days_since_last_use": 1,
  "consecutive_days_used": 5,
  "estimated_students_impacted": 120
}`}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Auth & User Test */}
                            {selectedSpec === 'auth-user' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            User ID (Firebase UID)
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            placeholder="nYqFxBohXrSaL3EBF1f3M2x0pLf2"
                                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                                        />
                                    </div>

                                    <button
                                        onClick={testProfileCheck}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/auth/profile-check</>}
                                    </button>
                                </div>
                            )}

                            {/* System Health */}
                            {selectedSpec === 'system' && (
                                <div className="space-y-4">
                                    <button
                                        onClick={testSystemHealth}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/health</>}
                                    </button>
                                </div>
                            )}

                            {/* Default (View Spec) */}
                            {!['analytics', 'auth-user', 'system'].includes(selectedSpec) && (
                                <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-yellow-900 font-medium mb-2 flex items-center gap-1">
                                        <FileText className="h-4 w-4" /> OpenAPI Spec Available
                                    </p>
                                    <p className="text-sm text-yellow-800 mb-4">
                                        This API has a complete OpenAPI specification. Interactive testing for this endpoint coming soon!
                                    </p>
                                    <a
                                        href={`/api-specs/${specs[selectedSpec as keyof typeof specs].file}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                                    >
                                        <Download className="h-4 w-4 inline-block mr-1" /> Download Spec
                                    </a>
                                </div>
                            )}

                            {/* Response Display */}
                            {error && (
                                <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-red-900 font-medium flex items-center gap-1"><XCircle className="h-4 w-4" /> Error</p>
                                    <p className="text-sm text-red-800 mt-1">{error}</p>
                                </div>
                            )}

                            {response && (
                                <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium">Response:</span>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${response.status === 200
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {response.status}
                                        </span>
                                    </div>
                                    <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-sm">
                                        {JSON.stringify(response.data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        {/* Documentation Link */}
                        <div className="bg-primary rounded-xl shadow-soft p-6 mt-6 text-primary-foreground">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><BookOpen className="h-5 w-5" /> Full API Documentation</h3>
                            <p className="text-primary-foreground/80 mb-4">
                                View complete OpenAPI 3.0 specifications for all 22 endpoints
                            </p>
                            <div className="flex gap-3">
                                <a
                                    href="/docs/TEACHER_LOOKUP.md"
                                    className="px-4 py-2 bg-background text-primary rounded-lg font-medium hover:bg-background/90 transition"
                                >
                                    Teacher Lookup Guide
                                </a>
                                <a
                                    href="/docs/MONITORING.md"
                                    className="px-4 py-2 bg-background text-primary rounded-lg font-medium hover:bg-background/90 transition"
                                >
                                    Monitoring Guide
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
