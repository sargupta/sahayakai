/**
 * Slice 2 service: adopted rules → proposals → approval → intents the existing
 * dispatcher dials (plan §2A, §2C, §4③⑤⑦). Practice mode only: this module
 * never constructs a carrier and never places a call; its only output is
 * intents (create-only, `proposalId` set) that the dispatcher reads. Everything
 * the dispatcher already guarantees — at-most-once, calling window, suppression,
 * consent, the sensitive-flag gate — applies to these intents unchanged, and the
 * gate refuses a rule-driven purpose that arrives without an approved proposal.
 *
 * Flow:
 *   adoptRule        a school adopts a rule with thresholds, in writing (append-only record)
 *   runRules         adopted rules over the CRM signals → proposals (create-only), routed to the
 *                    right role, each with evidence; unadopted rules are inert
 *   approveProposal  a person with the role (or the principal) approves → one intent per guardian
 *                    of record, gated at materialise, never earlier than the first allowed moment
 *                    (never Fri/Sat for concern purposes)
 *   dismiss / handleMyself   "Not now" / "I'll call myself": never resurrected
 *   confirmClassAbsences     A2: the class teacher's one tap per class per day IS the approval
 *   processAbsencePages      A2 outcomes: key 2 or no answer pages the class teacher and principal;
 *                            a keypress never writes attendance or leave
 */

import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { purposeSpec } from '@/lib/sampark/catalogue';
import { hashId, intentIdFor } from '@/lib/sampark/intents';
import { istDate } from '@/lib/sampark/policy/ist';
import { resolveLanguage } from '@/lib/sampark/policy/language';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import { runBacktest, weeklyDates, type Backtest } from '@/lib/sampark/rules/backtest';
import { runAdoptedRules } from '@/lib/sampark/rules/engine';
import { MAX_AUTOMATED_CALLS_PER_DUE } from '@/lib/sampark/rules/evaluate-fees';
import { buildPage, pagingFor } from '@/lib/sampark/rules/paging';
import type { SamparkRulesRepo } from '@/lib/sampark/rules/ports';
import { approverRoleFor, canApprove, resolveApprovers, validateRoleAssignment, type ApprovalActor, type ApprovalVia } from '@/lib/sampark/rules/roles';
import { earliestDialAt } from '@/lib/sampark/rules/schedule';
import type { SignalsLoad } from '@/lib/sampark/rules/signals-source';
import { DEFAULT_THRESHOLDS, parseThresholds } from '@/lib/sampark/rules/thresholds';
import {
    ADOPTION_STATEMENT_V1,
    RULE_IDS,
    isRuleId,
    type Adoption,
    type ClassConfirmation,
    type ExcludedChild,
    type Page,
    type Proposal,
    type ProposalDraft,
    type RoleAssignment,
    type RuleId,
    type SectionRef,
} from '@/lib/sampark/rules/types';
import { canNameChild, renderChildScript } from '@/lib/sampark/scripts/child-render';
import { isChildPurpose } from '@/lib/sampark/scripts/child-templates';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import { PARENT_LANGUAGES, type BlockReason, type Intent, type ParentLanguage, type SamparkSchool, type SamparkStudent } from '@/types/sampark';
import { carrierKindForDryRun } from '@/server/sampark/carrier';
import { badRequest, conflict, forbidden, notFound } from '@/server/sampark/errors';
import { getSchoolOrThrow } from '@/server/sampark/school';

export interface ProposalCtx {
    repo: SamparkRepo;
    rules: SamparkRulesRepo;
    clock: Clock;
    /** The CRM signals for a school (REST pull in the app, static in tests). */
    loadSignals(school: SamparkSchool): Promise<SignalsLoad>;
}

/** Concern and recognition proposals for the same child and purpose are not re-proposed within this many days. */
export const PROPOSAL_COOLDOWN_DAYS = 14;
const COOLDOWN_PURPOSES: readonly RuleId[] = ['attendance_talk', 'academic_talk', 'conduct_talk', 'recognition'];

/** Plain-language reasons for a gate refusal, for the approver (never a code). */
export const BLOCK_REASON_PLAIN: Readonly<Record<BlockReason, string>> = Object.freeze({
    no_consent: 'has not given consent for these calls',
    consent_denied: 'has said no to these calls',
    suppressed: 'asked to stop these calls',
    crm_do_not_contact: 'is marked do-not-contact in the school records',
    invalid_number: 'has a phone number that cannot be called',
    language_unknown: 'has no language on record, so the school should ask the family',
    fee_category_excluded: 'is exempt from fees',
    sensitive_flag: 'belongs to a child with a sensitive flag',
    human_only_purpose: 'is for a person to handle, not a machine',
    frequency_cap: 'has already had the most calls this month',
    mode_forbids_dialing: 'cannot be called in this mode (practice mode places no real calls)',
    synthetic_number_not_allowed: 'has a demo number that can never be dialled',
    purpose_not_available: 'cannot be called for this purpose yet',
    school_not_enabled: 'is at a school that has not enabled calling',
});

