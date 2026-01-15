
"use client";

import { generateRubric, RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ClipboardCheck, Info } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { RubricDisplay } from "@/components/rubric-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MicrophoneInput } from "@/components/microphone-input";

const formSchema = z.object({
  assignmentDescription: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "Rubric Generator",
    pageDescription: "Create clear and fair grading rubrics for any assignment.",
    dialogTitle: "What is a Rubric?",
    dialogDescription: "A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.",
    dialogWhy: "Why are they important?",
    dialogClarityText: "They demystify assignments by making expectations clear to students before they start.",
    dialogConsistencyText: "They ensure all students are graded with the same criteria, making assessment fair and objective.",
    dialogFeedbackText: "They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.",
    dialogEfficiencyText: "They can make the grading process faster and more straightforward for teachers.",
    formLabel: "Assignment Description",
    formPlaceholder: "e.g., A project to build a model of the solar system for 6th graders.",
    gradeLevel: "Grade Level",
    language: "Language",
    buttonGenerate: "Generate Rubric",
    buttonGenerating: "Generating Rubric...",
    loadingText: "Building your rubric...",
    strongClarity: "Clarity:",
    strongConsistency: "Consistency:",
    strongFeedback: "Feedback:",
    strongEfficiency: "Efficiency:",
  },
  hi: {
    pageTitle: "रूब्रिक जेनरेटर",
    pageDescription: "किसी भी असाइनमेंट के लिए स्पष्ट और निष्पक्ष ग्रेडिंग रूब्रिक बनाएं।",
    dialogTitle: "रूब्रिक क्या है?",
    dialogDescription: "रूब्रिक एक स्कोरिंग उपकरण है जो किसी असाइनमेंट या काम के लिए प्रदर्शन अपेक्षाओं का स्पष्ट रूप से प्रतिनिधित्व करता है।",
    dialogWhy: "वे महत्वपूर्ण क्यों हैं?",
    dialogClarityText: "वे छात्रों को शुरू करने से पहले अपेक्षाओं को स्पष्ट करके असाइनमेंट को सरल बनाते हैं।",
    dialogConsistencyText: "वे सुनिश्चित करते हैं कि सभी छात्रों को समान मानदंडों के साथ ग्रेड दिया जाए, जिससे मूल्यांकन निष्पक्ष और वस्तुनिष्ठ हो।",
    dialogFeedbackText: "वे विशिष्ट, विस्तृत फीडबैक प्रदान करते हैं जो छात्रों को उनकी ताकत और सुधार के क्षेत्रों को समझने में मदद करता है।",
    dialogEfficiencyText: "वे शिक्षकों के लिए ग्रेडिंग प्रक्रिया को तेज और अधिक सीधा बना सकते हैं।",
    formLabel: "असाइनमेंट विवरण",
    formPlaceholder: "उदा., छठी कक्षा के छात्रों के लिए सौर मंडल का एक मॉडल बनाने की एक परियोजना।",
    gradeLevel: "श्रेणी स्तर",
    language: "भाषा",
    buttonGenerate: "रूब्रिक बनाएं",
    buttonGenerating: "रूब्रिक बना रहा है...",
    loadingText: "आपका रूब्रिक बन रहा है...",
    strongClarity: "स्पष्टता:",
    strongConsistency: "संगति:",
    strongFeedback: "फीडबैक:",
    strongEfficiency: "दक्षता:",
  },
  bn: {
    pageTitle: "রুব্রিক জেনারেটর",
    pageDescription: "যেকোনো অ্যাসাইনমেন্টের জন্য স্পষ্ট এবং ন্যায্য গ্রেডিং রুব্রিক তৈরি করুন।",
    dialogTitle: "রুব্রিক কী?",
    dialogDescription: "একটি রুব্রিক একটি স্কোরিং সরঞ্জাম যা একটি অ্যাসাইনমেন্ট বা কাজের জন্য পারফরম্যান্স প্রত্যাশা স্পষ্টভাবে উপস্থাপন করে।",
    dialogWhy: "এগুলি গুরুত্বপূর্ণ কেন?",
    dialogClarityText: "এগুলি শুরু করার আগে শিক্ষার্থীদের কাছে প্রত্যাশা পরিষ্কার করে অ্যাসাইনমেন্টগুলিকে রহস্যমুক্ত করে।",
    dialogConsistencyText: "এগুলি নিশ্চিত করে যে সমস্ত শিক্ষার্থীকে একই মানদণ্ডে গ্রেড দেওয়া হয়েছে, মূল্যায়নকে ন্যায্য এবং উদ্দেশ্যমূলক করে তোলে।",
    dialogFeedbackText: "এগুলি নির্দিষ্ট, বিস্তারিত প্রতিক্রিয়া প্রদান করে যা শিক্ষার্থীদের তাদের শক্তি এবং উন্নতির ক্ষেত্রগুলি বুঝতে সাহায্য করে।",
    dialogEfficiencyText: "এগুলি শিক্ষকদের জন্য গ্রেডিং প্রক্রিয়া দ্রুত এবং আরও সহজ করে তুলতে পারে।",
    formLabel: "অ্যাসাইনমেন্টের বিবরণ",
    formPlaceholder: "যেমন, ৬ষ্ঠ শ্রেণীর ছাত্রদের জন্য সৌরজগতের একটি মডেল তৈরির একটি প্রকল্প।",
    gradeLevel: "শ্রেণী স্তর",
    language: "ভাষা",
    buttonGenerate: "রুব্রিক তৈরি করুন",
    buttonGenerating: "রুব্রিক তৈরি করা হচ্ছে...",
    loadingText: "আপনার রুব্রিক তৈরি হচ্ছে...",
    strongClarity: "স্বচ্ছতা:",
    strongConsistency: "সামঞ্জস্য:",
    strongFeedback: "প্রতিক্রিয়া:",
    strongEfficiency: "দক্ষতা:",
  },
  te: {
    pageTitle: "రూబ్రిక్ జనరేటర్",
    pageDescription: "ఏదైనా అసైన్‌మెంట్ కోసం స్పష్టమైన మరియు న్యాయమైన గ్రేడింగ్ రూబ్రిక్‌లను సృష్టించండి.",
    dialogTitle: "రూబ్రిక్ అంటే ఏమిటి?",
    dialogDescription: "రూబ్రిక్ అనేది ఒక స్కోరింగ్ సాధనం, ఇది ఒక అసైన్‌మెంట్ లేదా పని కోసం పనితీరు అంచనాలను స్పష్టంగా సూచిస్తుంది.",
    dialogWhy: "అవి ఎందుకు ముఖ్యమైనవి?",
    dialogClarityText: "అవి ప్రారంభించడానికి ముందు విద్యార్థులకు అంచనాలను స్పష్టం చేయడం ద్వారా అసైన్‌మెంట్‌లను సులభతరం చేస్తాయి.",
    dialogConsistencyText: "అవి విద్యార్థులందరికీ ఒకే ప్రమాణాలతో గ్రేడ్ చేయబడతాయని నిర్ధారిస్తాయి, మూల్యాంకనాన్ని న్యాయంగా మరియు లక్ష్యంలా చేస్తాయి.",
    dialogFeedbackText: "అవి విద్యార్థులకు వారి బలాలు మరియు మెరుగుదల ప్రాంతాలను అర్థం చేసుకోవడంలో సహాయపడే నిర్దిష్ట, వివరణాత్మక అభిప్రాయాన్ని అందిస్తాయి.",
    dialogEfficiencyText: "అవి ఉపాధ్యాయులకు గ్రేడింగ్ ప్రక్రియను వేగంగా మరియు మరింత సూటిగా చేయగలవు.",
    formLabel: "అసైన్‌మెంట్ వివరణ",
    formPlaceholder: "ఉదా., 6వ తరగతి విద్యార్థుల కోసం సౌర వ్యవస్థ యొక్క నమూనాను రూపొందించే ప్రాజెక్ట్.",
    gradeLevel: "గ్రేడ్ స్థాయి",
    language: "భాష",
    buttonGenerate: "రూబ్రిక్ రూపొందించండి",
    buttonGenerating: "రూబ్రిక్ రూపొందిస్తోంది...",
    loadingText: "మీ రూబ్రిక్ నిర్మిస్తోంది...",
    strongClarity: "స్పష్టత:",
    strongConsistency: "స్థిరత్వం:",
    strongFeedback: "అభిప్రాయం:",
    strongEfficiency: "సామర్థ్యం:",
  },
  mr: {
    pageTitle: "रब्रिक जनरेटर",
    pageDescription: "कोणत्याही असाइनमेंटसाठी स्पष्ट आणि निष्पक्ष ग्रेडिंग रब्रिक्स तयार करा.",
    dialogTitle: "रब्रिक म्हणजे काय?",
    dialogDescription: "रब्रिक हे एक स्कोअरिंग साधन आहे जे असाइनमेंट किंवा कामासाठी कामगिरीच्या अपेक्षा स्पष्टपणे दर्शवते.",
    dialogWhy: "ते महत्त्वाचे का आहेत?",
    dialogClarityText: "ते सुरू करण्यापूर्वी विद्यार्थ्यांना अपेक्षा स्पष्ट करून असाइनमेंटमधील रहस्य दूर करतात.",
    dialogConsistencyText: "ते सुनिश्चित करतात की सर्व विद्यार्थ्यांना समान निकषांवर ग्रेड दिले जातात, ज्यामुळे मूल्यांकन निष्पक्ष आणि वस्तुनिष्ठ होते.",
    dialogFeedbackText: "ते विशिष्ट, तपशीलवार अभिप्राय देतात जे विद्यार्थ्यांना त्यांची शक्ती आणि सुधारणेची क्षेत्रे समजण्यास मदत करतात.",
    dialogEfficiencyText: "ते शिक्षकांसाठी ग्रेडिंग प्रक्रिया जलद आणि अधिक सरळ करू शकतात.",
    formLabel: "असाइनमेंटचे वर्णन",
    formPlaceholder: "उदा., 6 वीच्या विद्यार्थ्यांसाठी सौर मंडळाचे मॉडेल तयार करण्याचा प्रकल्प.",
    gradeLevel: "इयत्ता स्तर",
    language: "भाषा",
    buttonGenerate: "रब्रिक तयार करा",
    buttonGenerating: "रब्रिक तयार होत आहे...",
    loadingText: "तुमचे रब्रिक तयार होत आहे...",
    strongClarity: "स्पष्टता:",
    strongConsistency: "सुसंगतता:",
    strongFeedback: "अभिप्रాయ:",
    strongEfficiency: "कार्यक्षमता:",
  },
  ta: {
    pageTitle: "ரூப்ரிக் ஜெனரேட்டர்",
    pageDescription: "எந்தவொரு பணிக்கும் தெளிவான மற்றும் நியாயமான தரப்படுத்தல் ரூபிரிக்குகளை உருவாக்கவும்.",
    dialogTitle: "ரூப்ரிக் என்றால் என்ன?",
    dialogDescription: "ஒரு ரூப்ரிக் என்பது ஒரு மதிப்பெண் கருவியாகும், இது ஒரு பணி அல்லது வேலைக்கான செயல்திறன் எதிர்பார்ப்புகளை வெளிப்படையாகக் குறிக்கிறது.",
    dialogWhy: "அவை ஏன் முக்கியமானவை?",
    dialogClarityText: "அவை தொடங்குவதற்கு முன்பு மாணவர்களுக்கு எதிர்பார்ப்புகளைத் தெளிவுபடுத்துவதன் மூலம் பணிகளைப் பற்றிய மர்மத்தை நீக்குகின்றன.",
    dialogConsistencyText: "அவை அனைத்து மாணவர்களும் ஒரே மாதிரியான அளவுகோல்களுடன் தரப்படுத்தப்படுவதை உறுதிசெய்கின்றன, மதிப்பீட்டை நியாயமாகவும் புறநிலையாகவும் ஆக்குகின்றன.",
    dialogFeedbackText: "அவை மாணவர்களுக்கு அவர்களின் பலம் மற்றும் முன்னேற்றத்திற்கான பகுதிகளைப் புரிந்துகொள்ள உதவும் குறிப்பிட்ட, விரிவான கருத்துக்களை வழங்குகின்றன.",
    dialogEfficiencyText: "அவை ஆசிரியர்களுக்கு தரப்படுத்தல் செயல்முறையை வேகமாகவும் எளிமையாகவும் செய்ய முடியும்.",
    formLabel: "பணியின் விளக்கம்",
    formPlaceholder: "எ.கா., 6 ஆம் வகுப்பு மாணவர்களுக்கு சூரிய மண்டலத்தின் மாதிரியை உருவாக்கும் ஒரு திட்டம்.",
    gradeLevel: "தர நிலை",
    language: "மொழி",
    buttonGenerate: "ரூப்ரிக் உருவாக்கவும்",
    buttonGenerating: "ரூப்ரிக் உருவாக்கப்படுகிறது...",
    loadingText: "உங்கள் ரூப்ரிக் கட்டப்படுகிறது...",
    strongClarity: "தெளிவு:",
    strongConsistency: "நிலைத்தன்மை:",
    strongFeedback: "பின்னூட்டம்:",
    strongEfficiency: "செயல்திறன்:",
  },
  gu: {
    pageTitle: "રૂબ્રિક જનરેટર",
    pageDescription: "કોઈપણ સોંપણી માટે સ્પષ્ટ અને ન્યાયી ગ્રેડિંગ રૂબ્રિક્સ બનાવો.",
    dialogTitle: "રૂબ્રિક શું છે?",
    dialogDescription: "રૂબ્રિક એ સ્કોરિંગ સાધન છે જે સોંપણી અથવા કાર્ય માટે પ્રદર્શનની અપેક્ષાઓ સ્પષ્ટપણે રજૂ કરે છે.",
    dialogWhy: "તેઓ શા માટે મહત્વપૂર્ણ છે?",
    dialogClarityText: "તેઓ શરૂ કરતા પહેલા વિદ્યાર્થીઓ માટે અપેક્ષાઓ સ્પષ્ટ કરીને સોંપણીઓને રહસ્યમય બનાવે છે.",
    dialogConsistencyText: "તેઓ ખાતરી કરે છે કે બધા વિદ્યાર્થીઓને સમાન માપદંડો સાથે ગ્રેડ આપવામાં આવે છે, મૂલ્યાંકનને ન્યાયી અને ઉદ્દેશ્ય બનાવે છે.",
    dialogFeedbackText: "તેઓ વિશિષ્ટ, વિગતવાર પ્રતિસાદ પ્રદાન કરે છે જે વિદ્યાર્થીઓને તેમની શક્તિઓ અને સુધારણા માટેના ક્ષેત્રોને સમજવામાં મદદ કરે છે.",
    dialogEfficiencyText: "તેઓ શિક્ષકો માટે ગ્રેડિંગ પ્રક્રિયાને ઝડપી અને વધુ સીધી બનાવી શકે છે.",
    formLabel: "સોંપણીનું વર્ણન",
    formPlaceholder: "દા.ત., 6ઠ્ઠા ધોરણના વિદ્યાર્થીઓ માટે સૂર્યમંડળનું મોડેલ બનાવવાનો પ્રોજેક્ટ.",
    gradeLevel: "ગ્રેડ સ્તર",
    language: "ભાષા",
    buttonGenerate: "રૂબ્રિક બનાવો",
    buttonGenerating: "રૂબ્રિક બનાવી રહ્યું છે...",
    loadingText: "તમારું રૂબ્રિક બની રહ્યું છે...",
    strongClarity: "સ્પષ્ટતા:",
    strongConsistency: "સુસંગતતા:",
    strongFeedback: "પ્રતિસાદ:",
    strongEfficiency: "કાર્યક્ષમતા:",
  },
  kn: {
    pageTitle: "ರೂಬ್ರಿಕ್ ಜನರೇಟರ್",
    pageDescription: "ಯಾವುದೇ ನಿಯೋಜನೆಗಾಗಿ ಸ್ಪಷ್ಟ ಮತ್ತು ನ್ಯಾಯೋಚಿತ ಗ್ರೇಡಿಂಗ್ ರೂಬ್ರಿಕ್‌ಗಳನ್ನು ರಚಿಸಿ.",
    dialogTitle: "ರೂಬ್ರಿಕ್ ಎಂದರೇನು?",
    dialogDescription: "ರೂಬ್ರಿಕ್ ಎನ್ನುವುದು ಒಂದು ಅಂಕ ಸಾಧನವಾಗಿದ್ದು, ಇದು ನಿಯೋಜನೆ ಅಥವಾ ಕೆಲಸಕ್ಕಾಗಿ ಕಾರ್ಯಕ್ಷಮತೆಯ ನಿರೀಕ್ಷೆಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಪ್ರತಿನಿಧಿಸುತ್ತದೆ.",
    dialogWhy: "ಅವು ಏಕೆ ಮುಖ್ಯ?",
    dialogClarityText: "ಅವು ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ನಿರೀಕ್ಷೆಗಳನ್ನು ಸ್ಪಷ್ಟಪಡಿಸುವ ಮೂಲಕ ನಿಯೋಜನೆಗಳನ್ನು ರಹಸ್ಯಮುಕ್ತಗೊಳಿಸುತ್ತವೆ.",
    dialogConsistencyText: "ಅವು ಎಲ್ಲಾ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಒಂದೇ ಮಾನದಂಡಗಳೊಂದಿಗೆ ಗ್ರೇಡ್ ನೀಡುವುದನ್ನು ಖಚಿತಪಡಿಸುತ್ತವೆ, ಮೌಲ್ಯಮಾಪನವನ್ನು ನ್ಯಾಯಯುತ ಮತ್ತು ವಸ್ತುನಿಷ್ಠವಾಗಿಸುತ್ತವೆ.",
    dialogFeedbackText: "ಅವು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ತಮ್ಮ ಸಾಮರ್ಥ್ಯಗಳನ್ನು ಮತ್ತು ಸುಧಾರಣೆಯ ಕ್ಷೇತ್ರಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಮಾಡುವ ನಿರ್ದಿಷ್ಟ, ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಒದಗಿಸುತ್ತವೆ.",
    dialogEfficiencyText: "ಅವು ಶಿಕ್ಷಕರಿಗೆ ಗ್ರೇಡಿಂಗ್ ಪ್ರಕ್ರಿಯೆಯನ್ನು ವೇಗವಾಗಿ ಮತ್ತು ಹೆಚ್ಚು ಸರಳಗೊಳಿಸುತ್ತವೆ.",
    formLabel: "ನಿಯೋಜನೆಯ ವಿವರಣೆ",
    formPlaceholder: "ಉದಾ., 6 ನೇ ತರಗತಿಯ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಸೌರಮಂಡಲದ ಮಾದರಿಯನ್ನು ನಿರ್ಮಿಸುವ ಯೋಜನೆ.",
    gradeLevel: "ಗ್ರೇಡ್ ಮಟ್ಟ",
    language: "ಭಾಷೆ",
    buttonGenerate: "ರೂಬ್ರಿಕ್ ರಚಿಸಿ",
    buttonGenerating: "ರೂಬ್ರಿಕ್ ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    loadingText: "ನಿಮ್ಮ ರೂಬ್ರಿಕ್ ನಿರ್ಮಿಸಲಾಗುತ್ತಿದೆ...",
    strongClarity: "ಸ್ಪಷ್ಟತೆ:",
    strongConsistency: "ಸ್ಥಿರತೆ:",
    strongFeedback: "ಪ್ರತಿಕ್ರಿಯೆ:",
    strongEfficiency: "ದಕ್ಷತೆ:",
  },
};


