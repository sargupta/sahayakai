/**
 * POST /api/community/persona-pulse
 *
 * Demo-only endpoint that mints one in-character message from a random
 * teacher persona and writes it to `community_chat`. Called by the
 * `useCommunityLivePulse` hook on a 3-5 min interval while the /community
 * page is open during the NCERT demo.
 *
 * Auth: any signed-in user. No plan check — this is demo infra.
 *
 * Request body:
 *   { recentMessages?: Array<{ authorName: string; text: string }> }
 *
 * Response:
 *   { message, personaName, personaState, personaSubject }
 *
 * Safety:
 *   - Hard-cap on output length (180 chars enforced by the flow's prompt).
 *   - Temperature 0.85, max 150 tokens → predictable cost (~$0.0002/call).
 *   - All writes are tagged `isDemoPersona: true` so they're trivially filterable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  COMMUNITY_PERSONAS,
  pickRandomPersona,
  getPersonaById,
} from '@/ai/data/community-personas';
import type { RecentMessageContext } from '@/ai/flows/community-persona-message';
import { dispatchCommunityPersonaMessage } from '@/lib/sidecar/community-persona-message-dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  recentMessages?: RecentMessageContext[];
  /** Optional explicit persona id — if omitted, a random one is chosen. */
  personaId?: string;
  /** Optional mode override — 'auto' by default. */
  mode?: 'reply' | 'fresh' | 'auto';
}

