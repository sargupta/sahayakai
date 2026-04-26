#!/usr/bin/env tsx
/**
 * Record parent-call agent fixtures across all 11 supported languages.
 *
 * Plays 22 synthetic turns (2 turns × 11 parent languages) through the
 * production Genkit `generateAgentReply` flow and writes the
 * (input, output) pairs to
 * `sahayakai-agents/tests/fixtures/parent_call_turns.json`.
 *
 * The fixtures are the input to two downstream gates:
 *
 * 1. `sahayakai-agents/scripts/compare_parity.py` — replays the same
 *    requests through the Python sidecar and scores
 *    sidecar-vs-genkit similarity (IndicSBERT cosine + Gemini-judge).
 *    Mean parity across the 22 fixtures gates the Track D shadow ramp.
 *
 * 2. The TypeScript `parent-call-guard` unit test pins the same
 *    behavioural assertions against the recorded outputs so any prompt
 *    drift that fails the guard surfaces immediately.
 *
 * USAGE:
 *   GOOGLE_GENAI_API_KEY=... npx tsx scripts/record-parent-call-fixtures.ts
 *
 * Re-run whenever:
 *   - the shared Handlebars prompt at
 *     `sahayakai-agents/prompts/parent-call/reply.handlebars` changes
 *   - the model version changes (`SAHAYAKAI_REPLY_MODEL` env var)
 *   - we add a new supported parent language
 *
 * The output is committed to the repo. CI does NOT regenerate it on
 * every push (would burn API spend); the recorder is a one-shot
 * developer task triggered via npm script `record:fixtures`.
 *
 * Round-2 audit reference: P0 EVAL-1 (parity comparator needs real
 * fixtures, not self-comparison) and PROMPT-1 (cross-runtime byte
 * fidelity check).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';

// Manual .env load — this script runs standalone, not via Next.js
const envPath = resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        if (!process.env[k]) process.env[k] = envConfig[k];
    }
}

import {
    generateAgentReply,
    type AgentReplyInput,
    type AgentReplyOutput,
} from '@/ai/flows/parent-call-agent';

const SUPPORTED_LANGUAGES = [
    'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'pa', 'ml', 'or',
] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const OUTPUT_PATH = resolve(
    process.cwd(),
    '..',
    'sahayakai-agents',
    'tests',
    'fixtures',
    'parent_call_turns.json',
);

interface ScenarioTurn {
    /** What the parent says on this turn (English baseline; the model is
     *  instructed to reply in `parentLanguage` regardless). */
    parentSpeech: string;
    /** Transcript prior to this turn — empty for turn 1. */
    transcriptBeforeTurn: Array<{ role: 'agent' | 'parent'; text: string }>;
}

/**
 * A two-turn scenario: parent picks up + responds neutrally, then asks
 * a concrete question. Same shape across all 11 languages so the
 * fixtures exercise the prompt's `{{#if}}` and `{{#each}}` blocks
 * without language-specific variation. The MODEL is what produces the
 * language-specific reply via the `parentLanguage` directive.
 */
const TWO_TURN_SCENARIO: [ScenarioTurn, ScenarioTurn] = [
    {
        parentSpeech: 'Yes, I am listening. Please tell me.',
        transcriptBeforeTurn: [],
    },
    {
        parentSpeech: 'Thank you. Can you tell me how I can help my child at home?',
        transcriptBeforeTurn: [
            { role: 'parent', text: 'Yes, I am listening. Please tell me.' },
            // The agent's turn-1 reply is filled in at runtime from the
            // recorded turn-1 output (so turn 2's transcript reflects
            // what the model actually said on turn 1, not a hard-coded
            // approximation that could drift from prompt edits).
            { role: 'agent', text: '__PLACEHOLDER_TURN_1_REPLY__' },
        ],
    },
];

