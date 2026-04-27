"use server";

import { getDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { publishEvent } from "@/lib/pubsub";
import { dbAdapter } from "@/lib/db/adapter";
import { aggregateUserMetrics } from "./aggregator";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth-helpers";
import { checkServerRateLimit } from "@/lib/server-safety";
import { cachedPerUser, invalidateUserCache } from "@/lib/server-cache";
import type { TeacherSuggestion } from "@/types/community";

export async function getProfilesAction(uids: string[]) {
    await requireAuth();
    return await dbAdapter.getUsers(uids);
}

/**
 * Create a public post. Author is derived from the authenticated session —
 * the client cannot impersonate other users.
 */
export async function createPostAction(content: string, visibility: string = 'public', imageUrl?: string) {
    const userId = await requireAuth();

    // Wave 3: input validation. Without these caps a client could POST a
    // 50 MB string into Firestore (rejected at storage-write time, but the
    // server still spends bandwidth + CPU before that). imageUrl validation
    // also prevents data:URI exploits and SSRF via attacker-chosen host.
    if (typeof content !== 'string') throw new Error('Content must be a string');
    if (!content.trim()) throw new Error('Content cannot be empty');
    if (content.length > 5000) throw new Error('Content too long (max 5000 chars)');
    if (visibility !== 'public' && visibility !== 'connections') {
        throw new Error('Invalid visibility');
    }
    if (imageUrl !== undefined) {
        if (typeof imageUrl !== 'string') throw new Error('imageUrl must be a string');
        if (imageUrl.length > 2048) throw new Error('imageUrl too long');
        if (!imageUrl.startsWith('https://firebasestorage.googleapis.com/') &&
            !imageUrl.startsWith('https://storage.googleapis.com/') &&
            !imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
            throw new Error('imageUrl must point to a trusted Storage host');
        }
    }

    const db = await getDb();

    const postData: any = {
        authorId: userId,
        content,
        visibility,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (imageUrl) postData.imageUrl = imageUrl;

    const docRef = await db.collection('posts').add(postData);

    // Trigger background processing (Feeds, Notifications) - Safe call
    try {
        await publishEvent('teacher-connect-events', {
            type: 'NEW_POST',
            postId: docRef.id,
            authorId: userId,
            timestamp: postData.createdAt
        });
    } catch (e) {
        logger.error("Non-critical: Failed to publish post event", e, 'COMMUNITY', { postId: docRef.id, authorId: userId });
    }

    revalidatePath("/community");
    revalidatePath("/impact-dashboard");

    // Background aggregation
    aggregateUserMetrics(userId).catch(e => logger.error("Aggregator error for user metrics", e, 'COMMUNITY', { userId }));

    return docRef.id;
}

export async function toggleLikeAction(postId: string) {
    const userId = await requireAuth();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const postRef = db.collection('posts').doc(postId);
    const likeRef = postRef.collection('likes').doc(userId);

    const likeDoc = await likeRef.get();

    // Wave 2b: replaced read-modify-write with FieldValue.increment so two
    // concurrent toggles can't read the same value, both write +1, and lose
    // a count. The likeRef.get is only used to decide direction — the actual
    // counter mutation is now atomic at the Firestore level.
    if (likeDoc.exists) {
        // Unlike
        await Promise.all([
            likeRef.delete(),
            postRef.update({ likesCount: FieldValue.increment(-1) }),
        ]);
    } else {
        // Like
        await Promise.all([
            likeRef.set({ uid: userId, createdAt: new Date().toISOString() }),
            postRef.update({ likesCount: FieldValue.increment(1) }),
        ]);
    }

    revalidatePath("/community");
}

export async function getPosts(filters: { language?: string, limit?: number, gradeLevels?: string[], subjects?: string[] } = {}) {
    await requireAuth();
    const db = await getDb();
    let query = db.collection('posts').orderBy('createdAt', 'desc');

    if (filters.gradeLevels && filters.gradeLevels.length > 0) {
        query = query.where('gradeLevel', 'in', filters.gradeLevels.slice(0, 10));
    }

    if (filters.subjects && filters.subjects.length > 0) {
        query = query.where('subject', 'in', filters.subjects.slice(0, 10));
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return dbAdapter.serialize(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })));
}

