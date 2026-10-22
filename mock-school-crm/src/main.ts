/**
 * `npm start`: serve the dummy CRM.
 *
 *   PORT                      default 4700
 *   HOST                      default 127.0.0.1 (use 0.0.0.0 in a container)
 *   MOCK_CRM_API_KEY          bearer key for /v1/**, default 'mock-crm-dev-key'
 *   MOCK_CRM_STATE_PATH       default data/state.json (created from the seed if missing)
 *   SAHAYAKAI_WEBHOOK_URL     optional: where demo-page changes are hinted
 *   SAHAYAKAI_WEBHOOK_SECRET  optional: HMAC key for X-CRM-Signature
 */

import { createCrmServer, DEFAULT_API_KEY } from './server';
import { DEFAULT_STATE_PATH, loadOrCreateState } from './store';
import { createWebhookSender } from './webhooks';

const port = Number(process.env.PORT ?? 4700);
const host = process.env.HOST ?? '127.0.0.1';
const apiKey = process.env.MOCK_CRM_API_KEY?.trim() || DEFAULT_API_KEY;
const statePath = process.env.MOCK_CRM_STATE_PATH?.trim() || DEFAULT_STATE_PATH;

const { state, created } = await loadOrCreateState(statePath);
if (created) console.log(`[mock-school-crm] seeded ${statePath}`);

const webhook = createWebhookSender({ url: process.env.SAHAYAKAI_WEBHOOK_URL, secret: process.env.SAHAYAKAI_WEBHOOK_SECRET });
if (process.env.SAHAYAKAI_WEBHOOK_URL && !webhook.enabled) {
    console.warn('[mock-school-crm] SAHAYAKAI_WEBHOOK_URL is set but SAHAYAKAI_WEBHOOK_SECRET is not; webhook hints are OFF');
}

const { server, app } = createCrmServer({ state, statePath, apiKey, webhook });
server.listen(port, host, () => {
    const live = state.students.filter((s) => !s.deleted).length;
    console.log(`[mock-school-crm] ${state.school.name}: ${live} students, ${state.guardians.length} guardians`);
    console.log(`[mock-school-crm] listening on http://${host}:${port} (demo page at /, API under /v1, key ${apiKey === DEFAULT_API_KEY ? 'default' : 'from MOCK_CRM_API_KEY'})`);
    console.log(`[mock-school-crm] webhook hints: ${webhook.enabled ? `ON → ${process.env.SAHAYAKAI_WEBHOOK_URL}` : 'off'}`);
});

let closing = false;
const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[mock-school-crm] ${signal}: closing`);
    server.close();
    void Promise.all([app.flushSaves(), app.flushWebhooks()]).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
