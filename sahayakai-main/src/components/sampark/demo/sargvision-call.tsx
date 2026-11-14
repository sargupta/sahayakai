"use client";

import { getSchool } from "@/lib/api/sampark";
import { ClassOutreachButton } from "@/components/sampark/class-outreach";
import { RiyaCallPanel } from "@/components/sampark/riya-call-panel";
import { SamparkSchoolProvider } from "@/components/sampark/school-context";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import type { OutreachReason } from "@/types/attendance";

/**
 * A real Riya call to one Sargvision roster contact, from the demo's teacher or principal views.
 * It is the Sampark console's own Riya panel (purpose, facts, preview, confirmation, history and
 * "Check status") on the local school `sargvision-local`, fixed to this contact. The server checks
 * sign-in, school admin authority, the roster rules and the allow-list; nothing rings until the
 * person confirms "Trigger Call". `reason` is the outreach reason the dialog was opened with (or
 * null); the panel lists the four outreach reasons first and pre-selects that one.
 */
export function SargvisionRiyaCall({ orgId, guardianId, studentId, reason = null }: { orgId: string; guardianId: string; studentId: string; reason?: OutreachReason | null }) {
    const school = useSamparkQuery((signal) => getSchool(orgId, { signal }), [orgId]);
    if (school.error) return <ErrorPanel error={school.error} onRetry={school.reload} />;
    if (!school.data) return <LoadingBlock rows={4} />;
    return (
        <SamparkSchoolProvider value={{ orgId, school: school.data, setSchool: () => school.reload(), reloadSchool: school.reload }}>
            <RiyaCallPanel fixedFamily={{ guardianId, studentId }} outreach={{ reason }} />
        </SamparkSchoolProvider>
    );
}

/**
 * Class-wide outreach for the Sargvision sample class from the demo's class page: the console's own
 * flow (reason, facts, review, confirmation, live campaign) on `sargvision-local`. Every call is a
 * normal Riya call through the server: the allow-list, consent, hours and caps apply to each one.
 */
export function SargvisionClassOutreach({ orgId, grade, section, label }: { orgId: string; grade: number; section: string; label: string }) {
    const school = useSamparkQuery((signal) => getSchool(orgId, { signal }), [orgId]);
    if (school.error) return <ErrorPanel error={school.error} onRetry={school.reload} />;
    if (!school.data) return null;
    return (
        <SamparkSchoolProvider value={{ orgId, school: school.data, setSchool: () => school.reload(), reloadSchool: school.reload }}>
            <ClassOutreachButton grade={grade} section={section} label={label} />
        </SamparkSchoolProvider>
    );
}
