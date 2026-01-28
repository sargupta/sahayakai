"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { generateLessonPlan, LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import { type NCERTChapter } from "@/data/ncert";
import { type ResourceLevel } from "@/components/resource-selector";
import { type DifficultyLevel } from "@/components/difficulty-selector";
import { type QuickTemplate } from "@/data/quick-templates";
import { offlineLessonPlans } from "@/data/offline-lesson-plans";
import { getCachedLessonPlan, saveLessonPlanToCache } from "@/app/actions/lesson-plan";
import { saveDraft, getDraft, saveCache, getCache, logEvent, getPendingEvents, clearEvent } from "@/lib/indexed-db";
import { logger } from "@/lib/logger";
import { syncTelemetryEvents } from "@/app/actions/telemetry";
import { formSchema, FormValues, topicPlaceholderTranslations } from "../types";
import { checkRateLimit, validateTopicSafety } from "@/lib/safety";
import { useSearchParams } from "next/navigation";

export function useLessonPlan() {
    const [lessonPlan, setLessonPlan] = useState<LessonPlanOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [selectedChapter, setSelectedChapter] = useState<NCERTChapter | null>(null);
    const [resourceLevel, setResourceLevel] = useState<ResourceLevel>('low');
    const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('standard');
    const [isOffline, setIsOffline] = useState(false);
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            topic: "",
            language: "en",
            gradeLevels: ["6th Grade"],
            imageDataUri: "",
        },
    });

    const selectedLanguage = form.watch("language") || 'en';
    const selectedGradeLevels = form.watch("gradeLevels");
    const topicPlaceholder = topicPlaceholderTranslations[selectedLanguage] || topicPlaceholderTranslations.en;

    // Extract numeric grade from string (e.g., "6th Grade" -> 6)
    const getNumericGrade = (grades?: string[]) => {
        if (!grades || grades.length === 0) return undefined;
        const match = grades[0].match(/(\d+)/);
        return match ? parseInt(match[1]) : undefined;
    };

    const currentGrade = getNumericGrade(selectedGradeLevels);

    // Network Status & Telemetry Sync
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOffline(!navigator.onLine);
        }

        const handleOnline = async () => {
            setIsOffline(false);
            toast({ title: "Back Online", description: "You are connected to the internet." });

            // Sync Telemetry
            try {
                const pending = await getPendingEvents();
                if (pending.length > 0) {
                    const events = pending.map(p => p.value);
                    const result = await syncTelemetryEvents(events);
                    if (result.success) {
                        await Promise.all(pending.map(p => clearEvent(p.key)));
                        console.log(`Synced ${pending.length} telemetry events`);
                    }
                }
            } catch (e) {
                console.error("Sync failed", e);
            }
        };

        const handleOffline = () => {
            setIsOffline(true);
            toast({ title: "You are Offline", description: "Using offline mode. AI features limited.", variant: "destructive" });
            logEvent({ type: 'offline_mode_active', timestamp: Date.now() });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [toast]);

    // Auto-save draft (IndexedDB)
    useEffect(() => {
        const subscription = form.watch(async (value) => {
            if (typeof window !== 'undefined') {
                try {
                    await saveDraft("lessonPlanDraft", value);
                } catch (e) {
                    console.error("Failed to save draft", e);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form.watch]);

    // Load draft (IndexedDB)
    useEffect(() => {
        const loadDraft = async () => {
            if (typeof window !== 'undefined') {
                try {
                    const savedDraft = await getDraft("lessonPlanDraft");
                    if (savedDraft && savedDraft.topic) {
                        form.reset(savedDraft);
                        toast({
                            title: "Draft Restored",
                            description: "We restored your previous work from secure storage.",
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse draft", e);
                }
            }
        };
        loadDraft();
    }, []);

    const searchParams = useSearchParams();

    // Auto-Execution from URL
    useEffect(() => {
        const topicParam = searchParams.get("topic");
        if (topicParam) {
            form.setValue("topic", topicParam);
            // Wait for form state update
            setTimeout(() => {
                form.handleSubmit(onSubmit)();
            }, 0);
        }
    }, [searchParams, form]);

    const onSubmit = async (values: FormValues) => {
        setIsLoading(true);
        setLessonPlan(null);

        // 0. SAFETY CHECKS
        const rateLimit = checkRateLimit();
        if (!rateLimit.allowed) {
            const minutes = Math.ceil((rateLimit.waitTime || 0) / 60000);
            toast({
                title: "Slow Down, Teacher! ☕",
                description: `You've created a lot of content recently. Please take a ${minutes} minute break.`,
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        const safetyCheck = validateTopicSafety(values.topic);
        if (!safetyCheck.safe) {
            toast({
                title: "Topic Rejected",
                description: "This topic violates our content safety policy. Please try something educational.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        const cacheKey = `cache_lp_${values.topic.trim().toLowerCase()}_${values.gradeLevels?.[0] || 'default'}_${values.language || 'en'}`;

        // 1. SEMANTIC CACHE CHECK (IndexedDB - Layer 1)
        if (typeof window !== 'undefined') {
            try {
                const cachedPlan = await getCache(cacheKey);
                if (cachedPlan) {
                    setTimeout(() => {
                        setLessonPlan(cachedPlan);
                        setIsLoading(false);
                        setLoadingMessage("");
                        toast({
                            title: "⚡ Instant Load",
                            description: "Loaded from local DB cache.",
                            className: "bg-green-50 border-green-200 text-green-800",
                        });
                    }, 300);
                    return;
                }
            } catch (e) {
                console.error("Cache fetch error", e);
            }
        }

        // 2. CLOUD CACHE CHECK (Community Cache - Layer 2)
        if (!isOffline) {
            try {
                const cloudCachedPlan = await getCachedLessonPlan(
                    values.topic,
                    values.gradeLevels?.[0] || 'default',
                    values.language || 'en'
                );

                if (cloudCachedPlan) {
                    setLessonPlan(cloudCachedPlan);
                    setIsLoading(false);
                    setLoadingMessage("");
                    toast({
                        title: "☁️ Community Cache",
                        description: "Found a plan shared by another teacher!",
                        className: "bg-blue-50 border-blue-200 text-blue-800",
                    });
                    if (typeof window !== 'undefined') {
                        await saveCache(cacheKey, cloudCachedPlan);
                    }
                    return;
                }
            } catch (e) {
                console.error("Cloud cache check failed", e);
            }
        }

        // OFFLINE MODE HANDLER
        if (isOffline) {
            if (selectedChapter && offlineLessonPlans[selectedChapter.id]) {
                setTimeout(() => {
                    setLessonPlan(offlineLessonPlans[selectedChapter.id]);
                    setIsLoading(false);
                    setLoadingMessage("");
                    toast({
                        title: "Offline Plan Loaded",
                        description: "Loaded pre-written lesson plan from device.",
                    });
                }, 500);
                return;
            } else {
                setIsLoading(false);
                setLoadingMessage("");
                toast({
                    title: "Offline Mode",
                    description: "No pre-downloaded plan found for this chapter. Please connect to internet to generate new plans.",
                    variant: "destructive",
                });
                return;
            }
        }

        try {
            setLoadingMessage("Analyzing your topic...");
            await new Promise(r => setTimeout(r, 800)); // UX Pause
            setLoadingMessage("Consulting Indian Context Database...");

            const result = await generateLessonPlan({
                topic: values.topic,
                language: values.language,
                gradeLevels: values.gradeLevels,
                imageDataUri: values.imageDataUri,
                useRuralContext: true,
                resourceLevel: resourceLevel,
                difficultyLevel: difficultyLevel,
                ncertChapter: selectedChapter ? {
                    title: selectedChapter.title,
                    number: selectedChapter.number,
                    learningOutcomes: selectedChapter.learningOutcomes,
                } : undefined,
            });
            setLessonPlan(result);

            if (typeof window !== 'undefined') {
                await saveCache(cacheKey, result);
            }

            if (!isOffline) {
                saveLessonPlanToCache(
                    result,
                    values.topic,
                    values.gradeLevels?.[0] || 'default',
                    values.language || 'en'
                );
            }
        } catch (error) {
            console.error("Failed to generate lesson plan:", error);
            toast({
                title: "Generation Failed",
                description: "There was an error generating the lesson plan. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false); // Ensure loader always turns off
        }
    };

    const handleTranscript = (transcript: string) => {
        form.setValue("topic", transcript);
        form.trigger("topic");
    };

    const handlePromptClick = (prompt: string) => {
        form.setValue("topic", prompt);
        form.trigger("topic");
    };

    const handleTemplateSelect = (template: QuickTemplate) => {
        form.setValue("topic", template.topic);
        form.setValue("gradeLevels", [template.gradeLevel]);
        setSelectedChapter(null);
        form.trigger("topic");

        toast({
            title: "Template Selected",
            description: `Loaded template: ${template.title}`,
        });
    };

    return {
        form,
        onSubmit,
        lessonPlan,
        isLoading,
        loadingMessage,
        isOffline,
        selectedChapter,
        setSelectedChapter,
        resourceLevel,
        setResourceLevel,
        difficultyLevel,
        setDifficultyLevel,
        currentGrade,
        selectedLanguage,
        topicPlaceholder,
        handleTranscript,
        handlePromptClick,
        handleTemplateSelect,
    };
}
