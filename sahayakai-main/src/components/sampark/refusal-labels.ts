/**
 * Every refusal, blocker and wait code the SamparkAI console can receive, in plain words.
 *
 * These are all the UI maps that turn a server code into text for staff:
 *   - refusalText       RiyaRefusal: the Riya call panel and class-wide outreach previews
 *   - riyaBlockerLabel  RiyaBlocker: PROVIDER_UNAVAILABLE refusals and the Riya availability line
 *   - callbackRefusalLabel  CallbackRefusal: the callback scheduling dialogs
 *   - batchBlockerLabel     BatchBlocker: why a class-wide batch cannot start
 *   - batchExclusionLabel   BatchExclusionReason: why one family is left out of a batch
 *   - batchWaitingLabel / batchPauseLabel: why a running batch is waiting or paused
 * GATE_BLOCKED reasons go through blockReasonLabel in ./labels.
 *
 * Each label is a string literal passed straight to t(), so Gate 9 sees the key and the ten
 * locale files carry it. A code never reaches the screen raw. The union-typed switches end in a `never` check:
 * a new server code without words here fails `tsc`. At run time an unknown code (a newer
 * server) gets a generic translated sentence, never the code itself.
 *
 * Class gate: src/__tests__/sampark/gate-refusal-labels-every-code-every-locale.test.ts reads
 * every code from the server source and checks that each one has its own label here, with a
 * key present in all ten locale files.
 */
import type { CallbackPreview } from "@/lib/api/sampark-callbacks";
import type { BatchPreview } from "@/lib/api/sampark-batch";
import type { RiyaAvailability, RiyaPreview } from "@/lib/api/sampark-riya";
import { BATCH_MAX_RECIPIENTS, type BatchExclusionReason } from "@/lib/sampark/batch/types";
import { blockReasonLabel, fmt, type Translate } from "./labels";

export type RiyaRefusalView = RiyaPreview["refusals"][number];
export type RiyaBlockerCode = NonNullable<RiyaAvailability["blocker"]>;
export type CallbackRefusalCode = CallbackPreview["refusals"][number]["code"];
export type BatchBlockerCode = BatchPreview["blockers"][number]["code"];

// ── Riya ─────────────────────────────────────────────────────────────────────

/** Why Riya cannot place real calls for this school on this deployment. */
export function riyaBlockerLabel(t: Translate, blocker: RiyaBlockerCode): string {
    switch (blocker) {
        case "RIYA_DISABLED": return t("Riya calling is not switched on for this deployment.");
        case "LIVE_MODE_NOT_AVAILABLE": return t("Riya calls run only in Practice or Test mode in this release.");
        case "LIVE_DIAL_DISABLED": return t("Real calls are switched off on this deployment.");
        case "ELEVENLABS_UNCONFIGURED": return t("The ElevenLabs voice agent is not set up on this deployment.");
        case "VOBIZ_UNCONFIGURED": return t("Vobiz calling is not set up on this deployment.");
        case "NONPROD_DATABASE_REQUIRED": return t("Riya test calls need the separate test database on this deployment.");
        case "DEMO_SCHOOL_PRACTICE_ONLY": return t("This is a demo school, so Riya calls stay in Practice. Real test calls need a non-demo school.");
        case "TEST_PHONE_MISSING": return t("Test mode needs a test phone number for this school.");
        case "TEST_PHONE_NOT_ALLOWED": return t("The saved test phone is not on this deployment's list of numbers Riya may call.");
        default: {
            const unhandled: never = blocker;
            void unhandled;
            return t("Riya cannot place calls yet.");
        }
    }
}