// ── Roles ───────────────────────────────────────────────────────────────────

export async function listRoles(ctx: ProposalCtx, orgId: string): Promise<RoleAssignment[]> {
    return ctx.rules.listRoleAssignments(orgId);
}

export async function grantRole(
    ctx: ProposalCtx,
    orgId: string,
    input: { uid: string; role: RoleAssignment['role']; sections: SectionRef[]; displayName: string },
    grantedBy: string,
): Promise<RoleAssignment> {
    const problem = validateRoleAssignment(input);
    if (problem) throw badRequest('INVALID_ROLE', problem);
    const record: RoleAssignment = {
        orgId,
        uid: input.uid,
        role: input.role,
        sections: input.sections.map((s) => ({ grade: s.grade, section: String(s.section).toUpperCase() })),
        displayName: input.displayName.trim() || input.uid,
        grantedBy,
        grantedAt: ctx.clock.now().toISOString(),
    };
    await ctx.rules.upsertRoleAssignment(record);
    await ctx.repo.appendAudit(orgId, { at: record.grantedAt, actor: grantedBy, action: 'role.grant', target: `user/${input.uid}`, detail: { role: input.role, sections: record.sections } });
    return record;
}

export async function revokeRole(ctx: ProposalCtx, orgId: string, uid: string, role: string, by: string): Promise<void> {
    await ctx.rules.removeRoleAssignment(orgId, uid, role);
    await ctx.repo.appendAudit(orgId, { at: ctx.clock.now().toISOString(), actor: by, action: 'role.revoke', target: `user/${uid}`, detail: { role } });
}

/** The caller's authority: org admin, and/or whatever roles were granted to them. */
export async function actorFor(ctx: ProposalCtx, orgId: string, uid: string, isOrgAdmin: boolean): Promise<{ actor: ApprovalActor; assignments: RoleAssignment[]; mine: RoleAssignment[] }> {
    const assignments = await ctx.rules.listRoleAssignments(orgId);
    return { actor: { uid, isOrgAdmin }, assignments, mine: assignments.filter((a) => a.uid === uid) };
}

// ── Adoption ────────────────────────────────────────────────────────────────

export interface RuleView {
    ruleId: RuleId;
    code: string;
    approver: string;
    adopted: boolean;
    version: number | null;
    thresholds: Record<string, unknown>;
    defaults: Record<string, unknown>;
    adoptedBy: string | null;
    adopterName: string | null;
    adoptedAt: string | null;
    statementVersion: string | null;
}

export async function listRules(ctx: ProposalCtx, orgId: string): Promise<{ statement: string; rules: RuleView[] }> {
    const current = new Map((await ctx.rules.listCurrentAdoptions(orgId)).map((a) => [a.ruleId, a]));
    return {
        statement: ADOPTION_STATEMENT_V1,
        rules: RULE_IDS.map((ruleId) => {
            const a = current.get(ruleId);
            const adopted = !!a && a.status === 'adopted';
            return {
                ruleId,
                code: purposeSpec(ruleId).code,
                approver: String(approverRoleFor(ruleId)),
                adopted,
                version: a?.version ?? null,
                thresholds: (adopted ? a!.thresholds : DEFAULT_THRESHOLDS[ruleId]) as unknown as Record<string, unknown>,
                defaults: DEFAULT_THRESHOLDS[ruleId] as unknown as Record<string, unknown>,
                adoptedBy: adopted ? a!.adoptedBy : null,
                adopterName: adopted ? a!.adopterName : null,
                adoptedAt: adopted ? a!.adoptedAt : null,
                statementVersion: adopted ? a!.statementVersion : null,
            };
        }),
    };
}

