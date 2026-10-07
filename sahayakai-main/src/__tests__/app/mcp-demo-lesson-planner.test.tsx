/**
 * @jest-environment jsdom
 *
 * /mcp-demo/lesson-planner — UI behaviour: renders like the app's Lesson
 * Planner, shows the MCP status, submits the exact `create_lesson_plan`
 * arguments to the server-side MCP client, renders the MCP result, and shows
 * a retryable error. The browser only ever calls /api/mcp-demo/lesson-planner.
 */
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/firebase', () => ({
    auth: { currentUser: { uid: 'teacher-1', getIdToken: jest.fn().mockResolvedValue('firebase-id-token') } },
}));
let mockSearch = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearch }));
jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (k: string) => k, language: 'English' }) }));
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('@/components/ncert-chapter-selector', () => ({ NCERTChapterSelector: () => null }));

import McpLessonPlannerDemoPage from '@/app/mcp-demo/lesson-planner/page';

const PLAN = {
    title: 'The Sun\'s Secret Kitchen: Photosynthesis',
    grade: 7, subject: 'Science', language: 'English', duration: '45 minutes',
    learning_objectives: ['Explain how plants make food', 'Name the raw materials of photosynthesis'],
    key_vocabulary: [{ term: 'Chlorophyll', meaning: 'Green pigment in leaves' }],
    materials: ['Fresh leaves', 'Chalkboard'],
    activities: ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].map((phase, i) => ({
        phase, name: `${phase} activity`, description: `${phase} description`, duration: `${5 + i} minutes`,
        teacher_tips: phase === 'Engage' ? 'Bring a potted plant.' : null,
        understanding_check: phase === 'Explain' ? 'What do leaves need to make food?' : null,
    })),
    assessment: 'Label a leaf diagram.',
    homework: 'Observe a plant for three days.',
    curriculum_note: null as string | null,
};
const MCP = { name: 'sahayak-lesson-planner', version: '1.0.0', tool: 'create_lesson_plan', protocol: 'Streamable HTTP', durationMs: 12345 };

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
    mockSearch = new URLSearchParams('topic=Photosynthesis&grade=7&subject=Science&language=English&difficulty=medium');
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (!init || init.method === 'GET') return reply(200, { configured: true, connected: true, server: { name: MCP.name, version: MCP.version, tool: MCP.tool, protocol: MCP.protocol } });
        return reply(200, { plan: PLAN, mcp: MCP });
    });
    (global as any).fetch = fetchMock;
});

const postCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

it('renders the Sahayak lesson-plan layout with a live MCP status', async () => {
    render(<McpLessonPlannerDemoPage />);
    expect(screen.getByText('Lesson Plan')).toBeInTheDocument();
    expect(screen.getByText('Lesson Plan Settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Lesson Plan' })).toBeInTheDocument();
    const status = screen.getByTestId('mcp-status');
    await waitFor(() => expect(within(status).getByText('Connected')).toBeInTheDocument());
    expect(within(status).getByText('create_lesson_plan')).toBeInTheDocument();
    expect(within(status).getByText('Streamable HTTP')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/mcp-demo/lesson-planner', expect.objectContaining({ method: 'GET' }));
});

it('submits the exact create_lesson_plan arguments to the server-side MCP client and renders the MCP result', async () => {
    render(<McpLessonPlannerDemoPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Photosynthesis')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Lesson Plan' }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    const [url, init] = postCalls()[0];
    expect(url).toBe('/api/mcp-demo/lesson-planner'); // never the MCP server directly — that needs the API key
    expect(init.headers).toMatchObject({ Authorization: 'Bearer firebase-id-token' });
    expect(JSON.parse(init.body)).toEqual({
        topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English',
        classroom_resources: 'low', difficulty: 'standard', use_local_context: true,
    });

    expect(await screen.findByText(PLAN.title)).toBeInTheDocument();
    expect(screen.getByText('Explain how plants make food')).toBeInTheDocument();
    expect(screen.getAllByTestId('mcp-activity').map((el) => within(el).getByText(/^(Engage|Explore|Explain|Elaborate|Evaluate)$/).textContent))
        .toEqual(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']);
    expect(screen.getByText('Bring a potted plant.')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-generation-info')).toHaveTextContent('create_lesson_plan');
    expect(screen.getByTestId('mcp-generation-info')).toHaveTextContent('12.3 s');
});

it('shows vocabulary, homework and a curriculum note when present, and no internal fields', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'POST'
        ? reply(200, { plan: { ...PLAN, curriculum_note: 'Chapter 4 is not in the Class 7 syllabus.' }, mcp: MCP })
        : reply(200, { configured: true, connected: false })));
    const { container } = render(<McpLessonPlannerDemoPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Photosynthesis')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Lesson Plan' }));
    expect(await screen.findByRole('note')).toHaveTextContent('Chapter 4 is not in the Class 7 syllabus.');
    fireEvent.click(screen.getByText('Key Vocabulary'));
    fireEvent.click(screen.getByText('Homework'));
    await waitFor(() => expect(screen.getByText('Chlorophyll')).toBeInTheDocument());
    expect(screen.getByText('Observe a plant for three days.')).toBeInTheDocument();
    for (const internal of ['sk_sahayak', 'keyId', 'orgId', 'telemetry', 'sidecar', 'requestId']) {
        expect(container.innerHTML).not.toContain(internal);
    }
});

