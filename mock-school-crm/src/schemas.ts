/**
 * v1 DRAFT schemas for the parts of the CRM contract that slice 1 does not
 * import: holistic progress card entries, attendance, assessments, events,
 * meeting requests, incidents, and the write-back endpoints. They validate what
 * this service serves and accepts; the app will adopt (and may reshape) them in
 * the slices that use them. The slice-1 contract (school, students, guardians,
 * CSV) lives in ./contract/crm-schema.ts and is not redefined here.
 *
 * Confidentiality rule (plan §2E): anything confidential crosses the wire as a
 * REASON CODE, never as note text. Incidents have no free-text field at all
 * (the schema is strict), and nurse / counsellor card entries carry a reason
 * code with `note: null`.
 */

import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM (24h, IST)');
const languageCode = z.enum(['en', 'hi', 'bn', 'ne']);

// ── Holistic progress card (NCERT/PARAKH 2025) ───────────────────────────────

export const HPC_STAGES = ['foundational', 'preparatory', 'middle', 'secondary'] as const;
export const HPC_ABILITIES = ['awareness', 'sensitivity', 'creativity'] as const;
/** The card's official respondents. */
export const OFFICIAL_RESPONDENTS = ['teacher', 'self', 'peer', 'parent'] as const;
/** This school's extension: non-teaching staff observations, modelled separately so rules can treat them differently. */
export const STAFF_RESPONDENTS = ['bus_attendant', 'coach', 'librarian', 'nurse', 'counsellor'] as const;
export const RESPONDENT_TYPES = [...OFFICIAL_RESPONDENTS, ...STAFF_RESPONDENTS] as const;
/** Roles whose entries are confidential: reason code only, never note text. */
export const CONFIDENTIAL_RESPONDENTS = ['nurse', 'counsellor'] as const;
export const HPC_SENTIMENTS = ['positive', 'neutral', 'concern'] as const;
export const HPC_REASON_CODES = ['sick_bay_visit', 'first_aid', 'health_screening', 'counselling_session', 'wellbeing_check_in'] as const;

export const HpcUnitSchema = z.object({
    /** Foundational → domain; Preparatory and Middle → subject; Secondary → project. */
    kind: z.enum(['domain', 'subject', 'project']),
    id: z.string().min(1),
    name: z.string().min(1),
});

export const HpcEntrySchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        academicYear: z.string(),
        term: z.number().int().min(1).max(2),
        stage: z.enum(HPC_STAGES),
        grade: z.number().int().min(1).max(12),
        /** Null for general observations (all staff-extension entries). */
        unit: HpcUnitSchema.nullable(),
        ability: z.enum(HPC_ABILITIES).nullable(),
        /** Formative rating on the school's rubric scale; never evidence of misconduct. level 1..3 indexes school.rubricScale.labels. */
        rubric: z
            .object({ scaleId: z.string(), level: z.number().int().min(1).max(3), label: z.string() })
            .nullable(),
        respondent: z.object({
            type: z.enum(RESPONDENT_TYPES),
            /** True for the card's own respondents (teacher/self/peer/parent); false for the school-extension staff roles. */
            official: z.boolean(),
        }),
        sentiment: z.enum(HPC_SENTIMENTS),
        /** Short English note for teacher and non-confidential staff entries; null for self/peer/parent and confidential roles. */
        note: z.string().max(280).nullable(),
        confidential: z.boolean(),
        reasonCode: z.enum(HPC_REASON_CODES).nullable(),
        observedOn: isoDate,
        createdAt: isoDateTime,
        updatedAt: isoDateTime,
    })
    .strict()
    .superRefine((entry, ctx) => {
        if (entry.confidential && entry.note !== null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'confidential entries carry a reason code, never note text', path: ['note'] });
        }
        const official = (OFFICIAL_RESPONDENTS as readonly string[]).includes(entry.respondent.type);
        if (official !== entry.respondent.official) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'respondent.official must match the respondent type', path: ['respondent', 'official'] });
        }
        if ((CONFIDENTIAL_RESPONDENTS as readonly string[]).includes(entry.respondent.type) && !entry.confidential) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nurse and counsellor entries must be confidential', path: ['confidential'] });
        }
    });
