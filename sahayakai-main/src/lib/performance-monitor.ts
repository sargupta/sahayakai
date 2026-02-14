import { onCLS, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export type PerformanceMetricType = 'web-vital' | 'custom-timing' | 'resource-load' | 'api-latency' | 'ai-generation' | 'interaction';

export interface BaseMetric {
    name: string;
    value: number;
    delta?: number;
    id?: string;
    timestamp: number;
    page_path: string;
    rating?: 'good' | 'needs-improvement' | 'poor';
}

export interface WebVitalMetric extends BaseMetric {
    type: 'web-vital';
}

export interface ResourceLoadMetric extends BaseMetric {
    type: 'resource-load';
    resource_type?: 'script' | 'css' | 'image' | 'fetch' | 'other';
}

export interface ApiLatencyMetric extends BaseMetric {
    type: 'api-latency';
    endpoint: string;
    method?: string;
    status_code?: number;
    success: boolean;
}

export interface AiGenerationMetric extends BaseMetric {
    type: 'ai-generation';
    model_id?: string;
    token_count?: number;
    prompt_length?: number;
    generation_type: 'text' | 'image' | 'audio' | 'video';
    success: boolean;
}

export interface UserInteractionMetric extends BaseMetric {
    type: 'interaction';
    interaction_type: 'click' | 'submit' | 'scroll' | 'hover' | 'regenerate';
    target_element?: string;
    component_name?: string;
}

export type PerformanceMetric =
    | WebVitalMetric
    | ResourceLoadMetric
    | ApiLatencyMetric
    | AiGenerationMetric
    | UserInteractionMetric;

// ----------------------------------------------------------------------
// Performance Monitor Class
// ----------------------------------------------------------------------

class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metricsQueue: PerformanceMetric[] = [];
    private isInitialized = false;
    private flushInterval = 10000; // 10 seconds
    private flushTimer: NodeJS.Timeout | null = null;
    private maxQueueSize = 50;

    private constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    private init() {
        if (this.isInitialized) return;

        // 1. Observe Web Vitals
        this.observeWebVitals();

        // 2. Observe Long Tasks (if supported)
        this.observeLongTasks();

        // 3. Observe Resource Timing
        this.observeResourceTiming();

        // 4. Start Flush Timer
        this.startFlushTimer();

        this.isInitialized = true;
        console.log('🚀 [PerformanceMonitor] Initialized');
    }

    // --- Data Collection Methods ---

    /**
     * Track Standard Web Vitals (CLS, FID, LCP, TTFB)
     */
    private observeWebVitals() {
        const handleMetric = (metric: Metric) => {
            this.pushMetric({
                type: 'web-vital',
                name: metric.name,
                value: metric.value,
                delta: metric.delta,
                id: metric.id,
                timestamp: Date.now(),
                page_path: window.location.pathname,
                rating: (metric.value > (metric.name === 'CLS' ? 0.1 : metric.name === 'LCP' ? 2500 : 100)) ? 'poor' : 'good' // Simplified rating logic
            });
        };

        onCLS(handleMetric);
        onINP(handleMetric);
        onLCP(handleMetric);
        onTTFB(handleMetric);
    }

    /**
     * Track Long Tasks (Main Thread Blocking)
     */
    private observeLongTasks() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.duration > 50) { // Tasks > 50ms are considered "long"
                            this.pushMetric({
                                type: 'custom-timing',
                                name: 'long-task',
                                value: entry.duration,
                                timestamp: Date.now(),
                                page_path: window.location.pathname,
                                rating: 'needs-improvement'
                            } as any); // Cast to any to fit BaseMetric for custom types
                        }
                    });
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                console.warn('Long Tasks API not supported');
            }
        }
    }

    /**
     * Track Resource Loading Times
     */
    private observeResourceTiming() {
        // This can be verbose, so maybe only track specific critical resources or errors
        // Implementation deferred for now to avoid noise
    }

    /**
     * Manually Track API Latency
     */
    public trackApiCall(data: Omit<ApiLatencyMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) {
        this.pushMetric({
            type: 'api-latency',
            name: `api_call_${data.endpoint}`,
            timestamp: Date.now(),
            page_path: typeof window !== 'undefined' ? window.location.pathname : '',
            ...data
        });
    }

    /**
     * Manually Track AI Generation Performance
     */
    public trackAiGeneration(data: Omit<AiGenerationMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) {
        this.pushMetric({
            type: 'ai-generation',
            name: `ai_gen_${data.generation_type}`,
            timestamp: Date.now(),
            page_path: typeof window !== 'undefined' ? window.location.pathname : '',
            ...data
        });
    }

    /**
     * Manually Track User Interactions
     */
    public trackInteraction(data: Omit<UserInteractionMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) {
        this.pushMetric({
            type: 'interaction',
            name: `interaction_${data.interaction_type}`,
            timestamp: Date.now(),
            page_path: typeof window !== 'undefined' ? window.location.pathname : '',
            ...data
        });
    }

    // --- Queue Management & Flushing ---

    private pushMetric(metric: PerformanceMetric) {
        this.metricsQueue.push(metric);

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[Performance] ${metric.name}:`, metric);
        }

        if (this.metricsQueue.length >= this.maxQueueSize) {
            this.flush();
        }
    }

    private startFlushTimer() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    private async flush() {
        if (this.metricsQueue.length === 0) return;

        const metricsToSend = [...this.metricsQueue];
        this.metricsQueue = []; // Clear queue locally first

        try {
            // Send to our API endpoint
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify({ metrics: metricsToSend })], { type: 'application/json' });
                navigator.sendBeacon('/api/metrics', blob);
            } else {
                await fetch('/api/metrics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metrics: metricsToSend }),
                    keepalive: true,
                });
            }
        } catch (error) {
            console.error('Failed to flush performance metrics', error);
            // Optionally requeue failed metrics, but be careful of infinite loops
        }
    }
}

// Export Singleton Accessor
export const getPerformanceMonitor = () => PerformanceMonitor.getInstance();
export const trackApi = (data: Omit<ApiLatencyMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) => getPerformanceMonitor().trackApiCall(data);
export const trackAi = (data: Omit<AiGenerationMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) => getPerformanceMonitor().trackAiGeneration(data);
export const trackInteraction = (data: Omit<UserInteractionMetric, 'type' | 'timestamp' | 'page_path' | 'name'>) => getPerformanceMonitor().trackInteraction(data);
