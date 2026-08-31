import { getChaptersForGrade } from '@/data/ncert';
import { NCERTMathematics } from '@/data/ncert/mathematics';

describe('NCERT Mathematics Data', () => {

    describe('Data Integrity', () => {
        it('Grade 6 is the NCF-2023 Ganita Prakash book (10 chapters)', () => {
            const grade6 = NCERTMathematics.find(g => g.grade === 6);
            expect(grade6).toBeDefined();
            expect(grade6?.chapters.length).toBe(10);
        });

        it('Grade 6 opens with "Patterns in Mathematics", not the retired "Knowing Our Numbers"', () => {
            const grade6 = NCERTMathematics.find(g => g.grade === 6);
            expect(grade6?.chapters[0].title).toBe('Patterns in Mathematics');
            expect(grade6?.chapters[0].id).toBe('math-6-1');
            expect(grade6?.chapters.some(c => c.title === 'Knowing Our Numbers')).toBe(false);
        });

        it('Grade 7 is Ganita Prakash Part 1+2 numbered continuously (15 chapters)', () => {
            const grade7 = NCERTMathematics.find(g => g.grade === 7);
            expect(grade7?.chapters.length).toBe(15);
            expect(grade7?.chapters[0].title).toBe('Large Numbers Around Us');
            expect(grade7?.chapters[14].title).toBe('Finding the Unknown');
            expect(grade7?.chapters.map(c => c.number)).toEqual(
                Array.from({ length: 15 }, (_, i) => i + 1),
            );
        });

        it('should include "Real Numbers" in Grade 10 (rationalized book unchanged)', () => {
            const grade10 = NCERTMathematics.find(g => g.grade === 10);
            const chapter = grade10?.chapters.find(c => c.title === 'Real Numbers');

            expect(chapter).toBeDefined();
            expect(chapter?.id).toBe('math-10-1');
        });
    });

    describe('Helper Function: getChaptersForGrade', () => {
        it('should return flattened chapters with correct subject tag', () => {
            const chapters = getChaptersForGrade(6, 'Mathematics');

            expect(chapters.length).toBe(10);

            // Should have subject 'Mathematics' injected by the helper (index.ts)
            chapters.forEach(c => {
                expect(c.subject).toBe('Mathematics');
                expect(c.grade).toBe(6);
            });
        });

        it('should return empty list for invalid grade', () => {
            const chapters = getChaptersForGrade(13, 'Mathematics');
            expect(chapters).toEqual([]);
        });
    });
});

