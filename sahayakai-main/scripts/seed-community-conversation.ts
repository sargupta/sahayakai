/**
 * Seed 50 historical community_chat messages from 10 demo teacher personas.
 *
 * Why: NCERT demo on 2026-05-20. The Community tab needs to feel "alive"
 * before any live AI tick fires. 50 messages spread across the last 24 hours
 * gives the founder a real conversation to scroll through.
 *
 * Run:
 *   cd sahayakai-main && npx tsx scripts/seed-community-conversation.ts
 *
 * Re-run safety: the script writes WITH explicit IDs so a second run is
 * idempotent — re-running replaces (overwrites) the same 50 docs rather than
 * doubling them. Pass `--purge` to delete all `persona_seed_*` docs first.
 *
 * Schema match (see src/components/community/community-chat.tsx):
 *   { text, authorId, authorName, authorPhotoURL, createdAt, isDemoPersona }
 */

import { config as loadDotenv } from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env BEFORE importing modules that touch Genkit / Google AI.
// (dotenv is a synchronous side-effecting call that mutates process.env.)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
loadDotenv({ path: join(repoRoot, '.env.local') });
loadDotenv({ path: join(repoRoot, '.env') });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { COMMUNITY_PERSONAS, type PersonaDef } from '../src/ai/data/community-personas';
import { generateCommunityPersonaMessage, type RecentMessageContext } from '../src/ai/flows/community-persona-message';

// ── Config ──────────────────────────────────────────────────────────────────
const SA_PATH = '/Users/sargupta/Downloads/sahayakai-b4248-firebase-adminsdk-fbsvc-5e4f90a578.json';
const COLLECTION = 'community_chat';
const TOTAL_MESSAGES = 50;
const HOURS_BACK = 24;
const SEED_ID_PREFIX = 'persona_seed_'; // every seeded doc id starts with this — makes purging trivial

