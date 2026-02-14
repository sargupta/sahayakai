"use client";

import type { FC } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LanguageSelectorProps = {
  onValueChange: (value: string) => void;
  defaultValue?: string;
  value?: string;
};

// A small subset of Indian languages for demonstration
const languages = [
  { value: "all", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी (Hindi)" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "gu", label: "ગુજરાતી (Gujarati)" },
  { value: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "ml", label: "മലയാളം (Malayalam)" },
  { value: "or", label: "ଓଡ଼ିଆ (Odia)" },
  { value: "kn", label: "ಕನ್ನಡ (Kannada)" },
];

export const LanguageSelector: FC<LanguageSelectorProps> = ({ onValueChange, defaultValue, value }) => {
  // If defaultValue is not in the list (like on first load of community page where it could be 'en'), use it. Otherwise, if it's not a valid lang, default to 'all'
  const finalDefaultValue = languages.some(l => l.value === defaultValue) ? defaultValue : "all";

  return (
    <Select onValueChange={onValueChange} defaultValue={finalDefaultValue} value={value}>
      <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm">
        <SelectValue placeholder="Select a language" />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