/** A school adopts a rule with its thresholds, in writing. Only the principal (org admin) may. */
export async function adoptRule(
    ctx: ProposalCtx,
    orgId: string,
    rule: string,
    input: { thresholds: unknown; adopterName: string; acknowledged: boolean },
    actor: { uid: string; isOrgAdmin: boolean },
): Promise<Adoption> {
    if (!actor.isOrgAdmin) throw forbidden('ADOPTION_FORBIDDEN', 'Only the principal can adopt a rule for the school.');
    if (!isRuleId(rule)) throw badRequest('UNKNOWN_RULE', `Unknown rule "${rule}"`);
    if (!input.acknowledged) throw badRequest('ADOPTION_NOT_ACKNOWLEDGED', 'The adoption statement must be accepted in writing.');
    const name = input.adopterName.trim();
    if (!name) throw badRequest('ADOPTER_NAME_REQUIRED', 'Type your name to adopt this rule.');
    const parsed = parseThresholds(rule, input.thresholds);
    if (!parsed.ok) throw badRequest('INVALID_THRESHOLDS', parsed.message);
    await getSchoolOrThrow(ctx, orgId);

    const history = (await ctx.rules.listAdoptionHistory(orgId)).filter((a) => a.ruleId === rule);
    const version = history.reduce((m, a) => Math.max(m, a.version), 0) + 1;
    const record: Adoption = {
        id: `${rule}__v${version}`,
        orgId,
        ruleId: rule,
        version,
        status: 'adopted',
        thresholds: parsed.value,
        adoptedBy: actor.uid,
        adopterName: name,
        statementVersion: 'v1',
        adoptedAt: ctx.clock.now().toISOString(),
    } as Adoption;
    await ctx.rules.appendAdoption(record);
    await ctx.repo.appendAudit(orgId, { at: record.adoptedAt, actor: actor.uid, action: 'rule.adopt', target: `rule/${rule}`, detail: { version, thresholds: parsed.value, adopterName: name } });
    return record;
}

export async function withdrawRule(ctx: ProposalCtx, orgId: string, rule: string, actor: { uid: string; isOrgAdmin: boolean }): Promise<Adoption> {
    if (!actor.isOrgAdmin) throw forbidden('ADOPTION_FORBIDDEN', 'Only the principal can withdraw a rule.');
    if (!isRuleId(rule)) throw badRequest('UNKNOWN_RULE', `Unknown rule "${rule}"`);
    const current = await ctx.rules.getCurrentAdoption(orgId, rule);
    if (!current || current.status !== 'adopted') throw conflict('RULE_NOT_ADOPTED', 'This rule is not adopted.');
    const record: Adoption = { ...current, id: `${rule}__v${current.version + 1}`, version: current.version + 1, status: 'withdrawn', adoptedBy: actor.uid, adoptedAt: ctx.clock.now().toISOString() } as Adoption;
    await ctx.rules.appendAdoption(record);
    // A withdrawn rule is inert; proposals still waiting on it are withdrawn with it.
    for (const p of await ctx.rules.listProposals(orgId, { status: 'pending' })) {
        if (p.purpose === rule) await ctx.rules.updateProposal(orgId, p.id, { status: 'expired', decisionNote: 'The rule was withdrawn.', updatedAt: record.adoptedAt });
    }
    await ctx.repo.appendAudit(orgId, { at: record.adoptedAt, actor: actor.uid, action: 'rule.withdraw', target: `rule/${rule}`, detail: { version: record.version } });
    return record;
}

// ── Running the rules ───────────────────────────────────────────────────────

export interface RunSummary {
    evaluated: RuleId[];
    inert: RuleId[];
    created: number;
    existing: number;
    skippedCooldown: number;
    autoApproved: number;
    expired: number;
    excluded: (ExcludedChild & { studentName: string; section: string })[];
    rejectedRecords: number;
}

async function feeCallsUsed(ctx: ProposalCtx, orgId: string, proposals: Proposal[]): Promise<Map<string, number>> {
    const used = new Map<string, number>();
    for (const p of proposals) {
        if (!p.facts || p.facts.kind !== 'fee' || p.status === 'dismissed' || p.status === 'handled_by_person') continue;
        let spent = 0;
        for (const intentId of p.intentIds) {
            const intent = await ctx.repo.getIntent(orgId, intentId);
            if (!intent || intent.status === 'blocked' || intent.status === 'cancelled') continue;
            const live = intent.status === 'approved' || intent.status === 'retry_wait' || intent.status === 'dialing';
            // A live intent still reserves every call it may make; a finished one has spent what it dialled.
            spent = Math.max(spent, live ? intent.maxAttempts : intent.attempts);
        }
        used.set(p.facts.dueId, Math.max(used.get(p.facts.dueId) ?? 0, spent));
    }
    return used;
}

function nameOf(students: Map<string, SamparkStudent>, id: string): { studentName: string; section: string } {
    const s = students.get(id);
    return { studentName: s?.displayName ?? id, section: s ? `${s.grade}${s.section}` : '' };
}

