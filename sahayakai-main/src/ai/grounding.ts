/**
 * @fileOverview Grounding status and citation guard for teacher-facing answers.
 *
 * One rule, expressed twice: nothing reaches a teacher as a source unless a
 * real search backend actually returned it.
 *
 *  - `resolveWebSearchProvider()` says which web-search backend this
 *    deployment has. There is none, and saying so out loud is the point —
 *    the previous `googleSearch` tool answered the same question with an
 *    invented result set, so the flow above it had no way to tell retrieval
 *    from fabrication.
 *  - `sanitizeVideoSuggestionUrl()` and `stripSourceLinks()` enforce the
 *    consequence: an answer nothing grounded carries no links, and the only
 *    video URL that survives is a YouTube *search*, which is a query the
 *    teacher can run rather than a claim about a specific source.
 *
 * Pure and dependency-free on purpose — the flow, the tool and the tests all
 * import it, and none of them should have to boot Genkit to ask whether this
 * build can search the web.
 */

/**
 * The web-search backend available to this deployment.
 *
 * Only `none` exists today. A future provider adds its own variant here
 * along with the client that serves it; until then every caller gets a
 * reason string rather than silence.
 */
export type WebSearchProvider = {
    kind: 'none';
    /** Operator-facing explanation, logged and surfaced in the tool notice. */
    reason: string;
};

/**
 * Handed back to the model in place of results. It is deliberately an
 * instruction and not just a status: a model told only "no results" will
 * happily supply its own.
 */
export const WEB_SEARCH_UNAVAILABLE_NOTICE =
    'Web search is unavailable in this deployment. No results were retrieved. ' +
    'Answer from your own knowledge, say plainly when you are unsure, and do ' +
    'NOT cite, quote or invent any source, link, URL or reference.';

export function resolveWebSearchProvider(
    env: NodeJS.ProcessEnv = process.env,
): WebSearchProvider {
    const configured = (env.WEB_SEARCH_PROVIDER ?? '').trim();

    if (!configured) {
        return {
            kind: 'none',
            reason:
                'WEB_SEARCH_PROVIDER is unset — no web-search backend is wired to this deployment',
        };
    }

    // An operator who sets the variable has asked for grounding, and must not
    // get a silent downgrade into ungrounded answers that look grounded.
    return {
        kind: 'none',
        reason: `WEB_SEARCH_PROVIDER='${configured}' has no implementation in this build — nothing can answer a search`,
    };
}

/**
 * Whether an answer produced by the Genkit path can have been grounded in a
 * retrieved source. False whenever no backend exists, which is every
 * environment today.
 *
 * A future provider must not simply flip this to `true`: "a backend exists"
 * is not "this answer used it". Wiring one means recording per call whether
 * the tool actually returned results, and reporting that instead.
 */
export function isWebSearchGrounded(env: NodeJS.ProcessEnv = process.env): boolean {
    return resolveWebSearchProvider(env).kind !== 'none';
}

/** The only video URL shape the instant-answer prompt is allowed to emit. */
export const YOUTUBE_SEARCH_PREFIX = 'https://www.youtube.com/results?search_query=';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/**
 * Reduce a model-supplied video URL to a YouTube search, or drop it.
 *
 * A specific video id is a claim that a particular video exists and is
 * relevant, and the model can check neither — `watch?v=example`, which the
 * old mock fed it verbatim, reached teachers as a "Recommended video" button
 * onto a dead page. A search URL makes no claim beyond the query it carries.
 */
export function sanitizeVideoSuggestionUrl(
    raw: string | null | undefined,
): string | null {
    if (!raw) return null;

    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return null;
    }

    if (parsed.protocol !== 'https:') return null;
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (parsed.pathname.replace(/\/+$/, '') !== '/results') return null;

    const query = (parsed.searchParams.get('search_query') ?? '').trim();
    if (!query) return null;

    // Rebuilt rather than passed through, so no extra parameter rides along.
    return `${YOUTUBE_SEARCH_PREFIX}${encodeURIComponent(query)}`;
}

