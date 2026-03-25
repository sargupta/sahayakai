/**
 * POST /api/jobs/ai-reactive-reply
 *
 * Triggered internally when a real teacher sends a message in community chat
 * or group chat. An AI persona may reply after a short delay to keep the
 * conversation alive.
 *
 * Security: requires `x-internal-secret` header matching AI_INTERNAL_SECRET env var.
 * Body: { collectionPath: string, messageText: string, authorName: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isAllowedChatPath } from '@/lib/ai-reactive-trigger';
import {
    pickRandomPersonas,
    buildPersonaSystemPrompt,
    buildMemoryContext,
    loadPersonaMemory,
    savePersonaMemory,
} from '@/lib/ai-teacher-personas';

export const maxDuration = 60;

// ── Config ──────────────────────────────────────────────────────────────────

/** Probability that an AI persona replies to any given real message */
const REPLY_PROBABILITY = 0.3;

/** Delay range in ms before posting (feels human). Kept within maxDuration budget. */
const MIN_DELAY_MS = 5_000;   // 5 seconds
const MAX_DELAY_MS = 25_000;  // 25 seconds (leaves ~30s for Firestore + LLM)

/** Cooldown: don't reply if an AI persona replied within this window */
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
    try {
        // ── Auth: internal secret check ─────────────────────────────────
        const secret = process.env.AI_INTERNAL_SECRET;
        if (secret) {
            const provided = req.headers.get('x-internal-secret');
            if (provided !== secret) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { collectionPath, messageText, authorName } = body as {
            collectionPath?: string;
            messageText?: string;
            authorName?: string;
        };

        if (!collectionPath || !messageText || !authorName) {
            return NextResponse.json({ ok: false, reason: 'missing fields' }, { status: 400 });
        }

        // ── Validate collection path (prevent arbitrary writes) ─────────
        if (!isAllowedChatPath(collectionPath)) {
            return NextResponse.json({ ok: false, reason: 'invalid path' }, { status: 400 });
        }

        // ── Skip if trigger is from an AI persona ──────────────────────
        if (authorName.startsWith('AI_')) {
            return NextResponse.json({ ok: true, action: 'skipped', reason: 'ai_author' });
        }

        // ── Probability gate ────────────────────────────────────────────
        if (Math.random() > REPLY_PROBABILITY) {
            return NextResponse.json({ ok: true, action: 'skipped', reason: 'probability' });
        }

        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        // ── Cooldown check ──────────────────────────────────────────────
        const recentAI = await db
            .collection(collectionPath)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        const now = Date.now();
        for (const doc of recentAI.docs) {
            const data = doc.data();
            if (data.authorId?.startsWith('AI_TEACHER_')) {
                const ts = data.createdAt?.toMillis?.() ?? 0;
                if (now - ts < COOLDOWN_MS) {
                    return NextResponse.json({ ok: true, action: 'skipped', reason: 'cooldown' });
                }
                break;
            }
        }

        // ── Pick persona ────────────────────────────────────────────────
        const persona = pickRandomPersonas(1)[0];
        if (!persona) {
            return NextResponse.json({ ok: true, action: 'skipped', reason: 'no persona' });
        }

        // ── Gather recent context ───────────────────────────────────────
        const recentSnap = await db
            .collection(collectionPath)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const recentMessages = recentSnap.docs
            .map(d => ({
                authorName: d.data().authorName as string,
                text: d.data().text as string,
            }))
            .reverse();

        const recentText = recentMessages.map(m => `${m.authorName}: ${m.text}`).join('\n');

        // ── Build prompt with memory ────────────────────────────────────
        const memory = await loadPersonaMemory(db, persona.id);
        const memoryCtx = buildMemoryContext(memory);

        const systemPrompt = buildPersonaSystemPrompt(
            persona,
            'reply_to_chat',
            recentText,
            memoryCtx,
        );

        const userPrompt = `${authorName} just said: "${messageText}"\n\nReply naturally as yourself. Keep it SHORT — 1-2 sentences max. React to what they said.`;

        // ── Random delay (within budget) ────────────────────────────────
        const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
        await sleep(delay);

        // ── Generate reply ──────────────────────────────────────────────
        const { ai, runResiliently } = await import('@/ai/genkit');
        const result = await runResiliently(async (override) => {
            return ai.generate({
                model: 'googleai/gemini-2.0-flash-lite',
                system: systemPrompt,
                prompt: userPrompt,
                config: {
                    temperature: 0.9,
                    maxOutputTokens: 150,
                    ...override.config,
                },
            });
        });

        const reply = result.text.trim();
        if (!reply) {
            return NextResponse.json({ ok: true, action: 'skipped', reason: 'empty reply' });
        }

        // ── Post the reply ──────────────────────────────────────────────
        const { FieldValue } = await import('firebase-admin/firestore');
        await db.collection(collectionPath).add({
            text: reply,
            authorId: persona.uid,
            authorName: persona.displayName,
            authorPhotoURL: null,
            createdAt: FieldValue.serverTimestamp(),
        });

        // ── Update persona memory ───────────────────────────────────────
        const memoryContext = collectionPath === 'community_chat' ? 'staff_room' as const : 'group_chat' as const;

        memory.recentInteractions.unshift({
            type: 'sent',
            context: memoryContext,
            authorName: persona.displayName,
            text: reply,
            timestamp: new Date().toISOString(),
        });

        memory.recentInteractions.unshift({
            type: 'seen',
            context: memoryContext,
            authorName,
            text: messageText,
            timestamp: new Date().toISOString(),
        });

        if (!memory.knownTeachers[authorName]) {
            memory.knownTeachers[authorName] = {
                displayName: authorName,
                lastInteraction: new Date().toISOString(),
                relationship: `Replied to their message: "${messageText.substring(0, 50)}"`,
            };
        } else {
            memory.knownTeachers[authorName].lastInteraction = new Date().toISOString();
        }

        await savePersonaMemory(db, memory);

        logger.info(
            `AI reactive reply by ${persona.displayName} in ${collectionPath}: ${reply.substring(0, 50)}...`,
            'AI_AGENT',
        );

        return NextResponse.json({
            ok: true,
            action: 'replied',
            persona: persona.displayName,
        });
    } catch (error) {
        logger.error('AI reactive reply failed', error, 'AI_AGENT');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
