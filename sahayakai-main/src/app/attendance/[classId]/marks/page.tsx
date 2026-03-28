"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getClassAction, getStudentsAction } from "@/app/actions/attendance";
import { getAuthToken } from "@/lib/get-auth-token";
import type { ClassRecord, Student } from "@/types/attendance";
import type { BatchMarksInput, StudentMarkEntry, AssessmentType, Term } from "@/types/performance";
import { ASSESSMENT_TYPES, TERMS } from "@/types/performance";
import { SUBJECTS } from "@/types";
import type { Subject } from "@/types";
import { format } from "date-fns";
import {
    ArrowLeft, Loader2, Save, ClipboardList,
} from "lucide-react";

const TYPE_LABELS: Record<AssessmentType, string> = {
    unit_test: "Unit Test",
    mid_term: "Mid Term",
    final_exam: "Final Exam",
    assignment: "Assignment",
    practical: "Practical",
    project: "Project",
};

const TERM_LABELS: Record<Term, string> = {
    term1: "Term 1",
    term2: "Term 2",
    annual: "Annual",
};

export default function MarksEntryPage() {
    const { classId } = useParams<{ classId: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading: authLoading, requireAuth } = useAuth();

    const [cls, setCls] = useState<ClassRecord | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Assessment metadata
    const [assessmentName, setAssessmentName] = useState("");
    const [assessmentType, setAssessmentType] = useState<AssessmentType>("unit_test");
    const [subject, setSubject] = useState<Subject | "">("");
    const [maxMarks, setMaxMarks] = useState<number>(100);
    const [term, setTerm] = useState<Term>("term1");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [academicYear, setAcademicYear] = useState("2025-26");

    // Per-student marks: studentId -> { marks, grade, remarks }
    const [marksMap, setMarksMap] = useState<
        Record<string, { marks: string; grade: string; remarks: string }>
    >({});

    const loadData = useCallback(async () => {
        try {
            const [classData, studentData] = await Promise.all([
                getClassAction(classId),
                getStudentsAction(classId),
            ]);
            if (!classData) {
                toast({ title: 'Class not found', description: 'This class does not exist or you do not have access.', variant: 'destructive' });
                return;
            }
            setCls(classData);
            setStudents(studentData);
            // Pre-fill subject from class
            if (classData?.subject) {
                setSubject(classData.subject);
            }
            // Initialize marks map
            const initial: Record<string, { marks: string; grade: string; remarks: string }> = {};
            for (const s of studentData) {
                initial[s.id] = { marks: "", grade: "", remarks: "" };
            }
            setMarksMap(initial);
        } catch (err: any) {
            toast({ title: "Error loading class", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [classId, toast]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            requireAuth();
            setLoading(false);
            return;
        }
        loadData();
    }, [authLoading, user, loadData, requireAuth]);

    const updateMark = (studentId: string, field: "marks" | "grade" | "remarks", value: string) => {
        setMarksMap((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const handleSave = async () => {
        // Validate metadata
        if (!assessmentName.trim()) {
            toast({ title: "Assessment name is required", variant: "destructive" });
            return;
        }
        if (!subject) {
            toast({ title: "Please select a subject", variant: "destructive" });
            return;
        }
        if (maxMarks <= 0) {
            toast({ title: "Max marks must be greater than 0", variant: "destructive" });
            return;
        }

        // Build marks entries — only include students with marks entered
        const marks: StudentMarkEntry[] = [];
        for (const s of students) {
            const entry = marksMap[s.id];
            if (!entry || entry.marks === "") continue;
            const obtained = Number(entry.marks);
            if (isNaN(obtained) || obtained < 0 || obtained > maxMarks) {
                toast({
                    title: `Invalid marks for ${s.name}`,
                    description: `Must be 0 to ${maxMarks}`,
                    variant: "destructive",
                });
                return;
            }
            marks.push({
                studentId: s.id,
                studentName: s.name,
                marksObtained: obtained,
                grade: entry.grade || undefined,
                remarks: entry.remarks || undefined,
            });
        }

        if (marks.length === 0) {
            toast({ title: "Enter marks for at least one student", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const token = await getAuthToken();
            if (!token) {
                toast({ title: "Session expired. Please log in again.", variant: "destructive" });
                return;
            }

            const payload: BatchMarksInput = {
                classId,
                name: assessmentName.trim(),
                type: assessmentType,
                subject: subject as Subject,
                maxMarks,
                term,
                date,
                academicYear,
                marks,
            };

            const res = await fetch("/api/performance/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Save failed (${res.status})`);
            }

            toast({ title: "Marks saved successfully" });
            router.push(`/attendance/${classId}`);
        } catch (err: any) {
            toast({ title: "Failed to save marks", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
        );
    }

    const sortedStudents = [...students].sort((a, b) => a.rollNumber - b.rollNumber);

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/attendance/${classId}`)}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        Enter Marks {cls ? `\u2014 ${cls.name}` : ""}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Fill in assessment details and student marks
                    </p>
                </div>
            </div>

            {/* Assessment Metadata */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-bold text-slate-700">Assessment Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <Label htmlFor="assessment-name">Assessment Name</Label>
                        <Input
                            id="assessment-name"
                            placeholder="e.g. Unit Test 1 - Algebra"
                            value={assessmentName}
                            onChange={(e) => setAssessmentName(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label>Type</Label>
                        <Select
                            value={assessmentType}
                            onValueChange={(v) => setAssessmentType(v as AssessmentType)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ASSESSMENT_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Subject</Label>
                        <Select
                            value={subject}
                            onValueChange={(v) => setSubject(v as Subject)}
                        >
                            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                            <SelectContent>
                                {SUBJECTS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="max-marks">Max Marks</Label>
                        <Input
                            id="max-marks"
                            type="number"
                            min={1}
                            value={maxMarks}
                            onChange={(e) => setMaxMarks(Number(e.target.value))}
                        />
                    </div>

                    <div>
                        <Label>Term</Label>
                        <Select
                            value={term}
                            onValueChange={(v) => setTerm(v as Term)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TERMS.map((t) => (
                                    <SelectItem key={t} value={t}>{TERM_LABELS[t]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="academic-year">Academic Year</Label>
                        <Input
                            id="academic-year"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Marks Grid */}
            {students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-700">No students in this class</p>
                    <p className="text-xs text-slate-400">Add students first from the class page.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 w-12">Roll</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 min-w-[120px]">Name</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 w-24">
                                        Marks <span className="font-normal text-slate-400">/{maxMarks}</span>
                                    </th>
                                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 w-20">Grade</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 min-w-[140px]">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStudents.map((s) => {
                                    const entry = marksMap[s.id] || { marks: "", grade: "", remarks: "" };
                                    return (
                                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-3 py-2 text-slate-500 tabular-nums">{s.rollNumber}</td>
                                            <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[160px]">{s.name}</td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={maxMarks}
                                                    placeholder="--"
                                                    value={entry.marks}
                                                    onChange={(e) => updateMark(s.id, "marks", e.target.value)}
                                                    className="h-8 w-20 text-sm tabular-nums"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    placeholder="--"
                                                    value={entry.grade}
                                                    onChange={(e) => updateMark(s.id, "grade", e.target.value)}
                                                    className="h-8 w-16 text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    placeholder="Optional"
                                                    value={entry.remarks}
                                                    onChange={(e) => updateMark(s.id, "remarks", e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Save Button */}
            {students.length > 0 && (
                <div className="flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {saving ? "Saving..." : "Save Marks"}
                    </Button>
                </div>
            )}
        </div>
    );
}
