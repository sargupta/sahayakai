import { OutboxMessage } from '@/types/messages';
import { initDB } from '@/lib/indexed-db';

const STORE = 'message_outbox' as const;
const MAX_RETRIES = 3;
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

type Listener = () => void;

class OutboxManager {
    private listeners = new Set<Listener>();
    private cache = new Map<string, OutboxMessage>();

    subscribe(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private notify() {
        this.listeners.forEach(fn => fn());
    }

    // Sync in-memory view for a conversation (non-async for React render)
    getMessages(conversationId: string): OutboxMessage[] {
        return Array.from(this.cache.values())
            .filter(m => m.conversationId === conversationId)
            .sort((a, b) => a.createdAt - b.createdAt);
    }

    async loadCache(): Promise<void> {
        const db = await initDB();
        const all: OutboxMessage[] = await db.getAll(STORE);
        this.cache.clear();
        for (const m of all) this.cache.set(m.clientMessageId, m);
    }

    async enqueue(msg: OutboxMessage): Promise<OutboxMessage> {
        const db = await initDB();
        await db.put(STORE, msg, msg.clientMessageId);
        this.cache.set(msg.clientMessageId, msg);
        this.notify();
        return msg;
    }

    async remove(clientMessageId: string): Promise<void> {
        const db = await initDB();
        await db.delete(STORE, clientMessageId);
        this.cache.delete(clientMessageId);
        this.notify();
    }

    async updateStatus(clientMessageId: string, status: OutboxMessage['status']): Promise<void> {
        const db = await initDB();
        const msg: OutboxMessage | undefined = await db.get(STORE, clientMessageId);
        if (!msg) return;
        msg.status = status;
        if (status === 'queued') msg.retryCount = 0;
        await db.put(STORE, msg, clientMessageId);
        this.cache.set(clientMessageId, msg);
        this.notify();
    }

    async getForConversation(conversationId: string): Promise<OutboxMessage[]> {
        const db = await initDB();
        const all: OutboxMessage[] = await db.getAll(STORE);
        return all
            .filter((m) => m.conversationId === conversationId)
            .sort((a, b) => a.createdAt - b.createdAt);
    }

    async getAllPending(): Promise<OutboxMessage[]> {
        const db = await initDB();
        const all: OutboxMessage[] = await db.getAll(STORE);
        return all
            .filter(
                (m) =>
                    m.status === 'queued' ||
                    (m.status === 'failed' && m.retryCount < MAX_RETRIES)
            )
            .sort((a, b) => a.createdAt - b.createdAt);
    }

    async markSending(clientMessageId: string): Promise<void> {
        const db = await initDB();
        const msg: OutboxMessage | undefined = await db.get(STORE, clientMessageId);
        if (!msg) return;
        msg.status = 'sending';
        await db.put(STORE, msg, clientMessageId);
    }

    async markSent(clientMessageId: string): Promise<void> {
        const db = await initDB();
        await db.delete(STORE, clientMessageId);
    }

    async markFailed(clientMessageId: string): Promise<void> {
        const db = await initDB();
        const msg: OutboxMessage | undefined = await db.get(STORE, clientMessageId);
        if (!msg) return;
        msg.status = 'failed';
        msg.retryCount += 1;
        await db.put(STORE, msg, clientMessageId);
    }

    async pruneExpired(): Promise<void> {
        const db = await initDB();
        const all: OutboxMessage[] = await db.getAll(STORE);
        const keys = await db.getAllKeys(STORE);
        const now = Date.now();
        const tx = db.transaction(STORE, 'readwrite');
        for (let i = 0; i < all.length; i++) {
            if (now - all[i].createdAt > EXPIRY_MS) {
                tx.store.delete(keys[i]);
            }
        }
        await tx.done;
    }

    private _flushing = false;

    async flush(
        sendFn: (msg: OutboxMessage) => Promise<{ messageId: string }>
    ): Promise<void> {
        // Prevent concurrent flushes (e.g. auto-sync + manual retry button).
        // Without this guard, two flushes could both read the same pending list
        // and both call sendFn → parent gets the same WhatsApp message twice.
        if (this._flushing) return;
        this._flushing = true;
        try {
            const pending = await this.getAllPending();
            for (const msg of pending) {
                try {
                    await this.markSending(msg.clientMessageId);
                    await sendFn(msg);
                    await this.markSent(msg.clientMessageId);
                } catch {
                    await this.markFailed(msg.clientMessageId);
                }
            }
        } finally {
            this._flushing = false;
        }
    }
}

export const outboxManager = new OutboxManager();
