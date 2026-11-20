"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { FollowUpsPage } from "@/components/sampark/demo/role-pages";

export default function DemoTeacherFollowUpsPage() {
    return <DemoRoleGate role="teacher">{(view) => <FollowUpsPage view={view} />}</DemoRoleGate>;
}
