/**
 * Feature Flag / Remote Config System
 * ------------------------------------
 * Firestore document: `system_config/feature_flags`
 *
 * Update flags without deployment:
 *   Firebase Console → Firestore → system_config → feature_flags → edit fields
 *   OR: `npx tsx src/scripts/update-flags.ts --kill-switch true`
 *
 * Fallback: if Firestore is unreachable, all gates default to FREE/OPEN
 * (users are never locked out of existing free features).
 */

import { getDb } from '@/lib/firebase-admin';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Individual feature toggle */
export interface FeatureToggle {
  enabled: boolean;
  /** Optional: only enable for these user IDs (overrides rollout %) */
  allowlist?: string[];
  /** Optional: always disable for these user IDs */
  blocklist?: string[];
}

/**
 * Parent-call sidecar dispatch mode.
 *
 * - `off`     — Genkit only. Default. Sidecar untouched even if deployed.
 * - `shadow`  — Genkit serves the response; sidecar called fire-and-forget
 *                in parallel for parity scoring. Output ignored.
 * - `canary`  — Sidecar serves the response; Genkit fallback on any
 *                sidecar error/timeout, with the canned safe-wrap-up as
 *                last resort.
 * - `full`    — Sidecar serves; same fallbacks as `canary` but
 *                `parentCallSidecarPercent` is treated as 100 regardless
 *                of value.
 */
export type ParentCallSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

/** The full Firestore document shape at `system_config/feature_flags` */
export interface FeatureFlagsConfig {
  // ── Global switches ────────────────────────────
  /** Master kill switch: if true, ALL plan checks return "free" */
  billingKillSwitch: boolean;
  /** If true, show maintenance banner and skip billing flows */
  maintenanceMode: boolean;
  maintenanceMessage: string; // e.g. "Billing under maintenance. All features are free."

  // ── Subscription rollout ───────────────────────
  /** true = subscription system is live for eligible users */
  subscriptionEnabled: boolean;
  /** 0-100: percentage of users who see subscription (hash-based) */
  subscriptionRolloutPercent: number;
  /** UIDs that always see subscription regardless of rollout % */
  subscriptionAllowlist: string[];

  // ── Parent-call sidecar (ADK Python) rollout ───
  /**
   * Routing mode for the parent-call agent. See `ParentCallSidecarMode`.
   * Defaults to `off` in `FALLBACK_CONFIG` so a Firestore outage cannot
   * accidentally route real Twilio calls to an undeployed sidecar.
   */
  parentCallSidecarMode: ParentCallSidecarMode;
  /**
   * 0-100: percentage of calls routed to the sidecar in `shadow` /
   * `canary` modes. Bucketing is done on `callSid` (sticky for the
   * lifetime of one Twilio call), not `uid` — TwiML webhooks have no
   * authenticated user. `full` mode treats this as 100 regardless.
   */
  parentCallSidecarPercent: number;

  // ── Per-feature toggles ────────────────────────
  features: Record<string, FeatureToggle>;

  // ── Metadata ───────────────────────────────────
  updatedAt: FirebaseFirestore.Timestamp | string;
  updatedBy: string; // admin email or "console"
}

/** Safe defaults when Firestore is unreachable */
const FALLBACK_CONFIG: FeatureFlagsConfig = {
  billingKillSwitch: true,       // safe: everything free
  maintenanceMode: false,
  maintenanceMessage: '',
  subscriptionEnabled: false,    // safe: no one sees paywalls
  subscriptionRolloutPercent: 0,
  subscriptionAllowlist: [],
  // Sidecar OFF on fallback so a Firestore outage cannot send live calls
  // to an undeployed or misconfigured sidecar. Genkit alone is the safe
  // baseline.
  parentCallSidecarMode: 'off',
  parentCallSidecarPercent: 0,
  features: {},
  updatedAt: '',
  updatedBy: 'fallback',
};

// ─── In-Memory Cache (server-side, 5-min TTL) ──────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedConfig: FeatureFlagsConfig | null = null;
let cacheTimestamp = 0;
let fetchPromise: Promise<FeatureFlagsConfig> | null = null;

/**
 * Read the feature flags config from Firestore.
 * - Returns cached value if < 5 min old
 * - Deduplicates concurrent requests (single in-flight fetch)
 * - Falls back to safe defaults on any error
 */
