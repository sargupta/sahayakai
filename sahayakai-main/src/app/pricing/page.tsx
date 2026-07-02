'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowRight,
    Crown,
    Loader2,
    BookOpen,
    ClipboardList,
    Mic,
    Shield,
    Download,
    MessageCircle,
    BarChart3,
    Sparkles,
    Zap,
    Users,
    HeartHandshake,
    Building2,
    KeyRound,
    Server,
    FileCheck,
    Wrench,
    Headphones,
    Timer,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useSearchParams } from 'next/navigation';
import { PLAN_PRICING } from '@/lib/plan-config';
import { forceTokenRefresh } from '@/lib/get-auth-token';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ScriptMarks } from '@/components/landing/script-marks';
import { PageAudio } from '@/components/marketing/page-audio';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

type Feature = { icon: ComponentType<{ className?: string }>; text: string };

// Component-local translation table for chrome strings not in the shared
// dictionary. Keyed by the 11 supported ISO codes, resolved by uiLangCode.
const PRICING_STRINGS: Record<string, {
    activating: string;
    proActivated: string;
    goldActivated: string;
    premiumActivated: string;
    timeoutPrefix: string;
    timeoutSuffix: string;
    errorPrefix: string;
    errorSuffix: string;
    emailDialogBody: string;
    launchPricing: string;
}> = {
    en: {
        activating: 'Payment received. Activating your Pro plan… (up to 60 seconds)',
        proActivated: 'Pro plan activated. You can now use every feature. Welcome aboard.',
        goldActivated: 'School Gold activated. Your whole school now has access. Welcome aboard.',
        premiumActivated: 'School Premium activated. Your custom plan is live. Welcome aboard.',
        timeoutPrefix: 'Activation is taking longer than usual. Please refresh the page in a minute. If the problem persists, contact ',
        timeoutSuffix: '.',
        errorPrefix: 'Payment could not be verified. If you were charged, please contact ',
        errorSuffix: '.',
        emailDialogBody: "We'll email you a one-click sign-in link after payment. No password to remember.",
        launchPricing: 'Launch pricing valid through 2026 for the first 10,000 teachers.',
    },
    hi: {
        activating: 'भुगतान प्राप्त हुआ। आपकी प्रो योजना सक्रिय की जा रही है… (60 सेकंड तक)',
        proActivated: 'प्रो योजना सक्रिय हो गई। अब आप हर सुविधा का उपयोग कर सकते हैं। आपका स्वागत है।',
        goldActivated: 'स्कूल गोल्ड सक्रिय हो गया। अब आपके पूरे स्कूल को पहुँच मिल गई है। आपका स्वागत है।',
        premiumActivated: 'स्कूल प्रीमियम सक्रिय हो गया। आपकी कस्टम योजना चालू है। आपका स्वागत है।',
        timeoutPrefix: 'सक्रियण में सामान्य से अधिक समय लग रहा है। कृपया एक मिनट में पेज रिफ्रेश करें। यदि समस्या बनी रहे, तो संपर्क करें ',
        timeoutSuffix: '।',
        errorPrefix: 'भुगतान सत्यापित नहीं हो सका। यदि आपसे शुल्क लिया गया है, तो कृपया संपर्क करें ',
        errorSuffix: '।',
        emailDialogBody: 'भुगतान के बाद हम आपको एक-क्लिक साइन-इन लिंक ईमेल करेंगे। कोई पासवर्ड याद रखने की ज़रूरत नहीं।',
        launchPricing: 'लॉन्च मूल्य पहले 10,000 शिक्षकों के लिए 2026 तक मान्य है।',
    },
    mr: {
        activating: 'पेमेंट मिळाले. तुमची प्रो योजना सक्रिय केली जात आहे… (60 सेकंदांपर्यंत)',
        proActivated: 'प्रो योजना सक्रिय झाली. आता तुम्ही प्रत्येक सुविधा वापरू शकता. तुमचे स्वागत आहे.',
        goldActivated: 'स्कूल गोल्ड सक्रिय झाले. आता तुमच्या संपूर्ण शाळेला प्रवेश मिळाला आहे. तुमचे स्वागत आहे.',
        premiumActivated: 'स्कूल प्रीमियम सक्रिय झाले. तुमची कस्टम योजना सुरू आहे. तुमचे स्वागत आहे.',
        timeoutPrefix: 'सक्रियणाला नेहमीपेक्षा जास्त वेळ लागत आहे. कृपया एका मिनिटात पृष्ठ रिफ्रेश करा. समस्या कायम राहिल्यास, संपर्क साधा ',
        timeoutSuffix: '.',
        errorPrefix: 'पेमेंट सत्यापित होऊ शकले नाही. तुमच्याकडून शुल्क घेतले असल्यास, कृपया संपर्क साधा ',
        errorSuffix: '.',
        emailDialogBody: 'पेमेंटनंतर आम्ही तुम्हाला एक-क्लिक साइन-इन लिंक ईमेल करू. कोणताही पासवर्ड लक्षात ठेवण्याची गरज नाही.',
        launchPricing: 'लॉन्च किंमत पहिल्या 10,000 शिक्षकांसाठी 2026 पर्यंत वैध आहे.',
    },
    bn: {
        activating: 'পেমেন্ট পাওয়া গেছে। আপনার প্রো প্ল্যান সক্রিয় করা হচ্ছে… (৬০ সেকেন্ড পর্যন্ত)',
        proActivated: 'প্রো প্ল্যান সক্রিয় হয়েছে। এখন আপনি প্রতিটি ফিচার ব্যবহার করতে পারবেন। স্বাগতম।',
        goldActivated: 'স্কুল গোল্ড সক্রিয় হয়েছে। এখন আপনার পুরো স্কুল অ্যাক্সেস পেয়েছে। স্বাগতম।',
        premiumActivated: 'স্কুল প্রিমিয়াম সক্রিয় হয়েছে। আপনার কাস্টম প্ল্যান চালু আছে। স্বাগতম।',
        timeoutPrefix: 'সক্রিয়করণে স্বাভাবিকের চেয়ে বেশি সময় লাগছে। অনুগ্রহ করে এক মিনিট পর পৃষ্ঠাটি রিফ্রেশ করুন। সমস্যা থেকে গেলে, যোগাযোগ করুন ',
        timeoutSuffix: '।',
        errorPrefix: 'পেমেন্ট যাচাই করা যায়নি। যদি আপনার কাছ থেকে চার্জ নেওয়া হয়ে থাকে, অনুগ্রহ করে যোগাযোগ করুন ',
        errorSuffix: '।',
        emailDialogBody: 'পেমেন্টের পর আমরা আপনাকে এক-ক্লিক সাইন-ইন লিঙ্ক ইমেল করব। কোনো পাসওয়ার্ড মনে রাখার দরকার নেই।',
        launchPricing: 'লঞ্চ মূল্য প্রথম ১০,০০০ শিক্ষকের জন্য ২০২৬ পর্যন্ত বৈধ।',
    },
    pa: {
        activating: 'ਭੁਗਤਾਨ ਪ੍ਰਾਪਤ ਹੋਇਆ। ਤੁਹਾਡੀ ਪ੍ਰੋ ਯੋਜਨਾ ਸਰਗਰਮ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ… (60 ਸਕਿੰਟ ਤੱਕ)',
        proActivated: 'ਪ੍ਰੋ ਯੋਜਨਾ ਸਰਗਰਮ ਹੋ ਗਈ। ਹੁਣ ਤੁਸੀਂ ਹਰ ਸੁਵਿਧਾ ਵਰਤ ਸਕਦੇ ਹੋ। ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।',
        goldActivated: 'ਸਕੂਲ ਗੋਲਡ ਸਰਗਰਮ ਹੋ ਗਿਆ। ਹੁਣ ਤੁਹਾਡੇ ਪੂਰੇ ਸਕੂਲ ਨੂੰ ਪਹੁੰਚ ਮਿਲ ਗਈ ਹੈ। ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।',
        premiumActivated: 'ਸਕੂਲ ਪ੍ਰੀਮੀਅਮ ਸਰਗਰਮ ਹੋ ਗਿਆ। ਤੁਹਾਡੀ ਕਸਟਮ ਯੋਜਨਾ ਚਾਲੂ ਹੈ। ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।',
        timeoutPrefix: 'ਸਰਗਰਮੀ ਵਿੱਚ ਆਮ ਨਾਲੋਂ ਵੱਧ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਮਿੰਟ ਵਿੱਚ ਪੰਨਾ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ। ਜੇ ਸਮੱਸਿਆ ਬਣੀ ਰਹੇ, ਤਾਂ ਸੰਪਰਕ ਕਰੋ ',
        timeoutSuffix: '।',
        errorPrefix: 'ਭੁਗਤਾਨ ਦੀ ਪੁਸ਼ਟੀ ਨਹੀਂ ਹੋ ਸਕੀ। ਜੇ ਤੁਹਾਡੇ ਤੋਂ ਚਾਰਜ ਲਿਆ ਗਿਆ ਹੈ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਸੰਪਰਕ ਕਰੋ ',
        errorSuffix: '।',
        emailDialogBody: 'ਭੁਗਤਾਨ ਤੋਂ ਬਾਅਦ ਅਸੀਂ ਤੁਹਾਨੂੰ ਇੱਕ-ਕਲਿੱਕ ਸਾਈਨ-ਇਨ ਲਿੰਕ ਈਮੇਲ ਕਰਾਂਗੇ। ਕੋਈ ਪਾਸਵਰਡ ਯਾਦ ਰੱਖਣ ਦੀ ਲੋੜ ਨਹੀਂ।',
        launchPricing: 'ਲਾਂਚ ਕੀਮਤ ਪਹਿਲੇ 10,000 ਅਧਿਆਪਕਾਂ ਲਈ 2026 ਤੱਕ ਵੈਧ ਹੈ।',
    },
    gu: {
        activating: 'ચુકવણી મળી. તમારી પ્રો યોજના સક્રિય કરવામાં આવી રહી છે… (60 સેકન્ડ સુધી)',
        proActivated: 'પ્રો યોજના સક્રિય થઈ. હવે તમે દરેક સુવિધાનો ઉપયોગ કરી શકો છો. તમારું સ્વાગત છે.',
        goldActivated: 'સ્કૂલ ગોલ્ડ સક્રિય થયું. હવે તમારી આખી શાળાને ઍક્સેસ મળી છે. તમારું સ્વાગત છે.',
        premiumActivated: 'સ્કૂલ પ્રીમિયમ સક્રિય થયું. તમારી કસ્ટમ યોજના ચાલુ છે. તમારું સ્વાગત છે.',
        timeoutPrefix: 'સક્રિયકરણમાં સામાન્ય કરતાં વધુ સમય લાગી રહ્યો છે. કૃપા કરીને એક મિનિટમાં પેજ રિફ્રેશ કરો. જો સમસ્યા ચાલુ રહે, તો સંપર્ક કરો ',
        timeoutSuffix: '.',
        errorPrefix: 'ચુકવણીની ચકાસણી થઈ શકી નથી. જો તમારી પાસેથી ચાર્જ લેવાયો હોય, તો કૃપા કરીને સંપર્ક કરો ',
        errorSuffix: '.',
        emailDialogBody: 'ચુકવણી પછી અમે તમને એક-ક્લિક સાઇન-ઇન લિંક ઈમેલ કરીશું. કોઈ પાસવર્ડ યાદ રાખવાની જરૂર નથી.',
        launchPricing: 'લૉન્ચ કિંમત પ્રથમ 10,000 શિક્ષકો માટે 2026 સુધી માન્ય છે.',
    },
    or: {
        activating: 'ଦେୟ ମିଳିଲା। ଆପଣଙ୍କ ପ୍ରୋ ଯୋଜନା ସକ୍ରିୟ କରାଯାଉଛି… (60 ସେକେଣ୍ଡ ପର୍ଯ୍ୟନ୍ତ)',
        proActivated: 'ପ୍ରୋ ଯୋଜନା ସକ୍ରିୟ ହେଲା। ବର୍ତ୍ତମାନ ଆପଣ ପ୍ରତ୍ୟେକ ସୁବିଧା ବ୍ୟବହାର କରିପାରିବେ। ଆପଣଙ୍କୁ ସ୍ୱାଗତ।',
        goldActivated: 'ସ୍କୁଲ ଗୋଲ୍ଡ ସକ୍ରିୟ ହେଲା। ବର୍ତ୍ତମାନ ଆପଣଙ୍କ ସମ୍ପୂର୍ଣ୍ଣ ବିଦ୍ୟାଳୟ ଆକ୍ସେସ ପାଇଲା। ଆପଣଙ୍କୁ ସ୍ୱାଗତ।',
        premiumActivated: 'ସ୍କୁଲ ପ୍ରିମିୟମ ସକ୍ରିୟ ହେଲା। ଆପଣଙ୍କ କଷ୍ଟମ ଯୋଜନା ଚାଲୁ ଅଛି। ଆପଣଙ୍କୁ ସ୍ୱାଗତ।',
        timeoutPrefix: 'ସକ୍ରିୟକରଣରେ ସାଧାରଣ ଅପେକ୍ଷା ଅଧିକ ସମୟ ଲାଗୁଛି। ଦୟାକରି ଏକ ମିନିଟ ମଧ୍ୟରେ ପୃଷ୍ଠାଟି ରିଫ୍ରେସ କରନ୍ତୁ। ସମସ୍ୟା ରହିଲେ, ଯୋଗାଯୋଗ କରନ୍ତୁ ',
        timeoutSuffix: '।',
        errorPrefix: 'ଦେୟ ଯାଞ୍ଚ କରାଯାଇପାରିଲା ନାହିଁ। ଯଦି ଆପଣଙ୍କଠାରୁ ଚାର୍ଜ ନିଆଯାଇଛି, ଦୟାକରି ଯୋଗାଯୋଗ କରନ୍ତୁ ',
        errorSuffix: '।',
        emailDialogBody: 'ଦେୟ ପରେ ଆମେ ଆପଣଙ୍କୁ ଏକ-କ୍ଲିକ ସାଇନ-ଇନ ଲିଙ୍କ ଇମେଲ କରିବୁ। କୌଣସି ପାସୱାର୍ଡ ମନେ ରଖିବାକୁ ପଡ଼ିବ ନାହିଁ।',
        launchPricing: 'ଲଞ୍ଚ ମୂଲ୍ୟ ପ୍ରଥମ 10,000 ଶିକ୍ଷକଙ୍କ ପାଇଁ 2026 ପର୍ଯ୍ୟନ୍ତ ବୈଧ।',
    },
    ta: {
        activating: 'கட்டணம் பெறப்பட்டது. உங்கள் ப்ரோ திட்டம் செயல்படுத்தப்படுகிறது… (60 விநாடிகள் வரை)',
        proActivated: 'ப்ரோ திட்டம் செயல்படுத்தப்பட்டது. இப்போது நீங்கள் ஒவ்வொரு அம்சத்தையும் பயன்படுத்தலாம். வரவேற்கிறோம்.',
        goldActivated: 'ஸ்கூல் கோல்ட் செயல்படுத்தப்பட்டது. இப்போது உங்கள் முழுப் பள்ளிக்கும் அணுகல் கிடைத்துள்ளது. வரவேற்கிறோம்.',
        premiumActivated: 'ஸ்கூல் ப்ரீமியம் செயல்படுத்தப்பட்டது. உங்கள் தனிப்பயன் திட்டம் இயங்குகிறது. வரவேற்கிறோம்.',
        timeoutPrefix: 'செயல்படுத்துவதற்கு வழக்கத்தை விட அதிக நேரம் ஆகிறது. தயவுசெய்து ஒரு நிமிடத்தில் பக்கத்தைப் புதுப்பிக்கவும். சிக்கல் தொடர்ந்தால், தொடர்பு கொள்ளவும் ',
        timeoutSuffix: '.',
        errorPrefix: 'கட்டணத்தை சரிபார்க்க முடியவில்லை. உங்களிடம் கட்டணம் வசூலிக்கப்பட்டிருந்தால், தயவுசெய்து தொடர்பு கொள்ளவும் ',
        errorSuffix: '.',
        emailDialogBody: 'கட்டணத்திற்குப் பிறகு ஒரு-கிளிக் உள்நுழைவு இணைப்பை உங்களுக்கு மின்னஞ்சல் செய்வோம். எந்த கடவுச்சொல்லையும் நினைவில் வைக்க வேண்டியதில்லை.',
        launchPricing: 'தொடக்க விலை முதல் 10,000 ஆசிரியர்களுக்கு 2026 வரை செல்லுபடியாகும்.',
    },
    te: {
        activating: 'చెల్లింపు అందింది. మీ ప్రో ప్లాన్ సక్రియం చేయబడుతోంది… (60 సెకన్ల వరకు)',
        proActivated: 'ప్రో ప్లాన్ సక్రియం అయింది. ఇప్పుడు మీరు ప్రతి ఫీచర్‌ను ఉపయోగించవచ్చు. స్వాగతం.',
        goldActivated: 'స్కూల్ గోల్డ్ సక్రియం అయింది. ఇప్పుడు మీ పాఠశాల మొత్తానికి యాక్సెస్ లభించింది. స్వాగతం.',
        premiumActivated: 'స్కూల్ ప్రీమియం సక్రియం అయింది. మీ కస్టమ్ ప్లాన్ ప్రత్యక్షంగా ఉంది. స్వాగతం.',
        timeoutPrefix: 'సక్రియం చేయడానికి సాధారణం కంటే ఎక్కువ సమయం పడుతోంది. దయచేసి ఒక నిమిషంలో పేజీని రిఫ్రెష్ చేయండి. సమస్య కొనసాగితే, సంప్రదించండి ',
        timeoutSuffix: '.',
        errorPrefix: 'చెల్లింపును ధృవీకరించలేకపోయాం. మీ నుండి ఛార్జ్ చేయబడితే, దయచేసి సంప్రదించండి ',
        errorSuffix: '.',
        emailDialogBody: 'చెల్లింపు తర్వాత మేము మీకు ఒక-క్లిక్ సైన్-ఇన్ లింక్‌ను ఇమెయిల్ చేస్తాము. ఏ పాస్‌వర్డ్‌ను గుర్తుంచుకోవాల్సిన అవసరం లేదు.',
        launchPricing: 'లాంచ్ ధర మొదటి 10,000 ఉపాధ్యాయులకు 2026 వరకు చెల్లుబాటు అవుతుంది.',
    },
    kn: {
        activating: 'ಪಾವತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಪ್ರೊ ಯೋಜನೆ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗುತ್ತಿದೆ… (60 ಸೆಕೆಂಡ್‌ಗಳವರೆಗೆ)',
        proActivated: 'ಪ್ರೊ ಯೋಜನೆ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ಈಗ ನೀವು ಪ್ರತಿ ವೈಶಿಷ್ಟ್ಯವನ್ನು ಬಳಸಬಹುದು. ಸ್ವಾಗತ.',
        goldActivated: 'ಸ್ಕೂಲ್ ಗೋಲ್ಡ್ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ಈಗ ನಿಮ್ಮ ಇಡೀ ಶಾಲೆಗೆ ಪ್ರವೇಶ ಸಿಕ್ಕಿದೆ. ಸ್ವಾಗತ.',
        premiumActivated: 'ಸ್ಕೂಲ್ ಪ್ರೀಮಿಯಂ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ನಿಮ್ಮ ಕಸ್ಟಮ್ ಯೋಜನೆ ಚಾಲ್ತಿಯಲ್ಲಿದೆ. ಸ್ವಾಗತ.',
        timeoutPrefix: 'ಸಕ್ರಿಯಗೊಳಿಸಲು ಎಂದಿನಂತೆ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಒಂದು ನಿಮಿಷದಲ್ಲಿ ಪುಟವನ್ನು ರಿಫ್ರೆಶ್ ಮಾಡಿ. ಸಮಸ್ಯೆ ಮುಂದುವರಿದರೆ, ಸಂಪರ್ಕಿಸಿ ',
        timeoutSuffix: '.',
        errorPrefix: 'ಪಾವತಿಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ. ನಿಮ್ಮಿಂದ ಶುಲ್ಕ ವಿಧಿಸಲಾಗಿದ್ದರೆ, ದಯವಿಟ್ಟು ಸಂಪರ್ಕಿಸಿ ',
        errorSuffix: '.',
        emailDialogBody: 'ಪಾವತಿಯ ನಂತರ ನಾವು ನಿಮಗೆ ಒಂದು-ಕ್ಲಿಕ್ ಸೈನ್-ಇನ್ ಲಿಂಕ್ ಅನ್ನು ಇಮೇಲ್ ಮಾಡುತ್ತೇವೆ. ಯಾವುದೇ ಪಾಸ್‌ವರ್ಡ್ ನೆನಪಿಟ್ಟುಕೊಳ್ಳುವ ಅಗತ್ಯವಿಲ್ಲ.',
        launchPricing: 'ಲಾಂಚ್ ಬೆಲೆ ಮೊದಲ 10,000 ಶಿಕ್ಷಕರಿಗೆ 2026 ರವರೆಗೆ ಮಾನ್ಯವಾಗಿದೆ.',
    },
    ml: {
        activating: 'പേയ്മെന്റ് ലഭിച്ചു. നിങ്ങളുടെ പ്രോ പ്ലാൻ സജീവമാക്കുന്നു… (60 സെക്കൻഡ് വരെ)',
        proActivated: 'പ്രോ പ്ലാൻ സജീവമായി. ഇപ്പോൾ നിങ്ങൾക്ക് എല്ലാ ഫീച്ചറുകളും ഉപയോഗിക്കാം. സ്വാഗതം.',
        goldActivated: 'സ്കൂൾ ഗോൾഡ് സജീവമായി. ഇപ്പോൾ നിങ്ങളുടെ മുഴുവൻ സ്കൂളിനും ആക്സസ് ലഭിച്ചു. സ്വാഗതം.',
        premiumActivated: 'സ്കൂൾ പ്രീമിയം സജീവമായി. നിങ്ങളുടെ ഇഷ്ടാനുസൃത പ്ലാൻ പ്രവർത്തനക്ഷമമാണ്. സ്വാഗതം.',
        timeoutPrefix: 'സജീവമാക്കാൻ പതിവിലും കൂടുതൽ സമയം എടുക്കുന്നു. ദയവായി ഒരു മിനിറ്റിനുള്ളിൽ പേജ് റിഫ്രഷ് ചെയ്യുക. പ്രശ്നം തുടരുകയാണെങ്കിൽ, ബന്ധപ്പെടുക ',
        timeoutSuffix: '.',
        errorPrefix: 'പേയ്മെന്റ് പരിശോധിക്കാനായില്ല. നിങ്ങളിൽ നിന്ന് ചാർജ് ഈടാക്കിയിട്ടുണ്ടെങ്കിൽ, ദയവായി ബന്ധപ്പെടുക ',
        errorSuffix: '.',
        emailDialogBody: 'പേയ്മെന്റിന് ശേഷം ഞങ്ങൾ നിങ്ങൾക്ക് ഒറ്റ-ക്ലിക്ക് സൈൻ-ഇൻ ലിങ്ക് ഇമെയിൽ ചെയ്യും. ഒരു പാസ്‌വേഡും ഓർമ്മിക്കേണ്ടതില്ല.',
        launchPricing: 'ലോഞ്ച് വില ആദ്യ 10,000 അധ്യാപകർക്ക് 2026 വരെ സാധുവാണ്.',
    },
};

