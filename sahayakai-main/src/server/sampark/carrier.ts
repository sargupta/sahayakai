/**
 * Carrier selection (contract §5; phase 2a contract §3). The ONLY place a Sampark carrier is chosen.
 *
 *   practice → the simulated carrier (no network, deterministic per call id)
 *   test     → the Vobiz notice carrier, which rings only the school's test phone.
 *              Refused (409) unless this deployment can place real calls:
 *              SAMPARK_LIVE_DIAL_ENABLED exactly 'true', SAMPARK_PUBLIC_BASE_URL an
 *              https origin, a Vobiz configuration (LIVE_DIAL_DISABLED /
 *              PUBLIC_BASE_URL_MISSING / CARRIER_UNCONFIGURED) — and unless the school
 *              has a test phone (TEST_PHONE_MISSING).
 *   live     → refused with LIVE_MODE_NOT_AVAILABLE: no parent is dialled on a real
 *              carrier in phase 2a, whatever the flags say.
 *
 * The dispatcher refuses live mode and a missing test phone on its own as well,
 * and the Vobiz carrier refuses any call not addressed to the test phone, so no
 * single slip here can ring a parent.
 *
 * This module constructs a carrier; only the dispatcher ever calls `place`
 * (class gate 2).
 */

import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier';
import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';
import { mintSamparkVoiceToken } from '@/lib/sampark/voice/tokens';
import { readVobizConfig } from '@/lib/vobiz/client';
import type { Carrier } from '@/lib/sampark/ports';
import type { CarrierKind, LiveDialBlocker, SamparkSchool } from '@/types/sampark';
import { conflict } from '@/server/sampark/errors';

export const LIVE_DIAL_DISABLED = 'LIVE_DIAL_DISABLED';

export function liveDialEnabled(): boolean {
    return process.env.SAMPARK_LIVE_DIAL_ENABLED === 'true';
}

/**
 * The origin Vobiz calls back on (answer, keypad, status, audio). Taken ONLY from
 * SAMPARK_PUBLIC_BASE_URL, never from a request's Host header (plan §16 row 21).
 * Null unless it is a plain https origin.
 */
export function samparkPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    const raw = env.SAMPARK_PUBLIC_BASE_URL?.trim();
    if (!raw) return null;
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
        if (url.pathname !== '/' && url.pathname !== '') return null;
        return url.origin;
    } catch {
        return null;
    }
}

export type { LiveDialBlocker };

/** Why this deployment cannot place real (Test-mode) calls, or null when it can. */
export function liveDialBlocker(env: NodeJS.ProcessEnv = process.env): LiveDialBlocker | null {
    if (env.SAMPARK_LIVE_DIAL_ENABLED !== 'true') return 'LIVE_DIAL_DISABLED';
    if (!samparkPublicBaseUrl(env)) return 'PUBLIC_BASE_URL_MISSING';
    if (!readVobizConfig(env)) return 'CARRIER_UNCONFIGURED';
    return null;
}

/**
 * Riya (ElevenLabs) is set up to place real Test-mode calls on this deployment: Riya and live
 * dialling on, the agent's key, id and number id present, and an allow-list of test numbers set.
 * Riya needs no Vobiz account or public callback URL (the agent's SIP trunk dials). Presence only:
 * conversation.ts validates the configuration and applies every Riya refusal on each call (and is
 * the only importer of the ElevenLabs client, riya-gates.test.ts).
 */
export function riyaTestDialReady(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.SAMPARK_ELEVENLABS_ENABLED === 'true'
        && env.SAMPARK_LIVE_DIAL_ENABLED === 'true'
        && ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_AGENT_PHONE_NUMBER_ID'].every((k) => Boolean(env[k]?.trim()))
        && Boolean(env.SAMPARK_RIYA_TEST_ALLOWED_NUMBERS?.trim());
}

/**
 * Why a school may not switch to Test mode: null when either real path can dial (Vobiz notices or
 * Riya). Notice calls are unaffected: `carrierKindFor` still refuses them without Vobiz.
 */
export function testModeBlocker(env: NodeJS.ProcessEnv = process.env): LiveDialBlocker | null {
    const blocker = liveDialBlocker(env);
    return blocker && riyaTestDialReady(env) ? null : blocker;
}

export const TEST_PHONE_MISSING = 'TEST_PHONE_MISSING';
export const LIVE_MODE_NOT_AVAILABLE = 'LIVE_MODE_NOT_AVAILABLE';

const BLOCKER_MESSAGE: Record<LiveDialBlocker, string> = {
    LIVE_DIAL_DISABLED: 'Live dialling is disabled for this deployment',
    PUBLIC_BASE_URL_MISSING: 'This deployment has no public https address for call callbacks',
    CARRIER_UNCONFIGURED: 'The calling provider is not configured for this deployment',
};

/**
 * Which carrier WOULD place a call for this school. Throws a 409 for any school that
 * cannot dial: live mode always; test mode while the deployment cannot place real
 * calls or the school has no test phone.
 */
export function carrierKindFor(school: SamparkSchool): CarrierKind {
    if (school.mode === 'practice') return 'simulated';
    if (school.mode === 'test') {
        const blocker = liveDialBlocker();
        if (blocker) throw conflict(blocker, BLOCKER_MESSAGE[blocker]);
        if (!school.testPhoneEnc || !school.testPhoneHash) {
            throw conflict(TEST_PHONE_MISSING, 'Test mode needs a test phone number for this school');
        }
        return 'vobiz';
    }
    throw conflict(LIVE_MODE_NOT_AVAILABLE, 'Live mode is not available in this release');
}

export function carrierFor(school: SamparkSchool): Carrier {
    if (carrierKindFor(school) === 'simulated') return createSimulatedCarrier();
    // carrierKindFor has already refused unless both are present; re-read rather than assert.
    const config = readVobizConfig();
    const publicBaseUrl = samparkPublicBaseUrl();
    if (!config) throw conflict('CARRIER_UNCONFIGURED', BLOCKER_MESSAGE.CARRIER_UNCONFIGURED);
    if (!publicBaseUrl) throw conflict('PUBLIC_BASE_URL_MISSING', BLOCKER_MESSAGE.PUBLIC_BASE_URL_MISSING);
    return createVobizNoticeCarrier({ config, publicBaseUrl, mintToken: mintSamparkVoiceToken });
}

/**
 * For dry runs (audience summaries): the carrier kind the gate should assume.
 * A school whose mode cannot dial yet is evaluated as if a real carrier would
 * be used, so the summary shows `mode_forbids_dialing` instead of throwing.
 */
export function carrierKindForDryRun(school: SamparkSchool): CarrierKind {
    try {
        return carrierKindFor(school);
    } catch {
        return 'vobiz';
    }
}
