"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CampaignsPage } from "@/components/sampark/demo/role-pages";

export default function DemoTeacherOutreachPage() {
    return <DemoRoleGate role="teacher">{(view) => <CampaignsPage view={view} />}</DemoRoleGate>;
}
