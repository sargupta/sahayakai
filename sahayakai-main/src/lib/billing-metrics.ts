/**
 * Billing Metrics — Structured log emitters for Cloud Monitoring
 *
 * Every function here emits a structured JSON log line that Cloud Logging
 * picks up automatically (Cloud Run stdout → Cloud Logging).
 * Log-based metrics + alerting policies are defined in monitoring/billing-alerts.tf
 *
 * Context label: 'BILLING' — all billing logs share this for easy filtering.
 */

import { logger } from '@/lib/logger';

// ─── Metric event types ─────────────────────────────────────────────
export type BillingEvent =
  | 'webhook_received'
  | 'webhook_verified'
  | 'webhook_invalid_signature'
  | 'payment_success'
  | 'payment_failed'
  | 'subscription_created'
  | 'subscription_activated'
  | 'subscription_cancelled'
  | 'subscription_halted'
  | 'plan_mismatch_detected'
  | 'credit_balance_negative'
  | 'firestore_write_failure'
  | 'api_latency'
  | 'reconciliation_run'
  | 'reconciliation_auto_fix'
  | 'reconciliation_flagged';

interface BillingMetricPayload {
  event: BillingEvent;
  userId?: string;
  subscriptionId?: string;
  planId?: string;
  amount?: number;        // paise
  currency?: string;
  razorpayEvent?: string; // raw Razorpay event name
  latencyMs?: number;
  endpoint?: string;
  errorMessage?: string;
  firestoreCollection?: string;
  currentPlan?: string;   // what Firestore says
  expectedPlan?: string;  // what Razorpay says
  creditBalance?: number;
  [key: string]: unknown;
}

/**
 * Emit a billing metric as a structured log entry.
 * Cloud Run sends stdout JSON to Cloud Logging automatically —
 * no need for the @google-cloud/logging SDK overhead.
 */
export function emitBillingMetric(payload: BillingMetricPayload): void {
  const severity = getSeverity(payload.event);
  const message = formatMessage(payload);

  const logData = {
    billing_event: payload.event,
    ...payload,
    labels: {
      billing_event: payload.event,
      user_id: payload.userId || 'unknown',
      endpoint: payload.endpoint || 'unknown',
    },
  };

  switch (severity) {
    case 'ERROR':
      logger.error(message, new Error(message), 'BILLING', logData);
      break;
    case 'WARNING':
      logger.warn(message, 'BILLING', logData);
      break;
    default:
      logger.info(message, 'BILLING', logData);
  }
}

function getSeverity(event: BillingEvent): 'INFO' | 'WARNING' | 'ERROR' {
  switch (event) {
    case 'webhook_invalid_signature':
    case 'payment_failed':
    case 'subscription_halted':
    case 'plan_mismatch_detected':
    case 'credit_balance_negative':
    case 'firestore_write_failure':
      return 'ERROR';
    case 'subscription_cancelled':
    case 'api_latency':
      return 'WARNING';
    default:
      return 'INFO';
  }
}

function formatMessage(p: BillingMetricPayload): string {
  switch (p.event) {
    case 'webhook_received':
      return `Razorpay webhook received: ${p.razorpayEvent}`;
    case 'payment_success':
      return `Payment succeeded: ₹${((p.amount || 0) / 100).toFixed(0)} for user ${p.userId}`;
    case 'payment_failed':
      return `Payment FAILED for user ${p.userId}: ${p.errorMessage || 'unknown'}`;
    case 'plan_mismatch_detected':
      return `Plan mismatch: user ${p.userId} has Firestore plan '${p.currentPlan}' but Razorpay says '${p.expectedPlan}'`;
    case 'credit_balance_negative':
      return `Negative credit balance: user ${p.userId} has ${p.creditBalance} credits`;
    case 'firestore_write_failure':
      return `Firestore write failed on ${p.firestoreCollection}: ${p.errorMessage}`;
    case 'api_latency':
      return `Billing API ${p.endpoint} took ${p.latencyMs}ms`;
    default:
      return `Billing event: ${p.event}`;
  }
}

/**
 * Middleware-style latency tracker for billing endpoints.
 * Usage:
 *   const end = trackBillingLatency('/api/subscribe');
 *   // ... do work ...
 *   end(); // emits the metric
 */
export function trackBillingLatency(endpoint: string): () => void {
  const start = performance.now();
  return () => {
    const latencyMs = Math.round(performance.now() - start);
    emitBillingMetric({
      event: 'api_latency',
      endpoint,
      latencyMs,
    });
  };
}
