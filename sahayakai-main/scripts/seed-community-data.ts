
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Seeding Data
const USERS = [
    { id: 'teacher-srujana', name: 'Srujana R S', role: 'teacher', email: 'srujana@example.com' },
    { id: 'teacher-ravi', name: 'Ravi Kumar', role: 'teacher', email: 'ravi@example.com' },
    { id: 'me', name: 'Current User', role: 'teacher', email: 'me@example.com' }
];

const RESOURCES = [
    {
        id: 'res-1',
        title: 'Class 10 Math Basics',
        type: 'lesson-plan',
        authorId: 'teacher-srujana',
        authorName: 'Srujana R S',
        language: 'en',
        stats: { likes: 50, downloads: 10, views: 100 },
        createdAt: new Date()
    },
    {
        id: 'res-2',
        title: 'Science Experiments for Primary',
        type: 'video',
        authorId: 'teacher-ravi',
        authorName: 'Ravi Kumar',
        language: 'hi',
        stats: { likes: 20, downloads: 5, views: 50 },
        createdAt: new Date()
    },
    {
        id: 'res-3',
        title: 'My Private Interaction Notes',
        type: 'document',
        authorId: 'me',
        authorName: 'Current User',
        language: 'en',
        stats: { likes: 5, downloads: 0, views: 10 },
        createdAt: new Date() // Post creation date
    }
];

const FOLLOWS = [
    { followerId: 'me', followingId: 'teacher-srujana' }
];

async function seed() {
    console.log("Seeding Community Data...");
    const db = await getDb();

    // Seed Users
    for (const user of USERS) {
        await db.collection('users').doc(user.id).set(user, { merge: true });
        console.log(`User seeded: ${user.name}`);
    }

    // Seed Resources
    for (const res of RESOURCES) {
        // Ensure stats object is plain object
        const data = { ...res, stats: { ...res.stats } };
        await db.collection('library_resources').doc(res.id).set(data, { merge: true });
        console.log(`Resource seeded: ${res.title}`);
    }

    // Seed Follows (assuming 'follows' collection structure: followerId_followingId)
    // Or subcollections? Code uses `getFollowingIdsAction` which queries `follows` collection?
    // Let's check `src/app/actions/community.ts` logic.
    // It queries `db.collection('follows').where('followerId', '==', userId)`

    for (const follow of FOLLOWS) {
        const id = `${follow.followerId}_${follow.followingId}`;
        await db.collection('follows').doc(id).set({
            ...follow,
            createdAt: new Date()
        });
        console.log(`Follow seeded: ${follow.followerId} -> ${follow.followingId}`);
    }

    console.log("Seeding Complete!");
}

seed().catch(console.error);
