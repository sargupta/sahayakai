/**
 * @jest-environment jsdom
 *
 * The Virtual Field Trip page against every 2xx the route can actually send.
 *
 * `POST /api/ai/virtual-field-trip` answers 202 with an `{ error:
 * "still_generating" }` envelope when the dispatcher's 45s budget expires
 * while the Genkit flow keeps writing the trip to Firestore. 202 is inside
 * `res.ok`, and the page's only gate was `if (!res.ok)`, so the envelope was
 * installed as the trip and `VirtualFieldTripDisplay` blew up on
 * `trip.stops.map` — the envelope has no `stops`. The teacher's screen went
 * white on the one path where their content had in fact been saved.
 *
 * These cases hold the class, not the instance: no 2xx body reaches the
 * display without being a trip, whichever status carried it and whichever
 * path fetched it.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockToast = jest.fn();
const searchParamsGet = jest.fn(() => null);

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ requireAuth: () => true, openAuthModal: jest.fn() }),
}));

jest.mock('@/lib/firebase', () => ({
    auth: {
        currentUser: { uid: 'teacher-1', getIdToken: jest.fn().mockResolvedValue('token') },
    },
}));

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: (key: string) => searchParamsGet(key) }),
}));

jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
    toast: (...args: unknown[]) => mockToast(...args),
}));

jest.mock('@/hooks/use-network-aware', () => ({
    useNetworkAware: () => ({ canUseAI: true, aiUnavailableReason: null }),
}));

jest.mock('@/hooks/use-vidya-form-sync', () => ({
    useVidyaFormSync: () => null,
}));

jest.mock('@/store/jarvisStore', () => ({
    useJarvisStore: () => ({ clearFormSnapshot: jest.fn() }),
}));

// Selector chrome is irrelevant to the response contract and drags in
// Radix portals; the textarea and the submit button stay real.
jest.mock('@/components/microphone-input', () => ({ MicrophoneInput: () => null }));
jest.mock('@/components/example-prompts', () => ({ ExamplePrompts: () => null }));
jest.mock('@/components/language-selector', () => ({ LanguageSelector: () => null }));
jest.mock('@/components/grade-level-selector', () => ({ GradeLevelSelector: () => null }));
jest.mock('@/components/subject-selector', () => ({ SubjectSelector: () => null }));

// VirtualFieldTripDisplay is deliberately NOT mocked — it is the component
// that crashed, and mocking it would mock the bug away.
import VirtualFieldTripPage from '@/app/virtual-field-trip/page';

const TRIP = {
    title: 'Rivers of North Bengal',
    gradeLevel: 'Class 7',
    subject: 'Geography',
    stops: [
        {
            name: 'Teesta River, Jalpaiguri',
            description: 'The river that shapes the North Bengal plains.',
            educationalFact: 'It carries silt down from the Sikkim Himalaya.',
            reflectionPrompt: 'What would the plains look like without the Teesta?',
            googleEarthUrl: 'https://earth.google.com/web/search/Teesta',
            culturalAnalogy: 'Like the Ganga further south, the Teesta is a lifeline.',
            explanation: 'Introduces river systems and silt deposition.',
        },
    ],
};

/** The exact production 202 body — route.ts, VirtualFieldTripStillGeneratingError. */
const STILL_GENERATING = {
    error: 'still_generating',
    message: 'Your field trip is still generating. Check My Library in a minute.',
    budgetMs: 45000,
    elapsedMs: 45001,
};

function answerWith(body: unknown, status: number) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as unknown as typeof fetch;
}

async function generate() {
    render(<VirtualFieldTripPage />);
    const topic = await screen.findByPlaceholderText(/Harappan Civilization/i);
    fireEvent.change(topic, {
        target: { value: 'A tour of the major rivers of North Bengal' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
}

/** The trip is on screen only if a stop rendered — that is what `stops.map` draws. */
function tripIsRendered() {
    return screen.queryByText(/Teesta River, Jalpaiguri/i) !== null;
}

describe('Virtual Field Trip — a 2xx is not a promise of a trip', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        searchParamsGet.mockReturnValue(null);
    });

    it('does not render the 202 still-generating envelope as a trip', async () => {
        answerWith(STILL_GENERATING, 202);
        await generate();

        // Before the fix this never got here: setTrip({error, message, …})
        // re-rendered the display, which called `.map` on an absent `stops`.
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        await waitFor(() => expect(mockToast).toHaveBeenCalled());
        expect(tripIsRendered()).toBe(false);
    });

    it('tells the teacher the trip is still being written, and where to find it', async () => {
        answerWith(STILL_GENERATING, 202);
        await generate();

        // The route returns 202 precisely so the teacher is not told to
        // regenerate content that is already being saved. "Planning Failed"
        // would undo that and charge them twice.
        await waitFor(() =>
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({ description: STILL_GENERATING.message }),
            ),
        );
        expect(mockToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive' }),
        );
        expect(await screen.findByText(/still generating/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Library/i })).toHaveAttribute(
            'href',
            '/my-library',
        );
    });

    it('does not render a 200 that carries no stops as a trip', async () => {
        // Same class, different status: HTTP 200, plausible metadata, and not
        // the one field the display dereferences.
        answerWith({ title: 'Rivers of North Bengal', gradeLevel: 'Class 7' }, 200);
        await generate();

        await waitFor(() => expect(mockToast).toHaveBeenCalled());
        expect(tripIsRendered()).toBe(false);
    });

    it('still renders a real 200 trip', async () => {
        answerWith(TRIP, 200);
        await generate();

        expect(await screen.findByText(/Teesta River, Jalpaiguri/i)).toBeInTheDocument();
    });
});

describe('Virtual Field Trip — restoring a saved trip from ?id', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not install a saved record that has no stops', async () => {
        searchParamsGet.mockImplementation((key: string) => (key === 'id' ? 'trip-42' : null));
        // A record the sidecar path persisted before its stops were written.
        answerWith({ topic: 'Rivers', gradeLevel: 'Class 7', data: { title: 'Rivers' } }, 200);

        render(<VirtualFieldTripPage />);

        await waitFor(() => expect(mockToast).toHaveBeenCalled());
        expect(tripIsRendered()).toBe(false);
    });

    it('installs a saved record that is a real trip', async () => {
        searchParamsGet.mockImplementation((key: string) => (key === 'id' ? 'trip-42' : null));
        answerWith({ topic: 'Rivers', gradeLevel: 'Class 7', data: TRIP }, 200);

        render(<VirtualFieldTripPage />);

        expect(await screen.findByText(/Teesta River, Jalpaiguri/i)).toBeInTheDocument();
    });
});
