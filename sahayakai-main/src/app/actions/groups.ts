'use server';

import { getDb } from '@/lib/firebase-admin';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
import { requireAuth, requireGroupMember } from '@/lib/auth-helpers';
import { createNotification } from '@/lib/notifications/create';
import { NEW_GROUP_POST, GROUP_POST_LIKE } from '@/lib/notifications/types';
import { formatNotificationMessage } from '@/lib/notifications/i18n';
import { sendPushToUser } from '@/lib/fcm-server';
import type { Language } from '@/types';
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
// `getAuthUserId` is kept as a local alias so call sites read naturally.
// All new actions should call `requireAuth` directly.

const getAuthUserId = requireAuth;

// ── Error helpers ─────────────────────────────────────────────────────────────
// Firestore Admin SDK throws errors with `.code` (gRPC status code) on
// document collisions. Code 6 = ALREADY_EXISTS. We must distinguish this
// expected race ("already a member") from real failures (quota, permission,
// network) so the latter surface to the client instead of being silently
// swallowed as "joined".
function isAlreadyExistsError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: number | string; message?: string };
    if (e.code === 6 || e.code === 'already-exists') return true;
    if (typeof e.message === 'string' && /already exists/i.test(e.message)) return true;
    return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeKey(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

const VALID_POST_TYPES: PostType[] = ['share', 'ask_help', 'celebrate', 'resource'];

// ── 1. ensureUserGroupsAction ─────────────────────────────────────────────────

export async function ensureUserGroupsAction(): Promise<string[]> {
    const uid = await getAuthUserId();
    try {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const now = new Date().toISOString();

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error('User profile not found');
    const profile = userDoc.data()!;

    // Short-circuit if groups already initialized (1 read instead of 16+)
    if (profile.groupsInitialized === true) {
        return profile.groupIds ?? [];
    }

    const subjects: string[] = profile.subjects ?? [];
    const gradeLevels: string[] = profile.gradeLevels ?? [];
    const schoolName: string = profile.schoolName ?? '';
    const board: string = profile.educationBoard ?? '';
    const state: string = profile.state ?? '';

    const existingGroupIds: string[] = profile.groupIds ?? [];
    const existingSet = new Set(existingGroupIds);
    const newGroupIds: string[] = [];

    // Subject+grade groups: create ALL so they're discoverable, but only
    // auto-join the FIRST (subject[0] × gradeLevels[0]). Extra subject-grade
    // matches surface in "Discover Groups" for the teacher to opt into —
    // otherwise a teacher with 5 subjects × 6 grades wakes up in 30 groups
    // and the sidebar becomes noise.
    const MAX_SUBJECT_GRADE_AUTO_JOINS = 1;
    let subjectGradeAutoJoins = 0;
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

            // Cap: only auto-join the first subject-grade combination.
            // The rest remain visible in Discover Groups for opt-in.
            if (subjectGradeAutoJoins >= MAX_SUBJECT_GRADE_AUTO_JOINS) continue;

            try {
                await groupRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
                await groupRef.update({ memberCount: FieldValue.increment(1) });
                newGroupIds.push(groupId);
                subjectGradeAutoJoins++;
            } catch (err) {
                if (isAlreadyExistsError(err)) {
                    // Expected race — user already a member of this auto-group.
                    newGroupIds.push(groupId);
                    subjectGradeAutoJoins++;
                } else {
                    // Real failure — log and skip. Do NOT push to newGroupIds
                    // (would create a phantom membership in the user's groupIds
                    // array that the server-side check would later reject).
                    logger.error('ensureUserGroups: subject-grade auto-join failed', err, 'COMMUNITY', { uid, groupId });
                }
            }
        }
    }

    // School group — create if needed but do NOT auto-join (privacy: opt-in only)
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
            // School groups are opt-in — teacher joins via community page prompt
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
            } catch (err) {
                if (isAlreadyExistsError(err)) {
                    newGroupIds.push(stateGroupId);
                } else {
                    logger.error('ensureUserGroups: state auto-join failed', err, 'COMMUNITY', { uid, stateGroupId });
                }
            }
        }
    }

    // Auto-join "Daily Briefing" group (curated education news for all users)
    const briefingGroupId = 'daily_briefing';
    if (!existingSet.has(briefingGroupId)) {
        const briefingRef = db.collection('groups').doc(briefingGroupId);
        const briefingDoc = await briefingRef.get();

        if (!briefingDoc.exists) {
            await briefingRef.set({
                name: 'Daily Briefing',
                description: 'Your morning education briefing — CBSE & ICSE circulars, AI in education news, and policy updates curated daily by SahayakAI.',
                type: 'interest' as const,
                coverColor: 'linear-gradient(135deg, #f97316, #6366f1)',
                memberCount: 0,
                autoJoinRules: {},
                lastActivityAt: FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString(),
                createdBy: 'system',
                isSystem: true,
            });
        }

        try {
            await briefingRef.collection('members').doc(uid).create({ joinedAt: now, role: 'member' });
            await briefingRef.update({ memberCount: FieldValue.increment(1) });
            newGroupIds.push(briefingGroupId);
        } catch (err) {
            if (isAlreadyExistsError(err)) {
                newGroupIds.push(briefingGroupId);
            } else {
                logger.error('ensureUserGroups: briefing auto-join failed', err, 'COMMUNITY', { uid });
            }
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
        } catch (err) {
            if (isAlreadyExistsError(err)) {
                newGroupIds.push(communityGroupId);
            } else {
                logger.error('ensureUserGroups: community auto-join failed', err, 'COMMUNITY', { uid });
            }
        }
    }

    // Persist groupIds + mark initialized on user doc
    const updateData: Record<string, any> = { groupsInitialized: true };
    if (newGroupIds.length > 0) {
        updateData.groupIds = FieldValue.arrayUnion(...newGroupIds);
    }
    await db.collection('users').doc(uid).update(updateData);

    const allGroupIds = [...existingGroupIds, ...newGroupIds];
    logger.info(`ensureUserGroups: uid=${uid}, existing=${existingGroupIds.length}, new=${newGroupIds.length}`);
    return allGroupIds;
    } catch (err) {
        logger.error('ensureUserGroupsAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 2. getMyGroupsAction ──────────────────────────────────────────────────────

export async function getMyGroupsAction(): Promise<Group[]> {
    const uid = await getAuthUserId();
    try {
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
    } catch (err) {
        logger.error('getMyGroupsAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 3. getGroupAction ─────────────────────────────────────────────────────────

/**
 * F10-06 (design choice, 2026-06-06): non-members CAN read group metadata via
 * this action. This is intentional — group discovery (browse/join) needs to
 * surface name, description, member count, and topics to teachers who are not
 * yet members. Anything sensitive (chat messages, member email list, draft
 * posts) lives in subcollections that are gated by separate per-collection
 * action handlers + Firestore rules requiring `requireGroupMember`. If at any
 * point the top-level `groups/{groupId}` doc starts carrying member-only data,
 * add a `requireGroupMember` check here.
 */
export async function getGroupAction(groupId: string): Promise<Group | null> {
    const uid = await requireAuth();
    try {
        const db = await getDb();
        const doc = await db.collection('groups').doc(groupId).get();
        if (!doc.exists) return null;
        return dbAdapter.serialize({ id: doc.id, ...doc.data() } as Group);
    } catch (err) {
        logger.error('getGroupAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 4. joinGroupAction ────────────────────────────────────────────────────────

/**
 * Join a group. Returns `{ joined: true }` on first join, `{ joined: false }`
 * if the user was already a member (idempotent). Real Firestore errors
 * (permission, quota, network) propagate to the caller — previously they
 * were silently swallowed as "already a member" so the UI toasted "Joined"
 * for every failure.
 */
export async function joinGroupAction(groupId: string): Promise<{ joined: boolean }> {
    const uid = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const groupRef = db.collection('groups').doc(groupId);
    const memberRef = groupRef.collection('members').doc(uid);
    const userRef = db.collection('users').doc(uid);

    // Wave 2b: wrap member-create + memberCount-increment + user.groupIds-update
    // in a single Firestore transaction so a partial failure can't leave the
    // system in an inconsistent state (member doc exists but count not bumped,
    // or vice versa, or count bumped but user.groupIds not updated). Previously
    // these were three separate writes; if any failed, the user's "groups"
    // listing diverged from the actual members subcollection.
    let joined = false;
    try {
        await db.runTransaction(async (t) => {
            const [groupSnap, memberSnap] = await Promise.all([
                t.get(groupRef),
                t.get(memberRef),
            ]);
            if (!groupSnap.exists) throw new Error('Group not found');
            if (memberSnap.exists) {
                // Already a member — only ensure the user doc cache reflects it.
                t.update(userRef, { groupIds: FieldValue.arrayUnion(groupId) });
                return;
            }
            t.set(memberRef, { joinedAt: new Date().toISOString(), role: 'member' });
            t.update(groupRef, { memberCount: FieldValue.increment(1) });
            t.update(userRef, { groupIds: FieldValue.arrayUnion(groupId) });
            joined = true;
        });
    } catch (err) {
        if (isAlreadyExistsError(err)) {
            // Belt-and-braces — Firestore is unlikely to surface this from a
            // transaction (we already checked memberSnap.exists), but if it
            // does, treat as idempotent success.
            joined = false;
        } else {
            logger.error('joinGroupAction failed', err, 'GROUPS', { userId: uid });
            throw err;
        }
    }

    logger.info(`joinGroup: uid=${uid}, groupId=${groupId}, joined=${joined}`);
    return { joined };
}

// ── 5. leaveGroupAction ──────────────────────────────────────────────────────

export async function leaveGroupAction(groupId: string): Promise<void> {
    const uid = await getAuthUserId();
    try {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const groupRef = db.collection('groups').doc(groupId);
    const memberRef = groupRef.collection('members').doc(uid);
    const userRef = db.collection('users').doc(uid);

    // Wave 2b: single transaction across delete-member + decrement-count +
    // user.groupIds-remove. Previously the delete happened OUTSIDE the
    // transaction, so a transaction-rollback could leave the member doc
    // deleted but the count unchanged.
    await db.runTransaction(async (t) => {
        const [groupSnap, memberSnap] = await Promise.all([
            t.get(groupRef),
            t.get(memberRef),
        ]);
        if (!memberSnap.exists) return; // idempotent — already not a member
        t.delete(memberRef);
        if (groupSnap.exists) {
            const current = groupSnap.data()?.memberCount ?? 0;
            if (current > 0) {
                t.update(groupRef, { memberCount: FieldValue.increment(-1) });
            }
        }
        t.update(userRef, { groupIds: FieldValue.arrayRemove(groupId) });
    });

    logger.info(`leaveGroup: uid=${uid}, groupId=${groupId}`);
    } catch (err) {
        logger.error('leaveGroupAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 6. getGroupPostsAction ───────────────────────────────────────────────────

export async function getGroupPostsAction(
    groupId: string,
    limit = 20,
    startAfter?: string,
): Promise<GroupPost[]> {
    // Authz: only members of the group may read its posts. Throws ForbiddenError
    // if the caller is signed in but not a member, UnauthorizedError if missing
    // the x-user-id header.
    const uid = await requireGroupMember(groupId);
    try {
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
    } catch (err) {
        logger.error('getGroupPostsAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 7. createGroupPostAction ─────────────────────────────────────────────────

export async function createGroupPostAction(
    groupId: string,
    content: string,
    postType: PostType,
    attachments: PostAttachment[] = [],
): Promise<string> {
    const uid = await getAuthUserId();
    try {
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

    // Fire-and-forget notification fanout. Do NOT await — this can touch up
    // to GROUP_POST_FANOUT_CAP recipient docs and we don't want the post
    // create to block on it. Errors are swallowed (logged) so a fanout
    // failure can never cause the post itself to roll back from the
    // caller's POV.
    void fanoutGroupPostNotifications({
        groupId,
        postId: postRef.id,
        authorUid: uid,
        authorName,
    }).catch((err) => {
        logger.error('createGroupPost: fanout failed', err, 'COMMUNITY', {
            groupId,
            postId: postRef.id,
        });
    });

    return postRef.id;
    } catch (err) {
        logger.error('createGroupPostAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 8. likeGroupPostAction ───────────────────────────────────────────────────

export async function likeGroupPostAction(
    groupId: string,
    postId: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    const uid = await getAuthUserId();
    try {
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

    // F5-002 fix: wrap the read-decide-write in a transaction. The previous
    // implementation pre-read `likeRef.exists` outside the write — concurrent
    // double-taps from the same client (or retried RPCs) could both observe
    // `!exists`, both set the like-doc (idempotent), and both fire
    // `FieldValue.increment(+1)`, inflating `likesCount` by N while only one
    // like-doc lands. The transaction retries on contention so the final
    // counter delta is always +1 or 0.
    const isLiked = await db.runTransaction(async (tx) => {
        const likeDoc = await tx.get(likeRef);
        if (likeDoc.exists) {
            tx.delete(likeRef);
            tx.update(postRef, { likesCount: FieldValue.increment(-1) });
            return false;
        } else {
            tx.set(likeRef, { uid, likedAt: new Date().toISOString() });
            tx.update(postRef, { likesCount: FieldValue.increment(1) });
            return true;
        }
    });

    const updatedPost = await postRef.get();
    const newCount = updatedPost.data()?.likesCount ?? 0;

    // Fire-and-forget like notification (only on transition to liked, not unlike).
    // Skips self-likes and dedup-suppressed events inside the helper.
    if (isLiked) {
        const post = updatedPost.data() ?? {};
        const authorUid = post.authorUid as string | undefined;
        if (authorUid && authorUid !== uid) {
            void notifyGroupPostLike({
                groupId,
                postId,
                postAuthorUid: authorUid,
                likerUid: uid,
            }).catch((err) => {
                logger.error('likeGroupPost: notify failed', err, 'COMMUNITY', {
                    groupId,
                    postId,
                });
            });
        }
    }

    return { isLiked, newCount };
    } catch (err) {
        logger.error('likeGroupPostAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 9. sendGroupChatMessageAction ────────────────────────────────────────────

export async function sendGroupChatMessageAction(
    groupId: string,
    text: string,
    audioUrl?: string,
): Promise<string> {
    const uid = await getAuthUserId();
    try {
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
    } catch (err) {
        logger.error('sendGroupChatMessageAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 10. discoverGroupsAction ─────────────────────────────────────────────────

export async function discoverGroupsAction(): Promise<Group[]> {
    const uid = await getAuthUserId();
    try {
    const db = await getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    const profile = userDoc.data() ?? {};
    const myGroupIds: string[] = profile.groupIds ?? [];
    const myGroupSet = new Set(myGroupIds);

    const subjects: string[] = profile.subjects ?? [];
    const grades: string[] = profile.gradeLevels ?? [];
    const state: string = profile.state ?? '';
    const schoolName: string = profile.schoolName ?? '';

    // Fetch top groups by member count
    const snap = await db
        .collection('groups')
        .orderBy('memberCount', 'desc')
        .limit(50)
        .get();

    const candidates: (Group & { score: number })[] = [];
    const fetchedIds = new Set(snap.docs.map(d => d.id));

    // Ensure the user's school group is included even if not in top 50
    if (schoolName) {
        const schoolGroupId = `school_${normalizeKey(schoolName)}`;
        if (!myGroupSet.has(schoolGroupId) && !fetchedIds.has(schoolGroupId)) {
            const schoolDoc = await db.collection('groups').doc(schoolGroupId).get();
            if (schoolDoc.exists) {
                const group = { id: schoolDoc.id, ...schoolDoc.data() } as Group;
                candidates.push({ ...group, score: 10 }); // High score for own school
            }
        }
    }

    for (const doc of snap.docs) {
        if (myGroupSet.has(doc.id)) continue;
        const group = { id: doc.id, ...doc.data() } as Group;
        let score = 0;

        const rules = group.autoJoinRules ?? {};
        // School match (highest priority — opt-in prompt)
        if (rules.school && schoolName && normalizeKey(rules.school) === normalizeKey(schoolName)) score += 10;
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
    } catch (err) {
        logger.error('discoverGroupsAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── 11. getUnifiedFeedAction ─────────────────────────────────────────────────

export async function getUnifiedFeedAction(
    limit = 20,
    startAfterTimestamp?: string,
): Promise<FeedItem[]> {
    const uid = await getAuthUserId();
    try {
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
    } catch (err) {
        logger.error('getUnifiedFeedAction failed', err, 'GROUPS', { userId: uid });
        throw err;
    }
}

// ── Notification fanout helpers ──────────────────────────────────────────────

/**
 * Max recipients we'll fan a single group-post notification out to. Above
 * this threshold we'd be writing thousands of notification docs per post
 * for popular groups (e.g. `community_general`, `daily_briefing`), which
 * pummels Firestore write quota AND fills the recipient inbox UI with
 * near-duplicate items. The over-cap path falls back to a coarser
 * "X new posts in <group>" digest notification (TODO: hook into the
 * scheduled digest job once that lands; for now we trim + log a metric).
 */
const GROUP_POST_FANOUT_CAP = 200;

/** Skip a like notification if the author already got one for this post
 *  within this window. Prevents notification spam from like-storms. */
const GROUP_POST_LIKE_DEDUP_MS = 60 * 60 * 1000; // 1 hour

interface GroupPostFanoutArgs {
    groupId: string;
    postId: string;
    authorUid: string;
    authorName: string;
}

/**
 * Fan a NEW_GROUP_POST notification out to every member of the group
 * (except the author). Uses the `groups/{groupId}/members` subcollection
 * as the canonical store — `users.groupIds` is a denormalized cache and
 * may lag the membership doc by a transaction boundary.
 *
 * Per-recipient i18n: we read each recipient's `preferredLanguage` from
 * their user doc and pick the template from `notifications/i18n.ts`.
 *
 * Exported for unit testing only — call sites should go through
 * `createGroupPostAction`.
 */
export async function fanoutGroupPostNotifications(
    args: GroupPostFanoutArgs,
): Promise<{ recipients: number; capped: boolean }> {
    const { groupId, postId, authorUid, authorName } = args;
    const db = await getDb();

    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
        logger.warn(`fanoutGroupPost: group not found groupId=${groupId}`);
        return { recipients: 0, capped: false };
    }
    const groupName = (groupDoc.data()?.name as string) ?? groupId;

    // F6-06 fix: previously we did `.limit(CAP+1)` without orderBy and sliced
    // the first CAP. Firestore returned by __name__ (uid) order, so the bottom
    // of the alphabet was systemically starved in big groups. We now pull the
    // full member list (cost is bounded — a Firestore `members` subcollection
    // for one group is small enough to scan), JS-shuffle, then slice to CAP.
    // Each over-cap fan-out is now a uniform sample of group members.
    const membersSnap = await db
        .collection('groups')
        .doc(groupId)
        .collection('members')
        .get();

    const memberIds = membersSnap.docs
        .map((d) => d.id)
        .filter((id) => id !== authorUid);

    const capped = memberIds.length > GROUP_POST_FANOUT_CAP;
    let recipients = memberIds;
    if (capped) {
        // Fisher-Yates shuffle then slice.
        const shuffled = [...memberIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        recipients = shuffled.slice(0, GROUP_POST_FANOUT_CAP);
    }

    if (capped) {
        logger.warn(
            `fanoutGroupPost: cap hit groupId=${groupId} memberCount=${memberIds.length} cap=${GROUP_POST_FANOUT_CAP}`,
        );
    }

    if (recipients.length === 0) {
        return { recipients: 0, capped };
    }

    // Per-recipient language lookup, chunked at Firestore `in` limit of 10.
    const langByUid = new Map<string, Language | undefined>();
    for (let i = 0; i < recipients.length; i += 10) {
        const chunk = recipients.slice(i, i + 10);
        try {
            const userSnap = await db
                .collection('users')
                .where('__name__', 'in', chunk)
                .get();
            for (const doc of userSnap.docs) {
                const data = doc.data();
                langByUid.set(doc.id, data?.preferredLanguage as Language | undefined);
            }
        } catch (err) {
            logger.warn(
                `fanoutGroupPost: user lookup chunk failed groupId=${groupId} err=${(err as Error)?.message ?? err}`,
            );
        }
    }

    const link = `/groups/${groupId}?post=${postId}`;
    const metadata = { groupId, postId, authorUid };

    // F6-07 fix: previously a serial `for...await` made ~200 Firestore
    // round-trips before the action returned. We now run writes in parallel
    // with a small concurrency cap so the post-action latency is ~O(CAP/conc)
    // round-trips instead of O(CAP). Cap 25 keeps us well under any per-uid
    // burst quota and matches what messages.ts uses elsewhere.
    //
    // F6-13 fix: each recipient also gets an FCM push (fire-and-forget) so
    // backgrounded apps surface the notification at OS level — bringing this
    // type to parity with 1:1 messages.
    const CONCURRENCY = 25;
    let written = 0;
    const writeOne = async (recipientId: string): Promise<void> => {
        const lang = langByUid.get(recipientId);
        const message = formatNotificationMessage('group_post', lang, {
            name: authorName,
            group: groupName,
        });
        try {
            await createNotification({
                recipientId,
                type: NEW_GROUP_POST,
                title: groupName,
                message,
                senderId: authorUid,
                senderName: authorName,
                link,
                metadata,
            });
            written++;
            void sendPushToUser(
                recipientId,
                { title: groupName, body: message },
                { link, type: NEW_GROUP_POST, groupId, postId },
            );
        } catch (err) {
            logger.error(
                'fanoutGroupPost: createNotification failed',
                err,
                'COMMUNITY',
                { recipientId, groupId, postId },
            );
        }
    };
    // Process in waves of CONCURRENCY using Promise.all on each chunk.
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
        const chunk = recipients.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(writeOne));
    }

    logger.info(
        `fanoutGroupPost: groupId=${groupId} postId=${postId} written=${written}/${recipients.length} capped=${capped}`,
    );

    return { recipients: written, capped };
}

interface GroupPostLikeNotifyArgs {
    groupId: string;
    postId: string;
    postAuthorUid: string;
    likerUid: string;
}

/**
 * Send a GROUP_POST_LIKE notification to the post author. Skips:
 *   - self-likes
 *   - dedup: any like notification on the same post sent to the same
 *     recipient within GROUP_POST_LIKE_DEDUP_MS (1 hour)
 *
 * Per-recipient i18n: reads the author's preferredLanguage; falls back
 * to English.
 *
 * Exported for unit testing only — call sites should go through
 * `likeGroupPostAction`.
 */
export async function notifyGroupPostLike(
    args: GroupPostLikeNotifyArgs,
): Promise<{ sent: boolean; reason?: 'self' | 'deduped' }> {
    const { groupId, postId, postAuthorUid, likerUid } = args;
    if (likerUid === postAuthorUid) return { sent: false, reason: 'self' };

    const db = await getDb();

    // F6-08 fix: previously this probe scanned the recipient's last 20 likes
    // of any post and filtered in-memory by postId. A prolific author with
    // >20 likes/hour across other posts would push the relevant postId out of
    // the probe window, so genuine duplicate likes on the SAME post got
    // through. We now query directly on `metadata.postId` so the probe is
    // post-scoped (composite index recipientId + type + metadata.postId is
    // optional — without it Firestore falls through to the catch and we
    // gracefully default to over-deliver, which matches the dedup contract).
    try {
        const recent = await db
            .collection('notifications')
            .where('recipientId', '==', postAuthorUid)
            .where('type', '==', GROUP_POST_LIKE)
            .where('metadata.postId', '==', postId)
            .limit(20)
            .get();
        const cutoff = Date.now() - GROUP_POST_LIKE_DEDUP_MS;
        for (const doc of recent.docs) {
            const data = doc.data() ?? {};
            const createdAt = Date.parse(data.createdAt ?? '');
            if (Number.isFinite(createdAt) && createdAt >= cutoff) {
                return { sent: false, reason: 'deduped' };
            }
        }
    } catch (err) {
        // Don't block notification on probe failure — over-notifying is a
        // softer failure than under-notifying.
        logger.warn(
            `notifyGroupPostLike: dedup probe failed groupId=${groupId} err=${(err as Error)?.message ?? err}`,
        );
    }

    const [likerDoc, authorDoc] = await Promise.all([
        db.collection('users').doc(likerUid).get(),
        db.collection('users').doc(postAuthorUid).get(),
    ]);
    const likerName = (likerDoc.data()?.displayName as string) ?? 'A teacher';
    const likerPhotoURL = (likerDoc.data()?.photoURL as string) ?? undefined;
    const recipientLang = authorDoc.data()?.preferredLanguage as Language | undefined;

    const message = formatNotificationMessage('group_post_like', recipientLang, {
        name: likerName,
    });

    const likeLink = `/groups/${groupId}?post=${postId}`;
    await createNotification({
        recipientId: postAuthorUid,
        type: GROUP_POST_LIKE,
        title: likerName,
        message,
        senderId: likerUid,
        senderName: likerName,
        senderPhotoURL: likerPhotoURL,
        link: likeLink,
        metadata: { groupId, postId, likerUid },
    });

    // F6-13 fix: also FCM-push so the post author sees the like at OS level
    // (fire-and-forget; fcm-server swallows internal errors).
    void sendPushToUser(
        postAuthorUid,
        { title: likerName, body: message },
        { link: likeLink, type: GROUP_POST_LIKE, groupId, postId },
    );

    return { sent: true };
}
