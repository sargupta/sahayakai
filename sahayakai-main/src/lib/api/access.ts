/**
 * Typed client wrappers for the access-gate API.
 * Contract: docs/ACCESS_GATE_DESIGN.md ("API contract").
 *
 * All wrappers go through `apiFetch`, so they throw `ApiError` (with the HTTP
 * status) on a non-2xx answer. `getAccessMode` is the one exception: the
 * landing page must never break because of it, so it resolves to `off`.
 */
import { apiFetch, syncAccess, type AccessSyncResult } from '@/lib/api/client';
import { auth } from '@/lib/firebase';
import { evaluateAccess } from '@/lib/access/access-state';

export type AccessGateMode = 'off' | 'log' | 'enforce';
export type AccessState = 'legacy' | 'pending' | 'pilot' | 'active' | 'blocked';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';
export type QuoteStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export const ACCESS_STATES: readonly AccessState[] = ['legacy', 'pending', 'pilot', 'active', 'blocked'];
export const QUOTE_STATUSES: readonly QuoteStatus[] = ['new', 'contacted', 'qualified', 'closed'];

// ── Public ──────────────────────────────────────────────────────────────────

export async function getAccessMode(signal?: AbortSignal): Promise<AccessGateMode> {
    try {
        const res = await fetch('/api/access/mode', { signal });
        if (!res.ok) return 'off';
        const data = (await res.json()) as { mode?: unknown };
        return data.mode === 'enforce' || data.mode === 'log' ? data.mode : 'off';
    } catch {
        return 'off';
    }
}

export interface QuoteEstimate {
    teachers: number;
    billing: 'annual' | 'monthly';
    includeParentCalls: boolean;
    students: number;
    callsPerStudentPerYear: number;
    avgMinutesPerCall: number;
    totalPerYearInclGst: number;
}

export interface QuoteRequestInput {
    schoolName: string;
    contactName: string;
    role: string;
    email: string;
    phone: string;
    board?: string;
    affiliationNumber?: string;
    city: string;
    state: string;
    estimate: QuoteEstimate;
    turnstileToken?: string;
}

export function submitQuoteRequest(input: QuoteRequestInput): Promise<{ ok: true; id: string }> {
    return apiFetch('/api/access/quote', { method: 'POST', body: input });
}

// ── Signed in ───────────────────────────────────────────────────────────────

/** `state`, except `expired` for an entitled state past its expiry. */
export type AccessVerdict = AccessState | 'expired' | 'none';

export interface AccessStatus {
    mode: AccessGateMode;
    state: AccessState;
    verdict: AccessVerdict;
    entitled: boolean;
    expiresAt: string | null;
    request: { status: AccessRequestStatus; createdAt: string } | null;
}

export function getAccessStatus(): Promise<AccessStatus> {
    return apiFetch('/api/access/status');
}

/** Shared, never-throwing sync (see client.ts). Refreshes the token itself. */
export function syncAccessClaim(): Promise<AccessSyncResult | null> {
    return syncAccess();
}

export interface AccessRequestInput {
    schoolName: string;
    role: string;
    board: string;
    affiliationNumber?: string;
    city: string;
    state: string;
    phone: string;
    teacherCount?: number;
    message?: string;
    acceptTerms: true;
}

export interface AccessRequestRecord extends Omit<AccessRequestInput, 'acceptTerms'> {
    uid: string;
    email?: string;
    displayName?: string;
    status: AccessRequestStatus;
    createdAt: string;
    updatedAt?: string;
    decidedAt?: string | null;
    decidedBy?: string | null;
    decisionNote?: string | null;
    grantedState?: AccessState | null;
    grantedExpiresAt?: string | null;
}

export function getMyAccessRequest(): Promise<{ request: AccessRequestRecord | null }> {
    return apiFetch('/api/access/request');
}

export function submitAccessRequest(input: AccessRequestInput): Promise<{ ok: true; status: 'pending' }> {
    return apiFetch('/api/access/request', { method: 'POST', body: input });
}

