/**
 * Static guard for firestore.rules (access gate).
 *
 * There is no Firestore emulator in CI, so this test cannot evaluate the
 * rules. It pins the STRUCTURE instead: the protected fields, the access
 * helpers, the deny-all on the gate's own collections, and that the shared
 * collections converted to hasAccess() never drift back to "any signed-in
 * user". If you change firestore.rules deliberately, update the lists here in
 * the same commit. Design: docs/ACCESS_GATE_DESIGN.md.
 */
import fs from 'fs';
import path from 'path';

const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

/**
 * Return the body of `match <pattern> { ... }` with balanced braces. When the
 * same pattern appears at several depths (top-level `posts` and the group
 * `posts` subcollection), the SHALLOWEST one is returned.
 */
function matchBlock(source: string, pattern: string): string {
    const header = `match ${pattern} {`;
    let start = -1;
    let bestIndent = Number.POSITIVE_INFINITY;
    for (let at = source.indexOf(header); at !== -1; at = source.indexOf(header, at + 1)) {
        const indent = at - (source.lastIndexOf('\n', at) + 1);
        if (indent < bestIndent) {
            bestIndent = indent;
            start = at;
        }
    }
    if (start === -1) throw new Error(`rules block not found: ${pattern}`);
    let depth = 0;
    for (let i = start + header.length - 1; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start + header.length, i);
        }
    }
    throw new Error(`unbalanced braces in block: ${pattern}`);
}

/** Return the body of `function <name>() { ... }`. */
function functionBody(source: string, name: string): string {
    const re = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`);
    const m = re.exec(source);
    if (!m) throw new Error(`rules function not found: ${name}`);
    const end = source.indexOf('\n    }', m.index);
    return source.slice(m.index, end);
}

/** Strip `//` comments so assertions only see executable rules. */
function code(block: string): string {
    return block
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
}

describe('firestore.rules — access gate', () => {
    it('protects the access source-of-truth fields on users/{uid}', () => {
        const body = functionBody(rules, 'protectedUserFields');
        for (const field of ['accessState', 'accessExpiresAt', 'accessUpdatedAt', 'accessUpdatedBy']) {
            expect(body).toContain(`'${field}'`);
        }
        // Pre-existing protections must survive the edit.
        for (const field of ['planType', 'organizationId', 'role', 'email']) {
            expect(body).toContain(`'${field}'`);
        }
    });

    it('defines the kill switch on system_config/access_gate', () => {
        const body = code(functionBody(rules, 'accessGateEnforced'));
        expect(body).toContain('exists(/databases/$(database)/documents/system_config/access_gate)');
        expect(body).toContain('get(/databases/$(database)/documents/system_config/access_gate).data.enforce == true');
    });

    it('mirrors evaluateAccess(): entitled states, pilot needs expiry, expiry in the future', () => {
        const body = code(functionBody(rules, 'hasEntitledClaim'));
        expect(body).toContain("'access' in request.auth.token");
        expect(body).toContain("request.auth.token.access in ['legacy', 'pilot', 'active']");
        expect(body).toContain("request.auth.token.access != 'pilot' || ('accessExp' in request.auth.token)");
        expect(body).toContain('request.auth.token.accessExp > request.time.toMillis() / 1000');
        expect(body).not.toContain("'pending'");
        expect(body).not.toContain("'blocked'");
    });

    it('hasAccess() is signed-in AND (gate off OR entitled claim)', () => {
        const body = code(functionBody(rules, 'hasAccess'));
        expect(body.replace(/\s+/g, ' ')).toContain(
            'return isSignedIn() && (!accessGateEnforced() || hasEntitledClaim());',
        );
    });

    it('group membership implies access', () => {
        expect(code(functionBody(rules, 'isGroupMember'))).toContain('hasAccess()');
    });

    // Collections whose client rules must be Admin-SDK-only.
    it.each([
        '/access_requests/{uid}',
        '/quote_requests/{quoteId}',
        '/access_audit/{auditId}',
        '/access_flags/{uid}',
        '/joinLinks/{linkId}',
    ])('denies all client access to %s', (pattern) => {
        const body = code(matchBlock(rules, pattern)).replace(/\s+/g, ' ').trim();
        expect(body).toBe('allow read, write: if false;');
    });

    it('keeps joinLinks nested under organizations', () => {
        expect(matchBlock(rules, '/organizations/{orgId}')).toContain('match /joinLinks/{linkId}');
    });

    it('does not expose system_config/access_gate to clients', () => {
        const body = code(matchBlock(rules, '/system_config/{docId}'));
        expect(body).toContain("docId.matches('^public_.*')");
        expect(body).toContain('allow write: if false;');
    });

    // Shared / community / product collections converted from "any signed-in
    // user" to hasAccess(). None of them may contain a bare isSignedIn() grant.
    const CONVERTED = [
        '/conversations/{convId}',
        '/community_chat/{messageId}',
        '/groups/{groupId}',
        '/posts/{postId}',
        '/library_resources/{resourceId}',
        '/config/plans',
        '/typing_status/{conversationId}',
    ];

    it.each(CONVERTED)('%s requires hasAccess() and has no isSignedIn() grant', (pattern) => {
        const body = code(matchBlock(rules, pattern));
        expect(body).toContain('hasAccess()');
        expect(body).not.toContain('isSignedIn()');
    });

    it('presence: reads need access, the owner write stays ungated', () => {
        const body = code(matchBlock(rules, '/presence/{uid}'));
        expect(body).toContain('allow read: if hasAccess();');
        expect(body).toContain('allow write: if isOwner(uid);');
        expect(body).not.toContain('isSignedIn()');
    });

    it('connection requests and reports: create needs access', () => {
        expect(code(matchBlock(rules, '/connection_requests/{reqId}'))).toContain('allow create: if hasAccess()');
        expect(code(matchBlock(rules, '/reports/{reportId}'))).toContain('allow create: if hasAccess()');
    });

    it('leaves the caller’s own documents reachable for a pending account', () => {
        // A pending user must still load their own profile and notifications.
        const users = code(matchBlock(rules, '/users/{userId}'));
        expect(users).toContain('allow read: if isOwner(userId);');
        expect(users).not.toContain('hasAccess()');
        expect(code(matchBlock(rules, '/notifications/{notifId}'))).not.toContain('hasAccess()');
    });

    it('has balanced braces', () => {
        const stripped = code(rules);
        expect((stripped.match(/\{/g) ?? []).length).toBe((stripped.match(/\}/g) ?? []).length);
    });
});
