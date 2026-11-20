#!/usr/bin/env node
/**
 * Behavioural check of firestore.rules against a Firestore EMULATOR (never a real project).
 *
 *   node scripts/qa/verify-firestore-rules.mjs --host 127.0.0.1:8180 --project demo-rules-check
 *
 * Start the emulator with this repo's firestore.rules first, on its own port and a demo-
 * project id (it refuses anything that is not a demo-* project). Seeds through the
 * emulator's admin bypass ("Bearer owner"), then makes signed-in client requests with
 * unsigned emulator ID tokens and checks each one is allowed or denied as expected.
 * Exit code 1 if any expectation fails.
 */
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const HOST = opt('host', '127.0.0.1:8180');
const PROJECT = opt('project', 'demo-rules-check');
if (!PROJECT.startsWith('demo-')) {
    console.error('refusing: --project must be a demo-* emulator project');
    process.exit(2);
}
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(HOST)) {
    console.error('refusing: --host must be a local emulator');
    process.exit(2);
}
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid) =>
    `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, user_id: uid, iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: 0, exp: 4102444800, auth_time: 0, firebase: { sign_in_provider: 'password' } })}.`;

function fields(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = val(v);
    return out;
}
function val(v) {
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'number') return { integerValue: String(v) };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
    if (v && typeof v === 'object') return { mapValue: { fields: fields(v) } };
    return { nullValue: null };
}

async function req(method, path, auth, body, query = '') {
    const res = await fetch(`${BASE}/${path}${query}`, {
        method,
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
        body: body ? JSON.stringify({ fields: fields(body) }) : undefined,
    });
    return res.status;
}
const seed = (path, data) => req('PATCH', path, 'owner', data);
// create via PATCH with currentDocument.exists=false; update via PATCH with an updateMask.
const create = (uid, path, data) => req('PATCH', path, token(uid), data, '?currentDocument.exists=false');
const update = (uid, path, data) =>
    req('PATCH', path, token(uid), data, `?${Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')}`);
const read = (uid, path) => req('GET', path, token(uid));

const results = [];
async function expect(name, promise, allowed) {
    const status = await promise;
    const ok = allowed ? status === 200 : status === 403;
    results.push({ name, status, ok, want: allowed ? 'allow' : 'deny' });
}

const A = 'teacherA', B = 'teacherB', V = 'victimV', X = 'outsiderX';
const DM = [A, V].sort().join('_');
await seed(`conversations/${DM}`, { type: 'direct', participantIds: [A, V], participants: { [A]: { displayName: 'A' }, [V]: { displayName: 'V' } } });
await seed(`conversations/${DM}/messages/m1`, { senderId: V, senderName: 'V', text: 'hi' });
await seed(`conversations/g1`, { type: 'group', participantIds: [A, B], participants: {} });
await seed(`groups/grp1`, { name: 'G', memberIds: [A] });
await seed(`groups/grp1/members/${A}`, { uid: A });
await seed(`typing_status/${DM}`, { [A]: 'x' });

// Conversations: participants read; no client create/update (block bypass, membership tampering, spoofing).
await expect('participant reads own DM', read(A, `conversations/${DM}`), true);
await expect('outsider cannot read DM', read(X, `conversations/${DM}`), false);
await expect('participant cannot flip DM to group (block bypass)', update(A, `conversations/${DM}`, { type: 'group' }), false);
await expect('group member cannot add an outsider to participantIds', update(A, 'conversations/g1', { participantIds: [A, B, X] }), false);
await expect("participant cannot rename another member", update(A, `conversations/${DM}`, { participants: { [V]: { displayName: 'Principal' } } }), false);
await expect('cannot plant a conversation in a victim inbox', create(X, 'conversations/planted', { type: 'direct', participantIds: [X, V], lastMessage: 'click here' }), false);

// Messages: read by participants; create server-only; receipts only on update.
await expect('participant reads messages', read(A, `conversations/${DM}/messages/m1`), true);
await expect('outsider cannot read messages', read(X, `conversations/${DM}/messages/m1`), false);
await expect('participant cannot create a message directly (impersonation / skips block + rate limits)', create(A, `conversations/${DM}/messages/m2`, { senderId: A, senderName: 'Principal Sharma', text: 'pay fees here' }), false);
await expect('participant cannot edit message text', update(A, `conversations/${DM}/messages/m1`, { text: 'edited' }), false);
await expect('participant may stamp a read receipt', update(A, `conversations/${DM}/messages/m1`, { readBy: [A] }), true);

// Community + group chat: server-only create.
await expect('community chat: client create denied (impersonation)', create(A, 'community_chat/c1', { authorId: A, authorName: 'Principal Sharma', text: 'x' }), false);
await expect('group chat: client create denied', create(A, 'groups/grp1/chat/c1', { authorId: A, authorName: 'Someone', text: 'x' }), false);

// Typing status: participants only.
await expect('participant reads typing status', read(A, `typing_status/${DM}`), true);
await expect('outsider cannot read typing status (who talks to whom)', read(X, `typing_status/${DM}`), false);
await expect('participant sets own typing key', update(V, `typing_status/${DM}`, { [V]: 'y' }), true);
await expect('outsider cannot write typing status', update(X, `typing_status/${DM}`, { [X]: 'y' }), false);
await expect('participant cannot set another user typing', update(A, `typing_status/${DM}`, { [V]: 'z' }), false);

let failed = 0;
for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.want.padEnd(5)} HTTP ${r.status}  ${r.name}`);
}
console.log(`\n${results.length - failed}/${results.length} rule expectations met`);
process.exit(failed ? 1 : 0);
