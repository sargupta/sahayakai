import { PubSub } from '@google-cloud/pubsub';
import 'server-only';
import { logger } from '@/lib/logger';

export const TOPICS = {
    STORAGE_CLEANUP: 'sahayakai-storage-cleanup',
} as const;

export interface StorageCleanupMessage {
    storagePath: string;
    userId: string;
    contentId: string;
}

let pubsub: PubSub | null = null;

export function getPubSub() {
    if (pubsub) return pubsub;

    // In production, it uses service account or default credentials
    // In local dev, we might use an emulator or a real project ID
    pubsub = new PubSub({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'sahayakai-b4248',
    });

    return pubsub;
}

export async function publishEvent(topicName: string, data: object) {
    const ps = getPubSub();
    const dataBuffer = Buffer.from(JSON.stringify(data));

    try {
        const messageId = await ps.topic(topicName).publishMessage({ data: dataBuffer });
        logger.info(`Message ${messageId} published to ${topicName}`, 'PUBSUB', data as Record<string, unknown>);
        return messageId;
    } catch (error) {
        logger.error(`Failed to publish to ${topicName}`, error, 'PUBSUB', data as Record<string, unknown>);
        // Don't throw — publishing is always a side-effect, never block the main flow
    }
}

/** Typed helper for the GCS storage cleanup topic. */
export async function publishStorageCleanup(msg: StorageCleanupMessage): Promise<void> {
    await publishEvent(TOPICS.STORAGE_CLEANUP, msg);
}
