/**
 * VIDYA assistant Genkit flow.
 *
 * Extracted from `/api/assistant/route.ts` so the Phase-5 dispatcher
 * can run the Genkit path through a single function reference instead
 * of duplicating the prompt + parsing logic.
 *
 * The existing route's L1 (in-process Map) + L2 (Firestore) cache
 * stays in the route — the cache wraps the dispatcher, not the Genkit
 * function. That way:
 *
 *  - Cache hit → no Genkit call AND no sidecar call (saves both paths
 *    money).
 *  - Cache miss → dispatcher runs once → cache write → return.
 *
 * Phase 5 §5.7 / §5.8.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { SAHAYAK_SOUL_PROMPT } from '@/ai/soul';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AssistantChatHistoryEntry {
    /** Genkit-style. */
    role?: 'user' | 'model';
    parts?: Array<{ text: string }>;
    /** VoiceAssistant-style. */
    user?: string;
    ai?: string;
    lang?: string;
}

export interface AssistantTeacherProfile {
    preferredGrade?: string | null;
    preferredSubject?: string | null;
    preferredLanguage?: string | null;
    schoolContext?: string | null;
}

export interface AssistantScreenContext {
    path?: string | null;
    uiState?: Record<string, unknown> | null;
}

export interface AssistantInput {
    message: string;
    chatHistory?: AssistantChatHistoryEntry[];
    currentScreenContext?: AssistantScreenContext | null;
    teacherProfile?: AssistantTeacherProfile | null;
    /** BCP-47 like 'en-IN' / 'hi-IN'. Optional. */
    detectedLanguage?: string | null;
}

export type AssistantAction =
    | { type: 'NAVIGATE_AND_FILL'; flow: string; params?: Record<string, unknown> }
    | { type: string; [key: string]: unknown };

/**
 * Phase N.1 — typed planned-action queue mirrors the Python sidecar's
 * `VidyaAction` (sahayakai-agents/.../vidya/schemas.py).
 *
 * Each entry is an ordered NAVIGATE_AND_FILL the orchestrator authored
 * for a compound request. The first entry mirrors the legacy `action`
 * field for backward compat; the remainder are the queue of follow-ups
 * the OmniOrb client renders as one-tap chips. Empty / undefined for
 * single-step / instantAnswer / unknown paths. Bounded at 3 entries
 * (matches the sidecar wire schema and the Genkit `agentRouterFlow`).
 */
export interface VidyaPlannedActionParams {
    topic?: string | null;
    gradeLevel?: string | null;
    subject?: string | null;
    language?: string | null;
    ncertChapter?: {
        number: number;
        title: string;
        learningOutcomes?: string[];
    } | null;
    /** Index pointers (max 2) into earlier `plannedActions` entries. */
    dependsOn?: number[];
}

export interface VidyaPlannedAction {
    type: 'NAVIGATE_AND_FILL';
    flow: string;
    params: VidyaPlannedActionParams;
}

