'use server';

import { getDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
import type {
    Group,
    GroupPost,
    GroupChatMessage,
    PostType,
    PostAttachment,
    FeedItem,
} from '@/types/community';
import { getGroupColor } from '@/types/community';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeKey(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

const VALID_POST_TYPES: PostType[] = ['share', 'ask_help', 'celebrate', 'resource'];

// ── 1. ensureUserGroupsAction ─────────────────────────────────────────────────

export async function ensureUserGroupsAction(): Promise<string[]> {
    const uid = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const now = new Date().toISOString();

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error('User profile not found');
    const profile = userDoc.data()!;

    const subjects: string[] = profile.subjects ?? [];
    const gradeLevels: string[] = profile.gradeLevels ?? [];
    const schoolName: string = profile.schoolName ?? '';
    const board: string = profile.educationBoard ?? '';
    const state: string = profile.state ?? '';

    const existingGroupIds: string[] = profile.groupIds ?? [];
    const existingSet = new Set(existingGroupIds);
    const newGroupIds: string[] = [];

    // Subject+grade groups
    for (const subject of subjects) {
        for (const grade of gradeLevels) {
            const groupId = `${normalizeKey(subject)}_${normalizeKey(grade)}_${normalizeKey(board || 'general')}`;
            if (existingSet.has(groupId)) continue;

            const groupRef = db.collection('groups').doc(groupId);
            const groupDoc = await groupRef.get();

            const isNewGroup = !groupDoc.exists;
            if (isNewGroup) {
                const boardLabel = board || 'All Boards';
                const groupData = {
                    name: `${grade} ${subject} — ${boardLabel}`,
                    description: `Teachers teaching ${subject} to ${grade} students (${boardLabel})`,
                    type: 'subject_grade' as const,
                    coverColor: getGroupColor(`${subject}_${grade}`),
                    memberCount: 0,
                    autoJoinRules: {
                        subjects: [subject],
                        grades: [grade],
                        ...(board ? { board } : {}),
                    },
                    lastActivityAt: FieldValue.serverTimestamp(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                };
                await groupRef.set(groupData);
            }

            try {
                await groupRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
                await groupRef.update({ memberCount: FieldValue.increment(1) });
                newGroupIds.push(groupId);
            } catch {
                // Already a member — skip (create fails if doc exists)
                newGroupIds.push(groupId);
            }
        }
    }

    // School group
    if (schoolName) {
        const schoolGroupId = `school_${normalizeKey(schoolName)}`;
        if (!existingSet.has(schoolGroupId)) {
            const groupRef = db.collection('groups').doc(schoolGroupId);
            const groupDoc = await groupRef.get();

            if (!groupDoc.exists) {
                await groupRef.set({
                    name: schoolName,
                    description: `Teachers from ${schoolName}`,
                    type: 'school',
                    coverColor: getGroupColor(schoolName),
                    memberCount: 0,
                    autoJoinRules: { school: schoolName },
                    lastActivityAt: FieldValue.serverTimestamp(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                });
            }

            try {
                await groupRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
                await groupRef.update({ memberCount: FieldValue.increment(1) });
                newGroupIds.push(schoolGroupId);
            } catch {
                // Already a member — skip (create fails if doc exists)
                newGroupIds.push(schoolGroupId);
            }
        }
    }

    // State group
    if (state) {
        const stateGroupId = `state_${normalizeKey(state)}`;
        if (!existingSet.has(stateGroupId)) {
            const groupRef = db.collection('groups').doc(stateGroupId);
            const groupDoc = await groupRef.get();

            if (!groupDoc.exists) {
                await groupRef.set({
                    name: `${state} Teachers`,
                    description: `All teachers in ${state}`,
                    type: 'region',
                    coverColor: getGroupColor(state),
                    memberCount: 0,
                    autoJoinRules: { state },
                    lastActivityAt: FieldValue.serverTimestamp(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                });
            }

            try {
                await groupRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
                await groupRef.update({ memberCount: FieldValue.increment(1) });
                newGroupIds.push(stateGroupId);
            } catch {
                // Already a member — skip (create fails if doc exists)
                newGroupIds.push(stateGroupId);
            }
        }
    }

    // Auto-join "Education Updates" group (system group for all users)
    const eduGroupId = 'education_updates';
    if (!existingSet.has(eduGroupId)) {
        const eduRef = db.collection('groups').doc(eduGroupId);
        const eduDoc = await eduRef.get();

        if (!eduDoc.exists) {
            await eduRef.set({
                name: 'Education Updates',
                description: 'Official CBSE circulars, board notifications, and education policy updates — auto-posted daily by SahayakAI.',
                type: 'interest' as const,
                coverColor: 'linear-gradient(135deg, #f97316, #dc2626)',
                memberCount: 0,
                autoJoinRules: {},
                lastActivityAt: FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString(),
                createdBy: 'system',
                isSystem: true,
            });
        }

        try {
            await eduRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
            await eduRef.update({ memberCount: FieldValue.increment(1) });
            newGroupIds.push(eduGroupId);
        } catch {
            newGroupIds.push(eduGroupId);
        }
    }

    // Auto-join "Community" general group (open to all for posting)
    const communityGroupId = 'community_general';
    if (!existingSet.has(communityGroupId)) {
        const commRef = db.collection('groups').doc(communityGroupId);
        const commDoc = await commRef.get();

        if (!commDoc.exists) {
            await commRef.set({
                name: 'Community',
                description: 'Open discussion for all teachers — share ideas, ask questions, celebrate wins.',
                type: 'interest' as const,
                coverColor: 'linear-gradient(135deg, #f59e0b, #f97316)',
                memberCount: 0,
                autoJoinRules: {},
                lastActivityAt: FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString(),
                createdBy: 'system',
                isSystem: true,
            });
        }

        try {
            await commRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
            await commRef.update({ memberCount: FieldValue.increment(1) });
            newGroupIds.push(communityGroupId);
        } catch {
            newGroupIds.push(communityGroupId);
        }
    }

    // Persist groupIds on user doc
    if (newGroupIds.length > 0) {
        await db.collection('users').doc(uid).update({
            groupIds: FieldValue.arrayUnion(...newGroupIds),
        });
    }

    const allGroupIds = [...existingGroupIds, ...newGroupIds];
    logger.info(`ensureUserGroups: uid=${uid}, existing=${existingGroupIds.length}, new=${newGroupIds.length}`);
    return allGroupIds;
}

// ── 2. getMyGroupsAction ──────────────────────────────────────────────────────

export async function getMyGroupsAction(): Promise<Group[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    const groupIds: string[] = userDoc.data()?.groupIds ?? [];

    if (groupIds.length === 0) return [];

    // Batch fetch in chunks of 10 (Firestore 'in' query limit)
    const groups: Group[] = [];
    for (let i = 0; i < groupIds.length; i += 10) {
        const chunk = groupIds.slice(i, i + 10);
        const snap = await db.collection('groups')
            .where('__name__', 'in', chunk)
            .get();
        for (const doc of snap.docs) {
            groups.push({ id: doc.id, ...doc.data() } as Group);
        }
    }

    // Sort by lastActivityAt desc
    groups.sort((a, b) => {
        const toStr = (v: unknown) => typeof v === 'string' ? v : (v as any)?.toDate?.().toISOString?.() ?? '';
        return toStr(b.lastActivityAt).localeCompare(toStr(a.lastActivityAt));
    });

    return dbAdapter.serialize(groups);
}

// ── 3. getGroupAction ─────────────────────────────────────────────────────────

export async function getGroupAction(groupId: string): Promise<Group | null> {
    const db = await getDb();
    const doc = await db.collection('groups').doc(groupId).get();
    if (!doc.exists) return null;
    return dbAdapter.serialize({ id: doc.id, ...doc.data() } as Group);
}

// ── 4. joinGroupAction ────────────────────────────────────────────────────────

export async function joinGroupAction(groupId: string): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) throw new Error('Group not found');

    try {
        await groupRef.collection('members').doc(uid).create({
            joinedAt: new Date().toISOString(),
            role: 'member',
        });
        await groupRef.update({ memberCount: FieldValue.increment(1) });
    } catch {
        // Already a member — create fails if doc exists, skip
        return;
    }

    await db.collection('users').doc(uid).update({
        groupIds: FieldValue.arrayUnion(groupId),
    });

    logger.info(`joinGroup: uid=${uid}, groupId=${groupId}`);
}

// ── 5. leaveGroupAction ──────────────────────────────────────────────────────

export async function leaveGroupAction(groupId: string): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const groupRef = db.collection('groups').doc(groupId);
    const memberRef = groupRef.collection('members').doc(uid);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) return; // Not a member — idempotent

    await memberRef.delete();
    await db.runTransaction(async (t) => {
        const groupDoc = await t.get(groupRef);
        if (!groupDoc.exists) return;
        const current = groupDoc.data()?.memberCount ?? 0;
        if (current > 0) {
            t.update(groupRef, { memberCount: FieldValue.increment(-1) });
        }
    });
    await db.collection('users').doc(uid).update({
        groupIds: FieldValue.arrayRemove(groupId),
    });

    logger.info(`leaveGroup: uid=${uid}, groupId=${groupId}`);
}

// ── 6. getGroupPostsAction ───────────────────────────────────────────────────

export async function getGroupPostsAction(
    groupId: string,
    limit = 20,
    startAfter?: string,
): Promise<GroupPost[]> {
    const db = await getDb();

    let query = db
        .collection('groups')
        .doc(groupId)
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(limit);

    if (startAfter) {
        const cursorDoc = await db
            .collection('groups')
            .doc(groupId)
            .collection('posts')
            .doc(startAfter)
            .get();
        if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
        }
    }

    const snap = await query.get();
    const posts: GroupPost[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    } as GroupPost));

    return dbAdapter.serialize(posts);
}

