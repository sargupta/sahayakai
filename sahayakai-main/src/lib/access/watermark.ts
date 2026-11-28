/**
 * Export watermark text (access gate, docs/ACCESS_GATE_DESIGN.md).
 *
 * Pure and isomorphic: no server-only or browser-only imports, so the same
 * function backs GET /api/access/watermark and its unit tests.
 *
 * Purpose: a document exported from a time-boxed evaluation carries the name
 * of the school and the account that produced it. That does not prevent
 * copying; it makes a leaked or resold document attributable, which is what
 * gives the evaluation terms teeth.
 *
 * Policy
 *   pilot                      -> "Evaluation copy · <org or school> · <email> · <date> · Not for redistribution"
 *   active seat of a school    -> "Licensed to <org>"
 *   everything else            -> null (no watermark)
 *
 * `legacy` accounts and individually approved `active` accounts with no
 * organisation are deliberately unmarked: existing teachers must see no
 * change in their documents.
 */

export interface WatermarkInput {
    /** The gate verdict for the caller (the `x-user-access` header). */
    access: string | null | undefined;
    /** Self-declared school name from the teacher's profile. */
    schoolName?: string | null;
    /** Verified email from the ID token. */
    email?: string | null;
    /** Name of the organisation the seat belongs to, when there is one. */
    orgName?: string | null;
    /** Time of export. Injectable for tests. */
    at?: Date;
}

const SEPARATOR = ' · ';
const MAX_PART_LENGTH = 80;

/** Collapse whitespace, strip control characters, bound the length. */
function clean(value: string | null | undefined): string {
    if (typeof value !== 'string') return '';
    const collapsed = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    return collapsed.length > MAX_PART_LENGTH ? `${collapsed.slice(0, MAX_PART_LENGTH - 1)}…` : collapsed;
}

function isoDate(at: Date): string {
    return Number.isNaN(at.getTime()) ? '' : at.toISOString().slice(0, 10);
}

export function buildWatermarkText(input: WatermarkInput): string | null {
    const orgName = clean(input.orgName);
    const schoolName = clean(input.schoolName);
    const email = clean(input.email);

    if (input.access === 'pilot') {
        const parts = [
            'Evaluation copy',
            orgName || schoolName || 'SahayakAI pilot',
            email,
            isoDate(input.at ?? new Date()),
            'Not for redistribution',
        ];
        return parts.filter((p) => p.length > 0).join(SEPARATOR);
    }

    if (input.access === 'active' && orgName) {
        return `Licensed to ${orgName}`;
    }

    return null;
}
