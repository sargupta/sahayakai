import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { WebhookEventSchema } from '../src/schemas';
import { createWebhookSender, signatureHeader, verifySignature } from '../src/webhooks';
import { freshState, startReceiver, startServer, submitDemo, type TestServer } from './helpers';

const SECRET = 'whsec_test_secret';

test('signature header format: t=<unix>,v1=<hex HMAC-SHA256(secret, t + "." + body)>', () => {
    const body = '{"id":"x"}';
    const header = signatureHeader(SECRET, body, 1_790_000_000);
    assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
    const expected = createHmac('sha256', SECRET).update(`1790000000.${body}`).digest('hex');
    assert.equal(header, `t=1790000000,v1=${expected}`);
    assert.equal(verifySignature(SECRET, body, header, 1_790_000_100), true);
    assert.equal(verifySignature(SECRET, body, header, 1_790_000_000 + 301), false, 'outside the 5-minute window');
    assert.equal(verifySignature('wrong', body, header, 1_790_000_000), false);
    assert.equal(verifySignature(SECRET, `${body} `, header, 1_790_000_000), false);
});

test('no URL or no secret → hints are off and nothing is sent', async () => {
    let called = false;
    const fetchImpl = (async () => {
        called = true;
        return new Response(null);
    }) as typeof fetch;
    const sender = createWebhookSender({ url: 'http://127.0.0.1:1/x', secret: '', fetchImpl });
    assert.equal(sender.enabled, false);
    assert.equal(await sender.send('guardian.updated', { kind: 'guardian', id: 'gdn_0001' }), null);
    assert.equal(called, false);
});

let receiver: Awaited<ReturnType<typeof startReceiver>>;
let srv: TestServer;
before(async () => {
    receiver = await startReceiver();
    srv = await startServer({ webhook: createWebhookSender({ url: receiver.url, secret: SECRET }) });
});
after(async () => {
    await srv.app.flushWebhooks();
    await srv.close();
    await receiver.close();
});

test('every demo-page mutation sends one signed hint with no record body', async () => {
    const state = freshState();
    const studentId = state.planted.siblings.studentIds[0];
    const guardianId = state.planted.siblings.guardianIds[0] ?? '';
    const actions: [string, Record<string, string>, string, string][] = [
        ['hpc', { studentId, respondentType: 'teacher', sentiment: 'positive', note: 'Led the class quiz.' }, 'hpc.entry.created', 'hpc_entry'],
        ['absent', { studentId }, 'attendance.marked', 'attendance'],
        ['event', { title: 'Sports Day', kind: 'sports_day', date: '2026-11-20', audience: 'school', venueId: 'school_ground', startTime: '09:00' }, 'event.published', 'event'],
        ['closure', { when: 'tomorrow', reason: 'landslide' }, 'event.published', 'event'],
        ['meeting', { studentId, reasonCode: 'general_progress', requestedByRole: 'class_teacher' }, 'meeting.requested', 'meeting'],
        ['incident', { studentId, reasonCode: 'minor_injury', severity: 'low', reportedByRole: 'teacher' }, 'incident.logged', 'incident'],
        ['guardian', { guardianId, doNotContact: 'true' }, 'guardian.updated', 'guardian'],
    ];
    for (const [action, fields, type, kind] of actions) {
        const location = await submitDemo(srv.baseUrl, action, fields);
        assert.match(location, /^\/\?done=/, `${action}: ${decodeURIComponent(location)}`);
        await srv.app.flushWebhooks();
        const hook = receiver.received.at(-1);
        assert.ok(hook, `${action} sent nothing`);
        const nowSec = Math.floor(Date.now() / 1000);
        const signature = String(hook.headers['x-crm-signature']);
        assert.match(signature, /^t=\d+,v1=[0-9a-f]{64}$/);
        assert.equal(verifySignature(SECRET, hook.body, signature, nowSec), true, `${action} signature`);
        const event = WebhookEventSchema.parse(JSON.parse(hook.body));
        assert.deepEqual(Object.keys(JSON.parse(hook.body)).sort(), ['entity', 'id', 'occurredAt', 'type']);
        assert.equal(hook.headers['x-crm-event-id'], event.id);
        assert.equal(event.type, type);
        assert.equal(event.entity.kind, kind);
        // The hinted entity can be pulled.
        const found =
            kind === 'hpc_entry' ? srv.app.state.hpcEntries.some((e) => e.id === event.entity.id)
            : kind === 'attendance' ? srv.app.state.attendance.some((r) => r.id === event.entity.id)
            : kind === 'event' ? srv.app.state.events.some((e) => e.id === event.entity.id)
            : kind === 'meeting' ? srv.app.state.meetings.some((m) => m.id === event.entity.id)
            : kind === 'incident' ? srv.app.state.incidents.some((i) => i.id === event.entity.id)
            : srv.app.state.guardians.some((g) => g.id === event.entity.id && g.doNotContact);
        assert.ok(found, `${action}: ${event.entity.id} not in state`);
    }
    assert.equal(receiver.received.length, actions.length);
    assert.equal(new Set(receiver.received.map((h) => h.headers['x-crm-event-id'])).size, actions.length);
});

test('invalid demo input redirects with an error and sends nothing', async () => {
    const count = receiver.received.length;
    const location = await submitDemo(srv.baseUrl, 'hpc', { studentId: 'stu_0000', respondentType: 'teacher', sentiment: 'positive' });
    assert.match(location, /^\/\?error=/);
    await srv.app.flushWebhooks();
    assert.equal(receiver.received.length, count);
});

test('confidential respondents never store note text', async () => {
    const studentId = freshState().planted.counsellorReferral.studentId;
    await submitDemo(srv.baseUrl, 'hpc', { studentId, respondentType: 'counsellor', sentiment: 'concern', note: 'private details' });
    await srv.app.flushWebhooks();
    const entry = srv.app.state.hpcEntries.at(-1);
    assert.equal(entry?.respondent.type, 'counsellor');
    assert.equal(entry?.note, null);
    assert.equal(entry?.reasonCode, 'counselling_session');
});
