#!/usr/bin/env ts-node

/**
 * SahayakAI Metrics Checker
 * 
 * Quick script to check user registration, activity, and KPIs
 */

import { getDb } from '../src/lib/firebase-admin';

async function checkMetrics() {
    console.log('🔍 SahayakAI Metrics Report\n');

    const db = await getDb();

    // 1. Total Registered Users
    const usersSnapshot = await db.collection('users').get();
    console.log(`👥 Total Registered Users: ${usersSnapshot.size}`);

    // 2. Active Users (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsersSnapshot = await db.collection('users')
        .where('lastLogin', '>=', sevenDaysAgo)
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

    for (const userDoc of usersSnapshot.docs) {
        const contentSnapshot = await db.collection('users')
            .doc(userDoc.id)
            .collection('content')
            .get();

        totalContent += contentSnapshot.size;

        contentSnapshot.docs.forEach(doc => {
            const type = doc.data().type;
            if (type in contentTypes) {
                contentTypes[type as keyof typeof contentTypes]++;
            }
        });
    }

    console.log(`\n📝 Total Content Generated: ${totalContent}`);
    console.log('   Breakdown:');
    Object.entries(contentTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
    });

    // 4. Teacher Health Summary
    const analyticsSnapshot = await db.collection('teacher_analytics').get();

    let healthyTeachers = 0;
    let atRiskTeachers = 0;
    let criticalTeachers = 0;
    let totalScore = 0;

    analyticsSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // Calculate score (simplified version)
        const activity = Math.min(30, (data.sessions_last_7_days || 0) * 5);
        const engagement = Math.min(30, (data.content_created_last_7_days || 0) * 5);
        const success = Math.min(20, (data.successful_generations || 0) / Math.max(1, data.total_attempts || 1) * 20);
        const growth = Math.min(20, (data.consecutive_days_used || 0) * 2);

        const score = activity + engagement + success + growth;
        totalScore += score;

        if (score >= 70) healthyTeachers++;
        else if (score >= 40) atRiskTeachers++;
        else criticalTeachers++;
    });

    const avgScore = analyticsSnapshot.size > 0 ? (totalScore / analyticsSnapshot.size).toFixed(1) : '0';

    console.log(`\n📊 Teacher Health Summary:`);
    console.log(`   Average Health Score: ${avgScore}/100`);
    console.log(`   🟢 Healthy: ${healthyTeachers}`);
    console.log(`   🟡 At Risk: ${atRiskTeachers}`);
    console.log(`   🔴 Critical: ${criticalTeachers}`);

    // 5. Most Active Teachers
    console.log(`\n🏆 Top 5 Most Active Teachers (by content created):`);

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

    teachersWithContent
        .sort((a, b) => b.contentCount - a.contentCount)
        .slice(0, 5)
        .forEach((teacher, index) => {
            console.log(`   ${index + 1}. ${teacher.name} (${teacher.email}): ${teacher.contentCount} items`);
        });

    console.log('\n✅ Metrics check complete!\n');
}

// Run the script
checkMetrics()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error checking metrics:', error);
        process.exit(1);
    });
