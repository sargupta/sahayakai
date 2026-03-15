"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { LANGUAGES } from "@/types";
import type { Student } from "@/types/attendance";
import {
    addStudentAction, updateStudentAction, deleteStudentAction,
} from "@/app/actions/attendance";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Pencil, Trash2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentManagerProps {
    classId: string;
    students: Student[];
    onRefresh: () => void;
}

const BLANK_FORM = { name: "", rollNumber: "", parentPhone: "", parentLanguage: "Hindi" as any };

export function StudentManager({ classId, students, onRefresh }: StudentManagerProps) {
    const { toast } = useToast();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editing, setEditing] = useState<Student | null>(null);
    const [form, setForm] = useState(BLANK_FORM);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const openAdd = () => {
        setEditing(null);
        setForm({ ...BLANK_FORM, rollNumber: String(students.length + 1) });
        setSheetOpen(true);
    };

    const openEdit = (s: Student) => {
        setEditing(s);
        setForm({
            name: s.name,
            rollNumber: String(s.rollNumber),
            parentPhone: s.parentPhone.replace('+91', ''),
            parentLanguage: s.parentLanguage,
        });
        setSheetOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.rollNumber || !form.parentPhone) return;
        setSaving(true);
        try {
            if (editing) {
                await updateStudentAction(classId, editing.id, {
                    name: form.name,
                    rollNumber: parseInt(form.rollNumber),
                    parentPhone: form.parentPhone,
                    parentLanguage: form.parentLanguage,
                });
                toast({ title: "Student updated" });
            } else {
                await addStudentAction(classId, {
                    name: form.name,
                    rollNumber: parseInt(form.rollNumber),
                    parentPhone: form.parentPhone,
                    parentLanguage: form.parentLanguage,
                });
                toast({ title: "Student added" });
            }
            setSheetOpen(false);
            onRefresh();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (studentId: string, name: string) => {
        if (!confirm(`Remove ${name} from this class?`)) return;
        setDeleting(studentId);
        try {
            await deleteStudentAction(classId, studentId);
            toast({ title: "Student removed" });
            onRefresh();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{students.length}/40 students</p>
                <Button
                    size="sm"
                    onClick={openAdd}
                    disabled={students.length >= 40}
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                    <UserPlus className="h-4 w-4" />
                    Add Student
                </Button>
            </div>

            {students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <div className="p-4 bg-orange-50 rounded-full">
                        <UserPlus className="h-8 w-8 text-orange-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">No students yet</p>
                    <p className="text-xs text-slate-400">Add students to start taking attendance.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                    {students.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                            <span className="w-8 text-center text-xs font-black text-slate-400 shrink-0">{s.rollNumber}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs text-slate-400">{s.parentPhone}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{s.parentLanguage}</Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-orange-500" onClick={() => openEdit(s)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                    onClick={() => handleDelete(s.id, s.name)}
                                    disabled={deleting === s.id}
                                >
                                    {deleting === s.id
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Trash2 className="h-3.5 w-3.5" />
                                    }
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{editing ? "Edit Student" : "Add Student"}</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                        <div className="space-y-1.5">
                            <Label>Roll Number *</Label>
                            <Input
                                type="number" min={1} max={40}
                                value={form.rollNumber}
                                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Student Name *</Label>
                            <Input
                                placeholder="Full name"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Parent's Phone *</Label>
                            <div className="flex">
                                <span className="flex items-center px-3 border border-r-0 border-slate-200 rounded-l-md bg-slate-50 text-sm text-slate-500">+91</span>
                                <Input
                                    className="rounded-l-none"
                                    placeholder="9876543210"
                                    value={form.parentPhone}
                                    onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Parent's Language</Label>
                            <Select value={form.parentLanguage} onValueChange={(v) => setForm((f) => ({ ...f, parentLanguage: v as any }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <SheetFooter className="mt-8">
                        <Button
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={handleSave}
                            disabled={saving || !form.name || !form.rollNumber || !form.parentPhone}
                        >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editing ? "Save Changes" : "Add Student"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
