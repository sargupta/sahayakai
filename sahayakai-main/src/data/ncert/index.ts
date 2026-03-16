/**
 * NCERT Curriculum Index
 * Central export for all NCERT subject data
 * Aligned with NCF 2023 / 2025-26 syllabus
 */

import { NCERTMathematics } from './mathematics';
import { scienceChapters, evsChapters } from './science';
import { socialStudiesChapters } from './social-studies';
import { englishChapters } from './english';
import { hindiChapters } from './hindi';
import { kannadaChapters } from './kannada';
import { sanskritChapters } from './sanskrit';
import { itChapters } from './it';
import { physicsChapters } from './physics';
import { chemistryChapters } from './chemistry';
import { biologyChapters } from './biology';
import { tamilChapters } from './tamil';
import { teluguChapters } from './telugu';
import { marathiChapters } from './marathi';
import { bengaliChapters } from './bengali';
import { gujaratiChapters } from './gujarati';
import { punjabiChapters } from './punjabi';
import { malayalamChapters } from './malayalam';
import { urduChapters } from './urdu';

export type NCERTSubject =
    | 'Mathematics'
    | 'Science'
    | 'EVS'
    | 'Physics'
    | 'Chemistry'
    | 'Biology'
    | 'Social Studies'
    | 'English'
    | 'Hindi'
    | 'Sanskrit'
    | 'Kannada'
    | 'Tamil'
    | 'Telugu'
    | 'Marathi'
    | 'Bengali'
    | 'Gujarati'
    | 'Punjabi'
    | 'Malayalam'
    | 'Urdu'
    | 'Information Technology';

/** NCF-2023: NCERT's new curriculum (grades 1–8).
 *  Rationalized-2022: NCERT rationalized books (grades 9–12).
 *  State-SCERT: State board textbook (DSERT/TNSCERT/MSCERT/WBSCERT/GCERT/PSEB/KSCERT/AP-SCERT). */
export type NCERTTextbookEdition = 'NCF-2023' | 'Rationalized-2022' | 'State-SCERT';

export interface NCERTChapter {
    id: string;
    title: string;
    titleHindi?: string;
    titleOriginal?: string;          // native script title for regional language subjects
    subject: NCERTSubject;
    grade: number;
    number: number;
    textbookName: string;
    textbookCode?: string;           // official NCERT book code e.g. '402' for IT
    textbookEdition?: NCERTTextbookEdition;   // set by each file; defaults in seed script
    learningOutcomes: string[];
    keywords: string[];
    estimatedPeriods: number;
    isActive?: boolean;              // false = rationalized-out; undefined treated as true
    dataVersion?: string;            // '2025-ncert-ncf' | '2025-ncert-rationalized'
}

export interface NCERTTextbook {
    id: string;
    name: string;
    subject: NCERTSubject;
    grades: number[];
    code?: string;
    edition: NCERTTextbookEdition;
    language: 'English' | 'Hindi' | 'Regional';
    coverImageUrl?: string;
    board: 'NCERT';
}

function getMathTextbookName(grade: number): string {
    if (grade <= 2) return `Joyful Mathematics ${grade}`;
    if (grade <= 5) return `Maths Mela ${grade}`;
    if (grade <= 8) return `Ganita Prakash ${grade}`;
    if (grade <= 10) return 'Mathematics (NCERT)';
    return 'Mathematics Part I & II (NCERT)';
}

// Flatten Math (NCERTGrade[] → NCERTChapter[])
const mathematicsChapters: NCERTChapter[] = NCERTMathematics.flatMap(g =>
    g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'Mathematics' as const,
        textbookName: getMathTextbookName(g.grade),
        textbookEdition: (g.grade <= 8 ? 'NCF-2023' : 'Rationalized-2022') as NCERTTextbookEdition,
        isActive: true,
        dataVersion: g.grade <= 8 ? '2025-ncert-ncf' : '2025-ncert-rationalized',
    }))
);

// Flatten IT
const informationTechnologyChapters: NCERTChapter[] = itChapters.map(c => ({
    ...c,
    subject: 'Information Technology' as const,
    textbookEdition: 'Rationalized-2022' as NCERTTextbookEdition,
    isActive: true,
    dataVersion: '2025-ncert-rationalized',
}));

export const allNCERTChapters: NCERTChapter[] = [
    ...mathematicsChapters,
    ...scienceChapters,
    ...evsChapters,
    ...socialStudiesChapters,
    ...englishChapters,
    ...hindiChapters,
    ...sanskritChapters,
    ...kannadaChapters,
    ...tamilChapters,
    ...teluguChapters,
    ...marathiChapters,
    ...bengaliChapters,
    ...gujaratiChapters,
    ...punjabiChapters,
    ...malayalamChapters,
    ...urduChapters,
    ...informationTechnologyChapters,
    ...physicsChapters,
    ...chemistryChapters,
    ...biologyChapters,
];

export const getChaptersForGrade = (grade: number, subject?: string) => {
    let chapters = allNCERTChapters.filter(c => c.grade === grade && c.isActive !== false);
    if (subject) {
        chapters = chapters.filter(c => c.subject === subject);
    }
    return chapters;
};

export const getChapterById = (id: string) => {
    return allNCERTChapters.find(c => c.id === id);
};

export const searchChapters = (query: string, filters?: { subject?: NCERTSubject; grade?: number }) => {
    const lowerQuery = query.toLowerCase();
    let results = allNCERTChapters.filter(c =>
        c.isActive !== false && (
            c.title.toLowerCase().includes(lowerQuery) ||
            c.keywords.some(k => k.toLowerCase().includes(lowerQuery))
        )
    );
    if (filters?.subject) results = results.filter(c => c.subject === filters.subject);
    if (filters?.grade) results = results.filter(c => c.grade === filters.grade);
    return results;
};
