"use client";

import { useState } from "react";
import { CalendarDays, Loader2, MapPin, Plus, School, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { updateSchool, type UpdateSchoolInput } from "@/lib/api/sampark";
import { PARENT_LANGUAGES, type ParentLanguage, type SchoolVenue } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { hourLabel, istToday, useSamparkFormat } from "./format";
import { fmt, languageName } from "./labels";
import { errorMessage } from "./states";

const ASK_FAMILY = "__ask__";
const START_HOURS = Array.from({ length: 10 }, (_, i) => i + 10); // 10 … 19
const END_HOURS = Array.from({ length: 10 }, (_, i) => i + 11); // 11 … 20
const WEEK = [0, 1, 2, 3, 4, 5, 6];

type SpokenNames = Record<ParentLanguage, string>;

function emptyNames(): SpokenNames {
    return { English: "", Hindi: "", Bengali: "", Nepali: "" };
}

function allNamed(names: SpokenNames): boolean {
    return PARENT_LANGUAGES.every((l) => names[l].trim().length > 0);
}

/** Save a partial school update and push the result into the console header. */
function useSaveSchool() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, setSchool } = useSamparkSchool();
    const [saving, setSaving] = useState(false);
    const save = async (input: UpdateSchoolInput): Promise<boolean> => {
        setSaving(true);
        try {
            setSchool(await updateSchool(orgId, input));
            toast({ title: t("Settings saved") });
            return true;
        } catch (err) {
            toast({ title: t("Could not save"), description: errorMessage(t, err), variant: "destructive" });
            return false;
        } finally {
            setSaving(false);
        }
    };
    return { save, saving };
}

function SpokenNameInputs({
    idPrefix,
    names,
    onChange,
    labelFor,
}: {
    idPrefix: string;
    names: SpokenNames;
    onChange: (next: SpokenNames) => void;
    labelFor: (language: ParentLanguage) => string;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {PARENT_LANGUAGES.map((l) => {
                const info = PARENT_LANGUAGE_INFO[l];
                const id = `${idPrefix}-${info.code}`;
                return (
                    <div key={l} className="space-y-2">
                        <Label htmlFor={id}>
                            {labelFor(l)} <span lang={info.code} className="text-muted-foreground">({info.nativeLabel})</span>
                        </Label>
                        <Input
                            id={id}
                            lang={info.code}
                            value={names[l]}
                            maxLength={120}
                            onChange={(e) => onChange({ ...names, [l]: e.target.value })}
                            className="leading-normal"
                        />
                    </div>
                );
            })}
        </div>
    );
}

