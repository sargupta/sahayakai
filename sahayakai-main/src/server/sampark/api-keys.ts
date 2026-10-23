/**
 * Integrations: the school's MCP API keys, managed from the Sampark console
 * (integration brief Step 1A; decision 3: any school admin may issue and
 * revoke keys).
 *
 * Keys live in `mcp_api_keys/{keyId}` (src/lib/mcp/api-keys.ts), not in the
 * Sampark repo: the MCP servers read them there. Only the HMAC of the secret
 * is stored. The full key exists in exactly one place — the create response —
 * and is never logged, audited, listed or stored readable.
 *
 * Every create and revoke is written to the school's Sampark audit log
 * (`api_key.created`, `api_key.revoked`) with the key id and label only.
 */

import { z } from 'zod';

import { getDb } from '@/lib/firebase-admin';
import {
    displayApiKey,
    getKeyPepper,
    MCP_API_KEYS_COLLECTION,
    mintApiKey,
    type McpApiKeyRecord,
    type McpScope,
} from '@/lib/mcp/api-keys';
import type { IntegrationApiKey, IntegrationScope } from '@/types/sampark';
import type { SamparkCtx } from '@/server/sampark/http';
import { conflict, notFound, SamparkServiceError } from '@/server/sampark/errors';

/**
 * Scopes a school admin can grant from the console. `calling` is left out
 * until Step 3 replaces it with a `sampark` scope (decision 1).
 */
export const CONSOLE_SCOPES = ['lesson-planner', 'exam-paper', 'quiz'] as const satisfies readonly (McpScope & IntegrationScope)[];

export const MAX_LABEL = 80;
/** Active keys per school; revoke one to make another. */
export const MAX_ACTIVE_KEYS = 20;
const MAX_LISTED = 200;

export const CreateApiKeySchema = z
    .object({
        label: z.string().trim().min(1).max(MAX_LABEL),
        scopes: z.array(z.enum(CONSOLE_SCOPES)).min(1).max(CONSOLE_SCOPES.length),
    })
    .strict();
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

/** Minimal Firestore surface (keeps this testable with a fake). */
export interface ApiKeyDb {
    collection(name: string): {
        doc(id: string): {
            get(): Promise<{ exists: boolean; data(): unknown }>;
            create(data: Record<string, unknown>): Promise<unknown>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        where(field: string, op: '==', value: string): {
            limit(n: number): { get(): Promise<{ docs: { id: string; data(): unknown }[] }> };
        };
    };
}

export interface ApiKeyDeps {
    getDb: () => Promise<ApiKeyDb>;
}

const defaultDeps: ApiKeyDeps = { getDb: async () => (await getDb()) as unknown as ApiKeyDb };

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** The only shape a key leaves the server in. Built field by field: nothing secret can ride along. */
export function toIntegrationApiKey(keyId: string, raw: unknown): IntegrationApiKey {
    const r = (raw ?? {}) as Partial<McpApiKeyRecord>;
    return {
        keyId,
        displayKey: displayApiKey(keyId),
        label: str(r.label) ?? '',
        scopes: Array.isArray(r.scopes) ? r.scopes.filter((s): s is string => typeof s === 'string') : [],
        status: r.status === 'active' ? 'active' : 'revoked',
        createdAt: str(r.createdAt),
        createdBy: str(r.createdBy),
        lastUsedAt: str(r.lastUsedAt),
        revokedAt: str(r.revokedAt),
        revokedBy: str(r.revokedBy),
    };
}

export async function listApiKeys(orgId: string, deps: ApiKeyDeps = defaultDeps): Promise<IntegrationApiKey[]> {
    const db = await deps.getDb();
    const snap = await db.collection(MCP_API_KEYS_COLLECTION).where('orgId', '==', orgId).limit(MAX_LISTED).get();
    return snap.docs
        .map((d) => toIntegrationApiKey(d.id, d.data()))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function createApiKey(
    ctx: SamparkCtx,
    orgId: string,
    uid: string,
    input: CreateApiKeyInput,
    deps: ApiKeyDeps = defaultDeps,
): Promise<{ key: IntegrationApiKey; apiKey: string }> {
    const pepper = getKeyPepper();
    if (!pepper) throw new SamparkServiceError('MCP_NOT_CONFIGURED', 'API keys cannot be created on this server yet', 409);

    const existing = await listApiKeys(orgId, deps);
    if (existing.filter((k) => k.status === 'active').length >= MAX_ACTIVE_KEYS) {
        throw conflict('API_KEY_LIMIT', `A school can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
    }

    const now = ctx.clock.now();
    const { apiKey, keyId, record } = mintApiKey({ orgId, label: input.label, scopes: input.scopes, createdBy: uid, pepper, now });
    const db = await deps.getDb();
    // create() fails if the id exists, so a (vanishingly unlikely) id collision never overwrites a key.
    await db.collection(MCP_API_KEYS_COLLECTION).doc(keyId).create({ ...record });
    await ctx.repo.appendAudit(orgId, {
        at: now.toISOString(),
        actor: uid,
        action: 'api_key.created',
        target: `api_key/${keyId}`,
        detail: { keyId, label: record.label, scopes: record.scopes },
    });
    return { key: toIntegrationApiKey(keyId, record), apiKey };
}

/** Idempotent: revoking a revoked key returns it unchanged and audits nothing. Another school's key is not found. */
export async function revokeApiKey(
    ctx: SamparkCtx,
    orgId: string,
    uid: string,
    keyId: string,
    deps: ApiKeyDeps = defaultDeps,
): Promise<IntegrationApiKey> {
    const db = await deps.getDb();
    const ref = db.collection(MCP_API_KEYS_COLLECTION).doc(keyId);
    const snap = await ref.get();
    const record = (snap.exists ? snap.data() : null) as Partial<McpApiKeyRecord> | null;
    if (!record || record.orgId !== orgId) throw notFound('API_KEY_NOT_FOUND', 'No such key for this school');
    if (record.status !== 'active') return toIntegrationApiKey(keyId, record);

    const revokedAt = ctx.clock.now().toISOString();
    await ref.update({ status: 'revoked', revokedAt, revokedBy: uid });
    await ctx.repo.appendAudit(orgId, {
        at: revokedAt,
        actor: uid,
        action: 'api_key.revoked',
        target: `api_key/${keyId}`,
        detail: { keyId, label: str(record.label) ?? '' },
    });
    return toIntegrationApiKey(keyId, { ...record, status: 'revoked', revokedAt, revokedBy: uid });
}
