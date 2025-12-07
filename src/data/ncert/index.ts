/**
 * NCERT Curriculum Index
 * Central export for all NCERT subject data
 */

import NCERTMathematics from './mathematics';
import NCERTScience from './science';
import type { NCERTGrade, NCERTChapter } from './mathematics';

export { NCERTMathematics, NCERTScience };
export type { NCERTGrade, NCERTChapter };

export const NCERTSubjects = {
    mathematics: NCERTMathematics,
    science: NCERTScience,
};

export type SubjectKey = keyof typeof NCERTSubjects;

/**
 * Get chapters for a specific grade and subject
 */
export function getChaptersForGrade(subject: SubjectKey, grade: number): NCERTChapter[] {
    const subjectData = NCERTSubjects[subject];
    const gradeData = subjectData.find(g => g.grade === grade);
    return gradeData?.chapters || [];
}

/**
 * Get a specific chapter by ID
 */
export function getChapterById(chapterId: string): NCERTChapter | null {
    for (const subject of Object.values(NCERTSubjects)) {
        for (const grade of subject) {
            const chapter = grade.chapters.find(c => c.id === chapterId);
            if (chapter) return chapter;
        }
    }
    return null;
}

/**
 * Search chapters by keyword
 */
export function searchChapters(keyword: string): NCERTChapter[] {
    const results: NCERTChapter[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const subject of Object.values(NCERTSubjects)) {
        for (const grade of subject) {
            for (const chapter of grade.chapters) {
                if (
                    chapter.title.toLowerCase().includes(lowerKeyword) ||
                    chapter.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
                    chapter.learningOutcomes.some(lo => lo.toLowerCase().includes(lowerKeyword))
                ) {
                    results.push(chapter);
                }
            }
        }
    }

    return results;
}
