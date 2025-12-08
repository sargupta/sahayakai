
"use client";

import { generateLessonPlan, LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LanguageSelector } from "@/components/language-selector";
import { LessonPlanDisplay } from "@/components/lesson-plan-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { ImageUploader } from "@/components/image-uploader";

import { NCERTChapterSelector } from "@/components/ncert-chapter-selector";
import { type NCERTChapter } from "@/data/ncert";
import { ResourceSelector, type ResourceLevel } from "@/components/resource-selector";
import { DifficultySelector, type DifficultyLevel } from "@/components/difficulty-selector";
import { QuickTemplates } from "@/components/quick-templates";
import { type QuickTemplate } from "@/data/quick-templates";

import { offlineLessonPlans } from "@/data/offline-lesson-plans";
import { useEffect } from "react";
import { getCachedLessonPlan, saveLessonPlanToCache } from "@/app/actions/lesson-plan";
import { saveDraft, getDraft, saveCache, getCache, logEvent, getPendingEvents, clearEvent } from "@/lib/indexed-db";
import { syncTelemetryEvents } from "@/app/actions/telemetry";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  language: z.string().optional(),
  gradeLevels: z.array(z.string()).optional(),
  imageDataUri: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const topicPlaceholderTranslations: Record<string, string> = {
  en: "e.g., 'Create a lesson plan for the Indian Monsoon'",
  hi: "उदा., 'भारतीय मानसून के लिए एक पाठ योजना बनाएं'",
  bn: "উদা., 'ভারতীয় বর্ষার জন্য একটি পাঠ পরিকল্পনা তৈরি করুন'",
  te: "ఉదా., 'భారతీయ రుతుపవనాల కోసం ఒక పాఠ్య ప్రణాళికను సృష్టించండి'",
  mr: "उदा., 'भारतीय मान्सूनसाठी एक पाठ योजना तयार करा'",
  ta: "உதா., 'இந்திய பருவமழைக்கு ஒரு பாடம் திட்டம் உருவாக்கவும்'",
  gu: "દા.ત., 'ભારતીય ચોમાસા માટે એક પાઠ યોજના બનાવો'",
  kn: "ಉದಾ., 'ಭಾರತೀಯ ಮಾನ್ಸೂನ್‌ಗಾಗಿ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ'",
};

