/**
 * The reclassification must only ever hide rows that provably came from the
 * old automatic instant-answer save — never an answer the teacher saved, and
 * never a row whose shape is uncertain.
 */
import { classifyInstantAnswerRow } from '@/lib/library-migration';
import { isListableContent } from '@/lib/db/adapter';

jest.mock('@/lib/firebase-admin', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { logUsage: jest.fn() } }));

// Exactly what the old Genkit flow wrote (src/ai/flows/instant-answer.ts, pre-2026-10).
const AUTO_GENKIT = {
    id: 'a1', type: 'instant-answer', title: 'Hi Vidya', topic: 'Hi Vidya',
    gradeLevel: 'Class 5', subject: 'General', language: 'English',
    storagePath: 'users/u1/instant-answers/20260901_101500_hi_vidya.json',
    isPublic: false, isDraft: false,
    data: { answer: 'Hello!', videoSuggestionUrl: null, gradeLevel: null, subject: null, grounded: false },
};
// What the old sidecar persist wrote (hyphenated slug).
const AUTO_SIDECAR = { ...AUTO_GENKIT, id: 'a2', storagePath: 'users/u1/instant-answers/20260901_101500_hi-vidya.json' };
// What the Save button (saveToLibrary) writes.
const SAVED = {
    id: 's1', type: 'instant-answer', title: 'What is photosynthesis?', topic: 'What is photosynthesis?',
    storagePath: 'users/u1/instant-answers/20260901_101500_what_is_photosynthesis.json',
    data: { answer: 'Plants make food…', videoSuggestionUrl: null, grounded: false, language: 'en', gradeLevel: 'Class 7', subject: 'Science' },
};

describe('classifyInstantAnswerRow', () => {
    it('recognises the Genkit and sidecar auto-save shapes', () => {
        expect(classifyInstantAnswerRow(AUTO_GENKIT).rowClass).toBe('auto');
        expect(classifyInstantAnswerRow(AUTO_SIDECAR).rowClass).toBe('auto');
    });

    it('keeps answers the teacher explicitly saved', () => {
        expect(classifyInstantAnswerRow(SAVED).rowClass).toBe('saved');
        // saveToLibrary keeps the language key even when the value was empty
        expect(classifyInstantAnswerRow({ ...SAVED, data: { ...SAVED.data, language: null } }).rowClass).toBe('saved');
    });

    it('keeps anything it cannot prove was auto-saved', () => {
        expect(classifyInstantAnswerRow({ ...AUTO_GENKIT, storagePath: 'users/u1/other/x.json' }).rowClass).toBe('ambiguous');
        expect(classifyInstantAnswerRow({ ...AUTO_GENKIT, title: 'Edited title' }).rowClass).toBe('ambiguous');
        expect(classifyInstantAnswerRow({ ...AUTO_GENKIT, data: {} }).rowClass).toBe('ambiguous');
    });

    it('never touches other content types', () => {
        expect(classifyInstantAnswerRow({ ...AUTO_GENKIT, type: 'worksheet' }).rowClass).toBe('not-instant-answer');
    });

    it('a hidden row disappears from My Library listings but is not deleted', () => {
        expect(isListableContent({ ...AUTO_GENKIT, hiddenFromLibrary: true } as never)).toBe(false);
        expect(isListableContent({ ...SAVED } as never)).toBe(true);
    });
});
