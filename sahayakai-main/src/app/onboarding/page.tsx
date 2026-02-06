"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS, GRADE_LEVELS, LANGUAGES, DEPARTMENTS } from "@/types";
import { updateProfileAction, getProfileData } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { Loader2, GraduationCap, MapPin, BookOpen, Layers, UserCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { t, setLanguage } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Form State
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        schoolName: "",
        district: "",
        bio: "",
        department: "",
        designation: "",
        subjects: [] as string[],
        gradeLevels: [] as string[],
        preferredLanguage: "English" as any
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                // Check if profile already exists
                const { profile } = await getProfileData(user.uid);
                if (profile && profile.schoolName) {
                    // Profile already complete, redirect home
                    router.push("/");
                }
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleSubjectChange = (subject: string) => {
        setFormData(prev => ({
            ...prev,
            subjects: prev.subjects.includes(subject)
                ? prev.subjects.filter(s => s !== subject)
                : [...prev.subjects, subject]
        }));
    };

    const handleGradeChange = (grade: string) => {
        setFormData(prev => ({
            ...prev,
            gradeLevels: prev.gradeLevels.includes(grade)
                ? prev.gradeLevels.filter(g => g !== grade)
                : [...prev.gradeLevels, grade]
        }));
    };

    const handleSubmit = async () => {
        if (!userId) return;
        if (!formData.schoolName || formData.subjects.length === 0 || formData.gradeLevels.length === 0 || !formData.department) {
            toast({
                title: "Information Required",
                description: "Please fill in all mandatory professional details to continue.",
                variant: "destructive"
            });
            return;
        }

        setSubmitting(true);
        try {
            await updateProfileAction(userId, {
                ...formData,
                schoolNormalized: formData.schoolName.toUpperCase().trim(),
                impactScore: 0,
                contentSharedCount: 0,
                followersCount: 0,
                followingCount: 0,
                verifiedStatus: 'none',
                badges: ["New Member"],
                createdAt: new Date().toISOString()
            });

            // Update local language context state (avoiding redundant DB write)
            await setLanguage(formData.preferredLanguage as any, false);

            toast({
                title: "Welcome to SahayakAI!",
                description: "Your professional profile has been set up successfully.",
            });

            router.push("/community");
        } catch (error: any) {
            toast({
                title: "Setup Failed",
                description: "Could not save your profile. Please try again.",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-slate-500 font-medium">Initializing onboarding...</p>
        </div>
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50/50 p-6">
            <Card className="w-full max-w-2xl shadow-xl border-none">
                <CardHeader className="text-center space-y-2 pb-8">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                        <GraduationCap className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-extrabold font-headline">{t("Finish your Profile")}</CardTitle>
                    <CardDescription className="text-lg">Help us personalize your experience based on your local teaching context.</CardDescription>

                    {/* Step Indicator */}
                    <div className="flex justify-center gap-2 mt-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-1.5 w-12 rounded-full transition-colors ${step >= i ? "bg-primary" : "bg-slate-200"}`} />
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="space-y-8 px-8 min-h-[400px]">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <UserCircle className="h-5 w-5" />
                                <span>1. Your Role & Bio</span>
                            </div>
                            <div className="grid gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Primary Department*</Label>
                                        <Select
                                            value={formData.department}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, department: v }))}
                                        >
                                            <SelectTrigger className="h-12 shadow-sm">
                                                <SelectValue placeholder="Select Dept" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DEPARTMENTS.map(d => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Designation</Label>
                                        <Input
                                            placeholder="e.g. Senior Teacher"
                                            value={formData.designation}
                                            onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                                            className="h-12 shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Short Bio</Label>
                                    <Textarea
                                        placeholder="Tell us about your teaching philosophy..."
                                        value={formData.bio}
                                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                        className="h-24 shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <MapPin className="h-5 w-5" />
                                <span>2. Location & Institution</span>
                            </div>
                            <div className="grid gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="school">School / Institution Name*</Label>
                                    <Input
                                        id="school"
                                        placeholder="e.g. Kendriya Vidyalaya, Delhi"
                                        value={formData.schoolName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, schoolName: e.target.value }))}
                                        className="h-12 text-lg shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="district">District / Region</Label>
                                    <Input
                                        id="district"
                                        placeholder="e.g. North Delhi"
                                        value={formData.district}
                                        onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                                        className="h-12 shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <BookOpen className="h-5 w-5" />
                                <span>3. Your Subjects*</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {SUBJECTS.map((subject) => (
                                    <div key={subject} className={cn(
                                        "flex items-center space-x-2 p-3 border rounded-xl transition-all cursor-pointer group hover:border-primary/50",
                                        formData.subjects.includes(subject) ? "bg-primary/5 border-primary shadow-sm" : "bg-white"
                                    )} onClick={() => handleSubjectChange(subject)}>
                                        <Checkbox
                                            id={`sub-${subject}`}
                                            checked={formData.subjects.includes(subject)}
                                            onCheckedChange={() => handleSubjectChange(subject)}
                                            className="rounded-full"
                                        />
                                        <Label htmlFor={`sub-${subject}`} className="text-sm cursor-pointer font-medium group-hover:text-primary transition-colors">{subject}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Layers className="h-5 w-5" />
                                <span>4. Classes & Language*</span>
                            </div>
                            <div className="space-y-4">
                                <Label>Which classes do you teach?</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                    {GRADE_LEVELS.slice(3).map((grade) => (
                                        <button
                                            key={grade}
                                            onClick={() => handleGradeChange(grade)}
                                            className={`px-3 py-2.5 text-sm font-semibold rounded-xl border transition-all ${formData.gradeLevels.includes(grade)
                                                ? "bg-primary text-white border-primary shadow-lg scale-[1.02]"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                                                }`}
                                        >
                                            {grade}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2 pt-4">
                                <Label>Preferred Language for SahayakAI</Label>
                                <Select
                                    value={formData.preferredLanguage}
                                    onValueChange={(v) => setFormData(prev => ({ ...prev, preferredLanguage: v }))}
                                >
                                    <SelectTrigger className="h-12 shadow-sm rounded-xl">
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {LANGUAGES.map(lang => (
                                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between px-8 py-8 border-t bg-slate-50/50 rounded-b-3xl">
                    <Button
                        variant="ghost"
                        onClick={() => setStep(prev => prev - 1)}
                        disabled={step === 1 || submitting}
                        className="rounded-xl px-6"
                    >
                        Back
                    </Button>

                    {step < 4 ? (
                        <Button
                            onClick={() => setStep(prev => prev + 1)}
                            disabled={(step === 1 && !formData.department) || (step === 2 && !formData.schoolName)}
                            className="w-36 rounded-xl shadow-lg shadow-primary/20"
                        >
                            Next Step
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-48 gap-2 rounded-xl shadow-lg shadow-primary/20"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {t("Enter Community")}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
