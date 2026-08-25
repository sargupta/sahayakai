/**
 * @jest-environment node
 *
 * Class gate: an instant answer may never show a teacher a source that
 * nothing retrieved.
 *
 * WHAT HAPPENED
 * `src/ai/tools/google-search.ts` was a hardcoded fixture — "This is the top
 * search result for your query: ${query}" linking to example.com, a Wikipedia
 * /wiki/Example page, and `youtube.com/watch?v=example` — and it was the tool
 * attached to `instantAnswerPrompt`, which is the default production path
 * (dispatcher mode `off`). The model could not tell the fixture from a real
 * retrieval, and neither could the flow above it: the fake video URL was
 * returned verbatim in `videoSuggestionUrl` and rendered to teachers as a
 * "Recommended video" button.
 *
 * WHAT THIS GATE CATCHES
 * Not "the old mock is deleted" — that is the instance. The class is: while
 * nothing grounds an answer, nothing in that answer may look like a source.
 * So the gate pins the three invariants that hold whatever a future model or
 * a future search provider does:
 *
 *   1. The search tool never returns a result it did not retrieve, and says
 *     so loudly rather than silently.
 *   2. A video suggestion survives only as a YouTube *search* — a query the
 *     teacher can run — never as a claim about a specific video.
 *   3. An ungrounded answer body carries no URL of any form, and the flow
 *      reports `grounded: false` rather than leaving it to the model to say.
 */

// The `mock` prefix is required so Jest's hoisting allows the reference
// inside the factory (same pattern as flows/voice-to-text.test.ts).
jest.mock('@/ai/genkit', () => {
    const promptFn = jest.fn();
    const promptConfigs: unknown[] = [];
    return {
        __mockPromptFn: promptFn,
        __mockPromptConfigs: promptConfigs,
        ai: {
            // Hand back the raw handlers so the test can drive the tool and
            // the flow directly without booting Genkit.
            defineTool: (_config: unknown, handler: unknown) => handler,
            defineFlow: (_config: unknown, handler: unknown) => handler,
            definePrompt: (config: unknown) => {
                promptConfigs.push(config);
                return promptFn;
            },
        },
        runResiliently: jest.fn().mockImplementation(
            async (fn: (config: unknown) => Promise<unknown>) => fn({}),
        ),
    };
});

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn().mockReturnValue('test-error-id'),
    },
}));

jest.mock('@/lib/firebase-admin', () => ({
    // Persistence is fail-soft in the flow; rejecting keeps Storage and
    // Firestore out of a unit test without changing the answer path.
    getStorageInstance: jest.fn().mockRejectedValue(new Error('no storage in tests')),
    getDb: jest.fn(),
}));

jest.mock('@/lib/usage-tracker', () => ({
    UsageTracker: { trackGemini: jest.fn(), trackGrounding: jest.fn() },
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn().mockResolvedValue(undefined),
    checkImageRateLimit: jest.fn(),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn().mockResolvedValue(null),
        saveContent: jest.fn().mockResolvedValue(undefined),
    },
}));

import {
    WEB_SEARCH_UNAVAILABLE_NOTICE,
    YOUTUBE_SEARCH_PREFIX,
    containsUrl,
    isWebSearchGrounded,
    resolveWebSearchProvider,
    sanitizeVideoSuggestionUrl,
    stripSourceLinks,
} from '@/ai/grounding';
import { googleSearch } from '@/ai/tools/google-search';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/logger';
import { StructuredLogger } from '@/lib/logger/structured-logger';

