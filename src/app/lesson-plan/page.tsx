
"use client";

import { generateLessonPlan, LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LanguageSelector } from "@/components/language-selector";
import { LessonPlanDisplay } from "@/components/lesson-plan-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import { ExamplePrompts } from "@/components/example-prompts";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  localContext: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const placeholderTranslations: Record<string, string> = {
    en: "e.g., city, festival, or landmark",
    hi: "उदा., शहर, त्योहार, या स्थल",
    bn: "उदा., শহর, উৎসব, বা ল্যান্ডমার্ক",
    te: "ఉదా., నగరం, పండుగ, లేదా మైలురాయి",
    mr: "उदा., शहर, सण, किंवा महत्त्वाचे ठिकाण",
    ta: "உதா., நகரம், திருவிழா, அல்லது முக்கிய இடம்",
    gu: "દા.ત., શહેર, તહેવાર, અથવા સીમાચિહ્ન",
    kn: "ಉದಾ., ನಗರ, ಹಬ್ಬ, ಅಥವಾ ಹೆಗ್ಗುರುತು",
};

const topicPlaceholderTranslations: Record<string, string> = {
    en: "e.g., 'The Indian Monsoon'",
    hi: "उदा., 'भारतीय मानसून'",
    bn: "উদা., 'ভারতীয় বর্ষা'",
    te: "ఉదా., 'భారత రుతుపవనాలు'",
    mr: "उदा., 'भारतीय मान्सून'",
    ta: "உதா., 'இந்திய பருவமழை'",
    gu: "દા.ત., 'ભારતીય ચોમાસું'",
    kn: "ಉದಾ., 'ಭಾರತೀಯ ಮಾನ್ಸೂನ್'",
};


export default function LessonPlanAgentPage() {
  const [lessonPlan, setLessonPlan] = useState<LessonPlanOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "6th Grade",
      localContext: "",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const placeholder = placeholderTranslations[selectedLanguage] || placeholderTranslations.en;
  const topicPlaceholder = topicPlaceholderTranslations[selectedLanguage] || topicPlaceholderTranslations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setLessonPlan(null);
    try {
      const result = await generateLessonPlan({
        topic: values.topic,
        language: values.language,
        gradeLevel: values.gradeLevel,
        localContext: values.localContext,
      });
      setLessonPlan(result);
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

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Lesson Plan Agent</CardTitle>
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
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          onValueChange={field.onChange}
                          defaultValue={field.value}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="localContext"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel className="font-headline">Local Context</FormLabel>
                      <FormControl>
                          <Input
                          placeholder={placeholder}
                          {...field}
                          className="bg-white/50 backdrop-blur-sm"
                          />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <div className="flex flex-col gap-2">
                    <FormLabel className="font-headline">Add context (optional)</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className="w-full h-10 flex items-center justify-center gap-2 border-dashed"
                      aria-label="Upload a file"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload Textbook Page</span>
                    </Button>
                  </div>
              </div>
              
              <MicrophoneInput onTranscriptChange={handleTranscript} />

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

              <ExamplePrompts
                onPromptClick={handlePromptClick}
                selectedLanguage={selectedLanguage}
                page="home"
              />

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
