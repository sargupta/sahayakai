"use server";

import { getDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { publishEvent } from "@/lib/pubsub";
import { dbAdapter } from "@/lib/db/adapter";

export async function getProfilesAction(uids: string[]) {
    return await dbAdapter.getUsers(uids);
}

export async function createPostAction(userId: string, content: string, visibility: string = 'public', imageUrl?: string) {
    const db = await getDb();

    const postData = {
        authorId: userId,
        content,
        imageUrl,
        visibility,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(), // In real app use FieldValue.serverTimestamp()
        updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection('posts').add(postData);

    // Trigger background processing (Feeds, Notifications)
    await publishEvent('teacher-connect-events', {
        type: 'NEW_POST',
        postId: docRef.id,
        authorId: userId,
        timestamp: postData.createdAt
    });

    revalidatePath("/community");
    return docRef.id;
}

export async function toggleLikeAction(postId: string, userId: string) {
    const db = await getDb();
    const postRef = db.collection('posts').doc(postId);
    const likeRef = postRef.collection('likes').doc(userId);

    const likeDoc = await likeRef.get();

    if (likeDoc.exists) {
        // Unlike
        await likeRef.delete();
        await postRef.update({
            likesCount: (await postRef.get()).data()?.likesCount - 1
        });
    } else {
        // Like
        await likeRef.set({ createdAt: new Date().toISOString() });
        await postRef.update({
            likesCount: ((await postRef.get()).data()?.likesCount || 0) + 1
        });
    }

    revalidatePath("/community");
}

export async function getPosts(filters: { language?: string, limit?: number, gradeLevels?: string[], subjects?: string[] } = {}) {
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

export async function followTeacherAction(followerId: string, followingId: string) {
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
            console.error("Failed to send follow notification:", e);
        }
    }
    revalidatePath("/community");
}

export async function getFollowingIdsAction(followerId: string) {
    const db = await getDb();
    const snapshot = await db.collection('connections')
        .where('followerId', '==', followerId)
        .get();
    return snapshot.docs.map(doc => doc.data().followingId);
}

export async function getFollowingPosts(followerId: string) {
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

export async function getRecommendedTeachersAction(userId: string) {
    const db = await getDb();

    // 1. Get current user profile and following list
    const [userDoc, followingIds] = await Promise.all([
        db.collection('users').doc(userId).get(),
        getFollowingIdsAction(userId)
    ]);

    if (!userDoc.exists) return [];

    const currentUser = userDoc.data() as any;
    const userSchool = currentUser.schoolNormalized || currentUser.schoolName || '';
    const userSubjects = currentUser.subjects || [];
    const userGrades = currentUser.gradeLevels || [];
    const userDistrict = currentUser.district || '';

    // 2. Fetch all teachers (excluding self and already followed)
    const excludeIds = [userId, ...followingIds];

    // Note: Firestore 'not-in' is limited to 10 items. For a robust system, 
    // we would use a search engine (Algolia) or client-side filtering + batching.
    // For now, we fetch a larger pool and filter.
    const snapshot = await db.collection('users')
        .limit(100)
        .get();

    const candidates = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as any))
        .filter(teacher => !excludeIds.includes(teacher.uid));

    // 3. Robust Multi-Tier Scoring
    const scored = candidates.map(teacher => {
        let score = 0;
        const reasons: string[] = [];

        // Tier 1: Institutional Affinity (Weight: 30 - Reduced from 50 to prevent echo chambers)
        const teacherSchool = teacher.schoolNormalized || teacher.schoolName || '';
        if (userSchool && teacherSchool === userSchool) {
            score += 30;
            reasons.push("Same School");
        } else if (userDistrict && teacher.district === userDistrict) {
            score += 15;
            reasons.push("Nearby Peer");
        }

        // Tier 2: Pedagogical Affinity (Weight: 40 - Increased to encourage subject growth)
        const commonSubjects = teacher.subjects?.filter((s: string) => userSubjects.includes(s)) || [];
        if (commonSubjects.length > 0) {
            score += (commonSubjects.length * 20);
            if (reasons.length === 0) reasons.push(`${commonSubjects[0]} Peer`);
        }

        const commonGrades = teacher.gradeLevels?.filter((g: string) => userGrades.includes(g)) || [];
        if (commonGrades.length > 0) {
            score += (commonGrades.length * 5);
        }

        // Tier 3: Professional Impact (Weight: 15)
        const impactBonus = Math.min(15, (teacher.impactScore || 0) / 10);
        score += impactBonus;

        // Tier 4: Serendipity (Small random factor to prevent stale lists)
        score += Math.random() * 5;

        return {
            ...teacher,
            score,
            recommendationReason: reasons[0] || "Active Educator"
        };
    });

    // 4. Sort and return top 5 (Sanitized results to strip PII)
    const recommendations = scored
        .filter(t => t.score > 1 && t.displayName) // Must have a name and minimum affinity
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
            recommendationReason: t.recommendationReason
        }));

    return dbAdapter.serialize(recommendations);
}

export async function getAllTeachersAction(currentUserId?: string) {
    const db = await getDb();

    // Fetch all teachers
    // Note: In a massive scale app, we'd use pagination. 
    // For the initial "show all" requirement, we fetch up to 200.
    const snapshot = await db.collection('users')
        .orderBy('displayName', 'asc')
        .limit(200)
        .get();

    const teachers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as any))
        .filter(teacher => teacher.uid !== currentUserId); // Exclude self if provided

    // Sanitize output for public directory - Only use real data
    const sanitized = teachers.map(t => ({
        uid: t.uid,
        displayName: t.displayName, // Must be real
        photoURL: t.photoURL,
        initial: t.displayName?.[0] || t.initial,
        schoolName: t.schoolName,
        subjects: t.subjects || [],
        gradeLevels: t.gradeLevels || [],
        bio: t.bio,
        impactScore: t.impactScore || 0,
        followersCount: t.followersCount || 0
    })).filter(t => t.displayName); // Ensure only teachers with names are shown

    return dbAdapter.serialize(sanitized);
}
