"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { availablePurposes } from "@/lib/sampark/catalogue";
import { MAX_GUARDIANS_PAGE, createCampaign, listGuardians, type GuardianRow } from "@/lib/api/sampark";
import type {
    CampaignAudience,
    CampaignFacts,
    ClosureReason,
    EventType,
    PurposeId,
} from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { useSamparkQuery } from "./use-sampark-query";
import { istToday, istTomorrow, pad2, useSamparkFormat } from "./format";
import { useCampaignSummary, venueName } from "./campaign-summary";
import { ErrorPanel, InlineSpinner, errorMessage } from "./states";
import {
    CLOSURE_REASONS,
    EVENT_TYPES,
    closureReasonLabel,
    eventTypeLabel,
    fmt,
    purposeDescription,
    purposeLabel,
} from "./labels";

type Step = 0 | 1 | 2 | 3;
const EVENT_HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 … 19:00

interface SectionKey { grade: number; section: string }
const sectionId = (s: SectionKey) => `${s.grade}|${s.section}`;

/** Grades and sections that actually have students, derived from the imported families. */
function sectionsFrom(guardians: GuardianRow[]): Map<number, string[]> {
    const byGrade = new Map<number, Set<string>>();
    for (const g of guardians) {
        for (const s of g.students) {
            if (!byGrade.has(s.grade)) byGrade.set(s.grade, new Set());
            byGrade.get(s.grade)!.add(s.section);
        }
    }
    return new Map(
        [...byGrade.entries()]
            .sort(([a], [b]) => a - b)
            .map(([grade, secs]) => [grade, [...secs].sort()]),
    );
}

function ChoiceChip({
    selected,
    onClick,
    children,
    disabled,
}: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex min-h-10 min-w-12 items-center justify-center gap-2 rounded-surface-md border px-3 py-2 text-sm font-medium leading-normal",
                "transition-colors duration-micro ease-out-quart",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
        >
            {selected && <Check aria-hidden="true" className="h-4 w-4" />}
            {children}
        </button>
    );
}

