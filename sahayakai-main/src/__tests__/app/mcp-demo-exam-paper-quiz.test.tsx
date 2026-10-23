/**
 * @jest-environment jsdom
 *
 * /mcp-demo/exam-paper and /mcp-demo/quiz — UI: MCP status pill (initialize +
 * tools/list via the demo API), form → public MCP arguments, result rendering,
 * error rendering, and the signed-out state. Only /api/mcp-demo/* is called.
 */
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: jest.fn().mockResolvedValue('firebase-id-token') } } }));
const mockAuth = { user: { uid: 'teacher-1' } as unknown, loading: false };
jest.mock('@/context/auth-context', () => ({ useAuth: () => mockAuth }));

import McpExamPaperDemoPage from '@/app/mcp-demo/exam-paper/page';
import McpQuizDemoPage from '@/app/mcp-demo/quiz/page';

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body });
let postReply: () => Promise<unknown>;
let statusBody: unknown;

beforeEach(() => {
    mockAuth.user = { uid: 'teacher-1' };
    mockAuth.loading = false;
    fetchMock.mockReset().mockImplementation((_url: string, init?: RequestInit) => (init?.method === 'POST' ? postReply() : reply(200, statusBody)));
    (global as any).fetch = fetchMock;
});
const posts = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST').map(([u, i]) => ({ url: u, body: JSON.parse(i.body) }));

// ── Exam paper ──────────────────────────────────────────────────────────────

const EXAM_SERVER = { name: 'sahayak-exam-paper', version: '1.0.0', tool: 'create_exam_paper', protocol: 'Streamable HTTP' };
const PAPER = {
    title: 'CBSE Class 8 Science — Force and Pressure', board: 'CBSE', grade: 8, subject: 'Science', language: 'English', duration: '45 Minutes',
    max_marks: 2, total_question_marks: 2, general_instructions: ['All questions are compulsory.'],
    sections: [{ name: 'Section A', label: 'MCQ', total_marks: 2, questions: [
        { number: 1, text: 'The SI unit of pressure is', marks: 1, origin: 'previous_year', source_note: 'PYQ 2023', options: ['(a) newton', '(b) pascal'], correct_option: 'b', internal_choice: null, answer_key: '(b) pascal', marking_scheme: '1 mark' },
        { number: 2, text: 'Which force acts without contact?', marks: 1, origin: 'new', source_note: null, options: [], correct_option: null, internal_choice: null, answer_key: 'Magnetic force', marking_scheme: null },
    ] }],
    blueprint: { chapter_marks: [{ chapter: 'Force and Pressure', marks: 2 }], difficulty_mix: [] },
    previous_year_sources: [{ year: 2023, set: 'Set 1', chapter: 'Force and Pressure' }],
    review_notes: ['Check question 2.'],
};

