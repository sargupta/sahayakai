/**
 * Performance Monitoring Utility for SahayakAI
 * 
 * Tracks Web Vitals, AI generation metrics, API performance,
 * and sends structured logs to Google Cloud Logging.
 */

import { onCLS, onINP, onLCP, onTTFB, onFCP, Metric } from 'web-vitals';

// ============================================================================
// TYPES
// ============================================================================

export type PerformanceMetricType =
    | 'web_vital'
    | 'page_load'
    | 'ai_generation'
    | 'api_call'
    | 'user_interaction'
    | 'resource_load';

export interface BaseMetric {
    type: PerformanceMetricType;
    timestamp: number;
    page: string;
    userId?: string;
    sessionId?: string;
}

export interface WebVitalMetric extends BaseMetric {
    type: 'web_vital';
    name: 'CLS' | 'INP' | 'LCP' | 'TTFB' | 'FCP';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
}

export interface PageLoadMetric extends BaseMetric {
    type: 'page_load';
    duration: number;
    route: string;
    ttfb: number;
    fcp?: number;
    lcp?: number;
    resources: {
        scripts: number;
        styles: number;
        images: number;
    };
}

export interface AIGenerationMetric extends BaseMetric {
    type: 'ai_generation';
    feature: string; // 'lesson-plan', 'quiz', etc.
    operation: 'generate' | 'regenerate' | 'edit';
    language: string;
    gradeLevel?: string;

    // Timing
    totalDuration: number;
    apiDuration: number;
    renderDuration?: number;

    // Context
    inputLength: number;
    outputLength?: number;
    cacheHit: boolean;

    // Quality
    success: boolean;
    errorType?: string;
    retryCount: number;
}

export interface APICallMetric extends BaseMetric {
    type: 'api_call';
    endpoint: string;
    method: string;
    duration: number;
    statusCode: number;
    cached: boolean;
    rateLimited: boolean;
    errorMessage?: string;
}

export interface UserInteractionMetric extends BaseMetric {
    type: 'user_interaction';
    action: string; // 'click', 'voice_input', 'template_select'
    target: string;
    latency: number;
    successful: boolean;
}

export type PerformanceMetric =
    | WebVitalMetric
    | PageLoadMetric
    | AIGenerationMetric
    | APICallMetric
    | UserInteractionMetric;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Batch settings
    batchSize: 10,
    batchTimeout: 5000, // ms

    // Sampling (send only X% of metrics to reduce cost)
    samplingRates: {
        web_vital: 100,        // Always send
        page_load: 100,        // Always send
        ai_generation: 100,    // Always send (critical)
        api_call: 50,          // 50% sampling
        user_interaction: 20,  // 20% sampling
    },

    // Logging endpoint
    endpoint: '/api/metrics',

    // Development mode (log to console)
    debug: process.env.NODE_ENV === 'development',
};

// ============================================================================
// METRIC COLLECTION
// ============================================================================