// ── NCF-2023 syllabus refresh (2026-08-13) ─────────────────────────────────
// Pins the verified chapter lists for the new NCF textbooks so a future
// "half-migration" (new book name over old chapter titles — the bug that
// shipped Poorvi 6 with Honeysuckle chapters) fails loudly in CI.
describe('NCF-2023 textbook data (Classes 6-8)', () => {
    const expectations: Array<[number, string, number, string, string]> = [
        // [grade, subject, count, first chapter, book name]
        [6, 'Mathematics',    10, 'Patterns in Mathematics',            'Ganita Prakash 6'],
        // The flatten now respects the per-chapter textbookName, so the real
        // Part 1 / Part 2 split survives instead of being collapsed.
        [7, 'Mathematics',    15, 'Large Numbers Around Us',            'Ganita Prakash 7 (Part 1)'],
        [6, 'Science',        12, 'The Wonderful World of Science',     'Curiosity 6'],
        [7, 'Science',        12, 'The Ever-Evolving World of Science', 'Curiosity 7'],
        [6, 'Social Studies', 14, 'Locating Places on the Earth',       'Exploring Society: India and Beyond 6'],
        [7, 'Social Studies', 20, 'Geographical Diversity of India',    'Exploring Society: India and Beyond 7 (Part 1)'],
        [6, 'English',        16, 'A Bottle of Dew',                    'Poorvi 6'],
        [7, 'English',        15, 'The Day the River Spoke',            'Poorvi 7'],
        [6, 'Hindi',          13, 'मातृभूमि',                            'Malhar 6'],
        [7, 'Hindi',          10, 'माँ, कह एक कहानी',                    'Malhar 7'],
        [6, 'Sanskrit',       15, 'वयं वर्णमालां पठामः',                  'Deepakam 6'],
        [7, 'Sanskrit',       12, 'वन्दे भारतमातरम्',                     'Deepakam 7'],
        [8, 'Mathematics',    14, 'A Square and A Cube',                 'Ganita Prakash 8 (Part 1)'],
        [8, 'Science',        13, 'Exploring the Investigative World of Science', 'Curiosity 8'],
        // Part 2 = the revised June-2026 edition (8 ch); the recalled Feb-2026
        // print had 9 — total must stay 15, not 16.
        [8, 'Social Studies', 15, 'Natural Resources and Their Use',     'Exploring Society: India and Beyond 8 (Part 1)'],
        [8, 'English',        15, 'The Wit that Won Hearts',             'Poorvi 8'],
        [8, 'Hindi',          10, 'स्वदेश',                               'Malhar 8'],
        [8, 'Sanskrit',       13, 'संगच्छध्वं संवदध्वम्',                  'Deepakam 8'],
    ];

    it.each(expectations)(
        'Class %i %s has %i chapters starting "%s"',
        (grade, subject, count, firstTitle, book) => {
            const chapters = getChaptersForGrade(grade, subject as never);
            expect(chapters.length).toBe(count);
            expect(chapters[0].title).toBe(firstTitle);
            expect(chapters[0].textbookName).toBe(book);
        },
    );

    it('no old-book chapter titles leak into the NCF grades', () => {
        // Signature chapters of the RETIRED books — must not appear.
        const retired: Array<[number, string, string]> = [
            [6, 'English', "Who Did Patrick's Homework?"],   // Honeysuckle
            [6, 'Hindi', 'वह चिड़िया जो'],                     // Vasant 1
            [7, 'Hindi', 'हम पंछी उन्मुक्त गगन के'],            // Vasant 2
            [6, 'Mathematics', 'Knowing Our Numbers'],        // old Maths 6
            [7, 'Science', 'Wastewater Story'],               // old Science 7
            [6, 'Social Studies', 'Panchayati Raj'],          // old Civics 6
            [6, 'Sanskrit', 'शब्दपरिचयः I'],                   // Ruchira 1
            [8, 'Mathematics', 'Rational Numbers'],           // old Maths 8
            [8, 'Science', 'Crop Production and Management'], // old Science 8
            [8, 'English', 'The Best Christmas Present in the World'], // Honeydew
            [8, 'Hindi', 'ध्वनि'],                             // Vasant 3
            [8, 'Sanskrit', 'सुभाषितानि'],                     // Ruchira 3
        ];
        for (const [grade, subject, title] of retired) {
            const chapters = getChaptersForGrade(grade, subject as never);
            expect(chapters.map(c => c.title)).not.toContain(title);
        }
    });

    it('every chapter has non-empty outcomes, keywords and sane period estimates', () => {
        for (const [grade, subject] of [[6, 'Mathematics'], [7, 'Mathematics'], [6, 'English'], [7, 'English'], [6, 'Hindi'], [7, 'Hindi'], [6, 'Social Studies'], [7, 'Social Studies'], [6, 'Sanskrit'], [7, 'Sanskrit']] as const) {
            for (const c of getChaptersForGrade(grade, subject as never)) {
                expect(c.title.trim().length).toBeGreaterThan(0);
                expect(c.learningOutcomes.length).toBeGreaterThan(0);
                expect(c.keywords.length).toBeGreaterThan(0);
                expect(c.estimatedPeriods).toBeGreaterThan(0);
                expect(c.estimatedPeriods).toBeLessThanOrEqual(20);
            }
        }
    });
});