// Feature copy uses plain verbs and specific numbers. Avoids jargon like
// "Copilot", "Gemini 2.0 Flash", "Sarvam cloud" — rural teacher should parse
// these at a glance without needing a tech background.
const FREE_FEATURES: Feature[] = [
    { icon: BookOpen, text: '10 lesson plans per month' },
    { icon: ClipboardList, text: '5 quizzes + 5 worksheets per month' },
    { icon: Zap, text: '20 instant answers per day' },
    { icon: Mic, text: 'Voice in 11 Indian languages' },
    { icon: Users, text: 'Community library access' },
    { icon: BarChart3, text: 'Basic impact dashboard' },
];

const PRO_FEATURES: Feature[] = [
    { icon: Sparkles, text: 'All 6 tools unlocked' },
    { icon: BookOpen, text: '25 lesson plans per month' },
    { icon: ClipboardList, text: '25 quizzes per month' },
    { icon: ClipboardList, text: 'Unlimited worksheets and rubrics' },
    { icon: Zap, text: 'Unlimited instant answers' },
    { icon: Mic, text: '300 voice cloud minutes per month' },
    { icon: Download, text: 'Download as PDF or Word (no watermark)' },
    { icon: MessageCircle, text: 'AI-powered parent messages' },
    { icon: BarChart3, text: 'Detailed impact dashboard' },
];

