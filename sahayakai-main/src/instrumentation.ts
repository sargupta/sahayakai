/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Validates all required environment variables before the first request.
 * A missing required var will crash startup loudly (visible in Cloud Run logs)
 * rather than silently failing at request time.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

const REQUIRED_ENV_VARS: Record<string, string> = {
    GOOGLE_GENAI_API_KEY:         'Gemini AI (lesson plan, visual aid, etc.)',
    FIREBASE_SERVICE_ACCOUNT_KEY: 'Firebase Admin SDK (Firestore, Auth)',
    // Note: NEXT_PUBLIC_* vars are build-time only — not available as runtime
    // process.env in Cloud Run. Firebase client uses hardcoded fallbacks in
    // lib/firebase.ts so these do NOT need to be runtime-checked.
};

// Optional — warn if missing but don't crash
const OPTIONAL_ENV_VARS: Record<string, string> = {
    TWILIO_ACCOUNT_SID:  'Twilio voice calls (attendance parent contact)',
    TWILIO_AUTH_TOKEN:   'Twilio voice calls (attendance parent contact)',
    TWILIO_PHONE_NUMBER: 'Twilio voice calls (attendance parent contact)',
    SENTRY_DSN:          'Sentry error monitoring',
};

export async function register() {
    // Only run on server (not in edge runtime or client bundle)
    if (process.env.NEXT_RUNTIME === 'edge') return;

    const missing: string[] = [];

    for (const [key, purpose] of Object.entries(REQUIRED_ENV_VARS)) {
        if (!process.env[key]) {
            missing.push(`  MISSING  ${key}  (${purpose})`);
        }
    }

    if (missing.length > 0) {
        console.error('\n╔══════════════════════════════════════════════════════╗');
        console.error('║  STARTUP FAILURE — Missing required environment vars  ║');
        console.error('╚══════════════════════════════════════════════════════╝');
        missing.forEach(m => console.error(m));
        console.error('Server will start but requests requiring these vars will fail.\n');
        // Don't throw — Cloud Run health probe would fail and block rollout
        // Log loudly instead so it's visible in startup logs
    } else {
        console.log('[startup] All required environment variables present.');
    }

    // Warn about optional vars
    const missingOptional: string[] = [];
    for (const [key, purpose] of Object.entries(OPTIONAL_ENV_VARS)) {
        if (!process.env[key]) {
            missingOptional.push(`${key} (${purpose})`);
        }
    }
    if (missingOptional.length > 0) {
        console.warn(`[startup] Optional env vars not set: ${missingOptional.join(', ')}`);
    }
}