// A link target counts as a source when the teacher's markdown view would
// really render it as one. "Carries a scheme" is too small a bar for that:
// CommonMark links a bare host, a protocol-relative `//host` and a
// root-relative `/path` exactly as readily as `https://`, so
// `[NCERT](ncert.nic.in/textbook/pdf/hesc106.pdf)` survived the guard and
// reached the teacher as a clickable citation of a source nothing retrieved.
//
// The bar that does hold is "looks like a host or a path", which is still what
// separates a citation from prose that happens to put a bracket beside a
// paren. The target in `arr[i](x)` and `Ca[OH](aq)` is a bare word with no dot
// and no slash, so it is neither, and those stay whole.
const URL_SCHEME = String.raw`(?:[a-z][a-z0-9+.\-]*:\/\/|mailto:)`;
// `/path` and `//host/path`, plus the `./` and `../` spellings of the same.
const TARGET_PATH = String.raw`\.{0,2}\/`;
// `example.com`, `ncert.nic.in`, `www.youtube.com`. The trailing run of two or
// more letters is the part that keeps `1.5`, `e.g` and `i.e.` out.
const TARGET_HOST = String.raw`[a-z0-9_\-]+(?:\.[a-z0-9_\-]+)*\.[a-z]{2,}`;
const LINK_TARGET = String.raw`(?:${URL_SCHEME}|www\.|${TARGET_PATH}|${TARGET_HOST})`;
const LINK_TARGET_URL = String.raw`\s*<?${LINK_TARGET}[^()]*`;