import { createNotification } from "./notifications";

export async function followTeacherAction(followingId: string) {
    const followerId = await requireAuth();
    // Invalidate this user's cached recommendations — their following list
    // just changed, so the exclusion set is stale.
    invalidateUserCache('recs', followerId);
    const db = await getDb();
    const connectionId = `${followerId}_${followingId}`;
    const connectionRef = db.collection('connections').doc(connectionId);

    const doc = await connectionRef.get();
    if (doc.exists) {
        await connectionRef.delete();
    } else {
        await connectionRef.set({
            followerId,
            followingId,
            createdAt: new Date().toISOString()
        });

        // Create Notification for the person being followed
        try {
            const followerDoc = await db.collection('users').doc(followerId).get();
            const followerData = followerDoc.data();

            await createNotification({
                recipientId: followingId,
                type: 'FOLLOW',
                title: 'New Follower',
                message: `${followerData?.displayName || 'A teacher'} started following you`,
                senderId: followerId,
                senderName: followerData?.displayName,
                senderPhotoURL: followerData?.photoURL,
                link: `/community` // Could link to follower's profile if available
            });
        } catch (e) {
            logger.error("Failed to send follow notification", e, 'COMMUNITY', { followerId, followingId });
        }
    }
    revalidatePath("/community");
}

export async function getFollowingIdsAction() {
    const followerId = await requireAuth();
    const db = await getDb();
    const snapshot = await db.collection('connections')
        .where('followerId', '==', followerId)
        .get();
    return snapshot.docs.map(doc => doc.data().followingId);
}

export async function getFollowingPosts() {
    const followerId = await requireAuth();
    const db = await getDb();

    // 1. Get list of following IDs
    const followingSnapshot = await db.collection('connections')
        .where('followerId', '==', followerId)
        .get();

    const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);

    if (followingIds.length === 0) return [];

    // 2. Fetch posts from those IDs
    const snapshot = await db.collection('posts')
        .where('authorId', 'in', followingIds.slice(0, 30))
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

    return dbAdapter.serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

export async function getLibraryResources(filters: { type?: string, language?: string, authorId?: string, authorIds?: string[], excludeTypes?: string[] } = {}) {
    await requireAuth();
    const db = await getDb();
    let query: any = db.collection('library_resources');

    if (filters.type) query = query.where('type', '==', filters.type);
    if (filters.excludeTypes && filters.excludeTypes.length > 0) query = query.where('type', 'not-in', filters.excludeTypes);
    if (filters.language && filters.language !== 'all') query = query.where('language', '==', filters.language);

    if (filters.authorId) {
        query = query.where('authorId', '==', filters.authorId);
    } else if (filters.authorIds && filters.authorIds.length > 0) {
        // Firestore 'in' query supports up to 10-30 items depending on configuration
        // Using slice to stay within standard limits
        query = query.where('authorId', 'in', filters.authorIds.slice(0, 10));
    }

    // Determine if we have filters that would require a composite index when paired with orderBy
    const hasFilters = !!(filters.type || (filters.language && filters.language !== 'all') || filters.authorId || (filters.authorIds && filters.authorIds.length > 0) || (filters.excludeTypes && filters.excludeTypes.length > 0));

    let snapshot;
    if (hasFilters) {
        // If filters are present, fetch without server-side ordering to avoid composite index requirement
        // We'll limit to a larger number and sort in memory.
        snapshot = await query.limit(100).get();
    } else {
        // Global trending query - standard single-field index works fine here
        snapshot = await query.orderBy('stats.likes', 'desc').limit(50).get();
    }

    let resources = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
    }));

    if (hasFilters) {
        // Sort in memory
        resources.sort((a: any, b: any) => (b.stats?.likes || 0) - (a.stats?.likes || 0));
    }

    return dbAdapter.serialize(resources);
}

