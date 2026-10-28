"use client";

import { SchoolCalendar } from "@/components/sampark/calendar/school-calendar";
import { useSamparkSchool } from "@/components/sampark/school-context";

/** SamparkAI workspace → Calendar: every scheduled call and school event. */
export default function SamparkCalendarPage() {
    const { orgId } = useSamparkSchool();
    return <SchoolCalendar orgId={orgId} />;
}
