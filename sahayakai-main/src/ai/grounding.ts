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

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\([^()]*\)/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^()]*\)/g;
const REFERENCE_DEFINITION = /^[ \t]*\[[^\]]+\]:[ \t]*\S+.*$/gm;
const REFERENCE_LINK = /\[([^\]]*)\]\[[^\]]*\]/g;
// "(see https://…)" — a whole parenthetical whose only purpose was the URL.
// Run after the markdown-link forms, so what is left inside brackets here is
// prose the sentence reads better without.
const PARENTHETICAL_WITH_URL = /[ \t]*\([^()]*https?:\/\/[^()]*\)/gi;
const AUTOLINK = /<https?:\/\/[^>\s]*>/gi;
const BARE_URL = /\bhttps?:\/\/[^\s<>()[\]"'`]+/gi;

/**
 * Strip every URL out of an ungrounded answer body, keeping the prose.
 *
 * Called only when nothing grounded the answer. In that state any link the
 * model produced is a citation it invented, and the markdown renderer would
 * present it to a teacher exactly as it presents a real one. Link labels
 * survive as plain text so the sentence still reads.
 */
export function stripSourceLinks(markdown: string): string {
    if (!markdown) return markdown;

    return markdown
        .replace(MARKDOWN_IMAGE, '$1')
        .replace(MARKDOWN_LINK, '$1')
        .replace(REFERENCE_DEFINITION, '')
        .replace(REFERENCE_LINK, '$1')
        .replace(PARENTHETICAL_WITH_URL, '')
        .replace(AUTOLINK, '')
        .replace(BARE_URL, '')
        // Tidy the holes the removals leave: "(see )", doubled spaces, a
        // space stranded before punctuation, runs of blank lines.
        .replace(/\([^\S\n]*\)/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([,.;:!?])/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** True when a body still carries a URL — the invariant the guard owes. */
export function containsUrl(text: string): boolean {
    return /https?:\/\//i.test(text);
}
