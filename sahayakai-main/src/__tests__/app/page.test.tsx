import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock Lucide Icons (Common source of ESM pain)
jest.mock('lucide-react', () => ({
    Sparkles: () => <div data-testid="icon-sparkles" />,
    ArrowRight: () => <div data-testid="icon-arrow" />,
    BookOpen: () => <div data-testid="icon-book" />,
    BrainCircuit: () => <div data-testid="icon-brain" />,
    PenTool: () => <div data-testid="icon-pen" />,
    GraduationCap: () => <div data-testid="icon-grad" />,
}));

// Mock Components
jest.mock('@/components/microphone-input', () => ({
    MicrophoneInput: ({ onTranscriptChange }: any) => (
        <button onClick={() => onTranscriptChange('Mic Input')}>Mic Mock</button>
    )
}));

jest.mock('@/components/auto-complete-input', () => ({
    AutoCompleteInput: React.forwardRef((props: any, ref: any) => (
        <input
            ref={ref}
            data-testid="topic-input"
            onChange={props.onChange}
            onBlur={props.onBlur} // Important for hook form
            name={props.name}     // Important for hook form
            value={props.value || ''}
            placeholder={props.placeholder}
        />
    ))
}));

describe('Home Page', () => {
    const mockPush = jest.fn();

    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        jest.clearAllMocks();
    });

    it('renders the hero section with greeting', () => {
        render(<Home />);
        // Use getAllByText for "Teacher" since it appears in greeting and cards
        const teacherElements = screen.getAllByText(/Teacher/i);
        expect(teacherElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/Sahayak, your personal AI companion/i)).toBeInTheDocument();
    });

    it('renders quick action cards', () => {
        render(<Home />);
        expect(screen.getByText('Lesson Plan')).toBeInTheDocument();
        expect(screen.getByText('Quiz Generator')).toBeInTheDocument();
        expect(screen.getByText('Content Creator')).toBeInTheDocument();
        expect(screen.getByText('Teacher Training')).toBeInTheDocument();
    });

    it('navigates on form submission', async () => {
        render(<Home />);
        const input = screen.getByTestId('topic-input');
        fireEvent.change(input, { target: { value: 'Photosynthesis' } });

        const submitBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/lesson-plan?topic=Photosynthesis');
        });
    });

    it('handles microphone input', async () => {
        render(<Home />);
        const micBtn = screen.getByText('Mic Mock');
        fireEvent.click(micBtn);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/lesson-plan?topic=Mic%20Input');
        });
    });
});
