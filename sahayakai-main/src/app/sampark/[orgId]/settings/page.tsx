"use client";

import { CallingWindowSection, SchoolProfileSection, VenuesSection } from "@/components/sampark/settings-school";
import { CarrierSection } from "@/components/sampark/settings-carrier";
import { CrmSection } from "@/components/sampark/settings-crm";
import { ModeSection } from "@/components/sampark/settings-mode";

/** Settings: school name, spoken names, calling hours, holidays, venues, default language, school records, calling number, mode. */
export default function SamparkSettingsPage() {
    return (
        <div className="space-y-6">
            <ModeSection />
            <CrmSection />
            <CarrierSection />
            <SchoolProfileSection />
            <CallingWindowSection />
            <VenuesSection />
        </div>
    );
}
