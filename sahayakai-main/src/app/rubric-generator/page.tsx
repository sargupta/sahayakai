"use client";

import { generateRubric, RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
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

const formSchema = z.object({
  assignmentDescription: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Rubric Generator",
    pageDescription: "Create clear and fair grading rubrics for any assignment.",
    dialogTitle: "What is a Rubric?",
    dialogDescription: "A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.",
    dialogWhy: "Why are they important?",
    dialogClarityText: "They demystify assignments by making expectations clear to students before they start.",
    dialogConsistencyText: "They ensure all students are graded with the same criteria, making assessment fair and objective.",
    dialogFeedbackText: "They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.",
    dialogEfficiencyText: "They can make the grading process faster and more straightforward for teachers.",
    formLabel: "Assignment Description",
    formPlaceholder: "e.g., A project to build a model of the solar system for 6th graders.",
    gradeLevel: "Grade Level",
    language: "Language",
    buttonGenerate: "Generate Rubric",
    buttonGenerating: "Generating Rubric...",
    loadingText: "Building your rubric...",
    strongClarity: "Clarity:",
    strongConsistency: "Consistency:",
    strongFeedback: "Feedback:",
    strongEfficiency: "Efficiency:",
  },
  hi: {
    pageTitle: "रूब्रिक जेनरेटर",
    pageDescription: "किसी भी असाइनमेंट के लिए स्पष्ट और निष्पक्ष ग्रेडिंग रूब्रिक बनाएं।",
    dialogTitle: "रूब्रिक क्या है?",
    dialogDescription: "रूब्रिक एक स्कोरिंग उपकरण है जो किसी असाइनमेंट या काम के लिए प्रदर्शन अपेक्षाओं का स्पष्ट रूप से प्रतिनिधित्व करता है।",
    dialogWhy: "वे महत्वपूर्ण क्यों हैं?",
    dialogClarityText: "वे छात्रों को शुरू करने से पहले अपेक्षाओं को स्पष्ट करके असाइनमेंट को सरल बनाते हैं।",
    dialogConsistencyText: "वे सुनिश्चित करते हैं कि सभी छात्रों को समान मानदंडों के साथ ग्रेड दिया जाए, जिससे मूल्यांकन निष्पक्ष और वस्तुनिष्ठ हो।",
    dialogFeedbackText: "वे विशिष्ट, विस्तृत फीडबैक प्रदान करते हैं जो छात्रों को उनकी ताकत और सुधार के क्षेत्रों को समझने में मदद करता है।",
    dialogEfficiencyText: "वे शिक्षकों के लिए ग्रेडिंग प्रक्रिया को तेज और अधिक सीधा बना सकते हैं।",
    formLabel: "असाइनमेंट विवरण",
    formPlaceholder: "उदा., छठी कक्षा के छात्रों के लिए सौर मंडल का एक मॉडल बनाने की एक परियोजना।",
    gradeLevel: "श्रेणी स्तर",
    language: "भाषा",
    buttonGenerate: "रूब्रिक बनाएं",
    buttonGenerating: "रूब्रिक बना रहा है...",
    loadingText: "आपका रूब्रिक बन रहा है...",
    strongClarity: "स्पष्टता:",
    strongConsistency: "संगति:",
    strongFeedback: "फीडबैक:",
    strongEfficiency: "दक्षता:",
  },
  // ... (keeping multi-lang structure)
};

function RubricGeneratorContent() {
  const { user, requireAuth, openAuthModal } = useAuth();
  const [rubric, setRubric] = useState<RubricGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const hasLoaded = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assignmentDescription: "",
      language: "en",
      gradeLevel: "7th Grade",
      subject: "General",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;

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
            title: "Load Failed",
            description: "Could not load the saved rubric.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
          hasLoaded.current = true;
        }
      };
      fetchSavedContent();
    } else if (descParam) {
      form.setValue("assignmentDescription", descParam);
      hasLoaded.current = true;
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 0);
    }
  }, [user, searchParams, form, toast]);

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    setIsLoading(true);
    setRubric(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/ai/rubric", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...values, language: selectedLanguage })
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
    } catch (error) {
      console.error("Failed to generate rubric:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the rubric. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("assignmentDescription", prompt);
    form.trigger("assignmentDescription");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-primary" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ClipboardCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <span>{t.pageDescription}</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Info className="h-5 w-5 text-accent-foreground/50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-headline">{t.dialogTitle}</DialogTitle>
                  <DialogDescription>
                    {t.dialogDescription}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">{t.dialogWhy}</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-foreground/80">{t.strongClarity}</strong> {t.dialogClarityText}</li>
                    <li><strong className="text-foreground/80">{t.strongConsistency}</strong> {t.dialogConsistencyText}</li>
                    <li><strong className="text-foreground/80">{t.strongFeedback}</strong> {t.dialogFeedbackText}</li>
                    <li><strong className="text-foreground/80">{t.strongEfficiency}</strong> {t.dialogEfficiencyText}</li>
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
                    <FormLabel className="font-headline">{t.formLabel}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4">
                        <MicrophoneInput
                          onTranscriptChange={(transcript) => field.onChange(transcript)}
                          iconSize="lg"
                          label="Describe the assignment..."
                          className="bg-white/50 backdrop-blur-sm"
                        />
                        <Textarea
                          placeholder={t.formPlaceholder}
                          {...field}
                          className="bg-white/50 backdrop-blur-sm min-h-[120px]"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="rubric" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">{t.gradeLevel}</FormLabel>
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
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">Subject</FormLabel>
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
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">{t.language}</FormLabel>
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

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6 shadow-lg shadow-primary/20 transition-all">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.buttonGenerating}
                  </>
                ) : (
                  t.buttonGenerate
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </div>

      {isLoading && (
        <Card className="mt-8 w-full bg-white border border-slate-200 shadow-sm rounded-2xl animate-fade-in-up">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium text-slate-600">{t.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {rubric && <RubricDisplay rubric={rubric} />}
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
