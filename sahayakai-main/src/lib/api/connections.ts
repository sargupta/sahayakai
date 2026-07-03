/**
 * Typed client wrappers for /api/connections/* (tranche 5 migration).
 *
 * Exported names and signatures are IDENTICAL to the old server actions in
 * src/app/actions/connections.ts — components only change their import path.
 */
import { apiFetch } from '@/lib/api/client';
import type { MyConnectionData } from '@/types';

export async function sendConnectionRequestAction(
    toUid: string,
): Promise<{ status: 'sent' | 'already_connected' | 'already_pending' }> {
    return apiFetch('/api/connections/request', { body: { toUid } });
}

export async function acceptConnectionRequestAction(requestId: string): Promise<void> {
    await apiFetch('/api/connections/request/accept', { body: { requestId } });
}

export async function declineConnectionRequestAction(requestId: string): Promise<void> {
    await apiFetch('/api/connections/request/decline', { body: { requestId } });
}

export async function disconnectAction(otherUid: string): Promise<void> {
    await apiFetch('/api/connections/disconnect', { body: { otherUid } });
}

export async function getMyConnectionDataAction(): Promise<MyConnectionData> {
    return apiFetch('/api/connections/mine');
}
