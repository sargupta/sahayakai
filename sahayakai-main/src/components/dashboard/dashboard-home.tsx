"use client";

/**
 * Dashboard home — redesigned per docs/design/proposals 01 (UX) + 04 (taste).
 *
 * Hierarchy (one dominant action, per proposal 04 "quiet craft"):
 *   1. PRIMARY   — voice mic + topic input feeding the intent router. The
 *                  entry point of the lesson-prep loop (plan → worksheet →
 *                  quiz/exam/rubric → export/share).
 *   2. RECENTS   — "Continue where you left off" strip (read-only over the
 *                  library API); hidden when empty or signed out.
 *   3. SECONDARY — the six prep-loop tools as one compact row of quiet
 *                  chip-links (NOT a grid of equal tinted-icon cards).
 *   4. TERTIARY  — Labs as a single muted text link.
 *
 * Banned patterns intentionally absent (proposal 04 §3): centered badge pill,
 * N-equal-cards grid, tinted-circle icon walls, unanchored accent ruler,
 * left-accent border on every card, hardcoded English strings.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MicrophoneInput, type MicStatus } from "@/components/microphone-input";
import { greetingFirstName } from "@/lib/teacher-name";
import { VidyaSphere, type VidyaOrbState } from "@/components/vidya/vidya-sphere";
import { useVidyaLiveSession, VIDYA_LIVE_VOICE_ENABLED } from "@/components/vidya/vidya-live-provider";
import { vidyaStatusKey } from "@/lib/vidya-live/use-vidya-live";
import { deriveOrbState } from "@/components/vidya/orb-state";
import { usePrefersReducedMotion, useVidyaSpeaking } from "@/components/vidya/use-vidya-signals";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, BrainCircuit, ClipboardCheck, ClipboardList, FileText, FlaskConical, Lightbulb, ArrowRight, X, RefreshCw, type LucideIcon } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { SectionCard } from "@/components/layout";
import { SampleOutputSection } from "@/components/landing/sample-output-section";
import { useCommunityIntro } from "@/hooks/use-community-intro";
import { CommunityNudgeBanner } from "@/components/community/community-nudge-banner";
import { DemoInteraction } from "@/components/landing/demo-interaction";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { ProfileCompletionCard } from "@/components/onboarding/profile-completion-card";
import { FeatureSpotlight, SPOTLIGHT_IDS } from "@/components/onboarding/feature-spotlight";
import { RecentWorkStrip } from "@/components/dashboard/recent-work-strip";
import type { ContextualSuggestion } from "@/lib/contextual-suggestions";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * The founder-ratified prep loop, in loop order. i18n keys are the existing
 * dictionary entries — no copy change, only the presentation shrinks from
 * nine equal cards to one compact row.
 */
const PREP_TOOLS: ReadonlyArray<{ labelKey: string; href: string; icon: LucideIcon }> = [
  { labelKey: "Lesson Plan", href: "/lesson-plan", icon: BookOpen },
  { labelKey: "Worksheet Wizard", href: "/worksheet-wizard", icon: ClipboardList },
  { labelKey: "Quiz Generator", href: "/quiz-generator", icon: BrainCircuit },
  { labelKey: "Exam Paper", href: "/exam-paper", icon: FileText },
  { labelKey: "Rubric Generator", href: "/rubric-generator", icon: ClipboardCheck },
  { labelKey: "Instant Answer", href: "/instant-answer", icon: Lightbulb },
];

