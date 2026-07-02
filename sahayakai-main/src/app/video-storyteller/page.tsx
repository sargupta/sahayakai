"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import {
  Video, Loader2, Sparkles, RefreshCw,
  Star, BookOpen, GraduationCap, Bell, School, type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { VideoCard } from "@/components/video-storyteller/VideoCard";
import { VideoCarousel } from "@/components/video-storyteller/VideoCarousel";
import { YouTubeVideo } from "@/lib/youtube";
import { mergeCuratedVideos } from "@/lib/curated-videos";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { VideoFilterBar } from "@/components/video-storyteller/VideoFilterBar";
import { getUserProfileAction } from "@/app/actions/auth";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { useSearchParams } from "next/navigation";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { LANGUAGE_CODE_MAP, LANGUAGE_TO_ISO } from "@/types";
import { useLanguage } from "@/context/language-context";

interface VideoRecommendations {
  categories: {
    pedagogy: string[];
    storytelling: string[];
    govtUpdates: string[];
    courses: string[];
    topRecommended: string[];
  };
  personalizedMessage: string;
  categorizedVideos: Record<string, YouTubeVideo[]>;
}

// Category title keys — actual titles resolved via t() inside the component (Wave 2 i18n).
const CATEGORY_DEFS: { key: string; titleKey: string; icon: LucideIcon }[] = [
  { key: "topRecommended", titleKey: "Top Recommended for You", icon: Star },
  { key: "storytelling",   titleKey: "Storytelling for Your Subjects", icon: BookOpen },
  { key: "pedagogy",       titleKey: "Pedagogy & Teaching Methods", icon: GraduationCap },
  { key: "govtUpdates",    titleKey: "Government Updates", icon: Bell },
  { key: "courses",        titleKey: "Teacher Training Courses", icon: School },
];

// Fallback personalization banner (degraded/offline path) — local i18n table
// keyed by UI-language ISO code, native script only. Mirrors the widely-used
// component-local table pattern (lesson-plan-view.tsx, example-prompts.tsx).
const FALLBACK_MESSAGE: Record<string, string> = {
  en: "Namaste Adhyapak! Here are some carefully selected videos to help you deliver engaging lessons, stay updated on government policies, and grow as an educator.",
  hi: "नमस्ते अध्यापक! यहाँ कुछ सावधानीपूर्वक चुने गए वीडियो हैं जो आपको रोचक पाठ पढ़ाने, सरकारी नीतियों से अपडेट रहने और एक शिक्षक के रूप में विकसित होने में मदद करेंगे।",
  mr: "नमस्ते अध्यापक! येथे काळजीपूर्वक निवडलेले काही व्हिडिओ आहेत जे तुम्हाला आकर्षक धडे शिकवण्यास, सरकारी धोरणांबाबत अद्ययावत राहण्यास आणि शिक्षक म्हणून प्रगती करण्यास मदत करतील.",
  bn: "নমস্তে অধ্যাপক! এখানে যত্ন সহকারে নির্বাচিত কিছু ভিডিও রয়েছে যা আপনাকে আকর্ষণীয় পাঠ দিতে, সরকারি নীতি সম্পর্কে আপডেট থাকতে এবং একজন শিক্ষক হিসেবে এগিয়ে যেতে সাহায্য করবে।",
  pa: "ਨਮਸਤੇ ਅਧਿਆਪਕ! ਇੱਥੇ ਕੁਝ ਧਿਆਨ ਨਾਲ ਚੁਣੇ ਗਏ ਵੀਡੀਓ ਹਨ ਜੋ ਤੁਹਾਨੂੰ ਦਿਲਚਸਪ ਪਾਠ ਪੜ੍ਹਾਉਣ, ਸਰਕਾਰੀ ਨੀਤੀਆਂ ਬਾਰੇ ਅੱਪਡੇਟ ਰਹਿਣ ਅਤੇ ਇੱਕ ਅਧਿਆਪਕ ਵਜੋਂ ਅੱਗੇ ਵਧਣ ਵਿੱਚ ਮਦਦ ਕਰਨਗੇ।",
  gu: "નમસ્તે અધ્યાપક! અહીં કાળજીપૂર્વક પસંદ કરેલા કેટલાક વીડિયો છે જે તમને રસપ્રદ પાઠ ભણાવવામાં, સરકારી નીતિઓ વિશે અપડેટ રહેવામાં અને એક શિક્ષક તરીકે વિકાસ કરવામાં મદદ કરશે.",
  or: "ନମସ୍ତେ ଅଧ୍ୟାପକ! ଏଠାରେ ଯତ୍ନ ସହକାରେ ବଛାଯାଇଥିବା କିଛି ଭିଡିଓ ଅଛି ଯାହା ଆପଣଙ୍କୁ ଆକର୍ଷଣୀୟ ପାଠ ପଢ଼ାଇବାରେ, ସରକାରୀ ନୀତି ବିଷୟରେ ଅଦ୍ୟତନ ରହିବାରେ ଏବଂ ଜଣେ ଶିକ୍ଷକ ଭାବେ ଆଗକୁ ବଢ଼ିବାରେ ସାହାଯ୍ୟ କରିବ।",
  ta: "வணக்கம் ஆசிரியரே! கவர்ச்சிகரமான பாடங்களை வழங்கவும், அரசாங்கக் கொள்கைகளில் புதுப்பித்த நிலையில் இருக்கவும், ஒரு கல்வியாளராக வளரவும் உதவ கவனமாகத் தேர்ந்தெடுக்கப்பட்ட சில வீடியோக்கள் இங்கே உள்ளன.",
  te: "నమస్తే అధ్యాపకా! ఆకర్షణీయమైన పాఠాలను అందించడంలో, ప్రభుత్వ విధానాలపై తాజాగా ఉండడంలో మరియు ఉపాధ్యాయునిగా ఎదగడంలో మీకు సహాయపడేందుకు జాగ్రత్తగా ఎంపిక చేసిన కొన్ని వీడియోలు ఇక్కడ ఉన్నాయి.",
  kn: "ನಮಸ್ತೆ ಅಧ್ಯಾಪಕರೇ! ಆಕರ್ಷಕ ಪಾಠಗಳನ್ನು ನೀಡಲು, ಸರ್ಕಾರಿ ನೀತಿಗಳ ಬಗ್ಗೆ ನವೀಕೃತವಾಗಿರಲು ಮತ್ತು ಶಿಕ್ಷಕರಾಗಿ ಬೆಳೆಯಲು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಎಚ್ಚರಿಕೆಯಿಂದ ಆಯ್ಕೆ ಮಾಡಿದ ಕೆಲವು ವೀಡಿಯೊಗಳು ಇಲ್ಲಿವೆ.",
  ml: "നമസ്തേ അധ്യാപകാ! ആകർഷകമായ പാഠങ്ങൾ നൽകാനും സർക്കാർ നയങ്ങളെക്കുറിച്ച് അപ്ഡേറ്റ് ആയിരിക്കാനും ഒരു അധ്യാപകനായി വളരാനും നിങ്ങളെ സഹായിക്കുന്ന ശ്രദ്ധയോടെ തിരഞ്ഞെടുത്ത ചില വീഡിയോകൾ ഇതാ.",
};

