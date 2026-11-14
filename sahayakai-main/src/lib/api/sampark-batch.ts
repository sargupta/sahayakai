/**
 * Typed client for class-wide outreach (/api/sampark/[orgId]/batch-calls). The browser names a
 * class (grade + section), a reason and typed facts, and families by record id only; the server
 * resolves names, phones and lines from Sampark records and applies every calling rule.
 */
import { apiFetch } from '@/lib/api/client';
import type { BatchReasonId } from '@/lib/sampark/batch/reasons';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import type { SimulationScenario } from '@/lib/sampark/conversation/simulated-provider';
import type { BatchCampaignView, BatchClass, BatchDetail, BatchPreview, BatchPreviewRecipient } from '@/server/sampark/batch-calls';

export type { BatchCampaignView, BatchClass, BatchDetail, BatchPreview, BatchPreviewRecipient };

type Opts = { signal?: AbortSignal };

function path(orgId: string, rest = ''): string {
    return `/api/sampark/${encodeURIComponent(orgId)}/batch-calls${rest}`;
}

export interface BatchRequest {
    grade: number;
    section: string;
    reason: BatchReasonId;
    facts: RiyaFacts;
    excluded: { guardianId: string; studentId: string }[];
}

export function getBatchOverview(orgId: string, opts: Opts = {}): Promise<{ classes: BatchClass[]; campaigns: BatchCampaignView[] }> {
    return apiFetch(path(orgId), { signal: opts.signal });
}

export function previewBatch(orgId: string, req: BatchRequest): Promise<BatchPreview> {
    return apiFetch(path(orgId, '/preview'), { method: 'POST', body: req });
}

export function startBatch(
    orgId: string,
    req: BatchRequest & { requestKey: string; confirmedRecipientCount: number; confirmedSampleAnnouncement: string; confirmRealCalls: boolean; scenario?: SimulationScenario },
): Promise<{ campaign: BatchCampaignView; duplicate: boolean }> {
    return apiFetch(path(orgId), { method: 'POST', body: req });
}

export function getBatchDetail(orgId: string, campaignId: string, opts: Opts = {}): Promise<BatchDetail> {
    return apiFetch(path(orgId, `/${encodeURIComponent(campaignId)}`), { signal: opts.signal });
}

export type BatchAction = { action: 'pause' | 'resume' | 'cancel' | 'advance' } | { action: 'retry'; recipientIds?: string[] };

export function actOnBatch(orgId: string, campaignId: string, action: BatchAction): Promise<BatchDetail> {
    return apiFetch(path(orgId, `/${encodeURIComponent(campaignId)}`), { method: 'POST', body: action });
}
