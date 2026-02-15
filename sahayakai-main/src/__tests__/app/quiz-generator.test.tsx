/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';

// Mock the auth context
jest.mock('@/context/auth-context', () => ({
    useAuth: jest.fn(),
}));

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-123', getIdToken: jest.fn().mockResolvedValue('mock-token') },
    },
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: jest.fn(),
    }),
}));

// Mock the AI flow
jest.mock('@/ai/flows/quiz-generator', () => ({
    generateQuiz: jest.fn(),
}));

describe('Quiz Generator - Voice Input Auto-Submit', () => {
    beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue({
            requireAuth: () => true,
            openAuthModal: jest.fn(),
        });

        // Mock fetch for quiz generation
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        easy: { questions: [] },
                        medium: {
                            title: 'Test Quiz',
                            questions: [{
                                questionText: 'Test?',
                                questionType: 'multiple_choice',
                                options: ['A', 'B'],
                                correctAnswer: 'A',
                                explanation: 'Because.',
                                difficultyLevel: 'medium'
                            }]
                        },
                        hard: { questions: [] },
                    }),
            })
        ) as jest.Mock;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should auto-submit form after voice transcript is received', async () => {
        // This test verifies that when a voice transcript is received,
        // the form automatically submits without requiring manual button click

        const mockTranscript = 'Generate quiz for grade five, chapter two of science';

        // Import the page component dynamically to avoid import issues
        const QuizGeneratorPage = require('@/app/quiz-generator/page').default;

        render(<QuizGeneratorPage />);

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText(/Quiz Generator/i)).toBeInTheDocument();
        });

        // Simulate microphone transcription callback
        // Note: In real implementation, this would be triggered by MicrophoneInput component
        const topicTextarea = screen.getByPlaceholderText(/life cycle of a butterfly/i);

        // Simulate the transcript being set
        fireEvent.change(topicTextarea, { target: { value: mockTranscript } });

        // Verify that the API call was made automatically
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/ai/quiz',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                        }),
                    })
                );
            },
            { timeout: 2000 } // Account for the 100ms setTimeout
        );
    }, 10000);

    it('should include voice transcript in quiz generation request', async () => {
        const mockTranscript = 'Generate quiz on photosynthesis for grade 6';

        const QuizGeneratorPage = require('@/app/quiz-generator/page').default;
        render(<QuizGeneratorPage />);

        await waitFor(() => {
            expect(screen.getByText(/Quiz Generator/i)).toBeInTheDocument();
        });

        const topicTextarea = screen.getByPlaceholderText(/life cycle of a butterfly/i);
        fireEvent.change(topicTextarea, { target: { value: mockTranscript } });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });

        // Verify the request body contains the transcript
        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        const lastCall = fetchCalls[fetchCalls.length - 1];
        const requestBody = JSON.parse(lastCall[1].body);

        expect(requestBody.topic).toBe(mockTranscript);
    });
});

describe('Quiz Generator - UI Color Palette', () => {
    it('should use saffron theme colors for slider', () => {
        // This test verifies that the slider component uses the correct color classes
        const SliderComponent = require('@/components/ui/slider').Slider;
        const { container } = render(<SliderComponent value={[5]} min={1} max={20} />);

        // Check that slider track uses muted background (not green secondary)
        const sliderTrack = container.querySelector('[class*="bg-muted"]');
        expect(sliderTrack).toBeInTheDocument();

        // Check that slider range uses primary color (saffron)
        const sliderRange = container.querySelector('[class*="bg-primary"]');
        expect(sliderRange).toBeInTheDocument();

        // Ensure no green secondary color is used
        const greenSecondary = container.querySelector('[class*="bg-secondary"]');
        expect(greenSecondary).not.toBeInTheDocument();
    });
});
