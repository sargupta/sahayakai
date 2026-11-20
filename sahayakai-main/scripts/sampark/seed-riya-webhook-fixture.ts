/**
 * EMULATOR ONLY. Stand in for "ElevenLabs accepted a Test call", so the signed-webhook
 * path can be exercised end to end on a laptop without placing a call.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 ELEVENLABS_AGENT_ID=<the app's value> \
 *     npx tsx scripts/sampark/seed-riya-webhook-fixture.ts [--conversation conv_local_test_1]
 *
 * It copies the newest Practice call in hillview-demo (run one in the Riya tab first)
 * into a new record shaped like an accepted Test call: provider 'elevenlabs', state
 * 'initiated', the given conversation id, linked create-only like the real start path.
 * It never contacts ElevenLabs or any phone, and it REFUSES to run unless
 * FIRESTORE_EMULATOR_HOST points at this machine.
 *
 * Then: node scripts/sampark/send-test-riya-webhook.mjs --conversation <same id>
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { FirestoreConversationRepo } from '@/lib/sampark/conversation/firestore-repo';
import type { ConversationCall } from '@/lib/sampark/conversation/types';

const ORG_ID = 'hillview-demo';
const LOCAL_EMULATOR = /^(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/;

function arg(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
    const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? '';
    if (!LOCAL_EMULATOR.test(emulator) || process.env.NODE_ENV === 'production') {
        process.stderr.write('Refusing: this script only writes to a Firestore emulator on this machine (FIRESTORE_EMULATOR_HOST=127.0.0.1:8080).\n');
        process.exit(1);
    }
    const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
    if (!agentId) {
        process.stderr.write('ELEVENLABS_AGENT_ID is not set: use the same value the local app has, or the webhook is treated as another agent.\n');
        process.exit(1);
    }
    const conversationId = arg('conversation', 'conv_local_test_1');
    if (!/^conv_[A-Za-z0-9_]{4,60}$/.test(conversationId)) {
        process.stderr.write('The conversation id must look like conv_xxxx.\n');
        process.exit(1);
    }

    const projectId = process.env.GCLOUD_PROJECT?.trim() || 'demo-sahayakai';
    const app = getApps()[0] ?? initializeApp({ projectId });
    const repo = new FirestoreConversationRepo(getFirestore(app));

    const existingLink = await repo.getLink(conversationId);
    if (existingLink) {
        process.stdout.write(`Already linked: ${conversationId} → ${existingLink.orgId}/${existingLink.callId}. Use another --conversation to start fresh.\n`);
        return;
    }
    const template = (await repo.listCalls(ORG_ID, 20)).find((c) => c.provider === 'simulated');
    if (!template) {
        process.stderr.write('No Practice call found in hillview-demo. Run one in the Riya tab first.\n');
        process.exitCode = 3;
        return;
    }

    const now = new Date().toISOString();
    const call: ConversationCall = {
        ...template,
        id: `webhookfixture_${conversationId}`,
        provider: 'elevenlabs',
        mode: 'test',
        destination: 'test_phone',
        state: 'initiated',
        providerConversationId: conversationId,
        providerCallId: null,
        agentId,
        agentPhoneNumberId: process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID?.trim() || null,
        durationSeconds: null,
        providerStatus: 'local_fixture',
        terminationReason: null,
        failureReason: null,
        callSuccessful: null,
        dataCollection: {},
        stopRequested: false,
        transcript: null,
        transcriptExpiresAt: null,
        appliedEvents: [],
        lastEventAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        createdAt: now,
        updatedAt: now,
        endedAt: null,
    };
    if (!(await repo.createCallIfAbsent(call))) {
        process.stderr.write(`A record ${call.id} already exists; use another --conversation.\n`);
        process.exitCode = 1;
        return;
    }
    await repo.linkConversation(conversationId, { orgId: ORG_ID, callId: call.id, createdAt: now });
    process.stdout.write(`Created local Test-call fixture ${ORG_ID}/${call.id}, linked to ${conversationId} (state initiated; nothing was dialled).\n`);
}

main().catch((err) => {
    process.stderr.write(`Fixture failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
