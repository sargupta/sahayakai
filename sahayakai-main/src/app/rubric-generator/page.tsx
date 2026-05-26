"use client";

import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ClipboardCheck, Info } from "lucide-react";
import { useState, useEffect, useRef, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { RubricDisplay } from "@/components/rubric-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MicrophoneInput } from "@/components/microphone-input";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useJarvisStore } from "@/store/jarvisStore";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";

const formSchema = z.object({
  assignmentDescription: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Local `translations` object removed (Wave 6 cleanup). All page strings
// now resolved via the global useLanguage() / translate() in 11 languages.

function RubricGeneratorContent() {
  const { user, requireAuth, openAuthModal } = useAuth();
  const [rubric, setRubric] = useState<RubricGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t: translate } = useLanguage();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const searchParams = useSearchParams();
  const hasLoaded = useRef(false);
  const { clearFormSnapshot } = useJarvisStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assignmentDescription: "",
      language: "en",
      gradeLevel: "Class 7",
      subject: "General",
    },
  });

  // ── VIDYA Form Sync ───────────────────────────────────────────────────────
  const watchedDesc    = form.watch("assignmentDescription");
  const watchedGrade   = form.watch("gradeLevel");
  const watchedSubject = form.watch("subject");
  const watchedLang    = form.watch("language");
  const savedSnapshot  = useVidyaFormSync("rubric-generator", {
    assignmentDescription: watchedDesc,
    gradeLevel: watchedGrade,
    subject: watchedSubject,
    language: watchedLang,
  });

  // Restore snapshot on mount — only when no URL params are present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const descParam = searchParams.get("assignmentDescription");
    const id = searchParams.get("id");
    if (descParam || id || !savedSnapshot) return;
    if (savedSnapshot.assignmentDescription) form.setValue("assignmentDescription", savedSnapshot.assignmentDescription);
    if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
    if (savedSnapshot.subject)    form.setValue("subject",    savedSnapshot.subject);
    if (savedSnapshot.language)   form.setValue("language",   savedSnapshot.language);
  }, []); // runs once on mount only

  const selectedLanguage = form.watch("language") || 'en';

  useEffect(() => {
    if (!user || hasLoaded.current) return;

    const id = searchParams.get("id");
    const descParam = searchParams.get("assignmentDescription");

    if (id) {
      const fetchSavedContent = async () => {
        setIsLoading(true);
        try {
          const token = await user.getIdToken();
          const res = await fetch(`/api/content/get?id=${id}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const content = await res.json();
            if (content.data) {
              setRubric(content.data);
              form.reset({
                assignmentDescription: content.topic || content.title,
                gradeLevel: content.gradeLevel,
                language: content.language,
              });
            }
          }
        } catch (err) {
          console.error("Failed to load saved rubric:", err);
          toast({
            title: translate("Load Failed"),
            description: translate("Could not load the saved rubric."),
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
          hasLoaded.current = true;
        }
      };
      fetchSavedContent();
    } else if (descParam) {
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

      form.setValue("assignmentDescription", descParam, SET_OPTS);
      if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
      const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
      if (normalisedGrade) form.setValue("gradeLevel", normalisedGrade, SET_OPTS);
      const normalisedLang = normaliseVidyaLanguage(languageParam);
      if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
      // ────────────────────────────────────────────────────────────────────
      hasLoaded.current = true;
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 300);
    }
  }, [user, searchParams, form, toast]);

  const submittingRef = useRef(false);
  const onSubmit = async (values: FormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!requireAuth()) { submittingRef.current = false; return; }
    setIsLoading(true);
    setRubric(null);
    try {
      const token = await user?.getIdToken();
      // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
      // ALWAYS send a non-empty `language`; strip the "General" subject
      // placeholder so the model isn't misled by a meaningless default.
      const submittedLanguage = values.language && values.language.trim()
        ? values.language
        : 'en';
      const submittedSubject = values.subject && values.subject !== 'General'
        ? values.subject
        : undefined;

      const res = await fetch("/api/ai/rubric", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          language: submittedLanguage,
          subject: submittedSubject,
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to generate rubrics");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate rubric");
      }

      const result = await res.json();
      setRubric(result);
      clearFormSnapshot("rubric-generator");
    } catch (error) {
      console.error("Failed to generate rubric:", error);
      toast({
        title: translate("Generation Failed"),
        description: translate("There was an error generating the rubric. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("assignmentDescription", prompt);
    form.trigger("assignmentDescription");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
      <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="card-accent-bar" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ClipboardCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl sm:text-3xl">{translate("Rubric Generator")}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <span>{translate("Create clear and fair grading rubrics for any assignment.")}</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Info className="h-5 w-5 text-accent-foreground/50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-headline">{translate("What is a Rubric?")}</DialogTitle>
                  <DialogDescription>
                    {translate("A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">{translate("Why are they important?")}</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-foreground/80">{translate("Clarity:")}</strong> {translate("They demystify assignments by making expectations clear to students before they start.")}</li>
                    <li><strong className="text-foreground/80">{translate("Consistency:")}</strong> {translate("They ensure all students are graded with the same criteria, making assessment fair and objective.")}</li>
                    <li><strong className="text-foreground/80">{translate("Feedback:")}</strong> {translate("They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.")}</li>
                    <li><strong className="text-foreground/80">{translate("Efficiency:")}</strong> {translate("They can make the grading process faster and more straightforward for teachers.")}</li>
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="assignmentDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{translate("Assignment Description")}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4">
                        <Textarea
                          placeholder={translate("e.g., A project to build a model of the solar system for 6th graders.")}
                          {...field}
                          className="bg-muted/20 min-h-[120px]"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="rubric" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/30 pt-4 mt-2">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Class")}</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={field.value ? [field.value] : []}
                          onValueChange={(values) => field.onChange(values?.[0])}
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
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Subject")}</FormLabel>
                      <FormControl>
                        <SubjectSelector
                          onValueChange={field.onChange}
                          value={field.value}
                          language={selectedLanguage}
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
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Language")}</FormLabel>
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

              <Button type="submit" disabled={isLoading || !canUseAI} className="w-full py-5 text-base font-headline shadow-lg shadow-primary/20 transition-all">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {translate("Generating Rubric...")}
                  </>
                ) : (
                  translate("Generate Rubric")
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
        <Card className="mt-8 w-full bg-card border border-border shadow-soft rounded-2xl animate-fade-in-up">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium text-muted-foreground">{translate("Building your rubric...")}</p>
          </CardContent>
        </Card>
      )}

      {rubric && (
        <>
          <div className="my-8 flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{translate("Result")}</span>
            <hr className="flex-1 border-border/40" />
          </div>
          <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4">
            <RubricDisplay rubric={rubric} selectedLanguage={selectedLanguage} />
          </div>
        </>
      )}
    </div>
  );
}

export default function RubricGeneratorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <RubricGeneratorContent />
    </Suspense>
  );
}
