
"use client";

import { instantAnswer } from "@/ai/flows/instant-answer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wand2, Youtube, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { MicrophoneInput } from "@/components/microphone-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';


const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Instant Answer",
    pageDescription: "Get quick, expert answers to your questions, powered by Google Search.",
    questionLabel: "Your Question",
    speakLabel: "Speak your question...",
    placeholder: "e.g., 'Explain photosynthesis to a 10-year-old...'",
    gradeLabel: "Grade Level",
    languageLabel: "Language",
    submitButton: "Get Instant Answer",
    loadingText: "Getting Answer...",
    searchingText: "Searching for the best answer...",
    answerTitle: "Your Answer",
    saveButton: "Save to Library",
    videoTitle: "Recommended Video",
    videoButton: "Watch on YouTube"
  },
  hi: {
    pageTitle: "त्वरित उत्तर",
    pageDescription: "Google खोज द्वारा संचालित, अपने प्रश्नों के त्वरित, विशेषज्ञ उत्तर प्राप्त करें।",
    questionLabel: "आपका प्रश्न",
    speakLabel: "अपना प्रश्न बोलें...",
    placeholder: "जैसे, '10 साल के बच्चे को प्रकाश संश्लेषण समझाएं...'",
    gradeLabel: "कक्षा स्तर",
    languageLabel: "भाषा",
    submitButton: "उत्तर प्राप्त करें",
    loadingText: "उत्तर प्राप्त कर रहा है...",
    searchingText: "सर्वोत्तम उत्तर की खोज कर रहा है...",
    answerTitle: "आपका उत्तर",
    saveButton: "लाइब्रेरी में सहेजें",
    videoTitle: "अनुशंसित वीडियो",
    videoButton: "YouTube पर देखें"
  },
  bn: {
    pageTitle: "তাত্ক্ষণিক উত্তর",
    pageDescription: "Google অনুসন্ধান দ্বারা চালিত, আপনার প্রশ্নের দ্রুত, বিশেষজ্ঞ উত্তর পান।",
    questionLabel: "আপনার প্রশ্ন",
    speakLabel: "আপনার প্রশ্ন বলুন...",
    placeholder: "যেমন, '১০ বছরের শিশুকে সালোকসংশ্লেষণ বোঝান...'",
    gradeLabel: "শ্রেণী",
    languageLabel: "ভাষা",
    submitButton: "উত্তর পান",
    loadingText: "উত্তর পাচ্ছেন...",
    searchingText: "সেরা উত্তরের জন্য অনুসন্ধান করা হচ্ছে...",
    answerTitle: "আপনার উত্তর",
    saveButton: "লাইব্রেরিতে সংরক্ষণ করুন",
    videoTitle: "প্রস্তাবিত ভিডিও",
    videoButton: "YouTube এ দেখুন"
  },
  te: {
    pageTitle: "తక్షణ సమాధానం",
    pageDescription: "Google శోధన ద్వారా ఆధారితం, మీ ప్రశ్నలకు శీఘ్ర, నిపుణుల సమాధానాలను పొందండి.",
    questionLabel: "మీ ప్రశ్న",
    speakLabel: "మీ ప్రశ్నను చెప్పండి...",
    placeholder: "ఉదా., '10 ఏళ్ల పిల్లవాడికి కిరణజన్య సంయోగక్రియను వివరించండి...'",
    gradeLabel: "తరగతి స్థాయి",
    languageLabel: "భాష",
    submitButton: "సమాధానం పొందండి",
    loadingText: "సమాధానం పొందుతున్నారు...",
    searchingText: "ఉత్తమ సమాధానం కోసం వెతుకుతోంది...",
    answerTitle: "మీ సమాధానం",
    saveButton: "లైబ్రరీలో సేవ్ చేయండి",
    videoTitle: "సిఫార్సు చేయబడిన వీడియో",
    videoButton: "YouTube లో చూడండి"
  },
  mr: {
    pageTitle: "त्वरित उत्तर",
    pageDescription: "Google शोधाद्वारे समर्थित, आपल्या प्रश्नांची त्वरित, तज्ञ उत्तरे मिळवा.",
    questionLabel: "आपला प्रश्न",
    speakLabel: "आपला प्रश्न बोला...",
    placeholder: "उदा., '10 वर्षांच्या मुलाला प्रकाशसंश्लेषण समजावून सांगा...'",
    gradeLabel: "इयत्ता",
    languageLabel: "भाषा",
    submitButton: "उत्तर मिळवा",
    loadingText: "उत्तर मिळवत आहे...",
    searchingText: "उत्तम उत्तर शोधत आहे...",
    answerTitle: "आपले उत्तर",
    saveButton: "लायब्ररीमध्ये जतन करा",
    videoTitle: "शिफारस केलेला व्हिडिओ",
    videoButton: "YouTube वर पहा"
  },
  ta: {
    pageTitle: "உடனடி பதில்",
    pageDescription: "கூகிள் தேடலால் இயக்கப்படுகிறது, உங்கள் கேள்விகளுக்கு விரைவான, நிபுணர் பதில்களைப் பெறுங்கள்.",
    questionLabel: "உங்கள் கேள்வி",
    speakLabel: "உங்கள் கேள்வியைப் பேசுங்கள்...",
    placeholder: "எ.கா., '10 வயது குழந்தைக்கு ஒளிச்சேர்க்கையை விளக்குங்கள்...'",
    gradeLabel: "வகுப்பு நிலை",
    languageLabel: "மொழி",
    submitButton: "பதில் பெறுங்கள்",
    loadingText: "பதில் பெறுகிறது...",
    searchingText: "சிறந்த பதிலைத் தேடுகிறது...",
    answerTitle: "உங்கள் பதில்",
    saveButton: "நூலகத்தில் சேமிக்கவும்",
    videoTitle: "பரிந்துரைக்கப்பட்ட வீடியோ",
    videoButton: "YouTube இல் பாருங்கள்"
  },
  gu: {
    pageTitle: "ત્વરિત જવાબ",
    pageDescription: "Google શોધ દ્વારા સંચાલિત, તમારા પ્રશ્નોના ઝડપી, નિષ્ણાત જવાબો મેળવો.",
    questionLabel: "તમારો પ્રશ્ન",
    speakLabel: "તમારો પ્રશ્ન બોલો...",
    placeholder: "દા.ત., '10 વર્ષના બાળકને પ્રકાશસંશ્લેષણ સમજાવો...'",
    gradeLabel: "ધોરણ",
    languageLabel: "ભાષા",
    submitButton: "જવાબ મેળવો",
    loadingText: "જવાબ મેળવી રહ્યા છે...",
    searchingText: "શ્રેષ્ઠ જવાબ શોધી રહ્યા છે...",
    answerTitle: "તમારો જવાબ",
    saveButton: "લાઇબ્રેરીમાં સાચવો",
    videoTitle: "ભલામણ કરેલ વિડિઓ",
    videoButton: "YouTube પર જુઓ"
  },
  kn: {
    pageTitle: "ತ್ವರಿತ ಉತ್ತರ",
    pageDescription: "Google ಹುಡುಕಾಟದಿಂದ ನಡೆಸಲ್ಪಡುವ, ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳಿಗೆ ತ್ವರಿತ, ತಜ್ಞ ಉತ್ತರಗಳನ್ನು ಪಡೆಯಿರಿ.",
    questionLabel: "ನಿಮ್ಮ ಪ್ರಶ್ನೆ",
    speakLabel: "ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಮಾತನಾಡಿ...",
    placeholder: "ಉದಾ., '10 ವರ್ಷದ ಮಗುವಿಗೆ ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯನ್ನು ವಿವರಿಸಿ...'",
    gradeLabel: "ದರ್ಜೆ ಮಟ್ಟ",
    languageLabel: "ಭಾಷೆ",
    submitButton: "ಉತ್ತರ ಪಡೆಯಿರಿ",
    loadingText: "ಉತ್ತರ ಪಡೆಯಲಾಗುತ್ತಿದೆ...",
    searchingText: "ಅತ್ಯುತ್ತಮ ಉತ್ತರಕ್ಕಾಗಿ ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
    answerTitle: "ನಿಮ್ಮ ಉತ್ತರ",
    saveButton: "ಲೈಬ್ರರಿಯಲ್ಲಿ ಉಳಿಸಿ",
    videoTitle: "ಶಿಫಾರಸು ಮಾಡಲಾದ ವೀಡಿಯೊ",
    videoButton: "YouTube ನಲ್ಲಿ ವೀಕ್ಷಿಸಿ"
  },
  pa: {
    pageTitle: "ਤੁਰੰਤ ਜਵਾਬ",
    pageDescription: "ਗੂਗਲ ਖੋਜ ਦੁਆਰਾ ਸੰਚਾਲਿਤ, ਆਪਣੇ ਪ੍ਰਸ਼ਨਾਂ ਦੇ ਤੇਜ਼, ਮਾਹਰ ਜਵਾਬ ਪ੍ਰਾਪਤ ਕਰੋ।",
    questionLabel: "ਤੁਹਾਡਾ ਪ੍ਰਸ਼ਨ",
    speakLabel: "ਆਪਣਾ ਪ੍ਰਸ਼ਨ ਬੋਲੋ...",
    placeholder: "ਉਦਾਹਰਣ: '10 ਸਾਲ ਦੇ ਬੱਚੇ ਨੂੰ ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਸਮਝਾਓ...'",
    gradeLabel: "ਜਮਾਤ",
    languageLabel: "ਭਾਸ਼ਾ",
    submitButton: "ਜਵਾਬ ਪ੍ਰਾਪਤ ਕਰੋ",
    loadingText: "ਜਵਾਬ ਪ੍ਰਾਪਤ ਕਰ ਰਿਹਾ ਹੈ...",
    searchingText: "ਵਧੀਆ ਜਵਾਬ ਲੱਭ ਰਿਹਾ ਹੈ...",
    answerTitle: "ਤੁਹਾਡਾ ਜਵਾਬ",
    saveButton: "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕਰੋ",
    videoTitle: "ਸਿਫਾਰਸ਼ ਕੀਤੀ ਵੀਡੀਓ",
    videoButton: "YouTube 'ਤੇ ਦੇਖੋ"
  },
  ml: {
    pageTitle: "തൽക്ഷണ ഉത്തരം",
    pageDescription: "Google തിരയൽ നൽകുന്ന, നിങ്ങളുടെ ചോദ്യങ്ങൾക്ക് വേഗത്തിലുള്ള, വിദഗ്ദ്ധ ഉത്തരങ്ങൾ നേടുക.",
    questionLabel: "നിങ്ങളുടെ ചോദ്യം",
    speakLabel: "നിങ്ങളുടെ ചോദ്യം പറയുക...",
    placeholder: "ഉദാ: '10 വയസ്സുള്ള കുട്ടിക്ക് പ്രകാശസംശ്ലേഷണം വിശദീകരിക്കുക...'",
    gradeLabel: "ക്ലാസ്",
    languageLabel: "ഭാഷ",
    submitButton: "ഉത്തരം നേടുക",
    loadingText: "ഉത്തരം ലഭിക്കുന്നു...",
    searchingText: "മികച്ച ഉത്തരത്തിനായി തിരയുന്നു...",
    answerTitle: "നിങ്ങളുടെ ഉത്തരം",
    saveButton: "ലൈബ്രറിയിൽ സേവ് ചെയ്യുക",
    videoTitle: "ശുപാർശ ചെയ്യുന്ന വീഡിയോ",
    videoButton: "YouTube-ൽ കാണുക"
  },
  or: {
    pageTitle: "ତୁରନ୍ତ ଉତ୍ତର",
    pageDescription: "Google ଅନୁସନ୍ଧାନ ଦ୍ୱାରା ଚାଳିତ, ଆପଣଙ୍କ ପ୍ରଶ୍ନର ଶୀଘ୍ର, ବିଶେଷଜ୍ଞ ଉତ୍ତର ପାଆନ୍ତୁ |",
    questionLabel: "ଆପଣଙ୍କ ପ୍ରଶ୍ନ",
    speakLabel: "ଆପଣଙ୍କ ପ୍ରଶ୍ନ କୁହନ୍ତୁ...",
    placeholder: "ଉଦାହରଣ: '10 ବର୍ଷର ପିଲାକୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାନ୍ତୁ...'",
    gradeLabel: "ଶ୍ରେଣୀ",
    languageLabel: "ଭାଷା",
    submitButton: "ଉତ୍ତର ପାଆନ୍ତୁ",
    loadingText: "ଉତ୍ତର ଆସୁଛି...",
    searchingText: "ସର୍ବୋତ୍ତମ ଉତ୍ତର ଖୋଜା ଚାଲିଛି...",
    answerTitle: "ଆପଣଙ୍କ ଉତ୍ତର",
    saveButton: "ଲାଇବ୍ରେରୀରେ ସଂରକ୍ଷଣ କରନ୍ତୁ",
    videoTitle: "ପରାମର୍ଶିତ ଭିଡିଓ",
    videoButton: "YouTube ରେ ଦେଖନ୍ତୁ"
  },
};

