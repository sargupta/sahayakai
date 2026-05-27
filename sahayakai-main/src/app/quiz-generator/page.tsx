
"use client";

import type { QuizVariantsOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Loader2, FileSignature, CheckSquare, BarChart2, MessageSquare, ListTodo, BrainCircuit, BotMessageSquare, Brain, Search, CircleHelp, DraftingCompass, Pencil, PencilRuler, Download, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { ImageUploader } from "@/components/image-uploader";
import { SubjectSelector } from "@/components/subject-selector";
import { QuizDisplay } from "@/components/quiz-display";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { MicrophoneInput } from "@/components/microphone-input";
import { Input } from "@/components/ui/input";
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
import { SelectableCard } from "@/components/selectable-card";
import { cn } from "@/lib/utils";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { SectionCard } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { WorksheetDisplay } from "@/components/worksheet-display";
import { VisualAidDisplay } from "@/components/visual-aid-display";
import { useJarvisStore } from "@/store/jarvisStore";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useLimitGuard } from "@/hooks/use-limit-guard";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { UsageRemainingBadge } from "@/components/usage-remaining-badge";

// labelKey resolved via translate() at render time (Wave 6 i18n).
const questionTypesData = [
  { id: 'multiple_choice', labelKey: 'Multiple Choice', icon: BarChart2 },
  { id: 'true_false', labelKey: 'True/False', icon: CheckSquare },
  { id: 'fill_in_the_blanks', labelKey: 'Fill in the Blanks', icon: Pencil },
  { id: 'short_answer', labelKey: 'Short Answer', icon: MessageSquare },
] as const;

const bloomsLevelsData = [
  { id: 'Remember', icon: Brain },
  { id: 'Understand', icon: Search },
  { id: 'Apply', icon: DraftingCompass },
  { id: 'Analyze', icon: BrainCircuit },
  { id: 'Evaluate', icon: CircleHelp },
  { id: 'Create', icon: BotMessageSquare },
];

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  imageDataUri: z.string().optional(),
  numQuestions: z.coerce.number().min(1).max(20).default(5),
  questionTypes: z.array(z.enum(["multiple_choice", "fill_in_the_blanks", "short_answer", "true_false"])).min(1, {
    message: "You have to select at least one question type.",
  }),
  bloomsTaxonomyLevels: z.array(z.string()).optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;



import { Suspense } from "react";

export default function QuizGeneratorPage() {
  return (
    <Suspense fallback={<div>{/* i18n-exempt: pre-context fallback */}Loading…</div>}>
      <QuizGeneratorContent />
    </Suspense>
  );
}

