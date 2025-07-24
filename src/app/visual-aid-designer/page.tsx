
"use client";

import { generateVisualAid } from "@/ai/flows/visual-aid-designer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Download, Images } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ExamplePrompts } from "@/components/example-prompts";


const formSchema = z.object({
  prompt: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

const visualAidPrompts: Record<string, string[]> = {
    en: [
        "A simple drawing of a flower showing its main parts: root, stem, leaf, and petal.",
        "A diagram showing the water cycle with labels for evaporation, condensation, and precipitation.",
        "A drawing that represents 'Unity in Diversity' using simple symbols.",
        "A simple diagram of the human heart with the four chambers.",
    ],
    hi: [
        "एक फूल का सरल चित्र जिसमें उसके मुख्य भाग दिखाए गए हैं: जड़, तना, पत्ती और पंखुड़ी।",
        "वाष्पीकरण, संघनन और वर्षा के लेबल के साथ जल चक्र दिखाने वाला एक आरेख।",
        "सरल प्रतीकों का उपयोग करके 'अनेकता में एकता' का प्रतिनिधित्व करने वाला एक चित्र।",
        "चार कक्षों के साथ मानव हृदय का एक सरल आरेख।",
    ],
    bn: [
        "একটি ফুলের একটি সাধারণ অঙ্কন যা তার প্রধান অংশগুলি দেখায়: মূল, কাণ্ড, পাতা এবং পাপড়ি।",
        "বাষ্পীভবন, ঘনীভবন এবং বৃষ্টিপাতের জন্য লেবেল সহ জলচক্র দেখানো একটি চিত্র।",
        "সাধারণ প্রতীক ব্যবহার করে 'বৈচিত্র্যের মধ্যে ঐক্য' প্রতিনিধিত্বকারী একটি অঙ্কন।",
        "চারটি চেম্বার সহ মানব হৃদপিণ্ডের একটি সাধারণ চিত্র।",
    ],
    te: [
        "పువ్వు యొక్క ప్రధాన భాగాలను చూపే ఒక సాధారణ డ్రాయింగ్: రూట్, కాండం, ఆకు మరియు రేక.",
        "బాష్పీభవనం, సంక్షేపణం మరియు అవపాతం కోసం లేబుల్‌లతో నీటి చక్రాన్ని చూపే రేఖాచిత్రం.",
        "సాధారణ చిహ్నాలను ఉపయోగించి 'భిన్నత్వంలో ఏకత్వం'ని సూచించే డ్రాయింగ్.",
        "నాలుగు గదులతో మానవ గుండె యొక్క సాధారణ రేఖాచిత్రం.",
    ],
    mr: [
        "एका फुलाचे साधे रेखाचित्र ज्यामध्ये त्याचे मुख्य भाग दर्शविलेले आहेत: मूळ, देठ, पान आणि पाकळी.",
        "बाष्पीभवन, संक्षेपण आणि पर्जन्यवृष्टीसाठी लेबलांसह जलचक्र दर्शविणारी आकृती.",
        "साध्या चिन्हांचा वापर करून ' विविधतेत एकता' दर्शवणारे चित्र.",
        "चार कक्षांसह मानवी हृदयाची एक साधी आकृती.",
    ],
    ta: [
        "ஒரு பூவின் எளிய வரைபடம் அதன் முக்கிய பகுதிகளைக் காட்டுகிறது: வேர், தண்டு, இலை மற்றும் இதழ்.",
        "ஆவியாதல், ஒடுக்கம் மற்றும் மழைப்பொழிவுக்கான லேபிள்களுடன் நீர் சுழற்சியைக் காட்டும் ஒரு வரைபடம்.",
        "எளிய சின்னங்களைப் பயன்படுத்தி 'வேற்றுமையில் ஒற்றுமை' என்பதைக் குறிக்கும் ஒரு வரைபடம்.",
        "நான்கு அறைகளைக் கொண்ட மனித இதயத்தின் எளிய வரைபடம்.",
    ],
    gu: [
        "એક ફૂલનું એક સરળ ચિત્ર જે તેના મુખ્ય ભાગો દર્શાવે છે: મૂળ, દાંડી, પાંદડું અને પાંખડી.",
        "બાષ્પીભવન, ઘનીકરણ અને વરસાદ માટે લેબલો સાથે જળ ચક્ર દર્શાવતી આકૃતિ.",
        "સરળ પ્રતીકોનો ઉપયોગ કરીને 'વિવિધતામાં એકતા' દર્શાવતું ચિત્ર.",
        "ચાર ચેમ્બર સાથે માનવ હૃદયની એક સરળ આકૃતિ.",
    ],
    kn: [
        "ಹೂವಿನ ಒಂದು ಸರಳ ರೇಖಾಚಿತ್ರವು ಅದರ ಮುಖ್ಯ ಭಾಗಗಳನ್ನು ತೋರಿಸುತ್ತದೆ: ಬೇರು, ಕಾಂಡ, ಎಲೆ ಮತ್ತು ದಳ.",
        "ಬಾಷ್ಪೀಕರಣ, ಘನೀಕರಣ ಮತ್ತು ಮಳೆಗಾಗಿ ಲೇಬಲ್‌ಗಳೊಂದಿಗೆ ನೀರಿನ ಚಕ್ರವನ್ನು ತೋರಿಸುವ ರೇಖಾಚಿತ್ರ.",
        "ಸರಳ ಚಿಹ್ನೆಗಳನ್ನು ಬಳಸಿಕೊಂಡು 'ವಿವಿಧತೆಯಲ್ಲಿ ಏಕತೆ'ಯನ್ನು ಪ್ರತಿನಿಧಿಸುವ ರೇಖಾಚಿತ್ರ.",
        "ನಾಲ್ಕು ಕೋಣೆಗಳೊಂದಿಗೆ ಮಾನವ ಹೃದಯದ ಸರಳ ರೇಖಾಚಿತ್ರ.",
    ],
};


export default function VisualAidDesignerPage() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });
  
  // Hardcoding language for now as it's not in the form
  const selectedLanguage = 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setImageData(null);
    try {
      const result = await generateVisualAid({
        prompt: values.prompt,
      });
      setImageData(result.imageDataUri);
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

  const handleDownload = () => {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = imageData;
    link.download = 'visual-aid.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
    form.trigger("prompt");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Images className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Visual Aid Designer</CardTitle>
          <CardDescription>
            Create simple black-and-white line drawings for your lessons.
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
                    <FormLabel className="font-headline">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., A simple diagram of the water cycle..."
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="visual-aid" />
              
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Visual Aid"
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
              <p className="text-muted-foreground">Generating your visual aid... this may take a moment.</p>
            </CardContent>
         </Card>
      )}

      {imageData && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center justify-between">
              <span>Generated Image</span>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center p-4">
            <Image
              src={imageData}
              alt="Generated visual aid"
              width={512}
              height={512}
              className="rounded-lg border border-black/10"
              data-ai-hint="illustration drawing"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
