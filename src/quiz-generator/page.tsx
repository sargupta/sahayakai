
"use client";

import { generateQuiz, QuizGeneratorOutput } from "@/ai/flows/quiz-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileSignature, Checkbox, BarChart2, MessageSquare, ListTodo, BrainCircuit, BotMessageSquare, Brain, Search, CircleHelp, DraftingCompass, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { ImageUploader } from "@/components/image-uploader";
import { QuizDisplay } from "@/components/quiz-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { Input } from "@/components/ui/input";
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
import { SelectableCard } from "@/components/selectable-card";
import { cn } from "@/lib/utils";

const questionTypesData = [
  { id: 'multiple_choice', icon: BarChart2 },
  { id: 'fill_in_the_blanks', icon: Pencil },
  { id: 'short_answer', icon: MessageSquare },
];

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
  questionTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one question type.",
  }),
  bloomsTaxonomyLevels: z.array(z.string()).optional(),
  gradeLevel: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const translations: Record<string, Record<string, any>> = {
  en: {
    pageTitle: "Quiz Generator",
    pageDescription: "Create a quiz on any topic, with various question types.",
    contextLabel: "Add Context (Optional Image)",
    topicLabel: "Topic",
    topicPlaceholder: "e.g., The life cycle of a butterfly, using the uploaded image.",
    numQuestionsLabel: "Number of Questions",
    questionTypesLabel: "Question Types",
    bloomsLabel: "Bloom's Taxonomy Levels",
    gradeLevelLabel: "Grade Level",
    languageLabel: "Language",
    submitButton: "Generate Quiz",
    submitButtonLoading: "Generating Quiz...",
    loadingText: "Preparing your quiz questions...",
    questionTypes: {
      multiple_choice: 'Multiple Choice',
      fill_in_the_blanks: 'Fill in the Blanks',
      short_answer: 'Short Answer',
    },
     blooms: {
        'Remember': 'Remember',
        'Understand': 'Understand',
        'Apply': 'Apply',
        'Analyze': 'Analyze',
        'Evaluate': 'Evaluate',
        'Create': 'Create',
    }
  },
  hi: {
    pageTitle: "क्विज़ जेनरेटर",
    pageDescription: "किसी भी विषय पर, विभिन्न प्रकार के प्रश्नों के साथ एक क्विज़ बनाएं।",
    contextLabel: "संदर्भ जोड़ें (वैकल्पिक छवि)",
    topicLabel: "विषय",
    topicPlaceholder: "उदा., अपलोड की गई छवि का उपयोग करते हुए, एक तितली का जीवन चक्र।",
    numQuestionsLabel: "प्रश्नों की संख्या",
    questionTypesLabel: "प्रश्न प्रकार",
    bloomsLabel: "ब्लूम की टैक्सोनॉमी स्तर",
    gradeLevelLabel: "श्रेणी स्तर",
    languageLabel: "भाषा",
    submitButton: "क्विज़ बनाएं",
    submitButtonLoading: "क्विज़ बना रहा है...",
    loadingText: "आपके प्रश्न तैयार किए जा रहे हैं...",
    questionTypes: {
      multiple_choice: 'बहुविकल्पीय',
      fill_in_the_blanks: 'रिक्त स्थान भरें',
      short_answer: 'संक्षिप्त उत्तर',
    },
    blooms: {
        'Remember': 'याद रखें',
        'Understand': 'समझें',
        'Apply': 'लागू करें',
        'Analyze': 'विश्लेषण करें',
        'Evaluate': 'मूल्यांकन करें',
        'Create': 'बनाएं',
    }
  },
  bn: {
    pageTitle: "কুইজ জেনারেটর",
    pageDescription: "যেকোনো বিষয়ে, বিভিন্ন ধরনের প্রশ্ন সহ একটি কুইজ তৈরি করুন।",
    contextLabel: "প্রসঙ্গ যোগ করুন (ঐচ্ছিক ছবি)",
    topicLabel: "বিষয়",
    topicPlaceholder: "উদাঃ, আপলোড করা ছবি ব্যবহার করে একটি প্রজাপতির জীবনচক্র।",
    numQuestionsLabel: "প্রশ্নের সংখ্যা",
    questionTypesLabel: "প্রশ্নের প্রকার",
    bloomsLabel: "ব্লুমের শ্রেণীবিন্যাস স্তর",
    gradeLevelLabel: "শ্রেণী স্তর",
    languageLabel: "ভাষা",
    submitButton: "কুইজ তৈরি করুন",
    submitButtonLoading: "কুইজ তৈরি করা হচ্ছে...",
    loadingText: "আপনার প্রশ্ন প্রস্তুত করা হচ্ছে...",
    questionTypes: {
        multiple_choice: 'বহু নির্বাচনী',
        fill_in_the_blanks: 'শূন্যস্থান পূরণ করুন',
        short_answer: 'সংক্ষিপ্ত উত্তর',
    },
    blooms: {
        'Remember': 'মনে রাখবেন',
        'Understand': 'বুঝুন',
        'Apply': 'প্রয়োগ করুন',
        'Analyze': 'বিশ্লেষণ করুন',
        'Evaluate': 'মূল্যায়ন করুন',
        'Create': 'তৈরি করুন',
    },
  },
  te: {
    pageTitle: "క్విజ్ జనరేటర్",
    pageDescription: "ఏదైనా అంశంపై, వివిధ రకాల ప్రశ్నలతో క్విజ్ సృష్టించండి.",
    contextLabel: "సందర్భాన్ని జోడించండి (ఐచ్ఛిక చిత్రం)",
    topicLabel: "అంశం",
    topicPlaceholder: "ఉదా., అప్‌లోడ్ చేసిన చిత్రాన్ని ఉపయోగించి సీతాకోకచిలుక జీవిత చక్రం.",
    numQuestionsLabel: "ప్రశ్నల సంఖ్య",
    questionTypesLabel: "ప్రశ్న రకాలు",
    bloomsLabel: "బ్లూమ్ యొక్క వర్గీకరణ స్థాయిలు",
    gradeLevelLabel: "గ్రేడ్ స్థాయి",
    languageLabel: "భాష",
    submitButton: "క్విజ్ సృష్టించు",
    submitButtonLoading: "క్విజ్ సృష్టిస్తోంది...",
    loadingText: "మీ ప్రశ్నలు సిద్ధమవుతున్నాయి...",
    questionTypes: {
        multiple_choice: 'బహుళ ఎంపిక',
        fill_in_the_blanks: 'ఖాళీలను పూరించండి',
        short_answer: 'చిన్న సమాధానం',
    },
    blooms: {
        'Remember': 'గుర్తుంచుకోండి',
        'Understand': 'అర్థం చేసుకోండి',
        'Apply': 'వర్తించు',
        'Analyze': 'విశ్లేషించండి',
        'Evaluate': 'మూల్యాంకనం చేయండి',
        'Create': 'సృష్టించండి',
    },
  },
  mr: {
    pageTitle: "क्विझ जनरेटर",
    pageDescription: "कोणत्याही विषयावर, विविध प्रकारच्या प्रश्नांसह एक क्विझ तयार करा.",
    contextLabel: "संदर्भ जोडा (पर्यायी प्रतिमा)",
    topicLabel: "विषय",
    topicPlaceholder: "उदा., अपलोड केलेल्या प्रतिमेचा वापर करून फुलपाखराचे जीवनचक्र.",
    numQuestionsLabel: "प्रश्नांची संख्या",
    questionTypesLabel: "प्रश्न प्रकार",
    bloomsLabel: "ब्लूमचे वर्गीकरण स्तर",
    gradeLevelLabel: "इयत्ता स्तर",
    languageLabel: "भाषा",
    submitButton: "क्विझ तयार करा",
    submitButtonLoading: "क्विझ तयार करत आहे...",
    loadingText: "तुमचे प्रश्न तयार होत आहेत...",
    questionTypes: {
        multiple_choice: 'बहुपर्यायी',
        fill_in_the_blanks: 'रिकाम्या जागा भरा',
        short_answer: 'थोडक्यात उत्तर',
    },
    blooms: {
        'Remember': 'लक्षात ठेवा',
        'Understand': 'समजून घ्या',
        'Apply': 'लागू करा',
        'Analyze': 'विश्लेषण करा',
        'Evaluate': 'मूल्यांकन करा',
        'Create': 'तयार करा',
    },
  },
  ta: {
    pageTitle: "வினாடி வினா ஜெனரேட்டர்",
    pageDescription: "எந்தவொரு தலைப்பிலும், பல்வேறு வகையான கேள்விகளுடன் ஒரு வினாடி வினாவை உருவாக்கவும்.",
    contextLabel: "சூழலைச் சேர்க்கவும் (விருப்பப் படம்)",
    topicLabel: "தலைப்பு",
    topicPlaceholder: "எ.கா., பதிவேற்றிய படத்தைப் பயன்படுத்தி ஒரு பட்டாம்பூச்சியின் வாழ்க்கைச் சுழற்சி.",
    numQuestionsLabel: "கேள்விகளின் எண்ணிக்கை",
    questionTypesLabel: "கேள்வி வகைகள்",
    bloomsLabel: "ப்ளூமின் வகைப்பாடு நிலைகள்",
    gradeLevelLabel: "தர நிலை",
    languageLabel: "மொழி",
    submitButton: "வினாடி வினாவை உருவாக்கவும்",
    submitButtonLoading: "வினாடி வினாவை உருவாக்குகிறது...",
    loadingText: "உங்கள் கேள்விகள் தயாரிக்கப்படுகின்றன...",
    questionTypes: {
        multiple_choice: 'பல தேர்வு',
        fill_in_the_blanks: 'வெற்றிடங்களை நிரப்புக',
        short_answer: 'குறுகிய பதில்',
    },
    blooms: {
        'Remember': 'நினைவில் கொள்ளுங்கள்',
        'Understand': ' புரிந்து கொள்ளுங்கள்',
        'Apply': 'விண்ணப்பிக்கவும்',
        'Analyze': 'பகுப்பாய்வு செய்யுங்கள்',
        'Evaluate': 'மதிப்பிடுங்கள்',
        'Create': 'உருவாக்கு',
    },
  },
  gu: {
    pageTitle: "ક્વિઝ જનરેટર",
    pageDescription: "કોઈપણ વિષય પર, વિવિધ પ્રકારના પ્રશ્નો સાથે ક્વિઝ બનાવો.",
    contextLabel: "સંદર્ભ ઉમેરો (વૈકલ્પિક છબી)",
    topicLabel: "વિષય",
    topicPlaceholder: "દા.ત., અપલોડ કરેલી છબીનો ઉપયોગ કરીને પતંગિયાનું જીવનચક્ર.",
    numQuestionsLabel: "પ્રશ્નોની સંખ્યા",
    questionTypesLabel: "પ્રશ્ન પ્રકારો",
    bloomsLabel: "બ્લૂમની વર્ગીકરણ સ્તર",
    gradeLevelLabel: "ગ્રેડ સ્તર",
    languageLabel: "ભાષા",
    submitButton: "ક્વિઝ બનાવો",
    submitButtonLoading: "ક્વિઝ બનાવી રહ્યું છે...",
    loadingText: "તમારા પ્રશ્નો તૈયાર કરવામાં આવી રહ્યા છે...",
    questionTypes: {
        multiple_choice: 'બહુવિધ પસંદગી',
        fill_in_the_blanks: 'ખાલી જગ્યા ભરો',
        short_answer: 'ટૂંકો જવાબ',
    },
    blooms: {
        'Remember': 'યાદ રાખો',
        'Understand': 'સમજો',
        'Apply': 'લાગુ કરો',
        'Analyze': 'વિશ્લેષણ કરો',
        'Evaluate': 'મૂલ્યાંકન કરો',
        'Create': 'બનાવો',
    },
  },
  kn: {
    pageTitle: "ಕ್ವಿಜ್ ಜನರೇಟರ್",
    pageDescription: "ಯಾವುದೇ ವಿಷಯದ ಮೇಲೆ, ವಿವಿಧ ರೀತಿಯ ಪ್ರಶ್ನೆಗಳೊಂದಿಗೆ ಒಂದು ರಸಪ್ರಶ್ನೆಯನ್ನು ರಚಿಸಿ.",
    contextLabel: "ಸಂದರ್ಭವನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ ಚಿತ್ರ)",
    topicLabel: "ವಿಷಯ",
    topicPlaceholder: "ಉದಾ., ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಚಿತ್ರವನ್ನು ಬಳಸಿ ಚಿಟ್ಟೆಯ ಜೀವನ ಚಕ್ರ.",
    numQuestionsLabel: "ಪ್ರಶ್ನೆಗಳ ಸಂಖ್ಯೆ",
    questionTypesLabel: "ಪ್ರಶ್ನೆ ಪ್ರಕಾರಗಳು",
    bloomsLabel: "ಬ್ಲೂಮ್ ಅವರ ವರ್ಗೀಕರಣ ಮಟ್ಟಗಳು",
    gradeLevelLabel: "ದರ್ಜೆ ಮಟ್ಟ",
    languageLabel: "ಭಾಷೆ",
    submitButton: "ರಸಪ್ರಶ್ನೆ ರಚಿಸಿ",
    submitButtonLoading: "ರಸಪ್ರಶ್ನೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    loadingText: "ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...",
    questionTypes: {
        multiple_choice: 'ಬಹು ಆಯ್ಕೆ',
        fill_in_the_blanks: 'ಖಾಲಿ ಜಾಗಗಳನ್ನು ತುಂಬಿರಿ',
        short_answer: 'ಸಣ್ಣ ಉತ್ತರ',
    },
    blooms: {
        'Remember': 'ನೆನಪಿಡಿ',
        'Understand': 'ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
        'Apply': 'ಅನ್ವಯಿಸಿ',
        'Analyze': 'ವಿಶ್ಲೇಷಿಸಿ',
        'Evaluate': 'ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ',
        'Create': 'ರಚಿಸಿ',
    },
  },
};


