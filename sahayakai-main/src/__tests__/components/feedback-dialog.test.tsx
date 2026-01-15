import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { useToast } from '@/hooks/use-toast';

// Mock Hooks
jest.mock('@/hooks/use-toast');

// Mock Firebase dynamic imports
jest.mock('@/lib/firebase', () => ({
    db: {}
}));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    addDoc: jest.fn(),
    serverTimestamp: jest.fn()
}));

// Mock Lucide React to avoid ESM issues
jest.mock('lucide-react', () => ({
    ThumbsUp: () => <div data-testid="icon-thumbs-up" />,
    ThumbsDown: () => <div data-testid="icon-thumbs-down" />,
    MessageSquare: () => <div data-testid="icon-message" />,
    X: () => <div data-testid="icon-close" />,
    Loader2: () => <div data-testid="icon-loader" />,
}));

// We need to jump through some hoops to mock dynamic imports in the component
// Since Jest runs in node, we can mock the modules themselves.
// The component calls `await import(...)`.
// In Jest with babel-jest/ts-jest, `import()` usually just resolves the module.

describe('FeedbackDialog', () => {
    const mockToast = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });

        // Mock the console errors to keep output clean during error tests
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
    });

    const defaultProps = {
        page: 'test-page',
        feature: 'test-feature',
        context: { id: 1 },
    };

    it('renders feedback buttons', () => {
        render(<FeedbackDialog {...defaultProps} />);
        expect(screen.getByText('Was this helpful?')).toBeInTheDocument();
        // Check for Lucide icons presence by class or role
        // Easier to check via the buttons wrapper if icons generate complex SVG
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(2);
    });

    it('opens dialog on thumbs down click', async () => {
        render(<FeedbackDialog {...defaultProps} />);

        const thumbsDown = screen.getAllByRole('button')[1];
        fireEvent.click(thumbsDown);

        await waitFor(() => {
            expect(screen.getByText('How can we improve?')).toBeInTheDocument();
        });
    });

    it('validates comment input before submitting', async () => {
        render(<FeedbackDialog {...defaultProps} />);

        // Open dialog
        fireEvent.click(screen.getAllByRole('button')[1]);

        await waitFor(() => screen.getByText('How can we improve?'));

        const submitBtn = screen.getByText('Submit Feedback');
        expect(submitBtn).toBeDisabled();

        const textarea = screen.getByPlaceholderText(/e.g., The objectives were too/i);
        fireEvent.change(textarea, { target: { value: 'Something wrong' } });

        expect(submitBtn).not.toBeDisabled();
    });

    it('handles thumbs up submission immediately', async () => {
        // We need to ensure the dynamic imports resolve
        render(<FeedbackDialog {...defaultProps} />);

        const thumbsUp = screen.getAllByRole('button')[0];
        fireEvent.click(thumbsUp);

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Feedback Received'
            }));
        });
    });
});
