/**
 * Shared builders for the Sampark voice-runtime tests. Not a test file (no
 * `.test.`), so jest only loads it when a test imports it.
 *
 * The world they build: one school in TEST mode, one PTM campaign that is
 * dispatching, one intent claimed for dial, and one call in 'dialing' to the
 * school's test phone — exactly what the dispatcher leaves behind after Vobiz
 * accepted the call. Clips are rendered from the real call scripts and stored
 * with a verification status the test chooses, so the clip-lookup path the
 * webhooks use is the production one.
 *
 * Instants (IST is the only clock that matters):
 *   WED_11_IST  2026-10-07 11:00 IST (Wednesday) — inside every routine window
 *   WED_23_IST  2026-10-07 23:00 IST — outside every window, emergency included
 */

import { emptyCounts } from '@/lib/sampark/dispatch/counts';
import { languageInfo } from '@/lib/sampark/languages';
import type { AudioStore, AuditEntry, Clock, SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { audienceLabelFor, renderNoticeScript } from '@/lib/sampark/scripts/render';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import { buildMulawWav } from '@/lib/sampark/speech/wav';
import { _resetSamparkVoiceKeyCacheForTest } from '@/lib/sampark/voice/tokens';
import type { Campaign, ClipKind, Intent, RenderedClip, SamparkCall, SamparkSchool } from '@/types/sampark';

export const ORG = 'hillview-demo';
export const CALL_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';
export const INTENT_ID = 'abcdabcdabcdabcdabcdabcdabcdabcd';
export const CAMPAIGN_ID = 'camp-ptm';
export const BASE_URL = 'https://sampark.example.test';
export const SIGNING_KEY = 'sampark-voice-test-signing-key-0123456789abcdef';
export const WED_11_IST = new Date('2026-10-07T05:30:00Z');
export const WED_23_IST = new Date('2026-10-07T17:30:00Z');
export const FAR_FUTURE = '2027-12-31T18:29:59.999Z';
export const VOBIZ_CALL_UUID = 'vobiz-leg-0001';

/** The flags a Test-mode deployment runs with. Called in beforeEach so a test that flips one cannot leak. */
export function setVoiceEnv(overrides: Partial<Record<string, string | undefined>> = {}): void {
    const env: Record<string, string | undefined> = {
        SAMPARK_ENABLED: 'true',
        SAMPARK_LIVE_DIAL_ENABLED: 'true',
        SAMPARK_PUBLIC_BASE_URL: BASE_URL,
        SAHAYAKAI_REQUEST_SIGNING_KEY: SIGNING_KEY,
        ...overrides,
    };
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    _resetSamparkVoiceKeyCacheForTest();
}

export interface TestClock extends Clock {
    set(at: Date | string): void;
}

export function testClock(start: Date | string = WED_11_IST): TestClock {
    let t = new Date(start).getTime();
    return {
        now: () => new Date(t),
        set: (at) => {
            t = new Date(at).getTime();
        },
    };
}

export function testSchool(overrides: Partial<SamparkSchool> = {}): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview Demo School', Hindi: 'हिलव्यू डेमो स्कूल', Bengali: 'হিলভিউ ডেমো স্কুল', Nepali: 'हिलभ्यू डेमो स्कूल' },
        displayName: 'Hillview Demo School',
        mode: 'test',
        isDemo: false,
        callingWindow: { startHour: 10, endHour: 20, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        testPhoneEnc: 'enc:test-phone',
        testPhoneLast4: '4321',
        testPhoneHash: 'hash:test-phone',
        crm: null,
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

export function testCampaign(overrides: Partial<Campaign> = {}): Campaign {
    return {
        id: CAMPAIGN_ID,
        orgId: ORG,
        purpose: 'ptm_invite',
        facts: { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'school_hall' },
        audience: { sections: [{ grade: 7, section: 'B' }] },
        status: 'dispatching',
        notBefore: null,
        expiresAt: FAR_FUTURE,
        createdBy: 'dev-user-123',
        createdAt: '2026-10-01T00:00:00.000Z',
        approvedBy: 'dev-user-123',
        approvedAt: '2026-10-01T00:00:00.000Z',
        renderProgress: { done: 0, total: 0, failures: [] },
        counts: emptyCounts(),
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
    };
}

export function testIntent(overrides: Partial<Intent> = {}): Intent {
    return {
        id: INTENT_ID,
        dedupeKey: `campaign:${CAMPAIGN_ID}:guardian:g001`,
        orgId: ORG,
        campaignId: CAMPAIGN_ID,
        purpose: 'ptm_invite',
        guardianId: 'g001',
        studentIds: ['s001'],
        language: 'English',
        status: 'approved',
        blockReason: null,
        attempts: 0,
        maxAttempts: 3,
        notBefore: null,
        expiresAt: FAR_FUTURE,
        lastCallId: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
    };
}

export function testCall(overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id: CALL_ID,
        orgId: ORG,
        intentId: INTENT_ID,
        campaignId: CAMPAIGN_ID,
        purpose: 'ptm_invite',
        guardianId: 'g001',
        phoneHash: 'hash:test-phone',
        phoneLast4: '4321',
        language: 'English',
        variant: 'default',
        attempt: 1,
        state: 'dialing',
        leaseUntil: '2026-10-07T05:45:00.000Z',
        carrier: 'vobiz',
        destination: 'test_phone',
        providerCallId: 'request-uuid-0001',
        vobizCallUuid: null,
        settledAt: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds: 20,
        createdAt: '2026-10-07T05:29:00.000Z',
        updatedAt: '2026-10-07T05:29:00.000Z',
        endedAt: null,
        failureReason: null,
        ...overrides,
    };
}

export type ClipFate = RenderedClip['verification']['status'] | 'missing';

/** In-memory AudioStore. */
export function memoryStore(): AudioStore & { keys(): string[] } {
    const blobs = new Map<string, { audio: Buffer; mimeType: string }>();
    return {
        async put(key, audio, mimeType) {
            blobs.set(key, { audio: Buffer.from(audio), mimeType });
        },
        async get(key) {
            return blobs.get(key) ?? null;
        },
        async exists(key) {
            return blobs.has(key);
        },
        keys: () => [...blobs.keys()],
    };
}

/** The clip key of each kind for this school / campaign / call, as the webhooks will look it up. */
export function clipKeysFor(school: SamparkSchool, campaign: Campaign, call: Pick<SamparkCall, 'language' | 'variant'>): Partial<Record<ClipKind, string>> {
    const script = renderNoticeScript({
        purpose: campaign.purpose,
        facts: campaign.facts,
        school,
        language: call.language,
        variant: call.variant,
        audience: audienceLabelFor(campaign),
    });
    const speech = languageInfo(call.language).speech;
    return Object.fromEntries(script.clips.map((c) => [c.kind, clipKey(speech, c.text)]));
}

/** Store every clip of the call's script; `fate(kind)` decides its verification status (or leaves it out). */
export async function seedClips(
    repo: SamparkRepo,
    store: AudioStore,
    school: SamparkSchool,
    campaign: Campaign,
    call: Pick<SamparkCall, 'language' | 'variant'>,
    fate: (kind: ClipKind) => ClipFate = () => 'passed',
): Promise<Partial<Record<ClipKind, string>>> {
    const script = renderNoticeScript({
        purpose: campaign.purpose,
        facts: campaign.facts,
        school,
        language: call.language,
        variant: call.variant,
        audience: audienceLabelFor(campaign),
    });
    const speech = languageInfo(call.language).speech;
    const keys: Partial<Record<ClipKind, string>> = {};
    for (const c of script.clips) {
        const key = clipKey(speech, c.text);
        keys[c.kind] = key;
        const status = fate(c.kind);
        if (status === 'missing') continue;
        await repo.saveClip({
            key,
            orgId: school.orgId,
            campaignId: campaign.id,
            purpose: campaign.purpose,
            language: call.language,
            variant: call.variant,
            kind: c.kind,
            text: c.text,
            engine: speech.engine,
            voice: speech.voice,
            model: speech.model ?? '',
            languageCode: speech.ttsLanguageCode,
            durationSeconds: 2,
            verification: { status, transcript: status === 'skipped' ? null : c.text, similarity: status === 'skipped' ? null : 0.99, checkedAt: '2026-10-01T00:00:00.000Z' },
            createdAt: '2026-10-01T00:00:00.000Z',
        });
        // 0.25 s of a recognisable μ-law pattern, so a test can tell the PCM output came from this clip.
        await store.put(key, buildMulawWav(Buffer.alloc(2000, 0x7f)), 'audio/wav');
    }
    return keys;
}

export interface World {
    repo: SamparkRepo;
    store: ReturnType<typeof memoryStore>;
    clock: TestClock;
    school: SamparkSchool;
    campaign: Campaign;
    keys: Partial<Record<ClipKind, string>>;
    audits: AuditEntry[];
}

/**
 * A dispatched Test-mode call waiting to be answered. The call is written through
 * claimIntentForDial, as the dispatcher writes it, so the intent is 'dialing' on it.
 */
export async function world(opts: {
    school?: Partial<SamparkSchool>;
    campaign?: Partial<Campaign>;
    call?: Partial<SamparkCall>;
    clips?: (kind: ClipKind) => ClipFate;
    clock?: Date | string;
} = {}): Promise<World> {
    const repo = createMemorySamparkRepo();
    const store = memoryStore();
    const clock = testClock(opts.clock ?? WED_11_IST);
    const school = testSchool(opts.school);
    const campaign = testCampaign(opts.campaign);
    await repo.upsertSchool(school);
    await repo.createCampaign(campaign);
    await repo.createIntentIfAbsent(testIntent());
    const call = testCall({ ...opts.call, state: 'dialing' });
    const claimed = await repo.claimIntentForDial(ORG, INTENT_ID, call, new Date(call.createdAt));
    if (claimed !== 'claimed') throw new Error('fixture: claim failed');
    if (opts.call?.state && opts.call.state !== 'dialing') await repo.updateCall(ORG, CALL_ID, { state: opts.call.state });
    const keys = await seedClips(repo, store, school, campaign, call, opts.clips);
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (orgId, entry) => {
        audits.push(entry);
        await original(orgId, entry);
    };
    return { repo, store, clock, school, campaign, keys, audits };
}

// ── Reading the XML we return ───────────────────────────────────────────────

function unescapeXml(s: string): string {
    return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Every <Play> URL, in order, unescaped. */
export function playUrls(xml: string): string[] {
    return [...xml.matchAll(/<Play>([^<]*)<\/Play>/g)].map((m) => unescapeXml(m[1]));
}

/** The Gather action URL, unescaped, or null. */
export function gatherAction(xml: string): string | null {
    const m = xml.match(/<Gather action="([^"]*)"/);
    return m ? unescapeXml(m[1]) : null;
}

/** The `t` query parameter of a URL we built. */
export function tokenOf(url: string): string {
    const t = new URL(url).searchParams.get('t');
    if (!t) throw new Error(`no token in ${url}`);
    return t;
}
