import { z } from "zod";

export const formSchema = z.object({
    topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
    language: z.string().optional(),
    gradeLevels: z.array(z.string()).optional(),
    imageDataUri: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export const topicPlaceholderTranslations: Record<string, string> = {
    en: "e.g., 'Create a lesson plan for the Indian Monsoon'",
    hi: "उदा., 'भारतीय मानसून के लिए एक पाठ योजना बनाएं'",
    bn: "উদা., 'ভারতীয় বর্ষার জন্য একটি পাঠ পরিকল্পনা তৈরি করুন'",
    te: "ఉదా., 'భారతీయ రుతుపవనాల కోసం ఒక పాఠ్య ప్రణాళికను సృష్టించండి'",
    mr: "उदा., 'भारतीय मान्सूनसाठी एक पाठ योजना तयार करा'",
    ta: "உதா., 'இந்திய பருவமழைக்கு ஒரு பாடம் திட்டம் உருவாக்கவும்'",
    gu: "દા.ત., 'ભારતીય ચોમાસા માટે એક પાઠ યોજના બનાવો'",
    kn: "ಉದಾ., 'ಭಾರತೀಯ ಮಾನ್ಸೂನ್‌ಗಾಗಿ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ'",
};