// ── 7. createGroupPostAction ─────────────────────────────────────────────────

export async function createGroupPostAction(
    groupId: string,
    content: string,
    postType: PostType,
    attachments: PostAttachment[] = [],
): Promise<string> {
    const uid = await getAuthUserId();
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // Membership check
    const memberSnap = await db.collection('groups').doc(groupId).collection('members').doc(uid).get();
    if (!memberSnap.exists) throw new Error('Not a member of this group');

    // Validate
    if (!content || content.length > 2000) {
        throw new Error('Post content must be between 1 and 2000 characters');
    }
    if (!VALID_POST_TYPES.includes(postType)) {
        throw new Error(`Invalid post type: ${postType}`);
    }
    if (attachments.length > 5) throw new Error('Too many attachments');

    // Fetch author profile
    const author = await dbAdapter.getUser(uid);
    const authorName = author?.displayName ?? 'Teacher';
    const authorPhotoURL = author?.photoURL ?? null;

    const postData: Omit<GroupPost, 'id'> = {
        groupId,
        authorUid: uid,
        authorName,
        authorPhotoURL,
        content,
        postType,
        attachments,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
    };

    const postRef = await db
        .collection('groups')
        .doc(groupId)
        .collection('posts')
        .add(postData);

    // Update group's lastActivityAt
    await db.collection('groups').doc(groupId).update({
        lastActivityAt: FieldValue.serverTimestamp(),
    });

    logger.info(`createGroupPost: uid=${uid}, groupId=${groupId}, postId=${postRef.id}`);
    return postRef.id;
}

