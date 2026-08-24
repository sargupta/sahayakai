
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '@/lib/logger';

let secretManager: SecretManagerServiceClient | null = null;
const secretCache: Record<string, string> = {};

/**
 * Secret Manager ids in this project are not written consistently: most follow
 * the env-var convention (`GOOGLE_GENAI_API_KEY`), but some were created by
 * hand in lower-kebab (`razorpay-key-secret`). Callers always ask by env-var
 * name, so resolution tries the literal id first and the kebab form second.
 *
 * Exported for the naming-drift test in __tests__/lib/secrets.test.ts.
 */
export function secretIdCandidates(secretName: string): string[] {
    const kebab = secretName.toLowerCase().replace(/_/g, '-');
    return kebab === secretName ? [secretName] : [secretName, kebab];
}

/**
 * Fetches a secret from GCP Secret Manager.
 * Caches the result in memory to avoid redundant API calls.
 */
export async function getSecret(secretName: string): Promise<string> {
    // 1. Return from cache if available
    if (secretCache[secretName]) {
        return secretCache[secretName];
    }

    // 2. CHECK LOCAL ENV FIRST - Avoids crashing in v25+ on missing ADC
    const envValue = process.env[secretName]?.trim();
    const isPlaceholder = (val: string | undefined) => !val || val.startsWith('secrets/');

    if (!isPlaceholder(envValue)) {
        logger.info(`Using local environment value for ${secretName}`, 'secrets', { secretName });
        secretCache[secretName] = envValue!;
        return envValue!;
    }

    // 3. Attempt Secret Manager only if no local key exists
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
    const candidates = secretIdCandidates(secretName);
    let lastError: any = null;

    for (const secretId of candidates) {
        try {
            if (!secretManager) {
                secretManager = new SecretManagerServiceClient();
            }

            const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;

            logger.info(`Fetching ${secretId} from Secret Manager...`, 'secrets', { secretName, secretId });
            const [version] = await secretManager.accessSecretVersion({ name });

            const payload = version.payload?.data?.toString();
            if (!payload) {
                throw new Error(`Secret ${secretId} has no payload.`);
            }

            // Cache the result under the name the caller asked for.
            secretCache[secretName] = payload;
            return payload;
        } catch (error: any) {
            lastError = error;
            console.error(`[Secrets] Failed to fetch ${secretId} from Cloud:`, error.message);
        }
    }

    const helpMsg = `Secret ${secretName} not found in Secret Manager (tried: ${candidates.join(', ')}) and no valid local fallback exists.
If running locally, please run 'gcloud auth application-default login' or provide the key in .env.local (WITHOUT the 'secrets/' prefix).`;

    console.error(`[Secrets] ${helpMsg}`, lastError?.message);
    throw new Error(helpMsg);
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
