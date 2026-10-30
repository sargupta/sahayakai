"use client";

import { getSchool } from "@/lib/api/sampark";
import { RiyaCallPanel } from "@/components/sampark/riya-call-panel";
import { SamparkSchoolProvider } from "@/components/sampark/school-context";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";

/**
 * A real Riya call to one Sargvision roster contact, from the demo's teacher or principal views.
 * It is the Sampark console's own Riya panel (purpose, facts, preview, confirmation, history and
 * "Check status") on the local school `sargvision-local`, fixed to this contact. The server checks
 * sign-in, school admin authority, the roster rules and the allow-list; nothing rings until the
 * person confirms "Place call".
 */
export function SargvisionRiyaCall({ orgId, guardianId, studentId }: { orgId: string; guardianId: string; studentId: string }) {
    const school = useSamparkQuery((signal) => getSchool(orgId, { signal }), [orgId]);
    if (school.error) return <ErrorPanel error={school.error} onRetry={school.reload} />;
    if (!school.data) return <LoadingBlock rows={4} />;
    return (
        <SamparkSchoolProvider value={{ orgId, school: school.data, setSchool: () => school.reload(), reloadSchool: school.reload }}>
            <RiyaCallPanel fixedFamily={{ guardianId, studentId }} />
        </SamparkSchoolProvider>
    );
}
