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
 *   4. The guard costs nothing it did not have to. `grounded` is false in
 *      every environment, so the strip runs over every answer: one that cited
 *      nothing comes back byte for byte, code and list nesting included, and
 *      no billable grounding call is counted for a retrieval that never ran.
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
import { UsageTracker } from '@/lib/usage-tracker';

/* eslint-disable @typescript-eslint/no-require-imports */
const genkitMock = require('@/ai/genkit') as {
    __mockPromptFn: jest.Mock;
    __mockPromptConfigs: Array<{
        prompt: string;
        output: { schema: { shape: Record<string, unknown> } };
    }>;
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

    // A target does not need a scheme to become an anchor. CommonMark links a
    // bare host, `//host`, `/path` and a `[1]: target` footnote exactly as it
    // links `https://`, and react-markdown draws every one of them for the
    // teacher. While the guard asked for `://` these survived, and because
    // `containsUrl` asked only for `https?://` the invariant above them stayed
    // green the whole time — so each is pinned here twice: stripped, and
    // reported as a link while it is still there.
    const RENDERABLE_TARGETS: Array<[string, string, string]> = [
        [
            'a bare host',
            'Read the chapter at [NCERT](ncert.nic.in/textbook/pdf/hesc106.pdf) for more.',
            'Read the chapter at NCERT for more.',
        ],
        [
            'a reference-style footnote',
            'Plants use sunlight[1].\n\n[1]: ncert.nic.in/ch6',
            'Plants use sunlight[1].',
        ],
        ['a root-relative path', 'See [Chapter 6](/textbook/ch6).', 'See Chapter 6.'],
        ['a protocol-relative host', 'See [source](//example.com/a).', 'See source.'],
        [
            'a bare host carrying a path',
            'See [this page](example.com/photosynthesis).',
            'See this page.',
        ],
    ];

    it.each(RENDERABLE_TARGETS)('strips %s', (_label, body, expected) => {
        const stripped = stripSourceLinks(body);

        expect(stripped).toBe(expected);
        expect(containsUrl(stripped)).toBe(false);
    });

    it.each(RENDERABLE_TARGETS)('reports %s as a link before it is stripped', (_label, body) => {
        expect(containsUrl(body)).toBe(true);
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

    // `grounded` is false in every environment, so this function sees every
    // answer the Genkit path produces — almost all of which cite nothing. An
    // answer with no source in it must come back byte for byte: the tidy-up
    // passes exist to close a hole a removal left, and with no removal there
    // is no hole. Each body below is one the guard used to damage.
    const UNTOUCHED: Array<[string, string]> = [
        [
            'a fenced code block',
            'Here is the loop:\n\n```python\nfor i in range(3):\n    if i:\n' +
                '        print(i)\n    else:\n        pass\n```\n\nThat prints 1 and 2.',
        ],
        // CommonMark needs two spaces to nest; collapsing them made the child
        // a sibling.
        ['a nested list', 'Plants need:\n\n- Sunlight\n  - From the sun\n- Water'],
        ['an indented code block', 'Example:\n\n    def f():\n        return 1\n\nDone.'],
        // `](` is not a link unless what follows it is a URL.
        ['an array index beside a call', 'Use arr[i](x) to call.'],
        ['a chemical formula', 'Ca[OH](aq) dissolves.'],
        ['empty parentheses in link-free prose', 'Area = ( ) is empty'],
        // A tab is the other spelling of an indented block, and a table is all
        // structural whitespace.
        ['a tab-indented code block', 'Example:\n\n\tdef f():\n\t\treturn 1\n\nDone.'],
        [
            'a markdown table',
            'Key terms:\n\n| Term | Meaning |\n| --- | --- |\n' +
                '| Photosynthesis | Food from light |\n',
        ],
        // The other side of the widened test: a unit and a decimal look like
        // neither a host nor a path, so they are not targets either.
        ['a unit in parentheses', 'Speed [v](m/s) is measured.'],
        ['a decimal in parentheses', 'Value [x](1.5) here.'],
        [
            'a Bengali answer carrying both',
            'সালোকসংশ্লেষ কীভাবে হয়:\n\n- সূর্যালোক\n  - সূর্য থেকে আসে\n- জল\n\n' +
                '```python\nfor i in range(3):\n    print(i)\n```',
        ],
    ];

    it.each(UNTOUCHED)('leaves %s byte for byte', (_label, body) => {
        expect(stripSourceLinks(body)).toBe(body);
    });

    it('keeps a list nested when a link elsewhere in the answer is stripped', () => {
        const body =
            'Plants need, per [the NCERT text](https://en.wikipedia.org/wiki/Example):\n\n' +
            '- Sunlight\n  - From the sun\n- Water';

        const stripped = stripSourceLinks(body);

        expect(containsUrl(stripped)).toBe(false);
        expect(stripped).toBe(
            'Plants need, per the NCERT text:\n\n- Sunlight\n  - From the sun\n- Water',
        );
    });

    it('keeps a fenced code block intact when a link elsewhere is stripped', () => {
        const code =
            '```python\nfor i in range(3):\n    if i:\n        print(i)\n' +
            '    else:\n        pass\n```';
        const stripped = stripSourceLinks(`Read more at https://example.com/loops.\n\n${code}`);

        expect(containsUrl(stripped)).toBe(false);
        expect(stripped).toContain(code);
    });

    it('strips an invented Bengali citation without reflowing the list beneath it', () => {
        const body =
            'সালোকসংশ্লেষ কীভাবে হয়, আরও পড়ুন [এখানে](https://example.com/bn)।\n\n' +
            '- সূর্যালোক\n  - সূর্য থেকে আসে\n- জল';

        const stripped = stripSourceLinks(body);

        expect(containsUrl(stripped)).toBe(false);
        expect(stripped).toBe(body.replace('[এখানে](https://example.com/bn)', 'এখানে'));
    });

    it('does not read an index in a code span as a reference link', () => {
        const stripped = stripSourceLinks('Use `arr[i][j]`, not https://example.com/arrays.');

        expect(stripped).toContain('`arr[i][j]`');
        expect(containsUrl(stripped)).toBe(false);
    });

    // The trade the guard makes: an invented URL is invented wherever it sits,
    // including inside a fence, so it still goes — but nothing else in there
    // is touched.
    it('still removes a URL from inside code, and removes only the URL', () => {
        const stripped = stripSourceLinks(
            '```python\nimport requests\n\nresp = requests.get("https://example.com/api")\n' +
                'print(resp)\n```',
        );

        expect(containsUrl(stripped)).toBe(false);
        expect(stripped).toContain('resp = requests.get("")');
        expect(stripped).toContain('import requests');
        expect(stripped).toContain('print(resp)');
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

    it('hands back a code sample exactly as the model wrote it', async () => {
        const answer =
            'Here is the loop:\n\n```python\nfor i in range(3):\n    if i:\n        print(i)\n' +
            '    else:\n        pass\n```\n\nThat prints 1 and 2.';
        mockPromptFn.mockResolvedValue({
            output: { answer, videoSuggestionUrl: null, gradeLevel: 'Class 8', subject: 'Computer Science' },
        });

        const out = await instantAnswer(ASK);

        expect(out.answer).toBe(answer);
    });

    it('counts no grounding call, because no retrieval happens on this path', async () => {
        mockPromptFn.mockResolvedValue({
            output: {
                answer: 'Plants make food using sunlight.',
                videoSuggestionUrl: null,
                gradeLevel: 'Class 5',
                subject: 'Science',
            },
            usage: { totalTokens: 120 },
        });

        await instantAnswer(ASK);

        // The model call is still billed; the retrieval that never ran is not.
        expect(UsageTracker.trackGemini).toHaveBeenCalled();
        expect(UsageTracker.trackGrounding).not.toHaveBeenCalled();
    });

    it('tells the model what an unavailable search means, in the prompt that ships', () => {
        const promptConfig = genkitMock.__mockPromptConfigs.at(-1);

        expect(promptConfig?.prompt).toMatch(/searchAvailable/);
        expect(promptConfig?.prompt).toMatch(/No Invented Sources/i);
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

describe('no prompt file may promise a search that cannot happen (class gate)', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const PROMPT_DIR = path.resolve(__dirname, '../../ai/prompts');

    const promptFiles = fs
        .readdirSync(PROMPT_DIR)
        .filter((file) => file.endsWith('.prompt'))
        .map((file) => ({
            file,
            source: fs.readFileSync(path.join(PROMPT_DIR, file), 'utf8'),
        }));

    it('finds prompt files to check', () => {
        expect(promptFiles.length).toBeGreaterThan(0);
    });

    // `promptDir` is commented out in src/ai/genkit.ts, so these files are not
    // loaded and a stale one changes no behaviour — it is just the copy the
    // next flow is written from. A file that still describes `googleSearch` as
    // a working search is that copy.
    it('every prompt offering googleSearch also says what to do when it returns nothing', () => {
        const stale = promptFiles
            .filter(({ source }) => /googleSearch/.test(source))
            .filter(
                ({ source }) =>
                    !/searchAvailable/.test(source) || !/No Invented Sources/i.test(source),
            )
            .map(({ file }) => file);

        expect(stale).toEqual([]);
    });
});
