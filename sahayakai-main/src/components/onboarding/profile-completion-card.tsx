"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEPARTMENTS } from "@/types";
import { updateProfileAction } from "@/app/actions/profile";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProfileCompletionCardProps {
    onComplete?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export function ProfileCompletionCard({ onComplete, onDismiss, className }: ProfileCompletionCardProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [dismissed, setDismissed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        department: "",
        designation: "",
        district: "",
        bio: "",
    });

    if (dismissed) return null;

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const data: Record<string, any> = { profileCompletionLevel: 'complete' };
            if (formData.department) data.department = formData.department;
            if (formData.designation) data.designation = formData.designation;
            if (formData.district) data.district = formData.district;
            if (formData.bio) data.bio = formData.bio;

            await updateProfileAction(user.uid, data);
            // Mark onboarding checklist item
            import('@/app/actions/profile').then(({ markChecklistItemAction }) =>
                markChecklistItemAction(user.uid, 'complete-profile')
            ).catch(() => {});
            toast({ title: "Profile updated", description: "Your profile is now complete." });
            onComplete?.();
            setDismissed(true);
        } catch {
            toast({ title: "Error", description: "Could not update profile.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className={cn("border border-border rounded-2xl shadow-soft bg-card", className)}>
            <CardHeader className="pb-3 relative">
                <button
                    onClick={() => { setDismissed(true); onDismiss?.(); }}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
                <CardTitle className="text-base font-bold">{t("Complete your profile")}</CardTitle>
                <CardDescription className="text-xs">
                    A few more details so we can recommend better content.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Department</Label>
                        <Select value={formData.department} onValueChange={(v) => setFormData(p => ({ ...p, department: v }))}>
                            <SelectTrigger className="h-9 text-sm shadow-soft">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Designation</Label>
                        <Input
                            placeholder="e.g. Senior Teacher"
                            value={formData.designation}
                            onChange={(e) => setFormData(p => ({ ...p, designation: e.target.value }))}
                            className="h-9 text-sm shadow-soft"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">District / Region</Label>
                    <Input
                        placeholder="e.g. North Delhi"
                        value={formData.district}
                        onChange={(e) => setFormData(p => ({ ...p, district: e.target.value }))}
                        className="h-9 text-sm shadow-soft"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Short Bio (optional)</Label>
                    <Textarea
                        placeholder="Your teaching philosophy..."
                        value={formData.bio}
                        onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))}
                        className="h-16 text-sm shadow-soft resize-none"
                    />
                </div>
                <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl gap-1">
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDismissed(true); onDismiss?.(); }} className="rounded-xl">
                        Skip for now
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