async function loadRunInputs(ctx: ProposalCtx, orgId: string) {
    const school = await getSchoolOrThrow(ctx, orgId);
    const [students, adoptions, assignments, load] = await Promise.all([
        ctx.repo.listStudents(orgId),
        ctx.rules.listCurrentAdoptions(orgId),
        ctx.rules.listRoleAssignments(orgId),
        ctx.loadSignals(school),
    ]);
    const today = istDate(ctx.clock.now());
    const [confirmations, proposals] = await Promise.all([ctx.rules.listClassConfirmations(orgId, today), ctx.rules.listProposals(orgId)]);
    return { school, students, adoptions, assignments, load, confirmations, proposals };
}

/** Dry run: what the adopted rules would propose right now, and who they would not (with plain reasons). Writes nothing. */
export async function previewRules(ctx: ProposalCtx, orgId: string): Promise<{ wouldPropose: { purpose: RuleId; studentName: string; section: string; summary: string }[]; excluded: RunSummary['excluded']; evaluated: RuleId[]; inert: RuleId[] }> {
    const inputs = await loadRunInputs(ctx, orgId);
    const used = await feeCallsUsed(ctx, orgId, inputs.proposals);
    const result = runAdoptedRules({ asOf: ctx.clock.now(), students: inputs.students, signals: inputs.load.signals, adoptions: inputs.adoptions, confirmations: inputs.confirmations, feeCallsUsed: used });
    const byId = new Map(inputs.students.map((s) => [s.id, s]));
    return {
        wouldPropose: result.drafts.map((d) => ({ purpose: d.purpose, summary: d.summary, ...nameOf(byId, d.studentId) })),
        excluded: result.excluded.map((e) => ({ ...e, ...nameOf(byId, e.studentId) })),
        evaluated: result.evaluated,
        inert: result.inert,
    };
}

function proposalFromDraft(orgId: string, draft: ProposalDraft, assignments: RoleAssignment[], adoption: Adoption, now: Date): Proposal {
    const routing = resolveApprovers(draft.purpose, draft.section, assignments);
    const at = now.toISOString();
    return {
        id: hashId(draft.dedupeKey),
        dedupeKey: draft.dedupeKey,
        orgId,
        purpose: draft.purpose,
        studentId: draft.studentId,
        section: draft.section,
        facts: draft.facts,
        summary: draft.summary,
        evidence: draft.evidence,
        approverRole: routing.approver,
        routingNote: routing.note,
        alreadyKnown: draft.alreadyKnown,
        status: 'pending',
        notBefore: null,
        expiresAt: draft.expiresAt,
        adoptionVersion: adoption.version,
        thresholds: adoption.thresholds as unknown as Record<string, unknown>,
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        intentIds: [],
        createdAt: at,
        updatedAt: at,
    };
}

/** Run the adopted rules and create proposals (create-only). Pre-approved drafts (A2 after confirmation, A5 if the school opted in) are approved at once. */
export async function runRules(ctx: ProposalCtx, orgId: string, opts: { only?: RuleId[]; actor?: string } = {}): Promise<RunSummary> {
    const inputs = await loadRunInputs(ctx, orgId);
    const now = ctx.clock.now();
    const used = await feeCallsUsed(ctx, orgId, inputs.proposals);
    const adoptions = opts.only ? inputs.adoptions.filter((a) => opts.only!.includes(a.ruleId)) : inputs.adoptions;
    const result = runAdoptedRules({ asOf: now, students: inputs.students, signals: inputs.load.signals, adoptions, confirmations: inputs.confirmations, feeCallsUsed: used });
    const byId = new Map(inputs.students.map((s) => [s.id, s]));
    const summary: RunSummary = {
        evaluated: result.evaluated,
        inert: result.inert,
        created: 0,
        existing: 0,
        skippedCooldown: 0,
        autoApproved: 0,
        expired: 0,
        excluded: result.excluded.map((e) => ({ ...e, ...nameOf(byId, e.studentId) })),
        rejectedRecords: inputs.load.rejected.length,
    };

    // Proposals past their expiry stop waiting.
    for (const p of inputs.proposals) {
        if (p.status === 'pending' && Date.parse(p.expiresAt) < now.getTime()) {
            await ctx.rules.updateProposal(orgId, p.id, { status: 'expired', decisionNote: 'Expired before anyone acted.', updatedAt: now.toISOString() });
            summary.expired++;
        }
    }

    for (const draft of result.drafts) {
        const adoption = adoptions.find((a) => a.ruleId === draft.purpose)!;
        // A child who was just proposed the same thing is not proposed again every day.
        if (COOLDOWN_PURPOSES.includes(draft.purpose)) {
            const cutoff = now.getTime() - PROPOSAL_COOLDOWN_DAYS * 86_400_000;
            const recent = inputs.proposals.some((p) => p.studentId === draft.studentId && p.purpose === draft.purpose && p.dedupeKey !== draft.dedupeKey && Date.parse(p.createdAt) >= cutoff);
            if (recent) {
                summary.skippedCooldown++;
                continue;
            }
        }
        const proposal = proposalFromDraft(orgId, draft, inputs.assignments, adoption, now);
        const created = await ctx.rules.createProposalIfAbsent(proposal);
        if (!created) {
            summary.existing++;
            continue;
        }
        summary.created++;
        if (draft.preApprovedBy) {
            await materialiseApproval(ctx, inputs.school, proposal, byId.get(proposal.studentId)!, { decidedBy: draft.preApprovedBy, via: draft.preApprovedBy === 'auto' ? 'auto' : 'class_confirmation', note: null });
            summary.autoApproved++;
        }
    }
    await ctx.repo.appendAudit(orgId, { at: now.toISOString(), actor: opts.actor ?? 'system', action: 'rules.run', target: `school/${orgId}`, detail: { evaluated: result.evaluated, created: summary.created, existing: summary.existing, excluded: result.excluded.length } });
    return summary;
}

