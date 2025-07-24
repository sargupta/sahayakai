
"use client";

import { generateLessonPlan } from "@/ai/flows/lesson-plan-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lightbulb } from "lucide-react";
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
  gradeLevel: z.string().optional(),
  localContext: z.string().optional(),
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
    kn: "ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಇನ್‌ಪುట్ ಅಥವಾ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಬಳಸಿ.",
};

const hintTranslations: Record<string, { title: string; body: string }> = {
    en: {
      title: "Make it relevant!",
      body: "e.g., mention the river Ganga, Pongal for Tamil Nadu, or Durga Puja for Bengal.",
    },
    hi: {
      title: "इसे प्रासंगिक बनाएं!",
      body: "उदा., गंगा नदी का उल्लेख करें, तमिलनाडु के लिए पोंगल, या बंगाल के लिए दुर्गा पूजा।",
    },
    bn: {
      title: "এটা প্রাসঙ্গিক করুন!",
      body: "উদাহরণস্বরূপ, গঙ্গা নদীর উল্লেখ করুন, তামিলনাড়ুর জন্য পোঙ্গল, বা বাংলার জন্য দুর্গা পূজা।",
    },
    te: {
      title: "దానిని సంబంధితంగా చేయండి!",
      body: "ఉదా., గంగా నదిని ప్రస్తావించండి, తమిళనాడుకు పొంగల్, లేదా బెంగాల్‌కు దుర్గా పూజ.",
    },
    mr: {
      title: "ते संबंधित बनवा!",
      body: "उदा., गंगा नदीचा उल्लेख करा, तामिळनाडूसाठी पोंगल, किंवा बंगालसाठी दुर्गा पूजा.",
    },
    ta: {
      title: "அதை தொடர்புடையதாக ஆக்குங்கள்!",
      body: "உதா., கங்கை நதியைக் குறிப்பிடவும், தமிழ்நாட்டிற்கு பொங்கல், அல்லது வங்காளத்திற்கு துர்கா பூஜை.",
    },
    gu: {
      title: "તેને સુસંગત બનાવો!",
      body: "દા.ત., ગંગા નદીનો ઉલ્લેખ કરો, તમિલનાડુ માટે પોંગલ, અથવા બંગાળ માટે દુર્ગા પૂજા.",
    },
    kn: {
      title: "ಅದನ್ನು ಸಂಬಂಧಿತಗೊಳಿಸಿ!",
      body: "ಉದಾ., ಗಂಗಾ ನದಿಯನ್ನು ಉಲ್ಲೇಖಿಸಿ, ತಮಿಳುನಾಡಿಗೆ ಪೊಂಗಲ್, ಅಥವಾ ಬಂಗಾಳಕ್ಕೆ ದುರ್ಗಾ ಪೂಜೆ.",
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
  const [lessonPlan, setLessonPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "6th Grade",
      localContext: "",
      imageDataUri: "",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const description = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
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
        imageDataUri: values.imageDataUri,
      });
      setLessonPlan(result.lessonPlan);
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
              
              <div className="flex items-center justify-center">
                <MicrophoneInput onTranscriptChange={handleTranscript} />
              </div>
              
              <FormField
                  control={form.control}
                  name="imageDataUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Add context (optional image)</FormLabel>
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
