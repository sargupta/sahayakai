/**
 * React Hook: usePerformanceTracking
 * 
 * Convenience hook for tracking performance metrics in React components
 */

import { useEffect, useRef, useCallback } from 'react';
import { trackAIGeneration, trackInteraction, flushMetrics } from '@/lib/performance-monitor';
import type { AIGenerationMetric, UserInteractionMetric } from '@/lib/performance-monitor';

type AIGenData = Omit<AIGenerationMetric, 'type' | 'timestamp' | 'page' | 'userId' | 'sessionId'>;
type InteractionData = Omit<UserInteractionMetric, 'type' | 'timestamp' | 'page' | 'userId' | 'sessionId'>;

export function usePerformanceTracking() {
    const startTimeRef = useRef<number>(0);

    /**
     * Start timing an AI generation operation
     */
    const startAIGeneration = useCallback(() => {
        startTimeRef.current = Date.now();
    }, []);

    /**
     * End timing and track AI generation
     */
    const endAIGeneration = useCallback((data: Partial<AIGenData>) => {
        if (!startTimeRef.current) {
            console.warn('[Performance] startAIGeneration was not called');
            return;
        }

        const totalDuration = Date.now() - startTimeRef.current;

        trackAIGeneration({
            feature: data.feature || 'unknown',
            operation: data.operation || 'generate',
            language: data.language || 'en',
            gradeLevel: data.gradeLevel,
            totalDuration,
            apiDuration: data.apiDuration || totalDuration,
            renderDuration: data.renderDuration,
            inputLength: data.inputLength || 0,
            outputLength: data.outputLength,
            cacheHit: data.cacheHit || false,
            success: data.success !== false,
            errorType: data.errorType,
            retryCount: data.retryCount || 0,
        });

        startTimeRef.current = 0;
    }, []);

    /**
     * Track a user interaction with automatic latency measurement
     */
    const trackClick = useCallback((target: string, action?: string) => {
        const start = Date.now();

        return {
            complete: (successful: boolean = true) => {
                const latency = Date.now() - start;
                trackInteraction({
                    action: action || 'click',
                    target,
                    latency,
                    successful,
                });
            },
        };
    }, []);

    /**
     * Flush metrics on component unmount
     */
    useEffect(() => {
        return () => {
            flushMetrics();
        };
    }, []);

    return {
        startAIGeneration,
        endAIGeneration,
        trackClick,
    };
}

/**
 * Higher-order function to wrap async AI operations with performance tracking
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    getMetadata: (args: Parameters<T>, result?: any, error?: any) => Partial<AIGenData>
): T {
    return (async (...args: Parameters<T>) => {
        const start = Date.now();
        const apiStart = Date.now();

        try {
            const result = await fn(...args);
            const duration = Date.now() - start;
            const apiDuration = Date.now() - apiStart;

            const metadata = getMetadata(args, result);

            trackAIGeneration({
                feature: metadata.feature || 'unknown',
                operation: metadata.operation || 'generate',
                language: metadata.language || 'en',
                gradeLevel: metadata.gradeLevel,
                totalDuration: duration,
                apiDuration,
                renderDuration: duration - apiDuration,
                inputLength: metadata.inputLength || 0,
                outputLength: metadata.outputLength,
                cacheHit: metadata.cacheHit || false,
                success: true,
                retryCount: 0,
            });

            return result;
        } catch (error) {
            const duration = Date.now() - start;
            const metadata = getMetadata(args, undefined, error);

            trackAIGeneration({
                feature: metadata.feature || 'unknown',
                operation: metadata.operation || 'generate',
                language: metadata.language || 'en',
                gradeLevel: metadata.gradeLevel,
                totalDuration: duration,
                apiDuration: Date.now() - apiStart,
                inputLength: metadata.inputLength || 0,
                cacheHit: false,
                success: false,
                errorType: error instanceof Error ? error.message : 'Unknown error',
                retryCount: metadata.retryCount || 0,
            });

            throw error;
        }
    }) as T;
}
