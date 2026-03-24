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

            if (!groupDoc.exists) {
                const boardLabel = board || 'All Boards';
                const groupData: Omit<Group, 'id'> = {
                    name: `${grade} ${subject} — ${boardLabel}`,
                    description: `Teachers teaching ${subject} to ${grade} students (${boardLabel})`,
                    type: 'subject_grade',
                    coverColor: getGroupColor(`${subject}_${grade}`),
                    memberCount: 1,
                    autoJoinRules: {
                        subjects: [subject],
                        grades: [grade],
                        ...(board ? { board } : {}),
                    },
                    lastActivityAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                };
                await groupRef.set(groupData);
            } else {
                // Group exists, check membership
                const memberDoc = await groupRef.collection('members').doc(uid).get();
                if (memberDoc.exists) {
                    existingSet.add(groupId);
                    continue;
                }
                await groupRef.update({ memberCount: FieldValue.increment(1) });
            }

            await groupRef.collection('members').doc(uid).set({
                uid,
                joinedAt: new Date().toISOString(),
                role: 'member',
            });
            newGroupIds.push(groupId);
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
                    memberCount: 1,
                    autoJoinRules: { school: schoolName },
                    lastActivityAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                });
            } else {
                const memberDoc = await groupRef.collection('members').doc(uid).get();
                if (!memberDoc.exists) {
                    await groupRef.update({ memberCount: FieldValue.increment(1) });
                }
            }

            const memberDoc = await groupRef.collection('members').doc(uid).get();
            if (!memberDoc.exists) {
                await groupRef.collection('members').doc(uid).set({
                    uid,
                    joinedAt: new Date().toISOString(),
                    role: 'member',
                });
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
                    memberCount: 1,
                    autoJoinRules: { state },
                    lastActivityAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                });
            } else {
                const memberDoc = await groupRef.collection('members').doc(uid).get();
                if (!memberDoc.exists) {
                    await groupRef.update({ memberCount: FieldValue.increment(1) });
                }
            }

            const memberDoc = await groupRef.collection('members').doc(uid).get();
            if (!memberDoc.exists) {
                await groupRef.collection('members').doc(uid).set({
                    uid,
                    joinedAt: new Date().toISOString(),
                    role: 'member',
                });
                newGroupIds.push(stateGroupId);
            }
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
    groups.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));

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

    const memberRef = groupRef.collection('members').doc(uid);
    const memberDoc = await memberRef.get();
    if (memberDoc.exists) return; // Already a member — idempotent

    await memberRef.set({
        uid,
        joinedAt: new Date().toISOString(),
        role: 'member',
    });

    await groupRef.update({ memberCount: FieldValue.increment(1) });
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
    await groupRef.update({ memberCount: FieldValue.increment(-1) });
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

    // Validate
    if (!content || content.length > 2000) {
        throw new Error('Post content must be between 1 and 2000 characters');
    }
    if (!VALID_POST_TYPES.includes(postType)) {
        throw new Error(`Invalid post type: ${postType}`);
    }

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

    // Validate
    if (!text && !audioUrl) {
        throw new Error('Message must contain text or audio');
    }
    if (text && text.length > 500) {
        throw new Error('Message text must be 500 characters or less');
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
    allPosts.sort((a, b) => (b.post.createdAt ?? '').localeCompare(a.post.createdAt ?? ''));
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