// ── Approval ────────────────────────────────────────────────────────────────

export interface ApprovalOutcome {
    proposal: Proposal;
    dialable: number;
    blocked: { guardianLabel: string; reason: BlockReason; plain: string }[];
    needsAttention: string | null;
}

type DecisionVia = ApprovalVia | 'auto' | 'class_confirmation';

/** Turn an approved proposal into intents the dispatcher can read. Idempotent: intent ids are create-only. */
async function materialiseApproval(
    ctx: ProposalCtx,
    school: SamparkSchool,
    proposal: Proposal,
    student: SamparkStudent | undefined,
    decision: { decidedBy: string; via: DecisionVia; note: string | null },
): Promise<ApprovalOutcome> {
    const { repo, rules, clock } = ctx;
    const orgId = school.orgId;
    const now = clock.now();
    const nowIso = now.toISOString();
    const spec = purposeSpec(proposal.purpose);
    const outcome: ApprovalOutcome = { proposal, dialable: 0, blocked: [], needsAttention: null };

    const finish = async (status: Proposal['status'], note: string | null) => {
        const patch: Partial<Proposal> = { status, decidedBy: decision.decidedBy, decidedAt: nowIso, decisionNote: note, intentIds: proposal.intentIds, notBefore: proposal.notBefore, updatedAt: nowIso };
        await rules.updateProposal(orgId, proposal.id, patch);
        outcome.proposal = { ...proposal, ...patch } as Proposal;
        await repo.appendAudit(orgId, {
            at: nowIso,
            actor: decision.decidedBy,
            action: status === 'approved' ? 'proposal.approve' : 'proposal.needs_attention',
            target: `proposal/${proposal.id}`,
            detail: { purpose: proposal.purpose, studentId: proposal.studentId, via: decision.via, evidence: proposal.evidence.map((e) => e.kind), intents: proposal.intentIds.length },
        });
        return outcome;
    };

    if (!student || !student.active) {
        outcome.needsAttention = 'This child is no longer on the school roll, so no call was set up.';
        return finish('needs_attention', outcome.needsAttention);
    }
    const candidates = await repo.listGuardians(orgId, student.guardianIds ?? []);
    // Guardian of record on BOTH sides of the snapshot, as in the class-wide audience.
    const guardians = candidates.filter((g) => g.active && (g.studentIds ?? []).includes(student.id)).sort((a, b) => a.id.localeCompare(b.id));
    if (guardians.length === 0) {
        outcome.needsAttention = 'No guardian of record with a usable record was found, so no call was set up. Please phone the family.';
        return finish('needs_attention', outcome.needsAttention);
    }

    const [prefs, suppressions] = await Promise.all([repo.getPreferences(orgId, guardians.map((g) => g.id)), repo.listSuppressions(orgId)]);
    const suppressionByPhone = new Map(suppressions.map((s) => [s.phoneHash, s]));
    const carrierKind = carrierKindForDryRun(school);
    const since = new Date(now.getTime() - FREQUENCY_WINDOW_MS);

    // Fee calls: at most two per due across C1 and C2, counting what earlier proposals have reserved or spent.
    let attemptsAllowed = spec.maxAttempts;
    if (proposal.facts?.kind === 'fee') {
        const others = (await rules.listProposals(orgId)).filter((p) => p.id !== proposal.id);
        const used = (await feeCallsUsed(ctx, orgId, others)).get(proposal.facts.dueId) ?? 0;
        attemptsAllowed = Math.min(spec.maxAttempts, MAX_AUTOMATED_CALLS_PER_DUE - used);
        if (attemptsAllowed <= 0) {
            outcome.needsAttention = 'Two automated calls have already been used for this fee. The accounts officer should speak with the family.';
            return finish('needs_attention', outcome.needsAttention);
        }
    }

    const earliest = spec.id === 'absence_today' ? now : earliestDialAt(proposal.purpose, school, now);
    const missingNames = new Set<ParentLanguage>();
    const intentIds: string[] = [];

    for (const guardian of guardians) {
        const dedupeKey = `proposal:${proposal.id}:guardian:${guardian.id}`;
        const id = intentIdFor(dedupeKey);
        const existing = await repo.getIntent(orgId, id);
        if (existing) {
            intentIds.push(id);
            if (existing.status === 'approved' || existing.status === 'retry_wait' || existing.status === 'dialing' || existing.status === 'done') outcome.dialable++;
            continue;
        }
        const preferences = prefs.get(guardian.id) ?? null;
        const recent = await repo.countCallsToPhoneSince(orgId, guardian.phoneHash, since, true);
        const verdict = evaluateGate({
            school,
            spec,
            guardian,
            students: [student],
            preferences,
            suppression: suppressionByPhone.get(guardian.phoneHash) ?? null,
            recentCallsToPhone: recent,
            carrierKind,
            now,
            stage: 'materialise',
            viaProposal: true,
        });
        const blockReason: BlockReason | null = verdict.kind === 'block' ? verdict.reason : null;
        const language = verdict.kind === 'allow' ? verdict.language : (resolveLanguage(guardian, preferences, school) ?? 'English');

        if (!blockReason && !canNameChild(student, language)) {
            // The child cannot be named in this parent's language: nothing is created and a person is told.
            missingNames.add(language);
            continue;
        }
        const intent: Intent = {
            id,
            dedupeKey,
            orgId,
            campaignId: null,
            proposalId: proposal.id,
            purpose: proposal.purpose,
            guardianId: guardian.id,
            studentIds: [student.id],
            language,
            status: blockReason ? 'blocked' : 'approved',
            blockReason,
            attempts: 0,
            maxAttempts: attemptsAllowed,
            notBefore: earliest ? earliest.toISOString() : null,
            expiresAt: proposal.expiresAt,
            lastCallId: null,
            createdAt: nowIso,
            updatedAt: nowIso,
        };
        await repo.createIntentIfAbsent(intent);
        intentIds.push(id);
        if (blockReason) outcome.blocked.push({ guardianLabel: guardian.displayName, reason: blockReason, plain: `${guardian.displayName} ${BLOCK_REASON_PLAIN[blockReason]}.` });
        else outcome.dialable++;
    }

    proposal.intentIds = intentIds;
    proposal.notBefore = earliest ? earliest.toISOString() : null;
    if (outcome.dialable > 0) return finish('approved', null);

    const reasons: string[] = [];
    if (missingNames.size > 0) reasons.push(`The school has no reviewed spoken first name for this child in ${[...missingNames].join(', ')}.`);
    reasons.push(...outcome.blocked.map((b) => b.plain));
    outcome.needsAttention = `No parent can be called automatically. ${reasons.join(' ')} Please phone the family.`.trim();
    return finish('needs_attention', outcome.needsAttention);
}

