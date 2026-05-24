/**
 * useCommunityLivePulse — demo-only hook that periodically posts a new
 * teacher-persona message to community_chat while the user has the /community
 * page open.
 *
 * Why: NCERT walks past the Community tab during a 20-minute demo and sees a
 * *living* conversation — messages arriving every 3-5 min. Founder narrates:
 * "These are AI personas seeded for the demo; pilot launch replaces them with
 * real teachers."
 *
 * Behaviour:
 *   - Schedules a randomized 3-5 minute interval (2-3 min during the active
 *     demo window if `frequency: 'demo'` is passed).
 *   - Each tick reads the latest 5 messages from Firestore (so the LLM can
 *     reply organically), then POSTs to /api/community/persona-pulse.
 *   - First tick fires ~30 s after mount — so the founder sees a message
 *     arrive within the first minute of opening the page.
 *   - Clears interval on unmount.
 *   - Skips ticks when document.visibilityState !== 'visible' (no point
 *     paying for LLM calls if the tab is hidden).
 *   - Honors a `NEXT_PUBLIC_DEMO_PERSONAS_ENABLED` flag — if the flag is
 *     literally "false", the hook becomes a no-op (safe for production).
 *
 * Console breadcrumbs:
 *   [persona-pulse] mounted, next tick in 32s
 *   [persona-pulse] tick → Lakshmi Iyer: "..."
 *   [persona-pulse] unmount, cleared timers
 */

'use client';

import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { getAuthToken } from '@/lib/get-auth-token';

// ── Config ──────────────────────────────────────────────────────────────────
const MIN_INTERVAL_MS = 3 * 60 * 1000; // 3 min
const MAX_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEMO_MIN_INTERVAL_MS = 2 * 60 * 1000; // 2 min
const DEMO_MAX_INTERVAL_MS = 3 * 60 * 1000; // 3 min
const FIRST_TICK_DELAY_MS = 30 * 1000; // 30 s after mount

interface Options {
  /** 'demo' tightens cadence to 2-3 min for the live demo slot. Default: 'normal'. */
  frequency?: 'normal' | 'demo';
  /** Pass false to disable without unmounting. Default true. */
  enabled?: boolean;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function useCommunityLivePulse(options: Options = {}) {
  const { frequency = 'normal', enabled = true } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Production safety: env flag can hard-disable this hook everywhere.
    const flag = process.env.NEXT_PUBLIC_DEMO_PERSONAS_ENABLED;
    if (flag === 'false') {
      console.log('[persona-pulse] disabled by NEXT_PUBLIC_DEMO_PERSONAS_ENABLED=false');
      return;
    }
    if (!enabled) {
      console.log('[persona-pulse] disabled by enabled=false');
      return;
    }

    mountedRef.current = true;
    const intMin = frequency === 'demo' ? DEMO_MIN_INTERVAL_MS : MIN_INTERVAL_MS;
    const intMax = frequency === 'demo' ? DEMO_MAX_INTERVAL_MS : MAX_INTERVAL_MS;

    const fireTick = async () => {
      if (!mountedRef.current) return;

      // Skip tick if tab is hidden — no point burning LLM cost if no-one's watching.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        console.log('[persona-pulse] tick skipped — tab hidden');
      } else {
        try {
          // Pull the latest 5 messages from community_chat so the LLM has context.
          const q = query(
            collection(db, 'community_chat'),
            orderBy('createdAt', 'desc'),
            limit(5),
          );
          const snap = await getDocs(q);
          const recentMessages = snap.docs
            .map((d) => {
              const data = d.data() as { authorName?: string; text?: string };
              return { authorName: data.authorName ?? 'Teacher', text: data.text ?? '' };
            })
            .filter((m) => m.text.length > 0)
            .reverse(); // chronological order for LLM context

          // Auth: send the Bearer token so middleware will inject x-user-id.
          const token = await getAuthToken();
          if (!token) {
            console.warn('[persona-pulse] tick skipped — no auth token');
          } else {
            const res = await fetch('/api/community/persona-pulse', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ recentMessages }),
            });
            if (res.ok) {
              const data = await res.json();
              console.log(
                `[persona-pulse] tick → ${data.personaName ?? 'unknown'} (${data.personaState ?? '?'}): "${(data.message ?? '').slice(0, 60)}"`,
              );
            } else if (res.status === 503) {
              // Server has disabled the feature via
              // system_config/feature_flags.features.communityPersonas.
              // Pause polling but schedule ONE retry tick 15 minutes out so
              // the hook recovers automatically if the flag is flipped back
              // ON (without requiring a page remount). If 503 fires again
              // on the retry, another 15-min pause schedules.
              const text = await res.text().catch(() => '');
              const RETRY_AFTER_503_MS = 15 * 60 * 1000;
              console.log(
                `[persona-pulse] disabled by feature flag (503): ${text.slice(0, 200)} — pausing ${RETRY_AFTER_503_MS / 60000}min`,
              );
              if (mountedRef.current) {
                timerRef.current = setTimeout(fireTick, RETRY_AFTER_503_MS);
              }
              return;
            } else {
              const text = await res.text().catch(() => '');
              console.warn(`[persona-pulse] tick failed ${res.status}: ${text.slice(0, 200)}`);
            }
          }
        } catch (err) {
          console.warn('[persona-pulse] tick error', err);
        }
      }

      // Schedule the next tick with a fresh random interval.
      if (mountedRef.current) {
        const nextDelay = randomBetween(intMin, intMax);
        console.log(`[persona-pulse] next tick in ${Math.round(nextDelay / 1000)}s`);
        timerRef.current = setTimeout(fireTick, nextDelay);
      }
    };

    // First tick fires after a short delay — gives the page time to load,
    // and ensures the user sees a new message arrive within the first minute.
    console.log(`[persona-pulse] mounted (frequency=${frequency}), first tick in ${Math.round(FIRST_TICK_DELAY_MS / 1000)}s`);
    timerRef.current = setTimeout(fireTick, FIRST_TICK_DELAY_MS);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      console.log('[persona-pulse] unmount, cleared timers');
    };
  }, [enabled, frequency]);
}