export async function readConfig(): Promise<FeatureFlagsConfig> {
  const now = Date.now();

  // Return cache if fresh
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  // Deduplicate: if a fetch is already in-flight, wait for it
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const db = await getDb();
      const snap = await db.doc('system_config/feature_flags').get();

      if (!snap.exists) {
        console.warn('[FeatureFlags] Document system_config/feature_flags does not exist — using fallback');
        cachedConfig = FALLBACK_CONFIG;
      } else {
        cachedConfig = snap.data() as FeatureFlagsConfig;
      }

      cacheTimestamp = Date.now();
      return cachedConfig;
    } catch (err) {
      console.error('[FeatureFlags] Failed to read config:', err);
      // If we have a stale cache, use it (better than nothing)
      if (cachedConfig) {
        console.warn('[FeatureFlags] Using stale cache');
        return cachedConfig;
      }
      return FALLBACK_CONFIG;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/** Force-refresh (useful after an admin update) */
export function invalidateConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ─── Flag Evaluation ────────────────────────────────────────────────────────

/**
 * Deterministic hash of uid → 0-99.
 * Same uid always gets the same bucket, so rollout is sticky.
 */
function userBucket(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

export interface FlagEvaluation {
  enabled: boolean;
  reason: string; // human-readable reason for debugging/logging
}

/**
 * Should this user see the subscription paywall / plan checks?
 *
 * Logic order:
 * 1. billingKillSwitch ON  → no (everything free)
 * 2. maintenanceMode ON    → no (show banner instead)
 * 3. subscriptionEnabled OFF → no
 * 4. user in allowlist      → yes
 * 5. rollout % check        → yes/no based on hash bucket
 */
export async function isSubscriptionEnabled(uid: string): Promise<FlagEvaluation> {
  const cfg = await readConfig();

  if (cfg.billingKillSwitch) {
    return { enabled: false, reason: 'billing_kill_switch' };
  }
  if (cfg.maintenanceMode) {
    return { enabled: false, reason: 'maintenance_mode' };
  }
  if (!cfg.subscriptionEnabled) {
    return { enabled: false, reason: 'subscription_disabled' };
  }
  if (cfg.subscriptionAllowlist?.includes(uid)) {
    return { enabled: true, reason: 'subscription_allowlist' };
  }

  const bucket = userBucket(uid);
  if (bucket < cfg.subscriptionRolloutPercent) {
    return { enabled: true, reason: `rollout_bucket_${bucket}_under_${cfg.subscriptionRolloutPercent}` };
  }

  return { enabled: false, reason: `rollout_bucket_${bucket}_over_${cfg.subscriptionRolloutPercent}` };
}

/**
 * Is a specific feature enabled for this user?
 *
 * Features not listed in the config are enabled by default
 * (so you only add entries to DISABLE things, not to enable them).
 */
export async function isFeatureEnabled(featureName: string, uid: string): Promise<FlagEvaluation> {
  const cfg = await readConfig();

  // Kill switch overrides everything — all features available
  if (cfg.billingKillSwitch) {
    return { enabled: true, reason: 'billing_kill_switch_all_free' };
  }

  const toggle = cfg.features[featureName];

  // Feature not listed → enabled by default
  if (!toggle) {
    return { enabled: true, reason: 'not_configured_default_on' };
  }

  // Blocklist takes priority
  if (toggle.blocklist?.includes(uid)) {
    return { enabled: false, reason: `blocklist` };
  }

  // Allowlist overrides the global enabled flag
  if (toggle.allowlist?.includes(uid)) {
    return { enabled: true, reason: `allowlist` };
  }

  return { enabled: toggle.enabled, reason: toggle.enabled ? 'feature_enabled' : 'feature_disabled' };
}

/**
 * Get maintenance info (for banner display).
 */
export async function getMaintenanceInfo(): Promise<{ active: boolean; message: string }> {
  const cfg = await readConfig();
  return {
    active: cfg.maintenanceMode,
    message: cfg.maintenanceMessage || 'Billing is under maintenance. All features are free during this time.',
  };
}

// ─── Parent-call sidecar dispatch ───────────────────────────────────────────

/**
 * Deterministic hash of `callSid` → 0-99. Twilio call SIDs are stable
 * for the lifetime of a single call, so bucketing on `callSid` keeps
 * each call on a single dispatch path even across `<Gather>` retries.
 *
 * Same algorithm as `userBucket` so the rollout maths reads identically
 * everywhere — only the input domain differs.
 */
export function callSidBucket(callSid: string): number {
  let hash = 0;
  for (let i = 0; i < callSid.length; i++) {
    hash = ((hash << 5) - hash + callSid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

export interface ParentCallSidecarDecision {
  /** Final dispatch mode for THIS call after percent-bucket evaluation. */
  mode: ParentCallSidecarMode;
  /** Human-readable reason for telemetry (logged on every TwiML turn). */
  reason: string;
  /** The 0-99 hash bucket; emitted for debugging hot-spotted call IDs. */
  bucket: number;
}

/**
 * Decide whether THIS call/turn routes to the sidecar.
 *
 * Logic order:
 * 1. configured mode is `off` → off
 * 2. configured mode is `full` → full (percent ignored)
 * 3. configured mode is `shadow` or `canary`:
 *    - bucket < percent → shadow / canary
 *    - bucket >= percent → off
 *
 * Bucket is computed on `callSid` so all turns of one call land on the
 * same path — half-shadow, half-Genkit within a single call would make
 * the transcript incoherent.
 */
export async function decideParentCallDispatch(
  callSid: string,
): Promise<ParentCallSidecarDecision> {
  const cfg = await readConfig();
  const bucket = callSidBucket(callSid);

  if (cfg.parentCallSidecarMode === 'off') {
    return { mode: 'off', reason: 'flag_off', bucket };
  }
  if (cfg.parentCallSidecarMode === 'full') {
    return { mode: 'full', reason: 'flag_full', bucket };
  }

  // shadow or canary: percent-gated
  const percent = Math.max(0, Math.min(100, cfg.parentCallSidecarPercent));
  if (bucket < percent) {
    return {
      mode: cfg.parentCallSidecarMode,
      reason: `bucket_${bucket}_under_${percent}`,
      bucket,
    };
  }
  return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

// ─── Debug Helper ───────────────────────────────────────────────────────────

/**
 * Full diagnostic for a user — call from /api/debug/flags?uid=xxx (admin only).
 * Returns the complete evaluation state for logging.
 */
export async function evaluateAllFlags(uid: string): Promise<{
  config: FeatureFlagsConfig;
  subscription: FlagEvaluation;
  userBucket: number;
  features: Record<string, FlagEvaluation>;
}> {
  const cfg = await readConfig();
  const sub = await isSubscriptionEnabled(uid);
  const featureResults: Record<string, FlagEvaluation> = {};

  for (const [name] of Object.entries(cfg.features)) {
    featureResults[name] = await isFeatureEnabled(name, uid);
  }

  return {
    config: cfg,
    subscription: sub,
    userBucket: userBucket(uid),
    features: featureResults,
  };
}
