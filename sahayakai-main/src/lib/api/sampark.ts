/**
 * Typed client for the Sampark (school-to-parent calling) API.
 *
 * Mirrors docs/sampark/SLICE1_CONTRACT.md §5 exactly: one function per route.
 * Every call goes through `apiFetch`, which attaches the Firebase ID token;
 * the middleware turns it into the trusted `x-user-id` header and the route
 * checks org-admin access. Errors surface as `ApiError` with the server's
 * `{ error }` message and HTTP status.
 *
 * Audio is the one exception: `<audio src>` cannot send an Authorization
 * header, so `fetchAudioBlob` fetches the clip with the Bearer token and the
 * console plays it from an object URL (see components/sampark/use-authed-audio).
 */
import { auth } from '@/lib/firebase';
import { apiFetch, ApiError } from '@/lib/api/client';
import type {
    BlockReason,
    Campaign,
    CampaignAudience,
    CampaignFacts,
    CallLogEntry,
    CallingWindow,
    ConsentGroup,
    ConsentStatus,
    GuardianPreferences,
    ImportRun,
    ParentLanguage,
    PhoneClass,
    PurposeId,
    SamparkGuardian,
    SamparkMode,
    SamparkOverview,
    SamparkSchool,
    SchoolVenue,
    ScriptPreview,
    Suppression,
} from '@/types/sampark';

// ── DTOs defined by the contract table (not in src/types/sampark.ts) ─────────

export interface SamparkMeSchool {
    orgId: string;
    displayName: string;
    enabled: boolean;
}

export interface GuardianRow {
    id: string;
    displayName: string;
    relation: SamparkGuardian['relation'];
    phoneLast4: string;
    phoneClass: PhoneClass;
    language: ParentLanguage | null;
    consent: Record<ConsentGroup, ConsentStatus>;
    suppressed: boolean;
    students: { id: string; displayName: string; grade: number; section: string }[];
}

export interface CampaignAudienceSummary {
    guardians: number;
    byLanguage: Record<ParentLanguage | 'unknown', number>;
    blocked: Partial<Record<BlockReason, number>>;
}

export interface CampaignDetail {
    campaign: Campaign;
    audience: CampaignAudienceSummary;
}

/**
 * The CRM connection as the console sets it; the server owns lastImportAt/lastImportId.
 * `apiKeySecretName` is the NAME of a stored secret (SAMPARK_CRM_<NAME>, or MOCK_CRM_API_KEY
 * for the dummy CRM), never the key itself.
 */
export type CrmConnectionInput =
    | { kind: 'rest'; baseUrl: string; apiKeySecretName: string }
    | { kind: 'csv' };

export interface UpdateSchoolInput {
    displayName?: string;
    spokenName?: Record<ParentLanguage, string>;
    callingWindow?: CallingWindow;
    holidays?: string[];
    venues?: SchoolVenue[];
    defaultLanguage?: ParentLanguage | null;
    crm?: CrmConnectionInput | null;
}

export type StartImportInput =
    | { source: 'rest' }
    | { source: 'csv'; studentsCsv: string; guardiansCsv: string };

export interface CreateCampaignInput {
    purpose: PurposeId;
    facts: CampaignFacts;
    audience: CampaignAudience;
    notBefore?: string | null;
}

export interface GuardianPreferencesPatch {
    language?: ParentLanguage | null;
    consent?: Partial<Record<ConsentGroup, ConsentStatus>>;
}

export interface ListGuardiansQuery {
    /** A parent language, or 'unknown' for guardians with no language recorded. */
    language?: ParentLanguage | 'unknown';
    q?: string;
    /** 1–500 (server default 100). */
    limit?: number;
}

/** The server's page cap for GET guardians. */
export const MAX_GUARDIANS_PAGE = 500;

