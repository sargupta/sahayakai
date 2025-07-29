"use client";

import { processAgentRequest, AgentRouterOutput } from "@/ai/flows/agent-router";
import { QuizDisplay } from "@/components/quiz-display";
import ReactMarkdown from 'react-markdown';
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
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  language: z.string().optional(),
  gradeLevels: z.array(z.string()).optional(),
  localContext: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const descriptionTranslations: Record<string, string> = {
    en: "Use the input below or your voice to get started.",
    hi: "आरंभ करने के लिए नीचे दिए गए इनपुट या अपनी आवाज़ का उपयोग करें।",
    bn: "শুরু করতে নীচের ইনপুট বা আপনার ভয়েস ব্যবহার করুন।",
    te: "ప్రారంభించడానికి దిగువ ఇన్‌పుట్ లేదా మీ వాయిస్‌ని ఉపయోగించండి।",
    mr: "प्रार���भ करण्यासाठी खालील इनपुट किंवा तुमचा आवाज वापरा।",
    ta: "தொடங்குவதற்கு கீழே உள்ள உள்ளீடு அல்லது உங்கள் குரலைப் பயன்படுத்தவும்।",
    gu: "શરૂ કરવા માટે નીચે આપેલ ઇનપુટ અથવા તમારા અવાજનો ઉપયોગ કરો।",
    kn: "ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಇನ್‌ಪುಟ್ ಅಥವಾ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಬಳಸಿ।",
};

const topicPlaceholderTranslations: Record<string, string> = {
    en: "e.g., 'Create a lesson plan for the Indian Monsoon'",
    hi: "उदा., 'भारतीय मानसून के लिए एक पाठ योजना बनाएं'",
    bn: "উদা., 'ভারতীয় বর্ষার জন্য একটি পাঠ পরিকল্পনা তৈরি করুন'",
    te: "ఉదా., 'భారతీయ రుతుపవన���ల కోసం ఒక పాఠ్య ప్రణాళికను సృష్టించండి'",
    mr: "उदा., 'भारतीय मान्सूनसाठी एक पाठ योजना तयार करा'",
    ta: "உதா., 'இந்திய பருவமழைக்கு ஒரு பாடம் திட்டம் உருவாக்கவும்'",
    gu: "દા.ત., 'ભારતીય ચોમાસા માટે એક પાઠ યોજના બનાવો'",
    kn: "ಉದಾ., 'ಭಾರತೀಯ ಮಾನ್ಸೂನ್‌ಗಾಗಿ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ'",
};

const gradeLevelLabelTranslations: Record<string, string> = {
    en: "Grade Level(s)",
    hi: "श्रेणी स्तर",
    bn: "শ্রেণী স্তর(গুলি)",
    te: "గ్రేడ్ స్థాయి(లు)",
    mr: "ग्रेड स्तर",
    ta: "வகுப்பு நிலை(கள்)",
    gu: "ગ્રેડ સ્તર",
    kn: "ಗ್ರೇಡ್ ಮಟ್ಟ(ಗಳು)",
};

const languageLabelTranslations: Record<string, string> = {
    en: "Language",
    hi: "भाषा",
    bn: "ভাষা",
    te: "భాష",
    mr: "भाषा",
    ta: "மொழி",
    gu: "ભાષા",
    kn: "ಭಾಷೆ",
};

const localContextLabelTranslations: Record<string, string> = {
    en: "Add Local Context",
    hi: "स्थानीय संदर्भ जोड़ें",
    bn: "স্থানীয় প্রসঙ্গ যোগ করুন",
    te: "స్థానిక సందర్భాన్ని జోడించండి",
    mr: "स्थानिक संदर्भ జోडा",
    ta: "உள்ளூர் சூழலைச் சேர்க்கவும்",
    gu: "સ્થાનિક સંદર્ભ ઉમેરો",
    kn: "ಸ್ಥಳೀಯ ಸಂದರ್ಭವನ್ನು ಸೇರಿಸಿ",
};