export type HpcEntry = z.infer<typeof HpcEntrySchema>;

// ── Attendance ───────────────────────────────────────────────────────────────

export const AttendanceRecordSchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        grade: z.number().int().min(1).max(12),
        section: z.string().regex(/^[A-Z]$/),
        date: isoDate,
        status: z.enum(['present', 'absent', 'late', 'on_leave']),
        /** A written leave note reached the class teacher (CBSE requires leave in writing). */
        leaveNote: z.boolean(),
        markedAt: isoDateTime,
        updatedAt: isoDateTime,
    })
    .strict();
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

// ── Assessments ──────────────────────────────────────────────────────────────

export const AssessmentRecordSchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        grade: z.number().int().min(1).max(12),
        subjectId: z.string().min(1),
        subjectName: z.string().min(1),
        /** PT1, PT2 (periodic tests), HY (half-yearly). */
        assessmentId: z.string().min(1),
        assessmentName: z.string().min(1),
        date: isoDate,
        maxMarks: z.number().int().positive(),
        /** Null when the student did not sit the test: a missed test is never scored as zero. */
        marks: z.number().min(0).nullable(),
        status: z.enum(['scored', 'absent', 'exempt']),
        updatedAt: isoDateTime,
    })
    .strict()
    .superRefine((row, ctx) => {
        if ((row.status === 'scored') !== (row.marks !== null)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'marks are set exactly when status is scored', path: ['marks'] });
        }
        if (row.marks !== null && row.marks > row.maxMarks) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'marks exceed maxMarks', path: ['marks'] });
        }
    });
export type AssessmentRecord = z.infer<typeof AssessmentRecordSchema>;

// ── Events ───────────────────────────────────────────────────────────────────

export const EVENT_KINDS = ['ptm', 'annual_day', 'closure', 'holiday', 'exam', 'sports_day', 'health_camp', 'other'] as const;
export const CLOSURE_REASONS = ['heavy_rain', 'landslide', 'bandh', 'other'] as const;

export const EventAudienceSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('school') }),
    z.object({
        kind: z.literal('sections'),
        sections: z.array(z.object({ grade: z.number().int().min(1).max(12), section: z.string().regex(/^[A-Z]$/) })).min(1),
    }),
]);

export const SchoolEventSchema = z
    .object({
        id: z.string().min(1),
        kind: z.enum(EVENT_KINDS),
        title: z.string().min(1),
        audience: EventAudienceSchema,
        date: isoDate,
        startTime: hhmm.nullable(),
        endTime: hhmm.nullable(),
        venueId: z.string().nullable(),
        venueName: z.string().nullable(),
        closure: z
            .object({ reason: z.enum(CLOSURE_REASONS), emergency: z.boolean(), declaredAt: isoDateTime })
            .nullable(),
        status: z.enum(['draft', 'published', 'cancelled']),
        rsvpEnabled: z.boolean(),
        publishedAt: isoDateTime.nullable(),
        updatedAt: isoDateTime,
    })
    .strict()
    .superRefine((event, ctx) => {
        if ((event.kind === 'closure') !== (event.closure !== null)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'closure details are set exactly when kind is closure', path: ['closure'] });
        }
    });
export type SchoolEvent = z.infer<typeof SchoolEventSchema>;

// ── Meeting requests ─────────────────────────────────────────────────────────

export const MEETING_REASON_CODES = ['academic_progress', 'attendance', 'general_progress', 'conduct', 'wellbeing', 'admission_query'] as const;

export const MeetingRequestSchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        guardianId: z.string().min(1),
        requestedByRole: z.enum(['class_teacher', 'coordinator', 'principal', 'counsellor', 'parent']),
        /** Reason code only, never note text. */
        reasonCode: z.enum(MEETING_REASON_CODES),
        status: z.enum(['requested', 'scheduled', 'completed', 'cancelled']),
        proposedSlots: z.array(isoDateTime),
        scheduledFor: isoDateTime.nullable(),
        createdAt: isoDateTime,
        updatedAt: isoDateTime,
    })
    .strict();
