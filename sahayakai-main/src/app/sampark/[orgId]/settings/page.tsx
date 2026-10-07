"use client";

import { CallingWindowSection, SchoolProfileSection, VenuesSection } from "@/components/sampark/settings-school";
import { CrmSection } from "@/components/sampark/settings-crm";
import { ModeSection } from "@/components/sampark/settings-mode";

/** Settings: school name, spoken names, calling hours, holidays, venues, default language, school records, mode. */
export default function SamparkSettingsPage() {
    return (
        <div className="space-y-6">
            <ModeSection />
            <CrmSection />
            <SchoolProfileSection />
            <CallingWindowSection />
            <VenuesSection />
        </div>
    );
}
