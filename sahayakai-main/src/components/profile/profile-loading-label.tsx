"use client";

import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";

// Localized loading label for the public profile route. The page itself is a
// server component (no hooks), so this small client component carries the
// translation, resolved by the app UI language.
const LOADING: Record<string, string> = {
    en: "Loading teacher profile...",
    hi: "शिक्षक प्रोफ़ाइल लोड हो रही है...",
    mr: "शिक्षक प्रोफाइल लोड होत आहे...",
    bn: "শিক্ষকের প্রোফাইল লোড হচ্ছে...",
    pa: "ਅਧਿਆਪਕ ਪ੍ਰੋਫਾਈਲ ਲੋਡ ਹੋ ਰਹੀ ਹੈ...",
    gu: "શિક્ષક પ્રોફાઇલ લોડ થઈ રહી છે...",
    or: "ଶିକ୍ଷକ ପ୍ରୋଫାଇଲ୍ ଲୋଡ୍ ହେଉଛି...",
    ta: "ஆசிரியர் சுயவிவரம் ஏற்றப்படுகிறது...",
    te: "ఉపాధ్యాయుని ప్రొఫైల్ లోడ్ అవుతోంది...",
    kn: "ಶಿಕ್ಷಕರ ಪ್ರೊಫೈಲ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    ml: "അധ്യാപക പ്രൊഫൈൽ ലോഡ് ചെയ്യുന്നു...",
};

export function ProfileLoadingLabel() {
    const { language } = useLanguage();
    const ui = LANGUAGE_TO_ISO[language] ?? "en";
    return (
        <p className="text-muted-foreground font-medium">{LOADING[ui] ?? LOADING.en}</p>
    );
}
