import { z } from 'zod';

const EnvSchema = z.object({
    GOOGLE_GENAI_API_KEY: z.string().min(1, 'GOOGLE_GENAI_API_KEY is required'),
    FIREBASE_SERVICE_ACCOUNT_KEY: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_KEY is required'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is required'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export function validateEnvironment() {
    try {
        EnvSchema.parse(process.env);
        console.log('[Config] ✅ Environment validation passed');
        return true;
    } catch (error: any) {
        console.error('[Config] ❌ Environment validation failed:');
        if (error.errors) {
            error.errors.forEach((err: any) => {
                console.error(`  - ${err.path.join('.')}: ${err.message}`);
            });
        }

        // In production, fail fast
        if (process.env.NODE_ENV === 'production') {
            console.error('[Config] Exiting due to invalid environment configuration');
            process.exit(1);
        }

        return false;
    }
}

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
    validateEnvironment();
}
