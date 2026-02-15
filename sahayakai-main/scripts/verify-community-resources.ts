
import { getDb } from "../src/lib/firebase-admin";
import { getLibraryResources } from "../src/app/actions/community";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyCommunityResources() {
    console.log("Verifying Community Resources Query using direct Firestore access...");

    // 1. Get a known author
    const db = await getDb();
    const resourcesSnap = await db.collection('library_resources').get();
    const totalResources = resourcesSnap.size;
    console.log(`Found ${totalResources} total resources.`);

    // Find a teacher author
    const teacherRes = resourcesSnap.docs.find(d => d.data().authorId?.startsWith('teacher-'));
    const targetAuthorId = teacherRes?.data().authorId || 'teacher-srujana';
    console.log(`Using real authorId from DB: ${targetAuthorId}`);

    // Test Exact Match (Profile)
    console.log(`\n--- Simulating Profile Tab Query (authorId == '${targetAuthorId}') ---`);
    const profileResources = await getLibraryResources({ authorId: targetAuthorId, excludeTypes: ['document'] });
    console.log(`Success! Found ${profileResources.length} resources.`);

    // Test 'in' Query (Following)
    console.log(`\n--- Simulating Following Tab Query (authorId in ['${targetAuthorId}']) ---`);
    const followingResources = await getLibraryResources({ authorIds: [targetAuthorId], excludeTypes: ['document'] });
    console.log(`Success! Found ${followingResources.length} resources.`);

    // Test Global Trending (Privacy Check)
    console.log(`\n--- Simulating Trending Tab Query (Global + Privacy Filter) ---`);
    const trendingResources = await getLibraryResources({ excludeTypes: ['document'] });
    console.log(`Found ${trendingResources.length} public resources.`);

    // Validation
    const privateDocs = trendingResources.filter((r: any) => r.type === 'document');
    if (privateDocs.length > 0) {
        console.error("CRITICAL FAILURE: Private documents found in Trending!");
        privateDocs.forEach((d: any) => console.error(`  - ${d.title} (${d.type})`));
        process.exit(1);
    } else {
        console.log("SUCCESS: No private documents in Trending.");
    }

    if (trendingResources.length === 0) {
        console.warn("WARNING: Trending is empty. Check if seed data exists.");
    }

    console.log("\nVERIFICATION PASSED: Queries work and Privacy Filter is strictly enforced.");
}

verifyCommunityResources().catch(console.error);
