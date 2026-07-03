/**
 * Community domain service — tranche 5 migration of
 * src/app/actions/community.ts (see docs/API_MIGRATION_PATTERN.md).
 *
 * Plain server module: every function takes the trusted `userId` (derived by
 * the API route from the middleware-injected `x-user-id` header) as its first
 * argument. NO function here reads headers() — auth happens at the route
 * boundary; ownership/security checks below are preserved verbatim from the
 * action module (F2/F5/F10 forensic fixes).
 *
 * Caching-semantics note (recipe step 7): the old server actions called
 * `revalidatePath('/community')` / `revalidatePath('/impact-dashboard')`
 * after mutations. Those calls are intentionally NOT carried over: both pages
 * are client components that fetch via this API surface on mount and update
 * optimistically after each mutation (create-post-dialog fires
 * `onPostCreated` → page refetch; like/save handlers use the returned counts).
 * `unstable_cache` reads (recommendations / directory) keep their caching
 * here via `cachedPerUser`, invalidated with `invalidateUserCache`.
 */

import { getDb } from "@/lib/firebase-admin";
import { publishEvent } from "@/lib/pubsub";
import { dbAdapter } from "@/lib/db/adapter";
import { aggregateUserMetrics } from "@/lib/aggregator";
import { logger } from "@/lib/logger";
import { checkServerRateLimit } from "@/lib/server-safety";
import { cachedPerUser, invalidateUserCache } from "@/lib/server-cache";
import { ForbiddenError } from "@/lib/auth-helpers";
import { createTypedNotification } from "@/lib/notifications/create";
import type { TeacherSuggestion } from "@/types/community";

// F2-01 (P0 PII leak): the previous implementation returned raw Firestore
// user docs to any signed-in caller, leaking phoneNumber, fcmTokens,
// adminRoles, planType, razorpaySubscriptionId, creditsUsed, email. We now
// strip to the same public allowlist that getPublicProfileAction uses.
//
// H6 (PII leak): email is intentionally NOT in this allowlist. The directory
// path (getProfiles/stripToPublicProfile) returns these fields to any
// signed-in caller for any uid, so including email would let anyone bulk-harvest
// every teacher's address. Email stays gated behind a connection in
// getPublicProfileAction.
const PUBLIC_PROFILE_FIELDS = [
    'id',
    'uid',
    'displayName',
    'photoURL',
    'bio',
    'state',
    'district',
    'schoolType',
    'schoolName',
    'resourceLevel',
    'subjects',
    'languages',
    'gradeLevels',
    'qualifications',
    'yearsOfExperience',
    'verifiedStatus',
    'careerStage',
] as const;

function stripToPublicProfile(user: any): any {
    if (!user || typeof user !== 'object') return user;
    const out: Record<string, any> = {};
    for (const key of PUBLIC_PROFILE_FIELDS) {
        if (key in user) out[key] = (user as any)[key];
    }
    // Preserve uid even if not present in the source object (some adapters
    // attach it as the doc id rather than a field).
    if (!('uid' in out) && (user as any).uid) out.uid = (user as any).uid;
    if (!('id' in out) && (user as any).id) out.id = (user as any).id;
    return out;
}