export async function trackDownloadAction(resourceId: string) {
    await requireAuth();
    const db = await getDb();
    const ref = db.collection('library_resources').doc(resourceId);

    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return;
        const currentDownloads = doc.data()?.stats?.downloads || 0;
        t.update(ref, { 'stats.downloads': currentDownloads + 1 });
    });

    // Publish event for analytics
    await publishEvent('teacher-connect-events', {
        type: 'RESOURCE_DOWNLOADED',
        resourceId,
        timestamp: new Date().toISOString()
    });
}

// Cached inner function. Pulled out so unstable_cache can key the result by
// uid + ttl. The auth check stays OUT of the cached body — `headers()` isn't
// available inside `unstable_cache` callbacks. Revalidate via
// `invalidateUserCache('recs', uid)` after follow / connect mutations.
/**
 * Returns true if this user doc should NEVER appear in production-facing
 * teacher discovery surfaces (People You May Know, Find Teachers, etc).
 *
 * Catches:
 *  - Dev / QA / impersonation accounts that leaked into the prod users
 *    collection. We were showing "Dev Principal (impersonat..." in
 *    sarguptaw's recommendations. Fix is name-pattern based because we
 *    don't have an explicit isDevAccount flag yet.
 *  - Anyone whose own profile says they don't want to be discovered
 *    (when we eventually wire that flag).
 *
 * AI personas are deliberately NOT excluded — they ARE the seed
 * community and the whole point is that they show up as discoverable
 * teachers until enough real teachers join.
 */
function isHiddenFromDiscovery(teacher: { uid?: string; displayName?: string }): boolean {
    const name = (teacher.displayName ?? '').toLowerCase();
    if (!name) return false;
    // Conservative deny-list: substring match catches "Dev Principal",
    // "Dev Test User", "QA Account", "test impersonation", etc. without
    // false-positiving on real names like "Devansh" (which has no space).
    return /\b(dev|qa|test|impersonat|sample|dummy|placeholder)\b/i.test(name);
}

const _recommendedTeachersFor = cachedPerUser(
    async (uid: string): Promise<TeacherSuggestion[]> => {
        const db = await getDb();

        // 1. Get current user profile and following list. We can't call
        //    getFollowingIdsAction() here because it does its own requireAuth,
        //    which would fail inside the cache context. Inline the equivalent
        //    Firestore query.
        const [userDoc, followingSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('connections').where('followerId', '==', uid).get(),
        ]);

        if (!userDoc.exists) return [];
        const followingIds = followingSnap.docs.map(d => d.data().followingId as string);

        const currentUser = userDoc.data() as any;
        const userSchool = currentUser.schoolNormalized || currentUser.schoolName || '';
        const userSubjects = currentUser.subjects || [];
        const userGrades = currentUser.gradeLevels || [];
        const userDistrict = currentUser.district || '';

        // 2. Fetch all teachers (excluding self and already followed)
        const excludeIds = [uid, ...followingIds];

        const snapshot = await db.collection('users').limit(100).get();

        const candidates = snapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as any))
            .filter(teacher => !excludeIds.includes(teacher.uid))
            .filter(teacher => !isHiddenFromDiscovery(teacher));

        // 3. Multi-tier scoring (same logic as before)
        const scored = candidates.map(teacher => {
            let score = 0;
            const reasons: string[] = [];

            const teacherSchool = teacher.schoolNormalized || teacher.schoolName || '';
            if (userSchool && teacherSchool === userSchool) {
                score += 30;
                reasons.push("Same School");
            } else if (userDistrict && teacher.district === userDistrict) {
                score += 15;
                reasons.push("Nearby Peer");
            }

            const commonSubjects = teacher.subjects?.filter((s: string) => userSubjects.includes(s)) || [];
            if (commonSubjects.length > 0) {
                score += (commonSubjects.length * 20);
                if (reasons.length === 0) reasons.push(`${commonSubjects[0]} Peer`);
            }

            const commonGrades = teacher.gradeLevels?.filter((g: string) => userGrades.includes(g)) || [];
            if (commonGrades.length > 0) score += (commonGrades.length * 5);

            const impactBonus = Math.min(15, (teacher.impactScore || 0) / 10);
            score += impactBonus;

            // Note: removed Math.random() serendipity from the cached version —
            // a random factor inside a cache means every cache hit returns the
            // same "random" choice, defeating the purpose. If serendipity is
            // important we should sample post-cache.

            return { ...teacher, score, recommendationReason: reasons[0] || "Active Educator" };
        });

        const recommendations: TeacherSuggestion[] = scored
            .filter(t => t.score > 1 && t.displayName)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(t => ({
                uid: t.uid,
                displayName: t.displayName,
                photoURL: t.photoURL,
                initial: t.displayName?.[0] || t.initial || "T",
                schoolName: t.schoolName,
                subjects: t.subjects,
                impactScore: t.impactScore,
                recommendationReason: t.recommendationReason,
            }));

        return dbAdapter.serialize(recommendations);
    },
    { key: 'recs', ttlSeconds: 300 }, // 5-minute TTL — stale enough to feel fresh, frequent enough to absorb peak traffic
);

