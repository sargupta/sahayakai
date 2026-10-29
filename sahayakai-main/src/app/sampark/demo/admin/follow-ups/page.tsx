"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { FollowUpsPage } from "@/components/sampark/demo/role-pages";

export default function DemoAdminFollowUpsPage() {
    return <DemoRoleGate role="admin">{(view) => <FollowUpsPage view={view} />}</DemoRoleGate>;
}