export function CampaignWizard() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const router = useRouter();
    const f = useSamparkFormat();
    const { orgId, school } = useSamparkSchool();
    const summary = useCampaignSummary();
    const base = `/sampark/${encodeURIComponent(orgId)}`;

    const purposes = useMemo(() => availablePurposes(), []);
    const [step, setStep] = useState<Step>(0);
    const [purpose, setPurpose] = useState<PurposeId | null>(null);

    // Audience
    const [wholeSchool, setWholeSchool] = useState(true);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const guardiansQuery = useSamparkQuery(
        step >= 1 ? (signal) => listGuardians(orgId, { limit: MAX_GUARDIANS_PAGE }, { signal }) : null,
        [orgId, step >= 1],
    );
    const sections = useMemo(() => sectionsFrom(guardiansQuery.data ?? []), [guardiansQuery.data]);

    // Facts
    const today = istToday();
    const [date, setDate] = useState<string>("");
    const [hour, setHour] = useState<number>(10);
    const [minute, setMinute] = useState<0 | 30>(0);
    const [venueId, setVenueId] = useState<string>(school.venues[0]?.id ?? "");
    const [eventType, setEventType] = useState<EventType | "">("");
    const [closureDay, setClosureDay] = useState<"today" | "tomorrow">("today");
    const [reason, setReason] = useState<ClosureReason | "">("");
    const [busesRunning, setBusesRunning] = useState<boolean>(false);
    const [creating, setCreating] = useState(false);

    const audience: CampaignAudience = useMemo(() => {
        if (wholeSchool) return { sections: [] };
        return {
            sections: [...picked].map((id) => {
                const [grade, section] = id.split("|");
                return { grade: Number(grade), section };
            }),
        };
    }, [wholeSchool, picked]);

    const facts: CampaignFacts | null = useMemo(() => {
        if (!purpose) return null;
        if (purpose === "ptm_invite") {
            if (!date || date < today || !venueId) return null;
            return { kind: "ptm_invite", date, time: { hour, minute }, venueId };
        }
        if (purpose === "event_invite") {
            if (!date || date < today || !venueId || !eventType) return null;
            return { kind: "event_invite", eventType, date, time: { hour, minute }, venueId };
        }
        if (purpose === "emergency_closure") {
            if (!reason) return null;
            return { kind: "emergency_closure", date: closureDay === "today" ? istToday() : istTomorrow(), reason, busesRunning };
        }
        return null;
    }, [purpose, date, today, venueId, hour, minute, eventType, reason, closureDay, busesRunning]);

    const needsVenue = purpose === "ptm_invite" || purpose === "event_invite";
    const noVenues = needsVenue && school.venues.length === 0;

    const canContinue =
        step === 0 ? purpose !== null :
        step === 1 ? wholeSchool || picked.size > 0 :
        step === 2 ? facts !== null :
        true;

    const togglePicked = (s: SectionKey) => {
        setPicked((prev) => {
            const next = new Set(prev);
            const id = sectionId(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const create = async () => {
        if (!purpose || !facts) return;
        setCreating(true);
        try {
            const campaign = await createCampaign(orgId, { purpose, facts, audience });
            toast({ title: t("Campaign created. Check what parents will hear, then approve.") });
            router.push(`${base}/campaigns/${encodeURIComponent(campaign.id)}`);
        } catch (err) {
            toast({ title: t("Could not create the campaign"), description: errorMessage(t, err), variant: "destructive" });
            setCreating(false);
        }
    };

    const steps = [t("Purpose"), t("Audience"), t("Details"), t("Review")];

    return (
        <div className="space-y-6">
            <Link
                href={`${base}/campaigns`}
                className="inline-flex items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("All campaigns")}
            </Link>

            <ol aria-label={t("Steps")} className="flex flex-wrap gap-2">
                {steps.map((label, i) => (
                    <li
                        key={label}
                        aria-current={i === step ? "step" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-sm leading-normal",
                            i === step ? "border-primary bg-primary/10 text-foreground font-medium" : i < step ? "border-border bg-muted text-foreground" : "border-border text-muted-foreground",
                        )}
                    >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-card text-xs font-semibold">
                            {i < step ? <Check aria-hidden="true" className="h-3 w-3" /> : i + 1}
                        </span>
                        {label}
                    </li>
                ))}
            </ol>

            {step === 0 && (
                <SectionCard title={t("What is this call about?")} description={t("Only notices with reviewed wording in all four languages can be sent.")}>
                    <div role="radiogroup" aria-label={t("Purpose")} className="grid gap-3">
                        {purposes.map((p) => {
                            const selected = purpose === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => setPurpose(p.id)}
                                    className={cn(
                                        "rounded-surface-md border p-4 text-left space-y-1",
                                        "transition-colors duration-micro ease-out-quart",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted",
                                    )}
                                >
                                    <span className="flex items-center gap-2 type-body-lg text-foreground">
                                        {selected && <Check aria-hidden="true" className="h-4 w-4 text-primary" />}
                                        {purposeLabel(t, p.id)}
                                    </span>
                                    <span className="block type-body text-muted-foreground">{purposeDescription(t, p.id)}</span>
                                </button>
                            );
                        })}
                    </div>
                </SectionCard>
            )}

            {step === 1 && (
                <SectionCard title={t("Who should be called?")} description={t("Each family is called once, even if they have more than one child in the chosen classes.")}>
                    <div className="flex flex-wrap gap-2">
                        <ChoiceChip selected={wholeSchool} onClick={() => setWholeSchool(true)}>{t("Whole school")}</ChoiceChip>
                        <ChoiceChip selected={!wholeSchool} onClick={() => setWholeSchool(false)}>{t("Choose classes")}</ChoiceChip>
                    </div>
                    {!wholeSchool && (
                        <div className="space-y-3">
                            {guardiansQuery.loading && !guardiansQuery.data && <InlineSpinner />}
                            {guardiansQuery.error && <ErrorPanel error={guardiansQuery.error} onRetry={guardiansQuery.reload} />}
                            {guardiansQuery.data && sections.size === 0 && (
                                <p className="type-body text-muted-foreground">
                                    {t("No classes found. Import your school data first.")}{" "}
                                    <Link href={`${base}/settings`} className="text-primary underline underline-offset-4">{t("Go to settings")}</Link>
                                </p>
                            )}
                            {[...sections.entries()].map(([grade, secs]) => (
                                <fieldset key={grade} className="flex flex-wrap items-center gap-2">
                                    <legend className="sr-only">{fmt(t("Grade {grade}"), { grade })}</legend>
                                    <span aria-hidden="true" className="w-20 shrink-0 type-body text-muted-foreground">{fmt(t("Grade {grade}"), { grade })}</span>
                                    {secs.map((section) => (
                                        <ChoiceChip
                                            key={section}
                                            selected={picked.has(sectionId({ grade, section }))}
                                            onClick={() => togglePicked({ grade, section })}
                                        >
                                            {`${grade}${section}`}
                                        </ChoiceChip>
                                    ))}
                                </fieldset>
                            ))}
                            {picked.size > 0 && (
                                <p className="type-body text-foreground">{summary.audience(audience)}</p>
                            )}
                        </div>
                    )}
                </SectionCard>
            )}

            {step === 2 && purpose && (
                <SectionCard title={t("Details parents will hear")} description={t("Only these facts go into the message. Nothing typed freely is ever spoken.")}>
                    {purpose === "emergency_closure" ? (
                        <div className="space-y-4">
                            <fieldset className="space-y-2">
                                <legend className="type-body font-medium text-foreground">{t("Which day is the school closed?")}</legend>
                                <div className="flex flex-wrap gap-2">
                                    <ChoiceChip selected={closureDay === "today"} onClick={() => setClosureDay("today")}>
                                        {fmt(t("Today, {date}"), { date: f.day(istToday()) })}
                                    </ChoiceChip>
                                    <ChoiceChip selected={closureDay === "tomorrow"} onClick={() => setClosureDay("tomorrow")}>
                                        {fmt(t("Tomorrow, {date}"), { date: f.day(istTomorrow()) })}
                                    </ChoiceChip>
                                </div>
                            </fieldset>
                            <div className="space-y-2">
                                <Label htmlFor="closure-reason">{t("Reason")}</Label>
                                <Select value={reason} onValueChange={(v) => setReason(v as ClosureReason)}>
                                    <SelectTrigger id="closure-reason" className="md:w-80">
                                        <SelectValue placeholder={t("Choose a reason")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLOSURE_REASONS.map((r) => (
                                            <SelectItem key={r} value={r}>{closureReasonLabel(t, r)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <fieldset className="space-y-2">
                                <legend className="type-body font-medium text-foreground">{t("Are school buses running?")}</legend>
                                <div className="flex flex-wrap gap-2">
                                    <ChoiceChip selected={busesRunning} onClick={() => setBusesRunning(true)}>{t("Yes, buses are running")}</ChoiceChip>
                                    <ChoiceChip selected={!busesRunning} onClick={() => setBusesRunning(false)}>{t("No buses")}</ChoiceChip>
                                </div>
                            </fieldset>
                            <p className="type-body text-muted-foreground">
                                {t("Parents hear a today or tomorrow version chosen at the moment of calling, and calls stop at the end of the closure day.")}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {purpose === "event_invite" && (
                                <div className="space-y-2">
                                    <Label htmlFor="event-type">{t("Event")}</Label>
                                    <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                                        <SelectTrigger id="event-type" className="md:w-80">
                                            <SelectValue placeholder={t("Choose an event")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EVENT_TYPES.map((e) => (
                                                <SelectItem key={e} value={e}>{eventTypeLabel(t, e)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="campaign-date">{t("Date")}</Label>
                                <Input
                                    id="campaign-date"
                                    type="date"
                                    min={today}
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="md:w-60"
                                />
                                {date && date < today && (
                                    <p className="type-body text-destructive">{t("Choose today or a later date.")}</p>
                                )}
                            </div>
                            <fieldset className="space-y-2">
                                <legend className="type-body font-medium text-foreground">{t("Time")}</legend>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                                        <SelectTrigger aria-label={t("Hour")} className="w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EVENT_HOURS.map((h) => (
                                                <SelectItem key={h} value={String(h)}>{pad2(h)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={String(minute)} onValueChange={(v) => setMinute(v === "30" ? 30 : 0)}>
                                        <SelectTrigger aria-label={t("Minutes")} className="w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">:00</SelectItem>
                                            <SelectItem value="30">:30</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="type-body text-muted-foreground">{f.spokenTime({ hour, minute })}</span>
                                </div>
                                <p className="type-body text-muted-foreground">{t("Whole and half hours only, so every language can say the time naturally.")}</p>
                            </fieldset>
                            <div className="space-y-2">
                                <Label htmlFor="campaign-venue">{t("Venue")}</Label>
                                {noVenues ? (
                                    <p className="type-body text-muted-foreground">
                                        {t("Add a venue with its name in all four languages before inviting families.")}{" "}
                                        <Link href={`${base}/settings`} className="text-primary underline underline-offset-4">{t("Go to settings")}</Link>
                                    </p>
                                ) : (
                                    <Select value={venueId} onValueChange={setVenueId}>
                                        <SelectTrigger id="campaign-venue" className="md:w-80">
                                            <SelectValue placeholder={t("Choose a venue")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {school.venues.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>{venueName(school, v.id)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    )}
                </SectionCard>
            )}

            {step === 3 && purpose && facts && (
                <SectionCard title={t("Review")} description={t("Nothing is sent yet. After you create the campaign you can hear the message in every language, and calls start only when you approve.")}>
                    <dl className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                            <dt className="text-xs font-medium leading-normal text-muted-foreground">{t("Purpose")}</dt>
                            <dd className="type-body text-foreground">{purposeLabel(t, purpose)}</dd>
                        </div>
                        <div className="space-y-1">
                            <dt className="text-xs font-medium leading-normal text-muted-foreground">{t("Audience")}</dt>
                            <dd className="type-body text-foreground">{summary.audience(audience)}</dd>
                        </div>
                        <div className="space-y-1">
                            <dt className="text-xs font-medium leading-normal text-muted-foreground">{t("Details")}</dt>
                            <dd className="type-body text-foreground">{summary.facts(facts, school)}</dd>
                        </div>
                    </dl>
                </SectionCard>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
                    disabled={step === 0 || creating}
                >
                    <ArrowLeft aria-hidden="true" />
                    {t("Back")}
                </Button>
                {step < 3 ? (
                    <Button type="button" onClick={() => setStep((s) => ((s + 1) as Step))} disabled={!canContinue}>
                        {t("Continue")}
                        <ArrowRight aria-hidden="true" />
                    </Button>
                ) : (
                    <Button type="button" onClick={create} disabled={creating || !facts}>
                        {creating && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Create campaign")}
                    </Button>
                )}
            </div>
        </div>
    );
}
