"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CalendarPage } from "@/components/sampark/demo/role-pages";

export default function DemoAdminCalendarPage() {
    return <DemoRoleGate role="admin">{(view) => <CalendarPage view={view} />}</DemoRoleGate>;
}
