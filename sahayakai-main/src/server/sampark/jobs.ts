/**
 * The two scheduled Sampark jobs (contract §5).
 *
 * renderJob   — for every campaign in 'rendering': render the clips its
 *               audience needs (stream C's runRenderStep, bounded per tick);
 *               when finished with no failures, materialise one intent per
 *               guardian of record (stream B) and move to 'scheduled'; any
 *               failed clip → 'render_failed' and nothing is dispatched.
 * dispatchJob — one dispatcher tick (stream B's runDispatchTick: single-flight
 *               lease, sweep, gate, claim-then-dial). The tick itself moves
 *               campaigns scheduled → dispatching → completed, expires intents
 *               past their campaign's expiry and keeps counts current; this
 *               module only supplies the carrier, the destination and the
 *               audio length.
 *
 * Both are idempotent and safe to overlap: rendering skips clips that exist
 * and runs under its own lease; the dispatcher's at-most-once guarantee is in
 * repo.claimIntentForDial.
 */

import crypto from 'node:crypto';
import os from 'node:os';

import { recomputeCampaignCounts, runDispatchTick, type DispatchReport } from '@/lib/sampark/dispatch/dispatcher';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { speechFor } from '@/lib/sampark/languages';
import { decryptPhone } from '@/lib/sampark/phone';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import { audienceLabelFor, renderNoticeScript, ScriptRenderError } from '@/lib/sampark/scripts/render';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import { runRenderStep } from '@/lib/sampark/speech/render-job';
import type { SpeechDeps } from '@/lib/sampark/repo/factory';
import { logger } from '@/lib/logger';
import type { Campaign, Intent, SamparkGuardian, SamparkSchool } from '@/types/sampark';
import { audienceLanguages, resolveCampaignAudience } from '@/server/sampark/campaigns';
import { carrierFor, carrierKindFor } from '@/server/sampark/carrier';

export const RENDER_LOCK = 'sampark-render';
const RENDER_LOCK_TTL_MS = 5 * 60 * 1000;
export const RENDER_STEP_OPTIONS = { maxClips: 24, concurrency: 2 }; // Gemini-TTS per-minute quota returned 429s at 4 (verify-voice run, 2026-09-30)
export const DISPATCH_OPTIONS = { maxDialsPerSchoolPerTick: 25, maxInFlightPerSchool: 20, leaseMs: 120_000 };

export interface JobDeps {
    repo: SamparkRepo;
    clock: Clock;
}

