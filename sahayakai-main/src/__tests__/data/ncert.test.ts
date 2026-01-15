import { getChaptersForGrade } from '@/data/ncert';
import { NCERTMathematics } from '@/data/ncert/mathematics';

describe('NCERT Mathematics Data', () => {

    describe('Data Integrity', () => {
        it('should have valid chapters for Grade 6', () => {
            // We know from the file there are 8 chapters in Grade 6
            const grade6 = NCERTMathematics.find(g => g.grade === 6);
            expect(grade6).toBeDefined();
            expect(grade6?.chapters.length).toBe(8);
        });

        it('should include "Knowing Our Numbers" in Grade 6', () => {
            const grade6 = NCERTMathematics.find(g => g.grade === 6);
            const chapter = grade6?.chapters.find(c => c.title === 'Knowing Our Numbers');

            expect(chapter).toBeDefined();
            expect(chapter?.id).toBe('math-6-1');
            expect(chapter?.subject).toBeUndefined(); // Raw data doesn't have subject on chapter level
        });

        it('should include "Real Numbers" in Grade 10', () => {
            const grade10 = NCERTMathematics.find(g => g.grade === 10);
            const chapter = grade10?.chapters.find(c => c.title === 'Real Numbers');

            expect(chapter).toBeDefined();
            expect(chapter?.id).toBe('math-10-1');
        });
    });

    describe('Helper Function: getChaptersForGrade', () => {
        it('should return flattened chapters with correct subject tag', () => {
            const chapters = getChaptersForGrade(6, 'Mathematics');

            // Should be 8
            expect(chapters.length).toBe(8);

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