/** Why one Riya call cannot be placed (preview and class-wide outreach). */
export function refusalText(t: Translate, r: RiyaRefusalView): string {
    switch (r.code) {
        case "PURPOSE_NOT_ENABLED": return t("This workflow is not switched on yet.");
        case "PAGING_REQUIRED": return t("Same-day absence calls alert staff first. Staff alerts are not set up yet, so only Practice calls can run.");
        case "ELEVENLABS_REQUEST_TO_TALK_UNVERIFIED": return t("Calls asking a parent to speak with the class teacher cannot run on ElevenLabs until its voice agent is updated. Use Practice or Vobiz.");
        case "FACTS_REQUIRED": return t("Enter the details for this call.");
        case "FACTS_INVALID": return t("Some details are missing, in the past, or not on the school calendar.");
        case "CAMPAIGN_FACTS_UNAVAILABLE": return t("That campaign has no details for this workflow.");
        case "NOT_GUARDIAN_OF_RECORD": return t("This person is not a guardian of record for that student.");
        case "STUDENT_INACTIVE": return t("That student is no longer active in the school records.");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school.");
        case "GATE_BLOCKED": return blockReasonLabel(t, r.reason);
        case "OUTSIDE_CALLING_HOURS": return t("Outside the school calling hours.");
        case "RECORDING_CONSENT_REQUIRED": return t("This parent has not agreed to recorded calls.");
        case "LANGUAGE_NOT_SUPPORTED": return t("Riya speaks English only; this parent is called in another language.");
        // The server's message is English free text; the blocker code is what carries the reason.
        case "PROVIDER_UNAVAILABLE": return riyaBlockerLabel(t, r.blocker);
        case "NUMBER_NOT_ALLOWED": return t("This contact's number is not on the list of numbers Riya may call here.");
        default: {
            const unhandled: never = r;
            void unhandled;
            return t("This call is not allowed.");
        }
    }
}

// ── Callbacks ────────────────────────────────────────────────────────────────

/** Why a callback cannot be booked for the chosen time (Schedule / Change time dialogs). */
export function callbackRefusalLabel(t: Translate, code: CallbackRefusalCode): string {
    switch (code) {
        case "OUTSIDE_CALLING_HOURS": return t("Outside the school's calling hours");
        case "TOO_SOON": return t("Choose a time at least a minute from now");
        case "TOO_FAR": return t("Callbacks can be up to 30 days ahead");
        case "CALLBACKS_PRACTICE_ONLY": return t("Scheduled callbacks run in Practice mode only for now");
        case "GATE_BLOCKED": return t("This parent cannot be called then (opt-out, consent or call limits)");
        case "RECORDING_CONSENT_REQUIRED": return t("This parent has not agreed to recorded calls");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school");
        case "FACTS_INVALID": return t("The call's details are no longer valid at that time");
        case "PROVIDER_UNAVAILABLE": return t("Riya calls are not available right now");
        case "LANGUAGE_NOT_SUPPORTED": return t("Riya cannot call this parent in their language");
        case "PURPOSE_NOT_ENABLED": return t("This kind of call is not switched on yet");
        // The callback preview does not follow the provider cookie, so "use Practice or Vobiz"
        // advice from the Riya panel does not apply here.
        case "PAGING_REQUIRED": return t("Same-day absence callbacks need staff alerts, which are not set up yet");
        case "ELEVENLABS_REQUEST_TO_TALK_UNVERIFIED": return t("This callback cannot run on ElevenLabs until its voice agent only asks the parent to speak with the class teacher");
        case "FACTS_REQUIRED": return t("The details for this call are missing");
        case "CAMPAIGN_FACTS_UNAVAILABLE": return t("The campaign behind this call has no details for it");
        case "NOT_GUARDIAN_OF_RECORD": return t("This person is no longer a guardian of record for the student");
        case "STUDENT_INACTIVE": return t("The student is no longer active in the school records");
        case "NUMBER_NOT_ALLOWED": return t("This parent's number is not on the list of numbers Riya may call here");
        default: {
            const unhandled: never = code;
            void unhandled;
            return t("This callback cannot be scheduled at that time");
        }
    }
}

// ── Class-wide batches ───────────────────────────────────────────────────────

