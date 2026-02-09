/**
 * API Route: POST /api/teacher-activity
 * 
 * Receives teacher activity events and logs them for analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AnalyticsEvent } from '@/lib/analytics-events';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EventBatch {
    events: AnalyticsEvent[];
}

export async function POST(req: NextRequest) {
    try {
        const body: EventBatch = await req.json();

        if (!body.events || !Array.isArray(body.events)) {
            return NextResponse.json(
                { error: 'Invalid events format' },
                { status: 400 }
            );
        }

        const db = await getDb();
        const batch = db.batch();
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Log each event to Cloud Logging & Aggregation
        for (const event of body.events) {
            const severity = getEventSeverity(event);

            // 1. Structured Logging (stdout)
            const logEntry = {
                severity,
                message: `Teacher activity: ${event.event_type}`,
                event_type: event.event_type,
                data: event,
                labels: {
                    event_type: event.event_type,
                    user_id: event.user_id,
                    session_id: event.session_id,
                },
                timestamp: new Date(event.timestamp).toISOString(),
            };
            console.log(JSON.stringify(logEntry));

            // 2. Firestore Aggregation (Daily Stats)
            // Schema: users/{userId}/analytics/{YYYY-MM-DD}
            if (event.user_id) {
                const dailyRef = db
                    .collection('users')
                    .doc(event.user_id)
                    .collection('analytics')
                    .doc(todayStr);

                const updates: Record<string, any> = {
                    lastUpdated: FieldValue.serverTimestamp(),
                    [`events.${event.event_type}`]: FieldValue.increment(1),
                    totalEvents: FieldValue.increment(1)
                };

                // Specific metric aggregations
                if (event.event_type === 'session_start') {
                    updates.sessions = FieldValue.increment(1);
                }
                if (event.event_type === 'content_created') {
                    updates.contentCreated = FieldValue.increment(1);
                    // @ts-ignore
                    if (event.content_type) {
                        // @ts-ignore
                        updates[`contentByType.${event.content_type}`] = FieldValue.increment(1);
                    }
                }

                batch.set(dailyRef, updates, { merge: true });

                // 3. Real-time Aggregation (Teacher Health Stats)
                // Also update the 'teacher_analytics/{userId}' document for instant dashboard feedback
                const healthRef = db.collection('teacher_analytics').doc(event.user_id);
                const healthUpdates: Record<string, any> = {
                    last_active: FieldValue.serverTimestamp(),
                    days_since_last_use: 0, // Reset on activity
                    total_attempts: FieldValue.increment(1),
                };

                // Aggregation Logic (Simplified for real-time)
                if (event.event_type === 'session_start') {
                    healthUpdates.sessions_last_7_days = FieldValue.increment(1);
                    healthUpdates.consecutive_days_used = FieldValue.increment(1); // Naive increment, proper logic needs cloud function
                }
                if (event.event_type === 'content_created') {
                    healthUpdates.content_created_last_7_days = FieldValue.increment(1);
                    healthUpdates.content_created_total = FieldValue.increment(1);
                    if (event.success) {
                        healthUpdates.successful_generations = FieldValue.increment(1);
                    }
                }
                if (event.event_type === 'feature_use') {
                    // We can't easily append to a list in Firestore without reading first or using arrayUnion
                    // enabling arrayUnion for features
                    healthUpdates.features_used_last_30_days = FieldValue.arrayUnion(event.feature);
                }

                batch.set(healthRef, healthUpdates, { merge: true });
            }
        }

        // Commit all Firestore updates
        await batch.commit();

        return NextResponse.json({
            success: true,
            received: body.events.length
        });
    } catch (error) {
        console.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Failed to process teacher activity events',
            error: error instanceof Error ? error.message : String(error),
        }));

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Determine log severity based on event type
 */
function getEventSeverity(event: AnalyticsEvent): 'INFO' | 'WARNING' | 'ERROR' {
    switch (event.event_type) {
        case 'challenge_detected':
            if (event.severity === 'high') return 'ERROR';
            if (event.severity === 'medium') return 'WARNING';
            return 'INFO';

        case 'content_created':
            if (!event.success) return 'WARNING';
            return 'INFO';

        default:
            return 'INFO';
    }
}