export interface AssistantOutput {
    response: string;
    action: AssistantAction | null;
    /**
     * Phase N.1 — typed planned-action queue. Replaces Phase G's
     * `followUpSuggestion: string | null`. Optional for backward
     * compat: the dispatcher's `genkitToDispatched` may still synthesise
     * the legacy single-action shape until δ's wire migration lands.
     */
    plannedActions?: VidyaPlannedAction[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildSystemPrompt(input: AssistantInput): string {
    const profileContext = (() => {
        const tp = input.teacherProfile;
        if (!tp) return '';
        const parts: string[] = [];
        if (tp.preferredGrade) parts.push(`Preferred class: ${tp.preferredGrade}`);
        if (tp.preferredSubject) parts.push(`Preferred subject: ${tp.preferredSubject}`);
        if (tp.preferredLanguage) parts.push(`Preferred language: ${tp.preferredLanguage}`);
        if (tp.schoolContext) parts.push(`School context: ${tp.schoolContext}`);
        if (parts.length === 0) return '';
        return `\nTeacher Profile (long-term memory):\n${parts.join('\n')}`;
    })();

    // Language resolution mirrors the previous route logic exactly:
    // 1. Explicit detectedLanguage if set
    // 2. Most recent chatHistory entry with `lang`
    // 3. SOUL fallback (English)
    let resolvedLanguage: string | null = input.detectedLanguage ?? null;
    if (!resolvedLanguage && input.chatHistory) {
        for (let i = input.chatHistory.length - 1; i >= 0; i--) {
            const entry = input.chatHistory[i];
            if (entry?.lang && typeof entry.lang === 'string') {
                resolvedLanguage = entry.lang;
                break;
            }
        }
    }
    const languageInstruction = resolvedLanguage
        ? `\nResolved conversation language: "${resolvedLanguage}". You MUST respond in this language and set action.params.language to "${resolvedLanguage}" on every tool-call. Do not switch languages mid-reply unless the teacher explicitly asks.`
        : `\nNo language signal detected yet — respond in English ("en") and set action.params.language to "en".`;

    const screen = input.currentScreenContext;
    return `${SAHAYAK_SOUL_PROMPT}

CRITICAL CONTEXT INJECTION:
Current User Screen path: ${screen?.path || 'unknown'}
Active form fields (what the teacher is currently working on): ${JSON.stringify(screen?.uiState || {})}${profileContext}${languageInstruction}
    `;
}

function buildChatContext(history: AssistantChatHistoryEntry[] | undefined): string {
    if (!history || history.length === 0) return '';
    return history
        .flatMap((msg) => {
            const lines: string[] = [];
            if (msg.role && msg.parts) {
                const text = msg.parts.map((p) => p.text).join('');
                if (text.trim()) lines.push(`${msg.role}: ${text}`);
            }
            const langTag = msg.lang ? `[lang=${msg.lang}] ` : '';
            if (msg.user?.trim()) lines.push(`user: ${langTag}${msg.user}`);
            if (msg.ai?.trim()) lines.push(`ai: ${langTag}${msg.ai}`);
            return lines;
        })
        .filter(Boolean)
        .join('\n');
}

const SAFE_FALLBACK: AssistantOutput = {
    response: "I'm sorry, my systems are currently recalibrating. Could you repeat that?",
    action: null,
    plannedActions: [],
};

/**
 * Phase N.1 — transitional 30-day shim.
 *
 * Normalises the parsed JSON into the v0.4+ shape:
 *
 *  1. If `plannedActions` is a non-empty array → keep as-is.
 *  2. Else if legacy `followUpSuggestion` is set AND `action` is set
 *     → synthesise a single-action plan from `action` and log a
 *     deprecation warn so the audit dashboard can flag the emitter.
 *  3. Else if `action` is a NAVIGATE_AND_FILL → synthesise a
 *     single-action plan from it (uniform iteration surface).
 *  4. Else → empty list.
 *
 * Plan to remove this shim 30 days after Phase N.1 lands (forensic
 * audit B5 + C4 closure window).
 */
interface LegacyVidyaShape {
    response?: string;
    action?: AssistantAction | null;
    plannedActions?: VidyaPlannedAction[];
    followUpSuggestion?: string | null;
}

function normalisePlannedActions(parsed: LegacyVidyaShape): VidyaPlannedAction[] {
    if (Array.isArray(parsed.plannedActions) && parsed.plannedActions.length > 0) {
        return parsed.plannedActions;
    }
    const action = parsed.action;
    const isNavigate = action && action.type === 'NAVIGATE_AND_FILL';
    if (parsed.followUpSuggestion && isNavigate) {
        // eslint-disable-next-line no-console
        console.warn(
            JSON.stringify({
                event: 'vidya_assistant.legacy_followup_suggestion',
                message:
                    'VIDYA model emitted legacy `followUpSuggestion` field — synthesising a 1-action plan. The shim is scheduled for removal 30 days after Phase N.1.',
            }),
        );
    }
    if (isNavigate) {
        const navAction = action as { type: 'NAVIGATE_AND_FILL'; flow: string; params?: Record<string, unknown> };
        const params = navAction.params ?? {};
        return [{
            type: 'NAVIGATE_AND_FILL',
            flow: navAction.flow,
            params: {
                topic: (params.topic as string | null | undefined) ?? null,
                gradeLevel: (params.gradeLevel as string | null | undefined) ?? null,
                subject: (params.subject as string | null | undefined) ?? null,
                language: (params.language as string | null | undefined) ?? null,
                ncertChapter:
                    (params.ncertChapter as VidyaPlannedActionParams['ncertChapter'] | undefined) ?? null,
                dependsOn: Array.isArray(params.dependsOn)
                    ? (params.dependsOn as number[]).slice(0, 2)
                    : [],
            },
        }];
    }
    return [];
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Run the Genkit-side VIDYA orchestrator. Returns the final
 * `{response, action}` shape — caller wires this into the cache + the
 * HTTP response.
 *
 * On parse failure returns the safe fallback (matching the previous
 * route's behaviour). On Genkit / Gemini failure throws — caller
 * decides whether to surface or fall back.
 */
export async function runGenkitVidya(
    input: AssistantInput,
): Promise<AssistantOutput> {
    if (!input.message) {
        // Defensive: route already validates, but a thrown error here
        // is more obvious than a malformed downstream prompt.
        throw new Error('runGenkitVidya: message is required');
    }

    const systemPrompt = buildSystemPrompt(input);
    const chatContext = buildChatContext(input.chatHistory);

    return await runResiliently(async (config) => {
        const response = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: `System: ${systemPrompt}\n\nChat History:\n${chatContext}\n\nUser: ${input.message}\n\nOutput strictly the JSON response as required by the System prompt. Return ONLY a single JSON object, no prose, no markdown code fences.`,
            ...config,
            config: {
                ...(config.config || {}),
                temperature: 0.1,
                // Force JSON output so Gemini does not wrap in ```json``` fences
                // or prepend prose. Without this, the model occasionally emits
                // "Sure! Here is the JSON: {…}" which crashes the regex parse
                // and lands the SAFE_FALLBACK — the silent demo failure mode.
                responseMimeType: 'application/json',
            },
        });

        const textOutput = response.text;

        try {
            const parsed = extractAndParseVidyaJson(textOutput);
            // Phase N.1 — normalise the legacy / new shape into the
            // v0.4+ wire shape (`plannedActions[]` always present, even
            // if empty). This also lets the dispatcher emit the same
            // shape regardless of which path served (Genkit off-mode
            // vs sidecar canary/full).
            const out: AssistantOutput = {
                response: parsed.response ?? '',
                action: parsed.action ?? null,
                plannedActions: normalisePlannedActions(parsed),
            };
            // [VIDYA Genkit] one-line structured trace so we can confirm
            // every voice utterance produced a valid intent at the LLM
            // boundary even when downstream navigation silently no-ops.
            // eslint-disable-next-line no-console
            console.log(
                JSON.stringify({
                    event: 'vidya.genkit.parsed',
                    hasResponse: Boolean(out.response),
                    responseLen: out.response.length,
                    actionType: out.action?.type ?? null,
                    actionFlow: (out.action as { flow?: string } | null)?.flow ?? null,
                    plannedCount: out.plannedActions?.length ?? 0,
                }),
            );
            return out;
        } catch (err) {
            // Match the legacy route: log + return safe fallback rather
            // than 500. The OmniOrb client renders the fallback as a
            // spoken hint to retry. Log the raw model output (truncated)
            // so we can debug demo-day misfires from Cloud Run logs.
            // eslint-disable-next-line no-console
            console.error(
                JSON.stringify({
                    event: 'vidya.genkit.parse_failed',
                    error: err instanceof Error ? err.message : String(err),
                    rawOutputExcerpt: String(textOutput ?? '').slice(0, 500),
                }),
            );
            return SAFE_FALLBACK;
        }
    });
}

/**
 * Robust JSON extraction for VIDYA model outputs.
 *
 * Gemini Flash occasionally wraps JSON in markdown code fences or
 * prepends a short prose explanation even with `responseMimeType:
 * 'application/json'`. The previous `match(/\{[\s\S]*\}/)` was greedy
 * and silently mis-parsed `{ ... } extra { ... }` shapes.
 *
 * Strategy (in order):
 *   1. Try direct JSON.parse first (fast path; works when JSON mode
 *      succeeded as intended).
 *   2. Strip Markdown code fences (```json\n...\n``` or ```\n...\n```).
 *   3. Walk for the first balanced top-level object — handles a leading
 *      prose preamble and a trailing prose epilogue without the greedy
 *      regex's "match the universe between first { and last }" bug.
 *   4. If all extraction strategies fail, throw — caller logs +
 *      returns SAFE_FALLBACK.
 */
function extractAndParseVidyaJson(raw: string): LegacyVidyaShape {
    const text = (raw ?? '').trim();
    if (!text) throw new Error('empty model output');

    // 1. Direct parse — happy path when responseMimeType is honoured.
    try {
        return JSON.parse(text);
    } catch {
        /* fall through */
    }

    // 2. Strip markdown code fences if present.
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
        try {
            return JSON.parse(fencedMatch[1].trim());
        } catch {
            /* fall through */
        }
    }

    // 3. Balanced-brace walk — find the first JSON object even if the
    // model prepended a prose preamble.
    const objStart = text.indexOf('{');
    if (objStart >= 0) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = objStart; i < text.length; i++) {
            const ch = text[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return JSON.parse(text.slice(objStart, i + 1));
                }
            }
        }
    }

    throw new Error('no JSON object found in model output');
}
