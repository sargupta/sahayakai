
"use client";

import type { FC } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';

type GradeLevelSelectorProps = {
  onValueChange: (value: string[]) => void;
  value?: string[];
  language: string;
};

const allGradeLevels: Record<string, string[]> = {
  en: ["1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"],
  hi: ["पहली कक्षा", "दूसरी कक्षा", "तीसरी कक्षा", "चौथी कक्षा", "पांचवीं कक्षा", "छठी कक्षा", "सातवीं कक्षा", "आठवीं कक्षा", "नौवीं कक्षा", "दसवीं कक्षा", "ग्यारहवीं कक्षा", "बारहवीं कक्षा"],
  bn: ["প্রথম শ্রেণী", "দ্বিতীয় শ্রেণী", "তৃতীয় শ্রেণী", "চতুর্থ শ্রেণী", "পঞ্চম শ্রেণী", "ষষ্ঠ শ্রেণী", "সপ্তম শ্রেণী", "অষ্টম শ্রেণী", "নবম শ্রেণী", "দশম শ্রেণী", "একাদশ শ্রেণী", "দ্বাদশ শ্রেণী"],
  te: ["ఒకటవ తరగతి", "రెండవ తరగతి", "మూడవ తరగతి", "నాల్గవ తరగతి", "ఐదవ తరగతి", "ఆరవ తరగతి", "ఏడవ తరగతి", "ఎనిమిదవ తరగతి", "తొమ్మిదవ తరగతి", "పదవ తరగతి", "పదకొండవ తరగతి", "పన్నెండవ తరగతి"],
  mr: ["इयत्ता पहिली", "इयत्ता दुसरी", "इयत्ता तिसरी", "इयत्ता चौथी", "इयत्ता पाचवी", "इयत्ता सहावी", "इयत्ता सातवी", "इयत्ता आठवी", "इयत्ता नववी", "इयत्ता दहावी", "इयत्ता अकरावी", "इयत्ता बारावी"],
  ta: ["முதலாம் வகுப்பு", "இரண்டாம் வகுப்பு", "மூன்றாம் வகுப்பு", "நான்காம் வகுப்பு", "ஐந்தாம் வகுப்பு", "ஆறாம் வகுப்பு", "ஏழாம் வகுப்பு", "எட்டாம் வகுப்பு", "ஒன்பதாம் வகுப்பு", "பத்தாம் வகுப்பு", "பதினொன்றாம் வகுப்பு", "பன்னிரண்டாம் வகுப்பு"],
  gu: ["પ્રથમ ધોરણ", "બીજું ધોરણ", "ત્રીજું ધોરણ", "ચોથું ધોરણ", "પાંચમું ધોરણ", "છઠ્ઠું ધોરણ", "સાતમું ધોરણ", "આઠમું ધોરણ", "નવમું ધોરણ", "દસમું ધોરણ", "અગિયારમું ધોરણ", "બારમું ધોરણ"],
  kn: ["ಒಂದನೇ ತರಗತಿ", "ಎರಡನೇ ತರಗತಿ", "ಮೂರನೇ ತರಗತಿ", "ನಾಲ್ಕನೇ ತರಗತಿ", "ಐದನೇ ತರಗತಿ", "ಆರನೇ ತರಗತಿ", "ಏಳನೇ ತರಗತಿ", "ಎಂಟನೇ ತರಗತಿ", "ಒಂಬತ್ತನೇ ತರಗತಿ", "ಹತ್ತನೇ ತರಗತಿ", "ಹನ್ನೊಂದನೇ ತರಗತಿ", "ಹನ್ನೆರಡನೇ ತರಗತಿ"],
};

