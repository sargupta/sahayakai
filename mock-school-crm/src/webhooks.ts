/**
 * Webhook HINTS. The body names the entity that changed and nothing else, so a
 * receiver must pull the record by id (and a forged or replayed hint can at
 * worst cause one extra pull).
 *
 *   POST <SAHAYAKAI_WEBHOOK_URL>
 *   Content-Type: application/json
 *   X-CRM-Event-Id: <event id>
 *   X-CRM-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 *   {"id":"…","type":"hpc.entry.created","occurredAt":"…","entity":{"kind":"hpc_entry","id":"…"}}
 *
 * Receivers should reject a `t` more than five minutes from their clock and
 * de-duplicate on the event id.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { type WebhookEvent, type WebhookEventType, WEBHOOK_ENTITY_KINDS } from './schemas';

export type EntityKind = (typeof WEBHOOK_ENTITY_KINDS)[number];

export function signatureHeader(secret: string, rawBody: string, unixSeconds: number): string {
    const v1 = createHmac('sha256', secret).update(`${unixSeconds}.${rawBody}`).digest('hex');
    return `t=${unixSeconds},v1=${v1}`;
}

/** Reference verifier, for receivers and tests. */
export function verifySignature(
    secret: string,
    rawBody: string,
    header: string,
    nowSeconds: number,
    toleranceSeconds = 300,
): boolean {
    const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
    if (!m) return false;
    const t = Number(m[1]);
    if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
    const expected = Buffer.from(signatureHeader(secret, rawBody, t).split('v1=')[1] ?? '', 'hex');
    const given = Buffer.from(m[2] ?? '', 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface DeliveryRecord {
    eventId: string;
    type: WebhookEventType;
    entity: { kind: EntityKind; id: string };
    at: string;
    status: number | null;
    error: string | null;
}

export interface WebhookSender {
    readonly enabled: boolean;
    send(type: WebhookEventType, entity: { kind: EntityKind; id: string }): Promise<DeliveryRecord | null>;
    recent(): readonly DeliveryRecord[];
}

export function createWebhookSender(opts: {
    url: string | null | undefined;
    secret: string | null | undefined;
    now?: () => Date;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}): WebhookSender {
    const url = opts.url?.trim() || null;
    const secret = opts.secret?.trim() || null;
    const now = opts.now ?? (() => new Date());
    const doFetch = opts.fetchImpl ?? fetch;
    const log: DeliveryRecord[] = [];
    const enabled = Boolean(url && secret);

    return {
        enabled,
        recent: () => log.slice(-20).reverse(),
        async send(type, entity) {
            if (!url || !secret) return null;
            const at = now();
            const event: WebhookEvent = { id: `whe_${randomUUID()}`, type, occurredAt: at.toISOString(), entity };
            const body = JSON.stringify(event);
            const record: DeliveryRecord = { eventId: event.id, type, entity, at: event.occurredAt, status: null, error: null };
            try {
                const res = await doFetch(url, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-crm-event-id': event.id,
                        'x-crm-signature': signatureHeader(secret, body, Math.floor(at.getTime() / 1000)),
                    },
                    body,
                    signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
                });
                record.status = res.status;
                await res.arrayBuffer().catch(() => undefined);
            } catch (err) {
                record.error = err instanceof Error ? err.message : String(err);
                console.error(`[mock-school-crm] webhook ${type} → ${url} failed: ${record.error}`);
            }
            log.push(record);
            if (log.length > 100) log.splice(0, log.length - 100);
            return record;
        },
    };
}
