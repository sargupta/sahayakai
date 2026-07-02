"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * RotatingProgressHint — three-stage rotating progress text used during
 * 20–30s AI generations. Cycles every 6s so the screen never feels frozen.
 *
 * NCERT demo polish (2026-05-19): the lesson plan + quiz generation paths
 * can take 20+ seconds end-to-end. A static "Generating..." string makes
 * the founder look uncertain on stage; a rotating hint shows the system
 * is actively working through known phases and reads as confident.
 *
 * Messages are intentionally framed around teacher-visible value
 * ("Adding hyperlocal examples", "Aligning to NCF-SE 5E framework"),
 * not internal architecture ("Calling Gemini 2.5 Pro"). The 5E framing
 * is the NCERT-recommended pedagogy frame and signals alignment.
 */
const DEFAULT_HINTS_BY_LANG: Record<string, string[]> = {
  en: [
    "Generating your lesson plan in your language...",
    "Adding hyperlocal examples from rural India...",
    "Aligning to NCF-SE 5E framework...",
    "Composing classroom activities for low-resource settings...",
    "Polishing assessment rubrics...",
  ],
  hi: [
    "आपकी भाषा में पाठ योजना तैयार की जा रही है...",
    "ग्रामीण भारत के स्थानीय उदाहरण जोड़े जा रहे हैं...",
    "NCF-SE 5E ढांचे के अनुरूप व्यवस्थित किया जा रहा है...",
    "कक्षा गतिविधियाँ रची जा रही हैं...",
    "मूल्यांकन रूब्रिक्स तैयार किए जा रहे हैं...",
  ],
  kn: [
    "ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    "ಗ್ರಾಮೀಣ ಭಾರತದ ಸ್ಥಳೀಯ ಉದಾಹರಣೆಗಳನ್ನು ಸೇರಿಸಲಾಗುತ್ತಿದೆ...",
    "NCF-SE 5E ಚೌಕಟ್ಟಿಗೆ ಜೋಡಿಸಲಾಗುತ್ತಿದೆ...",
    "ತರಗತಿ ಚಟುವಟಿಕೆಗಳನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    "ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್‌ಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...",
  ],
  ta: [
    "உங்கள் மொழியில் பாடத் திட்டம் உருவாக்கப்படுகிறது...",
    "கிராமப்புற இந்தியாவின் உள்ளூர் உதாரணங்கள் சேர்க்கப்படுகின்றன...",
    "NCF-SE 5E கட்டமைப்புடன் சீரமைக்கப்படுகிறது...",
    "வகுப்பறை செயல்பாடுகள் தயாரிக்கப்படுகின்றன...",
    "மதிப்பீட்டு வழிமுறைகள் வடிவமைக்கப்படுகின்றன...",
  ],
  bn: [
    "আপনার ভাষায় পাঠ পরিকল্পনা তৈরি হচ্ছে...",
    "গ্রামীণ ভারতের স্থানীয় উদাহরণ যোগ করা হচ্ছে...",
    "NCF-SE 5E কাঠামোর সাথে মিল রেখে সাজানো হচ্ছে...",
    "শ্রেণিকক্ষের কার্যক্রম রচনা করা হচ্ছে...",
    "মূল্যায়ন রুব্রিক প্রস্তুত করা হচ্ছে...",
  ],
  te: [
    "మీ భాషలో పాఠ ప్రణాళికను రూపొందిస్తోంది...",
    "గ్రామీణ భారత స్థానిక ఉదాహరణలు చేర్చబడుతున్నాయి...",
    "NCF-SE 5E చట్రానికి అనుగుణంగా సర్దుబాటు చేయబడుతోంది...",
    "తరగతి కార్యకలాపాలు రూపొందించబడుతున్నాయి...",
    "మూల్యాంకన రూబ్రిక్స్ సిద్ధం చేయబడుతున్నాయి...",
  ],
  mr: [
    "तुमच्या भाषेत पाठ नियोजन तयार होत आहे...",
    "ग्रामीण भारतातील स्थानिक उदाहरणे जोडली जात आहेत...",
    "NCF-SE 5E चौकटीशी जुळवून घेतले जात आहे...",
    "वर्ग कार्यक्रम तयार केले जात आहेत...",
    "मूल्यांकन रुब्रिक्स तयार केले जात आहेत...",
  ],
  gu: [
    "તમારી ભાષામાં પાઠ યોજના બની રહી છે...",
    "ગ્રામીણ ભારતના સ્થાનિક ઉદાહરણો ઉમેરાઈ રહ્યા છે...",
    "NCF-SE 5E માળખા સાથે સંરેખિત કરવામાં આવી રહ્યું છે...",
    "વર્ગ પ્રવૃત્તિઓ રચાઈ રહી છે...",
    "મૂલ્યાંકન રૂબ્રિક્સ તૈયાર કરવામાં આવી રહ્યા છે...",
  ],
  pa: [
    "ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪਾਠ ਯੋਜਨਾ ਤਿਆਰ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ...",
    "ਪੇਂਡੂ ਭਾਰਤ ਦੀਆਂ ਸਥਾਨਕ ਉਦਾਹਰਣਾਂ ਜੋੜੀਆਂ ਜਾ ਰਹੀਆਂ ਹਨ...",
    "NCF-SE 5E ਢਾਂਚੇ ਨਾਲ ਮੇਲ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
    "ਜਮਾਤੀ ਗਤੀਵਿਧੀਆਂ ਤਿਆਰ ਕੀਤੀਆਂ ਜਾ ਰਹੀਆਂ ਹਨ...",
    "ਮੁਲਾਂਕਣ ਰੁਬਰਿਕ ਤਿਆਰ ਕੀਤੇ ਜਾ ਰਹੇ ਹਨ...",
  ],
  ml: [
    "നിങ്ങളുടെ ഭാഷയിൽ പാഠ്യപദ്ധതി തയ്യാറാക്കുന്നു...",
    "ഗ്രാമീണ ഇന്ത്യയിൽ നിന്നുള്ള പ്രാദേശിക ഉദാഹരണങ്ങൾ ചേർക്കുന്നു...",
    "NCF-SE 5E ചട്ടക്കൂടുമായി പൊരുത്തപ്പെടുത്തുന്നു...",
    "ക്ലാസ് മുറി പ്രവർത്തനങ്ങൾ രചിക്കുന്നു...",
    "മൂല്യനിർണ്ണയ റൂബ്രിക്കുകൾ തയ്യാറാക്കുന്നു...",
  ],
  or: [
    "ଆପଣଙ୍କ ଭାଷାରେ ପାଠ ଯୋଜନା ପ୍ରସ୍ତୁତ କରାଯାଉଛି...",
    "ଗ୍ରାମୀଣ ଭାରତର ସ୍ଥାନୀୟ ଉଦାହରଣ ଯୋଡ଼ାଯାଉଛି...",
    "NCF-SE 5E ଢାଞ୍ଚା ସହିତ ସମନ୍ୱିତ କରାଯାଉଛି...",
    "ଶ୍ରେଣୀକକ୍ଷ କାର୍ଯ୍ୟକଳାପ ରଚନା କରାଯାଉଛି...",
    "ମୂଲ୍ୟାୟନ ରୁବ୍ରିକ୍ସ ପ୍ରସ୍ତୁତ କରାଯାଉଛି...",
  ],
};