const gradeLevelMap: Record<string, string> = {
  "1st Grade": "1st Grade", "पहली कक्षा": "1st Grade", "প্রথম শ্রেণী": "1st Grade", "ఒకటవ తరగతి": "1st Grade", "इयत्ता पहिली": "1st Grade", "முதலாம் வகுப்பு": "1st Grade", "પ્રથમ ધોરણ": "1st Grade", "ಒಂದನೇ ತರಗತಿ": "1st Grade",
  "2nd Grade": "2nd Grade", "दूसरी कक्षा": "2nd Grade", "দ্বিতীয় শ্রেণী": "2nd Grade", "రెండవ తరగతి": "2nd Grade", "इयत्ता दुसरी": "2nd Grade", "இரண்டாம் வகுப்பு": "2nd Grade", "બીજું ધોરણ": "2nd Grade", "ಎರಡನೇ ತರಗತಿ": "2nd Grade",
  "3rd Grade": "3rd Grade", "तीसरी कक्षा": "3rd Grade", "তৃতীয় শ্রেণী": "3rd Grade", "మూడవ తరగతి": "3rd Grade", "इयत्ता तिसरी": "3rd Grade", "மூன்றாம் வகுப்பு": "3rd Grade", "ત્રીજું ધોરણ": "3rd Grade", "ಮೂರನೇ ತರಗತಿ": "3rd Grade",
  "4th Grade": "4th Grade", "चौथी कक्षा": "4th Grade", "চতুর্থ শ্রেণী": "4th Grade", "నాల్గవ తరగతి": "4th Grade", "इयत्ता चौथी": "4th Grade", "நான்காம் வகுப்பு": "4th Grade", "ચોથું ધોરણ": "4th Grade", "ನಾಲ್ಕನೇ ತರಗತಿ": "4th Grade",
  "5th Grade": "5th Grade", "पांचवीं कक्षा": "5th Grade", "পঞ্চম শ্রেণী": "5th Grade", "ఐదవ తరగతి": "5th Grade", "इयत्ता पाचवी": "5th Grade", "ஐந்தாம் வகுப்பு": "5th Grade", "પાંચમું ધોરણ": "5th Grade", "ಐದನೇ ತರಗತಿ": "5th Grade",
  "6th Grade": "6th Grade", "छठी कक्षा": "6th Grade", "ষষ্ঠ শ্রেণী": "6th Grade", "ఆరవ తరగతి": "6th Grade", "इयत्ता सहावी": "6th Grade", "ஆறாம் வகுப்பு": "6th Grade", "છઠ્ઠું ધોરણ": "6th Grade", "ಆರನೇ ತರಗತಿ": "6th Grade",
  "7th Grade": "7th Grade", "सातवीं कक्षा": "7th Grade", "সপ্তম শ্রেণী": "7th Grade", "ఏడవ తరగతి": "7th Grade", "इयत्ता सातवी": "7th Grade", "ஏழாம் வகுப்பு": "7th Grade", "સાતમું ધોરણ": "7th Grade", "ಏಳನೇ ತರಗತಿ": "7th Grade",
  "8th Grade": "8th Grade", "आठवीं कक्षा": "8th Grade", "অষ্টম শ্রেণী": "8th Grade", "ఎనిమిదవ తరగతి": "8th Grade", "इयत्ता आठवी": "8th Grade", "எட்டாம் வகுப்பு": "8th Grade", "આઠમું ધોરણ": "8th Grade", "ಎಂಟನೇ ತರಗತಿ": "8th Grade",
  "9th Grade": "9th Grade", "नौवीं कक्षा": "9th Grade", "নবম শ্রেণী": "9th Grade", "తొమ్మిదవ తరగతి": "9th Grade", "इयत्ता नववी": "9th Grade", "ஒன்பதாம் வகுப்பு": "9th Grade", "નવમું ધોરણ": "9th Grade", "ಒಂಬತ್ತನೇ ತರಗತಿ": "9th Grade",
  "10th Grade": "10th Grade", "दसवीं कक्षा": "10th Grade", "দশম শ্রেণী": "10th Grade", "పదవ తరగతి": "10th Grade", "इयत्ता दहावी": "10th Grade", "பத்தாம் வகுப்பு": "10th Grade", "દસમું ધોરણ": "10th Grade", "ಹತ್ತನೇ ತರಗತಿ": "10th Grade",
  "11th Grade": "11th Grade", "ग्यारहवीं कक्षा": "11th Grade", "একাদশ শ্রেণী": "11th Grade", "పదకొండవ తరగతి": "11th Grade", "इयत्ता अकरावी": "11th Grade", "பதினொன்றாம் வகுப்பு": "11th Grade", "અગિયારમું ધોરણ": "11th Grade", "ಹನ್ನೊಂದನೇ ತರಗತಿ": "11th Grade",
  "12th Grade": "12th Grade", "बारहवीं कक्षा": "12th Grade", "দ্বাদশ শ্রেণী": "12th Grade", "పన్నెండవ తరగతి": "12th Grade", "इयत्ता बारावी": "12th Grade", "பன்னிரண்டாம் வகுப்பு": "12th Grade", "બારમું ધોરણ": "12th Grade", "ಹನ್ನೆರಡನೇ ತರಗತಿ": "12th Grade",
};

