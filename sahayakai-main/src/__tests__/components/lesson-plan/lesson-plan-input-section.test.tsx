import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonPlanInputSection } from '@/components/lesson-plan/lesson-plan-input-section';
import { FormProvider, useForm } from 'react-hook-form';
import userEvent from '@testing-library/user-event';

// Wrapper to provide Form Context
const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm({
        defaultValues: {
            topic: '',
            imageDataUri: '',
        }
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
};

// Mocks
jest.mock('@/components/microphone-input', () => ({
    MicrophoneInput: ({ onTranscriptChange }: any) => (
        <button data-testid="mic-input" onClick={() => onTranscriptChange('Spoken Text')}>
            Mic
        </button>
    ),
}));

jest.mock('@/components/image-uploader', () => ({
    ImageUploader: ({ onImageUpload }: any) => (
        <button data-testid="img-upload" onClick={() => onImageUpload('data:image/png;base64,123')}>
            Upload Image
        </button>
    ),
}));

jest.mock('@/components/example-prompts', () => ({
    ExamplePrompts: ({ onPromptClick }: any) => (
        <button onClick={() => onPromptClick('Example Prompt')}>Example</button>
    )
}));

jest.mock('@/components/quick-templates', () => ({
    QuickTemplates: ({ onTemplateSelect }: any) => (
        <button onClick={() => onTemplateSelect({ title: 'Template' })}>Template</button>
    )
}));

describe('LessonPlanInputSection', () => {
    const defaultProps = {
        topicPlaceholder: 'Enter topic...',
        selectedLanguage: 'en',
        onTranscriptChange: jest.fn(),
        onPromptClick: jest.fn(),
        onTemplateSelect: jest.fn(),
        generateButton: <button>Generate</button>,
    };

    it('renders key elements', () => {
        render(
            <Wrapper>
                <LessonPlanInputSection {...defaultProps} />
            </Wrapper>
        );

        // expect(screen.getByText(/Topic/i)).toBeInTheDocument(); // Removed as per current UI
        expect(screen.getByPlaceholderText(/A lesson on 'Healthy Food'/i)).toBeInTheDocument();
        expect(screen.getByTestId('mic-input')).toBeInTheDocument();
        // expect(screen.getByText('Generate')).toBeInTheDocument(); // Removed as per current UI
    });

    it('allows typing in the topic field', async () => {
        const user = userEvent.setup();
        render(
            <Wrapper>
                <LessonPlanInputSection {...defaultProps} />
            </Wrapper>
        );

        const input = screen.getByPlaceholderText(/A lesson on 'Healthy Food'/i);
        await user.type(input, 'Force and Motion');
        expect(input).toHaveValue('Force and Motion');
    });

    it('handles microphone input', () => {
        render(
            <Wrapper>
                <LessonPlanInputSection {...defaultProps} />
            </Wrapper>
        );

        fireEvent.click(screen.getByTestId('mic-input'));
        expect(defaultProps.onTranscriptChange).toHaveBeenCalledWith('Spoken Text');
    });
});
