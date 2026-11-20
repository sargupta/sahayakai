/**
 * Class-wide batch campaigns — one teacher action, one independent Riya call per family.
 *
 * Layout (Admin SDK only; firestore.rules default-deny covers every sampark_* path):
 *   sampark_schools/{orgId}/sampark_batch_campaigns/{campaignId}   BatchCampaign
 *
 * The campaign holds the recipient list (bounded, ≤ BATCH_MAX_RECIPIENTS) and, per recipient,
 * the ids of the Riya calls placed for them. Each call is an ordinary ConversationCall with its
 * own Vobiz CallUUID, record, context, transcript and synopsis; the call record carries
 * `batch: { campaignId, recipientId }` so a webhook for that call is attributable. The CALL
 * record is the source of truth for an outcome; the campaign mirrors it (reconcile).
 *
 * PII: names and last four digits only, as everywhere in Sampark. No phone numbers.
 */

import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import type { RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { SimulationScenario } from '@/lib/sampark/conversation/simulated-provider';
import type { ConversationProviderKind } from '@/lib/sampark/conversation/types';

import type { BatchReasonId } from './reasons';

export const BATCH_MAX_RECIPIENTS = 100;
export const BATCH_MAX_ATTEMPTS = 3;
/**
 * Launches that never reached the provider (a rate-limit refusal) do not spend one of the three
 * attempts; they are re-launched under a fresh idempotency key. This bounds that re-launching.
 */
export const BATCH_MAX_LAUNCH_FAILURES = 5;

export type BatchCampaignStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export type BatchRecipientStatus =
    | 'pending'       // waiting in the queue
    | 'dialing'       // claimed by the queue; the Riya call is being placed
    | 'in_progress'   // the provider accepted the call; ringing or talking
    | 'completed'     // a conversation took place
    | 'no_answer'
    | 'busy'
    | 'failed'        // refused before ringing, or a check refused it at dial time
    | 'unknown'       // cannot tell whether it rang: never re-dialled automatically
    | 'skipped'       // not dialled: already called about the same announcement, etc.
    | 'cancelled';    // the campaign was cancelled before this recipient was dialled

export const BATCH_ACTIVE_STATUSES: readonly BatchRecipientStatus[] = ['dialing', 'in_progress'];
export const BATCH_RETRYABLE_STATUSES: readonly BatchRecipientStatus[] = ['no_answer', 'busy', 'failed'];

export type BatchExclusionReason =
    | 'missing_phone'
    | 'opted_out'
    | 'no_consent'
    | 'not_allow_listed'
    | 'language'
    | 'inactive'
    | 'sensitive'
    | 'frequency_cap'
    | 'same_family'
    | 'already_called'
    | 'teacher_excluded'
    | 'not_permitted';

export interface BatchExclusion {
    guardianId: string | null;
    studentId: string;
    studentDisplayName: string;
    guardianDisplayName: string | null;
    reason: BatchExclusionReason;
    /** Machine detail (a gate reason code), never free text. */
    detail: string | null;
}

export interface BatchRecipient {
    /** hash(campaign | guardian | student). */
    id: string;
    guardianId: string;
    studentId: string;
    guardianDisplayName: string;
    studentDisplayName: string;
    phoneLast4: string;
    /** The exact line approved at creation for THIS family (their child's name, the shared facts). */
    announcement: string;
    status: BatchRecipientStatus;
    /** Calls placed (1 per attempt). */
    attempts: number;
    /** Every Riya call id placed for this recipient, oldest first. */
    callIds: string[];
    /** The call of the current attempt (known before dialling: call id = hash(org | key)). */
    currentCallId: string | null;
    /** When a 'dialing' claim may be re-run by another tick (crash safety; same key, never a second call). */
    claimUntil: string | null;
    /**
     * Launches the provider refused before anything rang (rate limits). They are NOT attempts: the
     * family keeps its retry allowance, and the next launch uses a new idempotency key.
     */
    launchFailures?: number;
    callbackRequested: boolean;
    stopRequested: boolean;
    lastError: { code: string; message: string } | null;
    updatedAt: string;
}

export interface BatchCampaign {
    /** hash(orgId | request key): a retried create returns the same campaign. */
    id: string;
    orgId: string;
    grade: number;
    section: string;
    reason: BatchReasonId;
    purpose: RiyaPurpose;
    facts: RiyaFacts;
    /** hash(org | class | purpose | canonical facts): one campaign per announcement per class. */
    dedupeKey: string;
    /** The provider fixed at creation. A campaign never switches provider silently. */
    provider: ConversationProviderKind;
    /** Practice only: what the simulated calls do. */
    scenario: SimulationScenario | null;
    /** A sample of what Riya says (the first recipient's line), for lists. */
    sampleAnnouncement: string;
    opening: string | null;
    language: 'English';
    status: BatchCampaignStatus;
    /** True while the queue still has work: running/paused, or a call still in flight. */
    open: boolean;
    /** Why a running campaign is not dialling right now (calling hours, school pause …), machine code. */
    waitingReason: string | null;
    pauseReason: string | null;
    /** Effective simultaneous calls for this campaign (app limit ∧ provider limit ∧ AI capacity). */
    concurrency: number;
    /** Which limit produced `concurrency` ('app' | 'provider' | 'ai'), for the progress view. */
    concurrencySource?: BatchCapacitySource;
    /** Minimum gap between two launches the provider accepted (ms). */
    minGapMs: number;
    /** When the last launch this campaign made was accepted by the provider. */
    lastDialAt: string | null;
    /** Earliest the next launch may go out (last accepted launch for this school + minGapMs). */
    nextLaunchAt?: string | null;
    /** Set when the provider rate-limited a launch: nothing is submitted again before this. */
    backoffUntil?: string | null;
    backoffReason?: string | null;
    recipients: BatchRecipient[];
    excluded: BatchExclusion[];
    createdBy: string;
    createdAt: string;
    startedAt: string;
    updatedAt: string;
    pausedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelledBy: string | null;
    /** Single-flight lease for advancing this campaign (holder + until). */
    leaseHolder: string | null;
    leaseUntil: string | null;
    /**
     * Set by a wake-up (a call freed its line) that found another worker holding the lease: that
     * worker runs one more pass before letting go, so the freed slot is filled without waiting.
     */
    rerunRequested?: boolean;
    version: number;
}

export type BatchCapacitySource = 'app' | 'provider' | 'ai';

export interface BatchProgress {
    total: number;
    completed: number;
    /** Calls this campaign has in flight right now (claimed, ringing or talking). */
    inProgress: number;
    pending: number;
    /** Pending families that have already been called at least once (a retry is queued). */
    retrying: number;
    noAnswer: number;
    busy: number;
    failed: number;
    /** noAnswer + busy + failed, kept for the existing progress view. */
    failedOrNoAnswer: number;
    unknown: number;
    skipped: number;
    cancelled: number;
    callbackRequested: number;
    stopRequested: number;
}
