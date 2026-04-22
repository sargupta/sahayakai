"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getClassAction, getStudentsAction, getStudentSummariesAction, getTwilioConfigStatusAction } from "@/app/actions/attendance";
import type { ClassRecord, Student, StudentAttendanceSummary } from "@/types/attendance";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { StudentManager } from "@/components/attendance/student-manager";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { ContactParentModal } from "@/components/attendance/contact-parent-modal";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft, Loader2, Phone, AlertTriangle,
    ClipboardList, Users, BarChart2,
} from "lucide-react";
import { format } from "date-fns";

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

    const [contactStudent, setContactStudent] = useState<Student | null>(null);

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

            // Load current month summaries for alerts
            const now = new Date();
            const s = await getStudentSummariesAction(classId, now.getFullYear(), now.getMonth() + 1);
            setSummaries(s);
        } catch (err: any) {
            toast({ title: "Error loading class", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [classId, toast]);

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

    // Students with >= 2 consecutive absences — for alert list
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
            </div>

            {/* At-risk alert banner */}
            {atRisk.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-red-700">{t("Attendance Alert")}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {atRisk.map((s) => {
                                const student = students.find((st) => st.id === s.studentId);
                                return (
                                    <button
                                        key={s.studentId}
                                        onClick={() => student && setContactStudent(student)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                                    >
                                        <span className="text-xs font-semibold text-red-700">{s.studentName}</span>
                                        <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                            {s.consecutiveAbsences}d
                                        </Badge>
                                        <Phone className="h-3 w-3 text-red-500" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
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
                    {students.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">{t("Parent Outreach")}</p>
                            <div className="divide-y divide-border/30 rounded-xl border border-border/50 overflow-hidden">
                                {students.map((s) => {
                                    const summary = summaries.find((sm) => sm.studentId === s.id);
                                    return (
                                        <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                                                {summary && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {summary.attendanceRate}% {t("attendance this month")}
                                                        {summary.consecutiveAbsences >= 2 && (
                                                            <span className="text-red-500 font-semibold ml-2">· {summary.consecutiveAbsences} {t("absent in a row")}</span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 text-xs h-9 shrink-0 hover:border-green-400 hover:text-green-700"
                                                onClick={() => setContactStudent(s)}
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
                    onOpenChange={(open) => { if (!open) setContactStudent(null); }}
                    student={contactStudent}
                    classId={classId}
                    className={cls.name}
                    subject={cls.subject}
                    consecutiveAbsences={summaries.find((s) => s.studentId === contactStudent.id)?.consecutiveAbsences}
                    twilioConfigured={twilioConfigured}
                />
            )}
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