const GOLD_FEATURES: Feature[] = [
    { icon: Sparkles, text: 'Everything in Pro, unlimited' },
    { icon: Shield, text: 'Principal dashboard + teacher onboarding' },
    { icon: Mic, text: '1,500 voice cloud minutes per teacher' },
    { icon: MessageCircle, text: 'WhatsApp Business integration' },
    { icon: HeartHandshake, text: 'Priority support in your timezone' },
    { icon: Building2, text: 'Volume discount for 50+ teachers' },
    { icon: Users, text: 'One-time onboarding and training' },
];

// Enterprise differentiators: what Premium adds on top of Gold. Addresses
// the "why not just Gold at scale" question for 250+ teacher chains + govt.
const PREMIUM_ADDITIONS: Feature[] = [
    { icon: KeyRound, text: 'SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)' },
    { icon: Server, text: 'Private deployment on your own cloud (AWS, GCP, or on-prem)' },
    { icon: Timer, text: '99.9% uptime SLA with written commitments' },
    { icon: Headphones, text: 'Dedicated customer success manager' },
    { icon: FileCheck, text: 'Audit logs and DPDP compliance reports' },
    { icon: Wrench, text: 'Custom AI fine-tuning on your board and curriculum' },
    { icon: Shield, text: 'API access and ERP integration (Fedena, Campus, custom)' },
    { icon: Users, text: 'Unlimited voice cloud minutes (no per-teacher cap)' },
];

