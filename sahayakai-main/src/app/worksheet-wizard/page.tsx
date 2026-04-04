
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLimitGuard } from "@/hooks/use-limit-guard";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { UsageRemainingBadge } from "@/components/usage-remaining-badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PencilRuler, Download, Save } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import ReactMarkdown from 'react-markdown';
import { ImageUploader } from "@/components/image-uploader";
import { MicrophoneInput } from "@/components/microphone-input";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { WorksheetDisplay } from "@/components/worksheet-display";
import { SubjectSelector } from "@/components/subject-selector";
import { useJarvisStore } from "@/store/jarvisStore";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";



const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Worksheet Wizard",
    pageDescription: "Upload a textbook page and describe the worksheet you want to create.",
    imageLabel: "Textbook Page Image",
    instructionsLabel: "Worksheet Instructions",
    speakLabel: "Describe the worksheet...",
    placeholder: "e.g., Create 5 fill-in-the-blank questions for Class 2...",
    gradeLabel: "Class",
    languageLabel: "Language",
    submitButton: "Generate Worksheet",
    generating: "Generating...",
    wizardMagic: "The wizard is working its magic...",
    resultTitle: "Your Generated Worksheet",
    saveButton: "Save",
    downloadButton: "Download",
    subjectLabel: "Subject"
  },
  hi: {
    pageTitle: "वर्कशीट विजार्ड",
    pageDescription: "पाठ्यपुस्तक का पृष्ठ अपलोड करें और वह वर्कशीट वर्णित करें जिसे आप बनाना चाहते हैं।",
    imageLabel: "पाठ्यपुस्तक पृष्ठ छवि",
    instructionsLabel: "वर्कशीट निर्देश",
    speakLabel: "वर्कशीट का वर्णन करें...",
    placeholder: "जैसे, कक्षा 2 के लिए 5 रिक्त स्थान भरने वाले प्रश्न बनाएं...",
    gradeLabel: "कक्षा",
    languageLabel: "भाषा",
    submitButton: "वर्कशीट बनाएं",
    generating: "उत्पन्न कर रहा है...",
    wizardMagic: "विजार्ड अपना जादू चला रहा है...",
    resultTitle: "आपकी उत्पन्न वर्कशीट",
    saveButton: "सहेजें",
    downloadButton: "डाउनलोड करें",
    subjectLabel: "विषय"
  },
  bn: {
    pageTitle: "ওয়ার্কশীট উইজার্ড",
    pageDescription: "একটি পাঠ্যপুস্তকের পৃষ্ঠা আপলোড করুন এবং আপনি যে ওয়ার্কশীটটি তৈরি করতে চান তা বর্ণনা করুন।",
    imageLabel: "পাঠ্যপুস্তকের পৃষ্ঠার ছবি",
    instructionsLabel: "ওয়ার্কশীট নির্দেশাবলী",
    speakLabel: "ওয়ার্কশীট বর্ণনা করুন...",
    placeholder: "উদাঃ, দ্বিতীয় শ্রেণীর জন্য ৫টি শূন্যস্থান পূরণ করার প্রশ্ন তৈরি করুন...",
    gradeLabel: "শ্রেণী",
    languageLabel: "ভাষা",
    submitButton: "ওয়ার্কশীট তৈরি করুন",
    generating: "তৈরি করা হচ্ছে...",
    wizardMagic: "উইজার্ড তার জাদু দেখাচ্ছে...",
    resultTitle: "আপনার তৈরি ওয়ার্কশীট",
    saveButton: "সংরক্ষণ করুন",
    downloadButton: "ডাউনলোড করুন"
  },
  te: {
    pageTitle: "వర్క్‌షీట్ విజార్డ్",
    pageDescription: "టెక్స్ట్‌బుక్ పేజీని అప్‌లోడ్ చేయండి మరియు మీరు సృష్టించాలనుకుంటున్న వర్క్‌షీట్‌ను వివరించండి.",
    imageLabel: "టెక్స్ట్‌బుక్ పేజీ చిత్రం",
    instructionsLabel: "వర్క్‌షీట్ సూచనలు",
    speakLabel: "వర్క్‌షీట్‌ను వివరించండి...",
    placeholder: "ఉదా., 2వ తరగతి కోసం 5 ఖాళీలను పూరించండి ప్రశ్నలను సృష్టించండి...",
    gradeLabel: "తరగతి స్థాయి",
    languageLabel: "భాష",
    submitButton: "వర్క్‌షీట్ సృష్టించండి",
    generating: "సృష్టిస్తోంది...",
    wizardMagic: "విజార్డ్ తన మాయాజాలాన్ని చూపిస్తోంది...",
    resultTitle: "మీరు సృష్టించిన వర్క్‌షీట్",
    saveButton: "సేవ్ చేయండి",
    downloadButton: "డౌన్‌లోడ్ చేయండి"
  },
  mr: {
    pageTitle: "वर्कशीट विझार्ड",
    pageDescription: "पाठ्यपुस्तकाचे पान अपलोड करा आणि तुम्हाला तयार करायची असलेली वर्कशीट वर्णन करा.",
    imageLabel: "पाठ्यपुस्तक पृष्ठ प्रतिमा",
    instructionsLabel: "वर्कशीट सूचना",
    speakLabel: "वर्कशीटचे वर्णन करा...",
    placeholder: "उदा., इयत्ता 2 री साठी 5 रिकाम्या जागा भरा प्रश्न तयार करा...",
    gradeLabel: "इयत्ता",
    languageLabel: "भाषा",
    submitButton: "वर्कशीट तयार करा",
    generating: "तयार करत आहे...",
    wizardMagic: "विझार्ड त्याची जादू करत आहे...",
    resultTitle: "तुमची तयार केलेली वर्कशीट",
    saveButton: "जतन करा",
    downloadButton: "डाउनलोड करा"
  },
  ta: {
    pageTitle: "பணித்தாள் வழிகாட்டி",
    pageDescription: "பாடப்புத்தகப் பக்கத்தைப் பதிவேற்றி, நீங்கள் உருவாக்க விரும்பும் பணித்தாளை விவரிக்கவும்.",
    imageLabel: "பாடப்புத்தகப் பக்கப் படம்",
    instructionsLabel: "பணித்தாள் வழிமுறைகள்",
    speakLabel: "பணித்தாளை விவரிக்கவும்...",
    placeholder: "எ.கா., 2 ஆம் வகுப்புக்கு 5 கோடிட்ட இடங்களை நிரப்புக கேள்விகளை உருவாக்கவும்...",
    gradeLabel: "வகுப்பு நிலை",
    languageLabel: "மொழி",
    submitButton: "பணித்தாளை உருவாக்குங்கள்",
    generating: "உருவாக்குகிறது...",
    wizardMagic: "வழிகாட்டி தனது மந்திரத்தைச் செய்கிறது...",
    resultTitle: "உங்கள் உருவாக்கப்பட்ட பணித்தாள்",
    saveButton: "சேமிக்கவும்",
    downloadButton: "பதிவிறக்கவும்"
  },
  gu: {
    pageTitle: "વર્કશીટ વિઝાર્ડ",
    pageDescription: "પાઠ્યપુસ્તકનું પૃષ્ઠ અપલોડ કરો અને તમે જે વર્કશીટ બનાવવા માંગો છો તેનું વર્ણન કરો.",
    imageLabel: "પાઠ્યપુસ્તક પૃષ્ઠ છબી",
    instructionsLabel: "વર્કશીટ સૂચનાઓ",
    speakLabel: "વર્કશીટનું વર્ણન કરો...",
    placeholder: "દા.ત., ધોરણ 2 માટે 5 ખાલી જગ્યા પૂરો પ્રશ્નો બનાવો...",
    gradeLabel: "ધોરણ",
    languageLabel: "ભાષા",
    submitButton: "વર્કશીટ બનાવો",
    generating: "બનાવી રહ્યું છે...",
    wizardMagic: "વિઝાર્ડ તેનો જાદુ કરી રહ્યું છે...",
    resultTitle: "તમારી બનાવેલી વર્કશીટ",
    saveButton: "સાચવો",
    downloadButton: "ડાઉનલોડ કરો"
  },
  kn: {
    pageTitle: "ವರ್ಕ್‌ಶೀಟ್ ವಿಝಾರ್ಡ್",
    pageDescription: "ಪಠ್ಯಪುಸ್ತಕ ಪುಟವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಮತ್ತು ನೀವು ರಚಿಸಲು ಬಯಸುವ ವರ್ಕ್‌ಶೀಟ್ ಅನ್ನು ವಿವರಿಸಿ.",
    imageLabel: "ಪಠ್ಯಪುಸ್ತಕ ಪುಟ ಚಿತ್ರ",
    instructionsLabel: "ವರ್ಕ್‌ಶೀಟ್ ಸೂಚನೆಗಳು",
    speakLabel: "ವರ್ಕ್‌ಶೀಟ್ ಅನ್ನು ವಿವರಿಸಿ...",
    placeholder: "ಉದಾ., 2 ನೇ ತರಗತಿಗೆ 5 ಬಿಟ್ಟ ಸ್ಥಳ ತುಂಬಿರಿ ಪ್ರಶ್ನೆಗಳನ್ನು ರಚಿಸಿ...",
    gradeLabel: "ದರ್ಜೆ ಮಟ್ಟ",
    languageLabel: "ಭಾಷೆ",
    submitButton: "ವರ್ಕ್‌ಶೀಟ್ ರಚಿಸಿ",
    generating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    wizardMagic: "ವಿಝಾರ್ಡ್ ತನ್ನ ಮ್ಯಾಜಿಕ್ ಮಾಡುತ್ತಿದೆ...",
    resultTitle: "ನಿಮ್ಮ ರಚಿಸಿದ ವರ್ಕ್‌ಶೀಟ್",
    saveButton: "ಉಳಿಸಿ",
    downloadButton: "ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ"
  },
  pa: {
    pageTitle: "ਵਰਕਸ਼ੀਟ ਵਿਜ਼ਾਰਡ",
    pageDescription: "ਪਾਠ ਪੁਸਤਕ ਦਾ ਪੰਨਾ ਅਪਲੋਡ ਕਰੋ ਅਤੇ ਉਹ ਵਰਕਸ਼ੀਟ ਦੱਸੋ ਜੋ ਤੁਸੀਂ ਬਣਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ।",
    imageLabel: "ਪਾਠ ਪੁਸਤਕ ਪੰਨਾ ਚਿੱਤਰ",
    instructionsLabel: "ਵਰਕਸ਼ੀਟ ਹਦਾਇਤਾਂ",
    speakLabel: "ਵਰਕਸ਼ੀਟ ਦਾ ਵਰਣਨ ਕਰੋ...",
    placeholder: "ਉਦਾਹਰਣ: ਜਮਾਤ 2 ਲਈ 5 ਖਾਲੀ ਥਾਵਾਂ ਭਰੋ ਪ੍ਰਸ਼ਨ ਬਣਾਓ...",
    gradeLabel: "ਜਮਾਤ",
    languageLabel: "ਭਾਸ਼ਾ",
    submitButton: "ਵਰਕਸ਼ੀਟ ਬਣਾਓ",
    generating: "ਬਣਾ ਰਿਹਾ ਹੈ...",
    wizardMagic: "ਵਿਜ਼ਾਰਡ ਆਪਣਾ ਜਾਦੂ ਕਰ ਰਿਹਾ ਹੈ...",
    resultTitle: "ਤੁਹਾਡੀ ਬਣਾਈ ਗਈ ਵਰਕਸ਼ੀਟ",
    saveButton: "ਸੁਰੱਖਿਅਤ ਕਰੋ",
    downloadButton: "ਡਾਊਨਲੋਡ ਕਰੋ"
  },
  ml: {
    pageTitle: "വർക്ക്ഷീറ്റ് വിസാർഡ്",
    pageDescription: "പാഠപുസ്തക പേജ് അപ്‌ലോഡ് ചെയ്ത് നിങ്ങൾക്ക് സൃഷ്ടിക്കേണ്ട വർക്ക്ഷീറ്റ് വിവരിക്കുക.",
    imageLabel: "പാഠപുസ്തക പേജ് ചിത്രം",
    instructionsLabel: "വർക്ക്ഷീറ്റ് നിർദ്ദേശങ്ങൾ",
    speakLabel: "വർക്ക്ഷീറ്റ് വിവരിക്കുക...",
    placeholder: "ഉദാ: രണ്ടാം ക്ലാസിലേക്ക് 5 വിട്ടഭാഗം പൂരിപ്പിക്കുക ചോദ്യങ്ങൾ തയ്യാറാക്കുക...",
    gradeLabel: "ക്ലാസ്",
    languageLabel: "ഭാഷ",
    submitButton: "വർക്ക്ഷീറ്റ് സൃഷ്ടിക്കുക",
    generating: "സൃഷ്ടിക്കുന്നു...",
    wizardMagic: "വിസാർഡ് മാന്ത്രികത കാണിക്കുന്നു...",
    resultTitle: "നിങ്ങൾ സൃഷ്ടിച്ച വർക്ക്ഷീറ്റ്",
    saveButton: "സേവ് ചെയ്യുക",
    downloadButton: "ഡൗൺലോഡ് ചെയ്യുക"
  },
  or: {
    pageTitle: "ୱାର୍କସିଟ୍ ୱିଜାର୍ଡ",
    pageDescription: "ପାଠ୍ୟପୁସ୍ତକ ପୃଷ୍ଠା ଅପଲୋଡ୍ କରନ୍ତୁ ଏବଂ ଆପଣ ତିଆରି କରିବାକୁ ଚାହୁଁଥିବା ୱାର୍କସିଟ୍ ବର୍ଣ୍ଣନା କରନ୍ତୁ |",
    imageLabel: "ପାଠ୍ୟପୁସ୍ତକ ପୃଷ୍ଠା ଚିତ୍ର",
    instructionsLabel: "ୱାର୍କସିଟ୍ ନିର୍ଦ୍ଦେଶାବଳୀ",
    speakLabel: "ୱାର୍କସିଟ୍ ବର୍ଣ୍ଣନା କରନ୍ତୁ...",
    placeholder: "ଉଦାହରଣ: ଦ୍ୱିତୀୟ ଶ୍ରେଣୀ ପାଇଁ 5 ଟି ଶୂନ୍ୟସ୍ଥାନ ପୂରଣ ପ୍ରଶ୍ନ ତିଆରି କରନ୍ତୁ...",
    gradeLabel: "ଶ୍ରେଣୀ",
    languageLabel: "ଭାଷା",
    submitButton: "ୱାର୍କସିଟ୍ ତିଆରି କରନ୍ତୁ",
    generating: "ତିଆରି ଚାଲିଛି...",
    wizardMagic: "ୱିଜାର୍ଡ ତାର ଯାଦୁ ଦେଖାଉଛି...",
    resultTitle: "ଆପଣଙ୍କ ପ୍ରସ୍ତୁତ ୱାର୍କସିଟ୍",
    saveButton: "ସଂରକ୍ଷଣ କରନ୍ତୁ",
    downloadButton: "ଡାଉନଲୋଡ୍ କରନ୍ତୁ"
  },
};

