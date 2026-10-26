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
import { MicrophoneInput } from "@/components/microphone-input";
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
import { VidyaPresence } from "@/components/vidya/vidya-presence";
import { useVidyaLiveSession } from "@/components/vidya/vidya-live-provider";
import { vidyaStatusKey } from "@/lib/vidya-live/use-vidya-live";

// Quiet conversation starters under VIDYA. Spoken into the live session.
const VOICE_STARTERS = [
  "Plan a lesson for Class 8 science",
  "Make a quiz on fractions",
  "Ideas to engage a large class",
] as const;
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
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
  const router = useRouter();

  const showNewUserHome = isNewUser && generationCount < 5;
  const teacherName = profileSummary?.displayName?.split(' ')[0] || "Teacher";

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

  // ── VIDYA live voice (the app-wide session from VidyaLiveProvider) ──
  const live = useVidyaLiveSession();
  const pendingSayRef = useRef<string | null>(null);

  // A starter/typed line tapped before the session is live is queued and
  // spoken into the session the moment it is ready.
  const liveState = live?.state;
  const liveSend = live?.sendText;
  useEffect(() => {
    if (liveState === "listening" && pendingSayRef.current && liveSend) {
      const text = pendingSayRef.current;
      pendingSayRef.current = null;
      liveSend(text);
    }
  }, [liveState, liveSend]);

  const sayToVidya = (text: string) => {
    if (!live) return;
    if (live.sendText(text)) return;
    pendingSayRef.current = text;
    if (!live.active) void live.start();
  };

  const onTypedSubmit = (values: FormValues) => {
    const text = values.topic?.trim();
    if (!text) return;
    if (live && live.state !== "error") {
      form.setValue("topic", "");
      sayToVidya(text);
      return;
    }
    // Voice unavailable (flag off / error) → the existing Genkit text path.
    void onSubmit(values);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[80vh] w-full container-wide pt-6 pb-8 md:pt-10 md:pb-12 gap-10 md:gap-12 relative">
      {/* ── VIDYA WORKSPACE ────────────────────────────────────────────
          Assistant-first: the greeting, then VIDYA herself as the primary
          control. One tap opens a continuous real voice session (ADK /
          Gemini Live via the app-wide VidyaLiveProvider — the same session
          the compact VIDYA on tool pages shows). Typing is a quiet fallback. */}
      <section className="w-full max-w-3xl flex flex-col items-center text-center animate-in fade-in duration-medium" aria-label={t("Talk to VIDYA")}>
        <h1 className="font-headline text-2xl md:text-4xl font-semibold text-foreground tracking-tight indic-text leading-[1.2]">
          {greeting}, <span className="text-primary">{teacherName}.</span>
        </h1>

        {live ? (
          <>
            {/* Block wrapper: the section centres its children (items-center),
                which would shrink-wrap VIDYA's full-width stage to nothing. */}
            <div className="w-full">
            <FeatureSpotlight
              id={SPOTLIGHT_IDS.HOME_VOICE_INPUT}
              message={t("Tap VIDYA once and just talk — in any language.")}
              seenSpotlights={spotlightsSeen}
              onDismiss={markSpotlightSeen}
              position="bottom"
            >
              <VidyaPresence
                size="workspace"
                state={live.state}
                getLevel={live.getLevel}
                onActivate={live.error ? () => { live.dismissError(); void live.start(); } : live.toggle}
                label={live.active ? t("End voice conversation") : t("Talk to VIDYA")}
                className="mx-auto -mt-2 md:-mt-4"
              />
            </FeatureSpotlight>
            </div>

            <div
              role="status"
              aria-live="polite"
              data-state={live.state}
              data-testid="vidya-home-status"
              className="vidya-status -mt-4 inline-flex items-center gap-2.5 rounded-full border border-saffron-200/80 bg-card/90 px-5 py-2 text-[14px] font-medium text-foreground shadow-soft"
            >
              <span aria-hidden className="vidya-status-dot" />
              <span className="indic-text">{live.error ? t(live.error) : t(vidyaStatusKey(live.state, live.hasAnswered))}</span>
              {live.active && (
                <button
                  type="button"
                  onClick={live.stop}
                  className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  data-testid="vidya-home-end"
                >
                  <X className="h-3 w-3" /> {t("End")}
                </button>
              )}
            </div>

            {/* Live caption — read-only, never needs submitting */}
            <p className="mt-3 min-h-[1.5rem] max-w-[46ch] text-sm leading-relaxed text-muted-foreground indic-text" data-testid="vidya-home-caption">
              {live.caption && live.active ? live.caption.text.slice(-160) : ""}
            </p>

            {/* A few quiet starters — spoken into the same session */}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {VOICE_STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sayToVidya(t(s))}
                  className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground indic-text"
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-4">
            <MicrophoneInput onTranscriptChange={handleTranscript} iconSize="xl" label={t("Speak your topic")} />
          </div>
        )}

        {/* Typed fallback — deliberately secondary */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onTypedSubmit)} className="mt-6 flex w-full max-w-xl items-center gap-2 rounded-full border border-border/80 bg-card/70 py-1 pl-4 pr-1 transition-shadow focus-within:border-primary/40 focus-within:shadow-soft">
            <div className="relative flex-1">
              <AutoCompleteInput
                placeholder={t("Or type to VIDYA…")}
                {...form.register("topic")}
                value={form.watch("topic")}
                selectedLanguage={userLanguage || "English"}
                onSuggestionClick={(value) => {
                  form.setValue("topic", value);
                  form.handleSubmit(onTypedSubmit)();
                }}
                className="border-none bg-transparent py-2 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
              aria-label={t("Send to VIDYA")}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </Form>

        {/* Text-path result (Genkit intent router) — only when voice is off/unavailable */}
        {isThinking && (
          <p className="mt-4 text-sm font-medium text-primary">{t("Thinking")}…</p>
        )}
        {answer && (
          <SectionCard
            className="w-full max-w-2xl mt-4 border-l-4 border-l-primary shadow-elevated animate-in fade-in slide-in-from-bottom-2 relative text-left"
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
              <h3 className="text-primary font-bold mb-2 text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" />{t("Answer")}</h3>
              <div className="whitespace-pre-wrap">{answer}</div>
              <p className="text-xs text-muted-foreground mt-3 not-prose">
                {t("Sahayak can make mistakes. Please review generated content.")}
              </p>
            </div>
          </SectionCard>
        )}
      </section>

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
