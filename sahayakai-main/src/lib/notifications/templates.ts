/**
 * Notification i18n templates (Lane A13).
 *
 * Every notification type has a `title` and `message` template for each of the
 * 11 supported teacher UI languages. Templates use `{placeholderName}` tokens
 * that are substituted at render time via `renderNotification`.
 *
 * Lane A13 fix: previously every notification doc stored an English-only
 * pre-rendered string in `message`. Hindi/Tamil/etc. teachers got English copy
 * in their bell dropdown. This module centralises copy so we can localise once.
 */

import type { Language, NotificationType } from '@/types';

// Canonical language codes. We reuse the same "English name" labels stored on
// users/{uid}.preferredLanguage so no user-doc migration is needed.
export type NotificationLanguage = Language;

export const NOTIFICATION_LANGUAGES: readonly NotificationLanguage[] = [
    'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi',
    'Bengali', 'Gujarati', 'Punjabi', 'Malayalam', 'Odia',
] as const;

export const DEFAULT_NOTIFICATION_LANGUAGE: NotificationLanguage = 'English';

// ── Placeholder shape per template key ───────────────────────────────────────
//
// Each key declares the placeholders its template expects. Typed at the call
// site so "forgot to pass senderName" is a compile-time error.

export interface NotificationPlaceholderMap {
    FOLLOW:           { senderName: string };
    NEW_POST:         { senderName: string; postTitle: string };
    BADGE_EARNED:     { badgeName: string };
    SYSTEM:           { title: string; message: string };
    LIKE:             { senderName: string; resourceTitle: string };
    RESOURCE_SAVED:   { senderName: string; resourceTitle: string };
    RESOURCE_USED:    { senderName: string; resourceTitle: string };
    COMMENT:          { senderName: string; resourceTitle: string };
    CONNECT_REQUEST:  { senderName: string };
    CONNECT_ACCEPTED: { senderName: string };
    MESSAGE:          { senderName: string; preview: string };
}

// MESSAGE is a virtual template key — persisted as type: 'SYSTEM' but rendered
// from a localised message-flow template. The rest correspond 1:1 to
// NotificationType members.
//
// Exclusion: NEW_TEACHER_JOINED, NEW_GROUP_POST, GROUP_POST_LIKE are
// localised through `src/lib/notifications/i18n.ts` (groups.ts + fanout.ts
// pipelines), not this template table. They appear in NotificationType but
// are intentionally NOT in TemplateKey so we don't double-source their copy.
export type TemplateKey = Exclude<
    NotificationType,
    'NEW_TEACHER_JOINED' | 'NEW_GROUP_POST' | 'GROUP_POST_LIKE'
> | 'MESSAGE';

interface TemplatePair {
    title: string;
    message: string;
}

type TemplateTable = Record<TemplateKey, Record<NotificationLanguage, TemplatePair>>;

// ── Templates ────────────────────────────────────────────────────────────────

