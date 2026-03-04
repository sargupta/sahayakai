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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type GradeLevelSelectorProps = {
  onValueChange: (value: string[]) => void;
  value?: string[];
  language: string;
  isMulti?: boolean;
  defaultValue?: string[];
};

const allGradeLevels: Record<string, string[]> = {
  en: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
  hi: ["पहली कक्षा", "दूसरी कक्षा", "तीसरी कक्षा", "चौथी कक्षा", "पांचवीं कक्षा", "छठी कक्षा", "सातवीं कक्षा", "आठवीं कक्षा", "नौवीं कक्षा", "दसवीं कक्षा", "ग्यारहवीं कक्षा", "बारहवीं कक्षा"],
  bn: ["প্রথম শ্রেণী", "দ্বিতীয় শ্রেণী", "তৃতীয় শ্রেণী", "চতুর্থ শ্রেণী", "পঞ্চম শ্রেণী", "ষষ্ঠ শ্রেণী", "সপ্তম শ্রেণী", "অষ্টম শ্রেণী", "নবম শ্রেণী", "দশম শ্রেণী", "একাদশ শ্রেণী", "দ্বাদশ শ্রেণী"],
  te: ["ఒకటవ తరగతి", "రెండవ తరగతి", "మూడవ తరగతి", "నాల్గవ తరగతి", "ఐదవ తరగతి", "ఆరవ తరగతి", "ఏడవ తరగతి", "ఎనిమిదవ తరగతి", "తొమ్మిదవ తరగతి", "పదవ తరగతి", "ప���కొండవ తరగతి", "పన్నెండవ తరగతి"],
  mr: ["इयत्ता पहिली", "इयत्ता दुसरी", "इयत्ता तिसरी", "इयत्ता चौथी", "इयत्ता पाचवी", "इयत्ता सहावी", "इयत्ता सातवी", "इयत्ता आठवी", "इयत्ता नववी", "इयत्ता दहावी", "इयत्ता अकरावी", "इयत्ता बारावी"],
  ta: ["முதலாம் வகுப்பு", "இரண்டாம் வகுப்பு", "மூன்றாம் வகுப்பு", "நான்காம் வகுப்பு", "ஐந்தாம் வகுப்பு", "ஆறாம் வகுப்பு", "ஏழாம் வகுப்பு", "எட்டாம் வகுப்பு", "ஒன்பதாம் வகுப்பு", "பத்தாம் வகுப்பு", "பதினொன்றாம் வகுப்பு", "பன்னிரண்டாம் வகுப்பு"],
  gu: ["પ્રથમ ધોરણ", "બીજું ધોરણ", "ત્રીજું ધોરણ", "ચોથું ધોરણ", "પાંચમું ધોરણ", "છઠ્ઠું ધોરણ", "સાતમું ધોરણ", "આઠમું ધોરણ", "નવમું ધોરણ", "દસમું ધોરણ", "અગિયારમું ધોરણ", "બારમું ધોરણ"],
  kn: ["ಒಂದನೇ ತರಗತಿ", "ಎರಡನೇ ತರಗತಿ", "ಮೂರನೇ ತರಗತಿ", "ನಾಲ್ಕನೇ ತರಗತಿ", "ಐದನೇ ತರಗತಿ", "ಆರನೇ ತರಗತಿ", "ಏಳನೇ ತರಗತಿ", "ಎಂಟನೇ ತರಗತಿ", "ಒಂಬತ್ತನೇ ತರಗತಿ", "ಹತ್ತನೇ ತರಗತಿ", "ಹನ್ನೊಂದನೇ ತರಗತಿ", "ಹನ್ನೆರಡನೇ ತರಗತಿ"],
};

