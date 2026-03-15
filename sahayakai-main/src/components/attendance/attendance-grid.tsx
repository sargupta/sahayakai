"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { saveAttendanceAction, getAttendanceForDateAction } from "@/app/actions/attendance";
import type { Student, AttendanceStatus } from "@/types/attendance";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Clock, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceGridProps {
    classId: string;
    students: Student[];
    date: string;  // YYYY-MM-DD
}

type StatusMap = Record<string, AttendanceStatus>;

const STATUS_CONFIG = {
    present: {
        label: "P",
        icon: CheckCircle2,
        bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
        activeBg: "bg-emerald-500 border-emerald-500 text-white",
    },
    absent: {
        label: "A",
        icon: XCircle,
        bg: "bg-red-50 border-red-200 text-red-700",
        activeBg: "bg-red-500 border-red-500 text-white",
    },
    late: {
        label: "L",
        icon: Clock,
        bg: "bg-amber-50 border-amber-200 text-amber-700",
        activeBg: "bg-amber-500 border-amber-500 text-white",
    },
} as const;

export function AttendanceGrid({ classId, students, date }: AttendanceGridProps) {
    const { toast } = useToast();
    const [records, setRecords] = useState<StatusMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load existing attendance for this date
    useEffect(() => {
        setLoading(true);
        setSaved(false);
        getAttendanceForDateAction(classId, date)
            .then((existing) => {
                if (existing?.records) {
                    setRecords(existing.records);
                } else {
                    // Default: all present
                    const defaults: StatusMap = {};
                    students.forEach((s) => { defaults[s.id] = 'present'; });
                    setRecords(defaults);
                }
            })
            .catch(() => {
                const defaults: StatusMap = {};
                students.forEach((s) => { defaults[s.id] = 'present'; });
                setRecords(defaults);
            })
            .finally(() => setLoading(false));
    }, [classId, date, students]);

    const cycle = useCallback((studentId: string) => {
        setSaved(false);
        setRecords((prev) => {
            const current = prev[studentId] ?? 'present';
            const next: AttendanceStatus =
                current === 'present' ? 'absent' :
                current === 'absent' ? 'late' : 'present';
            return { ...prev, [studentId]: next };
        });
    }, []);

    const markAllPresent = () => {
        setSaved(false);
        const all: StatusMap = {};
        students.forEach((s) => { all[s.id] = 'present'; });
        setRecords(all);
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await saveAttendanceAction(classId, date, records);
            setSaved(true);
            toast({ title: "Attendance saved" });
        } catch (err: any) {
            toast({ title: "Failed to save", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const presentCount = Object.values(records).filter((s) => s === 'present').length;
    const absentCount  = Object.values(records).filter((s) => s === 'absent').length;
    const lateCount    = Object.values(records).filter((s) => s === 'late').length;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400 text-sm">
                Add students first to take attendance.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-xs font-semibold">
                <span className="text-emerald-600">{presentCount} Present</span>
                <span className="text-slate-300">·</span>
                <span className="text-red-500">{absentCount} Absent</span>
                <span className="text-slate-300">·</span>
                <span className="text-amber-600">{lateCount} Late</span>
                <Button
                    variant="ghost" size="sm"
                    className="ml-auto h-7 text-xs text-slate-500 hover:text-orange-500"
                    onClick={markAllPresent}
                >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    All Present
                </Button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
                <span>Tap to cycle:</span>
                {(['present', 'absent', 'late'] as const).map((s) => (
                    <span key={s} className={cn("px-2 py-0.5 rounded-md border font-medium", STATUS_CONFIG[s].activeBg)}>
                        {STATUS_CONFIG[s].label} {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                ))}
            </div>

            {/* Student rows */}
            <div className="space-y-1">
                {students.map((student) => {
                    const status = records[student.id] ?? 'present';
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;

                    return (
                        <button
                            key={student.id}
                            onClick={() => cycle(student.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                                "active:scale-[0.98]",
                                config.bg,
                            )}
                        >
                            <span className="w-7 text-center text-xs font-black text-current opacity-60 shrink-0">
                                {student.rollNumber}
                            </span>
                            <span className="flex-1 text-sm font-semibold truncate">{student.name}</span>
                            <span className={cn(
                                "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0",
                                config.activeBg,
                            )}>
                                <Icon className="h-4 w-4" />
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Submit */}
            <div className="sticky bottom-4 pt-2">
                <Button
                    className={cn(
                        "w-full h-12 text-base font-bold shadow-lg transition-all",
                        saved
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                    )}
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                        : saved
                            ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Attendance Saved</>
                            : "Submit Attendance"
                    }
                </Button>
            </div>
        </div>
    );
}