/** Why a class-wide batch cannot start at all. */
export function batchBlockerLabel(t: Translate, code: BatchBlockerCode): string {
    switch (code) {
        case "RIYA_DISABLED": return t("Riya calling is not switched on for this deployment.");
        case "NOT_BATCHABLE": return t("This kind of call is about one child, so it stays an individual call.");
        case "REASON_NOT_AVAILABLE": return t("Riya has no approved wording for this reason yet.");
        case "PURPOSE_MISMATCH": return t("The details do not match the chosen reason.");
        case "BATCH_PROVIDER_NOT_SUPPORTED": return t("Class-wide calls run on Vobiz. ElevenLabs is selected, so no real class-wide call is placed, and calls are never moved to Vobiz without your choice.");
        case "BATCH_NEEDS_OWN_NUMBERS": return t("Real class-wide calls need each family's own permitted number. In this school's Test mode, calls ring only the one test phone.");
        case "REAL_BATCH_DISABLED": return t("Real class-wide calls are switched off on this deployment.");
        case "NO_ELIGIBLE_RECIPIENTS": return t("No family in this class can be called for this announcement.");
        case "TOO_MANY_RECIPIENTS": return fmt(t("A class-wide call can reach at most {max} families."), { max: BATCH_MAX_RECIPIENTS });
        case "CAMPAIGN_REFUSED": return t("The calling rules do not allow this announcement.");
        default: {
            const unhandled: never = code;
            void unhandled;
            return t("This batch cannot start.");
        }
    }
}

/** Why one family is not called in a class-wide batch. */
export function batchExclusionLabel(t: Translate, r: BatchExclusionReason): string {
    switch (r) {
        case "missing_phone": return t("Missing or invalid phone number");
        case "opted_out": return t("Opted out / do not call");
        case "no_consent": return t("No consent for recorded calls");
        case "not_allow_listed": return t("Not on the real-call allow-list");
        case "language": return t("Riya speaks English only");
        case "inactive": return t("Not active in school records");
        case "sensitive": return t("Restricted: the office contacts this family");
        case "frequency_cap": return t("Called too often recently");
        case "same_family": return t("Same parent as another child here (one call per family)");
        case "already_called": return t("Already called about this");
        case "teacher_excluded": return t("Removed by you");
        case "not_permitted": return t("Not allowed by the calling rules");
        default: {
            const unhandled: never = r;
            void unhandled;
            return t("This family is not called in this batch");
        }
    }
}

/**
 * Why a running batch is not dialling right now. The server stores these as plain strings
 * (BatchCampaign.waitingReason, BatchPreview.waiting.code), so there is no union to check
 * here; the class gate reads every code the batch service sets and requires a case for it.
 */
export function batchWaitingLabel(t: Translate, code: string | null): string | null {
    switch (code) {
        case null: return null;
        case "OUTSIDE_CALLING_HOURS": return t("Waiting for the school calling hours. Calls start automatically when the window opens.");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school. Calls start when the school pause is lifted.");
        case "REAL_BATCH_DISABLED": return t("Real class-wide calls are switched off on this deployment.");
        case "DAILY_LIMIT_REACHED": return t("Today's limit for class-wide calls has been reached. Calls continue tomorrow.");
        case "CONCURRENCY_FULL": return t("Every calling slot is busy. The next family is called as soon as one of these calls ends.");
        case "WAITING_FOR_INTERVAL": return t("Waiting for the minimum gap between calls.");
        case "PROVIDER_RATE_LIMITED": return t("The calling service asked us to slow down. Calls continue automatically after a short wait.");
        default: return t("Calls are waiting and start automatically when they are allowed.");
    }
}

/** Why a batch is paused (BatchCampaign.pauseReason, a plain string on the server). */
export function batchPauseLabel(t: Translate, code: string | null): string | null {
    switch (code) {
        case null: return null;
        case "PAUSED_BY_STAFF": return t("Paused. Calls already ringing finish; no new calls start until you resume.");
        case "CREATOR_NOT_AUTHORISED": return t("Paused: the person who started it no longer manages this class.");
        case "PROVIDER_CHANGED": return t("Paused: the school's calling provider or mode changed since the start.");
        default: return t("Paused. No new calls start until the batch is resumed.");
    }
}
