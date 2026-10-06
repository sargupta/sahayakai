import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Scoped API keys for Sahayak's public MCP servers.
 *
 * Key format (shown to the school ONCE, never stored):
 *
 *     sk_sahayak_<keyId>_<secret>
 *       keyId  — 16 hex chars, the Firestore doc id (not secret)
 *       secret — 43 chars base64url (256 bits)
 *
 * Firestore `mcp_api_keys/{keyId}` (server-only; client rules default-deny):
 *   {
 *     orgId:      string    — the school / organisation this key acts for
 *     label:      string    — human label ("Delhi Public School — LMS")
 *     scopes:     string[]  — capabilities, e.g. ['lesson-planner']
 *     secretHash: string    — HMAC-SHA256(pepper, secret), hex
 *     status:     'active' | 'revoked'
 *     createdAt:  string (ISO), createdBy: string
 *   }
 *
 * The tenant (orgId) and scopes come ONLY from this record — never from
 * anything the client sends.
 */

export const API_KEY_PREFIX = 'sk_sahayak_';
const KEY_RE = /^sk_sahayak_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;
export const MCP_API_KEYS_COLLECTION = 'mcp_api_keys';

/** Capabilities a key can be granted. One entry per public MCP server. */
export const MCP_SCOPES = ['lesson-planner', 'exam-paper'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export interface McpApiKeyRecord {
    orgId: string;
    label: string;
    scopes: string[];
    secretHash: string;
    status: 'active' | 'revoked';
    createdAt: string;
    createdBy: string;
}

export interface ParsedApiKey {
    keyId: string;
    secret: string;
}

/** Strict parse; anything else is not a Sahayak key. */
export function parseApiKey(raw: string | null | undefined): ParsedApiKey | null {
    if (!raw) return null;
    const m = KEY_RE.exec(raw.trim());
    return m ? { keyId: m[1], secret: m[2] } : null;
}

/** The server-side pepper. Missing pepper = MCP disabled (fail closed). */
export function getKeyPepper(): string | null {
    const pepper = process.env.MCP_API_KEY_PEPPER;
    return pepper && pepper.length >= 32 ? pepper : null;
}

export function hashSecret(secret: string, pepper: string): string {
    return createHmac('sha256', pepper).update(secret).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function secretMatches(secret: string, storedHash: string, pepper: string): boolean {
    const a = Buffer.from(hashSecret(secret, pepper), 'hex');
    const b = Buffer.from(storedHash ?? '', 'hex');
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Mint a new key. Returns the plaintext (show once) and the record to store. */
export function mintApiKey(params: {
    orgId: string;
    label: string;
    scopes: McpScope[];
    createdBy: string;
    pepper: string;
    now?: Date;
}): { apiKey: string; keyId: string; record: McpApiKeyRecord } {
    const keyId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    return {
        apiKey: `${API_KEY_PREFIX}${keyId}_${secret}`,
        keyId,
        record: {
            orgId: params.orgId,
            label: params.label,
            scopes: [...new Set(params.scopes)],
            secretHash: hashSecret(secret, params.pepper),
            status: 'active',
            createdAt: (params.now ?? new Date()).toISOString(),
            createdBy: params.createdBy,
        },
    };
}