export const NOTIFICATION_TEMPLATES: TemplateTable = {
    FOLLOW: {
        English:   { title: 'New Follower',          message: '{senderName} started following you' },
        Hindi:     { title: 'नया फ़ॉलोअर',             message: '{senderName} ने आपको फ़ॉलो करना शुरू किया' },
        Kannada:   { title: 'ಹೊಸ ಅನುಯಾಯಿ',           message: '{senderName} ನಿಮ್ಮನ್ನು ಫಾಲೋ ಮಾಡಲು ಪ್ರಾರಂಭಿಸಿದ್ದಾರೆ' },
        Tamil:     { title: 'புதிய பின்தொடர்பவர்',     message: '{senderName} உங்களைப் பின்தொடரத் தொடங்கினார்' },
        Telugu:    { title: 'కొత్త అనుచరుడు',         message: '{senderName} మిమ్మల్ని అనుసరించడం ప్రారంభించారు' },
        Marathi:   { title: 'नवीन फॉलोअर',            message: '{senderName} ने तुम्हाला फॉलो करायला सुरुवात केली' },
        Bengali:   { title: 'নতুন অনুসরণকারী',         message: '{senderName} আপনাকে অনুসরণ করা শুরু করেছেন' },
        Gujarati:  { title: 'નવો ફોલોઅર',             message: '{senderName} એ તમને ફોલો કરવાનું શરૂ કર્યું' },
        Punjabi:   { title: 'ਨਵਾਂ ਫਾਲੋਅਰ',             message: '{senderName} ਨੇ ਤੁਹਾਨੂੰ ਫਾਲੋ ਕਰਨਾ ਸ਼ੁਰੂ ਕੀਤਾ' },
        Malayalam: { title: 'പുതിയ ഫോളോവർ',           message: '{senderName} നിങ്ങളെ പിന്തുടരാൻ തുടങ്ങി' },
        Odia:      { title: 'ନୂଆ ଅନୁସରଣକାରୀ',         message: '{senderName} ଆପଣଙ୍କୁ ଅନୁସରଣ କରିବା ଆରମ୍ଭ କଲେ' },
    },

    LIKE: {
        English:   { title: 'Someone liked your resource', message: '{senderName} liked "{resourceTitle}"' },
        Hindi:     { title: 'किसी ने आपका संसाधन पसंद किया', message: '{senderName} ने "{resourceTitle}" को पसंद किया' },
        Kannada:   { title: 'ನಿಮ್ಮ ಸಂಪನ್ಮೂಲವನ್ನು ಯಾರೋ ಇಷ್ಟಪಟ್ಟರು', message: '{senderName} "{resourceTitle}" ಅನ್ನು ಇಷ್ಟಪಟ್ಟರು' },
        Tamil:     { title: 'உங்கள் வளத்தை ஒருவர் விரும்பினார்', message: '{senderName} "{resourceTitle}" ஐ விரும்பினார்' },
        Telugu:    { title: 'మీ వనరును ఎవరో ఇష్టపడ్డారు', message: '{senderName} "{resourceTitle}"ను ఇష్టపడ్డారు' },
        Marathi:   { title: 'कोणीतरी तुमचे संसाधन आवडले', message: '{senderName} ने "{resourceTitle}" आवडले' },
        Bengali:   { title: 'কেউ আপনার রিসোর্স পছন্দ করেছেন', message: '{senderName} "{resourceTitle}" পছন্দ করেছেন' },
        Gujarati:  { title: 'કોઈને તમારી સામગ્રી ગમી',     message: '{senderName} ને "{resourceTitle}" ગમ્યું' },
        Punjabi:   { title: 'ਕਿਸੇ ਨੇ ਤੁਹਾਡਾ ਸਰੋਤ ਪਸੰਦ ਕੀਤਾ', message: '{senderName} ਨੇ "{resourceTitle}" ਨੂੰ ਪਸੰਦ ਕੀਤਾ' },
        Malayalam: { title: 'നിങ്ങളുടെ ഉറവിടം ആരോ ഇഷ്ടപ്പെട്ടു', message: '{senderName} "{resourceTitle}" ഇഷ്ടപ്പെട്ടു' },
        Odia:      { title: 'କେହି ଆପଣଙ୍କ ସମ୍ବଳ ପସନ୍ଦ କଲେ', message: '{senderName} "{resourceTitle}" ପସନ୍ଦ କଲେ' },
    },

    RESOURCE_SAVED: {
        English:   { title: 'Resource saved',                     message: '{senderName} saved your "{resourceTitle}" to their library' },
        Hindi:     { title: 'संसाधन सहेजा गया',                    message: '{senderName} ने आपका "{resourceTitle}" अपनी लाइब्रेरी में सहेजा' },
        Kannada:   { title: 'ಸಂಪನ್ಮೂಲ ಉಳಿಸಲಾಗಿದೆ',                  message: '{senderName} ನಿಮ್ಮ "{resourceTitle}" ಅನ್ನು ತಮ್ಮ ಗ್ರಂಥಾಲಯಕ್ಕೆ ಉಳಿಸಿದ್ದಾರೆ' },
        Tamil:     { title: 'வளம் சேமிக்கப்பட்டது',                 message: '{senderName} உங்கள் "{resourceTitle}" ஐத் தங்கள் நூலகத்தில் சேமித்தார்' },
        Telugu:    { title: 'వనరు సేవ్ చేయబడింది',                  message: '{senderName} మీ "{resourceTitle}"ను తమ లైబ్రరీలో సేవ్ చేశారు' },
        Marathi:   { title: 'संसाधन जतन केले',                      message: '{senderName} ने तुमचे "{resourceTitle}" त्यांच्या लायब्ररीत जतन केले' },
        Bengali:   { title: 'রিসোর্স সংরক্ষিত',                     message: '{senderName} আপনার "{resourceTitle}" তাদের লাইব্রেরিতে সংরক্ষণ করেছেন' },
        Gujarati:  { title: 'સામગ્રી સાચવી',                       message: '{senderName} એ તમારી "{resourceTitle}" તેમની લાઇબ્રેરીમાં સાચવી' },
        Punjabi:   { title: 'ਸਰੋਤ ਸੰਭਾਲਿਆ ਗਿਆ',                    message: '{senderName} ਨੇ ਤੁਹਾਡਾ "{resourceTitle}" ਆਪਣੀ ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੰਭਾਲਿਆ' },
        Malayalam: { title: 'ഉറവിടം സംരക്ഷിച്ചു',                   message: '{senderName} നിങ്ങളുടെ "{resourceTitle}" തങ്ങളുടെ ലൈബ്രറിയിൽ സംരക്ഷിച്ചു' },
        Odia:      { title: 'ସମ୍ବଳ ସଞ୍ଚୟ ହେଲା',                    message: '{senderName} ଆପଣଙ୍କ "{resourceTitle}" କୁ ସେମାନଙ୍କ ଲାଇବ୍ରେରୀରେ ସଞ୍ଚୟ କଲେ' },
    },

    RESOURCE_USED: {
        English:   { title: 'Someone used your resource',  message: '{senderName} used your "{resourceTitle}"' },
        Hindi:     { title: 'किसी ने आपका संसाधन उपयोग किया', message: '{senderName} ने आपके "{resourceTitle}" का उपयोग किया' },
        Kannada:   { title: 'ಯಾರೋ ನಿಮ್ಮ ಸಂಪನ್ಮೂಲ ಬಳಸಿದ್ದಾರೆ', message: '{senderName} ನಿಮ್ಮ "{resourceTitle}" ಅನ್ನು ಬಳಸಿದ್ದಾರೆ' },
        Tamil:     { title: 'ஒருவர் உங்கள் வளத்தைப் பயன்படுத்தினார்', message: '{senderName} உங்கள் "{resourceTitle}" ஐப் பயன்படுத்தினார்' },
        Telugu:    { title: 'ఎవరో మీ వనరును ఉపయోగించారు', message: '{senderName} మీ "{resourceTitle}"ను ఉపయోగించారు' },
        Marathi:   { title: 'कोणीतरी तुमचे संसाधन वापरले',  message: '{senderName} ने तुमचे "{resourceTitle}" वापरले' },
        Bengali:   { title: 'কেউ আপনার রিসোর্স ব্যবহার করেছেন', message: '{senderName} আপনার "{resourceTitle}" ব্যবহার করেছেন' },
        Gujarati:  { title: 'કોઈએ તમારી સામગ્રીનો ઉપયોગ કર્યો', message: '{senderName} એ તમારી "{resourceTitle}"નો ઉપયોગ કર્યો' },
        Punjabi:   { title: 'ਕਿਸੇ ਨੇ ਤੁਹਾਡਾ ਸਰੋਤ ਵਰਤਿਆ', message: '{senderName} ਨੇ ਤੁਹਾਡੇ "{resourceTitle}" ਨੂੰ ਵਰਤਿਆ' },
        Malayalam: { title: 'ആരോ നിങ്ങളുടെ ഉറവിടം ഉപയോഗിച്ചു', message: '{senderName} നിങ്ങളുടെ "{resourceTitle}" ഉപയോഗിച്ചു' },
        Odia:      { title: 'କେହି ଆପଣଙ୍କ ସମ୍ବଳ ବ୍ୟବହାର କଲେ', message: '{senderName} ଆପଣଙ୍କ "{resourceTitle}" ବ୍ୟବହାର କଲେ' },
    },

    COMMENT: {
        English:   { title: 'New comment',   message: '{senderName} commented on "{resourceTitle}"' },
        Hindi:     { title: 'नई टिप्पणी',    message: '{senderName} ने "{resourceTitle}" पर टिप्पणी की' },
        Kannada:   { title: 'ಹೊಸ ಕಾಮೆಂಟ್',  message: '{senderName} "{resourceTitle}" ಬಗ್ಗೆ ಕಾಮೆಂಟ್ ಮಾಡಿದ್ದಾರೆ' },
        Tamil:     { title: 'புதிய கருத்து', message: '{senderName} "{resourceTitle}" மீது கருத்து தெரிவித்தார்' },
        Telugu:    { title: 'కొత్త వ్యాఖ్య', message: '{senderName} "{resourceTitle}"పై వ్యాఖ్యానించారు' },
        Marathi:   { title: 'नवीन टिप्पणी',  message: '{senderName} ने "{resourceTitle}" वर टिप्पणी केली' },
        Bengali:   { title: 'নতুন মন্তব্য',  message: '{senderName} "{resourceTitle}"-এ মন্তব্য করেছেন' },
        Gujarati:  { title: 'નવી ટિપ્પણી',   message: '{senderName} એ "{resourceTitle}" પર ટિપ્પણી કરી' },
        Punjabi:   { title: 'ਨਵੀਂ ਟਿੱਪਣੀ',   message: '{senderName} ਨੇ "{resourceTitle}" ਉੱਤੇ ਟਿੱਪਣੀ ਕੀਤੀ' },
        Malayalam: { title: 'പുതിയ കമന്റ്', message: '{senderName} "{resourceTitle}"-ൽ കമന്റ് ചെയ്തു' },
        Odia:      { title: 'ନୂଆ ମନ୍ତବ୍ୟ',  message: '{senderName} "{resourceTitle}" ଉପରେ ମନ୍ତବ୍ୟ ଦେଲେ' },
    },

    CONNECT_REQUEST: {
        English:   { title: 'New connection request',   message: '{senderName} wants to connect with you.' },
        Hindi:     { title: 'नया कनेक्शन अनुरोध',         message: '{senderName} आपसे जुड़ना चाहते हैं।' },
        Kannada:   { title: 'ಹೊಸ ಸಂಪರ್ಕ ವಿನಂತಿ',         message: '{senderName} ನಿಮ್ಮೊಂದಿಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಬಯಸುತ್ತಾರೆ.' },
        Tamil:     { title: 'புதிய இணைப்பு கோரிக்கை',      message: '{senderName} உங்களுடன் இணைய விரும்புகிறார்.' },
        Telugu:    { title: 'కొత్త కనెక్షన్ అభ్యర్థన',     message: '{senderName} మీతో కనెక్ట్ కావాలనుకుంటున్నారు.' },
        Marathi:   { title: 'नवीन कनेक्शन विनंती',         message: '{senderName} तुमच्याशी जोडू इच्छितात.' },
        Bengali:   { title: 'নতুন সংযোগ অনুরোধ',          message: '{senderName} আপনার সাথে সংযুক্ত হতে চান।' },
        Gujarati:  { title: 'નવી કનેક્શન વિનંતી',         message: '{senderName} તમારી સાથે જોડાવા માંગે છે.' },
        Punjabi:   { title: 'ਨਵੀਂ ਕਨੈਕਸ਼ਨ ਬੇਨਤੀ',         message: '{senderName} ਤੁਹਾਡੇ ਨਾਲ ਜੁੜਨਾ ਚਾਹੁੰਦੇ ਹਨ।' },
        Malayalam: { title: 'പുതിയ കണക്ഷൻ അഭ്യർത്ഥന',     message: '{senderName} നിങ്ങളുമായി ബന്ധപ്പെടാൻ ആഗ്രഹിക്കുന്നു.' },
        Odia:      { title: 'ନୂଆ ସଂଯୋଗ ଅନୁରୋଧ',           message: '{senderName} ଆପଣଙ୍କ ସହିତ ସଂଯୁକ୍ତ ହେବାକୁ ଚାହାଁନ୍ତି।' },
    },

    CONNECT_ACCEPTED: {
        English:   { title: 'Connection accepted',     message: '{senderName} accepted your connection request.' },
        Hindi:     { title: 'कनेक्शन स्वीकार किया गया', message: '{senderName} ने आपका कनेक्शन अनुरोध स्वीकार किया।' },
        Kannada:   { title: 'ಸಂಪರ್ಕ ಸ್ವೀಕರಿಸಲಾಗಿದೆ',     message: '{senderName} ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿನಂತಿಯನ್ನು ಸ್ವೀಕರಿಸಿದ್ದಾರೆ.' },
        Tamil:     { title: 'இணைப்பு ஏற்கப்பட்டது',     message: '{senderName} உங்கள் இணைப்பு கோரிக்கையை ஏற்றுக்கொண்டார்.' },
        Telugu:    { title: 'కనెక్షన్ ఆమోదించబడింది',   message: '{senderName} మీ కనెక్షన్ అభ్యర్థనను ఆమోదించారు.' },
        Marathi:   { title: 'कनेक्शन स्वीकारले',         message: '{senderName} ने तुमची कनेक्शन विनंती स्वीकारली.' },
        Bengali:   { title: 'সংযোগ গৃহীত',              message: '{senderName} আপনার সংযোগ অনুরোধ গ্রহণ করেছেন।' },
        Gujarati:  { title: 'કનેક્શન સ્વીકારાયું',      message: '{senderName} એ તમારી કનેક્શન વિનંતી સ્વીકારી.' },
        Punjabi:   { title: 'ਕਨੈਕਸ਼ਨ ਸਵੀਕਾਰ ਕੀਤਾ ਗਿਆ',  message: '{senderName} ਨੇ ਤੁਹਾਡੀ ਕਨੈਕਸ਼ਨ ਬੇਨਤੀ ਸਵੀਕਾਰ ਕੀਤੀ।' },
        Malayalam: { title: 'കണക്ഷൻ സ്വീകരിച്ചു',       message: '{senderName} നിങ്ങളുടെ കണക്ഷൻ അഭ്യർത്ഥന സ്വീകരിച്ചു.' },
        Odia:      { title: 'ସଂଯୋଗ ଗ୍ରହଣ କରାଗଲା',       message: '{senderName} ଆପଣଙ୍କ ସଂଯୋଗ ଅନୁରୋଧ ଗ୍ରହଣ କଲେ।' },
    },

    NEW_POST: {
        English:   { title: 'New post', message: '{senderName} shared "{postTitle}"' },
        Hindi:     { title: 'नई पोस्ट', message: '{senderName} ने "{postTitle}" साझा किया' },
        Kannada:   { title: 'ಹೊಸ ಪೋಸ್ಟ್', message: '{senderName} "{postTitle}" ಹಂಚಿಕೊಂಡಿದ್ದಾರೆ' },
        Tamil:     { title: 'புதிய பதிவு', message: '{senderName} "{postTitle}" பகிர்ந்தார்' },
        Telugu:    { title: 'కొత్త పోస్ట్', message: '{senderName} "{postTitle}"ను షేర్ చేశారు' },
        Marathi:   { title: 'नवीन पोस्ट', message: '{senderName} ने "{postTitle}" शेअर केले' },
        Bengali:   { title: 'নতুন পোস্ট', message: '{senderName} "{postTitle}" শেয়ার করেছেন' },
        Gujarati:  { title: 'નવી પોસ્ટ', message: '{senderName} એ "{postTitle}" શેર કર્યું' },
        Punjabi:   { title: 'ਨਵੀਂ ਪੋਸਟ', message: '{senderName} ਨੇ "{postTitle}" ਸਾਂਝਾ ਕੀਤਾ' },
        Malayalam: { title: 'പുതിയ പോസ്റ്റ്', message: '{senderName} "{postTitle}" പങ്കിട്ടു' },
        Odia:      { title: 'ନୂଆ ପୋଷ୍ଟ', message: '{senderName} "{postTitle}" ସେୟାର କଲେ' },
    },

    BADGE_EARNED: {
        English:   { title: 'Badge earned', message: 'You earned the "{badgeName}" badge!' },
        Hindi:     { title: 'बैज अर्जित किया', message: 'आपने "{badgeName}" बैज अर्जित किया!' },
        Kannada:   { title: 'ಬ್ಯಾಡ್ಜ್ ಗಳಿಸಿದ್ದೀರಿ', message: 'ನೀವು "{badgeName}" ಬ್ಯಾಡ್ಜ್ ಗಳಿಸಿದ್ದೀರಿ!' },
        Tamil:     { title: 'பதக்கம் பெற்றீர்கள்', message: 'நீங்கள் "{badgeName}" பதக்கத்தைப் பெற்றீர்கள்!' },
        Telugu:    { title: 'బ్యాడ్జ్ సంపాదించారు', message: 'మీరు "{badgeName}" బ్యాడ్జ్ సంపాదించారు!' },
        Marathi:   { title: 'बॅज मिळवला', message: 'तुम्ही "{badgeName}" बॅज मिळवला!' },
        Bengali:   { title: 'ব্যাজ অর্জন', message: 'আপনি "{badgeName}" ব্যাজ অর্জন করেছেন!' },
        Gujarati:  { title: 'બેજ મેળવ્યો', message: 'તમે "{badgeName}" બેજ મેળવ્યો!' },
        Punjabi:   { title: 'ਬੈਜ ਕਮਾਇਆ', message: 'ਤੁਸੀਂ "{badgeName}" ਬੈਜ ਕਮਾਇਆ!' },
        Malayalam: { title: 'ബാഡ്ജ് നേടി', message: 'നിങ്ങൾ "{badgeName}" ബാഡ്ജ് നേടി!' },
        Odia:      { title: 'ବ୍ୟାଜ୍ ଅର୍ଜନ', message: 'ଆପଣ "{badgeName}" ବ୍ୟାଜ୍ ଅର୍ଜନ କଲେ!' },
    },

    // SYSTEM is a pass-through escape hatch — the caller already has
    // (intentionally chosen) copy; placeholders map directly to fields.
    SYSTEM: {
        English:   { title: '{title}', message: '{message}' },
        Hindi:     { title: '{title}', message: '{message}' },
        Kannada:   { title: '{title}', message: '{message}' },
        Tamil:     { title: '{title}', message: '{message}' },
        Telugu:    { title: '{title}', message: '{message}' },
        Marathi:   { title: '{title}', message: '{message}' },
        Bengali:   { title: '{title}', message: '{message}' },
        Gujarati:  { title: '{title}', message: '{message}' },
        Punjabi:   { title: '{title}', message: '{message}' },
        Malayalam: { title: '{title}', message: '{message}' },
        Odia:      { title: '{title}', message: '{message}' },
    },

    // Virtual key used by direct/group message notifications. Persisted as
    // type: 'SYSTEM' but rendered from this localised template.
    MESSAGE: {
        English:   { title: 'New message from {senderName}',         message: '{preview}' },
        Hindi:     { title: '{senderName} से नया संदेश',                message: '{preview}' },
        Kannada:   { title: '{senderName} ರಿಂದ ಹೊಸ ಸಂದೇಶ',              message: '{preview}' },
        Tamil:     { title: '{senderName} இடமிருந்து புதிய செய்தி',     message: '{preview}' },
        Telugu:    { title: '{senderName} నుండి కొత్త సందేశం',          message: '{preview}' },
        Marathi:   { title: '{senderName} कडून नवीन संदेश',              message: '{preview}' },
        Bengali:   { title: '{senderName} থেকে নতুন বার্তা',             message: '{preview}' },
        Gujarati:  { title: '{senderName} તરફથી નવો સંદેશ',             message: '{preview}' },
        Punjabi:   { title: '{senderName} ਵੱਲੋਂ ਨਵਾਂ ਸੁਨੇਹਾ',           message: '{preview}' },
        Malayalam: { title: '{senderName}-ൽ നിന്ന് പുതിയ സന്ദേശം',       message: '{preview}' },
        Odia:      { title: '{senderName} ଠାରୁ ନୂଆ ସନ୍ଦେଶ',             message: '{preview}' },
    },
};

