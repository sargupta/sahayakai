"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GRADE_LEVELS, SUBJECTS } from "@/types";
import { createClassAction } from "@/app/actions/attendance";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateClassDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (classId: string) => void;
}

export function CreateClassDialog({ open, onOpenChange, onCreated }: CreateClassDialogProps) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: "",
        subject: "" as any,
        gradeLevel: "" as any,
        section: "",
        academicYear: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.subject || !form.gradeLevel) return;

        setSaving(true);
        try {
            const { classId } = await createClassAction({
                name: form.name,
                subject: form.subject,
                gradeLevel: form.gradeLevel,
                section: form.section || undefined,
                academicYear: form.academicYear,
            });
            toast({ title: "Class created" });
            onCreated(classId);
            onOpenChange(false);
            setForm((f) => ({ ...f, name: "", section: "" }));
        } catch (err: any) {
            const description = err.message === 'PREMIUM_REQUIRED'
                ? "Attendance is a Pro feature. Please upgrade your plan."
                : err.message;
            toast({ title: "Failed to create class", description, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 font-black">Create a Class</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Class Name *</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Class 6A"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Grade Level *</Label>
                            <Select value={form.gradeLevel} onValueChange={(v) => setForm((f) => ({ ...f, gradeLevel: v as any }))}>
                                <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                                <SelectContent>
                                    {GRADE_LEVELS.map((g) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Section</Label>
                            <Input
                                placeholder="e.g. A"
                                value={form.section}
                                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                                maxLength={3}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Subject *</Label>
                        <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v as any }))}>
                            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                            <SelectContent>
                                {SUBJECTS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Academic Year *</Label>
                        <Input
                            placeholder="e.g. 2025-26"
                            value={form.academicYear}
                            onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                            required
                        />
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={saving || !form.name || !form.subject || !form.gradeLevel}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Class
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
