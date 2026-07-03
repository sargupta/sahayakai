/**
 * Typed client wrappers for /api/moderation/* (moderation v1 — block/report).
 *
 * Identity is never sent for authorization: the middleware-verified Bearer
 * token (attached by apiFetch) is the only trusted identity.
 *
 * The target-type / reason unions are duplicated from src/server/moderation.ts
 * (which imports firebase-admin and must never reach a client bundle).
 */
import { apiFetch } from '@/lib/api/client';

export type ReportTargetType = 'message' | 'post' | 'profile' | 'resource';
export type ReportReason = 'harassment' | 'inappropriate' | 'spam' | 'other';

export const REPORT_FREETEXT_MAX = 500;

export interface BlockedUser {
    blockedUid: string;
    createdAt: string | null;
    displayName: string;
    photoURL: string | null;
}

export async function blockUserAction(blockedUid: string): Promise<void> {
    await apiFetch('/api/moderation/block', { body: { blockedUid } });
}

export async function unblockUserAction(blockedUid: string): Promise<void> {
    await apiFetch('/api/moderation/block', { method: 'DELETE', body: { blockedUid } });
}

export async function listBlockedUsersAction(): Promise<BlockedUser[]> {
    const { blocks } = await apiFetch<{ blocks: BlockedUser[] }>('/api/moderation/blocks');
    return blocks;
}

export async function reportContentAction(params: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    freeText?: string;
}): Promise<{ reportId: string }> {
    return apiFetch('/api/moderation/report', { body: params });
}