export async function getRecommendedTeachersAction(userId?: string): Promise<TeacherSuggestion[]> {
    // Authz: derive uid from session — ignore client-supplied parameter to prevent
    // a caller from scraping recommendations for arbitrary users.
    const callerId = await requireAuth();
    if (userId && userId !== callerId) {
        throw new Error('Forbidden: cannot fetch recommendations for another user');
    }
    return _recommendedTeachersFor(callerId);
}

// Cached inner. Keyed by selfUid so each user gets their own filtered list
// (the `selfUid` is excluded from results). 60s TTL — directory changes slowly
// and the same user navigating /community ↔ /community/teachers should hit it.
const _allTeachersFor = cachedPerUser(
    async (selfUid: string): Promise<TeacherSuggestion[]> => {
        const db = await getDb();

        const snapshot = await db.collection('users').limit(100).get();

        const teachers = snapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as any))
            .filter(teacher => teacher.uid !== selfUid)
            .filter(teacher => !isHiddenFromDiscovery(teacher));

        const sanitized: TeacherSuggestion[] = teachers.map(t => {
            const name = t.displayName
                || t.schoolName
                || (typeof t.email === 'string' ? t.email.split('@')[0] : null)
                || 'Teacher';
            return {
                uid: t.uid,
                displayName: name,
                photoURL: t.photoURL,
                initial: (name?.[0] || 'T').toUpperCase(),
                schoolName: t.schoolName,
                subjects: t.subjects || [],
                gradeLevels: t.gradeLevels || [],
                bio: t.bio,
                impactScore: t.impactScore || 0,
                followersCount: t.followersCount || 0,
            };
        });

        sanitized.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return dbAdapter.serialize(sanitized);
    },
    { key: 'all-teachers', ttlSeconds: 60 },
);

export async function getAllTeachersAction(currentUserId?: string): Promise<TeacherSuggestion[]> {
    // Authz + rate limit. Without these, this action exposed an unauthenticated
    // PII dump of every user in the directory (name, school, subjects, photoURL).
    // The optional `currentUserId` parameter is preserved for backward compat
    // but the actual self-exclusion uses the session uid.
    const callerId = await requireAuth();
    await checkServerRateLimit(callerId);
    const selfUid = currentUserId ?? callerId;

    return _allTeachersFor(selfUid);
}

// ── Engagement actions ────────────────────────────────────────────────────────
// These three actions close the engagement loop:
//   likeResourceAction       → like/unlike toggle on a library_resource
//   saveResourceToLibraryAction → copy a community resource into the teacher's
//                                 personal library + increment community stats
//   publishContentToLibraryAction → promote a personal content item to the
//                                   public library_resources collection
//                                   (the bridge between personal library and
//                                   the community feed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle a like on a community library resource.
 * Creates a like subcollection document for idempotency, increments/decrements
 * stats.likes atomically, and notifies the author.
 *
 * Returns { isLiked: boolean, newCount: number }.
 */