export interface JoinResult {
    ok: true;
    orgId: string;
    orgName: string;
    state: AccessState;
    expiresAt: string | null;
}

export function joinOrganization(code: string): Promise<JoinResult> {
    return apiFetch('/api/organizations/join', { method: 'POST', body: { code, acceptTerms: true } });
}

// ── School admin ────────────────────────────────────────────────────────────

export interface JoinLink {
    id: string;
    createdAt: string;
    expiresAt: string;
    maxUses: number;
    uses: number;
    revoked: boolean;
}

export interface CreatedJoinLink {
    id: string;
    code: string;
    url: string;
    expiresAt: string;
    maxUses: number;
}

const orgPath = (orgId: string) => `/api/organizations/${encodeURIComponent(orgId)}/join-links`;

export function listJoinLinks(orgId: string): Promise<{ links: JoinLink[] }> {
    return apiFetch(orgPath(orgId));
}

export function createJoinLink(
    orgId: string,
    input: { maxUses?: number; expiresInDays?: number },
): Promise<CreatedJoinLink> {
    return apiFetch(orgPath(orgId), { method: 'POST', body: input });
}

export function revokeJoinLink(orgId: string, id: string): Promise<{ ok: true }> {
    return apiFetch(`${orgPath(orgId)}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── SahayakAI admin ─────────────────────────────────────────────────────────

export function adminListAccessRequests(status: AccessRequestStatus): Promise<{ requests: AccessRequestRecord[] }> {
    return apiFetch(`/api/admin/access/requests?status=${status}`);
}

export type AccessDecisionInput =
    | { decision: 'approve'; state: 'pilot' | 'active'; expiresInDays?: number; note?: string }
    | { decision: 'reject'; note?: string };

export function adminDecideAccessRequest(uid: string, input: AccessDecisionInput): Promise<{ ok: true }> {
    return apiFetch(`/api/admin/access/requests/${encodeURIComponent(uid)}`, { method: 'POST', body: input });
}

export interface QuoteRecord extends Omit<QuoteRequestInput, 'turnstileToken'> {
    id: string;
    status: QuoteStatus;
    createdAt: string;
}

export function adminListQuotes(status?: QuoteStatus): Promise<{ quotes: QuoteRecord[] }> {
    return apiFetch(`/api/admin/access/quotes${status ? `?status=${status}` : ''}`);
}

export function adminSetQuoteStatus(id: string, status: QuoteStatus): Promise<{ ok: true }> {
    return apiFetch('/api/admin/access/quotes', { method: 'PATCH', body: { id, status } });
}

export interface AdminAccessUser {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    accessState?: AccessState | null;
    accessExpiresAt?: string | null;
    organizationId?: string | null;
    createdAt?: string | null;
}

export function adminSearchUsers(q: string): Promise<{ users: AdminAccessUser[] }> {
    return apiFetch(`/api/admin/access/users?q=${encodeURIComponent(q)}`);
}

export function adminSetUserAccess(input: {
    uid: string;
    state: AccessState;
    expiresInDays?: number;
    reason: string;
}): Promise<{ ok: true }> {
    return apiFetch('/api/admin/access/users', { method: 'POST', body: input });
}

/** Mirrors AccessFlagView in src/lib/access/anomaly.ts. */
export interface AccessFlag {
    uid: string;
    reasons: string[];
    featuresTouched: string[];
    limitsHit: string[];
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    reviewed: boolean;
}

export function adminListFlags(): Promise<{ flags: AccessFlag[] }> {
    return apiFetch('/api/admin/access/flags');
}

export interface PilotOrgVerification {
    board: string;
    affiliationNumber: string;
    method: string;
    note?: string;
}

export interface PilotOrgInput {
    name: string;
    type: 'school' | 'chain' | 'government';
    adminEmail: string;
    seats: number;
    pilotDays: number;
    plan?: 'gold' | 'premium';
    verification: PilotOrgVerification;
}

export interface AdminOrgSummary {
    id: string;
    name: string;
    type: string;
    status: 'pilot' | 'active' | 'expired';
    plan: string;
    totalSeats: number;
    usedSeats: number;
    pilotEndsAt: string | null;
    createdAt: string | null;
}

export function adminListOrganizations(): Promise<{ organizations: AdminOrgSummary[] }> {
    return apiFetch('/api/admin/access/pilot-orgs');
}

export function adminProvisionPilotOrg(input: PilotOrgInput): Promise<{ orgId: string }> {
    return apiFetch('/api/admin/access/pilot-orgs', { method: 'POST', body: input });
}

export function adminPilotOrgAction(
    orgId: string,
    input: { action: 'extend'; days: number } | { action: 'convert' } | { action: 'expire' },
): Promise<{ ok: true }> {
    return apiFetch(`/api/admin/access/pilot-orgs/${encodeURIComponent(orgId)}`, { method: 'POST', body: input });
}

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

/**
 * Accepts either a bare join code or a full invitation URL
 * (https://www.sahayakai.com/join/<code>) and returns the code, or null when
 * the input cannot be one.
 */
export function extractJoinCode(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    let candidate = raw;
    const marker = '/join/';
    const idx = raw.indexOf(marker);
    if (idx !== -1) {
        candidate = raw.slice(idx + marker.length);
    }
    candidate = candidate.split(/[?#]/)[0].replace(/\/+$/, '');
    try {
        candidate = decodeURIComponent(candidate);
    } catch {
        return null;
    }
    return /^[A-Za-z0-9._~-]{8,200}$/.test(candidate) ? candidate : null;
}

/**
 * Server-side caps (zod schemas in src/lib/access/requests.ts and quotes.ts).
 * Used as `maxLength` on inputs so the form cannot hold a value the server
 * rejects.
 */
export const FIELD_LIMITS = {
    schoolName: 160,
    contactName: 120,
    role: 80,
    board: 60,
    affiliationNumber: 40,
    city: 80,
    state: 80,
    phone: 20,
    email: 254,
    message: 1000,
} as const;

/** Server ceilings for administrator and school-admin inputs. */
export const MAX_PILOT_DAYS = 90;
export const MAX_JOIN_LINK_DAYS = 60;

/**
 * Reduce a typed phone number to what the server accepts and stores cleanly:
 * digits only, with `+91` kept (or added for a `91`/`0` prefixed mobile).
 * "(+91) 98765-43210" -> "+919876543210"; "098765 43210" -> "9876543210".
 */
export function normalizePhone(input: string): string {
    const digits = input.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
}

/** Indian mobile number: 10 digits starting 6-9, optional +91 / 0 prefix. */
export function isValidIndianPhone(input: string): boolean {
    // Only the characters the server pattern allows may appear at all.
    if (!/^[0-9+\s()-]+$/.test(input.trim())) return false;
    return /^(?:\+91)?[6-9]\d{9}$/.test(normalizePhone(input));
}

/**
 * Where an account that has just become entitled should land: onboarding
 * until its profile is complete, the app otherwise. Shared by /access and
 * /join so an approved requester and an invited teacher take the same path.
 * A failed check falls back to onboarding, which itself sends a completed
 * profile home.
 */
export async function resolveEntitledDestination(uid: string): Promise<'/' | '/onboarding'> {
    try {
        const res = await fetch(`/api/auth/profile-check?uid=${encodeURIComponent(uid)}`);
        if (res.ok) {
            const data = (await res.json()) as { onboardingComplete?: boolean };
            if (data.onboardingComplete === true) return '/';
        }
    } catch {
        // fall through
    }
    return '/onboarding';
}

/**
 * Whether the ID token this browser HOLDS carries an entitled access claim.
 * The middleware decides from the token, not from Firestore, so this (and
 * not /api/access/status, which reads the source of truth) is what tells us
 * a navigation into the app will be let through. Never throws.
 */
export async function tokenIsEntitled(): Promise<boolean> {
    try {
        const user = auth.currentUser;
        if (!user) return false;
        const result = await user.getIdTokenResult();
        return evaluateAccess(result.claims as Record<string, unknown>).entitled;
    } catch {
        return false;
    }
}

const AUTO_REDIRECT_KEY = 'sahayakai-access-auto-redirect';
const AUTO_REDIRECT_WINDOW_MS = 20_000;

/**
 * One-shot guard for automatic redirects out of the access flow. Returns
 * false when one was already made moments ago, which means the app sent the
 * user straight back: redirecting again would loop. Storage failures count
 * as "allowed" (a private window must not strand anyone on /access).
 */
export function claimAutoRedirect(now: number = Date.now()): boolean {
    try {
        const last = Number(sessionStorage.getItem(AUTO_REDIRECT_KEY) ?? '0');
        if (Number.isFinite(last) && last > 0 && now - last < AUTO_REDIRECT_WINDOW_MS) return false;
        sessionStorage.setItem(AUTO_REDIRECT_KEY, String(now));
    } catch {
        // sessionStorage unavailable
    }
    return true;
}

/**
 * Where to send an account leaving the access flow, or null when it must
 * stay: the token is not entitled while the gate is enforced, or an
 * automatic redirect has just bounced. Shared by /access and /join.
 */
export async function resolveExitFromAccessFlow(
    uid: string,
    mode: AccessGateMode,
): Promise<'/' | '/onboarding' | null> {
    // Outside enforce mode the middleware never sends anyone back here, so
    // there is nothing to check and no loop to guard against.
    if (mode === 'enforce') {
        if (!(await tokenIsEntitled())) return null;
        if (!claimAutoRedirect()) return null;
    }
    return resolveEntitledDestination(uid);
}

/** Text of a server validation error, when the response carried one. */
export function serverErrorText(err: unknown): string | null {
    const e = err as { status?: unknown; message?: unknown; body?: unknown } | null;
    if (!e || typeof e.status !== 'number') return null;
    const body = e.body as { error?: unknown } | undefined;
    return body && typeof body.error === 'string' && body.error.trim() ? body.error : null;
}

/** The `code` field of an API error body, when present. */
export function serverErrorCode(err: unknown): string | null {
    const body = (err as { body?: unknown } | null)?.body as { code?: unknown } | undefined;
    return body && typeof body.code === 'string' ? body.code : null;
}

export function isValidEmail(input: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export type AccessRequestField = 'schoolName' | 'role' | 'board' | 'city' | 'state' | 'phone' | 'teacherCount' | 'acceptTerms';

/** Mirrors the server-side validation of POST /api/access/request. */
export function validateAccessRequest(input: {
    schoolName: string;
    role: string;
    board: string;
    city: string;
    state: string;
    phone: string;
    teacherCount: string;
    acceptTerms: boolean;
}): AccessRequestField[] {
    const invalid: AccessRequestField[] = [];
    const within = (value: string, max: number) => value.trim().length <= max;
    if (input.schoolName.trim().length < 3 || !within(input.schoolName, FIELD_LIMITS.schoolName)) invalid.push('schoolName');
    if (!input.role.trim() || !within(input.role, FIELD_LIMITS.role)) invalid.push('role');
    if (!input.board.trim() || !within(input.board, FIELD_LIMITS.board)) invalid.push('board');
    if (input.city.trim().length < 2 || !within(input.city, FIELD_LIMITS.city)) invalid.push('city');
    if (!input.state.trim() || !within(input.state, FIELD_LIMITS.state)) invalid.push('state');
    if (!isValidIndianPhone(input.phone)) invalid.push('phone');
    if (input.teacherCount.trim()) {
        const n = Number(input.teacherCount);
        if (!Number.isInteger(n) || n < 1 || n > 100000) invalid.push('teacherCount');
    }
    if (!input.acceptTerms) invalid.push('acceptTerms');
    return invalid;
}
