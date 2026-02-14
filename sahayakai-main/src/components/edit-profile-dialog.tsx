"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";

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
            console.error("Failed to update profile:", error);
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
                    <DialogDescription className="text-slate-500 font-medium">
                        Update your professional details to build trust with other educators.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="displayName" className="font-bold text-slate-700">Display Name</Label>
                        <Input
                            id="displayName"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            className="rounded-xl border-slate-200 focus:ring-primary shadow-sm"
                            placeholder="Full Name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="designation" className="font-bold text-slate-700">Designation</Label>
                            <Input
                                id="designation"
                                value={formData.designation}
                                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                className="rounded-xl border-slate-200 focus:ring-primary shadow-sm"
                                placeholder="e.g. Science Teacher"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department" className="font-bold text-slate-700">Department</Label>
                            <Input
                                id="department"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="rounded-xl border-slate-200 focus:ring-primary shadow-sm"
                                placeholder="e.g. STEM"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="schoolName" className="font-bold text-slate-700">School / Institution</Label>
                        <Input
                            id="schoolName"
                            value={formData.schoolName}
                            onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                            className="rounded-xl border-slate-200 focus:ring-primary shadow-sm"
                            placeholder="e.g. Delhi Public School"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio" className="font-bold text-slate-700">Professional Bio</Label>
                        <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            className="rounded-xl border-slate-200 focus:ring-primary shadow-sm min-h-[100px]"
                            placeholder="Share a short summary of your teaching philosophy and experience..."
                        />
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
