/**
 * CRM import — ① Ingest + ② Normalise (plan §3.3, §4).
 *
 * Every record is validated INDEPENDENTLY with the wire-contract schemas
 * (crm/schema.ts). A record that fails is quarantined as an ImportRejectedRow
 * with the first Zod issue as its reason and is never half-imported; one bad
 * row never blocks the rest of the school.
 *
 * Normalisation:
 *   - guardian phones → phoneEnc (AES-GCM) / phoneHash (peppered) / phoneLast4 /
 *     phoneClass; a number that does not normalise, or classifies 'invalid',
 *     is rejected ('invalid phone'). The plaintext number is never stored,
 *     returned, or logged.
 *   - a CRM `synthetic: true` flag is honoured even when the number looks like
 *     a real mobile — fail closed towards the simulated carrier (class gate 4).
 *   - guardians of RECORD only: SamparkStudent.guardianIds and
 *     SamparkGuardian.studentIds follow `isGuardianOfRecord`, never a shared
 *     phone number (plan §4⑦ bundling).
 *   - tombstones (`deleted: true`) mark the existing record inactive.
 *   - the preferences registry is bootstrapped from CRM consent for guardians
 *     that have no registry entry; for existing entries only groups whose
 *     current source is 'crm' are refreshed — an office, parent-form or keypad
 *     decision is never overwritten by an import.
 *
 * Slice 1 always pulls a full snapshot (updatedSince = null).
 */

import crypto from 'node:crypto';

import { CSV_ERROR_KEY, CSV_ROW_KEY } from '@/lib/sampark/crm/csv-source';
import {
    type CrmGuardian,
    CrmGuardianSchema,
    CrmSchoolSchema,
    type CrmStudent,
    CrmStudentSchema,
} from '@/lib/sampark/crm/schema';
import { languageFromCode } from '@/lib/sampark/languages';
import { classifyPhone, encryptPhone, hashPhone, normalizeIndianPhone, phoneLast4 } from '@/lib/sampark/phone';
import type { Clock, CrmSource, SamparkRepo } from '@/lib/sampark/ports';
import { logger } from '@/lib/logger';
import type {
    ConsentGroup,
    ConsentRecord,
    GuardianPreferences,
    ImportRejectedRow,
    ImportRun,
    ParentLanguage,
    PhoneClass,
    SamparkGuardian,
    SamparkStudent,
} from '@/types/sampark';
import type { ZodError } from 'zod';

/** Rejected rows kept on the ImportRun document (the count is always exact). */
export const MAX_REJECTED_ROWS_STORED = 500;

export interface ImportDeps {
    repo: SamparkRepo;
    clock: Clock;
    newId?: () => string;
}

export class ImportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImportError';
    }
}

const CONSENT_KEYS: { crm: keyof CrmGuardian['consent']; group: ConsentGroup }[] = [
    { crm: 'notices', group: 'notices' },
    { crm: 'progress', group: 'progress' },
    { crm: 'recordedConversation', group: 'recorded_conversation' },
    { crm: 'hpcInput', group: 'hpc_input' },
];

function zodReason(err: ZodError): string {
    const issue = err.issues[0];
    if (!issue) return 'invalid record';
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
}

function rawMeta(raw: unknown): { crmId: string | null; row: number | null; csvError: string | null; tombstone: boolean } {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id.trim() !== '' ? r.id : null;
    return {
        crmId: id,
        row: typeof r[CSV_ROW_KEY] === 'number' ? (r[CSV_ROW_KEY] as number) : null,
        csvError: typeof r[CSV_ERROR_KEY] === 'string' ? (r[CSV_ERROR_KEY] as string) : null,
        tombstone: r.deleted === true && id !== null,
    };
}

function spokenNames(src: CrmStudent['spokenFirstName']): Partial<Record<ParentLanguage, string>> {
    const out: Partial<Record<ParentLanguage, string>> = {};
    for (const [code, name] of Object.entries(src)) {
        const lang = languageFromCode(code);
        if (lang && name) out[lang] = name;
    }
    return out;
}

function consentFromCrm(c: CrmGuardian['consent'][keyof CrmGuardian['consent']]): ConsentRecord {
    if (!c) return { status: 'unknown', noticeVersion: null, language: null, recordedAt: null, source: 'crm' };
    return { status: c.status, noticeVersion: c.noticeVersion, language: null, recordedAt: c.recordedAt, source: 'crm' };
}

function sameConsent(a: ConsentRecord, b: ConsentRecord): boolean {
    return a.status === b.status && a.noticeVersion === b.noticeVersion && a.recordedAt === b.recordedAt && a.source === b.source;
}

