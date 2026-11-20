
"use client";

import { Suspense, useRef } from "react";

import type { TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, GraduationCap, Lightbulb, Mic } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { TeacherTrainingDisplay } from "@/components/teacher-training-display";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { InlineMicButton } from "@/components/layout";
import { AuthGate } from "@/components/auth/auth-gate";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { saveToLibrary } from "@/lib/api/content";
import { Save, History, MessageCircleQuestion } from "lucide-react";
// Removed (audit 2026-04-27): VoiceAssistant import. The global OmniOrb
// (mounted in app-shell) already provides voice + chat for every page.
// Mounting both here created the "two voice surfaces" UX bug.
import { useJarvisStore } from "@/store/jarvisStore";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useVidyaCapability, useVidyaScreenContext } from "@/hooks/use-vidya-app-context";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { normaliseVidyaLanguage } from "@/lib/vidya-action-normalizer";
import { cn } from "@/lib/utils";
import { GeneratorHeader, GeneratorProgress, GeneratorSection, GeneratorSubmitBar, GENERATOR_SUBMIT_CLASS } from "@/features/generator";


const formSchema = z.object({
  question: z.string().min(10, { message: "Question must be at least 10 characters." }),
  language: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;


const descriptionTranslations: Record<string, [string, string]> = {
  en: [
    "Your personal AI coach, providing advice grounded in sound pedagogical principles.",
    "Ask for techniques, classroom strategies, or motivation."
  ],
  hi: [
    "आपका व्यक्तिगत AI कोच, जो ठोस शैक्षणिक सिद्धांतों पर आधारित सलाह प्रदान करता है।",
    "तकनीक, कक्षा रणनीतियों, या प्रेरणा के लिए पूछें।"
  ],
  bn: [
    "আপনার ব্যক্তিগত এআই কোচ, যা শিক্ষাগত নীতির উপর ভিত্তি করে পরামর্শ প্রদান করে।",
    "কৌশল, শ্রেণীকক্ষের কৌশল বা অনুপ্রেরণার জন্য জিজ্ঞাসা করুন।"
  ],
  te: [
    "మీ వ్యక్తిగత AI కోచ్, ధృడమైన బోధనా సూత్రాలపై ఆధారపడిన సలహాలను అందిస్తుంది.",
    "పద్ధతులు, తరగతి గది వ్యూహాలు లేదా ప్రేరణ కోసం అడగండి."
  ],
  mr: [
    "तुमचे वैयक्तिक AI प्रशिक्षक, जे योग्य शैक्षणिक तत्त्वांवर आधारित सल्ला देतात.",
    "तंत्र, वर्गातील रणनीती किंवा प्रेरणेसाठी विचारा."
  ],
  ta: [
    "உங்கள் தனிப்பட்ட AI பயிற்சியாளர், கல்விசார் கொள்கைகளின் அடிப்படையில் ஆலோசனைகளை வழங்குகிறார்.",
    "நுட்பங்கள், வகுப்பறை உத்திகள் அல்லது உந்துதலுக்காகக் கேளுங்கள்."
  ],
  gu: [
    "તમારા અંગત AI કોચ, જે શિક્ષણશાસ્ત્રના સિદ્ધાંતો પર આધારિત સલાહ પૂરી પાડે છે.",
    "તકનીકો, વર્ગખંડની વ્યૂહરચનાઓ અથવા પ્રેરણા માટે પૂછો."
  ],
  kn: [
    "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಎಐ ತರಬೇತುದಾರ, ಶಿಕ್ಷಣಾತ್ಮಕ ತತ್ವಗಳ ಮೇಲೆ ಆಧಾರಿತವಾದ ಸಲಹೆಯನ್ನು ನೀಡುತ್ತದೆ.",
    "ತಂತ್ರಗಳು, ತರಗತಿಯ ತಂತ್ರಗಳು, ಅಥವಾ ಪ್ರೇರಣೆಗಾಗಿ ಕೇಳಿ."
  ],
};

const placeholderTranslations: Record<string, string> = {
  en: "e.g., 'How can I get my students to be quiet without shouting?'",
  hi: "उदा., 'मैं अपने छात्रों को बिना चिल्लाए शांत कैसे करा सकता हूँ?'",
  bn: "উদা., 'চিৎকার না করে আমি কীভাবে আমার ছাত্রদের চুপ করাতে পারি?'",
  te: "ఉదా., 'అరవకుండా నా విద్యార్థులను నిశ్శబ్దంగా ఉండేలా చేయడం ఎలా?'",
  mr: "उदा., 'मी माझ्या विद्यार्थ्यांना न ओरडता शांत कसे करू शकेन?'",
  ta: "உதா., 'கத்தாமல் என் மாணவர்களை அமைதியாக இருக்க வைப்பது எப்படி?'",
  gu: "દા.ત., 'હું મારા વિદ્યાર્થીઓને બૂમો પાડ્યા વગર શાંત કેવી રીતે કરી શકું?'",
  kn: "ಉದಾ., 'ನನ್ನ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಕೂಗದೆ ಸುಮ್ಮನಿರಿಸುವುದು ಹೇಗೆ?'",
};

// UX audit #5: rotate through 4 useful pro tips so the sidebar tip
// isn't static across visits. Index advances daily based on date so
// the same tip stays for a session but changes day-to-day.
const PRO_TIP_KEYS = [
  "Be specific about your students' age group and the context (e.g., \"Class 5 students in a rural school\").",
  "Mention what you have already tried — VIDYA can suggest the next step instead of repeating the basics.",
  "Ask follow-up questions. Each answer can be refined: \"That worked, but what about students who still don't engage?\"",
  "Share what subject or chapter you are teaching — advice is sharper when the context is concrete.",
] as const;

function TeacherTrainingContent() {
  const [advice, setAdvice] = useState<TeacherTrainingOutput | null>(null);
  // Library id of the shown advice (minted per generation / restored id);
  // both Save buttons upsert it, so one generation = one Library row.
  const [adviceContentId, setAdviceContentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);
  const [savedToLib, setSavedToLib] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language: uiLanguage } = useLanguage();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const { clearFormSnapshot, teacherProfile } = useJarvisStore();
  const proTipKey = PRO_TIP_KEYS[new Date().getDate() % PRO_TIP_KEYS.length];

  // UX audit #13: load last question on mount so teacher can pick up
  // where they left off. Only show if it's recent (within 7 days).
  // Cross-language guard (2026-05-27): only restore if the saved question
  // was typed in the same UI language as the current session, otherwise
  // a Hindi-typed question bleeds into Bengali UI and renders mixed scripts.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tt-last-question");
      if (!raw) return;
      const { q, ts, uiLang } = JSON.parse(raw);
      const ageMs = Date.now() - (ts ?? 0);
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const sameLang = (uiLang ?? 'English') === uiLanguage;
      if (q && typeof q === "string" && ageMs < SEVEN_DAYS && sameLang) {
        setLastQuestion(q);
      }
    } catch {
      // ignore parse errors / localStorage unavailable
    }
  }, [uiLanguage]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: LANGUAGE_TO_ISO[uiLanguage] ?? "en",
      subject: "General",
    },
  });

  // ── VIDYA Form Sync (no gradeLevel on this page) ──────────────────────────
  const watchedQuestion = form.watch("question");
  const watchedSubject  = form.watch("subject");
  const watchedLang     = form.watch("language");
  const savedSnapshot   = useVidyaFormSync("teacher-training", {
    question: watchedQuestion,
    subject: watchedSubject,
    language: watchedLang,
  });

  const selectedLanguage = form.watch("language") || 'en';
  // UI chrome (tagline, placeholder) follows the global UI language, NOT the
  // AI-output language form field. Without this, switching the app to Bengali
  // leaves the chrome English until a hard refresh re-initialises the form.
  const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] || 'en';
  const descriptionLines = descriptionTranslations[uiLangCode] || descriptionTranslations.en;
  const placeholder = placeholderTranslations[uiLangCode] || placeholderTranslations.en;
  const searchParams = useSearchParams();

  // Restore snapshot on mount — only when no URL params are present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const questionParam = searchParams.get("question") || searchParams.get("topic");
    if (questionParam || !savedSnapshot) return;
    if (savedSnapshot.question) form.setValue("question", savedSnapshot.question);
    if (savedSnapshot.subject)  form.setValue("subject",  savedSnapshot.subject);
    if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
  }, []); // runs once on mount only

  useEffect(() => {
    const id = searchParams.get("id");
    const questionParam = searchParams.get("question") || searchParams.get("topic");

    if (id) {
      // ── Library: load saved teacher-training advice by id ─────────────
      const fetchSaved = async () => {
        setIsLoading(true);
        try {
          const token = await auth.currentUser?.getIdToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch(`/api/content/get?id=${id}`, { headers });
          if (res.ok) {
            const content = await res.json();
            if (content.topic) form.setValue("question", content.topic);
            if (content.language) form.setValue("language", content.language);
            if (content.subject) form.setValue("subject", content.subject);
            if (content.data) {
              setAdvice(content.data as TeacherTrainingOutput);
              setAdviceContentId(id);
            }
          }
        } catch (err) {
          console.error("Failed to load saved teacher training:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSaved();
    } else if (questionParam) {
      // ── VIDYA Action: Pre-fill all fields from URL params ──────────────
      // NCERT-demo 2026-05-19 pattern (see use-lesson-plan.ts):
      //   - SET_OPTS forces controlled selectors to re-render with the
      //     incoming value before the 300ms auto-submit fires.
      //   - VIDYA emits language in display-name form; normalise to ISO.
      // (No gradeLevel on this form.)
      const subjectParam = searchParams.get("subject");
      const languageParam = searchParams.get("language");

      const SET_OPTS = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

      form.setValue("question", questionParam, SET_OPTS);
      if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
      const normalisedLang = normaliseVidyaLanguage(languageParam);
      if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
      // ───────────────────────────────────────────────────────────────────
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 300);
    }
  }, [searchParams, form]);

  const { requireAuth, openAuthModal } = useAuth();
  const submittingRef = useRef(false);
  const onSubmit = async (values: FormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!requireAuth()) { submittingRef.current = false; return; }
    setIsLoading(true);
    setAdvice(null);
    setAdviceContentId(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
      // ALWAYS send a non-empty `language`; strip the "General" subject
      // placeholder so the model isn't misled by a meaningless default.
      const submittedLanguage = values.language && values.language.trim()
        ? values.language
        : 'en';
      const submittedSubject = values.subject && values.subject !== 'General'
        ? values.subject
        : undefined;

      const submitContentId = crypto.randomUUID();
      const res = await fetch("/api/ai/teacher-training", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          contentId: submitContentId,
          question: values.question,
          language: submittedLanguage,
          subject: submittedSubject,
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to get advice");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get advice");
      }

      const result = await res.json();
      setAdvice(result);
      setAdviceContentId(submitContentId);
      clearFormSnapshot("teacher-training");
      // UX audit #13: persist last question so a returning teacher can
      // pick up where they left off. Stored client-side only — no PII
      // crosses to the server beyond the existing API call.
      try {
        localStorage.setItem(
          "tt-last-question",
          JSON.stringify({ q: values.question, ts: Date.now(), uiLang: uiLanguage }),
        );
      } catch {
        // localStorage may be unavailable (private mode, restricted webview)
      }
    } catch (error) {
      console.error("Failed to get advice:", error);
      toast({
        title: t("Failed to Get Advice"),
        description: t("There was an error getting advice. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const handleTranscript = (transcript: string, language?: string) => {
    form.setValue("question", transcript);
    if (language) {
      form.setValue("language", language);
    }
    form.trigger("question");
    setTimeout(() => {
      form.handleSubmit(onSubmit)();
    }, 100);
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("question", prompt);
    form.trigger("question");
  };

  const handleResumeLast = () => {
    if (!lastQuestion) return;
    form.setValue("question", lastQuestion);
    form.trigger("question");
    setLastQuestion(null); // hide the pill once used
  };

  const handleSaveToLibrary = async () => {
    if (!advice || !auth.currentUser) return;
    setSavingToLib(true);
    try {
      const title = form.getValues("question").slice(0, 80);
      // Same id the generation was filed under → updates that row, never a
      // second copy (this button and the display's Save share it).
      const result = await saveToLibrary(
        auth.currentUser.uid,
        "teacher-training",
        title,
        advice,
        adviceContentId,
      );
      if (result.success) {
        setSavedToLib(true);
        toast({ title: t("Saved to your library") });
      } else {
        throw new Error(result.error || "Save failed");
      }
    } catch (err: any) {
      toast({
        title: t("Could not save"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setSavingToLib(false);
    }
  };

  // VIDYA: what the teacher asked and the coaching on screen, so she can talk it
  // through ("explain the second strategy", "how would that work in Class 3?").
  // Only what the teacher already sees; strings are bounded by the contract.
  useVidyaScreenContext("teacher-training", {
    generatorTool: "teacher-training",
    generationStatus: isLoading ? "generating" : advice ? "done" : "idle",
    hasResult: advice !== null,
    savedToLibrary: savedToLib,
    currentQuestion: (watchedQuestion || "").trim() || null,
    adviceStrategies: advice ? advice.advice.map((a) => a.strategy) : [],
    advicePedagogies: advice ? advice.advice.map((a) => a.pedagogy) : [],
  });
  // The same handlers the buttons use; both create or update a My Library row,
  // so VIDYA asks the teacher to confirm before running them.
  useVidyaCapability("teacher-training.ask", ({ question }) => {
    const q = (question || form.getValues("question") || "").trim();
    if (!q) return;
    form.setValue("question", q, { shouldValidate: true });
    void form.handleSubmit(onSubmit)();
  }, { enabled: !isLoading });
  useVidyaCapability("teacher-training.save", handleSaveToLibrary, {
    enabled: advice !== null && !savedToLib && !savingToLib,
  });

  return (
    <div className="container-wide space-y-8 py-6 md:py-10">
      <GeneratorHeader
        icon={GraduationCap}
        eyebrow={t("Class")}
        title={t("AI Coach")}
        description={
          <>
            <span>{descriptionLines[0]}</span>{" "}
            <span className="hidden sm:inline">{descriptionLines[1]}</span>
          </>
        }
      />

      <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="card-accent-bar" />
        <div className="p-4 sm:p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">

                {/* ── The question ───────────────────────────────────── */}
                <div className="space-y-6 xl:col-span-7">
                  {/* UX audit #13: previous question affordance — appears
                      only if a question was asked in the last 7 days. */}
                  {lastQuestion && (
                    <button
                      type="button"
                      onClick={handleResumeLast}
                      className="focus-ring flex w-full items-start gap-3 rounded-row border border-primary/20 bg-tint-accent-soft p-4 text-left transition-colors duration-micro ease-out-quart hover:border-primary/40"
                    >
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="type-eyebrow text-saffron-700 indic-text">{t("Continue your last question")}</p>
                        <p className="mt-1 line-clamp-1 text-sm text-foreground">{lastQuestion}</p>
                      </div>
                    </button>
                  )}

                  <GeneratorSection step={1} title={t("Your Question or Challenge")}>
                    <FormField
                      control={form.control}
                      name="question"
                      render={({ field }) => {
                        const charCount = (field.value || "").length;
                        const minChars = 10;
                        const isValid = charCount >= minChars;
                        return (
                          <FormItem>
                            <FormLabel className="sr-only">{t("Your Question or Challenge")}</FormLabel>
                            <FormControl>
                              {/* Mic anchored INSIDE the textarea wrapper at top-right
                                  — fixes UX audit bug #4 (orphaned position).
                                  Appends transcript to whatever the teacher already typed. */}
                              <div className="relative">
                                <Textarea
                                  placeholder={t("Type your question or challenge here…")}
                                  {...field}
                                  className="min-h-36 resize-none rounded-field bg-muted/30 pr-12 text-lg leading-relaxed"
                                />
                                <div className="absolute right-2 top-2">
                                  <InlineMicButton
                                    onTranscript={(text, isFinal) => {
                                      if (!isFinal) return;
                                      const current = field.value || "";
                                      field.onChange(current ? `${current} ${text}` : text);
                                    }}
                                  />
                                </div>
                              </div>
                            </FormControl>
                            {/* Live character counter — UX audit #11.
                                Teacher knows the 10-char minimum before submit. */}
                            <div className="mt-1 flex items-center justify-between">
                              <FormMessage />
                              <span className={`ml-auto text-xs font-medium tabular-nums ${isValid ? "text-success" : "text-muted-foreground"}`}>
                                {charCount} / {minChars} {isValid ? "✓" : t("min")}
                              </span>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  </GeneratorSection>

                  <GeneratorSection step={2} title={t("Quick Ideas")}>
                    <div className="space-y-4">
                      {/* UX audit #3: personalised Quick Ideas — appears only
                          when teacherProfile has grade + subject. Templates use
                          the teacher's actual context so suggestions feel relevant
                          ("for my Class 7 Math students" vs generic "students").
                          Static <ExamplePrompts> still renders below as fallback +
                          cross-context inspiration. */}
                      {teacherProfile.preferredGrade && teacherProfile.preferredSubject && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-2 text-sm font-medium text-foreground indic-text">
                            {t("For your")} {t(teacherProfile.preferredGrade)} {t(teacherProfile.preferredSubject)} {t("students")}
                            <span className="rounded-pill bg-tint-accent-soft px-2 py-0.5 text-xs font-semibold text-saffron-700">
                              {t("Personalised")}
                            </span>
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {[
                              `${t("How do I keep")} ${t(teacherProfile.preferredGrade)} ${t(teacherProfile.preferredSubject)} ${t("students focused for the full period?")}`,
                              `${t("Best way to introduce a new")} ${t(teacherProfile.preferredSubject)} ${t("chapter to")} ${t(teacherProfile.preferredGrade)}?`,
                              `${t("How do I assess")} ${t(teacherProfile.preferredGrade)} ${t(teacherProfile.preferredSubject)} ${t("understanding without a formal test?")}`,
                              `${t("Common")} ${t(teacherProfile.preferredSubject)} ${t("misconceptions in")} ${t(teacherProfile.preferredGrade)} ${t("and how to fix them?")}`,
                            ].map((prompt, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handlePromptClick(prompt)}
                                className="focus-ring rounded-row border border-primary/20 bg-tint-accent-soft p-3 text-left text-sm transition-colors duration-micro ease-out-quart hover:border-primary/40"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="teacher-training" />
                    </div>
                  </GeneratorSection>

                  {/* UX audit #4: example Q&A card — shows first-time visitors
                      what kind of advice to expect. Builds trust without
                      demanding upfront commitment. */}
                  {!advice && !isLoading && (
                    <details className="group rounded-row border border-border bg-muted/30">
                      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-foreground">
                        <MessageCircleQuestion className="h-4 w-4 text-saffron-600" aria-hidden="true" />
                        {t("See an example answer")}
                        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">{t("Tap to expand")}</span>
                      </summary>
                      <div className="space-y-2 px-4 pb-4 text-sm">
                        <p className="font-medium text-foreground">
                          {t("Q: How do I keep Class 5 students engaged during a 45-minute lesson?")}
                        </p>
                        <p className="italic text-muted-foreground">
                          {t("VIDYA: Break the lesson into three 15-minute chunks…")}
                          <span className="ml-1 inline-block rounded-pill bg-tint-accent-soft px-2 py-0.5 text-xs font-semibold not-italic text-saffron-700">
                            {t("Pedagogy: Spaced repetition")}
                          </span>
                        </p>
                      </div>
                    </details>
                  )}
                </div>

                {/* ── Settings ───────────────────────────────────────── */}
                <aside className="h-fit space-y-6 rounded-panel border border-border bg-muted/30 p-4 sm:p-6 xl:sticky xl:top-24 xl:col-span-5">
                  <h2 className="font-headline text-lg font-semibold text-foreground indic-text">{t("Settings")}</h2>

                  {/* UX audit #1: removed "Subject" dropdown — pedagogy advice
                      doesn't change by subject. "General" was always the default
                      anyway. UX audit #8: clarified Language label → "Response
                      language" so it's clear this controls VIDYA's reply, not
                      the UI language (that's already in the header pill). */}
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">{t("Response language")}</FormLabel>
                        <FormControl>
                          <LanguageSelector
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-row border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      {/* Bug #1: replaced malformed inline SVG with lucide
                          Lightbulb (was throwing a console SVG path error
                          on every page load). */}
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-saffron-600" aria-hidden="true" />
                      <div>
                        <p className="mb-1 text-sm font-semibold text-foreground">{t("Pro Tip")}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{t(proTipKey)}</p>
                      </div>
                    </div>
                  </div>

                  <GeneratorSubmitBar hint={aiUnavailableReason} className="md:block md:border-t-0 md:pt-0">
                    <Button type="submit" disabled={isLoading || !canUseAI} aria-busy={isLoading} className={cn(GENERATOR_SUBMIT_CLASS, "gap-2 md:w-full md:min-w-0")}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t("Getting Advice...")}
                        </>
                      ) : (
                        <>
                          <GraduationCap className="h-5 w-5" />
                          {t("Get Advice")}
                        </>
                      )}
                    </Button>
                  </GeneratorSubmitBar>
                </aside>
              </div>
            </form>
          </Form>
        </div>
      </section>

      <div aria-live="polite" aria-busy={isLoading} className="space-y-6">
        {isLoading && <GeneratorProgress messages={[t("Thinking of some helpful advice...")]} />}

        {advice && (
          <>
            <div className="flex items-center gap-3">
              <span className="type-eyebrow text-saffron-700 indic-text">{t("Result")}</span>
              <hr className="flex-1 border-border" />
            </div>
            <TeacherTrainingDisplay advice={advice} title={form.getValues("question")} selectedLanguage={selectedLanguage} contentId={adviceContentId} />
            {/* UX audit #7: save advice to library so the teacher can find it
                again later (separate from sharing publicly to community). */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveToLibrary}
                disabled={savingToLib || savedToLib}
                className="gap-2"
              >
                {savedToLib ? (
                  <><Save className="h-4 w-4 text-success" />{t("Saved to library")}</>
                ) : savingToLib ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("Saving…")}</>
                ) : (
                  <><Save className="h-4 w-4" />{t("Save to library")}</>
                )}
              </Button>
              <ShareToCommunityCTA contentType="teacher-training" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeacherTrainingPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      {/* Bug #6 (audit 2026-04-27): the form was rendering for unauthenticated
          visitors but Get Advice would fail at the API layer. Wrap in AuthGate
          so signed-out teachers get a clean sign-in prompt instead of filling
          a form that silently breaks. */}
      <AuthGate
        icon={GraduationCap}
        title={t("Sign in to ask the AI Coach")}
        description={t("Get advice grounded in pedagogical principles — sign in to ask anything about teaching.")}
      >
        <TeacherTrainingContent />
      </AuthGate>
    </Suspense>
  );
}
