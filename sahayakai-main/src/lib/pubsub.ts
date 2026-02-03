import { PubSub } from '@google-cloud/pubsub';
import 'server-only';

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
        console.log(`Message ${messageId} published to ${topicName}.`);
        return messageId;
    } catch (error) {
        console.error(`Error publishing to ${topicName}:`, error);
        // Don't throw to avoid blocking the main flow unless critical
    }
}