const formSchema = z.object({
  imageDataUri: z.string({ required_error: "Please upload an image." }).min(1, { message: "Please upload an image." }),
  prompt: z.string().min(10, { message: "Prompt must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function WorksheetWizardContent() {
  const { requireAuth, openAuthModal } = useAuth();
  const [worksheet, setWorksheet] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { limitState, checkResponse, clearLimit } = useLimitGuard();
  const { toast } = useToast();
  const { clearFormSnapshot } = useJarvisStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      language: "en",
      gradeLevel: "Class 4",
      subject: "General",
    },
  });

  // ── VIDYA Form Sync: live awareness + persisted snapshot ─────────────────
  const watchedPrompt  = form.watch("prompt");
  const watchedGrade   = form.watch("gradeLevel");
  const watchedSubject = form.watch("subject");
  const watchedLang    = form.watch("language");
  const savedSnapshot  = useVidyaFormSync("worksheet-wizard", {
    prompt: watchedPrompt,
    gradeLevel: watchedGrade,
    subject: watchedSubject,
    language: watchedLang,
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;
  const searchParams = useSearchParams();

  // Restore snapshot on mount — only when no URL params are present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const id = searchParams.get("id");
    if (promptParam || id || !savedSnapshot) return;
    if (savedSnapshot.prompt) form.setValue("prompt", savedSnapshot.prompt);
    if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
    if (savedSnapshot.subject)    form.setValue("subject",    savedSnapshot.subject);
    if (savedSnapshot.language)   form.setValue("language",   savedSnapshot.language);
  }, []); // empty array: runs once on mount only

  useEffect(() => {
    const id = searchParams.get("id");
    const promptParam = searchParams.get("prompt");

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
              setWorksheet(content.data.worksheetContent || content.data);
              form.reset({
                prompt: content.topic || content.title,
                gradeLevel: content.gradeLevel,
                language: content.language,
                imageDataUri: content.data.imageDataUri || "",
                subject: content.subject || "General"
              });
            }
          }
        } catch (err) {
          console.error("Failed to load saved worksheet:", err);
          toast({
            title: "Load Failed",
            description: "Could not load the saved worksheet.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSavedContent();
    } else if (promptParam) {
      // ── VIDYA Action: Pre-fill all fields from URL params ──────────────
      const subjectParam = searchParams.get("subject");
      const gradeLevelParam = searchParams.get("gradeLevel");
      const languageParam = searchParams.get("language");

      form.setValue("prompt", promptParam);
      if (subjectParam) form.setValue("subject", subjectParam);
      if (gradeLevelParam) form.setValue("gradeLevel", gradeLevelParam);
      if (languageParam) form.setValue("language", languageParam);
      // ── FIX: auto-generate when VIDYA navigates here with a pre-filled prompt
      setTimeout(() => form.handleSubmit(onSubmit)(), 300);
      // ────────────────────────────────────────────────────────────────────
    }
  }, [searchParams, form, toast]);

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    setIsLoading(true);
    setWorksheet(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/worksheet", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ ...values, language: values.language || selectedLanguage })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to generate worksheets");
        }
        const errorData = await res.json();
        if (checkResponse(res.status, errorData)) {
          setIsLoading(false);
          return;
        }
        throw new Error(errorData.error || "Failed to generate worksheet");
      }

      clearLimit();
      const result = await res.json();
      setWorksheet(result.worksheetContent);
      clearFormSnapshot("worksheet-wizard");
    } catch (error) {
      console.error("Failed to generate worksheet:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the worksheet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
    // form.trigger("prompt"); // Removed to prevent premature interaction
  };

  const handleDownload = () => {
    if (!worksheet) return;
    const blob = new Blob([worksheet], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'worksheet.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your worksheet has been saved to your personal library.",
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="card-accent-bar" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <PencilRuler className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl sm:text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription>
            {t.pageDescription}
          </CardDescription>
          <UsageRemainingBadge feature="worksheet" />
        </CardHeader>

        {(limitState.limitReached || limitState.upgradeRequired) && (
          <UpgradePrompt
            feature="worksheet"
            used={limitState.used ?? 0}
            limit={limitState.limit ?? 0}
          />
        )}

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="imageDataUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.imageLabel}</FormLabel>
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

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.instructionsLabel}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4">
                        <Textarea
                          placeholder={t.placeholder}
                          {...field}
                          className="bg-muted/20 min-h-[120px]"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="worksheet" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/30 pt-4 mt-2">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.gradeLabel}</FormLabel>
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
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.subjectLabel || "Subject"}</FormLabel>
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
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.languageLabel}</FormLabel>
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

              <Button type="submit" disabled={isLoading} className="w-full py-5 text-base font-headline shadow-lg shadow-primary/20 transition-all">
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
          <Card className="mt-8 w-full max-w-2xl bg-card border border-border shadow-soft rounded-2xl animate-fade-in-up">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{t.wizardMagic}</p>
            </CardContent>
          </Card>
        )
      }

      {
        worksheet && (
          <>
            <div className="my-8 flex items-center gap-3">
              <hr className="flex-1 border-border/40" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">Result</span>
              <hr className="flex-1 border-border/40" />
            </div>
          <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4"><WorksheetDisplay
            worksheet={{
              worksheetContent: worksheet,
              gradeLevel: form.getValues("gradeLevel"),
              subject: form.getValues("subject") || "General"
            }}
            title={form.getValues("prompt") || t.resultTitle}
            selectedLanguage={selectedLanguage}
          /></div>
          </>
        )
      }
    </div>
  );
}

export default function WorksheetWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <WorksheetWizardContent />
    </Suspense>
  );
}