// ── 8. likeGroupPostAction ───────────────────────────────────────────────────

export async function likeGroupPostAction(
    groupId: string,
    postId: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    const uid = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // Membership check
    const memberSnap = await db.collection('groups').doc(groupId).collection('members').doc(uid).get();
    if (!memberSnap.exists) throw new Error('Not a member of this group');

    const postRef = db
        .collection('groups')
        .doc(groupId)
        .collection('posts')
        .doc(postId);

    const likeRef = postRef.collection('likes').doc(uid);
    const likeDoc = await likeRef.get();

    let isLiked: boolean;
    if (likeDoc.exists) {
        // Unlike
        await likeRef.delete();
        await postRef.update({ likesCount: FieldValue.increment(-1) });
        isLiked = false;
    } else {
        // Like
        await likeRef.set({ uid, likedAt: new Date().toISOString() });
        await postRef.update({ likesCount: FieldValue.increment(1) });
        isLiked = true;
    }

    const updatedPost = await postRef.get();
    const newCount = updatedPost.data()?.likesCount ?? 0;

    return { isLiked, newCount };
}

// ── 9. sendGroupChatMessageAction ────────────────────────────────────────────

export async function sendGroupChatMessageAction(
    groupId: string,
    text: string,
    audioUrl?: string,
): Promise<string> {
    const uid = await getAuthUserId();
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(uid);

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // Membership check
    const memberSnap = await db.collection('groups').doc(groupId).collection('members').doc(uid).get();
    if (!memberSnap.exists) throw new Error('Not a member of this group');

    // Validate
    if (!text && !audioUrl) {
        throw new Error('Message must contain text or audio');
    }
    if (text && text.length > 500) {
        throw new Error('Message text must be 500 characters or less');
    }
    if (audioUrl && !audioUrl.startsWith('https://firebasestorage.googleapis.com/')) {
        throw new Error('Invalid audio URL');
    }

    // Fetch author profile
    const author = await dbAdapter.getUser(uid);
    const authorName = author?.displayName ?? 'Teacher';
    const authorPhotoURL = author?.photoURL ?? null;

    const messageData: Omit<GroupChatMessage, 'id'> = {
        groupId,
        text: text || '',
        ...(audioUrl ? { audioUrl } : {}),
        authorId: uid,
        authorName,
        authorPhotoURL,
        createdAt: FieldValue.serverTimestamp(),
    };

    const msgRef = await db
        .collection('groups')
        .doc(groupId)
        .collection('chat')
        .add(messageData);

    await db.collection('groups').doc(groupId).update({
        lastActivityAt: FieldValue.serverTimestamp(),
    });

    logger.info(`sendGroupChat: uid=${uid}, groupId=${groupId}, msgId=${msgRef.id}`);

    // Fire-and-forget: trigger AI reactive reply for group chat
    import('@/lib/ai-reactive-trigger').then(({ triggerAIReactiveReply }) => {
        triggerAIReactiveReply(`groups/${groupId}/chat`, text || '', authorName);
    }).catch(() => {});

    return msgRef.id;
}

