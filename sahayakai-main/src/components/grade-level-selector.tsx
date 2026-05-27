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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useLanguage } from '@/context/language-context';

type GradeLevelSelectorProps = {
  onValueChange: (value: string[]) => void;
  value?: string[];
  language?: string; // legacy prop kept for backwards compat — not used anymore
  isMulti?: boolean;
  defaultValue?: string[];
};

// English grade keys (1-12). Display labels resolved via global useLanguage() / t().
// Previously had a local `allGradeLevels` + `gradeLevelMap` + `translations` object
// covering only 9 languages (en/hi/bn/te/mr/ta/gu/kn) — Wave 6 cleanup harvested
// into the global dictionary with full 11-language coverage.
const GRADE_KEYS = [
  "Class 1", "Class 2", "Class 3", "Class 4",
  "Class 5", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10", "Class 11", "Class 12",
];

export const GradeLevelSelector: FC<GradeLevelSelectorProps> = ({ onValueChange, value = [], isMulti = true }) => {
  const { t } = useLanguage();

  if (!isMulti) {
    const singleValue = value?.[0] || '';
    return (
      <Select onValueChange={(val) => onValueChange([val])} value={singleValue}>
        <SelectTrigger className="w-full bg-card border-border shadow-soft rounded-xl backdrop-blur-sm">
          <SelectValue placeholder={t("Select a class")} />
        </SelectTrigger>
        <SelectContent>
          {GRADE_KEYS.map((grade) => (
            <SelectItem key={grade} value={grade}>
              {t(grade)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const handleCheckedChange = (grade: string, checked: boolean) => {
    const newValue = checked
      ? [...value, grade]
      : value.filter(g => g !== grade);
    onValueChange(newValue);
  };

  const selectedCount = value.length;
  const displayValue = selectedCount > 0
    ? `${selectedCount} ${selectedCount > 1 ? t("classes selected") : t("class selected")}`
    : t("Select Class(es)");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full bg-card border-border shadow-soft rounded-xl backdrop-blur-sm flex justify-between font-normal">
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel>{t("Select Class Levels")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {GRADE_KEYS.map((grade) => {
          const isSelected = value.includes(grade);
          return (
            <DropdownMenuCheckboxItem
              key={grade}
              checked={isSelected}
              onCheckedChange={(checked) => handleCheckedChange(grade, Boolean(checked))}
              onSelect={(e) => e.preventDefault()}
              className={isSelected ? "bg-primary/10 font-medium text-primary" : ""}
            >
              {t(grade)}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
