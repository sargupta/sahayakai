import { NextResponse } from 'next/server';
import { agentRouterFlow } from '@/ai/flows/agent-definitions';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';

/**
 * BUG #7 (2026-05-28): When the agent router fails to extract a concise
 * `topic`, we no longer dump the entire raw utterance into the destination
 * page. This helper strips the most common conversational scaffolding and
 * artefact/action words so a fallback at least resembles a short topic. If
 * the result is empty or still sentence-length, it returns '' and the caller
 * omits the param entirely (page shows a clean placeholder).
 */
function cleanTopicFallback(raw: string | undefined | null): string {
    if (!raw) return '';
    let s = raw.trim();
    // Strip leading conversational/action scaffolding (English + common Hindi romanization).
    s = s.replace(
        /^(hey|hi|hello|please|can you|could you|kya aap|kindly|i want|i need|help me|let'?s|make( me)?|create|generate|build|prepare|design|banao|banana hai|chahiye|de(na|sakti ho)?)[\s,:-]+/gi,
        ''
    );
    // Strip artefact/tool nouns and the connective that usually follows them.
    s = s.replace(
        /\b(a |an |the )?(lesson plan|unit plan|quiz|mcq|worksheet|exam paper|board paper|question paper|rubric|field trip|video|visual aid|flashcards?|diagram|training)\b[\s]*(about|on|for|regarding|ka|ke|ki|par|पर|का|के|की|पे)?[\s,:-]*/gi,
        ''
    );
    s = s.replace(/\s+/g, ' ').trim();
    // If nothing survives, or it still reads as a full sentence (too long / has a verb-y tail),
    // give up and let the page show its placeholder rather than a cluttered field.
    if (!s || s.length > 60 || s.split(/\s+/).length > 8) return '';
    return s;
}

/**
 * @swagger
 * /api/ai/intent:
 *   post:
 *     summary: AI Intent Router
 *     description: Determines the user's intent and either returns a navigation recommendation or an instant answer.
 *     tags:
 *       - AI Generation
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "Create a quiz about gravity."
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Intent analysis or Instant Answer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Analysis failed
 */
export async function POST(request: Request) {
    let promptText = 'Unknown Prompt';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, language } = body;
        promptText = prompt || 'Unknown Prompt';

        // 1. Determine Intent and extract params
        const flowOutput = await agentRouterFlow({
            prompt,
            language,
            userId
        });
        const {
            type: intent,
            topic: extractedTopic,
            gradeLevel: extractedGrade,
            subject: extractedSubject,
            language: detectedLanguage,
            // Phase N.1 — typed planned-action queue passed through to
            // the wire response so v0.4+ clients (OmniOrb post-δ
            // migration) get a uniform iteration surface across both
            // off-mode (Genkit) and canary/full (sidecar) paths. Empty
            // for instantAnswer / unknown / unroutable single-step.
            plannedActions = [],
        } = flowOutput;

        // BUG #7 (2026-05-28): Prefer the model's CONCISE extracted topic.
        // Previously we fell back to the raw `prompt` whenever extraction
        // returned null, which dumped the entire verbose utterance ("can you
        // help me make a lesson plan about photosynthesis for class 7") into
        // the destination page's topic field. Instead, only fall back to a
        // lightly-cleaned prompt, and leave the field empty if cleaning
        // produces nothing useful so the page shows a clean placeholder.
        const finalTopic = (extractedTopic && extractedTopic.trim()) || cleanTopicFallback(prompt);
        const finalLanguage = detectedLanguage || language || 'en';

        let result: any;
        const queryParams = new URLSearchParams();
        if (finalTopic) queryParams.set('topic', finalTopic);
        if (extractedGrade) queryParams.set('gradeLevel', extractedGrade);
        if (extractedSubject) queryParams.set('subject', extractedSubject);
        if (finalLanguage) queryParams.set('language', finalLanguage);

        const queryString = queryParams.toString();

        // 2. Route based on intent (Sync with processAgentRequest logic)
        switch (intent) {
            case 'lessonPlan':
                result = { action: 'NAVIGATE', url: `/lesson-plan?${queryString}` };
                break;
            case 'quiz':
                result = { action: 'NAVIGATE', url: `/quiz-generator?${queryString}` };
                break;
            case 'visualAid':
                result = { action: 'NAVIGATE', url: `/visual-aid-designer?${queryString}` };
                break;
            case 'worksheet':
                result = { action: 'NAVIGATE', url: `/worksheet-wizard?${queryString}` };
                break;
            case 'virtualFieldTrip':
                result = { action: 'NAVIGATE', url: `/virtual-field-trip?${queryString}` };
                break;
            case 'teacherTraining':
                result = { action: 'NAVIGATE', url: `/teacher-training?${queryString}` };
                break;
            case 'rubric':
                result = { action: 'NAVIGATE', url: `/rubric-generator?${queryString}` };
                break;
            case 'videoStoryteller':
                result = { action: 'NAVIGATE', url: `/video-storyteller?${queryString}` };
                break;
            case 'examPaper':
                result = { action: 'NAVIGATE', url: `/exam-paper?${queryString}` };
                break;
            case 'instantAnswer':
            default: {
                // QA #1 (2026-05-28): a bare academic topic with no action verb
                // ("Relations and Functions Class 12") previously fell to the
                // default branch and returned "Not sure how to help", which felt
                // broken. Treat any unclassified-but-non-empty prompt as an
                // instant-answer question instead of erroring out. The teacher
                // gets a useful answer + video rather than a dead end.
                const answer = await instantAnswer({
                    question: prompt,
                    language: finalLanguage,
                    userId: userId,
                });
                result = { action: 'ANSWER', content: answer.answer, videoUrl: answer.videoSuggestionUrl };
                break;
            }
        }

        return NextResponse.json({
            type: intent,
            plannedActions,
            result: result,
        });

    } catch (error) {
        logAIError(error, 'INTENT', { message: `Intent Router API Failed for prompt: "${promptText}"`, userId: request.headers.get('x-user-id') });
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
