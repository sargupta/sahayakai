/**
 * API Route: GET /api/analytics/teacher-health/[userId]
 * 
 * Returns teacher's health score and engagement metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TeacherAnalytics {
    user_id: string;
    sessions_last_7_days: number;
    sessions_days_8_to_14: number;
    content_created_last_7_days: number;
    content_created_days_8_to_14: number;
    features_used_last_30_days: string[];
    avg_generation_time_sec: number;
    avg_regenerations_per_content: number;
    successful_generations: number;
    total_attempts: number;
    days_since_last_use: number;
    consecutive_days_used: number;
    days_since_signup: number;
    content_created_total: number;
    exported_content_count: number;
    shared_to_community_count: number;
    estimated_students: number;
    location_type: 'rural' | 'urban';
    preferred_language: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        // Fetch from Firestore teacher_analytics collection
        const db = await getDb();
        const analyticsRef = db.collection('teacher_analytics').doc(userId);
        const analyticsDoc = await analyticsRef.get();

        if (!analyticsDoc.exists) {
            // Return default values for new users
            return NextResponse.json({
                score: 0,
                risk_level: 'critical',
                activity_score: 0,
                engagement_score: 0,
                success_score: 0,
                growth_score: 0,
                days_since_last_use: 0,
                consecutive_days_used: 0,
                estimated_students_impacted: 40, // Default assumption
            });
        }

        const data = analyticsDoc.data() as TeacherAnalytics;

        // Calculate health score
        const healthScore = calculateHealthScore(data);

        return NextResponse.json(healthScore);
    } catch (error) {
        console.error('Failed to fetch teacher health score:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function calculateHealthScore(data: TeacherAnalytics) {
    // Activity Score (0-30)
    let activity = 0;
    if (data.sessions_last_7_days >= 5) activity += 15;
    else if (data.sessions_last_7_days >= 3) activity += 10;
    else if (data.sessions_last_7_days >= 1) activity += 5;

    if (data.content_created_last_7_days >= 5) activity += 10;
    else if (data.content_created_last_7_days >= 3) activity += 6;
    else if (data.content_created_last_7_days >= 1) activity += 3;

    if (data.days_since_last_use === 0) activity += 5;
    else if (data.days_since_last_use <= 2) activity += 3;
    else if (data.days_since_last_use <= 5) activity += 1;

    activity = Math.min(activity, 30);

    // Engagement Score (0-30)
    let engagement = 0;
    const contentLastWeek = data.content_created_last_7_days;
    if (contentLastWeek >= 5) engagement += 15;
    else if (contentLastWeek >= 3) engagement += 10;
    else if (contentLastWeek >= 1) engagement += 5;

    const featuresUsed = data.features_used_last_30_days?.length || 0;
    if (featuresUsed >= 4) engagement += 10;
    else if (featuresUsed >= 2) engagement += 6;
    else if (featuresUsed >= 1) engagement += 3;

    if (data.shared_to_community_count > 0) engagement += 5;
    else if (data.exported_content_count > 0) engagement += 2;

    engagement = Math.min(engagement, 30);

    // Success Score (0-20)
    let success = 0;
    const successRate = data.total_attempts > 0
        ? data.successful_generations / data.total_attempts
        : 0;
    if (successRate >= 0.9) success += 15;
    else if (successRate >= 0.7) success += 10;
    else if (successRate >= 0.5) success += 5;

    if (data.avg_regenerations_per_content <= 1.2) success += 5;
    else if (data.avg_regenerations_per_content <= 2) success += 2;

    success = Math.min(success, 20);

    // Growth Score (0-20)
    let growth = 0;
    const thisWeek = data.content_created_last_7_days;
    const lastWeek = data.content_created_days_8_to_14;

    if (thisWeek > lastWeek && thisWeek >= 3) growth += 10;
    else if (thisWeek >= lastWeek && thisWeek >= 2) growth += 6;
    else if (thisWeek >= 1) growth += 3;

    if (data.consecutive_days_used >= 7) growth += 10;
    else if (data.consecutive_days_used >= 3) growth += 6;
    else if (data.consecutive_days_used >= 1) growth += 3;

    growth = Math.min(growth, 20);

    const total = activity + engagement + success + growth;

    let riskLevel: 'healthy' | 'at-risk' | 'critical';
    if (total >= 70) riskLevel = 'healthy';
    else if (total >= 40) riskLevel = 'at-risk';
    else riskLevel = 'critical';

    return {
        score: total,
        risk_level: riskLevel,
        activity_score: activity,
        engagement_score: engagement,
        success_score: success,
        growth_score: growth,
        days_since_last_use: data.days_since_last_use,
        consecutive_days_used: data.consecutive_days_used,
        estimated_students_impacted: data.estimated_students || 40,
    };
}
