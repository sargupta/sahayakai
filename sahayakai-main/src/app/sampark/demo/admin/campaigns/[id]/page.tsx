"use client";

import { useParams } from "next/navigation";
import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CampaignDetailPage } from "@/components/sampark/demo/role-pages";

export default function DemoAdminCampaignPage() {
    const { id } = useParams<{ id: string }>();
    return <DemoRoleGate role="admin">{(view) => <CampaignDetailPage view={view} id={decodeURIComponent(id)} />}</DemoRoleGate>;
}
