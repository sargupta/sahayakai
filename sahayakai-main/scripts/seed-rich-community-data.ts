
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function seedRichData() {
    console.log("--- Seeding RICH Community Data ---");
    const db = await getDb();
    const batch = db.batch();

    const authors = [
        { id: 'teacher-srujana', name: 'Srujana R S', school: 'DPS Bangalore' },
        { id: 'teacher-ravi', name: 'Ravi Kumar', school: 'Kendriya Vidyalaya' },
        { id: 'teacher-anjali', name: 'Anjali Sharma', school: 'Sanskriti School' }
    ];

    const resources = [
        {
            title: "Coordinate Geometry: Visual Proofs",
            type: "lesson-plan",
            language: "English",
            authorIdx: 0,
            stats: { likes: 124, downloads: 45 },
            grade: "Class 10"
        },
        {
            title: "Photosynthesis: Interactive Lab Guide",
            type: "experiment",
            language: "English",
            authorIdx: 1,
            stats: { likes: 89, downloads: 30 },
            grade: "Class 9"
        },
        {
            title: "Hindi Vyakaran: Sangya aur Sarvanam",
            type: "worksheet",
            language: "Hindi",
            authorIdx: 2,
            stats: { likes: 210, downloads: 150 },
            grade: "Class 6"
        },
        {
            title: "Thermodynamics: Heat Engine Simulator",
            type: "simulation",
            language: "English",
            authorIdx: 1,
            stats: { likes: 156, downloads: 12 },
            grade: "Class 11"
        },
        {
            title: "Mughal Empire: Timeline & Critical Analysis",
            type: "presentation",
            language: "English",
            authorIdx: 0,
            stats: { likes: 95, downloads: 40 },
            grade: "Class 7"
        },
        {
            title: "Linear Equations in Two Variables",
            type: "quiz",
            language: "English",
            authorIdx: 2,
            stats: { likes: 78, downloads: 25 },
            grade: "Class 9"
        },
        {
            title: "Trigonometry: Height and Distance",
            type: "lesson-plan",
            language: "English",
            authorIdx: 0,
            stats: { likes: 112, downloads: 60 },
            grade: "Class 10"
        }
    ];

    // Create Resources
    for (const res of resources) {
        const ref = db.collection('library_resources').doc();
        const author = authors[res.authorIdx];
        batch.set(ref, {
            title: res.title,
            type: res.type,
            language: res.language,
            authorId: author.id,
            authorName: author.name,
            schoolName: author.school,
            visibility: 'public',
            createdAt: new Date().toISOString(),
            stats: res.stats,
            description: `A comprehensive ${res.type} on ${res.title} for ${res.grade}.`,
            tags: [res.grade, res.type, 'CBSE']
        });
    }

    // Ensure Users exist for these authors
    for (const author of authors) {
        const userRef = db.collection('users').doc(author.id);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            batch.set(userRef, {
                uid: author.id,
                displayName: author.name,
                schoolName: author.school,
                email: `${author.id}@example.com`,
                photoURL: null, // UI handles fallback
                createdAt: new Date().toISOString()
            });
        }
    }

    // Connect 'me' (current user fallback) to all new teachers so Following tab is FULL
    // We'll target the 'me' user ID if it exists, or the first test user
    const viewerId = 'mcyD4zJGqZXiy3tt0vZJtoinVyE3'; // Abhishek Gupta from logs

    for (const author of authors) {
        const connRef = db.collection('connections').doc(`${viewerId}_${author.id}`);
        batch.set(connRef, {
            followerId: viewerId,
            followingId: author.id,
            createdAt: new Date().toISOString()
        });
    }

    await batch.commit();
    console.log("Seeded rich data successfully.");
}

seedRichData().catch(console.error);