export type MeetingRequest = z.infer<typeof MeetingRequestSchema>;

// ── Incidents (reason codes only) ────────────────────────────────────────────

export const INCIDENT_REASON_CODES = [
    'minor_injury',
    'illness_sent_home',
    'late_pickup',
    'bus_conduct',
    'property_damage',
    'bullying_reported',
    'uniform_non_compliance',
] as const;

export const IncidentSchema = z
    .object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        occurredAt: isoDateTime,
        reasonCode: z.enum(INCIDENT_REASON_CODES),
        severity: z.enum(['low', 'medium', 'high']),
        reportedByRole: z.enum(['teacher', 'coordinator', 'principal', 'nurse', 'bus_attendant', 'coach', 'guard']),
        status: z.enum(['open', 'closed']),
        createdAt: isoDateTime,
        updatedAt: isoDateTime,
    })
    // strict: an incident has no free-text field, so a `note` can never leak through.
    .strict();
export type Incident = z.infer<typeof IncidentSchema>;

// ── Write-back ───────────────────────────────────────────────────────────────

export const CommunicationInputSchema = z
    .object({
        /** The caller's own id for this communication (e.g. its call id). Idempotency key. */
        externalId: z.string().min(1).max(200),
        channel: z.enum(['voice_call', 'sms', 'whatsapp', 'other']),
        direction: z.enum(['outbound', 'inbound']).default('outbound'),
        guardianId: z.string().min(1),
        studentIds: z.array(z.string().min(1)).default([]),
        purpose: z.string().min(1).max(100),
        campaignExternalId: z.string().max(200).nullable().default(null),
        language: languageCode.nullable().default(null),
        outcome: z.string().min(1).max(60),
        heardLevel: z.string().max(60).nullable().default(null),
        keysPressed: z.array(z.string().regex(/^[0-9*#]$/)).default([]),
        optOut: z.boolean().default(false),
        durationSeconds: z.number().min(0).nullable().default(null),
        occurredAt: isoDateTime,
    })
    .strict();
export type CommunicationInput = z.infer<typeof CommunicationInputSchema>;

export const CommunicationSchema = CommunicationInputSchema.extend({
    id: z.string().min(1),
    receivedAt: isoDateTime,
}).strict();
export type Communication = z.infer<typeof CommunicationSchema>;

export const RsvpInputSchema = z
    .object({
        guardianId: z.string().min(1),
        studentIds: z.array(z.string().min(1)).default([]),
        response: z.enum(['attending', 'not_attending', 'maybe', 'reschedule_requested']),
        channel: z.enum(['voice_call', 'sms', 'whatsapp', 'office', 'other']).default('voice_call'),
        externalId: z.string().max(200).nullable().default(null),
        respondedAt: isoDateTime,
    })
    .strict();

export const RsvpSchema = RsvpInputSchema.extend({
    id: z.string().min(1),
    eventId: z.string().min(1),
    updatedAt: isoDateTime,
}).strict();
export type Rsvp = z.infer<typeof RsvpSchema>;

export const GuardianPreferencesInputSchema = z.object({ doNotContact: z.boolean() }).strict();

// ── Webhook hints ────────────────────────────────────────────────────────────

export const WEBHOOK_EVENT_TYPES = [
    'hpc.entry.created',
    'attendance.marked',
    'event.published',
    'meeting.requested',
    'incident.logged',
    'guardian.updated',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_ENTITY_KINDS = ['hpc_entry', 'attendance', 'event', 'meeting', 'incident', 'guardian'] as const;

/** A hint only: the receiver pulls the entity by id and never trusts a body. So there is no record body here. */
export const WebhookEventSchema = z
    .object({
        id: z.string().min(1),
        type: z.enum(WEBHOOK_EVENT_TYPES),
        occurredAt: isoDateTime,
        entity: z.object({ kind: z.enum(WEBHOOK_ENTITY_KINDS), id: z.string().min(1) }).strict(),
    })
    .strict();
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