export async function getProfiles(callerId: string, uids: string[]) {
    try {
        const users = await dbAdapter.getUsers(uids);
        if (!Array.isArray(users)) return users;
        return users.map(stripToPublicProfile);
    } catch (err) {
        logger.error('getProfiles failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

/**
 * Create a public post. Author is derived from the authenticated session —
 * the client cannot impersonate other users.
 */
export async function createPost(userId: string, content: string, visibility: string = 'public', imageUrl?: string, gradeLevel?: string, subject?: string) {
    try {

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

    // getPosts filters with .where('gradeLevel','in',...) and
    // .where('subject','in',...). Firestore 'in' filters match only docs that
    // actually carry the field, so posts written without gradeLevel/subject were
    // silently excluded whenever a grade/subject filter was applied. Always
    // persist both fields, defaulting consistently with the rest of this file
    // (subject → 'General', matching saveResourceToLibrary; gradeLevel →
    // 'all' so an unspecified post still surfaces under the "all grades" bucket).
    const postData: any = {
        authorId: userId,
        content,
        visibility,
        gradeLevel: (typeof gradeLevel === 'string' && gradeLevel.trim()) ? gradeLevel : 'all',
        subject: (typeof subject === 'string' && subject.trim()) ? subject : 'General',
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

    // revalidatePath('/community') + revalidatePath('/impact-dashboard')
    // removed — see module header (client pages refetch via onPostCreated).

    // Background aggregation
    aggregateUserMetrics(userId).catch(e => logger.error("Aggregator error for user metrics", e, 'COMMUNITY', { userId }));

    return docRef.id;
    } catch (err) {
        logger.error('createPost failed', err, 'COMMUNITY', { userId });
        throw err;
    }
}

export async function toggleLike(userId: string, postId: string) {
    try {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const postRef = db.collection('posts').doc(postId);
    const likeRef = postRef.collection('likes').doc(userId);

    // F10-05: forbid self-like. Inflates vanity counters and pollutes ranking.
    const postSnap = await postRef.get();
    if (!postSnap.exists) throw new Error('Post not found');
    const postData = postSnap.data() ?? {};
    if (postData.authorId && postData.authorId === userId) {
        throw new Error('Cannot like your own post');
    }

    // F5-002 fix: wrap the entire toggle in a Firestore transaction so that
    // concurrent toggles from the same user can't both observe `!exists` and
    // double-increment `likesCount`. Transactional read+decide+write keeps the
    // final state at one like-doc and a counter delta of +1 or 0.
    await db.runTransaction(async (tx) => {
        const likeDoc = await tx.get(likeRef);
        if (likeDoc.exists) {
            tx.delete(likeRef);
            tx.update(postRef, { likesCount: FieldValue.increment(-1) });
        } else {
            tx.set(likeRef, { uid: userId, createdAt: new Date().toISOString() });
            tx.update(postRef, { likesCount: FieldValue.increment(1) });
        }
    });

    // revalidatePath('/community') removed — see module header.
    } catch (err) {
        logger.error('toggleLike failed', err, 'COMMUNITY', { userId });
        throw err;
    }
}

export interface GetPostsFilters {
    language?: string;
    limit?: number;
    gradeLevels?: string[];
    subjects?: string[];
}

export async function getPosts(callerId: string, filters: GetPostsFilters = {}) {
    try {
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
    } catch (err) {
        logger.error('getPosts failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

export async function followTeacher(followerId: string, followingId: string) {
    try {
    // F10-04: forbid self-follow. Inflates the follower graph and gives
    // social-proof to the wrong account.
    if (followingId === followerId) {
        throw new Error('Cannot follow yourself');
    }
    // Invalidate this user's cached recommendations — their following list
    // just changed, so the exclusion set is stale.
    invalidateUserCache('recs', followerId);
    const db = await getDb();
    const connectionId = `${followerId}_${followingId}`;
    const connectionRef = db.collection('connections').doc(connectionId);

    // F5 fix: same TOCTOU pattern as toggleLike. Reading connectionRef
    // then conditionally delete/set as separate operations meant two concurrent
    // follow taps could both observe `!exists` and both set the connection doc
    // (idempotent) — or a concurrent follow+unfollow could interleave and leave
    // the graph in an inconsistent state. Wrap the read + conditional write in a
    // transaction so exactly one of {follow, unfollow} wins. The closure returns
    // `true` when a NEW follow was created, so the notification side-effects
    // below fire once and only for a genuine new follow.
    const didFollow = await db.runTransaction(async (tx) => {
        const doc = await tx.get(connectionRef);
        if (doc.exists) {
            tx.delete(connectionRef);
            return false;
        }
        tx.set(connectionRef, {
            followerId,
            followingId,
            createdAt: new Date().toISOString()
        });
        return true;
    });

    if (didFollow) {
        // Create Notification for the person being followed
        try {
            const followerDoc = await db.collection('users').doc(followerId).get();
            const followerData = followerDoc.data();

            await createTypedNotification({
                type: 'FOLLOW',
                recipientId: followingId,
                placeholders: { senderName: followerData?.displayName || 'A teacher' },
                senderId: followerId,
                senderName: followerData?.displayName,
                senderPhotoURL: followerData?.photoURL,
                link: `/community`, // Could link to follower's profile if available
            });
        } catch (e) {
            logger.error("Failed to send follow notification", e, 'COMMUNITY', { followerId, followingId });
        }
    }
    // revalidatePath('/community') removed — see module header.
    } catch (err) {
        logger.error('followTeacher failed', err, 'COMMUNITY', { userId: followerId });
        throw err;
    }
}

export async function getFollowingIds(followerId: string) {
    try {
    const db = await getDb();
    const snapshot = await db.collection('connections')
        .where('followerId', '==', followerId)
        .get();
    return snapshot.docs.map(doc => doc.data().followingId);
    } catch (err) {
        logger.error('getFollowingIds failed', err, 'COMMUNITY', { userId: followerId });
        throw err;
    }
}

export async function getFollowingPosts(followerId: string) {
    try {
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
    } catch (err) {
        logger.error('getFollowingPosts failed', err, 'COMMUNITY', { userId: followerId });
        throw err;
    }
}

export interface LibraryResourceFilters {
    type?: string;
    language?: string;
    authorId?: string;
    authorIds?: string[];
    excludeTypes?: string[];
}

export async function getLibraryResources(callerId: string, filters: LibraryResourceFilters = {}) {
    try {
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
    } catch (err) {
        logger.error('getLibraryResources failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

export async function trackDownload(callerId: string, resourceId: string) {
    try {
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
    } catch (err) {
        logger.error('trackDownload failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

// Cached inner function. Pulled out so unstable_cache can key the result by
// uid + ttl. The auth check stays OUT of the cached body — request context
// isn't available inside `unstable_cache` callbacks. Revalidate via
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
        //    getFollowingIds() with its logging wrapper here; inline the
        //    equivalent Firestore query so the cached body stays self-contained.
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

        // 2026-12 directory-visibility bug: the previous .limit(100) silently
        // dropped any teacher whose UID sorted past the first 100 (Firestore's
        // default ordering is by document ID). With 138+ user docs, ~38 real
        // teachers were INVISIBLE from recommendations — exactly the complaint
        // teachers reported. Bumped to 1000; cross that and we need indexed
        // queries (school / district / subjects) instead of an in-memory scan.
        const snapshot = await db.collection('users').limit(1000).get();

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

        // 2026-12 directory-visibility bug part 2: the previous `t.score > 1`
        // gate dropped every teacher who didn't share a school, district,
        // subject, OR grade with the viewer (impactScore alone yields 0).
        // A brand-new teacher who hasn't filled in their profile yet was
        // INVISIBLE to everyone they didn't already overlap with. Lowered
        // the floor to `t.score >= 0 && t.displayName` so legitimate new
        // joiners surface — they sort to the bottom of the recs list but
        // they appear. Hidden-from-discovery / no-displayName cases are
        // already filtered above.
        const recommendations: TeacherSuggestion[] = scored
            .filter(t => t.score >= 0 && t.displayName)
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
    // 2026-12: lowered from 300 → 60 so a new teacher's profile reflects
    // in recommendations within a minute instead of taking up to 5 min to
    // surface. Directory list (_allTeachersFor) was already at 60.
    { key: 'recs', ttlSeconds: 60 },
);

export async function getRecommendedTeachers(callerId: string, userId?: string): Promise<TeacherSuggestion[]> {
    // Authz: derive uid from session — ignore client-supplied parameter to prevent
    // a caller from scraping recommendations for arbitrary users.
    try {
        if (userId && userId !== callerId) {
            throw new ForbiddenError('Forbidden: cannot fetch recommendations for another user');
        }
        return await _recommendedTeachersFor(callerId);
    } catch (err) {
        logger.error('getRecommendedTeachers failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

// Cached inner. Keyed by selfUid so each user gets their own filtered list
// (the `selfUid` is excluded from results). 60s TTL — directory changes slowly
// and the same user navigating /community ↔ /community/teachers should hit it.
const _allTeachersFor = cachedPerUser(
    async (selfUid: string): Promise<TeacherSuggestion[]> => {
        const db = await getDb();

        // 2026-12 directory-visibility bug: was .limit(100) — dropped any
        // teacher whose UID sorted past the first 100. Bumped to 1000.
        const snapshot = await db.collection('users').limit(1000).get();

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

export async function getAllTeachers(callerId: string, currentUserId?: string): Promise<TeacherSuggestion[]> {
    // Authz + rate limit. Without these, this action exposed an unauthenticated
    // PII dump of every user in the directory (name, school, subjects, photoURL).
    // The optional `currentUserId` parameter is preserved for backward compat
    // but the actual self-exclusion uses the session uid.
    try {
        await checkServerRateLimit(callerId);
        const selfUid = currentUserId ?? callerId;

        return await _allTeachersFor(selfUid);
    } catch (err) {
        logger.error('getAllTeachers failed', err, 'COMMUNITY', { userId: callerId });
        throw err;
    }
}

// ── Engagement functions ──────────────────────────────────────────────────────
// These three close the engagement loop:
//   likeResource            → like/unlike toggle on a library_resource
//   saveResourceToLibrary   → copy a community resource into the teacher's
//                             personal library + increment community stats
//   publishContentToLibrary → promote a personal content item to the
//                             public library_resources collection
//                             (the bridge between personal library and
//                             the community feed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle a like on a community library resource.
 * Creates a like subcollection document for idempotency, increments/decrements
 * stats.likes atomically, and notifies the author.
 *
 * Returns { isLiked: boolean, newCount: number }.
 */
export async function likeResource(
    userId: string,
    resourceId: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    try {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const resRef  = db.collection('library_resources').doc(resourceId);
    const likeRef = resRef.collection('likes').doc(userId);

    // F5 fix: the toggle used to read likeDoc.exists and then run the like-doc
    // write + stats.likes increment as separate operations outside any
    // transaction, so two concurrent taps could both observe `!exists` and both
    // fire FieldValue.increment(+1), double-counting the like. Mirror
    // toggleLike: read the resource + like docs, decide, and write the
    // counter delta all inside one Firestore transaction so the final state is
    // one like-doc and a counter delta of +1 or 0.
    const { resData, isLiked } = await db.runTransaction(async (tx) => {
        const resDoc = await tx.get(resRef);
        if (!resDoc.exists) throw new Error('Resource not found');
        const data = resDoc.data()!;

        // F10-05: forbid self-like on library resources too.
        if (data.authorId && data.authorId === userId) {
            throw new Error('Cannot like your own resource');
        }

        const likeDoc = await tx.get(likeRef);
        if (likeDoc.exists) {
            // Already liked — unlike
            tx.delete(likeRef);
            tx.update(resRef, { 'stats.likes': FieldValue.increment(-1) });
            return { resData: data, isLiked: false };
        }
        // New like. We write `uid` on the doc so a single
        // `collectionGroup('likes').where('uid', '==', uid)` can hydrate the
        // full liked-state for a user without having to crawl every resource.
        tx.set(likeRef, { uid: userId, createdAt: new Date().toISOString() });
        tx.update(resRef, { 'stats.likes': FieldValue.increment(1) });
        return { resData: data, isLiked: true };
    });

    if (isLiked) {
        // Notify the original author (non-blocking)
        if (resData.authorId && resData.authorId !== userId) {
            try {
                const likerDoc = await db.collection('users').doc(userId).get();
                const liker = likerDoc.data();
                await createTypedNotification({
                    type: 'LIKE',
                    recipientId: resData.authorId,
                    placeholders: {
                        senderName: liker?.displayName || 'A teacher',
                        resourceTitle: resData.title ?? '',
                    },
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

    // revalidatePath('/community') removed — see module header.
    return { isLiked, newCount };
    } catch (err) {
        logger.error('likeResource failed', err, 'COMMUNITY', { userId });
        throw err;
    }
}

export interface SaveResourceInput {
    id: string;
    title: string;
    type: string;
    authorId: string;
    language: string;
    gradeLevel?: string;
    subject?: string;
}

/**
 * Save a community resource into the current teacher's personal library.
 * - Copies metadata into users/{saverId}/content
 * - Increments stats.saves on the library_resource
 * - Sends RESOURCE_SAVED notification to the original author
 * Idempotent: repeated saves are a no-op for stats/notifications.
 */
export async function saveResourceToLibrary(
    saverId: string,
    resource: SaveResourceInput,
): Promise<{ alreadySaved: boolean }> {
    try {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const resRef  = db.collection('library_resources').doc(resource.id);
    const saveRef = resRef.collection('saves').doc(saverId);

    // F5-003 fix: same TOCTOU pattern as F5-002. Pre-reading `saveRef.exists`
    // and then running the save-doc set + stats.saves increment as separate
    // writes meant two concurrent saves from the same user could both observe
    // `!exists`, both set the save-doc (idempotent), and both fire
    // `FieldValue.increment(+1)` — inflating `stats.saves` by N. Wrap the
    // existence check + counter increment in a transaction; the closure
    // returns `true` if the save was already recorded (so we short-circuit
    // the rest of the side-effects below: library copy, notification,
    // metrics, pubsub).
    const alreadySaved = await db.runTransaction(async (tx) => {
        const saveDoc = await tx.get(saveRef);
        if (saveDoc.exists) {
            return true;
        }
        tx.set(saveRef, { createdAt: new Date().toISOString() });
        tx.update(resRef, { 'stats.saves': FieldValue.increment(1) });
        return false;
    });

    if (alreadySaved) {
        // Already saved — silently succeed
        return { alreadySaved: true };
    }

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
            await createTypedNotification({
                type: 'RESOURCE_SAVED',
                recipientId: resource.authorId,
                placeholders: {
                    senderName: saver?.displayName || 'A teacher',
                    resourceTitle: resource.title,
                },
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

    // revalidatePath('/community') removed — see module header.
    return { alreadySaved: false };
    } catch (err) {
        logger.error('saveResourceToLibrary failed', err, 'COMMUNITY', { userId: saverId });
        throw err;
    }
}

/**
 * Promote a teacher's personal content item to the public community library.
 * This is the bridge between the personal library (users/{uid}/content) and
 * the community feed (library_resources).
 *
 * Creates a document in library_resources and marks the source content as
 * isPublic: true. Idempotent — calling twice updates the existing record.
 */
export async function publishContentToLibrary(
    userId: string,
    contentId: string,
): Promise<{ resourceId: string }> {
    // A user can only publish their own content — the dbAdapter.getContent
    // call below scopes by uid, so a spoofed userId would fail with
    // "Content not found" rather than mis-publishing.
    try {
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

    // revalidatePath('/community') removed — see module header.
    return { resourceId };
    } catch (err) {
        logger.error('publishContentToLibrary failed', err, 'COMMUNITY', { userId });
        throw err;
    }
}

/**
 * Share the user's most recently generated content of a given type to the community.
 * Finds the latest content doc by type, then delegates to publishContentToLibrary.
 */
export async function shareLatestContent(userId: string, contentType: string): Promise<{ resourceId: string }> {
    try {
        // Find the user's most recent content of this type
        const { items } = await dbAdapter.listContent(userId, { type: contentType as any, limit: 1 });
        if (!items.length) throw new Error('No content found to share. Generate something first!');

        const latestContent = items[0];
        if (latestContent.isPublic) throw new Error('This content is already shared.');

        return await publishContentToLibrary(userId, latestContent.id);
    } catch (err) {
        logger.error('shareLatestContent failed', err, 'COMMUNITY', { userId });
        throw err;
    }
}

export async function sendChatMessage(authorId: string, text: string, audioUrl?: string) {
    try {

    // 1. Validate input (author identity comes from the route's trusted header)
    const trimmed = text?.trim();
    if (!trimmed && !audioUrl) throw new Error("Message cannot be empty");
    if (trimmed && trimmed.length > 500) throw new Error("Message too long");

    // F10-03: audioUrl must point at Firebase Storage. Without this guard a
    // hostile client could plant a tracking-pixel URL that fires every time
    // a chat viewer's <audio> element preloads metadata, leaking which users
    // opened the chat. Mirrors sendGroupChatMessage's validation.
    if (audioUrl) {
        if (typeof audioUrl !== 'string' || audioUrl.length > 1024) {
            throw new Error('Invalid audio URL');
        }
        let parsed: URL;
        try {
            parsed = new URL(audioUrl);
        } catch {
            throw new Error('Invalid audio URL');
        }
        if (parsed.protocol !== 'https:' || parsed.host !== 'firebasestorage.googleapis.com') {
            throw new Error('Invalid audio URL');
        }
    }

    // 2. Rate limit
    await checkServerRateLimit(authorId);

    // 3. Fetch author profile from server — never trust client-supplied name/photo
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
    } catch (err) {
        logger.error('sendChatMessage failed', err, 'COMMUNITY', { userId: authorId });
        throw err;
    }
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
export async function getLikedItemIds(uid: string): Promise<{
    groupPostIds: string[];
    resourceIds: string[];
}> {
    try {
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
    } catch (err) {
        logger.error('getLikedItemIds failed', err, 'COMMUNITY', { userId: uid });
        throw err;
    }
}
