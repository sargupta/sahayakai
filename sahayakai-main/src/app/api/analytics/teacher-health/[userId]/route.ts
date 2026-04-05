/**
 * API Route: GET /api/analytics/teacher-health/[userId]
 *
 * Returns teacher's health score and engagement metrics.
 *
 * SCORING MODEL v2 (2026-03-03):
 * H(t) = 100 × σ( wA·A + wE·E + wS·S + wG·G + wC·C − β )
 *
 * Five orthogonal competency dimensions:
 *   A(t) = Kinematic Activity  [Temporal Decay, λ = ln(2)/3]
 *   E(t) = Feature Engagement  [Volume-Weighted Shannon Entropy, k=13]
 *   S(t) = Success Competency  [Bayesian Beta-Binomial + Regen Dampening]
 *   G(t) = Growth Momentum     [MACD-style EMA Divergence + Streak Bonus]
 *   C(t) = Community Impact    [Share depth + Export reach + Reciprocity]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { calculateHealthScore, TeacherAnalytics } from '@/lib/analytics/impact-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const db = await getDb();
        const analyticsRef = db.collection('teacher_analytics').doc(userId);
        const analyticsDoc = await analyticsRef.get();

        if (!analyticsDoc.exists) {
            return NextResponse.json({
                score: 0,
                risk_level: 'critical',
                activity_score: 0,
                engagement_score: 0,
                success_score: 0,
                growth_score: 0,
                community_score: 0,
                days_since_last_use: 0,
                consecutive_days_used: 0,
                estimated_students_impacted: 40,
            });
        }

        const data = analyticsDoc.data() as TeacherAnalytics;
        const healthScore = calculateHealthScore(data);
        return NextResponse.json(healthScore);

    } catch (error) {
        logger.error('Failed to fetch teacher health score', error, 'ANALYTICS', { userId: (await params).userId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

