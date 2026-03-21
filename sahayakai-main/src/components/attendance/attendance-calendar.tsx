"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getStudentSummariesAction } from "@/app/actions/attendance";
import type { StudentAttendanceSummary } from "@/types/attendance";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceCalendarProps {
    classId: string;
    initialSummaries?: StudentAttendanceSummary[]; // pass current-month data to avoid refetch
}

const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
];

export function AttendanceCalendar({ classId, initialSummaries }: AttendanceCalendarProps) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    const [summaries, setSummaries] = useState<StudentAttendanceSummary[]>(initialSummaries ?? []);
    const [loading, setLoading] = useState(!initialSummaries);

    useEffect(() => {
        // Skip fetch for the current month if initial data was provided
        if (year === currentYear && month === currentMonth && initialSummaries) {
            setSummaries(initialSummaries);
            setLoading(false);
            return;
        }
        setLoading(true);
        getStudentSummariesAction(classId, year, month)
            .then(setSummaries)
            .catch(() => setSummaries([]))
            .finally(() => setLoading(false));
    }, [classId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };

    const nextMonth = () => {
        const nextIsFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
        if (nextIsFuture) return;
        if (month === 12) { setMonth(1); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

    return (
        <div className="space-y-4">
            {/* Month navigator */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={prevMonth} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-bold text-slate-900">{MONTH_NAMES[month - 1]} {year}</p>
                <Button
                    variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
                    onClick={nextMonth}
                    disabled={year === now.getFullYear() && month >= now.getMonth() + 1}
                    aria-label="Next month"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
            ) : summaries.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                    No attendance data for this month.
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <span>Student</span>
                        <span className="text-center">Present</span>
                        <span className="text-center">Absent</span>
                        <span className="text-center">Late</span>
                        <span className="text-center">Days</span>
                        <span className="text-right">Rate</span>
                    </div>

                    {summaries.map((s) => (
                        <div
                            key={s.studentId}
                            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-2 items-center px-3 py-3 bg-white rounded-xl border border-slate-100"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{s.studentName}</p>
                                {s.consecutiveAbsences >= 2 && (
                                    <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                                        {s.consecutiveAbsences} days absent in a row
                                    </p>
                                )}
                            </div>
                            <span className="text-center text-sm font-bold text-emerald-600">{s.presentDays}</span>
                            <span className="text-center text-sm font-bold text-red-500">{s.absentDays}</span>
                            <span className="text-center text-sm font-bold text-amber-600">{s.lateDays}</span>
                            <span className="text-center text-xs text-slate-400">{s.totalDays}</span>
                            <div className="flex items-center gap-2 justify-end">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            s.attendanceRate >= 85 ? "bg-emerald-500" :
                                            s.attendanceRate >= 70 ? "bg-amber-500" : "bg-red-500"
                                        )}
                                        style={{ width: `${s.attendanceRate}%` }}
                                    />
                                </div>
                                <span className={cn(
                                    "text-xs font-bold w-10 text-right",
                                    s.attendanceRate >= 85 ? "text-emerald-600" :
                                    s.attendanceRate >= 70 ? "text-amber-600" : "text-red-600"
                                )}>
                                    {s.attendanceRate}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
