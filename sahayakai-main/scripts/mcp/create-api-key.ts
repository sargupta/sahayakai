/**
 * Issue a scoped API key for Sahayak's public MCP servers. DRY-RUN by default.
 *
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 MCP_API_KEY_PEPPER=... \
 *     npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope lesson-planner --label "School LMS"           # preview
 *   ... --apply   # write mcp_api_keys/{keyId} and print the key ONCE
 *
 * Revoke:  npx tsx scripts/mcp/create-api-key.ts --revoke <keyId> [--apply]
 *
 * The key is shown once and never stored in plaintext (only an HMAC-SHA256
 * of its secret, peppered with MCP_API_KEY_PEPPER — the SAME pepper must be
 * configured on the server). The organisation must already exist.
 */
import { getDb } from '../../src/lib/firebase-admin';
import { getKeyPepper, MCP_API_KEYS_COLLECTION, MCP_SCOPES, mintApiKey, type McpScope } from '../../src/lib/mcp/api-keys';

const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
};
const all = (name: string) => process.argv.flatMap((a, i) => (a === name ? [process.argv[i + 1]] : [])).filter(Boolean) as string[];

async function main() {
    const apply = process.argv.includes('--apply');
    const db = await getDb();

    const revokeId = arg('--revoke');
    if (revokeId) {
        if (!/^[0-9a-f]{16}$/.test(revokeId)) throw new Error('--revoke expects a 16-hex keyId.');
        const ref = db.collection(MCP_API_KEYS_COLLECTION).doc(revokeId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error(`No key ${revokeId}.`);
        console.log(`[mcp-key] ${apply ? 'REVOKING' : 'would revoke'} ${revokeId} (org ${snap.data()?.orgId}).`);
        if (apply) await ref.update({ status: 'revoked', revokedAt: new Date().toISOString() });
        return;
    }

    const orgId = arg('--org');
    const label = arg('--label') ?? '';
    const scopes = all('--scope');
    if (!orgId || !/^[A-Za-z0-9_-]{4,128}$/.test(orgId)) throw new Error('--org <orgId> is required.');
    if (scopes.length === 0) throw new Error(`At least one --scope is required (${MCP_SCOPES.join(', ')}).`);
    const unknown = scopes.filter((s) => !(MCP_SCOPES as readonly string[]).includes(s));
    if (unknown.length) throw new Error(`Unknown scope(s): ${unknown.join(', ')}. Known: ${MCP_SCOPES.join(', ')}.`);
    if (label.trim().length < 3) throw new Error('--label "<who/what uses this key>" is required.');

    const org = await db.collection('organizations').doc(orgId).get();
    if (!org.exists) throw new Error(`Organisation ${orgId} does not exist.`);

    const pepper = getKeyPepper();
    if (!pepper) throw new Error('MCP_API_KEY_PEPPER (>= 32 chars) must be set — the same value the server uses.');

    const { apiKey, keyId, record } = mintApiKey({ orgId, label: label.trim(), scopes: scopes as McpScope[], createdBy: process.env.USER ?? process.env.USERNAME ?? 'cli', pepper });
    console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY-RUN', keyId, orgId, orgName: org.data()?.name ?? null, scopes: record.scopes, label: record.label }, null, 2));
    if (!apply) {
        console.error('[mcp-key] dry-run only — nothing written. Re-run with --apply to create the key.');
        return;
    }
    await db.collection(MCP_API_KEYS_COLLECTION).doc(keyId).set(record);
    console.error('[mcp-key] created. Give this key to the school over a secure channel; it is shown ONLY now:');
    console.log(apiKey);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
