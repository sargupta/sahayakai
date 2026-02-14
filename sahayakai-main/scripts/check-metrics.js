/**
 * SahayakAI Metrics Checker - Simple Version
 * Run from Firebase Console or use Firestore REST API
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('\n❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
        console.error('\nPlease ensure Firebase is configured');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkMetrics() {
    console.log('🔍 SahayakAI Metrics Report\n');

    try {
        // 1. Total Registered Users
        const usersSnapshot = await db.collection('users').get();
        console.log(`👥 Total Registered Users: ${usersSnapshot.size}`);

        if (usersSnapshot.size === 0) {
            console.log('\n⚠️  No users found in database.');
            console.log('   This is expected if you haven\'t created any accounts yet.\n');
            return;
        }

        // 2. Active Users (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const activeUsersSnapshot = await db.collection('users')
            .where('lastLogin', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
            .get();
        console.log(`✅ Active Users (Last 7 Days): ${activeUsersSnapshot.size}`);

        // 3. Total Content Generated
        let totalContent = 0;
        const contentTypes = {
            'lesson-plan': 0,
            'quiz': 0,
            'worksheet': 0,
            'visual-aid': 0,
            'rubric': 0,
            'instant-answer': 0
        };

        console.log('\n📝 Checking content across all users...');
        for (const userDoc of usersSnapshot.docs) {
            const contentSnapshot = await db.collection('users')
                .doc(userDoc.id)
                .collection('content')
                .get();

            totalContent += contentSnapshot.size;

            contentSnapshot.docs.forEach(doc => {
                const type = doc.data().type;
                if (type in contentTypes) {
                    contentTypes[type]++;
                }
            });
        }

        console.log(`\n📊 Total Content Generated: ${totalContent}`);
        if (totalContent > 0) {
            console.log('   Breakdown:');
            Object.entries(contentTypes).forEach(([type, count]) => {
                if (count > 0) {
                    console.log(`   - ${type}: ${count}`);
                }
            });
        }

        // 4. Teacher Health Summary
        const analyticsSnapshot = await db.collection('teacher_analytics').get();

        if (analyticsSnapshot.size > 0) {
            let healthyTeachers = 0;
            let atRiskTeachers = 0;
            let critalTeachers = 0;
            let totalScore = 0;

            analyticsSnapshot.docs.forEach(doc => {
                const data = doc.data();

                // Calculate simplified score
                const activity = Math.min(30, (data.sessions_last_7_days || 0) * 5);
                const engagement = Math.min(30, (data.content_created_last_7_days || 0) * 5);
                const success = data.total_attempts > 0
                    ? Math.min(20, (data.successful_generations / data.total_attempts) * 20)
                    : 0;
                const growth = Math.min(20, (data.consecutive_days_used || 0) * 2);

                const score = activity + engagement + success + growth;
                totalScore += score;

                if (score >= 70) healthyTeachers++;
                else if (score >= 40) atRiskTeachers++;
                else criticalTeachers++;
            });

            const avgScore = (totalScore / analyticsSnapshot.size).toFixed(1);

            console.log(`\n📊 Teacher Health Summary:`);
            console.log(`   Average Health Score: ${avgScore}/100`);
            console.log(`   🟢 Healthy (70-100): ${healthyTeachers}`);
            console.log(`   🟡 At Risk (40-69): ${atRiskTeachers}`);
            console.log(`   🔴 Critical (0-39): ${criticalTeachers}`);
        }

        // 5. Most Active Teachers
        if (usersSnapshot.size > 0) {
            console.log(`\n🏆 Top Teachers (by content created):`);

            const teachersWithContent = [];

            for (const userDoc of usersSnapshot.docs) {
                const contentCount = (await db.collection('users')
                    .doc(userDoc.id)
                    .collection('content')
                    .get()).size;

                if (contentCount > 0) {
                    const userData = userDoc.data();
                    teachersWithContent.push({
                        name: userData.displayName || 'Unknown',
                        email: userData.email,
                        contentCount
                    });
                }
            }

            if (teachersWithContent.length > 0) {
                teachersWithContent
                    .sort((a, b) => b.contentCount - a.contentCount)
                    .slice(0, 5)
                    .forEach((teacher, index) => {
                        console.log(`   ${index + 1}. ${teacher.name} (${teacher.email}): ${teacher.contentCount} items`);
                    });
            } else {
                console.log('   No content created yet.');
            }
        }

        console.log('\n✅ Metrics check complete!\n');

    } catch (error) {
        console.error('\n❌ Error checking metrics:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Ensure Firebase credentials are properly configured');
        console.error('2. Check that Firestore database exists');
        console.error('3. Verify you have read permissions on the collections\n');
    }
}

// Run the script
checkMetrics()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
