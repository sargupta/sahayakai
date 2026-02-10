"use client";

import type { FC } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SUBJECTS, type Subject } from '@/types';

interface SubjectSelectorProps {
    onValueChange: (value: string) => void;
    value?: string;
    language: string;
}

const translations: Record<string, { label: string; placeholder: string; subjects: Record<string, string> }> = {
    en: {
        label: "Select Subject",
        placeholder: "Select a subject",
        subjects: {
            'Mathematics': 'Mathematics',
            'Science': 'Science',
            'Social Science': 'Social Science',
            'History': 'History',
            'Geography': 'Geography',
            'Civics': 'Civics',
            'English': 'English',
            'Hindi': 'Hindi',
            'Sanskrit': 'Sanskrit',
            'Kannada': 'Kannada',
            'Computer Science': 'Computer Science',
            'Environmental Studies (EVS)': 'Environmental Studies (EVS)',
            'General': 'General'
        }
    },
    hi: {
        label: "विषय चुनें",
        placeholder: "विषय चुनें",
        subjects: {
            'Mathematics': 'गणित',
            'Science': 'विज्ञान',
            'Social Science': 'सामाजिक विज्ञान',
            'History': 'इतिहास',
            'Geography': 'भूगोल',
            'Civics': 'नागरिक शास्त्र',
            'English': 'अंग्रेज़ी',
            'Hindi': 'हिंदी',
            'Sanskrit': 'संस्कृत',
            'Kannada': 'कन्नड़',
            'Computer Science': 'कंप्यूटर विज्ञान',
            'Environmental Studies (EVS)': 'पर्यावरण अध्ययन (EVS)',
            'General': 'सामान्य'
        }
    },
    kn: {
        label: "ವಿಷಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        placeholder: "ವಿಷಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        subjects: {
            'Mathematics': 'ಗಣಿತ',
            'Science': 'ವಿಜ್ಞಾನ',
            'Social Science': 'ಸಮಾಜ ವಿಜ್ಞಾನ',
            'History': 'ಇತಿಹಾಸ',
            'Geography': 'ಭೂಗೋಳ',
            'Civics': 'ನಾಗರಿಕ ಶಾಸ್ತ್ರ',
            'English': 'ಇಂಗ್ಲಿಷ್',
            'Hindi': 'ಹಿಂದಿ',
            'Sanskrit': 'ಸಂಸ್ಕೃತ',
            'Kannada': 'ಕನ್ನಡ',
            'Computer Science': 'ಗಣಕವಿಜ್ಞಾನ',
            'Environmental Studies (EVS)': 'ಪರಿಸರ ಅಧ್ಯಯನ (EVS)',
            'General': 'ಸಾಮಾನ್ಯ'
        }
    },
    // Add more languages as needed...
};

export const SubjectSelector: FC<SubjectSelectorProps> = ({ onValueChange, value, language }) => {
    const t = translations[language] || translations.en;

    return (
        <Select onValueChange={onValueChange} value={value}>
            <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm">
                <SelectValue placeholder={t.placeholder} />
            </SelectTrigger>
            <SelectContent>
                {SUBJECTS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                        {t.subjects[subject] || subject}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
