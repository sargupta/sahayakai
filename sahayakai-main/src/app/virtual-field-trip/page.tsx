
"use client";
import { planVirtualFieldTrip, VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Globe2, Send, MapPin, Save } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { MicrophoneInput } from "@/components/microphone-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { VirtualFieldTripDisplay } from "@/components/virtual-field-trip-display";
import { SubjectSelector } from "@/components/subject-selector";



const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Virtual Field Trip",
    pageDescription: "Plan exciting virtual tours for your students using Google Earth.",
    topicLabel: "Trip Topic",
    speakLabel: "Speak your trip idea...",
    placeholder: "e.g., 'A tour of the major centers of the Harappan Civilization...'",
    gradeLabel: "Grade Level",
    languageLabel: "Language",
    submitButton: "Generate",
    generating: "Generating Itinerary...",
    planningText: "Planning your virtual adventure...",
    saveButton: "Save to Library",
    visitButton: "Visit on Google Earth",
    subjectLabel: "Subject"
  },
  hi: {
    pageTitle: "आभासी क्षेत्र भ्रमण",
    pageDescription: "Google Earth का उपयोग करके अपने छात्रों के लिए रोमांचक आभासी दौरों की योजना बनाएं।",
    topicLabel: "यात्रा का विषय",
    speakLabel: "अपनी यात्रा का विचार बोलें...",
    placeholder: "जैसे, 'हड़प्पा सभ्यता के प्रमुख केंद्रों का दौरा...'",
    gradeLabel: "कक्षा स्तर",
    languageLabel: "भाषा",
    submitButton: "उत्पन्न करें",
    generating: "यात्रा कार्यक्रम बना रहा है...",
    planningText: "आपकी आभासी साहसिक यात्रा की योजना बना रहा है...",
    saveButton: "लाइब्रेरी में सहेजें",
    visitButton: "Google Earth पर जाएँ",
    subjectLabel: "विषय"
  },
  bn: {
    pageTitle: "ভার্চুয়াল ফিল্ড ট্রিপ",
    pageDescription: "Google Earth ব্যবহার করে আপনার ছাত্রদের জন্য উত্তেজনাপূর্ণ ভার্চুয়াল ট্যুরের পরিকল্পনা করুন।",
    topicLabel: "ভ্রমণের বিষয়",
    speakLabel: "আপনার ভ্রমণের ধারণা বলুন...",
    placeholder: "যেমন, 'হরপ্পা সভ্যতার প্রধান কেন্দ্রগুলি ভ্রমণ...'",
    gradeLabel: "শ্রেণী",
    languageLabel: "ভাষা",
    submitButton: "তৈরি করুন",
    generating: "ভ্রমণসূচী তৈরি করা হচ্ছে...",
    planningText: "আপনার ভার্চুয়াল অভিযানের পরিকল্পনা করা হচ্ছে...",
    saveButton: "লাইব্রেরিতে সংরক্ষণ করুন",
    visitButton: "Google Earth এ যান"
  },
  te: {
    pageTitle: "వర్చువల్ ఫీల్డ్ ట్రిప్",
    pageDescription: "Google Earth ఉపయోగించి మీ విద్యార్థుల కోసం ఉత్తేజకరమైన వర్చువల్ పర్యటనలను ప్లాన్ చేయండి.",
    topicLabel: "పర్యటన అంశం",
    speakLabel: "మీ పర్యటన ఆలోచనను చెప్పండి...",
    placeholder: "ఉదా., 'హరప్పా నాగరికత యొక్క ప్రధాన కేంద్రాల పర్యటన...'",
    gradeLabel: "తరగతి స్థాయి",
    languageLabel: "భాష",
    submitButton: "సృష్టించు",
    generating: "ప్రయాణ ప్రణాళికను సృష్టిస్తోంది...",
    planningText: "మీ వర్చువల్ అడ్వెంచర్‌ను ప్లాన్ చేస్తోంది...",
    saveButton: "లైబ్రరీలో సేవ్ చేయండి",
    visitButton: "Google Earth లో సందర్శించండి"
  },
  mr: {
    pageTitle: "आभासी क्षेत्र सहल",
    pageDescription: "Google Earth वापरून आपल्या विद्यार्थ्यांसाठी रोमांचक आभासी सहलींचे नियोजन करा.",
    topicLabel: "सहलीचा विषय",
    speakLabel: "आपली सहल कल्पना बोला...",
    placeholder: "उदा., 'हडप्पा संस्कृतीच्या प्रमुख केंद्रांचा दौरा...'",
    gradeLabel: "इयत्ता",
    languageLabel: "भाषा",
    submitButton: "तयार करा",
    generating: "प्रवास कार्यक्रम तयार करत आहे...",
    planningText: "तुमच्या आभासी साहसाचे नियोजन करत आहे...",
    saveButton: "लायब्ररीमध्ये जतन करा",
    visitButton: "Google Earth वर भेट द्या"
  },
  ta: {
    pageTitle: "மெய்நிகர் களப்பயணம்",
    pageDescription: "Google Earth ஐப் பயன்படுத்தி உங்கள் மாணவர்களுக்கு அற்புதமான மெய்நிகர் சுற்றுப்பயணங்களைத் திட்டமிடுங்கள்.",
    topicLabel: "பயணத் தலைப்பு",
    speakLabel: "உங்கள் பயண யோசனையைப் பேசுங்கள்...",
    placeholder: "எ.கா., 'ஹரப்பா நாகரிகத்தின் முக்கிய மையங்களுக்கு ஒரு பயணம்...'",
    gradeLabel: "வகுப்பு நிலை",
    languageLabel: "மொழி",
    submitButton: "உருவாக்கு",
    generating: "பயணத்திட்டத்தை உருவாக்குகிறது...",
    planningText: "உங்கள் மெய்நிகர் சாகசத்தைத் திட்டமிடுகிறது...",
    saveButton: "நூலகத்தில் சேமிக்கவும்",
    visitButton: "Google Earth இல் பார்வையிடவும்"
  },
  gu: {
    pageTitle: "વર્ચ્યુઅલ ફીલ્ડ ટ્રિપ",
    pageDescription: "Google Earth નો ઉપયોગ કરીને તમારા વિદ્યાર્થીઓ માટે આકર્ષક વર્ચ્યુઅલ ટુરની યોજના બનાવો.",
    topicLabel: "ટ્રિપ વિષય",
    speakLabel: "તમારો ટ્રિપ વિચાર બોલો...",
    placeholder: "દા.ત., 'હડપ્પીય સંસ્કૃતિના મુખ્ય કેન્દ્રોની મુલાકાત...'",
    gradeLabel: "ધોરણ",
    languageLabel: "ભાષા",
    submitButton: "બનાવો",
    generating: "પ્રવાસ કાર્યક્રમ બનાવી રહ્યું છે...",
    planningText: "તમારા વર્ચ્યુઅલ સાહસનું આયોજન કરી રહ્યું છે...",
    saveButton: "લાઇબ્રેરીમાં સાચવો",
    visitButton: "Google Earth પર મુલાકાત લો"
  },
  kn: {
    pageTitle: "ವರ್ಚುವಲ್ ಫೀಲ್ಡ್ ಟ್ರಿಪ್",
    pageDescription: "Google Earth ಬಳಸಿಕೊಂಡು ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ರೋಮಾಂಚಕಾರಿ ವರ್ಚುವಲ್ ಪ್ರವಾಸಗಳನ್ನು ಯೋಜಿಸಿ.",
    topicLabel: "ಪ್ರವಾಸದ ವಿಷಯ",
    speakLabel: "ನಿಮ್ಮ ಪ್ರವಾಸ ಕಲ್ಪನೆಯನ್ನು ಮಾತನಾಡಿ...",
    placeholder: "ಉದಾ., 'ಹರಪ್ಪನ್ ನಾಗರೀಕತೆಯ ಪ್ರಮುಖ ಕೇಂದ್ರಗಳ ಪ್ರವಾಸ...'",
    gradeLabel: "ದರ್ಜೆ ಮಟ್ಟ",
    languageLabel: "ಭಾೆ",
    submitButton: "ರಚಿಸಿ",
    generating: "ಪ್ರವಾಸದ ವಿವರವನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    planningText: "ನಿಮ್ಮ ವರ್ಚುವಲ್ ಸಾಹಸವನ್ನು ಯೋಜಿಸುತ್ತಿದೆ...",
    saveButton: "ಲೈಬ್ರರಿಯಲ್ಲಿ ಉಳಿಸಿ",
    visitButton: "Google Earth ನಲ್ಲಿ ಭೇಟಿ ನೀಡಿ"
  },
  pa: {
    pageTitle: "ਵਰਚੁਅਲ ਫੀਲਡ ਟ੍ਰਿਪ",
    pageDescription: "Google Earth ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਆਪਣੇ ਵਿਦਿਆਰਥੀਆਂ ਲਈ ਰੋਮਾਂਚਕ ਵਰਚੁਅਲ ਟੂਰਾਂ ਦੀ ਯੋਜਨਾ ਬਣਾਓ।",
    topicLabel: "ਟ੍ਰਿਪ ਵਿਸ਼ਾ",
    speakLabel: "ਆਪਣਾ ਟ੍ਰਿਪ ਵਿਚਾਰ ਬੋਲੋ...",
    placeholder: "ਉਦਾਹਰਣ: 'ਹੜੱਪਾ ਸੱਭਿਅਤਾ ਦੇ ਮੁੱਖ ਕੇਂਦਰਾਂ ਦਾ ਟੂਰ...'",
    gradeLabel: "ਜਮਾਤ",
    languageLabel: "ਭਾਸ਼ਾ",
    submitButton: "ਬਣਾਓ",
    generating: "ਯਾਤਰਾ ਯੋਜਨਾ ਬਣਾ ਰਿਹਾ ਹੈ...",
    planningText: "ਤੁਹਾਡੇ ਵਰਚੁਅਲ ਸਾਹਸ ਦੀ ਯੋਜਨਾ ਬਣਾ ਰਿਹਾ ਹੈ...",
    saveButton: "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕਰੋ",
    visitButton: "Google Earth 'ਤੇ ਜਾਓ"
  },
  ml: {
    pageTitle: "വെർച്വൽ ഫീൽഡ് ട്രിപ്പ്",
    pageDescription: "Google Earth ഉപയോഗിച്ച് നിങ്ങളുടെ വിദ്യാർത്ഥികൾക്കായി ആവേശകരമായ വെർച്വൽ ടൂറുകൾ ആസൂത്രണം ചെയ്യുക.",
    topicLabel: "യാത്രാ വിഷയം",
    speakLabel: "നിങ്ങളുടെ യാത്രാ ആശയം പറയുക...",
    placeholder: "ഉദാ: 'ഹാരപ്പൻ സംസ്കാരത്തിൻ്റെ പ്രധാന കേന്ദ്രങ്ങളിലേക്കുള്ള ഒരു യാത്ര...'",
    gradeLabel: "ക്ലാസ്",
    languageLabel: "ഭാഷ",
    submitButton: "സൃഷ്ടിക്കുക",
    generating: "യാത്രാ പദ്ധതി തയ്യാറാക്കുന്നു...",
    planningText: "നിങ്ങളുടെ വെർച്വൽ സാഹസികത ആസൂത്രണം ചെയ്യുന്നു...",
    saveButton: "ലൈബ്രറിയിൽ സേവ് ചെയ്യുക",
    visitButton: "Google Earth സന്ദർശിക്കുക"
  },
  or: {
    pageTitle: "ଭର୍ଚୁଆଲ୍ ଫିଲ୍ଡ ଟ୍ରିପ୍",
    pageDescription: "Google Earth ବ୍ୟବହାର କରି ଆପଣଙ୍କ ଛାତ୍ରମାନଙ୍କ ପାଇଁ ରୋମାଞ୍ଚକର ଭର୍ଚୁଆଲ୍ ଟୁର୍ ଯୋଜନା କରନ୍ତୁ |",
    topicLabel: "ଯାତ୍ରା ବିଷୟ",
    speakLabel: "ଆପଣଙ୍କ ଯାତ୍ରା ଧାରଣା କୁହନ୍ତୁ...",
    placeholder: "ଉଦାହରଣ: 'ହରପ୍ପା ସଭ୍ୟତାର ପ୍ରମୁଖ କେନ୍ଦ୍ରଗୁଡିକର ଏକ ଯାତ୍ରା...'",
    gradeLabel: "ଶ୍ରେଣୀ",
    languageLabel: "ଭାଷା",
    submitButton: "ତିଆରି କରନ୍ତୁ",
    generating: "ଯାତ୍ରା ଯୋଜନା ତିଆରି ଚାଲିଛି...",
    planningText: "ଆପଣଙ୍କ ଭର୍ଚୁଆଲ୍ ଦୁଃସାହସିକ ଯାତ୍ରା ଯୋଜନା କରାଯାଉଛି...",
    saveButton: "ଲାଇବ୍ରେରୀରେ ସଂରକ୍ଷଣ କରନ୍ତୁ",
    visitButton: "Google Earth ରେ ଦେଖନ୍ତୁ"
  },
};