const localContextPlaceholderTranslations: Record<string, string> = {
    en: "e.g., Village name, local festival, specific historical event...",
    hi: "उदा., गांव का नाम, स्थानीय त्योहार, विशिष्ट ऐतिहासिक घटना...",
    bn: "উদাঃ, গ্রামের নাম, স্থানীয় উৎসব, নির্দিষ্ট ঐতিহাসিক ঘটনা...",
    te: "ఉదా., గ్రామ పేరు, స్థానిక పండుగ, నిర్దిష్ట చారిత్రక సంఘటన...",
    mr: "उदा., गावाचे नाव, स्थानिक सण, विशिष्ट ऐतिहासिक घटना...",
    ta: "எ.கா., கிராமத்தின் பெயர், உள்ளூர் திருவிழா, குறிப்பிட்ட வரலாற்று நிகழ்வு...",
    gu: "દા.ત., ગામનું નામ, સ્થાનિક તહેવાર, ચોક્કસ ઐતિહાસિક ઘટના...",
    kn: "ಉದಾ., ಗ್ರಾಮದ ಹೆಸರು, ಸ್ಥಳೀಯ ಹಬ್ಬ, ನಿರ್ದಿಷ್ಟ ಐತಿಹಾಸಿಕ ಘಟನೆ...",
};

const helpLabelTranslations: Record<string, string> = {
    en: "How can I help you?",
    hi: "मैं आपकी कैसे मदद कर सकता हूँ?",
    bn: "আমি আপনাকে কিভাবে সাহায্য করতে পারি?",
    te: "నేను మీకు ఎలా సహాయం చేయగలను?",
    mr: "मी तुम्हाला कशी मदत करू शकतो?",
    ta: "நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    gu: "હું તમને કેવી રીતે મદદ કરી શકું?",
    kn: "ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
};

const generatingButtonTranslations: Record<string, string> = {
    en: "Generating...",
    hi: "उत्पन्न हो रहा है...",
    bn: "জেনারেট করা হচ্ছে...",
    te: "జనరేట్ చేస్తోంది...",
    mr: "तयार करत आहे...",
    ta: "உருவாக்குகிறது...",
    gu: "જનરેટ કરી રહ્યું છે...",
    kn: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
};

const generateButtonTranslations: Record<string, string> = {
    en: "Generate",
    hi: "उत्पन्न करें",
    bn: "জেনারেট করুন",
    te: "సృష్టించు",
    mr: "तयार करा",
    ta: "உருவாக்கு",
    gu: "જનરેટ કરો",
    kn: "ರಚಿಸಿ",
};

const generationFailedToastTitleTranslations: Record<string, string> = {
    en: "Generation Failed",
    hi: "उत्पादन विफल",
    bn: "জেনারেট ব্যর্থ হয়েছে",
    te: "జనరేషన్ విఫలమైంది",
    mr: "निर्मिती अयशस्वी",
    ta: "உருவாக்கம் தோல்வியுற்றது",
    gu: "જનરેશન નિષ્ફળ",
    kn: "ಜನರೇಷನ್ ವಿಫಲವಾಗಿದೆ",
};