const formSchema = z.object({
  question: z.string().min(5, { message: "Question must be at least 5 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Answer = z.infer<typeof formSchema> & { answer: string; videoSuggestionUrl?: string };

export default function InstantAnswerPage() {
  const { requireAuth, openAuthModal } = useAuth();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
      gradeLevel: "6th Grade",
      subject: "General",
    },
  });

  /* Translations Helper */
  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    setIsLoading(true);
    setAnswer(null);
    try {
      const result = await instantAnswer({
        question: values.question,
        language: values.language,
        gradeLevel: values.gradeLevel,
        subject: values.subject,
      });
      setAnswer({ ...values, ...result } as Answer);
    } catch (error: any) {
      console.error("Failed to get answer:", error);
      if (error.message?.includes("unauthorized") || error.message?.includes("sign in")) {
        openAuthModal();
      }
      toast({
        title: "Answer Generation Failed",
        description: error.message || "There was an error getting an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("question", prompt);
    // form.trigger("question"); // Removed to prevent premature validation messaging
  };

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your answer has been saved to your personal library.",
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-[#FF9933]" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Wand2 className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription>
            {t.pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.questionLabel}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4">
                        <MicrophoneInput
                          onTranscriptChange={(transcript) => {
                            field.onChange(transcript);
                          }}
                          iconSize="lg"
                          label={t.speakLabel}
                          className="bg-white/50 backdrop-blur-sm"
                        />
                        <Textarea
                          placeholder={t.placeholder}
                          {...field}
                          className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="instant-answer" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">{t.gradeLabel}</FormLabel>
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
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">{t.languageLabel}</FormLabel>
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

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.loadingText}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </div>

      {isLoading && (
        <Card className="mt-8 w-full max-w-2xl bg-white border border-slate-200 shadow-sm rounded-2xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t.searchingText}</p>
          </CardContent>
        </Card>
      )}

      {answer && (
        <Card className="mt-8 w-full max-w-2xl bg-white border border-slate-200 shadow-sm rounded-2xl animate-fade-in-up">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="font-headline text-2xl">{t.answerTitle}</CardTitle>
                <CardDescription className="italic">For the question: "{answer.question}"</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {t.saveButton}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-lg max-w-none text-foreground">
              <ReactMarkdown>{answer.answer}</ReactMarkdown>
            </div>

            {answer.videoSuggestionUrl && (
              <div className="border-t border-primary/20 pt-4">
                <h3 className="font-headline text-lg mb-2">{t.videoTitle}</h3>
                <Link href={answer.videoSuggestionUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <Youtube className="h-10 w-10 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{t.videoButton}</p>
                    <p className="text-xs text-muted-foreground truncate">{answer.videoSuggestionUrl}</p>
                  </div>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
