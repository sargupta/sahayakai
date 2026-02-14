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
                    logger.warn('Performance metric', 'METRICS', {
                        metric: metric.type,
                        data: metric,
                        labels: {
                            metric_type: metric.type,
                            page: metric.page,
                            user_id: metric.userId,
                        },
                    });
                    break;

                case 'ERROR':
                    logger.error(
                        'Performance metric - Poor',
                        new Error(`Poor performance: ${metric.type}`),
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

                default:
                    logger.info('Performance metric', 'METRICS', {
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
        console.error('Failed to process metrics:', error);
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

        default:
            return 'INFO';
    }
}
