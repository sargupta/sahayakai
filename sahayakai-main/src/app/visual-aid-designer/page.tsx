
"use client";

import { generateVisualAid } from "@/ai/flows/visual-aid-designer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Download, Images, Save } from "lucide-react";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { MicrophoneInput } from "@/components/microphone-input";
import Image from "next/image";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { VisualAidDisplay } from "@/components/visual-aid-display";
import { SubjectSelector } from "@/components/subject-selector";
import type { VisualAidOutput } from "@/ai/flows/visual-aid-designer";



const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Visual Aid Designer",
    pageDescription: "Create simple black-and-white line drawings for your lessons.",
    descLabel: "Description",
    speakLabel: "Speak your description...",
    placeholder: "e.g., A simple diagram of the water cycle...",
    gradeLabel: "Grade Level",
    languageLabel: "Language",
    submitButton: "Generate Visual Aid",
    generating: "Generating...",
    generatingText: "Generating your visual aid... this may take a moment.",
    resultTitle: "Generated Image",
    saveButton: "Save",
    downloadButton: "Download",
    subjectLabel: "Subject"
  },
  hi: {
    pageTitle: "दृश्य सहायक डिज़ाइनर (Visual Aid Designer)",
    pageDescription: "अपने पाठों के लिए सरल श्वेत-श्याम रेखा चित्र बनाएं।",
    descLabel: "विवरण",
    speakLabel: "अपना विवरण बोलें...",
    placeholder: "जैसे, जल चक्र का एक सरल आरेख...",
    gradeLabel: "कक्षा स्तर",
    languageLabel: "भाषा",
    submitButton: "दृश्य सहायक (Visual Aid) उत्पन्न करें",
    generating: "उत्पन्न कर रहा है...",
    generatingText: "आपकी दृश्य सहायक सामग्री उत्पन्न कर रहा है... इसमें एक पल लग सकता है।",
    resultTitle: "उत्पन्न छवि",
    saveButton: "सहेजें",
    downloadButton: "डाउनलोड करें",
    subjectLabel: "विषय"
  },
  bn: {
    pageTitle: "ভিজ্যুয়াল এইড ডিজাইনার",
    pageDescription: "আপনার পাঠের জন্য সাধারণ সাদা-কালো রেখাচিত্র তৈরি করুন।",
    descLabel: "বিবরণ",
    speakLabel: "আপনার বিবরণ বলুন...",
    placeholder: "যেমন, জলচক্রের একটি সাধারণ চিত্র...",
    gradeLabel: "শ্রেণী",
    languageLabel: "ভাষা",
    submitButton: "ভিজ্যুয়াল এইড তৈরি করুন",
    generating: "তৈরি করা হচ্ছে...",
    generatingText: "আপনার ভিজ্যুয়াল এইড তৈরি করা হচ্ছে... এতে কিছুক্ষণ সময় লাগতে পারে।",
    resultTitle: "তৈরি করা ছবি",
    saveButton: "সংরক্ষণ করুন",
    downloadButton: "ডাউনলোড করুন"
  },
  te: {
    pageTitle: "విజువల్ ఎయిడ్ డిజైనర్",
    pageDescription: "మీ పాఠాల కోసం సాధారణ నలుపు-తెలుపు లైన్ డ్రాయింగ్‌లను సృష్టించండి.",
    descLabel: "వివరణ",
    speakLabel: "మీ వివరణను చెప్పండి...",
    placeholder: "ఉదా., నీటి చక్రం యొక్క సాధారణ రేఖాచిత్రం...",
    gradeLabel: "తరగతి స్థాయి",
    languageLabel: "భాష",
    submitButton: "విజువల్ ఎయిడ్‌ను సృష్టించు",
    generating: "సృష్టిస్తోంది...",
    generatingText: "మీ విజువల్ ఎయిడ్‌ను సృష్టిస్తోంది... దీనికి కొంత సమయం పట్టవచ్చు.",
    resultTitle: "సృష్టించబడిన చిత్రం",
    saveButton: "సేవ్ చేయండి",
    downloadButton: "డౌన్‌లోడ్ చేయండి"
  },
  mr: {
    pageTitle: "व्हिज्युअल एड डिझायनर",
    pageDescription: "आपल्या धड्यांसाठी साधे काळे-पांढरे रेषाचित्रे तयार करा.",
    descLabel: "वर्णन",
    speakLabel: "आपले वर्णन बोला...",
    placeholder: "उदा., जलचक्राची एक साधी आकृती...",
    gradeLabel: "इयत्ता",
    languageLabel: "भाषा",
    submitButton: "व्हिज्युअल एड तयार करा",
    generating: "तयार करत आहे...",
    generatingText: "तुमचे व्हिज्युअल एड तयार करत आहे... यास थोडा वेळ लागू शकतो.",
    resultTitle: "तयार केलेली प्रतिमा",
    saveButton: "जतन करा",
    downloadButton: "डाउनलोड करा"
  },
  ta: {
    pageTitle: "காட்சி உதவி வடிவமைப்பாளர்",
    pageDescription: "உங்கள் பாடங்களுக்கான எளிய கருப்பு-வெள்ளை வரி ஓவியங்களை உருவாக்கவும்.",
    descLabel: "விளக்கம்",
    speakLabel: "உங்கள் விளக்கத்தைப் பேசுங்கள்...",
    placeholder: "எ.கா., நீர் சுழற்சியின் எளிய வரைபடம்...",
    gradeLabel: "வகுப்பு நிலை",
    languageLabel: "மொழி",
    submitButton: "காட்சி உதவியை உருவாக்கு",
    generating: "உருவாக்குகிறது...",
    generatingText: "உங்கள் காட்சி உதவியை உருவாக்குகிறது... இதற்கு சிறிது நேரம் ஆகலாம்.",
    resultTitle: "உருவாக்கப்பட்ட படம்",
    saveButton: "சேமிக்கவும்",
    downloadButton: "பதிவிறக்கவும்"
  },
  gu: {
    pageTitle: "વિઝ્યુઅલ એઇડ ડિઝાઇનર",
    pageDescription: "તમારા પાઠ માટે સરળ બ્લેક-એન્ડ-વ્હાઇટ લાઇન ડ્રોઇંગ્સ બનાવો.",
    descLabel: "વર્ણન",
    speakLabel: "તમારું વર્ણન બોલો...",
    placeholder: "દા.ત., જળ ચક્રની એક સરળ આકૃતિ...",
    gradeLabel: "ધોરણ",
    languageLabel: "ભાષા",
    submitButton: "વિઝ્યુઅલ એઇડ બનાવો",
    generating: "બનાવી રહ્યું છે...",
    generatingText: "તમારી વિઝ્યુઅલ એઇડ બનાવી રહ્યું છે... આમાં થોડો સમય લાગી શકે છે.",
    resultTitle: "બનાવેલી છબી",
    saveButton: "સાચવો",
    downloadButton: "ડાઉનલોડ કરો"
  },
  kn: {
    pageTitle: "ವಿಶುವಲ್ ಏಡ್ ಡಿಸೈನರ್",
    pageDescription: "ನಿಮ್ಮ ಪಾಠಗಳಿಗಾಗಿ ಸರಳ ಕಪ್ಪು-ಬಿಳುಪು ರೇಖಾಚಿತ್ರಗಳನ್ನು ರಚಿಸಿ.",
    descLabel: "ವಿವರಣೆ",
    speakLabel: "ನಿಮ್ಮ ವಿವರಣೆಯನ್ನು ಮಾತನಾಡಿ...",
    placeholder: "ಉದಾ., ನೀರಿನ ಚಕ್ರದ ಸರಳ ರೇಖಾಚಿತ್ರ...",
    gradeLabel: "ದರ್ಜೆ ಮಟ್ಟ",
    languageLabel: "ಭಾಷೆ",
    submitButton: "ವಿಶುವಲ್ ಏಡ್ ರಚಿಸಿ",
    generating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    generatingText: "ನಿಮ್ಮ ವಿಶುವಲ್ ಏಡ್ ರಚಿಸಲಾಗುತ್ತಿದೆ... ಇದಕ್ಕೆ ಸ್ವಲ್ಪ ಸಮಯ ತೆಗೆದುಕೊಳ್ಳಬಹುದು.",
    resultTitle: "ರಚಿಸಿದ ಚಿತ್ರ",
    saveButton: "ಉಳಿಸಿ",
    downloadButton: "ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ"
  },
  pa: {
    pageTitle: "ਵਿਜ਼ੂਅਲ ਏਡ ਡਿਜ਼ਾਈਨਰ",
    pageDescription: "ਆਪਣੇ ਪਾਠਾਂ ਲਈ ਸਧਾਰਨ ਬਲੈਕ-ਐਂਡ-ਵਾਈਟ ਲਾਈਨ ਡਰਾਇੰਗ ਬਣਾਓ।",
    descLabel: "ਵੇਰਵਾ",
    speakLabel: "ਆਪਣਾ ਵੇਰਵਾ ਬੋਲੋ...",
    placeholder: "ਉਦਾਹਰਣ: ਜਲ ਚੱਕਰ ਦਾ ਇੱਕ ਸਧਾਰਨ ਚਿੱਤਰ...",
    gradeLabel: "ਜਮਾਤ",
    languageLabel: "ਭਾਸ਼ਾ",
    submitButton: "ਵਿਜ਼ੂਅਲ ਏਡ ਬਣਾਓ",
    generating: "ਬਣਾ ਰਿਹਾ ਹੈ...",
    generatingText: "ਤੁਹਾਡੀ ਵਿਜ਼ੂਅਲ ਏਡ ਬਣਾ ਰਿਹਾ ਹੈ... ਇਸ ਵਿੱਚ ਕੁਝ ਸਮਾਂ ਲੱਗ ਸਕਦਾ ਹੈ।",
    resultTitle: "ਬਣਾਈ ਗਈ ਤਸਵੀਰ",
    saveButton: "ਸੁਰੱਖਿਅਤ ਕਰੋ",
    downloadButton: "ਡਾਊਨਲੋਡ ਕਰੋ"
  },
  ml: {
    pageTitle: "വിഷ്വൽ എയ്ഡ് ഡിസൈനർ",
    pageDescription: "നിങ്ങളുടെ പാഠങ്ങൾക്കായി ലളിതമായ ബ്ലാക്ക് ആൻഡ് വൈറ്റ് ലൈൻ ഡ്രോയിംഗുകൾ സൃഷ്ടിക്കുക.",
    descLabel: "വിവരണം",
    speakLabel: "നിങ്ങളുടെ വിവരണം പറയുക...",
    placeholder: "ഉദാ: ജലചക്രത്തിൻ്റെ ഒരു ലളിതമായ രേഖാചിത്രം...",
    gradeLabel: "ക്ലാസ്",
    languageLabel: "ഭാഷ",
    submitButton: "വിഷ്വൽ എയ്ഡ് സൃഷ്ടിക്കുക",
    generating: "സൃഷ്ടിക്കുന്നു...",
    generatingText: "നിങ്ങളുടെ വിഷ്വൽ എയ്ഡ് സൃഷ്ടിക്കുന്നു... ഇതിന് ഒരു നിമിഷം എടുത്തേക്കാം.",
    resultTitle: "സൃഷ്ടിച്ച ചിത്രം",
    saveButton: "സേവ് ചെയ്യുക",
    downloadButton: "ഡൗൺലോഡ് ചെയ്യുക"
  },
  or: {
    pageTitle: "ଭିଜୁଆଲ୍ ଏଡ୍ ଡିଜାଇନର୍",
    pageDescription: "ଆପଣଙ୍କ ପାଠ ପାଇଁ ସରଳ କଳା-ଧଳା ରେଖା ଚିତ୍ର ତିଆରି କରନ୍ତୁ |",
    descLabel: "ବର୍ଣ୍ଣନା",
    speakLabel: "ଆପଣଙ୍କ ବର୍ଣ୍ଣନା କୁହନ୍ତୁ...",
    placeholder: "ଉଦାହରଣ: ଜଳ ଚକ୍ରର ଏକ ସରଳ ଚିତ୍ର...",
    gradeLabel: "ଶ୍ରେଣୀ",
    languageLabel: "ଭାଷା",
    submitButton: "ଭିଜୁଆଲ୍ ଏଡ୍ ତିଆରି କରନ୍ତୁ",
    generating: "ତିଆରି ଚାଲିଛି...",
    generatingText: "ଆପଣଙ୍କ ଭିଜୁଆଲ୍ ଏଡ୍ ତିଆରି ଚାଲିଛି... ଏଥିପାଇଁ କିଛି ସମୟ ଲାଗିପାରେ |",
    resultTitle: "ପ୍ରସ୍ତୁତ ଚିତ୍ର",
    saveButton: "ସଂରକ୍ଷଣ କରନ୍ତୁ",
    downloadButton: "ଡାଉନଲୋଡ୍ କରନ୍ତୁ"
  },
};

