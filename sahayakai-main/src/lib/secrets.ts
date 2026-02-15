
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let secretManager: SecretManagerServiceClient | null = null;
const secretCache: Record<string, string> = {};

/**
 * Fetches a secret from GCP Secret Manager.
 * Caches the result in memory to avoid redundant API calls.
 */
export async function getSecret(secretName: string): Promise<string> {
    // Return from cache if available
    if (secretCache[secretName]) {
        return secretCache[secretName];
    }

    try {
        if (!secretManager) {
            secretManager = new SecretManagerServiceClient();
        }

        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
        const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

        console.log(`[Secrets] Fetching ${secretName} from Secret Manager...`);
        const [version] = await secretManager.accessSecretVersion({ name });

        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret ${secretName} has no payload.`);
        }

        // Cache the result
        secretCache[secretName] = payload;
        return payload;
    } catch (error: any) {
        console.error(`[Secrets] Failed to fetch ${secretName}:`, error.message);

        // Fallback to environment variable if available and NOT a placeholder
        const envValue = process.env[secretName]?.trim();
        if (envValue && !envValue.startsWith('secrets/')) {
            console.warn(`[Secrets] Falling back to process.env.${secretName}`);
            secretCache[secretName] = envValue;
            return envValue;
        }

        const helpMsg = `Secret ${secretName} not found in Secret Manager and no valid local fallback exists. 
If running locally, please run 'gcloud auth application-default login' or provide the key in .env.local (WITHOUT the 'secrets/' prefix).`;

        console.error(`[Secrets] ${helpMsg}`);
        throw new Error(helpMsg);
    }
}

/**
 * Convenience method to fetch multiple secrets at once.
 */
export async function getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    await Promise.all(
        secretNames.map(async (name) => {
            results[name] = await getSecret(name);
        })
    );
    return results;
}
