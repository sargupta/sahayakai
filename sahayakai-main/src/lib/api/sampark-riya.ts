/**
 * Typed client for the Riya (ElevenLabs conversation agent) routes under
 * /api/sampark/[orgId]/riya. One function per route, through `apiFetch` (Firebase ID
 * token → middleware → x-user-id → org-admin check on the server).
 *
 * The browser names a family by record id only. It never sends a phone number, a
 * school name or a child's name: the server resolves those from Sampark records.
 * Types are imported as types only, so no server code is bundled.
 */
import { apiFetch } from '@/lib/api/client';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import type { RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { SimulationScenario } from '@/lib/sampark/conversation/simulated-provider';
import type { ConversationCall, ConversationCallView } from '@/lib/sampark/conversation/types';
import type { RiyaAvailability, RiyaPreview } from '@/server/sampark/conversation';

export type { RiyaAvailability, RiyaPreview, ConversationCallView };

type Opts = { signal?: AbortSignal };

function path(orgId: string, rest = ''): string {
    return `/api/sampark/${encodeURIComponent(orgId)}/riya${rest}`;
}

export interface RiyaCallRequest {
    purpose: RiyaPurpose;
    guardianId: string;
    studentId: string;
    facts?: RiyaFacts;
    campaignId?: string;
}

export function getRiya(orgId: string, opts: Opts = {}): Promise<{ availability: RiyaAvailability; calls: ConversationCallView[] }> {
    return apiFetch(path(orgId), { signal: opts.signal });
}

export function previewRiya(orgId: string, req: RiyaCallRequest): Promise<RiyaPreview> {
    return apiFetch(path(orgId, '/preview'), { method: 'POST', body: req });
}

export function startRiya(
    orgId: string,
    req: RiyaCallRequest & { idempotencyKey: string; confirmedAnnouncement: string; scenario?: SimulationScenario },
): Promise<{ call: ConversationCallView; duplicate: boolean }> {
    return apiFetch(path(orgId), { method: 'POST', body: req });
}

/** The transcript never reaches the browser: staff read the call's synopsis. */
export interface RiyaCallDetail {
    call: ConversationCallView;
}

export function getRiyaCall(orgId: string, callId: string, opts: Opts = {}): Promise<RiyaCallDetail> {
    return apiFetch(path(orgId, `/${encodeURIComponent(callId)}`), { signal: opts.signal });
}

export function reconcileRiya(orgId: string, callId: string): Promise<RiyaCallDetail> {
    return apiFetch(path(orgId, `/${encodeURIComponent(callId)}/reconcile`), { method: 'POST', body: {} });
}

export function reviewRiya(orgId: string, callId: string, note: 'did_not_ring' | 'rang' | 'cannot_tell'): Promise<RiyaCallDetail> {
    return apiFetch(path(orgId, `/${encodeURIComponent(callId)}/review`), { method: 'POST', body: { note } });
}
