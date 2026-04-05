/**
 * API Route: POST /api/metrics
 * 
 * Receives performance metrics from clients and logs them to Google Cloud Logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MetricBatch {
    metrics: Array<{
        type: string;
        timestamp: number;
        [key: string]: any;
    }>;
}

export async function POST(req: NextRequest) {
    try {
        const body: MetricBatch = await req.json();

        if (!body.metrics || !Array.isArray(body.metrics)) {
            return NextResponse.json(
                { error: 'Invalid metrics format' },
                { status: 400 }
            );
        }

        // Log each metric to Google Cloud Logging with structured data
        for (const metric of body.metrics) {
            // Determine severity based on metric type and values
            const severity = getSeverity(metric);

            // Log to Cloud Logging with proper structure
            switch (severity) {
                case 'WARNING':
                    logger.warn(`Performance Warning on ${metric.page || 'unknown'}: ${metric.type} metric elevated`, 'METRICS', {
                        metric: metric.type,
                        data: metric,
                        labels: {
                            metric_type: metric.type,
                            page: metric.page,
                            user_id: metric.userId,
                        },
                    });
                    break;

                case 'ERROR': {
                    const durationStr = metric.duration ? ` took ${metric.duration}ms` : (metric.totalDuration ? ` took ${metric.totalDuration}ms` : '');
                    const detailsStr = metric.rating ? ` (Rating: ${metric.rating})` : '';
                    const message = `Poor Performance on /${metric.page || 'unknown'}: ${metric.type}${durationStr}${detailsStr}`;

                    logger.error(
                        message,
                        new Error(message),
                        'METRICS',
                        {
                            metric: metric.type,
                            data: metric,
                            labels: {
                                metric_type: metric.type,
                                page: metric.page,
                                user_id: metric.userId,
                            },
                        }
                    );
                    break;
                }

                default:
                    logger.info(`Performance OK on ${metric.page || 'unknown'}: ${metric.type}`, 'METRICS', {
                        metric: metric.type,
                        data: metric,
                        labels: {
                            metric_type: metric.type,
                            page: metric.page,
                            user_id: metric.userId,
                        },
                    });
            }
        }

        return NextResponse.json({
            success: true,
            received: body.metrics.length
        });
    } catch (error) {
        logger.error('Failed to process metrics', error, 'METRICS');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Determine log severity based on metric values
 */
function getSeverity(metric: any): 'INFO' | 'WARNING' | 'ERROR' {
    switch (metric.type) {
        case 'web_vital':
            if (metric.rating === 'poor') return 'ERROR';
            if (metric.rating === 'needs-improvement') return 'WARNING';
            return 'INFO';

        case 'page_load':
            if (metric.duration > 5000) return 'ERROR'; // >5s is critical
            if (metric.duration > 3000) return 'WARNING'; // >3s is concerning
            return 'INFO';

        case 'ai_generation':
            if (!metric.success) return 'ERROR';
            if (metric.totalDuration > 15000) return 'WARNING'; // >15s is slow
            return 'INFO';

        case 'api_call':
            if (metric.statusCode >= 500) return 'ERROR';
            if (metric.statusCode >= 400) return 'WARNING';
            if (metric.duration > 1000) return 'WARNING'; // >1s API call
            return 'INFO';

        case 'cost_metric':
            // Thresholds based on USER_REQUEST
            if (metric.metric === 'gemini_spend_daily' && metric.value > 50) return 'ERROR';
            if (metric.metric === 'tts_char_count_daily' && metric.value > 5000000) return 'ERROR';
            if (metric.metric === 'image_gen_calls_daily' && metric.value > 500) return 'ERROR';
            if (metric.metric === 'grounding_calls_daily' && metric.value > 1000) return 'ERROR';

            // Warnings at 80% of threshold
            if (metric.metric === 'gemini_spend_daily' && metric.value > 40) return 'WARNING';
            if (metric.metric === 'tts_char_count_daily' && metric.value > 4000000) return 'WARNING';
            if (metric.metric === 'image_gen_calls_daily' && metric.value > 400) return 'WARNING';
            if (metric.metric === 'grounding_calls_daily' && metric.value > 800) return 'WARNING';

            return 'INFO';

        default:
            return 'INFO';
    }
}