/* eslint-disable @typescript-eslint/no-require-imports */
const genkitMock = require('@/ai/genkit') as {
    __mockPromptFn: jest.Mock;
    __mockPromptConfigs: Array<{ output: { schema: { shape: Record<string, unknown> } } }>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const mockPromptFn = genkitMock.__mockPromptFn;

// The tool is registered through the mocked `ai.defineTool`, which returns
// the handler itself.
const runSearch = googleSearch as unknown as (
    input: { query: string },
) => Promise<{ searchAvailable: boolean; notice: string; results: unknown[] }>;

const ASK = {
    question: 'What is photosynthesis?',
    language: 'English',
    gradeLevel: 'Class 5',
    subject: 'Science',
    userId: 'teacher-1',
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('googleSearch tool', () => {
    it('returns no results and reports that search is unavailable', async () => {
        const out = await runSearch({ query: 'monsoon onset kerala 2026' });

        expect(out.searchAvailable).toBe(false);
        expect(out.results).toEqual([]);
    });

    it('tells the model what to do instead of inventing sources', async () => {
        const out = await runSearch({ query: 'explain gravity' });

        expect(out.notice).toBe(WEB_SEARCH_UNAVAILABLE_NOTICE);
        expect(out.notice).toMatch(/do\s+NOT cite, quote or invent/i);
    });

    it('never echoes the query back as if it were a result', async () => {
        const query = 'nalanda university history';
        const out = await runSearch({ query });

        expect(JSON.stringify(out.results)).not.toContain(query);
    });

    it('is loud: the first unavailable call in a process logs at ERROR', async () => {
        // The tool module keeps a per-process counter, and this suite has
        // already driven it above — so assert on the level split rather than
        // on a fresh first call: something is always logged, and the reason
        // always names the missing provider.
        await runSearch({ query: 'anything' });

        const levels = [
            ...(logger.error as jest.Mock).mock.calls,
            ...(logger.warn as jest.Mock).mock.calls,
        ];
        expect(levels.length).toBeGreaterThan(0);
        expect(JSON.stringify(levels)).toMatch(/WEB_SEARCH_PROVIDER/);
    });

    it('logs at ERROR on the very first call of a fresh process', async () => {
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fresh = require('@/ai/tools/google-search').googleSearch as (
                input: { query: string },
            ) => Promise<unknown>;
            return fresh({ query: 'first call' });
        });

        await Promise.resolve();
        expect((logger.error as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });
});

describe('resolveWebSearchProvider', () => {
    it('names the missing configuration when nothing is set', () => {
        const provider = resolveWebSearchProvider({} as NodeJS.ProcessEnv);

        expect(provider.kind).toBe('none');
        expect(provider.reason).toContain('WEB_SEARCH_PROVIDER');
    });

    it('refuses to pretend a configured-but-unimplemented provider works', () => {
        const provider = resolveWebSearchProvider({
            WEB_SEARCH_PROVIDER: 'programmable-search',
        } as NodeJS.ProcessEnv);

        expect(provider.kind).toBe('none');
        expect(provider.reason).toMatch(/no implementation/i);
    });

    it('reports no grounding in every environment this build ships to', () => {
        expect(isWebSearchGrounded({} as NodeJS.ProcessEnv)).toBe(false);
        expect(
            isWebSearchGrounded({ WEB_SEARCH_PROVIDER: 'anything' } as NodeJS.ProcessEnv),
        ).toBe(false);
    });
});

describe('sanitizeVideoSuggestionUrl', () => {
    // Every one of these is a claim the model cannot support. The first is
    // exactly what the old mock handed it.
    it.each([
        ['fabricated video id', 'https://www.youtube.com/watch?v=example'],
        ['plausible video id', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        ['short link', 'https://youtu.be/dQw4w9WgXcQ'],
        ['channel page', 'https://www.youtube.com/@someteacher'],
        ['placeholder search engine', 'https://example.com/search?q=photosynthesis'],
        ['placeholder article', 'https://en.wikipedia.org/wiki/Example'],
        ['insecure scheme', 'http://www.youtube.com/results?search_query=photosynthesis'],
        ['search with no query', 'https://www.youtube.com/results?search_query='],
        ['look-alike host', 'https://www.youtube.com.evil.test/results?search_query=x'],
        ['not a url at all', 'youtube dot com slash example'],
        ['empty', ''],
    ])('drops a %s', (_label, url) => {
        expect(sanitizeVideoSuggestionUrl(url)).toBeNull();
    });

    it('drops null and undefined', () => {
        expect(sanitizeVideoSuggestionUrl(null)).toBeNull();
        expect(sanitizeVideoSuggestionUrl(undefined)).toBeNull();
    });

    it('keeps a YouTube search, which is a query and not a claim', () => {
        expect(
            sanitizeVideoSuggestionUrl(
                'https://www.youtube.com/results?search_query=photosynthesis+for+class+5',
            ),
        ).toBe(`${YOUTUBE_SEARCH_PREFIX}${encodeURIComponent('photosynthesis for class 5')}`);
    });

    it('rebuilds the URL so no extra parameter rides along', () => {
        const sanitized = sanitizeVideoSuggestionUrl(
            'https://m.youtube.com/results?search_query=monsoon&utm_source=fabricated&v=example',
        );

        expect(sanitized).toBe(`${YOUTUBE_SEARCH_PREFIX}monsoon`);
        expect(sanitized).not.toMatch(/utm_source|v=example/);
    });
});

describe('stripSourceLinks', () => {
    // Bodies a model produces when it wants to look grounded, including the
    // literal links the old fixture taught it to expect.
    const FABRICATED = [
        'Photosynthesis is how plants make food. Read more at https://example.com/search?q=photosynthesis.',
        'See [the Wikipedia article](https://en.wikipedia.org/wiki/Example) for details.',
        'A good explainer: <https://www.youtube.com/watch?v=example>',
        'As described in the NCERT text[1].\n\n[1]: https://ncert.nic.in/textbook.php',
        'Diagram: ![leaf cross-section](https://example.org/leaf.png)',
        'Sources: [one][a] and [two][b].',
    ];

    it.each(FABRICATED)('leaves no URL behind in %s', (body) => {
        expect(containsUrl(stripSourceLinks(body))).toBe(false);
    });

    it('keeps the sentence readable by preserving link labels', () => {
        const stripped = stripSourceLinks(
            'See [the Wikipedia article](https://en.wikipedia.org/wiki/Example) for details.',
        );

        expect(stripped).toBe('See the Wikipedia article for details.');
    });

    it('leaves prose without links exactly as written', () => {
        const body = 'Photosynthesis happens in the chloroplasts.\n\n- Sunlight\n- Water';

        expect(stripSourceLinks(body)).toBe(body);
    });

    it('does not strand punctuation or empty brackets where a link was', () => {
        expect(stripSourceLinks('Plants use sunlight (see https://example.com/leaf).')).toBe(
            'Plants use sunlight.',
        );
    });
});

describe('instantAnswer output guard', () => {
    it('never asks the model to declare whether it was grounded', () => {
        const promptConfig = genkitMock.__mockPromptConfigs.at(-1);

        expect(promptConfig).toBeDefined();
        expect(Object.keys(promptConfig!.output.schema.shape)).not.toContain('grounded');
    });

    it('strips invented sources out of the answer and rejects a fabricated video', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer:
                    'Photosynthesis is how plants make food. ' +
                    'Read more at https://example.com/search?q=photosynthesis and ' +
                    '[this article](https://en.wikipedia.org/wiki/Example).',
                videoSuggestionUrl: 'https://www.youtube.com/watch?v=example',
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
        });

        const out = await instantAnswer(ASK);

        expect(containsUrl(out.answer)).toBe(false);
        expect(out.answer).toContain('Photosynthesis is how plants make food.');
        expect(out.videoSuggestionUrl).toBeNull();
    });

    it('reports the answer as ungrounded, from the deployment and not the model', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'Plants make food using sunlight.',
                videoSuggestionUrl: null,
                gradeLevel: 'Class 5',
                subject: 'Science',
                // A model that decides to claim grounding must not be believed.
                grounded: true,
            },
        });

        const out = await instantAnswer(ASK);

        expect(out.grounded).toBe(false);
    });

    it('keeps a properly formed YouTube search suggestion', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'Plants make food using sunlight.',
                videoSuggestionUrl:
                    'https://www.youtube.com/results?search_query=photosynthesis+for+class+5',
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
        });

        const out = await instantAnswer(ASK);

        expect(out.videoSuggestionUrl).toBe(
            `${YOUTUBE_SEARCH_PREFIX}${encodeURIComponent('photosynthesis for class 5')}`,
        );
    });

    it('logs when it drops a source, so the guard is not silent', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'Plants make food. https://example.com/leaf',
                videoSuggestionUrl: 'https://www.youtube.com/watch?v=example',
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
        });

        await instantAnswer(ASK);

        const warned = (StructuredLogger.warn as jest.Mock).mock.calls.map((call) =>
            JSON.stringify(call),
        );
        expect(warned.some((call) => /ungrounded sources/i.test(call))).toBe(true);
    });

    it('never returns a blank answer when the body was nothing but a link', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'https://example.com/photosynthesis',
                videoSuggestionUrl: null,
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
        });

        const out = await instantAnswer(ASK);

        expect(out.answer.trim().length).toBeGreaterThan(0);
        expect(containsUrl(out.answer)).toBe(false);
    });

    it('says nothing about sources when the model returns clean prose', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'Plants make food using sunlight.',
                videoSuggestionUrl: null,
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
        });

        await instantAnswer(ASK);

        const warned = (StructuredLogger.warn as jest.Mock).mock.calls.map((call) =>
            JSON.stringify(call),
        );
        expect(warned.some((call) => /ungrounded sources/i.test(call))).toBe(false);
    });
});

