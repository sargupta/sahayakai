"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LibraryCard } from "./library-card";
import { BaseContent, ContentType } from "@/types";
import { Loader2, Search, FilterX, Grid, List as ListIcon, BookOpen, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";

interface ContentGalleryProps {
    userId: string;
    initialType?: ContentType;
    onCountChange?: (count: number) => void;
}

export function ContentGallery({ userId, initialType, onCountChange }: ContentGalleryProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { t } = useLanguage();
    const [items, setItems] = useState<BaseContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalFetched, setTotalFetched] = useState(0);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const fetchPage = async (cursor?: string) => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        if (!cursor) setLoading(true);
        else setLoadingMore(true);

        try {
            const url = new URL("/api/content/list", window.location.origin);
            if (typeFilter !== "all") url.searchParams.append("type", typeFilter);
            if (cursor) url.searchParams.append("cursor", cursor);

            const token = await user.getIdToken();
            const response = await fetch(url.toString(), {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    openAuthModal();
                    throw new Error("Please sign in to view your library");
                }
                throw new Error("Failed to fetch library content");
            }

            const data = await response.json();
            if (cursor) {
                // Append — but local search filter means we always show all fetched items
                setItems(prev => {
                    const merged = [...prev, ...(data.items ?? [])];
                    setTotalFetched(merged.length);
                    if (onCountChange) onCountChange(merged.length);
                    return merged;
                });
            } else {
                setItems(data.items ?? []);
                setTotalFetched(data.items?.length ?? 0);
                if (onCountChange) onCountChange(data.items?.length ?? 0);
            }
            setNextCursor(data.nextCursor ?? null);
        } catch (error: any) {
            toast({
                title: t("Error"),
                description: error.message || t("Could not load library. Please try again."),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            setItems([]);
            setNextCursor(null);
            fetchPage();
        }
    }, [typeFilter, userId, authLoading, user]);

    const filteredItems = items.filter(item =>
        (item.title || "").toLowerCase().includes(query.toLowerCase()) ||
        (item.topic || "").toLowerCase().includes(query.toLowerCase())
    );
    const hasMore = nextCursor !== null;

    const handleDelete = async (resource: BaseContent) => {
        try {
            const token = await user?.getIdToken();
            if (!token) throw new Error("Authentication required");

            const response = await fetch(`/api/content/delete?id=${resource.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to delete");
            }

            // Optimistically remove from local state
            setItems(prev => prev.filter(item => item.id !== resource.id));
            if (onCountChange) {
                onCountChange(items.length - 1);
            }
            toast({ title: t("Deleted"), description: `"${resource.title}" ${t("removed from your library.")}` });
        } catch (error: any) {
            toast({
                title: t("Delete Failed"),
                description: error.message || t("Could not delete item."),
                variant: "destructive"
            });
        }
    };

    const handleOpen = (resource: BaseContent) => {
        const routeMap: Record<string, string> = {
            "lesson-plan": "/lesson-plan",
            "quiz": "/quiz-generator",
            "worksheet": "/worksheet-wizard",
            "rubric": "/rubric-generator",
            "virtual-field-trip": "/virtual-field-trip",
            "visual-aid": "/visual-aid-designer",
            "instant-answer": "/instant-answer",
            "teacher-training": "/teacher-training",
            // NCERT-demo 2026-05-20 — missing routes were producing 404 on
            // library card click. /library route does not exist in app/, so
            // the fallback was a dead-end. These types each have a generator
            // page that accepts ?id= and re-hydrates the saved artefact.
            "exam-paper": "/exam-paper",
            "video-storyteller": "/video-storyteller",
            "assessment-scanner": "/assessment-scanner",
            "assessment": "/assessment-scanner",
            "assessment-submission": "/assessment-scanner",
            "micro-lesson": "/lesson-plan",
        };

        const baseUrl = routeMap[resource.type];
        if (!baseUrl) {
            toast({
                title: t("Cannot open this item"),
                description: `${t("Resource type")} "${resource.type}" ${t("does not have a viewer yet. Use Download to export it.")}`,
                variant: "destructive",
            });
            return;
        }
        router.push(`${baseUrl}?id=${resource.id}`);
    };

    const handleDownload = async (resource: BaseContent) => {
        try {
            // Priority 1: Client-Side Export (formatted HTML, print-to-PDF ready)
            // If we have the data locally, open a print-formatted HTML in a new
            // window and auto-trigger the browser's print dialog. The teacher
            // gets a Save-as-PDF flow in two clicks instead of receiving a raw
            // JSON file. NCERT-demo 2026-05-20 — list extended to include
            // exam-paper, video-storyteller, virtual-field-trip,
            // assessment-scanner. Visual aids stay on the server-side path
            // (binary image, served via signed URL).
            const HTML_PRINTABLE_TYPES = new Set([
                'lesson-plan', 'quiz', 'worksheet', 'rubric', 'micro-lesson',
                'exam-paper', 'video-storyteller', 'virtual-field-trip',
                'teacher-training', 'instant-answer',
                'assessment', 'assessment-submission', 'assessment-scanner',
            ]);
            if (resource.data && HTML_PRINTABLE_TYPES.has(resource.type)) {
                toast({
                    title: t("Preparing PDF..."),
                    description: `${t("Opening print dialog for")} ${resource.title}. ${t("Choose \"Save as PDF\" in the print menu.")}`,
                });

                const blob = createDownloadableContent(resource.data, resource.type);
                const url = URL.createObjectURL(blob);

                // Open in a new tab and auto-trigger print. User picks
                // "Save as PDF" from the browser print dialog. Works on
                // every desktop browser + iOS Safari Share -> Print.
                const printWindow = window.open(url, '_blank');
                if (printWindow) {
                    printWindow.addEventListener('load', () => {
                        try {
                            printWindow.print();
                        } catch {
                            // print() can be blocked in some sandbox modes;
                            // the tab still shows the rendered content so the
                            // user can hit Ctrl/Cmd+P manually.
                        }
                    });
                } else {
                    // Popup blocked — fall back to direct download
                    const cleanTitle = (resource.title || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Untitled';
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `SahayakAI_${cleanTitle}.html`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({
                        title: t("Popup blocked"),
                        description: t("Saved as HTML instead. Open the file and press Ctrl/Cmd+P to save as PDF."),
                    });
                }

                return;
            }

            // Priority 2: Server-Side Download (Binary files or Missing Data)
            // Use this for Visual Aids (images) or if local data is incomplete
            toast({
                title: t("Download Started"),
                description: `${t("Fetching secure link for")} ${resource.title || t("content")}...`
            });

            const token = await user?.getIdToken();
            if (!token) throw new Error("Authentication required");

            const response = await fetch(`/api/content/download?id=${resource.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to generate download link");
            }

            const { downloadUrl, filename } = await response.json();

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename || '');
            link.setAttribute('target', '_blank');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: t("Download Ready"),
                description: t("Your file is downloading."),
            });

        } catch (error: any) {
            toast({
                title: t("Download Failed"),
                description: error.message || t("Could not retrieve file."),
                variant: "destructive"
            });
        }
    };

    const createDownloadableContent = (content: any, type: string): Blob => {
        // Create HTML content for download
        let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${content.title || content.topic || 'Content'}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { margin-top: 20px; }
        pre { background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; overflow-x: auto; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <h1>${content.title || content.topic || 'Content'}</h1>
    <div class="metadata">
        <p><strong>Type:</strong> ${type}</p>
        ${content.grade_level ? `<p><strong>Class:</strong> ${content.grade_level}</p>` : ''}
        ${content.language ? `<p><strong>Language:</strong> ${content.language}</p>` : ''}
        ${content.subject ? `<p><strong>Subject:</strong> ${content.subject}</p>` : ''}
    </div>
    <div class="content">
        ${formatContentByType(content, type)}
    </div>
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; color: #7f8c8d; font-size: 0.9em;">
        <p>Generated by SahayakAI | ${new Date().toLocaleDateString()}</p>
    </footer>
</body>
</html>`;

        return new Blob([htmlContent], { type: 'text/html' });
    };

    const formatContentByType = (content: any, type: string): string => {
        switch (type) {
            case 'lesson-plan':
                return formatLessonPlan(content);
            case 'quiz':
                return formatQuiz(content);
            case 'worksheet':
                return formatWorksheet(content);
            case 'rubric':
                return formatRubric(content);
            default:
                return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
        }
    };

    const formatLessonPlan = (content: any): string => {
        let html = '';
        if (content.sections) {
            content.sections.forEach((section: any) => {
                html += `<h2>${section.heading || section.title}</h2>`;
                html += `<div>${section.content || section.body || ''}</div>`;
            });
        }
        return html || `<div>${JSON.stringify(content, null, 2)}</div>`;
    };

    const formatQuiz = (content: any): string => {
        let html = '<div>';
        if (content.questions && Array.isArray(content.questions)) {
            content.questions.forEach((q: any, i: number) => {
                html += `<h3>Question ${i + 1}</h3>`;
                html += `<p>${q.question}</p>`;
                if (q.options) {
                    html += '<ul>';
                    q.options.forEach((opt: string) => {
                        html += `<li>${opt}</li>`;
                    });
                    html += '</ul>';
                }
                if (q.answer) {
                    html += `<p><strong>Answer:</strong> ${q.answer}</p>`;
                }
            });
        }
        html += '</div>';
        return html;
    };

    const formatWorksheet = (content: any): string => {
        // Similar to quiz formatting
        return formatQuiz(content);
    };

    const formatRubric = (content: any): string => {
        let html = '<div>';
        if (content.criteria && Array.isArray(content.criteria)) {
            html += '<table border="1" cellpadding="10" style="width:100%; border-collapse: collapse;">';
            html += '<thead><tr><th>Criteria</th><th>Description</th></tr></thead><tbody>';
            content.criteria.forEach((criterion: any) => {
                html += `<tr><td>${criterion.name || criterion.title}</td><td>${criterion.description || ''}</td></tr>`;
            });
            html += '</tbody></table>';
        }
        html += '</div>';
        return html;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/40 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search your library..."
                        className="pl-10 bg-white border-slate-200"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search your library"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full md:w-48 bg-white border-slate-200">
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Resources</SelectItem>
                            <SelectItem value="lesson-plan">Lesson Plans</SelectItem>
                            <SelectItem value="quiz">Quizzes</SelectItem>
                            <SelectItem value="worksheet">Worksheets</SelectItem>
                            <SelectItem value="visual-aid">Visual Aids</SelectItem>
                            <SelectItem value="rubric">Rubrics</SelectItem>
                            <SelectItem value="virtual-field-trip">Field Trips</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-white">
                        <Button
                            variant={viewMode === "grid" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => setViewMode("grid")}
                            aria-label="Grid view"
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "list" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => setViewMode("list")}
                            aria-label="List view"
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary/60" />
                    <p className="text-slate-500 font-medium animate-pulse">Fetching your creative workspace...</p>
                </div>
            ) : filteredItems.length > 0 ? (
                <div className="space-y-6">
                <div className={cn(
                    "grid gap-6",
                    viewMode === "grid"
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-1"
                )}>
                    {filteredItems.map(item => (
                        <LibraryCard
                            key={item.id}
                            resource={item}
                            onOpen={handleOpen}
                            onDownload={handleDownload}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
                {hasMore && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={() => fetchPage(nextCursor!)}
                            disabled={loadingMore}
                            className="gap-2"
                        >
                            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Load more
                        </Button>
                    </div>
                )}
                </div>
            ) : query || typeFilter !== "all" ? (
                <EmptyState
                    icon={FilterX}
                    title={t("No resources match those filters")}
                    description={t("Try adjusting your filters or clearing them to see everything.")}
                    cta={{
                        label: t("Clear all filters"),
                        onClick: () => { setQuery(""); setTypeFilter("all"); },
                    }}
                />
            ) : (
                <EmptyState
                    icon={BookOpen}
                    title={t("Your library is empty")}
                    description={t("Lesson plans, quizzes, worksheets, and more will appear here once you create them. Tap below to create your first.")}
                    sample={
                        <div className="flex items-start gap-3 text-left">
                            <div className="h-10 w-10 rounded-surface-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 min-w-0">
                                <div className="font-headline font-semibold text-sm text-foreground">
                                    {t("Photosynthesis — Class 8 Science")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t("Lesson Plan")} · 45 min · {t("English")} · 3 {t("days ago")}
                                </div>
                            </div>
                        </div>
                    }
                    cta={{
                        label: t("Create your first lesson plan"),
                        href: "/lesson-plan",
                    }}
                    secondaryCta={{
                        label: t("Browse community library"),
                        href: "/community-library",
                    }}
                />
            )}
        </div>
    );
}
