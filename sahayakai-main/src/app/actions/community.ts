"use server";

import { getDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { publishEvent } from "@/lib/pubsub";
import { dbAdapter } from "@/lib/db/adapter";

export async function getProfilesAction(uids: string[]) {
    return await dbAdapter.getUsers(uids);
}

export async function createPostAction(userId: string, content: string, visibility: string = 'public') {
    const db = await getDb();

    const postData = {
        authorId: userId,
        content,
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

export async function getPosts(filters: { language?: string, limit?: number } = {}) {
    const db = await getDb();
    let query = db.collection('posts').orderBy('createdAt', 'desc');

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return dbAdapter.serialize(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })));
}

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

export async function getLibraryResources(filters: { type?: string, language?: string, authorId?: string } = {}) {
    const db = await getDb();
    let query: any = db.collection('library_resources');

    if (filters.type) query = query.where('type', '==', filters.type);
    if (filters.language && filters.language !== 'all') query = query.where('language', '==', filters.language);
    if (filters.authorId) query = query.where('authorId', '==', filters.authorId);

    const snapshot = await query.orderBy('stats.likes', 'desc').limit(20).get();
    return dbAdapter.serialize(snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
    })));
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

export async function seedLibraryAction(userId: string) {
    const db = await getDb();
    const batch = db.batch();

    // 1. Create Mock User Profiles
    const mockUsers = [
        { uid: 'mock_ravi', displayName: 'Ravi Kumar', initial: 'RK', subject: 'Math', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi' },
        { uid: 'mock_priya', displayName: 'Priya Singh', initial: 'PS', subject: 'Science', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya' },
        { uid: 'mock_amit', displayName: 'Amit Sharma', initial: 'AS', subject: 'Hindi', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit' },
    ];

    for (const m of mockUsers) {
        const userRef = db.collection('users').doc(m.uid);
        batch.set(userRef, {
            ...m,
            email: `${m.uid}@example.com`,
            school: "Kendriya Vidyalaya",
            gradeLevels: ["Class 6", "Class 7", "Class 8"],
            lastLogin: new Date().toISOString()
        }, { merge: true });
    }

    // 2. Create Library Resources from Mock Users
    const resources = [
        {
            title: 'Interactive Lesson on the Solar System',
            type: 'lesson-plan',
            authorId: 'mock_priya',
            authorName: 'Priya Singh',
            authorInitials: 'PS',
            language: 'en',
            stats: { likes: 128, downloads: 45 },
            createdAt: new Date().toISOString()
        },
        {
            title: 'भिन्न पर उन्नत प्रश्नोत्तरी (कक्षा 7)',
            type: 'quiz',
            authorId: 'mock_ravi',
            authorName: 'Ravi Kumar',
            authorInitials: 'RK',
            language: 'hi',
            stats: { likes: 95, downloads: 30 },
            createdAt: new Date().toISOString()
        },
        {
            title: 'Modern Indian History Overview',
            type: 'lesson-plan',
            authorId: 'mock_amit',
            authorName: 'Amit Sharma',
            authorInitials: 'AS',
            language: 'en',
            stats: { likes: 210, downloads: 88 },
            createdAt: new Date().toISOString()
        }
    ];

    resources.forEach(r => {
        const ref = db.collection('library_resources').doc();
        batch.set(ref, r);
    });

    // 3. Create Staffroom Posts from Mock Users
    const posts = [
        {
            authorId: 'mock_priya',
            content: "Just tried the new AI Visual Aid designer for my Class 7 Science lab. The students loved the B&W diagrams!",
            likesCount: 12,
            createdAt: new Date().toISOString()
        },
        {
            authorId: 'mock_ravi',
            content: "Does anyone have a good strategy for teaching Vedic Math shortcuts to Class 6?",
            likesCount: 5,
            createdAt: new Date().toISOString()
        }
    ];

    posts.forEach(p => {
        const ref = db.collection('posts').doc();
        batch.set(ref, p);
    });

    await batch.commit();
    revalidatePath("/community");
}