class PerformanceMonitor {
    private queue: PerformanceMetric[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private sessionId: string;

    constructor() {
        this.sessionId = this.generateSessionId();

        if (typeof window !== 'undefined') {
            this.initWebVitals();
            this.initPageLoadTracking();
            this.initNavigationTracking();
        }
    }

    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize Web Vitals tracking
     */
    private initWebVitals() {
        const sendWebVital = (metric: Metric) => {
            this.trackWebVital({
                name: metric.name as any,
                value: metric.value,
                rating: metric.rating as any,
            });
        };

        onCLS(sendWebVital);
        onINP(sendWebVital);
        onLCP(sendWebVital);
        onTTFB(sendWebVital);
        onFCP(sendWebVital);
    }

    /**
     * Track page load performance
     */
    private initPageLoadTracking() {
        if (typeof window === 'undefined') return;

        window.addEventListener('load', () => {
            // Wait a bit for all metrics to be available
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

                if (!perfData) return;

                const resources = performance.getEntriesByType('resource');
                const scripts = resources.filter(r => r.name.endsWith('.js')).length;
                const styles = resources.filter(r => r.name.endsWith('.css')).length;
                const images = resources.filter(r =>
                    r.name.match(/\\.(jpg|jpeg|png|gif|svg|webp)$/i)
                ).length;

                this.trackPageLoad({
                    route: window.location.pathname,
                    duration: perfData.loadEventEnd - perfData.fetchStart,
                    ttfb: perfData.responseStart - perfData.fetchStart,
                    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
                    lcp: undefined, // Will be set by onLCP
                    resources: { scripts, styles, images },
                });
            }, 500);
        });
    }

    /**
     * Track navigation changes (SPA)
     */
    private initNavigationTracking() {
        if (typeof window === 'undefined') return;

        let lastPath = window.location.pathname;
        let navigationStart = Date.now();

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'navigation') {
                    const current = window.location.pathname;
                    if (current !== lastPath) {
                        const duration = Date.now() - navigationStart;
                        this.trackPageLoad({
                            route: current,
                            duration,
                            ttfb: 0,
                            resources: { scripts: 0, styles: 0, images: 0 },
                        });
                        lastPath = current;
                        navigationStart = Date.now();
                    }
                }
            }
        });

        observer.observe({ type: 'navigation', buffered: true });
    }

    /**
     * Track a Web Vital metric
     */
    trackWebVital(data: Omit<WebVitalMetric, keyof BaseMetric | 'type'>) {
        this.addMetric({
            type: 'web_vital',
            ...data,
            ...this.getBaseMetadata(),
        });
    }

    /**
     * Track a page load
     */
    trackPageLoad(data: Omit<PageLoadMetric, keyof BaseMetric | 'type'>) {
        this.addMetric({
            type: 'page_load',
            ...data,
            ...this.getBaseMetadata(),
        });
    }

    /**
     * Track AI generation
     */
    trackAIGeneration(data: Omit<AIGenerationMetric, keyof BaseMetric | 'type'>) {
        this.addMetric({
            type: 'ai_generation',
            ...data,
            ...this.getBaseMetadata(),
        });
    }

    /**
     * Track API call
     */
    trackAPICall(data: Omit<APICallMetric, keyof BaseMetric | 'type'>) {
        this.addMetric({
            type: 'api_call',
            ...data,
            ...this.getBaseMetadata(),
        });
    }

    /**
     * Track user interaction
     */
    trackInteraction(data: Omit<UserInteractionMetric, keyof BaseMetric | 'type'>) {
        this.addMetric({
            type: 'user_interaction',
            ...data,
            ...this.getBaseMetadata(),
        });
    }

    /**
     * Add metric to queue and schedule batch send
     */
    private addMetric(metric: PerformanceMetric) {
        // Sampling
        const samplingRate = CONFIG.samplingRates[metric.type];
        if (Math.random() * 100 > samplingRate) return;

        // Debug log
        if (CONFIG.debug) {
            console.log('[Performance]', metric.type, metric);
        }

        this.queue.push(metric);

        // Send immediately if batch is full
        if (this.queue.length >= CONFIG.batchSize) {
            this.sendBatch();
        } else {
            // Schedule batch send
            if (this.batchTimer) clearTimeout(this.batchTimer);
            this.batchTimer = setTimeout(() => this.sendBatch(), CONFIG.batchTimeout);
        }
    }

    /**
     * Send batched metrics to server
     */
    private async sendBatch() {
        if (this.queue.length === 0) return;

        const batch = [...this.queue];
        this.queue = [];

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            await fetch(CONFIG.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metrics: batch }),
                keepalive: true, // Ensure delivery even if page unloads
            });
        } catch (error) {
            console.error('[Performance] Failed to send metrics:', error);
            // Re-queue failed metrics (with limit to avoid infinite growth)
            if (this.queue.length < 100) {
                this.queue.unshift(...batch);
            }
        }
    }

    /**
     * Get base metadata for all metrics
     */
    private getBaseMetadata() {
        return {
            timestamp: Date.now(),
            page: typeof window !== 'undefined' ? window.location.pathname : '',
            sessionId: this.sessionId,
            userId: this.getUserId(),
        };
    }

    /**
     * Get current user ID from auth context
     */
    private getUserId(): string | undefined {
        if (typeof window === 'undefined') return undefined;
        try {
            // Attempt to get from auth context or local storage
            const userStr = localStorage.getItem('auth_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                return user.uid;
            }
        } catch {
            return undefined;
        }
    }

    /**
     * Force send any pending metrics
     */
    flush() {
        return this.sendBatch();
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let monitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
    if (!monitor) {
        monitor = new PerformanceMonitor();
    }
    return monitor;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const trackAIGeneration = (data: Omit<AIGenerationMetric, keyof BaseMetric | 'type'>) =>
    getPerformanceMonitor().trackAIGeneration(data);

export const trackAPICall = (data: Omit<APICallMetric, keyof BaseMetric | 'type'>) =>
    getPerformanceMonitor().trackAPICall(data);

export const trackInteraction = (data: Omit<UserInteractionMetric, keyof BaseMetric | 'type'>) =>
    getPerformanceMonitor().trackInteraction(data);

export const flushMetrics = () => getPerformanceMonitor().flush();