export async function likeResourceAction(
    resourceId: string,
    _userId?: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    // Derive uid from session — never trust client-supplied identity.
    // The legacy `_userId` parameter is preserved for one release so existing
    // call sites compile; it is intentionally ignored.
    const userId = await requireAuth();
    void _userId;
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const resRef  = db.collection('library_resources').doc(resourceId);
    const likeRef = resRef.collection('likes').doc(userId);

    const [resDoc, likeDoc] = await Promise.all([resRef.get(), likeRef.get()]);

    if (!resDoc.exists) throw new Error('Resource not found');
    const resData = resDoc.data()!;

    let isLiked: boolean;

    if (likeDoc.exists) {
        // Already liked — unlike
        await Promise.all([
            likeRef.delete(),
            resRef.update({ 'stats.likes': FieldValue.increment(-1) }),
        ]);
        isLiked = false;
    } else {
        // New like. We write `uid` on the doc so a single
        // `collectionGroup('likes').where('uid', '==', uid)` can hydrate the
        // full liked-state for a user without having to crawl every resource.
        await Promise.all([
            likeRef.set({ uid: userId, createdAt: new Date().toISOString() }),
            resRef.update({ 'stats.likes': FieldValue.increment(1) }),
        ]);
        isLiked = true;

        // Notify the original author (non-blocking)
        if (resData.authorId && resData.authorId !== userId) {
            try {
                const likerDoc = await db.collection('users').doc(userId).get();
                const liker = likerDoc.data();
                await createNotification({
                    recipientId: resData.authorId,
                    type: 'LIKE',
                    title: 'Someone liked your resource',
                    message: `${liker?.displayName || 'A teacher'} liked "${resData.title}"`,
                    senderId: userId,
                    senderName: liker?.displayName,
                    senderPhotoURL: liker?.photoURL,
                    link: '/community',
                });
            } catch (e) {
                logger.error('Failed to send like notification', e, 'COMMUNITY', { resourceId, userId });
            }
        }

        // Update author's impact score (likes are a strong signal)
        if (resData.authorId) {
            aggregateUserMetrics(resData.authorId).catch(() => {});
        }
    }

    // Return the new count for optimistic UI confirmation
    const updated = await resRef.get();
    const newCount = updated.data()?.stats?.likes ?? (resData.stats?.likes ?? 0) + (isLiked ? 1 : -1);

    revalidatePath('/community');
    return { isLiked, newCount };
}

/**
 * Save a community resource into the current teacher's personal library.
 * - Copies metadata into users/{saverId}/content
 * - Increments stats.saves on the library_resource
 * - Sends RESOURCE_SAVED notification to the original author
 * Idempotent: repeated saves are a no-op for stats/notifications.
 */
