
"use client";

import { Suspense, useRef } from "react";

import type { TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { saveToLibrary } from "@/app/actions/content";
import { Save, History, MessageCircleQuestion } from "lucide-react";
// Removed (audit 2026-04-27): VoiceAssistant import. The global OmniOrb
// (mounted in app-shell) already provides voice + chat for every page.
// Mounting both here created the "two voice surfaces" UX bug.
import { useJarvisStore } from "@/store/jarvisStore";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useNetworkAware } from "@/hooks/use-network-aware";


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
  const [isLoading, setIsLoading] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);
  const [savedToLib, setSavedToLib] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const { clearFormSnapshot, teacherProfile } = useJarvisStore();
  const proTipKey = PRO_TIP_KEYS[new Date().getDate() % PRO_TIP_KEYS.length];

  // UX audit #13: load last question on mount so teacher can pick up
  // where they left off. Only show if it's recent (within 7 days).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tt-last-question");
      if (!raw) return;
      const { q, ts } = JSON.parse(raw);
      const ageMs = Date.now() - (ts ?? 0);
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (q && typeof q === "string" && ageMs < SEVEN_DAYS) {
        setLastQuestion(q);
      }
    } catch {
      // ignore parse errors / localStorage unavailable
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
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
  const descriptionLines = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
  const placeholder = placeholderTranslations[selectedLanguage] || placeholderTranslations.en;
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
            if (content.data) setAdvice(content.data as TeacherTrainingOutput);
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
      const subjectParam = searchParams.get("subject");
      const languageParam = searchParams.get("language");

      form.setValue("question", questionParam);
      if (subjectParam) form.setValue("subject", subjectParam);
      if (languageParam) form.setValue("language", languageParam);
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
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/teacher-training", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          question: values.question,
          language: values.language || selectedLanguage,
          subject: values.subject,
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
      clearFormSnapshot("teacher-training");
      // UX audit #13: persist last question so a returning teacher can
      // pick up where they left off. Stored client-side only — no PII
      // crosses to the server beyond the existing API call.
      try {
        localStorage.setItem(
          "tt-last-question",
          JSON.stringify({ q: values.question, ts: Date.now() }),
        );
      } catch {
        // localStorage may be unavailable (private mode, restricted webview)
      }
    } catch (error) {
      console.error("Failed to get advice:", error);
      toast({
        title: t("Failed to Get Advice"),
        description: "There was an error getting advice. Please try again.",
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
      const result = await saveToLibrary(
        auth.currentUser.uid,
        "teacher-training",
        title,
        advice,
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="card-accent-bar" />

        <CardHeader className="text-center pb-3 sm:pb-6 pt-4 sm:pt-6">
          {/* Compact mobile header — icon hidden on mobile to save vertical
              space; on desktop kept for visual anchor (UX audit #14). */}
          <div className="hidden sm:flex justify-center items-center mb-3">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <GraduationCap className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="font-headline tracking-tight text-xl sm:text-3xl">{t("AI Coach")}</CardTitle>
          <CardDescription>
            <p>{descriptionLines[0]}</p>
            <p className="hidden sm:block">{descriptionLines[1]}</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Main Content (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* UX audit #13: previous question affordance — appears
                      only if a question was asked in the last 7 days. */}
                  {lastQuestion && (
                    <button
                      type="button"
                      onClick={handleResumeLast}
                      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <History className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t("Continue your last question")}</p>
                        <p className="text-sm text-foreground line-clamp-1">{lastQuestion}</p>
                      </div>
                    </button>
                  )}

                  {/* UX audit #4: example Q&A card — shows first-time visitors
                      what kind of advice to expect. Builds trust without
                      demanding upfront commitment. */}
                  {!advice && !isLoading && (
                    <details className="rounded-xl border border-border/60 bg-muted/20 group">
                      <summary className="flex items-center gap-2 p-3 cursor-pointer text-sm font-semibold text-foreground list-none">
                        <MessageCircleQuestion className="w-4 h-4 text-primary" />
                        {t("See an example answer")}
                        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">{t("Tap to expand")}</span>
                      </summary>
                      <div className="px-4 pb-4 space-y-2 text-sm">
                        <p className="font-medium text-foreground">
                          {t("Q: How do I keep Class 5 students engaged during a 45-minute lesson?")}
                        </p>
                        <p className="text-muted-foreground italic">
                          {t("VIDYA: Break the lesson into three 15-minute chunks…")}
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                            {t("Pedagogy: Spaced repetition")}
                          </span>
                        </p>
                      </div>
                    </details>
                  )}

                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => {
                      const charCount = (field.value || "").length;
                      const minChars = 10;
                      const isValid = charCount >= minChars;
                      return (
                        <FormItem>
                          <FormLabel className="font-headline text-lg">{t("Your Question or Challenge")}</FormLabel>
                          <FormControl>
                            {/* Mic anchored INSIDE the textarea wrapper at top-right
                                — fixes UX audit bug #4 (orphaned position).
                                Appends transcript to whatever the teacher already typed. */}
                            <div className="relative">
                              <Textarea
                                placeholder={t("Type your question or challenge here…")}
                                {...field}
                                className="bg-muted/20 min-h-[120px] resize-none text-lg pr-12"
                              />
                              <div className="absolute top-2 right-2">
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
                          <div className="flex items-center justify-between mt-1">
                            <FormMessage />
                            <span className={`text-xs font-medium ml-auto ${isValid ? "text-green-600" : "text-muted-foreground"}`}>
                              {charCount} / {minChars} {isValid ? "✓" : t("min")}
                            </span>
                          </div>
                        </FormItem>
                      );
                    }}
                  />

                  {/* UX audit #3: personalised Quick Ideas — appears only
                      when teacherProfile has grade + subject. Templates use
                      the teacher's actual context so suggestions feel relevant
                      ("for my Class 7 Math students" vs generic "students").
                      Static <ExamplePrompts> still renders below as fallback +
                      cross-context inspiration. */}
                  {teacherProfile.preferredGrade && teacherProfile.preferredSubject && (
                    <div className="space-y-2">
                      <FormLabel className="font-headline flex items-center gap-2">
                        {t("For your")} {teacherProfile.preferredGrade} {teacherProfile.preferredSubject} {t("students")}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase tracking-wide">
                          {t("Personalised")}
                        </span>
                      </FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          `${t("How do I keep")} ${teacherProfile.preferredGrade} ${teacherProfile.preferredSubject} ${t("students focused for the full period?")}`,
                          `${t("Best way to introduce a new")} ${teacherProfile.preferredSubject} ${t("chapter to")} ${teacherProfile.preferredGrade}?`,
                          `${t("How do I assess")} ${teacherProfile.preferredGrade} ${teacherProfile.preferredSubject} ${t("understanding without a formal test?")}`,
                          `${t("Common")} ${teacherProfile.preferredSubject} ${t("misconceptions in")} ${teacherProfile.preferredGrade} ${t("and how to fix them?")}`,
                        ].map((prompt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handlePromptClick(prompt)}
                            className="text-left text-sm p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <FormLabel className="font-headline">{t("Quick Ideas")}</FormLabel>
                    <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="teacher-training" />
                  </div>
                </div>

                {/* RIGHT COLUMN: Settings Sidebar (5 cols) */}
                <div className="lg:col-span-5 space-y-5 border border-border rounded-2xl p-4 md:p-5 bg-card shadow-soft h-fit">
                  <h3 className="font-headline text-base font-bold text-primary uppercase tracking-wide">{t("Settings")}</h3>

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
                        <FormLabel className="text-xs font-semibold text-muted-foreground">{t("Response language")}</FormLabel>
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

                  <div className="bg-primary/5 p-4 rounded-r-lg border-l-2 border-primary/40">
                    <div className="flex items-start gap-3">
                      {/* Bug #1: replaced malformed inline SVG with lucide
                          Lightbulb (was throwing a console SVG path error
                          on every page load). */}
                      <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground text-sm mb-1">{t("Pro Tip")}</p>
                        <p className="text-sm text-muted-foreground">{t(proTipKey)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={isLoading || !canUseAI} className="w-full text-lg py-6 shadow-lg shadow-primary/20 transition-all gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    {t("Getting Advice...")}
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-5 w-5" />
                    {t("Get Advice")}
                  </>
                )}
              </Button>
              {aiUnavailableReason && (
                <p className="text-xs text-amber-600 mt-1.5 text-center">{aiUnavailableReason}</p>
              )}
            </form>
          </Form>
        </CardContent>
      </div>

      {isLoading && (
        <Card className="mt-8 w-full max-w-4xl bg-muted/20 border-border shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t("Thinking of some helpful advice...")}</p>
          </CardContent>
        </Card>
      )}

      {advice && (
        <>
        <div className="my-8 flex items-center gap-3">
          <hr className="flex-1 border-border/40" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{t("Result")}</span>
          <hr className="flex-1 border-border/40" />
        </div>
        <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4"><TeacherTrainingDisplay advice={advice} title={form.getValues("question")} selectedLanguage={selectedLanguage} /></div>
        {/* UX audit #7: save advice to library so the teacher can find it
            again later (separate from sharing publicly to community). */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveToLibrary}
            disabled={savingToLib || savedToLib}
            className="gap-2"
          >
            {savedToLib ? (
              <><Save className="h-4 w-4 text-green-600" />{t("Saved to library")}</>
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
  );
}

export default function TeacherTrainingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      {/* Bug #6 (audit 2026-04-27): the form was rendering for unauthenticated
          visitors but Get Advice would fail at the API layer. Wrap in AuthGate
          so signed-out teachers get a clean sign-in prompt instead of filling
          a form that silently breaks. */}
      <AuthGate
        icon={GraduationCap}
        title="Sign in to ask the AI Coach"
        description="Get advice grounded in pedagogical principles — sign in to ask anything about teaching."
      >
        <TeacherTrainingContent />
      </AuthGate>
    </Suspense>
  );
}