it('renders a retryable error and retries the same MCP call', async () => {
    let calls = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return reply(200, { configured: true, connected: true, server: MCP });
        calls++;
        return calls === 1
            ? reply(502, { error: { category: 'upstream_unavailable', message: 'Sahayak\'s generation service is busy. Retry in about a minute.', retryable: true } })
            : reply(200, { plan: PLAN, mcp: MCP });
    });
    render(<McpLessonPlannerDemoPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Photosynthesis')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Lesson Plan' }));
    const alert = await screen.findByTestId('mcp-error');
    expect(alert).toHaveTextContent('The lesson plan could not be generated');
    expect(alert).toHaveTextContent('generation service is busy');
    fireEvent.click(within(alert).getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText(PLAN.title)).toBeInTheDocument();
    expect(JSON.parse(postCalls()[1][1].body)).toEqual(JSON.parse(postCalls()[0][1].body));
});

it('a non-retryable error (content policy) has no retry button', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'POST'
        ? reply(422, { error: { category: 'content_policy', message: 'This request cannot be used under Sahayak\'s classroom safety policy.', retryable: false } })
        : reply(200, { configured: true, connected: true, server: MCP })));
    render(<McpLessonPlannerDemoPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Photosynthesis')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Lesson Plan' }));
    const alert = await screen.findByTestId('mcp-error');
    expect(alert).toHaveTextContent('safety policy');
    expect(within(alert).queryByRole('button')).toBeNull();
});

it('validates the form before calling MCP (no topic, no class)', async () => {
    mockSearch = new URLSearchParams();
    render(<McpLessonPlannerDemoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Lesson Plan' }));
    expect(await screen.findByText('Topic must be at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Please select a class.')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
});

it('shows "Not configured" when the server has no MCP key', async () => {
    fetchMock.mockImplementation(() => reply(200, { configured: false, connected: false }));
    render(<McpLessonPlannerDemoPage />);
    await waitFor(() => expect(within(screen.getByTestId('mcp-status')).getByText('Not configured')).toBeInTheDocument());
});

describe('form mapping (regression: Radix Select emits "" inside forms)', () => {
    const { mcpDemoFormSchema, toMcpArguments, prefillFromSearchParams } = jest.requireActual('@/features/mcp-demo/lesson-planner/mapping');
    const base = { topic: 'Photosynthesis', subject: 'Science', language: 'English' };

    it('an empty class value from the selector is a validation error, never a request', () => {
        expect(mcpDemoFormSchema.safeParse({ ...base, gradeLevels: [''] }).success).toBe(false);
        expect(mcpDemoFormSchema.safeParse({ ...base, gradeLevels: [] }).success).toBe(false);
        expect(mcpDemoFormSchema.safeParse({ ...base, gradeLevels: ['Class 7'] }).success).toBe(true);
    });

    it('maps form + options to the exact MCP arguments (General subject omitted, NCERT chapter mapped)', () => {
        expect(toMcpArguments({ ...base, subject: 'General', gradeLevels: ['Class 12'] }, {
            resourceLevel: 'high', difficultyLevel: 'advanced', useLocalContext: false,
            chapter: { number: 4, title: 'Heat', learningOutcomes: Array.from({ length: 12 }, (_, i) => `LO ${i}`) },
        })).toEqual({
            topic: 'Photosynthesis', grade: 12, language: 'English', classroom_resources: 'high', difficulty: 'advanced', use_local_context: false,
            ncert_chapter: { number: 4, title: 'Heat', learning_outcomes: Array.from({ length: 10 }, (_, i) => `LO ${i}`) },
        });
    });

    it('URL prefill accepts the demo parameters and ignores unsupported values', () => {
        expect(prefillFromSearchParams(new URLSearchParams('topic=Photosynthesis&grade=7&subject=Science&language=english&difficulty=Medium')))
            .toEqual({ topic: 'Photosynthesis', gradeLevels: ['Class 7'], subject: 'Science', language: 'English', difficulty: 'standard' });
        expect(prefillFromSearchParams(new URLSearchParams('grade=13&language=French&difficulty=expert'))).toEqual({});
    });
});