// ── 10. discoverGroupsAction ─────────────────────────────────────────────────

export async function discoverGroupsAction(): Promise<Group[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    const profile = userDoc.data() ?? {};
    const myGroupIds: string[] = profile.groupIds ?? [];
    const myGroupSet = new Set(myGroupIds);

    const subjects: string[] = profile.subjects ?? [];
    const grades: string[] = profile.gradeLevels ?? [];
    const state: string = profile.state ?? '';

    // Fetch top groups by member count
    const snap = await db
        .collection('groups')
        .orderBy('memberCount', 'desc')
        .limit(50)
        .get();

    const candidates: (Group & { score: number })[] = [];

    for (const doc of snap.docs) {
        if (myGroupSet.has(doc.id)) continue;
        const group = { id: doc.id, ...doc.data() } as Group;
        let score = 0;

        const rules = group.autoJoinRules ?? {};
        // Subject match
        if (rules.subjects?.some(s => subjects.includes(s))) score += 3;
        // Grade match
        if (rules.grades?.some(g => grades.includes(g))) score += 2;
        // State match
        if (rules.state && rules.state === state) score += 2;
        // Popularity boost
        score += Math.min(group.memberCount / 100, 1);

        candidates.push({ ...group, score });
    }

    // Sort by relevance score desc, take top 10
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, 10).map(({ score: _score, ...group }) => group);

    return dbAdapter.serialize(top);
}

// ── 11. getUnifiedFeedAction ─────────────────────────────────────────────────

export async function getUnifiedFeedAction(
    limit = 20,
    startAfterTimestamp?: string,
): Promise<FeedItem[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    const groupIds: string[] = userDoc.data()?.groupIds ?? [];

    if (groupIds.length === 0) return [];

    // Fetch latest posts from each group in parallel
    const postsPerGroup = Math.max(5, Math.ceil(limit / groupIds.length));
    const postPromises = groupIds.map(async (groupId) => {
        let query = db
            .collection('groups')
            .doc(groupId)
            .collection('posts')
            .orderBy('createdAt', 'desc')
            .limit(postsPerGroup);

        if (startAfterTimestamp) {
            query = query.where('createdAt', '<', startAfterTimestamp);
        }

        const snap = await query.get();
        // Also fetch group name
        const groupDoc = await db.collection('groups').doc(groupId).get();
        const groupName = groupDoc.data()?.name ?? groupId;

        return snap.docs.map(doc => ({
            post: { id: doc.id, ...doc.data() } as GroupPost,
            groupId,
            groupName,
        }));
    });

    const results = await Promise.all(postPromises);
    const allPosts = results.flat();

    // Sort by createdAt desc and take top N
    const toStr = (v: unknown) => typeof v === 'string' ? v : (v as any)?.toDate?.().toISOString?.() ?? '';
    allPosts.sort((a, b) => toStr(b.post.createdAt).localeCompare(toStr(a.post.createdAt)));
    const topPosts = allPosts.slice(0, limit);

    const feedItems: FeedItem[] = topPosts.map(({ post, groupId, groupName }) => ({
        id: `gp_${post.id}`,
        type: 'group_post' as const,
        groupId,
        groupName,
        timestamp: post.createdAt,
        post,
    }));

    return dbAdapter.serialize(feedItems);
}
