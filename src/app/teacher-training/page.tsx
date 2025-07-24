
"use client";

import { getTeacherTrainingAdvice } from "@/ai/flows/teacher-training";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import ReactMarkdown from 'react-markdown';


const formSchema = z.object({
  question: z.string().min(10, { message: "Question must be at least 10 characters." }),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Advice = { answer: string };

const descriptionTranslations: Record<string, string> = {
    en: "Your personal AI coach, providing advice grounded in sound pedagogical principles. Ask for techniques, classroom strategies, or motivation.",
    hi: "आपका व्यक्तिगत AI कोच, जो ठोस शैक्षणिक सिद्धांतों पर आधारित सलाह प्रदान करता है। तकनीक, कक्षा रणनीतियों, या प्रेरणा के लिए पूछें।",
    bn: "আপনার ব্যক্তিগত এআই কোচ, যা শিক্ষাগত নীতির উপর ভিত্তি করে পরামর্শ প্রদান করে। কৌশল, শ্রেণীকক্ষের কৌশল বা অনুপ্রেরণার জন্য জিজ্ঞাসা করুন।",
    te: "మీ వ్యక్తిగత AI కోచ్, ధృడమైన బోధనా సూత్రాలపై ఆధారపడిన సలహాలను అందిస్తుంది. పద్ధతులు, తరగతి గది వ్యూహాలు లేదా ప్రేరణ కోసం అడగండి.",
    mr: "तुमचे वैयक्तिक AI प्रशिक्षक, जे योग्य शैक्षणिक तत्त्वांवर आधारित सल्ला देतात. तंत्र, वर्गातील रणनीती किंवा प्रेरणेसाठी विचारा.",
    ta: "உங்கள் தனிப்பட்ட AI பயிற்சியாளர், கல்விசார் கொள்கைகளின் அடிப்படையில் ஆலோசனைகளை வழங்குகிறார். நுட்பங்கள், வகுப்பறை உத்திகள் அல்லது உந்துதலுக்காகக் கேளுங்கள்.",
    gu: "તમારા અંગત AI કોચ, જે શિક્ષણશાસ્ત્રના સિદ્ધાંતો પર આધારિત સલાહ પૂરી પાડે છે. તકનીકો, વર્ગખંડની વ્યૂહરચનાઓ અથવા પ્રેરણા માટે પૂછો.",
    kn: "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಎಐ ತರಬೇತುದಾರ, ಶಿಕ್ಷಣಾತ್ಮಕ ತತ್ವಗಳ ಮೇಲೆ ಆಧಾರಿತವಾದ ಸಲಹೆಯನ್ನು ನೀಡುತ್ತದೆ. ತಂತ್ರಗಳು, ತರಗತಿಯ ತಂತ್ರಗಳು, ಅಥವಾ ಪ್ರೇರಣೆಗಾಗಿ ಕೇಳಿ.",
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


export default function TeacherTrainingPage() {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
    },
  });
  
  const selectedLanguage = form.watch("language") || 'en';
  const description = descriptionTranslations[selectedLanguage] || descriptionTranslations.en;
  const placeholder = placeholderTranslations[selectedLanguage] || placeholderTranslations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setAdvice(null);
    try {
      const result = await getTeacherTrainingAdvice({
        question: values.question,
        language: values.language,
      });
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
  
  const handlePromptClick = (prompt: string) => {
    form.setValue("question", prompt);
    form.trigger("question");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <GraduationCap className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Teacher Training</CardTitle>
          <CardDescription>
            {description}
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
                    <FormLabel className="font-headline">Your Question or Challenge</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={placeholder}
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="teacher-training" />

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
              
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
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
      </Card>

      {isLoading && (
         <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Thinking of some helpful advice...</p>
            </CardContent>
         </Card>
      )}

      {advice && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <GraduationCap />
                Your Personalized Advice
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-lg max-w-none text-foreground p-6 border-t border-primary/20 prose-p:my-4">
            <ReactMarkdown>{advice.answer}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
