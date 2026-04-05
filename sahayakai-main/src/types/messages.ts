import { Timestamp } from 'firebase/firestore';

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ConversationType = 'direct' | 'group';

export type MessageType = 'text' | 'resource' | 'audio';

// ── Participant snapshot (denormalized so inbox renders without joins) ─────────

export interface ParticipantSnapshot {
    displayName: string;
    photoURL: string | null;
    preferredLanguage?: string;
}

// ── Shared resource card (lesson plan / quiz / etc sent inside a DM) ─────────

export interface SharedResource {
    id: string;
    type: 'lesson-plan' | 'quiz' | 'worksheet' | 'visual-aid' | 'rubric' | 'virtual-field-trip' | 'teacher-training';
    title: string;
    gradeLevel?: string;
    subject?: string;
    language?: string;
    route: string; // e.g. 'lesson-planner' — used to build the "Open" link
}

// ── Message document (sub-collection: conversations/{id}/messages) ─────────────

export interface Message {
    id: string;                         // Firestore docId
    type: MessageType;                  // 'text' | 'resource'
    text: string;                       // plain text (or caption for resource share)
    senderId: string;
    senderName: string;                 // denormalized
    senderPhotoURL: string | null;      // denormalized
    resource?: SharedResource;          // only when type === 'resource'
    audioUrl?: string;                  // only when type === 'audio'
    audioDuration?: number;             // duration in seconds
    readBy: string[];                   // UIDs who have opened this message
    createdAt: Timestamp | null;
    clientMessageId?: string;          // UUID for idempotent writes / dedup
    deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    deliveredTo?: string[];            // UIDs that received the message
    mediaStatus?: 'uploading' | 'ready' | 'failed';  // for async media uploads
}

// ── Conversation document (collection: conversations) ─────────────────────────

export interface Conversation {
    id: string;
    type: ConversationType;             // 'direct' | 'group'

    participantIds: string[];           // ALL UIDs — used for array-contains queries
    participants: Record<string, ParticipantSnapshot>;

    // Group-only fields
    name?: string;                      // Group display name
    groupPhotoURL?: string;
    createdBy?: string;                 // UID of group creator

    // Inbox preview
    lastMessage: string;                // snippet (max 80 chars)
    lastMessageAt: Timestamp | null;
    lastMessageSenderId: string;

    // Unread badge per participant
    unreadCount: Record<string, number>;

    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

// ── Outbox item (queued in IndexedDB for offline-first sends) ─────────────────

export interface OutboxMessage {
    clientMessageId: string;
    conversationId: string;
    text: string;
    type: MessageType;
    resource?: SharedResource;
    audioUrl?: string;
    audioDuration?: number;
    status: 'queued' | 'sending' | 'sent' | 'failed';
    retryCount: number;
    createdAt: number;  // Date.now()
    localBlobUrl?: string;  // for voice messages before upload completes
}

// ── Helper: deterministic conversationId for 1:1 DMs ─────────────────────────

export function buildDirectConversationId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}
