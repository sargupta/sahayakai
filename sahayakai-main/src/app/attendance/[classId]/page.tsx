"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    getClassAction, getStudentsAction, getStudentSummariesAction, getTwilioConfigStatusAction,
    getClassPerformanceSummariesAction, getStudentsWithRecentBehavioralOutreachAction,
    getStudentAbsenceDatesAction,
    type StudentPerformanceSummary,
} from "@/app/actions/attendance";
import type { ClassRecord, Student, StudentAttendanceSummary, OutreachReason } from "@/types/attendance";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { StudentManager } from "@/components/attendance/student-manager";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { ContactParentModal } from "@/components/attendance/contact-parent-modal";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft, Loader2, Phone, AlertTriangle,
    ClipboardList, Users, BarChart2,
    CalendarX2, TrendingDown, Star,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function todayStr() {
    return format(new Date(), 'yyyy-MM-dd');
}

function ClassDetailContent() {
    const { classId } = useParams<{ classId: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const { t } = useLanguage();

    const [cls, setCls] = useState<ClassRecord | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [summaries, setSummaries] = useState<StudentAttendanceSummary[]>([]);
    const [twilioConfigured, setTwilioConfigured] = useState(false);
    const [loading, setLoading] = useState(true);

    // Triage-banner inputs — all optional; banner degrades gracefully if any fail.
    const [perfSummaries, setPerfSummaries] = useState<StudentPerformanceSummary[]>([]);
    const [behavioralStudentIds, setBehavioralStudentIds] = useState<string[]>([]);

    const [contactStudent, setContactStudent] = useState<Student | null>(null);
    const [contactSuggestedReason, setContactSuggestedReason] = useState<OutreachReason | undefined>(undefined);
    const [contactAbsenceDates, setContactAbsenceDates] = useState<string[] | undefined>(undefined);

    const loadAll = useCallback(async () => {
        try {
            const [classData, studentData, twilio] = await Promise.all([
                getClassAction(classId),
                getStudentsAction(classId),
                getTwilioConfigStatusAction(),
            ]);
            setCls(classData);
            setStudents(studentData);
            setTwilioConfigured(twilio.configured);

            // Load current month summaries + triage signals. The two triage
            // queries are non-critical — the page renders attendance-only
            // signals if either fails (e.g. missing Firestore index in
            // a fresh deploy).
            const now = new Date();
            const [s, perfs, behavioralIds] = await Promise.all([
                getStudentSummariesAction(classId, now.getFullYear(), now.getMonth() + 1),
                getClassPerformanceSummariesAction(classId).catch(() => [] as StudentPerformanceSummary[]),
                getStudentsWithRecentBehavioralOutreachAction(classId).catch(() => [] as string[]),
            ]);
            setSummaries(s);
            setPerfSummaries(perfs);
            setBehavioralStudentIds(behavioralIds);
        } catch (err: any) {
            toast({ title: t("Error loading class"), description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [classId, toast]);

    // Open the contact modal pre-loaded with a suggested reason and (for
    // absence-driven flows) the student's recent absent dates. Triggered
    // from the triage-banner chips.
    const openContact = useCallback(async (student: Student, reason?: OutreachReason) => {
        setContactSuggestedReason(reason);
        setContactStudent(student);
        if (reason === 'consecutive_absences') {
            // Fire-and-forget; if it fails the modal renders without the
            // date list and falls back to the streak count.
            try {
                const dates = await getStudentAbsenceDatesAction(classId, student.id);
                setContactAbsenceDates(dates);
            } catch {
                setContactAbsenceDates(undefined);
            }
        } else {
            setContactAbsenceDates(undefined);
        }
    }, [classId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
            </div>
        );
    }

    if (!cls) {
        return <div className="text-center py-20 text-muted-foreground">{t("Class not found.")}</div>;
    }

    // ── Triage signal computation (memoize-free; cheap arithmetic on small N) ─
    // The triage banner lets the teacher see WHICH students to call without
    // scrolling the alphabetical roster. Groups are mutually exclusive in
    // priority order: absences > academic > behavioral > celebrate. A
    // student in multiple groups is bucketed by their most urgent signal.
    const summaryById = new Map(summaries.map((s) => [s.studentId, s]));
    const perfById = new Map(perfSummaries.map((p) => [p.studentId, p]));
    const behavioralSet = new Set(behavioralStudentIds);

    interface TriageEntry {
        student: Student;
        summary?: StudentAttendanceSummary;
        perf?: StudentPerformanceSummary;
        suggestedReason: OutreachReason;
        badge: string;
    }
    const absenceGroup: TriageEntry[] = [];
    const academicGroup: TriageEntry[] = [];
    const behavioralGroup: TriageEntry[] = [];
    const celebrateGroup: TriageEntry[] = [];

    for (const student of students) {
        const summary = summaryById.get(student.id);
        const perf = perfById.get(student.id);
        const streak = summary?.consecutiveAbsences ?? 0;
        const attendanceRate = summary?.attendanceRate ?? 100;
        const latest = perf?.latestPercentage;
        const isBehavioral = behavioralSet.has(student.id);

        if (streak >= 2) {
            absenceGroup.push({
                student, summary, perf,
                suggestedReason: 'consecutive_absences',
                badge: `${streak}d in a row`,
            });
        } else if (typeof latest === 'number' && latest < 35) {
            academicGroup.push({
                student, summary, perf,
                suggestedReason: 'poor_performance',
                badge: `${Math.round(latest)}% avg · at-risk`,
            });
        } else if (isBehavioral) {
            behavioralGroup.push({
                student, summary, perf,
                suggestedReason: 'behavioral_concern',
                badge: 'Behavioral note',
            });
        } else if (attendanceRate >= 99 && typeof latest === 'number' && latest >= 85) {
            celebrateGroup.push({
                student, summary, perf,
                suggestedReason: 'positive_feedback',
                badge: `${Math.round(latest)}% · top`,
            });
        }
    }

    // Sort each group: absences by streak desc, academic by latestPercentage asc,
    // celebrate by latestPercentage desc.
    absenceGroup.sort((a, b) => (b.summary?.consecutiveAbsences ?? 0) - (a.summary?.consecutiveAbsences ?? 0));
    academicGroup.sort((a, b) => (a.perf?.latestPercentage ?? 100) - (b.perf?.latestPercentage ?? 100));
    celebrateGroup.sort((a, b) => (b.perf?.latestPercentage ?? 0) - (a.perf?.latestPercentage ?? 0));

    const triageTotal = absenceGroup.length + academicGroup.length + behavioralGroup.length + celebrateGroup.length;
    const triagedStudentIds = new Set<string>([
        ...absenceGroup.map((e) => e.student.id),
        ...academicGroup.map((e) => e.student.id),
        ...behavioralGroup.map((e) => e.student.id),
        ...celebrateGroup.map((e) => e.student.id),
    ]);

    // Sort the per-student Parent Outreach list: concerns first (absence >
    // academic > behavioral), then celebrate, then everyone else by roll.
    const sortedStudents = [...students].sort((a, b) => {
        const order = (sid: string) => {
            if (absenceGroup.some((e) => e.student.id === sid)) return 0;
            if (academicGroup.some((e) => e.student.id === sid)) return 1;
            if (behavioralGroup.some((e) => e.student.id === sid)) return 2;
            if (celebrateGroup.some((e) => e.student.id === sid)) return 3;
            return 4;
        };
        const da = order(a.id);
        const db = order(b.id);
        if (da !== db) return da - db;
        return a.rollNumber - b.rollNumber;
    });

    // Kept for backward compat with the existing red banner below.
    const atRisk = summaries.filter((s) => s.consecutiveAbsences >= 2);

    return (
        <div className="w-full max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => router.push('/attendance')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-black font-headline tracking-tight text-foreground truncate">{cls.name}</h1>
                    <p className="text-xs text-muted-foreground">{cls.gradeLevel} · {cls.subject} · {cls.studentCount} {t("students")}</p>
                </div>
                {triageTotal > 0 && (
                    <button
                        onClick={() => {
                            const el = document.getElementById('needs-outreach');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary text-xs font-semibold transition-colors"
                        title={t("Jump to outreach triage")}
                    >
                        <Phone className="h-3 w-3" />
                        <span className="hidden sm:inline">{t("Outreach")}</span>
                        <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1.5">{triageTotal}</Badge>
                    </button>
                )}
            </div>

            {/* Triage banner — surfaces who needs outreach today, grouped
                by reason. Each chip pre-selects the appropriate reason in
                the ContactParentModal so the teacher doesn't have to choose. */}
            {triageTotal > 0 && (
                <div id="needs-outreach" className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            {t("Needs outreach today")}
                            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{triageTotal}</Badge>
                        </p>
                    </div>

                    {absenceGroup.length > 0 && (
                        <TriageGroup
                            label={t("Consecutive absences")}
                            icon={CalendarX2}
                            tone="amber"
                            entries={absenceGroup}
                            onChip={openContact}
                        />
                    )}
                    {academicGroup.length > 0 && (
                        <TriageGroup
                            label={t("At-risk academically")}
                            icon={TrendingDown}
                            tone="rose"
                            entries={academicGroup}
                            onChip={openContact}
                        />
                    )}
                    {behavioralGroup.length > 0 && (
                        <TriageGroup
                            label={t("Behavioral concern")}
                            icon={AlertTriangle}
                            tone="orange"
                            entries={behavioralGroup}
                            onChip={openContact}
                        />
                    )}
                    {celebrateGroup.length > 0 && (
                        <TriageGroup
                            label={t("Celebrate")}
                            icon={Star}
                            tone="emerald"
                            entries={celebrateGroup}
                            onChip={openContact}
                        />
                    )}
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="today">
                <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/50 rounded-xl">
                    <TabsTrigger value="today" className="gap-1.5 text-xs font-semibold rounded-lg">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {t("Today")}
                    </TabsTrigger>
                    <TabsTrigger value="students" className="gap-1.5 text-xs font-semibold rounded-lg">
                        <Users className="h-3.5 w-3.5" />
                        {t("Students")}
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="gap-1.5 text-xs font-semibold rounded-lg">
                        <BarChart2 className="h-3.5 w-3.5" />
                        {t("Reports")}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="today" className="mt-4">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(), 'EEEE, d MMMM yyyy')}
                        </p>
                    </div>
                    <AttendanceGrid
                        classId={classId}
                        students={students}
                        date={todayStr()}
                    />
                </TabsContent>

                <TabsContent value="students" className="mt-4">
                    <StudentManager
                        classId={classId}
                        students={students}
                        onRefresh={loadAll}
                    />

                    {/* Contact parent buttons for each student */}
                    {sortedStudents.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">{t("Parent Outreach")}</p>
                            <div className="divide-y divide-border/30 rounded-xl border border-border/50 overflow-hidden">
                                {sortedStudents.map((s) => {
                                    const summary = summaries.find((sm) => sm.studentId === s.id);
                                    const perf = perfById.get(s.id);
                                    const isAbsence = absenceGroup.some((e) => e.student.id === s.id);
                                    const isAcademic = academicGroup.some((e) => e.student.id === s.id);
                                    const isBehavioral = behavioralGroup.some((e) => e.student.id === s.id);
                                    const isCelebrate = celebrateGroup.some((e) => e.student.id === s.id);
                                    const suggested: OutreachReason | undefined =
                                        isAbsence ? 'consecutive_absences' :
                                        isAcademic ? 'poor_performance' :
                                        isBehavioral ? 'behavioral_concern' :
                                        isCelebrate ? 'positive_feedback' :
                                        undefined;
                                    return (
                                        <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                                                {summary && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {summary.attendanceRate}% {t("attendance this month")}
                                                        {summary.consecutiveAbsences >= 2 && (
                                                            <span className="text-red-500 font-semibold ml-2">· {summary.consecutiveAbsences} {t("absent in a row")}</span>
                                                        )}
                                                        {!isAbsence && isAcademic && typeof perf?.latestPercentage === 'number' && (
                                                            <span className="text-rose-600 font-semibold ml-2">· {Math.round(perf.latestPercentage)}% {t("avg · at-risk")}</span>
                                                        )}
                                                        {!isAbsence && !isAcademic && isBehavioral && (
                                                            <span className="text-orange-600 font-semibold ml-2">· {t("Behavioral note")}</span>
                                                        )}
                                                        {!isAbsence && !isAcademic && !isBehavioral && isCelebrate && typeof perf?.latestPercentage === 'number' && (
                                                            <span className="text-emerald-600 font-semibold ml-2">· {Math.round(perf.latestPercentage)}% {t("top performer")}</span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className={cn(
                                                    "gap-1.5 text-xs h-9 shrink-0",
                                                    suggested
                                                        ? "border-primary/40 text-primary hover:border-primary hover:bg-primary/5"
                                                        : "hover:border-green-400 hover:text-green-700",
                                                )}
                                                onClick={() => openContact(s, suggested)}
                                            >
                                                <Phone className="h-3 w-3" />
                                                {t("Contact")}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="reports" className="mt-4">
                    <AttendanceCalendar classId={classId} initialSummaries={summaries} />
                </TabsContent>
            </Tabs>

            {/* Contact Parent Modal */}
            {contactStudent && (
                <ContactParentModal
                    open={!!contactStudent}
                    onOpenChange={(open) => {
                        if (!open) {
                            setContactStudent(null);
                            setContactSuggestedReason(undefined);
                            setContactAbsenceDates(undefined);
                        }
                    }}
                    student={contactStudent}
                    classId={classId}
                    className={cls.name}
                    subject={cls.subject}
                    consecutiveAbsences={summaries.find((s) => s.studentId === contactStudent.id)?.consecutiveAbsences}
                    twilioConfigured={twilioConfigured}
                    suggestedReason={contactSuggestedReason}
                    absenceDates={contactAbsenceDates}
                    attendanceRate={summaries.find((s) => s.studentId === contactStudent.id)?.attendanceRate}
                />
            )}
        </div>
    );
}

// ── Triage group chip row ───────────────────────────────────────────────────
//
// One labelled row of student chips inside the "Needs outreach today" banner.
// Each chip opens the ContactParentModal with the reason pre-selected, so the
// teacher's path from "see student" → "place call" is one tap.

interface TriageEntryProp {
    student: Student;
    summary?: StudentAttendanceSummary;
    perf?: StudentPerformanceSummary;
    suggestedReason: OutreachReason;
    badge: string;
}

const TONE_CLASSES: Record<string, { row: string; chip: string; label: string; icon: string }> = {
    amber:   { row: '', chip: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900',     label: 'text-amber-700',   icon: 'text-amber-600' },
    rose:    { row: '', chip: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900',         label: 'text-rose-700',    icon: 'text-rose-600' },
    orange:  { row: '', chip: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-900', label: 'text-orange-700',  icon: 'text-orange-600' },
    emerald: { row: '', chip: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900', label: 'text-emerald-700', icon: 'text-emerald-600' },
};

function TriageGroup({
    label, icon: Icon, tone, entries, onChip,
}: {
    label: string;
    icon: React.ElementType;
    tone: 'amber' | 'rose' | 'orange' | 'emerald';
    entries: TriageEntryProp[];
    onChip: (student: Student, reason: OutreachReason) => void;
}) {
    const tc = TONE_CLASSES[tone];
    return (
        <div className="space-y-1.5">
            <p className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5", tc.label)}>
                <Icon className={cn("h-3 w-3", tc.icon)} />
                {label}
                <span className="ml-0.5 font-normal opacity-70">({entries.length})</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
                {entries.map((e) => (
                    <button
                        key={e.student.id}
                        onClick={() => onChip(e.student, e.suggestedReason)}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors",
                            tc.chip,
                        )}
                        title={`${e.student.name} — ${e.badge}`}
                    >
                        <span className="truncate max-w-[120px]">{e.student.name.split(' ')[0]}</span>
                        <span className="font-normal opacity-70 tabular-nums">{e.badge}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function ClassDetailPage() {
    const { t } = useLanguage();
    return (
        <AuthGate
            icon={ClipboardList}
            title={t("Attendance")}
            description={t("Manage classes and track daily attendance")}
        >
            <ClassDetailContent />
        </AuthGate>
    );
}