const gradeLevelMap: Record<string, string> = {
  "Class 1": "Class 1", "1st Grade": "Class 1", "पहली कक्षा": "Class 1", "प्रथम শ্রেণী": "Class 1", "ఒకటవ తరగతి": "Class 1", "इयत्ता पहिली": "Class 1", "முதலாம் வகுப்பு": "Class 1", "પ્રથમ ધોરણ": "Class 1", "ಒಂದನೇ ತರಗತಿ": "Class 1",
  "Class 2": "Class 2", "2nd Grade": "Class 2", "दूसरी कक्षा": "Class 2", "द्वितीय শ্রেণী": "Class 2", "రెండవ తరగతి": "Class 2", "इयत्ता दुसरी": "Class 2", "இரண்டாம் வகுப்பு": "Class 2", "બીજું ધોરણ": "Class 2", "ಎರಡನೇ ತರಗತಿ": "Class 2",
  "Class 3": "Class 3", "3rd Grade": "Class 3", "तीसरी कक्षा": "Class 3", "তৃতীয় শ্রেণী": "Class 3", "మూడవ తరగತಿ": "Class 3", "इयत्ता तिसरी": "Class 3", "மூன்றாம் வகுப்பு": "Class 3", "ત્રીજું ધોરણ": "Class 3", "ಮೂರನೇ ತರಗತಿ": "Class 3",
  "Class 4": "Class 4", "4th Grade": "Class 4", "चौथी कक्षा": "Class 4", "চতুর্থ শ্রেণী": "Class 4", "నాల్గవ తరగతి": "Class 4", "इयत्ता चौथी": "Class 4", "நான்காம் வகுப்பு": "Class 4", "ચોથું ધોરણ": "Class 4", "ನಾಲ್ಕನೇ ತರಗತಿ": "Class 4",
  "Class 5": "Class 5", "5th Grade": "Class 5", "पांचवीं कक्षा": "Class 5", "পঞ্চম শ্রেণী": "Class 5", "ఐదవ తరగతి": "Class 5", "इयत्ता पाचवी": "Class 5", "ஐந்தாம் வகுப்பு": "Class 5", "પાંચમું ધોરણ": "Class 5", "ಐದನೇ ತರಗತಿ": "Class 5",
  "Class 6": "Class 6", "6th Grade": "Class 6", "छठी कक्षा": "Class 6", "ষষ্ঠ শ্রেণী": "Class 6", "ఆరవ తరగతి": "Class 6", "इयत्ता सहावी": "Class 6", "ஆறாம் வகுப்பு": "Class 6", "છઠ્ઠું ધોરણ": "Class 6", "ಆರನೇ ತರಗತಿ": "Class 6",
  "Class 7": "Class 7", "7th Grade": "Class 7", "सातवीं कक्षा": "Class 7", "सप्तम শ্রেণী": "Class 7", "ఏడవ తరగతి": "Class 7", "इयत्ता सातवी": "Class 7", "ஏழாம் வகுப்பு": "Class 7", "સાતમું ધોરણ": "Class 7", "ಏಳನೇ ತರಗತಿ": "Class 7",
  "Class 8": "Class 8", "8th Grade": "Class 8", "आठवीं कक्षा": "Class 8", "অষ্টম শ্রেণী": "Class 8", "ఎనిమిదవ తరగతి": "Class 8", "इयत्ता आठवी": "Class 8", "எட்டாம் வகுப்பு": "Class 8", "આઠમું ધોરણ": "Class 8", "ಎಂಟನೇ ತರಗತಿ": "Class 8",
  "Class 9": "Class 9", "9th Grade": "Class 9", "नौवीं कक्षा": "Class 9", "নবम শ্রেণী": "Class 9", "తొమ్మిదవ తరగతి": "Class 9", "इयत्ता नववी": "Class 9", "ஒன்பதாம் வகுப்பு": "Class 9", "નવમું ધોરણ": "Class 9", "ಒಂಬತ್ತನೇ ತರಗತಿ": "Class 9",
  "Class 10": "Class 10", "10th Grade": "Class 10", "दसवीं कक्षा": "Class 10", "দশম শ্রেণী": "Class 10", "పదవ తరగతి": "Class 10", "इयत्ता दहावी": "Class 10", "பத்தாம் வகுப்பு": "Class 10", "દસમું ધોરણ": "Class 10", "ಹತ್ತನೇ ತರಗತಿ": "Class 10",
  "Class 11": "Class 11", "11th Grade": "Class 11", "ग्यारहवीं कक्षा": "Class 11", "একাদশ শ্রেণী": "Class 11", "పదకొండవ తరగతి": "Class 11", "इयत्ता अकरावी": "Class 11", "பதினொன்றாம் வகுப்பு": "Class 11", "અગિયારમું ધોરણ": "Class 11", "ಹನ್ನೊಂದನೇ ತರಗತಿ": "Class 11",
  "Class 12": "Class 12", "12th Grade": "Class 12", "बारहवीं कक्षा": "Class 12", "দ্বাদশ শ্রেণী": "Class 12", "పన్నెండవ తరగతి": "Class 12", "इयत्ता बारावी": "Class 12", "பன்னிரண்டாம் வகுப்பு": "Class 12", "બારમું ધોરણ": "Class 12", "ಹನ್ನೆರಡನೇ ತರಗತಿ": "Class 12",
};

