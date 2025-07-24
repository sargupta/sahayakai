
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

type ExamplePromptsProps = {
  onPromptClick: (prompt: string) => void;
  selectedLanguage: string;
};

const translations: Record<string, Record<string, string>> = {
  waterCycle: {
    en: "A lesson plan on the water cycle",
    hi: "जल चक्र पर एक पाठ योजना",
    bn: "জল চক্রের উপর একটি পাঠ পরিকল্পনা",
    te: "నీటి చక్రంపై ఒక పాఠ్య ప్రణాళిక",
    mr: "जलचक्रावर एक पाठ योजना",
    ta: "நீர் சுழற்சி பற்றிய ஒரு பாடம் திட்டம்",
    gu: "જળ ચક્ર પર એક પાઠ યોજના",
    kn: "ನೀರಿನ ಚಕ್ರದ ಬಗ್ಗೆ ಪಾಠ ಯೋಜನೆ",
  },
  skyBlue: {
    en: "Why is the sky blue?",
    hi: "आसमान नीला क्यों है?",
    bn: "আকাশ নীল কেন?",
    te: "ఆకాశం నీలం ఎందుకు?",
    mr: "आकाश निळे का आहे?",
    ta: "வானம் ஏன் நீல நிறத்தில் உள்ளது?",
    gu: "આકાશ વાદળી કેમ છે?",
    kn: "ಆಕಾಶ ಏಕೆ ನೀಲಿಯಾಗಿದೆ?",
  },
  hibiscusDiagram: {
    en: "Draw a simple diagram of parts of Hibiscus for class 4",
    hi: "कक्षा 4 के लिए गुड़हल के भागों का एक सरल चित्र बनाएं",
    bn: "চতুর্থ শ্রেণীর জন্য জবা ফুলের বিভিন্ন অংশের একটি সহজ চিত্র আঁকুন",
    te: "4వ తరగతి కోసం మందార భాగాల యొక్క సాధారణ రేఖాచిత్రాన్ని గీయండి",
    mr: "इयत्ता 4 साठी जास्वंदीच्या भागांचे सोपे चित्र काढा",
    ta: "4 ஆம் வகுப்புக்கு செம்பருத்தி பாகங்களின் எளிய வரைபடத்தை வரையவும்",
    gu: "વર્ગ 4 માટે હિબિસ્કસના ભાગોનો એક સરળ રેખાકૃતિ દોરો",
    kn: "4 ನೇ ತರಗತಿಗೆ ದಾಸವಾಳದ ಭಾಗಗಳ ಸರಳ ರೇಖಾಚಿತ್ರವನ್ನು ಬರೆಯಿರಿ",
  },
  braveMouse: {
    en: "A short story about a brave mouse for class 2",
    hi: "कक्षा 2 के लिए एक बहादुर चूहे की एक छोटी कहानी",
    bn: "দ্বিতীয় শ্রেণীর জন্য একটি সাহসী ইঁদুরের একটি ছোট গল্প",
    te: "2వ తరగతికి చెందిన ధైర్యమైన ఎలుక గురించిన ఒక చిన్న కథ",
    mr: "इयत्ता 2 साठी एका शूर उंदराची एक छोटीशी गोष्ट",
    ta: "2 ஆம் வகுப்புக்கான ஒரு துணிச்சலான எலியைப் பற்றிய ஒரு చిన్న கதை",
    gu: "વર્ગ 2 માટે બહાદુર ઉંદર વિશેની ટૂંકી વાર્તા",
    kn: "2 ನೇ ತರಗತಿಗೆ ಧೈರ್ಯಶಾಲಿ ಇಲಿಯ ಬಗ್ಗೆ ಒಂದು ಸಣ್ಣ ಕಥೆ",
  },
};

export const ExamplePrompts: FC<ExamplePromptsProps> = ({ onPromptClick, selectedLanguage }) => {
  const prompts = Object.keys(translations).map(key => {
    return translations[key][selectedLanguage] || translations[key]['en'];
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Lightbulb className="h-4 w-4" />
        <span>Try one of these</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-xs h-auto py-1 px-2.5"
            onClick={() => onPromptClick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
};
