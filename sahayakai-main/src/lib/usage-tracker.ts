import { logger } from './logger';
import { costService } from './services/cost-service';

export type UsageMetricType =
    | 'gemini_tokens'
    | 'tts_characters'
    | 'image_generation'
    | 'grounding_calls'
    | 'firestore_writes';

interface UsagePayload {
    userId: string;
    type: UsageMetricType;
    value: number;
    metadata?: Record<string, any>;
}

/**
 * Centralized utility for tracking resource usage and costs.
 * Logs structured data that can be picked up by GCP Logging and aggregated.
 */
export const UsageTracker = {
    logUsage({ userId, type, value, metadata }: UsagePayload) {
        logger.info(`Usage Tracked: ${type}`, 'COST_MONITORING', {
            userId,
            metric_type: type,
            value,
            ...metadata,
            labels: {
                metric_type: type,
                user_id: userId,
                cost_tracking: 'true'
            }
        });

        // Atomic update in Firestore for real-time dashboard
        costService.trackDailyUsage(type, value).catch(err =>
            logger.error(`Failed to persist usage for ${type}`, err, 'COST_MONITORING')
        );
    },

    trackTTS(userId: string, characterCount: number, cacheHit: boolean = false) {
        this.logUsage({
            userId,
            type: 'tts_characters',
            value: characterCount,
            metadata: { cacheHit }
        });
    },

    trackGemini(userId: string, tokens: number, model: string) {
        this.logUsage({
            userId,
            type: 'gemini_tokens',
            value: tokens,
            metadata: { model }
        });
    },

    trackGrounding(userId: string, query: string) {
        this.logUsage({
            userId,
            type: 'grounding_calls',
            value: 1,
            metadata: { query }
        });
    },

    trackImageGen(userId: string) {
        this.logUsage({
            userId,
            type: 'image_generation',
            value: 1
        });
    }
};
