"use client";

import { ClassOutreachSection } from "@/components/sampark/class-outreach";
import { RiyaCallPanel } from "@/components/sampark/riya-call-panel";

/**
 * /sampark/[orgId]/riya — calls by Riya, the school's AI calling assistant: class-wide outreach
 * (one general announcement, one call per family) and one-family calls.
 */
export default function RiyaPage() {
    return (
        <div className="space-y-6">
            <ClassOutreachSection />
            <RiyaCallPanel />
        </div>
    );
}
