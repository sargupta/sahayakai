'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

// BCP-47 locale tags keyed by UI ISO code, for date formatting (B7).
const LOCALE_BY_ISO: Record<string, string> = {
    en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN',
    gu: 'gu-IN', or: 'or-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
};

// Component-LOCAL translation table for chrome strings not present in the
// shared dictionary. Keyed by the 11 UI ISO codes; resolved by uiLangCode.
const LOCAL_T: Record<string, Record<string, string>> = {
    signedOutParagraph: {
        en: 'We record your acceptance against your account so we can show you the exact version of this page you agreed to, and re-prompt you if we change anything material.',
        hi: 'हम आपकी स्वीकृति को आपके खाते के साथ दर्ज करते हैं ताकि हम आपको इस पृष्ठ का वही संस्करण दिखा सकें जिससे आप सहमत हुए थे, और यदि हम किसी महत्वपूर्ण चीज़ को बदलते हैं तो आपसे दोबारा पूछ सकें।',
        mr: 'आम्ही तुमची स्वीकृती तुमच्या खात्यासोबत नोंदवतो, जेणेकरून तुम्ही ज्या आवृत्तीस सहमती दिली होती तीच आवृत्ती आम्ही तुम्हाला दाखवू शकू, आणि काही महत्त्वाचे बदलल्यास तुम्हाला पुन्हा विचारू शकू.',
        bn: 'আমরা আপনার সম্মতি আপনার অ্যাকাউন্টের সাথে রেকর্ড করি, যাতে আপনি যে সংস্করণে সম্মত হয়েছিলেন ঠিক সেটিই আপনাকে দেখাতে পারি, এবং গুরুত্বপূর্ণ কিছু পরিবর্তন করলে আপনাকে আবার জিজ্ঞাসা করতে পারি।',
        pa: 'ਅਸੀਂ ਤੁਹਾਡੀ ਸਵੀਕ੍ਰਿਤੀ ਨੂੰ ਤੁਹਾਡੇ ਖਾਤੇ ਨਾਲ ਦਰਜ ਕਰਦੇ ਹਾਂ ਤਾਂ ਜੋ ਅਸੀਂ ਤੁਹਾਨੂੰ ਇਸ ਪੰਨੇ ਦਾ ਉਹੀ ਸੰਸਕਰਣ ਦਿਖਾ ਸਕੀਏ ਜਿਸ ਨਾਲ ਤੁਸੀਂ ਸਹਿਮਤ ਹੋਏ ਸੀ, ਅਤੇ ਜੇ ਅਸੀਂ ਕੋਈ ਮਹੱਤਵਪੂਰਨ ਚੀਜ਼ ਬਦਲੀਏ ਤਾਂ ਤੁਹਾਨੂੰ ਦੁਬਾਰਾ ਪੁੱਛ ਸਕੀਏ।',
        gu: 'અમે તમારી સ્વીકૃતિ તમારા ખાતા સાથે નોંધીએ છીએ જેથી તમે જે આવૃત્તિ સાથે સંમત થયા હતા તે જ આવૃત્તિ અમે તમને બતાવી શકીએ, અને જો અમે કંઈ મહત્ત્વનું બદલીએ તો તમને ફરી પૂછી શકીએ.',
        or: 'ଆମେ ଆପଣଙ୍କ ସ୍ୱୀକୃତିକୁ ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ସହିତ ରେକର୍ଡ କରୁ ଯାହା ଦ୍ୱାରା ଆପଣ ଯେଉଁ ସଂସ୍କରଣ ସହ ସମ୍ମତ ହୋଇଥିଲେ ସେଇ ସଂସ୍କରଣ ଆପଣଙ୍କୁ ଦେଖାଇ ପାରିବୁ, ଏବଂ ଯଦି ଆମେ କିଛି ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ବିଷୟ ବଦଳାଉ ତେବେ ଆପଣଙ୍କୁ ପୁନର୍ବାର ପଚାରିପାରିବୁ।',
        ta: 'நீங்கள் ஒப்புக்கொண்ட இந்தப் பக்கத்தின் சரியான பதிப்பை உங்களுக்குக் காட்டவும், முக்கியமான ஏதேனும் மாற்றினால் உங்களிடம் மீண்டும் கேட்கவும், உங்கள் ஒப்புதலை உங்கள் கணக்குடன் பதிவு செய்கிறோம்.',
        te: 'మీరు అంగీకరించిన ఈ పేజీ యొక్క ఖచ్చితమైన వెర్షన్‌ను మీకు చూపించడానికి, ముఖ్యమైనది ఏదైనా మార్చినప్పుడు మిమ్మల్ని మళ్లీ అడగడానికి, మీ అంగీకారాన్ని మీ ఖాతాకు వ్యతిరేకంగా నమోదు చేస్తాము.',
        kn: 'ನೀವು ಒಪ್ಪಿಕೊಂಡ ಈ ಪುಟದ ನಿಖರವಾದ ಆವೃತ್ತಿಯನ್ನು ನಿಮಗೆ ತೋರಿಸಲು, ಮತ್ತು ಯಾವುದೇ ಮುಖ್ಯವಾದದ್ದನ್ನು ನಾವು ಬದಲಾಯಿಸಿದರೆ ನಿಮ್ಮನ್ನು ಮತ್ತೆ ಕೇಳಲು, ನಿಮ್ಮ ಸ್ವೀಕಾರವನ್ನು ನಿಮ್ಮ ಖಾತೆಯೊಂದಿಗೆ ದಾಖಲಿಸುತ್ತೇವೆ.',
        ml: 'നിങ്ങൾ സമ്മതിച്ച ഈ പേജിന്റെ കൃത്യമായ പതിപ്പ് നിങ്ങൾക്ക് കാണിക്കാനും, പ്രധാനപ്പെട്ട എന്തെങ്കിലും മാറ്റിയാൽ നിങ്ങളോട് വീണ്ടും ചോദിക്കാനും, നിങ്ങളുടെ സമ്മതം നിങ്ങളുടെ അക്കൗണ്ടിനൊപ്പം ഞങ്ങൾ രേഖപ്പെടുത്തുന്നു.',
    },
    reconfirmKicker: {
        en: 'Re-confirm these commitments',
        hi: 'इन प्रतिबद्धताओं की पुनः पुष्टि करें',
        mr: 'या वचनबद्धतांची पुन्हा पुष्टी करा',
        bn: 'এই প্রতিশ্রুতিগুলি পুনরায় নিশ্চিত করুন',
        pa: 'ਇਹਨਾਂ ਵਚਨਬੱਧਤਾਵਾਂ ਦੀ ਮੁੜ ਪੁਸ਼ਟੀ ਕਰੋ',
        gu: 'આ પ્રતિબદ્ધતાઓની ફરી પુષ્ટિ કરો',
        or: 'ଏହି ପ୍ରତିବଦ୍ଧତାଗୁଡ଼ିକୁ ପୁନଃ ନିଶ୍ଚିତ କରନ୍ତୁ',
        ta: 'இந்த உறுதிமொழிகளை மீண்டும் உறுதிப்படுத்தவும்',
        te: 'ఈ నిబద్ధతలను మళ్లీ నిర్ధారించండి',
        kn: 'ಈ ಬದ್ಧತೆಗಳನ್ನು ಮರು-ದೃಢೀಕರಿಸಿ',
        ml: 'ഈ പ്രതിബദ്ധതകൾ വീണ്ടും സ്ഥിരീകരിക്കുക',
    },
    reconfirmHeadline: {
        en: 'We updated these commitments. Please re-confirm.',
        hi: 'हमने इन प्रतिबद्धताओं को अपडेट किया है। कृपया पुनः पुष्टि करें।',
        mr: 'आम्ही या वचनबद्धता अद्ययावत केल्या आहेत. कृपया पुन्हा पुष्टी करा.',
        bn: 'আমরা এই প্রতিশ্রুতিগুলি আপডেট করেছি। অনুগ্রহ করে পুনরায় নিশ্চিত করুন।',
        pa: 'ਅਸੀਂ ਇਹਨਾਂ ਵਚਨਬੱਧਤਾਵਾਂ ਨੂੰ ਅੱਪਡੇਟ ਕੀਤਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਮੁੜ ਪੁਸ਼ਟੀ ਕਰੋ।',
        gu: 'અમે આ પ્રતિબદ્ધતાઓ અપડેટ કરી છે. કૃપા કરીને ફરી પુષ્ટિ કરો.',
        or: 'ଆମେ ଏହି ପ୍ରତିବଦ୍ଧତାଗୁଡ଼ିକୁ ଅପଡେଟ୍ କରିଛୁ। ଦୟାକରି ପୁନଃ ନିଶ୍ଚିତ କରନ୍ତୁ।',
        ta: 'இந்த உறுதிமொழிகளை நாங்கள் புதுப்பித்துள்ளோம். மீண்டும் உறுதிப்படுத்தவும்.',
        te: 'మేము ఈ నిబద్ధతలను నవీకరించాము. దయచేసి మళ్లీ నిర్ధారించండి.',
        kn: 'ನಾವು ಈ ಬದ್ಧತೆಗಳನ್ನು ನವೀಕರಿಸಿದ್ದೇವೆ. ದಯವಿಟ್ಟು ಮರು-ದೃಢೀಕರಿಸಿ.',
        ml: 'ഞങ്ങൾ ഈ പ്രതിബദ്ധതകൾ പുതുക്കിയിട്ടുണ്ട്. ദയവായി വീണ്ടും സ്ഥിരീകരിക്കുക.',
    },
    acceptHeadline: {
        en: 'Accept these commitments to continue.',
        hi: 'जारी रखने के लिए इन प्रतिबद्धताओं को स्वीकार करें।',
        mr: 'पुढे जाण्यासाठी या वचनबद्धता स्वीकारा.',
        bn: 'চালিয়ে যেতে এই প্রতিশ্রুতিগুলি স্বীকার করুন।',
        pa: 'ਜਾਰੀ ਰੱਖਣ ਲਈ ਇਹਨਾਂ ਵਚਨਬੱਧਤਾਵਾਂ ਨੂੰ ਸਵੀਕਾਰ ਕਰੋ।',
        gu: 'ચાલુ રાખવા માટે આ પ્રતિબદ્ધતાઓ સ્વીકારો.',
        or: 'ଅଗ୍ରଗତି ପାଇଁ ଏହି ପ୍ରତିବଦ୍ଧତାଗୁଡ଼ିକୁ ସ୍ୱୀକାର କରନ୍ତୁ।',
        ta: 'தொடர இந்த உறுதிமொழிகளை ஏற்றுக்கொள்ளுங்கள்.',
        te: 'కొనసాగించడానికి ఈ నిబద్ధతలను అంగీకరించండి.',
        kn: 'ಮುಂದುವರಿಯಲು ಈ ಬದ್ಧತೆಗಳನ್ನು ಸ್ವೀಕರಿಸಿ.',
        ml: 'തുടരാൻ ഈ പ്രതിബദ്ധതകൾ സ്വീകരിക്കുക.',
    },
    acceptParagraph: {
        en: 'We will record the date and version you accept against your account. You can revisit this page anytime, and we will re-prompt you if we materially change anything.',
        hi: 'आप जिस तिथि और संस्करण को स्वीकार करते हैं उसे हम आपके खाते के साथ दर्ज करेंगे। आप इस पृष्ठ पर कभी भी वापस आ सकते हैं, और यदि हम किसी चीज़ को महत्वपूर्ण रूप से बदलते हैं तो आपसे दोबारा पूछेंगे।',
        mr: 'तुम्ही स्वीकारलेली तारीख आणि आवृत्ती आम्ही तुमच्या खात्यासोबत नोंदवू. तुम्ही या पृष्ठावर कधीही परत येऊ शकता, आणि आम्ही काही लक्षणीय बदलल्यास तुम्हाला पुन्हा विचारू.',
        bn: 'আপনি যে তারিখ ও সংস্করণ স্বীকার করেন তা আমরা আপনার অ্যাকাউন্টের সাথে রেকর্ড করব। আপনি যেকোনো সময় এই পৃষ্ঠায় ফিরে আসতে পারেন, এবং আমরা কিছু উল্লেখযোগ্যভাবে পরিবর্তন করলে আপনাকে আবার জিজ্ঞাসা করব।',
        pa: 'ਤੁਸੀਂ ਜਿਹੜੀ ਮਿਤੀ ਅਤੇ ਸੰਸਕਰਣ ਨੂੰ ਸਵੀਕਾਰ ਕਰਦੇ ਹੋ, ਉਸਨੂੰ ਅਸੀਂ ਤੁਹਾਡੇ ਖਾਤੇ ਨਾਲ ਦਰਜ ਕਰਾਂਗੇ। ਤੁਸੀਂ ਇਸ ਪੰਨੇ ਉੱਤੇ ਕਿਸੇ ਵੀ ਸਮੇਂ ਵਾਪਸ ਆ ਸਕਦੇ ਹੋ, ਅਤੇ ਜੇ ਅਸੀਂ ਕੁਝ ਮਹੱਤਵਪੂਰਨ ਤੌਰ ਉੱਤੇ ਬਦਲਦੇ ਹਾਂ ਤਾਂ ਤੁਹਾਨੂੰ ਦੁਬਾਰਾ ਪੁੱਛਾਂਗੇ।',
        gu: 'તમે જે તારીખ અને આવૃત્તિ સ્વીકારો છો તે અમે તમારા ખાતા સાથે નોંધીશું. તમે કોઈપણ સમયે આ પૃષ્ઠ પર પાછા આવી શકો છો, અને જો અમે કંઈ નોંધપાત્ર રીતે બદલીએ તો તમને ફરી પૂછીશું.',
        or: 'ଆପଣ ଯେଉଁ ତାରିଖ ଓ ସଂସ୍କରଣ ସ୍ୱୀକାର କରନ୍ତି ତାହା ଆମେ ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ସହିତ ରେକର୍ଡ କରିବୁ। ଆପଣ ଯେକୌଣସି ସମୟରେ ଏହି ପୃଷ୍ଠାକୁ ପୁନର୍ବାର ଦେଖି ପାରିବେ, ଏବଂ ଯଦି ଆମେ କିଛି ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଭାବେ ବଦଳାଉ ତେବେ ଆପଣଙ୍କୁ ପୁନର୍ବାର ପଚାରିବୁ।',
        ta: 'நீங்கள் ஏற்றுக்கொள்ளும் தேதியையும் பதிப்பையும் உங்கள் கணக்குடன் பதிவு செய்வோம். இந்தப் பக்கத்தை எப்போது வேண்டுமானாலும் நீங்கள் மீண்டும் பார்வையிடலாம், மேலும் ஏதேனும் கணிசமாக மாற்றினால் உங்களிடம் மீண்டும் கேட்போம்.',
        te: 'మీరు అంగీకరించే తేదీ మరియు వెర్షన్‌ను మేము మీ ఖాతాకు వ్యతిరేకంగా నమోదు చేస్తాము. మీరు ఈ పేజీని ఎప్పుడైనా మళ్లీ చూడవచ్చు, మరియు మేము ఏదైనా గణనీయంగా మార్చితే మిమ్మల్ని మళ్లీ అడుగుతాము.',
        kn: 'ನೀವು ಸ್ವೀಕರಿಸುವ ದಿನಾಂಕ ಮತ್ತು ಆವೃತ್ತಿಯನ್ನು ನಿಮ್ಮ ಖಾತೆಯೊಂದಿಗೆ ದಾಖಲಿಸುತ್ತೇವೆ. ನೀವು ಈ ಪುಟವನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ನೋಡಬಹುದು, ಮತ್ತು ನಾವು ಏನನ್ನಾದರೂ ಗಣನೀಯವಾಗಿ ಬದಲಾಯಿಸಿದರೆ ನಿಮ್ಮನ್ನು ಮತ್ತೆ ಕೇಳುತ್ತೇವೆ.',
        ml: 'നിങ്ങൾ സ്വീകരിക്കുന്ന തീയതിയും പതിപ്പും നിങ്ങളുടെ അക്കൗണ്ടിനൊപ്പം ഞങ്ങൾ രേഖപ്പെടുത്തും. ഈ പേജ് നിങ്ങൾക്ക് എപ്പോൾ വേണമെങ്കിലും വീണ്ടും സന്ദർശിക്കാം, എന്തെങ്കിലും ഗണ്യമായി മാറ്റിയാൽ ഞങ്ങൾ നിങ്ങളോട് വീണ്ടും ചോദിക്കും.',
    },
    consentLabel: {
        en: 'I have read and agree to SahayakAI’s privacy commitments above, including that my data will not be shared with inspectors, principals, or government officials without my explicit consent.',
        hi: 'मैंने ऊपर दी गई SahayakAI की गोपनीयता प्रतिबद्धताओं को पढ़ लिया है और उनसे सहमत हूँ, जिसमें यह भी शामिल है कि मेरी स्पष्ट सहमति के बिना मेरा डेटा निरीक्षकों, प्रधानाध्यापकों या सरकारी अधिकारियों के साथ साझा नहीं किया जाएगा।',
        mr: 'मी वर दिलेल्या SahayakAI च्या गोपनीयता वचनबद्धता वाचल्या आहेत आणि त्यांना सहमती देतो, ज्यात हेही समाविष्ट आहे की माझ्या स्पष्ट संमतीशिवाय माझा डेटा निरीक्षक, मुख्याध्यापक किंवा सरकारी अधिकाऱ्यांसोबत सामायिक केला जाणार नाही.',
        bn: 'আমি উপরে দেওয়া SahayakAI-এর গোপনীয়তা প্রতিশ্রুতিগুলি পড়েছি এবং তাতে সম্মত, যার মধ্যে রয়েছে যে আমার স্পষ্ট সম্মতি ছাড়া আমার ডেটা পরিদর্শক, প্রধান শিক্ষক বা সরকারি কর্মকর্তাদের সাথে শেয়ার করা হবে না।',
        pa: 'ਮੈਂ ਉੱਪਰ ਦਿੱਤੀਆਂ SahayakAI ਦੀਆਂ ਗੋਪਨੀਯਤਾ ਵਚਨਬੱਧਤਾਵਾਂ ਪੜ੍ਹ ਲਈਆਂ ਹਨ ਅਤੇ ਉਹਨਾਂ ਨਾਲ ਸਹਿਮਤ ਹਾਂ, ਜਿਸ ਵਿੱਚ ਇਹ ਵੀ ਸ਼ਾਮਲ ਹੈ ਕਿ ਮੇਰੀ ਸਪਸ਼ਟ ਸਹਿਮਤੀ ਤੋਂ ਬਿਨਾਂ ਮੇਰਾ ਡੇਟਾ ਨਿਰੀਖਕਾਂ, ਮੁੱਖ ਅਧਿਆਪਕਾਂ ਜਾਂ ਸਰਕਾਰੀ ਅਧਿਕਾਰੀਆਂ ਨਾਲ ਸਾਂਝਾ ਨਹੀਂ ਕੀਤਾ ਜਾਵੇਗਾ।',
        gu: 'મેં ઉપર આપેલી SahayakAI ની ગોપનીયતા પ્રતિબદ્ધતાઓ વાંચી છે અને તેમની સાથે સંમત છું, જેમાં એ પણ સામેલ છે કે મારી સ્પષ્ટ સંમતિ વિના મારો ડેટા નિરીક્ષકો, આચાર્યો કે સરકારી અધિકારીઓ સાથે શેર કરવામાં આવશે નહીં.',
        or: 'ମୁଁ ଉପରେ ଦିଆଯାଇଥିବା SahayakAI ର ଗୋପନୀୟତା ପ୍ରତିବଦ୍ଧତାଗୁଡ଼ିକ ପଢ଼ିଛି ଏବଂ ସେଗୁଡ଼ିକ ସହ ସମ୍ମତ, ଯେଉଁଥିରେ ଏହା ମଧ୍ୟ ଅନ୍ତର୍ଭୁକ୍ତ ଯେ ମୋର ସ୍ପଷ୍ଟ ସମ୍ମତି ବିନା ମୋ ତଥ୍ୟ ନିରୀକ୍ଷକ, ପ୍ରଧାନଶିକ୍ଷକ କିମ୍ବା ସରକାରୀ ଅଧିକାରୀଙ୍କ ସହ ସେୟାର କରାଯିବ ନାହିଁ।',
        ta: 'மேலே உள்ள SahayakAI இன் தனியுரிமை உறுதிமொழிகளை நான் படித்து ஒப்புக்கொள்கிறேன், என் வெளிப்படையான ஒப்புதல் இல்லாமல் என் தரவு ஆய்வாளர்கள், தலைமை ஆசிரியர்கள் அல்லது அரசு அதிகாரிகளுடன் பகிரப்படாது என்பதையும் உள்ளடக்கி.',
        te: 'పైన ఉన్న SahayakAI యొక్క గోప్యతా నిబద్ధతలను నేను చదివి అంగీకరిస్తున్నాను, నా స్పష్టమైన అంగీకారం లేకుండా నా డేటా తనిఖీ అధికారులు, ప్రధానోపాధ్యాయులు లేదా ప్రభుత్వ అధికారులతో పంచుకోబడదని కూడా ఇందులో ఉంది.',
        kn: 'ಮೇಲಿನ SahayakAI ನ ಗೌಪ್ಯತಾ ಬದ್ಧತೆಗಳನ್ನು ನಾನು ಓದಿ ಒಪ್ಪಿಕೊಂಡಿದ್ದೇನೆ, ನನ್ನ ಸ್ಪಷ್ಟ ಸಮ್ಮತಿಯಿಲ್ಲದೆ ನನ್ನ ಡೇಟಾವನ್ನು ತನಿಖಾಧಿಕಾರಿಗಳು, ಮುಖ್ಯೋಪಾಧ್ಯಾಯರು ಅಥವಾ ಸರ್ಕಾರಿ ಅಧಿಕಾರಿಗಳೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳುವುದಿಲ್ಲ ಎಂಬುದನ್ನೂ ಒಳಗೊಂಡಂತೆ.',
        ml: 'മുകളിലുള്ള SahayakAI യുടെ സ്വകാര്യതാ പ്രതിബദ്ധതകൾ ഞാൻ വായിച്ച് അംഗീകരിക്കുന്നു, എന്റെ വ്യക്തമായ സമ്മതമില്ലാതെ എന്റെ ഡാറ്റ പരിശോധകർ, പ്രധാനാധ്യാപകർ അല്ലെങ്കിൽ സർക്കാർ ഉദ്യോഗസ്ഥരുമായി പങ്കിടില്ല എന്നതുൾപ്പെടെ.',
    },
    saving: {
        en: 'Saving…', hi: 'सहेजा जा रहा है…', mr: 'जतन करत आहे…', bn: 'সংরক্ষণ করা হচ্ছে…',
        pa: 'ਸੰਭਾਲਿਆ ਜਾ ਰਿਹਾ ਹੈ…', gu: 'સાચવી રહ્યું છે…', or: 'ସେଭ୍ କରାଯାଉଛି…',
        ta: 'சேமிக்கிறது…', te: 'సేవ్ చేస్తోంది…', kn: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ…', ml: 'സംരക്ഷിക്കുന്നു…',
    },
    reconfirmBtn: {
        en: 'Re-confirm', hi: 'पुनः पुष्टि करें', mr: 'पुन्हा पुष्टी करा', bn: 'পুনরায় নিশ্চিত করুন',
        pa: 'ਮੁੜ ਪੁਸ਼ਟੀ ਕਰੋ', gu: 'ફરી પુષ્ટિ કરો', or: 'ପୁନଃ ନିଶ୍ଚିତ କରନ୍ତୁ',
        ta: 'மீண்டும் உறுதிப்படுத்து', te: 'మళ్లీ నిర్ధారించండి', kn: 'ಮರು-ದೃಢೀಕರಿಸಿ', ml: 'വീണ്ടും സ്ഥിരീകരിക്കുക',
    },
    accept: {
        en: 'I accept', hi: 'मैं स्वीकार करता/करती हूँ', mr: 'मी स्वीकारतो/स्वीकारते', bn: 'আমি স্বীকার করি',
        pa: 'ਮੈਂ ਸਵੀਕਾਰ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ', gu: 'હું સ્વીકારું છું', or: 'ମୁଁ ସ୍ୱୀକାର କରୁଛି',
        ta: 'நான் ஏற்கிறேன்', te: 'నేను అంగీకరిస్తున్నాను', kn: 'ನಾನು ಸ್ವೀಕರಿಸುತ್ತೇನೆ', ml: 'ഞാൻ സ്വീകരിക്കുന്നു',
    },
    // "You accepted version {v} on {date}. This is version {cur}." — interpolated.
    acceptedPrefix: {
        en: 'You accepted version', hi: 'आपने संस्करण', mr: 'तुम्ही आवृत्ती', bn: 'আপনি সংস্করণ',
        pa: 'ਤੁਸੀਂ ਸੰਸਕਰਣ', gu: 'તમે આવૃત્તિ', or: 'ଆପଣ ସଂସ୍କରଣ',
        ta: 'நீங்கள் பதிப்பு', te: 'మీరు వెర్షన్', kn: 'ನೀವು ಆವೃತ್ತಿ', ml: 'നിങ്ങൾ പതിപ്പ്',
    },
    acceptedOn: {
        en: 'on', hi: 'को स्वीकार किया।', mr: 'रोजी स्वीकारली.', bn: 'তারিখে স্বীকার করেছেন।',
        pa: 'ਨੂੰ ਸਵੀਕਾਰ ਕੀਤਾ।', gu: 'ના રોજ સ્વીકારી.', or: 'ରେ ସ୍ୱୀକାର କରିଥିଲେ।',
        ta: 'அன்று ஏற்றுக்கொண்டீர்கள்.', te: 'న అంగీకరించారు.', kn: 'ರಂದು ಸ್ವೀಕರಿಸಿದ್ದೀರಿ.', ml: 'ന് സ്വീകരിച്ചു.',
    },
    thisIsVersion: {
        en: 'This is version', hi: 'यह संस्करण है', mr: 'ही आवृत्ती आहे', bn: 'এটি সংস্করণ',
        pa: 'ਇਹ ਸੰਸਕਰਣ ਹੈ', gu: 'આ આવૃત્તિ છે', or: 'ଏହା ସଂସ୍କରଣ',
        ta: 'இது பதிப்பு', te: 'ఇది వెర్షన్', kn: 'ಇದು ಆವೃತ್ತಿ', ml: 'ഇത് പതിപ്പ്',
    },
};

