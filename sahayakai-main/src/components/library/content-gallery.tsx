"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LibraryCard } from "./library-card";
import { BaseContent, ContentType } from "@/types";
import { Loader2, Search, FilterX, Grid, List as ListIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

interface ContentGalleryProps {
    userId: string;
    initialType?: ContentType;
    onCountChange?: (count: number) => void;
}

export function ContentGallery({ userId, initialType, onCountChange }: ContentGalleryProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const [items, setItems] = useState<BaseContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const fetchContent = async () => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const url = new URL("/api/content/list", window.location.origin);
            if (typeFilter !== "all") url.searchParams.append("type", typeFilter);

            const token = await user.getIdToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            };

            const response = await fetch(url.toString(), {
                headers: headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    openAuthModal();
                    throw new Error("Please sign in to view your library");
                }
                throw new Error("Failed to fetch library content");
            }

            const data = await response.json();
            setItems(data.items);
            if (onCountChange) {
                onCountChange(data.items?.length || 0);
            }
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error.message || "Could not load library. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            fetchContent();
        }
    }, [typeFilter, userId, authLoading, user]);

    const filteredItems = items.filter(item =>
        (item.title || "").toLowerCase().includes(query.toLowerCase()) ||
        (item.topic || "").toLowerCase().includes(query.toLowerCase())
    );

    const handleOpen = (resource: BaseContent) => {
        const routeMap: Record<string, string> = {
            "lesson-plan": "/lesson-plan-generator",
            "quiz": "/quiz-generator",
            "worksheet": "/worksheet-wizard",
            "rubric": "/rubric-generator",
            "virtual-field-trip": "/virtual-field-trip",
            "visual-aid": "/visual-aid-designer",
            "instant-answer": "/instant-answer"
        };

        const baseUrl = routeMap[resource.type] || "/library";
        router.push(`${baseUrl}?id=${resource.id}`);
    };

    const handleDownload = async (resource: BaseContent) => {
        try {
            const renderableTypes = ['lesson-plan', 'quiz', 'worksheet', 'rubric', 'micro-lesson'];

            // Priority 1: Renderable Content (Fetch & generate PDF)
            if (renderableTypes.includes(resource.type)) {
                let contentData = resource.data;

                // 1. Fetch full data if missing
                if (!contentData) {
                    toast({
                        title: "Preparing Download",
                        description: `Retrieving full content for ${resource.title}...`
                    });

                    const token = await user?.getIdToken();
                    if (!token) throw new Error("Authentication required");

                    const response = await fetch(`/api/content/get?id=${resource.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || "Failed to fetch content details");
                    }

                    const fullResource = await response.json();
                    contentData = fullResource.data || fullResource;
                }

                // 2. Generate PDF
                if (contentData) {
                    toast({
                        title: "Generating PDF...",
                        description: "This may take a moment."
                    });

                    // Generate HTML content for PDF body
                    const contentHtml = createDownloadableContent(contentData, resource.type);

                    // Create hidden container for rendering
                    const container = document.createElement('div');
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    container.style.top = '0';
                    container.style.width = '210mm'; // A4 width
                    container.style.minHeight = '297mm'; // A4 height
                    container.style.padding = '20mm';
                    container.style.backgroundColor = '#ffffff';
                    container.style.fontFamily = 'Arial, sans-serif';
                    container.style.color = '#000000';

                    // Add Title and Metadata
                    const headerHtml = `
                        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #333;">${resource.title}</h1>
                        <div style="margin-bottom: 20px; font-size: 12px; color: #666;">
                            Generated by SahayakAI • ${new Date().toLocaleDateString()}
                            ${resource.gradeLevel ? `• ${resource.gradeLevel}` : ''}
                            ${resource.subject ? `• ${resource.subject}` : ''}
                            ${resource.type ? `• ${resource.type}` : ''}
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 30px;">
                    `;

                    container.innerHTML = headerHtml + contentHtml;
                    document.body.appendChild(container);

                    try {
                        const canvas = await html2canvas(container, {
                            scale: 2, // Retina quality
                            useCORS: true,
                            logging: false
                        });

                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: 'a4'
                        });

                        const imgWidth = 210;
                        const pageHeight = 297;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        let heightLeft = imgHeight;
                        let position = 0;

                        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;

                        while (heightLeft >= 0) {
                            position = heightLeft - imgHeight;
                            pdf.addPage();
                            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                            heightLeft -= pageHeight;
                        }

                        const cleanTitle = (resource.title || 'Untitled').replace(/[^a-z0-9]/gi, '_');
                        pdf.save(`SahayakAI_${cleanTitle}.pdf`);

                        toast({
                            title: "Export Complete",
                            description: "PDF downloaded successfully.",
                        });
                    } catch (pdfError) {
                        console.error('PDF Generation failed:', pdfError);
                        throw new Error("Failed to generate PDF document");
                    } finally {
                        document.body.removeChild(container);
                    }
                    return;
                }
            }

            // Priority 2: Binary/Server-Side Download (Visual Aids, etc.)
            toast({
                title: "Download Started",
                description: `Fetching file for ${resource.title || "content"}...`
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

            // Use SDK's promptSaveAs URL directly (no fetch needed)
            const link = document.createElement('a');
            link.href = downloadUrl;
            // No download attribute needed as server sets Content-Disposition
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: "Download Ready",
                description: "Your file is downloading.",
            });

        } catch (error: any) {
            console.error('Download failed:', error);
            toast({
                title: "Download Failed",
                description: error.message || "Could not retrieve file.",
                variant: "destructive"
            });
        }
    };

    const createDownloadableContent = (content: any, type: string): string => {
        let htmlContent = '';
        switch (type) {
            case 'lesson-plan':
                htmlContent = formatLessonPlan(content);
                break;
            case 'quiz':
                htmlContent = formatQuiz(content);
                break;
            case 'worksheet':
                htmlContent = formatWorksheet(content);
                break;
            case 'rubric':
                htmlContent = formatRubric(content);
                break;
            default:
                htmlContent = `<div><pre>${JSON.stringify(content, null, 2)}</pre></div>`;
        }
        return htmlContent;
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

    const renderMarkdown = (text: string | null | undefined) => {
        if (!text) return '';
        return text
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
    };

    const formatLessonPlan = (content: any): string => {
        let html = '';

        // Handle modern structure (Activities, Objectives, etc.)
        if (content.activities || content.objectives) {
            if (content.objectives?.length) {
                html += `<h2>Objectives</h2><ul>`;
                content.objectives.forEach((obj: string) => html += `<li>${renderMarkdown(obj)}</li>`);
                html += `</ul>`;
            }

            if (content.materials?.length) {
                html += `<h2>Materials Needed</h2><ul>`;
                content.materials.forEach((mat: string) => html += `<li>${renderMarkdown(mat)}</li>`);
                html += `</ul>`;
            }

            if (content.activities?.length) {
                html += `<h2>Activities</h2>`;
                content.activities.forEach((act: any) => {
                    html += `<div style="margin-bottom: 20px; padding: 10px; background: #f8f9fa; border-left: 4px solid #3498db;">`;
                    html += `<h3 style="margin-top: 0;">${renderMarkdown(act.name)} <span style="font-weight: normal; font-size: 0.9em; color: #666;">(${act.duration})</span></h3>`;
                    html += `<div>${renderMarkdown(act.description)}</div>`;
                    html += `</div>`;
                });
            }

            if (content.assessment) {
                html += `<h2>Assessment</h2>`;
                html += `<div>${renderMarkdown(content.assessment)}</div>`;
            }
            return html;
        }

        // Fallback to legacy "sections" structure
        if (content.sections) {
            content.sections.forEach((section: any) => {
                html += `<h2>${section.heading || section.title}</h2>`;
                html += `<div>${section.content || section.body || ''}</div>`;
            });
            return html;
        }

        return `<div><pre>${JSON.stringify(content, null, 2)}</pre></div>`;
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
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode("grid")}
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "list" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode("list")}
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
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <FilterX className="h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800">No resources found</h3>
                    <p className="text-slate-500 max-w-xs text-center mt-2">
                        {query || typeFilter !== "all"
                            ? "Try adjusting your filters or search terms."
                            : "Your library is empty. Start generating with SahayakAI!"}
                    </p>
                    <Button
                        variant="outline"
                        className="mt-6"
                        onClick={() => { setQuery(""); setTypeFilter("all"); }}
                    >
                        Clear all filters
                    </Button>
                </div>
            )}
        </div>
    );
}