describe('/mcp-demo/exam-paper', () => {
    beforeEach(() => {
        statusBody = { configured: true, connected: true, server: EXAM_SERVER };
        postReply = () => reply(200, { paper: PAPER, mcp: { ...EXAM_SERVER, durationMs: 31_400 } });
    });

    it('shows the real MCP status and sends the form as create_exam_paper arguments', async () => {
        render(<McpExamPaperDemoPage />);
        await waitFor(() => expect(within(screen.getByTestId('mcp-status')).getByText('create_exam_paper')).toBeInTheDocument());
        expect(fetchMock.mock.calls[0][0]).toBe('/api/mcp-demo/exam-paper');
        fireEvent.click(screen.getByRole('button', { name: /Generate Exam Paper/ }));
        const result = await screen.findByTestId('exam-paper-result');
        expect(posts()).toEqual([{ url: '/api/mcp-demo/exam-paper', body: {
            board: 'CBSE', grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium', language: 'English',
            max_marks: 20, duration_minutes: 45, include_answer_key: true, include_marking_scheme: true,
        } }]);
        expect(result).toHaveTextContent(PAPER.title);
        expect(result).toHaveTextContent('The SI unit of pressure is');
        expect(result).toHaveTextContent('(b) pascal');
        expect(result).toHaveTextContent('Check question 2.');
        expect(result).toHaveTextContent('create_exam_paper');
        expect(result).toHaveTextContent('31.4 s');
    });

    it('renders an MCP error message with a retry for retryable errors', async () => {
        postReply = () => reply(429, { error: { category: 'rate_limited', message: 'Rate limit reached for this API key. Retry after about 3 minutes.', retryable: true } });
        render(<McpExamPaperDemoPage />);
        await screen.findByText('create_exam_paper');
        fireEvent.click(screen.getByRole('button', { name: /Generate Exam Paper/ }));
        const alert = await screen.findByTestId('mcp-error');
        expect(alert).toHaveTextContent('Rate limit reached for this API key.');
        expect(alert).not.toHaveTextContent(/output schema|-32602/);
        expect(within(alert).getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    });

    it('signed out: asks to sign in, disables generation and calls nothing', async () => {
        mockAuth.user = null;
        render(<McpExamPaperDemoPage />);
        expect(await screen.findByTestId('mcp-signed-out')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Exam Paper/ })).toBeDisabled();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

// ── Quiz ────────────────────────────────────────────────────────────────────

const QUIZ_SERVER = { name: 'sahayak-quiz', version: '1.0.0', tool: 'create_quiz', protocol: 'Streamable HTTP' };
const QUIZ = {
    topic: 'Fractions', grade: 7, subject: 'Mathematics', language: 'English', review_notes: [],
    quizzes: [{ difficulty: 'medium', title: 'Fractions — medium', teacher_instructions: 'Use the board.', questions: [
        { number: 1, type: 'multiple_choice', question: 'What is 1/2 + 1/4?', options: ['1/6', '3/4'], correct_answer: '3/4', explanation: '2/4 + 1/4 = 3/4.' },
    ] }],
};

describe('/mcp-demo/quiz', () => {
    beforeEach(() => {
        statusBody = { configured: true, connected: true, server: QUIZ_SERVER };
        postReply = () => reply(200, { quiz: QUIZ, mcp: { ...QUIZ_SERVER, durationMs: 18_000 } });
    });

    it('shows the real MCP status, sends create_quiz arguments and renders questions with answers', async () => {
        render(<McpQuizDemoPage />);
        await waitFor(() => expect(within(screen.getByTestId('mcp-status')).getByText('create_quiz')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Generate Quiz/ }));
        const result = await screen.findByTestId('quiz-result');
        expect(posts()).toEqual([{ url: '/api/mcp-demo/quiz', body: {
            topic: 'Fractions', grade: 7, subject: 'Mathematics', num_questions: 5, question_types: ['multiple_choice', 'short_answer'],
            difficulty: 'medium', blooms_levels: ['Remember', 'Understand'], language: 'English',
        } }]);
        expect(within(result).getByTestId('quiz-medium')).toHaveTextContent('What is 1/2 + 1/4?');
        expect(result).toHaveTextContent('2/4 + 1/4 = 3/4.');
        fireEvent.click(within(result).getByRole('button', { name: 'Hide answers' }));
        expect(result).not.toHaveTextContent('2/4 + 1/4 = 3/4.');
    });

    it('"All three levels" omits difficulty; no question type disables generation', async () => {
        render(<McpQuizDemoPage />);
        await screen.findByText('create_quiz');
        fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'all' } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Quiz/ }));
        await screen.findByTestId('quiz-result');
        expect(posts()[0].body).not.toHaveProperty('difficulty');

        fireEvent.click(screen.getByLabelText('Multiple choice'));
        fireEvent.click(screen.getByLabelText('Short answer'));
        expect(screen.getByRole('button', { name: /Generate Quiz/ })).toBeDisabled();
    });

    it('renders a content-policy refusal without retry', async () => {
        postReply = () => reply(422, { error: { category: 'content_policy', message: 'This request cannot be used under Sahayak\'s classroom safety policy.', retryable: false } });
        render(<McpQuizDemoPage />);
        await screen.findByText('create_quiz');
        fireEvent.click(screen.getByRole('button', { name: /Generate Quiz/ }));
        const alert = await screen.findByTestId('mcp-error');
        expect(alert).toHaveTextContent('classroom safety policy');
        expect(within(alert).queryByRole('button', { name: /Try again/ })).toBeNull();
    });

    it('shows "Not configured" when the server has no MCP key', async () => {
        statusBody = { configured: false, connected: false };
        render(<McpQuizDemoPage />);
        await waitFor(() => expect(within(screen.getByTestId('mcp-status')).getByText('Not configured')).toBeInTheDocument());
    });
});
