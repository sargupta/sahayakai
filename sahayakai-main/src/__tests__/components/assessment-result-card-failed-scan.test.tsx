/**
 * Class gate (UI half): the result card cannot offer a grade it does not have.
 *
 * A scan that graded nothing arrives with `status: 'failed'`, an empty
 * questions array, and `scorePct: 0 / letterGrade: 'E'` — arithmetic on an
 * empty set. The card hid the score header for that state but left "Copy
 * summary" and "Send to parent" live, and both call `formatParentSummary`,
 * which rendered "Score: 0% (E)" as a real grade for a real child.
 *
 * The API now rejects such a scan with a 422, so a fresh scan never reaches
 * this card. Records persisted before that fix still open here from My
 * Library, which is why the card gates on the result rather than trusting
 * whoever handed it one.
 *
 * The class: no action that produces parent- or student-facing text is
 * reachable on a result that graded nothing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(),
    getAuthInstance: jest.fn(),
    getStorageInstance: jest.fn(),
}));

jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s, language: 'English' }),
}));

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: null }),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

const mockShare = jest.fn();
const mockFormatParentSummary = jest.fn();
jest.mock('@/lib/assessment-formatters', () => ({
    // Keep the real helpers (latexToReadable etc.) — the card formats question
    // text with latexToReadable at render — and only spy the two the failed-scan
    // gate test asserts on.
    ...jest.requireActual('@/lib/assessment-formatters'),
    formatParentSummary: (...args: unknown[]) => mockFormatParentSummary(...args),
    shareViaNativeOrWhatsapp: (...args: unknown[]) => mockShare(...args),
}));

import { AssessmentResultCard } from '@/components/assessment-scanner/assessment-result-card';
import { letterGradeFor } from '@/ai/schemas/assessment-scanner-utils';
import type { AssessmentScannerOutput } from '@/ai/schemas/assessment-scanner-schemas';

const UNGRADED_RESULT = {
    assessmentId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'failed' as const,
    pageCount: 1,
    totalAwardedMarks: 0,
    totalMaxMarks: 0,
    scorePct: 0,
    letterGrade: letterGradeFor(0),
    questions: [],
    classAverageAtScan: null,
    conceptMastery: [],
    recommendedNextSteps: [],
    studentRecommendations: [],
    needsReviewCount: 0,
    imageQualityWarnings: [],
} as AssessmentScannerOutput;

const GRADED_RESULT = {
    ...UNGRADED_RESULT,
    status: 'graded' as const,
    totalAwardedMarks: 2,
    totalMaxMarks: 2,
    scorePct: 100,
    letterGrade: letterGradeFor(100),
    questions: [
        {
            questionId: 'p0-q1',
            pageIndex: 0,
            questionText: 'Solve 12 x 4',
            studentAnswer: '48',
            expectedAnswer: '48',
            marksAwarded: 2,
            marksMax: 2,
            partialCreditBreakdown: [],
            feedback: 'Correct.',
            studentFacingFeedback: 'Well done.',
            conceptTested: 'Multiplication',
            ncertChapterId: null,
            mistakePattern: null,
            needsTeacherReview: false,
            confidence: 0.95,
        },
    ],
} as AssessmentScannerOutput;

function button(label: string): HTMLButtonElement {
    return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('AssessmentResultCard — a scan that graded nothing', () => {
    it('disables every action that would turn it into a grade', () => {
        render(<AssessmentResultCard result={UNGRADED_RESULT} studentName="Riya" />);

        expect(button('Send to parent')).toBeDisabled();
        expect(button('Copy summary')).toBeDisabled();
        expect(button('Print / PDF')).toBeDisabled();
        expect(button('Edit')).toBeDisabled();
    });

    it('never renders the 0% / E figures the failed aggregate carries', () => {
        render(<AssessmentResultCard result={UNGRADED_RESULT} studentName="Riya" />);

        expect(screen.queryByText('0%')).not.toBeInTheDocument();
        expect(screen.queryByText(/0\.0 \/ 0/)).not.toBeInTheDocument();
        expect(mockFormatParentSummary).not.toHaveBeenCalled();
    });

    it('says what went wrong instead of showing an empty result', () => {
        render(<AssessmentResultCard result={UNGRADED_RESULT} />);

        expect(screen.getByText('Nothing to share')).toBeInTheDocument();
        expect(screen.getByText(/did not grade any questions/i)).toBeInTheDocument();
    });

    it('leaves the actions live for a scan that did grade something', () => {
        render(<AssessmentResultCard result={GRADED_RESULT} studentName="Riya" />);

        expect(button('Send to parent')).toBeEnabled();
        expect(button('Copy summary')).toBeEnabled();
        expect(screen.queryByText('Nothing to share')).not.toBeInTheDocument();
    });
});

describe('AssessmentResultCard — "Saved to My Library" must be true when shown', () => {
    it('does not claim a library save when the write did not land', () => {
        render(<AssessmentResultCard result={GRADED_RESULT} isSaved={false} />);

        expect(screen.queryByText('Saved to My Library')).not.toBeInTheDocument();
        expect(screen.getByText('Not saved to My Library')).toBeInTheDocument();
    });

    it('claims it when the write did land', () => {
        render(<AssessmentResultCard result={GRADED_RESULT} isSaved />);

        expect(screen.getByText('Saved to My Library')).toBeInTheDocument();
        expect(screen.queryByText('Not saved to My Library')).not.toBeInTheDocument();
    });
});
