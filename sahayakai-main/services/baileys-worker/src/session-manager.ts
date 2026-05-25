import {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    type WASocket,
    type WAMessageContent,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import type { Logger } from 'pino';
import path from 'path';
import fs from 'fs/promises';

/**
 * Per-teacher Baileys session. Auth state is persisted to disk
 * (mounted volume in Docker / GCS-backed PD in Cloud Run).
 *
 * Production note: swap useMultiFileAuthState for a Redis-backed
 * implementation (see hbinduni/baileys-redis-auth) when running
 * stateless on Cloud Run. Disk works fine for the local-dev VM.
 */

interface SendArgs {
    teacherUid: string;
    to: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'document' | 'video';
    caption?: string;
}

interface SessionEntry {
    sock: WASocket;
    state: 'connecting' | 'open' | 'closed';
}

const AUTH_ROOT = process.env.AUTH_ROOT ?? '/app/auth';

export class SessionManager {
    private sessions = new Map<string, SessionEntry>();
    constructor(private log: Logger) {}

    count() { return this.sessions.size; }

    status(teacherUid: string) {
        const s = this.sessions.get(teacherUid);
        return { teacherUid, state: s?.state ?? 'closed' };
    }

    async requestPairingCode(teacherUid: string, phoneNumber: string): Promise<string> {
        const sock = await this.ensureSocket(teacherUid);
        // strip + and non-digits per Baileys requirement
        const cleaned = phoneNumber.replace(/[^\d]/g, '');
        if (sock.authState.creds.registered) {
            throw new Error('already_registered');
        }
        return await sock.requestPairingCode(cleaned);
    }

    async send(args: SendArgs) {
        const sock = await this.ensureSocket(args.teacherUid);
        const jid = this.toJid(args.to);
        const content = this.buildContent(args);
        // Simulate typing — see antiban guidance
        await sock.sendPresenceUpdate('composing', jid).catch(() => {});
        return await sock.sendMessage(jid, content);
    }

    async logout(teacherUid: string) {
        const s = this.sessions.get(teacherUid);
        if (!s) return;
        await s.sock.logout().catch(() => {});
        this.sessions.delete(teacherUid);
        await fs.rm(this.authDir(teacherUid), { recursive: true, force: true });
    }

    async shutdown() {
        for (const [, s] of this.sessions) {
            await s.sock.end(undefined).catch(() => {});
        }
        this.sessions.clear();
    }

    // ───────── internals ─────────

    private authDir(teacherUid: string) { return path.join(AUTH_ROOT, teacherUid); }

    private async ensureSocket(teacherUid: string): Promise<WASocket> {
        const existing = this.sessions.get(teacherUid);
        if (existing && existing.state !== 'closed') return existing.sock;

        const dir = this.authDir(teacherUid);
        await fs.mkdir(dir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(dir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['SahayakAI', 'Chrome', '120.0.0'],
        });
        const entry: SessionEntry = { sock, state: 'connecting' };
        this.sessions.set(teacherUid, entry);

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
            if (connection === 'open') {
                entry.state = 'open';
                this.log.info({ teacherUid }, 'wa connected');
            } else if (connection === 'close') {
                entry.state = 'closed';
                const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut;
                this.log.warn({ teacherUid, code, loggedOut }, 'wa disconnected');
                this.sessions.delete(teacherUid);
                // Reconnect only if not explicitly logged out
                if (!loggedOut) {
                    setTimeout(() => void this.ensureSocket(teacherUid).catch(() => {}), 3000);
                }
            }
        });
        return sock;
    }

    private toJid(phone: string): string {
        const cleaned = phone.replace(/[^\d]/g, '');
        return `${cleaned}@s.whatsapp.net`;
    }

    private buildContent(args: SendArgs): WAMessageContent {
        if (args.mediaUrl && args.mediaType) {
            const url = { url: args.mediaUrl };
            switch (args.mediaType) {
                case 'image':    return { image: url, caption: args.caption };
                case 'audio':    return { audio: url, ptt: true } as WAMessageContent;
                case 'video':    return { video: url, caption: args.caption };
                case 'document': return { document: url, mimetype: 'application/pdf', caption: args.caption };
            }
        }
        return { text: args.text ?? '' };
    }
}
