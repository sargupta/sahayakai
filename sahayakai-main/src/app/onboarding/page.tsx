"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS, GRADE_LEVELS, LANGUAGES, DEPARTMENTS, INDIAN_STATES, LANGUAGE_NATIVE_LABELS, STATE_BOARD_MAP } from "@/types";
import { updateProfileAction, getProfileData } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { Loader2, GraduationCap, MapPin, BookOpen, Layers, UserCircle, Shield, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Link from "next/link";

import type { Language } from "@/types";

// Board options for the cascading selector
const BOARD_CATEGORIES = [
    { value: 'CBSE', label: 'CBSE' },
    { value: 'ICSE / ISC', label: 'ICSE / ISC' },
    { value: 'state_board', label: 'State Board' },
] as const;

export default function OnboardingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { t, setLanguage } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Step 0 = language picker, Steps 1-3 = form
    const [step, setStep] = useState(0);
    const [showEarlyChildhood, setShowEarlyChildhood] = useState(false);
    const stepContainerRef = useRef<HTMLDivElement>(null);

    // Focus management — focus first focusable element after step transition
    useEffect(() => {
        if (step === 0) return;
        const container = stepContainerRef.current;
        if (!container) return;
        const timer = setTimeout(() => {
            const focusable = container.querySelector<HTMLElement>('input, select, button, [tabindex]');
            focusable?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, [step]);

    // Form State
    const [formData, setFormData] = useState({
        // Step 1 — What You Teach
        schoolName: "",
        educationBoard: "",
        boardCategory: "",   // CBSE | ICSE / ISC | state_board
        state: "",
        // Step 2 — Subjects & Classes
        subjects: [] as string[],
        gradeLevels: [] as string[],
        // Step 3 — About You (skippable)
        department: "",
        designation: "",
        district: "",
        bio: "",
        // Pre-step
        preferredLanguage: "English" as Language,
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                try {
                    const { profile } = await getProfileData(user.uid);
                    if (profile && profile.schoolName) {
                        router.push("/");
                        return;
                    }
                    // Resume from where they left off (progressive save)
                    if (profile) {
                        setFormData(prev => ({
                            ...prev,
                            schoolName: profile.schoolName || "",
                            educationBoard: profile.educationBoard || "",
                            state: profile.state || "",
                            subjects: profile.subjects || [],
                            gradeLevels: profile.gradeLevels || [],
                            preferredLanguage: (profile.preferredLanguage as Language) || "English",
                            department: profile.department || "",
                            designation: profile.designation || "",
                            district: profile.district || "",
                            bio: profile.bio || "",
                        }));
                        // Determine board category from existing board
                        if (profile.educationBoard === 'CBSE') {
                            setFormData(prev => ({ ...prev, boardCategory: 'CBSE' }));
                        } else if (profile.educationBoard === 'ICSE / ISC') {
                            setFormData(prev => ({ ...prev, boardCategory: 'ICSE / ISC' }));
                        } else if (profile.educationBoard) {
                            setFormData(prev => ({ ...prev, boardCategory: 'state_board' }));
                        }
                        // If they already picked language, skip to step 1
                        if (profile.preferredLanguage) {
                            setStep(1);
                        }
                    }
                    // Auto-detect language from browser
                    if (!profile?.preferredLanguage) {
                        const browserLang = navigator.language?.split('-')[0];
                        const { LANGUAGE_CODE_MAP } = await import('@/types');
                        const detected = LANGUAGE_CODE_MAP[browserLang];
                        if (detected) {
                            setFormData(prev => ({ ...prev, preferredLanguage: detected }));
                        }
                    }
                } catch (err) {
                    console.error("Failed to load profile for onboarding:", err);
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

    const handleBoardCategoryChange = (category: string) => {
        setFormData(prev => ({
            ...prev,
            boardCategory: category,
            educationBoard: category === 'state_board'
                ? (prev.state ? STATE_BOARD_MAP[prev.state] || '' : '')
                : category,
        }));
    };

    const handleStateChange = (state: string) => {
        setFormData(prev => ({
            ...prev,
            state,
            educationBoard: prev.boardCategory === 'state_board'
                ? (STATE_BOARD_MAP[state] || prev.educationBoard)
                : prev.educationBoard,
        }));
    };

    // Progressive save — save after each step completion
    const saveStep = async (stepData: Record<string, any>) => {
        if (!userId) return;
        try {
            await updateProfileAction(userId, stepData);
        } catch {
            // Non-fatal — data will be saved on final submit
        }
    };

    const handleLanguageSelect = async (lang: Language) => {
        setFormData(prev => ({ ...prev, preferredLanguage: lang }));
        await setLanguage(lang, false); // Update UI language immediately
        await saveStep({ preferredLanguage: lang });
        setStep(1);
    };

    const handleStep1Next = async () => {
        await saveStep({
            schoolName: formData.schoolName,
            schoolNormalized: formData.schoolName.toUpperCase().trim(),
            educationBoard: formData.educationBoard,
            state: formData.state,
        });
        setStep(2);
    };

    const handleStep2Next = async () => {
        await saveStep({
            subjects: formData.subjects,
            gradeLevels: formData.gradeLevels,
        });
        setStep(3);
    };

    const handleSubmit = async (skipStep3: boolean = false) => {
        if (!userId) return;
        if (!formData.schoolName || formData.subjects.length === 0 || formData.gradeLevels.length === 0) {
            toast({
                title: "Information Required",
                description: "Please fill in your school, subjects, and grades to continue.",
                variant: "destructive"
            });
            return;
        }

        setSubmitting(true);
        try {
            const profileData: Record<string, any> = {
                schoolName: formData.schoolName,
                schoolNormalized: formData.schoolName.toUpperCase().trim(),
                educationBoard: formData.educationBoard || undefined,
                state: formData.state || undefined,
                subjects: formData.subjects,
                gradeLevels: formData.gradeLevels,
                preferredLanguage: formData.preferredLanguage,
                communityIntroState: 'none',
                impactScore: 0,
                contentSharedCount: 0,
                followersCount: 0,
                followingCount: 0,
                verifiedStatus: 'none',
                badges: ["New Member"],
            };

            if (!skipStep3) {
                if (formData.department) profileData.department = formData.department;
                if (formData.designation) profileData.designation = formData.designation;
                if (formData.district) profileData.district = formData.district;
                if (formData.bio) profileData.bio = formData.bio;
            }

            await updateProfileAction(userId, profileData);
            await setLanguage(formData.preferredLanguage as Language, false);

            toast({
                title: "Welcome to SahayakAI!",
                description: "Your profile has been set up successfully.",
            });

            router.push("/");
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
    );

    // Step 0 — Language Picker (full screen, native scripts)
    if (step === 0) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background/50 p-3 sm:p-6">
                <Card className="w-full max-w-lg rounded-2xl border border-border shadow-soft">
                    <CardHeader className="text-center space-y-2 pb-4">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                            <GraduationCap className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight">
                            {t("Choose your language")}
                        </CardTitle>
                        <CardDescription className="text-base">
                            SahayakAI works in your language
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-8 pb-8">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => handleLanguageSelect(lang)}
                                    className={cn(
                                        "p-4 rounded-xl border text-center transition-all",
                                        "hover:border-primary/50 hover:shadow-soft active:scale-95",
                                        formData.preferredLanguage === lang
                                            ? "bg-primary/5 border-primary shadow-soft"
                                            : "bg-card border-border"
                                    )}
                                >
                                    <span className="block text-lg font-semibold">{LANGUAGE_NATIVE_LABELS[lang]}</span>
                                    {lang !== LANGUAGE_NATIVE_LABELS[lang] && (
                                        <span className="block text-xs text-muted-foreground mt-1">{lang}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Steps 1-3 — Profile Form
    const totalSteps = 3;

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background/50 p-3 sm:p-6">
            <Card className="w-full max-w-lg sm:max-w-2xl rounded-2xl border border-border shadow-soft">
                <CardHeader className="text-center space-y-2 pb-4 sm:pb-8">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                        <GraduationCap className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight">
                        {t("Finish your Profile")}
                    </CardTitle>
                    <CardDescription className="text-lg">
                        {formData.preferredLanguage !== 'English' && (
                            <span className="text-xs text-muted-foreground mr-2">({LANGUAGE_NATIVE_LABELS[formData.preferredLanguage]})</span>
                        )}
                        Help us personalize your experience
                    </CardDescription>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-2 mb-6" role="progressbar" aria-label={`Step ${step} of ${totalSteps}`} aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
                        {[1, 2, 3].map(s => (
                            <div key={s} className={cn("h-2 rounded-full transition-all", s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary/60" : "w-2 bg-border")} />
                        ))}
                    </div>
                </CardHeader>

                <CardContent ref={stepContainerRef} className="space-y-6 px-4 sm:px-8 min-h-[350px]">
                    {/* Step 1 — What You Teach */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <MapPin className="h-5 w-5" />
                                <span>1. {t("What You Teach")}</span>
                            </div>

                            {/* School Name */}
                            <div className="space-y-2">
                                <Label htmlFor="school">{t("School / Institution Name")}*</Label>
                                <Input
                                    id="school"
                                    placeholder="e.g. Kendriya Vidyalaya, Delhi"
                                    value={formData.schoolName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, schoolName: e.target.value }))}
                                    className="h-12 text-base shadow-soft"
                                />
                            </div>

                            {/* State */}
                            <div className="space-y-2">
                                <Label>{t("State")}*</Label>
                                <Select
                                    value={formData.state}
                                    onValueChange={handleStateChange}
                                >
                                    <SelectTrigger className="h-12 shadow-soft">
                                        <SelectValue placeholder="Select your state" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {INDIAN_STATES.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Board — Cascading: CBSE / ICSE / State Board */}
                            <div className="space-y-2">
                                <Label>{t("Education Board")}*</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BOARD_CATEGORIES.map(cat => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => handleBoardCategoryChange(cat.value)}
                                            className={cn(
                                                "px-3 py-3 text-sm font-semibold rounded-xl border transition-all",
                                                formData.boardCategory === cat.value
                                                    ? "bg-primary text-white border-primary shadow-lg"
                                                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                            )}
                                            aria-pressed={formData.boardCategory === cat.value}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                                {formData.boardCategory === 'state_board' && formData.state && formData.educationBoard && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Selected: {formData.educationBoard}
                                    </p>
                                )}
                                {formData.boardCategory === 'state_board' && !formData.state && (
                                    <p className="text-sm text-orange-600 mt-2">
                                        Please select your state above first
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2 — Subjects & Classes */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <BookOpen className="h-5 w-5" />
                                <span>2. {t("Your Subjects & Classes")}</span>
                            </div>

                            {/* Subjects */}
                            <div className="space-y-2">
                                <Label>{t("Subjects")}*</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3" role="group" aria-label="Select your subjects">
                                    {SUBJECTS.map((subject) => (
                                        <div key={subject} className={cn(
                                            "flex items-center space-x-2 p-3 border rounded-xl transition-all cursor-pointer group hover:border-primary/50",
                                            formData.subjects.includes(subject) ? "bg-primary/5 border-primary shadow-soft" : "bg-card"
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

                            {/* Grade Levels */}
                            <div className="space-y-2">
                                <Label>{t("Classes")}*</Label>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5" role="group" aria-label="Select your classes">
                                    {GRADE_LEVELS.slice(3).map((grade) => (
                                        <button
                                            key={grade}
                                            type="button"
                                            onClick={() => handleGradeChange(grade)}
                                            aria-pressed={formData.gradeLevels.includes(grade)}
                                            className={cn(
                                                "px-3 py-3 text-sm font-semibold rounded-xl border transition-all",
                                                formData.gradeLevels.includes(grade)
                                                    ? "bg-primary text-white border-primary shadow-lg"
                                                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:shadow-soft"
                                            )}
                                        >
                                            {grade}
                                        </button>
                                    ))}
                                </div>
                                {/* Early Childhood toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowEarlyChildhood(!showEarlyChildhood)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
                                >
                                    <ChevronDown className={cn("h-3 w-3 transition-transform", showEarlyChildhood && "rotate-180")} />
                                    Early Childhood (Nursery, LKG, UKG)
                                </button>
                                {showEarlyChildhood && (
                                    <div className="grid grid-cols-3 gap-2.5 mt-2 animate-in fade-in duration-300">
                                        {GRADE_LEVELS.slice(0, 3).map((grade) => (
                                            <button
                                                key={grade}
                                                type="button"
                                                onClick={() => handleGradeChange(grade)}
                                                aria-pressed={formData.gradeLevels.includes(grade)}
                                                className={cn(
                                                    "px-3 py-3 text-sm font-semibold rounded-xl border transition-all",
                                                    formData.gradeLevels.includes(grade)
                                                        ? "bg-primary text-white border-primary shadow-lg"
                                                        : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:shadow-soft"
                                                )}
                                            >
                                                {grade}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3 — About You (skippable) */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <UserCircle className="h-5 w-5" />
                                <span>3. {t("About You")}</span>
                            </div>
                            <p className="text-sm text-muted-foreground -mt-2">
                                Optional — you can complete this later from your profile.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Department</Label>
                                    <Select
                                        value={formData.department}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, department: v }))}
                                    >
                                        <SelectTrigger className="h-12 shadow-soft">
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
                                        className="h-12 shadow-soft"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>District / Region</Label>
                                <Input
                                    placeholder="e.g. North Delhi"
                                    value={formData.district}
                                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                                    className="h-12 shadow-soft"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Short Bio</Label>
                                <Textarea
                                    placeholder="Tell us about your teaching philosophy..."
                                    value={formData.bio}
                                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                    className="h-24 shadow-soft"
                                />
                            </div>

                            <Link
                                href="/privacy-for-teachers"
                                target="_blank"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <Shield className="h-4 w-4" />
                                Your data is private and never shared with inspectors
                            </Link>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between px-4 sm:px-8 py-4 sm:py-8 border-t bg-muted/20 rounded-b-3xl">
                    <Button
                        variant="ghost"
                        onClick={() => setStep(prev => prev - 1)}
                        disabled={step <= 1 || submitting}
                        className="rounded-xl px-6"
                    >
                        {t("Back")}
                    </Button>

                    <div className="flex gap-2">
                        {step === 3 && (
                            <Button
                                variant="outline"
                                onClick={() => handleSubmit(true)}
                                disabled={submitting}
                                className="rounded-xl"
                            >
                                {t("Skip for now")}
                            </Button>
                        )}

                        {step === 1 && (
                            <Button
                                onClick={handleStep1Next}
                                disabled={!formData.schoolName.trim() || !formData.educationBoard || !formData.state}
                                className="w-36 rounded-xl shadow-lg shadow-primary/20"
                            >
                                {t("Next Step")}
                            </Button>
                        )}

                        {step === 2 && (
                            <Button
                                onClick={handleStep2Next}
                                disabled={formData.subjects.length === 0 || formData.gradeLevels.length === 0}
                                className="w-36 rounded-xl shadow-lg shadow-primary/20"
                            >
                                {t("Next Step")}
                            </Button>
                        )}

                        {step === 3 && (
                            <Button
                                onClick={() => handleSubmit(false)}
                                disabled={submitting}
                                className="w-48 gap-2 rounded-xl shadow-lg shadow-primary/20"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t("Get Started")}
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