async function loadForDecision(ctx: ProposalCtx, orgId: string, id: string, actorInfo: { actor: ApprovalActor; assignments: RoleAssignment[] }) {
    const proposal = await ctx.rules.getProposal(orgId, id);
    if (!proposal) throw notFound('PROPOSAL_NOT_FOUND', 'Proposal not found');
    const decision = canApprove(actorInfo.actor, proposal.purpose, proposal.section, actorInfo.assignments);
    if (!decision.allowed) throw forbidden('APPROVAL_FORBIDDEN', decision.reason ?? 'You cannot decide this proposal.');
    if (proposal.status !== 'pending') throw conflict('PROPOSAL_NOT_PENDING', `This proposal is already ${proposal.status.replace('_', ' ')}.`);
    return { proposal, via: decision.via! };
}

export async function approveProposal(ctx: ProposalCtx, orgId: string, id: string, who: { uid: string; isOrgAdmin: boolean }): Promise<ApprovalOutcome> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const info = await actorFor(ctx, orgId, who.uid, who.isOrgAdmin);
    const { proposal, via } = await loadForDecision(ctx, orgId, id, info);
    if (Date.parse(proposal.expiresAt) < ctx.clock.now().getTime()) {
        await ctx.rules.updateProposal(orgId, id, { status: 'expired', decisionNote: 'Expired before anyone acted.', updatedAt: ctx.clock.now().toISOString() });
        throw conflict('PROPOSAL_EXPIRED', 'This proposal has expired; it will be proposed again if the situation continues.');
    }
    const student = (await ctx.repo.listStudents(orgId)).find((s) => s.id === proposal.studentId);
    return materialiseApproval(ctx, school, proposal, student, { decidedBy: who.uid, via, note: null });
}

