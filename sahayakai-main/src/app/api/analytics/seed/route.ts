
import { type NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';
import { validateAdmin } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
    // Admin gate: demo-mode seeder must never be reachable by unauth callers.
    const callerUid = req.headers.get('x-user-id');
    if (!callerUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await validateAdmin(callerUid);
    } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'UserId required' }, { status: 400 });
        }

        const db = await getDb();
        const healthRef = db.collection('teacher_analytics').doc(userId);

        // Create meaningful demo data
        const demoData = {
            last_active: FieldValue.serverTimestamp(),
            days_since_last_use: 0,
            total_attempts: 42,
            sessions_last_7_days: 5,
            content_created_last_7_days: 12,
            content_created_total: 85,
            successful_generations: 82,
            features_used_last_30_days: ['lesson-plan', 'quiz-generator', 'visual-aid', 'qa-generator'],

            // Preset scores
            score: 78,
            risk_level: 'healthy',
            activity_score: 25,
            engagement_score: 22,
            success_score: 18,
            growth_score: 13,
            consecutive_days_used: 12,
            estimated_students_impacted: 140
        };

        await healthRef.set(demoData, { merge: true });

        return NextResponse.json({ success: true, message: "Analytics seeded" });
    } catch (error: any) {
        logger.error("Seed API Error", error, 'ANALYTICS');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