export async function runImport(
    deps: ImportDeps,
    orgId: string,
    source: CrmSource,
    startedBy: string,
): Promise<ImportRun> {
    const { repo, clock } = deps;
    const school = await repo.getSchool(orgId);
    if (!school) throw new ImportError('Sampark is not enabled for this school');

    const startedAt = clock.now().toISOString();
    const run: ImportRun = {
        id: deps.newId?.() ?? crypto.randomUUID(),
        orgId,
        source: source.kind,
        startedAt,
        finishedAt: null,
        status: 'running',
        counts: { students: 0, guardians: 0, rejected: 0, tombstoned: 0 },
        rejected: [],
        error: null,
        startedBy,
    };
    await repo.createImportRun(run);

    const rejected: ImportRejectedRow[] = [];
    try {
        const now = clock.now().toISOString();

        // ── School (holidays) ────────────────────────────────────────────
        const rawSchool = await source.fetchSchool();
        let holidays: string[] | null = null;
        if (rawSchool !== null && rawSchool !== undefined) {
            const parsed = CrmSchoolSchema.safeParse(rawSchool);
            if (parsed.success) {
                holidays = [...new Set(parsed.data.holidays.map((h) => h.date))].sort();
            } else {
                logger.warn('CRM school record failed validation; holidays not refreshed', 'SAMPARK_IMPORT', {
                    orgId,
                    reason: zodReason(parsed.error),
                });
            }
        }

        const [rawStudents, rawGuardians] = await Promise.all([source.fetchStudents(null), source.fetchGuardians(null)]);

        // ── Validate every record independently ──────────────────────────
        const validStudents = new Map<string, CrmStudent>();
        const studentTombstones = new Set<string>();
        for (const raw of rawStudents) {
            const meta = rawMeta(raw);
            if (meta.csvError) {
                rejected.push({ entity: 'student', crmId: meta.crmId, row: meta.row, reason: meta.csvError });
                continue;
            }
            if (meta.tombstone) {
                studentTombstones.add(meta.crmId as string);
                validStudents.delete(meta.crmId as string);
                continue;
            }
            const parsed = CrmStudentSchema.safeParse(raw);
            if (!parsed.success) {
                rejected.push({ entity: 'student', crmId: meta.crmId, row: meta.row, reason: zodReason(parsed.error) });
                continue;
            }
            validStudents.set(parsed.data.id, parsed.data);
        }

        const validGuardians = new Map<string, { crm: CrmGuardian; e164: string; phoneClass: PhoneClass }>();
        const guardianTombstones = new Set<string>();
        for (const raw of rawGuardians) {
            const meta = rawMeta(raw);
            if (meta.csvError) {
                rejected.push({ entity: 'guardian', crmId: meta.crmId, row: meta.row, reason: meta.csvError });
                continue;
            }
            if (meta.tombstone) {
                guardianTombstones.add(meta.crmId as string);
                validGuardians.delete(meta.crmId as string);
                continue;
            }
            const parsed = CrmGuardianSchema.safeParse(raw);
            if (!parsed.success) {
                rejected.push({ entity: 'guardian', crmId: meta.crmId, row: meta.row, reason: zodReason(parsed.error) });
                continue;
            }
            const e164 = normalizeIndianPhone(parsed.data.phone);
            const cls = e164 ? classifyPhone(e164) : 'invalid';
            if (!e164 || cls === 'invalid') {
                rejected.push({ entity: 'guardian', crmId: meta.crmId, row: meta.row, reason: 'invalid phone' });
                continue;
            }
            // Fail closed: a CRM that says "synthetic" is believed even for a mobile-looking number.
            const phoneClass: PhoneClass = parsed.data.synthetic ? 'synthetic' : cls;
            validGuardians.set(parsed.data.id, { crm: parsed.data, e164, phoneClass });
        }

        // ── Existing snapshot (for tombstones and link integrity) ────────
        const [existingStudents, existingGuardians] = await Promise.all([repo.listStudents(orgId), repo.listGuardians(orgId)]);
        const knownGuardianIds = new Set<string>([
            ...validGuardians.keys(),
            ...existingGuardians.filter((g) => !guardianTombstones.has(g.id)).map((g) => g.id),
        ]);

        // ── Students ─────────────────────────────────────────────────────
        const students: SamparkStudent[] = [];
        const studentIdsByGuardian = new Map<string, string[]>();
        for (const s of validStudents.values()) {
            const ofRecord = s.guardians
                .filter((l) => l.isGuardianOfRecord && knownGuardianIds.has(l.guardianId))
                .map((l) => l.guardianId);
            const guardianIds = [...new Set(ofRecord)];
            for (const gid of guardianIds) {
                const list = studentIdsByGuardian.get(gid) ?? [];
                list.push(s.id);
                studentIdsByGuardian.set(gid, list);
            }
            students.push({
                orgId,
                id: s.id,
                grade: s.grade,
                section: s.section,
                spokenFirstName: spokenNames(s.spokenFirstName),
                displayName: s.fullName,
                feeCategory: s.feeCategory,
                sensitiveFlags: s.sensitiveFlags,
                boarding: s.boarding,
                transportRoute: s.transportRoute,
                guardianIds,
                active: s.status === 'active',
                crmUpdatedAt: s.updatedAt,
                importedAt: now,
            });
        }
        const tombstonedStudents = existingStudents
            .filter((s) => studentTombstones.has(s.id))
            .map((s) => ({ ...s, active: false, importedAt: now }));

        // ── Guardians ────────────────────────────────────────────────────
        const guardians: SamparkGuardian[] = [];
        for (const { crm, e164, phoneClass } of validGuardians.values()) {
            guardians.push({
                orgId,
                id: crm.id,
                displayName: crm.fullName,
                relation: crm.relation,
                phoneEnc: encryptPhone(e164),
                phoneHash: hashPhone(e164),
                phoneLast4: phoneLast4(e164),
                phoneClass,
                studentIds: studentIdsByGuardian.get(crm.id) ?? [],
                crmLanguage: languageFromCode(crm.preferredLanguage),
                crmDoNotContact: crm.doNotContact,
                active: true,
                crmUpdatedAt: crm.updatedAt,
                importedAt: now,
            });
        }
        const tombstonedGuardians = existingGuardians
            .filter((g) => guardianTombstones.has(g.id))
            .map((g) => ({ ...g, active: false, importedAt: now }));

        // ── Preferences registry ─────────────────────────────────────────
        const existingPrefs = await repo.getPreferences(orgId, guardians.map((g) => g.id));
        const prefWrites: GuardianPreferences[] = [];
        for (const { crm } of validGuardians.values()) {
            const current = existingPrefs.get(crm.id);
            if (!current) {
                const consent = {} as Record<ConsentGroup, ConsentRecord>;
                for (const k of CONSENT_KEYS) consent[k.group] = consentFromCrm(crm.consent[k.crm]);
                prefWrites.push({ orgId, guardianId: crm.id, language: null, consent, updatedAt: now, updatedBy: 'import' });
                continue;
            }
            let changed = false;
            const consent = { ...current.consent };
            for (const k of CONSENT_KEYS) {
                const existing = consent[k.group];
                if (existing && existing.source !== 'crm') continue; // office / parent / keypad decisions win
                const next = consentFromCrm(crm.consent[k.crm]);
                if (!existing || !sameConsent(existing, next)) {
                    consent[k.group] = next;
                    changed = true;
                }
            }
            if (changed) prefWrites.push({ ...current, consent, updatedAt: now, updatedBy: 'import' });
        }

        // ── Write ────────────────────────────────────────────────────────
        await repo.upsertGuardians(orgId, [...guardians, ...tombstonedGuardians]);
        await repo.upsertStudents(orgId, [...students, ...tombstonedStudents]);
        if (prefWrites.length > 0) await repo.upsertPreferences(prefWrites);

        const finishedAt = clock.now().toISOString();
        const latestSchool = (await repo.getSchool(orgId)) ?? school;
        await repo.upsertSchool({
            ...latestSchool,
            holidays: holidays ?? latestSchool.holidays,
            crm: latestSchool.crm
                ? { ...latestSchool.crm, lastImportAt: finishedAt, lastImportId: run.id }
                : { kind: source.kind, baseUrl: null, apiKeySecretName: null, lastImportAt: finishedAt, lastImportId: run.id },
            updatedAt: finishedAt,
        });

        const done: ImportRun = {
            ...run,
            finishedAt,
            status: 'succeeded',
            counts: {
                students: students.length,
                guardians: guardians.length,
                rejected: rejected.length,
                tombstoned: studentTombstones.size + guardianTombstones.size,
            },
            rejected: rejected.slice(0, MAX_REJECTED_ROWS_STORED),
        };
        await repo.updateImportRun(done);
        await repo.appendAudit(orgId, {
            at: finishedAt,
            actor: startedBy,
            action: 'import.run',
            target: `import/${run.id}`,
            detail: { source: source.kind, ...done.counts },
        });
        logger.info('Sampark import finished', 'SAMPARK_IMPORT', { orgId, importId: run.id, source: source.kind, ...done.counts });
        return done;
    } catch (err) {
        const message = err instanceof Error && /^(Crm|Csv|Import)/.test(err.name) ? err.message : 'Import failed';
        logger.error('Sampark import failed', err, 'SAMPARK_IMPORT', { orgId, importId: run.id, source: source.kind });
        const failed: ImportRun = {
            ...run,
            finishedAt: clock.now().toISOString(),
            status: 'failed',
            counts: { ...run.counts, rejected: rejected.length },
            rejected: rejected.slice(0, MAX_REJECTED_ROWS_STORED),
            error: message,
        };
        await repo.updateImportRun(failed);
        return failed;
    }
}