export async function POST(req: NextRequest) {
  // 1. Auth check — middleware injects x-user-id when the Bearer token is valid.
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1a. Feature flag gate. Demo-only seeded personas may be killed in prod
  // once real-teacher volume on /community warrants. Flag default is ON
  // (preserves current behavior). To kill: set
  //   system_config/feature_flags.features.communityPersonas.enabled = false
  // in Firestore. The useCommunityLivePulse hook treats 503 as a
  // stop-polling signal. See docs/operations/FEATURE_FLAGS.md.
  const flag = await isFeatureEnabled('communityPersonas', userId);
  if (!flag.enabled) {
    return NextResponse.json(
      { error: 'Feature disabled', reason: flag.reason },
      { status: 503 },
    );
  }

  // 2. Parse body (tolerant — empty body is valid).
  let body: RequestBody = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. Pick persona — caller can override but default is random.
  const persona = body.personaId
    ? getPersonaById(body.personaId) ?? pickRandomPersona()
    : pickRandomPersona();

  // 4. Sanitize recentMessages input (trust the client only enough to use as
  //    LLM context; cap length and count so a malicious payload can't blow up
  //    the prompt budget).
  const recent = (body.recentMessages ?? [])
    .slice(-5)
    .filter((m) => typeof m?.authorName === 'string' && typeof m?.text === 'string')
    .map((m) => ({
      authorName: String(m.authorName).slice(0, 80),
      text: String(m.text).slice(0, 400),
    }));

  // 5. Generate + write.
  //
  // Routes through the sidecar dispatcher so the
  // `communityPersonaMessageSidecarMode` flag controls shadow/canary/full
  // routing (and shadow_diffs land in Firestore for parity scoring).
  // The dispatcher always returns the Genkit response on the user-facing
  // path in `off`/`shadow` modes — same behaviour as the previous
  // direct-call code — but additionally fires the sidecar in shadow so
  // we can score parity. In `off` mode the dispatcher just proxies to
  // `generateCommunityPersonaMessage`, so this remains a strict
  // superset of the original behaviour.
  try {
    const dispatched = await dispatchCommunityPersonaMessage({
      persona,
      recentMessages: recent,
      mode: body.mode ?? 'auto',
      userId,
    });
    const out = { message: dispatched.message };

    const db = await getDb();
    const docId = `persona_live_${Date.now()}_${persona.id.replace('persona_', '')}`;
    // Preview env (DEMO_MODE=true) routes persona writes to a separate
    // collection so prod /community readers don't see preview QA noise.
    // Prod (DEMO_MODE unset or != 'true') writes to the canonical
    // community_chat collection. Strict string equality is intentional —
    // anything other than the literal 'true' falls through to prod.
    // See docs/operations/PREVIEW_ENV.md for the DEMO_MODE contract.
    const targetCollection =
      process.env.DEMO_MODE === 'true' ? 'community_chat_preview' : 'community_chat';
    await db.collection(targetCollection).doc(docId).set({
      text: out.message,
      authorId: persona.id,
      authorName: persona.displayName,
      authorPhotoURL: null,
      createdAt: Timestamp.now(),
      isDemoPersona: true,
      personaState: persona.state,
      personaSubject: persona.subject,
      // Marker for downstream cleanup — distinguishes seed vs live-pulse:
      personaSource: 'live_pulse',
    });

    return NextResponse.json({
      ok: true,
      message: out.message,
      personaId: persona.id,
      personaName: persona.displayName,
      personaState: persona.state,
      personaSubject: persona.subject,
      docId,
    });
  } catch (err) {
    // Classify before responding. The agents sidecar returns 503 on Gemini
    // quota (429 RESOURCE_EXHAUSTED) — surfaced here as a
    // CommunityPersonaMessageSidecarHttpError with .status, or a
    // *TimeoutError. These are transient AND the useCommunityLivePulse hook
    // is built to treat 503 as a stop-polling signal (see the flag note
    // above). Returning a blanket 500 here did two harmful things during the
    // 2026-06-09 quota storm: (1) paged on-call at ERROR for an expected
    // transient, and (2) kept the client polling every 3-5 min, amplifying
    // the 429 storm on the agents service. Map transient failures to 503 +
    // Retry-After (WARN), reserve 500/ERROR for genuine bugs.
    const status = typeof (err as any)?.status === 'number' ? (err as any).status : null;
    const name = String((err as any)?.name || '');
    const msg = err instanceof Error ? err.message : String(err);
    // NOTE (2026-06-11): a raw Genkit/GoogleGenerativeAI error from the `off`/
    // direct path often carries no numeric `.status`, embedding the code in the
    // message instead — e.g. "[503 Service Unavailable] This model is currently
    // experiencing high demand." The daily scan found 19 persona-pulse 500s in
    // 24h that were exactly this transient Gemini overload, misclassified as a
    // genuine bug because the regex below only matched 429/RESOURCE_EXHAUSTED/
    // timeout. Add 503/Service Unavailable/high demand/overloaded/UNAVAILABLE so
    // they correctly become a stop-polling 503 (WARN) like the shared
    // handleAIError helper now does (see src/lib/ai-error-response.ts).
    const isTransient =
      status === 503 ||
      status === 429 ||
      /TimeoutError$/.test(name) ||
      /timed out after \d+\s*ms|RESOURCE_EXHAUSTED|Resource exhausted|\b429\b|\b503\b|service unavailable|experiencing high demand|model is overloaded|\boverloaded\b|\bUNAVAILABLE\b/i.test(msg);

    if (isTransient) {
      console.warn('[persona-pulse] transient upstream failure — stop-polling 503', {
        status,
        name,
        message: msg.slice(0, 200),
      });
      return NextResponse.json(
        { error: 'Persona service is busy. Pausing live pulse.', code: 'AI_SERVICE_BUSY', retryAfterSeconds: 60 },
        { status: 503, headers: { 'Retry-After': '60' } },
      );
    }

    console.error('[persona-pulse] generation failed', err);
    // Genuine (non-transient) failure. Log the raw error above, but return a
    // generic body so the client never sees raw internal error strings.
    return NextResponse.json(
      { error: 'Failed to generate. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * GET — convenience for debugging. Returns the list of personas (no LLM call).
 */
export async function GET() {
  return NextResponse.json({
    personas: COMMUNITY_PERSONAS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      state: p.state,
      subject: p.subject,
      gradeLevel: p.gradeLevel,
      preferredLanguage: p.preferredLanguage,
    })),
  });
}