export default function QuizGeneratorPage() {
  const [quiz, setQuiz] = useState<QuizGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "5th Grade",
      numQuestions: 5,
      questionTypes: ["multiple_choice", "short_answer"],
      bloomsTaxonomyLevels: ['Remember', 'Understand'],
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setQuiz(null);
    try {
      const result = await generateQuiz({ ...values, language: selectedLanguage });
      setQuiz(result);
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("topic", prompt);
    form.trigger("topic");
  };

  const handleTranscript = (transcript: string) => {
    form.setValue("topic", transcript);
    form.trigger("topic");
  };


  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <FileSignature className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription>{t.pageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="imageDataUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.contextLabel}</FormLabel>
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
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.topicLabel}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t.topicPlaceholder}
                        {...field}
                        className="bg-white/50 backdrop-blur-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <MicrophoneInput onTranscriptChange={handleTranscript} />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="quiz" />

                <FormField
                  control={form.control}
                  name="questionTypes"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-headline">{t.questionTypesLabel}</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        {questionTypesData.map((item) => (
                           <SelectableCard
                                key={item.id}
                                icon={item.icon}
                                label={t.questionTypes[item.id]}
                                isSelected={field.value?.includes(item.id)}
                                onSelect={() => {
                                    const currentValues = field.value || [];
                                    const newValues = currentValues.includes(item.id)
                                    ? currentValues.filter((v) => v !== item.id)
                                    : [...currentValues, item.id];
                                    field.onChange(newValues);
                                }}
                            />
                        ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                control={form.control}
                name="bloomsTaxonomyLevels"
                render={() => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.bloomsLabel}</FormLabel>
                     <div className="flex flex-wrap gap-3 pt-2">
                      {bloomsLevelsData.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="bloomsTaxonomyLevels"
                          render={({ field }) => {
                            return (
                              <FormItem key={item.id} className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Button 
                                    type="button"
                                    variant={field.value?.includes(item.id) ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "rounded-full h-8 px-4 text-xs font-normal",
                                        field.value?.includes(item.id) && "bg-blue-600 hover:bg-blue-700 text-white"
                                    )}
                                    onClick={() => {
                                       const currentValues = field.value || [];
                                        const newValues = currentValues.includes(item.id)
                                        ? currentValues.filter((v) => v !== item.id)
                                        : [...currentValues, item.id];
                                        field.onChange(newValues);
                                    }}
                                  >
                                    <CheckboxUI
                                        checked={field.value?.includes(item.id)}
                                        className="mr-2 h-3 w-3 border-current"
                                    />
                                    {t.blooms[item.id]}
                                  </Button>
                                </FormControl>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
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
                      <FormLabel className="font-headline">{t.gradeLevelLabel}</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={[field.value || "5th Grade"]}
                          onValueChange={(values) => field.onChange(values?.[0])}
                          language={selectedLanguage}
                          isMulti={false}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">{t.languageLabel}</FormLabel>
                      <FormControl>
                        <LanguageSelector
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                  control={form.control}
                  name="numQuestions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">{t.numQuestionsLabel}</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="20" {...field} className="bg-white/50 backdrop-blur-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.submitButtonLoading}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {quiz && <QuizDisplay quiz={quiz} />}
    </div>
  );
}