describe('no tool may fabricate a source (class gate)', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const TOOLS_DIR = path.resolve(__dirname, '../../ai/tools');

    function toolSources(): Array<{ file: string; source: string }> {
        return fs
            .readdirSync(TOOLS_DIR)
            .filter((file) => file.endsWith('.ts'))
            .map((file) => ({
                file,
                source: fs.readFileSync(path.join(TOOLS_DIR, file), 'utf8'),
            }));
    }

    const sources = toolSources();

    it('finds tools to check', () => {
        expect(sources.length).toBeGreaterThan(0);
    });

    // RFC 2606 / RFC 6761 reserved names and the placeholder paths the old
    // fixture used. A tool quoting any of them is inventing.
    const PLACEHOLDER = [
        /example\.(?:com|org|net|edu|invalid)/i,
        /wikipedia\.org\/wiki\/Example/i,
        /watch\?v=example/i,
    ];

    it.each(sources.map((s) => s.file))('%s quotes no placeholder source', (file) => {
        const { source } = sources.find((s) => s.file === file)!;
        const offenders = PLACEHOLDER.filter((pattern) => pattern.test(stripComments(source)));

        expect(offenders.map(String)).toEqual([]);
    });

    it.each(sources.map((s) => s.file))('%s returns no hardcoded result set', (file) => {
        const { source } = sources.find((s) => s.file === file)!;

        // `results: [{ ... }]` is a literal answer the tool did not retrieve.
        expect(stripComments(source)).not.toMatch(/results:\s*\[\s*\{/);
    });

    it.each(sources.map((s) => s.file))(
        '%s never interpolates its input into a link or a snippet',
        (file) => {
            const { source } = sources.find((s) => s.file === file)!;

            // The tell of a fixture: `link: \`...${query}...\``.
            expect(stripComments(source)).not.toMatch(
                /\b(?:link|url|href|snippet|title)\s*:\s*`[^`]*\$\{/,
            );
        },
    );

    /** Comments describe the old fixture on purpose; only code is scanned. */
    function stripComments(source: string): string {
        return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    }
});
