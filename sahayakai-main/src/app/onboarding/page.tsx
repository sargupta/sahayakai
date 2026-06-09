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
import { SUBJECTS, GRADE_LEVELS, LANGUAGES, INDIAN_STATES, LANGUAGE_NATIVE_LABELS, STATE_BOARD_MAP, ADMINISTRATIVE_ROLES, EDUCATION_BOARDS, LANGUAGE_CODE_MAP } from "@/types";
import type { AdministrativeRole, EducationBoard } from "@/types";
import { tState, tSubject } from "@/lib/i18n-proper-nouns";
import { updateProfileAction, getProfileData, lookupSchoolDominantLocationAction } from "@/app/actions/profile";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { Loader2, GraduationCap, MapPin, BookOpen, Sparkles, ArrowRight, ChevronDown, ChevronUp, Check, Clock, Target, Users, Briefcase } from "lucide-react";
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

const ROLE_OPTIONS: { value: AdministrativeRole; label: string; hint: string }[] = [
    { value: 'none', label: 'Classroom Teacher', hint: 'Teach one or more classes' },
    { value: 'hod', label: 'HOD / Subject Lead', hint: 'Lead a subject department' },
    { value: 'coordinator', label: 'Coordinator', hint: 'Coordinate across teachers or sections' },
    { value: 'exam_controller', label: 'Exam Controller', hint: 'Run examinations and assessment' },
    { value: 'vice_principal', label: 'Vice Principal', hint: 'Manage academics for a wing' },
    { value: 'principal', label: 'Principal / School Admin', hint: 'Run the school' },
];

