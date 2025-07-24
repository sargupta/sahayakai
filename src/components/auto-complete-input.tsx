
"use client";

import { useState, type FC, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AutoCompleteInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSuggestionClick: (suggestion: string) => void;
  placeholder?: string;
  selectedLanguage: string;
  className?: string;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  ref: React.Ref<HTMLInputElement>;
};

const allSuggestions: Record<string, string[]> = {
    en: [
        "Lesson plan on the water cycle",
        "Why is the sky blue?",
        "Simple diagram of parts of Hibiscus for class 4",
        "Short story about a brave mouse for class 2",
        "Explain photosynthesis with an analogy for farming",
        "Worksheet on addition for 1st grade",
        "Quiz about the planets in our solar system",
        "Create a story about a trip to the mountains",
        "What are the states of matter?",
        "Activity to teach about magnets",
    ],
    hi: [
        "जल चक्र पर पाठ योजना",
        "आसमान नीला क्यों है?",
        "कक्षा 4 के लिए गुड़हल के भागों का सरल चित्र",
        "कक्षा 2 के लिए एक बहादुर चूहे की लघु कहानी",
        "खेती के सादृश्य के साथ प्रकाश संश्लेषण की व्याख्या करें",
        "पहली कक्षा के लिए जोड़ पर वर्कशीट",
        "हमारे सौर मंडल के ग्रहों के बारे में प्रश्नोत्तरी",
        " पहाड़ों की यात्रा के बारे में एक कहानी बनाएँ",
        "पदार्थ की अवस्थाएँ क्या हैं?",
        "चुंबक के बारे में सिखाने के लिए गतिविधि",
    ],
    bn: [
        "জল চক্রের উপর পাঠ পরিকল্পনা",
        "আকাশ নীল কেন?",
        "চতুর্থ শ্রেণীর জন্য জবা ফুলের অংশগুলির সহজ চিত্র",
        "দ্বিতীয় শ্রেণীর জন্য একটি সাহসী ইঁদুরের ছোট গল্প",
        "চাষের উপমা দিয়ে সালোকসংশ্লেষণ ব্যাখ্যা কর",
        "প্রথম শ্রেণীর জন্য যোগের উপর ওয়ার্কশিট",
        "আমাদের সৌরজগতের গ্রহ সম্পর্কে কুইজ",
        "পাহাড়ে ভ্রমণের গল্প তৈরি করুন",
        "পদার্থের অবস্থা কি কি?",
        "চুম্বক সম্পর্কে শেখানোর জন্য কার্যকলাপ",
    ],
    te: [
        "నీటి చక్రంపై పాఠ్య ప్రణాళిక",
        "ఆకాశం నీలం ఎందుకు?",
        "4వ తరగతికి మందార భాగాల సాధారణ రేఖాచిత్రం",
        "2వ తరగతికి చెందిన ధైర్యమైన ఎలుక గురించిన చిన్న కథ",
        "వ్యవసాయం కోసం ఒక సారూప్యతతో కిరణజన్య సంయోగక్రియను వివరించండి",
        "1వ తరగతికి కూడికపై వర్క్‌షీట్",
        "మన సౌర వ్యవస్థలోని గ్రహాల గురించి క్విజ్",
        "పర్వతాలకు యాత్ర గురించి కథను సృష్టించండి",
        "పదార్థం యొక్క స్థితులు ఏమిటి?",
        "అయస్కాంతాల గురించి బోధించడానికి కార్యాచరణ",
    ],
    mr: [
        "जलचक्रावर पाठ योजना",
        "आकाश निळे का आहे?",
        "इयत्ता ४ थी साठी जास्वंदीच्या भागांचे सोपे चित्र",
        "इयत्ता २ री साठी एका शूर उंदराची छोटीशी गोष्ट",
        "शेतीच्या साधर्म्याने प्रकाशसंश्लेषण स्पष्ट करा",
        "इयत्ता पहिलीसाठी बेरजेवर वर्कशीट",
        "आपल्या सूर्यमालेतील ग्रहांबद्दल प्रश्नमंजुषा",
        "डोंगरांच्या सहलीबद्दल एक कथा तयार करा",
        "पदार्थाच्या अवस्था कोणत्या आहेत?",
        "चुंबकाबद्दल शिकवण्यासाठी क्रियाकलाप",
    ],
    ta: [
        "நீர் சுழற்சியில் பாடத் திட்டம்",
        "வானம் ஏன் நீலமாக இருக்கிறது?",
        "4 ஆம் வகுப்புக்கு செம்பருத்தி பாகங்களின் எளிய வரைபடம்",
        "2 ஆம் வகுப்புக்கு ஒரு துணிச்சலான எலியைப் பற்றிய சிறுகதை",
        "விவசாயத்திற்கான ஒரு ஒப்புமையுடன் ஒளிச்சேர்க்கையை விளக்கவும்",
        "1 ஆம் வகுப்புக்கு கூட்டல்పై பணித்தாள்",
        "நமது சூரிய மண்டலத்தில் உள்ள கிரகங்கள் பற்றிய வினாடி வினா",
        "மலைகளுக்கு ஒரு பயணம் பற்றி ஒரு கதை உருவாக்கவும்",
        "பருப்பொருளின் நிலைகள் யாவை?",
        "காந்தங்களைப் பற்றி கற்பிப்பதற்கான செயல்பாடு",
    ],
    gu: [
        "જળ ચક્ર પર પાઠ યોજના",
        "આકાશ વાદળી કેમ છે?",
        "ધોરણ 4 માટે હિબિસ્કસના ભાગોનું સરળ રેખાચિત્ર",
        "ધોરણ 2 માટે બહાદુર ઉંદરની ટૂંકી વાર્તા",
        "ખેતીના ઉદાહરણ સાથે પ્રકાશસંશ્લેષણ સમજાવો",
        "પ્રથમ ધોરણ માટે સરવાળા પર વર્કશીટ",
        "આપણા સૌરમંડળના ગ્રહો વિશે ક્વિઝ",
        "પર્વતોની મુસાફરી વિશે એક વાર્તા બનાવો",
        "પદાર્થના રાજ્યો શું છે?",
        "ચુંબક વિશે શીખવવા માટે પ્રવૃત્તિ",
    ],
    kn: [
        "ನೀರಿನ ಚಕ್ರದ ಪಾಠ ಯೋಜನೆ",
        "ಆಕಾಶ ಏಕೆ ನೀಲಿಯಾಗಿದೆ?",
        "4 ನೇ ತರಗತಿಗೆ ದಾಸವಾಳದ ಭಾಗಗಳ ಸರಳ ರೇಖಾಚಿತ್ರ",
        "2 ನೇ ತರಗತಿಗೆ ಧೈರ್ಯಶಾಲಿ ಇಲಿಯ ಬಗ್ಗೆ ಒಂದು ಸಣ್ಣ ಕಥೆ",
        "ಬೇಸಾಯಕ್ಕಾಗಿ ಸಾದೃಶ್ಯದೊಂದಿಗೆ ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯನ್ನು ವಿವರಿಸಿ",
        "1 ನೇ ತರಗತಿಗೆ ಸಂಕಲನದ ಮೇಲೆ ವರ್ಕ್‌ಶೀಟ್",
        "ನಮ್ಮ ಸೌರವ್ಯೂಹದ ಗ್ರಹಗಳ ಬಗ್ಗೆ ರಸಪ್ರಶ್ನೆ",
        "ಬೆಟ್ಟಗಳಿಗೆ ಪ್ರವಾಸದ ಬಗ್ಗೆ ಕಥೆಯನ್ನು ರಚಿಸಿ",
        "ವಸ್ತುವಿನ ಸ್ಥಿತಿಗಳು ಯಾವುವು?",
        "ಕಾಂತಗಳ ಬಗ್ಗೆ ಕಲಿಸಲು ಚಟುವಟಿಕೆ",
    ],
};


export const AutoCompleteInput: FC<AutoCompleteInputProps> = ({ value, onChange, onSuggestionClick, placeholder, selectedLanguage, className, ...props }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (value && isFocused) {
      const languageSuggestions = allSuggestions[selectedLanguage] || allSuggestions.en;
      const filtered = languageSuggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [value, selectedLanguage, isFocused]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsFocused(false);
            setSuggestions([]);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick(suggestion);
    setSuggestions([]);
    setIsFocused(false);
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        className="bg-white/50 backdrop-blur-sm"
        autoComplete="off"
        {...props}
      />
      {suggestions.length > 0 && isFocused && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <ul className="py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestionClick(suggestion)
                }}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
