
"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookText, Download, CheckCircle2, ListTree, TestTube2, ClipboardList, Save, Copy, Clock, GraduationCap, BookOpen } from 'lucide-react';
import { submitFeedback } from '@/app/actions/feedback';
import type { FC } from 'react';
import type { LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, X, Save as SaveIcon } from 'lucide-react'; // Removing ThumbsUp/Down imports if they conflict or keep if reusable icons
import { FeedbackDialog } from "@/components/feedback-dialog";

type LessonPlanDisplayProps = {
  lessonPlan: LessonPlanOutput;
  selectedLanguage?: string;
};

const displayTranslations: Record<string, any> = {
  en: {
    fallbackTitle: "Your Generated Lesson Plan",
    fallbackSubject: "General",
    fallbackGrade: "Class 5",
    buttons: {
      edit: "Edit",
      copy: "Copy",
      save: "Save",
      pdf: "PDF",
      cancel: "Cancel",
      saveChanges: "Save Changes"
    },
    sections: {
      objectives: "Objectives",
      materials: "Materials Needed",
      activities: "Activities",
      assessment: "Assessment"
    },
    placeholders: {
      objectives: "Enter objectives (one per line)",
      materials: "Enter materials (one per line)",
      activityName: "Activity Name",
      duration: "Duration",
      description: "Description",
      assessment: "Assessment details"
    },
    toasts: {
      changesSaved: "Changes Saved",
      changesSavedDesc: "Your edits have been applied to the view.",
      feedbackRecorded: "Feedback Recorded",
      feedbackDesc: "Thank you for helping us improve!",
      printTitle: "Print to PDF",
      printDesc: "Select 'Save as PDF' to save.",
      savedLibrary: "Saved to Library",
      savedDesc: "Saved as",
      saveFailed: "Save Failed",
      copied: "Copied to Clipboard",
      copiedDesc: "Lesson plan has been copied to your clipboard."
    }
  },
  hi: {
    fallbackTitle: "आपकी जनरेट की गई पाठ योजना",
    fallbackSubject: "सामान्य",
    fallbackGrade: "कक्षा 5",
    buttons: {
      edit: "संपादित करें",
      copy: "कॉपी करें",
      save: "सहेजें",
      pdf: "PDF",
      cancel: "रद्द करें",
      saveChanges: "बदलाव सहेजें"
    },
    sections: {
      objectives: "उद्देश्य",
      materials: "आवश्यक सामग्री",
      activities: "गतिविधियाँ",
      assessment: "मूल्यांकन"
    },
    placeholders: {
      objectives: "उद्देश्य दर्ज करें (प्रति पंक्ति एक)",
      materials: "सामग्री दर्ज करें (प्रति पंक्ति एक)",
      activityName: "गतिविधि का नाम",
      duration: "अवधि",
      description: "विवरण",
      assessment: "मूल्यांकन विवरण"
    },
    toasts: {
      changesSaved: "बदलाव सहेजे गए",
      changesSavedDesc: "आपके संपादन दृश्य पर लागू हो गए हैं।",
      feedbackRecorded: "प्रतिक्रिया दर्ज की गई",
      feedbackDesc: "हमें बेहतर बनाने में मदद करने के लिए धन्यवाद!",
      printTitle: "PDF में प्रिंट करें",
      printDesc: "सहेजने के लिए 'Save as PDF' चुनें।",
      savedLibrary: "लाइब्रेरी में सहेजा गया",
      savedDesc: "इस रूप में सहेजा गया",
      saveFailed: "सहेजने में विफल",
      copied: "क्लिपबोर्ड पर कॉपी किया गया",
      copiedDesc: "पाठ योजना आपके क्लिपबोर्ड पर कॉपी कर दी गई है।"
    }
  },
  bn: {
    fallbackTitle: "আপনার তৈরি করা পাঠ পরিকল্পনা",
    fallbackSubject: "সাধারণ",
    fallbackGrade: "পঞ্চম শ্রেণী",
    buttons: { edit: "সম্পাদনা করুন", copy: "কপি করুন", save: "সংরক্ষণ করুন", pdf: "PDF", cancel: "বাতিল করুন", saveChanges: "পরিবর্তন সংরক্ষণ করুন" },
    sections: { objectives: "উদ্দেশ্য", materials: "প্রয়োজনীয় উপকরণ", activities: "ক্রিয়াকলাপ", assessment: "মূল্যায়ন" },
    placeholders: { objectives: "উদ্দেশ্য লিখুন (প্রতি লাইনে একটি)", materials: "উপকরণ লিখুন (প্রতি লাইনে একটি)", activityName: "ক্রিয়াকলাপের নাম", duration: "সময়কাল", description: "বিবরণ", assessment: "মূল্যায়নের বিবরণ" },
    toasts: { changesSaved: "পরিবর্তন সংরক্ষিত হয়েছে", changesSavedDesc: "আপনার সম্পাদনাগুলি প্রয়োগ করা হয়েছে।", feedbackRecorded: "প্রতিক্রিয়া রেকর্ড করা হয়েছে", feedbackDesc: "আমাদের উন্নতি করতে সাহায্য করার জন্য ধন্যবাদ!", printTitle: "PDF এ প্রিন্ট করুন", printDesc: "সংরক্ষণ করতে 'Save as PDF' নির্বাচন করুন।", savedLibrary: "লাইব্রেরিতে সংরক্ষিত", savedDesc: "হিসাবে সংরক্ষিত", saveFailed: "সংরক্ষণ ব্যর্থ হয়েছে", copied: "ক্লিপবোর্ডে কপি করা হয়েছে", copiedDesc: "পাঠ পরিকল্পনাটি আপনার ক্লিপবোর্ডে কপি করা হয়েছে।" }
  },
  te: {
    fallbackTitle: "మీరు రూపొందించిన పాఠ్య ప్రణాళిక",
    fallbackSubject: "సాధారణ",
    fallbackGrade: "5వ తరగతి",
    buttons: { edit: "సవరించండి", copy: "కాపీ చేయండి", save: "సేవ్ చేయండి", pdf: "PDF", cancel: "రద్దు చేయండి", saveChanges: "మార్పులను సేవ్ చేయండి" },
    sections: { objectives: "లక్ష్యాలు", materials: "అవసరమైన సామాగ్రి", activities: "కార్యకలాపాలు", assessment: "మూల్యాంకనం" },
    placeholders: { objectives: "లక్ష్యాలను నమోదు చేయండి (లైన్‌కు ఒకటి)", materials: "సామాగ్రిని నమోదు చేయండి (లైన్‌కు ఒకటి)", activityName: "కార్యకలాపం పేరు", duration: "నిడివి", description: "వివరాలు", assessment: "మూల్యాంకనం వివరాలు" },
    toasts: { changesSaved: "మార్పులు సేవ్ చేయబడ్డాయి", changesSavedDesc: "మీ సవరణలు వర్తింపజేయబడ్డాయి.", feedbackRecorded: "అభిప్రాయం రికార్డ్ చేయబడింది", feedbackDesc: "మాకు మెరుగుపరచడంలో సహాయపడినందుకు ధన్యవాదాలు!", printTitle: "PDFకి ప్రింట్ చేయండి", printDesc: "సేవ్ చేయడానికి 'Save as PDF' ఎంచుకోండి.", savedLibrary: "లైబ్రరీకి సేవ్ చేయబడింది", savedDesc: "దీనిగా సేవ్ చేయబడింది", saveFailed: "సేవ్ చేయడం విఫలమైంది", copied: "క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది", copiedDesc: "పాఠ్య ప్రణాళిక మీ క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది." }
  },
  mr: {
    fallbackTitle: "तुमची तयार केलेली पाठ नियोजन",
    fallbackSubject: "सामान्य",
    fallbackGrade: "इयत्ता ५वी",
    buttons: { edit: "संपादित करा", copy: "कॉपी करा", save: "जतन करा", pdf: "PDF", cancel: "रद्द करा", saveChanges: "बदल जतन करा" },
    sections: { objectives: "उद्देश्ये", materials: "आवश्यक साहित्य", activities: "उपक्रम", assessment: "मूल्यमापन" },
    placeholders: { objectives: "उद्देश्ये प्रविष्ट करा (एका ओळीत एक)", materials: "साहित्य प्रविष्ट करा (एका ओळीत एक)", activityName: "उपक्रमाचे नाव", duration: "कालावधी", description: "वर्णन", assessment: "मूल्यमापन तपशील" },
    toasts: { changesSaved: "बदल जतन केले", changesSavedDesc: "तुमचे संपादन लागू केले गेले आहेत.", feedbackRecorded: "अभिप्राय नोंदवला गेला", feedbackDesc: "आम्हाला सुधारण्यास मदत केल्याबद्दल धन्यवाद!", printTitle: "PDF मध्ये प्रिंट करा", printDesc: "जतन करण्यासाठी 'Save as PDF' निवडा.", savedLibrary: "लायब्ररीमध्ये जतन केले", savedDesc: "म्हणून जतन केले", saveFailed: "जतन करण्यात अयशस्वी", copied: "क्लिपबोर्डवर कॉपी केले", copiedDesc: "पाठ नियोजन तुमच्या क्लिपबोर्डवर कॉपी केले गेले आहे." }
  },
  ta: {
    fallbackTitle: "உங்கள் உருவாக்கப்பட்ட பாடத் திட்டம்",
    fallbackSubject: "பொது",
    fallbackGrade: "வகுப்பு 5",
    buttons: { edit: "திருத்து", copy: "நகலெடு", save: "சேமி", pdf: "PDF", cancel: "ரத்துசெய்", saveChanges: "மாற்றங்களைச் சேமி" },
    sections: { objectives: "நோக்கங்கள்", materials: "தேவையான பொருட்கள்", activities: "செயல்பாடுகள்", assessment: "மதிப்பீடு" },
    placeholders: { objectives: "நோக்கங்களை உள்ளிடவும் (வரிக்கு ஒன்று)", materials: "பொருட்களை உள்ளிடவும் (வரிக்கு ஒன்று)", activityName: "செயல்பாட்டின் பெயர்", duration: "கால அளவு", description: "விளக்கம்", assessment: "மதிப்பீடு விவரங்கள்" },
    toasts: { changesSaved: "மாற்றங்கள் சேமிக்கப்பட்டன", changesSavedDesc: "உங்கள் திருத்தங்கள் பயன்படுத்தப்பட்டன.", feedbackRecorded: "கருத்து பதிவு செய்யப்பட்டது", feedbackDesc: "நாங்கள் மேம்பட உதவியதற்கு நன்றி!", printTitle: "PDF இல் அச்சிடவும்", printDesc: "சேமிக்க 'Save as PDF' ஐத் தேர்ந்தெடுக்கவும்.", savedLibrary: "நூலகத்தில் சேமிக்கப்பட்டது", savedDesc: "ஆக சேமிக்கப்பட்டது", saveFailed: "சேமிக்க முடியவில்லை", copied: "கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது", copiedDesc: "பாடத் திட்டம் உங்கள் கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது." }
  },
  gu: {
    fallbackTitle: "તમારી બનાવેલી પાઠ યોજના",
    fallbackSubject: "સામાન્ય",
    fallbackGrade: "ધોરણ 5",
    buttons: { edit: "સંપાદિત કરો", copy: "નકલ કરો", save: "સાચવો", pdf: "PDF", cancel: "રદ કરો", saveChanges: "ફેરફારો સાચવો" },
    sections: { objectives: "ઉદ્દેશ્યો", materials: "જરૂરી સામગ્રી", activities: "પ્રવૃત્તિઓ", assessment: "મૂલ્યાંકન" },
    placeholders: { objectives: "ઉદ્દેશ્યો દાખલ કરો (લાઇન દીઠ એક)", materials: "સામગ્રી દાખલ કરો (લાઇન દીઠ એક)", activityName: "પ્રવૃત્તિનું નામ", duration: "સમયગાળો", description: "વર્ણન", assessment: "મૂલ્યાંકન વિગતો" },
    toasts: { changesSaved: "ફેરફારો સચવાયા", changesSavedDesc: "તમારા ફેરફારો લાગુ કરવામાં આવ્યા છે.", feedbackRecorded: "પ્રતિસાદ નોંધાયો", feedbackDesc: "અમને સુધારવામાં મદદ કરવા બદલ આભાર!", printTitle: "PDF માં પ્રિન્ટ કરો", printDesc: "સાચવવા માટે 'Save as PDF' પસંદ કરો.", savedLibrary: "લાઇબ્રેરીમાં સચવાયું", savedDesc: "તરીકે સચવાયું", saveFailed: "સાચવવામાં નિષ્ફળ", copied: "ક્લિપબોર્ડ પર નકલ કરી", copiedDesc: "પાઠ યોજના તમારી ક્લિપબોર્ડ પર નકલ કરવામાં આવી છે." }
  },
  kn: {
    fallbackTitle: "ನಿಮ್ಮ ರಚಿಸಿದ ಪಾಠ ಯೋಜನೆ",
    fallbackSubject: "ಸಾಮಾನ್ಯ",
    fallbackGrade: "ತರಗತಿ 5",
    buttons: { edit: "ಸಂಪಾದಿಸಿ", copy: "ನಕಲಿಸಿ", save: "ಉಳಿಸಿ", pdf: "PDF", cancel: "ರದ್ದುಮಾಡಿ", saveChanges: "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ" },
    sections: { objectives: "ಉದ್ದೇಶಗಳು", materials: "ಅಗತ್ಯವಿರುವ ಸಾಮಗ್ರಿಗಳು", activities: "ಚಟುವಟಿಕೆಗಳು", assessment: "ಮೌಲ್ಯಮಾಪನ" },
    placeholders: { objectives: "ಉದ್ದೇಶಗಳನ್ನು ನಮೂದಿಸಿ (ಸಾಲುಗೆ ಒಂದು)", materials: "ಸಾಮಗ್ರಿಗಳನ್ನು ನಮೂದಿಸಿ (ಸಾಲುಗೆ ಒಂದು)", activityName: "ಚಟುವಟಿಕೆಯ ಹೆಸರು", duration: "ಅವಧಿ", description: "ವಿವರಣೆ", assessment: "ಮೌಲ್ಯಮಾಪನ ವಿವರಗಳು" },
    toasts: { changesSaved: "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ", changesSavedDesc: "ನಿಮ್ಮ ಸಂಪಾದನೆಗಳನ್ನು ಅನ್ವಯಿಸಲಾಗಿದೆ.", feedbackRecorded: "ಪ್ರತಿಕ್ರಿಯೆ ದಾಖಲಿಸಲಾಗಿದೆ", feedbackDesc: "ನಮಗೆ ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು!", printTitle: "PDF ಗೆ ಮುದ್ರಿಸಿ", printDesc: "ಉಳಿಸಲು 'Save as PDF' ಆಯ್ಕೆಮಾಡಿ.", savedLibrary: "ಲೈಬ್ರರಿಯಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ", savedDesc: "ಹೀಗೆ ಉಳಿಸಲಾಗಿದೆ", saveFailed: "ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ", copied: "ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ", copiedDesc: "ಪಾಠ ಯೋಜನೆಯನ್ನು ನಿಮ್ಮ ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ." }
  },
  pa: {
    fallbackTitle: "ਤੁਹਾਡੀ ਬਣਾਈ ਗਈ ਪਾਠ ਯੋਜਨਾ",
    fallbackSubject: "ਆਮ",
    fallbackGrade: "ਜਮਾਤ 5",
    buttons: { edit: "ਸੰਪਾਦਿਤ ਕਰੋ", copy: "ਕਾਪੀ ਕਰੋ", save: "ਸੰਭਾਲੋ", pdf: "PDF", cancel: "ਰੱਦ ਕਰੋ", saveChanges: "ਤਬਦੀਲੀਆਂ ਸੰਭਾਲੋ" },
    sections: { objectives: "ਉਦੇਸ਼", materials: "ਲੋੜੀਂਦੀ ਸਮੱਗਰੀ", activities: "ਗਤੀਵਿਧੀਆਂ", assessment: "ਮੁਲਾਂਕਣ" },
    placeholders: { objectives: "ਉਦੇਸ਼ ਦਰਜ ਕਰੋ (ਪ੍ਰਤੀ ਲਾਈਨ ਇੱਕ)", materials: "ਸਮੱਗਰੀ ਦਰਜ ਕਰੋ (ਪ੍ਰਤੀ ਲਾਈਨ ਇੱਕ)", activityName: "ਗਤੀਵਿਧੀ ਦਾ ਨਾਮ", duration: "ਮਿਆਦ", description: "ਵੇਰਵਾ", assessment: "ਮੁਲਾਂਕਣ ਵੇਰਵੇ" },
    toasts: { changesSaved: "ਤਬਦੀਲੀਆਂ ਸੰਭਾਲੀਆਂ ਗਈਆਂ", changesSavedDesc: "ਤੁਹਾਡੀਆਂ ਤਬਦੀਲੀਆਂ ਲਾਗੂ ਹੋ ਗਈਆਂ ਹਨ।", feedbackRecorded: "ਫੀਡਬੈਕ ਦਰਜ ਕੀਤਾ ਗਿਆ", feedbackDesc: "ਸਾਨੂੰ ਬਿਹਤਰ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਨ ਲਈ ਧੰਨਵਾਦ!", printTitle: "PDF ਵਿੱਚ ਪ੍ਰਿੰਟ ਕਰੋ", printDesc: "ਸੰਭਾਲਣ ਲਈ 'Save as PDF' ਚੁਣੋ।", savedLibrary: "ਲਾਇਬ੍ਰੇਰੀ ਵਿੱਚ ਸੰਭਾਲਿਆ ਗਿਆ", savedDesc: "ਵਜੋਂ ਸੰਭਾਲਿਆ ਗਿਆ", saveFailed: "ਸੰਭਾਲਣ ਵਿੱਚ ਅਸਫਲ", copied: "ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਕੀਤਾ ਗਿਆ", copiedDesc: "ਪਾਠ ਯੋਜਨਾ ਤੁਹਾਡੇ ਕਲਿੱਪਬੋਰਡ 'ਤੇ ਕਾਪੀ ਕੀਤੀ ਗਈ ਹੈ।" }
  },
  ml: {
    fallbackTitle: "നിങ്ങൾ തയ്യാറാക്കിയ പാഠ്യപദ്ധതി",
    fallbackSubject: "പൊതുവായവ",
    fallbackGrade: "ക്ലാസ് 5",
    buttons: { edit: "എഡിറ്റ് ചെയ്യുക", copy: "പകർപ്പുക", save: "സൂക്ഷിക്കുക", pdf: "PDF", cancel: "റദ്ദാക്കുക", saveChanges: "മാറ്റങ്ങൾ സൂക്ഷിക്കുക" },
    sections: { objectives: "ലക്ഷ്യങ്ങൾ", materials: "ആവശ്യമായ സാമഗ്രികൾ", activities: "പ്രവർത്തനങ്ങൾ", assessment: "മൂല്യനിർണ്ണയം" },
    placeholders: { objectives: "ലക്ഷ്യങ്ങൾ ചേർക്കുക (വരിയിൽ ഒന്ന്)", materials: "സാമഗ്രികൾ ചേർക്കുക (വരിയിൽ ഒന്ന്)", activityName: "പ്രവർത്തനത്തിന്റെ പേര്", duration: "ദൈർഘ്യം", description: "വിവരണം", assessment: "മൂല്യനിർണ്ണയ വിവരങ്ങൾ" },
    toasts: { changesSaved: "മാറ്റങ്ങൾ സൂക്ഷിച്ചു", changesSavedDesc: "നിങ്ങളുടെ എഡിറ്റുകൾ പ്രയോഗിച്ചു.", feedbackRecorded: "ഫീഡ്ബാക്ക് രേഖപ്പെടുത്തി", feedbackDesc: "ഞങ്ങളെ മെച്ചപ്പെടുത്താൻ സഹായിച്ചതിന് നന്ദി!", printTitle: "PDF-ലേക്ക് പ്രിന്റ് ചെയ്യുക", printDesc: "സൂക്ഷിക്കാൻ 'Save as PDF' തിരഞ്ഞെടുക്കുക.", savedLibrary: "ലൈബ്രറിയിൽ സൂക്ഷിച്ചു", savedDesc: "ആയി സൂക്ഷിച്ചു", saveFailed: "സൂക്ഷിക്കുന്നതിൽ പരാജയപ്പെട്ടു", copied: "ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി", copiedDesc: "പാഠ്യപദ്ധതി നിങ്ങളുടെ ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി." }
  },
  or: {
    fallbackTitle: "ଆପଣଙ୍କ ପ୍ରସ୍ତୁତ ପାଠ ଯୋଜନା",
    fallbackSubject: "ସାଧାରଣ",
    fallbackGrade: "ଶ୍ରେଣୀ ୫",
    buttons: { edit: "ସମ୍ପାଦନ କରନ୍ତୁ", copy: "ନକଲ କରନ୍ତୁ", save: "ସଂରକ୍ଷଣ କରନ୍ତୁ", pdf: "PDF", cancel: "ବାତିଲ କରନ୍ତୁ", saveChanges: "ପରିବର୍ତ୍ତନ ସଂରକ୍ଷଣ କରନ୍ତୁ" },
    sections: { objectives: "ଉଦ୍ଦେଶ୍ୟ", materials: "ଆବଶ୍ୟକ ସାମଗ୍ରୀ", activities: "କାର୍ଯ୍ୟକଳାପ", assessment: "ମୂଲ୍ୟାଙ୍କନ" },
    placeholders: { objectives: "ଉଦ୍ଦେଶ୍ୟ ପ୍ରବେଶ କରନ୍ତୁ (ଧାଡି ପିଛା ଗୋଟିଏ)", materials: "ସାମଗ୍ରୀ ପ୍ରବେଶ କରନ୍ତୁ (ଧାଡି ପିଛା ଗୋଟିଏ)", activityName: "କାର୍ଯ୍ୟକଳାପର ନାମ", duration: "ଅବଧି", description: "ବିବରଣୀ", assessment: "ମୂଲ୍ୟାଙ୍କନ ବିବରଣୀ" },
    toasts: { changesSaved: "ପରିବର୍ତ୍ତନ ସଂରକ୍ଷିତ ହେଲା", changesSavedDesc: "ଆପଣଙ୍କ ସମ୍ପାଦନ ପ୍ରୟୋଗ ହେଲା |", feedbackRecorded: "ମତାମତ ରେକର୍ଡ ହେଲା", feedbackDesc: "ଆମକୁ ଉନ୍ନତ କରିବାରେ ସାହାଯ୍ୟ କରିଥିବାରୁ ଧନ୍ୟବାଦ!", printTitle: "PDF ରେ ପ୍ରିଣ୍ଟ କରନ୍ତୁ", printDesc: "ସଂରକ୍ଷଣ ପାଇଁ 'Save as PDF' ଚୟନ କରନ୍ତୁ |", savedLibrary: "ଲାଇବ୍ରେରୀରେ ସଂରକ୍ଷିତ", savedDesc: "ଭାବରେ ସଂରକ୍ଷିତ", saveFailed: "ସଂରକ୍ଷଣ ବିଫଳ", copied: "କ୍ଲିପବୋର୍ଡରେ ନକଲ ହେଲା", copiedDesc: "ପାଠ ଯୋଜନା ଆପଣଙ୍କ କ୍ଲିପବୋର୍ଡକୁ ନକଲ କରାଯାଇଛି |" }
  }
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan, selectedLanguage = 'en' }) => {
  const { toast } = useToast();
  const t = displayTranslations[selectedLanguage] || displayTranslations.en;
  const [editablePlan, setEditablePlan] = useState(lessonPlan);
  const [isEditing, setIsEditing] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    setEditablePlan(lessonPlan);
  }, [lessonPlan]);

  const handleSaveEdit = () => {
    setIsEditing(false);
    toast({
      title: t.toasts.changesSaved,
      description: t.toasts.changesSavedDesc,
    });
  };

  const handleFeedback = async (rating: 'thumbs-up' | 'thumbs-down') => {
    await submitFeedback({
      page: '/lesson-plan',
      feature: 'lesson-plan-generator',
      rating,
      context: { title: lessonPlan.title }
    });
    setFeedbackSubmitted(true);
    toast({
      title: t.toasts.feedbackRecorded,
      description: t.toasts.feedbackDesc,
    });
  };

  const handleCancelEdit = () => {
    setEditablePlan(lessonPlan);
    setIsEditing(false);
  };

  const handleDownload = async () => {
    const element = document.getElementById('lesson-plan-pdf');
    if (!element) return;

    const actionButtons = element.querySelector('.no-print');
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

    try {
      toast({ title: "Generating PDF...", description: "Preparing lesson plan." });

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > 297) {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= 297;
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      const cleanTitle = (lessonPlan.title || 'Lesson Plan').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Sahayak_Lesson_${cleanTitle}_${lessonPlan.gradeLevel || ''}.pdf`);

      toast({ title: "PDF Downloaded", description: "Your file is ready." });
    } catch (error) {
      console.error("PDF Error:", error);
      toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
    } finally {
      if (actionButtons) (actionButtons as HTMLElement).style.display = '';
    }
  };

  const handleSave = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      let user = auth.currentUser;

      // Handle Anonymous Auth if needed
      if (!user) {
        const { signInAnonymously } = await import('firebase/auth');
        const userCred = await signInAnonymously(auth);
        user = userCred.user;
      }

      // Prepare payload strictly matching SaveContentSchema using 1.0.0 API
      const saveTitle = lessonPlan.title && lessonPlan.title !== 'Lesson Plan'
        ? lessonPlan.title
        : `${lessonPlan.subject || 'General'} Lesson - ${lessonPlan.gradeLevel || 'Unspecified'}`;

      const payload = {
        id: crypto.randomUUID(), // Generate ID client-side or let server do it (server schema expects UUID in ID)
        type: 'lesson-plan',
        title: saveTitle,
        gradeLevel: lessonPlan.gradeLevel || 'Class 5',
        subject: lessonPlan.subject || 'General',
        topic: lessonPlan.title || 'Lesson', // Fallback for topic
        language: 'English', // Defaulting for now, ideally input should provide this
        isPublic: false,
        isDraft: false,
        data: lessonPlan
      };

      const token = await user.getIdToken();

      const response = await fetch('/api/content/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server rejected save');
      }

      // Calculate Edit Percentage for Analytics (Accuracy Metric)
      // We compare the original JSON string vs the new JSON string to get a rough "change" metric
      const originalStr = JSON.stringify(lessonPlan);
      const modifiedStr = JSON.stringify(editablePlan);

      // Dynamic import to avoid circular dependencies if any (though utils is safe)
      const { calculateEditPercentage } = await import('@/lib/utils');
      const editPercent = calculateEditPercentage(originalStr, modifiedStr);

      // Track the "Save" event with accuracy metrics
      // @ts-ignore - dynamic import of analytics to avoid hook rules in callback
      const { trackContentCreated } = await import('@/lib/analytics-events');
      trackContentCreated({
        content_type: 'lesson-plan',
        language: (lessonPlan as any).language || selectedLanguage || 'en',
        grade_level: lessonPlan.gradeLevel ?? undefined,
        subject: lessonPlan.subject ?? undefined,
        success: true,
        generation_time_sec: 0, // Not a generation event
        regeneration_count: 0,
        exported: false,
        edited: editPercent > 0,
        edit_percentage: editPercent
      });

      toast({
        title: t.toasts.savedLibrary,
        description: `${t.toasts.savedDesc} "${saveTitle}"`,
      });
    } catch (error) {
      console.error("Save Error:", error);
      toast({
        title: t.toasts.saveFailed,
        description: error instanceof Error ? error.message : "Could not save to library.",
        variant: "destructive"
      });
    }
  };

  const handleCopy = () => {
    const lessonPlanText = `
${editablePlan.title || 'Lesson Plan'}

OBJECTIVES:
${editablePlan.objectives.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n')}

MATERIALS NEEDED:
${editablePlan.materials.map((mat: string, i: number) => `• ${mat}`).join('\n')}

ACTIVITIES:
${editablePlan.activities.map((act: any, i: number) => `
${i + 1}. ${act.name} (${act.duration})
   ${act.description}
`).join('\n')}

ASSESSMENT:
${editablePlan.assessment}
    `.trim();

    navigator.clipboard.writeText(lessonPlanText);
    toast({
      title: t.toasts.copied,
      description: t.toasts.copiedDesc,
    });
  };

  if (!lessonPlan) {
    return null;
  }

  return (
    <Card id="lesson-plan-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-start justify-between">
          <div className="space-y-2 flex-1">
            <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
              <BookText className="h-7 w-7" />
              {lessonPlan.title || t.fallbackTitle}
            </CardTitle>

            {/* Metadata Section */}
            <div className="flex flex-wrap gap-3 mt-3">
              {lessonPlan.gradeLevel && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <GraduationCap className="h-4 w-4" />
                  {lessonPlan.gradeLevel}
                </Badge>
              )}
              {lessonPlan.duration && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <Clock className="h-4 w-4" />
                  {lessonPlan.duration}
                </Badge>
              )}
              {lessonPlan.subject && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <BookOpen className="h-4 w-4" />
                  {lessonPlan.subject}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-start gap-2 no-print">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <X className="mr-2 h-4 w-4" />
                  {t.buttons.cancel}
                </Button>
                <Button variant="default" size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                  <Save className="mr-2 h-4 w-4" />
                  {t.buttons.saveChanges}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t.buttons.edit}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t.buttons.copy}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  {t.buttons.save}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  {t.buttons.pdf}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full" defaultValue={['Objectives', 'Activities']}>

          <AccordionItem value="Objectives">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t.sections.objectives}
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              {isEditing ? (
                <Textarea
                  value={editablePlan.objectives.join('\n')}
                  onChange={(e) => setEditablePlan({ ...editablePlan, objectives: e.target.value.split('\n') })}
                  className="min-h-[150px]"
                  placeholder={t.placeholders.objectives}
                />
              ) : (
                <ul className="list-disc space-y-2">
                  {editablePlan.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Materials">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <ListTree className="h-5 w-5 text-primary" />
                {t.sections.materials}
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              {isEditing ? (
                <Textarea
                  value={editablePlan.materials.join('\n')}
                  onChange={(e) => setEditablePlan({ ...editablePlan, materials: e.target.value.split('\n') })}
                  className="min-h-[100px]"
                  placeholder={t.placeholders.materials}
                />
              ) : (
                <ul className="list-disc space-y-2">
                  {editablePlan.materials.map((material, index) => (
                    <li key={index}>{material}</li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Activities">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5 text-primary" />
                {t.sections.activities}
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-4 pt-4">
              {editablePlan.activities.map((activity, index) => (
                <div key={index} className="pl-4 border-l-2 border-primary/50 space-y-2">
                  {isEditing ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={activity.name}
                          onChange={(e) => {
                            const newActivities = [...editablePlan.activities];
                            newActivities[index] = { ...newActivities[index], name: e.target.value };
                            setEditablePlan({ ...editablePlan, activities: newActivities });
                          }}
                          placeholder={t.placeholders.activityName}
                          className="font-semibold flex-1"
                        />
                        <Input
                          value={activity.duration}
                          onChange={(e) => {
                            const newActivities = [...editablePlan.activities];
                            newActivities[index] = { ...newActivities[index], duration: e.target.value };
                            setEditablePlan({ ...editablePlan, activities: newActivities });
                          }}
                          placeholder={t.placeholders.duration}
                          className="w-32"
                        />
                      </div>
                      <Textarea
                        value={activity.description}
                        onChange={(e) => {
                          const newActivities = [...editablePlan.activities];
                          newActivities[index] = { ...newActivities[index], description: e.target.value };
                          setEditablePlan({ ...editablePlan, activities: newActivities });
                        }}
                        placeholder={t.placeholders.description}
                      />
                    </>
                  ) : (
                    <>
                      <h4 className="font-semibold text-foreground">{activity.name} ({activity.duration})</h4>
                      <p>{activity.description}</p>
                    </>
                  )}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Assessment">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                {t.sections.assessment}
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pt-2 pl-4">
              {isEditing ? (
                <Textarea
                  value={editablePlan.assessment ?? ''}
                  onChange={(e) => setEditablePlan({ ...editablePlan, assessment: e.target.value })}
                  className="min-h-[100px]"
                  placeholder={t.placeholders.assessment}
                />
              ) : (
                <p>{editablePlan.assessment}</p>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
      <div className="p-6 border-t border-slate-100 flex justify-end">
        <FeedbackDialog
          page="lesson-plan"
          feature="lesson-plan-result"
          context={{
            topic: lessonPlan.title,
            grade: lessonPlan.gradeLevel,
            subject: lessonPlan.subject
          }}
        />
      </div>
    </Card>
  );
};
