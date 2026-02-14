/**
 * SahayakAI - Check Teacher Activity by Email
 * 
 * Use this script to look up any teacher's activity by their email address
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('\n❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
        console.error('\nLoad environment first: source .env.local\n');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function getTeacherActivity(email) {
    console.log(`\n🔍 Looking up teacher: ${email}\n`);

    try {
        // 1. Find user by email in Firestore
        const usersSnapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            console.log('❌ No teacher found with that email address');
            console.log('\nPossible reasons:');
            console.log('  - Teacher hasn\'t registered yet');
            console.log('  - Email was typed incorrectly');
            console.log('  - Teacher registered with a different email\n');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        // 2. Display User Profile
        console.log('👤 TEACHER PROFILE');
        console.log('─'.repeat(50));
        console.log(`Name:     ${userData.displayName || 'Not set'}`);
        console.log(`Email:    ${userData.email}`);
        console.log(`User ID:  ${userId}`);
        console.log(`School:   ${userData.schoolName || 'Not set'}`);
        console.log(`Grades:   ${userData.teachingGradeLevels?.join(', ') || 'Not set'}`);
        console.log(`Subjects: ${userData.subjects?.join(', ') || 'Not set'}`);
        console.log(`Language: ${userData.preferredLanguage || 'English'}`);

        const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt);
        const lastLogin = userData.lastLogin?.toDate?.() || new Date(userData.lastLogin);
        console.log(`\nJoined:      ${createdAt.toLocaleString()}`);
        console.log(`Last Login:  ${lastLogin.toLocaleString()}`);

        // 3. Get Content Created
        const contentSnapshot = await db.collection('users')
            .doc(userId)
            .collection('content')
            .get();

        console.log(`\n📚 CONTENT CREATED: ${contentSnapshot.size} items`);
        console.log('─'.repeat(50));

        if (contentSnapshot.size > 0) {
            const contentByType = {};
            contentSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const type = data.type || 'unknown';
                contentByType[type] = (contentByType[type] || 0) + 1;
            });

            Object.entries(contentByType).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });

            // Show recent items
            const recentContent = contentSnapshot.docs
                .map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }))
                .sort((a, b) => {
                    const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
                    const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
                    return bTime - aTime;
                })
                .slice(0, 5);

            console.log('\n  Recent Content:');
            recentContent.forEach((item, i) => {
                const createdDate = item.createdAt?.toDate?.() || new Date(item.createdAt);
                console.log(`    ${i + 1}. ${item.title || 'Untitled'} (${item.type})`);
                console.log(`       Created: ${createdDate.toLocaleDateString()}`);
            });
        } else {
            console.log('  No content created yet');
        }

        // 4. Get Analytics/Health Score
        const analyticsDoc = await db.collection('teacher_analytics')
            .doc(userId)
            .get();

        if (analyticsDoc.exists) {
            const analytics = analyticsDoc.data();

            console.log(`\n📊 TEACHER HEALTH SCORE`);
            console.log('─'.repeat(50));

            // Calculate score
            const activity = Math.min(30, (analytics.sessions_last_7_days || 0) * 5);
            const engagement = Math.min(30, (analytics.content_created_last_7_days || 0) * 5);
            const successRate = analytics.total_attempts > 0
                ? (analytics.successful_generations / analytics.total_attempts)
                : 0;
            const success = Math.min(20, successRate * 20);
            const growth = Math.min(20, (analytics.consecutive_days_used || 0) * 2);
            const totalScore = Math.round(activity + engagement + success + growth);

            let riskLevel = '🔴 Critical';
            if (totalScore >= 70) riskLevel = '🟢 Healthy';
            else if (totalScore >= 40) riskLevel = '🟡 At Risk';

            console.log(`Overall Score: ${totalScore}/100 (${riskLevel})`);
            console.log(`\nBreakdown:`);
            console.log(`  Activity:    ${Math.round(activity)}/30 (${analytics.sessions_last_7_days || 0} sessions last 7 days)`);
            console.log(`  Engagement:  ${Math.round(engagement)}/30 (${analytics.content_created_last_7_days || 0} content last 7 days)`);
            console.log(`  Success:     ${Math.round(success)}/20 (${(successRate * 100).toFixed(1)}% success rate)`);
            console.log(`  Growth:      ${Math.round(growth)}/20 (${analytics.consecutive_days_used || 0} day streak)`);

            console.log(`\nActivity Stats:`);
            console.log(`  Days since last use:    ${analytics.days_since_last_use || 0}`);
            console.log(`  Consecutive days used:  ${analytics.consecutive_days_used || 0}`);
            console.log(`  Total content created:  ${analytics.content_created_total || 0}`);
            console.log(`  Students impacted (est): ${analytics.estimated_students || 40}`);

            if (analytics.features_used_last_30_days?.length > 0) {
                console.log(`\nFeatures Used:`);
                analytics.features_used_last_30_days.forEach(feature => {
                    console.log(`  - ${feature}`);
                });
            }
        } else {
            console.log(`\n📊 TEACHER HEALTH SCORE`);
            console.log('─'.repeat(50));
            console.log('No analytics data available yet');
            console.log('Analytics are generated after teacher creates content');
        }

        console.log('\n✅ Lookup complete!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nPlease ensure Firebase is properly configured\n');
    }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.log('\n📧 SahayakAI - Teacher Activity Lookup\n');
    console.log('Usage:');
    console.log('  npm run teacher:lookup <email>\n');
    console.log('Example:');
    console.log('  npm run teacher:lookup priya@school.in\n');
    process.exit(1);
}

// Run the lookup
getTeacherActivity(email)
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
