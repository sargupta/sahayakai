import express, { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { z } from 'zod';
import { SessionManager } from './session-manager';
import { Antiban } from './antiban';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const PORT = Number(process.env.PORT ?? 8081);
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_KEY) {
    log.error('INTERNAL_API_KEY is required');
    process.exit(1);
}

const sessions = new SessionManager(log);
const antiban = new Antiban({
    minDelayMs: Number(process.env.MIN_DELAY_MS ?? 4000),
    maxDelayMs: Number(process.env.MAX_DELAY_MS ?? 12000),
    dailyCap: Number(process.env.DAILY_CAP ?? 80),
});

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health') return next();
    if (req.header('x-internal-key') !== INTERNAL_KEY) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    next();
});

app.get('/health', (_req, res) => res.json({ ok: true, sessions: sessions.count() }));

const PairBody = z.object({ teacherUid: z.string().min(1), phoneNumber: z.string().min(8) });
app.post('/pair', async (req, res) => {
    const parsed = PairBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const code = await sessions.requestPairingCode(parsed.data.teacherUid, parsed.data.phoneNumber);
        res.json({ pairingCode: code });
    } catch (err) {
        log.error({ err }, 'pair failed');
        res.status(500).json({ error: 'pair_failed' });
    }
});

app.get('/status/:teacherUid', (req, res) => {
    res.json(sessions.status(req.params.teacherUid));
});

const SendBody = z.object({
    teacherUid: z.string().min(1),
    to: z.string().min(8),
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(['image', 'audio', 'document', 'video']).optional(),
    caption: z.string().optional(),
});
app.post('/send', async (req, res) => {
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { teacherUid } = parsed.data;
    const cap = await antiban.check(teacherUid);
    if (!cap.allowed) {
        res.status(429).json({ error: 'daily_cap_reached', remaining: cap.remaining });
        return;
    }
    try {
        await antiban.delay();
        const msg = await sessions.send(parsed.data);
        await antiban.record(teacherUid);
        res.json({ ok: true, id: msg.key.id });
    } catch (err) {
        log.error({ err, teacherUid }, 'send failed');
        res.status(500).json({ error: 'send_failed' });
    }
});

app.post('/logout/:teacherUid', async (req, res) => {
    await sessions.logout(req.params.teacherUid);
    res.json({ ok: true });
});

const server = app.listen(PORT, () => log.info({ port: PORT }, 'baileys-worker listening'));

const shutdown = async (sig: string) => {
    log.info({ sig }, 'shutting down');
    server.close();
    await sessions.shutdown();
    process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