export default function LessonPlanAgentPage() {
  const [lessonPlan, setLessonPlan] = useState<LessonPlanOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<NCERTChapter | null>(null);
  const [resourceLevel, setResourceLevel] = useState<ResourceLevel>('low');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('standard');
  const [isOffline, setIsOffline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check initial status
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = async () => {
      setIsOffline(false);
      toast({ title: "Back Online", description: "You are connected to the internet." });

      // Sync Telemetry
      try {
        const pending = await getPendingEvents();
        if (pending.length > 0) {
          const events = pending.map(p => p.value);
          const result = await syncTelemetryEvents(events);
          if (result.success) {
            // Clear synced events
            await Promise.all(pending.map(p => clearEvent(p.key)));
            console.log(`Synced ${pending.length} telemetry events`);
          }
        }
      } catch (e) {
        console.error("Sync failed", e);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({ title: "You are Offline", description: "Using offline mode. AI features limited.", variant: "destructive" });

      // Log offline event
      logEvent({ type: 'offline_mode_active', timestamp: Date.now() });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevels: ["6th Grade"],
      imageDataUri: "",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const selectedGradeLevels = form.watch("gradeLevels");
  const topicPlaceholder = topicPlaceholderTranslations[selectedLanguage] || topicPlaceholderTranslations.en;

  // Extract numeric grade from string (e.g., "6th Grade" -> 6)
  const getNumericGrade = (grades?: string[]) => {
    if (!grades || grades.length === 0) return undefined;
    const match = grades[0].match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  };

  const currentGrade = getNumericGrade(selectedGradeLevels);

  // Auto-save draft (IndexedDB)
  useEffect(() => {
    const subscription = form.watch(async (value) => {
      if (typeof window !== 'undefined') {
        try {
          await saveDraft("lessonPlanDraft", value);
        } catch (e) {
          console.error("Failed to save draft", e);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Load draft (IndexedDB)
  useEffect(() => {
    const loadDraft = async () => {
      if (typeof window !== 'undefined') {
        try {
          const savedDraft = await getDraft("lessonPlanDraft");
          if (savedDraft && savedDraft.topic) {
            form.reset(savedDraft);
            toast({
              title: "Draft Restored",
              description: "We restored your previous work from secure storage.",
            });
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    };
    loadDraft();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setLessonPlan(null);

    // 1. SEMANTIC CACHE CHECK (IndexedDB - Layer 1)
    const cacheKey = `cache_lp_${values.topic.trim().toLowerCase()}_${values.gradeLevels?.[0] || 'default'}_${values.language || 'en'}`;
    if (typeof window !== 'undefined') {
      try {
        const cachedPlan = await getCache(cacheKey);
        if (cachedPlan) {
          // Simulate a tiny delay for UX so it doesn't feel glitchy
          setTimeout(() => {
            setLessonPlan(cachedPlan);
            setIsLoading(false);
            toast({
              title: "⚡ Instant Load",
              description: "Loaded from local DB cache.",
              className: "bg-green-50 border-green-200 text-green-800",
            });
          }, 300);
          return;
        }
      } catch (e) {
        console.error("Cache fetch error", e);
      }
    }

    // 2. CLOUD CACHE CHECK (Community Cache - Layer 2)
    if (!isOffline) {
      try {
        const cloudCachedPlan = await getCachedLessonPlan(
          values.topic,
          values.gradeLevels?.[0] || 'default',
          values.language || 'en'
        );

        if (cloudCachedPlan) {
          setLessonPlan(cloudCachedPlan);
          setIsLoading(false);
          toast({
            title: "☁️ Community Cache",
            description: "Found a plan shared by another teacher!",
            className: "bg-blue-50 border-blue-200 text-blue-800",
          });
          // Save to local for next time
          if (typeof window !== 'undefined') {
            await saveCache(cacheKey, cloudCachedPlan);
          }
          return;
        }
      } catch (e) {
        console.error("Cloud cache check failed", e);
      }
    }

    // OFFLINE MODE HANDLER
    if (isOffline) {
      if (selectedChapter && offlineLessonPlans[selectedChapter.id]) {
        // Simulate a short delay for better UX
        setTimeout(() => {
          setLessonPlan(offlineLessonPlans[selectedChapter.id]);
          setIsLoading(false);
          toast({
            title: "Offline Plan Loaded",
            description: "Loaded pre-written lesson plan from device.",
          });
        }, 500);
        return;
      } else {
        setIsLoading(false);
        toast({
          title: "Offline Mode",
          description: "No pre-downloaded plan found for this chapter. Please connect to internet to generate new plans.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const result = await generateLessonPlan({
        topic: values.topic,
        language: values.language,
        gradeLevels: values.gradeLevels,
        imageDataUri: values.imageDataUri,
        useRuralContext: true, // Enable Indian rural context by default
        resourceLevel: resourceLevel,
        difficultyLevel: difficultyLevel,
        // Pass selected NCERT chapter if available
        ncertChapter: selectedChapter ? {
          title: selectedChapter.title,
          number: selectedChapter.number,
          learningOutcomes: selectedChapter.learningOutcomes,
        } : undefined,
      });
      setLessonPlan(result);

      // Save to semantic cache (Local - IndexedDB)
      if (typeof window !== 'undefined') {
        await saveCache(cacheKey, result);
      }

      // Save to semantic cache (Cloud - Firestore)
      if (!isOffline) {
        saveLessonPlanToCache(
          result,
          values.topic,
          values.gradeLevels?.[0] || 'default',
          values.language || 'en'
        );
      }
    } catch (error) {
      console.error("Failed to generate lesson plan:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the lesson plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscript = (transcript: string) => {
    form.setValue("topic", transcript);
    form.trigger("topic");
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("topic", prompt);
    form.trigger("topic");
  };

  const handleTemplateSelect = (template: QuickTemplate) => {
    form.setValue("topic", template.topic);
    form.setValue("gradeLevels", [template.gradeLevel]);
    // Reset other specific selections to avoid conflicts
    setSelectedChapter(null);
    form.trigger("topic");

    toast({
      title: "Template Selected",
      description: `Loaded template: ${template.title}`,
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Lesson Plan</CardTitle>
          <CardDescription>
            Create a comprehensive lesson plan using your voice or by typing a topic below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={field.value || []}
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
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Language</FormLabel>
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
              </div>

              {/* Resource Level Selector */}
              <div className="animate-fade-in-up">
                <ResourceSelector
                  value={resourceLevel}
                  onValueChange={setResourceLevel}
                />
              </div>

              {/* Difficulty Level Selector */}
              <div className="animate-fade-in-up">
                <DifficultySelector
                  value={difficultyLevel}
                  onValueChange={setDifficultyLevel}
                />
              </div>

              {/* NCERT Chapter Selector */}
              {currentGrade && (
                <div className="animate-fade-in-up">
                  <NCERTChapterSelector
                    selectedGrade={currentGrade}
                    onChapterSelect={(chapter) => {
                      setSelectedChapter(chapter);
                      // Auto-fill topic if chapter is selected
                      if (chapter) {
                        form.setValue("topic", `Lesson plan for ${chapter.title}`);
                      }
                    }}
                  />
                </div>
              )}



              <FormField
                control={form.control}
                name="imageDataUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Add Context (Optional Image)</FormLabel>
                    <FormControl>
                      <ImageUploader
                        onImageUpload={(dataUri) => {
                          field.onChange(dataUri);
                          form.trigger("imageDataUri");
                        }}
                        language={selectedLanguage}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <MicrophoneInput onTranscriptChange={handleTranscript} />

              {/* Quick Templates */}
              <div className="animate-fade-in-up">
                <QuickTemplates onTemplateSelect={handleTemplateSelect} />
              </div>

              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">How can I help you?</FormLabel>
                    <FormControl>
                      <AutoCompleteInput
                        placeholder={topicPlaceholder}
                        {...field}
                        selectedLanguage={selectedLanguage}
                        onSuggestionClick={(value) => {
                          form.setValue("topic", value);
                          form.trigger("topic");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-3 bg-accent/20 rounded-lg">
                <ExamplePrompts
                  onPromptClick={handlePromptClick}
                  selectedLanguage={selectedLanguage}
                  page="homeWithImage"
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Lesson Plan"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {lessonPlan && <LessonPlanDisplay lessonPlan={lessonPlan} />}
    </div>
  );
}