const formSchema = z.object({
  topic: z.string().min(10, { message: "Topic must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function VirtualFieldTripContent() {
  const { requireAuth, openAuthModal } = useAuth();
  const [trip, setTrip] = useState<VirtualFieldTripOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "8th Grade",
      subject: "General",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id");
    const topicParam = searchParams.get("topic");

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
              setTrip(content.data);
              form.reset({
                topic: content.topic || content.title,
                gradeLevel: content.gradeLevel,
                language: content.language,
              });
            }
          }
        } catch (err) {
          console.error("Failed to load saved field trip:", err);
          toast({
            title: "Load Failed",
            description: "Could not load the saved field trip.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSavedContent();
    } else if (topicParam) {
      form.setValue("topic", topicParam);
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 0);
    }
  }, [searchParams, form, toast]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setTrip(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/virtual-field-trip", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          topic: values.topic,
          language: values.language,
          gradeLevel: values.gradeLevel,
          subject: values.subject,
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to generate virtual field trips");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate virtual field trip");
      }

      const result = await res.json();
      setTrip(result);
    } catch (error) {
      console.error("Failed to plan trip:", error);
      toast({
        title: "Planning Failed",
        description: "There was an error planning the virtual trip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("topic", prompt);
    // form.trigger("topic"); // Removed to prevent premature interaction
  };


  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-primary" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Globe2 className="w-12 h-12 text-primary" />
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
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.topicLabel}</FormLabel>
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

              <div className="p-3 bg-accent/20 rounded-lg">
                <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="virtual-field-trip" />
              </div>

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
              <p className="text-muted-foreground">{t.planningText}</p>
            </CardContent>
          </Card>
        )
      }

      {
        trip && (
          <VirtualFieldTripDisplay
            trip={trip}
            topic={form.getValues('topic')}
            gradeLevel={form.getValues('gradeLevel')}
            language={form.getValues('language')}
          />
        )
      }
    </div>
  );
}

export default function VirtualFieldTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <VirtualFieldTripContent />
    </Suspense>
  );
}
