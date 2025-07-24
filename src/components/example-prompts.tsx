
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

type ExamplePromptsProps = {
  onPromptClick: (prompt: string) => void;
  selectedLanguage: string;
};

const promptTranslations: Record<string, Record<string, string>> = {
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
    en: "A simple diagram of parts of Hibiscus for class 4",
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
  visualAidFlower: {
    en: "A simple drawing of a flower showing its main parts: root, stem, leaf, and petal.",
    hi: "एक फूल का सरल चित्र जिसमें उसके मुख्य भाग दिखाए गए हैं: जड़, तना, पत्ती और पंखुड़ी।",
    bn: "একটি ফুলের একটি সাধারণ অঙ্কন যা তার প্রধান অংশগুলি দেখায়: মূল, কাণ্ড, পাতা এবং পাপড়ি।",
    te: "పువ్వు యొక్క ప్రధాన భాగాలను చూపే ఒక సాధారణ డ్రాయింగ్: రూట్, కాండం, ఆకు మరియు రేక.",
    mr: "एका फुलाचे साधे रेखाचित्र ज्यामध्ये त्याचे मुख्य भाग दर्शविलेले आहेत: मूळ, देठ, पान आणि पाकळी.",
    ta: "ஒரு பூவின் எளிய வரைபடம் அதன் முக்கிய பகுதிகளைக் காட்டுகிறது: வேர், தண்டு, இலை மற்றும் இதழ்.",
    gu: "એક ફૂલનું એક સરળ ચિત્ર જે તેના મુખ્ય ભાગો દર્શાવે છે: મૂળ, દાંડી, પાંદડું અને પાંખડી.",
    kn: "ಹೂವಿನ ಒಂದು ಸರಳ ರೇಖಾಚಿತ್ರವು ಅದರ ಮುಖ್ಯ ಭಾಗಗಳನ್ನು ತೋರಿಸುತ್ತದೆ: ಬೇರು, ಕಾಂಡ, ಎಲೆ ಮತ್ತು ದಳ.",
  },
  visualAidWaterCycle: {
    en: "A diagram showing the water cycle with labels for evaporation, condensation, and precipitation.",
    hi: "वाष्पीकरण, संघनन और वर्षा के लेबल के साथ जल चक्र दिखाने वाला एक आरेख।",
    bn: "বাষ্পীভবন, ঘনীভবন এবং বৃষ্টিপাতের জন্য লেবেল সহ জলচক্র দেখানো একটি চিত্র।",
    te: "బాష్పీభవనం, సంక్షేపణం మరియు అవపాతం కోసం లేబుల్‌లతో నీటి చక్రాన్ని చూపే రేఖాచిత్రం.",
    mr: "बाष्पीभवन, संक्षेपण आणि पर्जन्यवृष्टीसाठी लेबलांसह जलचक्र दर्शविणारी आकृती.",
    ta: "ஆவியாதல், ஒடுக்கம் மற்றும் மழைப்பொழிவுக்கான லேபிள்களுடன் நீர் சுழற்சியைக் காட்டும் ஒரு வரைபடம்.",
    gu: "બાષ્પીભવન, ઘનીકરણ અને વરસાદ માટે લેબલો સાથે જળ ચક્ર દર્શાવતી આકૃતિ.",
    kn: "ಬಾಷ್ಪೀಕರಣ, ಘನೀಕರಣ ಮತ್ತು ಮಳೆಗಾಗಿ ಲೇಬಲ್‌ಗಳೊಂದಿಗೆ ನೀರಿನ ಚಕ್ರವನ್ನು ತೋರಿಸುವ ರೇಖಾಚಿತ್ರ.",
  },
  visualAidUnity: {
    en: "A drawing that represents 'Unity in Diversity' using simple symbols.",
    hi: "सरल प्रतीकों का उपयोग करके 'अनेकता में एकता' का प्रतिनिधित्व करने वाला एक चित्र।",
    bn: "সাধারণ প্রতীক ব্যবহার করে 'বৈচিত্র্যের মধ্যে ঐক্য' প্রতিনিধিত্বকারী একটি অঙ্কন।",
    te: "సాధారణ చిహ్నాలను ఉపయోగించి 'భిన్నత్వంలో ఏకత్వం'ని సూచించే డ్రాయింగ్.",
    mr: "साध्या चिन्हांचा वापर करून ' विविधतेत एकता' दर्शवणारे चित्र.",
    ta: "எளிய சின்னங்களைப் பயன்படுத்தி 'வேற்றுமையில் ஒற்றுமை' என்பதைக் குறிக்கும் ஒரு வரைபடம்.",
    gu: "સરળ પ્રતીકોનો ઉપયોગ કરીને 'વિવિધતામાં એકતા' દર્શાવતું ચિત્ર.",
    kn: "ಸರಳ ಚಿಹ್ನೆಗಳನ್ನು ಬಳಸಿಕೊಂಡು 'ವಿವಿಧತೆಯಲ್ಲಿ ಏಕತೆ'ಯನ್ನು ಪ್ರತಿನಿಧಿಸುವ ರೇಖಾಚಿತ್ರ.",
  },
   visualAidHeart: {
    en: "A simple diagram of the human heart with the four chambers.",
    hi: "चार कक्षों के साथ मानव हृदय का एक सरल आरेख।",
    bn: "চারটি চেম্বার সহ মানব হৃদপিণ্ডের একটি সাধারণ চিত্র।",
    te: "నాలుగు గదులతో మానవ గుండె యొక్క సాధారణ రేఖాచిత్రం.",
    mr: "चार कक्षांसह मानवी हृदयाची एक साधी आकृती.",
    ta: "நான்கு அறைகளைக் கொண்ட மனித இதயத்தின் எளிய வரைபடம்.",
    gu: "ચાર ચેમ્બર સાથે માનવ હૃદયની એક સરળ આકૃતિ.",
    kn: "ನಾಲ್ಕು ಕೋಣೆಗಳೊಂದಿಗೆ ಮಾನವ ಹೃದಯದ ಸರಳ ರೇಖಾಚಿತ್ರ.",
  },
};

const headerTranslations: Record<string, string> = {
    en: "Try one of these",
    hi: "इनमें से एक का प्रयास करें",
    bn: "এইগুলির মধ্যে একটি চেষ্টা করুন",
    te: "వీటిలో ఒకదాన్ని ప్రయత్నించండి",
    mr: "यापैकी एक वापरून पहा",
    ta: "இவற்றில் ஒன்றை முயற்சிக்கவும்",
    gu: "આમાંથી એકનો પ્રયાસ કરો",
    kn: "ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಪ್ರಯತ್ನಿಸಿ",
};


export const ExamplePrompts: FC<ExamplePromptsProps> = ({ onPromptClick, selectedLanguage }) => {
  
  const allKeys = Object.keys(promptTranslations);
  // A simple way to get a different set of prompts for different pages
  const isVisualPage = (promptTranslations["visualAidFlower"][selectedLanguage] || "").length > 0;
  
  const promptKeys = isVisualPage
    ? allKeys.filter(k => k.startsWith('visualAid'))
    : allKeys.filter(k => !k.startsWith('visualAid'));

  const prompts = promptKeys.map(key => {
    return promptTranslations[key][selectedLanguage] || promptTranslations[key]['en'];
  }).slice(0, 4); // Limit to 4 prompts
  
  const headerText = headerTranslations[selectedLanguage] || headerTranslations['en'];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Lightbulb className="h-4 w-4" />
        <span>{headerText}</span>
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