const translations: Record<string, { select: string; one: string; other: string; label: string }> = {
    en: { select: "Select grade(s)", one: "grade selected", other: "grades selected", label: "Select Grade Levels" },
    hi: { select: "ग्रेड चुनें", one: "ग्रेड चुना गया", other: "ग्रेड चुने गए", label: "ग्रेड स्तर चुनें" },
    bn: { select: "শ্রেণী নির্বাচন করুন", one: "টি শ্রেণী নির্বাচিত", other: "টি শ্রেণী নির্বাচিত", label: "শ্রেণী স্তর নির্বাচন করুন" },
    te: { select: "గ్రేడ్‌లను ఎంచుకోండి", one: "గ్రేడ్ ఎంచుకోబడింది", other: "గ్రేడ్‌లు ఎంచుకోబడ్డాయి", label: "గ్రేడ్ స్థాయిలను ఎంచుకోండి" },
    mr: { select: "इयत्ता निवडा", one: "इयत्ता निवडली", other: "इयत्ता निवडल्या", label: "इयत्ता स्तर निवडा" },
    ta: { select: "வகுப்புகளைத் தேர்ந்தெடுக்கவும்", one: "வகுப்பு தேர்ந்தெடுக்கப்பட்டது", other: "வகுப்புகள் தேர்ந்தெடுக்கப்பட்டன", label: "தர நிலைகளைத் தேர்ந்தெடுக்கவும்" },
    gu: { select: "ધોરણ પસંદ કરો", one: "ધોરણ પસંદ કરેલ છે", other: "ધોરણો પસંદ કરેલ છે", label: "ધોરણ સ્તર પસંદ કરો" },
    kn: { select: "ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", one: "ತರಗತಿ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", other: "ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", label: "ಗ್ರೇಡ್ ಮಟ್ಟಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ" },
};


const getEnglishGrade = (translatedGrade: string) => gradeLevelMap[translatedGrade] || translatedGrade;
const getTranslatedGrade = (englishGrade: string, lang: string) => {
    const entry = Object.entries(gradeLevelMap).find(([_, val]) => val === englishGrade);
    if (!entry) return englishGrade;
    const gradesInLang = allGradeLevels[lang] || allGradeLevels.en;
    const translated = gradesInLang.find(g => getEnglishGrade(g) === englishGrade);
    return translated || englishGrade;
}

export const GradeLevelSelector: FC<GradeLevelSelectorProps> = ({ onValueChange, value = [], language }) => {
  const currentGradeLevels = allGradeLevels[language] || allGradeLevels.en;
  const t = translations[language] || translations.en;

  const handleCheckedChange = (grade: string, checked: boolean) => {
    const englishGrade = getEnglishGrade(grade);
    const newValue = checked 
      ? [...value, englishGrade]
      : value.filter(g => g !== englishGrade);
    onValueChange(newValue);
  };
  
  const selectedCount = value.length;
  const displayValue = selectedCount > 0 
    ? `${selectedCount} ${selectedCount > 1 ? t.other : t.one}`
    : t.select;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full bg-white/50 backdrop-blur-sm flex justify-between font-normal">
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        <DropdownMenuLabel>{t.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentGradeLevels.map((grade) => {
            const englishGrade = getEnglishGrade(grade);
            return (
                <DropdownMenuCheckboxItem
                    key={grade}
                    checked={value.includes(englishGrade)}
                    onCheckedChange={(checked) => handleCheckedChange(grade, Boolean(checked))}
                    onSelect={(e) => e.preventDefault()} // Prevent closing on select
                >
                    {grade}
                </DropdownMenuCheckboxItem>
            );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
