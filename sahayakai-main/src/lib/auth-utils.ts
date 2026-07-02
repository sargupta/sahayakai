import { dbAdapter } from './db/adapter';

/**
 * Checks if a user has administrator privileges.
 * @param userId The UID of the user to check.
 */
export async function isAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;

    try {
        const profile = await dbAdapter.getUser(userId);

        // Check for explicit 'admin' role in profile
        // This allows the user to grant admin status via Firestore: users/[uid] -> { role: 'admin' }
        if (profile && (profile as any).role === 'admin') {
            return true;
        }

        // Optional: Hardcoded owner logic or ENV based logic
        // const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
        // if (profile && adminEmails.includes(profile.email)) return true;

        return false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Validates admin status and throws an error if not authorized.
 * Useful for server actions.
 */
export async function validateAdmin(userId: string): Promise<void> {
    const authorized = await isAdmin(userId);
    if (authorized) return;

    // Admin is enforced in ALL environments by default (staging, preview, prod).
    // A dev convenience bypass exists ONLY when explicitly opted in via
    // ALLOW_DEV_ADMIN=true AND only for the known mock dev uid. This is NEVER
    // keyed on NODE_ENV, so a non-production build cannot fail open.
    const devBypass =
        process.env.ALLOW_DEV_ADMIN === 'true' && userId === 'dev-user-123';
    if (devBypass) return;

    throw new Error('Unauthorized: Admin access required.');
}
