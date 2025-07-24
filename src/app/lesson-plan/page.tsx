
"use client";

import { generateLessonPlan, LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lightbulb, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LanguageSelector } from "@/components/language-selector";
import { LessonPlanDisplay } from "@/components/lesson-plan-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { AutoCompleteInput } from "@/components/auto-complete-input";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  localContext: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const hintTranslations: Record<string, { title: string; body: string }> = {
    en: {
      title: "Make it relevant!",
      body: "Provide a local city, festival, or landmark to make the content more personal.",
    },
    hi: {
      title: "इसे प्रासंगिक बनाएं!",
      body: "सामग्री को और अधिक व्यक्तिगत बनाने के लिए एक स्थानीय शहर, त्योहार या स्थल का उल्लेख करें।",
    },
    bn: {
      title: "এটা প্রাসঙ্গিক করুন!",
      body: "বিষয়বস্তু আরও ব্যক্তিগত করতে একটি স্থানীয় শহর, উৎসব বা ল্যান্ডমার্ক উল্লেখ করুন।",
    },
    te: {
      title: "దానిని సంబంధితంగా చేయండి!",
      body: "కంటెంట్‌ను మరింత వ్యక్తిగతంగా చేయడానికి స్థానిక నగరం, పండుగ లేదా ల్యాండ్‌మార్క్‌ను అందించండి.",
    },
    mr: {
      title: "ते संबंधित बनवा!",
      body: "सामग्री अधिक वैयक्तिक करण्यासाठी स्थानिक शहर, सण किंवा महत्त्वाची खूण सांगा.",
    },
    ta: {
      title: "அதை தொடர்புடையதாக ஆக்குங்கள்!",
      body: "உள்ளடக்கத்தை மேலும் தனிப்பட்டதாக மாற்ற உள்ளூர் நகரம், திருவிழா அல்லது முக்கிய இடத்தைக் குறிப்பிடவும்.",
    },
    gu: {
      title: "તેને સુસંગત બનાવો!",
      body: "સામગ્રીને વધુ વ્યક્તિગત બનાવવા માટે સ્થાનિક શહેર, તહેવાર અથવા સીમાચિહ્ન પ્રદાન કરો.",
    },
    kn: {
      title: "ಅದನ್ನು ಸಂಬಂಧಿತಗೊಳಿಸಿ!",
      body: "ವಿಷಯವನ್ನು ಹೆಚ್ಚು ವೈಯಕ್ತಿಕವಾಗಿಸಲು ಸ್ಥಳೀಯ ನಗರ, ಹಬ್ಬ ಅಥವಾ ಹೆಗ್ಗುರುತನ್ನು ಒದಗಿಸಿ.",
    },
};

const placeholderTranslations: Record<string, string> = {
    en: "e.g., 'A village in Kerala'",
    hi: "उदा., 'केरल का एक गाँव'",
    bn: "উদা., 'কেরালার একটি গ্রাম'",
    te: "ఉదా., 'కేరళలోని ఒక గ్రామం'",
    mr: "उदा., 'केरळमधील एक गाव'",
    ta: "உதா., 'கேரளாவில் ஒரு கிராமம்'",
    gu: "દા.ત., 'કેરળનું એક ગામ'",
    kn: "ಉದಾ., 'ಕೇರಳದ ಒಂದು ಹಳ್ಳಿ'",
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
  const hint = hintTranslations[selectedLanguage] || hintTranslations.en;
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
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Topic</FormLabel>
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
              
              <div className="flex items-center justify-center gap-4">
                <MicrophoneInput onTranscriptChange={handleTranscript} />
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="h-20 w-20 rounded-full shadow-lg"
                  aria-label="Upload a file"
                >
                  <Upload className="h-10 w-10" />
                </Button>
              </div>

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
                <div className="md:col-span-2">
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
                        <div className="text-xs text-muted-foreground p-2 bg-accent/20 rounded-md border border-accent/30 space-y-1">
                            <div className="flex items-center gap-2 font-semibold">
                                <Lightbulb className="h-4 w-4" />
                                <span>{hint.title}</span>
                            </div>
                            <p>
                                {hint.body}
                            </p>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
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