const inr = (n: number) => n.toLocaleString('en-IN');

export default function PricingPage() {
    const { t } = useLanguage();
    return (
        <Suspense
            fallback={
                <div className="force-light min-h-screen flex items-center justify-center bg-background">
                    <p className="text-neutral-500 text-sm">{t("Loading pricing…")}</p>
                </div>
            }
        >
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const { user, openAuthModal } = useAuth();
    const { plan, loading, refresh } = useSubscription();
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] ?? 'en';
    const s = PRICING_STRINGS[uiLangCode] ?? PRICING_STRINGS.en;
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    // Default to monthly — lower upfront commitment, easier conversion for B2C freemium.
    // The SAVE 2 MONTHS pill next to the toggle nudges toward annual.
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [creating, setCreating] = useState(false);

    const [activating, setActivating] = useState(status === 'success' && plan === 'free');
    const [activationTimedOut, setActivationTimedOut] = useState(false);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        if (status !== 'success') return;
        if (!user) return;
        if (plan !== 'free') {
            setActivating(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 20;

        const tick = async () => {
            attempts += 1;
            await forceTokenRefresh();
            await refresh();
            if (attempts >= maxAttempts) {
                setActivationTimedOut(true);
                setActivating(false);
                if (pollRef.current !== null) {
                    window.clearInterval(pollRef.current);
                    pollRef.current = null;
                }
            }
        };

        tick();
        pollRef.current = window.setInterval(tick, 3000);

        return () => {
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, user?.uid]);

    useEffect(() => {
        if (activating && plan !== 'free') {
            setActivating(false);
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [activating, plan]);

    const [emailDialogPlan, setEmailDialogPlan] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);

    const handleSubscribe = async (planKey: string) => {
        if (!user) {
            setEmailDialogPlan(planKey);
            setEmailError(null);
            return;
        }

        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/billing/create-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ planKey }),
            });

            const data = await res.json();
            if (data.shortUrl) {
                window.location.href = data.shortUrl;
            } else {
                alert(t('Failed to create subscription. Please try again.'));
            }
        } catch {
            alert(t('Something went wrong. Please try again.'));
        } finally {
            setCreating(false);
        }
    };

    const handlePublicCheckout = async () => {
        if (!emailDialogPlan) return;

        const email = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError(t('Please enter a valid email address.'));
            return;
        }

        setCreating(true);
        setEmailError(null);
        try {
            const res = await fetch('/api/billing/create-public-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, planKey: emailDialogPlan }),
            });

            const data = await res.json();
            if (res.ok && data.shortUrl) {
                window.location.href = data.shortUrl;
            } else {
                setEmailError(data.error || t('Could not start checkout. Please try again.'));
            }
        } catch {
            setEmailError(t('Network error. Please check your connection and try again.'));
        } finally {
            setCreating(false);
        }
    };

    const proPricing = billingPeriod === 'monthly' ? PLAN_PRICING.pro.monthly : PLAN_PRICING.pro.annual;
    const proPlanKey = billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_annual';

    return (
        <div className="force-light flex flex-col min-h-screen bg-background text-foreground">
            <LandingNav onAuthClick={openAuthModal} />

            <div
                className="relative flex-1"
                style={{
                    background:
                        'radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)',
                }}
            >
                <ScriptMarks />

                <main>
                {/* Status banners */}
                {status === 'success' && activating && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="flex items-center justify-center gap-3 rounded-[12px] border border-saffron-200 bg-saffron-50 px-4 py-3 text-[13px] text-saffron-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{s.activating}</span>
                        </div>
                    </div>
                )}
                {status === 'success' && !activating && !activationTimedOut && plan !== 'free' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-saffron-200 bg-saffron-50 px-4 py-3 text-center text-[13px] text-saffron-700">
                            {plan === 'pro' && s.proActivated}
                            {plan === 'gold' && s.goldActivated}
                            {plan === 'premium' && s.premiumActivated}
                        </div>
                    </div>
                )}
                {status === 'success' && activationTimedOut && plan === 'free' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-neutral-200 bg-white px-4 py-3 text-center text-[13px] text-neutral-700">
                            {s.timeoutPrefix}
                            <a href="mailto:contact@sargvision.com" className="underline">
                                contact@sargvision.com
                            </a>
                            {s.timeoutSuffix}
                        </div>
                    </div>
                )}
                {status === 'error' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] text-red-700">
                            {s.errorPrefix}
                            <a href="mailto:contact@sargvision.com" className="underline">
                                contact@sargvision.com
                            </a>
                            {s.errorSuffix}
                        </div>
                    </div>
                )}

                {/* Hero */}
                <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-[52px] pb-8">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-7">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                        {t('Pricing, for Indian teachers')}
                    </div>

                    <h1 className="font-headline font-extrabold tracking-tight text-[42px] sm:text-[54px] leading-[1.05] max-w-[24ch] text-foreground">
                        {t('Less than a textbook.')}{' '}
                        <span className="italic font-normal text-saffron-700">{t('Yours to cancel anytime.')}</span>
                    </h1>

                    <p className="font-body text-[16px] sm:text-[17px] text-neutral-600 leading-[1.55] max-w-[58ch] mt-6 mx-auto">
                        {t('Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.')}
                    </p>
                </section>

                {/* Billing toggle + prominent savings pill (conversion nudge toward annual). */}
                <div className="relative z-10 flex items-center justify-center gap-3 mt-2 flex-wrap">
                    <div
                        role="radiogroup"
                        aria-label={t('Monthly') + ' / ' + t('Annual')}
                        className="inline-flex items-center rounded-full border border-black/10 bg-white/70 backdrop-blur p-[3px]"
                    >
                        <BillingToggle
                            active={billingPeriod === 'monthly'}
                            onClick={() => setBillingPeriod('monthly')}
                            label={t('Monthly')}
                        />
                        <BillingToggle
                            active={billingPeriod === 'annual'}
                            onClick={() => setBillingPeriod('annual')}
                            label={t('Annual')}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setBillingPeriod('annual')}
                        aria-label={t('Save 2 months')}
                        className={`inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] rounded-full px-[12px] py-[6px] transition-all cursor-pointer ${
                            billingPeriod === 'annual'
                                ? 'bg-saffron-50 text-saffron-700 border border-saffron-200'
                                : 'bg-saffron text-white shadow-[0_10px_22px_-8px_hsl(28_70%_45%/0.5)] hover:bg-saffron-600'
                        }`}
                    >
                        <Sparkles className="h-3 w-3" strokeWidth={2.4} />
                        {t('Save 2 months')}
                    </button>
                </div>

                {/* Tier columns */}
                <section className="relative z-10 px-6 sm:px-12 py-12 flex justify-center">
                    <div className="max-w-[960px] w-full grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 md:divide-x md:divide-black/10">
                        {/* Free */}
                        <TierColumn>
                            <TierName name={t('Free')} />
                            <TierPrice amount="₹0" unit={t('forever')} emphasis={false} />
                            {plan === 'free' ? (
                                <YourPlanChip />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => (user ? undefined : openAuthModal())}
                                    className="mt-5 self-start text-[13px] font-medium text-neutral-600 hover:text-foreground transition-colors"
                                >
                                    {user ? t('Start here') : `${t('Start free')} →`}
                                </button>
                            )}
                            <FeatureList items={FREE_FEATURES} />
                        </TierColumn>

                        {/* Pro — emphasized */}
                        <TierColumn>
                            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                {t('Most popular')}
                            </div>
                            <TierName name={t('Pro')} />
                            <TierPrice
                                amount={`₹${inr(proPricing.rupees)}`}
                                unit={billingPeriod === 'monthly' ? t('/month') : t('/year')}
                                sticker={`₹${inr(proPricing.stickerRupees)}`}
                                emphasis
                            />
                            <div className="mt-1 text-[12px] text-saffron-700 font-medium">
                                {t('Tax included')} · {t('7-day refund. Cancel anytime.')}
                            </div>
                            {plan === 'pro' ? (
                                <YourPlanChip />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleSubscribe(proPlanKey)}
                                    disabled={creating || loading}
                                    className="mt-5 self-start inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            {t('Start Pro')}…
                                        </>
                                    ) : (
                                        <>
                                            {t('Start Pro')}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </>
                                    )}
                                </button>
                            )}
                            <FeatureList items={PRO_FEATURES} />
                        </TierColumn>

                        {/* School Gold */}
                        <TierColumn>
                            <TierName name={t('School Gold')} />
                            <TierPrice
                                amount={`₹${inr(PLAN_PRICING.gold.annual.rupees)}`}
                                unit={t('/teacher/year')}
                                sticker={`₹${inr(PLAN_PRICING.gold.annual.stickerRupees)}`}
                                emphasis={false}
                            />
                            <div className="mt-1 text-[12px] text-neutral-500">
                                {t('Minimum 20 teachers · billed annually')}
                            </div>
                            {plan === 'gold' ? (
                                <YourPlanChip />
                            ) : (
                                <a
                                    href="https://calendly.com/contact-sargvision/30min"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 self-start inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-white border border-black/15 text-foreground hover:bg-black/5 transition-colors"
                                >
                                    {t('Book a school demo')}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                            )}
                            <GoldVolumeTable />
                            <FeatureList items={GOLD_FEATURES} />
                        </TierColumn>
                    </div>
                </section>

                {/* School Starter — editorial rail for small schools (5–19 teachers). */}
                <section className="relative z-10 px-6 sm:px-12 pb-6 flex justify-center">
                    <div className="max-w-[960px] w-full flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-[14px] bg-saffron-50 border border-saffron-200 px-6 sm:px-8 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-saffron-700 border border-saffron-200">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                    {t('School Starter')}
                                </div>
                                <div className="font-headline font-semibold text-[18px] text-foreground leading-tight">
                                    {t('For small schools (5–19 teachers)')}
                                </div>
                                <div className="mt-1.5 text-[13px] text-neutral-700 leading-[1.55]">
                                    {t('Everything in Pro for every teacher, plus a simple principal dashboard and onboarding help. No 20-teacher minimum.')}
                                </div>
                                <div className="mt-1.5 text-[12px] text-neutral-600">
                                    {t('Pricing tailored to your school. We come to you.')}
                                </div>
                            </div>
                        </div>
                        <a
                            href="https://calendly.com/contact-sargvision/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer shrink-0"
                        >
                            {t('Book a small-school call')}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </section>

                {/* School Premium — enterprise differentiators. */}
                <section className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center">
                    <div className="max-w-[960px] w-full rounded-[14px] bg-white border border-black/5 px-6 sm:px-8 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-saffron-50 text-saffron-700">
                                    <Crown className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                        {t('School Premium')}
                                    </div>
                                    <div className="font-headline font-semibold text-[18px] text-foreground leading-tight">
                                        {t('Chains, government & 250+ teacher schools')}
                                    </div>
                                    <div className="mt-1.5 text-[13px] text-neutral-600 leading-[1.55]">
                                        {t('Custom agreement, enterprise security, private deployment.')}
                                    </div>
                                </div>
                            </div>
                            <a
                                href="mailto:contact@sargvision.com?subject=SahayakAI%20School%20Premium%20Enquiry"
                                className="inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer shrink-0"
                            >
                                {t('Contact SARGVISION')}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                        </div>

                        {/* What Premium adds on top of Gold (the "why go Premium at 250+" question). */}
                        <div className="mt-6 pt-5 border-t border-black/5">
                            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-3">
                                {t('What Premium adds on top of Gold')}
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                                {PREMIUM_ADDITIONS.map(({ icon: Icon, text }) => (
                                    <li key={text} className="flex items-start gap-2.5 text-[13px] text-neutral-700 leading-[1.5]">
                                        <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-saffron-50 text-saffron-700">
                                            <Icon className="h-3 w-3" aria-hidden />
                                        </span>
                                        <span>{t(text)}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-4 text-[12px] text-neutral-500 leading-[1.55]">
                                {t('Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.')}
                            </p>
                        </div>
                    </div>
                </section>

                <p className="relative z-10 pb-14 mx-auto max-w-[640px] px-6 text-center text-[12px] text-neutral-500 leading-[1.55]">
                    {t('7-day refund. Cancel anytime.')} {s.launchPricing}
                </p>
                </main>
            </div>

            <LandingFooter />
            <PageAudio />

            {/* Public checkout email dialog */}
            <Dialog
                open={emailDialogPlan !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEmailDialogPlan(null);
                        setEmailError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("Just your email to continue")}</DialogTitle>
                        <DialogDescription>
                            {s.emailDialogBody}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        <Label htmlFor="checkout-email">{t("Email address")}</Label>
                        <Input
                            id="checkout-email"
                            type="email"
                            autoComplete="email"
                            placeholder={t("you@example.com")}
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !creating) {
                                    e.preventDefault();
                                    handlePublicCheckout();
                                }
                            }}
                            disabled={creating}
                            aria-invalid={!!emailError}
                        />
                        {emailError && (
                            <p className="text-sm text-red-600">{emailError}</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEmailDialogPlan(null);
                                setEmailError(null);
                            }}
                            disabled={creating}
                        >
                            {t("Cancel")}
                        </Button>
                        <Button
                            onClick={handlePublicCheckout}
                            disabled={creating || !emailInput.trim()}
                            className="bg-saffron hover:bg-saffron-600 text-white"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t("Starting…")}
                                </>
                            ) : (
                                <>
                                    {t("Continue to payment")}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---- Editorial pricing sub-components ----

function BillingToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            role="radio"
            aria-checked={active}
            aria-label={`Bill ${label.toLowerCase()}`}
            className={`text-[13px] font-medium px-[16px] py-[7px] rounded-full transition-colors cursor-pointer ${
                active
                    ? 'bg-saffron text-white shadow-[0_6px_14px_-6px_hsl(28_70%_45%/0.4)]'
                    : 'text-neutral-500 hover:text-foreground'
            }`}
        >
            {label}
        </button>
    );
}