const formSchema = z.object({
  prompt: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

import { Suspense } from "react";

function VisualAidContent() {
  const { requireAuth, openAuthModal } = useAuth();
  const [visualAid, setVisualAid] = useState<VisualAidOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      language: "en",
      gradeLevel: "6th Grade",
      subject: "General",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;
  const searchParams = useSearchParams();

  // Ref to prevent double-submission in StrictMode or re-renders
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    const id = searchParams.get("id");
    const promptParam = searchParams.get("prompt") || searchParams.get("topic");

    if (id) {
      const fetchSavedContent = async () => {
        setIsLoading(true);
        try {
          const token = await auth.currentUser?.getIdToken();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          } else if (auth.currentUser?.uid === "dev-user") {
            headers["x-user-id"] = "dev-user";
          }

          const res = await fetch(`/api/content/get?id=${id}`, {
            headers: headers
          });
          if (res.ok) {
            const content = await res.json();
            if (content.data) {
              setVisualAid(content.data.imageDataUri ? content.data : { ...content.data, imageDataUri: content.data });
              form.reset({
                prompt: content.topic || content.title,
                gradeLevel: content.gradeLevel,
                language: content.language,
              });
            }
          }
        } catch (err) {
          console.error("Failed to load saved visual aid:", err);
          toast({
            title: "Load Failed",
            description: "Could not load the saved visual aid.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSavedContent();
    } else if (promptParam && !hasAutoSubmitted.current) {
      form.setValue("prompt", promptParam);
      hasAutoSubmitted.current = true;
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 100);
    }
  }, [searchParams, form, toast]);

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    setIsLoading(true);
    setVisualAid(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/visual-aid", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          prompt: values.prompt,
          language: values.language,
          gradeLevel: values.gradeLevel,
          subject: values.subject,
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to generate visual aids");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate visual aid");
      }

      const result = await res.json();
      setVisualAid(result);
    } catch (error) {
      console.error("Failed to generate visual aid:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the visual aid. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-primary" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary">
              <Images className="w-8 h-8" />
            </div>
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
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.descLabel}</FormLabel>
                    <div className="flex flex-col gap-4">
                      <MicrophoneInput
                        onTranscriptChange={(transcript) => {
                          field.onChange(transcript);
                        }}
                        iconSize="lg"
                        label={t.speakLabel}
                        className="bg-white/50 backdrop-blur-sm"
                      />
                      <FormControl>
                        <Textarea
                          placeholder={t.placeholder}
                          {...field}
                          className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="visual-aid" />

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
                      <FormLabel className="font-headline text-xs font-semibold text-slate-600">{t.subjectLabel || "Subject"}</FormLabel>
                      <FormControl>
                        <SubjectSelector
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
                    {t.generating}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </div>

      {
        isLoading && (
          <Card className="mt-8 w-full max-w-2xl bg-white border border-slate-200 shadow-sm rounded-2xl animate-fade-in-up">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{t.generatingText}</p>
            </CardContent>
          </Card>
        )
      }

      {
        visualAid && (
          <VisualAidDisplay
            visualAid={visualAid}
            title={form.getValues('prompt')}
            gradeLevel={form.getValues('gradeLevel')}
            language={form.getValues('language')}
          />
        )
      }
    </div>
  );
}

export default function VisualAidDesignerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <VisualAidContent />
    </Suspense>
  );
}