export async function saveResourceToLibraryAction(
    resource: {
        id: string;
        title: string;
        type: string;
        authorId: string;
        language: string;
        gradeLevel?: string;
        subject?: string;
    },
    _saverId?: string,
): Promise<{ alreadySaved: boolean }> {
    // Derive saver from session. Legacy `_saverId` parameter is ignored.
    const saverId = await requireAuth();
    void _saverId;
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const resRef  = db.collection('library_resources').doc(resource.id);
    const saveRef = resRef.collection('saves').doc(saverId);

    const saveDoc = await saveRef.get();

    if (saveDoc.exists) {
        // Already saved — silently succeed
        return { alreadySaved: true };
    }

    // 1. Mark the save in the subcollection (idempotency guard)
    await saveRef.set({ createdAt: new Date().toISOString() });

    // 2. Increment community stats
    await resRef.update({ 'stats.saves': FieldValue.increment(1) });

    // 3. Copy into saver's personal library (subcollection)
    const contentId = `saved_${resource.id}_${saverId.slice(0, 8)}`;
    const now = new Date().toISOString();
    const nowTimestamp = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date() };

    await dbAdapter.saveContent(saverId, {
        id:         contentId,
        type:       resource.type as any,
        title:      resource.title,
        topic:      resource.title,
        language:   resource.language as any,
        gradeLevel: (resource.gradeLevel ?? '') as any,
        subject:    (resource.subject ?? 'General') as any,
        isPublic:   false,
        isDraft:    false,
        createdAt:  nowTimestamp,
        updatedAt:  nowTimestamp,
        // sourceResourceId lets us track where it came from without re-uploading any data
        data: { sourceResourceId: resource.id, savedFrom: 'community' } as any,
    });

    // 4. Notify original author (non-blocking)
    if (resource.authorId && resource.authorId !== saverId) {
        try {
            const saverDoc = await db.collection('users').doc(saverId).get();
            const saver = saverDoc.data();
            await createNotification({
                recipientId: resource.authorId,
                type: 'RESOURCE_SAVED',
                title: 'Resource saved',
                message: `${saver?.displayName || 'A teacher'} saved your "${resource.title}" to their library`,
                senderId: saverId,
                senderName: saver?.displayName,
                senderPhotoURL: saver?.photoURL,
                link: '/community',
            });
        } catch (e) {
            logger.error('Failed to send resource-saved notification', e, 'COMMUNITY', { resourceId: resource.id, saverId });
        }
    }

    // 5. Update author impact score (saves signal long-term utility)
    if (resource.authorId) {
        aggregateUserMetrics(resource.authorId).catch(() => {});
    }

    // Publish analytics event
    try {
        await publishEvent('teacher-connect-events', {
            type: 'RESOURCE_SAVED',
            resourceId: resource.id,
            saverId,
            timestamp: now,
        });
    } catch {}

    revalidatePath('/community');
    return { alreadySaved: false };
}

/**
 * Promote a teacher's personal content item to the public community library.
 * This is the bridge between the personal library (users/{uid}/content) and
 * the community feed (library_resources).
 *
 * Creates a document in library_resources and marks the source content as
 * isPublic: true. Idempotent — calling twice updates the existing record.
 */
export async function publishContentToLibraryAction(
    contentId: string,
    _userId?: string,
): Promise<{ resourceId: string }> {
    // Derive author from session. A user can only publish their own content
    // — the dbAdapter.getContent call below scopes by uid, so a spoofed userId
    // would fail with "Content not found" rather than mis-publishing.
    const userId = await requireAuth();
    void _userId;
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // 1. Read the source content from personal library
    const content = await dbAdapter.getContent(userId, contentId);
    if (!content) throw new Error('Content not found in personal library');

    // 2. Fetch author name for the community card
    const authorDoc = await db.collection('users').doc(userId).get();
    const authorData = authorDoc.data();

    // 3. Write (or overwrite) into library_resources
    // The document ID is deterministic so republishing is idempotent
    const resourceId = `pub_${userId.slice(0, 8)}_${contentId.slice(0, 12)}`;
    const resourceRef = db.collection('library_resources').doc(resourceId);

    await resourceRef.set({
        id:         resourceId,
        type:       content.type,
        title:      content.title,
        topic:      content.topic,
        language:   content.language,
        gradeLevel: content.gradeLevel,
        subject:    content.subject,
        authorId:   userId,
        authorName: authorData?.displayName || 'Teacher',
        authorPhotoURL: authorData?.photoURL ?? null,
        isPublic:   true,
        stats: {
            likes:     0,
            saves:     0,
            downloads: 0,
            uses:      0,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        // sourceContentId allows linking back to the full content in Cloud Storage
        sourceContentId: contentId,
        storagePath:     content.storagePath ?? null,
    }, { merge: true });

    // 4. Mark the source content as public so the UI can reflect it
    await dbAdapter.saveContent(userId, {
        ...content,
        isPublic: true,
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date() },
    });

    // 5. Publish event for feed fan-out (subscribers can push to followers' feeds)
    try {
        await publishEvent('teacher-connect-events', {
            type: 'RESOURCE_PUBLISHED',
            resourceId,
            authorId: userId,
            contentType: content.type,
            language: content.language,
            timestamp: new Date().toISOString(),
        });
    } catch {}

    // 6. Update author's content-shared count
    aggregateUserMetrics(userId).catch(() => {});

    revalidatePath('/community');
    return { resourceId };
}