const MARKDOWN_IMAGE = new RegExp(String.raw`!\[([^\]]*)\]\(${LINK_TARGET_URL}\)`, 'gi');
const MARKDOWN_LINK = new RegExp(String.raw`\[([^\]]*)\]\(${LINK_TARGET_URL}\)`, 'gi');
// `[1]: ncert.nic.in/ch6` is a footnote a renderer resolves into an anchor on
// the `[1]` above it, so it is a citation in exactly the way an inline link is.
const REFERENCE_DEFINITION = new RegExp(
    String.raw`^[ \t]*\[[^\]]+\]:[ \t]*<?${LINK_TARGET}\S*.*$`,
    'gim',
);
const REFERENCE_LINK = /\[([^\]]*)\]\[[^\]]*\]/g;
// "(see https://…)" — a whole parenthetical whose only purpose was the URL.
// Run after the markdown-link forms, so what is left inside brackets here is
// prose the sentence reads better without.
const PARENTHETICAL_WITH_URL = /[ \t]*\([^()]*https?:\/\/[^()]*\)/gi;
const AUTOLINK = /<https?:\/\/[^>\s]*>/gi;
const BARE_URL = /\bhttps?:\/\/[^\s<>()[\]"'`]+/gi;

/**
 * Applied to every region, code included: an invented URL is invented
 * wherever it sits. Nothing else is rewritten inside code — see
 * `stripSourceLinks`.
 */
function stripUrls(text: string): string {
    return text.replace(AUTOLINK, '').replace(BARE_URL, '');
}

/** The link shapes that only mean "source" in prose. */
function stripLinkForms(text: string): string {
    return stripUrls(
        text
            .replace(MARKDOWN_IMAGE, '$1')
            .replace(MARKDOWN_LINK, '$1')
            .replace(REFERENCE_DEFINITION, '')
            .replace(REFERENCE_LINK, '$1')
            .replace(PARENTHETICAL_WITH_URL, ''),
    );
}

/**
 * Close the hole a removal left: "(see )", a doubled space, a space stranded
 * before punctuation, a run of blank lines.
 *
 * Every pass here is anchored to preceding visible text. Leading whitespace is
 * markdown structure — two spaces are what make a nested list nested, four are
 * what make a block code — so a tidy-up that collapses it silently reflows the
 * answer it was only supposed to clean up after.
 */
function tidyAfterRemoval(text: string): string {
    return text
        .replace(/\([^\S\n]*\)/g, '')
        .replace(/(\S)[ \t]{2,}/g, '$1 ')
        .replace(/(\S)[ \t]+([,.;:!?])/g, '$1$2')
        .replace(/\n{3,}/g, '\n\n');
}

type Segment = { code: boolean; text: string };

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const INDENTED_CODE = /^(?: {4}|\t)/;
const INLINE_CODE = /(`+)(?:(?!\1)[\s\S])*?\1/g;

/**
 * Which lines belong to a code block — fenced (``` or ~~~) or indented by four
 * spaces after a blank line, which is the other way CommonMark makes a block
 * code. Blank lines inside an indented run stay with it.
 */
function markCodeLines(lines: string[]): boolean[] {
    const isCode = lines.map(() => false);
    let fence: string | null = null;
    let indentedRun = false;
    let pendingBlanks: number[] = [];

    lines.forEach((line, i) => {
        if (fence) {
            isCode[i] = true;
            const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
            if (close.test(line)) fence = null;
            return;
        }

        const opened = FENCE_OPEN.exec(line);
        if (opened) {
            fence = opened[1];
            isCode[i] = true;
            indentedRun = false;
            pendingBlanks = [];
            return;
        }

        if (line.trim() === '') {
            // Provisional: these belong to the run only if it continues.
            if (indentedRun) pendingBlanks.push(i);
            return;
        }

        // An indented line that interrupts a paragraph, or continues a list
        // item, is not a code block — so a run may only start after a blank.
        if (INDENTED_CODE.test(line) && (indentedRun || i === 0 || lines[i - 1].trim() === '')) {
            pendingBlanks.forEach((blank) => {
                isCode[blank] = true;
            });
            pendingBlanks = [];
            isCode[i] = true;
            indentedRun = true;
            return;
        }

        indentedRun = false;
        pendingBlanks = [];
    });

    return isCode;
}

/** Inline spans, so `arr[i][j]` is read as code a teacher typed. */
function splitInlineCode(text: string): Segment[] {
    const segments: Segment[] = [];
    let cursor = 0;

    INLINE_CODE.lastIndex = 0;
    let match: RegExpExecArray | null = INLINE_CODE.exec(text);
    while (match !== null) {
        if (match.index > cursor) {
            segments.push({ code: false, text: text.slice(cursor, match.index) });
        }
        segments.push({ code: true, text: match[0] });
        cursor = match.index + match[0].length;
        match = INLINE_CODE.exec(text);
    }

    if (cursor < text.length) segments.push({ code: false, text: text.slice(cursor) });
    return segments.length > 0 ? segments : [{ code: false, text }];
}

/** The body cut into code and prose runs; concatenating them restores it byte for byte. */
function splitCodeRegions(markdown: string): Segment[] {
    const lines = markdown.split('\n');
    const isCode = markCodeLines(lines);
    const blocks: Segment[] = [];

    let start = 0;
    for (let i = 1; i <= lines.length; i += 1) {
        if (i === lines.length || isCode[i] !== isCode[start]) {
            const body = lines.slice(start, i).join('\n');
            blocks.push({
                code: isCode[start],
                // The newline that separated this run from the next belongs to
                // it, so `join('')` is lossless.
                text: i === lines.length ? body : `${body}\n`,
            });
            start = i;
        }
    }

    return blocks.flatMap((block) => (block.code ? [block] : splitInlineCode(block.text)));
}

/**
 * Strip every URL out of an ungrounded answer body, keeping the prose.
 *
 * Called only when nothing grounded the answer. In that state any link the
 * model produced is a citation it invented, and the markdown renderer would
 * present it to a teacher exactly as it presents a real one. Link labels
 * survive as plain text so the sentence still reads.
 *
 * Two things bound how far it may reach, because `grounded` is false in every
 * environment this build ships to — so this runs over *every* answer the
 * Genkit path produces, cited or not:
 *
 *  - Code is left alone apart from URLs. Inside a fence, an indented block or
 *    a backtick span every space is load-bearing, and `[i][j]` is an index and
 *    not a reference link.
 *  - The tidy-up passes only touch a region a removal actually happened in. An
 *    answer that never cited anything comes back byte for byte as written.
 */
export function stripSourceLinks(markdown: string): string {
    if (!markdown) return markdown;

    const segments = splitCodeRegions(markdown);
    let removedSomething = false;

    const rebuilt = segments.map((segment) => {
        const stripped = segment.code ? stripUrls(segment.text) : stripLinkForms(segment.text);
        if (stripped === segment.text) return segment.text;

        removedSomething = true;
        return segment.code ? stripped : tidyAfterRemoval(stripped);
    });

    if (!removedSomething) return markdown;

    return rebuilt.join('').trim();
}

/**
 * Every shape that still reaches the teacher as an anchor: a URL standing on
 * its own, an inline link or image, and a reference definition.
 */
const RENDERABLE_LINK = new RegExp(
    [
        URL_SCHEME,
        String.raw`\[[^\]]*\]\(${LINK_TARGET_URL}\)`,
        String.raw`^[ \t]*\[[^\]]+\]:[ \t]*<?${LINK_TARGET}`,
    ].join('|'),
    'im',
);

/**
 * True when a body still carries a link — the invariant the guard owes.
 *
 * It has to ask the same question the guard asks, or it certifies bodies the
 * guard never cleaned. Asking only for `https?://` is how a bare-host citation
 * came to render as an anchor with every test above it still green: nothing
 * here can pass while a link the renderer will draw is still in the answer.
 */
export function containsUrl(text: string): boolean {
    return RENDERABLE_LINK.test(text);
}
