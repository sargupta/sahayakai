
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
import { ExamplePrompts } from "@/components/example-prompts";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import { ImageUploader } from "@/components/image-uploader";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  language: z.string().optional(),
  gradeLevels: z.array(z.string()).optional(),
  imageDataUri: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const descriptionTranslations: Record<string, string> = {
    en: "Use the input below or your voice to get started.",
    hi: "आरंभ करने के लिए नीचे दिए गए इनपुट या अपनी आवाज़ का उपयोग करें।",
    bn: "শুরু করতে নীচের ইনপুট বা আপনার ভয়েস ব্যবহার করুন।",
    te: "ప్రారంభించడానికి దిగువ ఇన్‌పుట్ లేదా మీ వాయిస్‌ని ఉపయోగించండి.",
    mr: "प्रारंभ करण्यासाठी खालील इनपुट किंवा तुमचा आवाज वापरा.",
    ta: "தொடங்குவதற்கு கீழே உள்ள உள்ளீடு அல்லது உங்கள் குரலைப் பயன்படுத்தவும்.",
    gu: "શરૂ કરવા માટે નીચે આપેલ ઇનપુટ અથવા તમારા અવાજનો ઉપયોગ કરો.",
    kn: "ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಇನ್‌ಪುಟ್ ಅಥವಾ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಬಳಸಿ.",
};

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

export default function Home() {
  const [lessonPlan, setLessonPlan] = useState<LessonPlanOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
  const description = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
  const topicPlaceholder = topicPlaceholderTranslations[selectedLanguage] || topicPlaceholderTranslations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setLessonPlan(null);
    try {
      const result = await generateLessonPlan({
        topic: values.topic,
        language: values.language,
        gradeLevels: values.gradeLevels,
        imageDataUri: values.imageDataUri,
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
          <CardTitle className="font-headline text-3xl">SahayakAI</CardTitle>
          <CardDescription>
            {description}
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
                      <FormLabel className="font-headline">Grade Level(s)</FormLabel>
                       <FormControl>
                        <GradeLevelSelector
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
                page="homeWithImage"
              />
            
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
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