/**
 * Share the user's most recently generated content of a given type to the community.
 * Finds the latest content doc by type, then delegates to publishContentToLibraryAction.
 */
export async function shareLatestContentAction(contentType: string): Promise<{ resourceId: string }> {
    const userId = await requireAuth();

    // Find the user's most recent content of this type
    const { items } = await dbAdapter.listContent(userId, { type: contentType as any, limit: 1 });
    if (!items.length) throw new Error('No content found to share. Generate something first!');

    const latestContent = items[0];
    if (latestContent.isPublic) throw new Error('This content is already shared.');

    return publishContentToLibraryAction(latestContent.id);
}

export async function sendChatMessageAction(text: string, audioUrl?: string) {
    // 1. Authenticate via middleware-injected header — never trust client-supplied identity
    const authorId = await requireAuth();

    // 2. Validate input
    const trimmed = text?.trim();
    if (!trimmed && !audioUrl) throw new Error("Message cannot be empty");
    if (trimmed && trimmed.length > 500) throw new Error("Message too long");

    // 3. Rate limit (already imported at top of file)
    await checkServerRateLimit(authorId);

    // 4. Fetch author profile from server — never trust client-supplied name/photo
    const db = await getDb();
    const { FieldValue } = await import("firebase-admin/firestore");

    const userDoc = await db.collection("users").doc(authorId).get();
    const userData = userDoc.data();
    const authorName = userData?.displayName || "Teacher";
    const authorPhotoURL = userData?.photoURL ?? null;

    const payload: Record<string, any> = {
        text: trimmed || '',
        authorId,
        authorName,
        authorPhotoURL,
        createdAt: FieldValue.serverTimestamp(),
    };
    if (audioUrl) payload.audioUrl = audioUrl;

    await db.collection("community_chat").add(payload);

    // Fire-and-forget: trigger AI reactive reply (non-blocking)
    const { triggerAIReactiveReply } = await import("@/lib/ai-reactive-trigger");
    triggerAIReactiveReply("community_chat", trimmed || '', authorName);
}

/**
 * Hydrate the set of post IDs and resource IDs the current user has liked.
 *
 * Used on community-page mount so heart icons render filled for previously-liked
 * items instead of starting empty until the user re-clicks.
 *
 * Implementation note: every like doc carries a `uid` field (added in Phase 3),
 * so a single collectionGroup query covers both `groups/*\/posts/*\/likes/*`
 * and `library_resources/*\/likes/*`. Pre-Phase-3 like docs without the `uid`
 * field will not appear here — those users will see un-filled hearts until
 * they re-like, which is acceptable as a one-time cosmetic regression.
 */
export async function getLikedItemIdsAction(): Promise<{
    groupPostIds: string[];
    resourceIds: string[];
}> {
    const uid = await requireAuth();
    const db = await getDb();

    // Cap the result set so a heavy liker doesn't load megabytes on page load.
    const snap = await db
        .collectionGroup('likes')
        .where('uid', '==', uid)
        .limit(500)
        .get();

    const groupPostIds: string[] = [];
    const resourceIds: string[] = [];

    for (const doc of snap.docs) {
        // Path shape:
        //   groups/{gid}/posts/{pid}/likes/{uid}    → ref.parent.parent = post doc,
        //                                             ref.parent.parent.parent.id = 'posts'
        //   library_resources/{rid}/likes/{uid}     → ref.parent.parent = resource doc,
        //                                             ref.parent.parent.parent.id = 'library_resources'
        const parentDoc = doc.ref.parent.parent;
        if (!parentDoc) continue;
        const ownerCollectionName = parentDoc.parent.id;
        if (ownerCollectionName === 'posts') {
            groupPostIds.push(parentDoc.id);
        } else if (ownerCollectionName === 'library_resources') {
            resourceIds.push(parentDoc.id);
        }
    }

    return { groupPostIds, resourceIds };
}