const SuggestionCard = ({ suggestion, startLabel }: { suggestion: ContextualSuggestion; startLabel: string }) => {
  const { t } = useLanguage();
  return (
    <Link href={suggestion.toolHref} className="group">
      <Card className="h-full rounded-surface-md border border-border shadow-soft hover:border-primary/50 hover:shadow-elevated transition-all duration-micro ease-out-quart overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-2">
          <span className="type-caption text-primary/70">{t(suggestion.toolLabel)}</span>
          <h3 className="font-headline text-sm font-semibold text-foreground leading-tight">{suggestion.topic}</h3>
          <p className="text-xs text-muted-foreground">{suggestion.subject ? t(suggestion.subject) : suggestion.subject} &middot; {suggestion.gradeLevel ? t(suggestion.gradeLevel) : suggestion.gradeLevel}</p>
          <div className="mt-auto pt-2 text-primary font-medium text-xs flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {startLabel} <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

/** Compact prep-loop row + quiet Labs link — the secondary/tertiary tiers. */
const PrepToolsRow = () => {
  const { t } = useLanguage();
  return (
    <nav className="w-full max-w-2xl" aria-label={t("Prep tools")}>
      <h2 className="type-caption text-muted-foreground mb-3">{t("Prep tools")}</h2>
      <div className="flex flex-wrap gap-2">
        {PREP_TOOLS.map(({ labelKey, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 rounded-surface-sm border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-soft hover:border-primary/50 hover:text-primary transition-colors duration-micro ease-out-quart indic-text"
          >
            <Icon className="h-4 w-4 text-ink-500 dark:text-muted-foreground" aria-hidden="true" />
            {t(labelKey)}
          </Link>
        ))}
      </div>
      <div className="mt-3">
        <Link
          href="/labs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Explore Labs")}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
};

export function DashboardHome() {
  const { requireAuth, openAuthModal, user } = useAuth();
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
  // The home mic's 3D VIDYA orb shows real state only: the mic's status, the answer
  // being fetched (isThinking) and VIDYA's voice playing.
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [orbFailed, setOrbFailed] = useState(false);
  useEffect(() => {
    if (!orbFailed) return;
    const id = setTimeout(() => setOrbFailed(false), 4000);
    return () => clearTimeout(id);
  }, [orbFailed]);
  const vidyaSpeaking = useVidyaSpeaking();
  const reducedMotion = usePrefersReducedMotion();
  const orbState = deriveOrbState({ failed: orbFailed, micStatus, speaking: vidyaSpeaking, awaitingReply: isThinking });
  // Hands-free Live session (null when the flag is off or outside the app shell).
  const liveSession = useVidyaLiveSession();
  const live = VIDYA_LIVE_VOICE_ENABLED ? liveSession : null;
  const liveOrbState: VidyaOrbState = !live ? orbState
    : live.state === "error" ? "error"
    : live.state === "listening" || live.state === "interrupted" ? "listening"
    : live.state === "speaking" ? "speaking"
    : live.state === "connecting" || live.state === "thinking" ? "thinking"
    : "idle";
  const [answer, setAnswer] = useState<string | null>(null);
  const router = useRouter();

  const showNewUserHome = isNewUser && generationCount < 5;
  // The saved profile name, else the sign-in account's (as the sidebar shows it).
  const teacherName = greetingFirstName(profileSummary?.displayName, user?.displayName) ?? t("Teacher");

  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
    },
  });

  // Guards the URL voice_transcript auto-submit so it fires at most once,
  // even when the greeting effect re-runs on a language change.
  const voiceHandledRef = useRef(false);

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
        // Send the current UI language (as an ISO code, the agent/route
        // contract) so the assistant answers in the teacher's chosen
        // language even when the spoken/typed prompt is in another script.
        body: JSON.stringify({
          prompt: values.topic,
          language: LANGUAGE_TO_ISO[userLanguage] ?? "en",
          uiLanguage: LANGUAGE_TO_ISO[userLanguage] ?? "en",
        })
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
          title: t("Not sure how to help"),
          description: result?.error || t("Please try asking to create a lesson plan, quiz, or visual aid."),
          variant: "destructive"
        });
        setIsThinking(false);
      }
    } catch (error) {
      console.error("Router Error:", error);
      toast({
        title: t("Connection Error"),
        description: t("Could not reach Sahayak. Please try again."),
        variant: "destructive"
      });
      setIsThinking(false);
      setOrbFailed(true);
    }
  };

  useEffect(() => {
    // Client-side only logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting(t("Good Morning"));
    else if (hour < 18) setGreeting(t("Good Afternoon"));
    else setGreeting(t("Good Evening"));

    // Handle voice transcript from URL — fire at most ONCE. `t` is in the deps
    // (so the greeting re-localizes on language change), but a language switch
    // must NOT re-trigger the auto-submit (which would double-generate + double
    // cost). The ref guard makes the submit idempotent across effect re-runs.
    if (typeof window !== 'undefined' && !voiceHandledRef.current) {
      const params = new URLSearchParams(window.location.search);
      const voiceTranscript = params.get("voice_transcript");

      if (voiceTranscript) {
        voiceHandledRef.current = true;
        form.setValue("topic", voiceTranscript);
        form.handleSubmit(onSubmit)();
      } else {
        // Check for voice transcript stored by GlobalVoiceInterface for
        // unauthenticated visitors who signed in after speaking.
        try {
          const storedTranscript = sessionStorage.getItem("sahayakai-voice-intent");
          if (storedTranscript) {
            sessionStorage.removeItem("sahayakai-voice-intent");
            voiceHandledRef.current = true;
            form.setValue("topic", storedTranscript);
            form.handleSubmit(onSubmit)();
          }
        } catch {
          // ignore storage errors
        }
      }
    }
  }, [form, t]);

  const handleTranscript = (transcript: string, _language?: string) => {
    form.setValue("topic", transcript);
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[80vh] w-full container-wide py-8 md:py-12 gap-8 md:gap-10 relative">
      {/* Greeting — restrained scale so the input, not the headline, dominates */}
      <div className="text-center space-y-3 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-medium">
        <h1 className="font-headline text-3xl md:text-5xl font-bold text-foreground tracking-tight indic-text leading-[1.15]">
          {greeting}, <span className="text-saffron-600 dark:text-primary">{teacherName}.</span>
        </h1>
        {showNewUserHome && suggestions.length > 0 ? (
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4 indic-text">
            {t("Ideas for your classes")}
          </p>
        ) : (
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4 indic-text">
            {t("I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.")}
          </p>
        )}
      </div>

      {/* PRIMARY — voice-first input, the prep loop's entry point */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-medium delay-75 z-10 flex flex-col items-center gap-8">

        {/* BIG MIC BUTTON */}
        <FeatureSpotlight
          id={SPOTLIGHT_IDS.HOME_VOICE_INPUT}
          message={t("Tap the mic and speak in any language. SahayakAI understands Hindi, Kannada, Tamil and more!")}
          seenSpotlights={spotlightsSeen}
          onDismiss={markSpotlightSeen}
          position="bottom"
        >
          {/* data-vidya-entry: the sidebar's "Talk to VIDYA" presses this mic on Home. */}
          {live ? (
            // Hands-free VIDYA (Gemini Live via the voice sidecar): one tap opens a
            // continuous voice-to-voice session — server-side voice detection, so
            // she answers the speaker, not the room. Same session as the compact
            // orb on tool pages (VidyaLiveProvider); tap again to end.
            <div className="flex flex-col items-center gap-3" data-vidya-entry="home" data-vidya-state={liveOrbState}>
              <button
                type="button"
                onClick={live.error ? () => { live.dismissError(); void live.start(); } : live.toggle}
                aria-label={live.active ? t("End voice conversation") : t("Talk to VIDYA")}
                aria-pressed={live.active}
                data-microphone="true"
                data-testid="vidya-home-live"
                // relative: VidyaSphere fills its nearest positioned box (absolute inset-0).
                className="focus-ring relative h-40 w-40 shrink-0 rounded-pill md:h-52 md:w-52"
              >
                <VidyaSphere state={liveOrbState} reducedMotion={reducedMotion} />
              </button>
              <div role="status" aria-live="polite" data-state={live.state} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <span className="indic-text">{live.error ? t(live.error) : t(vidyaStatusKey(live.state, live.hasAnswered))}</span>
                {live.active && (
                  <button type="button" onClick={live.stop} className="focus-ring inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium hover:bg-muted hover:text-foreground">
                    <X className="h-3 w-3" aria-hidden="true" /> {t("End")}
                  </button>
                )}
              </div>
              <p className="min-h-6 max-w-prose text-center text-sm text-muted-foreground indic-text" data-testid="vidya-home-caption">
                {live.active && live.caption ? live.caption.text.slice(-160) : ""}
              </p>
            </div>
          ) : (
          <div className="flex flex-col items-center gap-4" data-vidya-entry="home" data-vidya-state={orbState}>
            <MicrophoneInput
              onTranscriptChange={handleTranscript}
              onStatusChange={setMicStatus}
              renderVisual={() => <VidyaSphere state={orbState} reducedMotion={reducedMotion} />}
              iconSize="xl"
              label={t("Speak your topic")}
              className=""
            />
            <p className="text-muted-foreground text-sm md:text-sm">
              {t("Tap the microphone and tell Sahayak what you want to teach today")}
            </p>
          </div>
          )}
        </FeatureSpotlight>

        {/* OR TEXT INPUT (SECONDARY) */}
        {/* Composer (chat): a surface-disc pill with a border-glass edge; focus gives a
            2px saffron-500 edge and shadow-current; the send disc is saffron-500 (VIDYA's colour, on request), white glyph. */}
        <div className="w-full max-w-xl">
          <div className="rounded-pill border border-line-glass bg-surface-disc py-1.5 pl-[18px] pr-2 shadow-float backdrop-blur-sm transition-shadow duration-micro ease-out-quart focus-within:shadow-current focus-within:ring-2 focus-within:ring-saffron-500">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <AutoCompleteInput
                    placeholder={t("Type a topic, e.g. 'Photosynthesis for Class 8'")}
                    {...form.register("topic")}
                    value={form.watch("topic")}
                    selectedLanguage={userLanguage || "English"}
                    onSuggestionClick={(value) => {
                      form.setValue("topic", value);
                      form.handleSubmit(onSubmit)();
                    }}
                    inputClassName="h-[38px] rounded-none border-0 bg-transparent px-0 py-0 text-sm text-ink-900 shadow-none backdrop-blur-none placeholder:text-ink-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                {/* A plain button: the shadcn Button's rounded-md and forced 16px svg
                    survive tailwind-merge and spoil the disc. */}
                <button
                  type="submit"
                  disabled={isThinking}
                  className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-saffron-500 text-white shadow-mic transition-colors duration-micro hover:bg-saffron-600 active:scale-95 disabled:pointer-events-none disabled:opacity-[.55]"
                  aria-label={t("Generate Lesson Plan")}
                >
                  <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </form>
            </Form>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-xs text-muted-foreground px-4 indic-text">
            {t("try: \"Quiz about photosynthesis\" or \"Lesson plan for solar system\"")}
          </p>
          <p className="text-xs text-muted-foreground indic-text leading-relaxed text-center px-4">
            {t("Works in Hindi, Kannada, Tamil + 8 more languages")}
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

          {/* Instant Answer — uses SectionCard for consistent surface treatment */}
          {answer && (
            <SectionCard
              className="w-full max-w-2xl mt-4 border-l-4 border-l-primary shadow-elevated animate-in fade-in slide-in-from-bottom-2 relative"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setAnswer(null)}
                  aria-label={t("Close answer")}
                >
                  <X className="h-4 w-4" />
                </Button>
              }
            >
              <div className="prose prose-sm max-w-none text-foreground">
                <h3 className="text-saffron-600 dark:text-primary font-bold mb-2 text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" />{t("Answer")}</h3>
                <div className="whitespace-pre-wrap">{answer}</div>
                <p className="text-xs text-muted-foreground mt-3 not-prose">
                  {t("Sahayak can make mistakes. Please review generated content.")}
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* RECENTS — "continue where you left off"; renders nothing when empty */}
      <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-medium delay-100">
        <RecentWorkStrip />
      </div>

      {/* Daily inspiration — personalized suggestions for new users */}
      {showNewUserHome && suggestions.length > 0 && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-medium delay-150 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {suggestions.map(s => (
              <SuggestionCard key={s.id} suggestion={s} startLabel={t("Start")} />
            ))}
          </div>
          <div className="flex items-center justify-center">
            <button
              onClick={refreshSuggestions}
              className="text-sm text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> {t("Show different ideas")}
            </button>
          </div>
        </div>
      )}

      {/* SECONDARY + TERTIARY — the prep loop as one compact row, Labs quiet */}
      <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-medium delay-150">
        <PrepToolsRow />
      </div>

      {/* Sample Output -- hidden for new users who see personalized suggestions. */}
      {!showNewUserHome && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-medium delay-150 flex justify-center">
          <SampleOutputSection />
        </div>
      )}

      {/* Demo Interaction -- hidden for new users */}
      {!showNewUserHome && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-medium delay-150">
          <DemoInteraction />
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
