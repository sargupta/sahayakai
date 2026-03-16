"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getClassesAction, deleteClassAction } from "@/app/actions/attendance";
import type { ClassRecord } from "@/types/attendance";
import { CreateClassDialog } from "@/components/attendance/create-class-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
    Plus, ClipboardList, Users, ChevronRight,
    CalendarDays, Loader2, Trash2, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
    const { toast } = useToast();
    const router = useRouter();
    const [classes, setClasses] = useState<ClassRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        getClassesAction()
            .then(setClasses)
            .catch((err) => {
                toast({
                    title: "Failed to load classes",
                    description: err.message || "Please try refreshing the page.",
                    variant: "destructive",
                });
            })
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (cls: ClassRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete "${cls.name}"? This cannot be undone.`)) return;
        setDeleting(cls.id);
        try {
            await deleteClassAction(cls.id);
            toast({ title: "Class deleted" });
            load();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Attendance</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Manage classes and track daily attendance</p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                    <Plus className="h-4 w-4" />
                    New Class
                </Button>
            </div>

            {/* Class list */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
            ) : classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="p-5 bg-orange-50 rounded-full">
                        <ClipboardList className="h-10 w-10 text-orange-300" />
                    </div>
                    <div>
                        <p className="text-base font-black text-slate-800">No classes yet</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-xs">
                            Create your first class and add students — then take daily attendance in seconds.
                        </p>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create First Class
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {classes.map((cls) => (
                        <button
                            key={cls.id}
                            onClick={() => router.push(`/attendance/${cls.id}`)}
                            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all text-left group shadow-sm"
                        >
                            <div className="p-3 bg-orange-100 rounded-xl shrink-0">
                                <GraduationCap className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-black text-slate-900 truncate">{cls.name}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                    <span>{cls.gradeLevel}</span>
                                    <span>·</span>
                                    <span>{cls.subject}</span>
                                    {cls.section && <><span>·</span><span>Section {cls.section}</span></>}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Users className="h-3 w-3" />
                                        <span>{cls.studentCount} students</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <CalendarDays className="h-3 w-3" />
                                        <span>{cls.academicYear}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost" size="icon"
                                    className={cn(
                                        "h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity",
                                    )}
                                    onClick={(e) => handleDelete(cls, e)}
                                    disabled={deleting === cls.id}
                                >
                                    {deleting === cls.id
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Trash2 className="h-3.5 w-3.5" />
                                    }
                                </Button>
                                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-orange-400 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <CreateClassDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(classId) => {
                    load();
                    router.push(`/attendance/${classId}`);
                }}
            />
        </div>
    );
}
