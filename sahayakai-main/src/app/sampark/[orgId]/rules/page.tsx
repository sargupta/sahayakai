"use client";

import { BacktestSection } from "@/components/sampark/backtest-section";
import { RolesSection } from "@/components/sampark/roles-section";
import { RulesSection } from "@/components/sampark/rules-section";
import { useSamparkSchool } from "@/components/sampark/school-context";

/** Rules the school adopts, the backtest that tunes them, and who approves what. Principal's screen (org admin). */
export default function SamparkRulesPage() {
    const { orgId } = useSamparkSchool();
    return (
        <div className="space-y-6">
            <BacktestSection orgId={orgId} />
            <RulesSection orgId={orgId} />
            <RolesSection orgId={orgId} />
        </div>
    );
}