export interface ListCallsQuery {
    campaignId?: string;
    limit?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE = '/api/sampark';

function orgPath(orgId: string, rest = ''): string {
    return `${BASE}/${encodeURIComponent(orgId)}${rest}`;
}

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

type Opts = { signal?: AbortSignal };

// ── Schools ──────────────────────────────────────────────────────────────────

/** GET /api/sampark/me — organisations the signed-in user administers. */
export async function getMySchools(opts: Opts = {}): Promise<SamparkMeSchool[]> {
    const res = await apiFetch<{ schools: SamparkMeSchool[] }>(`${BASE}/me`, { signal: opts.signal });
    return res.schools;
}

/** POST /api/sampark/[orgId]/enable — creates the practice-mode record if absent. */
export function enableSampark(orgId: string, displayName: string): Promise<SamparkSchool> {
    return apiFetch<SamparkSchool>(orgPath(orgId, '/enable'), { method: 'POST', body: { displayName } });
}

/** GET /api/sampark/[orgId]/overview */
export function getOverview(orgId: string, opts: Opts = {}): Promise<SamparkOverview> {
    return apiFetch<SamparkOverview>(orgPath(orgId, '/overview'), { signal: opts.signal });
}

/** GET /api/sampark/[orgId]/school */
export function getSchool(orgId: string, opts: Opts = {}): Promise<SamparkSchool> {
    return apiFetch<SamparkSchool>(orgPath(orgId, '/school'), { signal: opts.signal });
}

/** PUT /api/sampark/[orgId]/school — partial update; send only the fields that changed. */
export function updateSchool(orgId: string, input: UpdateSchoolInput): Promise<SamparkSchool> {
    return apiFetch<SamparkSchool>(orgPath(orgId, '/school'), { method: 'PUT', body: input });
}

/** PUT /api/sampark/[orgId]/mode — slice 1 answers 409 LIVE_DIAL_DISABLED for anything but practice. */
export function setMode(orgId: string, mode: SamparkMode): Promise<SamparkSchool> {
    return apiFetch<SamparkSchool>(orgPath(orgId, '/mode'), { method: 'PUT', body: { mode } });
}

// ── Imports ──────────────────────────────────────────────────────────────────

/** POST /api/sampark/[orgId]/imports */
export function startImport(orgId: string, input: StartImportInput): Promise<ImportRun> {
    return apiFetch<ImportRun>(orgPath(orgId, '/imports'), { method: 'POST', body: input });
}

/** GET /api/sampark/[orgId]/imports/latest */
export function getLatestImport(orgId: string, opts: Opts = {}): Promise<ImportRun | null> {
    return apiFetch<ImportRun | null>(orgPath(orgId, '/imports/latest'), { signal: opts.signal });
}

// ── Families ─────────────────────────────────────────────────────────────────

/** GET /api/sampark/[orgId]/guardians?language=&q=&limit= */
export async function listGuardians(orgId: string, query: ListGuardiansQuery = {}, opts: Opts = {}): Promise<GuardianRow[]> {
    const res = await apiFetch<{ guardians: GuardianRow[] }>(
        orgPath(orgId, `/guardians${qs({ language: query.language, q: query.q?.trim(), limit: query.limit })}`),
        { signal: opts.signal },
    );
    return res.guardians;
}

/** PATCH /api/sampark/[orgId]/guardians/[guardianId]/preferences */
export function updateGuardianPreferences(
    orgId: string,
    guardianId: string,
    patch: GuardianPreferencesPatch,
): Promise<GuardianPreferences> {
    return apiFetch<GuardianPreferences>(
        orgPath(orgId, `/guardians/${encodeURIComponent(guardianId)}/preferences`),
        { method: 'PATCH', body: patch },
    );
}

/** GET /api/sampark/[orgId]/suppressions */
export async function listSuppressions(orgId: string, opts: Opts = {}): Promise<Suppression[]> {
    const res = await apiFetch<{ suppressions: Suppression[] }>(orgPath(orgId, '/suppressions'), { signal: opts.signal });
    return res.suppressions;
}

// ── Campaigns ────────────────────────────────────────────────────────────────

/** GET /api/sampark/[orgId]/campaigns */
export async function listCampaigns(orgId: string, opts: Opts = {}): Promise<Campaign[]> {
    const res = await apiFetch<{ campaigns: Campaign[] }>(orgPath(orgId, '/campaigns'), { signal: opts.signal });
    return res.campaigns;
}

/** POST /api/sampark/[orgId]/campaigns — returns the campaign in status `draft`. */
export function createCampaign(orgId: string, input: CreateCampaignInput): Promise<Campaign> {
    return apiFetch<Campaign>(orgPath(orgId, '/campaigns'), { method: 'POST', body: input });
}

/** GET /api/sampark/[orgId]/campaigns/[id] — the campaign plus a dry-run audience summary. */
export function getCampaign(orgId: string, campaignId: string, opts: Opts = {}): Promise<CampaignDetail> {
    return apiFetch<CampaignDetail>(orgPath(orgId, `/campaigns/${encodeURIComponent(campaignId)}`), { signal: opts.signal });
}

/** POST /api/sampark/[orgId]/campaigns/[id]/preview — what parents will hear, per language. */
export async function previewCampaign(
    orgId: string,
    campaignId: string,
    languages?: ParentLanguage[],
    opts: Opts = {},
): Promise<ScriptPreview[]> {
    const res = await apiFetch<{ previews: ScriptPreview[] }>(
        orgPath(orgId, `/campaigns/${encodeURIComponent(campaignId)}/preview`),
        { method: 'POST', body: languages ? { languages } : {}, signal: opts.signal },
    );
    return res.previews;
}

/** POST /api/sampark/[orgId]/campaigns/[id]/approve — draft → rendering. */
export function approveCampaign(orgId: string, campaignId: string): Promise<Campaign> {
    return apiFetch<Campaign>(orgPath(orgId, `/campaigns/${encodeURIComponent(campaignId)}/approve`), { method: 'POST' });
}

/** POST /api/sampark/[orgId]/campaigns/[id]/cancel */
export function cancelCampaign(orgId: string, campaignId: string): Promise<Campaign> {
    return apiFetch<Campaign>(orgPath(orgId, `/campaigns/${encodeURIComponent(campaignId)}/cancel`), { method: 'POST' });
}

// ── Calls ────────────────────────────────────────────────────────────────────

/** GET /api/sampark/[orgId]/calls?campaignId=&limit= */
export async function listCalls(orgId: string, query: ListCallsQuery = {}, opts: Opts = {}): Promise<CallLogEntry[]> {
    const res = await apiFetch<{ calls: CallLogEntry[] }>(
        orgPath(orgId, `/calls${qs({ campaignId: query.campaignId, limit: query.limit })}`),
        { signal: opts.signal },
    );
    return res.calls;
}

// ── Audio ────────────────────────────────────────────────────────────────────

/** Path of a rendered clip. Needs the Bearer header — use `fetchAudioBlob`, not `<audio src>`. */
export function audioUrl(orgId: string, key: string): string {
    return orgPath(orgId, `/audio/${encodeURIComponent(key)}`);
}

/** GET /api/sampark/[orgId]/audio/[key] with the signed-in user's token, as a Blob (audio/wav). */
export async function fetchAudioBlob(orgId: string, key: string, opts: Opts = {}): Promise<Blob> {
    const headers: Record<string, string> = {};
    const user = auth.currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    // ?format=pcm: the stored clip is telephony μ-law, which not every browser decodes.
    const res = await fetch(`${audioUrl(orgId, key)}?format=pcm`, { headers, signal: opts.signal });
    if (!res.ok) {
        const data = await res.json().catch(() => undefined);
        const message =
            data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
                ? (data as { error: string }).error
                : `Request failed (${res.status})`;
        throw new ApiError(res.status, message, data);
    }
    return res.blob();
}

export { ApiError };
