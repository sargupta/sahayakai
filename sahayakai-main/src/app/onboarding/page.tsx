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
import { SUBJECTS, GRADE_LEVELS, LANGUAGES, INDIAN_STATES, LANGUAGE_NATIVE_LABELS, STATE_BOARD_MAP } from "@/types";
import { tState, tSubject } from "@/lib/i18n-proper-nouns";
import { updateProfileAction, getProfileData } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { Loader2, GraduationCap, MapPin, BookOpen, Sparkles, ArrowRight, ChevronDown, ChevronUp, Check, Clock, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOnboardingExample, type OnboardingExample } from "@/data/onboarding-examples";
import { getOnboardingExampleTopic } from "@/lib/contextual-suggestions";
import { saveToLibrary } from "@/app/actions/content";
import { MicrophoneInput } from "@/components/microphone-input";

import type { Language, ContentType } from "@/types";

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

    // Step 0 = language picker, Step 1 = single-screen setup, Step 2 = hybrid aha moment
    const [step, setStep] = useState(0);
    const [showEarlyChildhood, setShowEarlyChildhood] = useState(false);
    const stepContainerRef = useRef<HTMLDivElement>(null);

    // Aha moment state
    const [previewExample, setPreviewExample] = useState<OnboardingExample | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<any>(null);
    const [generationError, setGenerationError] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<string>("");
    const [showAllActivities, setShowAllActivities] = useState(false);

    // B1: Accordion state for Step 1 mobile scroll
    const [activeSection, setActiveSection] = useState(0);
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Focus management
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

    // Form state — all fields on ONE screen
    const [formData, setFormData] = useState({
        schoolName: "",
        educationBoard: "",
        boardCategory: "",
        state: "",
        subjects: [] as string[],
        gradeLevels: [] as string[],
        preferredLanguage: "English" as Language,
    });

    // B1: Auto-advance accordion when a section is complete
    useEffect(() => {
        if (step !== 1) return;
        if (activeSection === 0 && formData.schoolName.trim() && formData.state) {
            const timer = setTimeout(() => setActiveSection(1), 400);
            return () => clearTimeout(timer);
        }
    }, [step, activeSection, formData.schoolName, formData.state]);

    useEffect(() => {
        if (step !== 1) return;
        if (activeSection === 1 && formData.educationBoard) {
            const timer = setTimeout(() => setActiveSection(2), 400);
            return () => clearTimeout(timer);
        }
    }, [step, activeSection, formData.educationBoard]);

    // Scroll active section into view on mobile
    useEffect(() => {
        if (step !== 1) return;
        const el = sectionRefs.current[activeSection];
        if (el) {
            const timer = setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [step, activeSection]);

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
                    if (profile) {
                        setFormData(prev => ({
                            ...prev,
                            schoolName: profile.schoolName || "",
                            educationBoard: profile.educationBoard || "",
                            state: profile.state || "",
                            subjects: profile.subjects || [],
                            gradeLevels: profile.gradeLevels || [],
                            preferredLanguage: (profile.preferredLanguage as Language) || "English",
                        }));
                        if (profile.educationBoard === 'CBSE') {
                            setFormData(prev => ({ ...prev, boardCategory: 'CBSE' }));
                        } else if (profile.educationBoard === 'ICSE / ISC') {
                            setFormData(prev => ({ ...prev, boardCategory: 'ICSE / ISC' }));
                        } else if (profile.educationBoard) {
                            setFormData(prev => ({ ...prev, boardCategory: 'state_board' }));
                        }
                        if (profile.preferredLanguage) {
                            setStep(1);
                        }
                    }
                    // Default remains English for new teachers. We used to
                    // auto-detect from navigator.language (e.g. hi-IN →
                    // preSelected Hindi), but that bypassed the teacher's
                    // explicit choice: a teacher on an Indic-locale browser
                    // who wanted English still ended up with Hindi because
                    // they never actively changed the pre-selected value.
                    // The spec is "default English, teacher explicitly
                    // changes during onboarding" — so we no longer auto-pick.
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

    const saveStep = async (stepData: Record<string, any>) => {
        if (!userId) return;
        try {
            await updateProfileAction(userId, stepData);
        } catch {
            // Non-fatal
        }
    };

    const handleLanguageSelect = async (lang: Language) => {
        setFormData(prev => ({ ...prev, preferredLanguage: lang }));
        await setLanguage(lang, false);
        await saveStep({ preferredLanguage: lang });
        setStep(1);
    };

    // Step 1 "Show me what SahayakAI can do" — saves profile + shows aha moment
    const handleStep1Submit = async () => {
        if (!userId) return;
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
                onboardingPhase: 'first-generation',
                profileCompletionLevel: 'basic',
            };

            await updateProfileAction(userId, profileData);
            await setLanguage(formData.preferredLanguage as Language, false);

            // Load pre-generated example for their subject/grade
            const example = getOnboardingExample(formData.subjects, formData.gradeLevels, formData.preferredLanguage === 'Hindi' ? 'Hindi' : 'English');
            setPreviewExample(example);

            // Get topic suggestion for real generation
            const topic = getOnboardingExampleTopic({
                subjects: formData.subjects,
                gradeLevels: formData.gradeLevels,
                educationBoard: formData.educationBoard,
            });
            if (topic) setSelectedTopic(topic.topic);

            setStep(2);
        } catch {
            toast({
                title: "Setup Failed",
                description: "Could not save your profile. Please try again.",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Real AI generation in Step 2
    const handleGenerate = async () => {
        if (!selectedTopic.trim() || !userId) return;
        setGenerating(true);
        setGenerationError(false);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch("/api/ai/lesson-plan", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    topic: selectedTopic,
                    gradeLevel: formData.gradeLevels[0] || "Class 6",
                    subject: formData.subjects[0] || "Science",
                    language: formData.preferredLanguage,
                }),
            });
            if (!res.ok) throw new Error("Generation failed");
            const data = await res.json();
            setGeneratedContent(data);
        } catch {
            setGenerationError(true);
        } finally {
            setGenerating(false);
        }
    };

    // Finish onboarding — save generated content to library if present, then go home
    const handleFinish = async () => {
        if (!userId) { router.push("/"); return; }

        const updates: Record<string, any> = { onboardingPhase: 'exploring' };

        // B5: Save generated content to library
        if (generatedContent) {
            try {
                const title = generatedContent.result?.title || generatedContent.title || `Lesson Plan: ${selectedTopic}`;
                const result = await saveToLibrary(userId, 'lesson-plan' as ContentType, title, generatedContent);
                if (result.success && result.id) {
                    updates.firstGenerationContentId = result.id;
                    updates.firstGenerationTool = 'lesson-plan';
                }
            } catch {
                // Non-fatal: content is lost but don't block onboarding
            }
        }

        await saveStep(updates);
        router.push("/");
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
    );

    // Step 0 — Language Picker (unchanged)
    if (step === 0) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background/50 p-3 sm:p-6">
                <Card className="w-full max-w-lg rounded-2xl border border-border shadow-soft">
                    <CardHeader className="text-center space-y-2 pb-4 pt-7">
                        <CardTitle className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">
                            {t("Choose your language")}
                        </CardTitle>
                        <CardDescription className="text-base">
                            {t("SahayakAI works in 11 Indian languages.")}
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

    // Step 2 — Hybrid Aha Moment
    if (step === 2) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background/50 p-3 sm:p-6">
                <div className="w-full max-w-2xl space-y-6">
                    {/* Pre-generated example */}
                    <Card className="rounded-2xl border border-border shadow-soft">
                        <CardHeader className="text-center space-y-1.5 pb-3 pt-6">
                            <CardTitle className="text-xl sm:text-2xl font-bold font-headline tracking-tight">
                                {t("Sample lesson plan")}
                            </CardTitle>
                            <CardDescription>
                                {previewExample?.title}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6">
                            {previewExample && (
                                <>
                                    {/* Objectives */}
                                    <div className="flex items-start gap-2">
                                        <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground">{t("Learning objectives")}</p>
                                            <ul className="text-sm space-y-1 mt-1">
                                                {previewExample.objectives.map((obj, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Check className="h-3 w-3 text-primary mt-1 shrink-0" />
                                                        <span>{obj}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>{previewExample.duration}</span>
                                    </div>

                                    {/* Activities preview */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground">{t("Activities")}</p>
                                        {(showAllActivities ? previewExample.activities : previewExample.activities.slice(0, 3)).map((act, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 animate-in fade-in duration-300">
                                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">{t(act.phase)}</span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium">{act.title}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{act.description}</p>
                                                </div>
                                                <span className="text-xs text-muted-foreground shrink-0">{act.duration}</span>
                                            </div>
                                        ))}
                                        {previewExample.activities.length > 3 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllActivities(!showAllActivities)}
                                                className="flex items-center justify-center gap-1 text-xs text-primary font-medium hover:underline w-full py-1"
                                            >
                                                {showAllActivities ? (
                                                    <><ChevronUp className="h-3 w-3" /> {t("Show fewer")}</>
                                                ) : (
                                                    <><ChevronDown className="h-3 w-3" /> {t("Show all {n} activities").replace("{n}", String(previewExample.activities.length))}</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Real generation CTA */}
                    <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-soft">
                        <CardContent className="p-4 sm:p-6 space-y-4">
                            <h3 className="font-headline font-bold text-base">{t("Create your own")}</h3>

                            <div className="flex gap-2 items-center">
                                <Input
                                    value={selectedTopic}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    placeholder="Enter a topic..."
                                    className="h-10 text-sm shadow-soft flex-1"
                                />
                                <MicrophoneInput
                                    onTranscriptChange={(transcript) => setSelectedTopic(transcript)}
                                    iconSize="sm"
                                    className="h-10 w-10 shrink-0 rounded-xl"
                                />
                                <Button
                                    onClick={handleGenerate}
                                    disabled={generating || !selectedTopic.trim()}
                                    className="rounded-xl gap-1 shrink-0"
                                >
                                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {t("Create this")}
                                </Button>
                            </div>

                            {/* Generated content preview */}
                            {generatedContent && (
                                <div className="p-3 rounded-xl bg-background border border-border">
                                    <p className="text-sm font-semibold text-primary mb-1">
                                        {generatedContent.result?.title || generatedContent.title || "Your Lesson Plan"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Created successfully! You can view and edit this from your library.
                                    </p>
                                </div>
                            )}

                            {generationError && (
                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                                    <p className="text-sm text-destructive">
                                        Could not generate. Don&apos;t worry, you can create content anytime from the home page.
                                    </p>
                                    <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-2 rounded-xl">
                                        Try again
                                    </Button>
                                </div>
                            )}

                            {generating && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <div>
                                        <p className="text-sm font-medium">{t("Generating lesson plan")}</p>
                                        <p className="text-xs text-muted-foreground">{t("Usually takes 20–30 seconds.")}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Navigation */}
                    <div className="flex justify-between items-center">
                        <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">
                            {t("Back")}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleFinish} className="rounded-xl h-11">
                                {t("Skip for now")}
                            </Button>
                            <Button onClick={handleFinish} className="rounded-xl gap-1 shadow-sm h-11 px-5">
                                {generatedContent ? t("Save and continue") : t("Continue")}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Step 1 — Single-screen setup (School + State + Board + Subjects + Grades)
    const isStep1Valid =
        formData.schoolName.trim() &&
        formData.state &&
        formData.educationBoard &&
        formData.subjects.length > 0 &&
        formData.gradeLevels.length > 0;

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background/50 p-3 sm:p-6">
            <Card className="w-full max-w-lg sm:max-w-2xl rounded-2xl border border-border shadow-soft">
                <CardHeader className="text-center space-y-2 pb-4 sm:pb-6 pt-7">
                    <CardTitle className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">
                        {t("Tell us about your teaching")}
                    </CardTitle>
                    <CardDescription className="text-base">
                        {t("We use this to personalise lesson plans, quizzes, and the community feed.")}
                    </CardDescription>
                </CardHeader>

                <CardContent ref={stepContainerRef} className="space-y-2 px-4 sm:px-8">
                    {/* Section 0: School & State */}
                    <div ref={el => { sectionRefs.current[0] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 0 ? -1 : 0)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("School / Institution Name")} & {t("State")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.schoolName.trim() && formData.state && activeSection !== 0 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{formData.schoolName.split(' ').slice(0,2).join(' ')}, {tState(formData.state, formData.preferredLanguage)}</span>
                                )}
                                {formData.schoolName.trim() && formData.state ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                        {activeSection === 0 && (
                            <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-1.5">
                                    <Label htmlFor="school" className="text-xs">{t("School / Institution Name")}*</Label>
                                    <Input
                                        id="school"
                                        placeholder={t("e.g. Kendriya Vidyalaya, Delhi")}
                                        value={formData.schoolName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, schoolName: e.target.value }))}
                                        className="h-11 text-sm shadow-soft"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">{t("State")}*</Label>
                                    <Select value={formData.state} onValueChange={handleStateChange}>
                                        <SelectTrigger className="h-11 shadow-soft">
                                            <SelectValue placeholder={t("Select your state")} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {INDIAN_STATES.map(s => (
                                                <SelectItem key={s} value={s}>{tState(s, formData.preferredLanguage)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 1: Education Board */}
                    <div ref={el => { sectionRefs.current[1] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 1 ? -1 : 1)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Education Board")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.educationBoard && activeSection !== 1 && (
                                    <span className="text-xs text-muted-foreground">{formData.educationBoard}</span>
                                )}
                                {formData.educationBoard ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                        {activeSection === 1 && (
                            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-3 gap-1.5">
                                    {BOARD_CATEGORIES.map(cat => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => handleBoardCategoryChange(cat.value)}
                                            className={cn(
                                                "px-2 py-2.5 text-xs font-semibold rounded-xl border transition-all",
                                                formData.boardCategory === cat.value
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                            )}
                                            aria-pressed={formData.boardCategory === cat.value}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                                {formData.boardCategory === 'state_board' && formData.state && formData.educationBoard && (
                                    <p className="text-xs text-muted-foreground mt-2">Selected: {formData.educationBoard}</p>
                                )}
                                {formData.boardCategory === 'state_board' && !formData.state && (
                                    <p className="text-xs text-destructive mt-2">{t("Please select your state first.")}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Subjects */}
                    <div ref={el => { sectionRefs.current[2] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 2 ? -1 : 2)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Subjects")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.subjects.length > 0 && activeSection !== 2 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {formData.subjects.slice(0, 2).map(s => tSubject(s, formData.preferredLanguage)).join(', ')}{formData.subjects.length > 2 ? ` +${formData.subjects.length - 2}` : ''}
                                    </span>
                                )}
                                {formData.subjects.length > 0 ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                        {activeSection === 2 && (
                            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2" role="group" aria-label="Select your subjects">
                                    {SUBJECTS.map((subject) => (
                                        <div key={subject} className={cn(
                                            "flex items-center space-x-2 p-2.5 border rounded-xl transition-all cursor-pointer group hover:border-primary/50",
                                            formData.subjects.includes(subject) ? "bg-primary/5 border-primary shadow-soft" : "bg-card"
                                        )} onClick={() => handleSubjectChange(subject)}>
                                            <Checkbox
                                                id={`sub-${subject}`}
                                                checked={formData.subjects.includes(subject)}
                                                onCheckedChange={() => handleSubjectChange(subject)}
                                                className="rounded-full"
                                            />
                                            <Label htmlFor={`sub-${subject}`} className="text-sm cursor-pointer font-medium group-hover:text-primary transition-colors">{tSubject(subject, formData.preferredLanguage)}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Grade Levels */}
                    <div ref={el => { sectionRefs.current[3] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 3 ? -1 : 3)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Classes")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.gradeLevels.length > 0 && activeSection !== 3 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {formData.gradeLevels.slice(0, 3).join(', ')}{formData.gradeLevels.length > 3 ? ` +${formData.gradeLevels.length - 3}` : ''}
                                    </span>
                                )}
                                {formData.gradeLevels.length > 0 ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                        {activeSection === 3 && (
                            <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2" role="group" aria-label="Select your classes">
                                    {GRADE_LEVELS.slice(3).map((grade) => (
                                        <button
                                            key={grade}
                                            type="button"
                                            onClick={() => handleGradeChange(grade)}
                                            aria-pressed={formData.gradeLevels.includes(grade)}
                                            className={cn(
                                                "px-2 py-2.5 text-xs font-semibold rounded-xl border transition-all",
                                                formData.gradeLevels.includes(grade)
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:shadow-soft"
                                            )}
                                        >
                                            {grade}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowEarlyChildhood(!showEarlyChildhood)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <ChevronDown className={cn("h-3 w-3 transition-transform", showEarlyChildhood && "rotate-180")} />
                                    Early Childhood (Nursery, LKG, UKG)
                                </button>
                                {showEarlyChildhood && (
                                    <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-300">
                                        {GRADE_LEVELS.slice(0, 3).map((grade) => (
                                            <button
                                                key={grade}
                                                type="button"
                                                onClick={() => handleGradeChange(grade)}
                                                aria-pressed={formData.gradeLevels.includes(grade)}
                                                className={cn(
                                                    "px-2 py-2.5 text-xs font-semibold rounded-xl border transition-all",
                                                    formData.gradeLevels.includes(grade)
                                                        ? "bg-primary text-white border-primary shadow-sm"
                                                        : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:shadow-soft"
                                                )}
                                            >
                                                {grade}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="flex justify-between px-4 sm:px-8 py-4 sm:py-6 border-t bg-muted/20 rounded-b-3xl">
                    <Button
                        variant="ghost"
                        onClick={() => setStep(0)}
                        className="rounded-xl px-6"
                    >
                        {t("Back")}
                    </Button>

                    <Button
                        onClick={handleStep1Submit}
                        disabled={!isStep1Valid || submitting}
                        className="gap-2 rounded-xl shadow-sm px-5 h-11"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t("Continue")}
                        {!submitting && <ArrowRight className="h-4 w-4" />}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