// Next 15 prerender requires useSearchParams() to be wrapped in a
// Suspense boundary; otherwise the page falls back to client-side
// rendering at build time and errors out. Default export wraps the
// inner component.
export default function VideoStorytellerPage() {
  return (
    <Suspense fallback={null}>
      <VideoStorytellerPageInner />
    </Suspense>
  );
}

function VideoStorytellerPageInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const uiLangCode = LANGUAGE_TO_ISO[language] || "en";
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<VideoRecommendations | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<{ key: string; title: string; icon: LucideIcon } | null>(null);

  const [filters, setFilters] = useState<{
    subject?: string;
    gradeLevel?: string;
    language?: string;
    searchQuery?: string;
  }>({ language: "English" });

  const fetchRecommendations = async (activeFilters = filters) => {
    setLoading(true);
    try {
      // Token is optional — video content is public; personalization degrades gracefully without auth
      const token = await user?.getIdToken().catch(() => null);

      const response = await fetch("/api/ai/video-storyteller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: activeFilters.subject,
          gradeLevel: activeFilters.gradeLevel,
          language: activeFilters.language,
          topic: activeFilters.searchQuery,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(`API ${response.status}: ${errBody?.error || errBody?.code || "Unknown error"}`);
      }

      const data = await response.json();
      data.categorizedVideos = mergeCuratedVideos(data.categorizedVideos || {});
      setRecommendations(data);
    } catch (error) {
      console.error("Error fetching video recommendations:", error);
      setRecommendations({
        categories: { pedagogy: [], storytelling: [], govtUpdates: [], courses: [], topRecommended: [] },
        personalizedMessage: FALLBACK_MESSAGE[uiLangCode] || FALLBACK_MESSAGE.en,
        categorizedVideos: mergeCuratedVideos({}),
      });
      toast({
        title: t("Showing curated content"),
        description: t("Personalization is loading. Showing recommended Indian educational videos."),
      });
    } finally {
      setLoading(false);
    }
  };

  // ── VIDYA Action: Pre-fill from URL params ─────────────────────────────
  // NCERT-demo 2026-05-19 pattern (see use-lesson-plan.ts). Video Storyteller
  // uses imperative useState filters and stores language as display name
  // ("English"); we normalise the inbound ISO/display value to the display
  // form the API consumer expects.
  const searchParams = useSearchParams();
  const hasAppliedVidyaParams = useRef(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        const result = await getUserProfileAction(user.uid);

        // VIDYA params take precedence over profile defaults so the
        // teacher's spoken intent overrides their persisted preference.
        const gradeLevelParam = searchParams?.get("gradeLevel") ?? null;
        const subjectParam = searchParams?.get("subject") ?? null;
        const languageParam = searchParams?.get("language") ?? null;
        const topicParam = searchParams?.get("topic") ?? null;
        const hasVidyaParams = !!(gradeLevelParam || subjectParam || languageParam || topicParam);

        const iso = normaliseVidyaLanguage(languageParam);
        const displayLang = iso
          ? LANGUAGE_CODE_MAP[iso as keyof typeof LANGUAGE_CODE_MAP]
          : undefined;

        const profile = result.success ? result.profile : null;

        const initialFilters = {
          subject: subjectParam || profile?.subjects?.[0],
          gradeLevel: normaliseVidyaGradeLevel(gradeLevelParam)
            ?? profile?.teachingGradeLevels?.[0],
          language: displayLang || profile?.preferredLanguage || "English",
          searchQuery: topicParam || undefined,
        };
        setFilters(initialFilters);
        if (hasVidyaParams) hasAppliedVidyaParams.current = true;
        fetchRecommendations(initialFilters);
      }
    };
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    fetchRecommendations(newFilters);
  };

  const handleVideoSelect = (video: YouTubeVideo) => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, "_blank");
  };

  // ── Expanded category view ──────────────────────────────────────────────────
  if (expandedCategory && recommendations) {
    const videos = recommendations.categorizedVideos[expandedCategory.key] || [];
    const Icon = expandedCategory.icon;
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BackButton onBack={() => setExpandedCategory(null)} />
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-headline tracking-tight font-bold text-foreground">{expandedCategory.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} onSelect={handleVideoSelect} />
          ))}
        </div>
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline tracking-tight font-bold text-foreground leading-tight">
              {t("Video Storyteller")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("Curated educational videos for Indian classrooms")}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRecommendations()}
          disabled={loading || !canUseAI}
          className="rounded-xl gap-1.5 h-8 text-xs shrink-0 mt-1"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          }
          {t("Refresh")}
        </Button>
      </div>

      {/* Filter bar */}
      <VideoFilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

      {/* AI insight banner */}
      {recommendations && (
        <div className="flex items-start gap-2.5 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed italic">
            {recommendations.personalizedMessage}
          </p>
        </div>
      )}

      {/* Loading state — initial load */}
      {loading && !recommendations && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-muted/40 rounded-2xl border border-dashed border-border">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-primary/30 animate-spin" />
            <Sparkles className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{t("Curating your videos…")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("Finding Bharat-first content for your classroom")}</p>
          </div>
        </div>
      )}

      {/* Video carousels */}
      {recommendations && (
        <div>
        <div className="my-8 flex items-center gap-3">
          <hr className="flex-1 border-border/40" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{t("Result")}</span>
          <hr className="flex-1 border-border/40" />
        </div>
        <div className="divide-y divide-border">
          {CATEGORY_DEFS.map(cat => (
            <VideoCarousel
              key={cat.key}
              categoryKey={cat.key}
              title={t(cat.titleKey)}
              icon={cat.icon}
              videos={recommendations.categorizedVideos[cat.key]}
              onVideoSelect={handleVideoSelect}
              onViewAll={(key) => {
                const found = CATEGORY_DEFS.find(c => c.key === key);
                if (found) setExpandedCategory({ key: found.key, title: t(found.titleKey), icon: found.icon });
              }}
            />
          ))}
        </div>
        </div>
      )}

      {/* Empty state — not loading, no data, user logged in */}
      {!loading && !recommendations && user && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Video className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{t("Ready to explore?")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("Use the filters above to find videos for your classroom.")}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchRecommendations()}
            className="rounded-xl gap-1.5 h-8 text-xs mt-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("Load Recommendations")}
          </Button>
        </div>
      )}
    </div>
  );
}
