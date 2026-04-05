"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { ADMINISTRATIVE_ROLES, QUALIFICATIONS, type AdministrativeRole, type Qualification } from '@/types';

interface EditProfileDialogProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    initialData: {
        displayName?: string;
        bio?: string;
        designation?: string;
        schoolName?: string;
        department?: string;
        yearsOfExperience?: number;
        administrativeRole?: AdministrativeRole;
        qualifications?: Qualification[];
    };
}

export function EditProfileDialog({ userId, isOpen, onClose, initialData }: EditProfileDialogProps) {
    const [formData, setFormData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateProfileAction(userId, formData);
            toast({
                title: "Profile Updated",
                description: "Your professional profile has been successfully updated.",
            });
            onClose();
        } catch (error) {
            toast({
                title: "Update Failed",
                description: "There was an error updating your profile. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem] p-8 border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black font-headline tracking-tight">Edit Professional Profile</DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                        Update your professional details to build trust with other educators.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="displayName" className="font-bold text-foreground">Display Name</Label>
                        <Input
                            id="displayName"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            className="rounded-xl border-border focus:ring-primary shadow-soft"
                            placeholder="Full Name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="designation" className="font-bold text-foreground">Designation</Label>
                            <Input
                                id="designation"
                                value={formData.designation}
                                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                className="rounded-xl border-border focus:ring-primary shadow-soft"
                                placeholder="e.g. Science Teacher"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department" className="font-bold text-foreground">Department</Label>
                            <Input
                                id="department"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="rounded-xl border-border focus:ring-primary shadow-soft"
                                placeholder="e.g. STEM"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="schoolName" className="font-bold text-foreground">School / Institution</Label>
                        <Input
                            id="schoolName"
                            value={formData.schoolName}
                            onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                            className="rounded-xl border-border focus:ring-primary shadow-soft"
                            placeholder="e.g. Delhi Public School"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio" className="font-bold text-foreground">Professional Bio</Label>
                        <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            className="rounded-xl border-border focus:ring-primary shadow-soft min-h-[100px]"
                            placeholder="Share a short summary of your teaching philosophy and experience..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="yearsOfExperience" className="font-bold text-foreground">Years of Teaching Experience</Label>
                            <Input
                                id="yearsOfExperience"
                                type="number"
                                min={0}
                                max={40}
                                value={formData.yearsOfExperience ?? ''}
                                onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="rounded-xl border-border focus:ring-primary shadow-soft"
                                placeholder="e.g. 12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="administrativeRole" className="font-bold text-foreground">School Role</Label>
                            <select
                                id="administrativeRole"
                                value={formData.administrativeRole ?? 'none'}
                                onChange={(e) => setFormData({ ...formData, administrativeRole: e.target.value as AdministrativeRole })}
                                className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-soft focus:ring-primary focus:outline-none focus:ring-2"
                            >
                                <option value="none">Teacher (no admin role)</option>
                                <option value="hod">Head of Department (HoD)</option>
                                <option value="coordinator">Academic Coordinator</option>
                                <option value="exam_controller">Exam Controller</option>
                                <option value="vice_principal">Vice Principal</option>
                                <option value="principal">Principal</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="qualifications" className="font-bold text-foreground">Educational Qualifications</Label>
                        <div className="flex flex-wrap gap-2">
                            {QUALIFICATIONS.filter(q => q !== 'Other').map((qual) => {
                                const selected = formData.qualifications?.includes(qual) ?? false;
                                return (
                                    <button
                                        key={qual}
                                        type="button"
                                        onClick={() => {
                                            const current = formData.qualifications ?? [];
                                            const updated = selected
                                                ? current.filter(q => q !== qual)
                                                : [...current, qual];
                                            setFormData({ ...formData, qualifications: updated as Qualification[] });
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                                            selected
                                                ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                                                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                                        }`}
                                    >
                                        {qual}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground/60">Select all that apply</p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
                    <Button onClick={handleSave} disabled={loading} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20">
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
