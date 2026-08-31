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
import { type EducationBoard } from '@/types';

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
 *  State-SCERT: State board textbook (KTBS/TNSCERT/Balbharati/WBBSE/GSSTB/PSEB/SCERT-Kerala/TSCERT/APSCERT). */
export type NCERTTextbookEdition = 'NCF-2023' | 'Rationalized-2022' | 'State-SCERT';

/** The board that prescribes a textbook.
 *
 *  This is a property of the (board × grade × subject) cell, NOT of the subject.
 *  Deriving it from the subject name — the pre-2026-08 behaviour in
 *  seed-ncert.ts — breaks in both directions: NCERT publishes a Class 9 Kannada
 *  reader (ತಿಳಿ ಕನ್ನಡ), and Karnataka prints its own Kannada edition of the
 *  NCERT Ganita Prakash. Every chapter must state its board explicitly.
 */
export type ChapterBoard = EducationBoard;

/** Chapters with no explicit `board` belong to this one. */
export const DEFAULT_BOARD: ChapterBoard = 'CBSE';

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
    /** Prescribing board. Omitted means DEFAULT_BOARD ('CBSE') — see ChapterBoard. */
    board?: ChapterBoard;
    learningOutcomes: string[];
    keywords: string[];
    estimatedPeriods: number;
    isActive?: boolean;              // false = rationalized-out; undefined treated as true
    dataVersion?: string;            // '2025-ncert-ncf' | '2025-ncert-rationalized'
}

/** Board of a chapter, resolving the omitted-means-CBSE default. */
export const boardOf = (c: Pick<NCERTChapter, 'board'>): ChapterBoard => c.board ?? DEFAULT_BOARD;

/**
 * Teacher-facing chapter order: by book, then by chapter number within it.
 *
 * Sorting on `number` alone is wrong for any subject that spans volumes.
 * Class 10 Social Science has four books that each start at Chapter 1, so a
 * number-only sort interleaves four indistinguishable "Chapter 1"s. Both the
 * bundled data and the Firestore reader use this comparator, so the two
 * sources are interchangeable rather than merely equivalent as sets.
 */
export const compareChapters = (a: NCERTChapter, b: NCERTChapter): number =>
    a.textbookName === b.textbookName
        ? a.number - b.number
        : (a.textbookName ?? '').localeCompare(b.textbookName ?? '');

export interface NCERTTextbook {
    id: string;
    name: string;
    subject: NCERTSubject;
    grades: number[];
    code?: string;
    edition: NCERTTextbookEdition;
    language: 'English' | 'Hindi' | 'Regional';
    coverImageUrl?: string;
    board: ChapterBoard;
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

/**
 * Chapters a teacher should see for a grade.
 *
 * `board` narrows to that board's prescribed books. Omit it to get every
 * board's chapters for the cell — correct for the curriculum browser, wrong
 * for anything generating material for one teacher, which should pass the
 * teacher's `preferredBoard`.
 */
export const getChaptersForGrade = (grade: number, subject?: string, board?: ChapterBoard) => {
    let chapters = allNCERTChapters.filter(c => c.grade === grade && c.isActive !== false);
    if (subject) {
        chapters = chapters.filter(c => c.subject === subject);
    }
    if (board) {
        chapters = chapters.filter(c => boardOf(c) === board);
    }
    return [...chapters].sort(compareChapters);
};

/** Boards that actually prescribe something at this (grade × subject) cell. */
export const getBoardsForCell = (grade: number, subject: string): ChapterBoard[] => {
    const boards = new Set<ChapterBoard>();
    for (const c of allNCERTChapters) {
        if (c.grade === grade && c.subject === subject && c.isActive !== false) boards.add(boardOf(c));
    }
    return [...boards].sort();
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