export function SchoolProfileSection() {
    const { t } = useLanguage();
    const { school } = useSamparkSchool();
    const { save, saving } = useSaveSchool();
    const [displayName, setDisplayName] = useState(school.displayName);
    const [spoken, setSpoken] = useState<SpokenNames>({ ...emptyNames(), ...school.spokenName });
    const [defaultLanguage, setDefaultLanguage] = useState<string>(school.defaultLanguage ?? ASK_FAMILY);

    const valid = displayName.trim().length > 0 && allNamed(spoken);

    return (
        <SectionCard title={t("School")} icon={School} description={t("Parents hear the school name exactly as written here, in their own language.")}>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="school-display-name">{t("School name in this console")}</Label>
                    <Input id="school-display-name" value={displayName} maxLength={120} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <fieldset className="space-y-2">
                    <legend className="type-body font-medium text-foreground">{t("School name as parents hear it")}</legend>
                    <SpokenNameInputs
                        idPrefix="spoken-name"
                        names={spoken}
                        onChange={setSpoken}
                        labelFor={(l) => languageName(t, l)}
                    />
                    {!allNamed(spoken) && (
                        <p className="type-body text-muted-foreground">{t("Fill in all four languages. A call never says a name that has not been written for that language.")}</p>
                    )}
                </fieldset>
                <div className="space-y-2">
                    <Label htmlFor="default-language">{t("When a family language is not recorded")}</Label>
                    <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                        <SelectTrigger id="default-language" className="md:w-96">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ASK_FAMILY}>{t("Do not call until the family tells us")}</SelectItem>
                            {PARENT_LANGUAGES.map((l) => (
                                <SelectItem key={l} value={l}>{fmt(t("Call in {language}"), { language: languageName(t, l) })}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    type="button"
                    disabled={!valid || saving}
                    onClick={() =>
                        save({
                            displayName: displayName.trim(),
                            spokenName: {
                                English: spoken.English.trim(),
                                Hindi: spoken.Hindi.trim(),
                                Bengali: spoken.Bengali.trim(),
                                Nepali: spoken.Nepali.trim(),
                            },
                            defaultLanguage: defaultLanguage === ASK_FAMILY ? null : (defaultLanguage as ParentLanguage),
                        })
                    }
                >
                    {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Save")}
                </Button>
            </div>
        </SectionCard>
    );
}

export function CallingWindowSection() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { school } = useSamparkSchool();
    const { save, saving } = useSaveSchool();
    const [startHour, setStartHour] = useState(school.callingWindow.startHour);
    const [endHour, setEndHour] = useState(school.callingWindow.endHour);
    const [offDays, setOffDays] = useState<number[]>([...school.callingWindow.offDays]);
    // The school's own holidays (H10). A school from before the split has only `holidays`,
    // which then counts as its own. Holidays from the school records are shown apart and
    // cannot be removed here: the next import would bring them back.
    const [holidays, setHolidays] = useState<string[]>([...(school.manualHolidays ?? school.holidays)].sort());
    const crmHolidays = [...(school.crmHolidays ?? [])].filter((h) => !holidays.includes(h)).sort();
    const [newHoliday, setNewHoliday] = useState("");

    const windowValid = startHour < endHour;
    const addHoliday = () => {
        if (!newHoliday || holidays.includes(newHoliday)) return;
        setHolidays([...holidays, newHoliday].sort());
        setNewHoliday("");
    };
    const toggleDay = (d: number, on: boolean) =>
        setOffDays((prev) => (on ? [...new Set([...prev, d])].sort() : prev.filter((x) => x !== d)));

    return (
        <SectionCard title={t("Calling hours and holidays")} icon={CalendarDays} description={t("Routine calls go out only inside these hours (IST), never on off days or holidays. Emergency closures follow their own rule: 6 am to 9 pm on any day.")}>
            <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="window-start">{t("From")}</Label>
                        <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                            <SelectTrigger id="window-start" className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {START_HOURS.map((h) => (
                                    <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="window-end">{t("Until")}</Label>
                        <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                            <SelectTrigger id="window-end" className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {END_HOURS.map((h) => (
                                    <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="pb-3 type-body text-muted-foreground">IST</span>
                </div>
                {!windowValid && <p className="type-body text-destructive">{t("The end time must be after the start time.")}</p>}

                <fieldset className="space-y-2">
                    <legend className="type-body font-medium text-foreground">{t("Off days (no routine calls)")}</legend>
                    <div className="flex flex-wrap gap-4">
                        {WEEK.map((d) => (
                            <div key={d} className="flex items-center gap-2">
                                <Checkbox id={`offday-${d}`} checked={offDays.includes(d)} onCheckedChange={(c) => toggleDay(d, c === true)} />
                                <Label htmlFor={`offday-${d}`} className="font-normal">{f.weekday(d)}</Label>
                            </div>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="type-body font-medium text-foreground">{t("School holidays")}</legend>
                    {holidays.length === 0 ? (
                        <p className="type-body text-muted-foreground">{t("No holidays added.")}</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {holidays.map((h) => (
                                <li key={h} className="inline-flex items-center gap-1 rounded-pill border border-border bg-muted/30 py-1 pl-3 pr-1 type-body text-foreground">
                                    {f.day(h)}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={fmt(t("Remove {date}"), { date: f.day(h) })}
                                        onClick={() => setHolidays(holidays.filter((x) => x !== h))}
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {crmHolidays.length > 0 && (
                        <div className="space-y-2">
                            <p className="type-body font-medium text-foreground">{t("From your school records")}</p>
                            <ul className="flex flex-wrap gap-2">
                                {crmHolidays.map((h) => (
                                    <li key={h} className="inline-flex items-center rounded-pill border border-border bg-muted/30 px-3 py-1 type-body text-foreground">
                                        {f.day(h)}
                                    </li>
                                ))}
                            </ul>
                            <p className="type-body text-muted-foreground">
                                {t("These come from your school records and are updated by each import. Holidays you add here are kept through every import.")}
                            </p>
                        </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-holiday" className="sr-only">{t("Holiday date")}</Label>
                            <Input id="new-holiday" type="date" min={istToday()} value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="w-48" />
                        </div>
                        <Button type="button" variant="outline" onClick={addHoliday} disabled={!newHoliday}>
                            <Plus aria-hidden="true" />
                            {t("Add holiday")}
                        </Button>
                    </div>
                </fieldset>

                <Button
                    type="button"
                    disabled={!windowValid || saving}
                    onClick={() => save({ callingWindow: { startHour, endHour, offDays }, holidays })}
                >
                    {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Save")}
                </Button>
            </div>
        </SectionCard>
    );
}

function newVenueId(existing: SchoolVenue[]): string {
    let id = `venue-${Date.now().toString(36)}`;
    let n = 1;
    while (existing.some((v) => v.id === id)) id = `venue-${Date.now().toString(36)}-${n++}`;
    return id;
}

export function VenuesSection() {
    const { t } = useLanguage();
    const { school } = useSamparkSchool();
    const { save, saving } = useSaveSchool();
    const [venues, setVenues] = useState<SchoolVenue[]>(school.venues.map((v) => ({ id: v.id, names: { ...emptyNames(), ...v.names } })));

    const valid = venues.every((v) => allNamed(v.names));

    return (
        <SectionCard title={t("Venues")} icon={MapPin} description={t("Places where the school holds meetings and events, named in all four languages. Invitations can only use a venue from this list.")}>
            <div className="space-y-4">
                {venues.length === 0 && <p className="type-body text-muted-foreground">{t("No venues yet. Add the school hall or wherever PTMs are held.")}</p>}
                <ol className="space-y-4">
                    {venues.map((v, i) => (
                        <li key={v.id} className="space-y-3 rounded-surface-md border border-border p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="type-body font-medium text-foreground">{fmt(t("Venue {number}"), { number: i + 1 })}</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setVenues(venues.filter((x) => x.id !== v.id))}
                                >
                                    <Trash2 aria-hidden="true" />
                                    {t("Remove")}
                                </Button>
                            </div>
                            <SpokenNameInputs
                                idPrefix={`venue-${v.id}`}
                                names={v.names}
                                onChange={(names) => setVenues(venues.map((x) => (x.id === v.id ? { ...x, names } : x)))}
                                labelFor={(l) => languageName(t, l)}
                            />
                        </li>
                    ))}
                </ol>
                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setVenues([...venues, { id: newVenueId(venues), names: emptyNames() }])}
                        disabled={venues.length >= 50}
                    >
                        <Plus aria-hidden="true" />
                        {t("Add venue")}
                    </Button>
                    <Button
                        type="button"
                        disabled={!valid || saving}
                        onClick={() =>
                            save({
                                venues: venues.map((v) => ({
                                    id: v.id,
                                    names: {
                                        English: v.names.English.trim(),
                                        Hindi: v.names.Hindi.trim(),
                                        Bengali: v.names.Bengali.trim(),
                                        Nepali: v.names.Nepali.trim(),
                                    },
                                })),
                            })
                        }
                    >
                        {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Save venues")}
                    </Button>
                </div>
                {!valid && <p className="type-body text-muted-foreground">{t("Every venue needs a name in all four languages.")}</p>}
            </div>
        </SectionCard>
    );
}
