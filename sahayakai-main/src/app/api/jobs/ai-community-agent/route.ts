/**
 * POST /api/jobs/ai-community-agent
 *
 * Periodic cron job that makes AI teacher personas participate in the community.
 * Runs every 3 hours via Cloud Scheduler.
 *
 * What it does each run:
 * 1. Posts 1-2 staff room chat messages from random personas
 * 2. Creates 1 group post in a relevant group
 * 3. Likes 2-3 recent real teacher posts (organic engagement)
 * 4. Optionally replies to a recent staff room message
 *
 * Cloud Scheduler setup:
 *   gcloud scheduler jobs create http sahayakai-ai-community-agent \
 *     --schedule="0 6,9,12,15,18 * * *" \
 *     --time-zone="Asia/Kolkata" \
 *     --uri="https://<your-app>/api/jobs/ai-community-agent" \
 *     --http-method=POST \
 *     --oidc-service-account-email=<sa>@<project>.iam.gserviceaccount.com \
 *     --oidc-token-audience="https://<your-app>" \
 *     --location=asia-south1
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
    buildPersonaSystemPrompt,
    buildMemoryContext,
    loadPersonaMemory,
    savePersonaMemory,
    getPersonaUserDoc,
    type AITeacherPersona,
    type PersonaMemory,
} from '@/lib/ai-teacher-personas';
import { getAllPersonas, pickFromPool } from '@/lib/ai-persona-runtime';

export const maxDuration = 120;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateContent(systemPrompt: string, userPrompt: string): Promise<string> {
    const { ai } = await import('@/ai/genkit');
    const { runResiliently } = await import('@/ai/genkit');

    const result = await runResiliently(async (override) => {
        return ai.generate({
            model: 'googleai/gemini-2.0-flash',
            system: systemPrompt,
            prompt: userPrompt,
            config: {
                temperature: 0.9, // High creativity for natural variation
                maxOutputTokens: 200,
                ...override.config,
            },
        });
    });

    return result.text.trim();
}

async function ensureAITeacherProfiles(db: FirebaseFirestore.Firestore, personas: AITeacherPersona[]) {
    // Ensure all AI teacher user docs exist (static + runtime).
    const batch = db.batch();
    let created = 0;

    for (const persona of personas) {
        const userRef = db.collection('users').doc(persona.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            batch.set(userRef, getPersonaUserDoc(persona));
            created++;
        }
    }

    if (created > 0) {
        await batch.commit();
        logger.info(`Created ${created} AI teacher profiles`, 'AI_AGENT');
    }
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function postStaffRoomChat(
    db: FirebaseFirestore.Firestore,
    persona: AITeacherPersona,
    recentMessages: Array<{ authorName: string; text: string }>,
) {
    const { FieldValue } = await import('firebase-admin/firestore');

    // Load persona memory
    const memory = await loadPersonaMemory(db, persona.id);
    const memoryCtx = buildMemoryContext(memory);

    const recentText = recentMessages.map(m => `${m.authorName}: ${m.text}`).join('\n');
    const systemPrompt = buildPersonaSystemPrompt(
        persona,
        recentMessages.length > 0 ? 'reply_to_chat' : 'staff_room_chat',
        recentMessages.length > 0 ? recentText : undefined,
        memoryCtx,
    );

    const hour = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: true });
    const prompts = [
        'Share something from your day today.',
        `It's ${hour} — what are you up to right now?`,
        'Share a quick teaching tip or something that worked in class recently.',
        'What\'s on your mind right now as a teacher?',
        'React to what other teachers said, or share your own thought.',
    ];
    const userPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const message = await generateContent(systemPrompt, userPrompt);

    await db.collection('community_chat').add({
        text: message,
        authorId: persona.uid,
        authorName: persona.displayName,
        authorPhotoURL: null,
        timestamp: FieldValue.serverTimestamp(),
    });

    // Update memory: record what we sent + what we saw
    memory.recentInteractions.unshift({
        type: 'sent',
        context: 'staff_room',
        authorName: persona.displayName,
        text: message,
        timestamp: new Date().toISOString(),
    });
    for (const msg of recentMessages.slice(0, 5)) {
        // Remember real teachers we've seen
        if (!msg.authorName.startsWith('AI_')) {
            memory.recentInteractions.unshift({
                type: 'seen',
                context: 'staff_room',
                authorName: msg.authorName,
                text: msg.text,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // Extract topic from our message (first 6 words as rough topic)
    const topic = message.split(/\s+/).slice(0, 6).join(' ');
    memory.topicsDiscussed.unshift(topic);

    // Remember real teachers from chat
    for (const msg of recentMessages) {
        if (msg.authorName !== persona.displayName && !msg.authorName.startsWith('AI_')) {
            const existing = memory.knownTeachers[msg.authorName];
            if (!existing) {
                memory.knownTeachers[msg.authorName] = {
                    displayName: msg.authorName,
                    lastInteraction: new Date().toISOString(),
                    relationship: `Chatted in staff room about: "${msg.text.substring(0, 50)}"`,
                };
            } else {
                existing.lastInteraction = new Date().toISOString();
            }
        }
    }

    await savePersonaMemory(db, memory);

    logger.info(`Staff room chat by ${persona.displayName}: ${message.substring(0, 50)}...`, 'AI_AGENT');
}

async function createGroupPost(
    db: FirebaseFirestore.Firestore,
    persona: AITeacherPersona,
) {
    const { FieldValue } = await import('firebase-admin/firestore');

    // Find a group matching this persona's subjects/grades
    const userDoc = await db.collection('users').doc(persona.uid).get();
    const groupIds: string[] = userDoc.data()?.groupIds ?? [];

    if (groupIds.length === 0) {
        // Auto-join persona to relevant groups first
        await autoJoinPersona(db, persona);
        const refreshed = await db.collection('users').doc(persona.uid).get();
        groupIds.push(...(refreshed.data()?.groupIds ?? []));
    }

    if (groupIds.length === 0) {
        logger.warn(`No groups for ${persona.displayName}, skipping post`, 'AI_AGENT');
        return;
    }

    // Pick a random group
    const groupId = groupIds[Math.floor(Math.random() * groupIds.length)];
    const groupDoc = await db.collection('groups').doc(groupId).get();
    const groupName = groupDoc.data()?.name ?? groupId;

    // Load memory for context-aware posting
    const memory = await loadPersonaMemory(db, persona.id);
    const memoryCtx = buildMemoryContext(memory);

    const systemPrompt = buildPersonaSystemPrompt(persona, 'group_post', groupName, memoryCtx);
    const userPrompt = 'Write a community post for this group. Share something useful — a tip, an experience, a question, or a resource recommendation.';

    const content = await generateContent(systemPrompt, userPrompt);

    const postTypes = ['share', 'ask_help', 'celebrate', 'resource'] as const;
    const postType = postTypes[Math.floor(Math.random() * postTypes.length)];

    const postRef = db.collection(`groups/${groupId}/posts`).doc();
    await postRef.set({
        groupId,
        authorUid: persona.uid,
        authorName: persona.displayName,
        authorPhotoURL: null,
        content,
        postType,
        attachments: [],
        likesCount: 0,
        commentsCount: 0,
        createdAt: FieldValue.serverTimestamp(),
    });

    // Update group activity
    await db.collection('groups').doc(groupId).update({
        lastActivityAt: FieldValue.serverTimestamp(),
    });

    // Update memory
    memory.recentInteractions.unshift({
        type: 'sent',
        context: 'group_post',
        authorName: persona.displayName,
        text: content,
        timestamp: new Date().toISOString(),
        groupId,
    });
    const postTopic = content.split(/\s+/).slice(0, 6).join(' ');
    memory.topicsDiscussed.unshift(postTopic);
    await savePersonaMemory(db, memory);

    logger.info(`Group post by ${persona.displayName} in ${groupName}: ${content.substring(0, 50)}...`, 'AI_AGENT');
}

async function likeRecentPosts(db: FirebaseFirestore.Firestore, persona: AITeacherPersona) {
    const { FieldValue } = await import('firebase-admin/firestore');

    const userDoc = await db.collection('users').doc(persona.uid).get();
    const groupIds: string[] = userDoc.data()?.groupIds ?? [];

    if (groupIds.length === 0) return;

    // Pick a random group and like recent posts
    const groupId = groupIds[Math.floor(Math.random() * groupIds.length)];
    const recentPosts = await db
        .collection(`groups/${groupId}/posts`)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    let liked = 0;
    for (const postDoc of recentPosts.docs) {
        // Don't like own posts
        if (postDoc.data().authorUid === persona.uid) continue;
        // Don't like system posts
        if (postDoc.data().authorUid === 'SYSTEM_SAHAYAKAI') continue;

        // Check if already liked
        const likeRef = db.doc(`groups/${groupId}/posts/${postDoc.id}/likes/${persona.uid}`);
        const likeSnap = await likeRef.get();
        if (likeSnap.exists) continue;

        await likeRef.set({ createdAt: FieldValue.serverTimestamp() });
        await postDoc.ref.update({ likesCount: FieldValue.increment(1) });
        liked++;

        if (liked >= 2) break; // Max 2 likes per run
    }

    if (liked > 0) {
        logger.info(`${persona.displayName} liked ${liked} posts in group ${groupId}`, 'AI_AGENT');
    }
}

async function autoJoinPersona(db: FirebaseFirestore.Firestore, persona: AITeacherPersona) {
    const { FieldValue } = await import('firebase-admin/firestore');

    // Find matching groups
    const allGroups = await db.collection('groups').limit(50).get();
    const groupsToJoin: string[] = [];

    for (const groupDoc of allGroups.docs) {
        const rules = groupDoc.data().autoJoinRules ?? {};

        // Match by subject
        if (rules.subjects?.some((s: string) => persona.subjects.includes(s))) {
            groupsToJoin.push(groupDoc.id);
            continue;
        }
        // Match by state
        if (rules.state && rules.state === persona.state) {
            groupsToJoin.push(groupDoc.id);
            continue;
        }
        // System groups
        if (['education_updates', 'community_general'].includes(groupDoc.id)) {
            groupsToJoin.push(groupDoc.id);
        }
    }

    for (const groupId of groupsToJoin) {
        const memberRef = db.doc(`groups/${groupId}/members/${persona.uid}`);
        try {
            await memberRef.create({
                joinedAt: new Date().toISOString(),
                role: 'member',
            });
            await db.collection('groups').doc(groupId).update({
                memberCount: FieldValue.increment(1),
            });
        } catch {
            // Already a member
        }
    }

    if (groupsToJoin.length > 0) {
        await db.collection('users').doc(persona.uid).update({
            groupIds: FieldValue.arrayUnion(...groupsToJoin),
        });
        logger.info(`Auto-joined ${persona.displayName} to ${groupsToJoin.length} groups`, 'AI_AGENT');
    }
}

async function collectEngagementSignals(
    db: FirebaseFirestore.Firestore,
    persona: AITeacherPersona,
) {
    const memory = await loadPersonaMemory(db, persona.id);
    const userDoc = await db.collection('users').doc(persona.uid).get();
    const groupIds: string[] = userDoc.data()?.groupIds ?? [];

    // Check recent posts by this persona for likes/comments
    for (const groupId of groupIds.slice(0, 3)) {
        const posts = await db
            .collection(`groups/${groupId}/posts`)
            .where('authorUid', '==', persona.uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        for (const postDoc of posts.docs) {
            const data = postDoc.data();
            const likes = data.likesCount ?? 0;
            const replies = data.commentsCount ?? 0;
            if (likes + replies === 0) continue;

            // Check if we already recorded this
            const alreadyRecorded = memory.engagementSignals.some(
                s => s.content === data.content?.substring(0, 80),
            );
            if (alreadyRecorded) continue;

            memory.engagementSignals.unshift({
                content: data.content?.substring(0, 80) ?? '',
                likes,
                replies,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // Also learn from staff room — extract opinions from real teachers
    const recentChat = await db
        .collection('community_chat')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

    for (const chatDoc of recentChat.docs) {
        const data = chatDoc.data();
        // Skip own messages and other AI messages
        if (data.authorId?.startsWith('AI_TEACHER_')) continue;

        // If a real teacher shared a substantive opinion (>30 chars), learn from it
        if (data.text?.length > 30) {
            const exists = memory.evolvedOpinions.some(
                o => o.includes(data.authorName),
            );
            if (!exists && memory.evolvedOpinions.length < 10) {
                memory.evolvedOpinions.unshift(
                    `${data.authorName} shared: "${data.text.substring(0, 60)}..."`,
                );
            }
        }
    }

    await savePersonaMemory(db, memory);
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function POST() {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        // Step 0: Load combined persona pool (static + runtime) and ensure
        // their user docs exist. Runtime personas are seeded by the
        // /api/jobs/grow-persona-pool job.
        const personaPool = await getAllPersonas();
        await ensureAITeacherProfiles(db, personaPool);

        // Step 1: Pick personas for this run (no overlap between roles).
        const chatPersonas = pickFromPool(personaPool, 2);
        const postPersona = pickFromPool(personaPool, 1, chatPersonas.map(p => p.id))[0];
        const likePersona = pickFromPool(personaPool, 1, [
            ...chatPersonas.map(p => p.id),
            postPersona?.id,
        ].filter(Boolean) as string[])[0];

        // Step 2: Get recent staff room messages for context
        const recentChat = await db
            .collection('community_chat')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        const recentMessages = recentChat.docs
            .map(d => ({
                authorName: d.data().authorName as string,
                text: d.data().text as string,
            }))
            .reverse();

        // Step 3: Collect engagement signals (learn from past performance)
        const engagementPersona = pickFromPool(personaPool, 1)[0];
        if (engagementPersona) {
            await collectEngagementSignals(db, engagementPersona).catch(err =>
                logger.warn(`Engagement collection failed: ${err}`, 'AI_AGENT'),
            );
        }

        // Step 4: Execute actions in parallel where possible
        const results = await Promise.allSettled([
            // Staff room chats
            postStaffRoomChat(db, chatPersonas[0], recentMessages),
            chatPersonas[1]
                ? postStaffRoomChat(db, chatPersonas[1], recentMessages)
                : Promise.resolve(),

            // Group post
            postPersona ? createGroupPost(db, postPersona) : Promise.resolve(),

            // Likes
            likePersona ? likeRecentPosts(db, likePersona) : Promise.resolve(),
        ]);

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            failures.forEach((f, i) => {
                if (f.status === 'rejected') {
                    logger.warn(`AI agent action ${i} failed: ${f.reason}`, 'AI_AGENT');
                }
            });
        }

        return NextResponse.json({
            ok: true,
            actions: {
                staffRoomChats: chatPersonas.map(p => p.displayName),
                groupPost: postPersona?.displayName ?? null,
                likes: likePersona?.displayName ?? null,
            },
            failures: failures.length,
        });
    } catch (error) {
        logger.error('AI community agent failed', error, 'AI_AGENT');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
