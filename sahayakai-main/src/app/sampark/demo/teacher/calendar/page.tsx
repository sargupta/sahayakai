"use client";

import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CalendarPage } from "@/components/sampark/demo/role-pages";

export default function DemoTeacherCalendarPage() {
    return <DemoRoleGate role="teacher">{(view) => <CalendarPage view={view} />}</DemoRoleGate>;
}
