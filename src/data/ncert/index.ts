/**
 * NCERT Curriculum Index
 * Central export for all NCERT subject data
 */

import { NCERTMathematics } from './mathematics';
import { NCERTScience } from './science';
import { socialStudiesChapters } from './social-studies';
import { englishChapters } from './english';
import { hindiChapters } from './hindi';

export interface NCERTChapter {
    id: string;
    title: string;
    titleHindi?: string;
    subject: 'Mathematics' | 'Science' | 'Social Studies' | 'English' | 'Hindi';
    grade: number;
    number: number;
    learningOutcomes: string[];
    keywords: string[];
    estimatedPeriods: number;
}

// Flatten Math
const mathematicsChapters: NCERTChapter[] = NCERTMathematics.flatMap(g =>
    g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'Mathematics',
    }))
);

// Flatten Science
const scienceChapters: NCERTChapter[] = NCERTScience.flatMap(g =>
    g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'Science',
    }))
);

export const allNCERTChapters: NCERTChapter[] = [
    ...mathematicsChapters,
    ...scienceChapters,
    ...socialStudiesChapters,
    ...englishChapters,
    ...hindiChapters,
];

export const getChaptersForGrade = (grade: number, subject?: string) => {
    let chapters = allNCERTChapters.filter(c => c.grade === grade);
    if (subject) {
        chapters = chapters.filter(c => c.subject === subject);
    }
    return chapters;
};

export const getChapterById = (id: string) => {
    return allNCERTChapters.find(c => c.id === id);
};

export const searchChapters = (query: string) => {
    const lowerQuery = query.toLowerCase();
    return allNCERTChapters.filter(c =>
        c.title.toLowerCase().includes(lowerQuery) ||
        c.keywords.some(k => k.toLowerCase().includes(lowerQuery))
    );
};
