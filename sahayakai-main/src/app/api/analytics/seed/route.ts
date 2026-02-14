
import { type NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
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
        console.error("Seed API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