function QuizGeneratorContent() {
  const { requireAuth, openAuthModal } = useAuth();
  const { language: userLanguage, t: translate } = useLanguage();
  const [quiz, setQuiz] = useState<QuizVariantsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { limitState, checkResponse, clearLimit } = useLimitGuard();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { clearFormSnapshot } = useJarvisStore();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();

  // Default the Language field to the user's profile language, not
  // hardcoded 'en'. See use-lesson-plan.ts for the same pattern.
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: LANGUAGE_TO_ISO[userLanguage] ?? "en",
      gradeLevel: undefined,
      numQuestions: 5,
      questionTypes: ["multiple_choice", "short_answer"],
      bloomsTaxonomyLevels: ['Remember', 'Understand'],
      subject: "General",
    },
  });

  // ── VIDYA Form Sync: live awareness + persisted snapshot ─────────────────
  const watchedTopic = form.watch("topic");
  const watchedGrade = form.watch("gradeLevel");
  const watchedSubject = form.watch("subject");
  const watchedLang = form.watch("language");
  const watchedNum = form.watch("numQuestions");
  const savedSnapshot = useVidyaFormSync("quiz-generator", {
    topic: watchedTopic,
    gradeLevel: watchedGrade,
    subject: watchedSubject,
    language: watchedLang,
    numQuestions: watchedNum,
  });

  // Restore snapshot on mount if no URL params are present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const topicParam = searchParams.get("topic");
    const id = searchParams.get("id");
    if (topicParam || id || !savedSnapshot) return;
    if (savedSnapshot.topic) form.setValue("topic", savedSnapshot.topic);
    if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
    if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
    if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    if (savedSnapshot.numQuestions) form.setValue("numQuestions", Number(savedSnapshot.numQuestions));
  }, []); // empty array: runs once on mount only

  useEffect(() => {
    const id = searchParams.get("id");
    const topicParam = searchParams.get("topic");

    if (id) {
      const fetchSavedContent = async () => {
        setIsLoading(true);
        try {
          // Use auth helper if available, otherwise fallback
          const userId = auth.currentUser?.uid || "dev-user";
          const res = await fetch(`/api/content/get?id=${id}`, {
            headers: { "x-user-id": userId }
          });
          if (res.ok) {
            const content = await res.json();
            if (content.data) {
              const loadedData = content.data;

              // Backward Compatibility: If loaded data is "old style" (has questions array directly), wrap it
              if (Array.isArray(loadedData.questions)) {
                setQuiz({
                  easy: null,
                  medium: loadedData,
                  hard: null,
                  id: id,
                  isSaved: true,
                  gradeLevel: content.gradeLevel,
                  subject: content.subject,
                  topic: content.topic || content.title
                });
              } else {
                // New style (easy, medium, hard)
                setQuiz({
                  ...loadedData,
                  id: id,
                  isSaved: true
                });
              }

              // Set form values to match saved content (prioritize medium, then any available)
              const primaryVariant = loadedData.medium || loadedData.easy || loadedData.hard || loadedData;

              form.reset({
                topic: content.topic || content.title,
                gradeLevel: content.gradeLevel,
                language: content.language,
                numQuestions: primaryVariant?.questions?.length || 5,
                // Default to standard types if not structured in base metadata
                questionTypes: ["multiple_choice", "short_answer"],
                bloomsTaxonomyLevels: ['Remember', 'Understand'],
                subject: content.subject || "General",
              });
            }
          }
        } catch (err) {
          console.error("Failed to load saved quiz:", err);
          toast({
            title: translate("Load Failed"),
            description: translate("Could not load the saved quiz."),
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSavedContent();
    } else if (topicParam) {
      // ── VIDYA Action: Pre-fill all fields from URL params ──────────────
      // NCERT-demo 2026-05-19 pattern (see use-lesson-plan.ts):
      //   - SET_OPTS forces controlled selectors to re-render with the
      //     incoming value before the 300ms auto-submit fires.
      //   - VIDYA emits language/grade in display-name form; normalise
      //     to ISO ("en") / "Class N" before writing.
      const subjectParam = searchParams.get("subject");
      const gradeLevelParam = searchParams.get("gradeLevel");
      const languageParam = searchParams.get("language");

      const SET_OPTS = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

      form.setValue("topic", topicParam, SET_OPTS);
      if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
      const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
      if (normalisedGrade) form.setValue("gradeLevel", normalisedGrade, SET_OPTS);
      const normalisedLang = normaliseVidyaLanguage(languageParam);
      if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
      // ────────────────────────────────────────────────────────────────────
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 300);
    }
  }, [searchParams, form, toast]);

  const selectedLanguage = form.watch("language") || 'en';
  // Local `translations` removed (Wave 6 cleanup). All chrome resolves via translate() from UI language.

  const submittingRef = useRef(false);
  const onSubmit = async (values: FormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!requireAuth()) { submittingRef.current = false; return; }
    setIsLoading(true);
    setQuiz(null);
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

      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          ...values,
          language: submittedLanguage,
          subject: submittedSubject,
          useRuralContext: true
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error(translate("Please sign in to generate quizzes"));
        }
        const errorData = await res.json();
        if (checkResponse(res.status, errorData)) {
          setIsLoading(false);
          submittingRef.current = false;
          return;
        }
        throw new Error(errorData.error || "Failed to generate quiz");
      }

      clearLimit();
      const result = await res.json();
      setQuiz(result);
      clearFormSnapshot("quiz-generator");

      // Mark onboarding checklist item
      if (auth.currentUser) {
        import('@/app/actions/profile').then(({ markChecklistItemAction }) =>
          markChecklistItemAction(auth.currentUser!.uid, 'first-quiz')
        ).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      toast({
        title: translate("Generation Failed"),
        description: translate("There was an error generating the quiz. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("topic", prompt);
    form.trigger("topic");
  };

  const handleTranscript = (transcript: string, language?: string) => {
    form.setValue("topic", transcript);
    if (language) {
      form.setValue("language", language);
    }
    form.trigger("topic");
    // Auto-submit after voice transcript to improve UX
    setTimeout(() => {
      form.handleSubmit(onSubmit)();
    }, 100);
  };



  return (
    <div className="container-wide py-8 space-y-8">
      <SectionCard className="overflow-hidden p-0 md:p-0 space-y-0">
        {/* Clean Top Bar */}
        <div className="card-accent-bar" />


        <div className="p-4 sm:p-6">
          <CardHeader className="text-center pt-0">
            <div className="flex justify-center items-center mb-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <FileSignature className="w-8 h-8" />
              </div>
            </div>

            <CardTitle className="font-headline text-2xl sm:text-3xl">{translate("Quiz Generator")}</CardTitle>
            <CardDescription>{translate("Create a quiz on any topic, with various question types.")}</CardDescription>
            <UsageRemainingBadge feature="quiz" />
          </CardHeader>

          {(limitState.limitReached || limitState.upgradeRequired) && (
            <UpgradePrompt
              feature="quiz"
              used={limitState.used ?? 0}
              limit={limitState.limit ?? 0}
            />
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Main Content (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex flex-col gap-4">
                            <Textarea
                              placeholder={translate("e.g., The life cycle of a butterfly, using the uploaded image.")}
                              {...field}
                              className="bg-muted/20 min-h-[120px] resize-none"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageDataUri"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline">{translate("Add Context (Optional Image)")}</FormLabel>
                        <FormControl>
                          <ImageUploader
                            onImageUpload={(dataUri) => field.onChange(dataUri)}
                            language={selectedLanguage}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="questionTypes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline">{translate("Question Types")}</FormLabel>
                        <div className="card-section">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {questionTypesData.map((item) => (
                              <SelectableCard
                                key={item.id}
                                icon={item.icon}
                                label={translate(item.labelKey)}
                                isSelected={field.value?.includes(item.id)}
                                onSelect={() => {
                                  const currentValues = field.value || [];
                                  const newValues = currentValues.includes(item.id)
                                    ? currentValues.filter((v) => v !== item.id)
                                    : [...currentValues, item.id];
                                  field.onChange(newValues);
                                }}
                                className="h-20"
                              />
                            ))}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel className="font-headline">{translate("Quick Ideas")}</FormLabel>
                    <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="quiz" />
                  </div>
                </div>

                {/* RIGHT COLUMN: Configuration (5 cols) */}
                <div className="lg:col-span-5 space-y-5 bg-card p-4 sm:p-6 rounded-surface-md border border-border shadow-soft h-fit">
                  {/* Subject, Grade and Language Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/30 pt-4 mt-2">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Subject")}</FormLabel>
                          <FormControl>
                            <SubjectSelector
                              value={field.value}
                              onValueChange={field.onChange}
                              language={selectedLanguage}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gradeLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Class")}</FormLabel>
                          <FormControl>
                            <GradeLevelSelector
                              value={field.value ? [field.value] : []}
                              onValueChange={(val) => field.onChange(val[0] || undefined)}
                              language={selectedLanguage}
                              isMulti={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Language")}</FormLabel>
                          <FormControl>
                            <LanguageSelector
                              onValueChange={field.onChange}
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="numQuestions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Number of Questions")}</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-4">
                            <Slider
                              min={1}
                              max={20}
                              step={1}
                              value={[field.value]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="flex-1"
                            />
                            <span className="font-semibold text-primary bg-primary/8 px-3 py-1 rounded-lg border border-primary/15 min-w-[3rem] text-center">{field.value}</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="questionTypes"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Question Types")}</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {['multiple_choice', 'short_answer', 'fill_in_the_blanks', 'true_false'].map((type) => (
                            <div key={type} className="flex items-center space-x-2 bg-muted/20 p-2 rounded border border-border/50">
                              <CheckboxUI
                                id={type}
                                checked={field.value?.includes(type as any)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...(field.value || []), type]);
                                  } else {
                                    field.onChange(field.value?.filter((val: string) => val !== type));
                                  }
                                }}
                              />
                              <label htmlFor={type} className="text-xs text-foreground cursor-pointer">
                                {translate(type === 'multiple_choice' ? 'Multiple Choice' : type === 'true_false' ? 'True/False' : type === 'fill_in_the_blanks' ? 'Fill in the Blanks' : type === 'short_answer' ? 'Short Answer' : type)}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bloomsTaxonomyLevels"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Bloom's Taxonomy Levels")}</FormLabel>
                        <TooltipProvider>
                          <div className="card-section flex flex-wrap gap-2">
                            {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].map((level) => (
                              <Tooltip key={level}>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={field.value?.includes(level) ? "default" : "outline"}
                                    className={`cursor-pointer transition-all ${field.value?.includes(level) ? "bg-primary hover:bg-primary/90 text-white" : "bg-muted/20 hover:bg-muted/40 text-muted-foreground"}`}
                                    onClick={() => {
                                      if (field.value?.includes(level)) {
                                        field.onChange(field.value.filter((l: string) => l !== level));
                                      } else {
                                        field.onChange([...(field.value || []), level]);
                                      }
                                    }}
                                  >
                                    {translate(level)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#1e293b] text-white border-slate-700">
                                  <p className="text-xs">{translate(`Bloom-hint-${level}`)}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>

                        {field.value && field.value.length > 0 && (
                          <div className="mt-3 p-3 bg-muted/20 rounded-xl border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-2 flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              {translate("Pedagogical Strategy")}
                            </div>
                            <div className="space-y-2">
                              {field.value.map((level: string) => (
                                <div key={level} className="text-[11px] leading-relaxed text-foreground flex items-start gap-2">
                                  <div className="mt-1 w-1 h-1 rounded-full bg-primary shrink-0" />
                                  <span>
                                    <span className="font-bold text-foreground">{translate(level)}:</span>{" "}
                                    {translate(`Bloom-hint-${level}`)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isLoading || !canUseAI} className="w-full py-5 text-base font-headline rounded-surface-md shadow-elevated transition-shadow duration-micro ease-out-quart">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                        {translate("Generating Quiz...")}
                      </>
                    ) : (
                      translate("Generate Quiz")
                    )}
                  </Button>
                  {aiUnavailableReason && (
                    <p className="text-xs text-amber-600 mt-2 text-center">{aiUnavailableReason}</p>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </SectionCard>

      {/* Results Section */}
      {quiz && (
        <>
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="type-caption text-muted-foreground px-2">{translate("Result")}</span>
            <hr className="flex-1 border-border/40" />
          </div>
          <SectionCard
            tone="muted"
            className="rounded-surface-md border-l-4 border-l-primary/70 bg-primary/5"
          >
            <QuizDisplay quiz={quiz as any} onRegenerate={() => form.handleSubmit(onSubmit)()} selectedLanguage={selectedLanguage} />
          </SectionCard>
          <ShareToCommunityCTA contentType="quiz" />
        </>
      )}
    </div>
  );
}
