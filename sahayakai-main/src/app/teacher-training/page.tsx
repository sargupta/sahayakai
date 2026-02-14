
"use client";

import { Suspense } from "react";

import { getTeacherTrainingAdvice, TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { TeacherTrainingDisplay } from "@/components/teacher-training-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { VoiceAssistant } from "@/components/voice-assistant";


const formSchema = z.object({
  question: z.string().min(10, { message: "Question must be at least 10 characters." }),
  language: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;


const descriptionTranslations: Record<string, [string, string]> = {
  en: [
    "Your personal AI coach, providing advice grounded in sound pedagogical principles.",
    "Ask for techniques, classroom strategies, or motivation."
  ],
  hi: [
    "आपका व्यक्तिगत AI कोच, जो ठोस शैक्षणिक सिद्धांतों पर आधारित सलाह प्रदान करता है।",
    "तकनीक, कक्षा रणनीतियों, या प्रेरणा के लिए पूछें।"
  ],
  bn: [
    "আপনার ব্যক্তিগত এআই কোচ, যা শিক্ষাগত নীতির উপর ভিত্তি করে পরামর্শ প্রদান করে।",
    "কৌশল, শ্রেণীকক্ষের কৌশল বা অনুপ্রেরণার জন্য জিজ্ঞাসা করুন।"
  ],
  te: [
    "మీ వ్యక్తిగత AI కోచ్, ధృడమైన బోధనా సూత్రాలపై ఆధారపడిన సలహాలను అందిస్తుంది.",
    "పద్ధతులు, తరగతి గది వ్యూహాలు లేదా ప్రేరణ కోసం అడగండి."
  ],
  mr: [
    "तुमचे वैयक्तिक AI प्रशिक्षक, जे योग्य शैक्षणिक तत्त्वांवर आधारित सल्ला देतात.",
    "तंत्र, वर्गातील रणनीती किंवा प्रेरणेसाठी विचारा."
  ],
  ta: [
    "உங்கள் தனிப்பட்ட AI பயிற்சியாளர், கல்விசார் கொள்கைகளின் அடிப்படையில் ஆலோசனைகளை வழங்குகிறார்.",
    "நுட்பங்கள், வகுப்பறை உத்திகள் அல்லது உந்துதலுக்காகக் கேளுங்கள்."
  ],
  gu: [
    "તમારા અંગત AI કોચ, જે શિક્ષણશાસ્ત્રના સિદ્ધાંતો પર આધારિત સલાહ પૂરી પાડે છે.",
    "તકનીકો, વર્ગખંડની વ્યૂહરચનાઓ અથવા પ્રેરણા માટે પૂછો."
  ],
  kn: [
    "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಎಐ ತರಬೇತುದಾರ, ಶಿಕ್ಷಣಾತ್ಮಕ ತತ್ವಗಳ ಮೇಲೆ ಆಧಾರಿತವಾದ ಸಲಹೆಯನ್ನು ನೀಡುತ್ತದೆ.",
    "ತಂತ್ರಗಳು, ತರಗತಿಯ ತಂತ್ರಗಳು, ಅಥವಾ ಪ್ರೇರಣೆಗಾಗಿ ಕೇಳಿ."
  ],
};

const placeholderTranslations: Record<string, string> = {
  en: "e.g., 'How can I get my students to be quiet without shouting?'",
  hi: "उदा., 'मैं अपने छात्रों को बिना चिल्लाए शांत कैसे करा सकता हूँ?'",
  bn: "উদা., 'চিৎকার না করে আমি কীভাবে আমার ছাত্রদের চুপ করাতে পারি?'",
  te: "ఉదా., 'అరవకుండా నా విద్యార్థులను నిశ్శబ్దంగా ఉండేలా చేయడం ఎలా?'",
  mr: "उदा., 'मी माझ्या विद्यार्थ्यांना न ओरडता शांत कसे करू शकेन?'",
  ta: "உதா., 'கத்தாமல் என் மாணவர்களை அமைதியாக இருக்க வைப்பது எப்படி?'",
  gu: "દા.ત., 'હું મારા વિદ્યાર્થીઓને બૂમો પાડ્યા વગર શાંત કેવી રીતે કરી શકું?'",
  kn: "ಉದಾ., 'ನನ್ನ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಕೂಗದೆ ಸುಮ್ಮನಿರಿಸುವುದು ಹೇಗೆ?'",
};

function TeacherTrainingContent() {
  const [advice, setAdvice] = useState<TeacherTrainingOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
      subject: "General",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const descriptionLines = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
  const placeholder = placeholderTranslations[selectedLanguage] || placeholderTranslations.en;
  const searchParams = useSearchParams();

  useEffect(() => {
    // Router sends 'topic', internal links might use 'question'
    const questionParam = searchParams.get("question") || searchParams.get("topic");

    if (questionParam) {
      form.setValue("question", questionParam);
      // Determine intent: if it's a direct handoff, trigger submit
      setTimeout(() => {
        form.handleSubmit(onSubmit)();
      }, 100);
    }
  }, [searchParams, form]);

  const { requireAuth, openAuthModal } = useAuth();
  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    setIsLoading(true);
    setAdvice(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/teacher-training", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          question: values.question,
          language: values.language,
          subject: values.subject,
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to get advice");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get advice");
      }

      const result = await res.json();
      setAdvice(result);
    } catch (error) {
      console.error("Failed to get advice:", error);
      toast({
        title: "Failed to Get Advice",
        description: "There was an error getting advice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscript = (transcript: string) => {
    form.setValue("question", transcript);
    form.trigger("question");
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("question", prompt);
    form.trigger("question");
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-[#FF9933]" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-3 rounded-full bg-purple-50 text-purple-600">
              <GraduationCap className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="font-headline text-3xl">Teacher Training</CardTitle>
          <CardDescription>
            <p>{descriptionLines[0]}</p>
            <p>{descriptionLines[1]}</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Main Content (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline text-lg">Your Question or Challenge</FormLabel>
                        <FormControl>
                          <div className="flex flex-col gap-4">
                            <MicrophoneInput
                              onTranscriptChange={(transcript) => {
                                field.onChange(transcript);
                              }}
                              iconSize="lg"
                              label="Speak your question..."
                              className="bg-white/50 backdrop-blur-sm"
                            />
                            <Textarea
                              placeholder={placeholder}
                              {...field}
                              className="bg-white/50 backdrop-blur-sm min-h-[150px] resize-none text-lg"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel className="font-headline">Quick Ideas</FormLabel>
                    <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="teacher-training" />
                  </div>
                </div>

                {/* RIGHT COLUMN: Settings Sidebar (5 cols) */}
                <div className="lg:col-span-5 space-y-5 bg-[#FFF8F0]/60 backdrop-blur-sm p-6 rounded-xl border-l-4 border-[#FF9933] border-t border-r border-b border-[#FF9933]/20 shadow-sm h-fit">
                  <h3 className="font-headline text-base font-bold text-[#FF9933] uppercase tracking-wide">Settings</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-600">Subject</FormLabel>
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
                          <FormLabel className="text-xs font-semibold text-slate-600">Language</FormLabel>
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

                  <div className="bg-blue-50/50 p-4 rounded-md border-l-4 border-blue-500">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-blue-900 text-sm mb-1">Pro Tip</p>
                        <p className="text-sm text-blue-800">Be specific about your students' age group and the context (e.g., "Class 5 students in a rural school").</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6 shadow-lg hover:shadow-xl transition-all">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Getting Advice...
                  </>
                ) : (
                  "Get Advice"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </div>

      {isLoading && (
        <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Thinking of some helpful advice...</p>
          </CardContent>
        </Card>
      )}

      {advice && <TeacherTrainingDisplay advice={advice} title={form.getValues("question")} />}

      {/* Floating Assistant (Safe Mode) */}
      <VoiceAssistant
        context={advice ? JSON.stringify(advice) : "No advice yet."}
      />
    </div>
  );
}

export default function TeacherTrainingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <TeacherTrainingContent />
    </Suspense>
  );
}