function holderId(kind: string): string {
    return `${kind}:${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
}

function safeMessage(err: unknown): string {
    return err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
}

// ── Render ──────────────────────────────────────────────────────────────────

export interface RenderJobReport {
    skipped: boolean;
    campaigns: number;
    clipsReady: number;
    scheduled: number;
    renderFailed: number;
    errors: string[];
}

export async function renderJob(deps: JobDeps & { speech: SpeechDeps }): Promise<RenderJobReport> {
    const { repo, clock } = deps;
    const report: RenderJobReport = { skipped: false, campaigns: 0, clipsReady: 0, scheduled: 0, renderFailed: 0, errors: [] };
    const holder = holderId('render');
    if (!(await repo.acquireLock(RENDER_LOCK, holder, clock.now(), RENDER_LOCK_TTL_MS))) {
        return { ...report, skipped: true };
    }
    try {
        for (const school of await repo.listSchools()) {
            const rendering = (await repo.listCampaigns(school.orgId, 200)).filter((c) => c.status === 'rendering');
            for (const campaign of rendering) {
                report.campaigns++;
                try {
                    await renderOne(deps, school, campaign, report);
                } catch (err) {
                    report.errors.push(`${school.orgId}/${campaign.id}: ${safeMessage(err)}`);
                    logger.error('Sampark render step failed', err, 'SAMPARK_JOBS', { orgId: school.orgId, campaignId: campaign.id });
                }
            }
        }
    } finally {
        await repo.releaseLock(RENDER_LOCK, holder);
    }
    return report;
}

async function renderOne(deps: JobDeps & { speech: SpeechDeps }, school: SamparkSchool, campaign: Campaign, report: RenderJobReport): Promise<void> {
    const { repo, clock, speech } = deps;
    const ctx = { repo, clock };
    const audience = await resolveCampaignAudience(ctx, school.orgId, campaign);
    const languages = audienceLanguages(audience, school);
    let result: { done: number; total: number; failures: string[]; finished: boolean };
    try {
        result = await runRenderStep(
            { repo, synth: speech.synth, verifier: speech.verifier, store: speech.store, clock },
            school.orgId,
            campaign.id,
            languages,
            RENDER_STEP_OPTIONS,
        );
    } catch (err) {
        // A script that cannot be said (e.g. settings changed after approval) will never
        // render on a later tick either: fail the campaign rather than retry forever.
        if (!(err instanceof ScriptRenderError)) throw err;
        result = { done: 0, total: 0, failures: [err.message], finished: true };
    }
    report.clipsReady += result.done;
    const nowIso = clock.now().toISOString();

    if (result.failures.length > 0) {
        await repo.updateCampaign(school.orgId, campaign.id, {
            status: 'render_failed',
            renderProgress: { done: result.done, total: result.total, failures: result.failures },
            updatedAt: nowIso,
        });
        await repo.appendAudit(school.orgId, {
            at: nowIso,
            actor: 'system',
            action: 'campaign.render_failed',
            target: `campaign/${campaign.id}`,
            detail: { failures: result.failures.slice(0, 20) },
        });
        report.renderFailed++;
        return;
    }
    if (!result.finished) return; // more clips next tick

    // Re-read: the campaign may have been cancelled while clips rendered.
    const current = await repo.getCampaign(school.orgId, campaign.id);
    if (!current || current.status !== 'rendering') return;
    const materialised = await materialiseCampaignIntents({ repo, clock }, current, school, carrierKindFor(school));
    const counts = await recomputeCampaignCounts(repo, school.orgId, campaign.id);
    await repo.updateCampaign(school.orgId, campaign.id, { status: 'scheduled', counts, updatedAt: clock.now().toISOString() });
    await repo.appendAudit(school.orgId, {
        at: nowIso,
        actor: 'system',
        action: 'campaign.scheduled',
        target: `campaign/${campaign.id}`,
        detail: { languages, created: materialised.created, existing: materialised.existing, blocked: materialised.blocked },
    });
    report.scheduled++;
}

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * The number a call goes to. Practice and live: the guardian's own number,
 * decrypted only here, at the moment of dialling. Test mode (every call to the
 * school's test phone) arrives in phase 2 and is refused until then.
 */
export async function destinationFor(school: SamparkSchool, guardian: SamparkGuardian): Promise<string> {
    if (school.mode === 'test') throw new Error('Test mode is not available in this release');
    return decryptPhone(guardian.phoneEnc);
}

/** Seconds of the rendered 'message' clip for this intent's language and variant, memoised per tick. */
export function makeAudioSecondsFor(repo: SamparkRepo) {
    const campaigns = new Map<string, Promise<Campaign | null>>();
    const seconds = new Map<string, Promise<number | null>>();
    return async (school: SamparkSchool, intent: Intent, variant: 'default' | 'today' | 'tomorrow'): Promise<number | null> => {
        if (!intent.campaignId) return null;
        const memoKey = `${school.orgId}|${intent.campaignId}|${intent.language}|${variant}`;
        if (!seconds.has(memoKey)) {
            seconds.set(memoKey, (async () => {
                const ck = `${school.orgId}|${intent.campaignId}`;
                if (!campaigns.has(ck)) campaigns.set(ck, repo.getCampaign(school.orgId, intent.campaignId as string));
                const campaign = await campaigns.get(ck);
                if (!campaign) return null;
                try {
                    const script = renderNoticeScript({
                        purpose: campaign.purpose,
                        facts: campaign.facts,
                        school,
                        language: intent.language,
                        variant,
                        audience: audienceLabelFor(campaign),
                    });
                    const message = script.clips.find((c) => c.kind === 'message');
                    if (!message) return null;
                    const clip = await repo.getClip(school.orgId, clipKey(speechFor(intent.language, campaign.purpose), message.text));
                    return clip ? clip.durationSeconds : null;
                } catch {
                    return null;
                }
            })());
        }
        return seconds.get(memoKey) as Promise<number | null>;
    };
}

export async function dispatchJob(deps: JobDeps): Promise<DispatchReport> {
    return runDispatchTick(
        {
            repo: deps.repo,
            clock: deps.clock,
            holder: holderId('dispatch'),
            carrierFor,
            destinationFor,
            audioSecondsFor: makeAudioSecondsFor(deps.repo),
        },
        DISPATCH_OPTIONS,
    );
}