const generationFailedToastDescTranslations: Record<string, string> = {
    en: "There was an error generating the content. Please try again.",
    hi: "सामग्री उत्पन्न करने में एक त्रुटि हुई। कृपया पुन: प्रयास करें।",
    bn: "বিষয়বস্তু তৈরি করার সময় একটি ত্রুটি ছিল। আবার চেষ্টা করুন.",
    te: "కంటెంట్‌ను రూపొందించడంలో లోపం ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి.",
    mr: "सामग्री तयार करताना एक त्रुटी आली. कृपया पुन्हा प्रयत्न करा.",
    ta: "உள்ளடக்கத்தை உருவாக்குவதில் பிழை ஏற்பட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
    gu: "સામગ્રી જનરેટ કરવામાં ભૂલ ��તી. કૃપા કરીને ફરી પ્રયાસ કરો.",
    kn: "ವಿಷಯವನ್ನು ರಚಿಸುವಲ್ಲಿ ದೋಷವಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};

const answerCardTitleTranslations: Record<string, string> = {
    en: "Answer",
    hi: "उत्तर",
    bn: "উত্তর",
    te: "సమాధానం",
    mr: "उत्तर",
    ta: "பதில்",
    gu: "જવાબ",
    kn: "ಉತ್ತರ",
};

const sorryCardTitleTranslations: Record<string, string> = {
    en: "Sorry!",
    hi: "माफ़ करें!",
    bn: "দুঃখিত!",
    te: "క్షమించండి!",
    mr: "माफ करा!",
    ta: "மன்னிக்கவும்!",
    gu: "માફ કરશો!",
    kn: "ಕ್ಷಮಿಸಿ!",
};

export default function Home() {
  const [generationResult, setGenerationResult] = useState<AgentRouterOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevels: ["6th Grade"],
      localContext: "",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const description = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
  const topicPlaceholder = topicPlaceholderTranslations[selectedLanguage] || topicPlaceholderTranslations.en;
  const gradeLevelLabel = gradeLevelLabelTranslations[selectedLanguage] || gradeLevelLabelTranslations.en;
  const languageLabel = languageLabelTranslations[selectedLanguage] || languageLabelTranslations.en;
  const localContextLabel = localContextLabelTranslations[selectedLanguage] || localContextLabelTranslations.en;
  const localContextPlaceholder = localContextPlaceholderTranslations[selectedLanguage] || localContextPlaceholderTranslations.en;
  const helpLabel = helpLabelTranslations[selectedLanguage] || helpLabelTranslations.en;
  const generatingButton = generatingButtonTranslations[selectedLanguage] || generatingButtonTranslations.en;
  const generateButton = generateButtonTranslations[selectedLanguage] || generateButtonTranslations.en;
  const generationFailedToastTitle = generationFailedToastTitleTranslations[selectedLanguage] || generationFailedToastTitleTranslations.en;
  const generationFailedToastDesc = generationFailedToastDescTranslations[selectedLanguage] || generationFailedToastDescTranslations.en;
  const answerCardTitle = answerCardTitleTranslations[selectedLanguage] || answerCardTitleTranslations.en;
  const sorryCardTitle = sorryCardTitleTranslations[selectedLanguage] || sorryCardTitleTranslations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setGenerationResult(null);
    try {
      const result = await processAgentRequest({
        prompt: values.topic,
        language: values.language,
        gradeLevels: values.gradeLevels,
        localContext: values.localContext,
      });
      setGenerationResult(result);
    } catch (error) {
      console.error("Failed to generate content:", error);
      toast({
        title: generationFailedToastTitle,
        description: generationFailedToastDesc,
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
                      <FormLabel className="font-headline">{gradeLevelLabel}</FormLabel>
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
                      <FormLabel className="font-headline">{languageLabel}</FormLabel>
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
                name="localContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{localContextLabel}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={localContextPlaceholder}
                        {...field}
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
                    <FormLabel className="font-headline">{helpLabel}</FormLabel>
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
                    {generatingButton}
                  </>
                ) : (
                  generateButton
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {generationResult && (
        <div className="w-full">
          {generationResult.type === 'lessonPlan' && <LessonPlanDisplay lessonPlan={generationResult.result} />}
          {generationResult.type === 'quiz' && <QuizDisplay quiz={generationResult.result} />}
          {generationResult.type === 'instantAnswer' && (
            <Card className="w-full bg-white/50 backdrop-blur-md border-white/60 shadow-lg">
              <CardHeader>
                <CardTitle>{answerCardTitle}</CardTitle>
              </CardHeader>
              <CardContent className="prose">
                <ReactMarkdown>{generationResult.result.answer}</ReactMarkdown>
              </CardContent>
            </Card>
          )}
          {generationResult.type === 'unknown' && (
            <Card className="w-full bg-destructive/10 border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">{sorryCardTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{generationResult.result.error}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}