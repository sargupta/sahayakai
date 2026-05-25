import Redis from 'ioredis';

/**
 * Lightweight antiban guardrails for Baileys.
 * - Daily cap per teacherUid (default 80 msgs/day)
 * - Randomised delay between sends with Gaussian-ish jitter
 *
 * Production hardening (not yet implemented here, see plan):
 *  - reply-ratio tracking (warn if <10%)
 *  - circuit-breaker on 403/disconnect
 *  - cooldown windows that pause sends during user's sleeping hours
 */
export class Antiban {
    private redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

    constructor(private opts: { minDelayMs: number; maxDelayMs: number; dailyCap: number }) {}

    private dayKey(teacherUid: string): string {
        const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        return `wa:cap:${teacherUid}:${day}`;
    }

    async check(teacherUid: string): Promise<{ allowed: boolean; remaining: number }> {
        const used = Number((await this.redis.get(this.dayKey(teacherUid))) ?? 0);
        const remaining = Math.max(0, this.opts.dailyCap - used);
        return { allowed: remaining > 0, remaining };
    }

    async record(teacherUid: string): Promise<void> {
        const key = this.dayKey(teacherUid);
        const used = await this.redis.incr(key);
        if (used === 1) {
            // expire ~36h to be safe across timezones
            await this.redis.expire(key, 60 * 60 * 36);
        }
    }

    async delay(): Promise<void> {
        const { minDelayMs, maxDelayMs } = this.opts;
        // Roughly Gaussian via sum-of-uniforms
        const r = (Math.random() + Math.random() + Math.random()) / 3;
        const ms = Math.floor(minDelayMs + r * (maxDelayMs - minDelayMs));
        await new Promise(r2 => setTimeout(r2, ms));
    }
}
