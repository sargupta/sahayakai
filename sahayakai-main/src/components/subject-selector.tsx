"use client";

import type { FC } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SUBJECTS } from '@/types';
import { useLanguage } from '@/context/language-context';

interface SubjectSelectorProps {
    onValueChange: (value: string) => void;
    value?: string;
    language?: string; // legacy prop kept for backwards compat — not used anymore
}

// Subject display labels resolved via global useLanguage() / t() (Wave 6 cleanup).
// Previously this component had a local `translations` object with only en+hi+kn coverage.
// Now uses the global dictionary which has full 11-language coverage for each subject.
export const SubjectSelector: FC<SubjectSelectorProps> = ({ onValueChange, value }) => {
    const { t } = useLanguage();

    return (
        <Select onValueChange={onValueChange} value={value}>
            <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm">
                <SelectValue placeholder={t("Select a subject")} />
            </SelectTrigger>
            <SelectContent>
                {SUBJECTS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                        {t(subject)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
