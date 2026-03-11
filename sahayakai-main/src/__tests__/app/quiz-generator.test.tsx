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
