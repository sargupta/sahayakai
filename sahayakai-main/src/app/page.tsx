"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MicrophoneInput } from "@/components/microphone-input";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { BookOpen, BrainCircuit, PenTool, GraduationCap, Sparkles, ArrowRight, Loader2, X, Mic, Search, Lightbulb, FileText, ClipboardList, Image, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { SampleOutputSection } from "@/components/landing/sample-output-section";
import { useCommunityIntro } from "@/hooks/use-community-intro";
import { CommunityNudgeBanner } from "@/components/community/community-nudge-banner";
import { DemoInteraction } from "@/components/landing/demo-interaction";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { ProfileCompletionCard } from "@/components/onboarding/profile-completion-card";
import { FeatureSpotlight, SPOTLIGHT_IDS } from "@/components/onboarding/feature-spotlight";
import type { ContextualSuggestion } from "@/lib/contextual-suggestions";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
});

type FormValues = z.infer<typeof formSchema>;





const SuggestionCard = ({ suggestion }: { suggestion: ContextualSuggestion }) => (
  <Link href={suggestion.toolHref} className="group">
    <Card className="h-full border border-border border-l-[3px] border-l-primary shadow-soft hover:border-primary/50 hover:border-l-primary transition-colors duration-150 overflow-hidden">
      <CardContent className="p-4 flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">{suggestion.toolLabel}</span>
        <h3 className="font-headline text-sm font-semibold text-foreground leading-tight">{suggestion.topic}</h3>
        <p className="text-xs text-muted-foreground">{suggestion.subject} &middot; {suggestion.gradeLevel}</p>
        <div className="mt-auto pt-2 text-primary font-medium text-xs flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          Start <ArrowRight className="h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function Home() {
  const { requireAuth, openAuthModal } = useAuth();
  const { language: userLanguage, t } = useLanguage();
  const {
    isNewUser, generationCount, checklistItems, suggestions, phase, advancePhase,
    profile, profileSummary, spotlightsSeen, markSpotlightSeen,
    showProfileCompletion, checklistDismissed, isFirstWeek,
    refreshSuggestions, dismissProfileCard, dismissChecklist,
  } = useOnboardingProgress();
  const { showNudge, dismissNudge, markVisited, trackGeneration } = useCommunityIntro({ profile });
  const [greeting, setGreeting] = useState("Namaste");
  const [isThinking, setIsThinking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [showAllToolsOnPage, setShowAllToolsOnPage] = useState(false);
  const router = useRouter();

  const showNewUserHome = isNewUser && generationCount < 5;
  const teacherName = profileSummary?.displayName?.split(' ')[0] || "Teacher";
  const primarySubject = profileSummary?.subjects?.[0];

  const { toast } = useToast();
  useEffect(() => {
    // Client-side only logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    // Handle voice transcript from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const voiceTranscript = params.get("voice_transcript");

      if (voiceTranscript) {
        form.setValue("topic", voiceTranscript);
        form.handleSubmit(onSubmit)();
      }
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    // Determine intent using the Smart Router
    setIsThinking(true);
    setAnswer(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/intent", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ prompt: values.topic, language: userLanguage })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to use the AI assistant");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process request");
      }

      const response = await res.json();
      const { result } = response;

      if (result?.action === 'NAVIGATE' && result.url) {
        trackGeneration();
        setIsThinking(false);
        router.push(result.url);
      } else if (result?.action === 'ANSWER') {
        trackGeneration();
        setAnswer(result.content);
        setIsThinking(false);
      } else {
        // Fallback or error
        toast({
          title: "Not sure how to help",
          description: result?.error || "Please try asking to create a lesson plan, quiz, or visual aid.",
          variant: "destructive"
        });
        setIsThinking(false);
      }
    } catch (error) {
      console.error("Router Error:", error);
      toast({
        title: "Connection Error",
        description: "Could not reach Sahayak. Please try again.",
        variant: "destructive"
      });
      setIsThinking(false);
    }
  };

  const handleTranscript = (transcript: string, _language?: string) => {
    form.setValue("topic", transcript);
    form.handleSubmit(onSubmit)();
  };

  const QuickActionCard = ({ title, icon: Icon, href, color, description }: { title: string, icon: any, href: string, color: string, description: string }) => (
    <Link href={href} className="group">
      <Card className="h-full border border-border border-l-[3px] border-l-primary shadow-soft hover:border-primary/50 hover:border-l-primary transition-colors duration-150 overflow-hidden">
        <CardContent className="p-4 md:p-6 flex flex-col items-center text-center gap-3 md:gap-4">
          <div className={cn("p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-all duration-200")}>
            <Icon className="h-6 w-6 md:h-8 md:w-8" />
          </div>
          <div className="space-y-1 md:space-y-2">
            <h2 className="font-headline text-base font-semibold text-foreground leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
          </div>
          <div className="mt-auto pt-2 md:pt-4 text-primary font-medium text-xs md:text-sm flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            Start <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-6xl mx-auto px-4 py-8 md:py-12 gap-8 md:gap-12 relative">
      {/* Clean Top Bar for Consistency */}
      <div className="absolute top-0 left-0 h-1.5 w-full bg-primary rounded-t-xl" />

      {/* Hero Section */}
      <div className="text-center space-y-4 md:space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-xs md:text-sm font-medium border border-orange-100 mb-2 md:mb-4">
          <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
          <span>{t("AI-Powered Teaching Assistant for Bharat")}</span>
        </div>
        <h1 className="font-headline text-4xl md:text-7xl font-bold text-foreground tracking-tight">
          {greeting}, <span className="text-primary">{teacherName}.</span>
        </h1>
        {showNewUserHome && suggestions.length > 0 ? (
          <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            {t("Ideas for your classes")}
          </p>
        ) : (
          <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.
          </p>
        )}
      </div>

      {/* Main Voice-First Input Section */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10 flex flex-col items-center gap-8">

        {/* BIG MIC BUTTON */}
        <FeatureSpotlight
          id={SPOTLIGHT_IDS.HOME_VOICE_INPUT}
          message="Tap the mic and speak in any language. SahayakAI understands Hindi, Kannada, Tamil and more!"
          seenSpotlights={spotlightsSeen}
          onDismiss={markSpotlightSeen}
          position="bottom"
        >
          <div className="flex flex-col items-center gap-4">
            <MicrophoneInput
              onTranscriptChange={handleTranscript}
              iconSize="xl"
              label="Speak your topic"
              className=""
            />
            <p className="text-muted-foreground text-sm md:text-sm">
              Tap the microphone and tell Sahayak what you want to teach today
            </p>
          </div>
        </FeatureSpotlight>

        {/* OR TEXT INPUT (SECONDARY) */}
        <div className="w-full">
          <Card className="border-none shadow-xl bg-card/95 backdrop-blur-sm ring-1 ring-border/80 transition-all focus-within:ring-primary/40 focus-within:ring-2">
            <CardContent className="p-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <AutoCompleteInput
                      placeholder="Type a topic, e.g. 'Photosynthesis for Class 8'"
                      {...form.register("topic")}
                      value={form.watch("topic")}
                      selectedLanguage={userLanguage || "English"}
                      onSuggestionClick={(value) => {
                        form.setValue("topic", value);
                        form.handleSubmit(onSubmit)();
                      }}
                      className="border-none shadow-none focus-visible:ring-0 text-sm md:text-base py-2 pl-4 bg-transparent"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-95"
                    aria-label="Generate Lesson Plan"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-xs text-muted-foreground px-4">
            try: "Quiz about photosynthesis" or "Lesson plan for solar system"
          </p>
          <p className="text-xs text-muted-foreground">
            Works in हिंदी, ಕನ್ನಡ, தமிழ் + 8 more languages
          </p>

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 text-primary font-medium mt-2">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                <span className="ml-2">{t("Thinking")}</span>
              </span>
            </div>
          )}

          {/* Instant Answer Card */}
          {answer && (
            <Card className="w-full max-w-2xl mt-4 border-primary/20 bg-card shadow-lg animate-in fade-in slide-in-from-bottom-2 border-l-4 border-primary">
              <CardContent className="p-4 md:p-6 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setAnswer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="prose prose-sm max-w-none text-foreground">
                  <h3 className="text-primary font-bold mb-2 text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" />{t("Answer")}</h3>
                  <div className="whitespace-pre-wrap">{answer}</div>
                  <p className="text-[10px] text-muted-foreground mt-3 not-prose">
                    Sahayak can make mistakes. Please review generated content.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sample Output -- hidden for new users who see personalized suggestions */}
      {!showNewUserHome && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150 flex justify-center">
          <SampleOutputSection />
        </div>
      )}

      {/* Demo Interaction -- hidden for new users */}
      {!showNewUserHome && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-200">
          <DemoInteraction />
        </div>
      )}

      {/* Quick Actions Grid — personalized for new users, full grid for experienced */}
      {showNewUserHome && suggestions.length > 0 ? (
        <div className="w-full animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {suggestions.map(s => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={refreshSuggestions}
              className="text-sm text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> {t("Show different ideas")}
            </button>
            {!showAllToolsOnPage && (
              <button
                onClick={() => setShowAllToolsOnPage(true)}
                className="text-sm text-primary font-medium hover:underline"
              >
                {t("See all tools")} &rarr;
              </button>
            )}
          </div>
          {showAllToolsOnPage && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full animate-in fade-in duration-300">
              <QuickActionCard title="Lesson Plan" icon={BookOpen} href="/lesson-plan" color="" description="NCERT-aligned plans." />
              <QuickActionCard title="Quiz Generator" icon={BrainCircuit} href="/quiz-generator" color="" description="Instant quizzes & worksheets." />
              <QuickActionCard title="Exam Paper" icon={FileText} href="/exam-paper" color="" description="Board-aligned papers." />
              <QuickActionCard title="Worksheet Wizard" icon={ClipboardList} href="/worksheet-wizard" color="" description="Practice worksheets." />
              <QuickActionCard title="Visual Aid" icon={Image} href="/visual-aid-designer" color="" description="Diagrams & illustrations." />
              <QuickActionCard title="Content Creator" icon={PenTool} href="/content-creator" color="" description="Stories & visual aids." />
              <QuickActionCard title="Instant Answer" icon={Lightbulb} href="/instant-answer" color="" description="Quick answers to questions." />
              <QuickActionCard title="Teacher Training" icon={GraduationCap} href="/teacher-training" color="" description="Professional development." />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
          <QuickActionCard
            title="Lesson Plan"
            icon={BookOpen}
            href="/lesson-plan"
            color=""
            description="NCERT-aligned plans."
          />
          <QuickActionCard
            title="Quiz Generator"
            icon={BrainCircuit}
            href="/quiz-generator"
            color=""
            description="Instant quizzes & worksheets."
          />
          <QuickActionCard
            title="Exam Paper"
            icon={FileText}
            href="/exam-paper"
            color=""
            description="Board-aligned papers."
          />
          <QuickActionCard
            title="Worksheet Wizard"
            icon={ClipboardList}
            href="/worksheet-wizard"
            color=""
            description="Practice worksheets."
          />
          <QuickActionCard
            title="Visual Aid"
            icon={Image}
            href="/visual-aid-designer"
            color=""
            description="Diagrams & illustrations."
          />
          <QuickActionCard
            title="Content Creator"
            icon={PenTool}
            href="/content-creator"
            color=""
            description="Stories & visual aids."
          />
          <QuickActionCard
            title="Instant Answer"
            icon={Lightbulb}
            href="/instant-answer"
            color=""
            description="Quick answers to questions."
          />
          <QuickActionCard
            title="Teacher Training"
            icon={GraduationCap}
            href="/teacher-training"
            color=""
            description="Professional development."
          />
        </div>
      )}

      {/* Profile Completion Card — shown after 5+ generations, max 3 times */}
      {showProfileCompletion && (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ProfileCompletionCard onComplete={() => advancePhase('done')} onDismiss={dismissProfileCard} />
        </div>
      )}

      {/* Community Nudge Banner — appears after 3rd AI generation */}
      {showNudge && (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CommunityNudgeBanner onDismiss={dismissNudge} onExplore={markVisited} />
        </div>
      )}

      {/* Onboarding Checklist — floating bottom-right for new users, dismissible, auto-hides after 7 days */}
      {showNewUserHome && !checklistDismissed && isFirstWeek && (
        <OnboardingChecklist items={checklistItems} onDismiss={dismissChecklist} />
      )}
    </div>
  );
}