interface RotatingProgressHintProps {
  language?: string;
  initialMessage?: string;
  intervalMs?: number;
  className?: string;
}

export function RotatingProgressHint({
  language = "en",
  initialMessage,
  intervalMs = 6000,
  className,
}: RotatingProgressHintProps) {
  const hints = DEFAULT_HINTS_BY_LANG[language] || DEFAULT_HINTS_BY_LANG.en;
  // If an initialMessage is supplied (e.g. existing translated state from
  // useLessonPlan), prepend it so the first frame matches whatever the
  // teacher already saw. Avoids a visual jump when the rotating hint kicks in.
  const sequence = initialMessage ? [initialMessage, ...hints] : hints;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % sequence.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, sequence.length]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm font-medium text-primary",
        className,
      )}
      aria-live="polite"
    >
      <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
      <span
        key={idx}
        className="animate-in fade-in slide-in-from-bottom-1 duration-500"
      >
        {sequence[idx]}
      </span>
    </div>
  );
}

interface LessonPlanResultSkeletonProps {
  className?: string;
}

/**
 * LessonPlanResultSkeleton — mirrors the shape of LessonPlanDisplay so
 * the layout doesn't jump when the real content swaps in. Matches the
 * five-section structure (title, overview, 5E phases, materials, assessment).
 */
