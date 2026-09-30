"use client";

import { useCallback } from "react";
import { useLanguage } from "@/context/language-context";
import type { Campaign, CampaignAudience, CampaignFacts, SamparkSchool } from "@/types/sampark";
import { useSamparkFormat } from "./format";
import { closureReasonLabel, eventTypeLabel, fmt } from "./labels";

/** Venue name for the console: English, since that is how the office entered it first. */
export function venueName(school: SamparkSchool | null | undefined, venueId: string): string {
    const venue = school?.venues.find((v) => v.id === venueId);
    if (!venue) return venueId;
    return venue.names.English || venue.names.Hindi || venue.names.Bengali || venue.names.Nepali || venueId;
}

/** One-line descriptions of a campaign's facts and audience, in the teacher's language. */
export function useCampaignSummary() {
    const { t } = useLanguage();
    const f = useSamparkFormat();

    const facts = useCallback(
        (facts: CampaignFacts, school: SamparkSchool | null | undefined): string => {
            switch (facts.kind) {
                case "ptm_invite":
                    return [f.day(facts.date), f.spokenTime(facts.time), venueName(school, facts.venueId)].join(" · ");
                case "event_invite":
                    return [eventTypeLabel(t, facts.eventType), f.day(facts.date), f.spokenTime(facts.time), venueName(school, facts.venueId)].join(" · ");
                case "emergency_closure":
                    return [
                        fmt(t("Closed on {date}"), { date: f.day(facts.date) }),
                        closureReasonLabel(t, facts.reason),
                        facts.busesRunning ? t("Buses running") : t("No buses"),
                    ].join(" · ");
                default:
                    return "";
            }
        },
        [t, f],
    );

    const audience = useCallback(
        (a: CampaignAudience): string => {
            if (a.sections.length === 0) return t("Whole school");
            if (a.sections.length === 1) {
                const [only] = a.sections;
                return fmt(t("Class {grade}{section}"), { grade: only.grade, section: only.section });
            }
            const labels = [...a.sections]
                .sort((x, y) => x.grade - y.grade || x.section.localeCompare(y.section))
                .map((s) => `${s.grade}${s.section}`);
            const shown = labels.slice(0, 6).join(", ");
            return labels.length > 6
                ? fmt(t("Classes {list} and {count} more"), { list: shown, count: labels.length - 6 })
                : fmt(t("Classes {list}"), { list: shown });
        },
        [t],
    );

    const describe = useCallback(
        (c: Campaign, school: SamparkSchool | null | undefined) => ({ facts: facts(c.facts, school), audience: audience(c.audience) }),
        [facts, audience],
    );

    return { facts, audience, describe };
}