// ── Render ───────────────────────────────────────────────────────────────────

/**
 * Substitute {placeholder} tokens. Unknown placeholders are left intact so
 * QA spots them, rather than silently collapsing to empty strings.
 */
function interpolate(template: string, placeholders: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(placeholders, key)
            ? String(placeholders[key])
            : match;
    });
}

/**
 * Resolve template key + recipient language + placeholders into a rendered
 * `{title, message}` pair. Falls back to English when the language is unknown.
 */
export function renderNotification<K extends TemplateKey>(
    type: K,
    language: NotificationLanguage | string | undefined,
    placeholders: K extends keyof NotificationPlaceholderMap
        ? NotificationPlaceholderMap[K]
        : Record<string, string>,
): { title: string; message: string } {
    const table = NOTIFICATION_TEMPLATES[type];
    const lang = (language && (NOTIFICATION_LANGUAGES as readonly string[]).includes(language as string))
        ? (language as NotificationLanguage)
        : DEFAULT_NOTIFICATION_LANGUAGE;
    const pair = table[lang] ?? table[DEFAULT_NOTIFICATION_LANGUAGE];
    return {
        title:   interpolate(pair.title,   placeholders as Record<string, string>),
        message: interpolate(pair.message, placeholders as Record<string, string>),
    };
}
