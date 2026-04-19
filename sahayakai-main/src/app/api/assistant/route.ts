import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ai } from '@/ai/genkit';
import { SAHAYAK_SOUL_PROMPT } from '@/ai/soul';
import { withPlanCheck } from '@/lib/plan-guard';

// ── L1: In-process intent cache (per server instance, sub-millisecond) ────────
// Keyed on: normalised_message + "::" + screen_path
// Applied only to fresh single-turn queries (empty chat history).
interface CacheEntry { data: any; ts: number }
const intentCache = new Map<string, CacheEntry>();
const L1_TTL_MS = 60 * 60 * 1000; // 1 hour

function normalisedCacheKey(message: string, path: string): string {
    const clean = message.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${path}::${clean}`;
}

/** MD5 hash of the cache key — used as the Firestore document ID. */
function hashKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
}

function getCachedIntent(key: string): any | null {
    const entry = intentCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > L1_TTL_MS) {
        intentCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedIntent(key: string, data: any): void {
    // LRU-lite: evict the oldest entry when we hit 1 000 items
    if (intentCache.size >= 1000) {
        const firstKey = intentCache.keys().next().value;
        if (firstKey) intentCache.delete(firstKey);
    }
    intentCache.set(key, { data, ts: Date.now() });
}
// ─────────────────────────────────────────────────────────────────────────────

// ── L2: Firestore shared cache (cross-instance, 24-hour TTL) ─────────────────
// Collection: vidya_intent_cache/{md5(cacheKey)}
// A cache hit here saves the full LLM round-trip (~600-2000 ms) for any teacher
// on any server instance asking the same question within the TTL window.
const L2_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VIDYA_CACHE_COLLECTION = 'vidya_intent_cache';

async function getFirestoreCache(hash: string): Promise<any | null> {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const db = await getDb();
        const doc = await db.collection(VIDYA_CACHE_COLLECTION).doc(hash).get();
        if (!doc.exists) return null;

        const data = doc.data()!;
        if (data.expiresAt < Date.now()) {
            // Expired — delete async and treat as a miss
            db.collection(VIDYA_CACHE_COLLECTION).doc(hash).delete().catch(console.warn);
            return null;
        }

        // Extend TTL and increment hit counter (async, non-blocking)
        db.collection(VIDYA_CACHE_COLLECTION).doc(hash).update({
            hitCount: FieldValue.increment(1),
            expiresAt: Date.now() + L2_TTL_MS,
        }).catch(console.warn);

        return data.response ?? null;
    } catch {
        return null; // cache errors must never break the main flow
    }
}

async function setFirestoreCache(hash: string, key: string, response: any, action: any): Promise<void> {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        await db.collection(VIDYA_CACHE_COLLECTION).doc(hash).set({
            hash,
            key,        // human-readable for debugging / analytics
            response,
            // Dimensions for analytics queries (which topics/grades are asked most)
            gradeLevel: action?.params?.gradeLevel ?? null,
            subject: action?.params?.subject ?? null,
            language: action?.params?.language ?? null,
            hitCount: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + L2_TTL_MS,
        });
    } catch {
        // Non-critical — swallow silently
    }
}
// ─────────────────────────────────────────────────────────────────────────────

async function _handler(req: Request) {
    try {
        const {
            message,
            chatHistory = [],
            currentScreenContext = null,
            teacherProfile = null,
            detectedLanguage = null,
        } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Cache applies only to fresh single-turn queries (no prior conversation).
        // Multi-turn context is too personalised to be safely shared across users.
        const isFreshQuery = chatHistory.length === 0;
        const cacheKey = normalisedCacheKey(message, currentScreenContext?.path || '');
        const cacheHash = hashKey(cacheKey);

        if (isFreshQuery) {
            // ── L1 check (in-process Map, < 0.1 ms) ──────────────────────────
            const l1Hit = getCachedIntent(cacheKey);
            if (l1Hit) return NextResponse.json(l1Hit);

            // ── L2 check (Firestore, ~50-150 ms) — only on fresh queries ─────
            const l2Hit = await getFirestoreCache(cacheHash);
            if (l2Hit) {
                setCachedIntent(cacheKey, l2Hit); // warm L1 for subsequent requests
                return NextResponse.json(l2Hit);
            }
        }

        // ── Build teacher profile context string ─────────────────────────────
        let profileContext = '';
        if (teacherProfile) {
            const parts: string[] = [];
            if (teacherProfile.preferredGrade) parts.push(`Preferred class: ${teacherProfile.preferredGrade}`);
            if (teacherProfile.preferredSubject) parts.push(`Preferred subject: ${teacherProfile.preferredSubject}`);
            if (teacherProfile.preferredLanguage) parts.push(`Preferred language: ${teacherProfile.preferredLanguage}`);
            if (teacherProfile.schoolContext) parts.push(`School context: ${teacherProfile.schoolContext}`);
            if (parts.length > 0) {
                profileContext = `\nTeacher Profile (long-term memory):\n${parts.join('\n')}`;
            }
        }

        const languageInstruction = detectedLanguage
            ? `\nDetected speech language: "${detectedLanguage}" — You MUST respond in this language. Set action.params.language to "${detectedLanguage}" if triggering a flow.`
            : '';

        const systemPrompt = `${SAHAYAK_SOUL_PROMPT}

CRITICAL CONTEXT INJECTION:
Current User Screen path: ${currentScreenContext?.path || 'unknown'}
Active form fields (what the teacher is currently working on): ${JSON.stringify(currentScreenContext?.uiState || {})}${profileContext}${languageInstruction}
    `;

        const { runResiliently } = await import('@/ai/genkit');

        return await runResiliently(async (config) => {
            const chatContext = chatHistory
                .flatMap((msg: any) => {
                    const lines: string[] = [];
                    // Format 1: Genkit-style { role, parts }
                    if (msg.role && msg.parts) {
                        const text = msg.parts.map((p: any) => p.text).join('');
                        if (text.trim()) lines.push(`${msg.role}: ${text}`);
                    }
                    // Format 2: VoiceAssistant { user, ai }
                    if (msg.user?.trim()) lines.push(`user: ${msg.user}`);
                    if (msg.ai?.trim()) lines.push(`ai: ${msg.ai}`);
                    return lines;
                })
                .filter(Boolean)
                .join('\n');

            const response = await ai.generate({
                model: 'googleai/gemini-2.0-flash',
                prompt: `System: ${systemPrompt}\n\nChat History:\n${chatContext}\n\nUser: ${message}\n\nOutput strictly the JSON response as required by the System prompt.`,
                ...config,
                config: {
                    ...(config.config || {}),
                    temperature: 0.1,
                }
            });

            const textOutput = response.text;

            let parsedResponse;
            try {
                const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    parsedResponse = JSON.parse(textOutput);
                }
            } catch (e) {
                console.error("Failed to parse VIDYA JSON", textOutput);
                return NextResponse.json(
                    { response: "I'm sorry, my systems are currently recalibrating. Could you repeat that?", action: null },
                    { status: 200 }
                );
            }

            // ── Write to L1 + L2 cache (fresh queries only, async) ───────────
            if (isFreshQuery) {
                setCachedIntent(cacheKey, parsedResponse);
                // L2 write is fully async — never awaited, never blocks the response
                setFirestoreCache(cacheHash, cacheKey, parsedResponse, parsedResponse?.action);
            }

            return NextResponse.json(parsedResponse);
        });

    } catch (error: any) {
        console.error('[Assistant API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const POST = withPlanCheck('assistant')(_handler);