async function closeProposal(ctx: ProposalCtx, orgId: string, id: string, who: { uid: string; isOrgAdmin: boolean }, status: 'dismissed' | 'handled_by_person', note: string | null): Promise<Proposal> {
    const info = await actorFor(ctx, orgId, who.uid, who.isOrgAdmin);
    const { proposal } = await loadForDecision(ctx, orgId, id, info);
    const nowIso = ctx.clock.now().toISOString();
    const patch: Partial<Proposal> = { status, decidedBy: who.uid, decidedAt: nowIso, decisionNote: note, updatedAt: nowIso };
    await ctx.rules.updateProposal(orgId, id, patch);
    await ctx.repo.appendAudit(orgId, { at: nowIso, actor: who.uid, action: status === 'dismissed' ? 'proposal.dismiss' : 'proposal.handled_by_person', target: `proposal/${id}`, detail: { purpose: proposal.purpose, studentId: proposal.studentId } });
    return { ...proposal, ...patch } as Proposal;
}

/** "Not now": never resurrected (the proposal id is create-only). */
export const dismissProposal = (ctx: ProposalCtx, orgId: string, id: string, who: { uid: string; isOrgAdmin: boolean }, note: string | null = null) => closeProposal(ctx, orgId, id, who, 'dismissed', note);
/** "I'll call myself". */
export const handleProposalMyself = (ctx: ProposalCtx, orgId: string, id: string, who: { uid: string; isOrgAdmin: boolean }) => closeProposal(ctx, orgId, id, who, 'handled_by_person', null);

// ── A2: the class teacher's one tap per class per day ───────────────────────

export async function confirmClassAbsences(ctx: ProposalCtx, orgId: string, section: SectionRef, who: { uid: string; isOrgAdmin: boolean }): Promise<{ confirmed: boolean; summary: RunSummary }> {
    const info = await actorFor(ctx, orgId, who.uid, who.isOrgAdmin);
    const decision = canApprove(info.actor, 'absence_today', section, info.assignments);
    if (!decision.allowed) throw forbidden('APPROVAL_FORBIDDEN', decision.reason ?? 'You cannot confirm absences for this class.');
    const adoption = await ctx.rules.getCurrentAdoption(orgId, 'absence_today');
    if (!adoption || adoption.status !== 'adopted') throw conflict('RULE_NOT_ADOPTED', 'The same-day absence rule has not been adopted by the school.');

    const now = ctx.clock.now();
    const date = istDate(now);
    const letter = String(section.section).toUpperCase();
    const confirmation: ClassConfirmation = { id: `${date}|${section.grade}${letter}`, orgId, date, grade: section.grade, section: letter, confirmedBy: who.uid, confirmedAt: now.toISOString() };
    const confirmed = await ctx.rules.createClassConfirmationIfAbsent(confirmation);
    await ctx.repo.appendAudit(orgId, { at: now.toISOString(), actor: who.uid, action: 'absence.class_confirmed', target: `class/${section.grade}${letter}`, detail: { date, firstTap: confirmed } });
    // Only A2 runs here, and only this class's drafts matter; others are idempotent (create-only).
    const summary = await runRules(ctx, orgId, { only: ['absence_today'], actor: who.uid });
    return { confirmed, summary };
}

// ── A2 paging ───────────────────────────────────────────────────────────────

/** Page the class teacher and principal for every A2 call that ended with key 2 or no answer. */
export async function processAbsencePages(ctx: ProposalCtx, orgId: string): Promise<{ created: number }> {
    const proposals = (await ctx.rules.listProposals(orgId)).filter((p) => p.purpose === 'absence_today' && p.status === 'approved');
    let created = 0;
    for (const p of proposals) {
        for (const intentId of p.intentIds) {
            const intent = await ctx.repo.getIntent(orgId, intentId);
            if (!intent?.lastCallId) continue;
            const call = await ctx.repo.getCall(orgId, intent.lastCallId);
            if (!call) continue;
            const page = buildPage({ orgId, proposalId: p.id, call, studentId: p.studentId, decision: pagingFor(call), now: ctx.clock.now() });
            if (page && (await ctx.rules.createPageIfAbsent(page))) {
                created++;
                await ctx.repo.appendAudit(orgId, { at: page.createdAt, actor: 'system', action: 'page.created', target: `page/${page.id}`, detail: { reason: page.reason, studentId: p.studentId } });
            }
        }
    }
    return { created };
}

