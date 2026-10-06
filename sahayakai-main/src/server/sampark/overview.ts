/**
 * The console's landing numbers (SamparkOverview): school, whether the calling
 * window is open right now (routine purposes — ptm_invite is the reference
 * routine spec), guardians by language and consent, today's calls (IST), active
 * campaigns and the last import. `school.liveDialAvailable` says whether this
 * deployment can place Test-mode calls at all; only the test phone's last four
 * digits are ever included.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { istDateString } from '@/lib/sampark/closure';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import type { CampaignStatus, ParentLanguage, SamparkOverview } from '@/types/sampark';
import { effectiveLanguage, isActiveSuppression } from '@/server/sampark/guardians';
import { liveDialBlocker } from '@/server/sampark/carrier';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

const ACTIVE_CAMPAIGN: CampaignStatus[] = ['rendering', 'scheduled', 'dispatching'];

export async function getOverview(ctx: SamparkCtx, orgId: string): Promise<SamparkOverview> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const now = ctx.clock.now();
    const verdict = samparkWindowVerdict(school, purposeSpec('ptm_invite'), now);

    const [guardians, suppressions, calls, campaigns, lastImport] = await Promise.all([
        ctx.repo.listGuardians(orgId),
        ctx.repo.listSuppressions(orgId),
        ctx.repo.listCalls(orgId, { limit: 1000 }),
        ctx.repo.listCampaigns(orgId, 200),
        ctx.repo.getLatestImportRun(orgId),
    ]);
    const active = guardians.filter((g) => g.active);
    const prefs = await ctx.repo.getPreferences(orgId, active.map((g) => g.id));
    const suppressed = new Set(suppressions.filter(isActiveSuppression).map((s) => s.phoneHash));

    const byLanguage: Record<ParentLanguage | 'unknown', number> = { English: 0, Hindi: 0, Bengali: 0, Nepali: 0, unknown: 0 };
    let withNoticesConsent = 0;
    let suppressedCount = 0;
    for (const g of active) {
        const p = prefs.get(g.id);
        byLanguage[effectiveLanguage(g, p) ?? 'unknown'] += 1;
        if (p?.consent.notices?.status === 'granted') withNoticesConsent += 1;
        if (suppressed.has(g.phoneHash)) suppressedCount += 1;
    }

    const today = istDateString(now);
    const todays = calls.filter((c) => istDateString(new Date(c.createdAt)) === today);

    return {
        school: {
            orgId: school.orgId,
            displayName: school.displayName,
            mode: school.mode,
            isDemo: school.isDemo,
            callingWindow: school.callingWindow,
            crm: school.crm,
            liveDialAvailable: liveDialBlocker() === null,
            testPhoneLast4: school.testPhoneLast4 ?? null,
        },
        windowOpenNow: verdict.allowed,
        nextWindowOpensAt: verdict.allowed ? null : verdict.nextAllowedAt?.toISOString() ?? null,
        guardians: { total: active.length, byLanguage, withNoticesConsent, suppressed: suppressedCount },
        today: {
            calls: todays.length,
            heardKeyFact: todays.filter((c) => c.outcome.heard === 'full' || c.outcome.confirmed || c.outcome.declined).length,
            confirmedYes: todays.filter((c) => c.outcome.confirmed).length,
            optOuts: todays.filter((c) => c.outcome.optOut !== 'none').length,
        },
        activeCampaigns: campaigns.filter((c) => ACTIVE_CAMPAIGN.includes(c.status)).length,
        lastImport: lastImport
            ? { id: lastImport.id, status: lastImport.status, finishedAt: lastImport.finishedAt, counts: lastImport.counts }
            : null,
    };
}