export function LessonPlanResultSkeleton({
  className,
}: LessonPlanResultSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true">
      {/* Title row */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4 md:w-1/2" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-pill" />
          <Skeleton className="h-6 w-24 rounded-pill" />
          <Skeleton className="h-6 w-16 rounded-pill" />
        </div>
      </div>

      {/* Overview paragraph */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* 5E phases — 5 collapsible-looking rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-surface-md border border-border bg-card/60 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-pill shrink-0" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-12 ml-auto" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

interface LessonPlanLoadingOverlayProps {
  language?: string;
  initialMessage?: string;
  onCancel?: () => void;
  className?: string;
}

// Translated subtitle shown under the rotating progress hint.
// Kept inline (not in language-context.tsx) because the overlay is
// only mounted from one place; pulling 11 strings into the global i18n
// table would bloat that file for zero reuse.
const SUBTITLE_BY_LANG: Record<string, string> = {
  en: "Typical generation takes 15-30 seconds. Output will appear here.",
  hi: "आमतौर पर तैयार होने में 15-30 सेकंड लगते हैं। परिणाम यहाँ दिखेगा।",
  kn: "ಸಾಮಾನ್ಯವಾಗಿ 15-30 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸಿದ್ಧವಾಗುತ್ತದೆ. ಫಲಿತಾಂಶ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  ta: "வழக்கமாக 15-30 விநாடிகளில் முடியும். வெளியீடு இங்கே காணப்படும்.",
  bn: "সাধারণত ১৫-৩০ সেকেন্ড সময় নেয়। ফলাফল এখানে দেখা যাবে।",
  te: "సాధారణంగా 15-30 సెకన్లు పడుతుంది. ఫలితం ఇక్కడ కనిపిస్తుంది.",
  mr: "साधारणपणे 15-30 सेकंद लागतात. निकाल येथे दिसेल.",
  gu: "સામાન્ય રીતે 15-30 સેકન્ડ લાગે છે. પરિણામ અહીં દેખાશે.",
  pa: "ਆਮ ਤੌਰ 'ਤੇ 15-30 ਸਕਿੰਟ ਲੱਗਦੇ ਹਨ। ਨਤੀਜਾ ਇੱਥੇ ਦਿਖਾਈ ਦੇਵੇਗਾ।",
  ml: "സാധാരണ 15-30 സെക്കൻഡ് എടുക്കും. ഫലം ഇവിടെ കാണാം.",
  or: "ସାଧାରଣତଃ 15-30 ସେକେଣ୍ଡ ଲାଗେ। ଫଳାଫଳ ଏଠାରେ ଦେଖାଯିବ।",
};

const CANCEL_BY_LANG: Record<string, { label: string; aria: string }> = {
  en: { label: "Cancel", aria: "Cancel generation" },
  hi: { label: "रद्द करें", aria: "जनरेशन रद्द करें" },
  kn: { label: "ರದ್ದುಗೊಳಿಸಿ", aria: "ರಚನೆಯನ್ನು ರದ್ದುಗೊಳಿಸಿ" },
  ta: { label: "ரத்து", aria: "உருவாக்கத்தை ரத்து செய்" },
  bn: { label: "বাতিল", aria: "তৈরি বাতিল করুন" },
  te: { label: "రద్దు", aria: "ఉత్పత్తిని రద్దు చేయండి" },
  mr: { label: "रद्द करा", aria: "तयार करणे रद्द करा" },
  gu: { label: "રદ કરો", aria: "જનરેશન રદ કરો" },
  pa: { label: "ਰੱਦ ਕਰੋ", aria: "ਜਨਰੇਸ਼ਨ ਰੱਦ ਕਰੋ" },
  ml: { label: "റദ്ദാക്കുക", aria: "സൃഷ്ടി റദ്ദാക്കുക" },
  or: { label: "ବାତିଲ୍", aria: "ସୃଷ୍ଟି ବାତିଲ୍ କରନ୍ତୁ" },
};

/**
 * LessonPlanLoadingOverlay — the full 20-30s generation state.
 *
 * Combines:
 *   1. RotatingProgressHint — three-stage progress that cycles every 6s
 *   2. LessonPlanResultSkeleton — shape-matched placeholder
 *   3. Cancel button — lets the founder abort mid-demo if it stalls
 *
 * Replaces the original single Loader2 spinner inside the Generate button.
 * The spinner stays in the button (compact cue near the action), but the
 * page renders this overlay below as the "where the output will appear"
 * confirmation.
 */
export function LessonPlanLoadingOverlay({
  language = "en",
  initialMessage,
  onCancel,
  className,
}: LessonPlanLoadingOverlayProps) {
  const subtitle = SUBTITLE_BY_LANG[language] ?? SUBTITLE_BY_LANG.en;
  const cancelText = CANCEL_BY_LANG[language] ?? CANCEL_BY_LANG.en;
  return (
    <div
      className={cn(
        "rounded-surface-md border-l-4 border-l-primary bg-primary/5 p-4 md:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-medium",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <RotatingProgressHint language={language} initialMessage={initialMessage} />
          <p className="text-xs text-muted-foreground leading-relaxed indic-text">
            {subtitle}
          </p>
        </div>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="shrink-0 h-8 px-2 text-muted-foreground hover:text-foreground"
            aria-label={cancelText.aria}
          >
            <X className="h-4 w-4 mr-1" />
            {cancelText.label}
          </Button>
        )}
      </div>
      <LessonPlanResultSkeleton />
    </div>
  );
}

/**
 * LessonPlanFormSkeleton — used by `<Suspense fallback>` while the
 * lesson-plan page boots (search-params hydration). Mirrors the 7/5
 * grid of LessonPlanView so the layout never jumps on first paint.
 */
export function LessonPlanFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("container-wide py-8 md:py-12 space-y-6", className)}>
      <div className="rounded-surface-md border border-border bg-card p-6 md:p-8 space-y-6">
        <div className="space-y-3 text-center">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="lg:col-span-5 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