const translations: Record<string, { select: string; one: string; other: string; label: string; placeholder: string }> = {
  en: { select: "Select Class(es)", one: "class selected", other: "classes selected", label: "Select Class Levels", placeholder: "Select a class" },
  hi: { select: "कक्षा चुनें", one: "कक्षा चुनी गई", other: "कक्षाएं चुनी गईं", label: "कक्षा स्तर चुनें", placeholder: "कक्षा चुनें" },
  bn: { select: "শ্রেণী নির্বাচন করুন", one: "টি শ্রেণী নির্বাচিত", other: "টি শ্রেণী নির্বাচিত", label: "শ্রেণী স্তর নির্বাচন করুন", placeholder: "একটি শ্রেণী নির্বাচন করুন" },
  te: { select: "తరగతి(ల)ను ఎంచుకోండి", one: "తరగతి ఎంచుకోబడింది", other: "తరగతులు ఎంచుకోబడ్డాయి", label: "గ్రేడ్ స్థాయిలను ఎంచుకోండి", placeholder: "ఒక గ్రేడ్‌ను ఎంచుకోండి" },
  mr: { select: "इयत्ता निवडा", one: "इयत्ता निवडली", other: "इयत्ता निवडल्या", label: "इयत्ता स्तर निवडा", placeholder: "एक इयत्ता निवडा" },
  ta: { select: "வகுப்புகளைத் தேர்ந்தெடுக்கவும்", one: "வகுப்பு தேர்ந்தெடுக்கப்பட்டது", other: "வகுப்புகள் தேர்ந்தெடுக்கப்பட்டன", label: "தர நிலைகளைத் தேர்ந்தெடுக்கவும்", placeholder: "ஒரு தரத்தைத் தேர்ந்தெடுக்கவும்" },
  gu: { select: "ધોરણ પસંદ કરો", one: "ધોરણ પસંદ કરેલ છે", other: "ધોરણો પસંદ કરેલ છે", label: "ધોરણ સ્તર પસંદ કરો", placeholder: "એક ગ્રેડ પસંદ કરો" },
  kn: { select: "ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", one: "ತರಗತಿ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", other: "ತರಗತಿಗಳನ್ನು ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ", label: "ಗ್ರೇಡ್ ಮಟ್ಟಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ", placeholder: "ಒಂದು ದರ್ಜೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ" },
};


const getEnglishGrade = (translatedGrade: string) => gradeLevelMap[translatedGrade] || translatedGrade;
const getTranslatedGrade = (englishGrade: string, lang: string) => {
  const gradesInLang = allGradeLevels[lang] || allGradeLevels.en;
  const translated = gradesInLang.find(g => getEnglishGrade(g) === englishGrade);
  return translated || englishGrade;
}

export const GradeLevelSelector: FC<GradeLevelSelectorProps> = ({ onValueChange, value = [], language, isMulti = true }) => {
  const currentGradeLevels = allGradeLevels[language] || allGradeLevels.en;
  const t = translations[language] || translations.en;

  if (!isMulti) {
    const singleValue = value?.[0] || '';
    const translatedValue = getTranslatedGrade(singleValue, language);
    return (
      <Select onValueChange={(val) => onValueChange([getEnglishGrade(val)])} value={translatedValue}>
        <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm">
          <SelectValue placeholder={t.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {currentGradeLevels.map((grade) => (
            <SelectItem key={grade} value={grade}>
              {grade}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

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
      <DropdownMenuContent className="w-full max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel>{t.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentGradeLevels.map((grade) => {
          const englishGrade = getEnglishGrade(grade);
          const isSelected = value.includes(englishGrade);
          return (
            <DropdownMenuCheckboxItem
              key={grade}
              checked={isSelected}
              onCheckedChange={(checked) => handleCheckedChange(grade, Boolean(checked))}
              onSelect={(e) => e.preventDefault()}
              className={isSelected ? "bg-orange-50 font-medium text-orange-900" : ""}
            >
              {grade}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};