export async function listPages(ctx: ProposalCtx, orgId: string, status?: Page['status']): Promise<Page[]> {
    return ctx.rules.listPages(orgId, status ? { status } : undefined);
}

export async function acknowledgePage(ctx: ProposalCtx, orgId: string, pageId: string, who: { uid: string; isOrgAdmin: boolean }): Promise<Page> {
    const info = await actorFor(ctx, orgId, who.uid, who.isOrgAdmin);
    const page = await ctx.rules.getPage(orgId, pageId);
    if (!page) throw notFound('PAGE_NOT_FOUND', 'Page not found');
    const student = (await ctx.repo.listStudents(orgId)).find((s) => s.id === page.studentId);
    const section = student ? { grade: student.grade, section: student.section } : null;
    // Whoever may approve A2 for this class (its class teacher, the principal) may acknowledge the page.
    if (!canApprove(info.actor, 'absence_today', section, info.assignments).allowed) throw forbidden('PAGE_FORBIDDEN', 'Only the class teacher or the principal can acknowledge this page.');
    const patch = { status: 'acknowledged' as const, acknowledgedBy: who.uid, updatedAt: ctx.clock.now().toISOString() };
    await ctx.rules.updatePage(orgId, pageId, patch);
    return { ...page, ...patch };
}

// ── Queue for the console ───────────────────────────────────────────────────

export interface ProposalPreview {
    language: ParentLanguage;
    clips: { kind: string; text: string }[] | null;
    problem: string | null;
}

export interface ProposalView {
    proposal: Proposal;
    studentName: string;
    section: string;
    approverLabel: string;
    canDecide: boolean;
    previews: ProposalPreview[];
}

export async function listProposalViews(ctx: ProposalCtx, orgId: string, who: { uid: string; isOrgAdmin: boolean }, filter: { status?: Proposal['status'] } = {}): Promise<ProposalView[]> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const info = await actorFor(ctx, orgId, who.uid, who.isOrgAdmin);
    const students = new Map((await ctx.repo.listStudents(orgId)).map((s) => [s.id, s]));
    const proposals = await ctx.rules.listProposals(orgId, filter.status ? { status: filter.status } : undefined);
    const views: ProposalView[] = [];
    for (const proposal of proposals) {
        const decision = canApprove(info.actor, proposal.purpose, proposal.section, info.assignments);
        if (!decision.allowed) continue; // each person sees only their own work
        const student = students.get(proposal.studentId);
        const previews: ProposalPreview[] = PARENT_LANGUAGES.map((language) => {
            if (!student || !isChildPurpose(proposal.purpose)) return { language, clips: null, problem: 'No preview available' };
            try {
                const rendered = renderChildScript({ purpose: proposal.purpose, language, school, student, facts: proposal.facts });
                return { language, clips: rendered.clips.filter((c) => c.kind === 'listener_check' || c.kind === 'message').map((c) => ({ kind: c.kind, text: c.text })), problem: null };
            } catch (err) {
                return { language, clips: null, problem: err instanceof ScriptRenderError ? err.message : 'Preview failed' };
            }
        });
        views.push({
            proposal,
            studentName: student?.displayName ?? proposal.studentId,
            section: `${proposal.section.grade}${proposal.section.section}`,
            approverLabel: String(proposal.approverRole).replace('_', ' '),
            canDecide: true,
            previews,
        });
    }
    return views;
}

// ── Backtest ────────────────────────────────────────────────────────────────

export async function backtestSchool(
    ctx: ProposalCtx,
    orgId: string,
    input: { weeks?: number; endDate?: string; thresholds?: Record<string, unknown> } = {},
): Promise<Backtest> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const [students, load] = await Promise.all([ctx.repo.listStudents(orgId), ctx.loadSignals(school)]);
    const proposed: NonNullable<Parameters<typeof runBacktest>[0]['thresholds']> = {};
    for (const [rule, raw] of Object.entries(input.thresholds ?? {})) {
        if (!isRuleId(rule)) throw badRequest('UNKNOWN_RULE', `Unknown rule "${rule}"`);
        const parsed = parseThresholds(rule, raw);
        if (!parsed.ok) throw badRequest('INVALID_THRESHOLDS', parsed.message);
        (proposed as Record<string, unknown>)[rule] = parsed.value;
    }
    const weeks = Math.min(Math.max(input.weeks ?? 5, 1), 20);
    const end = input.endDate ?? istDate(ctx.clock.now());
    return runBacktest({ students, signals: load.signals, asOfDates: weeklyDates(end, weeks), thresholds: proposed });
}