// ── Init Firebase Admin ─────────────────────────────────────────────────────
if (!getApps().length) {
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const db = getFirestore();

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a distribution of 50 timestamps over the last 24 h that clusters
 * around realistic teacher-activity windows:
 *   morning rush      07:00-09:00  → 12 messages
 *   mid-morning calm  10:00-12:00  →  8 messages
 *   afternoon break   13:00-15:00  → 10 messages
 *   evening review    18:00-22:00  → 20 messages (peak activity)
 *
 * Returns timestamps oldest → newest.
 */
function buildTimestampSchedule(): Date[] {
  const now = new Date();
  const slots: Date[] = [];

  // Walk backward through the last 24 h in hour buckets and assign weights.
  // Hour weight = (target messages / total messages) per hour band.
  const bands: { startHour: number; endHour: number; count: number }[] = [
    { startHour: 7, endHour: 9, count: 12 },
    { startHour: 10, endHour: 12, count: 8 },
    { startHour: 13, endHour: 15, count: 10 },
    { startHour: 18, endHour: 22, count: 20 },
  ];

  // Anchor: midnight of "today" in the runtime tz, then walk back N days as needed.
  const anchorMidnight = new Date(now);
  anchorMidnight.setHours(0, 0, 0, 0);

  // We work over the last full 24 h ending NOW. So we need bands from
  // BOTH "yesterday" (later in the day) AND "today" (up to now).
  const cutoff = new Date(now.getTime() - HOURS_BACK * 60 * 60 * 1000);

  for (const band of bands) {
    for (let i = 0; i < band.count; i++) {
      // Pick a random minute within the band, on today or yesterday.
      const useToday = Math.random() < 0.55; // bias slightly toward today
      const baseDay = useToday ? anchorMidnight : new Date(anchorMidnight.getTime() - 24 * 60 * 60 * 1000);
      const hour = band.startHour + Math.floor(Math.random() * (band.endHour - band.startHour + 1));
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const candidate = new Date(baseDay);
      candidate.setHours(hour, minute, second, 0);

      // Drop if outside the cutoff window or in the future.
      if (candidate < cutoff || candidate > now) continue;
      slots.push(candidate);
    }
  }

  // If we under-filled (a band rolled past `now` and got clipped),
  // top up with random recent timestamps.
  while (slots.length < TOTAL_MESSAGES) {
    const minutesAgo = Math.floor(Math.random() * HOURS_BACK * 60);
    slots.push(new Date(now.getTime() - minutesAgo * 60 * 1000));
  }

  // Sort chronologically and trim to exact target.
  slots.sort((a, b) => a.getTime() - b.getTime());
  return slots.slice(-TOTAL_MESSAGES);
}

/** Pad timestamp into a sortable id segment: 20260520T142357_xxx */
function tsId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

/** Choose persona for slot N — round-robin-ish with random reshuffle */
function pickPersonaForSlot(slotIndex: number, shuffled: PersonaDef[]): PersonaDef {
  return shuffled[slotIndex % shuffled.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function purgeExisting(): Promise<number> {
  console.log('[seed] Purging existing persona_seed_* docs…');
  // Range query: id between persona_seed_ and persona_seed_~  (tilde > all digits/letters)
  // Easier to use prefix scan via collection().get() with limit, then filter.
  // Collection size is small (<1000 in demo env) so we just pull and filter.
  const snap = await db.collection(COLLECTION).get();
  let deleted = 0;
  const batch = db.batch();
  let batchCount = 0;
  for (const d of snap.docs) {
    if (d.id.startsWith(SEED_ID_PREFIX)) {
      batch.delete(d.ref);
      deleted++;
      batchCount++;
      if (batchCount === 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) await batch.commit();
  console.log(`[seed]   Deleted ${deleted} prior persona docs.`);
  return deleted;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const shouldPurge = args.includes('--purge') || args.includes('--force');

  console.log('[seed] Community persona seed script starting');
  console.log(`[seed] Target: ${TOTAL_MESSAGES} messages across ${HOURS_BACK}h, collection=${COLLECTION}`);

  if (shouldPurge) await purgeExisting();

  // Plan the schedule and persona assignments BEFORE we call the LLM —
  // so we can show progress and recover from partial failures.
  const schedule = buildTimestampSchedule();
  const personaPool = shuffle(COMMUNITY_PERSONAS);

  console.log('[seed] Schedule built:');
  const bandCounts = countByHourBand(schedule);
  for (const [band, count] of Object.entries(bandCounts)) {
    console.log(`[seed]   ${band}: ${count} messages`);
  }

  // Build the conversation incrementally — each new message sees the previous
  // 5 as context, so the LLM produces something coherent rather than 50
  // disconnected one-liners.
  const generated: Array<{
    id: string;
    text: string;
    persona: PersonaDef;
    timestamp: Date;
  }> = [];

  let failedCount = 0;

  for (let i = 0; i < schedule.length; i++) {
    const ts = schedule[i];
    const persona = pickPersonaForSlot(i, personaPool);

    // Build the "last 5 messages" context window for this slot.
    const recentMessages: RecentMessageContext[] = generated.slice(-5).map((g) => ({
      authorName: g.persona.displayName,
      text: g.text,
    }));

    // Mode: 30% explicit reply when there's something to reply to, 30% fresh, else auto.
    let mode: 'reply' | 'fresh' | 'auto' = 'auto';
    if (recentMessages.length > 0) {
      const r = Math.random();
      if (r < 0.3) mode = 'reply';
      else if (r < 0.6) mode = 'fresh';
    } else {
      mode = 'fresh';
    }

    try {
      const out = await generateCommunityPersonaMessage(persona, recentMessages, mode);
      const id = `${SEED_ID_PREFIX}${tsId(ts)}_${persona.id.replace('persona_', '')}`;
      generated.push({ id, text: out.message, persona, timestamp: ts });
      const preview = out.message.slice(0, 60).replace(/\s+/g, ' ');
      console.log(`[seed]   [${i + 1}/${schedule.length}] ${persona.displayName.padEnd(22)} ${ts.toISOString().slice(11, 16)}  ${preview}`);
    } catch (err) {
      failedCount++;
      console.warn(`[seed]   [${i + 1}/${schedule.length}] FAILED for ${persona.displayName}:`, err instanceof Error ? err.message : err);
    }
  }

  // Write all messages in batches (Firestore batch limit = 500).
  console.log(`[seed] Writing ${generated.length} messages to Firestore…`);
  let written = 0;
  for (let i = 0; i < generated.length; i += 400) {
    const batch = db.batch();
    for (const g of generated.slice(i, i + 400)) {
      const docRef = db.collection(COLLECTION).doc(g.id);
      batch.set(docRef, {
        text: g.text,
        authorId: g.persona.id,
        authorName: g.persona.displayName,
        authorPhotoURL: null,
        createdAt: Timestamp.fromDate(g.timestamp),
        // Markers so prod cleanup can scrub these post-pilot:
        isDemoPersona: true,
        personaState: g.persona.state,
        personaSubject: g.persona.subject,
      });
      written++;
    }
    await batch.commit();
  }

  console.log(`[seed] Done. Wrote ${written} messages. ${failedCount} generation failures.`);

  // Print persona-message-count distribution for sanity.
  const byPersona: Record<string, number> = {};
  for (const g of generated) byPersona[g.persona.displayName] = (byPersona[g.persona.displayName] || 0) + 1;
  console.log('[seed] Per-persona counts:');
  for (const [name, count] of Object.entries(byPersona)) {
    console.log(`[seed]   ${name.padEnd(22)} ${count}`);
  }
}

function countByHourBand(dates: Date[]): Record<string, number> {
  const bands = { 'morning 07-09': 0, 'mid 10-12': 0, 'afternoon 13-15': 0, 'evening 18-22': 0, 'other': 0 };
  for (const d of dates) {
    const h = d.getHours();
    if (h >= 7 && h <= 9) bands['morning 07-09']++;
    else if (h >= 10 && h <= 12) bands['mid 10-12']++;
    else if (h >= 13 && h <= 15) bands['afternoon 13-15']++;
    else if (h >= 18 && h <= 22) bands['evening 18-22']++;
    else bands.other++;
  }
  return bands;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] FATAL:', err);
    process.exit(1);
  });
