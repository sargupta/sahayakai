"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CampaignsPage } from "@/components/sampark/demo/role-pages";

export default function DemoAdminCampaignsPage() {
    return <DemoRoleGate role="admin">{(view) => <CampaignsPage view={view} />}</DemoRoleGate>;
}
