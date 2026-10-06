import 'server-only';
import { timingSafeEqual } from 'crypto';
import {
    getKeyPepper,
    MCP_API_KEYS_COLLECTION,
    MCP_SCOPES,
    parseApiKey,
    secretMatches,
    type McpApiKeyRecord,
    type McpScope,
} from './api-keys';
import { McpCapabilityError } from './errors';

/**
 * The authenticated caller of a public MCP server. Derived ONLY from the
 * verified API key record — client-supplied tenant ids are never trusted.
 */
export interface McpPrincipal {
    keyId: string;
    orgId: string;
    scopes: string[];
}

/** Minimal Firestore surface used here (keeps auth unit-testable). */
export interface McpAuthDb {
    collection(name: string): { doc(id: string): { get(): Promise<{ exists: boolean; data(): unknown }> } };
}

/**
 * Read the API key from `Authorization: Bearer <key>` (preferred) or
 * `X-API-Key: <key>`. Nothing else (query strings leak into logs).
 */
export function extractApiKey(headers: Headers): string | null {
    const auth = headers.get('authorization');
    if (auth) {
        const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
        return m ? m[1].trim() : null;
    }
    return headers.get('x-api-key')?.trim() || null;
}

/**
 * LOCAL DEVELOPMENT ONLY: a key held in the developer's gitignored .env.local
 * (`MCP_LOCAL_DEV_API_KEY`, created by `npm run mcp:dev-key`) so MCP servers
 * can be demoed locally without issuing a key in the shared Firestore.
 *
 * Honoured only when NODE_ENV === 'development' (`next dev`). `next start` and
 * the production image (Dockerfile: NODE_ENV=production) never accept it.
 * Scopes default to every MCP scope; `MCP_LOCAL_DEV_SCOPES` narrows them
 * (e.g. to try the 403 path locally).
 */
export const LOCAL_DEV_ORG_ID = 'local-dev-org';

export function localDevKeyPrincipal(presented: string): McpPrincipal | null {
    if (process.env.NODE_ENV !== 'development') return null;
    const devKey = process.env.MCP_LOCAL_DEV_API_KEY?.trim();
    const parsed = parseApiKey(devKey);
    if (!devKey || !parsed) return null;
    const a = Buffer.from(presented);
    const b = Buffer.from(devKey);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const scopes = (process.env.MCP_LOCAL_DEV_SCOPES ?? MCP_SCOPES.join(','))
        .split(',').map((s) => s.trim()).filter(Boolean);
    return { keyId: `local-dev-${parsed.keyId}`, orgId: LOCAL_DEV_ORG_ID, scopes };
}

/**
 * Verify the caller and require `scope`. Throws McpCapabilityError with
 * category `authentication` (401), `authorization` (403) or
 * `not_configured` (503). Error messages never reveal whether a key id
 * exists — every bad credential reads the same.
 */
export async function authenticateMcpRequest(
    headers: Headers,
    scope: McpScope,
    deps: { getDb: () => Promise<McpAuthDb> },
): Promise<McpPrincipal> {
    const pepper = getKeyPepper();
    if (!pepper) {
        throw new McpCapabilityError('not_configured', 'This Sahayak MCP server is not available right now.');
    }

    const raw = extractApiKey(headers);
    if (!raw) {
        throw new McpCapabilityError(
            'authentication',
            'Missing API key. Send your Sahayak API key as "Authorization: Bearer sk_sahayak_…".',
        );
    }
    const parsed = parseApiKey(raw);
    const invalid = new McpCapabilityError('authentication', 'Invalid or revoked API key.');
    if (!parsed) throw invalid;

    const devPrincipal = localDevKeyPrincipal(raw.trim());
    if (devPrincipal) {
        if (!devPrincipal.scopes.includes(scope)) {
            throw new McpCapabilityError(
                'authorization',
                `This API key is not enabled for the "${scope}" capability. Ask your Sahayak administrator to grant it.`,
            );
        }
        return devPrincipal;
    }

    const db = await deps.getDb();
    const snap = await db.collection(MCP_API_KEYS_COLLECTION).doc(parsed.keyId).get();
    const record = (snap.exists ? snap.data() : null) as McpApiKeyRecord | null;
    if (!record || record.status !== 'active' || !secretMatches(parsed.secret, record.secretHash, pepper)) {
        throw invalid;
    }
    if (typeof record.orgId !== 'string' || record.orgId === '') throw invalid;

    // The organisation must still exist (deleting it revokes all its keys).
    const org = await db.collection('organizations').doc(record.orgId).get();
    if (!org.exists) throw invalid;

    const scopes = Array.isArray(record.scopes) ? record.scopes.filter((s) => typeof s === 'string') : [];
    if (!scopes.includes(scope)) {
        throw new McpCapabilityError(
            'authorization',
            `This API key is not enabled for the "${scope}" capability. Ask your Sahayak administrator to grant it.`,
        );
    }
    return { keyId: parsed.keyId, orgId: record.orgId, scopes };
}
