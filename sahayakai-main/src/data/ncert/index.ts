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
 *  seed-ncert.ts — assumed every "regional" subject is state-board and every
 *  other subject is NCERT. Karnataka prints its own Kannada edition of the
 *  NCERT Ganita Prakash, so Mathematics is not always CBSE; and one board can
 *  prescribe several books for the same subject and grade (KTBS publishes Siri,
 *  Tili and Nudi Kannada as first, second and third language readers), so the
 *  subject does not even determine the book. Every chapter states its board.
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
    /** For language subjects where a board prescribes more than one reader at
     *  the same grade. Omitted means the cell has a single book. */
    languageStream?: LanguageStream;
    learningOutcomes: string[];
    keywords: string[];
    estimatedPeriods: number;
    isActive?: boolean;              // false = rationalized-out; undefined treated as true
    dataVersion?: string;            // '2025-ncert-ncf' | '2025-ncert-rationalized'
}

/** Board of a chapter, resolving the omitted-means-CBSE default. */
export const boardOf = (c: Pick<NCERTChapter, 'board'>): ChapterBoard => c.board ?? DEFAULT_BOARD;

/**
 * Which language stream a language textbook belongs to.
 *
 * A state board can prescribe several readers in the same language, at the same
 * grade, for pupils studying it at different levels. Karnataka publishes three
 * Kannada readers per grade — ಸಿರಿ ಕನ್ನಡ (first language), ತಿಳಿ ಕನ್ನಡ (second) and
 * ನುಡಿ ಕನ್ನಡ (third) — and a teacher of second-language Kannada needs a different
 * book from a teacher of first-language Kannada in the same classroom year.
 * Without this, (board × grade × subject) returns one list and at most one of
 * those teachers is served correctly.
 *
 * Only language subjects carry it. Undefined means "the only book at this cell".
 */
export type LanguageStream = 'first' | 'second' | 'third';

/** Human label for a stream, for pickers and prompts. */
export const LANGUAGE_STREAM_LABEL: Record<LanguageStream, string> = {
    first: 'First language',
    second: 'Second language',
    third: 'Third language',
};

/**
 * Teacher-facing chapter order: by book, then by chapter number within it.
 *
 * Sorting on `number` alone is wrong for any subject that spans volumes.
 * Class 10 Social Science has four books that each start at Chapter 1, so a
 * number-only sort interleaves four indistinguishable "Chapter 1"s. Both the
 * bundled data and the Firestore reader use this comparator, so the two
 * sources are interchangeable rather than merely equivalent as sets.
 */
export const compareChapters = (a: NCERTChapter, b: NCERTChapter): number => {
    if (a.textbookName !== b.textbookName) {
        return (a.textbookName ?? '').localeCompare(b.textbookName ?? '');
    }
    if (a.number !== b.number) return a.number - b.number;
    // Same book, same chapter number: a prose piece and the poems printed
    // inside it. NCERT numbers the chapter, not the pieces — First Flight has
    // nine numbered chapters and Amanda! sits inside chapter 4 rather than
    // being chapter 10. Ids are suffixed so the prose sorts before its poems.
    return a.id.localeCompare(b.id);
};

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

/**
 * Flatten Math (NCERTGrade[] → NCERTChapter[]).
 *
 * Every field the chapter declares wins. This used to overwrite three of them
 * unconditionally, and each overwrite hid something true:
 *
 *  - `textbookName` was replaced by a grade→name lookup. Grades 1–5 declare
 *    themselves as `Ganita ka Jadu / Math Magic N` — the retired book, which is
 *    what their chapter titles actually are — and the lookup relabelled them
 *    `Joyful Mathematics N` / `Maths Mela N`. The data was honest; the flatten
 *    made it lie. It also erased the real `(Part 1)` / `(Part 2)` split on the
 *    Ganita Prakash 7 and 8 volumes.
 *  - `isActive` was hardcoded true, so no Mathematics chapter could ever be
 *    retired — the mechanism every other subject uses to supersede a book.
 *  - `textbookEdition` was derived from the grade, which stops being true the
 *    moment one grade holds both a retired and a current book, as Class 9 does.
 */
const mathematicsChapters: NCERTChapter[] = NCERTMathematics.flatMap(g =>
    g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'Mathematics' as const,
        textbookName: c.textbookName,
        textbookEdition: (c.textbookEdition
            ?? (g.grade <= 8 ? 'NCF-2023' : 'Rationalized-2022')) as NCERTTextbookEdition,
        isActive: c.isActive ?? true,
        dataVersion: c.dataVersion ?? (g.grade <= 8 ? '2025-ncert-ncf' : '2025-ncert-rationalized'),
    }))
);

// Flatten IT — like the Mathematics and Science flattens, what the chapter
// declares wins, so an IT chapter can be retired when the book is superseded.
const informationTechnologyChapters: NCERTChapter[] = itChapters.map(c => ({
    ...c,
    subject: 'Information Technology' as const,
    textbookEdition: (c.textbookEdition ?? 'Rationalized-2022') as NCERTTextbookEdition,
    isActive: c.isActive ?? true,
    dataVersion: c.dataVersion ?? '2025-ncert-rationalized',
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
export const getChaptersForGrade = (
    grade: number,
    subject?: string,
    board?: ChapterBoard,
    languageStream?: LanguageStream,
) => {
    let chapters = allNCERTChapters.filter(c => c.grade === grade && c.isActive !== false);
    if (subject) {
        chapters = chapters.filter(c => c.subject === subject);
    }
    if (board) {
        chapters = chapters.filter(c => boardOf(c) === board);
    }
    if (languageStream) {
        // A chapter with no stream belongs to every stream — it is the only book
        // at its cell. Filtering it out would empty single-book language cells.
        chapters = chapters.filter(c => c.languageStream === undefined || c.languageStream === languageStream);
    }
    return [...chapters].sort(compareChapters);
};

/** Language streams actually prescribed at this (board × grade × subject). */
export const getStreamsForCell = (grade: number, subject: string, board?: ChapterBoard): LanguageStream[] => {
    const streams = new Set<LanguageStream>();
    for (const c of allNCERTChapters) {
        if (c.grade !== grade || c.subject !== subject || c.isActive === false) continue;
        if (board && boardOf(c) !== board) continue;
        if (c.languageStream) streams.add(c.languageStream);
    }
    return [...streams].sort();
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
