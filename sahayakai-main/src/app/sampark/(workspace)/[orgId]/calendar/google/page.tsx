"use client";

import { GoogleCalendarPanel } from "@/components/sampark/calendar/google-calendar-panel";
import { useSamparkSchool } from "@/components/sampark/school-context";

/** SamparkAI workspace → Calendar → Google Calendar: the school's own Google calendar. */
export default function SamparkGoogleCalendarPage() {
    const { orgId } = useSamparkSchool();
    return <GoogleCalendarPanel orgId={orgId} />;
}
