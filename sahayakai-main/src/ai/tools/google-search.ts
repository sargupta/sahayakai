'use server';
/**
 * @fileOverview The web-search tool offered to teacher-facing flows.
 *
 * This tool used to return a hardcoded fixture — "This is the top search
 * result for your query: ${query}" pointing at example.com, a Wikipedia
 * /wiki/Example page and a `watch?v=example` video — and it was attached to
 * `instantAnswerPrompt`, which is the default production path. The model
 * received invented sources indistinguishable from retrieved ones and passed
 * them on to teachers as grounding.
 *
 * It now reports what it can actually do. No backend is wired to any
 * environment, so every call returns `searchAvailable: false` with zero
 * results and an instruction not to fill the gap by invention. Wiring a real
 * provider is a new variant in `@/ai/grounding` plus its client; the fixture
 * is gone so no flag or environment can bring it back.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  WEB_SEARCH_UNAVAILABLE_NOTICE,
  resolveWebSearchProvider,
} from '@/ai/grounding';

// One ERROR per process, WARN for the rest. The first line is what pages an
// operator (and reaches Sentry outside development); repeating it on every
// question would bury the signal in its own noise.
let unavailableCalls = 0;

export const googleSearch = ai.defineTool(
  {
    name: 'googleSearch',
    description:
      'Searches the web for up-to-date information. May report that search is unavailable, in which case it returns NO results and you must answer without citing any source.',
    inputSchema: z.object({
      query: z.string().describe('The search query.'),
    }),
    outputSchema: z.object({
      searchAvailable: z
        .boolean()
        .describe('True only when a real search backend answered this query.'),
      notice: z
        .string()
        .describe('What to do when searchAvailable is false. Follow it exactly.'),
      results: z.array(z.object({
        title: z.string(),
        link: z.string(),
        snippet: z.string(),
      })).describe('Retrieved results. Empty whenever searchAvailable is false.'),
    }),
  },
  async ({ query }) => {
    const provider = resolveWebSearchProvider();

    // `none` is the only provider that exists. When a real one lands, branch
    // here and return its results — never synthesise them.
    unavailableCalls += 1;
    const detail = {
      provider: provider.kind,
      reason: provider.reason,
      queryLength: query.length,
      callsThisProcess: unavailableCalls,
    };

    if (unavailableCalls === 1) {
      logger.error(
        'Web search is unavailable — instant answers are ungrounded',
        undefined,
        'GoogleSearch',
        detail,
      );
    } else {
      logger.warn(
        'Web search is unavailable — answering without retrieval',
        'GoogleSearch',
        detail,
      );
    }

    return {
      searchAvailable: false,
      notice: WEB_SEARCH_UNAVAILABLE_NOTICE,
      results: [],
    };
  }
);
