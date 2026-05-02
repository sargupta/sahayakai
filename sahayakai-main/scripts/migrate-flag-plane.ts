/**
 * Phase J.5 — Flag plane migration script.
 *
 * One-shot migration helper for the consolidation of the 12
 * env-var-flagged sidecar agents to the canonical Firestore plane at
 * `system_config/feature_flags`.
 *
 * Reads the current `process.env.SAHAYAKAI_<AGENT>_MODE` /
 * `SAHAYAKAI_<AGENT>_PERCENT` pairs and writes the equivalent typed
 * fields onto the Firestore feature-flags doc. Idempotent: if the
 * Firestore field already has a value, the script logs it and skips
 * unless `--force` is provided.
 *
 * Usage:
 *   npx tsx scripts/migrate-flag-plane.ts            # dry-run preview
 *   npx tsx scripts/migrate-flag-plane.ts --apply    # commit writes
 *   npx tsx scripts/migrate-flag-plane.ts --apply --force
 *
 * Safe to run repeatedly. Logs a structured JSON summary of what was
 * migrated, what was already up-to-date, and what was skipped.
 *
 * Forensic audit P0 #3 — see commit fix(phase-j.5): consolidate flag
 * plane to Firestore.
 */

import { initializeFirebase } from '@/lib/firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

type SidecarMode = 'off' | 'shadow' | 'canary' | 'full';

interface AgentMapping {
    /** Pretty agent name for logs. */
    agent: string;
    /** env-var prefix without `SAHAYAKAI_`. */
    envPrefix: string;
    /** Firestore field for the mode value. */
    modeField: string;
    /** Firestore field for the percent value. */
    percentField: string;
}

const AGENTS: AgentMapping[] = [
    { agent: 'quiz', envPrefix: 'QUIZ', modeField: 'quizSidecarMode', percentField: 'quizSidecarPercent' },
    { agent: 'exam-paper', envPrefix: 'EXAM_PAPER', modeField: 'examPaperSidecarMode', percentField: 'examPaperSidecarPercent' },
    { agent: 'visual-aid', envPrefix: 'VISUAL_AID', modeField: 'visualAidSidecarMode', percentField: 'visualAidSidecarPercent' },
    { agent: 'worksheet', envPrefix: 'WORKSHEET', modeField: 'worksheetSidecarMode', percentField: 'worksheetSidecarPercent' },
    { agent: 'rubric', envPrefix: 'RUBRIC', modeField: 'rubricSidecarMode', percentField: 'rubricSidecarPercent' },
    { agent: 'teacher-training', envPrefix: 'TEACHER_TRAINING', modeField: 'teacherTrainingSidecarMode', percentField: 'teacherTrainingSidecarPercent' },
    { agent: 'virtual-field-trip', envPrefix: 'VIRTUAL_FIELD_TRIP', modeField: 'virtualFieldTripSidecarMode', percentField: 'virtualFieldTripSidecarPercent' },
    { agent: 'instant-answer', envPrefix: 'INSTANT_ANSWER', modeField: 'instantAnswerSidecarMode', percentField: 'instantAnswerSidecarPercent' },
    { agent: 'parent-message', envPrefix: 'PARENT_MESSAGE', modeField: 'parentMessageSidecarMode', percentField: 'parentMessageSidecarPercent' },
    { agent: 'video-storyteller', envPrefix: 'VIDEO_STORYTELLER', modeField: 'videoStorytellerSidecarMode', percentField: 'videoStorytellerSidecarPercent' },
    { agent: 'avatar', envPrefix: 'AVATAR', modeField: 'avatarSidecarMode', percentField: 'avatarSidecarPercent' },
    { agent: 'voice-to-text', envPrefix: 'VOICE_TO_TEXT', modeField: 'voiceToTextSidecarMode', percentField: 'voiceToTextSidecarPercent' },
];

function parseMode(raw: string | undefined): SidecarMode | null {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v === 'off' || v === 'shadow' || v === 'canary' || v === 'full') return v;
    return null;
}

function parsePercent(raw: string | undefined): number | null {
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n));
}

interface AgentMigrationResult {
    agent: string;
    envMode: SidecarMode | null;
    envPercent: number | null;
    firestoreMode: SidecarMode | undefined;
    firestorePercent: number | undefined;
    action: 'migrated' | 'already_set' | 'no_env_value' | 'skipped_force_required';
    note?: string;
}

async function main(): Promise<void> {
    const args = new Set(process.argv.slice(2));
    const apply = args.has('--apply');
    const force = args.has('--force');

    await initializeFirebase();
    const db = getFirestore();
    const docRef = db.doc('system_config/feature_flags');
    const snap = await docRef.get();
    const existing = (snap.exists ? snap.data() : {}) ?? {};

    const results: AgentMigrationResult[] = [];
    const updates: Record<string, SidecarMode | number> = {};

    for (const m of AGENTS) {
        const envMode = parseMode(process.env[`SAHAYAKAI_${m.envPrefix}_MODE`]);
        const envPercent = parsePercent(process.env[`SAHAYAKAI_${m.envPrefix}_PERCENT`]);
        const fsMode = existing[m.modeField] as SidecarMode | undefined;
        const fsPercent = existing[m.percentField] as number | undefined;

        // No env values to migrate at all → nothing to do.
        if (envMode === null && envPercent === null) {
            results.push({
                agent: m.agent,
                envMode: null,
                envPercent: null,
                firestoreMode: fsMode,
                firestorePercent: fsPercent,
                action: 'no_env_value',
                note: 'no SAHAYAKAI_*_MODE/_PERCENT env values present in this process',
            });
            continue;
        }

        // Firestore already has a non-default value. Without --force,
        // do not overwrite — the operator may have flipped it manually
        // and the env var is just a stale Cloud Run revision setting.
        const fsHasValue = (fsMode !== undefined && fsMode !== 'off')
            || (fsPercent !== undefined && fsPercent !== 0);
        if (fsHasValue && !force) {
            results.push({
                agent: m.agent,
                envMode,
                envPercent,
                firestoreMode: fsMode,
                firestorePercent: fsPercent,
                action: 'skipped_force_required',
                note: 'Firestore already has a non-default value; pass --force to overwrite',
            });
            continue;
        }

        // Already in sync — env values match Firestore.
        if (envMode === fsMode && envPercent === fsPercent) {
            results.push({
                agent: m.agent,
                envMode,
                envPercent,
                firestoreMode: fsMode,
                firestorePercent: fsPercent,
                action: 'already_set',
            });
            continue;
        }

        // Stage the update — only emit a field if the env value was
        // actually parsed (so we never write `null` to Firestore).
        if (envMode !== null) updates[m.modeField] = envMode;
        if (envPercent !== null) updates[m.percentField] = envPercent;

        results.push({
            agent: m.agent,
            envMode,
            envPercent,
            firestoreMode: fsMode,
            firestorePercent: fsPercent,
            action: 'migrated',
        });
    }

    if (Object.keys(updates).length > 0 && apply) {
        updates.updatedAt = FieldValue.serverTimestamp() as unknown as never;
        updates.updatedBy = 'migrate-flag-plane' as unknown as never;
        await docRef.set(updates, { merge: true });
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'migrate_flag_plane.summary',
        apply,
        force,
        results,
        firestoreUpdated: apply && Object.keys(updates).length > 0,
        // updatedAt/updatedBy are server-only sentinels — strip from log
        fieldsWritten: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'updatedBy'),
    }, null, 2));

    if (!apply && Object.keys(updates).length > 0) {
        // eslint-disable-next-line no-console
        console.log('\nDry-run only. Re-run with --apply to commit the writes above.');
    }
}

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
