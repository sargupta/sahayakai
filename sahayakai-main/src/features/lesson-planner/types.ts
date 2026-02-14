
import { z } from "zod";

export const formSchema = z.object({
    topic: z.string().min(2, {
        message: "Topic must be at least 2 characters.",
    }),
    language: z.string().default("en"),
    gradeLevels: z.array(z.string()).min(1, {
        message: "Please select at least one grade level.",
    }),
    subject: z.string().optional(),
    imageDataUri: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export const topicPlaceholderTranslations: Record<string, string> = {
    en: "Enter a topic (e.g., Photosynthesis, Newton's Laws)",
    hi: "एक विषय दर्ज करें (जैसे, प्रकाश संश्लेषण, न्यूटन के नियम)",
    bn: "একটি বিষয় লিখুন (যেমন, সালোকসংশ্লেষণ, নিউটনের সূত্র)",
    te: "ఒక అంశాన్ని నమోదు చేయండి (ఉదా. కిరణజన్య సంయోగక్రియ)",
    mr: "एक विषय प्रविष्ट करा (उदा. प्रकाश संश्लेषण)",
    ta: "ஒரு தலைப்பை உள்ளிடவும் (எ.கா., ஒளிச்சேர்க்கை)",
    gu: "એક વિષય દાખલ કરો (દા.ત., પ્રકાશસંશ્લેષણ)",
    kn: "ಒಂದು ವಿಷಯವನ್ನು ನಮೂದಿಸಿ (ಉದಾ. ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ)",
    pa: "ਇੱਕ ਵਿਸ਼ਾ ਦਰਜ ਕਰੋ (ਜਿਵੇਂ, ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ)",
    ml: "ഒരു വിഷയം നൽകുക (ഉദാ. പ്രകാശസംശ്ലേഷണം)",
    or: "ଏକ ବିଷୟ ପ୍ରବେଶ କରନ୍ତୁ (ଯଥା, ଆଲୋକ ସଂଶ୍ଳେଷଣ)",
};

export const loadingMessages: Record<string, { analyzing: string; consulting: string }> = {
    en: {
        analyzing: "Analyzing Topic...",
        consulting: "Consulting Educational Resources...",
    },
    hi: {
        analyzing: "विषय का विश्लेषण किया जा रहा है...",
        consulting: "शैक्षिक संसाधनों से परामर्श किया जा रहा है...",
    },
    bn: {
        analyzing: "বিষয়টি বিশ্লেষণ করা হচ্ছে...",
        consulting: "শিক্ষামূলক সম্পদ অনুসন্ধান করা হচ্ছে...",
    },
    te: {
        analyzing: "అంశాన్ని విశ్లేషిస్తోంది...",
        consulting: "విద్యా వనరులను సంప్రదిస్తోంది...",
    },
    mr: {
        analyzing: "विषयाचे विश्लेषण करत आहे...",
        consulting: "शैक्षणिक संसाधनांचा सल्ला घेत आहे...",
    },
    ta: {
        analyzing: "தலைப்பை பகுப்பாய்வு செய்கிறது...",
        consulting: "கல்வி வளங்களை ஆலோசிக்கிறது...",
    },
    gu: {
        analyzing: "વિષયનું વિશ્લેષણ કરી રહ્યું છે...",
        consulting: "શૈક્ષણિક સંસાધનોની સલાહ લઈ રહ્યું છે...",
    },
    kn: {
        analyzing: "ವಿಷಯವನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...",
        consulting: "ಶೈಕ್ಷಣಿಕ ಸಂಪನ್ಮೂಲಗಳನ್ನು ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...",
    },
    pa: {
        analyzing: "ਵਿਸ਼ੇ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰ ਰਿਹਾ ਹੈ...",
        consulting: "ਵਿੱਦਿਅਕ ਸਰੋਤਾਂ ਨਾਲ ਸਲਾਹ ਕਰ ਰਿਹਾ ਹੈ...",
    },
    ml: {
        analyzing: "വിഷയം വിശകലനം ചെയ്യുന്നു...",
        consulting: "വിദ്യാഭ്യാസ വിഭവങ്ങൾ പരിശോധിക്കുന്നു...",
    },
    or: {
        analyzing: "ବିଷୟ ବିଶ୍ଳେଷଣ କରାଯାଉଛି...",
        consulting: "ଶିକ୍ଷାଗତ ସମ୍ବଳ ପରାମର୍ଶ କରାଯାଉଛି...",
    },
};