const ROLE_LABEL: Record<AdministrativeRole, string> = {
    'none': 'Classroom Teacher',
    'hod': 'HOD',
    'coordinator': 'Coordinator',
    'exam_controller': 'Exam Controller',
    'vice_principal': 'Vice Principal',
    'principal': 'Principal',
};

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
        displayName: "",
        schoolName: "",
        educationBoard: "",
        boardCategory: "",
        state: "",
        district: "",
        subjects: [] as string[],
        gradeLevels: [] as string[],
        preferredLanguage: "English" as Language,
        administrativeRole: undefined as AdministrativeRole | undefined,
        phoneNumber: "",
        pincode: "",
    });
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [pincodeError, setPincodeError] = useState<string | null>(null);
    const schoolLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // B1: Auto-advance accordion when a section is complete
    useEffect(() => {
        if (step !== 1) return;
        if (activeSection === 0 && formData.administrativeRole !== undefined) {
            const timer = setTimeout(() => setActiveSection(1), 400);
            return () => clearTimeout(timer);
        }
    }, [step, activeSection, formData.administrativeRole]);

    useEffect(() => {
        if (step !== 1) return;
        if (activeSection === 1 && formData.schoolName.trim() && formData.state) {
            const timer = setTimeout(() => setActiveSection(2), 400);
            return () => clearTimeout(timer);
        }
    }, [step, activeSection, formData.schoolName, formData.state]);

    useEffect(() => {
        if (step !== 1) return;
        if (activeSection === 2 && formData.educationBoard) {
            const timer = setTimeout(() => setActiveSection(3), 400);
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

    // F11-6: Per-section autosave for Step 1. Step 0 (language) already
    // persists on selection; Step 1 previously only saved on "Continue".
    // If the teacher closed the tab between sections, all Step 1 progress
    // was lost (and could not be repopulated on re-entry — see the
    // `getProfileData` effect above which pre-fills from Firestore).
    //
    // We send a single debounced patch per formData change. Only fields
    // that are non-empty are included — the action's allowlist + the
    // onboardingPhase prerequisite check (F11-3) will accept all of these
    // without requiring an explicit phase advance.
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (step !== 1) return;
        if (!userId) return;
        // Skip the initial-mount save: only autosave once the teacher has
        // actually interacted with at least one field on Step 1.
        const hasAnyInput =
            !!formData.displayName.trim()
            || !!formData.schoolName.trim()
            || !!formData.state
            || !!formData.educationBoard
            || formData.subjects.length > 0
            || formData.gradeLevels.length > 0
            || formData.administrativeRole !== undefined;
        if (!hasAnyInput) return;

        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            const patch: Record<string, any> = {};
            if (formData.displayName.trim()) patch.displayName = formData.displayName.trim();
            if (formData.schoolName.trim()) {
                patch.schoolName = formData.schoolName;
                patch.schoolNormalized = formData.schoolName.toUpperCase().trim();
            }
            if (formData.state) patch.state = formData.state;
            if (formData.educationBoard) patch.educationBoard = formData.educationBoard;
            if (formData.subjects.length > 0) patch.subjects = formData.subjects;
            if (formData.gradeLevels.length > 0) patch.gradeLevels = formData.gradeLevels;
            if (formData.administrativeRole !== undefined) patch.administrativeRole = formData.administrativeRole;
            if (Object.keys(patch).length === 0) return;
            saveStep(patch);
        }, 800);

        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        step,
        userId,
        formData.displayName,
        formData.schoolName,
        formData.state,
        formData.educationBoard,
        formData.subjects,
        formData.gradeLevels,
        formData.administrativeRole,
    ]);

    // School-name → state/district inference (A4). Debounced 500 ms.
    // Only fires when the user has not already picked a state, so we never
    // override their explicit choice.
    useEffect(() => {
        if (step !== 1) return;
        const sn = formData.schoolName.trim();
        if (sn.length < 4) return;
        if (formData.state) return;
        if (schoolLookupTimerRef.current) clearTimeout(schoolLookupTimerRef.current);
        schoolLookupTimerRef.current = setTimeout(async () => {
            try {
                const result = await lookupSchoolDominantLocationAction(sn);
                if (!result) return;
                if (result.matchCount < 3) return;
                setFormData(prev => {
                    // Only fill blanks. Never clobber.
                    if (prev.state || !result.state) return prev;
                    return {
                        ...prev,
                        state: result.state ?? prev.state,
                        district: prev.district || (result.district ?? ""),
                        // Cascading board picker: also default the state board.
                        educationBoard: prev.educationBoard ||
                            (result.state ? STATE_BOARD_MAP[result.state] || "" : ""),
                        boardCategory: prev.boardCategory ||
                            (result.state && STATE_BOARD_MAP[result.state] ? 'state_board' : prev.boardCategory),
                    };
                });
            } catch {
                /* non-fatal */
            }
        }, 500);
        return () => {
            if (schoolLookupTimerRef.current) clearTimeout(schoolLookupTimerRef.current);
        };
    }, [step, formData.schoolName, formData.state]);

    const detectLocation = async () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        setDetectingLocation(true);
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 8000,
                    maximumAge: 60000,
                });
            });
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/geo/reverse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.state || data.district) {
                    setFormData(prev => ({
                        ...prev,
                        state: prev.state || data.state || "",
                        district: prev.district || data.district || "",
                        educationBoard: prev.educationBoard ||
                            (data.state ? STATE_BOARD_MAP[data.state] || "" : ""),
                        boardCategory: prev.boardCategory ||
                            (data.state && STATE_BOARD_MAP[data.state] ? 'state_board' : prev.boardCategory),
                    }));
                }
            }
        } catch {
            // Silently skip — denied permission or timeout. Teacher can fill manually.
        } finally {
            setDetectingLocation(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                try {
                    const { profile } = await getProfileData(user.uid);
                    if (profile && profile.schoolName) {
                        // Already-onboarded teacher. Before sending them home,
                        // mint the profile-complete cookie + onboardingCompleted
                        // claim — otherwise, with the onboarding gate enabled,
                        // `/` redirects straight back here and we spin in an
                        // infinite / ⇆ /onboarding loop showing only "Loading…".
                        // (Root cause of the 2026-06-08 lockout: this redirect
                        // fired before any mark-complete call, so the escape
                        // hatch never issued a cookie.) Best-effort: even if the
                        // call fails we still navigate home.
                        try {
                            const token = await user.getIdToken();
                            await fetch('/api/profile/mark-complete', {
                                method: 'POST',
                                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                            });
                        } catch {
                            /* non-fatal — gate is default-off; cookie is a fast-path */
                        }
                        router.push("/");
                        return;
                    }
                    if (profile) {
                        // Pre-fill phone from Firebase Auth when present
                        // (phone-auth signups should not have to retype).
                        const authPhone = user.phoneNumber || profile.phoneNumber || (profile as Record<string, any>).phone || "";
                        setFormData(prev => ({
                            ...prev,
                            displayName: profile.displayName || user.displayName || "",
                            schoolName: profile.schoolName || "",
                            educationBoard: profile.educationBoard || "",
                            state: profile.state || "",
                            district: profile.district || "",
                            subjects: profile.subjects || [],
                            gradeLevels: profile.gradeLevels || [],
                            preferredLanguage: (profile.preferredLanguage as Language) || prev.preferredLanguage,
                            administrativeRole: (profile.administrativeRole as AdministrativeRole | undefined),
                            phoneNumber: authPhone,
                            pincode: profile.pincode || "",
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
                    // Smart default — only when the profile has no
                    // explicit preferredLanguage yet. If `navigator.language`
                    // reports an Indic locale we pre-select the matching
                    // option so the teacher only confirms instead of typing.
                    if (!profile?.preferredLanguage && typeof navigator !== 'undefined') {
                        const nav = navigator.language || '';
                        const prefix = nav.toLowerCase().split('-')[0];
                        const mapped = LANGUAGE_CODE_MAP[prefix];
                        if (mapped) {
                            setFormData(prev => ({ ...prev, preferredLanguage: mapped }));
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

    const handleRoleSelect = (role: AdministrativeRole) => {
        setFormData(prev => ({ ...prev, administrativeRole: role }));
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
                displayName: formData.displayName.trim(),
                schoolName: formData.schoolName,
                schoolNormalized: formData.schoolName.toUpperCase().trim(),
                educationBoard: formData.educationBoard || undefined,
                // QA #9 — persist the canonical typed board so AI tools can
                // default to a board-aligned context. Mirrors educationBoard
                // (same picker); kept as a typed EducationBoard field.
                preferredBoard: (EDUCATION_BOARDS as readonly string[]).includes(formData.educationBoard)
                    ? (formData.educationBoard as EducationBoard)
                    : undefined,
                state: formData.state || undefined,
                district: formData.district || undefined,
                subjects: formData.subjects,
                gradeLevels: formData.gradeLevels,
                preferredLanguage: formData.preferredLanguage,
                ...(formData.phoneNumber.trim() ? { phoneNumber: formData.phoneNumber.trim() } : {}),
                ...(formData.pincode.trim() ? { pincode: formData.pincode.trim() } : {}),
                communityIntroState: 'none',
                // NOTE: impactScore / contentSharedCount / followersCount /
                // followingCount / verifiedStatus / badges are SERVER-COMPUTED
                // aggregates. New-user defaults are initialized in
                // POST /api/user/profile (see route.ts isNewUser branch). They
                // are intentionally not written from the client and are not
                // in the PROFILE_WRITABLE_FIELDS allowlist.
                onboardingPhase: 'first-generation',
                // profileCompletionLevel is server-computed in updateProfileAction.
            };

            // Only include administrativeRole when set; Firestore's Admin SDK rejects
            // undefined field writes by default (ignoreUndefinedProperties is not enabled).
            if (formData.administrativeRole !== undefined) {
                profileData.administrativeRole = formData.administrativeRole;
            }

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
                title: t("Setup Failed"),
                description: t("Could not save your profile. Please try again."),
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

    // Finish onboarding — save generated content to library if present, then route based on role.
    // Principals and vice-principals go to the organization dashboard; everyone else goes home.
    const handleFinish = async () => {
        if (!userId) { router.push("/"); return; }

        const updates: Record<string, any> = { onboardingPhase: 'completed' };

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

        // Issue the profile-complete cookie so the middleware redirect
        // guard doesn't bounce us straight back here. Server validates
        // the actual completion ≥ 80 before setting the cookie.
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch('/api/profile/mark-complete', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
        } catch {
            // Non-fatal — user just won't have the cookie and will be
            // redirected on next page load. They'll get it on retry.
        }

        const isPrincipalRole = formData.administrativeRole === 'principal' || formData.administrativeRole === 'vice_principal';
        if (isPrincipalRole) {
            router.push("/organization/dashboard");
        } else {
            router.push("/");
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">{t("Loading...")}</p>
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
                                    placeholder={t("Enter a topic...")}
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
                                        {t("Created successfully! You can view and edit this from your library.")}
                                    </p>
                                </div>
                            )}

                            {generationError && (
                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                                    <p className="text-sm text-destructive">
                                        Could not generate. Don&apos;t worry, you can create content anytime from the home page.
                                    </p>
                                    <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-2 rounded-xl">
                                        {t("Try again")}
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

    // Step 1 — Single-screen setup (Role + School + State + Board + Subjects + Grades)
    const isStep1Valid =
        formData.administrativeRole !== undefined &&
        formData.displayName.trim().length >= 2 &&
        formData.schoolName.trim() &&
        formData.state &&
        formData.educationBoard &&
        formData.subjects.length > 0 &&
        formData.gradeLevels.length > 0 &&
        !phoneError &&
        !pincodeError;

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
                    {/* Section 0: Your role at school */}
                    <div ref={el => { sectionRefs.current[0] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 0 ? -1 : 0)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">{t("Your role at school")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.administrativeRole !== undefined && activeSection !== 0 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {t(ROLE_LABEL[formData.administrativeRole])}
                                    </span>
                                )}
                                {formData.administrativeRole !== undefined ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 0 && "rotate-180")} />
                                )}
                            </div>
                        </button>
                        {activeSection === 0 && (
                            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label={t("Select your role at school")}>
                                    {ROLE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleRoleSelect(opt.value)}
                                            aria-pressed={formData.administrativeRole === opt.value}
                                            className={cn(
                                                "p-3 text-left rounded-xl border transition-all",
                                                formData.administrativeRole === opt.value
                                                    ? "bg-primary/5 border-primary shadow-soft"
                                                    : "bg-card border-border hover:border-primary/50 hover:shadow-soft"
                                            )}
                                        >
                                            <div className="text-sm font-semibold">{t(opt.label)}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{t(opt.hint)}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 1: School & State */}
                    <div ref={el => { sectionRefs.current[1] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 1 ? -1 : 1)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">{t("School / Institution Name")} & {t("State")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.schoolName.trim() && formData.state && activeSection !== 1 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{formData.schoolName.split(' ').slice(0,2).join(' ')}, {tState(formData.state, formData.preferredLanguage)}</span>
                                )}
                                {formData.schoolName.trim() && formData.state ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 1 && "rotate-180")} />
                                )}
                            </div>
                        </button>
                        {activeSection === 1 && (
                            <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-1.5">
                                    <Label htmlFor="displayName" className="text-xs">{t("Your name")}*</Label>
                                    <Input
                                        id="displayName"
                                        placeholder={t("e.g. Anita Sharma")}
                                        value={formData.displayName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                        className="h-11 text-sm shadow-soft"
                                    />
                                </div>
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

                    {/* Section 2: Education Board */}
                    <div ref={el => { sectionRefs.current[2] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 2 ? -1 : 2)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Education Board")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.educationBoard && activeSection !== 2 && (
                                    <span className="text-xs text-muted-foreground">{formData.educationBoard}</span>
                                )}
                                {formData.educationBoard ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 2 && "rotate-180")} />
                                )}
                            </div>
                        </button>
                        {activeSection === 2 && (
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
                                    <p className="text-xs text-muted-foreground mt-2">{t("Selected:")} {formData.educationBoard}</p>
                                )}
                                {formData.boardCategory === 'state_board' && !formData.state && (
                                    <p className="text-xs text-destructive mt-2">{t("Please select your state first.")}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 3: Subjects */}
                    <div ref={el => { sectionRefs.current[3] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 3 ? -1 : 3)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Subjects")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.subjects.length > 0 && activeSection !== 3 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {formData.subjects.slice(0, 2).map(s => tSubject(s, formData.preferredLanguage)).join(', ')}{formData.subjects.length > 2 ? ` +${formData.subjects.length - 2}` : ''}
                                    </span>
                                )}
                                {formData.subjects.length > 0 ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 3 && "rotate-180")} />
                                )}
                            </div>
                        </button>
                        {activeSection === 3 && (
                            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2" role="group" aria-label={t("Select your subjects")}>
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

                    {/* Section 4: Grade Levels */}
                    <div ref={el => { sectionRefs.current[4] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 4 ? -1 : 4)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Classes")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.gradeLevels.length > 0 && activeSection !== 4 && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {formData.gradeLevels.slice(0, 3).join(', ')}{formData.gradeLevels.length > 3 ? ` +${formData.gradeLevels.length - 3}` : ''}
                                    </span>
                                )}
                                {formData.gradeLevels.length > 0 ? (
                                    <Check className="h-4 w-4 text-primary" />
                                ) : (
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 4 && "rotate-180")} />
                                )}
                            </div>
                        </button>
                        {activeSection === 4 && (
                            <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2" role="group" aria-label={t("Select your classes")}>
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

                    {/* Section 5: Optional — phone, pincode, detect location */}
                    <div ref={el => { sectionRefs.current[5] = el; }} className="rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveSection(activeSection === 5 ? -1 : 5)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{t("Contact & location (optional)")}</span>
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activeSection === 5 && "rotate-180")} />
                        </button>
                        {activeSection === 5 && (
                            <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone" className="text-xs">{t("Mobile number")}</Label>
                                    <div className="flex gap-2 items-stretch">
                                        <div className="flex items-center px-3 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground select-none">+91</div>
                                        <Input
                                            id="phone"
                                            inputMode="tel"
                                            placeholder="9876543210"
                                            value={formData.phoneNumber.replace(/^\+?91/, '')}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                setFormData(prev => ({ ...prev, phoneNumber: digits ? `+91${digits}` : "" }));
                                                if (digits.length > 0 && digits.length < 10) {
                                                    setPhoneError(t("Please enter a 10-digit number"));
                                                } else {
                                                    setPhoneError(null);
                                                }
                                            }}
                                            className="h-11 text-sm shadow-soft flex-1"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("Optional. Used for parent SMS only. Never shared.")}</p>
                                    {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="pincode" className="text-xs">{t("Pincode")}</Label>
                                    <Input
                                        id="pincode"
                                        inputMode="numeric"
                                        placeholder="560001"
                                        value={formData.pincode}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setFormData(prev => ({ ...prev, pincode: digits }));
                                            if (digits.length > 0 && digits.length < 6) {
                                                setPincodeError(t("Please enter a 6-digit pincode"));
                                            } else {
                                                setPincodeError(null);
                                            }
                                        }}
                                        className="h-11 text-sm shadow-soft"
                                    />
                                    <p className="text-xs text-muted-foreground">{t("We use this to suggest content for your region.")}</p>
                                    {pincodeError && <p className="text-xs text-destructive">{pincodeError}</p>}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={detectLocation}
                                    disabled={detectingLocation}
                                    className="rounded-xl gap-2"
                                >
                                    {detectingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                                    {t("Detect my location")}
                                </Button>
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
