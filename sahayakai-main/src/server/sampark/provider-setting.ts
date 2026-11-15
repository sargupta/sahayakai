/**
 * The school's calling provider: what the console shows (provider, prices, the estimate's
 * starting number of families) and the admin's change.
 *
 * The school decides, by budget, between ElevenLabs Calls and Vobiz Calls. Every Riya call path
 * reads the stored choice (`selectedProvider` in conversation.ts); a change is audited
 * (`school.conversation_provider`), refuses a provider this deployment has not set up, and pauses
 * a running class-wide batch on its next tick (PROVIDER_CHANGED) until a person resumes it.
 */

import type { RealConversationProvider } from '@/lib/sampark/conversation/types';
import { providerChooserEnabled } from '@/lib/sampark/provider-choice';
import { ESTIMATE_DEFAULTS } from '@/lib/sampark/provider-pricing';
import type { SamparkSchool } from '@/types/sampark';
import { conflict } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { PROVIDER_DIFFERENCES, providerOptions, schoolProvider, type ProviderOption } from '@/server/sampark/conversation';
import { getSchoolOrThrow, setConversationProvider } from '@/server/sampark/school';

type Env = Record<string, string | undefined>;

export interface SchoolProviderView {
    /** The school's provider (missing = ElevenLabs, the reference). */
    provider: RealConversationProvider;
    /** False until an admin has explicitly chosen (the default is then in force). */
    chosen: boolean;
    options: (Pick<ProviderOption, 'id' | 'available' | 'price'> & { differences: string[] })[];
    /** Starting values for the monthly estimate on the card. */
    estimateDefaults: { families: number; callsPerFamilyPerMonth: number; minutesPerCall: number };
    /** The internal demo chooser is on: a session choice may override the school here. */
    demoChooser: boolean;
}

export function providerView(school: SamparkSchool, families: number, env: Env = process.env): SchoolProviderView {
    return {
        provider: schoolProvider(school),
        chosen: school.conversationProvider === 'elevenlabs' || school.conversationProvider === 'vobiz',
        // Problems are names of missing settings: useful to operators, never shown to schools.
        options: providerOptions(env).map((o) => ({ id: o.id, available: o.available, price: o.price, differences: PROVIDER_DIFFERENCES[o.id] })),
        estimateDefaults: { families, ...ESTIMATE_DEFAULTS },
        demoChooser: providerChooserEnabled(env),
    };
}

export async function getSchoolProvider(ctx: SamparkCtx, orgId: string, env: Env = process.env): Promise<SchoolProviderView> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const families = (await ctx.repo.listGuardians(orgId)).length;
    return providerView(school, families, env);
}

/** Refuse a provider this deployment cannot run (never stored, never dialled). */
export function assertProviderAvailable(provider: RealConversationProvider, env: Env = process.env): void {
    const option = providerOptions(env).find((o) => o.id === provider);
    if (!option?.available) throw conflict('PROVIDER_NOT_AVAILABLE', 'This calling provider is not set up for this deployment yet');
}

export async function changeSchoolProvider(ctx: SamparkCtx, orgId: string, uid: string, provider: RealConversationProvider, env: Env = process.env): Promise<SchoolProviderView> {
    assertProviderAvailable(provider, env);
    const school = await setConversationProvider(ctx, orgId, uid, provider);
    const families = (await ctx.repo.listGuardians(orgId)).length;
    return providerView(school, families, env);
}