function TierColumn({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col px-0 md:px-8 first:md:pl-0 last:md:pr-0">{children}</div>;
}

function TierName({ name }: { name: string }) {
    return <h2 className="font-headline font-semibold text-[16px] text-foreground">{name}</h2>;
}

function TierPrice({
    amount,
    unit,
    sticker,
    emphasis,
}: {
    amount: string;
    unit: string;
    sticker?: string;
    emphasis: boolean;
}) {
    return (
        <div className="mt-3">
            {sticker && (
                <div className="text-[12px] text-neutral-400 line-through mb-0.5">{sticker}</div>
            )}
            <div className="flex items-baseline gap-1.5">
                <span
                    className={`font-headline font-extrabold tracking-tight ${
                        emphasis ? 'text-[44px] text-saffron-700 leading-none' : 'text-[32px] text-foreground leading-none'
                    }`}
                >
                    {amount}
                </span>
                <span className="text-[13px] text-neutral-500">{unit}</span>
            </div>
        </div>
    );
}

function GoldVolumeTable() {
    const { t } = useLanguage();
    return (
        <div className="mt-6 rounded-[10px] bg-saffron-50/60 border border-saffron-200/60 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-2">
                {t('Volume pricing')}
            </div>
            <dl className="space-y-1.5 text-[12px] text-neutral-700">
                {PLAN_PRICING.gold.annual.volumeTiers.map((tier) => (
                    <div key={tier.label} className="flex items-baseline justify-between gap-3">
                        <dt className="text-neutral-600">{t(tier.label)}</dt>
                        <dd className="font-semibold text-foreground whitespace-nowrap">
                            {tier.rupees !== null ? `₹${inr(tier.rupees)}` : t('Custom quote')}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function FeatureList({ items }: { items: readonly Feature[] }) {
    const { t } = useLanguage();
    return (
        <ul className="mt-6 space-y-3">
            {items.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[13px] text-neutral-700 leading-[1.5]">
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-saffron-50 text-saffron-700">
                        <Icon className="h-3 w-3" aria-hidden />
                    </span>
                    <span>{t(text)}</span>
                </li>
            ))}
        </ul>
    );
}

function YourPlanChip() {
    const { t } = useLanguage();
    return (
        <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-saffron-700 self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
            {t('Your plan')}
        </div>
    );
}