const BASE_INPUT: Omit<AgentReplyInput, 'parentLanguage' | 'transcript' | 'parentSpeech' | 'turnNumber'> = {
    studentName: 'Arav',
    className: 'Class 5',
    subject: 'Science',
    reason: 'Academic progress check-in',
    teacherMessage:
        'Arav has been doing well in science but missed two homework submissions this week. We wanted to make sure everything is OK at home and offer support.',
    teacherName: 'Mrs. Sharma',
    schoolName: 'Sunrise Public School',
    performanceSummary: 'Science: 18/25, Math: 21/25, English: 22/25 · overall 82%',
};

interface RecordedFixture {
    fixtureId: string;
    parentLanguage: SupportedLanguage;
    turnNumber: number;
    request: AgentReplyInput;
    /** What Genkit returned. The Python sidecar's parity comparator
     *  compares its own output against this baseline. */
    wrappedOutput: AgentReplyOutput;
    /** When this fixture was recorded — for staleness tracking. */
    recordedAt: string;
}

async function recordOneTurn(
    parentLanguage: SupportedLanguage,
    turnNumber: 1 | 2,
    transcript: Array<{ role: 'agent' | 'parent'; text: string }>,
    parentSpeech: string,
): Promise<RecordedFixture> {
    const request: AgentReplyInput = {
        ...BASE_INPUT,
        parentLanguage,
        transcript,
        parentSpeech,
        turnNumber,
    };

    process.stdout.write(`  turn ${turnNumber} (${parentLanguage})… `);
    const wrappedOutput = await generateAgentReply(request);
    process.stdout.write('ok\n');

    return {
        fixtureId: `${parentLanguage}_turn${turnNumber}`,
        parentLanguage,
        turnNumber,
        request,
        wrappedOutput,
        recordedAt: new Date().toISOString(),
    };
}

async function recordAll(): Promise<RecordedFixture[]> {
    const fixtures: RecordedFixture[] = [];

    for (const lang of SUPPORTED_LANGUAGES) {
        console.log(`\n[${lang}] recording 2-turn scenario`);

        // Turn 1 — empty transcript, neutral parent ack.
        const turn1 = await recordOneTurn(
            lang,
            1,
            TWO_TURN_SCENARIO[0].transcriptBeforeTurn,
            TWO_TURN_SCENARIO[0].parentSpeech,
        );
        fixtures.push(turn1);

        // Turn 2 — transcript reflects turn 1's actual reply, then the
        // parent asks a concrete question that triggers the
        // pedagogical-guidance branch in the prompt.
        const turn2Transcript: Array<{ role: 'agent' | 'parent'; text: string }> = [
            { role: 'parent', text: TWO_TURN_SCENARIO[0].parentSpeech },
            { role: 'agent', text: turn1.wrappedOutput.reply },
        ];
        const turn2 = await recordOneTurn(
            lang,
            2,
            turn2Transcript,
            TWO_TURN_SCENARIO[1].parentSpeech,
        );
        fixtures.push(turn2);
    }

    return fixtures;
}

async function main(): Promise<void> {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        console.error(
            '\nError: GOOGLE_GENAI_API_KEY is not set.\n' +
                'Set it in your shell, in `.env.local`, or pass it inline:\n' +
                '  GOOGLE_GENAI_API_KEY=... npx tsx scripts/record-parent-call-fixtures.ts\n',
        );
        process.exit(1);
    }

    console.log(
        `Recording 22 fixtures (${SUPPORTED_LANGUAGES.length} languages × 2 turns).\n` +
            `Output → ${OUTPUT_PATH}\n` +
            `This will make ~22 Gemini calls. Estimated cost: ~$0.05.`,
    );

    const fixtures = await recordAll();

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(fixtures, null, 2) + '\n',
        'utf8',
    );

    console.log(
        `\n✓ wrote ${fixtures.length} fixtures to ${OUTPUT_PATH}\n` +
            `Next step: run sahayakai-agents/scripts/compare_parity.py once the ` +
            `real sidecar replay path lands (P0 EVAL-1).`,
    );
}

main().catch((err) => {
    console.error('\nFixture recorder failed:', err);
    process.exit(1);
});
