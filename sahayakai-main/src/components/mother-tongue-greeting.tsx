"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { tts } from "@/lib/tts";
import { getProfileData, updateProfileAction } from "@/app/actions/profile";
import type { Language } from "@/types";

/**
 * Mother Tongue Moment — Breakthrough Idea #7
 *
 * On first app open after onboarding, auto-play a warm TTS greeting
 * in the teacher's preferred language. Creates an immediate emotional
 * connection: "This app speaks MY language."
 *
 * Fires once per user (sets hasHeardGreeting = true in profile).
 */

const GREETINGS: Record<Language, string> = {
    English: "Welcome to SahayakAI, Teacher! I am your AI teaching assistant. Tell me what you need — a lesson plan, a quiz, a visual aid — I will create it for you.",
    Hindi: "SahayakAI में आपका स्वागत है, शिक्षक! मैं आपका AI शिक्षण सहायक हूँ। बताइए आपको क्या चाहिए — पाठ योजना, प्रश्नोत्तरी, या कोई भी शिक्षण सामग्री — मैं तुरंत बना दूँगा।",
    Kannada: "ಶಿಕ್ಷಕರೇ, SahayakAI ಗೆ ಸ್ವಾಗತ! ನಾನು ನಿಮ್ಮ AI ಬೋಧನಾ ಸಹಾಯಕ. ನಿಮಗೆ ಏನು ಬೇಕು ಹೇಳಿ — ಪಾಠ ಯೋಜನೆ, ರಸಪ್ರಶ್ನೆ, ದೃಶ್ಯ ಸಾಧನ — ನಾನು ಈಗಲೇ ತಯಾರಿಸುತ್ತೇನೆ.",
    Tamil: "ஆசிரியரே, SahayakAI க்கு வரவேற்கிறோம்! நான் உங்கள் AI கற்பித்தல் உதவியாளர். உங்களுக்கு என்ன வேண்டும் சொல்லுங்கள் — பாடத் திட்டம், வினாடி வினா, காட்சிப் பொருள் — நான் உடனே உருவாக்குகிறேன்.",
    Telugu: "టీచర్, SahayakAI కి స్వాగతం! నేను మీ AI బోధనా సహాయకుడిని. మీకు ఏమి కావాలో చెప్పండి — పాఠ ప్రణాళిక, క్విజ్, విజువల్ ఎయిడ్ — నేను వెంటనే తయారు చేస్తాను.",
    Marathi: "शिक्षक, SahayakAI मध्ये आपले स्वागत आहे! मी तुमचा AI अध्यापन सहाय्यक आहे. तुम्हाला काय हवे ते सांगा — धडा योजना, प्रश्नमंजुषा, व्हिज्युअल एड — मी लगेच तयार करतो.",
    Bengali: "শিক্ষক, SahayakAI তে স্বাগতম! আমি আপনার AI শিক্ষণ সহায়ক। আপনার কী দরকার বলুন — পাঠ পরিকল্পনা, কুইজ, ভিজ্যুয়াল এইড — আমি এখনই তৈরি করে দেব।",
    Gujarati: "શિક્ષક, SahayakAI માં આપનું સ્વાગત છે! હું તમારો AI શિક્ષણ સહાયક છું. તમને શું જોઈએ છે કહો — પાઠ યોજના, ક્વિઝ, વિઝ્યુઅલ એઇડ — હું તરત બનાવી આપીશ.",
    Punjabi: "ਅਧਿਆਪਕ ਜੀ, SahayakAI ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ! ਮੈਂ ਤੁਹਾਡਾ AI ਅਧਿਆਪਨ ਸਹਾਇਕ ਹਾਂ। ਦੱਸੋ ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ — ਪਾਠ ਯੋਜਨਾ, ਕੁਇਜ਼, ਵਿਜ਼ੁਅਲ ਏਡ — ਮੈਂ ਹੁਣੇ ਬਣਾ ਦਿੰਦਾ ਹਾਂ।",
    Malayalam: "അധ്യാപകരേ, SahayakAI ലേക്ക് സ്വാഗതം! ഞാൻ നിങ്ങളുടെ AI അധ്യാപന സഹായിയാണ്. നിങ്ങൾക്ക് എന്താണ് വേണ്ടതെന്ന് പറയൂ — പാഠ പദ്ധതി, ക്വിസ്, വിഷ്വൽ എയ്ഡ് — ഞാൻ ഉടൻ ഉണ്ടാക്കിത്തരാം.",
    Odia: "ଶିକ୍ଷକ, SahayakAI ରେ ଆପଣଙ୍କୁ ସ୍ୱାଗତ! ମୁଁ ଆପଣଙ୍କ AI ଶିକ୍ଷାଦାନ ସହାୟକ। ଆପଣଙ୍କୁ କ'ଣ ଦରକାର କୁହନ୍ତୁ — ପାଠ ଯୋଜନା, କୁଇଜ୍, ଭିଜୁଆଲ୍ ଏଡ୍ — ମୁଁ ତୁରନ୍ତ ତିଆରି କରିଦେବି।",
};

// Map Language display name to TTS lang code
const LANG_TO_CODE: Record<Language, string> = {
    English: "en-IN",
    Hindi: "hi-IN",
    Kannada: "kn-IN",
    Tamil: "ta-IN",
    Telugu: "te-IN",
    Marathi: "hi-IN", // Devanagari — TTS route auto-detects
    Bengali: "bn-IN",
    Gujarati: "gu-IN",
    Punjabi: "pa-IN",
    Malayalam: "ml-IN",
    Odia: "or-IN",
};

export function MotherTongueGreeting() {
    const { user } = useAuth();
    const { language, isLoaded } = useLanguage();
    const hasTriggered = useRef(false);

    useEffect(() => {
        if (!user || !isLoaded || hasTriggered.current) return;

        const checkAndGreet = async () => {
            try {
                const { profile } = await getProfileData(user.uid);

                // Only greet if: profile exists (onboarded), hasn't heard greeting yet
                if (!profile?.schoolName || profile?.hasHeardGreeting) return;

                hasTriggered.current = true;

                // Small delay so the page has rendered
                await new Promise(r => setTimeout(r, 1500));

                const greeting = GREETINGS[language] || GREETINGS.English;
                const langCode = LANG_TO_CODE[language] || "en-IN";

                await tts.speak(greeting, langCode);

                // Mark as done — fire and forget
                updateProfileAction(user.uid, { hasHeardGreeting: true }).catch(() => { });
            } catch {
                // Non-critical — silently fail
            }
        };

        checkAndGreet();
    }, [user, isLoaded, language]);

    // This component renders nothing — it's a behavior hook
    return null;
}