/**
 * Version tag for the current privacy commitments copy. Bump this when the
 * page changes materially so signed-in teachers are re-prompted to re-confirm
 * the new version (even if they accepted an older one). Format: YYYY-MM-DD-vN.
 */
const PRIVACY_VERSION = '2026-04-24-v1';

function formatAcceptedDate(d: Date | undefined, locale: string = 'en-IN'): string {
    if (!d) return 'earlier';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const maybeToDate = (value as { toDate?: () => Date }).toDate;
        if (typeof maybeToDate === 'function') return maybeToDate.call(value);
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const s = (value as { seconds: number }).seconds;
        if (typeof s === 'number') return new Date(s * 1000);
    }
    return undefined;
}

export function PrivacyConsentForm() {
    const { user, openAuthModal } = useAuth();
    const { toast } = useToast();
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || 'en';
    const dateLocale = LOCALE_BY_ISO[uiLangCode] || 'en-IN';
    const lt = (key: keyof typeof LOCAL_T) => LOCAL_T[key][uiLangCode] ?? LOCAL_T[key].en;
    const router = useRouter();
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<Date | undefined>();
    const [acceptedVersion, setAcceptedVersion] = useState<string | undefined>();
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [justAccepted, setJustAccepted] = useState(false);
    const [redirectSeconds, setRedirectSeconds] = useState(5);

    // Auto-redirect countdown after a fresh acceptance. Gives rural non-tech
    // teachers a clear next step without forcing them to find the tiny
    // "Back to home" link in the footer.
    useEffect(() => {
        if (!justAccepted) return;
        if (redirectSeconds <= 0) {
            router.push('/');
            return;
        }
        const tick = setTimeout(() => setRedirectSeconds((s) => s - 1), 1000);
        return () => clearTimeout(tick);
    }, [justAccepted, redirectSeconds, router]);

    useEffect(() => {
        if (!user) {
            setAcceptedAt(undefined);
            setAcceptedVersion(undefined);
            setProfileLoaded(true);
            return;
        }
        let cancelled = false;
        (async () => {
            setProfileLoaded(false);
            try {
                const { profile } = await getProfileData(user.uid);
                if (cancelled) return;
                const p = profile as { privacyAcceptedAt?: unknown; privacyVersion?: string } | null;
                setAcceptedAt(toDate(p?.privacyAcceptedAt));
                setAcceptedVersion(p?.privacyVersion);
            } catch {
                // Fail open: show the accept form even if we cannot load profile.
            } finally {
                if (!cancelled) setProfileLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    async function handleAccept() {
        if (!user || !checked) return;
        setSubmitting(true);
        try {
            const now = new Date();
            await updateProfileAction(user.uid, {
                privacyAcceptedAt: now,
                privacyVersion: PRIVACY_VERSION,
            });
            setAcceptedAt(now);
            setAcceptedVersion(PRIVACY_VERSION);
            setChecked(false);
            setJustAccepted(true);
            toast({
                title: t('Thank you!'),
                description: t('Taking you to your dashboard…'),
            });
        } catch {
            toast({
                title: t('Could not save'),
                description: t('Something went wrong recording your acceptance. Please try again.'),
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    }

    // Render signed-out state immediately; don't gate on auth-context loading
    // (the auth observer may take time to resolve). If a user is authenticated
    // the useEffect above will transition us to the signed-in form.
    if (user && !profileLoaded) {
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="h-24 animate-pulse bg-muted/40 rounded-xl" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                    {t("Record your acceptance")}
                </div>
                <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground mb-3">
                    {t("Sign in to acknowledge these commitments.")}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[58ch] mb-6">
                    {lt('signedOutParagraph')}
                </p>
                <Button
                    onClick={() => openAuthModal()}
                    size="lg"
                    className="rounded-full px-6 font-medium"
                >
                    {t("Sign in to continue")}
                </Button>
            </div>
        );
    }

    const alreadyAccepted = !!acceptedAt;
    const acceptedCurrentVersion = alreadyAccepted && acceptedVersion === PRIVACY_VERSION;

    if (acceptedCurrentVersion) {
        // Warm confirmation + prominent next-step CTA + auto-redirect countdown.
        // For a rural non-tech teacher, landing on a static "YOUR ACCEPTANCE"
        // legal block after clicking Accept is confusing — they expect to move
        // forward. We show a big green check, a friendly thank-you headline,
        // the primary "Go to my dashboard" button, and auto-redirect in 5s as
        // fallback. The legal version stamp stays as a small muted line.
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="rounded-[16px] bg-saffron-50 border border-saffron-200 px-6 py-8 sm:p-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-start gap-4 mb-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-saffron text-white">
                            <CheckCircle2 className="h-6 w-6" strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-1">
                                {t('All set')}
                            </div>
                            <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground leading-tight">
                                {justAccepted
                                    ? t('Thank you! Your privacy choices are saved.')
                                    : t('You agreed to these privacy terms.')}
                            </h3>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <Button
                            onClick={() => router.push('/')}
                            size="lg"
                            className="rounded-full px-6 font-medium bg-saffron text-white hover:bg-saffron-600 shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)]"
                        >
                            {t('Go to my dashboard')}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        {justAccepted && redirectSeconds > 0 && (
                            <span className="text-[13px] text-neutral-600">
                                {t('Taking you there in')} {redirectSeconds}…
                            </span>
                        )}
                    </div>

                    <p className="mt-6 text-[12px] text-neutral-500 leading-[1.55] max-w-[58ch]">
                        {t('Saved on')} {formatAcceptedDate(acceptedAt, dateLocale)}.
                        {' '}
                        {t('We will ask you again only if we change anything important.')}
                        {' '}
                        <span className="opacity-70">(v{acceptedVersion})</span>
                    </p>
                </div>
            </div>
        );
    }

    // Signed-in, not yet accepted (or accepted an older version)
    return (
        <div className="mt-12 pt-10 border-t border-black/[0.08]">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                {alreadyAccepted ? lt('reconfirmKicker') : t('Record your acceptance')}
            </div>
            <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground mb-3">
                {alreadyAccepted ? lt('reconfirmHeadline') : lt('acceptHeadline')}
            </h3>
            <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[58ch] mb-6">
                {alreadyAccepted
                    ? `${lt('acceptedPrefix')} ${acceptedVersion} ${lt('acceptedOn')} ${formatAcceptedDate(acceptedAt, dateLocale)} ${lt('thisIsVersion')} ${PRIVACY_VERSION}.`
                    : lt('acceptParagraph')}
            </p>
            <div className="flex items-start gap-3 mb-6">
                <Checkbox
                    id="privacy-agree"
                    checked={checked}
                    onCheckedChange={value => setChecked(value === true)}
                    className="mt-1"
                />
                <Label htmlFor="privacy-agree" className="text-[14px] sm:text-[15px] text-foreground leading-[1.55] cursor-pointer max-w-[56ch]">
                    {lt('consentLabel')}
                </Label>
            </div>
            <Button
                onClick={handleAccept}
                disabled={!checked || submitting}
                size="lg"
                className="rounded-full px-6 font-medium"
            >
                {submitting ? lt('saving') : alreadyAccepted ? lt('reconfirmBtn') : lt('accept')}
            </Button>
        </div>
    );
}