export default function RubricGeneratorPage() {
  const [rubric, setRubric] = useState<RubricGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assignmentDescription: "",
      language: "en",
      gradeLevel: "7th Grade",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setRubric(null);
    try {
      const result = await generateRubric({...values, language: selectedLanguage});
      setRubric(result);
    } catch (error) {
      console.error("Failed to generate rubric:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the rubric. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("assignmentDescription", prompt);
    form.trigger("assignmentDescription");
  };
  
  const handleTranscript = (transcript: string) => {
    form.setValue("assignmentDescription", transcript);
    form.trigger("assignmentDescription");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ClipboardCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <span>{t.pageDescription}</span>
             <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Info className="h-5 w-5 text-accent-foreground/50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-headline">{t.dialogTitle}</DialogTitle>
                  <DialogDescription>
                   {t.dialogDescription}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong className="text-foreground">{t.dialogWhy}</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong className="text-foreground/80">{t.strongClarity}</strong> {t.dialogClarityText}</li>
                        <li><strong className="text-foreground/80">{t.strongConsistency}</strong> {t.dialogConsistencyText}</li>
                        <li><strong className="text-foreground/80">{t.strongFeedback}</strong> {t.dialogFeedbackText}</li>
                         <li><strong className="text-foreground/80">{t.strongEfficiency}</strong> {t.dialogEfficiencyText}</li>
                    </ul>
                </div>
              </DialogContent>
            </Dialog>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="assignmentDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.formLabel}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t.formPlaceholder}
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <MicrophoneInput onTranscriptChange={handleTranscript} />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="rubric" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">{t.gradeLevel}</FormLabel>
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
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">{t.language}</FormLabel>
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

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.buttonGenerating}
                  </>
                ) : (
                  t.buttonGenerate
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {rubric && <RubricDisplay rubric={rubric} />}
    </div>
  );
}
